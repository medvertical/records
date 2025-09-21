/**
 * Validation Settings Real-time Hook
 * 
 * This hook provides real-time updates for validation settings using either
 * SSE (Server-Sent Events) or polling, with automatic fallback between them.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { useValidationSSE } from './use-validation-sse';
import { useValidationSettingsPolling } from './use-validation-settings-polling';
import { useSystemSettings } from './use-system-settings';
import type { ValidationSettings } from '@shared/validation-settings';

export type RealTimeMode = 'sse' | 'polling' | 'auto';

export interface ValidationSettingsRealTimeOptions {
  /** Real-time mode: 'sse', 'polling', or 'auto' */
  mode?: RealTimeMode;
  
  /** Polling interval in milliseconds (used when mode is 'polling' or 'auto' fallback) */
  pollingInterval?: number;
  
  /** Whether to enable real-time updates */
  enabled?: boolean;
  
  /** Whether to show toast notifications for changes */
  showNotifications?: boolean;
  
  /** Whether to invalidate React Query cache on changes */
  invalidateCache?: boolean;
  
  /** Whether to automatically fallback from SSE to polling on failure */
  autoFallback?: boolean;
}

export interface ValidationSettingsRealTimeState {
  /** Current real-time mode being used */
  currentMode: RealTimeMode;
  
  /** Whether real-time updates are active */
  isActive: boolean;
  
  /** Last successful update timestamp */
  lastUpdate: Date | null;
  
  /** Last settings change timestamp */
  lastChange: Date | null;
  
  /** Whether there was an error in the last update */
  hasError: boolean;
  
  /** Last error message */
  error: string | null;
  
  /** SSE connection state */
  sseState: {
    isConnected: boolean;
    isEnabled: boolean;
  };
  
  /** Polling state */
  pollingState: {
    isPolling: boolean;
    failedPolls: number;
  };
}

export function useValidationSettingsRealTime(options: ValidationSettingsRealTimeOptions = {}) {
  const {
    mode = 'auto',
    pollingInterval = 5000,
    enabled = true,
    showNotifications = true,
    invalidateCache = true,
    autoFallback = true
  } = options;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isSSEEnabled } = useSystemSettings();
  
  const [state, setState] = useState<ValidationSettingsRealTimeState>({
    currentMode: mode,
    isActive: false,
    lastUpdate: null,
    lastChange: null,
    hasError: false,
    error: null,
    sseState: {
      isConnected: false,
      isEnabled: false
    },
    pollingState: {
      isPolling: false,
      failedPolls: 0
    }
  });

  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // Determine the effective mode based on configuration
  const getEffectiveMode = useCallback((): RealTimeMode => {
    if (mode === 'auto') {
      // Auto mode: prefer SSE if enabled, otherwise use polling
      return isSSEEnabled ? 'sse' : 'polling';
    }
    return mode;
  }, [mode, isSSEEnabled]);

  // SSE hook (only used when mode is 'sse' or 'auto')
  const sseHook = useValidationSSE(enabled && (getEffectiveMode() === 'sse' || getEffectiveMode() === 'auto'));
  
  // Polling hook (only used when mode is 'polling' or as fallback)
  const pollingHook = useValidationSettingsPolling({
    pollingInterval,
    enabled: enabled && (getEffectiveMode() === 'polling' || (getEffectiveMode() === 'auto' && !isSSEEnabled)),
    showNotifications,
    invalidateCache
  });

  // Handle SSE connection changes
  useEffect(() => {
    if (getEffectiveMode() === 'sse' || getEffectiveMode() === 'auto') {
      setState(prev => ({
        ...prev,
        sseState: {
          isConnected: sseHook.isConnected,
          isEnabled: true
        },
        isActive: sseHook.isConnected,
        lastUpdate: sseHook.isConnected ? new Date() : prev.lastUpdate,
        hasError: !sseHook.isConnected && prev.isActive,
        error: !sseHook.isConnected && prev.isActive ? 'SSE connection lost' : null
      }));

      // Handle SSE fallback to polling
      if (autoFallback && !sseHook.isConnected && getEffectiveMode() === 'auto' && !pollingHook.isPolling) {
        console.log('[ValidationSettingsRealTime] SSE failed, falling back to polling');
        
        // Clear any existing fallback timeout
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
        }

        // Set fallback timeout
        fallbackTimeoutRef.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            currentMode: 'polling',
            sseState: {
              ...prev.sseState,
              isEnabled: false
            }
          }));
        }, 3000); // Wait 3 seconds before falling back
      }
    }
  }, [sseHook.isConnected, getEffectiveMode, autoFallback, pollingHook.isPolling]);

  // Handle polling state changes
  useEffect(() => {
    if (getEffectiveMode() === 'polling' || state.currentMode === 'polling') {
      setState(prev => ({
        ...prev,
        pollingState: {
          isPolling: pollingHook.isPolling,
          failedPolls: pollingHook.failedPolls
        },
        isActive: pollingHook.isPolling,
        lastUpdate: pollingHook.lastPoll,
        lastChange: pollingHook.lastChange,
        hasError: pollingHook.hasError,
        error: pollingHook.error
      }));
    }
  }, [pollingHook.isPolling, pollingHook.failedPolls, pollingHook.lastPoll, pollingHook.lastChange, pollingHook.hasError, pollingHook.error, getEffectiveMode, state.currentMode]);

  // Handle settings changes from SSE
  useEffect(() => {
    if (sseHook.settingsState.lastChanged) {
      setState(prev => ({
        ...prev,
        lastChange: sseHook.settingsState.lastChanged
      }));
    }
  }, [sseHook.settingsState.lastChanged]);

  // Initialize real-time updates
  const initialize = useCallback(() => {
    if (hasInitializedRef.current || !enabled) return;
    
    hasInitializedRef.current = true;
    const effectiveMode = getEffectiveMode();
    
    console.log('[ValidationSettingsRealTime] Initializing with mode:', effectiveMode);
    
    setState(prev => ({
      ...prev,
      currentMode: effectiveMode,
      isActive: true
    }));

    // Show notification about real-time mode
    if (showNotifications) {
      toast({
        title: "Real-time Updates Active",
        description: `Using ${effectiveMode.toUpperCase()} for validation settings updates`,
        variant: "default"
      });
    }
  }, [enabled, getEffectiveMode, showNotifications, toast]);

  // Manual refresh
  const refresh = useCallback(() => {
    if (state.currentMode === 'sse') {
      // For SSE, we can't manually refresh, but we can sync with API
      sseHook.syncWithApi();
    } else if (state.currentMode === 'polling') {
      // For polling, trigger a manual poll
      pollingHook.manualPoll();
    }
  }, [state.currentMode, sseHook, pollingHook]);

  // Switch mode
  const switchMode = useCallback((newMode: RealTimeMode) => {
    console.log('[ValidationSettingsRealTime] Switching mode from', state.currentMode, 'to', newMode);
    
    setState(prev => ({
      ...prev,
      currentMode: newMode
    }));

    if (showNotifications) {
      toast({
        title: "Real-time Mode Changed",
        description: `Switched to ${newMode.toUpperCase()} mode`,
        variant: "default"
      });
    }
  }, [state.currentMode, showNotifications, toast]);

  // Reset error state
  const resetError = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasError: false,
      error: null
    }));

    if (state.currentMode === 'polling') {
      pollingHook.resetError();
    }
  }, [state.currentMode, pollingHook]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    initialize,
    refresh,
    switchMode,
    resetError,
    isEnabled: enabled,
    effectiveMode: getEffectiveMode(),
    // Expose underlying hooks for advanced usage
    sseHook,
    pollingHook
  };
}
