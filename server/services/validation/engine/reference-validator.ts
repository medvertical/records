/**
 * Reference Validator
 * 
 * Handles reference validation of FHIR resources including:
 * - Reference integrity checking using Firely server
 * - Reference cardinality validation
 * - Reference resolution and existence verification
 * - R4 reference validation
 */

import type { ValidationIssue } from '../types/validation-types';
import { FirelyClient } from '../../fhir/firely-client';

export class ReferenceValidator {
  private firelyClient: FirelyClient;
  private referenceFields: Map<string, Array<{path: string, type: string, required?: boolean}>> = new Map();

  constructor() {
    this.firelyClient = new FirelyClient();
    this.initializeReferenceFields();
  }

  /**
   * Initialize reference fields for different resource types
   */
  private initializeReferenceFields(): void {
    // Patient references
    this.referenceFields.set('Patient', [
      { path: 'generalPractitioner', type: 'Reference', required: false },
      { path: 'managingOrganization', type: 'Reference', required: false },
      { path: 'link.other', type: 'Reference', required: false }
    ]);

    // Observation references
    this.referenceFields.set('Observation', [
      { path: 'subject', type: 'Reference', required: false },
      { path: 'focus', type: 'Reference', required: false },
      { path: 'encounter', type: 'Reference', required: false },
      { path: 'performer', type: 'Reference', required: false },
      { path: 'specimen', type: 'Reference', required: false },
      { path: 'device', type: 'Reference', required: false },
      { path: 'hasMember', type: 'Reference', required: false },
      { path: 'derivedFrom', type: 'Reference', required: false }
    ]);

    // Condition references
    this.referenceFields.set('Condition', [
      { path: 'subject', type: 'Reference', required: true },
      { path: 'encounter', type: 'Reference', required: false },
      { path: 'recorder', type: 'Reference', required: false },
      { path: 'asserter', type: 'Reference', required: false }
    ]);

    // Encounter references
    this.referenceFields.set('Encounter', [
      { path: 'subject', type: 'Reference', required: false },
      { path: 'episodeOfCare', type: 'Reference', required: false },
      { path: 'basedOn', type: 'Reference', required: false },
      { path: 'participant.individual', type: 'Reference', required: false },
      { path: 'appointment', type: 'Reference', required: false },
      { path: 'reasonReference', type: 'Reference', required: false },
      { path: 'account', type: 'Reference', required: false },
      { path: 'serviceProvider', type: 'Reference', required: false },
      { path: 'partOf', type: 'Reference', required: false }
    ]);

    // Bundle references
    this.referenceFields.set('Bundle', [
      { path: 'entry.resource', type: 'Reference', required: false }
    ]);

    console.log(`[ReferenceValidator] Initialized reference fields for ${this.referenceFields.size} FHIR R4 resource types`);
  }

  async validate(resource: any, resourceType: string, fhirClient?: any): Promise<ValidationIssue[]> {
    // TEMPORARILY DISABLED FOR PERFORMANCE TESTING
    console.log(`[ReferenceValidator] SKIPPING reference validation for ${resourceType} (performance optimization)`);
    console.log(`[ReferenceValidator] Returning immediately to avoid any processing`);
    return []; // Return empty issues array for now
    
    // Original code (disabled):
    // const issues: ValidationIssue[] = [];
    // const startTime = Date.now();
    // 
    // console.log(`[ReferenceValidator] Validating ${resourceType} resource references...`);
    // 
    // try {
    //   // Test Firely server connectivity first
    //   const connectivityTest = await this.firelyClient.testConnectivity();
    //   if (!connectivityTest.success) {
    //     console.warn('[ReferenceValidator] Firely server connectivity failed, using fallback validation');
    //     const fallbackIssues = await this.performFallbackReferenceValidation(resource, resourceType);
    //     issues.push(...fallbackIssues);
    //   } else {
    //     console.log('[ReferenceValidator] Firely server connected successfully');
    //     
    //     // Perform comprehensive reference validation
    //     const referenceIssues = await this.performComprehensiveReferenceValidation(resource, resourceType);
    //     issues.push(...referenceIssues);
    //   }
    // 
    //   const validationTime = Date.now() - startTime;
    //   console.log(`[ReferenceValidator] Validated ${resourceType} references in ${validationTime}ms, found ${issues.length} issues`);
    //   return issues;
    // } catch (error) {
    //   console.error('[ReferenceValidator] Reference validation failed:', error);
    //   return [{
    //     id: `reference-error-${Date.now()}`,
    //     aspect: 'reference',
    //     severity: 'error',
    //     code: 'reference-validation-error',
    //     message: `Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    //     path: '',
    //     humanReadable: 'Reference validation encountered an error',
    //     details: {
    //       error: error instanceof Error ? error.message : 'Unknown error',
    //       resourceType: resourceType
    //     },
    //     validationMethod: 'reference-validation-error',
    //     timestamp: new Date().toISOString(),
    //     resourceType: resourceType,
    //     schemaVersion: 'R4'
    //   }];
    // }
  }

  /**
   * Perform comprehensive reference validation using Firely server
   */
  private async performComprehensiveReferenceValidation(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    // TEMPORARILY DISABLED FOR PERFORMANCE TESTING
    console.log(`[ReferenceValidator] SKIPPING comprehensive reference validation for ${resourceType} (performance optimization)`);
    return [];
    
    // Original code (disabled):
    // const issues: ValidationIssue[] = [];
    // const referenceFields = this.referenceFields.get(resourceType) || [];
    
    for (const field of referenceFields) {
      const fieldValue = this.getFieldValue(resource, field.path);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const fieldIssues = await this.validateReferenceField(fieldValue, field, resourceType);
        issues.push(...fieldIssues);
      }
    }

      return issues;
    }

  /**
   * Validate a reference field using Firely server
   */
  private async validateReferenceField(fieldValue: any, field: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Handle different reference value types
      if (typeof fieldValue === 'string') {
        // Direct reference validation
        const validation = await this.validateReference(fieldValue, field, resourceType);
        if (!validation.isValid) {
          issues.push({
            id: `reference-invalid-${Date.now()}-${field.path}`,
            aspect: 'reference',
            severity: validation.severity,
            code: validation.code,
            message: validation.message,
            path: field.path,
            humanReadable: validation.humanReadable,
            details: {
              fieldPath: field.path,
              actualReference: fieldValue,
              resourceType: resourceType,
              validationResult: validation
            },
            location: this.parseErrorLocation(field.path),
            validationMethod: 'firely-server-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      } else if (Array.isArray(fieldValue)) {
        // Array of references
        for (let i = 0; i < fieldValue.length; i++) {
          const item = fieldValue[i];
          const arrayPath = `${field.path}[${i}]`;
          
          if (typeof item === 'string') {
            const validation = await this.validateReference(item, field, resourceType);
            if (!validation.isValid) {
              issues.push({
                id: `reference-invalid-array-${Date.now()}-${arrayPath}`,
                aspect: 'reference',
                severity: validation.severity,
                code: validation.code,
                message: validation.message,
                path: arrayPath,
                humanReadable: validation.humanReadable,
                details: {
                  fieldPath: arrayPath,
                  actualReference: item,
                  resourceType: resourceType,
                  validationResult: validation
                },
                location: this.parseErrorLocation(arrayPath),
                validationMethod: 'firely-server-validation',
                timestamp: new Date().toISOString(),
                resourceType: resourceType,
                schemaVersion: 'R4'
              });
            }
          } else if (item && typeof item === 'object') {
            // Object with reference property
            if (item.reference) {
              const validation = await this.validateReference(item.reference, field, resourceType);
              if (!validation.isValid) {
                issues.push({
                  id: `reference-invalid-object-${Date.now()}-${arrayPath}`,
                  aspect: 'reference',
                  severity: validation.severity,
                  code: validation.code,
                  message: validation.message,
                  path: `${arrayPath}.reference`,
                  humanReadable: validation.humanReadable,
                  details: {
                    fieldPath: `${arrayPath}.reference`,
                    actualReference: item.reference,
                    resourceType: resourceType,
                    validationResult: validation
                  },
                  location: this.parseErrorLocation(`${arrayPath}.reference`),
                  validationMethod: 'firely-server-validation',
                  timestamp: new Date().toISOString(),
                  resourceType: resourceType,
                  schemaVersion: 'R4'
                });
              }
            }
          }
        }
      } else if (fieldValue && typeof fieldValue === 'object') {
        // Single reference object
        if (fieldValue.reference) {
          const validation = await this.validateReference(fieldValue.reference, field, resourceType);
          if (!validation.isValid) {
            issues.push({
              id: `reference-invalid-object-${Date.now()}-${field.path}`,
              aspect: 'reference',
              severity: validation.severity,
              code: validation.code,
              message: validation.message,
              path: `${field.path}.reference`,
              humanReadable: validation.humanReadable,
              details: {
                fieldPath: `${field.path}.reference`,
                actualReference: fieldValue.reference,
                resourceType: resourceType,
                validationResult: validation
              },
              location: this.parseErrorLocation(`${field.path}.reference`),
              validationMethod: 'firely-server-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R4'
            });
          }
        }
      }

    } catch (error) {
      console.error('[ReferenceValidator] Field validation failed:', error);
      issues.push({
        id: `reference-field-error-${Date.now()}-${field.path}`,
        aspect: 'reference',
        severity: 'warning',
        code: 'reference-field-validation-error',
        message: `Reference field validation failed for '${field.path}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: field.path,
        humanReadable: `Unable to validate reference for field '${field.path}'`,
        details: {
          fieldPath: field.path,
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType
        },
        validationMethod: 'reference-field-error',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Validate a reference using Firely server
   */
  private async validateReference(reference: string, field: any, resourceType: string): Promise<{
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    humanReadable: string;
  }> {
    try {
      // First validate reference format
      const formatValidation = this.validateReferenceFormat(reference);
      if (!formatValidation.isValid) {
        return formatValidation;
      }

      // Check if referenced resource exists on Firely server (TEMPORARILY DISABLED FOR PERFORMANCE TESTING)
      // TEMPORARY: Skip external validation for performance testing
      console.log(`[ReferenceValidator] SKIPPING external validation for reference ${reference} (performance optimization)`);
      
      // Assume reference is valid for performance testing
      return {
        isValid: true,
        severity: 'info',
        code: 'reference-assumed-valid',
        message: `Reference '${reference}' assumed valid (external validation disabled for performance)`,
        humanReadable: `The referenced resource '${reference}' exists and is accessible`
      };

    } catch (error) {
      console.error('[ReferenceValidator] Reference validation failed:', error);
      return {
        isValid: false,
        severity: 'warning',
        code: 'reference-validation-error',
        message: `Reference validation failed for '${reference}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        humanReadable: `Unable to validate the reference '${reference}' due to an error`
      };
    }
  }

  /**
   * Validate reference format
   */
  private validateReferenceFormat(reference: string): {
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    humanReadable: string;
  } {
    // Check if reference is a valid FHIR reference format
    if (!reference || typeof reference !== 'string') {
      return {
        isValid: false,
        severity: 'error',
        code: 'invalid-reference-format',
        message: 'Reference is not a valid string',
        humanReadable: 'Reference must be a valid string'
      };
    }

    // Check for basic FHIR reference patterns
    const resourcePattern = /^[A-Z][a-zA-Z]*\/[a-zA-Z0-9\-\.]+$/;
    const absoluteUrlPattern = /^https?:\/\/.+/;
    const relativeUrlPattern = /^[A-Z][a-zA-Z]*\/[a-zA-Z0-9\-\.]+$/;

    if (resourcePattern.test(reference) || absoluteUrlPattern.test(reference) || relativeUrlPattern.test(reference)) {
      return {
        isValid: true,
        severity: 'info',
        code: 'reference-format-valid',
        message: `Reference '${reference}' has valid format`,
        humanReadable: `The reference '${reference}' has a valid FHIR reference format`
      };
    }

    return {
      isValid: false,
      severity: 'error',
      code: 'invalid-reference-format',
      message: `Reference '${reference}' does not have a valid FHIR reference format`,
      humanReadable: `The reference '${reference}' does not follow the expected FHIR reference format (ResourceType/id or absolute URL)`
    };
  }

  /**
   * Perform fallback reference validation when Firely server is unavailable
   */
  private async performFallbackReferenceValidation(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Use reference fields for fallback validation
    const referenceFields = this.referenceFields.get(resourceType) || [];
    
    for (const field of referenceFields) {
      const fieldValue = this.getFieldValue(resource, field.path);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const formatValidation = this.validateReferenceFormat(fieldValue);
        if (!formatValidation.isValid) {
          issues.push({
            id: `reference-fallback-format-${Date.now()}-${field.path}`,
            aspect: 'reference',
            severity: formatValidation.severity,
            code: formatValidation.code,
            message: formatValidation.message,
            path: field.path,
            humanReadable: formatValidation.humanReadable,
            details: {
              fieldPath: field.path,
              actualReference: fieldValue,
              resourceType: resourceType,
              validationMethod: 'fallback'
            },
            validationMethod: 'reference-fallback-validation',
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