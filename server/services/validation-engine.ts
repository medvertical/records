import { FhirClient, FhirOperationOutcome } from './fhir-client.js';
import { ValidationError } from '@shared/schema.js';

export interface ValidationConfig {
  strictMode: boolean;
  requiredFields: string[];
  customRules: ValidationRule[];
}

export interface ValidationRule {
  path: string;
  type: 'required' | 'pattern' | 'valueSet' | 'custom';
  rule: string | RegExp | ((value: any) => boolean);
  message: string;
  severity: 'error' | 'warning' | 'information';
}

export class ValidationEngine {
  private fhirClient: FhirClient;
  private profileCache: Map<string, any> = new Map();

  constructor(fhirClient: FhirClient) {
    this.fhirClient = fhirClient;
  }

  async validateResource(
    resource: any,
    profileUrl?: string,
    config: Partial<ValidationConfig> = {}
  ): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Perform FHIR server validation if available
      if (profileUrl) {
        const serverValidation = await this.fhirClient.validateResource(resource, profileUrl);
        this.processOperationOutcome(serverValidation, errors, warnings);
      }

      // Perform custom validation rules
      if (config.customRules) {
        this.applyCustomRules(resource, config.customRules, errors, warnings);
      }

      // Perform basic structure validation
      this.validateBasicStructure(resource, errors, warnings);

      // Check required fields if specified
      if (config.requiredFields) {
        this.validateRequiredFields(resource, config.requiredFields, errors, warnings);
      }

    } catch (error: any) {
      errors.push({
        severity: 'error',
        message: `Validation error: ${error.message}`,
        path: 'root',
        code: 'validation-failed',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateAgainstProfile(resource: any, profileUrl: string): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }> {
    try {
      // Try to get profile from cache or fetch it
      let profile = this.profileCache.get(profileUrl);
      if (!profile) {
        profile = await this.fetchProfile(profileUrl);
        if (profile) {
          this.profileCache.set(profileUrl, profile);
        }
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];

      // Use FHIR server validation
      const operationOutcome = await this.fhirClient.validateResource(resource, profileUrl);
      this.processOperationOutcome(operationOutcome, errors, warnings);

      // Additional profile-specific validation if we have the profile
      if (profile) {
        this.validateAgainstStructureDefinition(resource, profile, errors, warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error: any) {
      return {
        isValid: false,
        errors: [{
          severity: 'error',
          message: `Profile validation failed: ${error.message}`,
          path: 'root',
          code: 'profile-validation-failed',
        }],
        warnings: [],
      };
    }
  }

  private async fetchProfile(profileUrl: string): Promise<any> {
    try {
      // Try to fetch the profile from the FHIR server
      const profileId = profileUrl.split('/').pop();
      if (profileId) {
        return await this.fhirClient.getResource('StructureDefinition', profileId);
      }
    } catch (error) {
      console.warn(`Could not fetch profile ${profileUrl}:`, error);
    }
    return null;
  }

  private processOperationOutcome(
    outcome: FhirOperationOutcome,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    outcome.issue.forEach(issue => {
      const validationError: ValidationError = {
        severity: issue.severity as ValidationError['severity'],
        message: issue.details?.text || issue.diagnostics || 'Validation issue',
        path: issue.location?.[0] || issue.expression?.[0] || 'unknown',
        code: issue.code,
      };

      if (issue.expression) {
        validationError.expression = issue.expression[0];
      }

      if (issue.severity === 'error' || issue.severity === 'fatal') {
        errors.push(validationError);
      } else if (issue.severity === 'warning') {
        warnings.push(validationError);
      }
    });
  }

  private applyCustomRules(
    resource: any,
    rules: ValidationRule[],
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    rules.forEach(rule => {
      const value = this.getValueByPath(resource, rule.path);
      let isValid = true;

      switch (rule.type) {
        case 'required':
          isValid = value !== undefined && value !== null && value !== '';
          break;
        case 'pattern':
          if (value && rule.rule instanceof RegExp) {
            isValid = rule.rule.test(String(value));
          }
          break;
        case 'custom':
          if (typeof rule.rule === 'function') {
            isValid = rule.rule(value);
          }
          break;
      }

      if (!isValid) {
        const validationError: ValidationError = {
          severity: rule.severity,
          message: rule.message,
          path: rule.path,
          code: `custom-${rule.type}`,
        };

        if (rule.severity === 'error') {
          errors.push(validationError);
        } else {
          warnings.push(validationError);
        }
      }
    });
  }

  private validateBasicStructure(
    resource: any,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Check for required base fields
    if (!resource.resourceType) {
      errors.push({
        severity: 'error',
        message: 'Resource must have a resourceType',
        path: 'resourceType',
        code: 'required-field',
      });
    }

    // Validate resource type is known
    const knownResourceTypes = [
      'Patient', 'Observation', 'Encounter', 'Condition', 'Procedure',
      'DiagnosticReport', 'MedicationRequest', 'AllergyIntolerance',
      'Immunization', 'Organization', 'Practitioner', 'Location'
    ];

    if (resource.resourceType && !knownResourceTypes.includes(resource.resourceType)) {
      warnings.push({
        severity: 'warning',
        message: `Unknown resource type: ${resource.resourceType}`,
        path: 'resourceType',
        code: 'unknown-resource-type',
      });
    }
  }

  private validateRequiredFields(
    resource: any,
    requiredFields: string[],
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    requiredFields.forEach(field => {
      const value = this.getValueByPath(resource, field);
      if (value === undefined || value === null || value === '') {
        errors.push({
          severity: 'error',
          message: `Required field '${field}' is missing or empty`,
          path: field,
          code: 'required-field',
        });
      }
    });
  }

  private validateAgainstStructureDefinition(
    resource: any,
    profile: any,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // This would implement detailed profile validation
    // For now, we'll do basic checks based on the profile structure
    if (profile.snapshot?.element) {
      profile.snapshot.element.forEach((element: any) => {
        if (element.min > 0) {
          // This is a required element
          const path = element.path.replace(`${resource.resourceType}.`, '');
          const value = this.getValueByPath(resource, path);
          
          if (value === undefined || value === null) {
            errors.push({
              severity: 'error',
              message: `Required element '${path}' is missing (required by profile)`,
              path,
              code: 'profile-required-field',
            });
          }
        }
      });
    }
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return current[key];
      }
      return undefined;
    }, obj);
  }
}
