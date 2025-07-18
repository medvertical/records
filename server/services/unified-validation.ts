import { createHash } from 'crypto';
import { storage } from '../storage.js';
import { ValidationEngine } from './validation-engine.js';
import { EnhancedValidationEngine } from './enhanced-validation-engine.js';
import { FhirClient } from './fhir-client.js';
import type { FhirResource, InsertFhirResource, InsertValidationResult, ValidationResult } from '@shared/schema.js';

/**
 * Unified validation service that handles both batch and individual resource validation
 * with timestamp-based invalidation
 */
export class UnifiedValidationService {
  private enhancedValidationEngine: EnhancedValidationEngine;

  constructor(
    private fhirClient: FhirClient,
    private validationEngine: ValidationEngine
  ) {
    // Initialize enhanced validation engine with default settings
    // Actual settings will be loaded from database when needed
    this.enhancedValidationEngine = new EnhancedValidationEngine(fhirClient, {
      enableStructuralValidation: true,
      enableProfileValidation: true,
      enableTerminologyValidation: true,
      enableReferenceValidation: true,
      enableBusinessRuleValidation: true,
      enableMetadataValidation: true,
      strictMode: false,
      profiles: [
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'
      ]
    });
  }

  /**
   * Load validation settings from database and update engine configuration
   */
  async loadValidationSettings(): Promise<void> {
    const settings = await storage.getValidationSettings();
    if (settings) {
      console.log('[UnifiedValidation] Loading validation settings from database:', {
        enableStructuralValidation: settings.enableStructuralValidation,
        enableProfileValidation: settings.enableProfileValidation,
        enableTerminologyValidation: settings.enableTerminologyValidation,
        enableReferenceValidation: settings.enableReferenceValidation,
        enableBusinessRuleValidation: settings.enableBusinessRuleValidation,
        enableMetadataValidation: settings.enableMetadataValidation
      });
      
      this.enhancedValidationEngine.updateConfig({
        enableStructuralValidation: settings.enableStructuralValidation ?? true,
        enableProfileValidation: settings.enableProfileValidation ?? true,
        enableTerminologyValidation: settings.enableTerminologyValidation ?? true,
        enableReferenceValidation: settings.enableReferenceValidation ?? true,
        enableBusinessRuleValidation: settings.enableBusinessRuleValidation ?? true,
        enableMetadataValidation: settings.enableMetadataValidation ?? true,
        strictMode: settings.strictMode ?? false,
        profiles: settings.validationProfiles ?? [
          'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
          'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'
        ],
        terminologyServers: settings.terminologyServers ?? [],
        profileResolutionServers: settings.profileResolutionServers ?? []
      });
    }
  }

  /**
   * Check if validation results are outdated based on resource timestamps
   */
  private isValidationOutdated(resource: any, validationResults: ValidationResult[]): boolean {
    if (!validationResults || validationResults.length === 0) {
      return true; // No validation results exist
    }

    // Get the most recent validation timestamp
    const latestValidation = validationResults.reduce((latest, current) => {
      return current.validatedAt > latest.validatedAt ? current : latest;
    });

    // Compare with resource's lastUpdated timestamp
    const resourceLastUpdated = resource.meta?.lastUpdated;
    if (!resourceLastUpdated) {
      return false; // No timestamp available, assume validation is still valid
    }

    const resourceDate = new Date(resourceLastUpdated);
    const validationDate = new Date(latestValidation.validatedAt);

    console.log(`[UnifiedValidation] Resource ${resource.resourceType}/${resource.id}:`);
    console.log(`  Resource lastUpdated: ${resourceDate.toISOString()}`);
    console.log(`  Latest validation: ${validationDate.toISOString()}`);
    console.log(`  Is outdated: ${resourceDate > validationDate}`);

    return resourceDate > validationDate;
  }

  /**
   * Validate a single resource with smart caching and timestamp-based invalidation
   * ALWAYS performs ALL validation categories when saving to database
   * Display filtering happens at the API layer
   */
  async validateResource(
    resource: any, 
    skipUnchanged: boolean = true, 
    forceRevalidation: boolean = false
  ): Promise<{
    validationResults: ValidationResult[];
    wasRevalidated: boolean;
  }> {
    const resourceHash = this.createResourceHash(resource);
    
    // Check if resource already exists in database
    let dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
    let wasRevalidated = false;

    // Save or update resource in database
    const resourceData: InsertFhirResource = {
      resourceType: resource.resourceType,
      resourceId: resource.id,
      versionId: resource.meta?.versionId,
      data: resource,
      resourceHash: resourceHash,
      serverId: 1 // Default server ID, should be dynamic in production
    };

    if (dbResource) {
      // Update existing resource
      await storage.updateFhirResource(dbResource.id, resource);
      // Get updated resource with current validation results
      const updatedResource = await storage.getFhirResourceById(dbResource.id);
      if (updatedResource) {
        dbResource = updatedResource;
      }
    } else {
      // Create new resource
      dbResource = await storage.createFhirResource(resourceData);
      dbResource.validationResults = [];
    }

    // Check if validation is needed
    const needsValidation = forceRevalidation || 
                           !dbResource.validationResults ||
                           dbResource.validationResults.length === 0 ||
                           (skipUnchanged && dbResource.resourceHash !== resourceHash) ||
                           this.isValidationOutdated(resource, dbResource.validationResults);

    if (needsValidation) {
      console.log(`[UnifiedValidation] Performing validation for ${resource.resourceType}/${resource.id}`);
      wasRevalidated = true;

      try {
        console.log(`[UnifiedValidation] Performing validation for ${resource.resourceType}/${resource.id} using current settings`);
        
        // Load latest validation settings from database
        await this.loadValidationSettings();
        
        // Use enhanced validation engine with current settings
        const enhancedResult = await this.enhancedValidationEngine.validateResource(resource);
        
        console.log(`[UnifiedValidation] Enhanced validation completed with score: ${enhancedResult.validationScore}`);
        console.log(`[UnifiedValidation] Validation aspects performed:`, {
          structural: enhancedResult.validationAspects.structural.issues.length > 0 || enhancedResult.validationAspects.structural.passed,
          profile: enhancedResult.validationAspects.profile.profilesChecked.length > 0,
          terminology: enhancedResult.validationAspects.terminology.codesChecked > 0,
          reference: enhancedResult.validationAspects.reference.referencesChecked > 0,
          businessRule: enhancedResult.validationAspects.businessRule.rulesChecked > 0,
          metadata: enhancedResult.validationAspects.metadata.issues.length > 0
        });
        
        // Convert enhanced validation result to our database format
        const validationResult: InsertValidationResult = {
          resourceId: dbResource.id,
          profileId: null,
          isValid: enhancedResult.isValid,
          errors: enhancedResult.issues.filter(issue => issue.severity === 'error' || issue.severity === 'fatal').map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.message,
            path: issue.path,
            expression: issue.expression,
            code: issue.code
          })),
          warnings: enhancedResult.issues.filter(issue => issue.severity === 'warning').map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.message,
            path: issue.path,
            expression: issue.expression,
            code: issue.code
          })),
          issues: enhancedResult.issues.map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.message,
            path: issue.path,
            expression: issue.expression,
            code: issue.code,
            category: issue.category // Include category in stored issues
          })),
          profileUrl: enhancedResult.validationAspects.profile.profilesChecked[0] || null,
          errorCount: enhancedResult.issues.filter(i => i.severity === 'error' || i.severity === 'fatal').length,
          warningCount: enhancedResult.issues.filter(i => i.severity === 'warning').length,
          validationScore: enhancedResult.validationScore,
          validatedAt: enhancedResult.validatedAt,
          // Add enhanced validation details
          details: {
            validationAspects: enhancedResult.validationAspects,
            categories: {
              structural: enhancedResult.issues.filter(i => i.category === 'structural').length,
              profile: enhancedResult.issues.filter(i => i.category === 'profile').length,
              terminology: enhancedResult.issues.filter(i => i.category === 'terminology').length,
              reference: enhancedResult.issues.filter(i => i.category === 'reference').length,
              businessRule: enhancedResult.issues.filter(i => i.category === 'business-rule').length,
              metadata: enhancedResult.issues.filter(i => i.category === 'metadata').length
            }
          }
        };

        // Save validation result
        await storage.createValidationResult(validationResult);

        // Get updated validation results
        const updatedValidationResults = await storage.getValidationResultsByResourceId(dbResource.id);
        return {
          validationResults: updatedValidationResults,
          wasRevalidated: true
        };

      } catch (error) {
        console.error(`[UnifiedValidation] Validation failed for ${resource.resourceType}/${resource.id}:`, error);
        
        // Create error validation result
        const errorResult: InsertValidationResult = {
          resourceId: dbResource.id,
          profileId: null,
          isValid: false,
          errors: [{
            severity: 'error' as const,
            message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
            path: '',
            code: 'validation-error'
          }],
          warnings: [],
          issues: [{
            severity: 'error' as const,
            message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
            path: '',
            code: 'validation-error'
          }],
          errorCount: 1,
          warningCount: 0,
          validationScore: 0,
          validatedAt: new Date()
        };

        await storage.createValidationResult(errorResult);
        const updatedValidationResults = await storage.getValidationResultsByResourceId(dbResource.id);
        return {
          validationResults: updatedValidationResults,
          wasRevalidated: true
        };
      }
    } else {
      console.log(`[UnifiedValidation] Using cached validation for ${resource.resourceType}/${resource.id}`);
      return {
        validationResults: dbResource.validationResults || [],
        wasRevalidated: false
      };
    }
  }

  /**
   * Calculate validation score based on issues
   */
  private calculateValidationScore(issues: any[]): number {
    let score = 100;
    
    for (const issue of issues) {
      switch (issue.severity) {
        case 'fatal':
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 2;
          break;
        case 'information':
          score -= 0.5;
          break;
      }
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Create hash for resource to detect changes
   */
  private createResourceHash(resource: any): string {
    // Create hash of resource data, excluding metadata that changes frequently
    const hashableData = {
      ...resource,
      meta: resource.meta ? {
        versionId: resource.meta.versionId,
        lastUpdated: resource.meta.lastUpdated
      } : undefined
    };
    
    const hash = createHash('sha256');
    hash.update(JSON.stringify(hashableData));
    return hash.digest('hex');
  }

  /**
   * Update configuration settings for the validation engine
   */
  updateConfig(config: any) {
    console.log('[UnifiedValidation] Updating configuration:', config);
    this.enhancedValidationEngine.updateConfig(config);
  }

  /**
   * Check and potentially revalidate a resource with validation results
   */
  async checkAndRevalidateResource(resourceWithValidation: FhirResource & { validationResults?: ValidationResult[] }): Promise<{
    resource: FhirResource & { validationResults: ValidationResult[] };
    wasRevalidated: boolean;
  }> {
    if (!resourceWithValidation.data) {
      return {
        resource: { ...resourceWithValidation, validationResults: resourceWithValidation.validationResults || [] },
        wasRevalidated: false
      };
    }

    // Check if revalidation is needed
    const needsRevalidation = !resourceWithValidation.validationResults ||
                             resourceWithValidation.validationResults.length === 0 ||
                             this.isValidationOutdated(resourceWithValidation.data, resourceWithValidation.validationResults);

    if (needsRevalidation) {
      console.log(`[UnifiedValidation] Resource ${resourceWithValidation.resourceType}/${resourceWithValidation.resourceId} needs revalidation`);
      
      const validationResult = await this.validateResource(resourceWithValidation.data, true, true);
      
      return {
        resource: {
          ...resourceWithValidation,
          validationResults: validationResult.validationResults
        },
        wasRevalidated: validationResult.wasRevalidated
      };
    }

    return {
      resource: { ...resourceWithValidation, validationResults: resourceWithValidation.validationResults || [] },
      wasRevalidated: false
    };
  }
}