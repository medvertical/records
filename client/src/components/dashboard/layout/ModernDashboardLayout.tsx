import React from 'react';
import { Card } from '@/components/ui/card';
import { ModernDashboardHeader } from './ModernDashboardHeader';
import { WiredValidationControlPanel } from '../controls/WiredValidationControlPanel';
import { WiredModernValidationAspectsPanel } from '../controls/WiredModernValidationAspectsPanel';
import { 
  WiredModernAlertCard, 
  WiredModernOverviewCard, 
  WiredModernStatusCard, 
  WiredModernTrendsCard, 
  WiredModernResourceBreakdownCard 
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
      {/* Modern Header */}
      <div className="mb-6">
        <ModernDashboardHeader
          serverName="Production FHIR Server"
          serverVersion="R4"
          isConnected={serverStatus?.isConnected}
          totalResources={fhirServerStats?.totalResources}
          lastUpdated={new Date()}
          onRefresh={refreshAll}
          onSettings={() => console.log('Settings clicked')}
          onUserMenu={() => console.log('User menu clicked')}
        />
      </div>

      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Row - Four Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <WiredModernAlertCard />
          <WiredModernOverviewCard />
          <WiredModernStatusCard />
          <WiredModernTrendsCard />
        </div>

        {/* Validation Control Panel - Full Width */}
        <div className="mb-6">
          <WiredValidationControlPanel />
        </div>

        {/* Bottom Row - Two Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WiredModernResourceBreakdownCard />
          <WiredModernValidationAspectsPanel />
        </div>
      </div>
    </div>
  );
};
