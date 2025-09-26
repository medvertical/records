/**
 * Validation Aspects Hook
 * 
 * This hook provides access to validation aspect breakdown data,
 * allowing components to display detailed information about each
 * validation aspect (structural, profile, terminology, etc.).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DetailedValidationResult } from '@shared/schema';

export interface ValidationAspectData {
  aspect: string;
  isValid: boolean;
  score: number;
  confidence: number;
  completeness: number;
  durationMs: number;
  issues: {
    errors: number;
    warnings: number;
    information: number;
    total: number;
  };
  details?: any;
}

export interface ValidationAspectsOptions {
  /** Whether to enable automatic polling for updates */
  enablePolling?: boolean;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  /** Resource type filter */
  resourceType?: string;
  /** Time range filter (days) */
  timeRange?: number;
}

export interface ValidationAspectsState {
  /** Aspect breakdown data */
  aspects: ValidationAspectData[];
  /** Overall validation metrics */
  overallMetrics: {
    averageScore: number;
    averageConfidence: number;
    averageCompleteness: number;
    totalDurationMs: number;
  };
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Last successful fetch timestamp */
  lastUpdated: Date | null;
  /** Whether polling is active */
  isPolling: boolean;
}

export interface ValidationAspectsActions {
  /** Manually refresh aspect data */
  refresh: () => void;
  /** Start polling for updates */
  startPolling: () => void;
  /** Stop polling for updates */
  stopPolling: () => void;
  /** Clear error state */
  clearError: () => void;
  /** Get aspect data by name */
  getAspectData: (aspectName: string) => ValidationAspectData | undefined;
}

/**
 * Hook for accessing validation aspect breakdown data
 */
export function useValidationAspects(
  options: ValidationAspectsOptions = {}
): ValidationAspectsState & ValidationAspectsActions {
  const {
    enablePolling = false,
    pollingInterval = 10000, // 10 seconds for aspect data
    resourceType,
    timeRange = 7 // Default to last 7 days
  } = options;

  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  // Query key for aspect data
  const queryKey = ['validation-aspects', resourceType, timeRange];

  // Fetch aspect breakdown data
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<any> => {
      const params = new URLSearchParams();
      if (resourceType) params.append('resourceType', resourceType);
      if (timeRange) params.append('timeRange', timeRange.toString());

      const response = await fetch(`/api/validation/aspects/breakdown?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch aspect breakdown: ${response.statusText}`);
      }
      return await response.json();
    },
    enabled: true,
    refetchInterval: enablePolling && isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 60000, // Consider data stale after 1 minute
    gcTime: 600000, // Keep in cache for 10 minutes
  });

  // Transform raw data to aspect breakdown
  const aspects = useMemo((): ValidationAspectData[] => {
    if (!rawData?.aspectBreakdown) return [];

    const aspectNames = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    
    return aspectNames.map(aspectName => {
      const aspectData = rawData.aspectBreakdown[aspectName];
      if (!aspectData) {
        return {
          aspect: aspectName,
          isValid: true,
          score: 100,
          confidence: 100,
          completeness: 100,
          durationMs: 0,
          issues: {
            errors: 0,
            warnings: 0,
            information: 0,
            total: 0
          }
        };
      }

      return {
        aspect: aspectName,
        isValid: aspectData.isValid || false,
        score: aspectData.score || 0,
        confidence: aspectData.confidence || 0,
        completeness: aspectData.completeness || 0,
        durationMs: aspectData.durationMs || 0,
        issues: {
          errors: aspectData.issues?.filter((i: any) => i.severity === 'error').length || 0,
          warnings: aspectData.issues?.filter((i: any) => i.severity === 'warning').length || 0,
          information: aspectData.issues?.filter((i: any) => i.severity === 'information').length || 0,
          total: aspectData.issues?.length || 0
        },
        details: aspectData.details
      };
    });
  }, [rawData]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    if (aspects.length === 0) {
      return {
        averageScore: 0,
        averageConfidence: 0,
        averageCompleteness: 0,
        totalDurationMs: 0
      };
    }

    const totalScore = aspects.reduce((sum, aspect) => sum + aspect.score, 0);
    const totalConfidence = aspects.reduce((sum, aspect) => sum + aspect.confidence, 0);
    const totalCompleteness = aspects.reduce((sum, aspect) => sum + aspect.completeness, 0);
    const totalDuration = aspects.reduce((sum, aspect) => sum + aspect.durationMs, 0);

    return {
      averageScore: Math.round(totalScore / aspects.length),
      averageConfidence: Math.round(totalConfidence / aspects.length),
      averageCompleteness: Math.round(totalCompleteness / aspects.length),
      totalDurationMs: totalDuration
    };
  }, [aspects]);

  // Manual refresh function
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    queryClient.setQueryData(queryKey, (oldData: any) => oldData);
  }, [queryClient, queryKey]);

  // Get aspect data by name
  const getAspectData = useCallback((aspectName: string): ValidationAspectData | undefined => {
    return aspects.find(aspect => aspect.aspect === aspectName);
  }, [aspects]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (enablePolling) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [enablePolling, startPolling, stopPolling]);

  return {
    // State
    aspects,
    overallMetrics,
    isLoading,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
    getAspectData,
  };
}

/**
 * Hook for accessing validation aspect data for a specific resource
 */
export function useValidationAspectsForResource(
  resourceId: string,
  options: Omit<ValidationAspectsOptions, 'resourceType'> = {}
) {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const {
    enablePolling = false,
    pollingInterval = 5000,
  } = options;

  // Query key for resource-specific aspect data
  const queryKey = ['validation-aspects-resource', resourceId];

  // Fetch resource-specific aspect data
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<DetailedValidationResult | null> => {
      const response = await fetch(`/api/validation/results/${resourceId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch resource validation results: ${response.statusText}`);
      }
      return await response.json();
    },
    enabled: !!resourceId,
    refetchInterval: enablePolling && isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    gcTime: 300000,
  });

  // Transform to aspect data
  const aspects = useMemo((): ValidationAspectData[] => {
    if (!rawData?.aspectResults) return [];

    const aspectNames = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    
    return aspectNames.map(aspectName => {
      const aspectResult = rawData.aspectResults[aspectName];
      if (!aspectResult) {
        return {
          aspect: aspectName,
          isValid: true,
          score: 100,
          confidence: 100,
          completeness: 100,
          durationMs: 0,
          issues: {
            errors: 0,
            warnings: 0,
            information: 0,
            total: 0
          }
        };
      }

      return {
        aspect: aspectName,
        isValid: aspectResult.isValid || false,
        score: aspectResult.score || 0,
        confidence: aspectResult.confidence || 0,
        completeness: aspectResult.completeness || 0,
        durationMs: aspectResult.durationMs || 0,
        issues: {
          errors: aspectResult.issues?.filter((i: any) => i.severity === 'error').length || 0,
          warnings: aspectResult.issues?.filter((i: any) => i.severity === 'warning').length || 0,
          information: aspectResult.issues?.filter((i: any) => i.severity === 'information').length || 0,
          total: aspectResult.issues?.length || 0
        },
        details: aspectResult.details
      };
    });
  }, [rawData]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    if (!rawData) {
      return {
        averageScore: 0,
        averageConfidence: 0,
        averageCompleteness: 0,
        totalDurationMs: 0
      };
    }

    return {
      averageScore: rawData.overallScore || 0,
      averageConfidence: rawData.overallConfidence || 0,
      averageCompleteness: rawData.overallCompleteness || 0,
      totalDurationMs: rawData.totalDurationMs || 0
    };
  }, [rawData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    queryClient.setQueryData(queryKey, (oldData: any) => oldData);
  }, [queryClient, queryKey]);

  // Get aspect data by name
  const getAspectData = useCallback((aspectName: string): ValidationAspectData | undefined => {
    return aspects.find(aspect => aspect.aspect === aspectName);
  }, [aspects]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (enablePolling) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [enablePolling, startPolling, stopPolling]);

  return {
    // State
    aspects,
    overallMetrics,
    isLoading,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
    getAspectData,
  };
}

export default useValidationAspects;
