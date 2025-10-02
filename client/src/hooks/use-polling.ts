/**
 * Shared Polling Hook
 * 
 * This hook provides a reusable polling mechanism with cancellation,
 * backoff with jitter, and cleanup capabilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface PollingOptions {
  /** Whether polling is enabled */
  enabled?: boolean;
  
  /** Polling interval in milliseconds */
  interval?: number;
  
  /** Maximum number of consecutive failures before stopping */
  maxFailures?: number;
  
  /** Base backoff multiplier for exponential backoff */
  backoffMultiplier?: number;
  
  /** Maximum backoff interval in milliseconds */
  maxBackoff?: number;
  
  /** Jitter factor (0-1) to randomize backoff intervals */
  jitter?: number;
  
  /** Whether to continue polling in background */
  continueInBackground?: boolean;
  
  /** Whether to start polling immediately */
  startImmediately?: boolean;
}

export interface PollingState {
  /** Whether polling is currently active */
  isPolling: boolean;
  
  /** Number of consecutive failures */
  failureCount: number;
  
  /** Current polling interval */
  currentInterval: number;
  
  /** Last successful poll timestamp */
  lastSuccess: Date | null;
  
  /** Last error */
  lastError: Error | null;
  
  /** Whether polling is paused due to failures */
  isPaused: boolean;
}

export interface PollingActions {
  /** Start polling */
  start: () => void;
  
  /** Stop polling */
  stop: () => void;
  
  /** Pause polling (can be resumed) */
  pause: () => void;
  
  /** Resume paused polling */
  resume: () => void;
  
  /** Reset failure count and resume normal polling */
  reset: () => void;
  
  /** Manually trigger a poll */
  poll: () => Promise<void>;
}

// ============================================================================
// Polling Hook
// ============================================================================

export function usePolling(
  pollFunction: () => Promise<any>,
  options: PollingOptions = {}
): PollingState & PollingActions {
  const {
    enabled = true,
    interval = 30000, // 30 seconds default
    maxFailures = 3,
    backoffMultiplier = 2,
    maxBackoff = 300000, // 5 minutes max
    jitter = 0.1,
    continueInBackground = false,
    startImmediately = true
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [currentInterval, setCurrentInterval] = useState(interval);
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const pollFunctionRef = useRef(pollFunction);

  // Update poll function ref when it changes
  useEffect(() => {
    pollFunctionRef.current = pollFunction;
  }, [pollFunction]);

  // Calculate backoff interval with jitter
  const calculateBackoffInterval = useCallback((baseInterval: number, failures: number): number => {
    const backoffInterval = Math.min(
      baseInterval * Math.pow(backoffMultiplier, failures),
      maxBackoff
    );
    
    // Add jitter to prevent thundering herd
    const jitterAmount = backoffInterval * jitter * Math.random();
    return Math.floor(backoffInterval + jitterAmount);
  }, [backoffMultiplier, maxBackoff, jitter]);

  // Execute a single poll
  const executePoll = useCallback(async (): Promise<void> => {
    if (!isActiveRef.current) return;

    try {
      await pollFunctionRef.current();
      
      // Success - reset failure count and interval
      setFailureCount(0);
      setCurrentInterval(interval);
      setLastSuccess(new Date());
      setLastError(null);
      setIsPaused(false);
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Polling failed');
      setLastError(err);
      
      // Use functional update to avoid dependency on failureCount
      setFailureCount(prevCount => {
        const newFailureCount = prevCount + 1;
        
        // Check if we should pause due to too many failures
        if (newFailureCount >= maxFailures) {
          setIsPaused(true);
          setIsPolling(false);
          if (intervalRef.current) {
            clearTimeout(intervalRef.current);
            intervalRef.current = null;
          }
          return newFailureCount;
        }
        
        // Calculate new interval with backoff
        const newInterval = calculateBackoffInterval(interval, newFailureCount);
        setCurrentInterval(newInterval);
        
        return newFailureCount;
      });
    }
  }, [interval, maxFailures, calculateBackoffInterval]);

  // Schedule next poll
  const scheduleNextPoll = useCallback(() => {
    if (!isActiveRef.current) return;

    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }

    intervalRef.current = setTimeout(() => {
      if (isActiveRef.current) {
        executePoll().then(() => {
          scheduleNextPoll();
        });
      }
    }, currentInterval);
  }, [currentInterval, executePoll]);

  // Start polling
  const start = useCallback(() => {
    if (isActiveRef.current) return;
    
    isActiveRef.current = true;
    setIsPolling(true);
    setIsPaused(false);
    
    // Execute first poll immediately
    executePoll().then(() => {
      scheduleNextPoll();
    });
  }, [executePoll, scheduleNextPoll]);

  // Stop polling
  const stop = useCallback(() => {
    isActiveRef.current = false;
    setIsPolling(false);
    setIsPaused(false);
    
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Pause polling
  const pause = useCallback(() => {
    setIsPaused(true);
    setIsPolling(false);
    
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Resume polling
  const resume = useCallback(() => {
    if (!isActiveRef.current) return;
    
    setIsPaused(false);
    setIsPolling(true);
    
    // Execute poll immediately and then schedule next
    executePoll().then(() => {
      scheduleNextPoll();
    });
  }, [executePoll, scheduleNextPoll]);

  // Reset failure count and resume normal polling
  const reset = useCallback(() => {
    setFailureCount(0);
    setCurrentInterval(interval);
    setLastError(null);
    setIsPaused(false);
    
    if (isActiveRef.current) {
      setIsPolling(true);
      executePoll().then(() => {
        scheduleNextPoll();
      });
    }
  }, [interval, executePoll, scheduleNextPoll]);

  // Manually trigger a poll
  const poll = useCallback(async (): Promise<void> => {
    await executePoll();
  }, [executePoll]);

  // Handle visibility change (pause/resume based on page visibility)
  useEffect(() => {
    if (!continueInBackground) {
      const handleVisibilityChange = () => {
        if (document.hidden && isPolling) {
          pause();
        } else if (!document.hidden && isActiveRef.current && isPaused) {
          resume();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [continueInBackground, isPolling, isPaused, pause, resume]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (enabled && startImmediately) {
      start();
    } else if (!enabled) {
      stop();
    }

    return () => {
      stop();
    };
  }, [enabled, startImmediately, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    // State
    isPolling,
    failureCount,
    currentInterval,
    lastSuccess,
    lastError,
    isPaused,

    // Actions
    start,
    stop,
    pause,
    resume,
    reset,
    poll,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for polling with a specific interval
 */
export function useIntervalPolling(
  pollFunction: () => Promise<any>,
  interval: number,
  options: Omit<PollingOptions, 'interval'> = {}
) {
  return usePolling(pollFunction, { ...options, interval });
}

/**
 * Hook for polling with exponential backoff
 */
export function useBackoffPolling(
  pollFunction: () => Promise<any>,
  baseInterval: number = 1000,
  options: Omit<PollingOptions, 'interval' | 'backoffMultiplier'> = {}
) {
  return usePolling(pollFunction, {
    ...options,
    interval: baseInterval,
    backoffMultiplier: 2,
  });
}

/**
 * Hook for polling that stops after failures
 */
export function useFailureAwarePolling(
  pollFunction: () => Promise<any>,
  maxFailures: number = 3,
  options: Omit<PollingOptions, 'maxFailures'> = {}
) {
  return usePolling(pollFunction, { ...options, maxFailures });
}

export default usePolling;

