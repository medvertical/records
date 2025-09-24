/**
 * Simplified Validation Settings Schema
 * 
 * This module defines a simplified, minimal schema for validation settings
 * without versioning, audit trails, or complex history management.
 */

// ============================================================================
// Core Validation Aspect Configuration
// ============================================================================

export interface ValidationAspectConfig {
  /** Whether this validation aspect is enabled */
  enabled: boolean;
  
  /** Severity level for issues found by this aspect */
  severity: 'error' | 'warning' | 'information';
}

// ============================================================================
// Server Configuration
// ============================================================================

export interface ServerConfig {
  /** FHIR server URL */
  url: string;
  
  /** Authentication configuration */
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'oauth2';
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  };
  
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  
  /** Maximum number of concurrent requests */
  maxConcurrentRequests?: number;
}

// ============================================================================
// Simplified Validation Settings
// ============================================================================

export interface ValidationSettings {
  /** Validation aspects configuration */
  aspects: {
    structural: ValidationAspectConfig;
    profile: ValidationAspectConfig;
    terminology: ValidationAspectConfig;
    reference: ValidationAspectConfig;
    businessRule: ValidationAspectConfig;
    metadata: ValidationAspectConfig;
  };
  
  /** FHIR server configuration */
  server: {
    url: string;
    timeout: number;
    retries: number;
  };
  
  /** Performance configuration */
  performance: {
    maxConcurrent: number;
    batchSize: number;
  };
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  aspects: {
    structural: {
      enabled: true,
      severity: 'error'
    },
    profile: {
      enabled: true,
      severity: 'warning'
    },
    terminology: {
      enabled: true,
      severity: 'warning'
    },
    reference: {
      enabled: true,
      severity: 'error'
    },
    businessRule: {
      enabled: true,
      severity: 'error'
    },
    metadata: {
      enabled: true,
      severity: 'error'
    }
  },
  server: {
    url: 'https://hapi.fhir.org/baseR4',
    timeout: 30000,
    retries: 3
  },
  performance: {
    maxConcurrent: 8,
    batchSize: 100
  }
};

// ============================================================================
// Update Interface
// ============================================================================

export interface ValidationSettingsUpdate {
  /** Partial settings to update */
  aspects?: Partial<ValidationSettings['aspects']>;
  server?: Partial<ValidationSettings['server']>;
  performance?: Partial<ValidationSettings['performance']>;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationSettingsValidationResult {
  /** Whether the settings are valid */
  isValid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Validation warnings */
  warnings: string[];
}

// ============================================================================
// Built-in Presets
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
}

export const BUILT_IN_PRESETS: ValidationSettingsPreset[] = [
  {
    id: 'strict',
    name: 'Strict Validation',
    description: 'All validation aspects enabled with error severity',
    isBuiltIn: true,
    settings: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'error' },
      terminology: { enabled: true, severity: 'error' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'error' },
      metadata: { enabled: true, severity: 'error' }
    }
  },
  {
    id: 'permissive',
    name: 'Permissive Validation',
    description: 'All validation aspects enabled with warning severity',
    isBuiltIn: true,
    settings: {
      structural: { enabled: true, severity: 'warning' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'warning' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'warning' }
    }
  },
  {
    id: 'minimal',
    name: 'Minimal Validation',
    description: 'Only structural and reference validation enabled',
    isBuiltIn: true,
    settings: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: false, severity: 'warning' },
      terminology: { enabled: false, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: false, severity: 'warning' },
      metadata: { enabled: false, severity: 'information' }
    }
  }
];

// ============================================================================
// Type Exports
// ============================================================================

export type ValidationAspect = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
export type ValidationSeverity = 'error' | 'warning' | 'information';
