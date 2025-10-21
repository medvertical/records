/**
 * Code Extractor for FHIR Resources
 * 
 * Extracts all terminology codes from FHIR resources for validation.
 * Handles CodeableConcept, Coding, and primitive code fields.
 * 
 * FHIR Code Types:
 * - CodeableConcept: { coding: Coding[], text?: string }
 * - Coding: { system?: string, code?: string, display?: string }
 * - code: primitive string (requires system from context)
 * 
 * Responsibilities: Code extraction ONLY
 * - Does not perform validation (handled by DirectTerminologyClient)
 * - Does not resolve ValueSets (handled by resource metadata/profiles)
 * 
 * File size: ~350 lines (adhering to global.mdc standards)
 */

// ============================================================================
// Types
// ============================================================================

export interface ExtractedCode {
  /** Code value */
  code: string;
  
  /** Code system URL */
  system: string;
  
  /** Display text */
  display?: string;
  
  /** Path to the code in the resource (for error reporting) */
  path: string;
  
  /** ValueSet URL if known from context */
  valueSet?: string;
  
  /** Code type */
  type: 'CodeableConcept' | 'Coding' | 'code';
}

export interface ExtractionResult {
  /** All extracted codes */
  codes: ExtractedCode[];
  
  /** Total number of codes found */
  totalCount: number;
  
  /** Codes grouped by system */
  bySystem: Map<string, ExtractedCode[]>;
  
  /** Codes grouped by path */
  byPath: Map<string, ExtractedCode[]>;
}

interface ResourceTypeContext {
  /** Known code fields for this resource type */
  codeFields: CodeFieldDefinition[];
}

interface CodeFieldDefinition {
  /** JSON path to the field */
  path: string;
  
  /** Expected code system (if fixed) */
  system?: string;
  
  /** Expected ValueSet URL */
  valueSet?: string;
  
  /** Field type */
  type: 'CodeableConcept' | 'Coding' | 'code';
}

// ============================================================================
// Code Extractor
// ============================================================================

export class CodeExtractor {
  private resourceTypeContexts: Map<string, ResourceTypeContext>;

  constructor() {
    this.resourceTypeContexts = this.initializeResourceContexts();
  }

  /**
   * Extract all codes from a FHIR resource
   * 
   * @param resource - FHIR resource
   * @param resourceType - Resource type
   * @returns Extraction result with all codes and metadata
   */
  extractCodes(resource: any, resourceType: string): ExtractionResult {
    const codes: ExtractedCode[] = [];
    
    // Get resource type context for known code fields
    const context = this.resourceTypeContexts.get(resourceType);
    
    // Extract codes using recursive traversal
    this.extractFromObject(resource, resourceType, '', codes, context);
    
    // Build result with groupings
    return this.buildExtractionResult(codes);
  }

  /**
   * Extract codes from a specific path in a resource
   * 
   * @param resource - FHIR resource
   * @param path - JSON path to extract from
   * @returns Array of extracted codes
   */
  extractFromPath(resource: any, path: string): ExtractedCode[] {
    const codes: ExtractedCode[] = [];
    const value = this.getValueAtPath(resource, path);
    
    if (value) {
      this.extractFromValue(value, path, codes);
    }
    
    return codes;
  }

  // --------------------------------------------------------------------------
  // Private Extraction Methods
  // --------------------------------------------------------------------------

  /**
   * Recursively extract codes from an object
   */
  private extractFromObject(
    obj: any,
    resourceType: string,
    currentPath: string,
    codes: ExtractedCode[],
    context?: ResourceTypeContext
  ): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemPath = `${currentPath}[${index}]`;
        this.extractFromObject(item, resourceType, itemPath, codes, context);
      });
      return;
    }

    // Check if this object is a CodeableConcept
    if (this.isCodeableConcept(obj)) {
      this.extractFromCodeableConcept(obj, currentPath, codes, context);
      return; // Don't recurse into CodeableConcept
    }

    // Check if this object is a Coding
    if (this.isCoding(obj)) {
      this.extractFromCoding(obj, currentPath, codes);
      return; // Don't recurse into Coding
    }

    // Recurse into object properties
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      
      // Check if this is a known code field (globally or in context)
      const isGlobalCodeField = this.isPrimitiveCodeField(key, value);
      const isContextCodeField = typeof value === 'string' && this.isConfiguredCodeField(newPath, context);
      
      if (isGlobalCodeField || isContextCodeField) {
        this.extractFromPrimitiveCode(key, value as string, newPath, codes, context);
      } else {
        this.extractFromObject(value, resourceType, newPath, codes, context);
      }
    }
  }

  /**
   * Extract codes from value (entry point for path extraction)
   */
  private extractFromValue(value: any, path: string, codes: ExtractedCode[]): void {
    if (this.isCodeableConcept(value)) {
      this.extractFromCodeableConcept(value, path, codes);
    } else if (this.isCoding(value)) {
      this.extractFromCoding(value, path, codes);
    } else if (typeof value === 'string') {
      // Primitive code - need system from context
      codes.push({
        code: value,
        system: '', // Unknown without context
        path,
        type: 'code',
      });
    }
  }

  /**
   * Extract codes from CodeableConcept
   */
  private extractFromCodeableConcept(
    codeableConcept: any,
    path: string,
    codes: ExtractedCode[],
    context?: ResourceTypeContext
  ): void {
    if (!codeableConcept.coding || !Array.isArray(codeableConcept.coding)) {
      return;
    }

    // Extract from each Coding in the array
    codeableConcept.coding.forEach((coding: any, index: number) => {
      const codingPath = `${path}.coding[${index}]`;
      this.extractFromCoding(coding, codingPath, codes);
    });
  }

  /**
   * Extract code from Coding
   */
  private extractFromCoding(
    coding: any,
    path: string,
    codes: ExtractedCode[]
  ): void {
    if (!coding.code) {
      return; // No code to extract
    }

    codes.push({
      code: coding.code,
      system: coding.system || '',
      display: coding.display,
      path,
      type: 'Coding',
    });
  }

  /**
   * Extract primitive code field
   */
  private extractFromPrimitiveCode(
    fieldName: string,
    code: string,
    path: string,
    codes: ExtractedCode[],
    context?: ResourceTypeContext
  ): void {
    const normalizedPath = path.replace(/\[\d+\]/g, ''); // Remove array indices
    
    // Check if this is a universal field first (e.g., text.status)
    const universalSystem = this.getUniversalFieldSystem(normalizedPath);
    if (universalSystem) {
      codes.push({
        code,
        system: universalSystem,
        path,
        type: 'code',
      });
      return;
    }
    
    // Try to find system from context
    // Match both exact path and array-indexed paths (e.g., identifier.use matches identifier[0].use)
    const fieldDef = context?.codeFields.find(f => {
      if (f.type !== 'code') return false;
      
      // Exact match on normalized path
      if (f.path === normalizedPath) return true;
      
      // Match if the configured path is a suffix of the normalized path
      // e.g., "name.use" matches "name[0].use" (normalized to "name.use")
      // but "identifier.use" does NOT match "name.use"
      const pathParts = normalizedPath.split('.');
      const configParts = f.path.split('.');
      
      // Must have same number of parts (or path has more due to deeper nesting)
      if (pathParts.length < configParts.length) return false;
      
      // Check if the last N parts match (where N is the length of config path)
      const pathSuffix = pathParts.slice(-configParts.length).join('.');
      return pathSuffix === f.path;
    });

    codes.push({
      code,
      system: fieldDef?.system || '',
      path,
      valueSet: fieldDef?.valueSet,
      type: 'code',
    });
  }

  // --------------------------------------------------------------------------
  // Type Checking Methods
  // --------------------------------------------------------------------------

  /**
   * Check if object is a CodeableConcept
   */
  private isCodeableConcept(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      'coding' in obj &&
      Array.isArray(obj.coding)
    );
  }

  /**
   * Check if object is a Coding
   */
  private isCoding(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      'code' in obj &&
      typeof obj.code === 'string' &&
      ('system' in obj || 'display' in obj)
    );
  }

  /**
   * Check if field is a primitive code field (globally recognized)
   */
  private isPrimitiveCodeField(fieldName: string, value: any): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    // Common primitive code field names
    // Note: 'system' is NOT included here because it's context-specific
    // (e.g., telecom.system IS a code, but identifier.system is NOT)
    const codeFieldNames = [
      'status',
      'gender',
      'language',
      'intent',
      'priority',
      'use',
      'kind',
      'mode',
    ];

    return codeFieldNames.includes(fieldName);
  }

  /**
   * Check if this is a universal field (present in all DomainResource types)
   * Returns the code system URL if it's a universal field, null otherwise
   */
  private getUniversalFieldSystem(path: string): string | null {
    const normalizedPath = path.replace(/\[\d+\]/g, '');
    
    // text.status appears in ALL DomainResource types
    if (normalizedPath === 'text.status') {
      return 'http://hl7.org/fhir/narrative-status';
    }
    
    // identifier.use appears in MANY resource types (Patient, Practitioner, Organization, Location, Encounter, Device, etc.)
    if (normalizedPath === 'identifier.use') {
      return 'http://hl7.org/fhir/identifier-use';
    }
    
    return null;
  }

  /**
   * Check if a field path is explicitly configured in the context
   */
  private isConfiguredCodeField(path: string, context?: ResourceTypeContext): boolean {
    if (!context) return false;
    
    const normalizedPath = path.replace(/\[\d+\]/g, '');
    
    return context.codeFields.some(f => {
      if (f.type !== 'code') return false;
      
      const pathParts = normalizedPath.split('.');
      const configParts = f.path.split('.');
      
      if (pathParts.length < configParts.length) return false;
      
      const pathSuffix = pathParts.slice(-configParts.length).join('.');
      return pathSuffix === f.path;
    });
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Get value at a specific path in an object
   */
  private getValueAtPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      // Handle array indices
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = current?.[key]?.[parseInt(index, 10)];
      } else {
        current = current?.[part];
      }

      if (current === undefined) {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Build extraction result with groupings
   */
  private buildExtractionResult(codes: ExtractedCode[]): ExtractionResult {
    const bySystem = new Map<string, ExtractedCode[]>();
    const byPath = new Map<string, ExtractedCode[]>();

    for (const code of codes) {
      // Group by system
      if (!bySystem.has(code.system)) {
        bySystem.set(code.system, []);
      }
      bySystem.get(code.system)!.push(code);

      // Group by path
      if (!byPath.has(code.path)) {
        byPath.set(code.path, []);
      }
      byPath.get(code.path)!.push(code);
    }

    return {
      codes,
      totalCount: codes.length,
      bySystem,
      byPath,
    };
  }

  /**
   * Initialize resource type contexts with known code fields
   */
  private initializeResourceContexts(): Map<string, ResourceTypeContext> {
    const contexts = new Map<string, ResourceTypeContext>();

    // Patient resource context
    contexts.set('Patient', {
      codeFields: [
        {
          path: 'gender',
          system: 'http://hl7.org/fhir/administrative-gender',
          valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
          type: 'code',
        },
        {
          path: 'maritalStatus',
          valueSet: 'http://hl7.org/fhir/ValueSet/marital-status',
          type: 'CodeableConcept',
        },
        {
          path: 'identifier.use',
          system: 'http://hl7.org/fhir/identifier-use',
          valueSet: 'http://hl7.org/fhir/ValueSet/identifier-use',
          type: 'code',
        },
        {
          path: 'name.use',
          system: 'http://hl7.org/fhir/name-use',
          valueSet: 'http://hl7.org/fhir/ValueSet/name-use',
          type: 'code',
        },
        {
          path: 'address.use',
          system: 'http://hl7.org/fhir/address-use',
          valueSet: 'http://hl7.org/fhir/ValueSet/address-use',
          type: 'code',
        },
        {
          path: 'telecom.use',
          system: 'http://hl7.org/fhir/contact-point-use',
          valueSet: 'http://hl7.org/fhir/ValueSet/contact-point-use',
          type: 'code',
        },
        {
          path: 'telecom.system',
          system: 'http://hl7.org/fhir/contact-point-system',
          valueSet: 'http://hl7.org/fhir/ValueSet/contact-point-system',
          type: 'code',
        },
        {
          path: 'contact.gender',
          system: 'http://hl7.org/fhir/administrative-gender',
          valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
          type: 'code',
        },
      ],
    });

    // Observation resource context
    contexts.set('Observation', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/observation-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/observation-status',
          type: 'code',
        },
        {
          path: 'category',
          valueSet: 'http://hl7.org/fhir/ValueSet/observation-category',
          type: 'CodeableConcept',
        },
        {
          path: 'code',
          type: 'CodeableConcept',
        },
        {
          path: 'interpretation',
          valueSet: 'http://hl7.org/fhir/ValueSet/observation-interpretation',
          type: 'CodeableConcept',
        },
      ],
    });

    // Condition resource context
    contexts.set('Condition', {
      codeFields: [
        {
          path: 'clinicalStatus',
          valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical',
          type: 'CodeableConcept',
        },
        {
          path: 'verificationStatus',
          valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status',
          type: 'CodeableConcept',
        },
        {
          path: 'code',
          type: 'CodeableConcept',
        },
      ],
    });

    // ServiceRequest resource context
    contexts.set('ServiceRequest', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/request-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/request-status',
          type: 'code',
        },
        {
          path: 'intent',
          system: 'http://hl7.org/fhir/request-intent',
          valueSet: 'http://hl7.org/fhir/ValueSet/request-intent',
          type: 'code',
        },
        {
          path: 'priority',
          system: 'http://hl7.org/fhir/request-priority',
          valueSet: 'http://hl7.org/fhir/ValueSet/request-priority',
          type: 'code',
        },
        {
          path: 'code',
          type: 'CodeableConcept',
        },
      ],
    });

    // MedicationRequest resource context
    contexts.set('MedicationRequest', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/request-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/medicationrequest-status',
          type: 'code',
        },
        {
          path: 'intent',
          system: 'http://hl7.org/fhir/request-intent',
          valueSet: 'http://hl7.org/fhir/ValueSet/medicationrequest-intent',
          type: 'code',
        },
        {
          path: 'priority',
          system: 'http://hl7.org/fhir/request-priority',
          valueSet: 'http://hl7.org/fhir/ValueSet/request-priority',
          type: 'code',
        },
      ],
    });

    // Encounter resource context
    contexts.set('Encounter', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/encounter-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status',
          type: 'code',
        },
        {
          path: 'class',
          type: 'Coding',
        },
        {
          path: 'location.status',
          system: 'http://hl7.org/fhir/encounter-location-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/encounter-location-status',
          type: 'code',
        },
      ],
    });

    // Procedure resource context
    contexts.set('Procedure', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/procedure-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/event-status',
          type: 'code',
        },
        {
          path: 'code',
          type: 'CodeableConcept',
        },
      ],
    });

    // DiagnosticReport resource context
    contexts.set('DiagnosticReport', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/diagnostic-report-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/diagnostic-report-status',
          type: 'code',
        },
        {
          path: 'code',
          type: 'CodeableConcept',
        },
      ],
    });

    // MedicationStatement resource context
    contexts.set('MedicationStatement', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/medication-statement-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/medication-statement-status',
          type: 'code',
        },
      ],
    });

    // AllergyIntolerance resource context
    contexts.set('AllergyIntolerance', {
      codeFields: [
        {
          path: 'clinicalStatus',
          type: 'CodeableConcept',
        },
        {
          path: 'verificationStatus',
          type: 'CodeableConcept',
        },
        {
          path: 'code',
          type: 'CodeableConcept',
        },
      ],
    });

    // Location resource context
    contexts.set('Location', {
      codeFields: [
        {
          path: 'status',
          system: 'http://hl7.org/fhir/location-status',
          valueSet: 'http://hl7.org/fhir/ValueSet/location-status',
          type: 'code',
        },
        {
          path: 'mode',
          system: 'http://hl7.org/fhir/location-mode',
          valueSet: 'http://hl7.org/fhir/ValueSet/location-mode',
          type: 'code',
        },
      ],
    });

    // Add more resource types as needed
    return contexts;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let extractorInstance: CodeExtractor | null = null;

/**
 * Get or create singleton CodeExtractor instance
 */
export function getCodeExtractor(): CodeExtractor {
  if (!extractorInstance) {
    extractorInstance = new CodeExtractor();
  }
  return extractorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCodeExtractor(): void {
  extractorInstance = null;
}

