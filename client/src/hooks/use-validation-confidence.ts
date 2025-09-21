/**
 * Hook for managing validation confidence scoring
 * 
 * Provides confidence metrics for validation results including confidence levels,
 * factors, issues, and recommended actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { 
  ValidationConfidenceMetrics, 
  ValidationConfidenceFactors,
  ValidationConfidenceIssue,
  ValidationConfidenceAction,
  ValidationResultWithConfidence
} from '@shared/types/validation';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface UseValidationConfidenceOptions {
  /** Resource ID to calculate confidence for */
  resourceId?: string;
  
  /** Resource type for confidence calculation */
  resourceType?: string;
  
  /** Whether to include historical analysis */
  includeHistoricalAnalysis?: boolean;
  
  /** Historical data time range (days) */
  historicalTimeRange?: number;
  
  /** Whether to enable real-time updates */
  enableRealTimeUpdates?: boolean;
  
  /** Update interval in milliseconds */
  updateInterval?: number;
}

interface ValidationConfidenceState {
  /** Current confidence metrics */
  confidence: ValidationConfidenceMetrics | null;
  
  /** Enhanced validation result with confidence */
  enhancedResult: ValidationResultWithConfidence | null;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error state */
  error: string | null;
  
  /** Last updated timestamp */
  lastUpdated: Date | null;
}

interface ValidationConfidenceActions {
  /** Calculate confidence for a specific result */
  calculateConfidence: (resourceId: string) => Promise<void>;
  
  /** Refresh confidence metrics */
  refreshConfidence: () => Promise<void>;
  
  /** Get confidence history for a resource type */
  getConfidenceHistory: (resourceType: string) => Promise<ValidationConfidenceMetrics[]>;
  
  /** Export confidence data */
  exportConfidence: (format: 'json' | 'csv') => Promise<void>;
  
  /** Clear error state */
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useValidationConfidence(
  options: UseValidationConfidenceOptions = {}
): ValidationConfidenceState & ValidationConfidenceActions {
  const {
    resourceId,
    resourceType,
    includeHistoricalAnalysis = true,
    historicalTimeRange = 30,
    enableRealTimeUpdates = false,
    updateInterval = 30000 // 30 seconds
  } = options;

  const queryClient = useQueryClient();
  
  // State
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Query key for caching
  const queryKey = [
    'validation-confidence',
    resourceId,
    resourceType,
    includeHistoricalAnalysis,
    historicalTimeRange
  ];

  // Fetch confidence metrics
  const {
    data: confidence,
    isLoading: isLoadingConfidence,
    error: confidenceError,
    refetch: refetchConfidence
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<ValidationConfidenceMetrics> => {
      if (!resourceId && !resourceType) {
        throw new Error('Either resourceId or resourceType must be provided');
      }

      const params = new URLSearchParams({
        includeHistoricalAnalysis: includeHistoricalAnalysis.toString(),
        historicalTimeRange: historicalTimeRange.toString()
      });

      if (resourceId) {
        params.append('resourceId', resourceId);
      }
      if (resourceType) {
        params.append('resourceType', resourceType);
      }

      const response = await fetch(`/api/validation/confidence?${params}`);
      
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

  // Fetch enhanced validation result with confidence
  const {
    data: enhancedResult,
    isLoading: isLoadingEnhanced,
    error: enhancedError,
    refetch: refetchEnhanced
  } = useQuery({
    queryKey: [...queryKey, 'enhanced'],
    queryFn: async (): Promise<ValidationResultWithConfidence> => {
      if (!resourceId) {
        throw new Error('resourceId is required for enhanced result');
      }

      const response = await fetch(`/api/validation/confidence/enhanced/${resourceId}`);
      
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
    const currentError = confidenceError || enhancedError;
    setError(currentError ? (currentError as Error).message : null);
  }, [confidenceError, enhancedError]);

  // Actions
  const calculateConfidence = useCallback(async (targetResourceId: string) => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/confidence/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resourceId: targetResourceId,
          includeHistoricalAnalysis,
          historicalTimeRange
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Invalidate and refetch confidence data
      await queryClient.invalidateQueries({ 
        queryKey: ['validation-confidence', targetResourceId] 
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate confidence');
    }
  }, [queryClient, includeHistoricalAnalysis, historicalTimeRange]);

  const refreshConfidence = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([
        refetchConfidence(),
        refetchEnhanced()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh confidence');
    }
  }, [refetchConfidence, refetchEnhanced]);

  const getConfidenceHistory = useCallback(async (targetResourceType: string): Promise<ValidationConfidenceMetrics[]> => {
    try {
      setError(null);
      
      const params = new URLSearchParams({
        resourceType: targetResourceType,
        includeHistoricalAnalysis: 'true',
        historicalTimeRange: historicalTimeRange.toString()
      });

      const response = await fetch(`/api/validation/confidence/history?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get confidence history');
      throw err;
    }
  }, [historicalTimeRange]);

  const exportConfidence = useCallback(async (format: 'json' | 'csv') => {
    try {
      setError(null);
      
      const params = new URLSearchParams({
        format,
        includeHistoricalAnalysis: includeHistoricalAnalysis.toString(),
        historicalTimeRange: historicalTimeRange.toString()
      });

      if (resourceId) {
        params.append('resourceId', resourceId);
      }
      if (resourceType) {
        params.append('resourceType', resourceType);
      }

      const response = await fetch(`/api/validation/confidence/export?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation-confidence.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export confidence data');
    }
  }, [resourceId, resourceType, includeHistoricalAnalysis, historicalTimeRange]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed state
  const isLoading = isLoadingConfidence || isLoadingEnhanced;

  return {
    // State
    confidence: confidence || null,
    enhancedResult: enhancedResult || null,
    isLoading,
    error,
    lastUpdated,
    
    // Actions
    calculateConfidence,
    refreshConfidence,
    getConfidenceHistory,
    exportConfidence,
    clearError
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for getting confidence trends
 */
export function useValidationConfidenceTrends(
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
      'validation-confidence-trends', 
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

      const response = await fetch(`/api/validation/confidence/trends?${params}`);
      
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
 * Hook for getting confidence recommendations
 */
export function useValidationConfidenceRecommendations(resourceId?: string) {
  return useQuery({
    queryKey: ['validation-confidence-recommendations', resourceId],
    queryFn: async () => {
      const url = resourceId 
        ? `/api/validation/confidence/recommendations/${resourceId}`
        : '/api/validation/confidence/recommendations';
        
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
 * Hook for batch confidence calculation
 */
export function useBatchValidationConfidence(resourceIds: string[]) {
  return useQuery({
    queryKey: ['batch-validation-confidence', resourceIds.join(',')],
    queryFn: async () => {
      const response = await fetch('/api/validation/confidence/batch', {
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
