import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface PerformanceHealth {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface PerformanceAnalytics {
  totalOperations: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  slowestOperations: Array<{
    operation: string;
    averageDuration: number;
    count: number;
  }>;
  errorBreakdown: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
  performanceTrends: Array<{
    timestamp: string;
    averageResponseTime: number;
    successRate: number;
  }>;
}

export interface PerformanceMonitoringOptions {
  enabled?: boolean;
  pollInterval?: number;
  enableRealTimeUpdates?: boolean;
  enableAlerts?: boolean;
  alertThresholds?: {
    responseTime?: number;
    errorRate?: number;
    successRate?: number;
  };
  maxMetricsHistory?: number;
  enableLocalStorage?: boolean;
}

export interface PerformanceMonitoringState {
  metrics: PerformanceMetrics[];
  health: PerformanceHealth | null;
  analytics: PerformanceAnalytics | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isConnected: boolean;
}

export interface PerformanceMonitoringActions {
  refreshMetrics: () => Promise<void>;
  clearMetrics: () => void;
  getOperationMetrics: (operation: string) => PerformanceMetrics[];
  getHealthStatus: () => PerformanceHealth | null;
  getAnalytics: () => PerformanceAnalytics | null;
  recordOperation: (operation: string, duration: number, success: boolean, error?: string, metadata?: Record<string, any>) => void;
  startOperation: (operation: string) => () => void;
  executeWithMonitoring: <T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>) => Promise<T>;
}

const DEFAULT_OPTIONS: Required<PerformanceMonitoringOptions> = {
  enabled: true,
  pollInterval: 30000, // 30 seconds
  enableRealTimeUpdates: true,
  enableAlerts: true,
  alertThresholds: {
    responseTime: 5000, // 5 seconds
    errorRate: 0.1, // 10%
    successRate: 0.9, // 90%
  },
  maxMetricsHistory: 1000,
  enableLocalStorage: true,
};

export function usePerformanceMonitoring(
  options: PerformanceMonitoringOptions = {}
): PerformanceMonitoringState & PerformanceMonitoringActions {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { toast } = useToast();

  // State
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [health, setHealth] = useState<PerformanceHealth | null>(null);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const operationTimers = useRef<Map<string, number>>(new Map());

  // Local storage key
  const storageKey = 'performance-metrics';

  // Load metrics from localStorage
  const loadMetricsFromStorage = useCallback((): PerformanceMetrics[] => {
    if (!mergedOptions.enableLocalStorage) return [];
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        return data.metrics || [];
      }
    } catch (error) {
      console.error('[PerformanceMonitoring] Error loading metrics from localStorage:', error);
    }
    return [];
  }, [mergedOptions.enableLocalStorage, storageKey]);

  // Save metrics to localStorage
  const saveMetricsToStorage = useCallback((metricsToSave: PerformanceMetrics[]) => {
    if (!mergedOptions.enableLocalStorage) return;
    
    try {
      const data = {
        metrics: metricsToSave.slice(-mergedOptions.maxMetricsHistory),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('[PerformanceMonitoring] Error saving metrics to localStorage:', error);
    }
  }, [mergedOptions.enableLocalStorage, mergedOptions.maxMetricsHistory, storageKey]);

  // Fetch metrics from server
  const fetchMetrics = useCallback(async (): Promise<void> => {
    if (!mergedOptions.enabled) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/performance/metrics');
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }

      const data = await response.json();
      
      // Update state
      setHealth(data.health);
      setAnalytics(data.analytics);
      setLastUpdated(new Date());
      setIsConnected(true);

      // Merge with local metrics
      const localMetrics = loadMetricsFromStorage();
      const allMetrics = [...localMetrics, ...(data.metrics || [])];
      
      // Keep only recent metrics
      const recentMetrics = allMetrics
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, mergedOptions.maxMetricsHistory);
      
      setMetrics(recentMetrics);
      saveMetricsToStorage(recentMetrics);

    } catch (error) {
      console.error('[PerformanceMonitoring] Error fetching metrics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch metrics');
      setIsConnected(false);
      
      // Load from localStorage as fallback
      const localMetrics = loadMetricsFromStorage();
      if (localMetrics.length > 0) {
        setMetrics(localMetrics);
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [mergedOptions.enabled, mergedOptions.maxMetricsHistory, loadMetricsFromStorage, saveMetricsToStorage]);

  // Check for performance alerts
  const checkAlerts = useCallback((currentMetrics: PerformanceMetrics[], currentHealth: PerformanceHealth | null) => {
    if (!mergedOptions.enableAlerts || !currentHealth) return;

    const { alertThresholds } = mergedOptions;

    // Check health status
    if (currentHealth.status === 'critical') {
      toast({
        title: "Performance Critical",
        description: `Performance health is critical: ${currentHealth.issues.join(', ')}`,
        variant: "destructive",
      });
    } else if (currentHealth.status === 'warning') {
      toast({
        title: "Performance Warning",
        description: `Performance issues detected: ${currentHealth.issues.join(', ')}`,
        variant: "default",
      });
    }

    // Check recent error rate
    const recentMetrics = currentMetrics.filter(m => 
      new Date(m.timestamp).getTime() > Date.now() - 300000 // Last 5 minutes
    );
    
    if (recentMetrics.length > 0) {
      const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
      
      if (errorRate > alertThresholds.errorRate) {
        toast({
          title: "High Error Rate",
          description: `Error rate is ${(errorRate * 100).toFixed(1)}%, above threshold of ${(alertThresholds.errorRate * 100).toFixed(1)}%`,
          variant: "destructive",
        });
      }
    }
  }, [mergedOptions.enableAlerts, mergedOptions.alertThresholds, toast]);

  // Refresh metrics
  const refreshMetrics = useCallback(async (): Promise<void> => {
    await fetchMetrics();
  }, [fetchMetrics]);

  // Clear metrics
  const clearMetrics = useCallback((): void => {
    setMetrics([]);
    setHealth(null);
    setAnalytics(null);
    setError(null);
    setLastUpdated(null);
    
    if (mergedOptions.enableLocalStorage) {
      localStorage.removeItem(storageKey);
    }
  }, [mergedOptions.enableLocalStorage, storageKey]);

  // Get metrics for specific operation
  const getOperationMetrics = useCallback((operation: string): PerformanceMetrics[] => {
    return metrics.filter(m => m.operation === operation);
  }, [metrics]);

  // Get health status
  const getHealthStatus = useCallback((): PerformanceHealth | null => {
    return health;
  }, [health]);

  // Get analytics
  const getAnalytics = useCallback((): PerformanceAnalytics | null => {
    return analytics;
  }, [analytics]);

  // Record operation manually
  const recordOperation = useCallback((
    operation: string,
    duration: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ): void => {
    const newMetric: PerformanceMetrics = {
      operation,
      duration,
      success,
      error,
      metadata,
      timestamp: new Date().toISOString()
    };

    setMetrics(prev => {
      const updated = [newMetric, ...prev].slice(0, mergedOptions.maxMetricsHistory);
      saveMetricsToStorage(updated);
      return updated;
    });
  }, [mergedOptions.maxMetricsHistory, saveMetricsToStorage]);

  // Start operation timer
  const startOperation = useCallback((operation: string): (() => void) => {
    const startTime = Date.now();
    operationTimers.current.set(operation, startTime);

    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      operationTimers.current.delete(operation);
      
      recordOperation(operation, duration, true);
    };
  }, [recordOperation]);

  // Execute function with monitoring
  const executeWithMonitoring = useCallback(async <T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      recordOperation(operation, duration, true, undefined, metadata);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      recordOperation(operation, duration, false, errorMessage, metadata);
      throw error;
    }
  }, [recordOperation]);

  // Initialize polling
  useEffect(() => {
    if (!mergedOptions.enabled) return;

    // Load initial metrics from localStorage
    const localMetrics = loadMetricsFromStorage();
    if (localMetrics.length > 0) {
      setMetrics(localMetrics);
      setLastUpdated(new Date());
    }

    // Fetch initial metrics
    fetchMetrics();

    // Set up polling
    if (mergedOptions.enableRealTimeUpdates) {
      pollIntervalRef.current = setInterval(fetchMetrics, mergedOptions.pollInterval);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [mergedOptions.enabled, mergedOptions.enableRealTimeUpdates, mergedOptions.pollInterval, fetchMetrics, loadMetricsFromStorage]);

  // Check alerts when metrics or health change
  useEffect(() => {
    if (metrics.length > 0 || health) {
      checkAlerts(metrics, health);
    }
  }, [metrics, health, checkAlerts]);

  return {
    // State
    metrics,
    health,
    analytics,
    loading,
    error,
    lastUpdated,
    isConnected,
    
    // Actions
    refreshMetrics,
    clearMetrics,
    getOperationMetrics,
    getHealthStatus,
    getAnalytics,
    recordOperation,
    startOperation,
    executeWithMonitoring,
  };
}

