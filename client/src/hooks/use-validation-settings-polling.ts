/**
 * Validation Settings Polling Hook
 * 
 * This hook provides polling-based real-time updates for validation settings
 * as an alternative to SSE/WebSocket connections.
 * 
 * Uses the shared usePolling hook with cancellation, backoff with jitter, and cleanup.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { usePolling } from './use-polling';
import type { ValidationSettings } from '@shared/validation-settings-simplified';

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
  
  /** Whether polling is paused */
  isPaused: boolean;
  
  /** Current polling interval (with backoff) */
  currentInterval: number;
  
  /** Last successful poll timestamp from shared hook */
  lastSuccess: Date | null;
  
  /** Start polling */
  startPolling: () => void;
  
  /** Stop polling */
  stopPolling: () => void;
  
  /** Pause polling */
  pausePolling: () => void;
  
  /** Resume polling */
  resumePolling: () => void;
  
  /** Manual poll */
  manualPoll: () => void;
  
  /** Reset error state */
  resetError: () => void;
  
  /** Whether polling is enabled */
  isEnabled: boolean;
  
  /** Polling interval */
  pollingInterval: number;
}

export function useValidationSettingsPolling(options: ValidationSettingsPollingOptions = {}) {
  const {
    pollingInterval = 60000, // 60 seconds (reduced frequency)
    enabled = true,
    showNotifications = true,
    invalidateCache = true
  } = options;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [state, setState] = useState<Partial<ValidationSettingsPollingState>>({
    settings: null,
    isPolling: false,
    lastPoll: null,
    lastChange: null,
    failedPolls: 0,
    hasError: false,
    error: null
  });

  const lastSettingsRef = useRef<string | null>(null);
  const invalidateCacheRef = useRef(invalidateCache);
  const showNotificationsRef = useRef(showNotifications);
  const queryClientRef = useRef(queryClient);
  const toastRef = useRef(toast);

  // Update refs when values change
  useEffect(() => {
    invalidateCacheRef.current = invalidateCache;
    showNotificationsRef.current = showNotifications;
    queryClientRef.current = queryClient;
    toastRef.current = toast;
  }, [invalidateCache, showNotifications, queryClient, toast]);

  // Poll for settings updates
  const pollSettings = useCallback(async () => {
    const response = await fetch('/api/validation/settings');
    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }

    const data = await response.json();
    // API returns settings directly, not wrapped in a 'settings' property
    const newSettings = data;
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
        if (invalidateCacheRef.current) {
          // Invalidate both query key formats for validation settings
          queryClientRef.current.invalidateQueries({ queryKey: ['validation-settings'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/validation/settings'] });
          
          // Invalidate dashboard and resource queries to show updated counts
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/dashboard/fhir-server-stats'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/dashboard/validation-stats'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/dashboard/combined'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/validation/bulk/progress'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/validation/errors/recent'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
        }

        // Show notification if enabled
        if (showNotificationsRef.current && previousSettings) {
          toastRef.current({
            title: "Settings Updated",
            description: "Validation settings have been updated by another user.",
            variant: "default"
          });
        }

        // Emit custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('settingsChanged', {
          detail: {
            changeType: 'updated',
            settingsId: newSettings?.id || 'current',
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
              settingsId: newSettings?.id || 'current',
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

    return newSettings;
  }, []); // Empty dependency array since we're using refs

  // Use shared polling hook with cancellation, backoff with jitter, and cleanup
  const polling = usePolling(pollSettings, {
    enabled,
    interval: pollingInterval,
    maxFailures: 3,
    backoffMultiplier: 2,
    maxBackoff: 300000, // 5 minutes max
    jitter: 0.1,
    continueInBackground: false,
    startImmediately: true
  });

  // Update local state based on polling state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isPolling: polling.isPolling,
      failedPolls: polling.failureCount,
      hasError: polling.lastError !== null,
      error: polling.lastError?.message || null
    }));

    // Show error notification after multiple failures
    if (showNotifications && polling.failureCount >= 3 && polling.lastError) {
      toast({
        title: "Settings Sync Error",
        description: `Failed to sync settings: ${polling.lastError.message}`,
        variant: "destructive"
      });
    }
  }, [polling.isPolling, polling.failureCount, polling.lastError, showNotifications, toast]);

  // Manual poll
  const manualPoll = useCallback(() => {
    polling.poll();
  }, [polling]);

  // Reset error state
  const resetError = useCallback(() => {
    polling.reset();
    setState(prev => ({
      ...prev,
      hasError: false,
      error: null
    }));
  }, [polling]);

  return {
    // Core state
    settings: state.settings || null,
    isPolling: state.isPolling || false,
    lastPoll: state.lastPoll || null,
    lastChange: state.lastChange || null,
    failedPolls: state.failedPolls || 0,
    hasError: state.hasError || false,
    error: state.error || null,
    
    // Polling actions
    startPolling: polling.start,
    stopPolling: polling.stop,
    pausePolling: polling.pause,
    resumePolling: polling.resume,
    manualPoll,
    resetError,
    
    // Configuration
    isEnabled: enabled,
    pollingInterval,
    
    // Additional polling state from shared hook
    isPaused: polling.isPaused,
    currentInterval: polling.currentInterval,
    lastSuccess: polling.lastSuccess
  };
}
