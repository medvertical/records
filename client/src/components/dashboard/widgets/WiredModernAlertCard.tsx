import React from 'react';
import { ModernAlertCard } from './ModernAlertCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredModernAlertCardProps {
  className?: string;
}

export const WiredModernAlertCard: React.FC<WiredModernAlertCardProps> = ({
  className,
}) => {
  const { alerts, isLoading, hasErrors, refreshAlerts } = useDashboardDataWiring();

  return (
    <ModernAlertCard
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
