import React from 'react';
import { AlertCard } from './AlertCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';
import { Alert } from '@/shared/types/dashboard-new';

/**
 * WiredAlertCard Component - Single responsibility: Connect AlertCard to real alert data
 * Follows global rules: Single responsibility, uses existing data wiring hook
 */
interface WiredAlertCardProps {
  className?: string;
  onAlertAction?: (alertId: string, actionId: string) => void;
  onDismissAlert?: (alertId: string) => void;
}

export const WiredAlertCard: React.FC<WiredAlertCardProps> = ({
  className,
  onAlertAction,
  onDismissAlert,
}) => {
  const {
    alerts,
    alertSummary,
    alertsLoading,
    alertsError,
    refreshAlerts,
    lastUpdated,
  } = useDashboardDataWiring();

  // Handle alert actions
  const handleAlertAction = (alertId: string, actionId: string) => {
    console.log(`Alert action triggered: ${actionId} for alert: ${alertId}`);
    onAlertAction?.(alertId, actionId);
  };

  // Handle alert dismissal
  const handleDismissAlert = (alertId: string) => {
    console.log(`Alert dismissed: ${alertId}`);
    onDismissAlert?.(alertId);
  };

  return (
    <AlertCard
      alerts={alerts}
      summary={alertSummary}
      loading={alertsLoading}
      error={alertsError}
      onRefresh={refreshAlerts}
      onAlertAction={handleAlertAction}
      onDismissAlert={handleDismissAlert}
      className={className}
    />
  );
};

export default WiredAlertCard;
