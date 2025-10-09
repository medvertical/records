/**
 * Validation Controls Hook - MVP Version
 * 
 * Simplified hook for validation control operations with only essential features:
 * - Start/Stop/Pause/Resume validation
 * - Progress tracking
 * - Error handling
 * - Status management
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import { useValidationPolling } from './use-validation-polling';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ValidationStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error' | 'completed';

export interface ValidationProgress {
  processedResources: number;
  totalResources: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  errors: number;
  warnings: number;
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

export interface ValidationControlsState {
  status: ValidationStatus;
  progress: ValidationProgress | null;
  error: string | null;
  isRunning: boolean;
  isPaused: boolean;
  canStart: boolean;
  canStop: boolean;
  canPause: boolean;
  canResume: boolean;
}

export interface ValidationControlsActions {
  startValidation: (options?: StartValidationOptions) => Promise<void>;
  stopValidation: () => Promise<void>;
  pauseValidation: () => Promise<void>;
  resumeValidation: () => Promise<void>;
  clearValidation: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export interface StartValidationOptions {
  serverId?: number;
  resourceTypes?: string[];
  batchSize?: number;
  maxConcurrent?: number;
}

export interface UseValidationControlsOptions {
  /** Server ID for server-specific validation */
  serverId?: number;
  
  /** Whether to auto-refresh status */
  autoRefresh?: boolean;
  
  /** Refresh interval in milliseconds */
  refreshIntervalMs?: number;
  
  /** Whether to show toast notifications */
  showNotifications?: boolean;
}

export interface UseValidationControlsReturn extends ValidationControlsState, ValidationControlsActions {}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useValidationControls(options: UseValidationControlsOptions = {}): UseValidationControlsReturn {
  const { toast } = useToast();
  const {
    serverId,
    autoRefresh = true,
    refreshIntervalMs = 2000,
    showNotifications = true
  } = options;

  // State
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use validation polling for real-time updates
  const { data: pollingData, isLoading: pollingLoading, error: pollingError } = useValidationPolling({
    enabled: autoRefresh && status !== 'idle',
    interval: refreshIntervalMs
  });

  // Update state from polling data
  useEffect(() => {
    if (pollingData) {
      setStatus(pollingData.status || 'idle');
      setProgress(pollingData.progress || null);
      setError(pollingData.error || null);
    }
  }, [pollingData]);

  // Update error from polling error
  useEffect(() => {
    if (pollingError) {
      setError(pollingError.message || 'Polling error');
    }
  }, [pollingError]);

  // Computed state
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const canStart = status === 'idle' || status === 'stopped' || status === 'error' || status === 'completed';
  const canStop = status === 'running' || status === 'paused';
  const canPause = status === 'running';
  const canResume = status === 'paused';

  const startValidation = useCallback(async (options: StartValidationOptions = {}) => {
    try {
      setError(null);
      setStatus('running');
      
      const response = await fetch('/api/validation/bulk/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serverId,
          ...options
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start validation: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (showNotifications) {
        toast({
          title: 'Validation Started',
          description: 'Validation process has been started successfully'
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start validation';
      setError(errorMessage);
      setStatus('error');
      
      if (showNotifications) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  }, [serverId, showNotifications, toast]);

  const stopValidation = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/bulk/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serverId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to stop validation: ${response.statusText}`);
      }
      
      setStatus('stopped');
      setProgress(null);
      
      if (showNotifications) {
        toast({
          title: 'Validation Stopped',
          description: 'Validation process has been stopped'
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop validation';
      setError(errorMessage);
      setStatus('error');
      
      if (showNotifications) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  }, [serverId, showNotifications, toast]);

  const pauseValidation = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/bulk/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serverId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to pause validation: ${response.statusText}`);
      }
      
      setStatus('paused');
      
      if (showNotifications) {
        toast({
          title: 'Validation Paused',
          description: 'Validation process has been paused'
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause validation';
      setError(errorMessage);
      setStatus('error');
      
      if (showNotifications) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  }, [serverId, showNotifications, toast]);

  const resumeValidation = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/bulk/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serverId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to resume validation: ${response.statusText}`);
      }
      
      setStatus('running');
      
      if (showNotifications) {
        toast({
          title: 'Validation Resumed',
          description: 'Validation process has been resumed'
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume validation';
      setError(errorMessage);
      setStatus('error');
      
      if (showNotifications) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  }, [serverId, showNotifications, toast]);

  const clearValidation = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/bulk/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serverId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clear validation: ${response.statusText}`);
      }
      
      setStatus('idle');
      setProgress(null);
      setError(null);
      
      if (showNotifications) {
        toast({
          title: 'Validation Cleared',
          description: 'Validation results have been cleared'
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear validation';
      setError(errorMessage);
      
      if (showNotifications) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  }, [serverId, showNotifications, toast]);

  const refreshStatus = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/validation/bulk/progress');
      
      if (!response.ok) {
        throw new Error(`Failed to refresh status: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(data.status || 'idle');
      setProgress(data.progress || null);
      setError(data.error || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh status';
      setError(errorMessage);
      console.error('Error refreshing validation status:', err);
    }
  }, []);

  return {
    // State
    status,
    progress,
    error,
    isRunning,
    isPaused,
    canStart,
    canStop,
    canPause,
    canResume,
    
    // Actions
    startValidation,
    stopValidation,
    pauseValidation,
    resumeValidation,
    clearValidation,
    refreshStatus
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get status display text
 */
export function getStatusDisplayText(status: ValidationStatus): string {
  const statusTexts: Record<ValidationStatus, string> = {
    idle: 'Idle',
    running: 'Running',
    paused: 'Paused',
    stopped: 'Stopped',
    error: 'Error',
    completed: 'Completed'
  };
  
  return statusTexts[status] || 'Unknown';
}

/**
 * Get status color variant
 */
export function getStatusColorVariant(status: ValidationStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colorVariants: Record<ValidationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    idle: 'secondary',
    running: 'default',
    paused: 'outline',
    stopped: 'secondary',
    error: 'destructive',
    completed: 'default'
  };
  
  return colorVariants[status] || 'secondary';
}

/**
 * Format progress percentage
 */
export function formatProgressPercentage(progress: ValidationProgress | null): string {
  if (!progress) return '0%';
  return `${Math.round(progress.percentage)}%`;
}

/**
 * Format estimated time remaining
 */
export function formatEstimatedTimeRemaining(progress: ValidationProgress | null): string {
  if (!progress?.estimatedTimeRemaining) return 'Unknown';
  
  const seconds = Math.round(progress.estimatedTimeRemaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${remainingSeconds}s`;
}