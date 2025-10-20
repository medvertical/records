// ============================================================================
// Modern Dashboard Component - Batch Validation Control
// ============================================================================

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardErrorBoundary } from '@/components/dashboard/shared/ErrorBoundary';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { BatchControlIdleWidget } from '@/components/dashboard/batch/BatchControlIdleWidget';
import { BatchControlRunningWidget } from '@/components/dashboard/batch/BatchControlRunningWidget';
import { ResourceTypePieChart } from '@/components/dashboard/resource-type-pie-chart';
import { ValidationStatusChartCard } from '@/components/dashboard/ValidationStatusChartCard';
import { useDashboardBatchState } from '@/hooks/use-dashboard-batch-state';

/**
 * Dashboard Component - Validation health monitoring and batch validation control
 * Layout: 4 metric cards at top, batch control widget full width, then resources and chart
 */
export default function Dashboard() {
  const { mode, progress } = useDashboardBatchState();

  // Fetch FHIR server resource counts - filtered/validated types
  // Shared with sidebar/quick access via same query key
  // Uses in-memory cache on backend for instant loading
  const { data: resourceCountsData, isLoading: isResourcesLoading } = useQuery({
    queryKey: ["/api/fhir/resource-counts"], // Same key as sidebar
    queryFn: async () => {
      const response = await fetch('/api/fhir/resource-counts');
      if (!response.ok) throw new Error('Failed to fetch resource counts');
      
      const data = await response.json();
      
      // Transform to match sidebar format: Record<string, number>
      const counts: Record<string, number> = {};
      if (data.resourceTypes && Array.isArray(data.resourceTypes)) {
        data.resourceTypes.forEach((item: { resourceType: string; count: number }) => {
          counts[item.resourceType] = item.count;
        });
      }
      
      return {
        resourceTypes: data.resourceTypes,
        totalResources: data.totalResources,
        counts // Add transformed counts
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (backend has its own cache)
    refetchInterval: false,
    refetchOnWindowFocus: true, // Refetch in background when tab focused
    refetchOnMount: false,
    placeholderData: (previousData) => previousData, // Show old data during refetch
    retry: 2, // Retry failed requests
  });

  // Fetch validation stats
  const { data: dashboardData, isLoading: isValidationLoading } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/combined');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    refetchInterval: mode === 'running' ? 5000 : 30000, // Poll faster when batch running
  });

  // Fetch validation settings to get included resource types
  const { data: validationSettings } = useQuery({
    queryKey: ['validation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      if (!response.ok) throw new Error('Failed to fetch validation settings');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isLoading = isResourcesLoading || isValidationLoading;

  // Total Resources: ALWAYS show total from FHIR server, not from batch validation
  const totalResources = resourceCountsData?.totalResources || 0;

  const validationCoverage = dashboardData?.validation?.validationCoverage || 0;
  
  // Errors/Warnings: Use live batch progress when running, otherwise use dashboard data
  const errorResources = mode === 'running' && progress?.errors !== undefined
    ? progress.errors
    : dashboardData?.validation?.errorResources || 0;

  const warningResources = mode === 'running' && progress?.warnings !== undefined
    ? progress.warnings
    : dashboardData?.validation?.warningResources || 0;

  // Get trends from dashboard data
  const errorTrend = dashboardData?.validation?.errorTrend || null;
  const warningTrend = dashboardData?.validation?.warningTrend || null;

  // Use transformed counts from query, filtered by included types from settings
  const allResourceCounts = resourceCountsData?.counts || {};
  const includedTypes = validationSettings?.resourceTypes?.includedTypes || [];
  
  // Filter resource counts to only show types that are in the settings
  const resourceCounts = includedTypes.length > 0
    ? Object.fromEntries(
        Object.entries(allResourceCounts).filter(([type]) => 
          includedTypes.includes(type)
        )
      )
    : allResourceCounts;

  return (
    <div className="min-h-screen bg-background">
      <DashboardErrorBoundary context="Dashboard">
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
          {/* Top Row: 4 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Resources"
              value={totalResources.toLocaleString()}
              subtitle="From FHIR server"
              loading={isLoading}
            />
            <MetricCard
              title="Validation Coverage"
              value={`${validationCoverage.toFixed(1)}%`}
              subtitle="Resources validated"
              loading={isLoading}
            />
            <MetricCard
              title="Errors"
              value={errorResources.toLocaleString()}
              subtitle="Validation errors found"
              variant="error"
              trend={errorTrend}
              trendInverted={true}
              loading={isLoading}
            />
            <MetricCard
              title="Warnings"
              value={warningResources.toLocaleString()}
              subtitle="Validation warnings"
              variant="warning"
              trend={warningTrend}
              trendInverted={true}
              loading={isLoading}
            />
          </div>

          {/* Batch Validation Control Widget - switches between idle/running */}
          <DashboardErrorBoundary context="BatchControl">
            {mode === 'idle' ? (
              <BatchControlIdleWidget />
            ) : (
              <BatchControlRunningWidget />
            )}
          </DashboardErrorBoundary>

          {/* Bottom Row: Resources by Type (left) + Valid vs Invalid Chart (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardErrorBoundary context="ResourcesByType">
              <ResourceTypePieChart
                resourceCounts={resourceCounts}
              />
            </DashboardErrorBoundary>

            <DashboardErrorBoundary context="ValidationChart">
              <ValidationStatusChartCard
                data={dashboardData?.validation?.resourceTypeBreakdown || {}}
              />
            </DashboardErrorBoundary>
          </div>
        </div>
      </DashboardErrorBoundary>
    </div>
  );
}