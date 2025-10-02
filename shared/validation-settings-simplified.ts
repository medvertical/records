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
  severity: 'error' | 'warning' | 'info';
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
  
  /** Resource type filtering configuration */
  resourceTypes: {
    /** Whether resource type filtering is enabled */
    enabled: boolean;
    /** List of resource types to validate (empty means all types) */
    includedTypes: string[];
    /** List of resource types to exclude from validation */
    excludedTypes: string[];
    /** Whether to validate only the latest version of each resource */
    latestOnly: boolean;
  };

  /** Records-specific validation options */
  records: {
    /** Whether to validate external references (references to resources outside the current server) */
    validateExternalReferences: boolean;
    /** Whether to perform strict reference type checking */
    strictReferenceTypeChecking: boolean;
    /** Whether to enable strict mode (all validation rules enforced) */
    strictMode: boolean;
    /** Whether to validate reference integrity (check if referenced resources exist) */
    validateReferenceIntegrity: boolean;
    /** Whether to allow broken references in validation results */
    allowBrokenReferences: boolean;
    /** Maximum depth for reference traversal */
    maxReferenceDepth: number;
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
  },
  resourceTypes: {
    enabled: false,
    includedTypes: [],
    excludedTypes: [],
    latestOnly: false
  },
  records: {
    validateExternalReferences: true,
    strictReferenceTypeChecking: true,
    strictMode: false,
    validateReferenceIntegrity: true,
    allowBrokenReferences: false,
    maxReferenceDepth: 3
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
  resourceTypes?: Partial<ValidationSettings['resourceTypes']>;
  records?: Partial<ValidationSettings['records']>;
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
      aspects: {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'error' },
        terminology: { enabled: true, severity: 'error' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'error' },
        metadata: { enabled: true, severity: 'error' }
      },
      records: {
        validateExternalReferences: true,
        strictReferenceTypeChecking: true,
        strictMode: true,
        validateReferenceIntegrity: true,
        allowBrokenReferences: false,
        maxReferenceDepth: 5
      }
    }
  },
  {
    id: 'permissive',
    name: 'Permissive Validation',
    description: 'All validation aspects enabled with warning severity',
    isBuiltIn: true,
    settings: {
      aspects: {
        structural: { enabled: true, severity: 'warning' },
        profile: { enabled: true, severity: 'warning' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'warning' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'warning' }
      },
      records: {
        validateExternalReferences: false,
        strictReferenceTypeChecking: false,
        strictMode: false,
        validateReferenceIntegrity: false,
        allowBrokenReferences: true,
        maxReferenceDepth: 1
      }
    }
  },
  {
    id: 'minimal',
    name: 'Minimal Validation',
    description: 'Only structural and reference validation enabled',
    isBuiltIn: true,
    settings: {
      aspects: {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: false, severity: 'warning' },
        terminology: { enabled: false, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: false, severity: 'warning' },
        metadata: { enabled: false, severity: 'info' }
      },
      records: {
        validateExternalReferences: false,
        strictReferenceTypeChecking: true,
        strictMode: false,
        validateReferenceIntegrity: true,
        allowBrokenReferences: true,
        maxReferenceDepth: 2
      }
    }
  }
];

// ============================================================================
// Common FHIR Resource Types
// ============================================================================

export const COMMON_FHIR_RESOURCE_TYPES = [
  'Patient',
  'Observation',
  'Condition',
  'Medication',
  'MedicationRequest',
  'Encounter',
  'DiagnosticReport',
  'Procedure',
  'AllergyIntolerance',
  'Immunization',
  'Organization',
  'Practitioner',
  'PractitionerRole',
  'Location',
  'Device',
  'Specimen',
  'DocumentReference',
  'ImagingStudy',
  'CarePlan',
  'Goal',
  'ServiceRequest',
  'Task',
  'Questionnaire',
  'QuestionnaireResponse',
  'Appointment',
  'Schedule',
  'Slot',
  'Account',
  'ChargeItem',
  'Invoice',
  'PaymentNotice',
  'PaymentReconciliation',
  'Coverage',
  'CoverageEligibilityRequest',
  'CoverageEligibilityResponse',
  'EnrollmentRequest',
  'EnrollmentResponse',
  'Claim',
  'ClaimResponse',
  'ExplanationOfBenefit',
  'InsurancePlan',
  'MedicinalProduct',
  'MedicinalProductAuthorization',
  'MedicinalProductContraindication',
  'MedicinalProductIndication',
  'MedicinalProductIngredient',
  'MedicinalProductInteraction',
  'MedicinalProductManufactured',
  'MedicinalProductPackaged',
  'MedicinalProductPharmaceutical',
  'MedicinalProductUndesirableEffect',
  'Substance',
  'SubstanceNucleicAcid',
  'SubstancePolymer',
  'SubstanceProtein',
  'SubstanceReferenceInformation',
  'SubstanceSourceMaterial',
  'SubstanceSpecification',
  'ActivityDefinition',
  'PlanDefinition',
  'ResearchDefinition',
  'ResearchElementDefinition',
  'ResearchStudy',
  'ResearchSubject',
  'CatalogEntry',
  'EventDefinition',
  'Evidence',
  'EvidenceVariable',
  'ExampleScenario',
  'GuidanceResponse',
  'Library',
  'Measure',
  'MeasureReport',
  'MessageDefinition',
  'MessageHeader',
  'NamingSystem',
  'OperationDefinition',
  'OperationOutcome',
  'Parameters',
  'SearchParameter',
  'StructureDefinition',
  'StructureMap',
  'TerminologyCapabilities',
  'TestScript',
  'ValueSet',
  'ConceptMap',
  'CodeSystem',
  'CompartmentDefinition',
  'GraphDefinition',
  'ImplementationGuide',
  'CapabilityStatement',
  'AuditEvent',
  'Provenance',
  'Consent',
  'Contract',
  'Composition',
  'List',
  'Bundle',
  'Binary',
  'DomainResource',
  'Resource'
] as const;

export type CommonFhirResourceType = typeof COMMON_FHIR_RESOURCE_TYPES[number];

// ============================================================================
// Type Exports
// ============================================================================

export type ValidationAspect = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
export type ValidationSeverity = 'error' | 'warning' | 'info';
