import React from 'react';
import { ModernResourceBreakdownCard } from './ModernResourceBreakdownCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredModernResourceBreakdownCardProps {
  className?: string;
}

export const WiredModernResourceBreakdownCard: React.FC<WiredModernResourceBreakdownCardProps> = ({
  className,
}) => {
  const { resourceBreakdown, isLoading, hasErrors } = useDashboardDataWiring();

  return (
    <ModernResourceBreakdownCard
      data={resourceBreakdown}
      isLoading={isLoading}
      error={hasErrors ? 'Failed to load resource data' : null}
      onViewAll={() => console.log('View all resources')}
      onResourceClick={(resourceType) => console.log('Click resource:', resourceType)}
      className={className}
    />
  );
};
