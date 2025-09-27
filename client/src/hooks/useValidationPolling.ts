import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PollingSession {
  sessionId: string;
  clientId: string;
  resourceIds: string[];
  pollInterval: number;
  maxPollDuration: number;
  startTime: Date;
}

export interface ResourceProgress {
  resourceId: string;
  resourceType: string;
  status: 'pending' | 'initializing' | 'validating' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  progress: number; // 0-100 percentage
  currentAspect?: string;
  completedAspects: string[];
  failedAspects: string[];
  startTime: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  lastError?: string;
  retryAttempts: number;
  maxRetryAttempts: number;
}

export interface PollingResponse {
  sessionId: string;
  timestamp: Date;
  isActive: boolean;
  progress: {
    individual: ResourceProgress[];
    summary: {
      totalResources: number;
      activeResources: number;
      completedResources: number;
      failedResources: number;
      averageProgress: number;
    };
  };
  updates: {
    newResources: string[];
    completedResources: string[];
    failedResources: string[];
    updatedResources: string[];
  };
  metadata: {
    totalResources: number;
    activeResources: number;
    completedResources: number;
    failedResources: number;
    averageProgress: number;
    estimatedTimeRemaining?: number;
  };
}

export interface UseValidationPollingOptions {
  pollInterval?: number;
  maxPollDuration?: number;
  autoStart?: boolean;
  onProgressUpdate?: (response: PollingResponse) => void;
  onSessionEnd?: (session: PollingSession) => void;
  onError?: (error: Error) => void;
}

export interface UseValidationPollingReturn {
  // Session state
  session: PollingSession | null;
  isPolling: boolean;
  isActive: boolean;
  
  // Progress data
  progress: ResourceProgress[];
  summary: PollingResponse['progress']['summary'] | null;
  updates: PollingResponse['updates'] | null;
  metadata: PollingResponse['metadata'] | null;
  
  // Error state
  error: string | null;
  
  // Actions
  startPolling: (resourceIds: string[], options?: Partial<UseValidationPollingOptions>) => Promise<void>;
  stopPolling: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // Statistics
  lastPollTime: Date | null;
  pollCount: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useValidationPolling(options: UseValidationPollingOptions = {}): UseValidationPollingReturn {
  const {
    pollInterval = 2000,
    maxPollDuration = 30 * 60 * 1000, // 30 minutes
    autoStart = false,
    onProgressUpdate,
    onSessionEnd,
    onError
  } = options;

  // State
  const [session, setSession] = useState<PollingSession | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState<ResourceProgress[]>([]);
  const [summary, setSummary] = useState<PollingResponse['progress']['summary'] | null>(null);
  const [updates, setUpdates] = useState<PollingResponse['updates'] | null>(null);
  const [metadata, setMetadata] = useState<PollingResponse['metadata'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientIdRef = useRef<string>(`client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // ============================================================================
  // API Functions
  // ============================================================================

  const createPollingSession = useCallback(async (resourceIds: string[], sessionOptions: Partial<UseValidationPollingOptions> = {}): Promise<PollingSession> => {
    const response = await fetch('/api/validation/polling/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': clientIdRef.current
      },
      body: JSON.stringify({
        resourceIds,
        pollInterval: sessionOptions.pollInterval || pollInterval,
        maxPollDuration: sessionOptions.maxPollDuration || maxPollDuration,
        context: {
          requestedBy: 'frontend',
          requestId: `frontend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create polling session: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create polling session');
    }

    return result.data;
  }, [pollInterval, maxPollDuration]);

  const getPollingResponse = useCallback(async (sessionId: string): Promise<PollingResponse> => {
    const response = await fetch(`/api/validation/polling/session/${sessionId}`, {
      headers: {
        'X-Client-ID': clientIdRef.current
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get polling response: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get polling response');
    }

    return result.data;
  }, []);

  const endPollingSession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`/api/validation/polling/session/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'X-Client-ID': clientIdRef.current
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to end polling session: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to end polling session');
    }
  }, []);

  // ============================================================================
  // Polling Logic
  // ============================================================================

  const pollForUpdates = useCallback(async () => {
    if (!session || !isPolling) return;

    try {
      const response = await getPollingResponse(session.sessionId);
      
      setProgress(response.progress.individual);
      setSummary(response.progress.summary);
      setUpdates(response.updates);
      setMetadata(response.metadata);
      setIsActive(response.isActive);
      setLastPollTime(new Date());
      setPollCount(prev => prev + 1);
      setError(null);

      // Call progress update callback
      if (onProgressUpdate) {
        onProgressUpdate(response);
      }

      // Check if session should end
      if (!response.isActive || response.metadata.completedResources + response.metadata.failedResources >= response.metadata.totalResources) {
        await stopPolling();
        if (onSessionEnd && session) {
          onSessionEnd(session);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to poll for updates';
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    }
  }, [session, isPolling, getPollingResponse, onProgressUpdate, onSessionEnd, onError]);

  const startPollingInterval = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(pollForUpdates, session?.pollInterval || pollInterval);
  }, [pollForUpdates, session?.pollInterval, pollInterval]);

  const stopPollingInterval = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    const timeout = session?.maxPollDuration || maxPollDuration;
    sessionTimeoutRef.current = setTimeout(async () => {
      console.warn('[ValidationPolling] Session timeout reached, stopping polling');
      await stopPolling();
    }, timeout);
  }, [session?.maxPollDuration, maxPollDuration]);

  const stopSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
  }, []);

  // ============================================================================
  // Actions
  // ============================================================================

  const startPolling = useCallback(async (resourceIds: string[], sessionOptions: Partial<UseValidationPollingOptions> = {}) => {
    try {
      setError(null);
      setIsPolling(true);

      // Create polling session
      const newSession = await createPollingSession(resourceIds, sessionOptions);
      setSession(newSession);

      // Start polling immediately
      await pollForUpdates();

      // Start polling interval
      startPollingInterval();

      // Start session timeout
      startSessionTimeout();

      console.log(`[ValidationPolling] Started polling for ${resourceIds.length} resources`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start polling';
      setError(errorMessage);
      setIsPolling(false);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    }
  }, [createPollingSession, pollForUpdates, startPollingInterval, startSessionTimeout, onError]);

  const stopPolling = useCallback(async () => {
    try {
      setIsPolling(false);
      stopPollingInterval();
      stopSessionTimeout();

      if (session) {
        await endPollingSession(session.sessionId);
        setSession(null);
      }

      setProgress([]);
      setSummary(null);
      setUpdates(null);
      setMetadata(null);
      setIsActive(false);

      console.log('[ValidationPolling] Stopped polling');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop polling';
      setError(errorMessage);
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    }
  }, [session, endPollingSession, stopPollingInterval, stopSessionTimeout, onError]);

  const refresh = useCallback(async () => {
    if (session && isPolling) {
      await pollForUpdates();
    }
  }, [session, isPolling, pollForUpdates]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Auto-start polling if enabled
  useEffect(() => {
    if (autoStart && !session && !isPolling) {
      // Note: This would need resourceIds to be provided somehow
      // For now, we'll just set up the polling infrastructure
      console.log('[ValidationPolling] Auto-start enabled but no resourceIds provided');
    }
  }, [autoStart, session, isPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPollingInterval();
      stopSessionTimeout();
    };
  }, [stopPollingInterval, stopSessionTimeout]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Session state
    session,
    isPolling,
    isActive,
    
    // Progress data
    progress,
    summary,
    updates,
    metadata,
    
    // Error state
    error,
    
    // Actions
    startPolling,
    stopPolling,
    refresh,
    
    // Statistics
    lastPollTime,
    pollCount
  };
}
