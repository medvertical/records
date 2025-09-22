import React from 'react';
import { WireframeOverviewCard } from './WireframeOverviewCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredWireframeOverviewCardProps {
  className?: string;
}

/**
 * Wired Wireframe Overview Card - Connects wireframe OverviewCard to real data
 */
export const WiredWireframeOverviewCard: React.FC<WiredWireframeOverviewCardProps> = ({
  className,
}) => {
  const { 
    fhirServerStats, 
    validationStats, 
    isLoading, 
    hasErrors, 
    refreshOverview 
  } = useDashboardDataWiring();

  // Calculate success rate from validation stats
  const successRate = validationStats?.totalValidated > 0 
    ? ((validationStats?.validResources || 0) / validationStats.totalValidated) * 100
    : 0;

  return (
    <WireframeOverviewCard
      totalResources={fhirServerStats?.totalResources}
      validatedResources={validationStats?.totalValidated}
      successRate={successRate}
      isLoading={isLoading}
      error={hasErrors ? 'Failed to load overview data' : null}
      className={className}
    />
  );
};
