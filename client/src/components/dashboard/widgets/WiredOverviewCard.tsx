import React from 'react';
import { OverviewCard } from './OverviewCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

/**
 * WiredOverviewCard Component - Single responsibility: Connect OverviewCard to real FHIR server and validation data
 * Follows global rules: Single responsibility, uses existing data wiring hook
 */
interface WiredOverviewCardProps {
  className?: string;
}

export const WiredOverviewCard: React.FC<WiredOverviewCardProps> = ({
  className,
}) => {
  const {
    overviewMetrics,
    overviewLoading,
    overviewError,
    refreshOverview,
    lastUpdated,
  } = useDashboardDataWiring();

  return (
    <OverviewCard
      metrics={overviewMetrics}
      loading={overviewLoading}
      error={overviewError}
      onRefresh={refreshOverview}
      lastUpdated={lastUpdated}
      className={className}
    />
  );
};

export default WiredOverviewCard;
