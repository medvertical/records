/**
 * Validation Settings Integration Utilities - MVP Version
 * 
 * Simplified utilities for validation settings integration:
 * - Aspect management
 * - Settings validation
 * - Error handling
 * - Basic persistence
 */

import type { ValidationSettings, ValidationAspectConfig } from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationAspectInfo {
  id: string;
  name: string;
  description: string;
  category: 'structural' | 'semantic' | 'business' | 'metadata';
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  config: ValidationAspectConfig;
}

export interface ValidationSettingsIntegration {
  settings: ValidationSettings | null;
  loading: boolean;
  error: string | null;
  aspects: ValidationAspectInfo[];
  enabledAspects: ValidationAspectInfo[];
  disabledAspects: ValidationAspectInfo[];
  updateAspect: (aspectId: string, config: Partial<ValidationAspectConfig>) => Promise<void>;
  toggleAspect: (aspectId: string) => Promise<void>;
  setAspectSeverity: (aspectId: string, severity: 'error' | 'warning' | 'info') => Promise<void>;
  enableAllAspects: () => Promise<void>;
  disableAllAspects: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  getAspectConfig: (aspectId: string) => ValidationAspectConfig | null;
  isAspectEnabled: (aspectId: string) => boolean;
  getAspectSeverity: (aspectId: string) => 'error' | 'warning' | 'info' | null;
  getValidationPayload: () => any;
  validateSettings: () => Promise<boolean>;
}

// ============================================================================
// Aspect Definitions
// ============================================================================

export const VALIDATION_ASPECTS: ValidationAspectInfo[] = [
    {
      id: 'structural',
    name: 'Structural',
    description: 'Validates FHIR resource structure and required fields',
      category: 'structural',
    enabled: true,
    severity: 'error',
    config: { enabled: true, severity: 'error' }
    },
    {
      id: 'profile',
    name: 'Profile',
    description: 'Validates against FHIR profiles and extensions',
      category: 'semantic',
    enabled: true,
    severity: 'warning',
    config: { enabled: true, severity: 'warning' }
    },
    {
      id: 'terminology',
    name: 'Terminology',
    description: 'Validates terminology bindings and code systems',
      category: 'semantic',
    enabled: true,
    severity: 'warning',
    config: { enabled: true, severity: 'warning' }
    },
    {
      id: 'reference',
    name: 'Reference',
    description: 'Validates resource references and relationships',
      category: 'semantic',
    enabled: true,
    severity: 'error',
    config: { enabled: true, severity: 'error' }
    },
    {
      id: 'businessRule',
    name: 'Business Rules',
    description: 'Validates business rules and constraints',
      category: 'business',
    enabled: true,
    severity: 'warning',
    config: { enabled: true, severity: 'warning' }
    },
    {
      id: 'metadata',
    name: 'Metadata',
    description: 'Validates metadata and administrative information',
      category: 'metadata',
    enabled: true,
    severity: 'info',
    config: { enabled: true, severity: 'info' }
  }
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get aspect info by ID
 */
export function getAspectInfo(aspectId: string): ValidationAspectInfo | null {
  return VALIDATION_ASPECTS.find(aspect => aspect.id === aspectId) || null;
}

/**
 * Get all aspect IDs
 */
export function getAllAspectIds(): string[] {
  return VALIDATION_ASPECTS.map(aspect => aspect.id);
}

/**
 * Get enabled aspect IDs
 */
export function getEnabledAspectIds(settings: ValidationSettings | null): string[] {
  if (!settings) return [];
  
  return Object.entries(settings.aspects)
    .filter(([_, config]) => config.enabled)
    .map(([aspectId, _]) => aspectId);
}

/**
 * Get disabled aspect IDs
 */
export function getDisabledAspectIds(settings: ValidationSettings | null): string[] {
  if (!settings) return [];
  
  return Object.entries(settings.aspects)
    .filter(([_, config]) => !config.enabled)
    .map(([aspectId, _]) => aspectId);
}

/**
 * Get aspect config from settings
 */
export function getAspectConfig(settings: ValidationSettings | null, aspectId: string): ValidationAspectConfig | null {
  if (!settings || !settings.aspects[aspectId as keyof typeof settings.aspects]) {
    return null;
  }
  
  return settings.aspects[aspectId as keyof typeof settings.aspects];
}

/**
 * Check if aspect is enabled
 */
export function isAspectEnabled(settings: ValidationSettings | null, aspectId: string): boolean {
  const config = getAspectConfig(settings, aspectId);
  return config?.enabled || false;
}

/**
 * Get aspect severity
 */
export function getAspectSeverity(settings: ValidationSettings | null, aspectId: string): 'error' | 'warning' | 'info' | null {
  const config = getAspectConfig(settings, aspectId);
  return config?.severity || null;
}

/**
 * Update aspect config in settings
 */
export function updateAspectConfig(
  settings: ValidationSettings | null,
  aspectId: string,
  config: Partial<ValidationAspectConfig>
): ValidationSettings | null {
  if (!settings) return null;
  
  const currentConfig = getAspectConfig(settings, aspectId);
  if (!currentConfig) return settings;
  
  const updatedConfig = { ...currentConfig, ...config };
  
  return {
    ...settings,
    aspects: {
      ...settings.aspects,
      [aspectId]: updatedConfig
    }
  };
}

/**
 * Toggle aspect enabled state
 */
export function toggleAspect(settings: ValidationSettings | null, aspectId: string): ValidationSettings | null {
  const config = getAspectConfig(settings, aspectId);
  if (!config) return settings;
  
  return updateAspectConfig(settings, aspectId, { enabled: !config.enabled });
}

/**
 * Set aspect severity
 */
export function setAspectSeverity(
  settings: ValidationSettings | null,
  aspectId: string,
  severity: 'error' | 'warning' | 'info'
): ValidationSettings | null {
  return updateAspectConfig(settings, aspectId, { severity });
}

/**
 * Enable all aspects
 */
export function enableAllAspects(settings: ValidationSettings | null): ValidationSettings | null {
  if (!settings) return null;
  
  const updatedAspects = { ...settings.aspects };
  
  Object.keys(updatedAspects).forEach(aspectId => {
    updatedAspects[aspectId as keyof typeof updatedAspects] = {
      ...updatedAspects[aspectId as keyof typeof updatedAspects],
      enabled: true
    };
  });
  
  return {
    ...settings,
    aspects: updatedAspects
  };
}

/**
 * Disable all aspects
 */
export function disableAllAspects(settings: ValidationSettings | null): ValidationSettings | null {
  if (!settings) return null;
  
  const updatedAspects = { ...settings.aspects };
  
  Object.keys(updatedAspects).forEach(aspectId => {
    updatedAspects[aspectId as keyof typeof updatedAspects] = {
      ...updatedAspects[aspectId as keyof typeof updatedAspects],
      enabled: false
    };
  });
  
  return {
    ...settings,
    aspects: updatedAspects
  };
}

/**
 * Get validation payload for API calls
 */
export function getValidationPayload(settings: ValidationSettings | null): any {
  if (!settings) return null;

  return {
    aspects: settings.aspects,
    performance: settings.performance,
    resourceTypes: settings.resourceTypes
  };
}

/**
 * Validate settings structure
 */
export function validateSettingsStructure(settings: ValidationSettings | null): boolean {
  if (!settings) return false;
  
  // Check required fields
  if (!settings.aspects || !settings.performance || !settings.resourceTypes) {
    return false;
  }
  
  // Check aspects structure
  const requiredAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
  for (const aspectId of requiredAspects) {
    const aspect = settings.aspects[aspectId as keyof typeof settings.aspects];
    if (!aspect || typeof aspect.enabled !== 'boolean' || !aspect.severity) {
      return false;
    }
  }
  
  // Check performance structure
  if (typeof settings.performance.maxConcurrent !== 'number' || 
      typeof settings.performance.batchSize !== 'number') {
    return false;
  }
  
  // Check resource types structure
  if (typeof settings.resourceTypes.enabled !== 'boolean' || 
      !settings.resourceTypes.fhirVersion) {
    return false;
  }
  
  return true;
}

  /**
   * Get aspect category color
   */
export function getAspectCategoryColor(category: 'structural' | 'semantic' | 'business' | 'metadata'): string {
  const colors: Record<string, string> = {
    structural: 'bg-blue-100 text-blue-800',
    semantic: 'bg-green-100 text-green-800',
    business: 'bg-purple-100 text-purple-800',
    metadata: 'bg-gray-100 text-gray-800'
  };
  
  return colors[category] || 'bg-gray-100 text-gray-800';
}

  /**
   * Get severity color
   */
export function getSeverityColor(severity: 'error' | 'warning' | 'info'): string {
  const colors: Record<string, string> = {
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800'
  };
  
  return colors[severity] || 'bg-gray-100 text-gray-800';
}

/**
 * Get aspect icon name
 */
export function getAspectIconName(aspectId: string): string {
  const icons: Record<string, string> = {
    structural: 'Database',
    profile: 'BookOpen',
    terminology: 'FileText',
    reference: 'Link',
    businessRule: 'Briefcase',
    metadata: 'Settings'
  };
  
  return icons[aspectId] || 'Settings';
}

/**
 * Get aspect display name
 */
export function getAspectDisplayName(aspectId: string): string {
  const aspect = getAspectInfo(aspectId);
  return aspect?.name || aspectId;
}

  /**
   * Get aspect description
   */
export function getAspectDescription(aspectId: string): string {
  const aspect = getAspectInfo(aspectId);
  return aspect?.description || 'Validation aspect';
}

/**
 * Get aspect category
 */
export function getAspectCategory(aspectId: string): 'structural' | 'semantic' | 'business' | 'metadata' {
  const aspect = getAspectInfo(aspectId);
  return aspect?.category || 'metadata';
}

/**
 * Get enabled aspects count
 */
export function getEnabledAspectsCount(settings: ValidationSettings | null): number {
  return getEnabledAspectIds(settings).length;
}

/**
 * Get disabled aspects count
 */
export function getDisabledAspectsCount(settings: ValidationSettings | null): number {
  return getDisabledAspectIds(settings).length;
}

/**
 * Get total aspects count
 */
export function getTotalAspectsCount(): number {
  return VALIDATION_ASPECTS.length;
}