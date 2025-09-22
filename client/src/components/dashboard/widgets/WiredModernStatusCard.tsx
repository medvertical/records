import React from 'react';
import { ModernStatusCard } from './ModernStatusCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredModernStatusCardProps {
  className?: string;
}

export const WiredModernStatusCard: React.FC<WiredModernStatusCardProps> = ({
  className,
}) => {
  const { validationStatus, isLoading, hasErrors } = useDashboardDataWiring();

  return (
    <ModernStatusCard
      status={validationStatus}
      isLoading={isLoading}
      error={hasErrors ? 'Failed to load status' : null}
      className={className}
    />
  );
};
