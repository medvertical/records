/**
 * Terminology Validator
 * 
 * Handles terminology validation of FHIR resources including:
 * - Code system validation using R4 Ontoserver
 * - Value set validation using R4 Ontoserver
 * - Terminology server integration
 * - R4 terminology validation
 */

import type { ValidationIssue } from '../types/validation-types';
import { OntoserverClient } from '../../fhir/ontoserver-client';

export class TerminologyValidator {
  private ontoserverClient: OntoserverClient;
  private knownValueSets: Map<string, any> = new Map();

  constructor() {
    this.ontoserverClient = new OntoserverClient();
    this.initializeKnownValueSets();
  }

  /**
   * Initialize known FHIR R4 value sets for validation
   */
  private initializeKnownValueSets(): void {
    // Common FHIR R4 value sets
    this.knownValueSets.set('http://hl7.org/fhir/ValueSet/administrative-gender', {
      name: 'Administrative Gender',
      description: 'FHIR R4 Administrative Gender value set',
      system: 'http://hl7.org/fhir/administrative-gender',
      codes: ['male', 'female', 'other', 'unknown']
    });

    this.knownValueSets.set('http://hl7.org/fhir/ValueSet/observation-status', {
      name: 'Observation Status',
      description: 'FHIR R4 Observation Status value set',
      system: 'http://hl7.org/fhir/observation-status',
      codes: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown']
    });

    this.knownValueSets.set('http://hl7.org/fhir/ValueSet/encounter-status', {
      name: 'Encounter Status',
      description: 'FHIR R4 Encounter Status value set',
      system: 'http://hl7.org/fhir/encounter-status',
      codes: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown']
    });

    this.knownValueSets.set('http://hl7.org/fhir/ValueSet/condition-clinical', {
      name: 'Condition Clinical Status',
      description: 'FHIR R4 Condition Clinical Status value set',
      system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      codes: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved']
    });

    this.knownValueSets.set('http://hl7.org/fhir/ValueSet/condition-ver-status', {
      name: 'Condition Verification Status',
      description: 'FHIR R4 Condition Verification Status value set',
      system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
      codes: ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error']
    });

    this.knownValueSets.set('http://hl7.org/fhir/ValueSet/bundle-type', {
      name: 'Bundle Type',
      description: 'FHIR R4 Bundle Type value set',
      system: 'http://hl7.org/fhir/bundle-type',
      codes: ['document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset', 'collection']
    });

    console.log(`[TerminologyValidator] Initialized ${this.knownValueSets.size} known FHIR R4 value sets`);
  }

  async validate(resource: any, resourceType: string, terminologyClient?: any): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    console.log(`[TerminologyValidator] Validating ${resourceType} resource terminology...`);

    try {
      // Test R4 Ontoserver connectivity first
      const connectivityTest = await this.ontoserverClient.testR4Connectivity();
      if (!connectivityTest.success) {
        console.warn('[TerminologyValidator] R4 Ontoserver connectivity failed, using fallback validation');
        const fallbackIssues = await this.performFallbackTerminologyValidation(resource, resourceType);
        issues.push(...fallbackIssues);
      } else {
        console.log('[TerminologyValidator] R4 Ontoserver connected successfully');
        
        // Perform comprehensive terminology validation
        const terminologyIssues = await this.performComprehensiveTerminologyValidation(resource, resourceType);
        issues.push(...terminologyIssues);
      }

      const validationTime = Date.now() - startTime;
      console.log(`[TerminologyValidator] Validated ${resourceType} terminology in ${validationTime}ms, found ${issues.length} issues`);

    } catch (error) {
      console.error('[TerminologyValidator] Terminology validation failed:', error);
      issues.push({
        id: `terminology-error-${Date.now()}`,
        aspect: 'terminology',
        severity: 'error',
        code: 'terminology-validation-error',
        message: `Terminology validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: '',
        humanReadable: 'Terminology validation encountered an error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType
        },
        validationMethod: 'terminology-validation-error',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Perform comprehensive terminology validation using R4 Ontoserver
   */
  private async performComprehensiveTerminologyValidation(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Validate common terminology fields based on resource type
    const terminologyFields = this.getTerminologyFieldsForResourceType(resourceType);
    
    for (const field of terminologyFields) {
      const fieldValue = this.getFieldValue(resource, field.path);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const fieldIssues = await this.validateTerminologyField(fieldValue, field, resourceType);
        issues.push(...fieldIssues);
      }
    }

    return issues;
  }

  /**
   * Get terminology fields to validate for a specific resource type
   */
  private getTerminologyFieldsForResourceType(resourceType: string): Array<{path: string, valueSet?: string, system?: string}> {
    const terminologyFields: Record<string, Array<{path: string, valueSet?: string, system?: string}>> = {
      'Patient': [
        { path: 'gender', valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender' }
      ],
      'Observation': [
        { path: 'status', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
        { path: 'category.coding.code', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
        { path: 'code.coding.code', system: 'http://loinc.org' }
      ],
      'Condition': [
        { path: 'clinicalStatus.coding.code', valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical' },
        { path: 'verificationStatus.coding.code', valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status' },
        { path: 'code.coding.code', system: 'http://snomed.info/sct' }
      ],
      'Encounter': [
        { path: 'status', valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status' },
        { path: 'class.code', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' }
      ],
      'Bundle': [
        { path: 'type', valueSet: 'http://hl7.org/fhir/ValueSet/bundle-type' }
      ]
    };

    return terminologyFields[resourceType] || [];
  }

  /**
   * Validate a terminology field using R4 Ontoserver
   */
  private async validateTerminologyField(fieldValue: any, field: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Handle different field value types
      if (typeof fieldValue === 'string') {
        // Direct code validation
        const validation = await this.validateCodeAgainstValueSet(fieldValue, field.valueSet, field.system);
        if (!validation.isValid) {
          issues.push({
            id: `terminology-invalid-code-${Date.now()}-${field.path}`,
            aspect: 'terminology',
            severity: 'error',
            code: 'invalid-code',
            message: `Invalid code '${fieldValue}' for field '${field.path}'`,
            path: field.path,
            humanReadable: `The code '${fieldValue}' is not valid for the ${field.valueSet ? 'value set' : 'code system'} specified`,
            details: {
              fieldPath: field.path,
              actualCode: fieldValue,
              valueSet: field.valueSet,
              system: field.system,
              resourceType: resourceType,
              validationResult: validation
            },
            location: this.parseErrorLocation(field.path),
            validationMethod: 'r4-ontoserver-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      } else if (fieldValue.coding && Array.isArray(fieldValue.coding)) {
        // CodeableConcept validation
        for (const coding of fieldValue.coding) {
          if (coding.code) {
            const validation = await this.validateCodeAgainstValueSet(coding.code, field.valueSet, coding.system || field.system);
            if (!validation.isValid) {
              issues.push({
                id: `terminology-invalid-coding-${Date.now()}-${field.path}`,
                aspect: 'terminology',
                severity: 'error',
                code: 'invalid-coding',
                message: `Invalid coding '${coding.code}' in system '${coding.system}' for field '${field.path}'`,
                path: field.path,
                humanReadable: `The coding '${coding.code}' is not valid in the specified code system`,
                details: {
                  fieldPath: field.path,
                  actualCoding: coding,
                  valueSet: field.valueSet,
                  system: coding.system || field.system,
                  resourceType: resourceType,
                  validationResult: validation
                },
                location: this.parseErrorLocation(field.path),
                validationMethod: 'r4-ontoserver-validation',
                timestamp: new Date().toISOString(),
                resourceType: resourceType,
                schemaVersion: 'R4'
              });
            }
          }
        }
      }

    } catch (error) {
      console.error('[TerminologyValidator] Field validation failed:', error);
      issues.push({
        id: `terminology-field-error-${Date.now()}-${field.path}`,
        aspect: 'terminology',
        severity: 'warning',
        code: 'terminology-field-validation-error',
        message: `Terminology field validation failed for '${field.path}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: field.path,
        humanReadable: `Unable to validate terminology for field '${field.path}'`,
        details: {
          fieldPath: field.path,
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType
        },
        validationMethod: 'terminology-field-error',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

      return issues;
  }

  /**
   * Validate a code against a value set using R4 Ontoserver
   */
  private async validateCodeAgainstValueSet(code: string, valueSet?: string, system?: string): Promise<{isValid: boolean, display?: string, error?: string}> {
    try {
      // First try with known value sets
      if (valueSet && this.knownValueSets.has(valueSet)) {
        const knownValueSet = this.knownValueSets.get(valueSet);
        const isValid = knownValueSet.codes.includes(code);
        return {
          isValid,
          display: isValid ? code : undefined,
          error: isValid ? undefined : `Code '${code}' not found in value set '${valueSet}'`
        };
      }

      // If we have a system but no value set, validate against the code system
      if (system && !valueSet) {
        // For now, we'll use basic validation for common systems
        const isValid = this.validateAgainstCommonCodeSystem(code, system);
        return {
          isValid,
          display: isValid ? code : undefined,
          error: isValid ? undefined : `Code '${code}' not valid in system '${system}'`
        };
      }

      // Use Ontoserver for external validation
      if (valueSet) {
        const result = await this.ontoserverClient.validateCodeR4(code, system || '', valueSet);
        return {
          isValid: result.isValid,
          display: result.display,
          error: result.error
        };
      }

      return { isValid: true }; // Default to valid if no validation criteria

    } catch (error) {
      console.error('[TerminologyValidator] Code validation failed:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate against common code systems
   */
  private validateAgainstCommonCodeSystem(code: string, system: string): boolean {
    // Basic validation for common code systems
    if (system === 'http://loinc.org') {
      return /^\d+-\d+$/.test(code); // LOINC codes typically have format like "33747-0"
    }
    
    if (system === 'http://snomed.info/sct') {
      return /^\d+$/.test(code); // SNOMED CT codes are numeric
    }
    
    if (system === 'http://terminology.hl7.org/CodeSystem/v3-ActCode') {
      return /^[A-Z_]+$/.test(code); // Act codes are typically uppercase with underscores
    }

    // Default to true for unknown systems
    return true;
  }

  /**
   * Perform fallback terminology validation when Ontoserver is unavailable
   */
  private async performFallbackTerminologyValidation(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Use known value sets for fallback validation
    const terminologyFields = this.getTerminologyFieldsForResourceType(resourceType);
    
    for (const field of terminologyFields) {
      const fieldValue = this.getFieldValue(resource, field.path);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const validation = this.validateWithKnownValueSets(fieldValue, field);
        if (!validation.isValid) {
          issues.push({
            id: `terminology-fallback-invalid-${Date.now()}-${field.path}`,
            aspect: 'terminology',
            severity: 'warning',
            code: 'invalid-code-fallback',
            message: `Invalid code '${fieldValue}' for field '${field.path}' (fallback validation)`,
            path: field.path,
            humanReadable: `The code '${fieldValue}' may not be valid (using fallback validation)`,
            details: {
              fieldPath: field.path,
              actualCode: fieldValue,
              valueSet: field.valueSet,
              system: field.system,
              resourceType: resourceType,
              validationMethod: 'fallback'
            },
            validationMethod: 'terminology-fallback-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate using known value sets
   */
  private validateWithKnownValueSets(fieldValue: any, field: any): {isValid: boolean, error?: string} {
    if (field.valueSet && this.knownValueSets.has(field.valueSet)) {
      const knownValueSet = this.knownValueSets.get(field.valueSet);
      
      if (typeof fieldValue === 'string') {
        const isValid = knownValueSet.codes.includes(fieldValue);
        return {
          isValid,
          error: isValid ? undefined : `Code '${fieldValue}' not found in known value set '${field.valueSet}'`
        };
      }
    }

    return { isValid: true }; // Default to valid
  }

  /**
   * Get field value from resource using dot notation
   */
  private getFieldValue(resource: any, fieldPath: string): any {
    if (!fieldPath) return resource;
    
    const parts = fieldPath.split('.');
    let current = resource;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Parse error location from field path
   */
  private parseErrorLocation(fieldPath: string): any {
    return {
      field: fieldPath,
      path: fieldPath.split('.'),
      depth: fieldPath.split('.').length
    };
  }
}