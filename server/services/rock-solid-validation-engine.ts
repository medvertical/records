/**
 * Rock Solid Validation Engine - Centralized Settings Integration
 * 
 * This is the new validation engine that uses the centralized validation settings
 * system for consistent, reliable, and maintainable validation.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationAspect,
  ValidationSeverity
} from '@shared/validation-settings';
import { getValidationSettingsService } from './validation-settings-service';
import { FhirClient } from './fhir-client';
import { TerminologyClient } from './terminology-client';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationRequest {
  /** Resource to validate */
  resource: any;
  
  /** Resource type */
  resourceType: string;
  
  /** Resource ID */
  resourceId?: string;
  
  /** Profile URL to validate against */
  profileUrl?: string;
  
  /** Additional context */
  context?: ValidationContext;
}

export interface ValidationContext {
  /** FHIR server URL */
  fhirServerUrl?: string;
  
  /** User making the request */
  requestedBy?: string;
  
  /** Request ID for tracking */
  requestId?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  /** Whether the resource is valid */
  isValid: boolean;
  
  /** Resource type */
  resourceType: string;
  
  /** Resource ID */
  resourceId?: string;
  
  /** Profile URL used for validation */
  profileUrl?: string;
  
  /** Validation issues found */
  issues: ValidationIssue[];
  
  /** Validation summary */
  summary: ValidationSummary;
  
  /** Performance metrics */
  performance: ValidationPerformance;
  
  /** Timestamp of validation */
  validatedAt: Date;
  
  /** Settings used for validation */
  settingsUsed: ValidationSettings;
  
  /** Request context */
  context?: ValidationContext;
}

export interface ValidationIssue {
  /** Issue severity */
  severity: ValidationSeverity;
  
  /** Issue code */
  code: string;
  
  /** Issue message */
  message: string;
  
  /** Detailed diagnostics */
  diagnostics?: string;
  
  /** Location in the resource */
  location: string[];
  
  /** FHIRPath expression */
  expression?: string[];
  
  /** Human-readable description */
  humanReadable: string;
  
  /** Validation aspect that found this issue */
  aspect: ValidationAspect;
  
  /** Additional context */
  context?: Record<string, any>;
}

export interface ValidationSummary {
  /** Total number of issues */
  totalIssues: number;
  
  /** Number of errors */
  errorCount: number;
  
  /** Number of warnings */
  warningCount: number;
  
  /** Number of information messages */
  informationCount: number;
  
  /** Validation score (0-100) */
  validationScore: number;
  
  /** Whether validation passed */
  passed: boolean;
  
  /** Issues by aspect */
  issuesByAspect: Record<ValidationAspect, number>;
}

export interface ValidationPerformance {
  /** Total validation time in milliseconds */
  totalTimeMs: number;
  
  /** Time spent on each aspect */
  aspectTimes: Record<ValidationAspect, number>;
  
  /** Time spent on structural validation */
  structuralTimeMs: number;
  
  /** Time spent on profile validation */
  profileTimeMs: number;
  
  /** Time spent on terminology validation */
  terminologyTimeMs: number;
  
  /** Time spent on reference validation */
  referenceTimeMs: number;
  
  /** Time spent on business rule validation */
  businessRuleTimeMs: number;
  
  /** Time spent on metadata validation */
  metadataTimeMs: number;
}

export interface ValidationEngineConfig {
  /** Whether to enable parallel validation */
  enableParallelValidation: boolean;
  
  /** Maximum concurrent validations */
  maxConcurrentValidations: number;
  
  /** Default timeout in milliseconds */
  defaultTimeoutMs: number;
  
  /** Whether to include debug information */
  includeDebugInfo: boolean;
}

// ============================================================================
// Rock Solid Validation Engine
// ============================================================================

export class RockSolidValidationEngine extends EventEmitter {
  private settingsService = getValidationSettingsService();
  private config: ValidationEngineConfig;
  private activeValidations = new Map<string, Promise<ValidationResult>>();

  constructor(config: Partial<ValidationEngineConfig> = {}) {
    super();
    
    this.config = {
      enableParallelValidation: true,
      maxConcurrentValidations: 10,
      defaultTimeoutMs: 30000,
      includeDebugInfo: false,
      ...config
    };
  }

  // ========================================================================
  // Main Validation Methods
  // ========================================================================

  /**
   * Validate a FHIR resource using centralized settings
   */
  async validateResource(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    const requestId = request.context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Check for concurrent validation limit
      if (this.activeValidations.size >= this.config.maxConcurrentValidations) {
        throw new Error('Maximum concurrent validations reached');
      }

      // Get current validation settings
      const settings = await this.settingsService.getActiveSettings();
      
      // Create validation promise
      const validationPromise = this.performValidation(request, settings, requestId);
      this.activeValidations.set(requestId, validationPromise);

      // Wait for validation to complete
      const result = await validationPromise;
      
      // Update performance metrics
      result.performance.totalTimeMs = Date.now() - startTime;
      
      // Emit validation completed event
      this.emit('validationCompleted', {
        requestId,
        result,
        duration: result.performance.totalTimeMs
      });

      return result;

    } catch (error) {
      this.emit('validationError', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      throw error;
    } finally {
      this.activeValidations.delete(requestId);
    }
  }

  /**
   * Validate multiple resources in parallel
   */
  async validateResources(requests: ValidationRequest[]): Promise<ValidationResult[]> {
    if (!this.config.enableParallelValidation) {
      // Sequential validation
      const results: ValidationResult[] = [];
      for (const request of requests) {
        const result = await this.validateResource(request);
        results.push(result);
      }
      return results;
    }

    // Parallel validation with concurrency limit
    const results: ValidationResult[] = [];
    const chunks = this.chunkArray(requests, this.config.maxConcurrentValidations);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(request => this.validateResource(request));
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Validate a resource against a specific profile
   */
  async validateAgainstProfile(
    request: ValidationRequest,
    profileUrl: string
  ): Promise<ValidationResult> {
    const profileRequest = {
      ...request,
      profileUrl
    };

    return this.validateResource(profileRequest);
  }

  // ========================================================================
  // Validation Aspects
  // ========================================================================

  /**
   * Perform structural validation
   */
  private async performStructuralValidation(
    resource: any,
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    if (!settings.structural.enabled) {
      return issues;
    }

    try {
      // Basic FHIR structure validation
      if (!resource.resourceType) {
        issues.push({
          severity: settings.structural.severity,
          code: 'MISSING_RESOURCE_TYPE',
          message: 'Resource type is required',
          location: ['resourceType'],
          humanReadable: 'The resource must have a resourceType field',
          aspect: 'structural'
        });
      }

      if (!resource.id && resource.resourceType !== 'Bundle') {
        issues.push({
          severity: settings.structural.severity,
          code: 'MISSING_RESOURCE_ID',
          message: 'Resource ID is required',
          location: ['id'],
          humanReadable: 'The resource must have an id field',
          aspect: 'structural'
        });
      }

      // Validate required fields based on resource type
      const requiredFields = this.getRequiredFieldsForResourceType(resource.resourceType);
      for (const field of requiredFields) {
        if (!this.hasField(resource, field)) {
          issues.push({
            severity: settings.structural.severity,
            code: 'MISSING_REQUIRED_FIELD',
            message: `Required field '${field}' is missing`,
            location: [field],
            humanReadable: `The field '${field}' is required for ${resource.resourceType} resources`,
            aspect: 'structural'
          });
        }
      }

      // Validate field types
      this.validateFieldTypes(resource, issues, settings.structural);

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'STRUCTURAL_VALIDATION_ERROR',
        message: `Structural validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred during structural validation',
        aspect: 'structural'
      });
    }

    const duration = Date.now() - startTime;
    this.emit('aspectCompleted', {
      aspect: 'structural',
      duration,
      issueCount: issues.length
    });

    return issues;
  }

  /**
   * Perform profile validation
   */
  private async performProfileValidation(
    resource: any,
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    if (!settings.profile.enabled) {
      return issues;
    }

    try {
      // Profile validation logic would go here
      // This would integrate with the profile resolution servers
      
      if (settings.profileResolutionServers.length === 0) {
        issues.push({
          severity: 'warning',
          code: 'NO_PROFILE_SERVERS',
          message: 'No profile resolution servers configured',
          location: [],
          humanReadable: 'Profile validation is enabled but no servers are configured',
          aspect: 'profile'
        });
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'PROFILE_VALIDATION_ERROR',
        message: `Profile validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred during profile validation',
        aspect: 'profile'
      });
    }

    const duration = Date.now() - startTime;
    this.emit('aspectCompleted', {
      aspect: 'profile',
      duration,
      issueCount: issues.length
    });

    return issues;
  }

  /**
   * Perform terminology validation
   */
  private async performTerminologyValidation(
    resource: any,
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    if (!settings.terminology.enabled) {
      return issues;
    }

    try {
      // Terminology validation logic would go here
      // This would integrate with the terminology servers
      
      if (settings.terminologyServers.length === 0) {
        issues.push({
          severity: 'warning',
          code: 'NO_TERMINOLOGY_SERVERS',
          message: 'No terminology servers configured',
          location: [],
          humanReadable: 'Terminology validation is enabled but no servers are configured',
          aspect: 'terminology'
        });
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'TERMINOLOGY_VALIDATION_ERROR',
        message: `Terminology validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred during terminology validation',
        aspect: 'terminology'
      });
    }

    const duration = Date.now() - startTime;
    this.emit('aspectCompleted', {
      aspect: 'terminology',
      duration,
      issueCount: issues.length
    });

    return issues;
  }

  /**
   * Perform reference validation
   */
  private async performReferenceValidation(
    resource: any,
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    if (!settings.reference.enabled) {
      return issues;
    }

    try {
      // Reference validation logic would go here
      // This would check if referenced resources exist and are of the correct type
      
      const references = this.extractReferences(resource);
      for (const reference of references) {
        // Validate reference format
        if (!this.isValidReference(reference)) {
          issues.push({
            severity: settings.reference.severity,
            code: 'INVALID_REFERENCE_FORMAT',
            message: `Invalid reference format: ${reference}`,
            location: this.getReferenceLocation(resource, reference),
            humanReadable: `The reference '${reference}' is not in a valid format`,
            aspect: 'reference'
          });
        }
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'REFERENCE_VALIDATION_ERROR',
        message: `Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred during reference validation',
        aspect: 'reference'
      });
    }

    const duration = Date.now() - startTime;
    this.emit('aspectCompleted', {
      aspect: 'reference',
      duration,
      issueCount: issues.length
    });

    return issues;
  }

  /**
   * Perform business rule validation
   */
  private async performBusinessRuleValidation(
    resource: any,
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    if (!settings.businessRule.enabled) {
      return issues;
    }

    try {
      // Business rule validation logic would go here
      // This would apply custom business rules and constraints
      
      for (const rule of settings.customRules) {
        if (rule.enabled) {
          // Apply custom rule
          const ruleIssues = await this.applyCustomRule(resource, rule, settings);
          issues.push(...ruleIssues);
        }
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'BUSINESS_RULE_VALIDATION_ERROR',
        message: `Business rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred during business rule validation',
        aspect: 'businessRule'
      });
    }

    const duration = Date.now() - startTime;
    this.emit('aspectCompleted', {
      aspect: 'businessRule',
      duration,
      issueCount: issues.length
    });

    return issues;
  }

  /**
   * Perform metadata validation
   */
  private async performMetadataValidation(
    resource: any,
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    if (!settings.metadata.enabled) {
      return issues;
    }

    try {
      // Metadata validation logic would go here
      // This would validate meta fields, timestamps, etc.
      
      if (resource.meta) {
        // Validate meta fields
        if (resource.meta.lastUpdated && !this.isValidTimestamp(resource.meta.lastUpdated)) {
          issues.push({
            severity: settings.metadata.severity,
            code: 'INVALID_LAST_UPDATED',
            message: 'Invalid lastUpdated timestamp',
            location: ['meta', 'lastUpdated'],
            humanReadable: 'The lastUpdated timestamp is not in a valid format',
            aspect: 'metadata'
          });
        }
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'METADATA_VALIDATION_ERROR',
        message: `Metadata validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred during metadata validation',
        aspect: 'metadata'
      });
    }

    const duration = Date.now() - startTime;
    this.emit('aspectCompleted', {
      aspect: 'metadata',
      duration,
      issueCount: issues.length
    });

    return issues;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async performValidation(
    request: ValidationRequest,
    settings: ValidationSettings,
    requestId: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const allIssues: ValidationIssue[] = [];
    const aspectTimes: Record<ValidationAspect, number> = {
      structural: 0,
      profile: 0,
      terminology: 0,
      reference: 0,
      businessRule: 0,
      metadata: 0
    };

    try {
      // Perform all validation aspects
      const validationPromises: Promise<ValidationIssue[]>[] = [];

      // Structural validation (always first)
      const structuralPromise = this.performStructuralValidation(request.resource, settings, request.context || {});
      validationPromises.push(structuralPromise);

      // Other validations (can be parallel if enabled)
      if (this.config.enableParallelValidation) {
        validationPromises.push(
          this.performProfileValidation(request.resource, settings, request.context || {}),
          this.performTerminologyValidation(request.resource, settings, request.context || {}),
          this.performReferenceValidation(request.resource, settings, request.context || {}),
          this.performBusinessRuleValidation(request.resource, settings, request.context || {}),
          this.performMetadataValidation(request.resource, settings, request.context || {})
        );
      } else {
        // Sequential validation
        const profileIssues = await this.performProfileValidation(request.resource, settings, request.context || {});
        const terminologyIssues = await this.performTerminologyValidation(request.resource, settings, request.context || {});
        const referenceIssues = await this.performReferenceValidation(request.resource, settings, request.context || {});
        const businessRuleIssues = await this.performBusinessRuleValidation(request.resource, settings, request.context || {});
        const metadataIssues = await this.performMetadataValidation(request.resource, settings, request.context || {});

        allIssues.push(...profileIssues, ...terminologyIssues, ...referenceIssues, ...businessRuleIssues, ...metadataIssues);
      }

      // Wait for all validations to complete
      const results = await Promise.all(validationPromises);
      allIssues.push(...results.flat());

      // Calculate summary
      const summary = this.calculateSummary(allIssues, settings);
      
      // Calculate performance metrics
      const performance: ValidationPerformance = {
        totalTimeMs: Date.now() - startTime,
        aspectTimes,
        structuralTimeMs: aspectTimes.structural,
        profileTimeMs: aspectTimes.profile,
        terminologyTimeMs: aspectTimes.terminology,
        referenceTimeMs: aspectTimes.reference,
        businessRuleTimeMs: aspectTimes.businessRule,
        metadataTimeMs: aspectTimes.metadata
      };

      return {
        isValid: summary.passed,
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        profileUrl: request.profileUrl,
        issues: allIssues,
        summary,
        performance,
        validatedAt: new Date(),
        settingsUsed: settings,
        context: request.context
      };

    } catch (error) {
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateSummary(issues: ValidationIssue[], settings: ValidationSettings): ValidationSummary {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const informationCount = issues.filter(i => i.severity === 'information').length;
    
    const issuesByAspect: Record<ValidationAspect, number> = {
      structural: 0,
      profile: 0,
      terminology: 0,
      reference: 0,
      businessRule: 0,
      metadata: 0
    };

    for (const issue of issues) {
      issuesByAspect[issue.aspect]++;
    }

    const totalIssues = issues.length;
    const fatalCount = issues.filter(i => i.severity === 'fatal').length;
    
    // Use consistent scoring system with enhanced validation engine
    let validationScore = 100;
    validationScore -= fatalCount * 30;  // Fatal issues: -30 points each
    validationScore -= errorCount * 15;  // Error issues: -15 points each  
    validationScore -= warningCount * 5; // Warning issues: -5 points each
    validationScore -= informationCount * 1; // Information issues: -1 point each
    validationScore = Math.max(0, Math.round(validationScore));
    
    // Resource passes if no fatal or error issues (warnings and info are acceptable)
    const passed = fatalCount === 0 && errorCount === 0;

    return {
      totalIssues,
      errorCount,
      warningCount,
      informationCount,
      validationScore,
      passed,
      issuesByAspect
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getRequiredFieldsForResourceType(resourceType: string): string[] {
    // This would return required fields based on FHIR specification
    const requiredFields: Record<string, string[]> = {
      'Patient': ['identifier', 'name'],
      'Observation': ['status', 'code'],
      'Encounter': ['status', 'class'],
      // Add more resource types as needed
    };
    
    return requiredFields[resourceType] || [];
  }

  private hasField(resource: any, field: string): boolean {
    return resource.hasOwnProperty(field) && resource[field] !== null && resource[field] !== undefined;
  }

  private validateFieldTypes(resource: any, issues: ValidationIssue[], aspectConfig: any): void {
    // Field type validation logic would go here
  }

  private extractReferences(resource: any): string[] {
    // Extract all references from the resource
    const references: string[] = [];
    this.traverseObject(resource, (value, path) => {
      if (typeof value === 'string' && value.startsWith('http')) {
        references.push(value);
      }
    });
    return references;
  }

  private traverseObject(obj: any, callback: (value: any, path: string[]) => void, path: string[] = []): void {
    if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        callback(value, currentPath);
        if (value && typeof value === 'object') {
          this.traverseObject(value, callback, currentPath);
        }
      }
    }
  }

  private isValidReference(reference: string): boolean {
    // Basic reference validation
    return reference.startsWith('http') || reference.includes('/');
  }

  private getReferenceLocation(resource: any, reference: string): string[] {
    // Find the location of the reference in the resource
    const locations: string[] = [];
    this.traverseObject(resource, (value, path) => {
      if (value === reference) {
        locations.push(path.join('.'));
      }
    });
    return locations;
  }

  private isValidTimestamp(timestamp: string): boolean {
    try {
      new Date(timestamp);
      return true;
    } catch {
      return false;
    }
  }

  private async applyCustomRule(resource: any, rule: any, settings: ValidationSettings): Promise<ValidationIssue[]> {
    // Custom rule application logic would go here
    return [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let engineInstance: RockSolidValidationEngine | null = null;

/**
 * Get the singleton instance of RockSolidValidationEngine
 */
export function getRockSolidValidationEngine(): RockSolidValidationEngine {
  if (!engineInstance) {
    engineInstance = new RockSolidValidationEngine();
  }
  return engineInstance;
}
