import { useMemo, useCallback } from 'react';
import { useDashboardData } from './use-dashboard-data';
import { useValidationPolling } from './use-validation-polling';
import { useServerData } from './use-server-data';
import { useDebouncedValue, useThrottledCallback } from '@/lib/performance-utils';
import {
  AlertDataAdapter,
  OverviewDataAdapter,
  StatusDataAdapter,
  TrendsDataAdapter,
  ResourceBreakdownDataAdapter,
} from '@/lib/dashboard-data-adapters';
import {
  Alert,
  AlertSummary,
  OverviewMetrics,
  ValidationStatus,
  TrendData,
  TrendMetrics,
  ResourceBreakdownData,
} from '@/shared/types/dashboard-new';

/**
 * Dashboard Data Wiring Hook - Single responsibility: Connect dashboard widgets to real data sources
 * Follows global rules: Uses existing polling patterns, single responsibility, focused on data wiring
 */
export interface UseDashboardDataWiringOptions {
  enableRealTimeUpdates?: boolean;
  refetchInterval?: number;
  enabled?: boolean;
}

export interface DashboardDataWiring {
  // Alert Data
  alerts: Alert[];
  alertSummary: AlertSummary;
  alertsLoading: boolean;
  alertsError: string | null;
  refreshAlerts: () => void;

  // Overview Data
  overviewMetrics: OverviewMetrics | undefined;
  overviewLoading: boolean;
  overviewError: string | null;
  refreshOverview: () => void;

  // Status Data
  validationStatus: ValidationStatus | undefined;
  statusLoading: boolean;
  statusError: string | null;
  refreshStatus: () => void;

  // Trends Data
  trendData: TrendData[];
  trendMetrics: TrendMetrics | undefined;
  trendsLoading: boolean;
  trendsError: string | null;
  refreshTrends: () => void;

  // Resource Breakdown Data
  resourceBreakdown: ResourceBreakdownData | undefined;
  resourceBreakdownLoading: boolean;
  resourceBreakdownError: string | null;
  refreshResourceBreakdown: () => void;

  // Global State
  isLoading: boolean;
  hasErrors: boolean;
  lastUpdated: Date | null;
  refreshAll: () => void;
}

export function useDashboardDataWiring(
  options: UseDashboardDataWiringOptions = {}
): DashboardDataWiring {
  const {
    enableRealTimeUpdates = true,
    refetchInterval = 30000, // 30 seconds
    enabled = true,
  } = options;

  // Use existing data hooks
  const {
    fhirServerStats,
    validationStats,
    combinedData,
    isLoading: dashboardLoading,
    isFhirServerLoading,
    isValidationLoading,
    error: dashboardError,
    fhirServerError,
    validationError,
    refetch: refetchDashboard,
    refetchFhirServer,
    refetchValidation,
    lastUpdated: dashboardLastUpdated,
  } = useDashboardData({
    enableRealTimeUpdates,
    refetchInterval,
    enabled,
  });

  const {
    progress: validationProgress,
    isConnected: validationConnected,
    connectionState,
    lastError: pollingError,
    startPolling,
    stopPolling,
    syncWithApi,
  } = useValidationPolling({
    enabled: enableRealTimeUpdates && enabled,
    pollInterval: refetchInterval,
  });

  const {
    activeServer,
    serverStatus,
    isLoading: serverLoading,
    error: serverError,
    refresh: refreshServer,
  } = useServerData();

  // Debounce rapid updates for better performance
  const debouncedValidationStats = useDebouncedValue(validationStats, 500);
  const debouncedServerStatus = useDebouncedValue(serverStatus, 300);

  // Transform data using adapters with debounced inputs
  const alerts = useMemo(() => {
    const validationAlerts = AlertDataAdapter.transformValidationErrors(
      debouncedValidationStats?.aspectBreakdown ? Object.values(debouncedValidationStats.aspectBreakdown) : []
    );
    const serverAlerts = AlertDataAdapter.transformServerAlerts(
      debouncedServerStatus?.error ? [{ message: debouncedServerStatus.error, level: 'error' }] : []
    );
    return [...validationAlerts, ...serverAlerts];
  }, [debouncedValidationStats, debouncedServerStatus]);

  const alertSummary = useMemo(() => {
    return AlertDataAdapter.createAlertSummary(alerts);
  }, [alerts]);

  const overviewMetrics = useMemo(() => {
    return OverviewDataAdapter.transformToOverviewMetrics(fhirServerStats, validationStats);
  }, [fhirServerStats, validationStats]);

  const validationStatus = useMemo(() => {
    return StatusDataAdapter.transformValidationProgress(validationProgress);
  }, [validationProgress]);

  const trendData = useMemo(() => {
    // For now, we'll create mock trend data based on current metrics
    // In a real implementation, this would come from historical data API
    if (!overviewMetrics) return [];
    
    const now = new Date();
    const mockTrendData: TrendData[] = [];
    
    // Generate last 7 days of data with slight variations
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const variation = (Math.random() - 0.5) * 10; // ±5% variation
      const successRate = Math.max(0, Math.min(100, overviewMetrics.successRate + variation));
      
      mockTrendData.push({
        date,
        successRate,
        totalValidated: Math.floor(overviewMetrics.validatedResources * (1 + Math.random() * 0.1)),
        errorCount: Math.floor(Math.random() * 50),
        warningCount: Math.floor(Math.random() * 100),
      });
    }
    
    return mockTrendData;
  }, [overviewMetrics]);

  const trendMetrics = useMemo(() => {
    return TrendsDataAdapter.calculateTrendMetrics(trendData);
  }, [trendData]);

  const resourceBreakdown = useMemo(() => {
    return ResourceBreakdownDataAdapter.transformResourceStats(fhirServerStats, validationStats);
  }, [fhirServerStats, validationStats]);

  // Loading states
  const alertsLoading = isValidationLoading || serverLoading;
  const overviewLoading = isFhirServerLoading || isValidationLoading;
  const statusLoading = !validationConnected;
  const trendsLoading = overviewLoading; // Trends depend on overview data
  const resourceBreakdownLoading = isFhirServerLoading || isValidationLoading;

  // Error states
  const alertsError = pollingError || serverError;
  const overviewError = fhirServerError || validationError;
  const statusError = pollingError;
  const trendsError = overviewError; // Trends depend on overview data
  const resourceBreakdownError = fhirServerError || validationError;

  // Global loading and error states
  const isLoading = dashboardLoading || statusLoading;
  const hasErrors = !!(dashboardError || pollingError || serverError);
  const lastUpdated = dashboardLastUpdated || new Date();

  // Throttled refresh functions to prevent rapid API calls
  const refreshAlerts = useThrottledCallback(() => {
    refetchValidation();
    refreshServer();
  }, 1000);

  const refreshOverview = useThrottledCallback(() => {
    refetchDashboard();
  }, 1000);

  const refreshStatus = useThrottledCallback(() => {
    syncWithApi();
  }, 500);

  const refreshTrends = useThrottledCallback(() => {
    refetchDashboard();
  }, 1000);

  const refreshResourceBreakdown = useThrottledCallback(() => {
    refetchDashboard();
  }, 1000);

  const refreshAll = useThrottledCallback(() => {
    refetchDashboard();
    syncWithApi();
    refreshServer();
  }, 2000);

  return {
    // Alert Data
    alerts,
    alertSummary,
    alertsLoading,
    alertsError,
    refreshAlerts,

    // Overview Data
    overviewMetrics,
    overviewLoading,
    overviewError,
    refreshOverview,

    // Status Data
    validationStatus,
    statusLoading,
    statusError,
    refreshStatus,

    // Trends Data
    trendData,
    trendMetrics,
    trendsLoading,
    trendsError,
    refreshTrends,

    // Resource Breakdown Data
    resourceBreakdown,
    resourceBreakdownLoading,
    resourceBreakdownError,
    refreshResourceBreakdown,

    // Global State
    isLoading,
    hasErrors,
    lastUpdated,
    refreshAll,
    syncWithApi,
  };
}

export default useDashboardDataWiring;
