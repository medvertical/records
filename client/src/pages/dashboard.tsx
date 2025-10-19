// ============================================================================
// Modern Dashboard Component - Batch Validation Control
// ============================================================================

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardErrorBoundary } from '@/components/dashboard/shared/ErrorBoundary';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { BatchControlIdleWidget } from '@/components/dashboard/batch/BatchControlIdleWidget';
import { BatchControlRunningWidget } from '@/components/dashboard/batch/BatchControlRunningWidget';
import { ResourcesByTypeCard } from '@/components/dashboard/ResourcesByTypeCard';
import { ValidationStatusChartCard } from '@/components/dashboard/ValidationStatusChartCard';
import { useDashboardBatchState } from '@/hooks/use-dashboard-batch-state';

/**
 * Dashboard Component - Validation health monitoring and batch validation control
 * Layout: 4 metric cards at top, batch control widget full width, then resources and chart
 */
export default function Dashboard() {
  const { mode, progress } = useDashboardBatchState();

  // Fetch FHIR server resource counts
  const { data: resourceCountsData, isLoading: isResourcesLoading } = useQuery({
    queryKey: ['fhir-resource-counts'],
    queryFn: async () => {
      const response = await fetch('/api/fhir/resource-counts');
      if (!response.ok) throw new Error('Failed to fetch resource counts');
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
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

  const isLoading = isResourcesLoading || isValidationLoading;

  // Use live progress data when batch is running, otherwise use static dashboard data
  const totalResources = mode === 'running' && progress?.totalResources
    ? progress.totalResources
    : resourceCountsData?.totalResources || 0;

  const validationCoverage = dashboardData?.validation?.validationCoverage || 0;
  
  const errorResources = mode === 'running' && progress?.errors !== undefined
    ? progress.errors
    : dashboardData?.validation?.errorResources || 0;

  const warningResources = mode === 'running' && progress?.warnings !== undefined
    ? progress.warnings
    : dashboardData?.validation?.warningResources || 0;

  // Get trends from dashboard data
  const errorTrend = dashboardData?.validation?.errorTrend || null;
  const warningTrend = dashboardData?.validation?.warningTrend || null;

  // Convert resource counts array to object format
  const resourceCounts = resourceCountsData?.resourceTypes?.reduce((acc: Record<string, number>, item: any) => {
    acc[item.resourceType] = item.count;
    return acc;
  }, {}) || {};

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
              <ResourcesByTypeCard
                data={resourceCounts}
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