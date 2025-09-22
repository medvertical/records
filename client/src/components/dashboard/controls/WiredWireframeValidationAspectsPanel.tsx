import React from 'react';
import { WireframeValidationAspectsPanel } from './WireframeValidationAspectsPanel';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredWireframeValidationAspectsPanelProps {
  className?: string;
}

/**
 * Wired Wireframe Validation Aspects Panel - Connects wireframe ValidationAspectsPanel to real data
 */
export const WiredWireframeValidationAspectsPanel: React.FC<WiredWireframeValidationAspectsPanelProps> = ({
  className,
}) => {
  const {
    validationAspects,
    aspectsLoading,
    aspectsError,
    refreshAspects,
  } = useDashboardDataWiring();

  const handleAspectToggle = async (aspectId: string, enabled: boolean) => {
    try {
      // In a real implementation, this would call an API to update the aspect
      console.log('Toggle aspect:', aspectId, enabled);
      // For now, just refresh the aspects data
      refreshAspects();
    } catch (error) {
      console.error('Failed to toggle aspect:', error);
    }
  };

  const handleConfigure = () => {
    console.log('Configure validation aspects');
  };

  return (
    <WireframeValidationAspectsPanel
      aspects={validationAspects?.aspects}
      onAspectToggle={handleAspectToggle}
      onConfigure={handleConfigure}
      isLoading={aspectsLoading}
      error={aspectsError}
      className={className}
    />
  );
};
