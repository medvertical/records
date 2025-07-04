import { FhirClient, FhirOperationOutcome } from './fhir-client.js';
import { ValidationError } from '@shared/schema.js';

export interface ValidationConfig {
  strictMode: boolean;
  requiredFields: string[];
  customRules: ValidationRule[];
  autoValidate: boolean;
  profiles: string[];
}

export interface ValidationRule {
  path: string;
  type: 'required' | 'pattern' | 'valueSet' | 'custom' | 'cardinality' | 'terminology';
  rule: string | RegExp | ((value: any) => boolean);
  message: string;
  severity: 'error' | 'warning' | 'information';
  code?: string;
  expression?: string;
}

export interface DetailedValidationResult {
  isValid: boolean;
  resourceType: string;
  resourceId?: string;
  profileUrl?: string;
  profileName?: string;
  issues: ValidationIssue[];
  summary: ValidationSummary;
  validatedAt: Date;
}

export interface ValidationIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  details: string;
  diagnostics?: string;
  location: string[];
  expression?: string[];
  humanReadable: string;
  suggestion?: string;
  category: 'structure' | 'cardinality' | 'terminology' | 'business-rule' | 'format';
}

export interface ValidationSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  fatalCount: number;
  score: number; // 0-100 validation score
}

export class ValidationEngine {
  private fhirClient: FhirClient;
  private profileCache: Map<string, any> = new Map();
  private humanReadableMessages: Map<string, string> = new Map();

  constructor(fhirClient: FhirClient) {
    this.fhirClient = fhirClient;
    this.initializeHumanReadableMessages();
  }

  private initializeHumanReadableMessages() {
    // Common validation error messages in human-readable format
    this.humanReadableMessages.set('structure-definition-not-found', 'The resource structure does not match any known FHIR profile');
    this.humanReadableMessages.set('required-element-missing', 'A required field is missing from this resource');
    this.humanReadableMessages.set('cardinality-violation', 'This field has too many or too few values');
    this.humanReadableMessages.set('terminology-error', 'The code or value is not from the expected terminology system');
    this.humanReadableMessages.set('invariant-failed', 'A business rule constraint has been violated');
    this.humanReadableMessages.set('format-error', 'The data format is incorrect or invalid');
    this.humanReadableMessages.set('reference-not-found', 'A referenced resource could not be found');
    this.humanReadableMessages.set('extension-not-allowed', 'This extension is not permitted in this context');
    this.humanReadableMessages.set('value-out-of-range', 'The value is outside the allowed range');
    this.humanReadableMessages.set('pattern-mismatch', 'The value does not match the required pattern');
  }

  async validateResourceDetailed(
    resource: any,
    config: ValidationConfig = { 
      strictMode: false, 
      requiredFields: [], 
      customRules: [], 
      autoValidate: true, 
      profiles: [] 
    }
  ): Promise<DetailedValidationResult> {
    const startTime = new Date();
    const issues: ValidationIssue[] = [];
    
    try {
      // Basic structure validation
      const structureIssues = await this.validateBasicStructureDetailed(resource);
      issues.push(...structureIssues);
      
      // Required fields validation
      const requiredFieldIssues = await this.validateRequiredFieldsDetailed(resource, config.requiredFields);
      issues.push(...requiredFieldIssues);
      
      // Profile-specific validation
      for (const profileUrl of config.profiles) {
        const profileIssues = await this.validateAgainstProfileDetailed(resource, profileUrl);
        issues.push(...profileIssues);
      }
      
      // Custom business rules
      const customIssues = await this.applyCustomRulesDetailed(resource, config.customRules);
      issues.push(...customIssues);
      
      // FHIR server validation
      if (this.fhirClient) {
        const serverIssues = await this.validateWithFhirServer(resource, config.profiles[0]);
        issues.push(...serverIssues);
      }
      
      // Calculate validation summary
      const summary = this.calculateValidationSummary(issues);
      
      return {
        isValid: summary.errorCount === 0 && summary.fatalCount === 0,
        resourceType: resource.resourceType || 'Unknown',
        resourceId: resource.id,
        profileUrl: config.profiles[0],
        profileName: await this.getProfileName(config.profiles[0]),
        issues,
        summary,
        validatedAt: startTime
      };
    } catch (error: any) {
      // Handle validation engine errors
      const fatalIssue: ValidationIssue = {
        severity: 'fatal',
        code: 'validation-engine-error',
        details: `Validation engine encountered an error: ${error.message}`,
        location: ['resource'],
        humanReadable: 'The validation process failed due to an internal error. Please check the resource format and try again.',
        suggestion: 'Ensure the resource is valid JSON and follows FHIR structure conventions.',
        category: 'format'
      };
      
      return {
        isValid: false,
        resourceType: resource.resourceType || 'Unknown',
        resourceId: resource.id,
        issues: [fatalIssue],
        summary: {
          totalIssues: 1,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          fatalCount: 1,
          score: 0
        },
        validatedAt: startTime
      };
    }
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

  // Enhanced validation methods for detailed results
  private async validateBasicStructureDetailed(resource: any): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!resource || typeof resource !== 'object') {
      issues.push({
        severity: 'fatal',
        code: 'invalid-resource-format',
        details: 'Resource must be a valid JSON object',
        location: ['resource'],
        humanReadable: 'The resource is not properly formatted. It should be a valid JSON object.',
        suggestion: 'Ensure the resource is valid JSON and contains proper FHIR structure.',
        category: 'format'
      });
      return issues;
    }

    if (!resource.resourceType) {
      issues.push({
        severity: 'error',
        code: 'missing-resource-type',
        details: 'Resource must have a resourceType field',
        location: ['resourceType'],
        humanReadable: 'Every FHIR resource must specify what type of resource it is.',
        suggestion: 'Add a "resourceType" field with a valid FHIR resource type (e.g., "Patient", "Observation").',
        category: 'structure'
      });
    }

    return issues;
  }

  private async validateRequiredFieldsDetailed(resource: any, requiredFields: string[]): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const fieldPath of requiredFields) {
      const value = this.getValueByPath(resource, fieldPath);
      if (value === undefined || value === null || value === '') {
        const fieldName = fieldPath.split('.').pop() || fieldPath;
        issues.push({
          severity: 'error',
          code: 'required-field-missing',
          details: `Required field '${fieldPath}' is missing or empty`,
          location: fieldPath.split('.'),
          humanReadable: `The field "${fieldName}" is required but was not provided or is empty.`,
          suggestion: `Add a value for the "${fieldName}" field. Check the FHIR specification for valid values.`,
          category: 'structure'
        });
      }
    }

    return issues;
  }

  private async validateAgainstProfileDetailed(resource: any, profileUrl: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!profileUrl) return issues;

    try {
      const originalResult = await this.validateAgainstProfile(resource, profileUrl);
      
      for (const error of originalResult.errors) {
        issues.push({
          severity: 'error',
          code: error.code || 'profile-validation-error',
          details: error.message,
          location: [error.path],
          expression: error.expression ? [error.expression] : undefined,
          humanReadable: this.makeHumanReadable(error.message, error.code),
          suggestion: this.getSuggestion(error.code, error.path),
          category: this.categorizeError(error.code)
        });
      }

      for (const warning of originalResult.warnings) {
        issues.push({
          severity: 'warning',
          code: warning.code || 'profile-validation-warning',
          details: warning.message,
          location: [warning.path],
          humanReadable: this.makeHumanReadable(warning.message, warning.code),
          category: this.categorizeError(warning.code)
        });
      }
    } catch (error: any) {
      issues.push({
        severity: 'error',
        code: 'profile-validation-failed',
        details: `Profile validation failed: ${error.message}`,
        location: ['resource'],
        humanReadable: 'Could not validate against the specified profile.',
        category: 'structure'
      });
    }

    return issues;
  }

  private async applyCustomRulesDetailed(resource: any, customRules: ValidationRule[]): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const rule of customRules) {
      const value = this.getValueByPath(resource, rule.path);
      let isValid = true;

      try {
        switch (rule.type) {
          case 'required':
            isValid = value !== undefined && value !== null && value !== '';
            break;
          case 'pattern':
            if (value && typeof rule.rule === 'string') {
              const regex = new RegExp(rule.rule);
              isValid = regex.test(String(value));
            }
            break;
          case 'custom':
            if (typeof rule.rule === 'function') {
              isValid = rule.rule(value);
            }
            break;
        }

        if (!isValid) {
          issues.push({
            severity: rule.severity,
            code: rule.code || `custom-rule-${rule.type}`,
            details: rule.message,
            location: rule.path.split('.'),
            humanReadable: rule.message,
            category: 'business-rule'
          });
        }
      } catch (error: any) {
        issues.push({
          severity: 'error',
          code: 'custom-rule-error',
          details: `Custom rule evaluation failed: ${error.message}`,
          location: rule.path.split('.'),
          humanReadable: 'A business rule validation failed.',
          category: 'business-rule'
        });
      }
    }

    return issues;
  }

  private async validateWithFhirServer(resource: any, profileUrl?: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      const outcome = await this.fhirClient.validateResource(resource, profileUrl);
      
      if (outcome.issue) {
        for (const issue of outcome.issue) {
          issues.push({
            severity: issue.severity,
            code: issue.code,
            details: issue.details?.text || issue.diagnostics || 'FHIR server validation issue',
            location: issue.location || ['resource'],
            humanReadable: this.makeHumanReadable(issue.details?.text || issue.diagnostics, issue.code),
            category: this.categorizeError(issue.code)
          });
        }
      }
    } catch (error: any) {
      issues.push({
        severity: 'warning',
        code: 'server-validation-unavailable',
        details: `FHIR server validation unavailable: ${error.message}`,
        location: ['resource'],
        humanReadable: 'Could not validate with the FHIR server. Basic validation was performed instead.',
        category: 'structure'
      });
    }

    return issues;
  }

  private calculateValidationSummary(issues: ValidationIssue[]): ValidationSummary {
    const summary: ValidationSummary = {
      totalIssues: issues.length,
      errorCount: 0,
      warningCount: 0,
      informationCount: 0,
      fatalCount: 0,
      score: 100
    };

    for (const issue of issues) {
      switch (issue.severity) {
        case 'fatal':
          summary.fatalCount++;
          break;
        case 'error':
          summary.errorCount++;
          break;
        case 'warning':
          summary.warningCount++;
          break;
        case 'information':
          summary.informationCount++;
          break;
      }
    }

    let deduction = summary.fatalCount * 50 + summary.errorCount * 10 + summary.warningCount * 2;
    summary.score = Math.max(0, 100 - deduction);

    return summary;
  }

  private async getProfileName(profileUrl?: string): Promise<string | undefined> {
    if (!profileUrl) return undefined;
    
    try {
      const profile = this.profileCache.get(profileUrl);
      return profile?.name || profile?.title || profileUrl.split('/').pop();
    } catch {
      return profileUrl.split('/').pop();
    }
  }

  private makeHumanReadable(message?: string, code?: string): string {
    if (!message && !code) return 'An unknown validation issue occurred.';
    
    if (code && this.humanReadableMessages.has(code)) {
      return this.humanReadableMessages.get(code)!;
    }
    
    if (message) {
      if (message.includes('required') && message.includes('missing')) {
        return 'A required field is missing from this resource.';
      }
      if (message.includes('cardinality')) {
        return 'This field has the wrong number of values.';
      }
      if (message.includes('terminology')) {
        return 'The code value is not from the expected terminology.';
      }
      return message;
    }
    
    return 'A validation issue was found.';
  }

  private getSuggestion(code?: string, path?: string): string {
    const fieldName = path?.split('.').pop() || 'field';
    
    switch (code) {
      case 'required-field-missing':
        return `Add a value for the "${fieldName}" field.`;
      case 'cardinality-violation':
        return `Check the allowed number of values for "${fieldName}".`;
      case 'terminology-error':
        return `Use a valid code for "${fieldName}".`;
      default:
        return `Review the FHIR specification for "${fieldName}".`;
    }
  }

  private categorizeError(code?: string): 'structure' | 'cardinality' | 'terminology' | 'business-rule' | 'format' {
    if (!code) return 'structure';
    
    if (code.includes('cardinality')) return 'cardinality';
    if (code.includes('terminology')) return 'terminology';
    if (code.includes('invariant')) return 'business-rule';
    if (code.includes('format')) return 'format';
    
    return 'structure';
  }
}
