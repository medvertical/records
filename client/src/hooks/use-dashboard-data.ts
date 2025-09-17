// ============================================================================
// Dashboard Data Hook - Centralized Data Management
// ============================================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { 
  FhirServerStats, 
  ValidationStats, 
  DashboardData, 
  ValidationProgress 
} from '@shared/types/dashboard';

// ============================================================================
// Types
// ============================================================================

interface UseDashboardDataOptions {
  enableRealTimeUpdates?: boolean;
  refetchInterval?: number;
  enableCaching?: boolean;
  enabled?: boolean;
}

interface UseDashboardDataReturn {
  // Data
  fhirServerStats: FhirServerStats | undefined;
  validationStats: ValidationStats | undefined;
  combinedData: DashboardData | undefined;
  
  // Loading states
  isLoading: boolean;
  isFhirServerLoading: boolean;
  isValidationLoading: boolean;
  
  // Error states
  error: string | null;
  fhirServerError: string | null;
  validationError: string | null;
  
  // Actions
  refetch: () => void;
  refetchFhirServer: () => void;
  refetchValidation: () => void;
  
  // Status
  lastUpdated: Date | null;
  isStale: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useDashboardData(options: UseDashboardDataOptions = {}): UseDashboardDataReturn {
  const {
    enableRealTimeUpdates = true,
    refetchInterval = 600000, // 10 minutes (reduced frequency for better performance)
    enableCaching = true,
    enabled = true
  } = options;

  const isEnabled = Boolean(enabled);
  const shouldRefetch = isEnabled && enableRealTimeUpdates;

  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Listen for settings changes to invalidate dashboard cache
  useEffect(() => {
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_changed' && data.data?.type === 'validation_settings_updated') {
          console.log('[useDashboardData] Validation settings updated, invalidating cache');
          // Invalidate all dashboard-related queries
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/fhir-server-stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/validation-stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/combined'] });
          queryClient.invalidateQueries({ queryKey: ['/api/validation/bulk/progress'] });
          queryClient.invalidateQueries({ queryKey: ['/api/validation/errors/recent'] });
          queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    // Add event listener for SSE messages
    const sse = (window as any).validationSSE;
    if (sse) {
      sse.addEventListener('message', handleSSEMessage);
      return () => sse.removeEventListener('message', handleSSEMessage);
    }
  }, [queryClient]);

  // FHIR Server Stats Query
  const {
    data: fhirServerStats,
    isLoading: isFhirServerLoading,
    error: fhirServerError,
    refetch: refetchFhirServer
  } = useQuery({
    queryKey: ['/api/dashboard/fhir-server-stats'],
    refetchInterval: shouldRefetch ? refetchInterval : false,
    staleTime: enableCaching ? 30 * 60 * 1000 : 0, // 30 minutes (extended for better performance)
    keepPreviousData: true, // Prevent flashing during refetch
    enabled: isEnabled,
    onSuccess: () => {
      setLastUpdated(new Date());
      setIsStale(false);
    },
    onError: (error: any) => {
      console.error('[useDashboardData] FHIR server stats error:', error);
    }
  });

  // Validation Stats Query
  const {
    data: validationStats,
    isLoading: isValidationLoading,
    error: validationError,
    refetch: refetchValidation
  } = useQuery({
    queryKey: ['/api/dashboard/validation-stats'],
    refetchInterval: shouldRefetch ? refetchInterval : false,
    staleTime: enableCaching ? 2 * 60 * 1000 : 0, // 2 minutes (extended for better performance)
    keepPreviousData: true, // Prevent flashing during refetch
    enabled: isEnabled,
    onSuccess: () => {
      setLastUpdated(new Date());
      setIsStale(false);
    },
    onError: (error: any) => {
      console.error('[useDashboardData] Validation stats error:', error);
    }
  });

  // Combined Data Query (for backward compatibility)
  const {
    data: combinedData,
    isLoading: isCombinedLoading,
    error: combinedError,
    refetch: refetchCombined
  } = useQuery({
    queryKey: ['/api/dashboard/combined'],
    refetchInterval: shouldRefetch ? refetchInterval : false,
    staleTime: enableCaching ? 2 * 60 * 1000 : 0, // 2 minutes (extended for better performance)
    keepPreviousData: true, // Prevent flashing during refetch
    enabled: isEnabled,
    onSuccess: () => {
      setLastUpdated(new Date());
      setIsStale(false);
    },
    onError: (error: any) => {
      console.error('[useDashboardData] Combined data error:', error);
    }
  });

  // Legacy Dashboard Stats Query (for backward compatibility)
  const {
    data: legacyStats,
    isLoading: isLegacyLoading,
    error: legacyError,
    refetch: refetchLegacy
  } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: shouldRefetch ? refetchInterval : false,
    staleTime: enableCaching ? 2 * 60 * 1000 : 0, // 2 minutes (extended for better performance)
    keepPreviousData: true, // Prevent flashing during refetch
    enabled: isEnabled,
    onSuccess: () => {
      setLastUpdated(new Date());
      setIsStale(false);
    },
    onError: (error: any) => {
      console.error('[useDashboardData] Legacy stats error:', error);
    }
  });

  // Combined loading state
  const isLoading = isFhirServerLoading || isValidationLoading || isCombinedLoading || isLegacyLoading;

  // Combined error state
  const error = fhirServerError?.message || validationError?.message || combinedError?.message || legacyError?.message || null;

  // Refetch all data
  const refetch = useCallback(() => {
    refetchFhirServer();
    refetchValidation();
    refetchCombined();
    refetchLegacy();
  }, [refetchFhirServer, refetchValidation, refetchCombined, refetchLegacy]);

  // Check for stale data
  useEffect(() => {
    if (lastUpdated) {
      const now = new Date();
      const age = now.getTime() - lastUpdated.getTime();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      setIsStale(age > staleThreshold);
    }
  }, [lastUpdated]);

  return {
    // Data
    fhirServerStats,
    validationStats,
    combinedData,
    
    // Loading states
    isLoading,
    isFhirServerLoading,
    isValidationLoading,
    
    // Error states
    error,
    fhirServerError: fhirServerError?.message || null,
    validationError: validationError?.message || null,
    
    // Actions
    refetch,
    refetchFhirServer,
    refetchValidation,
    
    // Status
    lastUpdated,
    isStale
  };
}

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Hook for FHIR server statistics only
 */
export function useFhirServerStats() {
  return useQuery({
    queryKey: ['/api/dashboard/fhir-server-stats'],
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 5 * 60 * 1000,
    keepPreviousData: true // Prevent flashing during refetch
  });
}

/**
 * Hook for validation statistics only
 */
export function useValidationStats() {
  return useQuery({
    queryKey: ['/api/dashboard/validation-stats'],
    refetchInterval: 1 * 60 * 1000, // 1 minute
    staleTime: 1 * 60 * 1000,
    keepPreviousData: true // Prevent flashing during refetch
  });
}

/**
 * Hook for combined dashboard data
 */
export function useCombinedDashboardData() {
  return useQuery({
    queryKey: ['/api/dashboard/combined'],
    refetchInterval: 1 * 60 * 1000, // 1 minute
    staleTime: 1 * 60 * 1000,
    keepPreviousData: true // Prevent flashing during refetch
  });
}

/**
 * Hook for legacy dashboard stats (backward compatibility)
 */
export function useLegacyDashboardStats() {
  return useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 1 * 60 * 1000, // 1 minute
    staleTime: 1 * 60 * 1000,
    keepPreviousData: true // Prevent flashing during refetch
  });
}
