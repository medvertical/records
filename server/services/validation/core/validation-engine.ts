/**
 * Main Validation Engine - Orchestrates all validation aspects
 * 
 * This is the main entry point for the validation system, coordinating
 * all validation aspects through the modular validator components.
 */

import { EventEmitter } from 'events';
import { StructuralValidator } from '../engine/structural-validator';
import { ProfileValidator } from '../engine/profile-validator';
import { TerminologyValidator } from '../engine/terminology-validator';
import { ReferenceValidator } from '../engine/reference-validator';
import { BusinessRuleValidator } from '../engine/business-rule-validator';
import { MetadataValidator } from '../engine/metadata-validator';
import { getValidationSettingsService } from '../settings/validation-settings-service';
import { FhirClient } from '../../fhir/fhir-client';
import { TerminologyClient } from '../../fhir/terminology-client';
import { getErrorMappingEngine } from '../utils/error-mapping-engine';
import { getConnectivityDetector, type ConnectivityMode } from '../utils/connectivity-detector';
import { getGracefulDegradationHandler } from '../utils/graceful-degradation-handler';
import { performanceBaselineTracker } from '../../performance/performance-baseline'; // Task 10.3
import { createValidationTimer, globalTimingAggregator } from '../utils/validation-timing'; // Task 10.4
import type {
  ValidationSettings,
  ValidationAspect,
  ValidationSeverity
} from '@shared/validation-settings';
import type {
  ValidationRequest,
  ValidationAspectResult,
  ValidationAspectExecutionStatus
} from '../types/validation-types';
import type { ValidationResult, ValidationIssue } from '@shared/types/validation';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

// ============================================================================
// Main Validation Engine Class
// ============================================================================

export class ValidationEngine extends EventEmitter {
  private structuralValidator: StructuralValidator;
  private profileValidator: ProfileValidator;
  private terminologyValidator: TerminologyValidator;
  private referenceValidator: ReferenceValidator;
  private businessRuleValidator: BusinessRuleValidator;
  private metadataValidator: MetadataValidator;
  private settingsService: any;
  private errorMappingEngine = getErrorMappingEngine();
  private fhirClient?: FhirClient;
  private terminologyClient?: TerminologyClient;
  private fhirVersion: 'R4' | 'R5' | 'R6'; // Task 2.3: Store detected FHIR version
  private connectivityDetector = getConnectivityDetector(); // Task 5.9: Connectivity monitoring
  private degradationHandler = getGracefulDegradationHandler(); // Task 5.9: Graceful degradation
  private hasWarmedCache: boolean = false; // Task 10.3: Track cold start vs warm cache
  private enableParallelValidation: boolean = true; // Task 10.10: Parallel aspect validation

  constructor(
    fhirClient?: FhirClient, 
    terminologyClient?: TerminologyClient,
    fhirVersion?: 'R4' | 'R5' | 'R6' // Task 2.3: Accept FHIR version parameter
  ) {
    super();
    
    console.log('[ValidationEngine] Constructor called');
    
    this.fhirClient = fhirClient;
    this.terminologyClient = terminologyClient;
    this.fhirVersion = fhirVersion || 'R4'; // Task 2.3: Default to R4 if not provided
    this.settingsService = getValidationSettingsService();
    
    console.log(`[ValidationEngine] FHIR version: ${this.fhirVersion}`);
    
    // Initialize validators
    this.structuralValidator = new StructuralValidator();
    this.profileValidator = new ProfileValidator();
    this.terminologyValidator = new TerminologyValidator();
    this.referenceValidator = new ReferenceValidator();
    this.businessRuleValidator = new BusinessRuleValidator();
    this.metadataValidator = new MetadataValidator();

    // Task 5.9: Setup connectivity listeners
    this.setupConnectivityListeners();
  }

  /**
   * Setup connectivity event listeners
   * Task 5.9: Listen to connectivity events and adjust behavior
   */
  private setupConnectivityListeners(): void {
    // Listen for connectivity mode changes
    this.connectivityDetector.on('mode-changed', (event: any) => {
      console.log(
        `[ValidationEngine] Connectivity mode changed: ${event.oldMode} → ${event.newMode}`
      );
      
      // Update degradation handler
      this.degradationHandler.setConnectivityMode(event.newMode);
      
      // Emit event for external listeners
      this.emit('connectivity-changed', {
        oldMode: event.oldMode,
        newMode: event.newMode,
        timestamp: event.timestamp,
      });
    });

    // Listen for degradation strategy changes
    this.degradationHandler.on('strategy-changed', (event: any) => {
      console.log(
        `[ValidationEngine] Degradation strategy changed: ${event.oldStrategy.name} → ${event.newStrategy.name}`
      );
      
      // Log warnings to users
      if (event.warnings && event.warnings.length > 0) {
        console.warn('[ValidationEngine] Validation limitations in current mode:');
        event.warnings.forEach((w: string) => console.warn(`  - ${w}`));
      }
      
      // Emit event for external listeners
      this.emit('degradation-changed', event);
    });

    console.log('[ValidationEngine] Connectivity listeners configured');
  }

  /**
   * Get current FHIR version
   * Task 2.3: Accessor for FHIR version
   */
  getFhirVersion(): 'R4' | 'R5' | 'R6' {
    return this.fhirVersion;
  }

  /**
   * Set FHIR version (for version switching)
   * Task 2.3: Mutator for FHIR version
   */
  setFhirVersion(version: 'R4' | 'R5' | 'R6'): void {
    console.log(`[ValidationEngine] Switching FHIR version: ${this.fhirVersion} → ${version}`);
    this.fhirVersion = version;
    this.emit('versionChanged', { oldVersion: this.fhirVersion, newVersion: version });
  }

  /**
   * Get current connectivity mode
   * Task 5.9: Expose connectivity status
   */
  getConnectivityMode(): ConnectivityMode {
    return this.connectivityDetector.getCurrentMode();
  }

  /**
   * Check if validation aspect is available in current connectivity mode
   * Task 5.9: Feature availability checking
   */
  isAspectAvailable(aspect: string): boolean {
    const featureMap: Record<string, keyof ReturnType<typeof this.degradationHandler.getCurrentStrategy>['features']> = {
      'structural': 'structuralValidation',
      'profile': 'profileValidation',
      'terminology': 'terminologyValidation',
      'reference': 'referenceValidation',
      'businessRules': 'businessRules',
      'metadata': 'metadataValidation',
    };

    const feature = featureMap[aspect];
    if (!feature) return true; // Unknown aspects default to available

    return this.degradationHandler.isFeatureAvailable(feature);
  }

  /**
   * Get connectivity status for UI display
   * Task 5.9: Status reporting
   */
  getConnectivityStatus(): {
    mode: ConnectivityMode;
    isOnline: boolean;
    detectedMode: ConnectivityMode;
    manualOverride: boolean;
    warnings: string[];
    availableFeatures: string[];
    unavailableFeatures: string[];
  } {
    const mode = this.connectivityDetector.getCurrentMode();
    const strategy = this.degradationHandler.getCurrentStrategy();
    const summary = this.connectivityDetector.getHealthSummary();

    const availableFeatures: string[] = [];
    const unavailableFeatures: string[] = [];

    Object.entries(strategy.features).forEach(([feature, available]) => {
      if (available) {
        availableFeatures.push(feature);
      } else {
        unavailableFeatures.push(feature);
      }
    });

    return {
      mode,
      isOnline: this.connectivityDetector.isOnline(),
      detectedMode: summary.detectedMode,
      manualOverride: summary.manualOverride,
      warnings: strategy.warnings,
      availableFeatures,
      unavailableFeatures,
    };
  }

  /**
   * Validate a single FHIR resource
   */
  async validateResource(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    const isFirstValidation = !this.hasWarmedCache; // Track if this is cold start
    
    // Task 10.4: Create timing tracker for detailed breakdown
    const timer = createValidationTimer(request.resourceType, 'overall');
    
    console.log(`[ValidationEngine] Starting validation for resource: ${request.resourceType}/${request.resource?.id}`);
    
    try {
      // Get validation settings
      timer.startPhase('settings-load', 'Loading validation settings');
      const settings = request.settings || await this.settingsService.getCurrentSettings();
      timer.endPhase();
      
      const aspectsToExecute = this.resolveRequestedAspects(settings, request.aspects);
      
      console.log(`[ValidationEngine] Validation settings:`, JSON.stringify(settings, null, 2));
      console.log(`[ValidationEngine] Requested aspects:`, Array.from(aspectsToExecute));
      console.log(`[ValidationEngine] ALL_VALIDATION_ASPECTS:`, ALL_VALIDATION_ASPECTS);
      console.log(`[ValidationEngine] aspectsToExecute vs ALL_VALIDATION_ASPECTS:`, {
        aspectsToExecute: Array.from(aspectsToExecute),
        allAspects: Array.from(ALL_VALIDATION_ASPECTS),
        same: Array.from(aspectsToExecute).length === Array.from(ALL_VALIDATION_ASPECTS).length
      });
      
      // Initialize result (Task 2.11: Include fhirVersion)
      const result: ValidationResult = {
        resourceId: request.resource.id || 'unknown',
        resourceType: request.resourceType,
        isValid: true,
        issues: [],
        aspects: [],
        validatedAt: new Date(),
        validationTime: 0,
        fhirVersion: this.fhirVersion // Task 2.11: Store FHIR version from engine
      };

      const aspectResults: ValidationAspectResult[] = [];

      // Task 10.10: Parallel aspect validation for better performance
      timer.startPhase('aspects-validation', 'Validating all enabled aspects');
      
      if (this.enableParallelValidation && aspectsToExecute.size > 1) {
        console.log(`[ValidationEngine] Task 10.10: Running ${aspectsToExecute.size} aspects in parallel`);
        
        // Execute all aspects in parallel
        const aspectPromises = Array.from(aspectsToExecute).map(async (aspect) => {
          const aspectStart = Date.now();
          const aspectResult = await this.validateAspect(request, aspect, settings);
          const aspectTime = Date.now() - aspectStart;
          
          return { aspect, aspectResult, aspectTime };
        });

        // Wait for all aspects to complete
        const aspectData = await Promise.all(aspectPromises);
        
        // Process results and record timing
        for (const { aspect, aspectResult, aspectTime } of aspectData) {
          timer.recordPhase(aspect, aspectTime, `${aspect} validation (parallel)`);
          aspectResults.push(aspectResult);
          result.issues.push(...aspectResult.issues);

          if (!aspectResult.isValid) {
            result.isValid = false;
          }
        }
        
        const parallelTime = Date.now() - startTime;
        console.log(`[ValidationEngine] Task 10.10: Parallel validation complete in ${parallelTime}ms`);
      } else {
        // Sequential validation (fallback or single aspect)
        console.log(`[ValidationEngine] Running ${aspectsToExecute.size} aspects sequentially`);
        
        for (const aspect of aspectsToExecute) {
          const aspectStart = Date.now();
          const aspectResult = await this.validateAspect(request, aspect, settings);
          timer.recordPhase(aspect, Date.now() - aspectStart, `${aspect} validation`);
          
          aspectResults.push(aspectResult);
          result.issues.push(...aspectResult.issues);

          if (!aspectResult.isValid) {
            result.isValid = false;
          }
        }
      }
      timer.endPhase();

      result.aspects = aspectResults;

      result.validationTime = Date.now() - startTime;
      
      // Task 10.3: Record overall validation performance
      try {
        if (isFirstValidation) {
          performanceBaselineTracker.recordColdStart(result.validationTime);
          this.hasWarmedCache = true;
        } else {
          performanceBaselineTracker.recordWarmCache(result.validationTime);
        }
      } catch (error) {
        console.error('[ValidationEngine] Failed to record validation performance:', error);
      }
      
      // Task 10.4: Record post-processing timing
      timer.startPhase('post-processing', 'Enhancing issues and mapping errors');
      
      // Enhance issues with user-friendly error messages
      const enhancedIssues = this.errorMappingEngine.enhanceIssues(result.issues, {
        resourceType: request.resourceType,
        fhirVersion: this.fhirVersion,
      });
      
      // Replace issues with enhanced versions (maintains backward compatibility)
      result.issues = enhancedIssues as any;
      
      timer.endPhase();
      
      // Task 10.4: Get timing breakdown and store it
      const breakdown = timer.getBreakdown();
      globalTimingAggregator.add(breakdown);
      
      console.log(`[ValidationEngine] Validation completed for ${request.resourceType}/${request.resource?.id}:`, {
        isValid: result.isValid,
        issueCount: result.issues.length,
        enhancedIssues: enhancedIssues.filter(i => i.mapped).length,
        validationTime: result.validationTime
      });
      
      // Log detailed timing in debug mode
      if (process.env.LOG_VALIDATION_TIMING === 'true') {
        console.log(timer.formatBreakdown());
      }
      
      this.emit('validationComplete', result);
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      console.error(`[ValidationEngine] Validation failed for ${request.resourceType}/${request.resource?.id}:`, errorMessage);
      this.emit('validationError', error);
      throw error;
    }
  }

  /**
   * Validate multiple FHIR resources
   */
  async validateResources(requests: ValidationRequest[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.validateResource(request);
        results.push(result);
      } catch (error) {
        // Create error result
        const message = `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        const issue: ValidationIssue = {
          id: `error-${Date.now()}`,
          aspect: 'structural' as ValidationAspect,
          severity: 'error' as ValidationSeverity,
          message,
          code: 'VALIDATION_ERROR'
        };

        // Task 2.11: Include fhirVersion in error result
        const errorResult: ValidationResult = {
          resourceId: request.resource?.id || 'unknown',
          resourceType: request.resourceType,
          isValid: false,
          issues: [issue],
          aspects: ALL_VALIDATION_ASPECTS.map((aspect) => {
            if (aspect === 'structural') {
              return this.createPlaceholderAspectResult(aspect, 'failed', {
                issues: [issue],
                reason: message,
                isValid: false
              });
            }

            return this.createPlaceholderAspectResult(aspect, 'skipped', {
              reason: 'Validation was aborted before this aspect could execute'
            });
          }),
          validatedAt: new Date(),
          validationTime: 0,
          fhirVersion: this.fhirVersion // Task 2.11: Store FHIR version
        };
        results.push(errorResult);
      }
    }
    
    return results;
  }

  private resolveRequestedAspects(
    settings: ValidationSettings,
    requested?: (ValidationAspect | string)[] | null
  ): Set<ValidationAspect> {
    // Only return aspects that are enabled in settings
    const enabledAspects = new Set<ValidationAspect>();
    
    // Check the correct settings structure: settings.aspects.{aspect}.enabled
    if (settings.aspects?.structural?.enabled) {
      enabledAspects.add('structural');
    }
    if (settings.aspects?.profile?.enabled) {
      enabledAspects.add('profile');
    }
    if (settings.aspects?.terminology?.enabled) {
      enabledAspects.add('terminology');
    }
    if (settings.aspects?.reference?.enabled) {
      enabledAspects.add('reference');
    }
    if (settings.aspects?.businessRules?.enabled) {
      enabledAspects.add('businessRules');
    }
    if (settings.aspects?.metadata?.enabled) {
      enabledAspects.add('metadata');
    }
    
    return enabledAspects;
  }



  private createPlaceholderAspectResult(
    aspect: ValidationAspect,
    status: ValidationAspectExecutionStatus,
    options: {
      issues?: ValidationIssue[];
      validationTime?: number;
      reason?: string;
      isValid?: boolean;
    } = {}
  ): ValidationAspectResult {
    const issues = options.issues ?? [];
    const isValid = options.isValid ?? (status !== 'failed' && issues.length === 0);

    return {
      aspect,
      isValid,
      issues,
      validationTime: options.validationTime ?? 0,
      status,
      reason: options.reason,
    };
  }

  /**
   * Validate a specific aspect
   */
  private async validateAspect(
    request: ValidationRequest, 
    aspect: ValidationAspect, 
    settings: ValidationSettings
  ): Promise<ValidationAspectResult> {
    const startTime = Date.now();
    
    // Task 5.9: Check if aspect is available in current connectivity mode
    if (!this.isAspectAvailable(aspect)) {
      const mode = this.connectivityDetector.getCurrentMode();
      console.warn(
        `[ValidationEngine] Aspect '${aspect}' not available in ${mode} mode - skipping`
      );
      
      return {
        aspect,
        isValid: true,
        issues: [{
          id: `aspect-unavailable-${aspect}-${Date.now()}`,
          aspect,
          severity: 'info' as ValidationSeverity,
          message: `${aspect} validation skipped in ${mode} mode`,
          code: 'ASPECT_UNAVAILABLE_IN_MODE',
          path: '',
          timestamp: new Date(),
        }],
        validationTime: Date.now() - startTime,
        status: 'skipped',
        reason: `Not available in ${mode} mode`,
      };
    }
    
    try {
      const timeoutMs = this.getAspectTimeoutMs(aspect, settings);
      const issues: ValidationIssue[] = await Promise.race([
        (async () => {
          // Task 2.4: Pass fhirVersion to all validators
          switch (aspect) {
            case 'structural':
              return await this.structuralValidator.validate(request.resource, request.resourceType, this.fhirVersion);
            case 'profile':
              return await this.profileValidator.validate(request.resource, request.resourceType, request.profileUrl, this.fhirVersion, settings);
            case 'terminology':
              return await this.terminologyValidator.validate(request.resource, request.resourceType, settings, this.fhirVersion);
            case 'reference':
              return await this.referenceValidator.validate(request.resource, request.resourceType, this.fhirClient, this.fhirVersion);
            case 'businessRules':
              return await this.businessRuleValidator.validate(request.resource, request.resourceType, settings, this.fhirVersion);
            case 'metadata':
              return await this.metadataValidator.validate(request.resource, request.resourceType, this.fhirVersion);
            default:
              // Graceful degradation: skip unknown aspects
              return [{
                id: `aspect-unavailable-${Date.now()}`,
                aspect,
                severity: 'info' as ValidationSeverity,
                message: `Aspect '${aspect}' not available; skipped`,
                code: 'ASPECT_UNAVAILABLE'
              }];
          }
        })(),
        this.timeoutPromise(timeoutMs, aspect)
      ]);
      
      const validationTime = Date.now() - startTime;
      
      // Task 10.3: Record performance metrics for this aspect
      try {
        performanceBaselineTracker.recordValidationTime(
          request.resourceType,
          aspect,
          validationTime,
          false // Cache hit tracking would require more integration
        );
      } catch (error) {
        // Don't fail validation if performance tracking fails
        console.error('[ValidationEngine] Failed to record performance metric:', error);
      }

      return {
        aspect,
        isValid: issues.length === 0,
        issues,
        validationTime,
        status: 'executed'
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown aspect validation error';
      console.error(`[ValidationEngine] Aspect ${aspect} validation failed:`, errorMessage);
      
      return {
        aspect,
        isValid: false,
        issues: [this.mapErrorToIssue(aspect, errorMessage)],
        validationTime: Date.now() - startTime,
        status: 'failed'
      };
    }
  }

  // ------------------------------------------------------------------------
  // Timeout and error mapping helpers
  // ------------------------------------------------------------------------

  private getAspectTimeoutMs(aspect: ValidationAspect, settings: ValidationSettings): number {
    const defaults: Record<ValidationAspect, number> = {
      structural: 20000,   // 20s - allow first-time package loads
      profile: 30000,      // 30s - allow first-time profile downloads
      terminology: 20000,  // 20s - terminology server + caching
      reference: 10000,    // 10s
      businessRules: 10000, // 10s
      metadata: 5000,      // 5s
    } as const;

    // Settings may carry per-aspect timeout; fall back to defaults
    const configured = (settings as any)[aspect]?.timeoutMs;
    return typeof configured === 'number' && configured > 0 ? configured : defaults[aspect];
  }

  private timeoutPromise(ms: number, aspect: ValidationAspect): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Validation timeout after ${ms}ms for aspect: ${aspect}`)), ms);
    });
  }

  private mapErrorToIssue(aspect: ValidationAspect, errorMessage: string): ValidationIssue {
    if (errorMessage.toLowerCase().includes('timeout')) {
      return {
        id: `aspect-timeout-${Date.now()}`,
        aspect,
        severity: 'error' as ValidationSeverity,
        message: `Validation timeout: ${errorMessage}`,
        code: 'TIMEOUT'
      };
    }
    if (errorMessage.includes('ECONN') || errorMessage.includes('ETIMEDOUT')) {
      return {
        id: `aspect-network-${Date.now()}`,
        aspect,
        severity: 'error' as ValidationSeverity,
        message: `Network error during ${aspect} validation: ${errorMessage}`,
        code: 'NETWORK_ERROR'
      };
    }
    return {
      id: `aspect-error-${Date.now()}`,
      aspect,
      severity: 'error' as ValidationSeverity,
      message: `Aspect validation failed: ${errorMessage}`,
      code: 'ASPECT_ERROR'
    };
  }

  // ========================================================================
  // Task 10.3: Performance Monitoring Methods
  // ========================================================================

  /**
   * Get current performance baseline
   */
  getPerformanceBaseline() {
    return performanceBaselineTracker.getCurrentBaseline();
  }

  /**
   * Generate new performance baseline from current measurements
   */
  generatePerformanceBaseline() {
    return performanceBaselineTracker.generateBaseline();
  }

  /**
   * Get performance summary with trends
   */
  getPerformanceSummary() {
    return performanceBaselineTracker.getSummary();
  }

  /**
   * Reset performance measurements (useful for testing)
   */
  resetPerformanceTracking() {
    performanceBaselineTracker.resetCurrentMeasurements();
    this.hasWarmedCache = false;
    console.log('[ValidationEngine] Performance tracking reset');
  }

  /**
   * Get all performance baselines
   */
  getPerformanceHistory() {
    return performanceBaselineTracker.getAllBaselines();
  }

  // ========================================================================
  // Task 10.4: Detailed Timing Methods
  // ========================================================================

  /**
   * Get aggregate timing statistics from all validations
   */
  getTimingStats() {
    return globalTimingAggregator.getStats();
  }

  /**
   * Get all timing breakdowns
   */
  getAllTimingBreakdowns() {
    return globalTimingAggregator.getAll();
  }

  /**
   * Clear all timing data
   */
  clearTimingData() {
    globalTimingAggregator.clear();
    console.log('[ValidationEngine] Timing data cleared');
  }

  // ========================================================================
  // Task 10.10: Parallel Validation Methods
  // ========================================================================

  /**
   * Enable or disable parallel aspect validation
   */
  setParallelValidation(enabled: boolean): void {
    this.enableParallelValidation = enabled;
    console.log(`[ValidationEngine] Parallel validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if parallel validation is enabled
   */
  isParallelValidationEnabled(): boolean {
    return this.enableParallelValidation;
  }

  /**
   * Get validation mode info
   */
  getValidationMode(): {
    parallel: boolean;
    description: string;
    expectedSpeedup: string;
  } {
    return {
      parallel: this.enableParallelValidation,
      description: this.enableParallelValidation
        ? 'All aspects run in parallel for maximum performance'
        : 'Aspects run sequentially for predictable order',
      expectedSpeedup: this.enableParallelValidation
        ? '40-60% faster for multi-aspect validation'
        : 'No speedup (sequential)',
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let validationEngineInstance: ValidationEngine | null = null;

export function getValidationEngine(fhirClient?: FhirClient, terminologyClient?: TerminologyClient): ValidationEngine {
  console.log('[ValidationEngine] getValidationEngine called');
  if (!validationEngineInstance) {
    console.log('[ValidationEngine] Creating new validation engine instance');
    validationEngineInstance = new ValidationEngine(fhirClient, terminologyClient);
  } else {
    console.log('[ValidationEngine] Returning existing validation engine instance');
  }
  return validationEngineInstance;
}
