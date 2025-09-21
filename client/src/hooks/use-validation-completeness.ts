/**
 * Hook for managing validation completeness indicators
 * 
 * Provides completeness metrics for validation results including coverage,
 * missing areas, gaps, and completeness scores.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { 
  ValidationCompletenessMetrics,
  ValidationCompletenessFactors,
  ValidationCoverageMetrics,
  MissingValidationArea,
  ValidationGap,
  ValidationCompletenessAction,
  ValidationResultWithCompleteness
} from '@shared/types/validation';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface UseValidationCompletenessOptions {
  /** Resource ID to calculate completeness for */
  resourceId?: string;
  
  /** Resource type for completeness calculation */
  resourceType?: string;
  
  /** Whether to include coverage analysis */
  includeCoverageAnalysis?: boolean;
  
  /** Whether to include gap analysis */
  includeGapAnalysis?: boolean;
  
  /** Whether to enable real-time updates */
  enableRealTimeUpdates?: boolean;
  
  /** Update interval in milliseconds */
  updateInterval?: number;
}

interface ValidationCompletenessState {
  /** Current completeness metrics */
  completeness: ValidationCompletenessMetrics | null;
  
  /** Enhanced validation result with completeness */
  enhancedResult: ValidationResultWithCompleteness | null;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error state */
  error: string | null;
  
  /** Last updated timestamp */
  lastUpdated: Date | null;
}

interface ValidationCompletenessActions {
  /** Calculate completeness for a specific result */
  calculateCompleteness: (resourceId: string) => Promise<void>;
  
  /** Refresh completeness metrics */
  refreshCompleteness: () => Promise<void>;
  
  /** Get completeness history for a resource type */
  getCompletenessHistory: (resourceType: string) => Promise<ValidationCompletenessMetrics[]>;
  
  /** Export completeness data */
  exportCompleteness: (format: 'json' | 'csv') => Promise<void>;
  
  /** Clear error state */
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useValidationCompleteness(
  options: UseValidationCompletenessOptions = {}
): ValidationCompletenessState & ValidationCompletenessActions {
  const {
    resourceId,
    resourceType,
    includeCoverageAnalysis = true,
    includeGapAnalysis = true,
    enableRealTimeUpdates = false,
    updateInterval = 30000 // 30 seconds
  } = options;

  const queryClient = useQueryClient();
  
  // State
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Query key for caching
  const queryKey = [
    'validation-completeness',
    resourceId,
    resourceType,
    includeCoverageAnalysis,
    includeGapAnalysis
  ];

  // Fetch completeness metrics
  const {
    data: completeness,
    isLoading: isLoadingCompleteness,
    error: completenessError,
    refetch: refetchCompleteness
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<ValidationCompletenessMetrics> => {
      if (!resourceId && !resourceType) {
        throw new Error('Either resourceId or resourceType must be provided');
      }

      const params = new URLSearchParams({
        includeCoverageAnalysis: includeCoverageAnalysis.toString(),
        includeGapAnalysis: includeGapAnalysis.toString()
      });

      if (resourceId) {
        params.append('resourceId', resourceId);
      }
      if (resourceType) {
        params.append('resourceType', resourceType);
      }

      const response = await fetch(`/api/validation/completeness?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setLastUpdated(new Date());
      return data;
    },
    enabled: !!(resourceId || resourceType),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: enableRealTimeUpdates ? updateInterval : false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Fetch enhanced validation result with completeness
  const {
    data: enhancedResult,
    isLoading: isLoadingEnhanced,
    error: enhancedError,
    refetch: refetchEnhanced
  } = useQuery({
    queryKey: [...queryKey, 'enhanced'],
    queryFn: async (): Promise<ValidationResultWithCompleteness> => {
      if (!resourceId) {
        throw new Error('resourceId is required for enhanced result');
      }

      const response = await fetch(`/api/validation/completeness/enhanced/${resourceId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!resourceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: enableRealTimeUpdates ? updateInterval : false,
    retry: 2
  });

  // Update error state
  useEffect(() => {
    const currentError = completenessError || enhancedError;
    setError(currentError ? (currentError as Error).message : null);
  }, [completenessError, enhancedError]);

  // Actions
  const calculateCompleteness = useCallback(async (targetResourceId: string) => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/completeness/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resourceId: targetResourceId,
          includeCoverageAnalysis,
          includeGapAnalysis
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Invalidate and refetch completeness data
      await queryClient.invalidateQueries({ 
        queryKey: ['validation-completeness', targetResourceId] 
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate completeness');
    }
  }, [queryClient, includeCoverageAnalysis, includeGapAnalysis]);

  const refreshCompleteness = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([
        refetchCompleteness(),
        refetchEnhanced()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh completeness');
    }
  }, [refetchCompleteness, refetchEnhanced]);

  const getCompletenessHistory = useCallback(async (targetResourceType: string): Promise<ValidationCompletenessMetrics[]> => {
    try {
      setError(null);
      
      const params = new URLSearchParams({
        resourceType: targetResourceType,
        includeCoverageAnalysis: 'true',
        includeGapAnalysis: 'true'
      });

      const response = await fetch(`/api/validation/completeness/history?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get completeness history');
      throw err;
    }
  }, []);

  const exportCompleteness = useCallback(async (format: 'json' | 'csv') => {
    try {
      setError(null);
      
      const params = new URLSearchParams({
        format,
        includeCoverageAnalysis: includeCoverageAnalysis.toString(),
        includeGapAnalysis: includeGapAnalysis.toString()
      });

      if (resourceId) {
        params.append('resourceId', resourceId);
      }
      if (resourceType) {
        params.append('resourceType', resourceType);
      }

      const response = await fetch(`/api/validation/completeness/export?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation-completeness.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export completeness data');
    }
  }, [resourceId, resourceType, includeCoverageAnalysis, includeGapAnalysis]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed state
  const isLoading = isLoadingCompleteness || isLoadingEnhanced;

  return {
    // State
    completeness: completeness || null,
    enhancedResult: enhancedResult || null,
    isLoading,
    error,
    lastUpdated,
    
    // Actions
    calculateCompleteness,
    refreshCompleteness,
    getCompletenessHistory,
    exportCompleteness,
    clearError
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for getting completeness trends
 */
export function useValidationCompletenessTrends(
  resourceType: string,
  timeRange?: { start: Date; end: Date }
) {
  const defaultTimeRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
    end: new Date()
  };

  const effectiveTimeRange = timeRange || defaultTimeRange;

  return useQuery({
    queryKey: [
      'validation-completeness-trends', 
      resourceType, 
      effectiveTimeRange.start.toISOString(), 
      effectiveTimeRange.end.toISOString()
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        resourceType,
        start: effectiveTimeRange.start.toISOString(),
        end: effectiveTimeRange.end.toISOString()
      });

      const response = await fetch(`/api/validation/completeness/trends?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!resourceType,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
}

/**
 * Hook for getting completeness recommendations
 */
export function useValidationCompletenessRecommendations(resourceId?: string) {
  return useQuery({
    queryKey: ['validation-completeness-recommendations', resourceId],
    queryFn: async () => {
      const url = resourceId 
        ? `/api/validation/completeness/recommendations/${resourceId}`
        : '/api/validation/completeness/recommendations';
        
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!resourceId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });
}

/**
 * Hook for batch completeness calculation
 */
export function useBatchValidationCompleteness(resourceIds: string[]) {
  return useQuery({
    queryKey: ['batch-validation-completeness', resourceIds.join(',')],
    queryFn: async () => {
      const response = await fetch('/api/validation/completeness/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resourceIds })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: resourceIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
}

/**
 * Hook for coverage analysis
 */
export function useValidationCoverageAnalysis(resourceType: string) {
  return useQuery({
    queryKey: ['validation-coverage-analysis', resourceType],
    queryFn: async () => {
      const response = await fetch(`/api/validation/completeness/coverage/${resourceType}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!resourceType,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2
  });
}
