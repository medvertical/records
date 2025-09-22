import React from 'react';
import { WireframeResourceBreakdownCard } from './WireframeResourceBreakdownCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';
import { useLocation } from 'wouter';

interface WiredWireframeResourceBreakdownCardProps {
  className?: string;
}

/**
 * Wired Wireframe Resource Breakdown Card - Connects wireframe ResourceBreakdownCard to real data
 */
export const WiredWireframeResourceBreakdownCard: React.FC<WiredWireframeResourceBreakdownCardProps> = ({
  className,
}) => {
  const {
    resourceBreakdown,
    resourceBreakdownLoading,
    resourceBreakdownError,
    refreshResourceBreakdown,
  } = useDashboardDataWiring();

  const [, setLocation] = useLocation();

  const handleResourceTypeClick = (resourceType: string) => {
    setLocation(`/resources?type=${resourceType}`);
  };

  const handleViewAll = () => {
    setLocation('/resources');
  };

  return (
    <WireframeResourceBreakdownCard
      resourceTypes={resourceBreakdown?.resourceTypes}
      totalResources={resourceBreakdown?.totalResources}
      onResourceTypeClick={handleResourceTypeClick}
      onViewAll={handleViewAll}
      isLoading={resourceBreakdownLoading}
      error={resourceBreakdownError}
      className={className}
    />
  );
};
