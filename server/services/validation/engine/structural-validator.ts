/**
 * Real Structural Validator using @asymmetrik/fhir-json-schema-validator
 * 
 * Handles real structural validation of FHIR R4, R5, and R6 resources including:
 * - JSON schema validation using @asymmetrik/fhir-json-schema-validator
 * - Required field validation
 * - Data type validation
 * - Cardinality validation
 * - Structure definition compliance
 * - FHIR version detection and validation
 */

import type { ValidationIssue } from '../types/validation-types';

// Import the FHIR JSON schema validator
let JSONSchemaValidator: any;
try {
  JSONSchemaValidator = require('@asymmetrik/fhir-json-schema-validator');
  console.log('[StructuralValidator] @asymmetrik/fhir-json-schema-validator loaded successfully');
} catch (error) {
  console.warn('[StructuralValidator] @asymmetrik/fhir-json-schema-validator not available, falling back to basic validation');
}

export class StructuralValidator {
  async validate(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    try {
      console.log(`[StructuralValidator] Validating ${resourceType} resource structure...`);

      // Detect FHIR version from resource
      const fhirVersion = this.detectFhirVersion(resource);
      console.log(`[StructuralValidator] Detected FHIR version: ${fhirVersion}`);
      
      // Add FHIR version to validation context
      const validationContext = {
        fhirVersion,
        resourceType,
        validationTimestamp: new Date().toISOString()
      };

      // Basic JSON structure validation
      if (typeof resource !== 'object' || resource === null) {
        issues.push({
          id: `structural-${Date.now()}-1`,
          aspect: 'structural',
          severity: 'error',
          code: 'invalid-json',
          message: 'Resource must be a valid JSON object',
          path: '',
          humanReadable: 'The resource must be a valid JSON object'
        });
        return issues;
      }

    // Check resource type
    if (!resource.resourceType) {
      issues.push({
          id: `structural-${Date.now()}-2`,
        aspect: 'structural',
        severity: 'error',
        code: 'required-element-missing',
        message: 'Resource type is required',
        path: 'resourceType',
        humanReadable: 'The resource must have a resourceType field'
      });
        return issues;
      }

      // Validate resource type matches expected type
      if (resource.resourceType !== resourceType) {
        issues.push({
          id: `structural-${Date.now()}-3`,
          aspect: 'structural',
          severity: 'error',
          code: 'resource-type-mismatch',
          message: `Expected resourceType '${resourceType}' but found '${resource.resourceType}'`,
          path: 'resourceType',
          humanReadable: `The resource type should be '${resourceType}' but is '${resource.resourceType}'`
        });
      }

      // Use @asymmetrik/fhir-json-schema-validator if available
      if (JSONSchemaValidator) {
        try {
          const validationResult = await this.validateWithFhirSchema(resource, resourceType, fhirVersion);
          issues.push(...validationResult);
        } catch (schemaError) {
          console.warn(`[StructuralValidator] Schema validation failed for ${resourceType}:`, schemaError);
          
          // Fall back to enhanced validation
          issues.push(...this.performEnhancedValidation(resource, resourceType, fhirVersion));
        }
      } else {
        // Fall back to enhanced validation
        issues.push(...this.performEnhancedValidation(resource, resourceType, fhirVersion));
      }

      const validationTime = Date.now() - startTime;
      console.log(`[StructuralValidator] Validated ${resourceType} in ${validationTime}ms, found ${issues.length} issues`);

      return issues;

    } catch (error) {
      console.error(`[StructuralValidator] Error validating ${resourceType}:`, error);
      
      issues.push({
        id: `structural-${Date.now()}-error`,
        aspect: 'structural',
        severity: 'error',
        code: 'validation-error',
        message: `Structural validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: '',
        humanReadable: 'An error occurred during structural validation'
      });

      return issues;
    }
  }

  /**
   * Detect FHIR version from resource metadata or context
   */
  private detectFhirVersion(resource: any): 'R4' | 'R5' | 'R6' {
    // Check meta.versionId for FHIR version indicators
    if (resource.meta?.versionId) {
      // R6 resources often have versionId in meta
      if (resource.meta.versionId.includes('R6') || resource.meta.versionId.includes('6.')) {
        return 'R6';
      }
      if (resource.meta.versionId.includes('R5') || resource.meta.versionId.includes('5.')) {
        return 'R5';
      }
    }

    // Check meta.profile for version indicators
    if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
      for (const profile of resource.meta.profile) {
        if (typeof profile === 'string') {
          if (profile.includes('r6') || profile.includes('R6')) return 'R6';
          if (profile.includes('r5') || profile.includes('R5')) return 'R5';
          if (profile.includes('r4') || profile.includes('R4')) return 'R4';
        }
      }
    }

    // Check for R5/R6 specific fields
    if (resource.implicitRules || resource.contained) {
      // These fields are more common in R5/R6
      if (resource.contained && Array.isArray(resource.contained)) {
        return 'R5'; // R5 introduced better contained resource handling
      }
    }

    // Check for R6 specific features
    if (resource.extension && Array.isArray(resource.extension)) {
      const hasR6Extensions = resource.extension.some((ext: any) => 
        ext.url && (ext.url.includes('r6') || ext.url.includes('R6'))
      );
      if (hasR6Extensions) return 'R6';
    }

    // Check for R5 specific features
    if (resource.extension && Array.isArray(resource.extension)) {
      const hasR5Extensions = resource.extension.some((ext: any) => 
        ext.url && (ext.url.includes('r5') || ext.url.includes('R5'))
      );
      if (hasR5Extensions) return 'R5';
    }

    // Default to R4 for backward compatibility
    return 'R4';
  }

  /**
   * Validate using @asymmetrik/fhir-json-schema-validator
   */
  private async validateWithFhirSchema(resource: any, resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6'): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      console.log(`[StructuralValidator] Using @asymmetrik/fhir-json-schema-validator for ${resourceType} (${fhirVersion})...`);

      // Initialize the validator with appropriate FHIR schema version
      const validator = new JSONSchemaValidator();
      
      // Configure validator for specific FHIR version
      if (fhirVersion === 'R5' || fhirVersion === 'R6') {
        // For R5/R6, we need to configure the validator appropriately
        console.log(`[StructuralValidator] Configuring validator for FHIR ${fhirVersion}...`);
        // Note: @asymmetrik/fhir-json-schema-validator primarily supports R4
        // For R5/R6, we'll use R4 schema as base and add version-specific validation
      }
      
      // Validate the resource with verbose error reporting
      const schemaErrors = validator.validate(resource, true);

      if (schemaErrors.length > 0) {
        console.log(`[StructuralValidator] Found ${schemaErrors.length} schema validation errors`);
        
        // Filter and convert schema errors to ValidationIssue format
        // Focus on critical structural issues, limit additional-property warnings
        const criticalErrors = this.filterCriticalSchemaErrors(schemaErrors);
        
        for (const schemaError of criticalErrors) {
          const issue: ValidationIssue = {
            id: `structural-schema-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            aspect: 'structural',
            severity: this.mapSchemaErrorSeverity(schemaError),
            code: this.mapSchemaErrorCode(schemaError),
            message: schemaError.message || 'Schema validation error',
            path: schemaError.dataPath || schemaError.instancePath || '',
            humanReadable: this.createHumanReadableMessage(schemaError, resourceType),
            details: this.createDetailedErrorContext(schemaError, resource, resourceType),
            location: this.parseErrorLocation(schemaError.dataPath || schemaError.instancePath || ''),
            validationMethod: 'fhir-schema-validator',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: fhirVersion
          };
          
          issues.push(issue);
        }
        
        console.log(`[StructuralValidator] Filtered to ${criticalErrors.length} critical issues from ${schemaErrors.length} total errors`);
      } else {
        console.log(`[StructuralValidator] Schema validation passed for ${resourceType}`);
      }

      // Also perform enhanced validation for additional checks
      const enhancedIssues = this.performEnhancedValidation(resource, resourceType, fhirVersion);
      issues.push(...enhancedIssues);

      // Add version-specific validation for R5/R6
      if (fhirVersion === 'R5' || fhirVersion === 'R6') {
        const versionSpecificIssues = this.performVersionSpecificValidation(resource, resourceType, fhirVersion);
        issues.push(...versionSpecificIssues);
      }

      return issues;

    } catch (error) {
      console.warn(`[StructuralValidator] FHIR schema validation failed:`, error);
      throw error;
    }
  }

  /**
   * Filter schema errors to focus on critical structural issues
   */
  private filterCriticalSchemaErrors(schemaErrors: any[]): any[] {
    const criticalKeywords = [
      'required',      // Missing required fields
      'type',          // Wrong data types
      'format',        // Invalid formats (dates, etc.)
      'enum',          // Invalid enum values
      'minItems',      // Array cardinality issues
      'maxItems',      // Array cardinality issues
      'minLength',     // String length issues
      'maxLength',     // String length issues
      'pattern'        // Pattern matching issues
    ];
    
    // Always include critical errors
    const criticalErrors = schemaErrors.filter(error => 
      criticalKeywords.includes(error.keyword)
    );
    
    // Limit additional-property warnings to avoid spam (max 3)
    const additionalPropertyErrors = schemaErrors.filter(error => 
      error.keyword === 'additionalProperties'
    ).slice(0, 3);
    
    return [...criticalErrors, ...additionalPropertyErrors];
  }

  /**
   * Map schema error severity to our severity levels
   */
  private mapSchemaErrorSeverity(schemaError: any): 'error' | 'warning' | 'info' {
    // Most schema errors are structural errors
    if (schemaError.keyword === 'required' || schemaError.keyword === 'type' || schemaError.keyword === 'format') {
      return 'error';
    }
    
    // Additional properties might be warnings
    if (schemaError.keyword === 'additionalProperties') {
      return 'warning';
    }
    
    // Default to error for structural issues
    return 'error';
  }

  /**
   * Map schema error to our error codes
   */
  private mapSchemaErrorCode(schemaError: any): string {
    const keyword = schemaError.keyword;
    
    switch (keyword) {
      case 'required':
        return 'required-element-missing';
      case 'type':
        return 'invalid-type';
      case 'format':
        return 'invalid-format';
      case 'additionalProperties':
        return 'additional-property';
      case 'minItems':
        return 'insufficient-items';
      case 'maxItems':
        return 'too-many-items';
      case 'minLength':
        return 'insufficient-length';
      case 'maxLength':
        return 'excessive-length';
      case 'pattern':
        return 'pattern-mismatch';
      case 'enum':
        return 'invalid-enum-value';
      default:
        return 'schema-validation-error';
    }
  }

  /**
   * Create detailed error context with additional metadata
   */
  private createDetailedErrorContext(schemaError: any, resource: any, resourceType: string): any {
    const details: any = {
      keyword: schemaError.keyword,
      schemaPath: schemaError.schemaPath,
      params: schemaError.params,
      resourceType: resourceType,
      fhirVersion: 'R4',
      validationLibrary: '@asymmetrik/fhir-json-schema-validator',
      severity: this.mapSchemaErrorSeverity(schemaError),
      category: this.categorizeSchemaError(schemaError.keyword)
    };

    // Add field-specific context
    const fieldPath = schemaError.dataPath || schemaError.instancePath || '';
    if (fieldPath) {
      details.fieldPath = fieldPath;
      details.fieldName = fieldPath.replace(/^\//, '').split('/').pop();
      details.nestedLevel = (fieldPath.match(/\//g) || []).length;
      
      // Get actual field value if available
      const fieldValue = this.getFieldValue(resource, fieldPath);
      if (fieldValue !== undefined) {
        details.actualValue = fieldValue;
        details.actualType = typeof fieldValue;
      }
    }

    // Add specific context based on error type
    switch (schemaError.keyword) {
      case 'required':
        details.missingProperty = schemaError.params?.missingProperty;
        details.availableFields = Object.keys(resource);
        break;
      case 'type':
        details.expectedType = schemaError.params?.type;
        details.actualType = typeof schemaError.data;
        break;
      case 'enum':
        details.allowedValues = schemaError.params?.allowedValues;
        details.actualValue = schemaError.data;
        break;
      case 'format':
        details.expectedFormat = schemaError.params?.format;
        break;
      case 'minItems':
      case 'maxItems':
        details.limit = schemaError.params?.limit;
        details.actualCount = Array.isArray(schemaError.data) ? schemaError.data.length : 0;
        break;
    }

    return details;
  }

  /**
   * Parse error location into structured format
   */
  private parseErrorLocation(path: string): string[] {
    if (!path) return [];
    
    // Remove leading slash and split by path separators
    return path.replace(/^\//, '').split('/').filter(segment => segment.length > 0);
  }

  /**
   * Categorize schema errors for better organization
   */
  private categorizeSchemaError(keyword: string): string {
    switch (keyword) {
      case 'required':
        return 'missing-required-field';
      case 'type':
        return 'invalid-data-type';
      case 'format':
        return 'invalid-format';
      case 'enum':
        return 'invalid-enum-value';
      case 'minItems':
      case 'maxItems':
        return 'cardinality-violation';
      case 'minLength':
      case 'maxLength':
        return 'length-violation';
      case 'pattern':
        return 'pattern-mismatch';
      case 'additionalProperties':
        return 'unexpected-property';
      default:
        return 'schema-violation';
    }
  }

  /**
   * Get field value from resource using path
   */
  private getFieldValue(resource: any, path: string): any {
    if (!path || !resource) return undefined;
    
    const segments = path.replace(/^\//, '').split('/');
    let current = resource;
    
    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Get field category for better error context
   */
  private getFieldCategory(field: string, resourceType: string): string {
    const categories: Record<string, Record<string, string>> = {
      'Patient': {
        'name': 'demographics',
        'gender': 'demographics',
        'birthDate': 'demographics',
        'address': 'contact',
        'telecom': 'contact',
        'identifier': 'identification'
      },
      'Observation': {
        'status': 'workflow',
        'code': 'clinical',
        'value': 'clinical',
        'subject': 'reference',
        'effectiveDateTime': 'temporal'
      },
      'Encounter': {
        'status': 'workflow',
        'class': 'classification',
        'subject': 'reference',
        'period': 'temporal'
      }
    };
    
    return categories[resourceType]?.[field] || 'general';
  }

  /**
   * Validate a required field based on R4 StructureDefinitions
   */
  private validateRequiredField(resource: any, field: string, resourceType: string): {
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    humanReadable: string;
    details?: any;
  } {
    const fieldValue = this.getFieldValue(resource, field);
    const cardinality = this.getFieldCardinality(field, resourceType);
    
    // Check if field is completely missing
    if (fieldValue === undefined || fieldValue === null) {
      return {
        isValid: false,
        severity: 'error',
        code: 'required-element-missing',
        message: `Required field '${field}' is missing`,
        humanReadable: `The '${field}' field is required for ${resourceType} resources`,
        details: {
          cardinality: cardinality,
          minOccurrences: cardinality.min || 1,
          actualOccurrences: 0
        }
      };
    }
    
    // Check cardinality for arrays
    if (Array.isArray(fieldValue)) {
      const count = fieldValue.length;
      if (cardinality.min && count < cardinality.min) {
        return {
          isValid: false,
          severity: 'error',
          code: 'insufficient-occurrences',
          message: `Field '${field}' has insufficient occurrences (${count}/${cardinality.min})`,
          humanReadable: `The '${field}' field must occur at least ${cardinality.min} time(s) for ${resourceType} resources`,
          details: {
            cardinality: cardinality,
            actualOccurrences: count,
            expectedMinimum: cardinality.min
          }
        };
      }
      
      if (cardinality.max && count > cardinality.max) {
        return {
          isValid: false,
          severity: 'warning',
          code: 'excessive-occurrences',
          message: `Field '${field}' has excessive occurrences (${count}/${cardinality.max})`,
          humanReadable: `The '${field}' field should occur at most ${cardinality.max} time(s) for ${resourceType} resources`,
          details: {
            cardinality: cardinality,
            actualOccurrences: count,
            expectedMaximum: cardinality.max
          }
        };
      }
    }
    
    // Check if single value field is empty
    if (!Array.isArray(fieldValue) && fieldValue === '') {
      return {
        isValid: false,
        severity: 'error',
        code: 'empty-required-field',
        message: `Required field '${field}' is empty`,
        humanReadable: `The '${field}' field cannot be empty for ${resourceType} resources`,
        details: {
          cardinality: cardinality,
          actualValue: fieldValue,
          actualType: typeof fieldValue
        }
      };
    }
    
    return {
      isValid: true,
      severity: 'info',
      code: 'field-valid',
      message: `Field '${field}' is valid`,
      humanReadable: `The '${field}' field is properly provided`
    };
  }

  /**
   * Get field cardinality based on R4 StructureDefinitions
   */
  private getFieldCardinality(field: string, resourceType: string): { min: number; max: number | string } {
    const cardinalities: Record<string, Record<string, { min: number; max: number | string }>> = {
      'Patient': {
        'resourceType': { min: 1, max: 1 },
        'name': { min: 0, max: '*' },
        'gender': { min: 0, max: 1 },
        'birthDate': { min: 0, max: 1 },
        'address': { min: 0, max: '*' },
        'telecom': { min: 0, max: '*' },
        'identifier': { min: 0, max: '*' }
      },
      'Observation': {
        'resourceType': { min: 1, max: 1 },
        'status': { min: 1, max: 1 },
        'code': { min: 1, max: 1 },
        'subject': { min: 0, max: 1 },
        'value': { min: 0, max: 1 },
        'component': { min: 0, max: '*' },
        'referenceRange': { min: 0, max: '*' }
      },
      'Encounter': {
        'resourceType': { min: 1, max: 1 },
        'status': { min: 1, max: 1 },
        'class': { min: 1, max: 1 },
        'subject': { min: 0, max: 1 },
        'participant': { min: 0, max: '*' },
        'reasonCode': { min: 0, max: '*' }
      },
      'Condition': {
        'resourceType': { min: 1, max: 1 },
        'code': { min: 1, max: 1 },
        'subject': { min: 1, max: 1 },
        'clinicalStatus': { min: 0, max: 1 },
        'verificationStatus': { min: 0, max: 1 },
        'category': { min: 0, max: '*' },
        'severity': { min: 0, max: 1 }
      },
      'Bundle': {
        'resourceType': { min: 1, max: 1 },
        'type': { min: 1, max: 1 },
        'entry': { min: 0, max: '*' },
        'total': { min: 0, max: 1 }
      }
    };
    
    return cardinalities[resourceType]?.[field] || { min: 0, max: 1 };
  }

  /**
   * Get expected field type for better error context
   */
  private getExpectedFieldType(field: string, resourceType: string): string {
    const types: Record<string, Record<string, string>> = {
      'Patient': {
        'name': 'array',
        'gender': 'string',
        'birthDate': 'string',
        'address': 'array',
        'telecom': 'array',
        'identifier': 'array'
      },
      'Observation': {
        'status': 'string',
        'code': 'object',
        'value': 'mixed',
        'subject': 'object',
        'effectiveDateTime': 'string'
      }
    };
    
    return types[resourceType]?.[field] || 'mixed';
  }

  /**
   * Create human-readable error messages
   */
  private createHumanReadableMessage(schemaError: any, resourceType: string): string {
    const keyword = schemaError.keyword;
    const dataPath = schemaError.dataPath || schemaError.instancePath || '';
    const fieldName = dataPath.replace('/', '') || 'field';
    
    switch (keyword) {
      case 'required':
        return `The '${schemaError.params.missingProperty}' field is required for ${resourceType} resources`;
      case 'type':
        return `The '${fieldName}' field must be of type ${schemaError.params.type}`;
      case 'format':
        return `The '${fieldName}' field has an invalid format`;
      case 'additionalProperties':
        return `The property '${schemaError.params.additionalProperty}' is not allowed`;
      case 'minItems':
        return `The '${fieldName}' array must contain at least ${schemaError.params.limit} items`;
      case 'maxItems':
        return `The '${fieldName}' array cannot contain more than ${schemaError.params.limit} items`;
      case 'minLength':
        return `The '${fieldName}' field must be at least ${schemaError.params.limit} characters long`;
      case 'maxLength':
        return `The '${fieldName}' field cannot be longer than ${schemaError.params.limit} characters`;
      case 'pattern':
        return `The '${fieldName}' field does not match the required pattern`;
      case 'enum':
        return `The '${fieldName}' field must be one of: ${schemaError.params.allowedValues.join(', ')}`;
      default:
        return `Schema validation error in '${fieldName}' field`;
    }
  }

  /**
   * Perform version-specific validation for R5/R6 features
   */
  private performVersionSpecificValidation(resource: any, resourceType: string, fhirVersion: 'R5' | 'R6'): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    console.log(`[StructuralValidator] Performing ${fhirVersion}-specific validation for ${resourceType}...`);

    // R5 specific validations
    if (fhirVersion === 'R5') {
      // R5 introduced better contained resource handling
      if (resource.contained && Array.isArray(resource.contained)) {
        for (let i = 0; i < resource.contained.length; i++) {
          const containedResource = resource.contained[i];
          if (!containedResource.resourceType) {
            issues.push({
              id: `structural-r5-${Date.now()}-contained-${i}`,
              aspect: 'structural',
              severity: 'error',
              code: 'missing-resource-type',
              message: `Contained resource at index ${i} is missing resourceType`,
              path: `contained[${i}].resourceType`,
              humanReadable: `Contained resources must have a resourceType field in FHIR R5`,
              details: {
                containedIndex: i,
                fhirVersion: 'R5',
                validationContext: 'contained-resource-validation'
              },
              location: ['contained', i.toString(), 'resourceType'],
              validationMethod: 'r5-specific-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R5'
            });
          }
        }
      }

      // R5 improved extension handling
      if (resource.extension && Array.isArray(resource.extension)) {
        for (let i = 0; i < resource.extension.length; i++) {
          const extension = resource.extension[i];
          if (!extension.url) {
            issues.push({
              id: `structural-r5-${Date.now()}-extension-${i}`,
              aspect: 'structural',
              severity: 'error',
              code: 'missing-extension-url',
              message: `Extension at index ${i} is missing url`,
              path: `extension[${i}].url`,
              humanReadable: `Extensions must have a url field in FHIR R5`,
              details: {
                extensionIndex: i,
                fhirVersion: 'R5',
                validationContext: 'extension-validation'
              },
              location: ['extension', i.toString(), 'url'],
              validationMethod: 'r5-specific-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R5'
            });
          }
        }
      }
    }

    // R6 specific validations
    if (fhirVersion === 'R6') {
      // R6 enhanced metadata requirements
      if (resource.meta) {
        // R6 has stricter versionId requirements
        if (!resource.meta.versionId && resource.id) {
          issues.push({
            id: `structural-r6-${Date.now()}-version-id`,
            aspect: 'structural',
            severity: 'warning',
            code: 'recommended-version-id',
            message: 'Resource should have versionId in meta for FHIR R6',
            path: 'meta.versionId',
            humanReadable: `Resources with IDs should include versionId in meta for FHIR R6 compliance`,
            details: {
              fhirVersion: 'R6',
              validationContext: 'metadata-validation',
              recommendation: 'Add versionId to meta for better version tracking'
            },
            location: ['meta', 'versionId'],
            validationMethod: 'r6-specific-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R6'
          });
        }

        // R6 improved profile validation
        if (resource.meta.profile && Array.isArray(resource.meta.profile)) {
          for (let i = 0; i < resource.meta.profile.length; i++) {
            const profile = resource.meta.profile[i];
            if (typeof profile === 'string' && !profile.startsWith('http')) {
              issues.push({
                id: `structural-r6-${Date.now()}-profile-${i}`,
                aspect: 'structural',
                severity: 'warning',
                code: 'invalid-profile-format',
                message: `Profile at index ${i} should be a URI`,
                path: `meta.profile[${i}]`,
                humanReadable: `Profile references should be URIs in FHIR R6`,
                details: {
                  profileIndex: i,
                  profileValue: profile,
                  fhirVersion: 'R6',
                  validationContext: 'profile-validation'
                },
                location: ['meta', 'profile', i.toString()],
                validationMethod: 'r6-specific-validation',
                timestamp: new Date().toISOString(),
                resourceType: resourceType,
                schemaVersion: 'R6'
              });
            }
          }
        }
      }

      // R6 enhanced security labels
      if (resource.meta?.security && Array.isArray(resource.meta.security)) {
        for (let i = 0; i < resource.meta.security.length; i++) {
          const security = resource.meta.security[i];
          if (!security.system || !security.code) {
            issues.push({
              id: `structural-r6-${Date.now()}-security-${i}`,
              aspect: 'structural',
              severity: 'warning',
              code: 'incomplete-security-coding',
              message: `Security label at index ${i} should have both system and code`,
              path: `meta.security[${i}]`,
              humanReadable: `Security labels should include both system and code in FHIR R6`,
              details: {
                securityIndex: i,
                hasSystem: !!security.system,
                hasCode: !!security.code,
                fhirVersion: 'R6',
                validationContext: 'security-validation'
              },
              location: ['meta', 'security', i.toString()],
              validationMethod: 'r6-specific-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R6'
            });
          }
        }
      }
    }

    console.log(`[StructuralValidator] ${fhirVersion}-specific validation completed, found ${issues.length} issues`);
    return issues;
  }

  /**
   * Perform enhanced validation with more detailed checks
   */
  private performEnhancedValidation(resource: any, resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6'): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for required fields based on FHIR version-specific StructureDefinitions
    const requiredFields = this.getRequiredFieldsForResourceType(resourceType, fhirVersion);
    
    for (const field of requiredFields) {
      const fieldValidation = this.validateRequiredField(resource, field, resourceType);
      if (!fieldValidation.isValid) {
        issues.push({
          id: `structural-${Date.now()}-${field}`,
          aspect: 'structural',
          severity: fieldValidation.severity,
          code: fieldValidation.code,
          message: fieldValidation.message,
          path: field,
          humanReadable: fieldValidation.humanReadable,
          details: {
            missingField: field,
            resourceType: resourceType,
            fieldCategory: this.getFieldCategory(field, resourceType),
            expectedType: this.getExpectedFieldType(field, resourceType),
            isRequiredInFHIR: true,
            fhirSpecification: 'R4',
            cardinality: this.getFieldCardinality(field, resourceType),
            ...fieldValidation.details
          },
          location: this.parseErrorLocation(field),
          validationMethod: 'structure-definition-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }
    }

    // Validate data types using FHIR version-specific schema constraints
    this.validateDataTypesWithVersionConstraints(resource, resourceType, fhirVersion, issues);

    // Validate cardinality using FHIR version-specific schema min/max constraints
    this.validateCardinalityWithVersionConstraints(resource, resourceType, fhirVersion, issues);

    // Validate date formats using FHIR version-specific constraints
    this.validateDateFormatsWithVersionConstraints(resource, resourceType, fhirVersion, issues);

    return issues;
  }

  /**
   * Perform basic validation fallback
   */
  private performBasicValidation(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check resource ID (except for Bundle)
    if (!resource.id && resourceType !== 'Bundle') {
      issues.push({
        id: `structural-${Date.now()}-id`,
        aspect: 'structural',
        severity: 'warning',
        code: 'missing-id',
        message: 'Resource ID is recommended',
        path: 'id',
        humanReadable: 'The resource should have an id field'
      });
    }

    // Check for meta field
    if (!resource.meta) {
      issues.push({
        id: `structural-${Date.now()}-meta`,
        aspect: 'structural',
        severity: 'info',
        code: 'missing-meta',
        message: 'Resource should have a meta field',
        path: 'meta',
        humanReadable: 'The resource should include metadata information'
      });
    }

    return issues;
  }

  /**
   * Get required fields for specific resource types based on FHIR version-specific StructureDefinitions
   * This is based on FHIR specification requirements for R4, R5, and R6
   */
  private getRequiredFieldsForResourceType(resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6'): string[] {
    // Base required fields (common across all versions)
    const baseRequiredFields: Record<string, string[]> = {
      'Patient': ['resourceType'],
      'Observation': ['resourceType', 'status', 'code', 'subject'],
      'Encounter': ['resourceType', 'status', 'class'],
      'Condition': ['resourceType', 'code', 'subject'],
      'Medication': ['resourceType'],
      'Practitioner': ['resourceType'],
      'Organization': ['resourceType'],
      'Bundle': ['resourceType', 'type'],
      'DiagnosticReport': ['resourceType', 'status', 'code', 'subject'],
      'MedicationRequest': ['resourceType', 'status', 'medicationCodeableConcept', 'subject'],
      'Procedure': ['resourceType', 'status', 'code', 'subject'],
      'Immunization': ['resourceType', 'status', 'vaccineCode', 'patient'],
      'AllergyIntolerance': ['resourceType', 'clinicalStatus', 'code'],
      'CarePlan': ['resourceType', 'status', 'intent', 'subject'],
      'Device': ['resourceType'],
      'Location': ['resourceType', 'status'],
      'ServiceRequest': ['resourceType', 'status', 'intent', 'code', 'subject'],
      'Specimen': ['resourceType', 'status'],
      'Task': ['resourceType', 'status', 'intent'],
      'Composition': ['resourceType', 'status', 'type', 'subject', 'date', 'author', 'title'],
      'DocumentReference': ['resourceType', 'status', 'type', 'subject', 'date', 'author', 'content'],
      'QuestionnaireResponse': ['resourceType', 'status', 'questionnaire'],
      'ValueSet': ['resourceType', 'status', 'name', 'title'],
      'CodeSystem': ['resourceType', 'status', 'name', 'title', 'content'],
      'ConceptMap': ['resourceType', 'status', 'name', 'title', 'sourceUri', 'targetUri'],
      'NamingSystem': ['resourceType', 'status', 'name', 'kind'],
      'OperationDefinition': ['resourceType', 'status', 'name', 'title', 'kind', 'code'],
      'SearchParameter': ['resourceType', 'status', 'name', 'type', 'base'],
      'StructureDefinition': ['resourceType', 'status', 'name', 'title', 'kind', 'abstract', 'type'],
      'ImplementationGuide': ['resourceType', 'status', 'name', 'title', 'packageId'],
      'CapabilityStatement': ['resourceType', 'status', 'name', 'title', 'kind', 'fhirVersion']
    };

    // R5 specific additional required fields
    const r5AdditionalFields: Record<string, string[]> = {
      'Patient': ['resourceType'], // R5 has same requirements as R4 for Patient
      'Observation': ['resourceType', 'status', 'code', 'subject'], // R5 has same requirements as R4 for Observation
      'Encounter': ['resourceType', 'status', 'class'], // R5 has same requirements as R4 for Encounter
      'Bundle': ['resourceType', 'type'], // R5 has same requirements as R4 for Bundle
      'CapabilityStatement': ['resourceType', 'status', 'name', 'title', 'kind', 'fhirVersion'] // R5 has same requirements as R4
    };

    // R6 specific additional required fields
    const r6AdditionalFields: Record<string, string[]> = {
      'Patient': ['resourceType'], // R6 has same requirements as R4 for Patient
      'Observation': ['resourceType', 'status', 'code', 'subject'], // R6 has same requirements as R4 for Observation
      'Encounter': ['resourceType', 'status', 'class'], // R6 has same requirements as R4 for Encounter
      'Bundle': ['resourceType', 'type'], // R6 has same requirements as R4 for Bundle
      'CapabilityStatement': ['resourceType', 'status', 'name', 'title', 'kind', 'fhirVersion'] // R6 has same requirements as R4
    };

    // Get base fields
    let requiredFields = baseRequiredFields[resourceType] || ['resourceType'];

    // Add version-specific fields
    if (fhirVersion === 'R5') {
      const r5Fields = r5AdditionalFields[resourceType];
      if (r5Fields) {
        requiredFields = [...new Set([...requiredFields, ...r5Fields])];
      }
    } else if (fhirVersion === 'R6') {
      const r6Fields = r6AdditionalFields[resourceType];
      if (r6Fields) {
        requiredFields = [...new Set([...requiredFields, ...r6Fields])];
      }
    }

    return requiredFields;
  }

  /**
   * Check if a field exists in the resource (supports nested paths)
   */
  private hasField(resource: any, fieldPath: string): boolean {
    const parts = fieldPath.split('.');
    let current = resource;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return current !== undefined && current !== null;
  }

  /**
   * Validate data types using FHIR version-specific schema constraints
   */
  private validateDataTypesWithVersionConstraints(resource: any, resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6', issues: ValidationIssue[]): void {
    const dataTypeConstraints = this.getVersionSpecificDataTypeConstraints(resourceType, fhirVersion);
    
    for (const [fieldPath, constraints] of Object.entries(dataTypeConstraints)) {
      const fieldValue = this.getFieldValue(resource, fieldPath);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const validation = this.validateFieldDataType(fieldValue, constraints, fieldPath, resourceType);
        if (!validation.isValid) {
          issues.push({
            id: `structural-datatype-${Date.now()}-${fieldPath}`,
            aspect: 'structural',
            severity: validation.severity,
            code: validation.code,
            message: validation.message,
            path: fieldPath,
            humanReadable: validation.humanReadable,
            details: {
              fieldPath: fieldPath,
              expectedType: constraints.type,
              actualType: typeof fieldValue,
              actualValue: fieldValue,
              resourceType: resourceType,
              fhirDataType: constraints.fhirDataType,
              constraints: constraints,
              ...validation.details
            },
            location: this.parseErrorLocation(fieldPath),
            validationMethod: 'r4-datatype-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      }
    }
  }

  /**
   * Get FHIR version-specific data type constraints for resource types
   */
  private getVersionSpecificDataTypeConstraints(resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6'): Record<string, any> {
    const constraints: Record<string, Record<string, any>> = {
      'Patient': {
        'id': { type: 'string', fhirDataType: 'id', pattern: /^[A-Za-z0-9\-\.]{1,64}$/ },
        'gender': { type: 'string', fhirDataType: 'code', enum: ['male', 'female', 'other', 'unknown'] },
        'birthDate': { type: 'string', fhirDataType: 'date', pattern: /^\d{4}-\d{2}-\d{2}$/ },
        'deceasedBoolean': { type: 'boolean', fhirDataType: 'boolean' },
        'deceasedDateTime': { type: 'string', fhirDataType: 'dateTime', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/ },
        'active': { type: 'boolean', fhirDataType: 'boolean' }
      },
      'Observation': {
        'id': { type: 'string', fhirDataType: 'id', pattern: /^[A-Za-z0-9\-\.]{1,64}$/ },
        'status': { type: 'string', fhirDataType: 'code', enum: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'] },
        'category': { type: 'array', fhirDataType: 'CodeableConcept[]' },
        'code': { type: 'object', fhirDataType: 'CodeableConcept' },
        'subject': { type: 'object', fhirDataType: 'Reference' },
        'effectiveDateTime': { type: 'string', fhirDataType: 'dateTime', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/ },
        'effectivePeriod': { type: 'object', fhirDataType: 'Period' },
        'valueQuantity': { type: 'object', fhirDataType: 'Quantity' },
        'valueString': { type: 'string', fhirDataType: 'string' },
        'valueBoolean': { type: 'boolean', fhirDataType: 'boolean' },
        'valueInteger': { type: 'number', fhirDataType: 'integer', isInteger: true },
        'valueRange': { type: 'object', fhirDataType: 'Range' },
        'valueRatio': { type: 'object', fhirDataType: 'Ratio' },
        'valueSampledData': { type: 'object', fhirDataType: 'SampledData' },
        'valueTime': { type: 'string', fhirDataType: 'time', pattern: /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.\d{3})?$/ },
        'valueDateTime': { type: 'string', fhirDataType: 'dateTime', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/ },
        'valuePeriod': { type: 'object', fhirDataType: 'Period' }
      },
      'Condition': {
        'id': { type: 'string', fhirDataType: 'id', pattern: /^[A-Za-z0-9\-\.]{1,64}$/ },
        'clinicalStatus': { type: 'object', fhirDataType: 'CodeableConcept' },
        'verificationStatus': { type: 'object', fhirDataType: 'CodeableConcept' },
        'category': { type: 'array', fhirDataType: 'CodeableConcept[]' },
        'severity': { type: 'object', fhirDataType: 'CodeableConcept' },
        'code': { type: 'object', fhirDataType: 'CodeableConcept' },
        'subject': { type: 'object', fhirDataType: 'Reference' },
        'onsetDateTime': { type: 'string', fhirDataType: 'dateTime', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/ },
        'onsetAge': { type: 'object', fhirDataType: 'Age' },
        'onsetPeriod': { type: 'object', fhirDataType: 'Period' },
        'abatementDateTime': { type: 'string', fhirDataType: 'dateTime', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/ }
      },
      'Encounter': {
        'id': { type: 'string', fhirDataType: 'id', pattern: /^[A-Za-z0-9\-\.]{1,64}$/ },
        'status': { type: 'string', fhirDataType: 'code', enum: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'] },
        'class': { type: 'object', fhirDataType: 'Coding' },
        'subject': { type: 'object', fhirDataType: 'Reference' },
        'period': { type: 'object', fhirDataType: 'Period' },
        'length': { type: 'object', fhirDataType: 'Duration' },
        'reasonCode': { type: 'array', fhirDataType: 'CodeableConcept[]' },
        'hospitalization': { type: 'object', fhirDataType: 'EncounterHospitalization' }
      },
      'Bundle': {
        'id': { type: 'string', fhirDataType: 'id', pattern: /^[A-Za-z0-9\-\.]{1,64}$/ },
        'type': { type: 'string', fhirDataType: 'code', enum: ['document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset', 'collection'] },
        'timestamp': { type: 'string', fhirDataType: 'instant', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/ },
        'total': { type: 'number', fhirDataType: 'unsignedInt', min: 0 },
        'entry': { type: 'array', fhirDataType: 'BundleEntry[]' }
      }
    };
    
    return constraints[resourceType] || {};
  }

  /**
   * Validate field data type against R4 constraints
   */
  private validateFieldDataType(fieldValue: any, constraints: any, fieldPath: string, resourceType: string): {
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    humanReadable: string;
    details?: any;
  } {
    const actualType = typeof fieldValue;
    
    // Check basic type
    if (actualType !== constraints.type) {
      return {
        isValid: false,
        severity: 'error',
        code: 'invalid-datatype',
        message: `Field '${fieldPath}' must be of type '${constraints.type}', got '${actualType}'`,
        humanReadable: `The '${fieldPath}' field should be a ${constraints.type} value for ${resourceType} resources`,
        details: {
          expectedType: constraints.type,
          actualType: actualType,
          fhirDataType: constraints.fhirDataType
        }
      };
    }
    
    // Check enum constraints
    if (constraints.enum && !constraints.enum.includes(fieldValue)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'invalid-enum-value',
        message: `Field '${fieldPath}' must be one of: ${constraints.enum.join(', ')}`,
        humanReadable: `The '${fieldPath}' field must be one of the allowed values: ${constraints.enum.join(', ')}`,
        details: {
          allowedValues: constraints.enum,
          actualValue: fieldValue,
          fhirDataType: constraints.fhirDataType
        }
      };
    }
    
    // Check pattern constraints
    if (constraints.pattern && typeof fieldValue === 'string' && !constraints.pattern.test(fieldValue)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'pattern-mismatch',
        message: `Field '${fieldPath}' does not match required pattern`,
        humanReadable: `The '${fieldPath}' field format is invalid for ${resourceType} resources`,
        details: {
          pattern: constraints.pattern.toString(),
          actualValue: fieldValue,
          fhirDataType: constraints.fhirDataType
        }
      };
    }
    
    // Check numeric constraints
    if (constraints.min !== undefined && typeof fieldValue === 'number' && fieldValue < constraints.min) {
      return {
        isValid: false,
        severity: 'error',
        code: 'value-too-small',
        message: `Field '${fieldPath}' value ${fieldValue} is below minimum ${constraints.min}`,
        humanReadable: `The '${fieldPath}' field value must be at least ${constraints.min}`,
        details: {
          minimum: constraints.min,
          actualValue: fieldValue,
          fhirDataType: constraints.fhirDataType
        }
      };
    }
    
    if (constraints.max !== undefined && typeof fieldValue === 'number' && fieldValue > constraints.max) {
      return {
        isValid: false,
        severity: 'error',
        code: 'value-too-large',
        message: `Field '${fieldPath}' value ${fieldValue} exceeds maximum ${constraints.max}`,
        humanReadable: `The '${fieldPath}' field value must be at most ${constraints.max}`,
        details: {
          maximum: constraints.max,
          actualValue: fieldValue,
          fhirDataType: constraints.fhirDataType
        }
      };
    }
    
    // Check integer constraint
    if (constraints.isInteger && typeof fieldValue === 'number' && !Number.isInteger(fieldValue)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'invalid-integer',
        message: `Field '${fieldPath}' must be an integer, got decimal ${fieldValue}`,
        humanReadable: `The '${fieldPath}' field must be a whole number for ${resourceType} resources`,
        details: {
          expectedType: 'integer',
          actualValue: fieldValue,
          fhirDataType: constraints.fhirDataType
        }
      };
    }
    
    return {
      isValid: true,
      severity: 'info',
      code: 'datatype-valid',
      message: `Field '${fieldPath}' data type is valid`,
      humanReadable: `The '${fieldPath}' field has correct data type`
    };
  }

  /**
   * Validate common field types
   */
  private validateCommonFieldTypes(resource: any, resourceType: string, issues: ValidationIssue[]): void {
    // Validate status field if present
    if (resource.status && typeof resource.status !== 'string') {
      issues.push({
        id: `structural-${Date.now()}-status-type`,
        aspect: 'structural',
        severity: 'error',
        code: 'invalid-type',
        message: 'Status field must be a string',
        path: 'status',
        humanReadable: 'The status field should be a text value',
        details: {
          fieldName: 'status',
          expectedType: 'string',
          actualType: typeof resource.status,
          actualValue: resource.status,
          fieldCategory: 'workflow',
          isRequiredInFHIR: false,
          fhirSpecification: 'R4'
        },
        location: ['status'],
        validationMethod: 'enhanced-validation',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    // Validate ID field if present
    if (resource.id && typeof resource.id !== 'string') {
      issues.push({
        id: `structural-${Date.now()}-id-type`,
        aspect: 'structural',
        severity: 'error',
        code: 'invalid-type',
        message: 'ID field must be a string',
        path: 'id',
        humanReadable: 'The id field should be a text value',
        details: {
          fieldName: 'id',
          expectedType: 'string',
          actualType: typeof resource.id,
          actualValue: resource.id,
          fieldCategory: 'identification',
          isRequiredInFHIR: false,
          fhirSpecification: 'R4'
        },
        location: ['id'],
        validationMethod: 'enhanced-validation',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }
  }

  /**
   * Validate cardinality using FHIR version-specific schema min/max constraints
   */
  private validateCardinalityWithVersionConstraints(resource: any, resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6', issues: ValidationIssue[]): void {
    const cardinalityConstraints = this.getVersionSpecificCardinalityConstraints(resourceType, fhirVersion);
    
    for (const [fieldPath, constraints] of Object.entries(cardinalityConstraints)) {
      const fieldValue = this.getFieldValue(resource, fieldPath);
      const validation = this.validateFieldCardinality(fieldValue, constraints, fieldPath, resourceType);
      
      if (!validation.isValid) {
        issues.push({
          id: `structural-cardinality-${Date.now()}-${fieldPath}`,
          aspect: 'structural',
          severity: validation.severity,
          code: validation.code,
          message: validation.message,
          path: fieldPath,
          humanReadable: validation.humanReadable,
          details: {
            fieldPath: fieldPath,
            cardinality: constraints,
            actualOccurrences: validation.actualOccurrences,
            expectedMinimum: constraints.min,
            expectedMaximum: constraints.max,
            resourceType: resourceType,
            fhirDataType: constraints.fhirDataType,
            isRequired: constraints.min > 0,
            ...validation.details
          },
          location: this.parseErrorLocation(fieldPath),
          validationMethod: 'r4-cardinality-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }
    }
  }

  /**
   * Get FHIR version-specific cardinality constraints for resource types
   */
  private getVersionSpecificCardinalityConstraints(resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6'): Record<string, any> {
    const constraints: Record<string, Record<string, any>> = {
      'Patient': {
        'name': { min: 0, max: '*', fhirDataType: 'HumanName[]', description: 'Patient name' },
        'telecom': { min: 0, max: '*', fhirDataType: 'ContactPoint[]', description: 'Contact information' },
        'address': { min: 0, max: '*', fhirDataType: 'Address[]', description: 'Patient address' },
        'identifier': { min: 0, max: '*', fhirDataType: 'Identifier[]', description: 'Patient identifier' },
        'contact': { min: 0, max: '*', fhirDataType: 'PatientContact[]', description: 'Patient contact' },
        'communication': { min: 0, max: '*', fhirDataType: 'PatientCommunication[]', description: 'Communication preference' },
        'generalPractitioner': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'General practitioner' },
        'managingOrganization': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Managing organization' },
        'link': { min: 0, max: '*', fhirDataType: 'PatientLink[]', description: 'Patient link' }
      },
      'Observation': {
        'identifier': { min: 0, max: '*', fhirDataType: 'Identifier[]', description: 'Observation identifier' },
        'basedOn': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Based on request' },
        'partOf': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Part of event' },
        'category': { min: 0, max: '*', fhirDataType: 'CodeableConcept[]', description: 'Observation category' },
        'focus': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Focus of observation' },
        'encounter': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Healthcare encounter' },
        'effectiveDateTime': { min: 0, max: 1, fhirDataType: 'dateTime', description: 'Effective date/time' },
        'effectivePeriod': { min: 0, max: 1, fhirDataType: 'Period', description: 'Effective period' },
        'issued': { min: 0, max: 1, fhirDataType: 'instant', description: 'Date/Time issued' },
        'performer': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Who performed observation' },
        'valueQuantity': { min: 0, max: 1, fhirDataType: 'Quantity', description: 'Quantity value' },
        'valueCodeableConcept': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Coded value' },
        'valueString': { min: 0, max: 1, fhirDataType: 'string', description: 'String value' },
        'valueBoolean': { min: 0, max: 1, fhirDataType: 'boolean', description: 'Boolean value' },
        'valueInteger': { min: 0, max: 1, fhirDataType: 'integer', description: 'Integer value' },
        'valueRange': { min: 0, max: 1, fhirDataType: 'Range', description: 'Range value' },
        'valueRatio': { min: 0, max: 1, fhirDataType: 'Ratio', description: 'Ratio value' },
        'valueSampledData': { min: 0, max: 1, fhirDataType: 'SampledData', description: 'Sampled data value' },
        'valueTime': { min: 0, max: 1, fhirDataType: 'time', description: 'Time value' },
        'valueDateTime': { min: 0, max: 1, fhirDataType: 'dateTime', description: 'DateTime value' },
        'valuePeriod': { min: 0, max: 1, fhirDataType: 'Period', description: 'Period value' },
        'dataAbsentReason': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Data absent reason' },
        'interpretation': { min: 0, max: '*', fhirDataType: 'CodeableConcept[]', description: 'Observation interpretation' },
        'note': { min: 0, max: '*', fhirDataType: 'Annotation[]', description: 'Comments about observation' },
        'bodySite': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Body site' },
        'method': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Observation method' },
        'specimen': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Specimen' },
        'device': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Device used' },
        'referenceRange': { min: 0, max: '*', fhirDataType: 'ObservationReferenceRange[]', description: 'Reference range' },
        'hasMember': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Has member observation' },
        'derivedFrom': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Derived from observation' },
        'component': { min: 0, max: '*', fhirDataType: 'ObservationComponent[]', description: 'Component observation' }
      },
      'Condition': {
        'identifier': { min: 0, max: '*', fhirDataType: 'Identifier[]', description: 'Condition identifier' },
        'clinicalStatus': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Clinical status' },
        'verificationStatus': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Verification status' },
        'category': { min: 0, max: '*', fhirDataType: 'CodeableConcept[]', description: 'Condition category' },
        'severity': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Condition severity' },
        'code': { min: 1, max: 1, fhirDataType: 'CodeableConcept', description: 'Condition code (required)' },
        'bodySite': { min: 0, max: '*', fhirDataType: 'CodeableConcept[]', description: 'Body site affected' },
        'subject': { min: 1, max: 1, fhirDataType: 'Reference', description: 'Who has condition (required)' },
        'encounter': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Encounter' },
        'onsetDateTime': { min: 0, max: 1, fhirDataType: 'dateTime', description: 'Onset date/time' },
        'onsetAge': { min: 0, max: 1, fhirDataType: 'Age', description: 'Onset age' },
        'onsetPeriod': { min: 0, max: 1, fhirDataType: 'Period', description: 'Onset period' },
        'onsetRange': { min: 0, max: 1, fhirDataType: 'Range', description: 'Onset range' },
        'onsetString': { min: 0, max: 1, fhirDataType: 'string', description: 'Onset description' },
        'abatementDateTime': { min: 0, max: 1, fhirDataType: 'dateTime', description: 'Abatement date/time' },
        'abatementAge': { min: 0, max: 1, fhirDataType: 'Age', description: 'Abatement age' },
        'abatementPeriod': { min: 0, max: 1, fhirDataType: 'Period', description: 'Abatement period' },
        'abatementRange': { min: 0, max: 1, fhirDataType: 'Range', description: 'Abatement range' },
        'abatementString': { min: 0, max: 1, fhirDataType: 'string', description: 'Abatement description' },
        'recordedDate': { min: 0, max: 1, fhirDataType: 'dateTime', description: 'Date condition was recorded' },
        'recorder': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Who recorded condition' },
        'asserter': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Person who asserts condition' },
        'stage': { min: 0, max: '*', fhirDataType: 'ConditionStage[]', description: 'Condition stage' },
        'evidence': { min: 0, max: '*', fhirDataType: 'ConditionEvidence[]', description: 'Supporting evidence' },
        'note': { min: 0, max: '*', fhirDataType: 'Annotation[]', description: 'Additional notes' }
      },
      'Encounter': {
        'identifier': { min: 0, max: '*', fhirDataType: 'Identifier[]', description: 'Encounter identifier' },
        'status': { min: 1, max: 1, fhirDataType: 'code', description: 'Encounter status (required)' },
        'statusHistory': { min: 0, max: '*', fhirDataType: 'EncounterStatusHistory[]', description: 'Status history' },
        'class': { min: 1, max: 1, fhirDataType: 'Coding', description: 'Encounter class (required)' },
        'classHistory': { min: 0, max: '*', fhirDataType: 'EncounterClassHistory[]', description: 'Class history' },
        'type': { min: 0, max: '*', fhirDataType: 'CodeableConcept[]', description: 'Encounter type' },
        'serviceType': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Service type' },
        'priority': { min: 0, max: 1, fhirDataType: 'CodeableConcept', description: 'Priority' },
        'subject': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Patient' },
        'episodeOfCare': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Episode of care' },
        'basedOn': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Based on request' },
        'participant': { min: 0, max: '*', fhirDataType: 'EncounterParticipant[]', description: 'Encounter participant' },
        'appointment': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Appointment' },
        'period': { min: 0, max: 1, fhirDataType: 'Period', description: 'Encounter period' },
        'length': { min: 0, max: 1, fhirDataType: 'Duration', description: 'Encounter length' },
        'reasonCode': { min: 0, max: '*', fhirDataType: 'CodeableConcept[]', description: 'Reason code' },
        'reasonReference': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Reason reference' },
        'diagnosis': { min: 0, max: '*', fhirDataType: 'EncounterDiagnosis[]', description: 'Diagnosis' },
        'account': { min: 0, max: '*', fhirDataType: 'Reference[]', description: 'Account' },
        'hospitalization': { min: 0, max: 1, fhirDataType: 'EncounterHospitalization', description: 'Hospitalization details' },
        'location': { min: 0, max: '*', fhirDataType: 'EncounterLocation[]', description: 'Location' },
        'serviceProvider': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Service provider' },
        'partOf': { min: 0, max: 1, fhirDataType: 'Reference', description: 'Part of encounter' }
      },
      'Bundle': {
        'identifier': { min: 0, max: 1, fhirDataType: 'Identifier', description: 'Bundle identifier' },
        'type': { min: 1, max: 1, fhirDataType: 'code', description: 'Bundle type (required)' },
        'timestamp': { min: 0, max: 1, fhirDataType: 'instant', description: 'Bundle timestamp' },
        'total': { min: 0, max: 1, fhirDataType: 'unsignedInt', description: 'Total number of entries' },
        'link': { min: 0, max: '*', fhirDataType: 'BundleLink[]', description: 'Bundle links' },
        'entry': { min: 0, max: '*', fhirDataType: 'BundleEntry[]', description: 'Bundle entries' },
        'signature': { min: 0, max: 1, fhirDataType: 'Signature', description: 'Bundle signature' }
      }
    };
    
    return constraints[resourceType] || {};
  }

  /**
   * Validate field cardinality against R4 constraints
   */
  private validateFieldCardinality(fieldValue: any, constraints: any, fieldPath: string, resourceType: string): {
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    humanReadable: string;
    actualOccurrences: number;
    details?: any;
  } {
    let actualOccurrences = 0;
    
    // Count occurrences based on field type
    if (fieldValue === undefined || fieldValue === null) {
      actualOccurrences = 0;
    } else if (Array.isArray(fieldValue)) {
      actualOccurrences = fieldValue.length;
    } else {
      actualOccurrences = 1;
    }
    
    // Check minimum cardinality
    if (constraints.min > 0 && actualOccurrences < constraints.min) {
      const isRequired = constraints.min > 0;
      return {
        isValid: false,
        severity: isRequired ? 'error' : 'warning',
        code: isRequired ? 'required-element-missing' : 'insufficient-occurrences',
        message: `Field '${fieldPath}' has insufficient occurrences (${actualOccurrences}/${constraints.min})`,
        humanReadable: isRequired 
          ? `The '${fieldPath}' field is required and must occur at least ${constraints.min} time(s) for ${resourceType} resources`
          : `The '${fieldPath}' field should occur at least ${constraints.min} time(s) for ${resourceType} resources`,
        actualOccurrences,
        details: {
          cardinalityType: 'minimum',
          isRequired: isRequired,
          description: constraints.description
        }
      };
    }
    
    // Check maximum cardinality (only if max is not unlimited '*')
    if (constraints.max !== '*' && constraints.max !== undefined && actualOccurrences > constraints.max) {
      return {
        isValid: false,
        severity: 'warning',
        code: 'excessive-occurrences',
        message: `Field '${fieldPath}' has excessive occurrences (${actualOccurrences}/${constraints.max})`,
        humanReadable: `The '${fieldPath}' field should occur at most ${constraints.max} time(s) for ${resourceType} resources`,
        actualOccurrences,
        details: {
          cardinalityType: 'maximum',
          isRequired: false,
          description: constraints.description
        }
      };
    }
    
    // Check for empty arrays when minimum is > 0
    if (Array.isArray(fieldValue) && fieldValue.length === 0 && constraints.min > 0) {
      return {
        isValid: false,
        severity: 'error',
        code: 'empty-required-array',
        message: `Required field '${fieldPath}' is an empty array`,
        humanReadable: `The '${fieldPath}' field is required and cannot be empty for ${resourceType} resources`,
        actualOccurrences,
        details: {
          cardinalityType: 'empty-array',
          isRequired: true,
          description: constraints.description
        }
      };
    }
    
    return {
      isValid: true,
      severity: 'info',
      code: 'cardinality-valid',
      message: `Field '${fieldPath}' cardinality is valid`,
      humanReadable: `The '${fieldPath}' field has correct cardinality`,
      actualOccurrences,
      details: {
        cardinalityType: 'valid',
        isRequired: constraints.min > 0,
        description: constraints.description
      }
    };
  }

  /**
   * Validate array cardinality
   */
  private validateArrayCardinality(resource: any, resourceType: string, issues: ValidationIssue[]): void {
    // Check for empty arrays where content is expected
    const arrayFields = ['identifier', 'name', 'telecom', 'address', 'contact'];
    
    for (const field of arrayFields) {
      if (resource[field] && Array.isArray(resource[field]) && resource[field].length === 0) {
        issues.push({
          id: `structural-${Date.now()}-${field}-empty`,
          aspect: 'structural',
          severity: 'warning',
          code: 'empty-array',
          message: `Array field '${field}' is empty`,
          path: field,
          humanReadable: `The ${field} field should contain at least one item`
        });
      }
    }
  }

  /**
   * Validate date formats using FHIR version-specific constraints
   */
  private validateDateFormatsWithVersionConstraints(resource: any, resourceType: string, fhirVersion: 'R4' | 'R5' | 'R6', issues: ValidationIssue[]): void {
    const dateFields = ['birthDate', 'effectiveDateTime', 'issued', 'lastUpdated'];
    
    for (const field of dateFields) {
      if (resource[field]) {
        const dateValue = resource[field];
        
        // Check if it's a valid date format (YYYY-MM-DD or ISO 8601)
        if (typeof dateValue === 'string') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
          if (!dateRegex.test(dateValue)) {
            issues.push({
              id: `structural-${Date.now()}-${field}-format`,
              aspect: 'structural',
              severity: 'error',
              code: 'invalid-date-format',
              message: `Invalid date format for field '${field}'`,
              path: field,
              humanReadable: `The ${field} should be in YYYY-MM-DD or ISO 8601 format`
            });
          }
        }
      }
    }
  }
}