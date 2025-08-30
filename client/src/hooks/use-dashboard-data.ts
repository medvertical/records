// ============================================================================
// Dashboard Data Hook - Centralized Data Management
// ============================================================================

import { useQuery } from '@tanstack/react-query';
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
    refetchInterval = 300000, // 5 minutes (reduced from 30 seconds for better performance)
    enableCaching = true
  } = options;

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  // FHIR Server Stats Query
  const {
    data: fhirServerStats,
    isLoading: isFhirServerLoading,
    error: fhirServerError,
    refetch: refetchFhirServer
  } = useQuery({
    queryKey: ['/api/dashboard/fhir-server-stats'],
    refetchInterval: enableRealTimeUpdates ? refetchInterval : false,
    staleTime: enableCaching ? 15 * 60 * 1000 : 0, // 15 minutes (extended for better performance)
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
    refetchInterval: enableRealTimeUpdates ? refetchInterval : false,
    staleTime: enableCaching ? 2 * 60 * 1000 : 0, // 2 minutes (extended for better performance)
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
    refetchInterval: enableRealTimeUpdates ? refetchInterval : false,
    staleTime: enableCaching ? 2 * 60 * 1000 : 0, // 2 minutes (extended for better performance)
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
    refetchInterval: enableRealTimeUpdates ? refetchInterval : false,
    staleTime: enableCaching ? 2 * 60 * 1000 : 0, // 2 minutes (extended for better performance)
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
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Hook for validation statistics only
 */
export function useValidationStats() {
  return useQuery({
    queryKey: ['/api/dashboard/validation-stats'],
    refetchInterval: 1 * 60 * 1000, // 1 minute
    staleTime: 1 * 60 * 1000
  });
}

/**
 * Hook for combined dashboard data
 */
export function useCombinedDashboardData() {
  return useQuery({
    queryKey: ['/api/dashboard/combined'],
    refetchInterval: 1 * 60 * 1000, // 1 minute
    staleTime: 1 * 60 * 1000
  });
}

/**
 * Hook for legacy dashboard stats (backward compatibility)
 */
export function useLegacyDashboardStats() {
  return useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 1 * 60 * 1000, // 1 minute
    staleTime: 1 * 60 * 1000
  });
}
