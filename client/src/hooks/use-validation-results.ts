/**
 * Validation Results Hook
 * 
 * This hook provides access to detailed validation results from the consolidated
 * validation service, including all six validation aspects and normalized data.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DetailedValidationResult } from '@shared/schema';

export interface ValidationResultsOptions {
  /** Whether to enable automatic polling for updates */
  enablePolling?: boolean;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  /** Whether to show loading states */
  showLoading?: boolean;
}

export interface ValidationResultsState {
  /** Current validation results */
  results: DetailedValidationResult | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Last successful fetch timestamp */
  lastUpdated: Date | null;
  /** Whether polling is active */
  isPolling: boolean;
}

export interface ValidationResultsActions {
  /** Manually refresh validation results */
  refresh: () => void;
  /** Start polling for updates */
  startPolling: () => void;
  /** Stop polling for updates */
  stopPolling: () => void;
  /** Clear error state */
  clearError: () => void;
}

/**
 * Hook for accessing detailed validation results
 */
export function useValidationResults(
  resourceId?: string,
  options: ValidationResultsOptions = {}
): ValidationResultsState & ValidationResultsActions {
  const {
    enablePolling = false,
    pollingInterval = 5000,
    showLoading = true
  } = options;

  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  // Query key for React Query
  const queryKey = resourceId 
    ? ['validation-results', resourceId]
    : ['validation-results', 'latest'];

  // Fetch validation results
  const {
    data: results,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<DetailedValidationResult | null> => {
      if (!resourceId) {
        // Fetch latest validation results
        const response = await fetch('/api/validation/results/latest');
        if (!response.ok) {
          throw new Error(`Failed to fetch validation results: ${response.statusText}`);
        }
        return await response.json();
      } else {
        // Fetch specific resource validation results
        const response = await fetch(`/api/validation/results/${resourceId}`);
        if (!response.ok) {
          if (response.status === 404) {
            return null; // No results found
          }
          throw new Error(`Failed to fetch validation results: ${response.statusText}`);
        }
        return await response.json();
      }
    },
    enabled: true,
    refetchInterval: enablePolling && isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });

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
    results,
    isLoading: showLoading ? isLoading : false,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
  };
}

/**
 * Hook for accessing validation results for multiple resources
 */
export function useValidationResultsBatch(
  resourceIds: string[],
  options: ValidationResultsOptions = {}
) {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const {
    enablePolling = false,
    pollingInterval = 5000,
    showLoading = true
  } = options;

  // Query key for batch results
  const queryKey = ['validation-results-batch', resourceIds.sort().join(',')];

  // Fetch batch validation results
  const {
    data: results,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<Record<string, DetailedValidationResult>> => {
      if (resourceIds.length === 0) return {};

      const response = await fetch('/api/validation/results/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch batch validation results: ${response.statusText}`);
      }

      return await response.json();
    },
    enabled: resourceIds.length > 0,
    refetchInterval: enablePolling && isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    gcTime: 300000,
  });

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
    results: results || {},
    isLoading: showLoading ? isLoading : false,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
  };
}

export default useValidationResults;
