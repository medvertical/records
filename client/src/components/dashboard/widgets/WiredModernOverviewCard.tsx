import React from 'react';
import { ModernOverviewCard } from './ModernOverviewCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredModernOverviewCardProps {
  className?: string;
}

export const WiredModernOverviewCard: React.FC<WiredModernOverviewCardProps> = ({
  className,
}) => {
  const { overviewMetrics, isLoading, hasErrors } = useDashboardDataWiring();

  return (
    <ModernOverviewCard
      metrics={overviewMetrics}
      isLoading={isLoading}
      error={hasErrors ? 'Failed to load metrics' : null}
      className={className}
    />
  );
};
