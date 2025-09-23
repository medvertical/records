import React from 'react';
import { AlertCard } from './AlertCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredWireframeAlertCardProps {
  className?: string;
}

/**
 * Wired Wireframe Alert Card - Connects wireframe AlertCard to real data
 */
export const WiredWireframeAlertCard: React.FC<WiredWireframeAlertCardProps> = ({
  className,
}) => {
  const { alerts, isLoading, hasErrors, refreshAlerts } = useDashboardDataWiring();

  return (
    <AlertCard
      alerts={alerts}
      isLoading={isLoading}
      error={hasErrors ? 'Failed to load alerts' : null}
      onViewAll={() => console.log('View all alerts')}
      onDismiss={(alertId) => console.log('Dismiss alert:', alertId)}
      onConfigure={() => console.log('Configure alerts')}
      className={className}
    />
  );
};
