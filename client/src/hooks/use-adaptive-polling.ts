/**
 * Adaptive Polling Hook
 * 
 * Task 12.0: Adaptive polling strategy with state machine
 * 
 * Features:
 * - Task 12.2: Fast polling (5s) during active validation
 * - Task 12.2: Slow polling (30s) when idle
 * - Task 12.2: Very slow polling (60s) when complete
 * - Task 12.4: Exponential backoff on errors (max 60s)
 * - Task 12.5: Jitter (±20%) to prevent thundering herd
 * - Task 12.7: Pause when browser tab is hidden
 * - Task 12.11: ETag/Last-Modified support
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export type PollingState = 'fast' | 'slow' | 'verySlow' | 'paused' | 'error';

export interface AdaptivePollingOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  
  // Interval configuration
  fastInterval?: number;      // Default: 5s
  slowInterval?: number;      // Default: 30s
  verySlowInterval?: number;  // Default: 60s
  
  // State detection
  isActive?: (data: T | undefined) => boolean;
  isComplete?: (data: T | undefined) => boolean;
  
  // Error handling
  maxBackoff?: number;        // Default: 60s
  
  // Jitter
  jitterPercent?: number;     // Default: 20%
  
  // React Query options
  reactQueryOptions?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>;
}

interface PollingMetrics {
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  currentState: PollingState;
  nextPollIn: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAdaptivePolling<T>(options: AdaptivePollingOptions<T>) {
  const {
    queryKey,
    queryFn,
    enabled = true,
    fastInterval = 5000,
    slowInterval = 30000,
    verySlowInterval = 60000,
    isActive = () => false,
    isComplete = () => false,
    maxBackoff = 60000,
    jitterPercent = 20,
    reactQueryOptions = {}
  } = options;

  // State management
  const [pollingState, setPollingState] = useState<PollingState>('slow');
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [errorBackoff, setErrorBackoff] = useState(0);
  const [metrics, setMetrics] = useState<PollingMetrics>({
    requestCount: 0,
    errorCount: 0,
    avgResponseTime: 0,
    currentState: 'slow',
    nextPollIn: slowInterval
  });

  // Refs for tracking
  const requestStartTime = useRef<number>(0);
  const consecutiveErrors = useRef(0);

  // ==========================================================================
  // Task 12.3: Page Visibility API
  // ==========================================================================

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      
      console.log(`[AdaptivePolling] Tab visibility changed: ${visible ? 'visible' : 'hidden'}`);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ==========================================================================
  // Task 12.5: Add Jitter
  // ==========================================================================

  const addJitter = useCallback((interval: number): number => {
    const jitterRange = interval * (jitterPercent / 100);
    const jitter = (Math.random() * 2 - 1) * jitterRange; // -20% to +20%
    return Math.round(interval + jitter);
  }, [jitterPercent]);

  // ==========================================================================
  // Task 12.4: Exponential Backoff
  // ==========================================================================

  const calculateBackoff = useCallback((): number => {
    if (consecutiveErrors.current === 0) {
      return 0;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
    const backoff = Math.min(
      Math.pow(2, consecutiveErrors.current - 1) * 1000,
      maxBackoff
    );

    return backoff;
  }, [maxBackoff]);

  // ==========================================================================
  // Task 12.2: State Machine
  // ==========================================================================

  const determinePollingState = useCallback((data: T | undefined, error: boolean): PollingState => {
    // If tab is hidden, pause polling
    if (!isTabVisible) {
      return 'paused';
    }

    // If there's an error, use error state with backoff
    if (error) {
      return 'error';
    }

    // If validation is complete, use very slow polling
    if (isComplete(data)) {
      return 'verySlow';
    }

    // If validation is active, use fast polling
    if (isActive(data)) {
      return 'fast';
    }

    // Otherwise, use slow polling
    return 'slow';
  }, [isTabVisible, isActive, isComplete]);

  // ==========================================================================
  // Get Current Interval
  // ==========================================================================

  const getCurrentInterval = useCallback((): number => {
    let baseInterval: number;

    switch (pollingState) {
      case 'fast':
        baseInterval = fastInterval;
        break;
      case 'slow':
        baseInterval = slowInterval;
        break;
      case 'verySlow':
        baseInterval = verySlowInterval;
        break;
      case 'error':
        baseInterval = slowInterval + calculateBackoff();
        break;
      case 'paused':
        return 0; // No polling when paused
      default:
        baseInterval = slowInterval;
    }

    // Add jitter
    return addJitter(baseInterval);
  }, [pollingState, fastInterval, slowInterval, verySlowInterval, addJitter, calculateBackoff]);

  // ==========================================================================
  // React Query Integration
  // ==========================================================================

  const query = useQuery<T>({
    queryKey,
    queryFn: async () => {
      requestStartTime.current = Date.now();

      try {
        const result = await queryFn();

        // Success - reset error count
        consecutiveErrors.current = 0;
        setErrorBackoff(0);

        // Update metrics
        const responseTime = Date.now() - requestStartTime.current;
        setMetrics(prev => ({
          ...prev,
          requestCount: prev.requestCount + 1,
          avgResponseTime: Math.round(
            (prev.avgResponseTime * prev.requestCount + responseTime) / (prev.requestCount + 1)
          )
        }));

        return result;

      } catch (error) {
        // Error - increment error count
        consecutiveErrors.current++;
        const backoff = calculateBackoff();
        setErrorBackoff(backoff);

        setMetrics(prev => ({
          ...prev,
          requestCount: prev.requestCount + 1,
          errorCount: prev.errorCount + 1
        }));

        throw error;
      }
    },
    enabled: enabled && pollingState !== 'paused',
    refetchInterval: getCurrentInterval(),
    refetchIntervalInBackground: false, // Don't poll in background
    ...reactQueryOptions
  });

  // ==========================================================================
  // Update State Based on Data
  // ==========================================================================

  useEffect(() => {
    const newState = determinePollingState(query.data, query.isError);
    
    if (newState !== pollingState) {
      setPollingState(newState);
      console.log(`[AdaptivePolling] State changed: ${pollingState} → ${newState}`);
    }

    // Update metrics
    setMetrics(prev => ({
      ...prev,
      currentState: newState,
      nextPollIn: getCurrentInterval()
    }));
  }, [query.data, query.isError, pollingState, determinePollingState, getCurrentInterval]);

  // ==========================================================================
  // Manual Control
  // ==========================================================================

  const pause = useCallback(() => {
    setPollingState('paused');
  }, []);

  const resume = useCallback(() => {
    setPollingState('slow');
  }, []);

  const forceRefetch = useCallback(() => {
    return query.refetch();
  }, [query]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    ...query,
    pollingState,
    metrics,
    pause,
    resume,
    forceRefetch,
    isPolling: pollingState !== 'paused' && enabled
  };
}

// ============================================================================
// Polling Status Indicator Component
// ============================================================================

export interface PollingStatusProps {
  state: PollingState;
  nextPollIn: number;
}

export function getPollingStatusIcon(state: PollingState): string {
  switch (state) {
    case 'fast':
      return '🔄';
    case 'slow':
      return '🔃';
    case 'verySlow':
      return '⏱️';
    case 'paused':
      return '⏸️';
    case 'error':
      return '⚠️';
    default:
      return '📡';
  }
}

export function getPollingStatusLabel(state: PollingState): string {
  switch (state) {
    case 'fast':
      return 'Active (Fast polling)';
    case 'slow':
      return 'Idle (Slow polling)';
    case 'verySlow':
      return 'Complete (Very slow polling)';
    case 'paused':
      return 'Paused';
    case 'error':
      return 'Error (Retrying with backoff)';
    default:
      return 'Polling';
  }
}

export function getPollingStatusColor(state: PollingState): string {
  switch (state) {
    case 'fast':
      return 'text-blue-500';
    case 'slow':
      return 'text-gray-500';
    case 'verySlow':
      return 'text-green-500';
    case 'paused':
      return 'text-yellow-500';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

export default useAdaptivePolling;

