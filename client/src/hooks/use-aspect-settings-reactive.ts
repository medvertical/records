/**
 * Aspect Settings Reactive Hook - MVP Version
 * 
 * Simplified hook for reactive aspect settings management:
 * - Automatic detection of aspect setting changes
 * - Cache invalidation for validation results
 * - UI state updates and notifications
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useValidationSettings } from './use-validation-settings';
import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AspectSettings {
  structural: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
  profile: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
  terminology: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
  reference: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
  businessRule: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
  metadata: { enabled: boolean; severity: 'error' | 'warning' | 'info' };
}

export interface UseAspectSettingsReactiveOptions {
  /** Callback when settings change */
  onSettingsChange?: (newSettings: AspectSettings, previousSettings: AspectSettings) => void;
  
  /** Whether to enable reactive updates */
  enabled?: boolean;
  
  /** Whether to invalidate validation result cache on changes */
  invalidateCache?: boolean;
  
  /** Whether to show notifications on changes */
  showNotifications?: boolean;
}

export interface UseAspectSettingsReactiveReturn {
  /** Current aspect settings */
  currentSettings: AspectSettings | null;
  
  /** Whether settings have changed since last check */
  hasChanged: boolean;
  
  /** Last change timestamp */
  lastChange: Date | null;
  
  /** Whether reactive updates are enabled */
  isEnabled: boolean;
  
  /** Manually trigger cache invalidation */
  invalidateCache: () => void;
  
  /** Get enabled aspects count */
  getEnabledAspectsCount: () => number;
  
  /** Get disabled aspects */
  getDisabledAspects: () => string[];
  
  /** Get enabled aspects */
  getEnabledAspects: () => string[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAspectSettingsReactive(options: UseAspectSettingsReactiveOptions = {}): UseAspectSettingsReactiveReturn {
  const {
    onSettingsChange,
    enabled = true,
    invalidateCache: shouldInvalidateCache = true,
    showNotifications = false
  } = options;

  const queryClient = useQueryClient();
  const previousSettingsRef = useRef<AspectSettings | null>(null);
  const lastChangeRef = useRef<Date | null>(null);

  // Use the validation settings hook
  const { settings: validationSettings } = useValidationSettings({
    autoSave: false
  });

  // Extract aspect settings from validation settings
  const currentSettings: AspectSettings | null = validationSettings ? {
    structural: validationSettings.aspects.structural,
    profile: validationSettings.aspects.profile,
    terminology: validationSettings.aspects.terminology,
    reference: validationSettings.aspects.reference,
    businessRule: validationSettings.aspects.businessRule,
    metadata: validationSettings.aspects.metadata
  } : null;

  // Check for changes
  const hasChanged = useCallback(() => {
    if (!currentSettings || !previousSettingsRef.current) {
      return false;
    }

    const previous = previousSettingsRef.current;
    const current = currentSettings;

    // Check if any aspect has changed
    return Object.keys(current).some(aspectKey => {
      const currentAspect = current[aspectKey as keyof AspectSettings];
      const previousAspect = previous[aspectKey as keyof AspectSettings];
      
      return (
        currentAspect.enabled !== previousAspect.enabled ||
        currentAspect.severity !== previousAspect.severity
      );
    });
  }, [currentSettings]);

  // Handle settings changes
  useEffect(() => {
    if (!enabled || !currentSettings) return;

    const changed = hasChanged();
    
    if (changed && previousSettingsRef.current) {
      // Update last change timestamp
      lastChangeRef.current = new Date();
      
      // Call change callback
      if (onSettingsChange) {
        onSettingsChange(currentSettings, previousSettingsRef.current);
      }
      
      // Invalidate cache if enabled
      if (shouldInvalidateCache) {
        invalidateValidationCache();
      }
    }
    
    // Update previous settings reference
    previousSettingsRef.current = currentSettings;
  }, [currentSettings, enabled, hasChanged, onSettingsChange, shouldInvalidateCache]);

  // Cache invalidation function
  const invalidateValidationCache = useCallback(() => {
    // Invalidate validation-related queries
    queryClient.invalidateQueries({ queryKey: ['validation-results'] });
    queryClient.invalidateQueries({ queryKey: ['validation-progress'] });
    queryClient.invalidateQueries({ queryKey: ['validation-stats'] });
    queryClient.invalidateQueries({ queryKey: ['validation-aspects'] });
    queryClient.invalidateQueries({ queryKey: ['validation-quality'] });
  }, [queryClient]);

  // Manual cache invalidation
  const invalidateCache = useCallback(() => {
    invalidateValidationCache();
  }, [invalidateValidationCache]);

  // Get enabled aspects count
  const getEnabledAspectsCount = useCallback((): number => {
    if (!currentSettings) return 0;
    
    return Object.values(currentSettings).filter(aspect => aspect.enabled).length;
  }, [currentSettings]);

  // Get disabled aspects
  const getDisabledAspects = useCallback((): string[] => {
    if (!currentSettings) return [];
    
    return Object.entries(currentSettings)
      .filter(([_, aspect]) => !aspect.enabled)
      .map(([aspectKey, _]) => aspectKey);
  }, [currentSettings]);

  // Get enabled aspects
  const getEnabledAspects = useCallback((): string[] => {
    if (!currentSettings) return [];
    
    return Object.entries(currentSettings)
      .filter(([_, aspect]) => aspect.enabled)
      .map(([aspectKey, _]) => aspectKey);
  }, [currentSettings]);

  return {
    currentSettings,
    hasChanged: hasChanged(),
    lastChange: lastChangeRef.current,
    isEnabled: enabled,
    invalidateCache,
    getEnabledAspectsCount,
    getDisabledAspects,
    getEnabledAspects
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get aspect display name
 */
export function getAspectDisplayName(aspectKey: string): string {
  const displayNames: Record<string, string> = {
    structural: 'Structural',
    profile: 'Profile',
    terminology: 'Terminology',
    reference: 'Reference',
    businessRule: 'Business Rules',
    metadata: 'Metadata'
  };
  
  return displayNames[aspectKey] || aspectKey;
}

/**
 * Get aspect description
 */
export function getAspectDescription(aspectKey: string): string {
  const descriptions: Record<string, string> = {
    structural: 'Validates FHIR resource structure and required fields',
    profile: 'Validates against FHIR profiles and extensions',
    terminology: 'Validates terminology bindings and code systems',
    reference: 'Validates resource references and relationships',
    businessRule: 'Validates business rules and constraints',
    metadata: 'Validates metadata and administrative information'
  };
  
  return descriptions[aspectKey] || 'Validation aspect';
}

/**
 * Get aspect icon name
 */
export function getAspectIconName(aspectKey: string): string {
  const iconNames: Record<string, string> = {
    structural: 'Database',
    profile: 'BookOpen',
    terminology: 'FileText',
    reference: 'Link',
    businessRule: 'Briefcase',
    metadata: 'Settings'
  };
  
  return iconNames[aspectKey] || 'Settings';
}

/**
 * Get aspect color variant
 */
export function getAspectColorVariant(aspectKey: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colorVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    structural: 'default',
    profile: 'secondary',
    terminology: 'outline',
    reference: 'default',
    businessRule: 'secondary',
    metadata: 'outline'
  };
  
  return colorVariants[aspectKey] || 'default';
}

/**
 * Get severity color variant
 */
export function getSeverityColorVariant(severity: 'error' | 'warning' | 'info'): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colorVariants: Record<'error' | 'warning' | 'info', 'default' | 'secondary' | 'destructive' | 'outline'> = {
    error: 'destructive',
    warning: 'outline',
    info: 'secondary'
  };
  
  return colorVariants[severity] || 'secondary';
}

/**
 * Get severity display text
 */
export function getSeverityDisplayText(severity: 'error' | 'warning' | 'info'): string {
  const displayTexts: Record<'error' | 'warning' | 'info', string> = {
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  };
  
  return displayTexts[severity] || 'Unknown';
}