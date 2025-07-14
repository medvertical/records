import { createHash } from 'crypto';
import { storage } from '../storage.js';
import { ValidationEngine } from './validation-engine.js';
import { FhirClient } from './fhir-client.js';
import type { FhirResource, InsertFhirResource, InsertValidationResult, ValidationResult } from '@shared/schema.js';

/**
 * Unified validation service that handles both batch and individual resource validation
 * with timestamp-based invalidation
 */
export class UnifiedValidationService {
  constructor(
    private fhirClient: FhirClient,
    private validationEngine: ValidationEngine
  ) {}

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
        // Perform FHIR validation
        const outcome = await this.validationEngine.validateResource(resource);
        
        // Convert validation outcome to our format
        const validationResult: InsertValidationResult = {
          resourceId: dbResource.id,
          profileId: null, // Will be set by validation engine if specific profile used
          isValid: !outcome.issue.some(issue => issue.severity === 'error' || issue.severity === 'fatal'),
          errors: outcome.issue.filter(issue => issue.severity === 'error' || issue.severity === 'fatal').map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.details?.text || issue.diagnostics || 'Unknown error',
            path: issue.location?.[0] || '',
            expression: issue.expression?.[0],
            code: issue.code
          })),
          warnings: outcome.issue.filter(issue => issue.severity === 'warning').map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.details?.text || issue.diagnostics || 'Unknown warning',
            path: issue.location?.[0] || '',
            expression: issue.expression?.[0],
            code: issue.code
          })),
          issues: outcome.issue.map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.details?.text || issue.diagnostics || 'Unknown issue',
            path: issue.location?.[0] || '',
            expression: issue.expression?.[0],
            code: issue.code
          })),
          errorCount: outcome.issue.filter(issue => issue.severity === 'error' || issue.severity === 'fatal').length,
          warningCount: outcome.issue.filter(issue => issue.severity === 'warning').length,
          validationScore: this.calculateValidationScore(outcome.issue),
          validatedAt: new Date()
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