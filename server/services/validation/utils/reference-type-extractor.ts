/**
 * Reference Type Extractor
 * 
 * Utility for extracting resource types from FHIR reference strings.
 * Handles various reference formats including relative, absolute, canonical, and contained references.
 * 
 * Task 6.1: Add resource type extraction from reference strings
 */

// ============================================================================
// Types
// ============================================================================

export interface ReferenceParseResult {
  /** The extracted resource type (e.g., "Patient", "Observation") */
  resourceType: string | null;
  /** The resource ID if present */
  resourceId: string | null;
  /** The reference type category */
  referenceType: 'relative' | 'absolute' | 'canonical' | 'contained' | 'fragment' | 'invalid';
  /** Whether the reference is valid */
  isValid: boolean;
  /** The original reference string */
  originalReference: string;
  /** Base URL for absolute references */
  baseUrl?: string;
  /** Version information if present */
  version?: string;
  /** Additional metadata */
  metadata?: {
    isHistorical?: boolean;
    hasVersion?: boolean;
    isBundle?: boolean;
    bundleType?: string;
  };
}

export interface ReferenceTypeExtractionOptions {
  /** Whether to allow contained references (default: true) */
  allowContained?: boolean;
  /** Whether to allow canonical references (default: true) */
  allowCanonical?: boolean;
  /** Whether to extract version information (default: true) */
  extractVersion?: boolean;
  /** Whether to validate resource type against known FHIR resources (default: false) */
  validateResourceType?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Known FHIR R4/R5 resource types for validation
 */
const KNOWN_FHIR_RESOURCE_TYPES = new Set([
  // Foundation
  'Resource', 'DomainResource', 'Element', 'BackboneElement', 'Narrative',
  
  // Clinical
  'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson', 'Person', 'Group',
  'Organization', 'OrganizationAffiliation', 'Location', 'HealthcareService', 'Endpoint',
  'Device', 'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement',
  'Substance', 'SubstanceDefinition', 'SubstanceNucleicAcid', 'SubstancePolymer',
  'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
  'SubstanceSpecification', 'Medication', 'MedicationAdministration', 'MedicationDispense',
  'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement', 'MedicationUsage',
  'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation',
  
  // Diagnostics
  'Observation', 'DiagnosticReport', 'ServiceRequest', 'Specimen', 'SpecimenDefinition',
  'BodyStructure', 'ImagingStudy', 'Media', 'QuestionnaireResponse',
  
  // Care Management
  'Condition', 'Procedure', 'AllergyIntolerance', 'AdverseEvent', 'DetectedIssue',
  'ClinicalImpression', 'RiskAssessment', 'FamilyMemberHistory', 'Goal', 'CarePlan',
  'CareTeam', 'ServiceRequest', 'NutritionOrder', 'VisionPrescription',
  
  // Request & Response
  'Task', 'Appointment', 'AppointmentResponse', 'Schedule', 'Slot', 'Encounter',
  'EpisodeOfCare', 'Flag', 'List', 'Library', 'Measure', 'MeasureReport',
  
  // Foundation
  'Composition', 'DocumentManifest', 'DocumentReference', 'CatalogEntry',
  'Basic', 'Binary', 'Bundle', 'Linkage', 'MessageDefinition', 'MessageHeader',
  'OperationDefinition', 'OperationOutcome', 'Parameters', 'Subscription',
  'SubscriptionStatus', 'SubscriptionTopic',
  
  // Conformance
  'CapabilityStatement', 'StructureDefinition', 'StructureMap', 'ImplementationGuide',
  'SearchParameter', 'CompartmentDefinition', 'ExampleScenario', 'GraphDefinition',
  'TestReport', 'TestScript',
  
  // Terminology
  'CodeSystem', 'ValueSet', 'ConceptMap', 'NamingSystem', 'TerminologyCapabilities',
  
  // Security
  'AuditEvent', 'Consent', 'Provenance', 'Signature',
  
  // Financial
  'Account', 'ChargeItem', 'ChargeItemDefinition', 'Contract', 'Coverage',
  'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'EnrollmentRequest',
  'EnrollmentResponse', 'Claim', 'ClaimResponse', 'Invoice', 'PaymentNotice',
  'PaymentReconciliation', 'ExplanationOfBenefit', 'InsurancePlan',
  
  // Specialized
  'Citation', 'Evidence', 'EvidenceReport', 'EvidenceVariable', 'ResearchDefinition',
  'ResearchElementDefinition', 'ResearchStudy', 'ResearchSubject', 'ActivityDefinition',
  'PlanDefinition', 'Questionnaire', 'Requirements', 'ActorDefinition'
]);

/**
 * Common FHIR canonical URL patterns (for conformance resources)
 * These are NOT regular resource instance URLs
 */
const CANONICAL_PATTERNS = [
  /^https?:\/\/hl7\.org\/fhir\/StructureDefinition\//,
  /^https?:\/\/hl7\.org\/fhir\/ValueSet\//,
  /^https?:\/\/hl7\.org\/fhir\/CodeSystem\//,
  /^https?:\/\/hl7\.org\/fhir\/ConceptMap\//,
  /^https?:\/\/hl7\.org\/fhir\/ImplementationGuide\//,
  /^https?:\/\/fhir\.kbv\.de\/StructureDefinition\//,
  /^https?:\/\/fhir\.de\/StructureDefinition\//,
  /^https?:\/\/.*\.medizininformatik-initiative\.de\/fhir\//,
  /^https?:\/\/build\.fhir\.org\/ig\//,
  /^https?:\/\/simplifier\.net\/.*\/StructureDefinition\//,
];

// ============================================================================
// Reference Type Extractor Class
// ============================================================================

export class ReferenceTypeExtractor {
  private options: Required<ReferenceTypeExtractionOptions>;

  constructor(options: ReferenceTypeExtractionOptions = {}) {
    this.options = {
      allowContained: options.allowContained ?? true,
      allowCanonical: options.allowCanonical ?? true,
      extractVersion: options.extractVersion ?? true,
      validateResourceType: options.validateResourceType ?? false,
    };
  }

  /**
   * Extract resource type from a reference string
   */
  extractResourceType(reference: string): string | null {
    const result = this.parseReference(reference);
    return result.resourceType;
  }

  /**
   * Parse a reference string and extract all components
   */
  parseReference(reference: string): ReferenceParseResult {
    if (!reference || typeof reference !== 'string') {
      return this.createInvalidResult(reference, 'Reference is not a valid string');
    }

    const trimmedRef = reference.trim();
    
    // Handle contained references (#resource-id)
    if (trimmedRef.startsWith('#')) {
      return this.parseContainedReference(trimmedRef);
    }

    // Handle canonical URLs (check BEFORE absolute URLs since canonical are also URLs)
    if (this.isCanonicalUrl(trimmedRef)) {
      return this.parseCanonicalReference(trimmedRef);
    }

    // Handle absolute URLs
    if (this.isAbsoluteUrl(trimmedRef)) {
      return this.parseAbsoluteReference(trimmedRef);
    }

    // Handle relative references (ResourceType/id)
    return this.parseRelativeReference(trimmedRef);
  }

  /**
   * Parse contained reference (#resource-id)
   */
  private parseContainedReference(reference: string): ReferenceParseResult {
    if (!this.options.allowContained) {
      return this.createInvalidResult(reference, 'Contained references not allowed');
    }

    const resourceId = reference.slice(1); // Remove #
    
    if (!resourceId) {
      return this.createInvalidResult(reference, 'Contained reference missing resource ID');
    }

    return {
      resourceType: null, // Contained resources don't have a type in the reference
      resourceId,
      referenceType: 'contained',
      isValid: true,
      originalReference: reference,
    };
  }

  /**
   * Parse absolute URL reference
   */
  private parseAbsoluteReference(reference: string): ReferenceParseResult {
    try {
      const url = new URL(reference);
      const pathParts = url.pathname.split('/').filter(p => p);
      
      // Look for FHIR resource pattern: .../fhir/ResourceType/id
      const fhirIndex = pathParts.findIndex(part => part.toLowerCase() === 'fhir');
      
      if (fhirIndex >= 0 && fhirIndex < pathParts.length - 1) {
        const resourceType = pathParts[fhirIndex + 1];
        const resourceId = pathParts[fhirIndex + 2];
        
        // Check for version in path (ResourceType/id/_history/version)
        let version: string | undefined;
        if (pathParts[fhirIndex + 3] === '_history' && pathParts[fhirIndex + 4]) {
          version = pathParts[fhirIndex + 4];
        }

        const isValidResourceType = this.isValidResourceType(resourceType);
        
        return {
          resourceType: isValidResourceType ? resourceType : null,
          resourceId: resourceId || null,
          referenceType: 'absolute',
          isValid: isValidResourceType && !!resourceId,
          originalReference: reference,
          baseUrl: `${url.protocol}//${url.host}${url.pathname.split('/fhir')[0]}/fhir`,
          version,
          metadata: {
            isHistorical: !!version,
            hasVersion: !!version,
          },
        };
      }

      // Fallback: try to extract from the last two path segments
      if (pathParts.length >= 2) {
        const resourceType = pathParts[pathParts.length - 2];
        const resourceId = pathParts[pathParts.length - 1];
        const isValidResourceType = this.isValidResourceType(resourceType);
        
        return {
          resourceType: isValidResourceType ? resourceType : null,
          resourceId,
          referenceType: 'absolute',
          isValid: isValidResourceType,
          originalReference: reference,
          baseUrl: url.origin,
        };
      }

      return this.createInvalidResult(reference, 'Unable to extract resource type from absolute URL');
    } catch (error) {
      return this.createInvalidResult(reference, `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse canonical URL reference
   */
  private parseCanonicalReference(reference: string): ReferenceParseResult {
    try {
      // Handle version in canonical URL (url|version)
      const [baseUrl, version] = reference.split('|');
      const url = new URL(baseUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      
      // Extract resource type from canonical URL patterns
      // Pattern: http://hl7.org/fhir/StructureDefinition/Patient
      // The second-to-last segment is typically the resource type
      let resourceType: string | null = null;
      
      if (pathParts.length >= 2) {
        const lastPart = pathParts[pathParts.length - 2];
        if (this.isValidResourceType(lastPart)) {
          resourceType = lastPart;
        }
      }

      // Fallback: look for known resource types in the path
      if (!resourceType) {
        for (const part of pathParts) {
          if (this.isValidResourceType(part)) {
            resourceType = part;
            break;
          }
        }
      }

      // Check if allowCanonical is disabled
      if (!this.options.allowCanonical) {
        return this.createInvalidResult(reference, 'Canonical references not allowed');
      }

      return {
        resourceType,
        resourceId: pathParts[pathParts.length - 1] || null,
        referenceType: 'canonical',
        isValid: !!resourceType,
        originalReference: reference,
        baseUrl: url.origin,
        version: version?.trim() || undefined,
        metadata: {
          hasVersion: !!version,
        },
      };
    } catch (error) {
      return this.createInvalidResult(reference, `Invalid canonical URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse relative reference (ResourceType/id)
   */
  private parseRelativeReference(reference: string): ReferenceParseResult {
    // Handle version suffix (ResourceType/id/_history/version)
    const historyMatch = reference.match(/^([^\/]+)\/([^\/]+)\/_history\/(.+)$/);
    if (historyMatch) {
      const [, resourceType, resourceId, version] = historyMatch;
      const isValidResourceType = this.isValidResourceType(resourceType);
      
      return {
        resourceType: isValidResourceType ? resourceType : null,
        resourceId,
        referenceType: isValidResourceType ? 'relative' : 'invalid',
        isValid: isValidResourceType && !!resourceId,
        originalReference: reference,
        version,
        metadata: {
          isHistorical: true,
          hasVersion: true,
        },
      };
    }

    // Standard format: ResourceType/id
    const parts = reference.split('/');
    
    if (parts.length !== 2) {
      return this.createInvalidResult(reference, 'Relative reference must be in format ResourceType/id');
    }

    const [resourceType, resourceId] = parts;
    
    // Check if resource type starts with uppercase (FHIR requirement)
    if (!/^[A-Z]/.test(resourceType)) {
      return this.createInvalidResult(reference, 'Resource type must start with uppercase letter');
    }
    
    // Check if resource ID is empty
    if (!resourceId || resourceId.trim() === '') {
      return this.createInvalidResult(reference, 'Resource ID is required');
    }
    
    const isValidResourceType = this.isValidResourceType(resourceType);
    
    return {
      resourceType: isValidResourceType ? resourceType : null,
      resourceId,
      referenceType: isValidResourceType ? 'relative' : 'invalid',
      isValid: isValidResourceType,
      originalReference: reference,
    };
  }

  /**
   * Check if a string is an absolute URL
   */
  private isAbsoluteUrl(reference: string): boolean {
    return /^https?:\/\//.test(reference) && !this.isCanonicalUrl(reference);
  }

  /**
   * Check if a string is a canonical URL
   * Canonical URLs reference conformance resources, not instance data
   */
  private isCanonicalUrl(reference: string): boolean {
    // Strip version if present (url|version)
    const baseRef = reference.split('|')[0];
    
    // Canonical URLs must match specific patterns
    const matchesPattern = CANONICAL_PATTERNS.some(pattern => pattern.test(baseRef));
    
    return matchesPattern;
  }

  /**
   * Validate if a string is a known FHIR resource type
   */
  private isValidResourceType(resourceType: string): boolean {
    if (!this.options.validateResourceType) {
      // If validation is disabled, assume valid if it looks like a resource type
      return /^[A-Z][a-zA-Z0-9]*$/.test(resourceType);
    }
    
    return KNOWN_FHIR_RESOURCE_TYPES.has(resourceType);
  }

  /**
   * Create an invalid result object
   */
  private createInvalidResult(reference: string, reason: string): ReferenceParseResult {
    return {
      resourceType: null,
      resourceId: null,
      referenceType: 'invalid',
      isValid: false,
      originalReference: reference,
      metadata: { error: reason } as any,
    };
  }

  /**
   * Batch extract resource types from multiple references
   */
  extractMultiple(references: string[]): ReferenceParseResult[] {
    return references.map(ref => this.parseReference(ref));
  }

  /**
   * Get only valid references from a list
   */
  getValidReferences(references: string[]): ReferenceParseResult[] {
    return this.extractMultiple(references).filter(result => result.isValid);
  }

  /**
   * Get unique resource types from a list of references
   */
  getUniqueResourceTypes(references: string[]): string[] {
    const resourceTypes = new Set<string>();
    
    for (const reference of references) {
      const result = this.parseReference(reference);
      if (result.isValid && result.resourceType) {
        resourceTypes.add(result.resourceType);
      }
    }
    
    return Array.from(resourceTypes);
  }

  /**
   * Check if a reference is of a specific resource type
   */
  isReferenceOfType(reference: string, resourceType: string): boolean {
    const result = this.parseReference(reference);
    return result.isValid && result.resourceType === resourceType;
  }

  /**
   * Filter references by resource type
   */
  filterByResourceType(references: string[], resourceType: string): string[] {
    return references.filter(ref => this.isReferenceOfType(ref, resourceType));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Static utility function for quick resource type extraction
 */
export function extractResourceType(reference: string): string | null {
  const extractor = new ReferenceTypeExtractor();
  return extractor.extractResourceType(reference);
}

/**
 * Static utility function for parsing references
 */
export function parseReference(reference: string, options?: ReferenceTypeExtractionOptions): ReferenceParseResult {
  const extractor = new ReferenceTypeExtractor(options);
  return extractor.parseReference(reference);
}

/**
 * Check if a reference is valid
 */
export function isValidReference(reference: string): boolean {
  const result = parseReference(reference);
  return result.isValid;
}

/**
 * Get all known FHIR resource types
 */
export function getKnownResourceTypes(): string[] {
  return Array.from(KNOWN_FHIR_RESOURCE_TYPES);
}

// ============================================================================
// Export singleton instance
// ============================================================================

const defaultExtractor = new ReferenceTypeExtractor();
export { defaultExtractor as referenceTypeExtractor };
