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
  ValidationResult,
  ValidationIssue,
  ValidationAspectResult
} from '../types/validation-types';

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
    
    try {
      // Get validation settings
      const settings = request.settings || await this.settingsService.getSettings();
      const aspects = request.aspects || settings.enabledAspects;
      
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

      // Run validation for each enabled aspect
      for (const aspect of aspects) {
        const aspectResult = await this.validateAspect(request, aspect, settings);
        result.aspects.push(aspectResult);
        result.issues.push(...aspectResult.issues);
        
        if (!aspectResult.isValid) {
          result.isValid = false;
        }
      }

      result.validationTime = Date.now() - startTime;
      
      this.emit('validationComplete', result);
      return result;
      
    } catch (error) {
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
        const errorResult: ValidationResult = {
          resourceId: request.resource.id || 'unknown',
          resourceType: request.resourceType,
          isValid: false,
          issues: [{
            id: `error-${Date.now()}`,
            aspect: 'structural' as ValidationAspect,
            severity: 'error' as ValidationSeverity,
            message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'VALIDATION_ERROR'
          }],
          aspects: [],
          validatedAt: new Date(),
          validationTime: 0
        };
        results.push(errorResult);
      }
    }
    
    return results;
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
        case 'businessRules':
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
        validationTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        aspect,
        isValid: false,
        issues: [{
          id: `aspect-error-${Date.now()}`,
          aspect,
          severity: 'error' as ValidationSeverity,
          message: `Aspect validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'ASPECT_ERROR'
        }],
        validationTime: Date.now() - startTime
      };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let validationEngineInstance: ValidationEngine | null = null;

export function getValidationEngine(fhirClient?: FhirClient, terminologyClient?: TerminologyClient): ValidationEngine {
  if (!validationEngineInstance) {
    validationEngineInstance = new ValidationEngine(fhirClient, terminologyClient);
  }
  return validationEngineInstance;
}
