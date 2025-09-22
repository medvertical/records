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
  
  /** Validation aspects breakdown */
  aspects: {
    structural: ValidationAspectResult;
    profile: ValidationAspectResult;
    terminology: ValidationAspectResult;
    reference: ValidationAspectResult;
    businessRule: ValidationAspectResult;
    metadata: ValidationAspectResult;
  };
  
  /** Validation score (0-100) */
  validationScore: number;
  
  /** Performance metrics */
  performance: ValidationPerformance;
  
  /** Retry tracking information */
  retryInfo?: ValidationRetryInfo;
}

export interface ValidationAspectResult {
  /** Whether this aspect passed validation */
  passed: boolean;
  
  /** Issues found in this aspect */
  issues: ValidationIssue[];
  
  /** Number of errors */
  errorCount: number;
  
  /** Number of warnings */
  warningCount: number;
  
  /** Number of information messages */
  informationCount: number;
  
  /** Validation score for this aspect (0-100) */
  validationScore: number;
  
  /** Whether this aspect is enabled */
  enabled: boolean;
}

export interface ValidationRetryInfo {
  /** Number of retry attempts made */
  attempts: number;
  
  /** Maximum number of retry attempts allowed */
  maxAttempts: number;
  
  /** Whether this validation was a retry */
  wasRetry: boolean;
  
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

  // Enhanced features from legacy engines
  private humanReadableMessages: Map<string, string> = new Map();
  private simplifierClient: any = null;
  private terminologyClient: any = null;

  // Performance optimization features
  private validationCache = new Map<string, ValidationResult>();
  private profileCache = new Map<string, any>();
  private terminologyCache = new Map<string, boolean>();
  private referenceCache = new Map<string, boolean>();
  private businessRuleCache = new Map<string, ValidationIssue[]>();
  
  // Performance metrics
  private performanceMetrics = {
    totalValidations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageValidationTime: 0,
    peakMemoryUsage: 0,
    batchProcessingTimes: [] as number[]
  };

  // Memory management
  private maxCacheSize = 10000;
  private cacheEvictionThreshold = 0.8;
  private lastCacheCleanup = Date.now();

  constructor(config: Partial<ValidationEngineConfig> = {}) {
    super();
    
    this.config = {
      enableParallelValidation: true,
      maxConcurrentValidations: 10,
      defaultTimeoutMs: 30000,
      includeDebugInfo: false,
      enableCaching: true,
      enableBatchProcessing: true,
      enableMemoryOptimization: true,
      enablePerformanceMonitoring: true,
      maxCacheSize: 10000,
      cacheEvictionThreshold: 0.8,
      batchSize: 100,
      maxMemoryUsageMB: 512,
      ...config
    };

    // Initialize enhanced features
    this.initializeHumanReadableMessages();
    this.loadSimplifierClient();
    this.loadTerminologyClient();
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

      // Get current validation settings with fallback
      let settings;
      try {
        settings = await this.settingsService.getActiveSettings();
        
        // Ensure settings have the expected structure
        if (!settings || typeof settings !== 'object') {
          throw new Error('Settings is not an object');
        }
        
        // Ensure all required aspects are present
        const defaultSettings = {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'warning' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        };
        
        // Merge with defaults to ensure all aspects are present
        settings = { ...defaultSettings, ...settings };
        
      } catch (error) {
        console.warn('[RockSolidValidationEngine] Failed to load settings, using defaults:', error instanceof Error ? error.message : error);
        // Use default settings when database is unavailable
        settings = {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'warning' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' },
          maxConcurrentValidations: 5,
          profileResolutionServers: [],
          terminologyServers: [],
          customRules: []
        };
      }
      
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

    if (!settings.structural?.enabled) {
      return issues;
    }

    try {
      // Basic FHIR structure validation
      if (!resource.resourceType) {
        issues.push({
          severity: settings.structural?.severity || 'error',
          code: 'required-element-missing',
          message: 'Resource type is required',
          location: ['resourceType'],
          humanReadable: this.getHumanReadableMessage('required-element-missing', 'The resource must have a resourceType field'),
          aspect: 'structural'
        });
      }

      if (!resource.id && resource.resourceType !== 'Bundle') {
        issues.push({
          severity: settings.structural?.severity || 'error',
          code: 'required-element-missing',
          message: 'Resource ID is required',
          location: ['id'],
          humanReadable: this.getHumanReadableMessage('required-element-missing', 'The resource must have an id field'),
          aspect: 'structural'
        });
      }

      // Validate required fields based on resource type
      const requiredFields = this.getRequiredFieldsForResourceType(resource.resourceType);
      for (const field of requiredFields) {
        if (!this.hasField(resource, field)) {
          issues.push({
            severity: settings.structural?.severity || 'error',
            code: 'required-element-missing',
            message: `Required field '${field}' is missing`,
            location: [field],
            humanReadable: this.getHumanReadableMessage('required-element-missing', `The field '${field}' is required for ${resource.resourceType} resources`),
            aspect: 'structural'
          });
        }
      }

      // Validate field types
      this.validateFieldTypes(resource, issues, settings.structural || { enabled: true, severity: 'error' });

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'format-error',
        message: `Structural validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('format-error', 'An error occurred during structural validation'),
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
            code: validUrl ? 'profile-detected' : 'structure-definition-not-found',
            message: validUrl ? `Profile declared: ${url}` : `Invalid profile URL: ${String(url)}`,
            location: ['meta', 'profile'],
            humanReadable: validUrl ? `Detected declared profile ${url}` : this.getHumanReadableMessage('structure-definition-not-found', `Profile URL seems invalid: ${String(url)}`),
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
        code: 'format-error',
        message: `Profile validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('format-error', 'An error occurred during profile validation'),
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

      // Extract and validate codable concepts from the resource
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

      // Enhanced terminology validation with TerminologyClient
      if (this.terminologyClient) {
        const enhancedIssues = await this.performEnhancedTerminologyValidation(resource, settings, context);
        issues.push(...enhancedIssues);
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'terminology-error',
        message: `Terminology validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('terminology-error', 'An error occurred during terminology validation'),
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
        code: 'invalid-reference',
        message: `Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during reference validation'),
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
        code: 'invariant-failed',
        message: `Business rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred during business rule validation'),
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
        aspects: {
          structural: {
            passed: summary.aspects.structural.passed,
            issues: summary.aspects.structural.issues,
            errorCount: summary.aspects.structural.errorCount,
            warningCount: summary.aspects.structural.warningCount,
            informationCount: summary.aspects.structural.informationCount,
            validationScore: summary.aspects.structural.validationScore,
            enabled: summary.aspects.structural.enabled
          },
          profile: {
            passed: summary.aspects.profile.passed,
            issues: summary.aspects.profile.issues,
            errorCount: summary.aspects.profile.errorCount,
            warningCount: summary.aspects.profile.warningCount,
            informationCount: summary.aspects.profile.informationCount,
            validationScore: summary.aspects.profile.validationScore,
            enabled: summary.aspects.profile.enabled
          },
          terminology: {
            passed: summary.aspects.terminology.passed,
            issues: summary.aspects.terminology.issues,
            errorCount: summary.aspects.terminology.errorCount,
            warningCount: summary.aspects.terminology.warningCount,
            informationCount: summary.aspects.terminology.informationCount,
            validationScore: summary.aspects.terminology.validationScore,
            enabled: summary.aspects.terminology.enabled
          },
          reference: {
            passed: summary.aspects.reference.passed,
            issues: summary.aspects.reference.issues,
            errorCount: summary.aspects.reference.errorCount,
            warningCount: summary.aspects.reference.warningCount,
            informationCount: summary.aspects.reference.informationCount,
            validationScore: summary.aspects.reference.validationScore,
            enabled: summary.aspects.reference.enabled
          },
          businessRule: {
            passed: summary.aspects.businessRule.passed,
            issues: summary.aspects.businessRule.issues,
            errorCount: summary.aspects.businessRule.errorCount,
            warningCount: summary.aspects.businessRule.warningCount,
            informationCount: summary.aspects.businessRule.informationCount,
            validationScore: summary.aspects.businessRule.validationScore,
            enabled: summary.aspects.businessRule.enabled
          },
          metadata: {
            passed: summary.aspects.metadata.passed,
            issues: summary.aspects.metadata.issues,
            errorCount: summary.aspects.metadata.errorCount,
            warningCount: summary.aspects.metadata.warningCount,
            informationCount: summary.aspects.metadata.informationCount,
            validationScore: summary.aspects.metadata.validationScore,
            enabled: summary.aspects.metadata.enabled
          }
        },
        validationScore: summary.validationScore,
        performance,
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
    if (!path || typeof path !== 'string') return obj;
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
    // Handle null/undefined reference
    if (!reference || typeof reference !== 'string') {
      return { id: reference || '' };
    }
    
    // Handle different reference formats
    if (reference.startsWith('http')) {
      return { url: reference };
    }
    
    if (reference && typeof reference === 'string' && reference.includes('/')) {
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

  // ========================================================================
  // Enhanced Features from Legacy Engines
  // ========================================================================

  /**
   * Initialize human-readable messages for validation errors
   */
  private initializeHumanReadableMessages(): void {
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
    this.humanReadableMessages.set('invalid-date', 'The date format is invalid or outside the allowed range');
    this.humanReadableMessages.set('missing-binding', 'The code is not bound to the expected value set');
    this.humanReadableMessages.set('invalid-reference', 'The reference format is invalid or the referenced resource does not exist');
    this.humanReadableMessages.set('constraint-violation', 'A structural constraint has been violated');
    this.humanReadableMessages.set('metadata-incomplete', 'Required metadata is missing or incomplete');
  }

  /**
   * Load Simplifier client for enhanced profile resolution
   */
  private async loadSimplifierClient(): Promise<void> {
    try {
      const { SimplifierClient } = await import('../fhir/simplifier-client');
      this.simplifierClient = new SimplifierClient();
      console.log('[RockSolidValidationEngine] Simplifier client loaded successfully');
    } catch (error) {
      console.warn('[RockSolidValidationEngine] Simplifier client not available:', error instanceof Error ? error.message : error);
      this.simplifierClient = null;
    }
  }

  /**
   * Get human-readable message for validation error code
   */
  getHumanReadableMessage(code: string, fallback?: string): string {
    if (code && this.humanReadableMessages.has(code)) {
      return this.humanReadableMessages.get(code)!;
    }
    return fallback || `Validation error: ${code}`;
  }

  /**
   * Enhanced profile resolution with Simplifier support
   */
  async resolveProfileWithSimplifier(profileUrl: string): Promise<any> {
    if (this.simplifierClient) {
      try {
        return await this.simplifierClient.resolveProfile(profileUrl);
      } catch (error) {
        console.warn('[RockSolidValidationEngine] Simplifier profile resolution failed:', error);
      }
    }
    
    // Fallback to standard profile resolution
    return this.resolveProfile(profileUrl);
  }

  /**
   * Check if Simplifier client is available
   */
  isSimplifierAvailable(): boolean {
    return this.simplifierClient !== null;
  }

  /**
   * Load Terminology client for enhanced terminology validation
   */
  private async loadTerminologyClient(): Promise<void> {
    try {
      const { TerminologyClient, defaultTerminologyConfig } = await import('../fhir/terminology-client');
      this.terminologyClient = new TerminologyClient(defaultTerminologyConfig);
      console.log('[RockSolidValidationEngine] Terminology client loaded successfully');
    } catch (error) {
      console.warn('[RockSolidValidationEngine] Terminology client not available:', error instanceof Error ? error.message : error);
      this.terminologyClient = null;
    }
  }

  /**
   * Check if Terminology client is available
   */
  isTerminologyAvailable(): boolean {
    return this.terminologyClient !== null;
  }

  /**
   * Enhanced terminology validation with TerminologyClient support
   */
  async validateCodeWithTerminologyServer(code: string, system: string, valueSet?: string): Promise<boolean> {
    if (!this.terminologyClient) {
      return false;
    }

    try {
      // Use terminology client to validate code
      const result = await this.terminologyClient.validateCode(code, system, valueSet);
      return result.valid || false;
    } catch (error) {
      console.warn('[RockSolidValidationEngine] Terminology validation failed:', error);
      return false;
    }
  }

  /**
   * Resolve extension using terminology server
   */
  async resolveExtensionWithTerminology(extensionUrl: string): Promise<any> {
    if (!this.terminologyClient) {
      return null;
    }

    try {
      return await this.terminologyClient.resolveExtension(extensionUrl);
    } catch (error) {
      console.warn('[RockSolidValidationEngine] Extension resolution failed:', error);
      return null;
    }
  }

  /**
   * Search structure definitions using terminology server
   */
  async searchStructureDefinitionsWithTerminology(query: string): Promise<any[]> {
    if (!this.terminologyClient) {
      return [];
    }

    try {
      return await this.terminologyClient.searchStructureDefinitions(query);
    } catch (error) {
      console.warn('[RockSolidValidationEngine] Structure definition search failed:', error);
      return [];
    }
  }

  // ========================================================================
  // Terminology Validation Helper Methods
  // ========================================================================

  /**
   * Extract codable concepts from a FHIR resource
   */
  private extractCodableConcepts(resource: any): any[] {
    const concepts: any[] = [];
    
    const extractFromObject = (obj: any, path: string[] = []): void => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        
        if (value && typeof value === 'object') {
          // Check if this is a codable concept (has code and system)
          if ('code' in value && 'system' in value) {
            concepts.push({
              ...value,
              path: currentPath,
              resourceType: resource.resourceType
            });
          }
          
          // Recursively search nested objects
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (item && typeof item === 'object') {
                extractFromObject(item, [...currentPath, index.toString()]);
              }
            });
          } else {
            extractFromObject(value, currentPath);
          }
        }
      }
    };
    
    extractFromObject(resource);
    return concepts;
  }

  /**
   * Validate a codable concept
   */
  private async validateCodableConcept(concept: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Basic validation
      if (!concept.code) {
        issues.push({
          severity: settings.terminology.severity,
          code: 'missing-binding',
          message: 'Code is required for codable concept',
          location: concept.path,
          humanReadable: this.getHumanReadableMessage('missing-binding', 'The code field is required'),
          aspect: 'terminology'
        });
      }
      
      if (!concept.system) {
        issues.push({
          severity: settings.terminology.severity,
          code: 'missing-binding',
          message: 'System is required for codable concept',
          location: concept.path,
          humanReadable: this.getHumanReadableMessage('missing-binding', 'The system field is required'),
          aspect: 'terminology'
        });
      }
      
      // Enhanced validation with TerminologyClient
      if (this.terminologyClient && concept.code && concept.system) {
        const isValid = await this.validateCodeWithTerminologyServer(concept.code, concept.system);
        if (!isValid) {
          issues.push({
            severity: settings.terminology.severity,
            code: 'terminology-error',
            message: `Code '${concept.code}' is not valid in system '${concept.system}'`,
            location: concept.path,
            humanReadable: this.getHumanReadableMessage('terminology-error', `The code '${concept.code}' is not valid in the terminology system '${concept.system}'`),
            aspect: 'terminology'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'terminology-error',
        message: `Codable concept validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: concept.path,
        humanReadable: this.getHumanReadableMessage('terminology-error', 'An error occurred during codable concept validation'),
        aspect: 'terminology'
      });
    }
    
    return issues;
  }

  /**
   * Extract code systems from a FHIR resource
   */
  private extractCodeSystems(resource: any): any[] {
    // This is a simplified implementation
    // In a full implementation, you would traverse the resource more comprehensively
    const systems: any[] = [];
    const codableConcepts = this.extractCodableConcepts(resource);
    
    for (const concept of codableConcepts) {
      if (concept.system && !systems.find(s => s.system === concept.system)) {
        systems.push({
          system: concept.system,
          path: concept.path
        });
      }
    }
    
    return systems;
  }

  /**
   * Validate a code system
   */
  private async validateCodeSystem(codeSystem: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Basic validation
      if (!codeSystem.system) {
        issues.push({
          severity: settings.terminology.severity,
          code: 'missing-binding',
          message: 'Code system URL is required',
          location: codeSystem.path,
          humanReadable: this.getHumanReadableMessage('missing-binding', 'The code system URL is required'),
          aspect: 'terminology'
        });
      }
      
      // Enhanced validation with TerminologyClient
      if (this.terminologyClient && codeSystem.system) {
        // Validate that the code system is accessible
        const isValid = await this.validateCodeSystemWithTerminology(codeSystem.system);
        if (!isValid) {
          issues.push({
            severity: settings.terminology.severity,
            code: 'terminology-error',
            message: `Code system '${codeSystem.system}' is not accessible`,
            location: codeSystem.path,
            humanReadable: this.getHumanReadableMessage('terminology-error', `The code system '${codeSystem.system}' is not accessible or valid`),
            aspect: 'terminology'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'terminology-error',
        message: `Code system validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: codeSystem.path,
        humanReadable: this.getHumanReadableMessage('terminology-error', 'An error occurred during code system validation'),
        aspect: 'terminology'
      });
    }
    
    return issues;
  }

  /**
   * Extract value sets from a FHIR resource
   */
  private extractValueSets(resource: any): any[] {
    // This is a simplified implementation
    // In a full implementation, you would look for value set references
    const valueSets: any[] = [];
    
    // Look for value set references in the resource
    const extractValueSetsFromObject = (obj: any, path: string[] = []): void => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        
        if (value && typeof value === 'object') {
          // Check if this references a value set
          if ('valueSet' in value || 'binding' in value) {
            valueSets.push({
              ...value,
              path: currentPath
            });
          }
          
          // Recursively search nested objects
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (item && typeof item === 'object') {
                extractValueSetsFromObject(item, [...currentPath, index.toString()]);
              }
            });
          } else {
            extractValueSetsFromObject(value, currentPath);
          }
        }
      }
    };
    
    extractValueSetsFromObject(resource);
    return valueSets;
  }

  /**
   * Validate a value set
   */
  private async validateValueSet(valueSet: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Basic validation
      if (!valueSet.valueSet && !valueSet.binding?.valueSet) {
        return issues; // No value set to validate
      }
      
      const valueSetUrl = valueSet.valueSet || valueSet.binding?.valueSet;
      
      // Enhanced validation with TerminologyClient
      if (this.terminologyClient && valueSetUrl) {
        const isValid = await this.validateValueSetWithTerminology(valueSetUrl);
        if (!isValid) {
          issues.push({
            severity: settings.terminology.severity,
            code: 'terminology-error',
            message: `Value set '${valueSetUrl}' is not accessible`,
            location: valueSet.path,
            humanReadable: this.getHumanReadableMessage('terminology-error', `The value set '${valueSetUrl}' is not accessible or valid`),
            aspect: 'terminology'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'terminology-error',
        message: `Value set validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: valueSet.path,
        humanReadable: this.getHumanReadableMessage('terminology-error', 'An error occurred during value set validation'),
        aspect: 'terminology'
      });
    }
    
    return issues;
  }

  /**
   * Perform enhanced terminology validation using TerminologyClient
   */
  private async performEnhancedTerminologyValidation(resource: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Validate extensions using terminology server
      if (resource.extension && Array.isArray(resource.extension)) {
        for (const extension of resource.extension) {
          if (extension.url) {
            const resolvedExtension = await this.resolveExtensionWithTerminology(extension.url);
            if (!resolvedExtension) {
              issues.push({
                severity: settings.terminology.severity,
                code: 'terminology-error',
                message: `Extension '${extension.url}' could not be resolved`,
                location: ['extension'],
                humanReadable: this.getHumanReadableMessage('terminology-error', `The extension '${extension.url}' could not be resolved from the terminology server`),
                aspect: 'terminology'
              });
            }
          }
        }
      }
      
      // Validate profile references
      if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
        for (const profileUrl of resource.meta.profile) {
          const searchResults = await this.searchStructureDefinitionsWithTerminology(profileUrl);
          if (searchResults.length === 0) {
            issues.push({
              severity: settings.terminology.severity,
              code: 'structure-definition-not-found',
              message: `Profile '${profileUrl}' not found in terminology server`,
              location: ['meta', 'profile'],
              humanReadable: this.getHumanReadableMessage('structure-definition-not-found', `The profile '${profileUrl}' was not found in the terminology server`),
              aspect: 'terminology'
            });
          }
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'terminology-error',
        message: `Enhanced terminology validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('terminology-error', 'An error occurred during enhanced terminology validation'),
        aspect: 'terminology'
      });
    }
    
    return issues;
  }

  /**
   * Validate code system with terminology server
   */
  private async validateCodeSystemWithTerminology(systemUrl: string): Promise<boolean> {
    if (!this.terminologyClient) {
      return false;
    }

    try {
      // This is a simplified implementation
      // In a full implementation, you would check if the code system is accessible
      return true; // Placeholder - implement actual validation
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate value set with terminology server
   */
  private async validateValueSetWithTerminology(valueSetUrl: string): Promise<boolean> {
    if (!this.terminologyClient) {
      return false;
    }

    try {
      // This is a simplified implementation
      // In a full implementation, you would check if the value set is accessible
      return true; // Placeholder - implement actual validation
    } catch (error) {
      return false;
    }
  }

  // ========================================================================
  // Business Rule Validation Methods
  // ========================================================================

  /**
   * Apply built-in FHIR business rules
   */
  private async applyBuiltInBusinessRules(resource: any, settings: ValidationSettings): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // General FHIR business rules
      issues.push(...this.validateGeneralFhirBusinessRules(resource, settings));
      
      // Resource type specific business rules
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
        case 'Condition':
          issues.push(...this.validateConditionBusinessRules(resource, settings));
          break;
        case 'Procedure':
          issues.push(...this.validateProcedureBusinessRules(resource, settings));
          break;
        case 'Medication':
          issues.push(...this.validateMedicationBusinessRules(resource, settings));
          break;
        case 'MedicationRequest':
          issues.push(...this.validateMedicationRequestBusinessRules(resource, settings));
          break;
        case 'DiagnosticReport':
          issues.push(...this.validateDiagnosticReportBusinessRules(resource, settings));
          break;
        case 'AllergyIntolerance':
          issues.push(...this.validateAllergyIntoleranceBusinessRules(resource, settings));
          break;
        case 'Immunization':
          issues.push(...this.validateImmunizationBusinessRules(resource, settings));
          break;
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Built-in business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while applying built-in business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Apply custom business rules
   */
  private async applyCustomRule(resource: any, rule: any, settings: ValidationSettings): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      switch (rule.type) {
        case 'required':
          issues.push(...this.validateRequiredRule(resource, rule, settings));
          break;
        case 'pattern':
          issues.push(...this.validatePatternRule(resource, rule, settings));
          break;
        case 'custom':
          issues.push(...await this.validateCustomFunctionRule(resource, rule, settings));
          break;
        case 'cardinality':
          issues.push(...this.validateCardinalityRule(resource, rule, settings));
          break;
        case 'terminology':
          issues.push(...await this.validateTerminologyRule(resource, rule, settings));
          break;
        case 'invariant':
          issues.push(...this.validateInvariantRule(resource, rule, settings));
          break;
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Custom rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: rule.path || [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', `An error occurred while validating custom rule: ${rule.name || rule.type}`),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Apply resource-specific business rules
   */
  private async applyResourceSpecificRules(resource: any, settings: ValidationSettings): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // This method delegates to the built-in business rules
      // The built-in business rules already handle resource-specific validation
      // This is kept for consistency with the method structure
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Resource-specific business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while applying resource-specific business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Apply cross-field validation rules
   */
  private applyCrossFieldValidation(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Cross-field validation rules
      issues.push(...this.validateCrossFieldConstraints(resource, settings));
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Cross-field validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred during cross-field validation'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Apply temporal validation rules
   */
  private applyTemporalValidation(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Temporal validation rules (dates, times, periods)
      issues.push(...this.validateTemporalConstraints(resource, settings));
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Temporal validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred during temporal validation'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  // ========================================================================
  // Business Rule Helper Methods
  // ========================================================================

  /**
   * Validate general FHIR business rules
   */
  private validateGeneralFhirBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Resource must have a valid resourceType
      if (!resource.resourceType || typeof resource.resourceType !== 'string') {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Resource must have a valid resourceType',
          location: ['resourceType'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'The resource must have a valid resourceType field'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Resource must have an id (except Bundle)
      if (resource.resourceType !== 'Bundle' && (!resource.id || typeof resource.id !== 'string')) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Resource must have a valid id',
          location: ['id'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'The resource must have a valid id field'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Meta field must have valid structure if present
      if (resource.meta) {
        if (resource.meta.versionId && typeof resource.meta.versionId !== 'string') {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invariant-failed',
            message: 'Meta.versionId must be a string',
            location: ['meta', 'versionId'],
            humanReadable: this.getHumanReadableMessage('invariant-failed', 'The meta.versionId field must be a string'),
            aspect: 'businessRule'
          });
        }
        
        if (resource.meta.lastUpdated && !this.isValidDateTime(resource.meta.lastUpdated)) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invalid-date',
            message: 'Meta.lastUpdated must be a valid date',
            location: ['meta', 'lastUpdated'],
            humanReadable: this.getHumanReadableMessage('invalid-date', 'The meta.lastUpdated field must be a valid date'),
            aspect: 'businessRule'
          });
        }
      }
      
      // Rule: Text field must have valid structure if present
      if (resource.text) {
        if (!resource.text.div && !resource.text.status) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invariant-failed',
            message: 'Text field must have div or status',
            location: ['text'],
            humanReadable: this.getHumanReadableMessage('invariant-failed', 'The text field must have either div or status'),
            aspect: 'businessRule'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `General FHIR business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating general FHIR business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate Patient-specific business rules
   */
  private validatePatientBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Patient must have at least one identifier or name
      if ((!resource.identifier || resource.identifier.length === 0) && 
          (!resource.name || resource.name.length === 0)) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Patient must have at least one identifier or name',
          location: [],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A Patient resource must have at least one identifier or name'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Patient birthDate cannot be in the future
      if (resource.birthDate && this.isValidDate(resource.birthDate)) {
        const birthDate = new Date(resource.birthDate);
        const now = new Date();
        if (birthDate > now) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invalid-date',
            message: 'Patient birthDate cannot be in the future',
            location: ['birthDate'],
            humanReadable: this.getHumanReadableMessage('invalid-date', 'The patient birth date cannot be in the future'),
            aspect: 'businessRule'
          });
        }
      }
      
      // Rule: Patient deceasedDateTime cannot be in the future
      if (resource.deceasedDateTime && this.isValidDateTime(resource.deceasedDateTime)) {
        const deceasedDate = new Date(resource.deceasedDateTime);
        const now = new Date();
        if (deceasedDate > now) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invalid-date',
            message: 'Patient deceasedDateTime cannot be in the future',
            location: ['deceasedDateTime'],
            humanReadable: this.getHumanReadableMessage('invalid-date', 'The patient deceased date cannot be in the future'),
            aspect: 'businessRule'
          });
        }
      }
      
      // Rule: Patient cannot be both deceased and have deceasedDateTime
      if (resource.deceasedBoolean === true && resource.deceasedDateTime) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Patient cannot have both deceasedBoolean=true and deceasedDateTime',
          location: ['deceasedBoolean', 'deceasedDateTime'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A patient cannot have both deceasedBoolean=true and deceasedDateTime'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Patient business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating patient business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate Observation-specific business rules
   */
  private validateObservationBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Observation must have status
      if (!resource.status) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Observation must have status',
          location: ['status'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An Observation resource must have a status'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Observation must have code or category
      if ((!resource.code || !resource.code.coding || resource.code.coding.length === 0) &&
          (!resource.category || resource.category.length === 0)) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Observation must have code or category',
          location: [],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An Observation resource must have either a code or category'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Observation effectiveDateTime cannot be in the future
      if (resource.effectiveDateTime && this.isValidDateTime(resource.effectiveDateTime)) {
        const effectiveDate = new Date(resource.effectiveDateTime);
        const now = new Date();
        if (effectiveDate > now) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invalid-date',
            message: 'Observation effectiveDateTime cannot be in the future',
            location: ['effectiveDateTime'],
            humanReadable: this.getHumanReadableMessage('invalid-date', 'The observation effective date cannot be in the future'),
            aspect: 'businessRule'
          });
        }
      }
      
      // Rule: Observation value and dataAbsentReason are mutually exclusive
      if (resource.value && resource.dataAbsentReason) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Observation cannot have both value and dataAbsentReason',
          location: ['value', 'dataAbsentReason'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An observation cannot have both a value and dataAbsentReason'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Observation business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating observation business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate Encounter-specific business rules
   */
  private validateEncounterBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Encounter must have status
      if (!resource.status) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Encounter must have status',
          location: ['status'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An Encounter resource must have a status'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Encounter must have class
      if (!resource.class) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Encounter must have class',
          location: ['class'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An Encounter resource must have a class'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Encounter period start cannot be after end
      if (resource.period && resource.period.start && resource.period.end) {
        const startDate = new Date(resource.period.start);
        const endDate = new Date(resource.period.end);
        if (startDate > endDate) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invalid-date',
            message: 'Encounter period start cannot be after end',
            location: ['period'],
            humanReadable: this.getHumanReadableMessage('invalid-date', 'The encounter period start date cannot be after the end date'),
            aspect: 'businessRule'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Encounter business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating encounter business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate Condition-specific business rules
   */
  private validateConditionBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Condition must have clinicalStatus or verificationStatus
      if (!resource.clinicalStatus && !resource.verificationStatus) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Condition must have clinicalStatus or verificationStatus',
          location: [],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A Condition resource must have either clinicalStatus or verificationStatus'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Condition must have code
      if (!resource.code) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Condition must have code',
          location: ['code'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A Condition resource must have a code'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Condition business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating condition business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate Procedure-specific business rules
   */
  private validateProcedureBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Procedure must have status
      if (!resource.status) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Procedure must have status',
          location: ['status'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A Procedure resource must have a status'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Procedure must have code
      if (!resource.code) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Procedure must have code',
          location: ['code'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A Procedure resource must have a code'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Procedure business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating procedure business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate Medication-specific business rules
   */
  private validateMedicationBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Medication must have code or ingredient
      if (!resource.code && (!resource.ingredient || resource.ingredient.length === 0)) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Medication must have code or ingredient',
          location: [],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A Medication resource must have either a code or ingredient'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Medication business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating medication business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate MedicationRequest-specific business rules
   */
  private validateMedicationRequestBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: MedicationRequest must have status
      if (!resource.status) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'MedicationRequest must have status',
          location: ['status'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A MedicationRequest resource must have a status'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: MedicationRequest must have intent
      if (!resource.intent) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'MedicationRequest must have intent',
          location: ['intent'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A MedicationRequest resource must have an intent'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `MedicationRequest business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating medication request business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate DiagnosticReport-specific business rules
   */
  private validateDiagnosticReportBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: DiagnosticReport must have status
      if (!resource.status) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'DiagnosticReport must have status',
          location: ['status'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A DiagnosticReport resource must have a status'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: DiagnosticReport must have code
      if (!resource.code) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'DiagnosticReport must have code',
          location: ['code'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'A DiagnosticReport resource must have a code'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `DiagnosticReport business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating diagnostic report business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate AllergyIntolerance-specific business rules
   */
  private validateAllergyIntoleranceBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: AllergyIntolerance must have clinicalStatus
      if (!resource.clinicalStatus) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'AllergyIntolerance must have clinicalStatus',
          location: ['clinicalStatus'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An AllergyIntolerance resource must have a clinicalStatus'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: AllergyIntolerance must have verificationStatus
      if (!resource.verificationStatus) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'AllergyIntolerance must have verificationStatus',
          location: ['verificationStatus'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An AllergyIntolerance resource must have a verificationStatus'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `AllergyIntolerance business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating allergy intolerance business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate Immunization-specific business rules
   */
  private validateImmunizationBusinessRules(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Rule: Immunization must have status
      if (!resource.status) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Immunization must have status',
          location: ['status'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An Immunization resource must have a status'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Immunization must have vaccineCode
      if (!resource.vaccineCode) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Immunization must have vaccineCode',
          location: ['vaccineCode'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An Immunization resource must have a vaccineCode'),
          aspect: 'businessRule'
        });
      }
      
      // Rule: Immunization must have patient
      if (!resource.patient) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'invariant-failed',
          message: 'Immunization must have patient',
          location: ['patient'],
          humanReadable: this.getHumanReadableMessage('invariant-failed', 'An Immunization resource must have a patient reference'),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Immunization business rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred while validating immunization business rules'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  // ========================================================================
  // Custom Rule Validation Methods
  // ========================================================================

  /**
   * Validate required rule
   */
  private validateRequiredRule(resource: any, rule: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      const value = this.getValueByPath(resource, rule.path);
      if (value === undefined || value === null || value === '') {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'required-element-missing',
          message: `Required field '${rule.path.join('.')}' is missing`,
          location: rule.path,
          humanReadable: this.getHumanReadableMessage('required-element-missing', `The required field '${rule.path.join('.')}' is missing`),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Required rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: rule.path || [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', `An error occurred while validating required rule: ${rule.name || rule.path?.join('.')}`),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate pattern rule
   */
  private validatePatternRule(resource: any, rule: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      const value = this.getValueByPath(resource, rule.path);
      if (value !== undefined && value !== null && typeof value === 'string') {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'pattern-mismatch',
            message: `Field '${rule.path.join('.')}' does not match pattern '${rule.pattern}'`,
            location: rule.path,
            humanReadable: this.getHumanReadableMessage('pattern-mismatch', `The field '${rule.path.join('.')}' does not match the required pattern`),
            aspect: 'businessRule'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Pattern rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: rule.path || [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', `An error occurred while validating pattern rule: ${rule.name || rule.path?.join('.')}`),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate custom function rule
   */
  private async validateCustomFunctionRule(resource: any, rule: any, settings: ValidationSettings): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      if (typeof rule.function === 'function') {
        const result = await rule.function(resource, rule);
        if (result && result.length > 0) {
          issues.push(...result);
        }
      } else {
        issues.push({
          severity: 'error',
          code: 'invariant-failed',
          message: `Custom function rule '${rule.name}' has invalid function`,
          location: rule.path || [],
          humanReadable: this.getHumanReadableMessage('invariant-failed', `The custom function rule '${rule.name}' has an invalid function`),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Custom function rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: rule.path || [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', `An error occurred while validating custom function rule: ${rule.name}`),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate cardinality rule
   */
  private validateCardinalityRule(resource: any, rule: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      const value = this.getValueByPath(resource, rule.path);
      const count = Array.isArray(value) ? value.length : (value !== undefined && value !== null ? 1 : 0);
      
      if (rule.min !== undefined && count < rule.min) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'cardinality-violation',
          message: `Field '${rule.path.join('.')}' has ${count} values, minimum is ${rule.min}`,
          location: rule.path,
          humanReadable: this.getHumanReadableMessage('cardinality-violation', `The field '${rule.path.join('.')}' has ${count} values, but minimum is ${rule.min}`),
          aspect: 'businessRule'
        });
      }
      
      if (rule.max !== undefined && count > rule.max) {
        issues.push({
          severity: settings.businessRule.severity,
          code: 'cardinality-violation',
          message: `Field '${rule.path.join('.')}' has ${count} values, maximum is ${rule.max}`,
          location: rule.path,
          humanReadable: this.getHumanReadableMessage('cardinality-violation', `The field '${rule.path.join('.')}' has ${count} values, but maximum is ${rule.max}`),
          aspect: 'businessRule'
        });
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Cardinality rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: rule.path || [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', `An error occurred while validating cardinality rule: ${rule.name || rule.path?.join('.')}`),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate terminology rule
   */
  private async validateTerminologyRule(resource: any, rule: any, settings: ValidationSettings): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      const value = this.getValueByPath(resource, rule.path);
      if (value !== undefined && value !== null) {
        // This would integrate with the terminology validation
        // For now, it's a placeholder
        if (this.terminologyClient && rule.valueSet) {
          const isValid = await this.validateCodeWithTerminologyServer(value, rule.system, rule.valueSet);
          if (!isValid) {
            issues.push({
              severity: settings.businessRule.severity,
              code: 'terminology-error',
              message: `Field '${rule.path.join('.')}' has invalid terminology value '${value}'`,
              location: rule.path,
              humanReadable: this.getHumanReadableMessage('terminology-error', `The field '${rule.path.join('.')}' has an invalid terminology value`),
              aspect: 'businessRule'
            });
          }
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Terminology rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: rule.path || [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', `An error occurred while validating terminology rule: ${rule.name || rule.path?.join('.')}`),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate invariant rule
   */
  private validateInvariantRule(resource: any, rule: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Invariant rules are complex business logic constraints
      // This is a simplified implementation
      if (rule.expression && typeof rule.expression === 'function') {
        const result = rule.expression(resource);
        if (!result) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invariant-failed',
            message: `Invariant rule '${rule.name}' failed`,
            location: rule.path || [],
            humanReadable: this.getHumanReadableMessage('invariant-failed', `The invariant rule '${rule.name}' has been violated`),
            aspect: 'businessRule'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Invariant rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: rule.path || [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', `An error occurred while validating invariant rule: ${rule.name}`),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  // ========================================================================
  // Cross-Field and Temporal Validation Methods
  // ========================================================================

  /**
   * Validate cross-field constraints
   */
  private validateCrossFieldConstraints(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Example cross-field validations
      
      // Rule: If resource has both status and effectivePeriod, status should be consistent with period
      if (resource.status && resource.effectivePeriod) {
        // This is a simplified example - in practice, you'd have more complex logic
        if (resource.status === 'completed' && resource.effectivePeriod.end && !this.isValidDateTime(resource.effectivePeriod.end)) {
          issues.push({
            severity: settings.businessRule.severity,
            code: 'invariant-failed',
            message: 'Completed resource must have valid end date in effectivePeriod',
            location: ['status', 'effectivePeriod'],
            humanReadable: this.getHumanReadableMessage('invariant-failed', 'A completed resource must have a valid end date in its effective period'),
            aspect: 'businessRule'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Cross-field validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred during cross-field validation'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  /**
   * Validate temporal constraints
   */
  private validateTemporalConstraints(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Validate date/time fields
      const dateFields = ['birthDate', 'deceasedDateTime', 'effectiveDateTime', 'issued', 'recordedDate'];
      
      for (const field of dateFields) {
        if (resource[field]) {
          if (!this.isValidDateTime(resource[field])) {
            issues.push({
              severity: settings.businessRule.severity,
              code: 'invalid-date',
              message: `Field '${field}' has invalid date format`,
              location: [field],
              humanReadable: this.getHumanReadableMessage('invalid-date', `The field '${field}' has an invalid date format`),
              aspect: 'businessRule'
            });
          }
        }
      }
      
      // Validate periods
      if (resource.effectivePeriod) {
        const start = resource.effectivePeriod.start;
        const end = resource.effectivePeriod.end;
        
        if (start && end) {
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          if (startDate > endDate) {
            issues.push({
              severity: settings.businessRule.severity,
              code: 'invalid-date',
              message: 'Period start date cannot be after end date',
              location: ['effectivePeriod'],
              humanReadable: this.getHumanReadableMessage('invalid-date', 'The period start date cannot be after the end date'),
              aspect: 'businessRule'
            });
          }
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invariant-failed',
        message: `Temporal validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invariant-failed', 'An error occurred during temporal validation'),
        aspect: 'businessRule'
      });
    }
    
    return issues;
  }

  // ========================================================================
  // Utility Methods for Business Rule Validation
  // ========================================================================

  /**
   * Check if a string is a valid date
   */
  private isValidDate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
  }

  /**
   * Check if a string is a valid date-time
   */
  private isValidDateTime(dateTimeString: string): boolean {
    if (!dateTimeString || typeof dateTimeString !== 'string') return false;
    const date = new Date(dateTimeString);
    return !isNaN(date.getTime());
  }

  // ========================================================================
  // Reference Validation Methods
  // ========================================================================

  /**
   * Extract all references from a FHIR resource
   */
  private extractReferences(resource: any): any[] {
    const references: any[] = [];
    
    const extractFromObject = (obj: any, path: string[] = []): void => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        
        if (value && typeof value === 'object') {
          // Check if this is a reference object
          if (value.reference || value.url) {
            references.push({
              ...value,
              path: currentPath,
              resourceType: resource.resourceType
            });
          }
          
          // Check if this is a string that looks like a reference
          if (typeof value === 'string' && this.looksLikeReference(value)) {
            references.push({
              reference: value,
              path: currentPath,
              resourceType: resource.resourceType
            });
          }
          
          // Recursively search nested objects
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (item && typeof item === 'object') {
                extractFromObject(item, [...currentPath, index.toString()]);
              } else if (typeof item === 'string' && this.looksLikeReference(item)) {
                references.push({
                  reference: item,
                  path: [...currentPath, index.toString()],
                  resourceType: resource.resourceType
                });
              }
            });
          } else {
            extractFromObject(value, currentPath);
          }
        } else if (typeof value === 'string' && this.looksLikeReference(value)) {
          references.push({
            reference: value,
            path: currentPath,
            resourceType: resource.resourceType
          });
        }
      }
    };
    
    extractFromObject(resource);
    return references;
  }

  /**
   * Check if a string looks like a FHIR reference
   */
  private looksLikeReference(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    
    // Check for various FHIR reference patterns
    return (
      // Relative reference: ResourceType/id
      /^[A-Z][a-zA-Z]*\/[a-zA-Z0-9-_.]+$/.test(value) ||
      // Absolute reference: http://.../ResourceType/id
      /^https?:\/\/.*\/[A-Z][a-zA-Z]*\/[a-zA-Z0-9-_.]+$/.test(value) ||
      // UUID reference
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
      // Fragment reference: #fragment
      /^#[a-zA-Z0-9-_.]+$/.test(value)
    );
  }

  /**
   * Validate a single reference
   */
  private async validateReference(reference: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      const refString = reference.reference || reference.url;
      if (!refString) {
        issues.push({
          severity: settings.reference.severity,
          code: 'invalid-reference',
          message: 'Reference object must have reference or url field',
          location: reference.path,
          humanReadable: this.getHumanReadableMessage('invalid-reference', 'The reference object must have either a reference or url field'),
          aspect: 'reference'
        });
        return issues;
      }
      
      // Parse the reference
      const parsedRef = this.parseReference(refString);
      
      // Validate reference format
      if (!parsedRef.isValid) {
        issues.push({
          severity: settings.reference.severity,
          code: 'invalid-reference',
          message: `Invalid reference format: ${refString}`,
          location: reference.path,
          humanReadable: this.getHumanReadableMessage('invalid-reference', `The reference '${refString}' has an invalid format`),
          aspect: 'reference'
        });
        return issues;
      }
      
      // Validate based on reference type
      if (parsedRef.type === 'internal') {
        issues.push(...await this.validateInternalReference(parsedRef, reference, settings, context));
      } else if (parsedRef.type === 'external') {
        issues.push(...await this.validateExternalReference(parsedRef, reference, settings, context));
      } else if (parsedRef.type === 'fragment') {
        issues.push(...await this.validateFragmentReference(parsedRef, reference, settings, context));
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: reference.path,
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during reference validation'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Parse a reference string into components
   */
  private parseReference(refString: string): any {
    try {
      // Fragment reference: #fragment
      if (refString.startsWith('#')) {
        return {
          isValid: true,
          type: 'fragment',
          fragment: refString.substring(1),
          original: refString
        };
      }
      
      // Absolute reference: http://.../ResourceType/id
      if (refString.startsWith('http')) {
        const parts = refString.split('/');
        if (parts.length >= 2) {
          const resourceType = parts[parts.length - 2];
          const id = parts[parts.length - 1];
          return {
            isValid: true,
            type: 'external',
            url: refString,
            resourceType,
            id,
            original: refString
          };
        }
      }
      
      // Relative reference: ResourceType/id
      const relativeMatch = refString.match(/^([A-Z][a-zA-Z]*)\/([a-zA-Z0-9-_.]+)$/);
      if (relativeMatch) {
        return {
          isValid: true,
          type: 'internal',
          resourceType: relativeMatch[1],
          id: relativeMatch[2],
          original: refString
        };
      }
      
      // UUID reference
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refString)) {
        return {
          isValid: true,
          type: 'internal',
          id: refString,
          original: refString
        };
      }
      
      return {
        isValid: false,
        original: refString
      };
      
    } catch (error) {
      return {
        isValid: false,
        original: refString,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate internal reference
   */
  private async validateInternalReference(parsedRef: any, reference: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Validate resource type format
      if (parsedRef.resourceType) {
        if (!/^[A-Z][a-zA-Z]*$/.test(parsedRef.resourceType)) {
          issues.push({
            severity: settings.reference.severity,
            code: 'invalid-reference',
            message: `Invalid resource type in reference: ${parsedRef.resourceType}`,
            location: reference.path,
            humanReadable: this.getHumanReadableMessage('invalid-reference', `The resource type '${parsedRef.resourceType}' in the reference is invalid`),
            aspect: 'reference'
          });
        }
      }
      
      // Validate ID format
      if (parsedRef.id) {
        if (!/^[a-zA-Z0-9-_.]+$/.test(parsedRef.id)) {
          issues.push({
            severity: settings.reference.severity,
            code: 'invalid-reference',
            message: `Invalid ID in reference: ${parsedRef.id}`,
            location: reference.path,
            humanReadable: this.getHumanReadableMessage('invalid-reference', `The ID '${parsedRef.id}' in the reference is invalid`),
            aspect: 'reference'
          });
        }
      }
      
      // Check for self-reference
      if (reference.resourceType && parsedRef.resourceType === reference.resourceType && parsedRef.id === reference.id) {
        issues.push({
          severity: settings.reference.severity,
          code: 'invalid-reference',
          message: 'Resource cannot reference itself',
          location: reference.path,
          humanReadable: this.getHumanReadableMessage('invalid-reference', 'A resource cannot reference itself'),
          aspect: 'reference'
        });
      }
      
      // Enhanced validation with FHIR client if available
      if (context.fhirClient) {
        const exists = await this.checkResourceExists(parsedRef, context.fhirClient);
        if (!exists) {
          issues.push({
            severity: settings.reference.severity,
            code: 'reference-not-found',
            message: `Referenced resource not found: ${parsedRef.original}`,
            location: reference.path,
            humanReadable: this.getHumanReadableMessage('reference-not-found', `The referenced resource '${parsedRef.original}' was not found`),
            aspect: 'reference'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `Internal reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: reference.path,
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during internal reference validation'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Validate external reference
   */
  private async validateExternalReference(parsedRef: any, reference: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Validate URL format
      try {
        new URL(parsedRef.url);
      } catch (error) {
        issues.push({
          severity: settings.reference.severity,
          code: 'invalid-reference',
          message: `Invalid URL in external reference: ${parsedRef.url}`,
          location: reference.path,
          humanReadable: this.getHumanReadableMessage('invalid-reference', `The URL '${parsedRef.url}' in the external reference is invalid`),
          aspect: 'reference'
        });
        return issues;
      }
      
      // Validate resource type format
      if (parsedRef.resourceType && !/^[A-Z][a-zA-Z]*$/.test(parsedRef.resourceType)) {
        issues.push({
          severity: settings.reference.severity,
          code: 'invalid-reference',
          message: `Invalid resource type in external reference: ${parsedRef.resourceType}`,
          location: reference.path,
          humanReadable: this.getHumanReadableMessage('invalid-reference', `The resource type '${parsedRef.resourceType}' in the external reference is invalid`),
          aspect: 'reference'
        });
      }
      
      // Validate ID format
      if (parsedRef.id && !/^[a-zA-Z0-9-_.]+$/.test(parsedRef.id)) {
        issues.push({
          severity: settings.reference.severity,
          code: 'invalid-reference',
          message: `Invalid ID in external reference: ${parsedRef.id}`,
          location: reference.path,
          humanReadable: this.getHumanReadableMessage('invalid-reference', `The ID '${parsedRef.id}' in the external reference is invalid`),
          aspect: 'reference'
        });
      }
      
      // Enhanced validation with FHIR client if available
      if (context.fhirClient) {
        const exists = await this.checkExternalResourceExists(parsedRef, context.fhirClient);
        if (!exists) {
          issues.push({
            severity: settings.reference.severity,
            code: 'reference-not-found',
            message: `External referenced resource not found: ${parsedRef.original}`,
            location: reference.path,
            humanReadable: this.getHumanReadableMessage('reference-not-found', `The external referenced resource '${parsedRef.original}' was not found`),
            aspect: 'reference'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `External reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: reference.path,
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during external reference validation'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Validate fragment reference
   */
  private async validateFragmentReference(parsedRef: any, reference: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Validate fragment format
      if (!/^[a-zA-Z0-9-_.]+$/.test(parsedRef.fragment)) {
        issues.push({
          severity: settings.reference.severity,
          code: 'invalid-reference',
          message: `Invalid fragment format: ${parsedRef.fragment}`,
          location: reference.path,
          humanReadable: this.getHumanReadableMessage('invalid-reference', `The fragment '${parsedRef.fragment}' has an invalid format`),
          aspect: 'reference'
        });
      }
      
      // Note: Fragment validation is limited without full context
      // In a full implementation, you would check if the fragment exists in the resource
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `Fragment reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: reference.path,
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during fragment reference validation'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Validate reference integrity (circular references, broken chains)
   */
  private async validateReferenceIntegrity(resource: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Check for circular references
      const circularIssues = this.checkCircularReferences(resource, settings);
      issues.push(...circularIssues);
      
      // Check for broken reference chains
      const chainIssues = await this.checkBrokenReferenceChains(resource, settings, context);
      issues.push(...chainIssues);
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `Reference integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during reference integrity validation'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Check for circular references
   */
  private checkCircularReferences(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Simple circular reference check
      const visited = new Set<string>();
      const checkForCircularRef = (obj: any, path: string[] = []): void => {
        if (!obj || typeof obj !== 'object') return;
        
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = [...path, key];
          const pathString = currentPath.join('.');
          
          if (visited.has(pathString)) {
            issues.push({
              severity: settings.reference.severity,
              code: 'invalid-reference',
              message: `Circular reference detected at path: ${pathString}`,
              location: currentPath,
              humanReadable: this.getHumanReadableMessage('invalid-reference', `A circular reference was detected at '${pathString}'`),
              aspect: 'reference'
            });
            return;
          }
          
          visited.add(pathString);
          
          if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                if (item && typeof item === 'object') {
                  checkForCircularRef(item, [...currentPath, index.toString()]);
                }
              });
            } else {
              checkForCircularRef(value, currentPath);
            }
          }
          
          visited.delete(pathString);
        }
      };
      
      checkForCircularRef(resource);
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `Circular reference check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during circular reference check'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Check for broken reference chains
   */
  private async checkBrokenReferenceChains(resource: any, settings: ValidationSettings, context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // This is a simplified implementation
      // In a full implementation, you would check if all referenced resources exist
      // and if the reference chains are complete
      
      if (context.fhirClient) {
        const references = this.extractReferences(resource);
        for (const reference of references) {
          const refString = reference.reference || reference.url;
          if (refString && !refString.startsWith('#')) {
            const parsedRef = this.parseReference(refString);
            if (parsedRef.isValid) {
              const exists = parsedRef.type === 'external' 
                ? await this.checkExternalResourceExists(parsedRef, context.fhirClient)
                : await this.checkResourceExists(parsedRef, context.fhirClient);
              
              if (!exists) {
                issues.push({
                  severity: settings.reference.severity,
                  code: 'reference-not-found',
                  message: `Broken reference chain: ${refString}`,
                  location: reference.path,
                  humanReadable: this.getHumanReadableMessage('reference-not-found', `The referenced resource '${refString}' was not found, breaking the reference chain`),
                  aspect: 'reference'
                });
              }
            }
          }
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `Broken reference chain check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during broken reference chain check'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Validate reference cardinality and constraints
   */
  private validateReferenceCardinality(resource: any, settings: ValidationSettings): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    try {
      // Check for reference cardinality violations
      const referenceFields = this.getReferenceFields(resource);
      
      for (const field of referenceFields) {
        if (field.min && field.count < field.min) {
          issues.push({
            severity: settings.reference.severity,
            code: 'cardinality-violation',
            message: `Reference field '${field.path.join('.')}' has ${field.count} references, minimum is ${field.min}`,
            location: field.path,
            humanReadable: this.getHumanReadableMessage('cardinality-violation', `The reference field '${field.path.join('.')}' has ${field.count} references, but minimum is ${field.min}`),
            aspect: 'reference'
          });
        }
        
        if (field.max && field.count > field.max) {
          issues.push({
            severity: settings.reference.severity,
            code: 'cardinality-violation',
            message: `Reference field '${field.path.join('.')}' has ${field.count} references, maximum is ${field.max}`,
            location: field.path,
            humanReadable: this.getHumanReadableMessage('cardinality-violation', `The reference field '${field.path.join('.')}' has ${field.count} references, but maximum is ${field.max}`),
            aspect: 'reference'
          });
        }
      }
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference',
        message: `Reference cardinality validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: [],
        humanReadable: this.getHumanReadableMessage('invalid-reference', 'An error occurred during reference cardinality validation'),
        aspect: 'reference'
      });
    }
    
    return issues;
  }

  /**
   * Get reference fields with cardinality information
   */
  private getReferenceFields(resource: any): any[] {
    const referenceFields: any[] = [];
    
    // This is a simplified implementation
    // In a full implementation, you would get cardinality information from the FHIR specification
    const knownReferenceFields = [
      { path: ['subject'], min: 0, max: 1 },
      { path: ['patient'], min: 0, max: 1 },
      { path: ['encounter'], min: 0, max: 1 },
      { path: ['performer'], min: 0, max: Infinity },
      { path: ['author'], min: 0, max: Infinity },
      { path: ['custodian'], min: 0, max: 1 },
      { path: ['basedOn'], min: 0, max: Infinity },
      { path: ['partOf'], min: 0, max: Infinity }
    ];
    
    for (const field of knownReferenceFields) {
      const value = this.getValueByPath(resource, field.path);
      const count = Array.isArray(value) ? value.length : (value ? 1 : 0);
      
      referenceFields.push({
        ...field,
        count,
        value
      });
    }
    
    return referenceFields;
  }

  /**
   * Check if a resource exists (internal reference)
   */
  private async checkResourceExists(parsedRef: any, fhirClient: any): Promise<boolean> {
    try {
      if (!parsedRef.resourceType || !parsedRef.id) {
        return false;
      }
      
      // This would make an actual FHIR request to check if the resource exists
      // For now, it's a placeholder
      return true;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if an external resource exists
   */
  private async checkExternalResourceExists(parsedRef: any, fhirClient: any): Promise<boolean> {
    try {
      if (!parsedRef.url) {
        return false;
      }
      
      // This would make an actual HTTP request to check if the external resource exists
      // For now, it's a placeholder
      return true;
      
    } catch (error) {
      return false;
    }
  }

  // ========================================================================
  // Performance Optimization Methods
  // ========================================================================

  /**
   * Generate cache key for validation request
   */
  private generateCacheKey(request: ValidationRequest, settings: any): string {
    const resourceHash = this.hashResource(request.resource);
    const settingsHash = this.hashSettings(settings);
    return `${request.resourceType}_${resourceHash}_${settingsHash}`;
  }

  /**
   * Hash resource for caching
   */
  private hashResource(resource: any): string {
    try {
      // Create a deterministic hash of the resource
      const resourceString = JSON.stringify(resource, Object.keys(resource).sort());
      return this.simpleHash(resourceString);
    } catch (error) {
      return `error_${Date.now()}`;
    }
  }

  /**
   * Hash settings for caching
   */
  private hashSettings(settings: any): string {
    try {
      // Create a deterministic hash of the settings
      const settingsString = JSON.stringify(settings, Object.keys(settings).sort());
      return this.simpleHash(settingsString);
    } catch (error) {
      return `error_${Date.now()}`;
    }
  }

  /**
   * Simple hash function for caching
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check cache for validation result
   */
  private getCachedResult(cacheKey: string): ValidationResult | null {
    if (!this.config.enableCaching) {
      return null;
    }

    const cached = this.validationCache.get(cacheKey);
    if (cached) {
      this.performanceMetrics.cacheHits++;
      return { ...cached, fromCache: true };
    }
    
    this.performanceMetrics.cacheMisses++;
    return null;
  }

  /**
   * Store validation result in cache
   */
  private setCachedResult(cacheKey: string, result: ValidationResult): void {
    if (!this.config.enableCaching) {
      return;
    }

    // Check cache size and evict if necessary
    if (this.validationCache.size >= this.config.maxCacheSize) {
      this.evictCacheEntries();
    }

    this.validationCache.set(cacheKey, { ...result, fromCache: false });
  }

  /**
   * Evict cache entries using LRU strategy
   */
  private evictCacheEntries(): void {
    const entriesToEvict = Math.floor(this.validationCache.size * this.config.cacheEvictionThreshold);
    const entries = Array.from(this.validationCache.entries());
    
    // Simple LRU eviction - remove oldest entries
    for (let i = 0; i < entriesToEvict; i++) {
      this.validationCache.delete(entries[i][0]);
    }
  }

  /**
   * Optimized batch validation with performance monitoring
   */
  async validateResourcesOptimized(requests: ValidationRequest[]): Promise<ValidationResult[]> {
    const startTime = Date.now();
    const results: ValidationResult[] = [];

    try {
      if (!this.config.enableBatchProcessing || requests.length === 0) {
        return this.validateResources(requests);
      }

      // Process in optimized batches
      const batchSize = Math.min(this.config.batchSize || 100, requests.length);
      const batches = this.chunkArray(requests, batchSize);

      for (const batch of batches) {
        const batchStartTime = Date.now();
        
        // Process batch with optimizations
        const batchResults = await this.processBatchOptimized(batch);
        results.push(...batchResults);
        
        const batchTime = Date.now() - batchStartTime;
        this.performanceMetrics.batchProcessingTimes.push(batchTime);
        
        // Memory management
        if (this.config.enableMemoryOptimization) {
          await this.performMemoryManagement();
        }
        
        // Emit batch completion event
        this.emit('batchCompleted', {
          batchSize: batch.length,
          duration: batchTime,
          totalProcessed: results.length,
          remaining: requests.length - results.length
        });
      }

      const totalTime = Date.now() - startTime;
      this.updatePerformanceMetrics(totalTime, results.length);

      return results;

    } catch (error) {
      this.emit('batchError', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: results.length,
        total: requests.length
      });
      throw error;
    }
  }

  /**
   * Process batch with optimizations
   */
  private async processBatchOptimized(batch: ValidationRequest[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Group requests by resource type for better caching
    const groupedRequests = this.groupRequestsByType(batch);
    
    for (const [resourceType, requests] of groupedRequests) {
      // Process requests in parallel with controlled concurrency
      const concurrencyLimit = Math.min(this.config.maxConcurrentValidations || 10, requests.length);
      const chunks = this.chunkArray(requests, concurrencyLimit);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(request => this.validateResourceOptimized(request));
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      }
    }
    
    return results;
  }

  /**
   * Group requests by resource type
   */
  private groupRequestsByType(requests: ValidationRequest[]): Map<string, ValidationRequest[]> {
    const grouped = new Map<string, ValidationRequest[]>();
    
    for (const request of requests) {
      const type = request.resourceType || 'unknown';
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(request);
    }
    
    return grouped;
  }

  /**
   * Optimized single resource validation with caching
   */
  private async validateResourceOptimized(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Get settings
      const settings = await this.settingsService.getActiveSettings();
      
      // Check cache first
      const cacheKey = this.generateCacheKey(request, settings);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
      
      // Perform validation
      const result = await this.performValidation(request, settings, request.context?.requestId || 'optimized');
      
      // Cache result
      this.setCachedResult(cacheKey, result);
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.updateValidationMetrics(duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateValidationMetrics(duration, true);
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(totalTime: number, resourceCount: number): void {
    this.performanceMetrics.totalValidations += resourceCount;
    
    // Update average validation time
    const currentAverage = this.performanceMetrics.averageValidationTime;
    const totalValidations = this.performanceMetrics.totalValidations;
    this.performanceMetrics.averageValidationTime = 
      (currentAverage * (totalValidations - resourceCount) + totalTime) / totalValidations;
    
    // Update peak memory usage
    if (this.config.enableMemoryOptimization) {
      const currentMemory = this.getCurrentMemoryUsage();
      this.performanceMetrics.peakMemoryUsage = Math.max(
        this.performanceMetrics.peakMemoryUsage,
        currentMemory
      );
    }
  }

  /**
   * Update validation metrics
   */
  private updateValidationMetrics(duration: number, isError: boolean = false): void {
    this.totalValidations++;
    if (isError) {
      this.totalValidationErrors++;
    }
    this.lastDurationMs = duration;
    this.lastCompletedAt = new Date();
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024; // Convert to MB
    }
    return 0;
  }

  /**
   * Perform memory management
   */
  private async performMemoryManagement(): Promise<void> {
    const currentMemory = this.getCurrentMemoryUsage();
    
    // Check if memory usage is too high
    if (currentMemory > this.config.maxMemoryUsageMB) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Clear caches
      this.clearCaches();
      
      // Emit memory warning
      this.emit('memoryWarning', {
        currentUsage: currentMemory,
        maxUsage: this.config.maxMemoryUsageMB,
        cacheSize: this.validationCache.size
      });
    }
    
    // Periodic cache cleanup
    const now = Date.now();
    if (now - this.lastCacheCleanup > 300000) { // 5 minutes
      this.performCacheCleanup();
      this.lastCacheCleanup = now;
    }
  }

  /**
   * Clear all caches
   */
  private clearCaches(): void {
    this.validationCache.clear();
    this.profileCache.clear();
    this.terminologyCache.clear();
    this.referenceCache.clear();
    this.businessRuleCache.clear();
  }

  /**
   * Perform cache cleanup
   */
  private performCacheCleanup(): void {
    // Remove expired entries (simplified implementation)
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    // This is a simplified cleanup - in a full implementation,
    // you would track entry timestamps and remove expired ones
    if (this.validationCache.size > this.config.maxCacheSize * 0.8) {
      this.evictCacheEntries();
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.performanceMetrics.cacheHits / 
        (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100,
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      cacheSizes: {
        validation: this.validationCache.size,
        profile: this.profileCache.size,
        terminology: this.terminologyCache.size,
        reference: this.referenceCache.size,
        businessRule: this.businessRuleCache.size
      }
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalValidations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0,
      peakMemoryUsage: 0,
      batchProcessingTimes: []
    };
  }

  /**
   * Utility method to chunk array
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // ========================================================================
  // Error Handling and Retry Logic
  // ========================================================================

  /**
   * Comprehensive error handling wrapper for validation operations
   */
  private async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    retryConfig?: RetryConfig
  ): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;
    const maxAttempts = retryConfig?.maxAttempts || 3;
    const baseDelay = retryConfig?.baseDelayMs || 1000;
    const maxDelay = retryConfig?.maxDelayMs || 10000;

    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Log error with context
        this.logError(lastError, context, attempt, maxAttempts);

        // Check if error is retryable
        if (attempt >= maxAttempts || !this.isRetryableError(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await this.sleep(delay);

        // Emit retry event
        this.emit('retryAttempt', {
          context,
          attempt,
          maxAttempts,
          error: lastError.message,
          delay
        });
      }
    }

    // Emit final error event
    this.emit('operationFailed', {
      context,
      attempts: attempt,
      error: lastError?.message || 'Unknown error',
      retryable: this.isRetryableError(lastError)
    });

    throw lastError || new Error(`Operation failed after ${maxAttempts} attempts`);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /econnreset/i,
      /enotfound/i,
      /econnrefused/i,
      /etimedout/i,
      /temporary/i,
      /unavailable/i,
      /throttle/i,
      /rate limit/i,
      /too many requests/i
    ];

    const nonRetryablePatterns = [
      /validation/i,
      /syntax/i,
      /parse/i,
      /malformed/i,
      /invalid/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /bad request/i
    ];

    const errorMessage = error.message.toLowerCase();

    // Check non-retryable patterns first
    for (const pattern of nonRetryablePatterns) {
      if (pattern.test(errorMessage)) {
        return false;
      }
    }

    // Check retryable patterns
    for (const pattern of retryablePatterns) {
      if (pattern.test(errorMessage)) {
        return true;
      }
    }

    // Default to non-retryable for unknown errors
    return false;
  }

  /**
   * Log error with context
   */
  private logError(error: Error, context: string, attempt: number, maxAttempts: number): void {
    const logLevel = attempt === maxAttempts ? 'error' : 'warn';
    const message = `[RockSolidValidationEngine] ${context} (attempt ${attempt}/${maxAttempts}): ${error.message}`;
    
    if (logLevel === 'error') {
      console.error(message, error.stack);
    } else {
      console.warn(message);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced validation with retry logic
   */
  async validateResourceWithRetry(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    const retryConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 5000
    };

    try {
      const result = await this.withErrorHandling(
        () => this.validateResource(request),
        'validateResource',
        retryConfig
      );

      // Add retry information to result
      result.retryInfo = {
        attempts: 1,
        maxAttempts: retryConfig.maxAttempts,
        wasRetry: false,
        totalRetryDurationMs: 0,
        canRetry: false,
        retryReason: undefined
      };

      return result;

    } catch (error) {
      // Create error result
      const errorResult: ValidationResult = {
        resourceId: request.resource?.id || 'unknown',
        resourceType: request.resourceType || 'unknown',
        isValid: false,
        validationScore: 0,
        issues: [{
          severity: 'error',
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          location: [],
          humanReadable: 'An error occurred during validation',
          aspect: 'general'
        }],
        aspects: {
          structural: { passed: false, issues: [], errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 0, enabled: true },
          profile: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
          terminology: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
          reference: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
          businessRule: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
          metadata: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true }
        },
        performance: {
          totalTimeMs: Date.now() - startTime,
          aspectTimes: {}
        },
        retryInfo: {
          attempts: retryConfig.maxAttempts,
          maxAttempts: retryConfig.maxAttempts,
          wasRetry: true,
          totalRetryDurationMs: Date.now() - startTime,
          canRetry: false,
          retryReason: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      return errorResult;
    }
  }

  /**
   * Enhanced batch validation with error recovery
   */
  async validateResourcesWithErrorRecovery(requests: ValidationRequest[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const failedRequests: ValidationRequest[] = [];
    
    try {
      // Process requests in batches with error isolation
      const batchSize = Math.min(this.config.batchSize || 100, requests.length);
      const batches = this.chunkArray(requests, batchSize);

      for (const batch of batches) {
        const batchResults = await this.processBatchWithErrorRecovery(batch);
        
        // Separate successful and failed results
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const request = batch[i];
          
          if (result.isValid || result.issues.length === 0) {
            results.push(result);
          } else {
            // Check if this was a validation error or a system error
            const hasSystemError = result.issues.some(issue => 
              issue.code === 'VALIDATION_ERROR' || issue.severity === 'error'
            );
            
            if (hasSystemError) {
              failedRequests.push(request);
            } else {
              results.push(result);
            }
          }
        }
      }

      // Retry failed requests
      if (failedRequests.length > 0) {
        console.warn(`[RockSolidValidationEngine] Retrying ${failedRequests.length} failed requests`);
        const retryResults = await this.retryFailedRequests(failedRequests);
        results.push(...retryResults);
      }

      return results;

    } catch (error) {
      // If batch processing fails completely, fall back to individual validation
      console.error('[RockSolidValidationEngine] Batch processing failed, falling back to individual validation:', error);
      
      const fallbackResults: ValidationResult[] = [];
      for (const request of requests) {
        try {
          const result = await this.validateResourceWithRetry(request);
          fallbackResults.push(result);
        } catch (fallbackError) {
          // Create error result for completely failed requests
          const errorResult = this.createErrorResult(request, fallbackError);
          fallbackResults.push(errorResult);
        }
      }
      
      return fallbackResults;
    }
  }

  /**
   * Process batch with error recovery
   */
  private async processBatchWithErrorRecovery(batch: ValidationRequest[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Process each request individually to isolate errors
    for (const request of batch) {
      try {
        const result = await this.validateResourceWithRetry(request);
        results.push(result);
      } catch (error) {
        // Create error result for failed request
        const errorResult = this.createErrorResult(request, error);
        results.push(errorResult);
      }
    }
    
    return results;
  }

  /**
   * Retry failed requests
   */
  private async retryFailedRequests(failedRequests: ValidationRequest[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const request of failedRequests) {
      try {
        // Use exponential backoff for retries
        const retryConfig: RetryConfig = {
          maxAttempts: 2,
          baseDelayMs: 2000,
          maxDelayMs: 8000
        };
        
        const result = await this.withErrorHandling(
          () => this.validateResource(request),
          'retryFailedRequest',
          retryConfig
        );
        
        results.push(result);
        
      } catch (error) {
        // Create final error result
        const errorResult = this.createErrorResult(request, error);
        results.push(errorResult);
      }
    }
    
    return results;
  }

  /**
   * Create error result for failed requests
   */
  private createErrorResult(request: ValidationRequest, error: unknown): ValidationResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      resourceId: request.resource?.id || 'unknown',
      resourceType: request.resourceType || 'unknown',
      isValid: false,
      validationScore: 0,
      issues: [{
        severity: 'error',
        code: 'SYSTEM_ERROR',
        message: `System error during validation: ${errorMessage}`,
        location: [],
        humanReadable: 'A system error occurred during validation',
        aspect: 'general'
      }],
      aspects: {
        structural: { passed: false, issues: [], errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 0, enabled: true },
        profile: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
        terminology: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
        reference: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
        businessRule: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true },
        metadata: { passed: false, issues: [], errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, enabled: true }
      },
      performance: {
        totalTimeMs: 0,
        aspectTimes: {}
      },
      retryInfo: {
        attempts: 1,
        maxAttempts: 1,
        wasRetry: false,
        totalRetryDurationMs: 0,
        canRetry: false,
        retryReason: errorMessage
      }
    };
  }

  /**
   * Enhanced settings loading with retry logic
   */
  private async loadSettingsWithRetry(): Promise<any> {
    const retryConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 2000
    };

    try {
      const settings = await this.withErrorHandling(
        () => this.settingsService.getActiveSettings(),
        'loadSettings',
        retryConfig
      );
      
      // Ensure settings have the expected structure
      if (!settings || typeof settings !== 'object') {
        throw new Error('Settings is not an object');
      }
      
      // Ensure all required aspects are present
      const defaultSettings = {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'warning' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' }
      };
      
      // Merge with defaults to ensure all aspects are present
      return { ...defaultSettings, ...settings };
      
    } catch (error) {
      // Return default settings if loading fails
      console.warn('[RockSolidValidationEngine] Using default settings due to loading failure');
      return {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'warning' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' },
        maxConcurrentValidations: 5,
        profileResolutionServers: [],
        terminologyServers: [],
        customRules: []
      };
    }
  }

  /**
   * Enhanced client loading with retry logic
   */
  private async loadClientWithRetry(loadFunction: () => Promise<any>, clientName: string): Promise<any> {
    const retryConfig: RetryConfig = {
      maxAttempts: 2,
      baseDelayMs: 1000,
      maxDelayMs: 3000
    };

    try {
      return await this.withErrorHandling(
        loadFunction,
        `load${clientName}`,
        retryConfig
      );
    } catch (error) {
      console.warn(`[RockSolidValidationEngine] ${clientName} client not available:`, error);
      return null;
    }
  }

  /**
   * Circuit breaker pattern for external service calls
   */
  private circuitBreaker = new Map<string, {
    failures: number;
    lastFailureTime: number;
    state: 'closed' | 'open' | 'half-open';
  }>();

  /**
   * Execute operation with circuit breaker
   */
  private async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    serviceName: string,
    failureThreshold: number = 5,
    timeoutMs: number = 30000
  ): Promise<T> {
    const breaker = this.circuitBreaker.get(serviceName) || {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed' as const
    };

    // Check if circuit is open
    if (breaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailureTime;
      if (timeSinceLastFailure < timeoutMs) {
        throw new Error(`Circuit breaker open for ${serviceName}`);
      }
      // Transition to half-open
      breaker.state = 'half-open';
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      breaker.failures = 0;
      breaker.state = 'closed';
      this.circuitBreaker.set(serviceName, breaker);
      
      return result;
      
    } catch (error) {
      // Failure - update circuit breaker
      breaker.failures++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failures >= failureThreshold) {
        breaker.state = 'open';
      }
      
      this.circuitBreaker.set(serviceName, breaker);
      throw error;
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [serviceName, breaker] of this.circuitBreaker.entries()) {
      status[serviceName] = {
        state: breaker.state,
        failures: breaker.failures,
        lastFailureTime: breaker.lastFailureTime,
        timeSinceLastFailure: Date.now() - breaker.lastFailureTime
      };
    }
    
    return status;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName: string): void {
    this.circuitBreaker.delete(serviceName);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreaker.clear();
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
