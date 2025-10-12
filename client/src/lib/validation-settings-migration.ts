/**
 * Validation Settings Migration Logic - MVP Version
 * 
 * Handles migration of validation settings between FHIR versions:
 * - R4 to R5 migration
 * - R5 to R4 migration
 * - Resource type filtering migration
 * - Settings validation and cleanup
 * - Migration warnings and confirmations
 */

import type { ValidationSettings, FHIRVersion } from '@shared/validation-settings';
import { getDefaultResourceTypes, isResourceTypeAvailableInVersion } from '../hooks/use-fhir-version-detection';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MigrationResult {
  success: boolean;
  migratedSettings: ValidationSettings;
  warnings: MigrationWarning[];
  errors: MigrationError[];
  removedResourceTypes: string[];
  addedResourceTypes: string[];
}

export interface MigrationWarning {
  type: 'resource_type_removed' | 'resource_type_added' | 'setting_deprecated' | 'setting_changed';
  message: string;
  details?: string;
  affectedResourceTypes?: string[];
  affectedSettings?: string[];
}

export interface MigrationError {
  type: 'validation_failed' | 'migration_failed' | 'incompatible_version';
  message: string;
  details?: string;
  field?: string;
}

export interface MigrationOptions {
  /** Whether to show migration warnings */
  showWarnings?: boolean;
  
  /** Whether to auto-remove unsupported resource types */
  autoRemoveUnsupported?: boolean;
  
  /** Whether to auto-add new resource types */
  autoAddNew?: boolean;
  
  /** Whether to preserve user selections */
  preserveUserSelections?: boolean;
  
  /** Custom resource type mappings */
  resourceTypeMappings?: Record<string, string>;
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate validation settings from one FHIR version to another
 */
export function migrateValidationSettings(
  settings: ValidationSettings,
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion,
  options: MigrationOptions = {}
): MigrationResult {
  const {
    showWarnings = true,
    autoRemoveUnsupported = true,
    autoAddNew = false,
    preserveUserSelections = true,
    resourceTypeMappings = {}
  } = options;

  const warnings: MigrationWarning[] = [];
  const errors: MigrationError[] = [];
  const removedResourceTypes: string[] = [];
  const addedResourceTypes: string[] = [];

  try {
    // Start with a copy of the current settings
    const migratedSettings: ValidationSettings = {
      ...settings,
      resourceTypes: {
        ...settings.resourceTypes,
        fhirVersion: toVersion
      }
    };

    // Handle resource type migration
    const resourceTypeResult = migrateResourceTypes(
      settings.resourceTypes.includedTypes || [],
      fromVersion,
      toVersion,
      {
        autoRemoveUnsupported,
        autoAddNew,
        preserveUserSelections,
        resourceTypeMappings
      }
    );

    migratedSettings.resourceTypes.includedTypes = resourceTypeResult.migratedTypes;
    warnings.push(...resourceTypeResult.warnings);
    removedResourceTypes.push(...resourceTypeResult.removedTypes);
    addedResourceTypes.push(...resourceTypeResult.addedTypes);

    // Handle aspect settings migration
    const aspectResult = migrateAspectSettings(settings.aspects, fromVersion, toVersion);
    migratedSettings.aspects = aspectResult.migratedAspects;
    warnings.push(...aspectResult.warnings);

    // Handle performance settings migration
    const performanceResult = migratePerformanceSettings(settings.performance, fromVersion, toVersion);
    migratedSettings.performance = performanceResult.migratedPerformance;
    warnings.push(...performanceResult.warnings);

    // Validate migrated settings
    const validationResult = validateMigratedSettings(migratedSettings, toVersion);
    if (!validationResult.isValid) {
      errors.push(...validationResult.errors);
    }

    return {
      success: errors.length === 0,
      migratedSettings,
      warnings,
      errors,
      removedResourceTypes,
      addedResourceTypes
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown migration error';
    errors.push({
      type: 'migration_failed',
      message: 'Failed to migrate settings',
      details: errorMessage
    });

    return {
      success: false,
      migratedSettings: settings,
      warnings,
      errors,
      removedResourceTypes,
      addedResourceTypes
    };
  }
}

/**
 * Migrate resource types between FHIR versions
 */
function migrateResourceTypes(
  includedTypes: string[],
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion,
  options: MigrationOptions
): {
  migratedTypes: string[];
  warnings: MigrationWarning[];
  removedTypes: string[];
  addedTypes: string[];
} {
  const warnings: MigrationWarning[] = [];
  const removedTypes: string[] = [];
  const addedTypes: string[] = [];

  // Get default resource types for both versions
  const fromDefaultTypes = getDefaultResourceTypes(fromVersion);
  const toDefaultTypes = getDefaultResourceTypes(toVersion);

  // Find resource types that are no longer available
  const unsupportedTypes = includedTypes.filter(type => 
    !isResourceTypeAvailableInVersion(type, toVersion)
  );

  // Find new resource types that could be added
  const newTypes = toDefaultTypes.filter(type => 
    !isResourceTypeAvailableInVersion(type, fromVersion) && 
    !includedTypes.includes(type)
  );

  // Remove unsupported types if auto-remove is enabled
  let migratedTypes = includedTypes;
  if (options.autoRemoveUnsupported && unsupportedTypes.length > 0) {
    migratedTypes = includedTypes.filter(type => 
      isResourceTypeAvailableInVersion(type, toVersion)
    );
    removedTypes.push(...unsupportedTypes);

    warnings.push({
      type: 'resource_type_removed',
      message: `${unsupportedTypes.length} resource type(s) removed (not available in ${toVersion})`,
      details: `Removed: ${unsupportedTypes.join(', ')}`,
      affectedResourceTypes: unsupportedTypes
    });
  }

  // Add new types if auto-add is enabled
  if (options.autoAddNew && newTypes.length > 0) {
    migratedTypes = [...migratedTypes, ...newTypes];
    addedTypes.push(...newTypes);

    warnings.push({
      type: 'resource_type_added',
      message: `${newTypes.length} new resource type(s) available in ${toVersion}`,
      details: `Added: ${newTypes.join(', ')}`,
      affectedResourceTypes: newTypes
    });
  }

  return {
    migratedTypes,
    warnings,
    removedTypes,
    addedTypes
  };
}

/**
 * Migrate aspect settings between FHIR versions
 */
function migrateAspectSettings(
  aspects: ValidationSettings['aspects'],
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion
): {
  migratedAspects: ValidationSettings['aspects'];
  warnings: MigrationWarning[];
} {
  const warnings: MigrationWarning[] = [];
  const migratedAspects = { ...aspects };

  // Check for aspect-specific version differences
  if (fromVersion === 'R4' && toVersion === 'R5') {
    // R4 to R5 migration - no changes needed for aspects
    // All aspects are supported in both versions
  } else if (fromVersion === 'R5' && toVersion === 'R4') {
    // R5 to R4 migration - no changes needed for aspects
    // All aspects are supported in both versions
  }

  return {
    migratedAspects,
    warnings
  };
}

/**
 * Migrate performance settings between FHIR versions
 */
function migratePerformanceSettings(
  performance: ValidationSettings['performance'],
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion
): {
  migratedPerformance: ValidationSettings['performance'];
  warnings: MigrationWarning[];
} {
  const warnings: MigrationWarning[] = [];
  const migratedPerformance = { ...performance };

  // Check for performance-specific version differences
  if (fromVersion === 'R4' && toVersion === 'R5') {
    // R4 to R5 migration - R5 might support higher concurrency
    if (performance.maxConcurrent < 16) {
      warnings.push({
        type: 'setting_changed',
        message: 'R5 supports higher concurrency limits',
        details: 'Consider increasing maxConcurrent for better performance',
        affectedSettings: ['maxConcurrent']
      });
    }
  } else if (fromVersion === 'R5' && toVersion === 'R4') {
    // R5 to R4 migration - R4 might have lower limits
    if (performance.maxConcurrent > 8) {
      warnings.push({
        type: 'setting_changed',
        message: 'R4 has lower concurrency limits',
        details: 'Consider reducing maxConcurrent for R4 compatibility',
        affectedSettings: ['maxConcurrent']
      });
    }
  }

  return {
    migratedPerformance,
    warnings
  };
}

/**
 * Validate migrated settings
 */
function validateMigratedSettings(
  settings: ValidationSettings,
  version: FHIRVersion
): {
  isValid: boolean;
  errors: MigrationError[];
} {
  const errors: MigrationError[] = [];

  // Validate resource types
  if (settings.resourceTypes.enabled && settings.resourceTypes.includedTypes) {
    const invalidTypes = settings.resourceTypes.includedTypes.filter(type => 
      !isResourceTypeAvailableInVersion(type, version)
    );

    if (invalidTypes.length > 0) {
      errors.push({
        type: 'validation_failed',
        message: 'Invalid resource types for target version',
        details: `Invalid types: ${invalidTypes.join(', ')}`,
        field: 'resourceTypes.includedTypes'
      });
    }
  }

  // Validate performance settings
  if (settings.performance) {
    if (settings.performance.maxConcurrent < 1 || settings.performance.maxConcurrent > 16) {
      errors.push({
        type: 'validation_failed',
        message: 'Invalid maxConcurrent value',
        details: 'maxConcurrent must be between 1 and 16',
        field: 'performance.maxConcurrent'
      });
    }

    if (settings.performance.batchSize < 1 || settings.performance.batchSize > 1000) {
      errors.push({
        type: 'validation_failed',
        message: 'Invalid batchSize value',
        details: 'batchSize must be between 1 and 1000',
        field: 'performance.batchSize'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get migration summary text
 */
export function getMigrationSummary(result: MigrationResult): string {
  if (!result.success) {
    return `Migration failed: ${result.errors.map(e => e.message).join(', ')}`;
  }

  const parts: string[] = [];
  
  if (result.removedResourceTypes.length > 0) {
    parts.push(`Removed ${result.removedResourceTypes.length} resource type(s)`);
  }
  
  if (result.addedResourceTypes.length > 0) {
    parts.push(`Added ${result.addedResourceTypes.length} resource type(s)`);
  }
  
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning(s)`);
  }
  
  if (parts.length === 0) {
    return 'Settings migrated successfully';
  }
  
  return `Migration completed: ${parts.join(', ')}`;
}

/**
 * Get migration warnings text
 */
export function getMigrationWarningsText(warnings: MigrationWarning[]): string[] {
  return warnings.map(warning => {
    let text = warning.message;
    if (warning.details) {
      text += ` (${warning.details})`;
    }
    return text;
  });
}

/**
 * Get migration errors text
 */
export function getMigrationErrorsText(errors: MigrationError[]): string[] {
  return errors.map(error => {
    let text = error.message;
    if (error.details) {
      text += ` (${error.details})`;
    }
    return text;
  });
}

/**
 * Check if migration is needed
 */
export function isMigrationNeeded(
  settings: ValidationSettings,
  currentVersion: FHIRVersion
): boolean {
  return settings.resourceTypes?.fhirVersion !== currentVersion;
}

/**
 * Get migration impact assessment
 */
export function getMigrationImpact(
  settings: ValidationSettings,
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion
): {
  impact: 'low' | 'medium' | 'high';
  description: string;
  affectedAreas: string[];
} {
  const affectedAreas: string[] = [];
  let impact: 'low' | 'medium' | 'high' = 'low';

  // Check resource type impact
  if (settings.resourceTypes.enabled && settings.resourceTypes.includedTypes) {
    const unsupportedTypes = settings.resourceTypes.includedTypes.filter(type => 
      !isResourceTypeAvailableInVersion(type, toVersion)
    );

    if (unsupportedTypes.length > 0) {
      affectedAreas.push('Resource Types');
      impact = unsupportedTypes.length > 3 ? 'high' : 'medium';
    }
  }

  // Check performance impact
  if (fromVersion === 'R5' && toVersion === 'R4' && settings.performance?.maxConcurrent && settings.performance.maxConcurrent > 8) {
    affectedAreas.push('Performance Settings');
    impact = 'medium';
  }

  let description = 'Migration impact assessment: ';
  if (impact === 'low') {
    description += 'Minimal impact, settings should migrate cleanly';
  } else if (impact === 'medium') {
    description += 'Moderate impact, some settings may need adjustment';
  } else {
    description += 'High impact, significant changes required';
  }

  return {
    impact,
    description,
    affectedAreas
  };
}

/**
 * Create migration confirmation message
 */
export function createMigrationConfirmationMessage(
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion,
  impact: ReturnType<typeof getMigrationImpact>
): string {
  const baseMessage = `Migrate settings from ${fromVersion} to ${toVersion}?`;
  
  if (impact.impact === 'low') {
    return baseMessage;
  } else if (impact.impact === 'medium') {
    return `${baseMessage}\n\nThis will affect: ${impact.affectedAreas.join(', ')}`;
  } else {
    return `${baseMessage}\n\n⚠️ High impact migration!\nThis will significantly affect: ${impact.affectedAreas.join(', ')}`;
  }
}

/**
 * Get resource type migration suggestions
 */
export function getResourceTypeMigrationSuggestions(
  removedTypes: string[],
  addedTypes: string[]
): {
  suggestions: string[];
  alternatives: Record<string, string[]>;
} {
  const suggestions: string[] = [];
  const alternatives: Record<string, string[]> = {};

  // Add suggestions for removed types
  if (removedTypes.length > 0) {
    suggestions.push(`Consider alternative resource types for: ${removedTypes.join(', ')}`);
    
    // Add specific alternatives
    removedTypes.forEach(type => {
      alternatives[type] = getAlternativeResourceTypes(type);
    });
  }

  // Add suggestions for new types
  if (addedTypes.length > 0) {
    suggestions.push(`New resource types available: ${addedTypes.join(', ')}`);
  }

  return {
    suggestions,
    alternatives
  };
}

/**
 * Get alternative resource types for a removed type
 */
function getAlternativeResourceTypes(removedType: string): string[] {
  const alternatives: Record<string, string[]> = {
    'Substance': ['Medication', 'Device'],
    'TestScript': ['TestReport', 'Observation'],
    'ClinicalImpression': ['DiagnosticReport', 'Observation'],
    'DeviceMetric': ['Device', 'Observation'],
    'SubstanceDefinition': ['Medication', 'Substance'],
    'TestReport': ['DiagnosticReport', 'Observation'],
    'TestPlan': ['TestScript', 'TestReport'],
    'ValueSet': ['CodeSystem', 'ConceptMap'],
    'CodeSystem': ['ValueSet', 'ConceptMap'],
    'ConceptMap': ['ValueSet', 'CodeSystem']
  };

  return alternatives[removedType] || [];
}

