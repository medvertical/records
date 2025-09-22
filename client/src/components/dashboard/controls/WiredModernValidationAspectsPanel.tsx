import React from 'react';
import { ModernValidationAspectsPanel } from './ModernValidationAspectsPanel';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface WiredModernValidationAspectsPanelProps {
  className?: string;
}

export const WiredModernValidationAspectsPanel: React.FC<WiredModernValidationAspectsPanelProps> = ({
  className,
}) => {
  const { validationAspects, isLoading, hasErrors } = useDashboardDataWiring();

  const handleToggle = (aspectId: string, enabled: boolean) => {
    console.log('Toggle aspect:', aspectId, enabled);
    // TODO: Implement actual API call to update validation aspects
  };

  const handleConfigure = () => {
    console.log('Configure validation aspects');
    // TODO: Navigate to validation aspects configuration page
  };

  return (
    <ModernValidationAspectsPanel
      aspects={validationAspects}
      isLoading={isLoading}
      error={hasErrors ? 'Failed to load validation aspects' : null}
      onToggle={handleToggle}
      onConfigure={handleConfigure}
      className={className}
    />
  );
};
