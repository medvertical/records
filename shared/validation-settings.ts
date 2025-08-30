/**
 * Validation Settings Schema - Rock Solid Configuration
 * 
 * This module defines the centralized, type-safe schema for all validation settings
 * used throughout the FHIR Records Management Platform.
 */

// ============================================================================
// Core Validation Aspect Configuration
// ============================================================================

export interface ValidationAspectConfig {
  /** Whether this validation aspect is enabled */
  enabled: boolean;
  
  /** Severity level for issues found by this aspect */
  severity: 'error' | 'warning' | 'information';
  
  /** Custom rules or overrides for this aspect */
  customRules?: ValidationRule[];
  
  /** Timeout in milliseconds for this validation aspect */
  timeoutMs?: number;
  
  /** Whether to fail fast on first error for this aspect */
  failFast?: boolean;
}

export interface ValidationRule {
  /** Unique identifier for the rule */
  id: string;
  
  /** Human-readable name of the rule */
  name: string;
  
  /** Rule description */
  description?: string;
  
  /** Whether this rule is enabled */
  enabled: boolean;
  
  /** Severity override for this specific rule */
  severity?: 'error' | 'warning' | 'information';
  
  /** Rule-specific configuration */
  config?: Record<string, any>;
}

// ============================================================================
// Server Configuration
// ============================================================================

export interface TerminologyServerConfig {
  /** Unique identifier for the server */
  id: string;
  
  /** Display name for the server */
  name: string;
  
  /** Server URL */
  url: string;
  
  /** Whether this server is enabled */
  enabled: boolean;
  
  /** Priority order (lower numbers = higher priority) */
  priority: number;
  
  /** Authentication configuration */
  auth?: ServerAuthConfig;
  
  /** Timeout in milliseconds */
  timeoutMs?: number;
  
  /** Whether to use this server for validation */
  useForValidation: boolean;
  
  /** Whether to use this server for expansion */
  useForExpansion: boolean;
}

export interface ProfileResolutionServerConfig {
  /** Unique identifier for the server */
  id: string;
  
  /** Display name for the server */
  name: string;
  
  /** Server URL */
  url: string;
  
  /** Whether this server is enabled */
  enabled: boolean;
  
  /** Priority order (lower numbers = higher priority) */
  priority: number;
  
  /** Authentication configuration */
  auth?: ServerAuthConfig;
  
  /** Timeout in milliseconds */
  timeoutMs?: number;
  
  /** Whether to use this server for profile resolution */
  useForProfileResolution: boolean;
  
  /** Whether to use this server for structure definition resolution */
  useForStructureDefinitionResolution: boolean;
}

export interface ServerAuthConfig {
  /** Authentication type */
  type: 'none' | 'basic' | 'bearer' | 'oauth2';
  
  /** Username for basic auth */
  username?: string;
  
  /** Password for basic auth */
  password?: string;
  
  /** Bearer token */
  token?: string;
  
  /** OAuth2 configuration */
  oauth2?: OAuth2Config;
}

export interface OAuth2Config {
  /** Client ID */
  clientId: string;
  
  /** Client secret */
  clientSecret: string;
  
  /** Token URL */
  tokenUrl: string;
  
  /** Scope */
  scope?: string;
}

// ============================================================================
// Performance Configuration
// ============================================================================

export interface CacheConfig {
  /** Whether caching is enabled */
  enabled: boolean;
  
  /** Cache TTL in milliseconds */
  ttlMs: number;
  
  /** Maximum cache size in MB */
  maxSizeMB: number;
  
  /** Whether to cache validation results */
  cacheValidationResults: boolean;
  
  /** Whether to cache terminology expansions */
  cacheTerminologyExpansions: boolean;
  
  /** Whether to cache profile resolutions */
  cacheProfileResolutions: boolean;
}

export interface TimeoutConfig {
  /** Default timeout in milliseconds */
  defaultTimeoutMs: number;
  
  /** Timeout for structural validation */
  structuralValidationTimeoutMs: number;
  
  /** Timeout for profile validation */
  profileValidationTimeoutMs: number;
  
  /** Timeout for terminology validation */
  terminologyValidationTimeoutMs: number;
  
  /** Timeout for reference validation */
  referenceValidationTimeoutMs: number;
  
  /** Timeout for business rule validation */
  businessRuleValidationTimeoutMs: number;
  
  /** Timeout for metadata validation */
  metadataValidationTimeoutMs: number;
}

// ============================================================================
// Main Validation Settings Interface
// ============================================================================

export interface ValidationSettings {
  /** Unique identifier for this settings configuration */
  id?: string;
  
  /** Version number for this settings configuration */
  version: number;
  
  /** Whether this configuration is active */
  isActive: boolean;
  
  /** Timestamp when this configuration was created */
  createdAt?: Date;
  
  /** Timestamp when this configuration was last updated */
  updatedAt?: Date;
  
  /** User who created this configuration */
  createdBy?: string;
  
  /** User who last updated this configuration */
  updatedBy?: string;
  
  // ========================================================================
  // Core Validation Aspects (The 6 Pillars)
  // ========================================================================
  
  /** Structural validation configuration */
  structural: ValidationAspectConfig;
  
  /** Profile validation configuration */
  profile: ValidationAspectConfig;
  
  /** Terminology validation configuration */
  terminology: ValidationAspectConfig;
  
  /** Reference validation configuration */
  reference: ValidationAspectConfig;
  
  /** Business rule validation configuration */
  businessRule: ValidationAspectConfig;
  
  /** Metadata validation configuration */
  metadata: ValidationAspectConfig;
  
  // ========================================================================
  // Global Settings
  // ========================================================================
  
  /** Whether to run in strict mode (fail on any validation error) */
  strictMode: boolean;
  
  /** Default severity for validation issues */
  defaultSeverity: 'error' | 'warning' | 'information';
  
  /** Whether to include debug information in validation results */
  includeDebugInfo: boolean;
  
  /** Whether to validate against base FHIR specification */
  validateAgainstBaseSpec: boolean;
  
  /** FHIR version to validate against */
  fhirVersion: 'R4' | 'R4B' | 'R5';
  
  // ========================================================================
  // Server Configurations
  // ========================================================================
  
  /** Terminology servers configuration */
  terminologyServers: TerminologyServerConfig[];
  
  /** Profile resolution servers configuration */
  profileResolutionServers: ProfileResolutionServerConfig[];
  
  // ========================================================================
  // Performance Settings
  // ========================================================================
  
  /** Cache configuration */
  cacheSettings: CacheConfig;
  
  /** Timeout configuration */
  timeoutSettings: TimeoutConfig;
  
  /** Maximum number of concurrent validations */
  maxConcurrentValidations: number;
  
  /** Whether to use parallel validation where possible */
  useParallelValidation: boolean;
  
  // ========================================================================
  // Advanced Settings
  // ========================================================================
  
  /** Custom validation rules */
  customRules: ValidationRule[];
  
  /** Resource type specific overrides */
  resourceTypeOverrides?: Record<string, Partial<ValidationSettings>>;
  
  /** Whether to validate references to external resources */
  validateExternalReferences: boolean;
  
  /** Whether to validate references to non-existent resources */
  validateNonExistentReferences: boolean;
  
  /** Whether to validate references to resources of wrong type */
  validateReferenceTypes: boolean;
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  version: 1,
  isActive: true,
  
  // Core validation aspects - all enabled by default
  structural: {
    enabled: true,
    severity: 'error',
    timeoutMs: 30000,
    failFast: false
  },
  
  profile: {
    enabled: true,
    severity: 'warning',
    timeoutMs: 45000,
    failFast: false
  },
  
  terminology: {
    enabled: true,
    severity: 'warning',
    timeoutMs: 60000,
    failFast: false
  },
  
  reference: {
    enabled: true,
    severity: 'error',
    timeoutMs: 30000,
    failFast: false
  },
  
  businessRule: {
    enabled: true,
    severity: 'warning',
    timeoutMs: 30000,
    failFast: false
  },
  
  metadata: {
    enabled: true,
    severity: 'information',
    timeoutMs: 15000,
    failFast: false
  },
  
  // Global settings
  strictMode: false,
  defaultSeverity: 'warning',
  includeDebugInfo: false,
  validateAgainstBaseSpec: true,
  fhirVersion: 'R4',
  
  // Server configurations - with default terminology servers
  terminologyServers: [
    {
      id: 'csiro-ontoserver',
      name: 'CSIRO OntoServer',
      url: 'https://r4.ontoserver.csiro.au/fhir',
      enabled: true,
      priority: 1,
      useForValidation: true,
      useForExpansion: true,
      timeoutMs: 60000
    },
    {
      id: 'hl7-fhir-terminology',
      name: 'HL7 FHIR Terminology Server',
      url: 'https://tx.fhir.org/r4',
      enabled: true,
      priority: 2,
      useForValidation: true,
      useForExpansion: true,
      timeoutMs: 60000
    },
    {
      id: 'snomed-international',
      name: 'SNOMED International',
      url: 'https://snowstorm.ihtsdotools.org/fhir',
      enabled: true,
      priority: 3,
      useForValidation: true,
      useForExpansion: true,
      timeoutMs: 60000
    }
  ],
  profileResolutionServers: [
    {
      id: 'simplifier-net',
      name: 'Simplifier.net',
      url: 'https://packages.simplifier.net',
      enabled: true,
      priority: 1,
      useForProfileResolution: true,
      useForStructureDefinitionResolution: true,
      timeoutMs: 60000
    },
    {
      id: 'fhir-ci-build',
      name: 'FHIR CI Build',
      url: 'https://build.fhir.org',
      enabled: true,
      priority: 2,
      useForProfileResolution: true,
      useForStructureDefinitionResolution: true,
      timeoutMs: 60000
    },
    {
      id: 'fhir-package-registry',
      name: 'FHIR Package Registry',
      url: 'https://registry.fhir.org',
      enabled: true,
      priority: 3,
      useForProfileResolution: true,
      useForStructureDefinitionResolution: true,
      timeoutMs: 60000
    }
  ],
  
  // Performance settings
  cacheSettings: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
    maxSizeMB: 100,
    cacheValidationResults: true,
    cacheTerminologyExpansions: true,
    cacheProfileResolutions: true
  },
  
  timeoutSettings: {
    defaultTimeoutMs: 30000,
    structuralValidationTimeoutMs: 30000,
    profileValidationTimeoutMs: 45000,
    terminologyValidationTimeoutMs: 60000,
    referenceValidationTimeoutMs: 30000,
    businessRuleValidationTimeoutMs: 30000,
    metadataValidationTimeoutMs: 15000
  },
  
  maxConcurrentValidations: 10,
  useParallelValidation: true,
  
  // Advanced settings
  customRules: [],
  validateExternalReferences: false,
  validateNonExistentReferences: true,
  validateReferenceTypes: true
};

// ============================================================================
// Settings Presets
// ============================================================================

export interface ValidationSettingsPreset {
  /** Unique identifier for the preset */
  id: string;
  
  /** Display name for the preset */
  name: string;
  
  /** Description of the preset */
  description: string;
  
  /** The settings configuration for this preset */
  settings: Partial<ValidationSettings>;
  
  /** Whether this is a built-in preset */
  isBuiltIn: boolean;
  
  /** Tags for categorizing presets */
  tags: string[];
}

export const BUILT_IN_PRESETS: ValidationSettingsPreset[] = [
  {
    id: 'strict',
    name: 'Strict Validation',
    description: 'Maximum validation with all aspects enabled and strict error handling',
    isBuiltIn: true,
    tags: ['strict', 'compliance', 'production'],
    settings: {
      strictMode: true,
      defaultSeverity: 'error',
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'error' },
      terminology: { enabled: true, severity: 'error' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'error' },
      metadata: { enabled: true, severity: 'error' },
      validateExternalReferences: true,
      validateNonExistentReferences: true,
      validateReferenceTypes: true
    }
  },
  
  {
    id: 'permissive',
    name: 'Permissive Validation',
    description: 'Minimal validation for development and testing',
    isBuiltIn: true,
    tags: ['permissive', 'development', 'testing'],
    settings: {
      strictMode: false,
      defaultSeverity: 'information',
      structural: { enabled: true, severity: 'warning' },
      profile: { enabled: false, severity: 'information' },
      terminology: { enabled: false, severity: 'information' },
      reference: { enabled: true, severity: 'warning' },
      businessRule: { enabled: false, severity: 'information' },
      metadata: { enabled: false, severity: 'information' },
      validateExternalReferences: false,
      validateNonExistentReferences: false,
      validateReferenceTypes: false
    }
  },
  
  {
    id: 'balanced',
    name: 'Balanced Validation',
    description: 'Balanced validation suitable for most production use cases',
    isBuiltIn: true,
    tags: ['balanced', 'production', 'recommended'],
    settings: {
      strictMode: false,
      defaultSeverity: 'warning',
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'information' },
      validateExternalReferences: false,
      validateNonExistentReferences: true,
      validateReferenceTypes: true
    }
  }
];

// ============================================================================
// Utility Types
// ============================================================================

export type ValidationAspect = keyof Pick<ValidationSettings, 
  'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'
>;

export type ValidationSeverity = 'error' | 'warning' | 'information';

export type FHIRVersion = 'R4' | 'R4B' | 'R5';

// ============================================================================
// Settings Update Types
// ============================================================================

export interface ValidationSettingsUpdate {
  /** Partial settings to update */
  settings: Partial<ValidationSettings>;
  
  /** Whether to validate the update before applying */
  validate?: boolean;
  
  /** Whether to create a new version */
  createNewVersion?: boolean;
  
  /** User making the update */
  updatedBy?: string;
}

export interface ValidationSettingsValidationResult {
  /** Whether the settings are valid */
  isValid: boolean;
  
  /** Validation errors */
  errors: ValidationError[];
  
  /** Validation warnings */
  warnings: ValidationWarning[];
  
  /** Suggested fixes */
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Path to the invalid field */
  path: string;
  
  /** Suggested fix */
  suggestion?: string;
}

export interface ValidationWarning {
  /** Warning code */
  code: string;
  
  /** Warning message */
  message: string;
  
  /** Path to the field */
  path: string;
  
  /** Suggested improvement */
  suggestion?: string;
}

export interface ValidationSuggestion {
  /** Suggestion code */
  code: string;
  
  /** Suggestion message */
  message: string;
  
  /** Path to the field */
  path: string;
  
  /** Suggested value */
  suggestedValue?: any;
}
