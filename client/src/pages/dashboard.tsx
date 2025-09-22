// ============================================================================
// New Modular Dashboard Component - Replacing Legacy Dashboard
// ============================================================================

import React from 'react';
import { WiredValidationControlPanel } from '@/components/dashboard/controls/WiredValidationControlPanel';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

/**
 * New Modular Dashboard Component - Single responsibility: Main dashboard page
 * Follows global rules: Under 400 lines, single responsibility, uses existing patterns
 * Replaces the legacy monolithic Dashboard.tsx with modern modular architecture
 */
export default function Dashboard() {
  const {
    // Overview data
    overviewMetrics,
    
    // Status data
    validationStatus,
    
    // Resource breakdown data
    resourceBreakdownData,
    
    // Global state
    isLoading,
    hasErrors,
    lastUpdated,
  } = useDashboardDataWiring();

  // Loading state
  if (isLoading && !hasErrors) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">🚀 NEW RECORDS DASHBOARD v2.0 🚀</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card p-6 rounded-lg border animate-pulse">
                <div className="h-6 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🚀 NEW RECORDS DASHBOARD v2.0 🚀</h1>
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : new Date().toLocaleTimeString()}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Alerts Card */}
          <div className="bg-card p-6 rounded-lg border shadow-lg">
            <h2 className="text-xl font-semibold mb-2">🚨 Alerts</h2>
            <div className="text-2xl font-bold mb-1">
              {overviewMetrics?.errorResources || 0}
            </div>
            <p className="text-sm text-muted-foreground">
              {overviewMetrics?.errorResources || 0} errors, 0 warnings
            </p>
          </div>
          
          {/* Overview Card */}
          <div className="bg-card p-6 rounded-lg border shadow-lg">
            <h2 className="text-xl font-semibold mb-2">📊 Overview</h2>
            <div className="text-2xl font-bold mb-1">
              {overviewMetrics?.totalResources?.toLocaleString() || '0'}
            </div>
            <p className="text-sm text-muted-foreground">
              {overviewMetrics?.successRate?.toFixed(1) || '0'}% success rate
            </p>
          </div>
          
          {/* Status Card */}
          <div className="bg-card p-6 rounded-lg border shadow-lg">
            <h2 className="text-xl font-semibold mb-2">⚡ Status</h2>
            <div className="text-2xl font-bold mb-1 capitalize">
              {validationStatus?.status || 'idle'}
            </div>
            <p className="text-sm text-muted-foreground">
              {validationStatus?.progress?.toFixed(1) || '0'}% complete
            </p>
          </div>
          
          {/* Trends Card */}
          <div className="bg-card p-6 rounded-lg border shadow-lg">
            <h2 className="text-xl font-semibold mb-2">📈 Trends</h2>
            <div className="text-2xl font-bold mb-1">
              {overviewMetrics?.validatedResources?.toLocaleString() || '0'}
            </div>
            <p className="text-sm text-muted-foreground">
              Resources validated
            </p>
          </div>
        </div>
        
        <div className="mt-8">
          <WiredValidationControlPanel />
        </div>
        
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-lg border shadow-lg">
            <h2 className="text-xl font-semibold mb-4">📋 Resource Breakdown</h2>
            <div className="space-y-2">
              {resourceBreakdownData?.resourceTypes?.slice(0, 5).map((resource, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{resource.name}</span>
                  <span className="text-sm font-medium">{resource.count.toLocaleString()}</span>
                </div>
              )) || (
                <div className="flex justify-between items-center">
                  <span className="text-sm">Patient</span>
                  <span className="text-sm font-medium">Loading...</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg border shadow-lg">
            <h2 className="text-xl font-semibold mb-4">🔔 Validation Progress</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Status:</span>
                <span className="text-sm font-medium capitalize">{validationStatus?.status || 'idle'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Progress:</span>
                <span className="text-sm font-medium">{validationStatus?.progress?.toFixed(1) || '0'}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Processed:</span>
                <span className="text-sm font-medium">
                  {validationStatus?.processedResources || 0} / {validationStatus?.totalResources || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Valid:</span>
                <span className="text-sm font-medium">{validationStatus?.validResources || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Errors:</span>
                <span className="text-sm font-medium">{validationStatus?.errorResources || 0}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <strong>🎉 SUCCESS!</strong> You are now viewing the NEW MODULAR DASHBOARD v2.0 with REAL VALIDATION CONTROLS and LIVE DATA!
          </div>
        </div>
      </div>
    </div>
  );
}
