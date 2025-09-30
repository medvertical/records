import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to track component render performance
 * Helps ensure p95 < 300ms for resource detail views
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

export interface UsePerformanceTrackingOptions {
  componentName: string;
  enabled?: boolean;
  warnThreshold?: number; // Warn if duration exceeds this (ms)
  errorThreshold?: number; // Error if duration exceeds this (ms)
  onMetric?: (metric: PerformanceMetric) => void;
}

export function usePerformanceTracking({
  componentName,
  enabled = process.env.NODE_ENV === 'development',
  warnThreshold = 300, // PRD requirement: p95 < 300ms
  errorThreshold = 500,
  onMetric,
}: UsePerformanceTrackingOptions) {
  const startTimeRef = useRef<number>(0);
  const metricsRef = useRef<PerformanceMetric[]>([]);

  // Start tracking on mount
  useEffect(() => {
    if (!enabled) return;
    startTimeRef.current = performance.now();
  }, [enabled]);

  // Measure render time
  useEffect(() => {
    if (!enabled) return;

    const duration = performance.now() - startTimeRef.current;
    const metric: PerformanceMetric = {
      name: componentName,
      duration,
      timestamp: Date.now(),
    };

    metricsRef.current.push(metric);

    // Log performance
    if (duration > errorThreshold) {
      console.error(
        `[Performance] ${componentName} took ${duration.toFixed(2)}ms (threshold: ${errorThreshold}ms)`,
        metric
      );
    } else if (duration > warnThreshold) {
      console.warn(
        `[Performance] ${componentName} took ${duration.toFixed(2)}ms (threshold: ${warnThreshold}ms)`,
        metric
      );
    } else {
      console.debug(
        `[Performance] ${componentName} rendered in ${duration.toFixed(2)}ms`
      );
    }

    onMetric?.(metric);

    // Calculate p95 from recent metrics (keep last 100)
    if (metricsRef.current.length > 100) {
      metricsRef.current = metricsRef.current.slice(-100);
    }

    const sorted = [...metricsRef.current].sort((a, b) => a.duration - b.duration);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Duration = sorted[p95Index]?.duration || 0;

    if (metricsRef.current.length >= 20) {
      console.debug(
        `[Performance] ${componentName} p95: ${p95Duration.toFixed(2)}ms (${metricsRef.current.length} samples)`
      );
    }
  });

  const measure = useCallback((label: string) => {
    if (!enabled) return () => {};

    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      console.debug(`[Performance] ${componentName}.${label}: ${duration.toFixed(2)}ms`);
    };
  }, [componentName, enabled]);

  const getMetrics = useCallback(() => {
    return metricsRef.current;
  }, []);

  const getP95 = useCallback(() => {
    const sorted = [...metricsRef.current].sort((a, b) => a.duration - b.duration);
    const p95Index = Math.floor(sorted.length * 0.95);
    return sorted[p95Index]?.duration || 0;
  }, []);

  return {
    measure,
    getMetrics,
    getP95,
  };
}

/**
 * Hook to track async operation performance
 */
export function useAsyncPerformanceTracking(operationName: string) {
  const track = useCallback(async <T,>(
    operation: () => Promise<T>,
    options?: {
      warnThreshold?: number;
      errorThreshold?: number;
    }
  ): Promise<T> => {
    const { warnThreshold = 300, errorThreshold = 500 } = options || {};
    const start = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - start;

      if (duration > errorThreshold) {
        console.error(
          `[Performance] ${operationName} took ${duration.toFixed(2)}ms (threshold: ${errorThreshold}ms)`
        );
      } else if (duration > warnThreshold) {
        console.warn(
          `[Performance] ${operationName} took ${duration.toFixed(2)}ms (threshold: ${warnThreshold}ms)`
        );
      } else {
        console.debug(
          `[Performance] ${operationName} completed in ${duration.toFixed(2)}ms`
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(
        `[Performance] ${operationName} failed after ${duration.toFixed(2)}ms`,
        error
      );
      throw error;
    }
  }, [operationName]);

  return { track };
}
