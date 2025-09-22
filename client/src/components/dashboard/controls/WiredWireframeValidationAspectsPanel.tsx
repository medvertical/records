import React from 'react';
import { WireframeValidationAspectsPanel } from './WireframeValidationAspectsPanel';
import { useQuery } from '@tanstack/react-query';

interface WiredWireframeValidationAspectsPanelProps {
  className?: string;
}

/**
 * Wired Wireframe Validation Aspects Panel - Connects wireframe ValidationAspectsPanel to real data
 */
export const WiredWireframeValidationAspectsPanel: React.FC<WiredWireframeValidationAspectsPanelProps> = ({
  className,
}) => {
  // Fetch validation settings to get the current aspects
  const { data: settingsData, isLoading, error } = useQuery({
    queryKey: ['validation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      const data = await response.json();
      return data.settings;
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Transform settings data to aspects format
  const aspects = settingsData ? [
    {
      id: 'structural',
      name: 'Structural',
      description: 'JSON schema validation',
      enabled: settingsData.structural?.enabled || false,
      severity: settingsData.structural?.severity || 'error'
    },
    {
      id: 'profile',
      name: 'Profile',
      description: 'Conformance validation',
      enabled: settingsData.profile?.enabled || false,
      severity: settingsData.profile?.severity || 'warning'
    },
    {
      id: 'terminology',
      name: 'Terminology',
      description: 'Code system validation',
      enabled: settingsData.terminology?.enabled || false,
      severity: settingsData.terminology?.severity || 'warning'
    },
    {
      id: 'reference',
      name: 'Reference',
      description: 'Resource reference checking',
      enabled: settingsData.reference?.enabled || false,
      severity: settingsData.reference?.severity || 'error'
    },
    {
      id: 'businessRule',
      name: 'Business Rules',
      description: 'Custom rule validation',
      enabled: settingsData.businessRule?.enabled || false,
      severity: settingsData.businessRule?.severity || 'warning'
    },
    {
      id: 'metadata',
      name: 'Metadata',
      description: 'Version & timestamp validation',
      enabled: settingsData.metadata?.enabled || false,
      severity: settingsData.metadata?.severity || 'information'
    }
  ] : [];

  const handleAspectToggle = async (aspectId: string, enabled: boolean) => {
    try {
      // Update the specific aspect in settings
      const updatedSettings = {
        ...settingsData,
        [aspectId]: {
          ...settingsData[aspectId],
          enabled: enabled
        }
      };

      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        // Refresh the data
        window.location.reload(); // Simple refresh for now
      }
    } catch (error) {
      console.error('Failed to toggle aspect:', error);
    }
  };

  const handleConfigure = () => {
    console.log('Configure validation aspects');
  };

  return (
    <WireframeValidationAspectsPanel
      aspects={aspects}
      onAspectToggle={handleAspectToggle}
      onConfigure={handleConfigure}
      isLoading={isLoading}
      error={error?.message}
      className={className}
    />
  );
};
