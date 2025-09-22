import React from 'react';
import { Card } from '@/components/ui/card';
import { WiredWireframeValidationControlPanel } from '../controls/WiredWireframeValidationControlPanel';
import { WiredWireframeValidationAspectsPanel } from '../controls/WiredWireframeValidationAspectsPanel';
import { 
  WiredWireframeAlertCard, 
  WiredWireframeOverviewCard, 
  WiredWireframeStatusCard, 
  WiredWireframeTrendsCard, 
  WiredWireframeResourceBreakdownCard 
} from '../widgets';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface ModernDashboardLayoutProps {
  className?: string;
}

export const ModernDashboardLayout: React.FC<ModernDashboardLayoutProps> = ({
  className,
}) => {
  const {
    fhirServerStats,
    validationStats,
    serverStatus,
    refreshAll,
  } = useDashboardDataWiring();

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {/* Main Dashboard Content - Wireframe-based Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Row - Four Cards (Desktop: 4-column, Tablet: 2-column, Mobile: 1-column) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          <WiredWireframeAlertCard />
          <WiredWireframeOverviewCard />
          <WiredWireframeStatusCard />
          <WiredWireframeTrendsCard />
        </div>

        {/* Validation Control Panel - Full Width */}
        <div className="mb-6">
          <WiredWireframeValidationControlPanel />
        </div>

        {/* Bottom Row - Two Cards (Desktop: 2-column, Mobile: 1-column) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WiredWireframeResourceBreakdownCard />
          <WiredWireframeValidationAspectsPanel />
        </div>
      </div>
    </div>
  );
};
