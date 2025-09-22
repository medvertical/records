import React from 'react';
import { ResourceBreakdownCard } from './ResourceBreakdownCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';
import { useNavigate } from 'wouter';

/**
 * WiredResourceBreakdownCard Component - Single responsibility: Connect ResourceBreakdownCard to real resource data
 * Follows global rules: Single responsibility, uses existing data wiring hook
 */
interface WiredResourceBreakdownCardProps {
  className?: string;
}

export const WiredResourceBreakdownCard: React.FC<WiredResourceBreakdownCardProps> = ({
  className,
}) => {
  const {
    resourceBreakdown,
    resourceBreakdownLoading,
    resourceBreakdownError,
    refreshResourceBreakdown,
    lastUpdated,
  } = useDashboardDataWiring();

  const navigate = useNavigate();

  // Handle resource type click - navigate to resources page with filter
  const handleResourceTypeClick = (resourceType: string) => {
    navigate(`/resources?type=${resourceType}`);
  };

  return (
    <ResourceBreakdownCard
      data={resourceBreakdown}
      loading={resourceBreakdownLoading}
      error={resourceBreakdownError}
      onRefresh={refreshResourceBreakdown}
      onResourceTypeClick={handleResourceTypeClick}
      lastUpdated={lastUpdated}
      className={className}
    />
  );
};

export default WiredResourceBreakdownCard;
