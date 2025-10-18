/**
 * Simplified Validation Settings Schema
 * 
 * This module defines a simplified, minimal schema for validation settings
 * focusing only on essential functionality: 6 validation aspects, performance settings,
 * and resource type filtering. No presets, audit trails, or complex features.
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
// Terminology Server Configuration
// ============================================================================

export type ServerStatus = 
  | 'healthy'      // Working normally
  | 'degraded'     // Slow responses
  | 'unhealthy'    // Failing requests
  | 'circuit-open' // Circuit breaker activated
  | 'unknown';     // Not yet tested

export interface TerminologyServer {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Base FHIR URL */
  url: string;
  
  /** Active/inactive toggle */
  enabled: boolean;
  
  /** Supported FHIR versions (auto-detected) */
  fhirVersions: ('R4' | 'R5' | 'R6')[];
  
  /** Health status */
  status: ServerStatus;
  
  /** Circuit breaker failure count */
  failureCount: number;
  
  /** Last failure timestamp */
  lastFailureTime: number | null;
  
  /** Circuit breaker state */
  circuitOpen: boolean;
  
  /** Average response time in ms */
  responseTimeAvg: number;
  
  /** Test score (0-100) from terminology-server-test */
  testScore?: number;
}

export interface CircuitBreakerConfig {
  /** Open circuit after N failures */
  failureThreshold: number;
  
  /** Reset circuit after N milliseconds */
  resetTimeout: number;
  
  /** Try one request after N milliseconds */
  halfOpenTimeout: number;
}

// ============================================================================
// Simplified Validation Settings
// ============================================================================

export interface ValidationSettings {
  /** 6 Validation Aspects (Structural, Profile, Terminology, Reference, Business Rules, Metadata) */
  aspects: {
    structural: ValidationAspectConfig;
    profile: ValidationAspectConfig;
    terminology: ValidationAspectConfig;
    reference: ValidationAspectConfig;
    businessRule: ValidationAspectConfig; // Singular to match database schema
    metadata: ValidationAspectConfig;
  };
  
  /** Performance Settings (only 2 essential fields) */
  performance: {
    maxConcurrent: number; // 1-20, default: 4
    batchSize: number;     // 10-100, default: 50
  };
  
  /** Resource Type Filtering (essential for performance) */
  resourceTypes: {
    enabled: boolean;           // Whether filtering is active
    includedTypes: string[];    // List of resource types to validate (empty = all)
    excludedTypes: string[];    // List of resource types to exclude
  };

  /** Multiple Terminology Servers (ordered by priority) */
  terminologyServers?: TerminologyServer[];

  /** Circuit Breaker Configuration */
  circuitBreaker?: CircuitBreakerConfig;

  /** Validation Mode (Online/Offline) for terminology validation */
  mode?: 'online' | 'offline'; // Default: 'online'

  /** Task 8.2: Use FHIR server's $validate operation when available */
  useFhirValidateOperation?: boolean; // Default: false
  
  /** Terminology Fallback Configuration (DEPRECATED - use terminologyServers instead) */
  terminologyFallback?: {
    local?: string;  // Local terminology server URL (e.g., http://localhost:8081/fhir)
    remote?: string; // Remote terminology server URL (e.g., https://tx.fhir.org)
  };
  
  /** Offline Mode Configuration */
  offlineConfig?: {
    ontoserverUrl?: string;     // Local Ontoserver URL
    profileCachePath?: string;  // Path to cached profile packages
  };

  /** Task 4.13: Profile Package Sources Configuration */
  profileSources?: 'local' | 'simplifier' | 'both'; // Default: 'both'

  /** Auto-Revalidation Settings */
  autoRevalidateAfterEdit?: boolean; // Automatically revalidate after resource edit (default: false)

  /** Task 6.6 & 6.7: Recursive Reference Validation Configuration */
  recursiveReferenceValidation?: {
    enabled: boolean;              // Enable recursive validation (default: false)
    maxDepth: number;              // Maximum depth (1-3, default: 1)
    validateExternal: boolean;     // Validate external references (default: false)
    validateContained: boolean;    // Validate contained references recursively (default: true)
    validateBundleEntries: boolean; // Validate Bundle entries recursively (default: true)
    excludeResourceTypes?: string[]; // Resource types to exclude
    maxReferencesPerResource?: number; // Max references to follow per resource (default: 10)
    timeoutMs?: number;            // Timeout in milliseconds (default: 30000)
  };

  /** Task 7.12: Multi-Layer Cache Configuration */
  cacheConfig?: {
    /** Cache layers configuration */
    layers?: {
      L1?: 'enabled' | 'disabled';  // In-memory cache
      L2?: 'enabled' | 'disabled';  // Database cache
      L3?: 'enabled' | 'disabled';  // Filesystem cache
    };
    /** L1 (Memory) cache size limit in MB (default: 100) */
    l1MaxSizeMb?: number;
    /** L2 (Database) cache size limit in GB (default: 1) */
    l2MaxSizeGb?: number;
    /** L3 (Filesystem) cache size limit in GB (default: 5) */
    l3MaxSizeGb?: number;
    /** Time-to-live (TTL) configuration in milliseconds */
    ttl?: {
      validation?: number;    // Validation results (default: 5 min)
      profile?: number;       // FHIR profiles (default: 30 min)
      terminology?: number;   // Terminology codes (default: 1 hour)
      igPackage?: number;     // IG packages (default: 24 hours)
      default?: number;       // Default TTL (default: 15 min)
    };
    /** Enable cache warming on startup (default: false) */
    enableWarmup?: boolean;
    /** Custom profiles to warm (default: common FHIR core profiles) */
    warmupProfiles?: string[];
    /** Custom terminology systems to warm (default: LOINC, SNOMED, ICD-10) */
    warmupTerminologySystems?: string[];
  };
}

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
// FHIR Version-Aware Resource Type Constants
// ============================================================================

// Complete R4 Resource Types (143 total in R4)
export const R4_ALL_RESOURCE_TYPES = [
  'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment',
  'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
  'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam',
  'CatalogEntry', 'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse',
  'ClinicalImpression', 'CodeSystem', 'Communication', 'CommunicationRequest',
  'CompartmentDefinition', 'Composition', 'ConceptMap', 'Condition', 'Consent',
  'Contract', 'Coverage', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse',
  'DetectedIssue', 'Device', 'DeviceDefinition', 'DeviceMetric', 'DeviceRequest',
  'DeviceUseStatement', 'DiagnosticReport', 'DocumentManifest', 'DocumentReference',
  'EffectEvidenceSynthesis', 'Encounter', 'Endpoint', 'EnrollmentRequest',
  'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence',
  'EvidenceVariable', 'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory',
  'Flag', 'Goal', 'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService',
  'ImagingStudy', 'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation',
  'ImplementationGuide', 'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List',
  'Location', 'Measure', 'MeasureReport', 'Media', 'Medication', 'MedicationAdministration',
  'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
  'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication',
  'MedicinalProductIndication', 'MedicinalProductIngredient', 'MedicinalProductInteraction',
  'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical',
  'MedicinalProductUndesirableEffect', 'MessageDefinition', 'MessageHeader',
  'MolecularSequence', 'NamingSystem', 'NutritionOrder', 'Observation', 'ObservationDefinition',
  'OperationDefinition', 'OperationOutcome', 'Organization', 'OrganizationAffiliation',
  'Parameters', 'Patient', 'PaymentNotice', 'PaymentReconciliation', 'Person',
  'PlanDefinition', 'Practitioner', 'PractitionerRole', 'Procedure', 'Provenance',
  'Questionnaire', 'QuestionnaireResponse', 'RelatedPerson', 'RequestGroup',
  'ResearchDefinition', 'ResearchElementDefinition', 'ResearchStudy', 'ResearchSubject',
  'RiskAssessment', 'RiskEvidenceSynthesis', 'Schedule', 'SearchParameter',
  'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition', 'StructureDefinition',
  'StructureMap', 'Subscription', 'Substance', 'SubstanceNucleicAcid', 'SubstancePolymer',
  'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
  'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task', 'TerminologyCapabilities',
  'TestReport', 'TestScript', 'ValueSet', 'VerificationResult', 'VisionPrescription'
] as const;

// Complete R5 Resource Types (154 total in R5)
export const R5_ALL_RESOURCE_TYPES = [
  ...R4_ALL_RESOURCE_TYPES,
  // R5-specific new resource types
  'Citation', 'EvidenceReport', 'InventoryReport', 'RegulatedAuthorization',
  'SubstanceDefinition', 'Transport'
] as const;

// R4 Default included resource types (most important for validation)
export const R4_DEFAULT_INCLUDED_RESOURCE_TYPES = [
  // Core Clinical Resources (R4)
  'Patient', 'Observation', 'Condition', 'Encounter', 'Procedure',
  'Medication', 'MedicationRequest', 'DiagnosticReport', 'AllergyIntolerance',
  'Immunization', 'CarePlan', 'Goal', 'ServiceRequest',
  
  // Administrative Resources (R4)
  'Organization', 'Practitioner', 'PractitionerRole', 'Location',
  'DocumentReference', 'Composition', 'List', 'Appointment', 'Schedule', 'Slot'
];

// R5 Default included resource types (most important for validation)
export const R5_DEFAULT_INCLUDED_RESOURCE_TYPES = [
  // Core Clinical Resources (R5 - includes new types)
  'Patient', 'Observation', 'Condition', 'Encounter', 'Procedure',
  'Medication', 'MedicationRequest', 'DiagnosticReport', 'AllergyIntolerance',
  'Immunization', 'CarePlan', 'Goal', 'ServiceRequest',
  
  // Administrative Resources (R5)
  'Organization', 'Practitioner', 'PractitionerRole', 'Location',
  'DocumentReference', 'Composition', 'List', 'Appointment', 'Schedule', 'Slot',
  
  // R5-specific new resource types
  'Evidence', 'EvidenceReport', 'EvidenceVariable', 'Citation'
];

// ============================================================================
// Default Settings Constants
// ============================================================================

// Common validation configurations for quick setup
export const VALIDATION_CONFIGS = {
  // Strict validation - all aspects enabled with error severity
  STRICT: {
    aspects: {
      structural: { enabled: true, severity: 'error' as const },
      profile: { enabled: true, severity: 'error' as const },
      terminology: { enabled: true, severity: 'error' as const },
      reference: { enabled: true, severity: 'error' as const },
      businessRule: { enabled: true, severity: 'error' as const },
      metadata: { enabled: true, severity: 'error' as const }
    },
    performance: {
      maxConcurrent: 3,
      batchSize: 25
    }
  },
  
  // Balanced validation - mix of error and warning severity
  BALANCED: {
    aspects: {
      structural: { enabled: true, severity: 'error' as const },
      profile: { enabled: true, severity: 'warning' as const },
      terminology: { enabled: true, severity: 'warning' as const },
      reference: { enabled: true, severity: 'error' as const },
      businessRule: { enabled: true, severity: 'warning' as const },
      metadata: { enabled: true, severity: 'error' as const }
    },
    performance: {
      maxConcurrent: 4,
      batchSize: 50
    }
  },
  
  // Fast validation - only critical aspects with higher concurrency
  FAST: {
    aspects: {
      structural: { enabled: true, severity: 'error' as const },
      profile: { enabled: false, severity: 'warning' as const },
      terminology: { enabled: false, severity: 'warning' as const },
      reference: { enabled: true, severity: 'error' as const },
      businessRule: { enabled: false, severity: 'warning' as const },
      metadata: { enabled: false, severity: 'info' as const }
    },
    performance: {
      maxConcurrent: 10,
      batchSize: 100
    }
  }
} as const;

// ============================================================================
// Default Terminology Servers (Based on Test Results)
// ============================================================================

/**
 * Default terminology servers based on TERMINOLOGY_SERVER_TEST_RESULTS.md
 * 
 * Priority order (sequential fallback):
 * 1. tx.fhir.org/r5 - Primary (98/100 score, fastest, most complete)
 * 2. tx.fhir.org/r4 - Secondary (98/100 score, R4 support)
 * 3. CSIRO R4 - Fallback (96/100 score, offline-capable)
 * 
 * NOTE: CSIRO R5 NOT included - test results show it's broken (61/100)
 * - ValueSet expansion fails (404 errors)
 * - Code validation fails (404 errors)
 * - Missing FHIR core ValueSets
 */
export const DEFAULT_TERMINOLOGY_SERVERS: TerminologyServer[] = [
  {
    id: 'tx-fhir-org-r5',
    name: 'HL7 TX Server (R5)',
    url: 'https://tx.fhir.org/r5',
    enabled: true,
    fhirVersions: ['R5', 'R6'],
    status: 'unknown',
    failureCount: 0,
    lastFailureTime: null,
    circuitOpen: false,
    responseTimeAvg: 0,
    testScore: 98 // Excellent - fastest and most complete
  },
  {
    id: 'tx-fhir-org-r4',
    name: 'HL7 TX Server (R4)',
    url: 'https://tx.fhir.org/r4',
    enabled: true,
    fhirVersions: ['R4'],
    status: 'unknown',
    failureCount: 0,
    lastFailureTime: null,
    circuitOpen: false,
    responseTimeAvg: 0,
    testScore: 98 // Excellent performance
  },
  {
    id: 'csiro-ontoserver-r4',
    name: 'CSIRO Ontoserver (R4)',
    url: 'https://r4.ontoserver.csiro.au/fhir',
    enabled: true,
    fhirVersions: ['R4'],
    status: 'unknown',
    failureCount: 0,
    lastFailureTime: null,
    circuitOpen: false,
    responseTimeAvg: 0,
    testScore: 96 // Good for R4 fallback
  }
];

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,        // Open circuit after 5 consecutive failures
  resetTimeout: 1800000,      // 30 minutes before full reset
  halfOpenTimeout: 300000     // 5 minutes before trying one request
};

/**
 * Default Cache Configuration
 * Task 7.12: Multi-layer cache settings
 */
export const DEFAULT_CACHE_CONFIG = {
  layers: {
    L1: 'enabled' as const,
    L2: 'disabled' as const,  // Disabled by default (requires database)
    L3: 'disabled' as const   // Disabled by default (requires filesystem)
  },
  l1MaxSizeMb: 100,  // 100 MB for in-memory cache
  l2MaxSizeGb: 1,    // 1 GB for database cache
  l3MaxSizeGb: 5,    // 5 GB for filesystem cache
  ttl: {
    validation: 5 * 60 * 1000,      // 5 minutes
    profile: 30 * 60 * 1000,        // 30 minutes
    terminology: 60 * 60 * 1000,    // 1 hour
    igPackage: 24 * 60 * 60 * 1000, // 24 hours
    default: 15 * 60 * 1000         // 15 minutes
  },
  enableWarmup: false,  // Disabled by default
  warmupProfiles: [],   // Empty = use common FHIR core profiles
  warmupTerminologySystems: []  // Empty = use common terminology systems
};

export const DEFAULT_VALIDATION_SETTINGS_R4: ValidationSettings = {
  aspects: {
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'error' },
    metadata: { enabled: true, severity: 'error' }
  },
  performance: {
    maxConcurrent: 5,
    batchSize: 50
  },
  resourceTypes: {
    enabled: true,
    includedTypes: R4_DEFAULT_INCLUDED_RESOURCE_TYPES,
    excludedTypes: []
  },
  terminologyServers: DEFAULT_TERMINOLOGY_SERVERS,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  mode: 'online',
  terminologyFallback: {
    local: 'n/a',  // No local terminology server
    remote: 'https://tx.fhir.org/r4'  // DEPRECATED - use terminologyServers instead
  },
  offlineConfig: {
    ontoserverUrl: 'https://r4.ontoserver.csiro.au/fhir',  // Public Ontoserver for fallback
    profileCachePath: '/opt/fhir/igs/'
  },
  profileSources: 'simplifier', // Fetch profiles from Simplifier, resolve locally
  autoRevalidateAfterEdit: false,
  cacheConfig: DEFAULT_CACHE_CONFIG
};

export const DEFAULT_VALIDATION_SETTINGS_R5: ValidationSettings = {
  aspects: {
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'error' },
    metadata: { enabled: true, severity: 'error' }
  },
  performance: {
    maxConcurrent: 5,
    batchSize: 50
  },
  resourceTypes: {
    enabled: true,
    includedTypes: R5_DEFAULT_INCLUDED_RESOURCE_TYPES,
    excludedTypes: []
  },
  terminologyServers: DEFAULT_TERMINOLOGY_SERVERS,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  mode: 'online',
  terminologyFallback: {
    local: 'n/a',  // No local terminology server
    remote: 'https://tx.fhir.org/r5'  // DEPRECATED - use terminologyServers instead
  },
  offlineConfig: {
    ontoserverUrl: 'https://r4.ontoserver.csiro.au/fhir',  // Public Ontoserver for fallback
    profileCachePath: '/opt/fhir/igs/'
  },
  profileSources: 'simplifier', // Fetch profiles from Simplifier, resolve locally
  autoRevalidateAfterEdit: false,
  cacheConfig: DEFAULT_CACHE_CONFIG
};

// ============================================================================
// Update Interface
// ============================================================================

export interface ValidationSettingsUpdate {
  /** Partial settings to update */
  aspects?: Partial<ValidationSettings['aspects']>;
  performance?: Partial<ValidationSettings['performance']>;
  resourceTypes?: Partial<ValidationSettings['resourceTypes']>;
  terminologyServers?: TerminologyServer[];
  circuitBreaker?: CircuitBreakerConfig;
  mode?: 'online' | 'offline';
  useFhirValidateOperation?: boolean;
  terminologyFallback?: {
    local?: string;
    remote?: string;
  };
  offlineConfig?: {
    ontoserverUrl?: string;
    profileCachePath?: string;
  };
  profileSources?: 'local' | 'simplifier' | 'both';
  autoRevalidateAfterEdit?: boolean;
  recursiveReferenceValidation?: Partial<ValidationSettings['recursiveReferenceValidation']>;
  cacheConfig?: Partial<ValidationSettings['cacheConfig']>;
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
// FHIR Version Detection
// ============================================================================

export type FHIRVersion = 'R4' | 'R5';

export interface FHIRResourceTypeConfig {
  version: FHIRVersion;
  includedTypes: string[];
  excludedTypes: string[];
  totalCount: number;
}

// ============================================================================
// Performance Settings Constants & Validation
// ============================================================================

export const PERFORMANCE_LIMITS = {
  maxConcurrent: {
    min: 1,
    max: 20,
    default: 5
  },
  batchSize: {
    min: 10,
    max: 100,
    default: 50
  }
} as const;

/**
 * Validate performance settings
 */
export function validatePerformanceSettings(performance: ValidationSettings['performance']): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate maxConcurrent
  if (performance.maxConcurrent < PERFORMANCE_LIMITS.maxConcurrent.min) {
    errors.push(`maxConcurrent must be at least ${PERFORMANCE_LIMITS.maxConcurrent.min}`);
  }
  if (performance.maxConcurrent > PERFORMANCE_LIMITS.maxConcurrent.max) {
    errors.push(`maxConcurrent must not exceed ${PERFORMANCE_LIMITS.maxConcurrent.max}`);
  }

  // Validate batchSize
  if (performance.batchSize < PERFORMANCE_LIMITS.batchSize.min) {
    errors.push(`batchSize must be at least ${PERFORMANCE_LIMITS.batchSize.min}`);
  }
  if (performance.batchSize > PERFORMANCE_LIMITS.batchSize.max) {
    errors.push(`batchSize must not exceed ${PERFORMANCE_LIMITS.batchSize.max}`);
  }

  // Performance warnings
  if (performance.maxConcurrent > 10) {
    warnings.push('High concurrent validation may impact server performance');
  }
  if (performance.batchSize > 75) {
    warnings.push('Large batch sizes may cause memory issues');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get default performance settings
 */
export function getDefaultPerformanceSettings(): ValidationSettings['performance'] {
  return {
    maxConcurrent: PERFORMANCE_LIMITS.maxConcurrent.default,
    batchSize: PERFORMANCE_LIMITS.batchSize.default
  };
}

// ============================================================================
// FHIR Version Management Utilities
// ============================================================================

/**
 * Get all resource types for a specific FHIR version
 */
export function getAllResourceTypesForVersion(version: FHIRVersion): readonly string[] {
  return version === 'R4' ? R4_ALL_RESOURCE_TYPES : R5_ALL_RESOURCE_TYPES;
}

/**
 * Get default included resource types for a specific FHIR version
 */
export function getDefaultIncludedTypesForVersion(version: FHIRVersion): string[] {
  return version === 'R4' ? [...R4_DEFAULT_INCLUDED_RESOURCE_TYPES] : [...R5_DEFAULT_INCLUDED_RESOURCE_TYPES];
}

/**
 * Check if a resource type is available in a specific FHIR version
 */
export function isResourceTypeAvailableInVersion(resourceType: string, version: FHIRVersion): boolean {
  const allTypes = getAllResourceTypesForVersion(version);
  return allTypes.includes(resourceType);
}

/**
 * Get resource types that are not available in a specific FHIR version
 */
export function getUnavailableResourceTypes(resourceTypes: string[], version: FHIRVersion): string[] {
  const allTypes = getAllResourceTypesForVersion(version);
  return resourceTypes.filter(type => !allTypes.includes(type));
}

/**
 * Get resource types that are new in R5 (not available in R4)
 */
export function getR5SpecificResourceTypes(): string[] {
  const r4Types = R4_ALL_RESOURCE_TYPES as readonly string[];
  return (R5_ALL_RESOURCE_TYPES as readonly string[]).filter((type: string) => !r4Types.includes(type));
}

/**
 * Migrate resource type settings from one FHIR version to another
 */
export function migrateResourceTypesForVersion(
  resourceTypes: ValidationSettings['resourceTypes'],
  fromVersion: FHIRVersion,
  toVersion: FHIRVersion
): ValidationSettings['resourceTypes'] {
  if (fromVersion === toVersion) {
    return resourceTypes;
  }

  const toAllTypes = getAllResourceTypesForVersion(toVersion);
  
  // Filter out unavailable types
  const migratedIncludedTypes = resourceTypes.includedTypes.filter(type => 
    toAllTypes.includes(type)
  );
  
  const migratedExcludedTypes = resourceTypes.excludedTypes.filter(type => 
    toAllTypes.includes(type)
  );

  // If no included types remain, use defaults for the target version
  const finalIncludedTypes = migratedIncludedTypes.length > 0 
    ? migratedIncludedTypes 
    : getDefaultIncludedTypesForVersion(toVersion);

  return {
    enabled: resourceTypes.enabled,
    includedTypes: finalIncludedTypes,
    excludedTypes: migratedExcludedTypes
  };
}

// ============================================================================
// Resource Type Filtering Utilities
// ============================================================================

/**
 * Validate resource type filtering settings
 */
export function validateResourceTypeSettings(resourceTypes: ValidationSettings['resourceTypes']): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for conflicts between included and excluded types
  const conflicts = resourceTypes.includedTypes.filter(type => 
    resourceTypes.excludedTypes.includes(type)
  );
  
  if (conflicts.length > 0) {
    errors.push(`Resource types cannot be both included and excluded: ${conflicts.join(', ')}`);
  }

  // Check for empty included types when filtering is enabled
  if (resourceTypes.enabled && resourceTypes.includedTypes.length === 0) {
    warnings.push('Resource type filtering is enabled but no types are included (will validate all types)');
  }

  // Check for duplicate types
  const includedDuplicates = resourceTypes.includedTypes.filter((type, index) => 
    resourceTypes.includedTypes.indexOf(type) !== index
  );
  if (includedDuplicates.length > 0) {
    errors.push(`Duplicate included resource types: ${includedDuplicates.join(', ')}`);
  }

  const excludedDuplicates = resourceTypes.excludedTypes.filter((type, index) => 
    resourceTypes.excludedTypes.indexOf(type) !== index
  );
  if (excludedDuplicates.length > 0) {
    errors.push(`Duplicate excluded resource types: ${excludedDuplicates.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate resource type filtering settings against a specific FHIR version
 */
export function validateResourceTypeSettingsForVersion(
  resourceTypes: ValidationSettings['resourceTypes'],
  version: FHIRVersion
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const baseValidation = validateResourceTypeSettings(resourceTypes);
  const errors = [...baseValidation.errors];
  const warnings = [...baseValidation.warnings];

  const allTypesForVersion = getAllResourceTypesForVersion(version);

  // Check for invalid included types (not available in this FHIR version)
  const invalidIncludedTypes = resourceTypes.includedTypes.filter(type => 
    !allTypesForVersion.includes(type)
  );
  if (invalidIncludedTypes.length > 0) {
    errors.push(`Included resource types not available in FHIR ${version}: ${invalidIncludedTypes.join(', ')}`);
  }

  // Check for invalid excluded types (not available in this FHIR version)
  const invalidExcludedTypes = resourceTypes.excludedTypes.filter(type => 
    !allTypesForVersion.includes(type)
  );
  if (invalidExcludedTypes.length > 0) {
    errors.push(`Excluded resource types not available in FHIR ${version}: ${invalidExcludedTypes.join(', ')}`);
  }

  // Check for R5-specific types when using R4
  if (version === 'R4') {
    const r5SpecificIncluded = resourceTypes.includedTypes.filter(type => 
      getR5SpecificResourceTypes().includes(type as any)
    );
    if (r5SpecificIncluded.length > 0) {
      errors.push(`R5-specific resource types cannot be used with FHIR R4: ${r5SpecificIncluded.join(', ')}`);
    }

    const r5SpecificExcluded = resourceTypes.excludedTypes.filter(type => 
      getR5SpecificResourceTypes().includes(type)
    );
    if (r5SpecificExcluded.length > 0) {
      warnings.push(`R5-specific resource types in excluded list (will be ignored for R4): ${r5SpecificExcluded.join(', ')}`);
    }
  }

  // Performance warnings for large resource type lists
  if (resourceTypes.includedTypes.length > 50) {
    warnings.push(`Large number of included resource types (${resourceTypes.includedTypes.length}) may impact validation performance`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get effective resource types to validate based on settings
 */
export function getEffectiveResourceTypes(
  resourceTypes: ValidationSettings['resourceTypes'],
  allAvailableTypes: string[]
): string[] {
  if (!resourceTypes.enabled) {
    return allAvailableTypes;
  }

  let effectiveTypes = resourceTypes.includedTypes.length > 0 
    ? resourceTypes.includedTypes 
    : allAvailableTypes;

  // Remove excluded types
  effectiveTypes = effectiveTypes.filter(type => 
    !resourceTypes.excludedTypes.includes(type)
  );

  return effectiveTypes;
}

/**
 * Check if a resource type should be validated
 */
export function shouldValidateResourceType(
  resourceType: string,
  resourceTypes: ValidationSettings['resourceTypes'],
  allAvailableTypes: string[]
): boolean {
  const effectiveTypes = getEffectiveResourceTypes(resourceTypes, allAvailableTypes);
  return effectiveTypes.includes(resourceType);
}

/**
 * Get default resource type settings
 */
export function getDefaultResourceTypeSettings(): ValidationSettings['resourceTypes'] {
  return {
    enabled: true,
    includedTypes: [],
    excludedTypes: []
  };
}

// ============================================================================
// Validation Aspect Utilities
// ============================================================================

export const VALIDATION_ASPECTS: ValidationAspect[] = [
  'structural',
  'profile', 
  'terminology',
  'reference',
  'businessRule',
  'metadata'
];

export const VALIDATION_ASPECT_LABELS: Record<ValidationAspect, string> = {
  structural: 'Structural',
  profile: 'Profile',
  terminology: 'Terminology',
  reference: 'Reference',
  businessRule: 'Business Rules',
  metadata: 'Metadata'
};

export const VALIDATION_ASPECT_DESCRIPTIONS: Record<ValidationAspect, string> = {
  structural: 'Validates FHIR resource structure and syntax',
  profile: 'Validates against FHIR profiles and constraints',
  terminology: 'Validates terminology bindings and code systems',
  reference: 'Validates resource references and integrity',
  businessRule: 'Validates business logic and clinical rules',
  metadata: 'Validates resource metadata and provenance'
};

/**
 * Get all enabled validation aspects from settings
 */
export function getEnabledAspects(settings: ValidationSettings): ValidationAspect[] {
  return VALIDATION_ASPECTS.filter(aspect => settings.aspects[aspect].enabled);
}

/**
 * Check if a specific aspect is enabled
 */
export function isAspectEnabled(settings: ValidationSettings, aspect: ValidationAspect): boolean {
  return settings.aspects[aspect].enabled;
}

/**
 * Get severity for a specific aspect
 */
export function getAspectSeverity(settings: ValidationSettings, aspect: ValidationAspect): ValidationSeverity {
  return settings.aspects[aspect].severity;
}

// ============================================================================
// Complete Settings Validation
// ============================================================================

/**
 * Validate complete validation settings against a specific FHIR version
 */
export function validateValidationSettings(
  settings: ValidationSettings,
  version: FHIRVersion
): ValidationSettingsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate performance settings
  const performanceValidation = validatePerformanceSettings(settings.performance);
  errors.push(...performanceValidation.errors);
  warnings.push(...performanceValidation.warnings);

  // Validate resource type settings for the specific FHIR version
  const resourceTypeValidation = validateResourceTypeSettingsForVersion(settings.resourceTypes, version);
  errors.push(...resourceTypeValidation.errors);
  warnings.push(...resourceTypeValidation.warnings);

  // Validate aspects
  const enabledAspects = getEnabledAspects(settings);
  if (enabledAspects.length === 0) {
    errors.push('At least one validation aspect must be enabled');
  }

  // Check for reasonable aspect configurations
  const errorSeverityAspects = enabledAspects.filter(aspect => 
    getAspectSeverity(settings, aspect) === 'error'
  );
  if (errorSeverityAspects.length === 0) {
    warnings.push('No validation aspects are configured with error severity');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get default validation settings for a specific FHIR version
 */
export function getDefaultValidationSettingsForVersion(version: FHIRVersion): ValidationSettings {
  return version === 'R4' ? DEFAULT_VALIDATION_SETTINGS_R4 : DEFAULT_VALIDATION_SETTINGS_R5;
}

/**
 * Get default validation settings for R4 (backward compatibility)
 */
export function getDefaultValidationSettings(): ValidationSettings {
  return DEFAULT_VALIDATION_SETTINGS_R4;
}

/**
 * Create a copy of default settings for a specific FHIR version
 */
export function createDefaultValidationSettings(version: FHIRVersion): ValidationSettings {
  const defaults = getDefaultValidationSettingsForVersion(version);
  return JSON.parse(JSON.stringify(defaults)); // Deep copy
}

/**
 * Reset settings to defaults for a specific FHIR version
 */
export function resetToDefaultSettings(version: FHIRVersion): ValidationSettings {
  return createDefaultValidationSettings(version);
}

/**
 * Check if settings match the defaults for a specific FHIR version
 */
export function isDefaultSettings(settings: ValidationSettings, version: FHIRVersion): boolean {
  const defaults = getDefaultValidationSettingsForVersion(version);
  return JSON.stringify(settings) === JSON.stringify(defaults);
}

// ============================================================================
// Type Exports
// ============================================================================

export type ValidationAspect = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
export type ValidationSeverity = 'error' | 'warning' | 'info';