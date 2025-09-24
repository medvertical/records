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
  retryStatistics?: {
    totalRetryAttempts: number;
    successfulRetries: number;
    failedRetries: number;
    resourcesWithRetries: number;
    averageRetriesPerResource: number;
  };
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ValidationPollingState {
  isConnected: boolean;
  connectionState: ConnectionState;
  progress: ValidationProgress | null;
  validationStatus: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  lastError: string | null;
  currentServer: { id: number; name: string; url: string } | null;
  connectionAttempts: number;
  lastConnectedAt: Date | null;
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
    enabled = true, // Default to enabled for live updates
    pollInterval = 3000, // Poll every 3 seconds for live updates
    hasActiveServer = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentServer, setCurrentServer] = useState<{ id: number; name: string; url: string } | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const retryDelayRef = useRef(1000); // Start with 1 second delay
  const maxRetryDelay = 30000; // Max 30 seconds delay

  // Fetch validation progress from API with enhanced error handling
  const fetchValidationProgress = useCallback(async (): Promise<ValidationProgress | null> => {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }, 30000); // 30 second timeout

      const response = await fetch('/api/validation/bulk/progress', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

  // Start polling for validation progress with smart frequency adjustment
  const startPolling = useCallback(() => {
    if (isPollingRef.current || !enabled || !hasActiveServer) {
      return;
    }

    console.log('[ValidationPolling] Starting validation progress polling');
    isPollingRef.current = true;
    setConnectionState('connecting');
    setIsConnected(false);
    setLastError(null);
    retryCountRef.current = 0;
    setConnectionAttempts(prev => prev + 1);

    const poll = async () => {
      try {
        const progressData = await fetchValidationProgress();
        
        // Mark as connected on successful fetch
        setConnectionState('connected');
        setIsConnected(true);
        setLastConnectedAt(new Date());
        console.log('[ValidationPolling] Connected successfully');
        
        // Reset retry state on successful connection
        retryCountRef.current = 0;
        retryDelayRef.current = 1000; // Reset to initial delay
        setLastError(null);
        
        if (progressData) {
          setProgress(progressData);
          setValidationStatus(progressData.status);
        } else {
          // No validation in progress
          setProgress(null);
          setValidationStatus('idle');
        }
      } catch (error) {
        console.error('[ValidationPolling] Polling error:', error);
        
        // Handle AbortError gracefully (this is normal during component cleanup)
        if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
          console.log('[ValidationPolling] Request aborted - component cleanup in progress');
          return;
        }
        
        retryCountRef.current++;
        
        // Update connection state to error
        setConnectionState('error');
        setIsConnected(false);
        
        // Enhanced error message with more context
        let errorMessage = 'Failed to fetch validation progress';
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMessage = 'Request timeout - server may be slow to respond';
          } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error - check server connection';
          } else {
            errorMessage = error.message;
          }
        }
        setLastError(`${errorMessage} (attempt ${retryCountRef.current}/${maxRetries})`);
        
        // Implement exponential backoff for retries
        if (retryCountRef.current < maxRetries) {
          const delay = Math.min(retryDelayRef.current * Math.pow(2, retryCountRef.current - 1), maxRetryDelay);
          console.log(`[ValidationPolling] Retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
          
          // Set up retry with exponential backoff
          setTimeout(() => {
            if (isPollingRef.current) {
              poll();
            }
          }, delay);
        } else {
          console.log('[ValidationPolling] Max retries reached, stopping polling');
          stopPolling();
        }
      }
    };

    // Initial fetch
    poll();

    // Set up smart polling interval that adjusts based on validation status
    const setupSmartPolling = () => {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Determine polling frequency based on current status
      let currentInterval = pollInterval;
      if (validationStatus === 'idle' || validationStatus === 'completed') {
        // Reduce frequency when idle (every 10 seconds)
        currentInterval = 10000;
      } else if (validationStatus === 'running' || validationStatus === 'paused') {
        // High frequency when active (every 3 seconds)
        currentInterval = 3000;
      }

      pollingIntervalRef.current = setInterval(poll, currentInterval);
      console.log(`[ValidationPolling] Set polling interval to ${currentInterval}ms for status: ${validationStatus}`);
    };

    // Set up initial polling
    setupSmartPolling();
  }, [enabled, hasActiveServer, pollInterval, fetchValidationProgress, validationStatus]);

  // Stop polling
  const stopPolling = useCallback(() => {
    console.log('[ValidationPolling] Stopping validation progress polling');
    isPollingRef.current = false;
    setConnectionState('disconnected');
    setIsConnected(false);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []); // Empty dependency array since this function doesn't depend on any state

  // Reset progress state
  const resetProgress = useCallback(() => {
    setProgress(null);
    setValidationStatus('idle');
    setLastError(null);
  }, []);

  // Reconnect polling with enhanced retry logic
  const reconnect = useCallback(() => {
    console.log('[ValidationPolling] Reconnecting validation polling');
    stopPolling();
    
    // Reset retry state for manual reconnect
    retryCountRef.current = 0;
    retryDelayRef.current = 1000;
    setLastError(null);
    
    // Start polling after a short delay
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
  }, [enabled, hasActiveServer]); // Removed startPolling and stopPolling dependencies to prevent infinite loops

  // Fetch current server on mount
  useEffect(() => {
    if (hasActiveServer) {
      fetchCurrentServer();
    }
  }, [hasActiveServer]); // Removed fetchCurrentServer dependency

  // Adjust polling frequency based on validation status
  useEffect(() => {
    if (isPollingRef.current && pollingIntervalRef.current) {
      // Clear existing interval
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      
      // Set new interval based on current status
      let newInterval = pollInterval;
      if (validationStatus === 'idle' || validationStatus === 'completed') {
        newInterval = 10000; // 10 seconds when idle
      } else if (validationStatus === 'running' || validationStatus === 'paused') {
        newInterval = 3000; // 3 seconds when active
      }
      
      // Set up new interval
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const progressData = await fetchValidationProgress();
          if (progressData) {
            setProgress(progressData);
            setValidationStatus(progressData.status);
            setLastError(null);
            retryCountRef.current = 0;
          } else {
            setProgress(null);
            setValidationStatus('idle');
            setLastError(null);
          }
        } catch (error) {
          console.error('[ValidationPolling] Polling error:', error);
          
          // Handle AbortError gracefully (this is normal during component cleanup)
          if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
            console.log('[ValidationPolling] Request aborted - component cleanup in progress');
            return;
          }
          
          retryCountRef.current++;
          if (retryCountRef.current >= maxRetries) {
            setLastError(error instanceof Error ? error.message : 'Failed to fetch validation progress');
            setIsConnected(false);
            stopPolling();
          }
        }
      }, newInterval);
      
      console.log(`[ValidationPolling] Adjusted polling interval to ${newInterval}ms for status: ${validationStatus}`);
    }
  }, [validationStatus, pollInterval]); // Removed fetchValidationProgress and stopPolling dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []); // Empty dependency array for cleanup only

  return {
    // State
    isConnected,
    connectionState,
    progress,
    validationStatus,
    lastError,
    currentServer,
    connectionAttempts,
    lastConnectedAt,
    
    // Actions
    startPolling,
    stopPolling,
    resetProgress,
    reconnect,
    syncWithApi
  };
}
