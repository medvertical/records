/**
 * Validation Progress Hook
 * 
 * This hook provides access to validation queue progress and status information
 * with real-time updates and polling capabilities.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

// ============================================================================
// Types
// ============================================================================

export interface ValidationProgress {
  /** Current queue status */
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  
  /** Total number of resources to validate */
  totalResources: number;
  
  /** Number of resources processed */
  processedResources: number;
  
  /** Number of resources with validation errors */
  errorResources: number;
  
  /** Number of resources that passed validation */
  validResources: number;
  
  /** Current resource type being processed */
  currentResourceType: string | null;
  
  /** Start time of current validation batch */
  startTime: Date | null;
  
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number | null;
  
  /** Current throughput (resources per minute) */
  currentThroughput: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Error message if validation failed */
  error: string | null;
  
  /** Batch size for current validation */
  batchSize: number;
  
  /** Maximum concurrent validations */
  maxConcurrent: number;
}

export interface ValidationProgressOptions {
  /** Whether to enable automatic polling */
  enablePolling?: boolean;
  
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  
  /** Whether to show loading states */
  showLoading?: boolean;
  
  /** Whether to show toast notifications */
  showNotifications?: boolean;
}

export interface ValidationProgressState {
  /** Current progress data */
  progress: ValidationProgress | null;
  
  /** Whether data is loading */
  isLoading: boolean;
  
  /** Error message if any */
  error: string | null;
  
  /** Last successful fetch timestamp */
  lastUpdated: Date | null;
  
  /** Whether polling is active */
  isPolling: boolean;
}

export interface ValidationProgressActions {
  /** Manually refresh progress data */
  refresh: () => void;
  
  /** Start polling for updates */
  startPolling: () => void;
  
  /** Stop polling for updates */
  stopPolling: () => void;
  
  /** Clear error state */
  clearError: () => void;
  
  /** Start validation with specified parameters */
  startValidation: (params: { batchSize?: number; resourceTypes?: string[] }) => Promise<void>;
  
  /** Pause current validation */
  pauseValidation: () => Promise<void>;
  
  /** Resume paused validation */
  resumeValidation: () => Promise<void>;
  
  /** Stop current validation */
  stopValidation: () => Promise<void>;
  
  /** Cancel current validation */
  cancelValidation: () => Promise<void>;
}

// ============================================================================
// Validation Progress Hook
// ============================================================================

export function useValidationProgress(
  options: ValidationProgressOptions = {}
): ValidationProgressState & ValidationProgressActions {
  const {
    enablePolling = true,
    pollingInterval = 5000, // 5 seconds for progress updates
    showLoading = true,
    showNotifications = true
  } = options;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(enablePolling);

  // Query key for React Query
  const queryKey = ['validation-progress'];

  // Fetch validation progress
  const {
    data: progress,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<ValidationProgress | null> => {
      const response = await fetch('/api/validation/progress');
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No active validation
        }
        throw new Error(`Failed to fetch validation progress: ${response.statusText}`);
      }
      return await response.json();
    },
    enabled: true,
    refetchInterval: isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 2000, // Consider data stale after 2 seconds
    gcTime: 30000, // Keep in cache for 30 seconds
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

  // Start validation
  const startValidation = useCallback(async (params: { batchSize?: number; resourceTypes?: string[] }) => {
    try {
      const response = await fetch('/api/validation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start validation');
      }

      // Invalidate progress cache to get fresh data
      queryClient.invalidateQueries({ queryKey });
      
      if (showNotifications) {
        toast({
          title: "Validation Started",
          description: "Batch validation has been started successfully",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start validation';
      if (showNotifications) {
        toast({
          title: "Start Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

  // Pause validation
  const pauseValidation = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/pause', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to pause validation');
      }

      // Invalidate progress cache
      queryClient.invalidateQueries({ queryKey });
      
      if (showNotifications) {
        toast({
          title: "Validation Paused",
          description: "Batch validation has been paused",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pause validation';
      if (showNotifications) {
        toast({
          title: "Pause Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

  // Resume validation
  const resumeValidation = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/resume', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resume validation');
      }

      // Invalidate progress cache
      queryClient.invalidateQueries({ queryKey });
      
      if (showNotifications) {
        toast({
          title: "Validation Resumed",
          description: "Batch validation has been resumed",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resume validation';
      if (showNotifications) {
        toast({
          title: "Resume Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

  // Stop validation
  const stopValidation = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to stop validation');
      }

      // Invalidate progress cache
      queryClient.invalidateQueries({ queryKey });
      
      if (showNotifications) {
        toast({
          title: "Validation Stopped",
          description: "Batch validation has been stopped",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop validation';
      if (showNotifications) {
        toast({
          title: "Stop Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

  // Cancel validation
  const cancelValidation = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel validation');
      }

      // Invalidate progress cache
      queryClient.invalidateQueries({ queryKey });
      
      if (showNotifications) {
        toast({
          title: "Validation Cancelled",
          description: "Batch validation has been cancelled",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel validation';
      if (showNotifications) {
        toast({
          title: "Cancel Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

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
    progress,
    isLoading: showLoading ? isLoading : false,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
    startValidation,
    pauseValidation,
    resumeValidation,
    stopValidation,
    cancelValidation,
  };
}

export default useValidationProgress;

