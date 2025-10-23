/**
 * Structural Validator (Facade)
 * 
 * Main entry point for structural validation. Acts as a facade that:
 * 1. Tries HAPI FHIR Validator (comprehensive, HL7-compliant)
 * 2. Falls back to schema validator (basic JSON schema validation)
 * 3. Provides FHIR version detection
 * 
 * This replaces the 1595-line stub implementation with real validation.
 * 
 * Architecture:
 * - Delegates to hapi-structural-validator.ts for primary validation
 * - Falls back to schema-structural-validator.ts if HAPI unavailable
 * - Maintains backward compatibility with existing validation engine
 * 
 * File size: Target <400 lines (global.mdc compliance)
 */

import type { ValidationIssue } from '../types/validation-types';
import { hapiStructuralValidator } from './structural-validator-hapi';
import { schemaStructuralValidator } from './structural-validator-schema';
import type { HapiValidationCoordinator } from './hapi-validation-coordinator';

// ============================================================================
// Structural Validator (Facade)
// ============================================================================

export class StructuralValidator {
  private hapiAvailable: boolean | null = null;
  private hapiCheckInProgress = false;

  /**
   * Validate resource structure
   * 
   * Tries HAPI validator first, falls back to schema validator if unavailable.
   * 
   * @param resource - FHIR resource to validate
   * @param resourceType - Expected resource type
   * @param fhirVersion - FHIR version (optional, will be detected if not provided)
   * @param settings - Optional validation settings for best practice checks
   * @returns Array of structural validation issues
   */
  async validate(
    resource: any, 
    resourceType: string,
    fhirVersion?: 'R4' | 'R5' | 'R6', // Task 2.4: Accept FHIR version parameter
    settings?: any,
    coordinator?: HapiValidationCoordinator
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();

    try {
      console.log(`[StructuralValidator] Validating ${resourceType} resource structure...`);

      // Task 2.4: Use provided version or detect from resource (fallback)
      const version = fhirVersion || this.detectFhirVersion(resource);
      console.log(`[StructuralValidator] FHIR version: ${version} (${fhirVersion ? 'provided' : 'detected'})`);

      // Basic pre-validation
      const preValidationIssues = this.performPreValidation(resource, resourceType);
      if (preValidationIssues.length > 0 && preValidationIssues.some(i => i.severity === 'error')) {
        // Return early if basic structure is invalid
        return preValidationIssues;
      }

      // Check coordinator first
      if (coordinator) {
        const resourceId = `${resource.resourceType}/${resource.id}`;
        const coordinatorIssues = coordinator.getIssuesByAspect(resourceId, 'structural');
        
        if (coordinatorIssues.length > 0 || coordinator.hasBeenInitialized(resourceId)) {
          console.log(`[StructuralValidator] Using ${coordinatorIssues.length} issues from coordinator`);
          // Add any pre-validation issues
          coordinatorIssues.unshift(...preValidationIssues);
          const validationTime = Date.now() - startTime;
          console.log(
            `[StructuralValidator] Validated ${resourceType} in ${validationTime}ms ` +
            `(${coordinatorIssues.length} issues, source: coordinator)`
          );
          return coordinatorIssues;
        }
      }

      // Check HAPI availability (cached)
      await this.checkHapiAvailability();

      let issues: ValidationIssue[] = [];

      if (this.hapiAvailable) {
        // Use HAPI validator (primary)
        try {
          console.log(`[StructuralValidator] Using HAPI validator...`);
          issues = await hapiStructuralValidator.validate(resource, resourceType, version, settings);
        } catch (hapiError) {
          console.warn(`[StructuralValidator] HAPI validation failed, falling back to schema:`, hapiError);
          // Fall back to schema validator
          issues = await schemaStructuralValidator.validate(resource, resourceType, version);
        }
      } else {
        // Use schema validator (fallback)
        console.log(`[StructuralValidator] Using schema validator (HAPI not available)...`);
        issues = await schemaStructuralValidator.validate(resource, resourceType, version);
      }

      // Add any pre-validation issues
      issues.unshift(...preValidationIssues);

      const validationTime = Date.now() - startTime;
      console.log(
        `[StructuralValidator] Validated ${resourceType} in ${validationTime}ms ` +
        `(${issues.length} issues, validator: ${this.hapiAvailable ? 'HAPI' : 'schema'})`
      );

      return issues;

    } catch (error) {
      console.error(`[StructuralValidator] Validation failed for ${resourceType}:`, error);
      
      return [{
        id: `structural-error-${Date.now()}`,
        aspect: 'structural',
        severity: 'error',
        code: 'validation-error',
        message: `Structural validation failed: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      }];
    }
  }

  /**
   * Perform basic pre-validation checks
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
   * Check HAPI validator availability (cached)
   */
  private async checkHapiAvailability(): Promise<void> {
    // Check if explicitly disabled via environment variable (e.g., Vercel deployment)
    const hapiEnabled = process.env.HAPI_ENABLED !== 'false';
    const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    if (!hapiEnabled || isServerless) {
      if (this.hapiAvailable === null) {
        console.log(`[StructuralValidator] HAPI validator disabled (${isServerless ? 'serverless environment' : 'HAPI_ENABLED=false'}), using schema validator`);
        this.hapiAvailable = false;
      }
      return;
    }
    
    // Return cached result if available
    if (this.hapiAvailable !== null) {
      return;
    }

    // Avoid concurrent checks
    if (this.hapiCheckInProgress) {
      // Wait a bit and return cached result
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    try {
      this.hapiCheckInProgress = true;
      this.hapiAvailable = await hapiStructuralValidator.isAvailable();
      console.log(`[StructuralValidator] HAPI validator available: ${this.hapiAvailable}`);
    } catch (error) {
      console.warn(`[StructuralValidator] Failed to check HAPI availability:`, error);
      this.hapiAvailable = false;
    } finally {
      this.hapiCheckInProgress = false;
    }
  }

  /**
   * Detect FHIR version from resource metadata
   * 
   * Priority:
   * 1. Server-level version (should be provided by caller via ValidationContext)
   * 2. Resource meta.profile
   * 3. Resource-specific fields
   * 4. Default to R4
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

    // Check for R6-specific fields
    if (resource.versionAlgorithm || resource.copyrightLabel) {
      return 'R6';
    }

    // Check for R5-specific fields
    if (resource.contained && Array.isArray(resource.contained) && resource.contained.length > 0) {
      // R5 has better contained resource support
      const hasComplexContained = resource.contained.some((c: any) => 
        c.meta?.profile || c.extension
      );
      if (hasComplexContained) {
        return 'R5';
      }
    }

    // Check meta.versionId (though this is usually not reliable)
    if (resource.meta?.versionId) {
      const versionId = String(resource.meta.versionId);
      if (versionId.includes('R6') || versionId.includes('6.')) return 'R6';
      if (versionId.includes('R5') || versionId.includes('5.')) return 'R5';
    }

    // Default to R4 for backward compatibility
    return 'R4';
  }

  /**
   * Force refresh of HAPI availability check
   * Useful after HAPI setup or configuration changes
   */
  async refreshHapiAvailability(): Promise<boolean> {
    this.hapiAvailable = null;
    await this.checkHapiAvailability();
    return this.hapiAvailable === true;
  }

  /**
   * Get current validator status
   */
  getValidatorStatus(): {
    hapiAvailable: boolean | null;
    schemaAvailable: boolean;
    preferredValidator: 'hapi' | 'schema' | 'unknown';
  } {
    return {
      hapiAvailable: this.hapiAvailable,
      schemaAvailable: schemaStructuralValidator.isAvailable(),
      preferredValidator: this.hapiAvailable === true ? 'hapi' : 
                         this.hapiAvailable === false ? 'schema' : 
                         'unknown',
    };
  }
}

// Export singleton instance (maintains backward compatibility)
export const structuralValidator = new StructuralValidator();

// Re-export sub-validators for direct access if needed
export { hapiStructuralValidator, schemaStructuralValidator };
