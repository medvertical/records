/**
 * Hook for managing validation quality metrics
 * 
 * Provides comprehensive quality metrics including accuracy, completeness,
 * consistency, performance, and reliability scores.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { 
  ValidationQualityMetrics, 
  ValidationQualityReport,
  ValidationQualityConfig 
} from '@shared/types/validation';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface UseValidationQualityMetricsOptions {
  /** Time range for quality metrics calculation */
  timeRange?: {
    start: Date;
    end: Date;
  };
  
  /** Resource types to include in quality metrics */
  resourceTypes?: string[];
  
  /** Whether to enable real-time updates */
  enableRealTimeUpdates?: boolean;
  
  /** Update interval in milliseconds */
  updateInterval?: number;
  
  /** Whether to include quality recommendations */
  includeRecommendations?: boolean;
}

interface ValidationQualityMetricsState {
  /** Current quality metrics */
  qualityMetrics: ValidationQualityMetrics | null;
  
  /** Quality report */
  qualityReport: ValidationQualityReport | null;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error state */
  error: string | null;
  
  /** Last updated timestamp */
  lastUpdated: Date | null;
  
  /** Quality configuration */
  config: ValidationQualityConfig | null;
}

interface ValidationQualityMetricsActions {
  /** Refresh quality metrics */
  refreshMetrics: () => Promise<void>;
  
  /** Generate quality report */
  generateReport: () => Promise<void>;
  
  /** Update quality configuration */
  updateConfig: (config: Partial<ValidationQualityConfig>) => Promise<void>;
  
  /** Export quality metrics */
  exportMetrics: (format: 'json' | 'csv' | 'pdf') => Promise<void>;
  
  /** Clear error state */
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useValidationQualityMetrics(
  options: UseValidationQualityMetricsOptions = {}
): ValidationQualityMetricsState & ValidationQualityMetricsActions {
  const {
    timeRange,
    resourceTypes,
    enableRealTimeUpdates = false,
    updateInterval = 30000, // 30 seconds
    includeRecommendations = true
  } = options;

  const queryClient = useQueryClient();
  
  // State
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Default time range (last 7 days)
  const defaultTimeRange = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  };

  const effectiveTimeRange = timeRange || defaultTimeRange;

  // Query key for caching
  const queryKey = [
    'validation-quality-metrics',
    effectiveTimeRange.start.toISOString(),
    effectiveTimeRange.end.toISOString(),
    resourceTypes?.join(','),
    includeRecommendations
  ];

  // Fetch quality metrics
  const {
    data: qualityMetrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
    refetch: refetchMetrics
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<ValidationQualityMetrics> => {
      const params = new URLSearchParams({
        start: effectiveTimeRange.start.toISOString(),
        end: effectiveTimeRange.end.toISOString(),
        includeRecommendations: includeRecommendations.toString()
      });

      if (resourceTypes && resourceTypes.length > 0) {
        params.append('resourceTypes', resourceTypes.join(','));
      }

      const response = await fetch(`/api/validation/quality-metrics?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setLastUpdated(new Date());
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: enableRealTimeUpdates ? updateInterval : false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Fetch quality report
  const {
    data: qualityReport,
    isLoading: isLoadingReport,
    error: reportError,
    refetch: refetchReport
  } = useQuery({
    queryKey: [...queryKey, 'report'],
    queryFn: async (): Promise<ValidationQualityReport> => {
      const params = new URLSearchParams({
        start: effectiveTimeRange.start.toISOString(),
        end: effectiveTimeRange.end.toISOString(),
        includeRecommendations: includeRecommendations.toString()
      });

      if (resourceTypes && resourceTypes.length > 0) {
        params.append('resourceTypes', resourceTypes.join(','));
      }

      const response = await fetch(`/api/validation/quality-report?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: false, // Only fetch when explicitly requested
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });

  // Fetch quality configuration
  const {
    data: config,
    isLoading: isLoadingConfig,
    error: configError
  } = useQuery({
    queryKey: ['validation-quality-config'],
    queryFn: async (): Promise<ValidationQualityConfig> => {
      const response = await fetch('/api/validation/quality-config');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2
  });

  // Update error state
  useEffect(() => {
    const currentError = metricsError || reportError || configError;
    setError(currentError ? (currentError as Error).message : null);
  }, [metricsError, reportError, configError]);

  // Actions
  const refreshMetrics = useCallback(async () => {
    try {
      setError(null);
      await refetchMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh quality metrics');
    }
  }, [refetchMetrics]);

  const generateReport = useCallback(async () => {
    try {
      setError(null);
      await refetchReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quality report');
    }
  }, [refetchReport]);

  const updateConfig = useCallback(async (newConfig: Partial<ValidationQualityConfig>) => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/quality-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Invalidate and refetch config
      await queryClient.invalidateQueries({ queryKey: ['validation-quality-config'] });
      
      // Also invalidate metrics to recalculate with new config
      await queryClient.invalidateQueries({ queryKey });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quality configuration');
    }
  }, [queryClient, queryKey]);

  const exportMetrics = useCallback(async (format: 'json' | 'csv' | 'pdf') => {
    try {
      setError(null);
      
      const params = new URLSearchParams({
        start: effectiveTimeRange.start.toISOString(),
        end: effectiveTimeRange.end.toISOString(),
        format,
        includeRecommendations: includeRecommendations.toString()
      });

      if (resourceTypes && resourceTypes.length > 0) {
        params.append('resourceTypes', resourceTypes.join(','));
      }

      const response = await fetch(`/api/validation/quality-export?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation-quality-metrics.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export quality metrics');
    }
  }, [effectiveTimeRange, resourceTypes, includeRecommendations]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed state
  const isLoading = isLoadingMetrics || isLoadingReport || isLoadingConfig;

  return {
    // State
    qualityMetrics: qualityMetrics || null,
    qualityReport: qualityReport || null,
    isLoading,
    error,
    lastUpdated,
    config: config || null,
    
    // Actions
    refreshMetrics,
    generateReport,
    updateConfig,
    exportMetrics,
    clearError
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for getting validation quality trends
 */
export function useValidationQualityTrends(timeRange?: { start: Date; end: Date }) {
  const defaultTimeRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
    end: new Date()
  };

  const effectiveTimeRange = timeRange || defaultTimeRange;

  return useQuery({
    queryKey: ['validation-quality-trends', effectiveTimeRange.start.toISOString(), effectiveTimeRange.end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: effectiveTimeRange.start.toISOString(),
        end: effectiveTimeRange.end.toISOString()
      });

      const response = await fetch(`/api/validation/quality-trends?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
}

/**
 * Hook for getting validation quality recommendations
 */
export function useValidationQualityRecommendations() {
  return useQuery({
    queryKey: ['validation-quality-recommendations'],
    queryFn: async () => {
      const response = await fetch('/api/validation/quality-recommendations');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });
}
