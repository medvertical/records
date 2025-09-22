import React from 'react';
import { ModernTrendsCard } from './ModernTrendsCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredModernTrendsCardProps {
  className?: string;
}

export const WiredModernTrendsCard: React.FC<WiredModernTrendsCardProps> = ({
  className,
}) => {
  const { trendData, isLoading, hasErrors } = useDashboardDataWiring();

  return (
    <ModernTrendsCard
      trends={trendData}
      isLoading={isLoading}
      error={hasErrors ? 'Failed to load trends' : null}
      onViewChart={() => console.log('View detailed chart')}
      className={className}
    />
  );
};
