import React from 'react';
import { StatusCard } from './StatusCard';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredWireframeStatusCardProps {
  className?: string;
}

/**
 * Wired Wireframe Status Card - Connects wireframe StatusCard to real data
 */
export const WiredWireframeStatusCard: React.FC<WiredWireframeStatusCardProps> = ({
  className,
}) => {
  const { 
    validationStatus, 
    statusLoading, 
    statusError, 
    refreshStatus 
  } = useDashboardDataWiring();

  return (
    <StatusCard
      status={validationStatus?.status}
      progress={validationStatus?.progress}
      currentResourceType={validationStatus?.currentResourceType}
      processingRate={validationStatus?.processingRate}
      estimatedTimeRemaining={validationStatus?.estimatedTimeRemaining}
      isLoading={statusLoading}
      error={statusError}
      className={className}
    />
  );
};
