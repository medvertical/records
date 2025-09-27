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

  constructor(fhirClient?: FhirClient, terminologyClient?: TerminologyClient) {
    super();
    
    console.log('[ValidationEngine] Constructor called');
    
    this.fhirClient = fhirClient;
    this.terminologyClient = terminologyClient;
    this.settingsService = getValidationSettingsService();
    
    // Initialize validators
    this.structuralValidator = new StructuralValidator();
    this.profileValidator = new ProfileValidator();
    this.terminologyValidator = new TerminologyValidator();
    this.referenceValidator = new ReferenceValidator();
    this.businessRuleValidator = new BusinessRuleValidator();
    this.metadataValidator = new MetadataValidator();
  }

  /**
   * Validate a single FHIR resource
   */
  async validateResource(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    
    console.log(`[ValidationEngine] Starting validation for resource: ${request.resourceType}/${request.resource?.id}`);
    
    try {
      // Get validation settings
      const settings = request.settings || await this.settingsService.getSettings();
      
      const aspectsToExecute = this.resolveRequestedAspects(settings, request.aspects);
      
      console.log(`[ValidationEngine] Validation settings:`, JSON.stringify(settings, null, 2));
      console.log(`[ValidationEngine] Requested aspects:`, Array.from(aspectsToExecute));
      
      // Initialize result
      const result: ValidationResult = {
        resourceId: request.resource.id || 'unknown',
        resourceType: request.resourceType,
        isValid: true,
        issues: [],
        aspects: [],
        validatedAt: new Date(),
        validationTime: 0
      };

      const aspectResults: ValidationAspectResult[] = [];

      for (const aspect of ALL_VALIDATION_ASPECTS) {
        // Always execute all aspects - UI will filter results based on settings
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
          validationTime: 0
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
    // Always return all aspects - engine always performs all 6 aspects
    // UI will filter results based on settings
    return new Set(ALL_VALIDATION_ASPECTS);
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
      let issues: ValidationIssue[] = [];
      
      switch (aspect) {
        case 'structural':
          issues = await this.structuralValidator.validate(request.resource, request.resourceType);
          break;
        case 'profile':
          issues = await this.profileValidator.validate(request.resource, request.resourceType, request.profileUrl);
          break;
        case 'terminology':
          issues = await this.terminologyValidator.validate(request.resource, request.resourceType, this.terminologyClient);
          break;
        case 'reference':
          issues = await this.referenceValidator.validate(request.resource, request.resourceType, this.fhirClient);
          break;
        case 'businessRule':
          issues = await this.businessRuleValidator.validate(request.resource, request.resourceType, settings);
          break;
        case 'metadata':
          issues = await this.metadataValidator.validate(request.resource, request.resourceType);
          break;
        default:
          issues = [{
            id: `unknown-aspect-${Date.now()}`,
            aspect,
            severity: 'error' as ValidationSeverity,
            message: `Unknown validation aspect: ${aspect}`,
            code: 'UNKNOWN_ASPECT'
          }];
      }
      
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
        issues: [{
          id: `aspect-error-${Date.now()}`,
          aspect,
          severity: 'error' as ValidationSeverity,
          message: `Aspect validation failed: ${errorMessage}`,
          code: 'ASPECT_ERROR'
        }],
        validationTime: Date.now() - startTime,
        status: 'failed'
      };
    }
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
