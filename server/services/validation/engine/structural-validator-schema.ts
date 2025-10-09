/**
 * Schema-Based Structural Validator (Fallback)
 * 
 * Fallback structural validation using @asymmetrik/fhir-json-schema-validator.
 * Used when HAPI validator is not available or fails.
 * 
 * Provides basic JSON schema validation for FHIR resources.
 * 
 * Task 2.7: Version-specific JSON schema validation (R4, R5, R6)
 * - Maps FHIR versions to schema validator versions
 * - Supports R4 (4_0_0) and R5 (5_0_0) fully
 * - R6 falls back to R4 schema with warning (R6 schemas not yet in library)
 * 
 * File size: Target <400 lines (global.mdc compliance)
 */

import type { ValidationIssue } from '../types/validation-types';
import { getVersionConfig } from '../../../config/fhir-package-versions';

// Import FHIR JSON schema validator (optional dependency)
let JSONSchemaValidator: any;
try {
  JSONSchemaValidator = require('@asymmetrik/fhir-json-schema-validator');
  console.log('[SchemaStructuralValidator] @asymmetrik/fhir-json-schema-validator loaded successfully');
} catch (error) {
  console.warn('[SchemaStructuralValidator] @asymmetrik/fhir-json-schema-validator not available');
}

// ============================================================================
// Schema-Based Structural Validator
// ============================================================================

export class SchemaStructuralValidator {
  /**
   * Validate resource structure using JSON schema validator
   * 
   * @param resource - FHIR resource to validate
   * @param resourceType - Expected resource type
   * @param fhirVersion - FHIR version (R4, R5, or R6)
   * @returns Array of structural validation issues
   */
  async validate(
    resource: any,
    resourceType: string,
    fhirVersion: 'R4' | 'R5' | 'R6'
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    try {
      console.log(`[SchemaStructuralValidator] Validating ${resourceType} structure with schema...`);

      // Basic validation
      const basicIssues = this.performBasicValidation(resource, resourceType);
      issues.push(...basicIssues);

      // If basic validation failed critically, return early
      if (basicIssues.some(issue => issue.severity === 'error')) {
        return issues;
      }

      // Schema validation if available
      if (JSONSchemaValidator) {
        try {
          const schemaIssues = await this.validateWithSchema(resource, resourceType, fhirVersion);
          issues.push(...schemaIssues);
        } catch (schemaError) {
          console.warn(`[SchemaStructuralValidator] Schema validation failed:`, schemaError);
          // Continue with basic validation only
        }
      } else {
        // Perform enhanced validation if schema validator not available
        const enhancedIssues = this.performEnhancedValidation(resource, resourceType);
        issues.push(...enhancedIssues);
      }

      const validationTime = Date.now() - startTime;
      console.log(
        `[SchemaStructuralValidator] Validated ${resourceType} in ${validationTime}ms ` +
        `(${issues.length} issues)`
      );

      return issues;

    } catch (error) {
      console.error(`[SchemaStructuralValidator] Validation failed:`, error);
      
      return [{
        id: `schema-error-${Date.now()}`,
        aspect: 'structural',
        severity: 'error',
        code: 'schema-validation-error',
        message: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      }];
    }
  }

  /**
   * Perform basic structural validation
   */
  private performBasicValidation(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if resource is an object
    if (typeof resource !== 'object' || resource === null) {
      issues.push({
        id: `basic-${Date.now()}-1`,
        aspect: 'structural',
        severity: 'error',
        code: 'invalid-json',
        message: 'Resource must be a valid JSON object',
        path: '',
        timestamp: new Date(),
      });
      return issues;
    }

    // Check resourceType field
    if (!resource.resourceType) {
      issues.push({
        id: `basic-${Date.now()}-2`,
        aspect: 'structural',
        severity: 'error',
        code: 'required-element-missing',
        message: 'Resource type is required',
        path: 'resourceType',
        timestamp: new Date(),
      });
    }

    // Check resourceType matches
    if (resource.resourceType && resource.resourceType !== resourceType) {
      issues.push({
        id: `basic-${Date.now()}-3`,
        aspect: 'structural',
        severity: 'error',
        code: 'resource-type-mismatch',
        message: `Expected resourceType '${resourceType}' but found '${resource.resourceType}'`,
        path: 'resourceType',
        timestamp: new Date(),
      });
    }

    // Check for id field (required for most operations)
    if (!resource.id) {
      issues.push({
        id: `basic-${Date.now()}-4`,
        aspect: 'structural',
        severity: 'warning',
        code: 'missing-id',
        message: 'Resource ID is recommended',
        path: 'id',
        timestamp: new Date(),
      });
    }

    return issues;
  }

  /**
   * Validate using JSON schema validator
   */
  /**
   * Map FHIR version to schema validator version
   * Task 2.7: Version-specific schema mapping
   * 
   * @param fhirVersion - FHIR version (R4, R5, R6)
   * @returns Schema validator version key
   */
  private mapFhirVersionToSchemaVersion(fhirVersion: 'R4' | 'R5' | 'R6'): {
    version: string;
    fallback: boolean;
    warning?: string;
  } {
    switch (fhirVersion) {
      case 'R4':
        return { version: '4_0_0', fallback: false };
      
      case 'R5':
        return { version: '5_0_0', fallback: false };
      
      case 'R6':
        // R6 schemas not yet available in @asymmetrik library
        // Fall back to R4 schema with warning
        return {
          version: '4_0_0',
          fallback: true,
          warning: 'R6 schemas not available in validator library. Using R4 schema as fallback. Consider using HAPI validator for R6 resources.'
        };
      
      default:
        return { version: '4_0_0', fallback: true };
    }
  }

  /**
   * Validate resource structure using JSON schema validator
   * Task 2.7: Version-specific schema validation
   * 
   * @param resource - FHIR resource to validate
   * @param resourceType - Expected resource type
   * @param fhirVersion - FHIR version (R4, R5, or R6)
   * @returns Array of structural validation issues
   */
  private async validateWithSchema(
    resource: any,
    resourceType: string,
    fhirVersion: 'R4' | 'R5' | 'R6'
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Get version-specific schema (Task 2.7)
      const versionMapping = this.mapFhirVersionToSchemaVersion(fhirVersion);
      const schemaVersion = versionMapping.version;

      console.log(
        `[SchemaStructuralValidator] Using schema version ${schemaVersion} for ${fhirVersion}` +
        (versionMapping.fallback ? ' (fallback)' : '')
      );

      // Log warning if using fallback schema
      if (versionMapping.fallback && versionMapping.warning) {
        console.warn(`[SchemaStructuralValidator] ${versionMapping.warning}`);
        
        // Add informational issue about version fallback
        issues.push({
          id: `version-fallback-${Date.now()}`,
          aspect: 'structural',
          severity: 'info',
          code: 'schema-version-fallback',
          message: versionMapping.warning,
          path: '',
          timestamp: new Date(),
        });
      }

      // Get validator for version
      const validator = JSONSchemaValidator[schemaVersion];

      if (!validator) {
        console.error(
          `[SchemaStructuralValidator] No validator found for schema version ${schemaVersion} (FHIR ${fhirVersion})`
        );
        
        issues.push({
          id: `schema-unavailable-${Date.now()}`,
          aspect: 'structural',
          severity: 'warning',
          code: 'schema-validator-unavailable',
          message: `Schema validator not available for ${fhirVersion}. Validation may be incomplete.`,
          path: '',
          timestamp: new Date(),
        });
        
        return issues;
      }

      // Log version limitations
      const versionConfig = getVersionConfig(fhirVersion);
      if (versionConfig.limitations && versionConfig.limitations.length > 0) {
        console.log(
          `[SchemaStructuralValidator] ${fhirVersion} limitations: ${versionConfig.limitations.join(', ')}`
        );
      }

      // Validate resource with version-specific schema
      console.log(`[SchemaStructuralValidator] Validating ${resourceType} against ${fhirVersion} schema...`);
      const result = validator.validate(resource, resourceType);

      // Process validation errors
      if (result.errors && result.errors.length > 0) {
        console.log(
          `[SchemaStructuralValidator] Found ${result.errors.length} schema validation errors for ${resourceType}`
        );
        
        result.errors.forEach((error: any, index: number) => {
          issues.push(this.mapSchemaErrorToIssue(error, index, fhirVersion));
        });
      } else {
        console.log(`[SchemaStructuralValidator] ${resourceType} passed ${fhirVersion} schema validation`);
      }

    } catch (error) {
      console.error(`[SchemaStructuralValidator] Schema validation error for ${fhirVersion}:`, error);
      
      issues.push({
        id: `schema-error-${Date.now()}`,
        aspect: 'structural',
        severity: 'error',
        code: 'schema-validation-error',
        message: `Schema validation failed for ${fhirVersion}: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      });
    }

    return issues;
  }

  /**
   * Map schema validation error to ValidationIssue
   * Task 2.7: Enhanced with FHIR version context
   */
  private mapSchemaErrorToIssue(
    schemaError: any,
    index: number,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): ValidationIssue {
    const message = schemaError.message || 'Schema validation failed';
    const versionContext = fhirVersion ? ` (FHIR ${fhirVersion})` : '';
    
    return {
      id: `schema-${Date.now()}-${index}`,
      aspect: 'structural',
      severity: this.determineSeverity(schemaError),
      code: schemaError.keyword || 'schema-validation-error',
      message: `${message}${versionContext}`,
      path: schemaError.dataPath || schemaError.instancePath || '',
      timestamp: new Date(),
    };
  }

  /**
   * Determine severity from schema error
   */
  private determineSeverity(schemaError: any): 'error' | 'warning' | 'info' {
    const keyword = schemaError.keyword?.toLowerCase() || '';

    // Critical keywords
    if (['required', 'type', 'enum'].includes(keyword)) {
      return 'error';
    }

    // Warning keywords
    if (['pattern', 'format', 'minimum', 'maximum'].includes(keyword)) {
      return 'warning';
    }

    // Default to error
    return 'error';
  }

  /**
   * Perform enhanced validation (when schema validator unavailable)
   */
  private performEnhancedValidation(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for common required fields based on resource type
    const requiredFields = this.getRequiredFields(resourceType);
    
    for (const field of requiredFields) {
      if (!this.hasField(resource, field)) {
        issues.push({
          id: `enhanced-${Date.now()}-${field}`,
          aspect: 'structural',
          severity: 'error',
          code: 'required-element-missing',
          message: `Required field '${field}' is missing`,
          path: field,
          timestamp: new Date(),
        });
      }
    }

    // Check for common data type issues
    this.validateCommonDataTypes(resource, resourceType, issues);

    return issues;
  }

  /**
   * Get required fields for resource type
   */
  private getRequiredFields(resourceType: string): string[] {
    // Basic required fields for common resource types
    const requiredFieldsMap: Record<string, string[]> = {
      Patient: ['name'],
      Observation: ['status', 'code'],
      Encounter: ['status', 'class'],
      Condition: ['code'],
      Procedure: ['status', 'code', 'subject'],
      MedicationRequest: ['status', 'intent', 'medication', 'subject'],
      DiagnosticReport: ['status', 'code'],
      AllergyIntolerance: ['code', 'patient'],
    };

    return requiredFieldsMap[resourceType] || [];
  }

  /**
   * Check if resource has field
   */
  private hasField(resource: any, fieldPath: string): boolean {
    const parts = fieldPath.split('.');
    let current = resource;

    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        return false;
      }
      current = current[part];
    }

    return current !== null && current !== undefined;
  }

  /**
   * Validate common data types
   */
  private validateCommonDataTypes(
    resource: any,
    resourceType: string,
    issues: ValidationIssue[]
  ): void {
    // Validate dates
    if (resource.date && !this.isValidDate(resource.date)) {
      issues.push({
        id: `datatype-date-${Date.now()}`,
        aspect: 'structural',
        severity: 'error',
        code: 'invalid-date-format',
        message: 'Invalid date format',
        path: 'date',
        timestamp: new Date(),
      });
    }

    // Validate URLs
    if (resource.url && typeof resource.url === 'string' && !this.isValidUrl(resource.url)) {
      issues.push({
        id: `datatype-url-${Date.now()}`,
        aspect: 'structural',
        severity: 'warning',
        code: 'invalid-url-format',
        message: 'URL format may be invalid',
        path: 'url',
        timestamp: new Date(),
      });
    }

    // Validate status codes
    if (resource.status && typeof resource.status === 'string') {
      const validStatuses = this.getValidStatuses(resourceType);
      if (validStatuses.length > 0 && !validStatuses.includes(resource.status)) {
        issues.push({
          id: `datatype-status-${Date.now()}`,
          aspect: 'structural',
          severity: 'error',
          code: 'invalid-status-value',
          message: `Invalid status value '${resource.status}' for ${resourceType}`,
          path: 'status',
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Check if date string is valid
   */
  private isValidDate(dateString: string): boolean {
    // FHIR date format: YYYY, YYYY-MM, or YYYY-MM-DD
    const dateRegex = /^\d{4}(-\d{2}(-\d{2})?)?$/;
    return dateRegex.test(dateString);
  }

  /**
   * Check if URL string is valid
   */
  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get valid status values for resource type
   */
  private getValidStatuses(resourceType: string): string[] {
    const statusMap: Record<string, string[]> = {
      Observation: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'],
      Encounter: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled'],
      Condition: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'],
      Procedure: ['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown'],
      MedicationRequest: ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'],
    };

    return statusMap[resourceType] || [];
  }

  /**
   * Check if schema validator is available
   */
  isAvailable(): boolean {
    return JSONSchemaValidator !== undefined;
  }

  /**
   * Get available schema versions
   * Task 2.7: Expose version support information
   * 
   * @returns Array of supported FHIR versions with schema availability
   */
  getAvailableVersions(): Array<{
    fhirVersion: 'R4' | 'R5' | 'R6';
    schemaVersion: string;
    available: boolean;
    fallback: boolean;
  }> {
    if (!this.isAvailable()) {
      return [];
    }

    const versions: Array<'R4' | 'R5' | 'R6'> = ['R4', 'R5', 'R6'];
    
    return versions.map(fhirVersion => {
      const mapping = this.mapFhirVersionToSchemaVersion(fhirVersion);
      const validator = JSONSchemaValidator[mapping.version];
      
      return {
        fhirVersion,
        schemaVersion: mapping.version,
        available: !!validator,
        fallback: mapping.fallback,
      };
    });
  }

  /**
   * Check if a specific FHIR version is supported
   * Task 2.7: Version-specific support check
   * 
   * @param fhirVersion - FHIR version to check
   * @returns true if version is supported (including fallback)
   */
  isVersionSupported(fhirVersion: 'R4' | 'R5' | 'R6'): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    const mapping = this.mapFhirVersionToSchemaVersion(fhirVersion);
    const validator = JSONSchemaValidator[mapping.version];
    
    return !!validator;
  }
}

// Export singleton instance
export const schemaStructuralValidator = new SchemaStructuralValidator();

