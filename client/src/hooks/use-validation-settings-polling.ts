/**
 * Validation Settings Polling Hook
 * 
 * This hook provides polling-based real-time updates for validation settings
 * as an alternative to SSE/WebSocket connections.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import type { ValidationSettings } from '@shared/validation-settings';

export interface ValidationSettingsPollingOptions {
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  
  /** Whether to enable polling */
  enabled?: boolean;
  
  /** Whether to show toast notifications for changes */
  showNotifications?: boolean;
  
  /** Whether to invalidate React Query cache on changes */
  invalidateCache?: boolean;
}

export interface ValidationSettingsPollingState {
  /** Current settings from polling */
  settings: ValidationSettings | null;
  
  /** Whether polling is active */
  isPolling: boolean;
  
  /** Last successful poll timestamp */
  lastPoll: Date | null;
  
  /** Last settings change timestamp */
  lastChange: Date | null;
  
  /** Number of consecutive failed polls */
  failedPolls: number;
  
  /** Whether there was an error in the last poll */
  hasError: boolean;
  
  /** Last error message */
  error: string | null;
}

export function useValidationSettingsPolling(options: ValidationSettingsPollingOptions = {}) {
  const {
    pollingInterval = 5000, // 5 seconds
    enabled = true,
    showNotifications = true,
    invalidateCache = true
  } = options;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [state, setState] = useState<ValidationSettingsPollingState>({
    settings: null,
    isPolling: false,
    lastPoll: null,
    lastChange: null,
    failedPolls: 0,
    hasError: false,
    error: null
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSettingsRef = useRef<string | null>(null);
  const isPollingRef = useRef(false);

  // Poll for settings updates
  const pollSettings = useCallback(async () => {
    if (isPollingRef.current) return; // Prevent concurrent polls
    isPollingRef.current = true;

    try {
      const response = await fetch('/api/validation/settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }

      const data = await response.json();
      const newSettings = data.settings;
      const newSettingsString = JSON.stringify(newSettings);

      setState(prev => ({
        ...prev,
        lastPoll: new Date(),
        failedPolls: 0,
        hasError: false,
        error: null
      }));

      // Check if settings have changed
      if (lastSettingsRef.current !== newSettingsString) {
        const previousSettings = lastSettingsRef.current ? JSON.parse(lastSettingsRef.current) : null;
        lastSettingsRef.current = newSettingsString;

        setState(prev => ({
          ...prev,
          settings: newSettings,
          lastChange: new Date()
        }));

        // Invalidate React Query cache if enabled
        if (invalidateCache) {
          // Invalidate both query key formats for validation settings
          queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
          queryClient.invalidateQueries({ queryKey: ['/api/validation/settings'] });
          
          // Invalidate dashboard and resource queries to show updated counts
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/fhir-server-stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/validation-stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/combined'] });
          queryClient.invalidateQueries({ queryKey: ['/api/validation/bulk/progress'] });
          queryClient.invalidateQueries({ queryKey: ['/api/validation/errors/recent'] });
          queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
        }

        // Show notification if enabled
        if (showNotifications && previousSettings) {
          toast({
            title: "Settings Updated",
            description: "Validation settings have been updated by another user.",
            variant: "default"
          });
        }

        // Emit custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('settingsChanged', {
          detail: {
            changeType: 'updated',
            settingsId: newSettings.id || 'current',
            timestamp: new Date().toISOString(),
            previousVersion: previousSettings,
            newVersion: newSettings
          }
        }));

        // Trigger server-side notification for all connected clients (polling-based)
        try {
          await fetch('/api/validation/settings/notify-change', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              changeType: 'polling_detected',
              settingsId: newSettings.id || 'current',
              previousVersion: previousSettings,
              newVersion: newSettings
            })
          });
        } catch (notificationError) {
          console.warn('[ValidationSettingsPolling] Failed to trigger server notification:', notificationError);
          // Don't fail the polling if notification fails
        }

        console.log('[ValidationSettingsPolling] Settings changed:', {
          previous: previousSettings,
          current: newSettings,
          timestamp: new Date().toISOString()
        });
      } else {
        // Settings haven't changed, just update the current settings
        setState(prev => ({
          ...prev,
          settings: newSettings
        }));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ValidationSettingsPolling] Poll failed:', errorMessage);
      
      setState(prev => ({
        ...prev,
        failedPolls: prev.failedPolls + 1,
        hasError: true,
        error: errorMessage
      }));

      // Show error notification after multiple failures
      if (showNotifications && state.failedPolls >= 3) {
        toast({
          title: "Settings Sync Error",
          description: `Failed to sync settings: ${errorMessage}`,
          variant: "destructive"
        });
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [invalidateCache, showNotifications, queryClient, toast, state.failedPolls]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!enabled || intervalRef.current) return;

    console.log('[ValidationSettingsPolling] Starting polling with interval:', pollingInterval);
    
    setState(prev => ({
      ...prev,
      isPolling: true
    }));

    // Poll immediately
    pollSettings();

    // Then poll at intervals
    intervalRef.current = setInterval(pollSettings, pollingInterval);
  }, [enabled, pollingInterval, pollSettings]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isPolling: false
    }));

    console.log('[ValidationSettingsPolling] Stopped polling');
  }, []);

  // Manual poll
  const manualPoll = useCallback(() => {
    pollSettings();
  }, [pollSettings]);

  // Reset error state
  const resetError = useCallback(() => {
    setState(prev => ({
      ...prev,
      failedPolls: 0,
      hasError: false,
      error: null
    }));
  }, []);

  // Effect to start/stop polling based on enabled state
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    ...state,
    startPolling,
    stopPolling,
    manualPoll,
    resetError,
    isEnabled: enabled,
    pollingInterval
  };
}
