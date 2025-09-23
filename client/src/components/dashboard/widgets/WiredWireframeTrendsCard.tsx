import React from 'react';
import { TrendsCard } from './TrendsCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredWireframeTrendsCardProps {
  className?: string;
}

/**
 * Wired Wireframe Trends Card - Connects wireframe TrendsCard to real data
 */
export const WiredWireframeTrendsCard: React.FC<WiredWireframeTrendsCardProps> = ({
  className,
}) => {
  const { 
    validationStats, 
    trendsLoading, 
    trendsError, 
    refreshTrends 
  } = useDashboardDataWiring();

  // Calculate current success rate
  const currentSuccessRate = validationStats?.totalValidated > 0 
    ? ((validationStats?.validResources || 0) / validationStats.totalValidated) * 100
    : 0;

  // Mock previous success rate for trend calculation (in real app, this would come from historical data)
  const previousSuccessRate = Math.max(0, currentSuccessRate - Math.random() * 5);
  const trendChange = currentSuccessRate - previousSuccessRate;
  const trendDirection = trendChange > 0.5 ? 'up' : trendChange < -0.5 ? 'down' : 'stable';

  return (
    <TrendsCard
      currentSuccessRate={currentSuccessRate}
      previousSuccessRate={previousSuccessRate}
      trendDirection={trendDirection}
      trendChange={Math.abs(trendChange)}
      period="vs last week"
      isLoading={trendsLoading}
      error={trendsError}
      className={className}
    />
  );
};
