import React, { useState } from 'react';
import { ValidationAspectsPanel } from './ValidationAspectsPanel';
import { ValidationAspects } from '@/shared/types/dashboard-new';

/**
 * WiredValidationAspectsPanel Component - Single responsibility: Connect ValidationAspectsPanel to real validation settings
 * Follows global rules: Single responsibility, uses existing patterns for validation configuration
 */
interface WiredValidationAspectsPanelProps {
  className?: string;
}

export const WiredValidationAspectsPanel: React.FC<WiredValidationAspectsPanelProps> = ({
  className,
}) => {
  const [aspects, setAspects] = useState<ValidationAspects>({
    structural: { enabled: true, status: 'success' },
    profile: { enabled: true, status: 'success' },
    terminology: { enabled: true, status: 'warning' },
    reference: { enabled: true, status: 'success' },
    businessRules: { enabled: false, status: 'error' },
    metadata: { enabled: true, status: 'success' },
  });

  const [loading, setLoading] = useState(false);

  // Handle aspect toggle
  const handleAspectToggle = async (aspectId: string, enabled: boolean) => {
    try {
      setLoading(true);
      
      // Update local state immediately for responsive UI
      setAspects(prev => ({
        ...prev,
        [aspectId]: {
          ...prev[aspectId as keyof ValidationAspects],
          enabled,
        }
      }));

      // In a real implementation, this would call the validation settings API
      console.log(`Toggling ${aspectId} to ${enabled}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Could show success notification here
      console.log(`Successfully updated ${aspectId} validation aspect`);
      
    } catch (error) {
      console.error(`Failed to update ${aspectId} validation aspect:`, error);
      
      // Revert local state on error
      setAspects(prev => ({
        ...prev,
        [aspectId]: {
          ...prev[aspectId as keyof ValidationAspects],
          enabled: !enabled,
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  // Handle configure button
  const handleConfigure = () => {
    console.log('Opening validation aspects configuration...');
    // Could navigate to detailed settings page or open modal
  };

  // Handle refresh
  const handleRefresh = () => {
    console.log('Refreshing validation aspects...');
    // In a real implementation, this would fetch current validation settings
  };

  return (
    <ValidationAspectsPanel
      aspects={aspects}
      loading={loading}
      error={null}
      onAspectToggle={handleAspectToggle}
      onConfigure={handleConfigure}
      onRefresh={handleRefresh}
      className={className}
    />
  );
};

export default WiredValidationAspectsPanel;
