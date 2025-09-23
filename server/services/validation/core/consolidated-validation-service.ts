/**
 * Consolidated Validation Service
 * 
 * This service consolidates the functionality from:
 * - rock-solid-validation-engine.ts (core validation logic)
 * - unified-validation.ts (database persistence and caching)
 * - validation-pipeline.ts (orchestration)
 * 
 * Provides a unified API for all validation operations while maintaining
 * backward compatibility and removing deprecated code.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { storage } from '../../../storage';
import { getValidationEngine } from './validation-engine';
import { getValidationPipeline } from './validation-pipeline-new';
import { getValidationSettingsService } from '../settings/validation-settings-service';
import ValidationCacheManager from '../../../utils/validation-cache-manager';
import type { FhirResource, InsertFhirResource, InsertValidationResult, ValidationResult } from '@shared/schema';
import type { ValidationSettings } from '@shared/validation-settings';
import type { ValidationPipelineRequest, ValidationPipelineResult } from '../pipeline/pipeline-types';

// ============================================================================
// Consolidated Validation Service
// ============================================================================

export class ConsolidatedValidationService extends EventEmitter {
  private pipeline = getValidationPipeline();
  private validationEngine = getValidationEngine();
  private cachedSettings: ValidationSettings | null = null;
  private settingsCacheTime: number = 0;
  private SETTINGS_CACHE_TTL = 60000; // Cache settings for 1 minute
  private settingsService: ReturnType<typeof getValidationSettingsService>;

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
    this.setupSettingsEventListeners();
  }

  // ========================================================================
  // Settings Management
  // ========================================================================

  /**
   * Set up event listeners for settings changes
   */
  private setupSettingsEventListeners(): void {
    // Listen for settings changes and automatically reload configuration
    this.settingsService.on('settingsChanged', (event) => {
      console.log('[ConsolidatedValidation] Settings changed, clearing cache and reloading configuration');
      this.clearSettingsCache();
      this.loadValidationSettings().catch(error => {
        console.error('[ConsolidatedValidation] Failed to reload settings after change:', error);
      });
    });

    // Listen for settings activation
    this.settingsService.on('settingsActivated', (event) => {
      console.log('[ConsolidatedValidation] Settings activated, reloading configuration');
      this.clearSettingsCache();
      this.loadValidationSettings().catch(error => {
        console.error('[ConsolidatedValidation] Failed to reload settings after activation:', error);
      });
    });

    // Listen for settings service errors
    this.settingsService.on('error', (error) => {
      console.error('[ConsolidatedValidation] Settings service error:', error);
      // Clear cache to force reload on next access
      this.clearSettingsCache();
    });
  }

  /**
   * Load validation settings from database and update engine configuration
   */
  async loadValidationSettings(): Promise<void> {
    // Check if we have cached settings that are still valid
    const now = Date.now();
    if (this.cachedSettings && (now - this.settingsCacheTime) < this.SETTINGS_CACHE_TTL) {
      return; // Use cached settings
    }
    
    try {
      const settings = await this.settingsService.getActiveSettings();
      if (settings) {
        this.cachedSettings = settings;
        this.settingsCacheTime = now;
        
        // Update pipeline configuration based on settings
        this.pipeline.updateConfig({
          maxConcurrentValidations: settings.maxConcurrentValidations || 10,
          defaultTimeoutMs: settings.timeoutMs || 300000,
          enableParallelProcessing: settings.enableParallelProcessing !== false,
          enableResultCaching: settings.enableCaching !== false,
          cacheTtlMs: settings.cacheTtlMs || 300000
        });

        this.emit('settingsLoaded', { settings });
      }
    } catch (error) {
      console.error('[ConsolidatedValidation] Failed to load validation settings:', error);
      this.emit('settingsError', { error });
      throw error;
    }
  }

  /**
   * Force reload of validation settings
   */
  async forceReloadSettings(): Promise<void> {
    this.clearSettingsCache();
    await this.loadValidationSettings();
  }

  /**
   * Get current cached settings
   */
  async getCurrentSettings(): Promise<ValidationSettings | null> {
    if (!this.cachedSettings) {
      await this.loadValidationSettings();
    }
    return this.cachedSettings;
  }

  /**
   * Check if settings service is healthy
   */
  async isSettingsServiceHealthy(): Promise<boolean> {
    try {
      await this.settingsService.getActiveSettings();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear settings cache
   */
  private clearSettingsCache(): void {
    this.cachedSettings = null;
    this.settingsCacheTime = 0;
  }

  // ========================================================================
  // Resource Validation
  // ========================================================================

  /**
   * Validate a single resource with smart caching and timestamp-based invalidation
   * ALWAYS performs ALL validation categories when saving to database
   * Display filtering happens at the API layer
   */
  async validateResource(
    resource: any, 
    skipUnchanged: boolean = true, 
    forceRevalidation: boolean = false,
    retryAttempt: number = 0
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

    // Check if we need to revalidate
    const needsRevalidation = this.shouldRevalidateResource(dbResource, forceRevalidation, skipUnchanged);
    
    if (needsRevalidation) {
      // Perform validation using the pipeline
      const validationRequest: ValidationPipelineRequest = {
        resources: [{
          resource: resource,
          resourceType: resource.resourceType,
          resourceId: resource.id,
          profileUrl: undefined, // Will be determined by settings
          context: {
            requestId: `resource_${resource.resourceType}_${resource.id}_${Date.now()}`,
            requestedBy: 'consolidated-validation-service'
          }
        }],
        context: {
          requestId: `validation_${Date.now()}`,
          requestedBy: 'consolidated-validation-service'
        }
      };

      try {
        const pipelineResult = await this.pipeline.executePipeline(validationRequest);
        const validationResult = pipelineResult.results[0];

        if (validationResult) {
          // Save validation result to database
          const validationResultData: InsertValidationResult = {
            resourceId: dbResource.id,
            profileId: null, // TODO: link to profile if available
            isValid: validationResult.isValid,
            errors: validationResult.issues.filter(issue => issue.severity === 'error'),
            warnings: validationResult.issues.filter(issue => issue.severity === 'warning'),
            information: validationResult.issues.filter(issue => issue.severity === 'info'),
            summary: validationResult.summary,
            performance: validationResult.performance,
            validatedAt: validationResult.validatedAt,
            settingsUsed: validationResult.settingsUsed
          };

          await storage.createValidationResult(validationResultData);
          wasRevalidated = true;

          // Update resource with new validation results
          const updatedResource = await storage.getFhirResourceById(dbResource.id);
          if (updatedResource) {
            dbResource = updatedResource;
          }
        }
      } catch (error) {
        console.error('[ConsolidatedValidation] Validation failed:', error);
        throw error;
      }
    }

    return {
      validationResults: dbResource.validationResults || [],
      wasRevalidated
    };
  }

  /**
   * Check if resource needs revalidation
   */
  private shouldRevalidateResource(
    dbResource: FhirResource, 
    forceRevalidation: boolean, 
    skipUnchanged: boolean
  ): boolean {
    if (forceRevalidation) {
      return true;
    }

    if (!skipUnchanged) {
      return true;
    }

    // Check if resource has validation results
    if (!dbResource.validationResults || dbResource.validationResults.length === 0) {
      return true;
    }

    // Check if latest validation is recent enough (within 1 hour)
    const latestValidation = dbResource.validationResults[0];
    const validationAge = Date.now() - new Date(latestValidation.validatedAt).getTime();
    const maxAge = 60 * 60 * 1000; // 1 hour

    return validationAge > maxAge;
  }

  /**
   * Check and revalidate resource if needed
   */
  async checkAndRevalidateResource(
    resourceWithValidation: FhirResource & { validationResults?: ValidationResult[] }
  ): Promise<{
    needsRevalidation: boolean;
    wasRevalidated: boolean;
    validationResults: ValidationResult[];
  }> {
    const needsRevalidation = this.shouldRevalidateResource(
      resourceWithValidation, 
      false, // Don't force revalidation
      true   // Skip unchanged
    );

    let wasRevalidated = false;
    let validationResults = resourceWithValidation.validationResults || [];

    if (needsRevalidation) {
      const result = await this.validateResource(resourceWithValidation.data, true, false);
      validationResults = result.validationResults;
      wasRevalidated = result.wasRevalidated;
    }

    return {
      needsRevalidation,
      wasRevalidated,
      validationResults
    };
  }

  // ========================================================================
  // Batch Validation
  // ========================================================================

  /**
   * Validate multiple resources in batch
   */
  async validateResources(
    resources: any[],
    options: {
      forceRevalidation?: boolean;
      skipUnchanged?: boolean;
      maxConcurrency?: number;
    } = {}
  ): Promise<{
    results: Array<{
      resource: any;
      validationResults: ValidationResult[];
      wasRevalidated: boolean;
    }>;
    summary: {
      total: number;
      revalidated: number;
      cached: number;
      errors: number;
    };
  }> {
    const { forceRevalidation = false, skipUnchanged = true, maxConcurrency = 5 } = options;

    // Create validation requests
    const validationRequests = resources.map(resource => ({
      resource: resource,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      profileUrl: undefined,
      context: {
        requestId: `batch_${resource.resourceType}_${resource.id}_${Date.now()}`,
        requestedBy: 'consolidated-validation-service'
      }
    }));

    // Execute batch validation using pipeline
    const pipelineRequest: ValidationPipelineRequest = {
      resources: validationRequests,
      config: {
        maxConcurrentValidations: maxConcurrency,
        enableParallelProcessing: true,
        enableResultCaching: !forceRevalidation
      },
      context: {
        requestId: `batch_validation_${Date.now()}`,
        requestedBy: 'consolidated-validation-service'
      }
    };

    try {
      const pipelineResult = await this.pipeline.executePipeline(pipelineRequest);
      
      // Process results and save to database
      const results = [];
      let revalidated = 0;
      let cached = 0;
      let errors = 0;

      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const validationResult = pipelineResult.results[i];

        try {
          // Save resource to database
          const resourceData: InsertFhirResource = {
            resourceType: resource.resourceType,
            resourceId: resource.id,
            versionId: resource.meta?.versionId,
            data: resource,
            resourceHash: this.createResourceHash(resource),
            serverId: 1
          };

          let dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
          if (dbResource) {
            await storage.updateFhirResource(dbResource.id, resource);
          } else {
            dbResource = await storage.createFhirResource(resourceData);
          }

          // Save validation result
          if (validationResult) {
            const validationResultData: InsertValidationResult = {
              resourceId: dbResource.id,
              profileId: null,
              isValid: validationResult.isValid,
              errors: validationResult.issues.filter(issue => issue.severity === 'error'),
              warnings: validationResult.issues.filter(issue => issue.severity === 'warning'),
              information: validationResult.issues.filter(issue => issue.severity === 'info'),
              summary: validationResult.summary,
              performance: validationResult.performance,
              validatedAt: validationResult.validatedAt,
              settingsUsed: validationResult.settingsUsed
            };

            await storage.createValidationResult(validationResultData);
            revalidated++;
          } else {
            cached++;
          }

          results.push({
            resource,
            validationResults: [validationResult],
            wasRevalidated: !!validationResult
          });

        } catch (error) {
          console.error(`[ConsolidatedValidation] Failed to process resource ${resource.id}:`, error);
          errors++;
          results.push({
            resource,
            validationResults: [],
            wasRevalidated: false
          });
        }
      }

      return {
        results,
        summary: {
          total: resources.length,
          revalidated,
          cached,
          errors
        }
      };

    } catch (error) {
      console.error('[ConsolidatedValidation] Batch validation failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Create hash for resource content
   */
  private createResourceHash(resource: any): string {
    const content = JSON.stringify(resource, Object.keys(resource).sort());
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get pipeline instance for advanced operations
   */
  getPipeline() {
    return this.pipeline;
  }

  /**
   * Get validation engine instance for advanced operations
   */
  getValidationEngine() {
    return this.validationEngine;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.pipeline.getCacheStats();
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.pipeline.clearCache();
    this.clearSettingsCache();
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    settingsService: boolean;
    pipeline: boolean;
    engine: boolean;
    database: boolean;
  }> {
    const health = {
      healthy: true,
      settingsService: false,
      pipeline: false,
      engine: false,
      database: false
    };

    try {
      // Check settings service
      health.settingsService = await this.isSettingsServiceHealthy();
      
      // Check pipeline
      health.pipeline = !!this.pipeline;
      
      // Check engine
      health.engine = !!this.validationEngine;
      
      // Check database (simple query)
      try {
        await storage.getValidationSettings();
        health.database = true;
      } catch (error) {
        health.database = false;
      }

      health.healthy = health.settingsService && health.pipeline && health.engine && health.database;
    } catch (error) {
      health.healthy = false;
    }

    return health;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let consolidatedServiceInstance: ConsolidatedValidationService | null = null;

/**
 * Get consolidated validation service instance (singleton)
 */
export function getConsolidatedValidationService(): ConsolidatedValidationService {
  if (!consolidatedServiceInstance) {
    consolidatedServiceInstance = new ConsolidatedValidationService();
  }
  return consolidatedServiceInstance;
}

/**
 * Create new consolidated validation service instance
 */
export function createConsolidatedValidationService(): ConsolidatedValidationService {
  return new ConsolidatedValidationService();
}

/**
 * Reset service instance (for testing)
 */
export function resetConsolidatedValidationService(): void {
  consolidatedServiceInstance = null;
}

// ============================================================================
// Backward Compatibility Alias
// ============================================================================

/**
 * Backward compatibility alias for UnifiedValidationService
 * @deprecated Use ConsolidatedValidationService instead
 */
export const UnifiedValidationService = ConsolidatedValidationService;

/**
 * Backward compatibility factory function
 * @deprecated Use getConsolidatedValidationService instead
 */
export function getUnifiedValidationService(): ConsolidatedValidationService {
  return getConsolidatedValidationService();
}
