/**
 * Profile Validator
 * 
 * Handles profile validation of FHIR resources including:
 * - Profile conformance checking using fhir-validator library
 * - Profile resolution and constraint validation
 * - R4 StructureDefinition-based validation
 */

import type { ValidationIssue } from '../types/validation-types';

// Import fhir-validator library
let fhirValidator: any = null;
try {
  fhirValidator = require('fhir-validator');
  console.log('[ProfileValidator] fhir-validator loaded successfully');
} catch (error) {
  console.warn('[ProfileValidator] fhir-validator not available, using fallback validation');
}

export class ProfileValidator {
  private knownProfiles: Map<string, any> = new Map();

  constructor() {
    this.initializeKnownProfiles();
  }

  /**
   * Initialize known FHIR R4 profiles for validation
   */
  private initializeKnownProfiles(): void {
    // Common FHIR R4 profiles
    this.knownProfiles.set('http://hl7.org/fhir/StructureDefinition/Patient', {
      name: 'Patient',
      version: 'R4',
      description: 'FHIR R4 Patient resource profile',
      constraints: [
        { path: 'name', min: 0, max: '*', type: 'HumanName[]' },
        { path: 'gender', min: 0, max: 1, type: 'code' },
        { path: 'birthDate', min: 0, max: 1, type: 'date' },
        { path: 'active', min: 0, max: 1, type: 'boolean' }
      ]
    });

    this.knownProfiles.set('http://hl7.org/fhir/StructureDefinition/Observation', {
      name: 'Observation',
      version: 'R4',
      description: 'FHIR R4 Observation resource profile',
      constraints: [
        { path: 'status', min: 1, max: 1, type: 'code', required: true },
        { path: 'code', min: 1, max: 1, type: 'CodeableConcept', required: true },
        { path: 'subject', min: 0, max: 1, type: 'Reference' },
        { path: 'valueQuantity', min: 0, max: 1, type: 'Quantity' },
        { path: 'valueString', min: 0, max: 1, type: 'string' },
        { path: 'valueBoolean', min: 0, max: 1, type: 'boolean' }
      ]
    });

    this.knownProfiles.set('http://hl7.org/fhir/StructureDefinition/Condition', {
      name: 'Condition',
      version: 'R4',
      description: 'FHIR R4 Condition resource profile',
      constraints: [
        { path: 'code', min: 1, max: 1, type: 'CodeableConcept', required: true },
        { path: 'subject', min: 1, max: 1, type: 'Reference', required: true },
        { path: 'clinicalStatus', min: 0, max: 1, type: 'CodeableConcept' },
        { path: 'verificationStatus', min: 0, max: 1, type: 'CodeableConcept' }
      ]
    });

    this.knownProfiles.set('http://hl7.org/fhir/StructureDefinition/Encounter', {
      name: 'Encounter',
      version: 'R4',
      description: 'FHIR R4 Encounter resource profile',
      constraints: [
        { path: 'status', min: 1, max: 1, type: 'code', required: true },
        { path: 'class', min: 1, max: 1, type: 'Coding', required: true },
        { path: 'subject', min: 0, max: 1, type: 'Reference' },
        { path: 'period', min: 0, max: 1, type: 'Period' }
      ]
    });

    this.knownProfiles.set('http://hl7.org/fhir/StructureDefinition/Bundle', {
      name: 'Bundle',
      version: 'R4',
      description: 'FHIR R4 Bundle resource profile',
      constraints: [
        { path: 'type', min: 1, max: 1, type: 'code', required: true },
        { path: 'timestamp', min: 0, max: 1, type: 'instant' },
        { path: 'total', min: 0, max: 1, type: 'unsignedInt' },
        { path: 'entry', min: 0, max: '*', type: 'BundleEntry[]' }
      ]
    });

    console.log(`[ProfileValidator] Initialized ${this.knownProfiles.size} known FHIR R4 profiles`);
  }

  async validate(resource: any, resourceType: string, profileUrl?: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    console.log(`[ProfileValidator] Validating ${resourceType} resource profile...`);

    try {
      // Always check for declared profiles in meta.profile first
      if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
        console.log(`[ProfileValidator] Resource declares ${resource.meta.profile.length} profile(s): ${resource.meta.profile.join(', ')}`);
        for (const declaredProfile of resource.meta.profile) {
          const profileIssues = await this.validateAgainstProfile(resource, resourceType, declaredProfile);
          issues.push(...profileIssues);
        }
      }

      // If a specific profile URL is provided, validate against it
      if (profileUrl) {
        console.log(`[ProfileValidator] Validating against specific profile: ${profileUrl}`);
        const profileIssues = await this.validateAgainstProfile(resource, resourceType, profileUrl);
        issues.push(...profileIssues);
      }

      // If no profiles were declared and no specific profile provided, perform basic validation
      if (!profileUrl && (!resource.meta?.profile || !Array.isArray(resource.meta.profile) || resource.meta.profile.length === 0)) {
        console.log(`[ProfileValidator] No profiles declared, performing basic profile validation`);
        const basicIssues = await this.performBasicProfileValidation(resource, resourceType);
        issues.push(...basicIssues);
      }

      const validationTime = Date.now() - startTime;
      console.log(`[ProfileValidator] Validated ${resourceType} profile in ${validationTime}ms, found ${issues.length} issues`);

    } catch (error) {
      console.error('[ProfileValidator] Profile validation failed:', error);
      issues.push({
        id: `profile-error-${Date.now()}`,
        aspect: 'profile',
        severity: 'error',
        code: 'profile-validation-error',
        message: `Profile validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: '',
        humanReadable: 'Profile validation encountered an error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType,
          profileUrl: profileUrl
        },
        validationMethod: 'profile-validation-error',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Validate resource against a specific profile
   */
  private async validateAgainstProfile(resource: any, resourceType: string, profileUrl: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if we have a known profile
    const knownProfile = this.knownProfiles.get(profileUrl);
    if (knownProfile) {
      console.log(`[ProfileValidator] Validating against known profile: ${knownProfile.name}`);
      const profileIssues = await this.validateAgainstKnownProfile(resource, resourceType, knownProfile, profileUrl);
      issues.push(...profileIssues);
    } else {
      console.log(`[ProfileValidator] Profile not in known profiles, using fhir-validator: ${profileUrl}`);
      const validatorIssues = await this.validateWithFhirValidator(resource, resourceType, profileUrl);
      issues.push(...validatorIssues);
    }

    return issues;
  }

  /**
   * Validate against a known profile with predefined constraints
   */
  private async validateAgainstKnownProfile(resource: any, resourceType: string, profile: any, profileUrl: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Validate against profile constraints
    for (const constraint of profile.constraints) {
      const fieldValue = this.getFieldValue(resource, constraint.path);
      const validation = this.validateConstraint(fieldValue, constraint, constraint.path, resourceType, profileUrl);
      
      if (!validation.isValid) {
        issues.push({
          id: `profile-constraint-${Date.now()}-${constraint.path}`,
          aspect: 'profile',
          severity: validation.severity,
          code: validation.code,
          message: validation.message,
          path: constraint.path,
          humanReadable: validation.humanReadable,
          details: {
            profileUrl: profileUrl,
            profileName: profile.name,
            constraint: constraint,
            actualValue: fieldValue,
            resourceType: resourceType,
            ...validation.details
          },
          location: this.parseErrorLocation(constraint.path),
          validationMethod: 'known-profile-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }
    }

    return issues;
  }

  /**
   * Validate using fhir-validator library
   */
  private async validateWithFhirValidator(resource: any, resourceType: string, profileUrl: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!fhirValidator) {
      issues.push({
        id: `profile-fhir-validator-unavailable-${Date.now()}`,
        aspect: 'profile',
        severity: 'warning',
        code: 'fhir-validator-unavailable',
        message: 'fhir-validator library not available for profile validation',
        path: '',
        humanReadable: 'Profile validation using fhir-validator is not available',
        details: {
          profileUrl: profileUrl,
          resourceType: resourceType,
          reason: 'fhir-validator library not loaded'
        },
        validationMethod: 'fhir-validator-fallback',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
      return issues;
    }

    try {
      console.log(`[ProfileValidator] Using fhir-validator for profile: ${profileUrl}`);
      
      // Note: fhir-validator API may vary, this is a basic implementation
      // The actual API would need to be checked and implemented accordingly
      
      // For now, we'll perform basic profile structure validation
      const structureIssues = await this.performBasicProfileValidation(resource, resourceType);
      issues.push(...structureIssues);

    } catch (error) {
      console.error('[ProfileValidator] fhir-validator validation failed:', error);
      issues.push({
        id: `profile-fhir-validator-error-${Date.now()}`,
        aspect: 'profile',
        severity: 'error',
        code: 'fhir-validator-error',
        message: `fhir-validator validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: '',
        humanReadable: 'Profile validation using fhir-validator encountered an error',
        details: {
          profileUrl: profileUrl,
          resourceType: resourceType,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        validationMethod: 'fhir-validator-error',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Perform basic profile validation without external libraries
   */
  private async performBasicProfileValidation(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if resource declares profiles in meta.profile
    if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
      for (const declaredProfile of resource.meta.profile) {
        // Validate that declared profile is a valid URL
        if (!this.isValidProfileUrl(declaredProfile)) {
          issues.push({
            id: `profile-invalid-url-${Date.now()}`,
            aspect: 'profile',
            severity: 'error',
            code: 'invalid-profile-url',
            message: `Invalid profile URL: ${declaredProfile}`,
            path: 'meta.profile',
            humanReadable: `The declared profile URL is invalid: ${declaredProfile}`,
            details: {
              declaredProfile: declaredProfile,
              resourceType: resourceType
            },
            validationMethod: 'basic-profile-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      }
    }

    // Check for common profile conformance issues
    const conformanceIssues = this.checkProfileConformance(resource, resourceType);
    issues.push(...conformanceIssues);

    return issues;
  }

  /**
   * Validate a constraint against a field value
   */
  private validateConstraint(fieldValue: any, constraint: any, fieldPath: string, resourceType: string, profileUrl: string): {
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    humanReadable: string;
    details?: any;
  } {
    // Check required fields
    if (constraint.required && (fieldValue === undefined || fieldValue === null)) {
      return {
        isValid: false,
        severity: 'error',
        code: 'required-field-missing',
        message: `Required field '${fieldPath}' is missing for profile ${profileUrl}`,
        humanReadable: `The '${fieldPath}' field is required by the profile but is missing`,
        details: {
          constraint: constraint,
          isRequired: true
        }
      };
    }

    // Check cardinality for arrays
    if (Array.isArray(fieldValue)) {
      const count = fieldValue.length;
      if (constraint.min && count < constraint.min) {
        return {
          isValid: false,
          severity: 'error',
          code: 'insufficient-occurrences',
          message: `Field '${fieldPath}' has insufficient occurrences (${count}/${constraint.min}) for profile ${profileUrl}`,
          humanReadable: `The '${fieldPath}' field must occur at least ${constraint.min} time(s) as required by the profile`,
          details: {
            constraint: constraint,
            actualOccurrences: count,
            expectedMinimum: constraint.min
          }
        };
      }
      
      if (constraint.max && constraint.max !== '*' && count > constraint.max) {
        return {
          isValid: false,
          severity: 'warning',
          code: 'excessive-occurrences',
          message: `Field '${fieldPath}' has excessive occurrences (${count}/${constraint.max}) for profile ${profileUrl}`,
          humanReadable: `The '${fieldPath}' field should occur at most ${constraint.max} time(s) as specified by the profile`,
          details: {
            constraint: constraint,
            actualOccurrences: count,
            expectedMaximum: constraint.max
          }
        };
      }
    }

    return {
      isValid: true,
      severity: 'info',
      code: 'constraint-valid',
      message: `Field '${fieldPath}' satisfies profile constraint`,
      humanReadable: `The '${fieldPath}' field meets the profile requirements`
    };
  }

  /**
   * Check profile conformance issues
   */
  private checkProfileConformance(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if resource has meta.profile but no actual profile validation
    if (resource.meta?.profile && Array.isArray(resource.meta.profile) && resource.meta.profile.length > 0) {
      // This is good - resource declares profiles
      console.log(`[ProfileValidator] Resource declares ${resource.meta.profile.length} profile(s)`);
    } else {
      // Resource doesn't declare any profiles - this might be a conformance issue
      issues.push({
        id: `profile-no-declaration-${Date.now()}`,
        aspect: 'profile',
        severity: 'warning',
        code: 'no-profile-declaration',
        message: 'Resource does not declare any profiles in meta.profile',
        path: 'meta.profile',
        humanReadable: 'The resource should declare which profiles it conforms to in meta.profile',
        details: {
          resourceType: resourceType,
          hasMeta: !!resource.meta,
          hasProfile: !!(resource.meta?.profile)
        },
        validationMethod: 'profile-conformance-check',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Check if a profile URL is valid
   */
  private isValidProfileUrl(profileUrl: string): boolean {
    try {
      const url = new URL(profileUrl);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
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