/**
 * Validation Settings Validator - Rock Solid Validation
 * 
 * This module provides comprehensive validation for validation settings using Zod schemas.
 * It ensures all settings are valid before they are applied to the system.
 */

import { z } from 'zod';
import type {
  ValidationSettings,
  ValidationAspectConfig,
  ValidationRule,
  TerminologyServerConfig,
  ProfileResolutionServerConfig,
  ServerAuthConfig,
  OAuth2Config,
  CacheConfig,
  TimeoutConfig,
  BatchProcessingConfig,
  ResourceTypeFilterConfig,
  ValidationSettingsValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationSuggestion,
  ValidationSeverity,
  FHIRVersion
} from './validation-settings';

// ============================================================================
// Base Schemas
// ============================================================================

const ValidationSeveritySchema = z.enum(['error', 'warning', 'information']);

const FHIRVersionSchema = z.enum(['R4', 'R4B', 'R5']);

// ============================================================================
// Validation Rule Schema
// ============================================================================

const ValidationRuleSchema = z.object({
  id: z.string().min(1, 'Rule ID is required'),
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  enabled: z.boolean(),
  severity: ValidationSeveritySchema.optional(),
  config: z.record(z.any()).optional()
});

// ============================================================================
// Server Authentication Schema
// ============================================================================

const OAuth2ConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  tokenUrl: z.string().url('Token URL must be a valid URL'),
  scope: z.string().optional()
});

const ServerAuthConfigSchema = z.object({
  type: z.enum(['none', 'basic', 'bearer', 'oauth2']),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  oauth2: OAuth2ConfigSchema.optional()
}).refine((data) => {
  // Validate that required fields are present based on auth type
  if (data.type === 'basic') {
    return data.username && data.password;
  }
  if (data.type === 'bearer') {
    return data.token;
  }
  if (data.type === 'oauth2') {
    return data.oauth2;
  }
  return true;
}, {
  message: 'Authentication configuration is incomplete for the specified type'
});

// ============================================================================
// Server Configuration Schemas
// ============================================================================

const TerminologyServerConfigSchema = z.object({
  id: z.string().min(1, 'Server ID is required'),
  name: z.string().min(1, 'Server name is required'),
  url: z.string().url('Server URL must be a valid URL'),
  enabled: z.boolean(),
  priority: z.number().int().min(0, 'Priority must be a non-negative integer'),
  auth: ServerAuthConfigSchema.optional(),
  timeoutMs: z.number().int().min(1000, 'Timeout must be at least 1000ms').max(300000, 'Timeout must not exceed 5 minutes').optional(),
  useForValidation: z.boolean(),
  useForExpansion: z.boolean()
});

const ProfileResolutionServerConfigSchema = z.object({
  id: z.string().min(1, 'Server ID is required'),
  name: z.string().min(1, 'Server name is required'),
  url: z.string().url('Server URL must be a valid URL'),
  enabled: z.boolean(),
  priority: z.number().int().min(0, 'Priority must be a non-negative integer'),
  auth: ServerAuthConfigSchema.optional(),
  timeoutMs: z.number().int().min(1000, 'Timeout must be at least 1000ms').max(300000, 'Timeout must not exceed 5 minutes').optional(),
  useForProfileResolution: z.boolean(),
  useForStructureDefinitionResolution: z.boolean()
});

// ============================================================================
// Performance Configuration Schemas
// ============================================================================

const CacheConfigSchema = z.object({
  enabled: z.boolean(),
  ttlMs: z.number().int().min(1000, 'Cache TTL must be at least 1000ms').max(3600000, 'Cache TTL must not exceed 1 hour'),
  maxSizeMB: z.number().int().min(1, 'Max cache size must be at least 1MB').max(10000, 'Max cache size must not exceed 10GB'),
  cacheValidationResults: z.boolean(),
  cacheTerminologyExpansions: z.boolean(),
  cacheProfileResolutions: z.boolean()
});

const TimeoutConfigSchema = z.object({
  defaultTimeoutMs: z.number().int().min(1000, 'Default timeout must be at least 1000ms').max(300000, 'Default timeout must not exceed 5 minutes'),
  structuralValidationTimeoutMs: z.number().int().min(1000, 'Structural validation timeout must be at least 1000ms').max(300000, 'Structural validation timeout must not exceed 5 minutes'),
  profileValidationTimeoutMs: z.number().int().min(1000, 'Profile validation timeout must be at least 1000ms').max(300000, 'Profile validation timeout must not exceed 5 minutes'),
  terminologyValidationTimeoutMs: z.number().int().min(1000, 'Terminology validation timeout must be at least 1000ms').max(300000, 'Terminology validation timeout must not exceed 5 minutes'),
  referenceValidationTimeoutMs: z.number().int().min(1000, 'Reference validation timeout must be at least 1000ms').max(300000, 'Reference validation timeout must not exceed 5 minutes'),
  businessRuleValidationTimeoutMs: z.number().int().min(1000, 'Business rule validation timeout must be at least 1000ms').max(300000, 'Business rule validation timeout must not exceed 5 minutes'),
  metadataValidationTimeoutMs: z.number().int().min(1000, 'Metadata validation timeout must be at least 1000ms').max(300000, 'Metadata validation timeout must not exceed 5 minutes')
});

const BatchProcessingConfigSchema = z.object({
  defaultBatchSize: z.number().int().min(50, 'Default batch size must be at least 50').max(1000, 'Default batch size must not exceed 1000'),
  minBatchSize: z.number().int().min(10, 'Minimum batch size must be at least 10').max(500, 'Minimum batch size must not exceed 500'),
  maxBatchSize: z.number().int().min(100, 'Maximum batch size must be at least 100').max(2000, 'Maximum batch size must not exceed 2000'),
  useAdaptiveBatchSizing: z.boolean(),
  targetBatchProcessingTimeMs: z.number().int().min(5000, 'Target batch processing time must be at least 5 seconds').max(300000, 'Target batch processing time must not exceed 5 minutes'),
  pauseBetweenBatches: z.boolean(),
  pauseDurationMs: z.number().int().min(100, 'Pause duration must be at least 100ms').max(10000, 'Pause duration must not exceed 10 seconds'),
  retryFailedBatches: z.boolean(),
  maxRetryAttempts: z.number().int().min(0, 'Max retry attempts must be at least 0').max(5, 'Max retry attempts must not exceed 5'),
  retryDelayMs: z.number().int().min(1000, 'Retry delay must be at least 1 second').max(60000, 'Retry delay must not exceed 1 minute')
}).refine((data) => {
  // Validate that default batch size is within min/max bounds
  return data.defaultBatchSize >= data.minBatchSize && data.defaultBatchSize <= data.maxBatchSize;
}, {
  message: 'Default batch size must be between min and max batch size values',
  path: ['defaultBatchSize']
}).refine((data) => {
  // Validate that min batch size is less than max batch size
  return data.minBatchSize < data.maxBatchSize;
}, {
  message: 'Minimum batch size must be less than maximum batch size',
  path: ['minBatchSize']
});

const ResourceTypeFilterConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['include', 'exclude'], {
    errorMap: () => ({ message: 'Filter mode must be either "include" or "exclude"' })
  }),
  resourceTypes: z.array(z.string().min(1, 'Resource type name cannot be empty')).max(100, 'Cannot filter more than 100 resource types'),
  validateUnknownTypes: z.boolean(),
  showResourceTypeCounts: z.boolean(),
  validateCustomTypes: z.boolean()
}).refine((data) => {
  // If filtering is enabled, resource types list cannot be empty
  if (data.enabled && data.resourceTypes.length === 0) {
    return false;
  }
  return true;
}, {
  message: 'Resource types list cannot be empty when filtering is enabled',
  path: ['resourceTypes']
}).refine((data) => {
  // Resource type names should be valid FHIR resource type names (alphanumeric, PascalCase)
  const validResourceTypePattern = /^[A-Z][a-zA-Z0-9]*$/;
  return data.resourceTypes.every(type => validResourceTypePattern.test(type));
}, {
  message: 'All resource types must be valid FHIR resource type names (PascalCase, alphanumeric)',
  path: ['resourceTypes']
});

// ============================================================================
// Validation Aspect Configuration Schema
// ============================================================================

const ValidationAspectConfigSchema = z.object({
  enabled: z.boolean(),
  severity: ValidationSeveritySchema,
  customRules: z.array(ValidationRuleSchema).optional(),
  timeoutMs: z.number().int().min(1000, 'Timeout must be at least 1000ms').max(300000, 'Timeout must not exceed 5 minutes').optional(),
  failFast: z.boolean().optional()
});

// ============================================================================
// Main Validation Settings Schema
// ============================================================================

const ValidationSettingsSchema = z.object({
  id: z.string().optional(),
  version: z.number().int().min(1, 'Version must be at least 1'),
  isActive: z.boolean(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  
  // Core validation aspects
  structural: ValidationAspectConfigSchema,
  profile: ValidationAspectConfigSchema,
  terminology: ValidationAspectConfigSchema,
  reference: ValidationAspectConfigSchema,
  businessRule: ValidationAspectConfigSchema,
  metadata: ValidationAspectConfigSchema,
  
  // Global settings
  strictMode: z.boolean(),
  defaultSeverity: ValidationSeveritySchema,
  includeDebugInfo: z.boolean(),
  validateAgainstBaseSpec: z.boolean(),
  fhirVersion: FHIRVersionSchema,
  
  // Server configurations
  terminologyServers: z.array(TerminologyServerConfigSchema),
  profileResolutionServers: z.array(ProfileResolutionServerConfigSchema),
  
  // Performance settings
  cacheSettings: CacheConfigSchema,
  timeoutSettings: TimeoutConfigSchema,
  batchProcessingSettings: BatchProcessingConfigSchema,
  resourceTypeFilterSettings: ResourceTypeFilterConfigSchema,
  maxConcurrentValidations: z.number().int().min(1, 'Max concurrent validations must be at least 1').max(100, 'Max concurrent validations must not exceed 100'),
  useParallelValidation: z.boolean(),
  
  // Advanced settings
  customRules: z.array(ValidationRuleSchema),
  resourceTypeOverrides: z.record(z.any()).optional(),
  validateExternalReferences: z.boolean(),
  validateNonExistentReferences: z.boolean(),
  validateReferenceTypes: z.boolean()
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates validation settings using Zod schema
 */
export function validateValidationSettings(settings: unknown): ValidationSettingsValidationResult {
  const result: ValidationSettingsValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  try {
    // Validate against schema
    const parseResult = ValidationSettingsSchema.safeParse(settings);
    
    if (!parseResult.success) {
      result.isValid = false;
      result.errors = parseResult.error.errors.map(error => ({
        code: error.code,
        message: error.message,
        path: error.path.join('.'),
        suggestion: getSuggestionForError(error)
      }));
    }

    // Additional business logic validation
    if (result.isValid && parseResult.data) {
      const businessValidation = validateBusinessLogic(parseResult.data);
      result.warnings.push(...businessValidation.warnings);
      result.suggestions.push(...businessValidation.suggestions);
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push({
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      path: '',
      suggestion: 'Check the settings structure and try again'
    });
  }

  return result;
}

/**
 * Validates partial validation settings (for updates)
 */
export function validatePartialValidationSettings(settings: unknown): ValidationSettingsValidationResult {
  const result: ValidationSettingsValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  try {
    // Validate against partial schema
    const parseResult = ValidationSettingsSchema.partial().safeParse(settings);
    
    if (!parseResult.success) {
      result.isValid = false;
      result.errors = parseResult.error.errors.map(error => ({
        code: error.code,
        message: error.message,
        path: error.path.join('.'),
        suggestion: getSuggestionForError(error)
      }));
    }

    // Additional business logic validation for partial updates
    if (result.isValid && parseResult.data) {
      const businessValidation = validatePartialBusinessLogic(parseResult.data);
      result.warnings.push(...businessValidation.warnings);
      result.suggestions.push(...businessValidation.suggestions);
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push({
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      path: '',
      suggestion: 'Check the settings structure and try again'
    });
  }

  return result;
}

/**
 * Validates business logic rules
 */
function validateBusinessLogic(settings: ValidationSettings): {
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
} {
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  // Check for conflicting settings
  if (settings.strictMode && settings.defaultSeverity !== 'error') {
    warnings.push({
      code: 'CONFLICTING_SETTINGS',
      message: 'Strict mode is enabled but default severity is not "error"',
      path: 'strictMode',
      suggestion: 'Consider setting defaultSeverity to "error" when using strict mode'
    });
  }

  // Check timeout consistency
  const aspectTimeouts = [
    settings.structural.timeoutMs,
    settings.profile.timeoutMs,
    settings.terminology.timeoutMs,
    settings.reference.timeoutMs,
    settings.businessRule.timeoutMs,
    settings.metadata.timeoutMs
  ].filter((timeout): timeout is number => typeof timeout === 'number');

  if (aspectTimeouts.length > 0) {
    const maxTimeout = Math.max(...aspectTimeouts);
    if (maxTimeout > (settings.timeoutSettings.defaultTimeoutMs || 30000)) {
      warnings.push({
        code: 'TIMEOUT_INCONSISTENCY',
        message: 'Some validation aspects have timeouts longer than the default timeout',
        path: 'timeoutSettings.defaultTimeoutMs',
        suggestion: 'Consider increasing the default timeout to match the longest aspect timeout'
      });
    }
  }

  // Check server configuration
  const enabledTerminologyServers = settings.terminologyServers.filter(s => s.enabled);
  if (settings.terminology.enabled && enabledTerminologyServers.length === 0) {
    warnings.push({
      code: 'NO_TERMINOLOGY_SERVERS',
      message: 'Terminology validation is enabled but no terminology servers are configured',
      path: 'terminologyServers',
      suggestion: 'Either disable terminology validation or configure at least one terminology server'
    });
  }

  const enabledProfileServers = settings.profileResolutionServers.filter(s => s.enabled);
  if (settings.profile.enabled && enabledProfileServers.length === 0) {
    warnings.push({
      code: 'NO_PROFILE_SERVERS',
      message: 'Profile validation is enabled but no profile resolution servers are configured',
      path: 'profileResolutionServers',
      suggestion: 'Either disable profile validation or configure at least one profile resolution server'
    });
  }

  // Check cache settings
  if (settings.cacheSettings.enabled && settings.cacheSettings.ttlMs < 60000) {
    suggestions.push({
      code: 'SHORT_CACHE_TTL',
      message: 'Cache TTL is very short (less than 1 minute)',
      path: 'cacheSettings.ttlMs',
      suggestedValue: 300000 // 5 minutes
    });
  }

  // Check concurrent validations
  if (settings.maxConcurrentValidations > 50) {
    warnings.push({
      code: 'HIGH_CONCURRENCY',
      message: 'High number of concurrent validations may impact performance',
      path: 'maxConcurrentValidations',
      suggestion: 'Consider reducing to 20-30 for better performance'
    });
  }

  // Check batch processing settings
  if (settings.batchProcessingSettings.defaultBatchSize > 500) {
    warnings.push({
      code: 'LARGE_BATCH_SIZE',
      message: 'Large batch size may cause memory issues or timeouts',
      path: 'batchProcessingSettings.defaultBatchSize',
      suggestion: 'Consider reducing batch size to 200-300 for better stability'
    });
  }

  if (settings.batchProcessingSettings.useAdaptiveBatchSizing && settings.batchProcessingSettings.pauseBetweenBatches) {
    suggestions.push({
      code: 'ADAPTIVE_WITH_PAUSE',
      message: 'Using adaptive batch sizing with pause between batches may reduce efficiency',
      path: 'batchProcessingSettings.useAdaptiveBatchSizing',
      suggestedValue: false
    });
  }

  if (settings.batchProcessingSettings.retryFailedBatches && settings.batchProcessingSettings.maxRetryAttempts > 3) {
    warnings.push({
      code: 'HIGH_RETRY_COUNT',
      message: 'High retry count may significantly increase processing time',
      path: 'batchProcessingSettings.maxRetryAttempts',
      suggestion: 'Consider reducing retry attempts to 1-2 for better performance'
    });
  }

  // Check resource type filtering settings
  if (settings.resourceTypeFilterSettings.enabled) {
    const filterSettings = settings.resourceTypeFilterSettings;
    
    // Suggest common resource types if only a few are selected
    const commonResourceTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'Procedure', 'MedicationRequest', 'DiagnosticReport'];
    const selectedCommonTypes = filterSettings.resourceTypes.filter(type => commonResourceTypes.includes(type));
    
    if (filterSettings.mode === 'include' && selectedCommonTypes.length < 3 && filterSettings.resourceTypes.length < 5) {
      suggestions.push({
        code: 'suggest_common_resource_types',
        message: 'Consider including more common FHIR resource types for comprehensive validation',
        path: 'resourceTypeFilterSettings.resourceTypes',
        suggestedValue: [...filterSettings.resourceTypes, ...commonResourceTypes.filter(type => !filterSettings.resourceTypes.includes(type)).slice(0, 3)]
      });
    }
    
    // Warn about excluding too many resource types
    if (filterSettings.mode === 'exclude' && filterSettings.resourceTypes.length > 30) {
      warnings.push({
        code: 'exclude_too_many_types',
        message: 'Excluding too many resource types may significantly reduce validation coverage',
        path: 'resourceTypeFilterSettings.resourceTypes',
        suggestion: 'Consider using include mode instead to specify only the types you want to validate'
      });
    }
    
    // Suggest enabling unknown types validation for comprehensive filtering
    if (!filterSettings.validateUnknownTypes && filterSettings.mode === 'include') {
      suggestions.push({
        code: 'enable_unknown_types_validation',
        message: 'Consider enabling validation of unknown resource types for comprehensive coverage',
        path: 'resourceTypeFilterSettings.validateUnknownTypes',
        suggestedValue: true
      });
    }
    
    // Suggest enabling custom types validation if filtering is restrictive
    if (!filterSettings.validateCustomTypes && filterSettings.mode === 'include' && filterSettings.resourceTypes.length < 10) {
      suggestions.push({
        code: 'enable_custom_types_validation',
        message: 'Consider enabling validation of custom resource types for comprehensive coverage',
        path: 'resourceTypeFilterSettings.validateCustomTypes',
        suggestedValue: true
      });
    }
  }

  return { warnings, suggestions };
}

/**
 * Validates business logic for partial updates
 */
function validatePartialBusinessLogic(settings: Partial<ValidationSettings>): {
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
} {
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  // Check for conflicting settings in partial update
  if (settings.strictMode === true && settings.defaultSeverity && settings.defaultSeverity !== 'error') {
    warnings.push({
      code: 'CONFLICTING_SETTINGS',
      message: 'Strict mode is enabled but default severity is not "error"',
      path: 'strictMode',
      suggestion: 'Consider setting defaultSeverity to "error" when using strict mode'
    });
  }

  return { warnings, suggestions };
}

/**
 * Gets suggestion for validation error
 */
function getSuggestionForError(error: z.ZodIssue): string | undefined {
  switch (error.code) {
    case 'invalid_type':
      return `Expected ${error.expected}, received ${error.received}`;
    case 'too_small':
      return `Value must be at least ${error.minimum}`;
    case 'too_big':
      return `Value must be at most ${error.maximum}`;
    case 'invalid_string':
      if (error.validation === 'url') {
        return 'Please provide a valid URL';
      }
      if (error.validation === 'email') {
        return 'Please provide a valid email address';
      }
      break;
    case 'invalid_enum_value':
      return `Must be one of: ${error.options.join(', ')}`;
    default:
      return 'Please check the value and try again';
  }
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrates old settings format to new format
 */
export function migrateValidationSettings(oldSettings: any): ValidationSettings {
  // This function would handle migration from old settings format
  // For now, we'll return the old settings as-is if they're already in the new format
  const validationResult = validateValidationSettings(oldSettings);
  
  if (validationResult.isValid) {
    return oldSettings as ValidationSettings;
  }

  // If validation fails, we need to migrate
  // This is a placeholder - actual migration logic would depend on the old format
  throw new Error('Settings migration not implemented yet. Please update your settings to the new format.');
}

/**
 * Validates and normalizes settings
 */
export function normalizeValidationSettings(settings: unknown): ValidationSettings {
  const validationResult = validateValidationSettings(settings);
  
  if (!validationResult.isValid) {
    throw new Error(`Invalid settings: ${validationResult.errors.map(e => e.message).join(', ')}`);
  }

  return settings as ValidationSettings;
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  ValidationSettings,
  ValidationAspectConfig,
  ValidationRule,
  TerminologyServerConfig,
  ProfileResolutionServerConfig,
  ServerAuthConfig,
  OAuth2Config,
  CacheConfig,
  TimeoutConfig,
  BatchProcessingConfig,
  ValidationSettingsValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationSuggestion,
  ValidationSeverity,
  FHIRVersion
};
