/**
 * HAPI-Based Structural Validator
 * 
 * Primary structural validation using HAPI FHIR Validator.
 * Provides comprehensive FHIR-compliant structural validation for R4, R5, and R6.
 * 
 * This validator calls HAPI for structural validation and filters the results
 * to return only structural issues (not profile, terminology, etc.).
 * 
 * File size: Target <400 lines (global.mdc compliance)
 */

import type { ValidationIssue } from '../types/validation-types';
import { hapiValidatorClient } from './hapi-validator-client';
import type { HapiValidationOptions } from './hapi-validator-types';

// ============================================================================
// HAPI Structural Validator
// ============================================================================

export class HapiStructuralValidator {
  /**
   * Validate resource structure using HAPI FHIR Validator
   * 
   * @param resource - FHIR resource to validate
   * @param resourceType - Expected resource type
   * @param fhirVersion - FHIR version (R4, R5, or R6)
   * @param settings - Optional validation settings for best practice checks
   * @returns Array of structural validation issues only
   */
  async validate(
    resource: any,
    resourceType: string,
    fhirVersion: 'R4' | 'R5' | 'R6',
    settings?: any
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();

    try {
      console.log(`[HapiStructuralValidator] Validating ${resourceType} structure with HAPI (${fhirVersion})...`);

      // Basic pre-validation checks
      const preValidationIssues = this.performPreValidation(resource, resourceType);
      if (preValidationIssues.length > 0) {
        // Return early if basic structure is invalid
        return preValidationIssues;
      }

      // Build validation options for HAPI
      const options: HapiValidationOptions = {
        fhirVersion,
        mode: 'online', // Use online mode for better coverage
        enableBestPractice: settings?.enableBestPracticeChecks ?? true,
        validationLevel: 'hints', // Show all message types
        // No profile specified - structural validation only
      };

      // Call HAPI validator
      const allIssues = await hapiValidatorClient.validateResource(resource, options);

      // Filter to structural issues only
      const structuralIssues = this.filterStructuralIssues(allIssues);

      const validationTime = Date.now() - startTime;
      console.log(
        `[HapiStructuralValidator] Validated ${resourceType} in ${validationTime}ms ` +
        `(${structuralIssues.length} structural issues, ${allIssues.length} total)`
      );

      return structuralIssues;

    } catch (error) {
      console.error(`[HapiStructuralValidator] Validation failed for ${resourceType}:`, error);
      
      // Return error as validation issue
      return [{
        id: `hapi-structural-error-${Date.now()}`,
        aspect: 'structural',
        severity: 'error',
        code: 'hapi-validation-error',
        message: `HAPI structural validation failed: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      }];
    }
  }

  /**
   * Perform basic pre-validation checks
   * These catch fundamental issues before calling HAPI
   */
  private performPreValidation(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if resource is an object
    if (typeof resource !== 'object' || resource === null) {
      issues.push({
        id: `pre-validation-${Date.now()}-1`,
        aspect: 'structural',
        severity: 'error',
        code: 'invalid-json',
        message: 'Resource must be a valid JSON object',
        path: '',
        timestamp: new Date(),
      });
      return issues;
    }

    // Check if resourceType field exists
    if (!resource.resourceType) {
      issues.push({
        id: `pre-validation-${Date.now()}-2`,
        aspect: 'structural',
        severity: 'error',
        code: 'required-element-missing',
        message: 'Resource type is required',
        path: 'resourceType',
        timestamp: new Date(),
      });
      return issues;
    }

    // Check if resourceType matches expected type
    if (resource.resourceType !== resourceType) {
      issues.push({
        id: `pre-validation-${Date.now()}-3`,
        aspect: 'structural',
        severity: 'error',
        code: 'resource-type-mismatch',
        message: `Expected resourceType '${resourceType}' but found '${resource.resourceType}'`,
        path: 'resourceType',
        timestamp: new Date(),
      });
    }

    return issues;
  }

  /**
   * Filter HAPI validation issues to only structural ones
   * 
   * HAPI returns all types of issues. We only want structural issues for this validator.
   * Other aspects (profile, terminology, etc.) are handled by their respective validators.
   */
  private filterStructuralIssues(allIssues: ValidationIssue[]): ValidationIssue[] {
    return allIssues.filter(issue => {
      // Already tagged as structural by hapi-issue-mapper
      if (issue.aspect === 'structural') {
        return true;
      }

      // Additional check: look for structural-related codes
      const code = issue.code?.toLowerCase() || '';
      const message = issue.message?.toLowerCase() || '';

      const structuralKeywords = [
        'structure',
        'required',
        'cardinality',
        'datatype',
        'missing',
        'invalid',
        'type',
        'format',
        'syntax',
      ];

      return structuralKeywords.some(keyword => 
        code.includes(keyword) || message.includes(keyword)
      );
    });
  }

  /**
   * Detect FHIR version from resource
   * 
   * This is a fallback method in case the version is not provided.
   * Prefers server-level version detection (from CapabilityStatement).
   */
  detectFhirVersion(resource: any): 'R4' | 'R5' | 'R6' {
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

    // Check for version-specific fields
    // R5/R6 have more complex contained resource handling
    if (resource.contained && Array.isArray(resource.contained) && resource.contained.length > 0) {
      // Check for R6-specific contained fields
      const hasR6Fields = resource.contained.some((contained: any) => 
        contained.versionAlgorithm || contained.copyrightLabel
      );
      if (hasR6Fields) return 'R6';

      // Assume R5 if complex contained resources
      return 'R5';
    }

    // Default to R4 for backward compatibility
    return 'R4';
  }

  /**
   * Check if HAPI validator is available and configured
   */
  async isAvailable(): Promise<boolean> {
    try {
      const setupResult = await hapiValidatorClient.testSetup();
      return setupResult.success;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const hapiStructuralValidator = new HapiStructuralValidator();

