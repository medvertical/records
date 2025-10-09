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
  private fhirClient?: FhirClient;
  private terminologyClient?: TerminologyClient;
  private fhirVersion: 'R4' | 'R5' | 'R6'; // Task 2.3: Store detected FHIR version

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
   * Validate a single FHIR resource
   */
  async validateResource(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    
    console.log(`[ValidationEngine] Starting validation for resource: ${request.resourceType}/${request.resource?.id}`);
    
    try {
      // Get validation settings
      const settings = request.settings || await this.settingsService.getCurrentSettings();
      
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

      for (const aspect of aspectsToExecute) {
        // Only execute aspects that are enabled in settings
        const aspectResult = await this.validateAspect(request, aspect, settings);
        aspectResults.push(aspectResult);
        result.issues.push(...aspectResult.issues);

        if (!aspectResult.isValid) {
          result.isValid = false;
        }
      }

      result.aspects = aspectResults;

      result.validationTime = Date.now() - startTime;
      
      console.log(`[ValidationEngine] Validation completed for ${request.resourceType}/${request.resource?.id}:`, {
        isValid: result.isValid,
        issueCount: result.issues.length,
        validationTime: result.validationTime
      });
      
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
      enabledAspects.add('businessRule');
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
    
    try {
      const timeoutMs = this.getAspectTimeoutMs(aspect, settings);
      const issues: ValidationIssue[] = await Promise.race([
        (async () => {
          // Task 2.4: Pass fhirVersion to all validators
          switch (aspect) {
            case 'structural':
              return await this.structuralValidator.validate(request.resource, request.resourceType, this.fhirVersion);
            case 'profile':
              return await this.profileValidator.validate(request.resource, request.resourceType, request.profileUrl, this.fhirVersion);
            case 'terminology':
              return await this.terminologyValidator.validate(request.resource, request.resourceType, settings, this.fhirVersion);
            case 'reference':
              return await this.referenceValidator.validate(request.resource, request.resourceType, this.fhirClient, this.fhirVersion);
            case 'businessRule':
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
      
      return {
        aspect,
        isValid: issues.length === 0,
        issues,
        validationTime: Date.now() - startTime,
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
      structural: 5000,
      profile: 45000,
      terminology: 60000,
      reference: 30000,
      businessRule: 30000,
      metadata: 5000,
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
