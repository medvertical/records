import React from 'react';
import { Card } from '@/components/ui/card';
import { ValidationControlPanel } from '../controls/ValidationControlPanel';
import { 
  AlertCard, 
  OverviewCard, 
  StatusCard, 
  TrendsCard, 
  ResourceBreakdownCard 
} from '../widgets';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { DashboardErrorBoundary } from '../shared/ErrorBoundary';
import { ValidationHistoryTimeline } from '@/components/validation/validation-history-timeline';

interface ModernDashboardLayoutProps {
  className?: string;
}

export const ModernDashboardLayout: React.FC<ModernDashboardLayoutProps> = ({
  className,
}) => {
  return (
    <DashboardProvider>
      <div className={`min-h-screen bg-background ${className}`}>
        {/* Main Dashboard Content - Wireframe-based Layout */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Row - Four Cards (Desktop: 4-column, Tablet: 2-column, Mobile: 1-column) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          <DashboardErrorBoundary context="AlertCard">
            <AlertCard />
          </DashboardErrorBoundary>
          <DashboardErrorBoundary context="OverviewCard">
            <OverviewCard />
          </DashboardErrorBoundary>
          <DashboardErrorBoundary context="StatusCard">
            <StatusCard />
          </DashboardErrorBoundary>
          <DashboardErrorBoundary context="TrendsCard">
            <TrendsCard />
          </DashboardErrorBoundary>
        </div>

          {/* Validation Control Panel - Full Width */}
          <div className="mb-6">
            <DashboardErrorBoundary context="ValidationControlPanel">
              <ValidationControlPanel />
            </DashboardErrorBoundary>
          </div>

          {/* Resource Breakdown Card */}
          <div className="mb-6">
            <DashboardErrorBoundary context="ResourceBreakdownCard">
              <ResourceBreakdownCard />
            </DashboardErrorBoundary>
          </div>

          {/* Validation History Timeline - Full Width */}
          <div className="mb-6">
            <DashboardErrorBoundary context="ValidationHistoryTimeline">
              <ValidationHistoryTimeline />
            </DashboardErrorBoundary>
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
};
