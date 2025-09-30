import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useValidationSettingsPolling } from './use-validation-settings-polling';
import type { ValidationAspect } from '@/components/filters';

/**
 * Hook to handle reactive UI updates when validation aspect settings change
 * 
 * This implements:
 * - Automatic detection of aspect setting changes (enabled/disabled)
 * - Cache invalidation for validation results when settings change
 * - UI state updates (show "Validating..." indicators)
 * - Greying out/excluding disabled aspects from calculations
 */

interface AspectSettings {
  structural: { enabled: boolean; severity: string };
  profile: { enabled: boolean; severity: string };
  terminology: { enabled: boolean; severity: string };
  reference: { enabled: boolean; severity: string };
  businessRule: { enabled: boolean; severity: string };
  metadata: { enabled: boolean; severity: string };
}

interface UseAspectSettingsReactiveOptions {
  onSettingsChange?: (newSettings: AspectSettings, previousSettings: AspectSettings) => void;
  pollingInterval?: number;
  enabled?: boolean;
}

export function useAspectSettingsReactive(options: UseAspectSettingsReactiveOptions = {}) {
  const {
    onSettingsChange,
    pollingInterval = 30000,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const previousSettingsRef = useRef<AspectSettings | null>(null);

  // Use the existing validation settings polling hook
  const { 
    settings: currentSettings, 
    lastChange,
    isPolling 
  } = useValidationSettingsPolling({
    pollingInterval,
    enabled,
    showNotifications: false,
    invalidateCache: false, // We'll handle invalidation ourselves
  });

  // Extract aspect settings from current settings
  const aspectSettings: AspectSettings | null = currentSettings?.aspects || null;

  // Detect changes in aspect settings
  useEffect(() => {
    if (!aspectSettings) return;

    const previous = previousSettingsRef.current;
    
    if (previous) {
      // Check if any aspects changed
      const aspectsChanged = (Object.keys(aspectSettings) as ValidationAspect[]).some(
        aspect => {
          const prevAspect = previous[aspect];
          const currAspect = aspectSettings[aspect];
          return prevAspect?.enabled !== currAspect?.enabled ||
                 prevAspect?.severity !== currAspect?.severity;
        }
      );

      if (aspectsChanged) {
        console.log('[AspectSettingsReactive] Aspect settings changed, invalidating cache');
        
        // Invalidate validation queries
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return (
              queryKey.includes('/api/validation/issues/groups') ||
              queryKey.includes('/api/validation/resources') ||
              queryKey.includes('/api/validation/progress')
            );
          },
        });

        // Call optional callback
        if (onSettingsChange) {
          onSettingsChange(aspectSettings, previous);
        }
      }
    }

    // Update ref
    previousSettingsRef.current = aspectSettings;
  }, [aspectSettings, queryClient, onSettingsChange]);

  /**
   * Check if a specific aspect is enabled
   */
  const isAspectEnabled = useCallback((aspect: ValidationAspect): boolean => {
    return aspectSettings?.[aspect]?.enabled ?? true;
  }, [aspectSettings]);

  /**
   * Get enabled aspects
   */
  const getEnabledAspects = useCallback((): ValidationAspect[] => {
    if (!aspectSettings) return [];
    return (Object.keys(aspectSettings) as ValidationAspect[]).filter(
      aspect => aspectSettings[aspect]?.enabled
    );
  }, [aspectSettings]);

  /**
   * Get disabled aspects
   */
  const getDisabledAspects = useCallback((): ValidationAspect[] => {
    if (!aspectSettings) return [];
    return (Object.keys(aspectSettings) as ValidationAspect[]).filter(
      aspect => !aspectSettings[aspect]?.enabled
    );
  }, [aspectSettings]);

  /**
   * Check if validation is currently updating (after settings change)
   */
  const isValidating = useCallback((): boolean => {
    // If settings changed recently (within last 5 seconds), show validating state
    if (lastChange?.timestamp) {
      const timeSinceChange = Date.now() - new Date(lastChange.timestamp).getTime();
      return timeSinceChange < 5000;
    }
    return false;
  }, [lastChange]);

  return {
    aspectSettings,
    isAspectEnabled,
    getEnabledAspects,
    getDisabledAspects,
    isValidating,
    isPolling,
    lastChange,
  };
}

/**
 * Hook to get CSS classes for aspect-based UI elements
 * Automatically greys out disabled aspects
 */
export function useAspectStyles(aspect: ValidationAspect) {
  const { isAspectEnabled, isValidating } = useAspectSettingsReactive({ enabled: true });

  const enabled = isAspectEnabled(aspect);
  const validating = isValidating();

  return {
    className: `${!enabled ? 'opacity-50 text-gray-400' : ''} ${validating ? 'animate-pulse' : ''}`,
    isEnabled: enabled,
    isValidating: validating,
  };
}
