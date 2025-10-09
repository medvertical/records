/**
 * Validation Settings Hook - MVP Version
 * 
 * Simplified hook for managing validation settings with only essential features:
 * - 6 validation aspects
 * - Performance settings (maxConcurrent, batchSize)
 * - Resource type filtering
 * - FHIR version support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  FHIRVersion
} from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface UseValidationSettingsOptions {
  /** Server ID for server-specific settings */
  serverId?: number;
  
  /** Whether to auto-save changes */
  autoSave?: boolean;
  
  /** Auto-save delay in milliseconds */
  autoSaveDelayMs?: number;
}

export interface UseValidationSettingsReturn {
  // Settings state
  settings: ValidationSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Actions
  updateSettings: (updates: Partial<ValidationSettingsUpdate>) => Promise<void>;
  saveSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  loadSettings: () => Promise<void>;
  
  // Resource type management
  loadResourceTypes: (version: FHIRVersion) => Promise<string[]>;
  availableResourceTypes: string[];
  
  // FHIR version management
  fhirVersion: FHIRVersion;
  setFhirVersion: (version: FHIRVersion) => void;
  
  // Validation
  validateSettings: (settings: ValidationSettings) => Promise<boolean>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useValidationSettings(options: UseValidationSettingsOptions = {}): UseValidationSettingsReturn {
  const { toast } = useToast();
  const {
    serverId,
    autoSave = false,
    autoSaveDelayMs = 1000
  } = options;

  // State
  const [settings, setSettings] = useState<ValidationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [fhirVersion, setFhirVersion] = useState<FHIRVersion>('R4');

  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [serverId]);

  // Load resource types when FHIR version changes
  useEffect(() => {
    if (fhirVersion) {
      loadResourceTypes(fhirVersion);
    }
  }, [fhirVersion]);

  // Auto-save effect
  useEffect(() => {
    if (autoSave && settings) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(() => {
        saveSettings();
      }, autoSaveDelayMs);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [settings, autoSave, autoSaveDelayMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSettings(data);
      
      // Extract FHIR version from settings
      if (data.resourceTypes?.fhirVersion) {
        setFhirVersion(data.resourceTypes.fhirVersion);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      console.error('Error loading validation settings:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to load validation settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [serverId, toast]);

  const saveSettings = useCallback(async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const url = `/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSettings(data);
      
      toast({
        title: 'Success',
        description: 'Validation settings saved successfully'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      console.error('Error saving validation settings:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to save validation settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }, [settings, serverId, toast]);

  const updateSettings = useCallback(async (updates: Partial<ValidationSettingsUpdate>) => {
    if (!settings) return;
    
    try {
      setError(null);
      
      // Merge updates with current settings
      const updatedSettings = {
        ...settings,
        ...updates,
        // Handle nested updates
        aspects: updates.aspects ? { ...settings.aspects, ...updates.aspects } : settings.aspects,
        performance: updates.performance ? { ...settings.performance, ...updates.performance } : settings.performance,
        resourceTypes: updates.resourceTypes ? { ...settings.resourceTypes, ...updates.resourceTypes } : settings.resourceTypes
      };
      
      setSettings(updatedSettings);
      
      // Auto-save if enabled
      if (autoSave) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        
        autoSaveTimerRef.current = setTimeout(() => {
          saveSettings();
        }, autoSaveDelayMs);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      console.error('Error updating validation settings:', err);
    }
  }, [settings, autoSave, autoSaveDelayMs, saveSettings]);

  const resetToDefaults = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch('/api/validation/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          serverId,
          fhirVersion 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reset settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSettings(data);
      
      // Update FHIR version if changed
      if (data.resourceTypes?.fhirVersion) {
        setFhirVersion(data.resourceTypes.fhirVersion);
      }
      
      toast({
        title: 'Success',
        description: 'Settings reset to defaults'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      console.error('Error resetting validation settings:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to reset settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }, [serverId, fhirVersion, toast]);

  const loadResourceTypes = useCallback(async (version: FHIRVersion): Promise<string[]> => {
    try {
      const response = await fetch(`/api/validation/resource-types/${version}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load resource types: ${response.statusText}`);
      }
      
      const data = await response.json();
      const resourceTypes = data.resourceTypes || [];
      setAvailableResourceTypes(resourceTypes);
      
      return resourceTypes;
    } catch (err) {
      console.error('Error loading resource types:', err);
      setAvailableResourceTypes([]);
      return [];
    }
  }, []);

  const validateSettings = useCallback(async (settingsToValidate: ValidationSettings): Promise<boolean> => {
    try {
      const response = await fetch('/api/validation/settings/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsToValidate)
      });
      
      if (!response.ok) {
        return false;
      }
      
      const result = await response.json();
      return result.valid === true;
    } catch (err) {
      console.error('Error validating settings:', err);
      return false;
    }
  }, []);

  return {
    // State
    settings,
    loading,
    saving,
    error,
    
    // Actions
    updateSettings,
    saveSettings,
    resetToDefaults,
    loadSettings,
    
    // Resource type management
    loadResourceTypes,
    availableResourceTypes,
    
    // FHIR version management
    fhirVersion,
    setFhirVersion,
    
    // Validation
    validateSettings
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get aspect display name
 */
export function getAspectDisplayName(aspectKey: string): string {
  return aspectKey.replace(/([A-Z])/g, ' $1').trim();
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
 * Get aspect icon component name
 */
export function getAspectIconName(aspectKey: string): string {
  const icons: Record<string, string> = {
    structural: 'Database',
    profile: 'BookOpen',
    terminology: 'FileText',
    reference: 'Link',
    businessRule: 'Briefcase',
    metadata: 'Settings'
  };
  
  return icons[aspectKey] || 'Settings';
}