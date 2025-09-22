import React from 'react';
import { WireframeValidationControlPanel } from './WireframeValidationControlPanel';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredWireframeValidationControlPanelProps {
  className?: string;
}

/**
 * Wired Wireframe Validation Control Panel - Connects wireframe control panel to real data
 */
export const WiredWireframeValidationControlPanel: React.FC<WiredWireframeValidationControlPanelProps> = ({
  className,
}) => {
  const {
    validationStatus,
    statusLoading,
    statusError,
    refreshStatus,
    syncWithApi,
  } = useDashboardDataWiring();

  const handleStart = async () => {
    try {
      const response = await fetch('/api/validation/bulk/start', { method: 'POST' });
      if (response.ok) {
        syncWithApi(); // Force immediate data sync
      }
    } catch (error) {
      console.error('Failed to start validation:', error);
    }
  };

  const handlePause = async () => {
    try {
      const response = await fetch('/api/validation/bulk/pause', { method: 'POST' });
      if (response.ok) {
        syncWithApi(); // Force immediate data sync
      }
    } catch (error) {
      console.error('Failed to pause validation:', error);
    }
  };

  const handleResume = async () => {
    try {
      const response = await fetch('/api/validation/bulk/resume', { method: 'POST' });
      if (response.ok) {
        syncWithApi(); // Force immediate data sync
      }
    } catch (error) {
      console.error('Failed to resume validation:', error);
    }
  };

  const handleStop = async () => {
    try {
      const response = await fetch('/api/validation/bulk/stop', { method: 'POST' });
      if (response.ok) {
        syncWithApi(); // Force immediate data sync
      }
    } catch (error) {
      console.error('Failed to stop validation:', error);
    }
  };

  return (
    <WireframeValidationControlPanel
      status={validationStatus?.status}
      progress={validationStatus?.progress}
      totalResources={validationStatus?.totalResources}
      processedResources={validationStatus?.processedResources}
      currentResourceType={validationStatus?.currentResourceType}
      nextResourceType={validationStatus?.nextResourceType}
      processingRate={validationStatus?.processingRate}
      estimatedTimeRemaining={validationStatus?.estimatedTimeRemaining}
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onSettings={() => console.log('Settings clicked')}
      onViewDetails={() => console.log('View details clicked')}
      isLoading={statusLoading}
      error={statusError}
      className={className}
    />
  );
};
