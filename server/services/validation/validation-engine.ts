import { FhirClient, FhirOperationOutcome } from '../fhir/fhir-client.js';
import { ValidationError } from '@shared/schema.js';
import { TerminologyClient, defaultTerminologyConfig } from '../fhir/terminology-client.js';
import { errorHandler } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export interface ValidationConfig {
  strictMode: boolean;
  requiredFields: string[];
  customRules: ValidationRule[];
  autoValidate: boolean;
  profiles: string[];
  fetchFromSimplifier: boolean;
  fetchFromFhirServer: boolean;
  autoDetectProfiles: boolean;
  terminologyServer?: {
    enabled: boolean;
    url: string;
    type: string;
    description: string;
  };
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
  private simplifierClient: any;
  private terminologyClient: TerminologyClient;

  constructor(fhirClient: FhirClient) {
    this.fhirClient = fhirClient;
    this.terminologyClient = new TerminologyClient(defaultTerminologyConfig);
    this.initializeHumanReadableMessages();
    // Import simplifier client dynamically to avoid circular dependencies
    this.loadSimplifierClient();
  }

  private async loadSimplifierClient() {
    try {
      const { SimplifierClient } = await import('../fhir/simplifier-client');
      this.simplifierClient = new SimplifierClient();
      logger.validation(2, 'Simplifier client loaded successfully', 'loadSimplifierClient');
    } catch (error) {
      logger.validation(1, 'Simplifier client not available', 'loadSimplifierClient', { error: error.message });
      // This is not a critical error - validation can continue without Simplifier
      this.simplifierClient = null;
    }
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
      profiles: [],
      fetchFromSimplifier: true,
      fetchFromFhirServer: true,
      autoDetectProfiles: true
    }
  ): Promise<DetailedValidationResult> {
    const startTime = new Date();
    const issues: ValidationIssue[] = [];
    
    try {
      // Auto-detect profiles from resource if enabled
      let profilesToValidate = [...config.profiles];
      if (config.autoDetectProfiles) {
        const detectedProfiles = await this.detectProfilesFromResource(resource, config);
        profilesToValidate.push(...detectedProfiles);
        // Remove duplicates
        profilesToValidate = Array.from(new Set(profilesToValidate));
      }

      // Basic structure validation
      const structureIssues = await this.validateBasicStructureDetailed(resource);
      issues.push(...structureIssues);
      
      // Required fields validation
      const requiredFieldIssues = await this.validateRequiredFieldsDetailed(resource, config.requiredFields);
      issues.push(...requiredFieldIssues);
      
      // Profile-specific validation
      for (const profileUrl of profilesToValidate) {
        const profileIssues = await this.validateAgainstProfileDetailed(resource, profileUrl, config);
        issues.push(...profileIssues);
      }
      
      // Custom business rules
      const customIssues = await this.applyCustomRulesDetailed(resource, config.customRules);
      issues.push(...customIssues);
      
      // FHIR server validation
      if (this.fhirClient && config.fetchFromFhirServer) {
        const serverIssues = await this.validateWithFhirServer(resource, profilesToValidate[0]);
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
      // Use standardized error handling
      const standardizedError = errorHandler.handleValidationError(
        error,
        {
          service: 'validation-engine',
          operation: 'validateResource',
          resourceId: resource.id || 'unknown',
          metadata: { resourceType: resource.resourceType, profileUrl }
        }
      );

      errors.push({
        severity: 'error',
        message: standardizedError.message,
        path: 'root',
        code: standardizedError.code,
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
      
      // Process operation outcome and attempt to resolve extension references
      await this.processOperationOutcomeWithExtensionResolution(operationOutcome, errors, warnings);

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
      if (!profileUrl || typeof profileUrl !== 'string') return null;
      const profileId = profileUrl.split('/').pop();
      if (profileId) {
        return await this.fhirClient.getResource('StructureDefinition', profileId);
      }
    } catch (error) {
      console.warn(`Could not fetch profile ${profileUrl}:`, error);
    }
    return null;
  }

  public async processOperationOutcomeWithExtensionResolution(operationOutcome: FhirOperationOutcome, errors: ValidationError[], warnings: ValidationError[]) {
    for (const issue of operationOutcome.issue) {
      const isExtensionError = issue.diagnostics?.includes('Unable to resolve reference to extension') || 
                               issue.details?.text?.includes('Unable to resolve reference to extension');
      
      if (isExtensionError && this.terminologyClient) {
        // Extract extension URL from the error message
        const extensionUrl = this.extractExtensionUrlFromError(issue.diagnostics || issue.details?.text || '');
        
        if (extensionUrl) {
          try {
            // Attempt to resolve the extension from terminology server
            const structureDefinition = await this.terminologyClient.resolveExtension(extensionUrl);
            
            if (structureDefinition) {
              // Convert to warning instead of error since we can resolve it
              warnings.push({
                severity: 'warning',
                message: `Extension '${extensionUrl}' resolved from terminology server: ${structureDefinition.title || structureDefinition.name}`,
                path: issue.expression?.[0] || issue.location?.[0] || 'unknown',
                code: issue.code || 'extension-resolved',
              });
              continue; // Skip adding as error
            }
          } catch (error) {
            console.warn(`Failed to resolve extension ${extensionUrl}:`, error);
          }
        }
      }

      // Process as normal error/warning
      if (issue.severity === 'error' || issue.severity === 'fatal') {
        errors.push({
          severity: issue.severity as 'error',
          message: issue.details?.text || issue.diagnostics || 'Validation error',
          path: issue.expression?.[0] || issue.location?.[0] || 'unknown',
          code: issue.code || 'validation-error',
        });
      } else if (issue.severity === 'warning') {
        warnings.push({
          severity: 'warning',
          message: issue.details?.text || issue.diagnostics || 'Validation warning',
          path: issue.expression?.[0] || issue.location?.[0] || 'unknown',
          code: issue.code || 'validation-warning',
        });
      }
    }
  }

  private extractExtensionUrlFromError(errorMessage: string): string | null {
    // Extract URL from error messages like "Unable to resolve reference to extension 'http://hl7.org/fhir/StructureDefinition/birthPlace'"
    const match = errorMessage.match(/Unable to resolve reference to extension '([^']+)'/);
    if (match) {
      return match[1];
    }
    
    // Try alternative patterns
    const match2 = errorMessage.match(/extension["\s]*([http][^\s"']+)/i);
    if (match2) {
      return match2[1];
    }
    
    return null;
  }

  public updateTerminologyConfig(config: ValidationConfig) {
    if (config.terminologyServer) {
      this.terminologyClient.updateConfig(config.terminologyServer);
    }
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
    if (!path || typeof path !== 'string') return obj;
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
        const fieldName = (fieldPath && typeof fieldPath === 'string') ? fieldPath.split('.').pop() || fieldPath : fieldPath;
        issues.push({
          severity: 'error',
          code: 'required-field-missing',
          details: `Required field '${fieldPath}' is missing or empty`,
          location: (fieldPath && typeof fieldPath === 'string') ? fieldPath.split('.') : [fieldPath],
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
            location: (rule.path && typeof rule.path === 'string') ? rule.path.split('.') : [rule.path],
            humanReadable: rule.message,
            category: 'business-rule'
          });
        }
      } catch (error: any) {
        issues.push({
          severity: 'error',
          code: 'custom-rule-error',
          details: `Custom rule evaluation failed: ${error.message}`,
          location: (rule.path && typeof rule.path === 'string') ? rule.path.split('.') : [rule.path],
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
      if (profile?.name) return profile.name;
      if (profile?.title) return profile.title;
      if (profileUrl && typeof profileUrl === 'string') {
        return profileUrl.split('/').pop() || 'Unknown Profile';
      }
      return 'Unknown Profile';
    } catch {
      if (profileUrl && typeof profileUrl === 'string') {
        return profileUrl.split('/').pop() || 'Unknown Profile';
      }
      return 'Unknown Profile';
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
    const fieldName = (path && typeof path === 'string') ? path.split('.').pop() || 'field' : 'field';
    
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

  // Profile detection and fetching methods
  private async detectProfilesFromResource(resource: any, config: ValidationConfig): Promise<string[]> {
    const profiles: string[] = [];

    try {
      // Check meta.profile for explicit profile declarations
      if (resource.meta?.profile) {
        const resourceProfiles = Array.isArray(resource.meta.profile) 
          ? resource.meta.profile 
          : [resource.meta.profile];
        
        for (const profileUrl of resourceProfiles) {
          if (typeof profileUrl === 'string' && profileUrl.trim()) {
            profiles.push(profileUrl.trim());
          }
        }
      }

      // Check for implicit profiles based on resource type and extensions
      const implicitProfiles = await this.detectImplicitProfiles(resource, config);
      profiles.push(...implicitProfiles);

      return profiles;
    } catch (error) {
      console.warn('Error detecting profiles from resource:', error);
      return [];
    }
  }

  private async detectImplicitProfiles(resource: any, config: ValidationConfig): Promise<string[]> {
    const profiles: string[] = [];

    try {
      // Look for common US Core patterns based on extensions and identifiers
      if (resource.extension) {
        for (const ext of resource.extension) {
          if (ext.url) {
            // US Core birth place extension
            if (ext.url.includes('birthPlace')) {
              profiles.push('http://hl7.org/fhir/us/core/StructureDefinition/us-core-' + resource.resourceType.toLowerCase());
            }
            // Other US Core extensions
            if (ext.url.includes('us-core')) {
              profiles.push('http://hl7.org/fhir/us/core/StructureDefinition/us-core-' + resource.resourceType.toLowerCase());
            }
          }
        }
      }

      // Look for identifier systems that suggest US Core profiles
      if (resource.identifier) {
        for (const identifier of resource.identifier) {
          if (identifier.system) {
            // US Social Security Number suggests US Core
            if (identifier.system.includes('ssn') || identifier.system.includes('social-security')) {
              profiles.push('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
            }
          }
        }
      }

      return [...new Set(profiles)]; // Remove duplicates
    } catch (error) {
      console.warn('Error detecting implicit profiles:', error);
      return [];
    }
  }


  private async fetchProfileFromFhirServer(profileUrl: string): Promise<any> {
    try {
      // Extract the profile ID from the URL
      if (!profileUrl || typeof profileUrl !== 'string') return null;
      const profileId = profileUrl.split('/').pop();
      if (!profileId) return null;

      // Try to fetch as StructureDefinition
      const response = await this.fhirClient.getResource('StructureDefinition', profileId);
      return response;
    } catch (error) {
      console.warn(`Failed to fetch profile from FHIR server: ${profileUrl}`, error);
      return null;
    }
  }

  private async fetchProfileFromTerminologyServer(profileUrl: string): Promise<any> {
    try {
      if (!this.terminologyClient) return null;

      // Try to resolve the profile using terminology server
      const profile = await this.terminologyClient.resolveExtension(profileUrl);
      if (profile) {
        console.log(`Successfully fetched profile from terminology server: ${profileUrl}`);
        return profile;
      }

      // Fallback: try searching by URL
      const searchResults = await this.terminologyClient.searchStructureDefinitions(profileUrl);
      if (searchResults && searchResults.length > 0) {
        console.log(`Found profile via search on terminology server: ${profileUrl}`);
        return searchResults[0];
      }

      return null;
    } catch (error) {
      console.warn(`Could not fetch profile from terminology server: ${profileUrl}`, error);
      return null;
    }
  }

  private async fetchProfileFromSimplifier(profileUrl: string): Promise<any> {
    try {
      if (!this.simplifierClient) return null;

      // Try to get package details if the URL contains package information
      if (!profileUrl || typeof profileUrl !== 'string') return null;
      const urlParts = profileUrl.split('/');
      const packageId = this.extractPackageIdFromProfileUrl(profileUrl);
      
      if (packageId) {
        const packageDetails = await this.simplifierClient.getPackageDetails(packageId);
        if (packageDetails) {
          const profiles = await this.simplifierClient.getPackageProfiles(packageId);
          const matchingProfile = profiles.find((p: any) => p.url === profileUrl);
          return matchingProfile;
        }
      }

      // Fallback: search for the profile by URL
      const profiles = await this.simplifierClient.searchProfiles(profileUrl);
      return profiles.length > 0 ? profiles[0] : null;
    } catch (error) {
      console.warn(`Failed to fetch profile from Simplifier: ${profileUrl}`, error);
      return null;
    }
  }

  private extractPackageIdFromProfileUrl(profileUrl: string): string | null {
    try {
      // Common patterns for profile URLs:
      // http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient -> hl7.fhir.us.core
      // http://hl7.org/fhir/uv/ips/StructureDefinition/ips-patient -> hl7.fhir.uv.ips
      
      if (!profileUrl || typeof profileUrl !== 'string') return null;
      const url = new URL(profileUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      
      if (pathParts.length >= 4 && pathParts[0] === 'fhir') {
        // Extract the package identifier parts
        const packageParts = ['hl7', 'fhir'];
        for (let i = 1; i < pathParts.length - 1; i++) {
          if (pathParts[i] !== 'StructureDefinition') {
            packageParts.push(pathParts[i]);
          } else {
            break;
          }
        }
        return packageParts.join('.');
      }

      return null;
    } catch (error) {
      return null;
    }
  }

}
