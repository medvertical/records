/**
 * Rock Solid Validation Engine - Centralized Settings Integration
 * 
 * This is the new validation engine that uses the centralized validation settings
 * system for consistent, reliable, and maintainable validation.
 *
 * Configuration mapping (from ValidationSettings):
 * - structural.enabled/severity          → performStructuralValidation gating and issue severity
 * - profile.enabled                      → performProfileValidation gating
 * - profileResolutionServers[]           → used to warn when empty; future resolution integration
 * - terminology.enabled                  → performTerminologyValidation gating
 * - terminologyServers[]                 → used to warn when empty; future terminology integration
 * - reference.enabled/severity           → performReferenceValidation gating and issue severity
 * - businessRule.enabled/severity        → performBusinessRuleValidation gating and issue severity
 * - customRules[]                        → executed in business rule aspect (required, pattern, custom fn)
 * - metadata.enabled/severity            → performMetadataValidation gating and issue severity
 * - maxConcurrentValidations             → engine concurrency limit
 * - timeoutSettings/cacheSettings        → presently reserved; hook points exist for future enforcement
 *
 * Settings are retrieved via ValidationSettingsService.getActiveSettings() per validation.
 * The engine emits per-aspect completion events and aggregates timing into performance.aspectTimes.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationAspect,
  ValidationSeverity
} from '@shared/validation-settings';
import { getValidationSettingsService } from './validation-settings-service';
import { FhirClient } from '../fhir/fhir-client';
import { TerminologyClient } from '../fhir/terminology-client';

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
  
  /** Retry tracking information */
  retryInfo?: ValidationRetryInfo;
}

export interface ValidationRetryInfo {
  /** Number of retry attempts made */
  attemptCount: number;
  
  /** Maximum number of retry attempts allowed */
  maxAttempts: number;
  
  /** Whether this validation was a retry */
  isRetry: boolean;
  
  /** Previous validation attempt results */
  previousAttempts: ValidationRetryAttempt[];
  
  /** Total retry duration in milliseconds */
  totalRetryDurationMs: number;
  
  /** Whether retry is still possible */
  canRetry: boolean;
  
  /** Reason for retry (if applicable) */
  retryReason?: string;
}

export interface ValidationRetryAttempt {
  /** Attempt number (1-based) */
  attemptNumber: number;
  
  /** Timestamp of the attempt */
  attemptedAt: Date;
  
  /** Whether the attempt was successful */
  success: boolean;
  
  /** Error message if the attempt failed */
  errorMessage?: string;
  
  /** Duration of this attempt in milliseconds */
  durationMs: number;
  
  /** Validation result of this attempt */
  result?: Partial<ValidationResult>;
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

export interface ValidationAspectSummary {
  /** Number of issues found by this aspect */
  issueCount: number;
  
  /** Number of errors found by this aspect */
  errorCount: number;
  
  /** Number of warnings found by this aspect */
  warningCount: number;
  
  /** Number of information messages found by this aspect */
  informationCount: number;
  
  /** Validation score for this aspect (0-100) */
  validationScore: number;
  
  /** Whether this aspect passed validation */
  passed: boolean;
  
  /** Whether this aspect was enabled during validation */
  enabled: boolean;
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
  
  /** Issues by aspect (legacy - total count only) */
  issuesByAspect: Record<ValidationAspect, number>;
  
  /** Detailed breakdown by aspect */
  aspectBreakdown: Record<ValidationAspect, ValidationAspectSummary>;
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
  
  // Health / status metrics
  private totalValidations = 0;
  private totalValidationErrors = 0;
  private lastCompletedAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastDurationMs: number | null = null;

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
      
      if (this.config.includeDebugInfo) {
        console.debug('[DefaultValidationEngine] Starting validation', {
          requestId,
          resourceType: request.resourceType,
          profileUrl: request.profileUrl
        });
      }
      
      // Create validation promise
      const validationPromise = this.performValidation(request, settings, requestId);
      this.activeValidations.set(requestId, validationPromise);

      // Wait for validation to complete
      const result = await validationPromise;
      
      // Update performance metrics
      result.performance.totalTimeMs = Date.now() - startTime;
      
      // Engine-level metrics
      this.totalValidations += 1;
      this.lastCompletedAt = new Date();
      this.lastDurationMs = result.performance.totalTimeMs;

      // Emit validation completed event
      this.emit('validationCompleted', {
        requestId,
        result,
        duration: result.performance.totalTimeMs
      });

      if (this.config.includeDebugInfo) {
        console.debug('[DefaultValidationEngine] Validation completed', {
          requestId,
          durationMs: result.performance.totalTimeMs,
          isValid: result.isValid,
          issues: result.summary.totalIssues
        });
      }

      return result;

    } catch (error) {
      this.totalValidationErrors += 1;
      this.lastErrorAt = new Date();

      this.emit('validationError', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      if (this.config.includeDebugInfo) {
        console.error('[DefaultValidationEngine] Validation error', {
          requestId,
          error: error instanceof Error ? error.message : error
        });
      }
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
      // Auto-detect declared profiles and report
      const declared: string[] = Array.isArray(resource?.meta?.profile) ? resource.meta.profile : [];
      if (declared.length > 0) {
        for (const url of declared) {
          const validUrl = typeof url === 'string' && /^(https?:\/\/).+/.test(url);
          issues.push({
            severity: validUrl ? settings.profile.severity : settings.profile.severity,
            code: validUrl ? 'PROFILE_DETECTED' : 'PROFILE_URL_INVALID',
            message: validUrl ? `Profile declared: ${url}` : `Invalid profile URL: ${String(url)}`,
            location: ['meta', 'profile'],
            humanReadable: validUrl ? `Detected declared profile ${url}` : `Profile URL seems invalid: ${String(url)}`,
            aspect: 'profile'
          });
        }
      }

      // Warn if enabled without resolution servers
      if ((settings as any).profileResolutionServers?.length === 0) {
        issues.push({
          severity: settings.profile.severity,
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

    if (this.config.includeDebugInfo) {
      console.debug('[DefaultValidationEngine] Profile validation completed', { durationMs: duration, issues: issues.length });
    }

    return issues;
  }

  /**
   * Perform comprehensive terminology validation
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
      // Check if terminology servers are configured
      if (settings.terminologyServers.length === 0) {
        issues.push({
          severity: settings.terminology.severity,
          code: 'NO_TERMINOLOGY_SERVERS',
          message: 'No terminology servers configured',
          location: [],
          humanReadable: 'Terminology validation is enabled but no servers are configured',
          aspect: 'terminology'
        });
        return issues;
      }

      // Extract all codable concepts from the resource
      const codableConcepts = this.extractCodableConcepts(resource);
      
      // Validate each codable concept comprehensively
      for (const concept of codableConcepts) {
        const conceptIssues = await this.validateCodableConcept(concept, settings, context);
        issues.push(...conceptIssues);
      }

      // Validate code systems and value sets
      const codeSystems = this.extractCodeSystems(resource);
      for (const codeSystem of codeSystems) {
        const systemIssues = await this.validateCodeSystem(codeSystem, settings, context);
        issues.push(...systemIssues);
      }

      // Validate value sets
      const valueSets = this.extractValueSets(resource);
      for (const valueSet of valueSets) {
        const valueSetIssues = await this.validateValueSet(valueSet, settings, context);
        issues.push(...valueSetIssues);
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
   * Perform comprehensive reference validation
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
      // Extract all references from the resource
      const references = this.extractReferences(resource);
      
      for (const reference of references) {
        const referenceIssues = await this.validateReference(reference, settings, context);
        issues.push(...referenceIssues);
      }

      // Validate reference integrity (circular references, broken chains)
      const integrityIssues = await this.validateReferenceIntegrity(resource, settings, context);
      issues.push(...integrityIssues);

      // Validate reference cardinality and constraints
      const cardinalityIssues = this.validateReferenceCardinality(resource, settings);
      issues.push(...cardinalityIssues);

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
      // Apply built-in FHIR business rules
      const builtInRuleIssues = await this.applyBuiltInBusinessRules(resource, settings);
      issues.push(...builtInRuleIssues);

      // Apply custom rules from settings
      for (const rule of (settings as any).customRules || []) {
        if (rule.enabled) {
          const ruleIssues = await this.applyCustomRule(resource, rule, settings);
          issues.push(...ruleIssues);
        }
      }

      // Apply resource-specific business rules
      const resourceSpecificIssues = await this.applyResourceSpecificRules(resource, settings);
      issues.push(...resourceSpecificIssues);

      // Apply cross-field validation rules
      const crossFieldIssues = this.applyCrossFieldValidation(resource, settings);
      issues.push(...crossFieldIssues);

      // Apply temporal validation rules
      const temporalIssues = this.applyTemporalValidation(resource, settings);
      issues.push(...temporalIssues);

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

    if (this.config.includeDebugInfo) {
      console.debug('[DefaultValidationEngine] Business rule validation completed', { durationMs: duration, issues: issues.length });
    }

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
      // Perform all validation aspects with timing
      const runTimed = async (aspect: ValidationAspect, fn: () => Promise<ValidationIssue[]>): Promise<ValidationIssue[]> => {
        const t0 = Date.now();
        try {
          return await fn();
        } finally {
          aspectTimes[aspect] += Date.now() - t0;
        }
      };

      // Structural validation (always first)
      const structuralIssues = await runTimed('structural', () => this.performStructuralValidation(request.resource, settings, request.context || {}));
      allIssues.push(...structuralIssues);

      if (this.config.enableParallelValidation) {
        const [profileIssues, terminologyIssues, referenceIssues, businessRuleIssues, metadataIssues] = await Promise.all([
          runTimed('profile', () => this.performProfileValidation(request.resource, settings, request.context || {})),
          runTimed('terminology', () => this.performTerminologyValidation(request.resource, settings, request.context || {})),
          runTimed('reference', () => this.performReferenceValidation(request.resource, settings, request.context || {})),
          runTimed('businessRule', () => this.performBusinessRuleValidation(request.resource, settings, request.context || {})),
          runTimed('metadata', () => this.performMetadataValidation(request.resource, settings, request.context || {}))
        ]);
        allIssues.push(...profileIssues, ...terminologyIssues, ...referenceIssues, ...businessRuleIssues, ...metadataIssues);
      } else {
        const profileIssues = await runTimed('profile', () => this.performProfileValidation(request.resource, settings, request.context || {}));
        const terminologyIssues = await runTimed('terminology', () => this.performTerminologyValidation(request.resource, settings, request.context || {}));
        const referenceIssues = await runTimed('reference', () => this.performReferenceValidation(request.resource, settings, request.context || {}));
        const businessRuleIssues = await runTimed('businessRule', () => this.performBusinessRuleValidation(request.resource, settings, request.context || {}));
        const metadataIssues = await runTimed('metadata', () => this.performMetadataValidation(request.resource, settings, request.context || {}));
        allIssues.push(...profileIssues, ...terminologyIssues, ...referenceIssues, ...businessRuleIssues, ...metadataIssues);
      }

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
    // Include all issues from all aspects (UI will filter based on enabled aspects)
    const allIssues = issues;
    
    const errorCount = allIssues.filter(i => i.severity === 'error').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;
    const informationCount = allIssues.filter(i => i.severity === 'information').length;
    
    const issuesByAspect: Record<ValidationAspect, number> = {
      structural: 0,
      profile: 0,
      terminology: 0,
      reference: 0,
      businessRule: 0,
      metadata: 0
    };

    // Calculate detailed aspect breakdown
    const aspectBreakdown: Record<ValidationAspect, ValidationAspectSummary> = {
      structural: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings.structural?.enabled !== false },
      profile: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings.profile?.enabled !== false },
      terminology: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings.terminology?.enabled !== false },
      reference: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings.reference?.enabled !== false },
      businessRule: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings.businessRule?.enabled !== false },
      metadata: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings.metadata?.enabled !== false }
    };

    // Process each issue and update aspect breakdowns
    for (const issue of allIssues) {
      const aspect = issue.aspect;
      if (aspect && aspectBreakdown[aspect]) {
        issuesByAspect[aspect]++;
        
        const breakdown = aspectBreakdown[aspect];
        breakdown.issueCount++;
        
        if (issue.severity === 'error' || issue.severity === 'fatal') {
          breakdown.errorCount++;
        } else if (issue.severity === 'warning') {
          breakdown.warningCount++;
        } else if (issue.severity === 'information') {
          breakdown.informationCount++;
        }
      }
    }

    // Calculate aspect-specific scores and pass/fail status for all aspects
    for (const aspect of Object.keys(aspectBreakdown) as ValidationAspect[]) {
      const breakdown = aspectBreakdown[aspect];
      
      // Always calculate score for this aspect (UI will filter based on enabled status)
      let aspectScore = 100;
      aspectScore -= breakdown.errorCount * 15;  // Error issues: -15 points each
      aspectScore -= breakdown.warningCount * 5; // Warning issues: -5 points each
      aspectScore -= breakdown.informationCount * 1; // Information issues: -1 point each
      breakdown.validationScore = Math.max(0, Math.round(aspectScore));
      
      // Aspect passes if no errors (warnings and info are acceptable)
      breakdown.passed = breakdown.errorCount === 0;
    }

    const totalIssues = allIssues.length;
    // Fatal severity not part of ValidationSeverity; treat non-modeled fatals as errors
    const fatalCount = 0;
    
    // Use consistent scoring system with enhanced validation engine
    let validationScore = 100;
    validationScore -= fatalCount * 30;  // Fatal issues: -30 points each
    validationScore -= errorCount * 15;  // Error issues: -15 points each  
    validationScore -= warningCount * 5; // Warning issues: -5 points each
    validationScore -= informationCount * 1; // Information issues: -1 point each
    validationScore = Math.max(0, Math.round(validationScore));
    
    // Resource passes if no error issues (warnings and info are acceptable)
    const passed = errorCount === 0;

    return {
      totalIssues,
      errorCount,
      warningCount,
      informationCount,
      validationScore,
      passed,
      issuesByAspect,
      aspectBreakdown
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
    const issues: ValidationIssue[] = [];
    const severity = (settings as any).businessRule?.severity || 'warning';
    const path: string = rule.path || '';
    const value = path ? this.getValueByPath(resource, path) : resource;
    const makeIssue = (code: string, message: string): ValidationIssue => ({
      severity,
      code,
      message,
      location: path ? [path] : [],
      humanReadable: message,
      aspect: 'businessRule'
    });

    try {
      switch (rule.type) {
        case 'required': {
          const ok = value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0);
          if (!ok) issues.push(makeIssue('RULE_REQUIRED_FAILED', rule.message || `Required field '${path}' is missing`));
          break;
        }
        case 'pattern': {
          if (typeof rule.rule === 'string' || rule.rule instanceof RegExp) {
            const regex = rule.rule instanceof RegExp ? rule.rule : new RegExp(rule.rule);
            const strVal = value == null ? '' : String(value);
            if (!regex.test(strVal)) issues.push(makeIssue('RULE_PATTERN_FAILED', rule.message || `Value at '${path}' does not match pattern`));
          }
          break;
        }
        case 'custom': {
          if (typeof rule.rule === 'function') {
            const ok = await Promise.resolve(rule.rule(value, resource));
            if (!ok) issues.push(makeIssue('RULE_CUSTOM_FAILED', rule.message || `Custom rule failed at '${path}'`));
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'BUSINESS_RULE_EVALUATION_ERROR',
        message: `Business rule evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while evaluating a business rule',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  private getValueByPath(obj: any, path: string): any {
    if (!path) return obj;
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
  }

  // ========================================================================
  // Comprehensive Validation Helper Methods
  // ========================================================================

  /**
   * Extract all codable concepts from a resource
   */
  private extractCodableConcepts(resource: any): Array<{concept: any, location: string[]}> {
    const concepts: Array<{concept: any, location: string[]}> = [];
    
    const traverse = (obj: any, path: string[] = []) => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        
        if (value && typeof value === 'object') {
          // Check if this is a CodableConcept
          if (value.coding || value.text) {
            concepts.push({ concept: value, location: currentPath });
          }
          // Recursively traverse nested objects
          traverse(value, currentPath);
        }
      }
    };
    
    traverse(resource);
    return concepts;
  }

  /**
   * Extract all code systems from a resource
   */
  private extractCodeSystems(resource: any): Array<{system: string, location: string[]}> {
    const systems: Array<{system: string, location: string[]}> = [];
    
    const traverse = (obj: any, path: string[] = []) => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        
        if (value && typeof value === 'object') {
          // Check if this is a Coding with a system
          if (value.system && value.code) {
            systems.push({ system: value.system, location: currentPath });
          }
          // Recursively traverse nested objects
          traverse(value, currentPath);
        }
      }
    };
    
    traverse(resource);
    return systems;
  }

  /**
   * Extract all value sets from a resource
   */
  private extractValueSets(resource: any): Array<{valueSet: string, location: string[]}> {
    const valueSets: Array<{valueSet: string, location: string[]}> = [];
    
    const traverse = (obj: any, path: string[] = []) => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        
        if (value && typeof value === 'object') {
          // Check for value set references in various formats
          if (value.valueSet || value.valueSetUri) {
            valueSets.push({ 
              valueSet: value.valueSet || value.valueSetUri, 
              location: currentPath 
            });
          }
          // Recursively traverse nested objects
          traverse(value, currentPath);
        }
      }
    };
    
    traverse(resource);
    return valueSets;
  }

  /**
   * Validate a codable concept comprehensively
   */
  private async validateCodableConcept(
    concept: {concept: any, location: string[]},
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { concept: codableConcept, location } = concept;

    try {
      // Validate that either coding or text is present
      if (!codableConcept.coding && !codableConcept.text) {
        issues.push({
          severity: settings.terminology.severity,
          code: 'CODABLE_CONCEPT_INCOMPLETE',
          message: 'CodableConcept must have either coding or text',
          location,
          humanReadable: 'A codable concept must specify either coding or text',
          aspect: 'terminology'
        });
      }

      // Validate codings if present
      if (codableConcept.coding && Array.isArray(codableConcept.coding)) {
        for (let i = 0; i < codableConcept.coding.length; i++) {
          const coding = codableConcept.coding[i];
          const codingLocation = [...location, 'coding', i.toString()];
          
          if (!coding.system) {
            issues.push({
              severity: settings.terminology.severity,
              code: 'CODING_MISSING_SYSTEM',
              message: 'Coding must have a system',
              location: codingLocation,
              humanReadable: 'Each coding must specify a code system',
              aspect: 'terminology'
            });
          }
          
          if (!coding.code) {
            issues.push({
              severity: settings.terminology.severity,
              code: 'CODING_MISSING_CODE',
              message: 'Coding must have a code',
              location: codingLocation,
              humanReadable: 'Each coding must specify a code',
              aspect: 'terminology'
            });
          }
        }
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'CODABLE_CONCEPT_VALIDATION_ERROR',
        message: `CodableConcept validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location,
        humanReadable: 'An error occurred while validating a codable concept',
        aspect: 'terminology'
      });
    }

    return issues;
  }

  /**
   * Validate a code system
   */
  private async validateCodeSystem(
    codeSystem: {system: string, location: string[]},
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { system, location } = codeSystem;

    try {
      // Validate code system URL format
      if (!this.isValidUrl(system)) {
        issues.push({
          severity: settings.terminology.severity,
          code: 'INVALID_CODE_SYSTEM_URL',
          message: `Invalid code system URL: ${system}`,
          location,
          humanReadable: `The code system URL '${system}' is not valid`,
          aspect: 'terminology'
        });
      }

      // TODO: Add actual terminology server validation
      // This would check if the code system is recognized by configured terminology servers

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'CODE_SYSTEM_VALIDATION_ERROR',
        message: `Code system validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location,
        humanReadable: 'An error occurred while validating a code system',
        aspect: 'terminology'
      });
    }

    return issues;
  }

  /**
   * Validate a value set
   */
  private async validateValueSet(
    valueSet: {valueSet: string, location: string[]},
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { valueSet: vs, location } = valueSet;

    try {
      // Validate value set URL format
      if (!this.isValidUrl(vs)) {
        issues.push({
          severity: settings.terminology.severity,
          code: 'INVALID_VALUE_SET_URL',
          message: `Invalid value set URL: ${vs}`,
          location,
          humanReadable: `The value set URL '${vs}' is not valid`,
          aspect: 'terminology'
        });
      }

      // TODO: Add actual terminology server validation
      // This would check if the value set is recognized by configured terminology servers

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'VALUE_SET_VALIDATION_ERROR',
        message: `Value set validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location,
        humanReadable: 'An error occurred while validating a value set',
        aspect: 'terminology'
      });
    }

    return issues;
  }

  /**
   * Validate a reference comprehensively
   */
  private async validateReference(
    reference: {reference: string, location: string[]},
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { reference: ref, location } = reference;

    try {
      // Validate reference format
      if (!this.isValidReference(ref)) {
        issues.push({
          severity: settings.reference.severity,
          code: 'INVALID_REFERENCE_FORMAT',
          message: `Invalid reference format: ${ref}`,
          location,
          humanReadable: `The reference '${ref}' is not in a valid format`,
          aspect: 'reference'
        });
        return issues;
      }

      // Parse reference components
      const refComponents = this.parseReference(ref);
      
      // Validate resource type if specified
      if (refComponents.resourceType && !this.isValidResourceType(refComponents.resourceType)) {
        issues.push({
          severity: settings.reference.severity,
          code: 'INVALID_REFERENCE_RESOURCE_TYPE',
          message: `Invalid resource type in reference: ${refComponents.resourceType}`,
          location,
          humanReadable: `The resource type '${refComponents.resourceType}' in the reference is not valid`,
          aspect: 'reference'
        });
      }

      // TODO: Add actual reference resolution validation
      // This would check if the referenced resource exists and is accessible

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'REFERENCE_VALIDATION_ERROR',
        message: `Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location,
        humanReadable: 'An error occurred while validating a reference',
        aspect: 'reference'
      });
    }

    return issues;
  }

  /**
   * Validate reference integrity (circular references, broken chains)
   */
  private async validateReferenceIntegrity(
    resource: any,
    settings: ValidationSettings,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // TODO: Implement circular reference detection
      // TODO: Implement reference chain validation
      // This would track reference chains and detect circular dependencies

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'REFERENCE_INTEGRITY_VALIDATION_ERROR',
        message: `Reference integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while validating reference integrity',
        aspect: 'reference'
      });
    }

    return issues;
  }

  /**
   * Validate reference cardinality and constraints
   */
  private validateReferenceCardinality(
    resource: any,
    settings: ValidationSettings
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // TODO: Implement reference cardinality validation
      // This would check if references meet cardinality constraints defined in profiles

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'REFERENCE_CARDINALITY_VALIDATION_ERROR',
        message: `Reference cardinality validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while validating reference cardinality',
        aspect: 'reference'
      });
    }

    return issues;
  }

  /**
   * Apply built-in FHIR business rules
   */
  private async applyBuiltInBusinessRules(
    resource: any,
    settings: ValidationSettings
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // TODO: Implement comprehensive FHIR business rules
      // This would include rules like:
      // - Date consistency (effective date <= recorded date)
      // - Quantity constraints (positive values for certain quantities)
      // - Enumeration value validation
      // - Required field combinations
      // - Cardinality constraints

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'BUILT_IN_RULES_VALIDATION_ERROR',
        message: `Built-in business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while applying built-in business rules',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  /**
   * Apply resource-specific business rules
   */
  private async applyResourceSpecificRules(
    resource: any,
    settings: ValidationSettings
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Apply resource-specific validation rules
      switch (resource.resourceType) {
        case 'Patient':
          issues.push(...this.validatePatientBusinessRules(resource, settings));
          break;
        case 'Observation':
          issues.push(...this.validateObservationBusinessRules(resource, settings));
          break;
        case 'Encounter':
          issues.push(...this.validateEncounterBusinessRules(resource, settings));
          break;
        // Add more resource types as needed
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'RESOURCE_SPECIFIC_RULES_VALIDATION_ERROR',
        message: `Resource-specific business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while applying resource-specific business rules',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  /**
   * Apply cross-field validation rules
   */
  private applyCrossFieldValidation(
    resource: any,
    settings: ValidationSettings
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // TODO: Implement cross-field validation
      // This would include rules like:
      // - Related fields must have consistent values
      // - Conditional fields based on other field values
      // - Mutually exclusive fields

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'CROSS_FIELD_VALIDATION_ERROR',
        message: `Cross-field validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while performing cross-field validation',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  /**
   * Apply temporal validation rules
   */
  private applyTemporalValidation(
    resource: any,
    settings: ValidationSettings
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // TODO: Implement temporal validation
      // This would include rules like:
      // - Date ranges (start <= end)
      // - Future date constraints
      // - Historical date constraints
      // - Duration consistency

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'TEMPORAL_VALIDATION_ERROR',
        message: `Temporal validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while performing temporal validation',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  /**
   * Validate Patient-specific business rules
   */
  private validatePatientBusinessRules(
    patient: any,
    settings: ValidationSettings
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // Birth date cannot be in the future
      if (patient.birthDate) {
        const birthDate = new Date(patient.birthDate);
        if (birthDate > new Date()) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'PATIENT_BIRTH_DATE_FUTURE',
            message: 'Patient birth date cannot be in the future',
            location: ['birthDate'],
            humanReadable: 'A patient\'s birth date cannot be in the future',
            aspect: 'businessRule'
          });
        }
      }

      // Death date must be after birth date
      if (patient.birthDate && patient.deceasedDateTime) {
        const birthDate = new Date(patient.birthDate);
        const deathDate = new Date(patient.deceasedDateTime);
        if (deathDate <= birthDate) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'PATIENT_DEATH_BEFORE_BIRTH',
            message: 'Patient death date must be after birth date',
            location: ['deceasedDateTime'],
            humanReadable: 'A patient\'s death date must be after their birth date',
            aspect: 'businessRule'
          });
        }
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'PATIENT_BUSINESS_RULES_ERROR',
        message: `Patient business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while validating patient business rules',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  /**
   * Validate Observation-specific business rules
   */
  private validateObservationBusinessRules(
    observation: any,
    settings: ValidationSettings
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // Effective date/time must be present
      if (!observation.effectiveDateTime && !observation.effectivePeriod && !observation.effectiveInstant) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'OBSERVATION_MISSING_EFFECTIVE_TIME',
          message: 'Observation must have effective date/time',
          location: [],
          humanReadable: 'An observation must specify when it was taken or observed',
          aspect: 'businessRule'
        });
      }

      // Value and interpretation should be consistent
      if (observation.valueQuantity && observation.interpretation) {
        // TODO: Add logic to validate value against interpretation
        // This would check if the numeric value aligns with the interpretation
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'OBSERVATION_BUSINESS_RULES_ERROR',
        message: `Observation business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while validating observation business rules',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  /**
   * Validate Encounter-specific business rules
   */
  private validateEncounterBusinessRules(
    encounter: any,
    settings: ValidationSettings
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // Period start must be before or equal to period end
      if (encounter.period && encounter.period.start && encounter.period.end) {
        const startDate = new Date(encounter.period.start);
        const endDate = new Date(encounter.period.end);
        if (startDate > endDate) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'ENCOUNTER_PERIOD_INVALID',
            message: 'Encounter period start must be before or equal to end',
            location: ['period'],
            humanReadable: 'An encounter\'s start time must be before or equal to its end time',
            aspect: 'businessRule'
          });
        }
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'ENCOUNTER_BUSINESS_RULES_ERROR',
        message: `Encounter business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: 'An error occurred while validating encounter business rules',
        aspect: 'businessRule'
      });
    }

    return issues;
  }

  /**
   * Check if a URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a resource type is valid
   */
  private isValidResourceType(resourceType: string): boolean {
    // List of valid FHIR R4 resource types
    const validResourceTypes = [
      'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance',
      'Appointment', 'AppointmentResponse', 'AuditEvent', 'Basic',
      'Binary', 'BiologicallyDerivedProduct', 'BodyStructure', 'Bundle',
      'CapabilityStatement', 'CarePlan', 'CareTeam', 'CatalogEntry',
      'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse',
      'ClinicalImpression', 'CodeSystem', 'Communication', 'CommunicationRequest',
      'CompartmentDefinition', 'Composition', 'ConceptMap', 'Condition',
      'Consent', 'Contract', 'Coverage', 'CoverageEligibilityRequest',
      'CoverageEligibilityResponse', 'DetectedIssue', 'Device', 'DeviceDefinition',
      'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement', 'DiagnosticReport',
      'DocumentManifest', 'DocumentReference', 'EffectEvidenceSynthesis',
      'Encounter', 'Endpoint', 'EnrollmentRequest', 'EnrollmentResponse',
      'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable',
      'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory',
      'Flag', 'Goal', 'GraphDefinition', 'Group', 'GuidanceResponse',
      'HealthcareService', 'ImagingStudy', 'Immunization', 'ImmunizationEvaluation',
      'ImmunizationRecommendation', 'ImplementationGuide', 'InsurancePlan',
      'Invoice', 'Library', 'Linkage', 'List', 'Location', 'Measure',
      'MeasureReport', 'Media', 'Medication', 'MedicationAdministration',
      'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest',
      'MedicationStatement', 'MedicinalProduct', 'MedicinalProductAuthorization',
      'MedicinalProductContraindication', 'MedicinalProductIndication',
      'MedicinalProductIngredient', 'MedicinalProductInteraction',
      'MedicinalProductManufactured', 'MedicinalProductPackaged',
      'MedicinalProductPharmaceutical', 'MedicinalProductUndesirableEffect',
      'MessageDefinition', 'MessageHeader', 'MolecularSequence', 'NamingSystem',
      'NutritionOrder', 'Observation', 'ObservationDefinition', 'OperationDefinition',
      'OperationOutcome', 'Organization', 'OrganizationAffiliation', 'Parameters',
      'Patient', 'PaymentNotice', 'PaymentReconciliation', 'Person',
      'PlanDefinition', 'Practitioner', 'PractitionerRole', 'Procedure',
      'Provenance', 'Questionnaire', 'QuestionnaireResponse', 'RelatedPerson',
      'RequestGroup', 'ResearchDefinition', 'ResearchElementDefinition',
      'ResearchStudy', 'ResearchSubject', 'RiskAssessment', 'RiskEvidenceSynthesis',
      'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen',
      'SpecimenDefinition', 'StructureDefinition', 'StructureMap',
      'Subscription', 'Substance', 'SubstanceNucleicAcid', 'SubstancePolymer',
      'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
      'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest',
      'Task', 'TerminologyCapabilities', 'TestReport', 'TestScript',
      'ValueSet', 'VerificationResult', 'VisionPrescription'
    ];
    
    return validResourceTypes.includes(resourceType);
  }

  /**
   * Parse a reference into its components
   */
  private parseReference(reference: string): {resourceType?: string, id?: string, url?: string} {
    // Handle different reference formats
    if (reference.startsWith('http')) {
      return { url: reference };
    }
    
    if (reference.includes('/')) {
      const parts = reference.split('/');
      if (parts.length >= 2) {
        return { resourceType: parts[parts.length - 2], id: parts[parts.length - 1] };
      }
    }
    
    return { id: reference };
  }

  // Expose health status
  getHealthStatus(): {
    isHealthy: boolean;
    activeValidations: number;
    totalValidations: number;
    totalValidationErrors: number;
    lastCompletedAt: Date | null;
    lastErrorAt: Date | null;
    lastDurationMs: number | null;
  } {
    return {
      isHealthy: true, // In future, base on error rates/timeouts
      activeValidations: this.activeValidations.size,
      totalValidations: this.totalValidations,
      totalValidationErrors: this.totalValidationErrors,
      lastCompletedAt: this.lastCompletedAt,
      lastErrorAt: this.lastErrorAt,
      lastDurationMs: this.lastDurationMs
    };
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
