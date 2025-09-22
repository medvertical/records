import React from 'react';
import { TrendsCard } from './TrendsCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

/**
 * WiredTrendsCard Component - Single responsibility: Connect TrendsCard to real historical validation data
 * Follows global rules: Single responsibility, uses existing data wiring hook
 */
interface WiredTrendsCardProps {
  className?: string;
}

export const WiredTrendsCard: React.FC<WiredTrendsCardProps> = ({
  className,
}) => {
  const {
    trendData,
    trendMetrics,
    trendsLoading,
    trendsError,
    refreshTrends,
    lastUpdated,
  } = useDashboardDataWiring();

  return (
    <TrendsCard
      trends={trendData}
      metrics={trendMetrics}
      loading={trendsLoading}
      error={trendsError}
      onRefresh={refreshTrends}
      lastUpdated={lastUpdated}
      className={className}
    />
  );
};

export default WiredTrendsCard;
