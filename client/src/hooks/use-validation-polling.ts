// ============================================================================
// Validation Polling Hook - Polling-based validation for MVP
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  startTime: Date | null;
  currentResourceType: string | null;
  estimatedTimeRemaining?: number;
  processingRate?: number;
  isComplete?: boolean;
}

export interface ValidationPollingState {
  isConnected: boolean;
  progress: ValidationProgress | null;
  validationStatus: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  lastError: string | null;
  currentServer: { id: number; name: string; url: string } | null;
}

export interface ValidationPollingActions {
  startPolling: () => void;
  stopPolling: () => void;
  resetProgress: () => void;
  reconnect: () => void;
  syncWithApi: () => Promise<void>;
}

export interface UseValidationPollingOptions {
  enabled?: boolean;
  pollInterval?: number;
  hasActiveServer?: boolean;
}

export function useValidationPolling(options: UseValidationPollingOptions = {}): ValidationPollingState & ValidationPollingActions {
  const {
    enabled = true,
    pollInterval = 2000, // Poll every 2 seconds
    hasActiveServer = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentServer, setCurrentServer] = useState<{ id: number; name: string; url: string } | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Fetch validation progress from API
  const fetchValidationProgress = useCallback(async (): Promise<ValidationProgress | null> => {
    try {
      const response = await fetch('/api/validation/bulk/progress', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No validation in progress
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Convert startTime string to Date if it exists
      if (data.startTime) {
        data.startTime = new Date(data.startTime);
      }

      return {
        totalResources: data.totalResources || 0,
        processedResources: data.processedResources || 0,
        validResources: data.validResources || 0,
        errorResources: data.errorResources || 0,
        status: data.status || 'idle',
        startTime: data.startTime || null,
        currentResourceType: data.currentResourceType || null,
        estimatedTimeRemaining: data.estimatedTimeRemaining,
        processingRate: data.processingRate,
        isComplete: data.isComplete || false
      };
    } catch (error) {
      console.error('[ValidationPolling] Failed to fetch validation progress:', error);
      throw error;
    }
  }, []);

  // Fetch current server info
  const fetchCurrentServer = useCallback(async () => {
    try {
      const response = await fetch('/api/fhir/servers');
      if (response.ok) {
        const servers = await response.json();
        const activeServer = servers.find((server: any) => server.isActive);
        if (activeServer) {
          setCurrentServer({
            id: activeServer.id,
            name: activeServer.name,
            url: activeServer.url
          });
        }
      }
    } catch (error) {
      console.error('[ValidationPolling] Failed to fetch current server:', error);
    }
  }, []);

  // Start polling for validation progress
  const startPolling = useCallback(() => {
    if (isPollingRef.current || !enabled || !hasActiveServer) {
      return;
    }

    console.log('[ValidationPolling] Starting validation progress polling');
    isPollingRef.current = true;
    setIsConnected(true);
    setLastError(null);
    retryCountRef.current = 0;

    const poll = async () => {
      try {
        const progressData = await fetchValidationProgress();
        
        if (progressData) {
          setProgress(progressData);
          setValidationStatus(progressData.status);
          setLastError(null);
          retryCountRef.current = 0; // Reset retry count on success
        } else {
          // No validation in progress
          setProgress(null);
          setValidationStatus('idle');
          setLastError(null);
        }
      } catch (error) {
        console.error('[ValidationPolling] Polling error:', error);
        retryCountRef.current++;
        
        if (retryCountRef.current >= maxRetries) {
          setLastError(error instanceof Error ? error.message : 'Failed to fetch validation progress');
          setIsConnected(false);
          stopPolling();
        }
      }
    };

    // Initial fetch
    poll();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(poll, pollInterval);
  }, [enabled, hasActiveServer, pollInterval, fetchValidationProgress]);

  // Stop polling
  const stopPolling = useCallback(() => {
    console.log('[ValidationPolling] Stopping validation progress polling');
    isPollingRef.current = false;
    setIsConnected(false);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Reset progress state
  const resetProgress = useCallback(() => {
    setProgress(null);
    setValidationStatus('idle');
    setLastError(null);
  }, []);

  // Reconnect polling
  const reconnect = useCallback(() => {
    console.log('[ValidationPolling] Reconnecting validation polling');
    stopPolling();
    setTimeout(() => {
      startPolling();
    }, 1000);
  }, [startPolling, stopPolling]);

  // Manual sync with API
  const syncWithApi = useCallback(async () => {
    try {
      const progressData = await fetchValidationProgress();
      if (progressData) {
        setProgress(progressData);
        setValidationStatus(progressData.status);
        setLastError(null);
      } else {
        setProgress(null);
        setValidationStatus('idle');
        setLastError(null);
      }
    } catch (error) {
      console.error('[ValidationPolling] Sync error:', error);
      setLastError(error instanceof Error ? error.message : 'Failed to sync with API');
    }
  }, [fetchValidationProgress]);

  // Auto-start polling when conditions are met
  useEffect(() => {
    if (enabled && hasActiveServer && !isPollingRef.current) {
      startPolling();
    } else if ((!enabled || !hasActiveServer) && isPollingRef.current) {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, hasActiveServer]); // Removed startPolling and stopPolling dependencies

  // Fetch current server on mount
  useEffect(() => {
    if (hasActiveServer) {
      fetchCurrentServer();
    }
  }, [hasActiveServer]); // Removed fetchCurrentServer dependency

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []); // Empty dependency array for cleanup only

  return {
    // State
    isConnected,
    progress,
    validationStatus,
    lastError,
    currentServer,
    
    // Actions
    startPolling,
    stopPolling,
    resetProgress,
    reconnect,
    syncWithApi
  };
}
