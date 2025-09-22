import React from 'react';
import { StatusCard } from './StatusCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

/**
 * WiredStatusCard Component - Single responsibility: Connect StatusCard to real validation progress data
 * Follows global rules: Single responsibility, uses existing data wiring hook
 */
interface WiredStatusCardProps {
  className?: string;
}

export const WiredStatusCard: React.FC<WiredStatusCardProps> = ({
  className,
}) => {
  const {
    validationStatus,
    statusLoading,
    statusError,
    refreshStatus,
    lastUpdated,
  } = useDashboardDataWiring();

  return (
    <StatusCard
      status={validationStatus}
      loading={statusLoading}
      error={statusError}
      onRefresh={refreshStatus}
      lastUpdated={lastUpdated}
      className={className}
    />
  );
};

export default WiredStatusCard;
