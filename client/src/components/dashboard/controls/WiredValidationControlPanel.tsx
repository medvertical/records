import React, { useState } from 'react';
import { ValidationControlPanel } from './ValidationControlPanel';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';
import { ValidationStatus } from '@/shared/types/dashboard-new';

/**
 * WiredValidationControlPanel Component - Single responsibility: Connect ValidationControlPanel to real validation API
 * Follows global rules: Single responsibility, uses existing data wiring hook and API patterns
 */
interface WiredValidationControlPanelProps {
  className?: string;
}

export const WiredValidationControlPanel: React.FC<WiredValidationControlPanelProps> = ({
  className,
}) => {
  const {
    validationStatus,
    statusLoading,
    statusError,
    refreshStatus,
  } = useDashboardDataWiring();

  const [isProcessing, setIsProcessing] = useState(false);

  // API call functions
  const callValidationAPI = async (endpoint: string, method: 'POST' | 'GET' = 'POST') => {
    try {
      setIsProcessing(true);
      const response = await fetch(`/api/validation/bulk/${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} validation: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Validation ${endpoint} result:`, result);
      
      // Refresh status after action
      setTimeout(() => {
        refreshStatus();
      }, 1000);

      return result;
    } catch (error) {
      console.error(`Error ${endpoint} validation:`, error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Validation control handlers
  const handleStart = async () => {
    try {
      await callValidationAPI('start');
    } catch (error) {
      console.error('Failed to start validation:', error);
      // Could show toast notification here
    }
  };

  const handlePause = async () => {
    try {
      await callValidationAPI('pause');
    } catch (error) {
      console.error('Failed to pause validation:', error);
    }
  };

  const handleResume = async () => {
    try {
      await callValidationAPI('resume');
    } catch (error) {
      console.error('Failed to resume validation:', error);
    }
  };

  const handleStop = async () => {
    try {
      await callValidationAPI('stop');
    } catch (error) {
      console.error('Failed to stop validation:', error);
    }
  };

  const handleRevalidateAll = async () => {
    try {
      // First stop current validation if running
      if (validationStatus?.status === 'running') {
        await callValidationAPI('stop');
      }
      
      // Wait a moment then start fresh
      setTimeout(async () => {
        try {
          await callValidationAPI('start');
        } catch (error) {
          console.error('Failed to restart validation:', error);
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to revalidate all:', error);
    }
  };

  const handleSettings = () => {
    console.log('Opening validation settings...');
    // Could navigate to settings page or open modal
  };

  const handleRefresh = () => {
    refreshStatus();
  };

  return (
    <ValidationControlPanel
      status={validationStatus}
      loading={statusLoading || isProcessing}
      error={statusError}
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onRevalidateAll={handleRevalidateAll}
      onSettings={handleSettings}
      onRefresh={handleRefresh}
      className={className}
    />
  );
};

export default WiredValidationControlPanel;
