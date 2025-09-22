// ============================================================================
// Performance Utilities - React performance optimization helpers
// ============================================================================

import { memo, useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Performance Utilities - Single responsibility: React performance optimization helpers
 * Follows global rules: Under 200 lines, single responsibility, focused on performance
 */

/**
 * Create a memoized component with custom comparison function
 */
export const createMemoizedComponent = <P extends object>(
  Component: React.ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean
) => {
  return memo(Component, areEqual);
};

/**
 * Shallow comparison for props (default React.memo behavior)
 */
export const shallowEqual = <T extends object>(prev: T, next: T): boolean => {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  
  if (prevKeys.length !== nextKeys.length) {
    return false;
  }
  
  for (const key of prevKeys) {
    if (prev[key as keyof T] !== next[key as keyof T]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Deep comparison for props (use with caution - can be expensive)
 */
export const deepEqual = <T>(prev: T, next: T): boolean => {
  if (prev === next) return true;
  
  if (prev == null || next == null) return prev === next;
  
  if (typeof prev !== 'object' || typeof next !== 'object') {
    return prev === next;
  }
  
  if (Array.isArray(prev) !== Array.isArray(next)) return false;
  
  if (Array.isArray(prev)) {
    if (prev.length !== (next as any[]).length) return false;
    return prev.every((item, index) => deepEqual(item, (next as any[])[index]));
  }
  
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  
  if (prevKeys.length !== nextKeys.length) return false;
  
  return prevKeys.every(key => 
    deepEqual((prev as any)[key], (next as any)[key])
  );
};

/**
 * Custom hook for stable object references
 */
export const useStableObject = <T extends object>(obj: T): T => {
  const ref = useRef<T>();
  
  if (!ref.current || !shallowEqual(ref.current, obj)) {
    ref.current = obj;
  }
  
  return ref.current;
};

/**
 * Custom hook for stable array references
 */
export const useStableArray = <T>(arr: T[]): T[] => {
  const ref = useRef<T[]>();
  
  if (!ref.current || !shallowEqual(ref.current, arr)) {
    ref.current = arr;
  }
  
  return ref.current;
};

/**
 * Custom hook for debounced values
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};

/**
 * Custom hook for throttled callbacks
 */
export const useThrottledCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRun = useRef<number>(0);
  
  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        return callback(...args);
      }
    }) as T,
    [callback, delay]
  );
};

/**
 * Custom hook for stable callback references
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T
): T => {
  const ref = useRef<T>(callback);
  
  useEffect(() => {
    ref.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: Parameters<T>) => ref.current(...args)) as T,
    []
  );
};

/**
 * Performance monitoring hook
 */
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef<number>(0);
  
  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    
    if (lastRenderTime.current > 0) {
      const timeSinceLastRender = now - lastRenderTime.current;
      console.log(`${componentName} rendered ${renderCount.current} times, ${timeSinceLastRender}ms since last render`);
    }
    
    lastRenderTime.current = now;
  });
  
  return {
    renderCount: renderCount.current,
    timeSinceLastRender: lastRenderTime.current ? Date.now() - lastRenderTime.current : 0,
  };
};

/**
 * Component optimization utilities
 */
export const componentOptimizations = {
  /**
   * Memoize expensive calculations
   */
  useExpensiveCalculation: <T, R>(
    calculation: (input: T) => R,
    input: T,
    deps?: React.DependencyList
  ): R => {
    return useMemo(() => calculation(input), [input, ...(deps || [])]);
  },
  
  /**
   * Memoize callback functions
   */
  useMemoizedCallback: <T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList
  ): T => {
    return useCallback(callback, deps);
  },
  
  /**
   * Memoize object props
   */
  useMemoizedProps: <T extends object>(props: T): T => {
    return useStableObject(props);
  },
  
  /**
   * Memoize array props
   */
  useMemoizedArray: <T>(array: T[]): T[] => {
    return useStableArray(array);
  },
};

/**
 * Dashboard-specific performance optimizations
 */
export const dashboardOptimizations = {
  /**
   * Optimize widget props comparison
   */
  widgetPropsEqual: <P extends object>(prev: P, next: P): boolean => {
    // Custom comparison for widget props that ignores certain fields
    const ignoreFields = ['lastUpdated', 'onRefresh'];
    
    const prevFiltered = { ...prev };
    const nextFiltered = { ...next };
    
    ignoreFields.forEach(field => {
      delete (prevFiltered as any)[field];
      delete (nextFiltered as any)[field];
    });
    
    return shallowEqual(prevFiltered, nextFiltered);
  },
  
  /**
   * Optimize validation status comparison
   */
  validationStatusEqual: (prev: any, next: any): boolean => {
    if (!prev || !next) return prev === next;
    
    // Only compare essential fields for validation status
    const essentialFields = ['status', 'progress', 'currentResourceType', 'processingRate'];
    
    return essentialFields.every(field => 
      prev[field] === next[field]
    );
  },
  
  /**
   * Optimize alert data comparison
   */
  alertDataEqual: (prev: any[], next: any[]): boolean => {
    if (!prev || !next) return prev === next;
    if (prev.length !== next.length) return false;
    
    // Compare only essential alert fields
    return prev.every((prevAlert, index) => {
      const nextAlert = next[index];
      return (
        prevAlert.id === nextAlert.id &&
        prevAlert.type === nextAlert.type &&
        prevAlert.resolved === nextAlert.resolved
      );
    });
  },
};

// Import useState for useDebouncedValue
import { useState } from 'react';

export default {
  createMemoizedComponent,
  shallowEqual,
  deepEqual,
  useStableObject,
  useStableArray,
  useDebouncedValue,
  useThrottledCallback,
  useStableCallback,
  usePerformanceMonitor,
  componentOptimizations,
  dashboardOptimizations,
};
