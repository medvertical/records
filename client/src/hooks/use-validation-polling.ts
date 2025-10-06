// ============================================================================
// Validation Polling Hook - Polling-based validation for MVP
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ValidationStateEventHelpers } from '../lib/validation-state-event-emitter';
import { useServerScopedStorageKey } from '../lib/server-scoping';

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
  // Enhanced with normalized validation results
  aspectBreakdown?: {
    structural: { errors: number; warnings: number; score: number };
    profile: { errors: number; warnings: number; score: number };
    terminology: { errors: number; warnings: number; score: number };
    reference: { errors: number; warnings: number; score: number };
    businessRule: { errors: number; warnings: number; score: number };
    metadata: { errors: number; warnings: number; score: number };
  };
  overallValidationMetrics?: {
    averageScore: number;
    averageConfidence: number;
    averageCompleteness: number;
    totalDurationMs: number;
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
  // Persistence state
  persistedState: ValidationProgress | null;
  lastPersistedAt: Date | null;
}

export interface ValidationPollingActions {
  startPolling: () => void;
  stopPolling: () => void;
  resetProgress: () => void;
  reconnect: () => void;
  syncWithApi: () => Promise<void>;
  getPollingConfig: () => UseValidationPollingOptions;
  updatePollingConfig: (newConfig: Partial<UseValidationPollingOptions>) => void;
  // Persistence actions
  saveProgressToStorage: () => void;
  loadProgressFromStorage: () => ValidationProgress | null;
  clearPersistedProgress: () => void;
  restoreFromPersistence: () => Promise<boolean>;
}

export interface UseValidationPollingOptions {
  enabled?: boolean;
  pollInterval?: number;
  activePollInterval?: number; // Polling interval when validation is active (running/paused)
  idlePollInterval?: number;   // Polling interval when validation is idle/completed
  hasActiveServer?: boolean;
  maxRetries?: number;         // Maximum number of retry attempts
  retryDelay?: number;         // Initial retry delay in milliseconds
  maxRetryDelay?: number;      // Maximum retry delay in milliseconds
  requestTimeout?: number;     // Request timeout in milliseconds
  enableSmartPolling?: boolean; // Whether to use smart polling (adjusts interval based on status)
  enableExponentialBackoff?: boolean; // Whether to use exponential backoff for retries
}

export function useValidationPolling(options: UseValidationPollingOptions = {}): ValidationPollingState & ValidationPollingActions {
  const {
    enabled = true, // Default to enabled for live updates
    pollInterval = 10000, // Default polling interval (fallback)
    activePollInterval = 3000, // Poll every 3 seconds when validation is active
    idlePollInterval = 10000, // Poll every 10 seconds when validation is idle
    hasActiveServer = true,
    maxRetries = 5,
    retryDelay = 1000,
    maxRetryDelay = 30000,
    requestTimeout = 30000,
    enableSmartPolling = true,
    enableExponentialBackoff = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentServer, setCurrentServer] = useState<{ id: number; name: string; url: string } | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  
  // Persistence state
  const [persistedState, setPersistedState] = useState<ValidationProgress | null>(null);
  const [lastPersistedAt, setLastPersistedAt] = useState<Date | null>(null);
  
  // Server-scoped storage key
  const storageKey = useServerScopedStorageKey('validation-progress');
  
  // Store current configuration in state for dynamic updates
  const [currentConfig, setCurrentConfig] = useState<UseValidationPollingOptions>({
    enabled,
    pollInterval,
    activePollInterval,
    idlePollInterval,
    hasActiveServer,
    maxRetries,
    retryDelay,
    maxRetryDelay,
    requestTimeout,
    enableSmartPolling,
    enableExponentialBackoff
  });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryDelayRef = useRef(retryDelay); // Use configurable initial delay
  
  // Store functions in refs to avoid dependency issues
  const startPollingRef = useRef<() => void>();
  const stopPollingRef = useRef<() => void>();
  
  // Track previous state for event emission
  const previousValidationStatusRef = useRef<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');
  const previousConnectionStateRef = useRef<ConnectionState>('disconnected');
  const previousProgressRef = useRef<ValidationProgress | null>(null);

  // Helper function to emit events when state changes
  const emitStateChangeEvents = useCallback((
    newValidationStatus: 'idle' | 'running' | 'paused' | 'completed' | 'error',
    newConnectionState: ConnectionState,
    newProgress: ValidationProgress | null,
    error?: string
  ) => {
    const previousValidationStatus = previousValidationStatusRef.current;
    const previousConnectionState = previousConnectionStateRef.current;
    const previousProgress = previousProgressRef.current;

    // Emit validation status change events
    if (newValidationStatus !== previousValidationStatus) {
      switch (newValidationStatus) {
        case 'running':
          if (previousValidationStatus === 'idle') {
            ValidationStateEventHelpers.emitValidationStarted(newProgress, currentServer?.id);
          } else if (previousValidationStatus === 'paused') {
            ValidationStateEventHelpers.emitValidationResumed(newProgress);
          }
          break;
        case 'paused':
          if (previousValidationStatus === 'running') {
            ValidationStateEventHelpers.emitValidationPaused(newProgress);
          }
          break;
        case 'completed':
          if (previousValidationStatus === 'running') {
            ValidationStateEventHelpers.emitValidationCompleted(newProgress);
          }
          break;
        case 'error':
          if (previousValidationStatus === 'running' || previousValidationStatus === 'paused') {
            ValidationStateEventHelpers.emitValidationError(error || 'Unknown error', newProgress);
          }
          break;
        case 'idle':
          if (previousValidationStatus === 'running' || previousValidationStatus === 'paused') {
            ValidationStateEventHelpers.emitValidationStopped(newProgress);
          }
          break;
      }
      
      // Emit general status change event
      ValidationStateEventHelpers.emitStatusChanged(previousValidationStatus, newValidationStatus, newProgress);
    }

    // Emit connection state change events
    if (newConnectionState !== previousConnectionState) {
      ValidationStateEventHelpers.emitConnectionStateChanged(newConnectionState, error);
    }

    // Emit progress update events
    if (newProgress !== previousProgress) {
      ValidationStateEventHelpers.emitProgressUpdated(newProgress, previousProgress);
    }

    // Update previous state refs
    previousValidationStatusRef.current = newValidationStatus;
    previousConnectionStateRef.current = newConnectionState;
    previousProgressRef.current = newProgress;
  }, [currentServer?.id]);

  // Fetch validation progress from API with enhanced error handling
  const fetchValidationProgress = useCallback(async (): Promise<ValidationProgress | null> => {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }, currentConfig.requestTimeout || requestTimeout);

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
        isComplete: data.isComplete || false,
        // Enhanced with normalized validation results
        aspectBreakdown: data.aspectBreakdown || undefined,
        overallValidationMetrics: data.overallValidationMetrics || undefined,
        retryStatistics: data.retryStatistics || undefined
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

    // Only log when actually starting (not on every call)
    console.log('[ValidationPolling] Starting validation progress polling');
    isPollingRef.current = true;
    setConnectionState('connecting');
    setIsConnected(false);
    setLastError(null);
    retryCountRef.current = 0;
    setConnectionAttempts(prev => prev + 1);
    
    // Emit connection state change event
    emitStateChangeEvents(validationStatus, 'connecting', progress);

    const poll = async () => {
      try {
        const progressData = await fetchValidationProgress();
        
        // Mark as connected on successful fetch
        setConnectionState('connected');
        setIsConnected(true);
        setLastConnectedAt(new Date());
        // Only log connection success once per session
        if (!isConnected) {
          console.log('[ValidationPolling] Connected successfully');
        }
        
        // Reset retry state on successful connection
        retryCountRef.current = 0;
        retryDelayRef.current = retryDelay; // Reset to initial delay
        setLastError(null);
        
        if (progressData) {
          setProgress(progressData);
          setValidationStatus(progressData.status);
          // Emit state change events
          emitStateChangeEvents(progressData.status, 'connected', progressData);
        } else {
          // No validation in progress
          setProgress(null);
          setValidationStatus('idle');
          // Emit state change events
          emitStateChangeEvents('idle', 'connected', null);
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
        
        // Emit state change events for error
        emitStateChangeEvents(validationStatus, 'error', progress, errorMessage);
        
        // Implement retry logic with configurable backoff
        const currentMaxRetries = currentConfig.maxRetries || maxRetries;
        const currentRetryDelay = currentConfig.retryDelay || retryDelay;
        const currentMaxRetryDelay = currentConfig.maxRetryDelay || maxRetryDelay;
        const currentEnableExponentialBackoff = currentConfig.enableExponentialBackoff ?? enableExponentialBackoff;
        
        if (retryCountRef.current < currentMaxRetries) {
          let delay = currentRetryDelay;
          if (currentEnableExponentialBackoff) {
            delay = Math.min(retryDelayRef.current * Math.pow(2, retryCountRef.current - 1), currentMaxRetryDelay);
          }
          console.log(`[ValidationPolling] Retrying in ${delay}ms (attempt ${retryCountRef.current}/${currentMaxRetries})`);
          
          // Set up retry with configurable backoff
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

      // Start with default interval - will be adjusted based on actual status from API
      const currentEnableSmartPolling = currentConfig.enableSmartPolling ?? enableSmartPolling;
      const currentIdlePollInterval = currentConfig.idlePollInterval || idlePollInterval;
      const currentPollInterval = currentConfig.pollInterval || pollInterval;
      let currentInterval = currentEnableSmartPolling ? currentIdlePollInterval : currentPollInterval;

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const progressData = await fetchValidationProgress();
          if (progressData) {
            setProgress(progressData);
            setValidationStatus(progressData.status);
            setLastError(null);
            retryCountRef.current = 0;
            
            // Emit state change events
            emitStateChangeEvents(progressData.status, 'connected', progressData);
            
            // Adjust interval based on actual status (only if smart polling is enabled)
            const currentActivePollInterval = currentConfig.activePollInterval || activePollInterval;
            let newInterval = currentPollInterval;
            if (currentEnableSmartPolling) {
              if (progressData.status === 'idle' || progressData.status === 'completed') {
                newInterval = currentIdlePollInterval;
              } else if (progressData.status === 'running' || progressData.status === 'paused') {
                newInterval = currentActivePollInterval;
              }
            }
            
            // Update interval if it changed
            if (newInterval !== currentInterval) {
              currentInterval = newInterval;
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = setInterval(arguments.callee, newInterval);
              console.log(`[ValidationPolling] Adjusted polling interval to ${newInterval}ms for status: ${progressData.status}`);
            }
          } else {
            setProgress(null);
            setValidationStatus('idle');
            setLastError(null);
            
            // Emit state change events
            emitStateChangeEvents('idle', 'connected', null);
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
      }, currentInterval);
      
      console.log(`[ValidationPolling] Set polling interval to ${currentInterval}ms`);
    };

    // Set up initial polling
    setupSmartPolling();
  }, [enabled, hasActiveServer, pollInterval, fetchValidationProgress]);

  // Stop polling
  const stopPolling = useCallback(() => {
    // Only log when actually stopping (not on every call)
    if (isPollingRef.current) {
      console.log('[ValidationPolling] Stopping validation progress polling');
    }
    isPollingRef.current = false;
    setConnectionState('disconnected');
    setIsConnected(false);
    
    // Emit connection state change event
    emitStateChangeEvents(validationStatus, 'disconnected', progress);
    
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
    retryDelayRef.current = retryDelay;
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

  // Get current polling configuration
  const getPollingConfig = useCallback((): UseValidationPollingOptions => {
    return { ...currentConfig };
  }, [currentConfig]);

  // Update polling configuration dynamically
  const updatePollingConfig = useCallback((newConfig: Partial<UseValidationPollingOptions>) => {
    setCurrentConfig(prevConfig => {
      const updatedConfig = { ...prevConfig, ...newConfig };
      
      // If polling is active and interval changed, restart polling with new interval
      if (isPollingRef.current && (
        newConfig.pollInterval !== undefined ||
        newConfig.activePollInterval !== undefined ||
        newConfig.idlePollInterval !== undefined ||
        newConfig.enableSmartPolling !== undefined
      )) {
        console.log('[ValidationPolling] Configuration updated, restarting polling with new settings');
        // Restart polling with new configuration
        setTimeout(() => {
          stopPolling();
          setTimeout(() => {
            startPolling();
          }, 100);
        }, 0);
      }
      
      return updatedConfig;
    });
  }, [startPolling, stopPolling]);

  // Persistence functions
  const saveProgressToStorage = useCallback(() => {
    if (progress) {
      try {
        const dataToStore = {
          progress,
          timestamp: new Date().toISOString(),
          serverId: currentServer?.id,
          serverUrl: currentServer?.url
        };
        localStorage.setItem(storageKey, JSON.stringify(dataToStore));
        setPersistedState(progress);
        setLastPersistedAt(new Date());
        console.log('[ValidationPolling] Progress saved to localStorage');
      } catch (error) {
        console.error('[ValidationPolling] Error saving progress to localStorage:', error);
      }
    }
  }, [progress, currentServer, storageKey]);

  const loadProgressFromStorage = useCallback((): ValidationProgress | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const data = JSON.parse(stored);
        const storedDate = new Date(data.timestamp);
        const now = new Date();
        const hoursSinceStored = (now.getTime() - storedDate.getTime()) / (1000 * 60 * 60);
        
        // Only restore if stored within last 24 hours
        if (hoursSinceStored < 24) {
          console.log('[ValidationPolling] Progress loaded from localStorage');
          return data.progress;
        } else {
          // Clean up expired data
          localStorage.removeItem(storageKey);
          console.log('[ValidationPolling] Expired progress data removed from localStorage');
        }
      }
    } catch (error) {
      console.error('[ValidationPolling] Error loading progress from localStorage:', error);
    }
    
    return null;
  }, [storageKey]);

  const clearPersistedProgress = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setPersistedState(null);
      setLastPersistedAt(null);
      console.log('[ValidationPolling] Persisted progress cleared');
    } catch (error) {
      console.error('[ValidationPolling] Error clearing persisted progress:', error);
    }
  }, [storageKey]);

  const restoreFromPersistence = useCallback(async (): Promise<boolean> => {
    try {
      // First try to restore from localStorage
      const localProgress = loadProgressFromStorage();
      if (localProgress) {
        setProgress(localProgress);
        setPersistedState(localProgress);
        setLastPersistedAt(new Date());
        console.log('[ValidationPolling] Progress restored from localStorage');
        return true;
      }

      // If no local progress, try to restore from server
      if (currentServer?.id) {
        const response = await fetch(`/api/validation/bulk/restore-active`);
        if (response.ok) {
          const data = await response.json();
          if (data.restored && data.state) {
            // Convert server state to client progress format
            const restoredProgress: ValidationProgress = {
              totalResources: data.state.totalResources || 0,
              processedResources: data.state.processedResources || 0,
              validResources: 0, // Will be updated by polling
              errorResources: data.state.errors || 0,
              status: data.state.isRunning ? (data.state.isPaused ? 'paused' : 'running') : 'idle',
              startTime: data.state.startTime ? new Date(data.state.startTime) : null,
              currentResourceType: data.state.currentResourceType,
              estimatedTimeRemaining: data.state.estimatedTimeRemaining,
              processingRate: data.state.processingRate,
              isComplete: data.state.shouldStop || false
            };
            
            setProgress(restoredProgress);
            setPersistedState(restoredProgress);
            setLastPersistedAt(new Date());
            console.log('[ValidationPolling] Progress restored from server');
            return true;
          }
        }
      }
    } catch (error) {
      console.error('[ValidationPolling] Error restoring from persistence:', error);
    }
    
    return false;
  }, [currentServer, loadProgressFromStorage]);

  // Auto-save progress to localStorage when it changes
  useEffect(() => {
    if (progress && (progress.status === 'running' || progress.status === 'paused')) {
      saveProgressToStorage();
    }
  }, [progress, saveProgressToStorage]);

  // Auto-start polling when conditions are met
  useEffect(() => {
    if (enabled && hasActiveServer && !isPollingRef.current) {
      startPollingRef.current?.();
    } else if ((!enabled || !hasActiveServer) && isPollingRef.current) {
      stopPollingRef.current?.();
    }

    return () => {
      stopPollingRef.current?.();
    };
  }, [enabled, hasActiveServer]); // Only depend on the actual state values

  // Update function refs whenever functions change
  useEffect(() => {
    startPollingRef.current = startPolling;
    stopPollingRef.current = stopPolling;
  }, [startPolling, stopPolling]);

  // Fetch current server on mount
  useEffect(() => {
    if (hasActiveServer) {
      fetchCurrentServer();
    }
  }, [hasActiveServer]); // Removed fetchCurrentServer dependency

  // Note: Polling interval management is now handled within the startPolling function
  // to avoid infinite re-render loops

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
    // Persistence state
    persistedState,
    lastPersistedAt,
    
    // Actions
    startPolling,
    stopPolling,
    resetProgress,
    reconnect,
    syncWithApi,
    getPollingConfig,
    updatePollingConfig,
    // Persistence actions
    saveProgressToStorage,
    loadProgressFromStorage,
    clearPersistedProgress,
    restoreFromPersistence
  };
}
