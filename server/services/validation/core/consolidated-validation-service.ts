/**
 * Consolidated Validation Service (REFACTORED)
 * 
 * Main orchestration service for all validation operations.
 * Uses extracted utilities for single responsibility:
 * - ValidationSettingsCacheService (settings caching)
 * - ValidationResultBuilder (result transformation)
 * - ValidationCacheHelper (resource hashing & cache checks)
 * 
 * Refactored from 1110 lines to ~450 lines
 * 
 * Responsibilities:
 * - Orchestrate validation pipeline
 * - Coordinate with storage layer
 * - Manage validation lifecycle
 * - Provide unified validation API
 */

import { EventEmitter } from 'events';
import { storage } from '../../../storage';
import { validationEnginePerAspect } from '../engine/validation-engine-per-aspect';
import { getValidationPipeline } from './validation-pipeline';
import { getValidationResourceTypeFilteringService } from '../features/validation-resource-type-filtering-service';
import { getValidationSettingsCacheService } from '../utils/validation-settings-cache-service';
import { getValidationSettingsService } from '../settings/validation-settings-service';
import { getValidationResultBuilder, type DetailedValidationResult } from '../utils/validation-result-builder';
import { getValidationCacheHelper } from '../utils/validation-cache-helper';
import { getValidationResourcePersistence } from '../utils/validation-resource-persistence';
import { getBatchValidationOrchestrator } from './batch-validation-orchestrator';
import { cacheManager } from '../../../utils/cache-manager';
import type {
  FhirResourceWithValidation,
  InsertFhirResource,
  ValidationResult as StoredValidationResult,
} from '@shared/schema';
import type { ValidationSettings } from '@shared/validation-settings';
import type {
  ValidationPipelineRequest,
  ValidationPipelineConfig,
} from '../pipeline/pipeline-types';
import type {
  ValidationResult as EngineValidationResult,
} from '../types/validation-types';

// ============================================================================
// Types
// ============================================================================

export interface ValidateResourceOptions {
  pipelineConfig?: Partial<ValidationPipelineConfig>;
  validationSettingsOverride?: ValidationSettings;
  profileUrls?: string[];
  requestContext?: {
    requestId?: string;
    requestedBy?: string;
    metadata?: Record<string, any>;
  };
}

// ============================================================================
// Consolidated Validation Service
// ============================================================================

export class ConsolidatedValidationService extends EventEmitter {
  private pipeline = getValidationPipeline();
  private validationEngine = validationEnginePerAspect;
  private settingsCache = getValidationSettingsCacheService();
  private resultBuilder = getValidationResultBuilder();
  private cacheHelper = getValidationCacheHelper();
  private resourcePersistence = getValidationResourcePersistence();
  private batchOrchestrator = getBatchValidationOrchestrator();

  constructor() {
    super();
    this.setupEventListeners();
  }

  // ========================================================================
  // Event Management
  // ========================================================================

  private setupEventListeners(): void {
    // Forward settings cache events
    this.settingsCache.on('settingsInvalidated', (event) => {
      console.log('[ConsolidatedValidation] Settings invalidated from cache, clearing caches');
      this.clearCaches();
    });

    this.settingsCache.on('settingsLoaded', (event) => {
      this.updatePipelineConfig(event.settings);
      this.emit('settingsLoaded', event);
    });

    this.settingsCache.on('error', (error) => {
      console.error('[ConsolidatedValidation] Settings error:', error);
      this.emit('settingsError', { error });
    });

    // Also listen directly to settings service for invalidation events
    const settingsService = getValidationSettingsService();
    settingsService.on('settingsInvalidated', (event) => {
      console.log('[ConsolidatedValidation] Settings invalidated from service:', event);
      this.clearCaches();
      this.emit('settingsInvalidated', event);
    });
  }

  private updatePipelineConfig(settings: ValidationSettings): void {
    this.pipeline.updateConfig({
      maxConcurrentValidations: settings.performance?.maxConcurrent || 10,
      defaultTimeoutMs: settings.server?.timeout || 300000,
      enableParallelProcessing: true,
      enableResultCaching: true,
      cacheTtlMs: 300000,
    });
  }

  // ========================================================================
  // Settings Management
  // ========================================================================

  async loadValidationSettings(): Promise<void> {
    const settings = await this.settingsCache.loadSettings();
    if (settings) {
      this.updatePipelineConfig(settings);
    }
  }

  async forceReloadSettings(): Promise<void> {
    await this.settingsCache.forceReload();
  }

  async getCurrentSettings(): Promise<ValidationSettings | null> {
    return this.settingsCache.getSettings();
  }

  async isSettingsServiceHealthy(): Promise<boolean> {
    return this.settingsCache.isHealthy();
  }

  // ========================================================================
  // Resource Validation
  // ========================================================================

  /**
   * Validate a single resource with smart caching and timestamp-based invalidation
   */
  async validateResource(
    resource: any,
    skipUnchanged: boolean = true,
    forceRevalidation: boolean = false,
    retryAttempt: number = 0,
    options: ValidateResourceOptions = {}
  ): Promise<{
    validationResults: StoredValidationResult[];
    detailedResult: DetailedValidationResult;
    wasRevalidated: boolean;
  }> {
    console.error(`[ConsolidatedValidation] *** VALIDATE RESOURCE CALLED: ${resource.resourceType}/${resource.id} (forceRevalidation: ${forceRevalidation}) ***`);
    
    // Check resource type filtering
    const filterResult = await this.checkResourceFiltering(resource);
    if (!filterResult.shouldValidate) {
      console.error(`[ConsolidatedValidation] *** RESOURCE FILTERED OUT: ${filterResult.reason} ***`);
      return this.createFilteredResult(resource, filterResult.reason);
    }
    
    const resourceHash = this.cacheHelper.createResourceHash(resource);
    const { dbResource, dbResourceId } = await this.resourcePersistence.ensureResourceStored(resource, resourceHash);

    console.error(`[ConsolidatedValidation] *** DB RESOURCE ID: ${dbResourceId} ***`);

    // Check if revalidation is needed
    const needsRevalidation = this.determineRevalidationNeed(
      dbResource,
      forceRevalidation,
      skipUnchanged
    );

    console.error(`[ConsolidatedValidation] *** NEEDS REVALIDATION: ${needsRevalidation} (force: ${forceRevalidation}, skip: ${skipUnchanged}) ***`);

    let wasRevalidated = false;
    let detailedResult: DetailedValidationResult | null = null;

    if (needsRevalidation) {
      console.error(`[ConsolidatedValidation] *** STARTING VALIDATION FOR ${resource.resourceType}/${resource.id} ***`);
      
      // Get settings that will be used for validation
      const settingsUsed = options.validationSettingsOverride || await this.getCurrentSettings();
      
      console.error(`[ConsolidatedValidation] *** SETTINGS OVERRIDE: ${options.validationSettingsOverride ? 'YES' : 'NO'} ***`);
      
      // Execute validation
      const validationResult = await this.executeValidation(resource, options);
      detailedResult = this.resultBuilder.buildFromEngine(
        validationResult,
        resource.resourceType,
        resource.id ?? null
      );
      wasRevalidated = true;

      // Persist results with the settings that were actually used
      if (dbResourceId) {
        console.error(`[ConsolidatedValidation] *** CALLING persistValidationResult FOR ${resource.resourceType}/${resource.id} ***`);
        await this.resourcePersistence.persistValidationResult(
          dbResourceId,
          resource,
          detailedResult,
          resourceHash,
          validationResult,
          settingsUsed
        );
        console.error(`[ConsolidatedValidation] *** PERSISTENCE CALL COMPLETED FOR ${resource.resourceType}/${resource.id} ***`);
      } else {
        console.error(`[ConsolidatedValidation] *** NO DB RESOURCE ID - SKIPPING PERSISTENCE ***`);
      }
    } else {
      console.error(`[ConsolidatedValidation] *** USING CACHED RESULTS FOR ${resource.resourceType}/${resource.id} ***`);
      // Use cached results
      detailedResult = this.buildResultFromCached(dbResource, resource);
    }

    if (!detailedResult) {
      detailedResult = this.resultBuilder.createEmpty(resource);
    }

    return {
      validationResults: dbResource?.validationResults || [],
      detailedResult,
      wasRevalidated,
    };
  }

  /**
   * Check and revalidate resource if needed
   */
  async checkAndRevalidateResource(
    resourceWithValidation: FhirResourceWithValidation
  ): Promise<{
    needsRevalidation: boolean;
    wasRevalidated: boolean;
    validationResults: StoredValidationResult[];
    detailedResult: DetailedValidationResult;
  }> {
    const needsRevalidation = this.determineRevalidationNeed(
      resourceWithValidation,
      false,
      true
    );

    let wasRevalidated = false;
    let validationResults = resourceWithValidation.validationResults || [];
    let detailedResult: DetailedValidationResult;

    if (needsRevalidation) {
      const result = await this.validateResource(resourceWithValidation.data, true, false);
      validationResults = result.validationResults;
      wasRevalidated = result.wasRevalidated;
      detailedResult = result.detailedResult;
    } else {
      detailedResult = this.buildResultFromCached(resourceWithValidation, resourceWithValidation.data);
    }

    return {
      needsRevalidation,
      wasRevalidated,
      validationResults,
      detailedResult,
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
      validationResults: StoredValidationResult[];
      detailedResult: DetailedValidationResult;
      wasRevalidated: boolean;
    }>;
    summary: {
      total: number;
      revalidated: number;
      cached: number;
      errors: number;
      filtered: number;
    };
  }> {
    // Get validation settings
    const currentSettings = await this.getCurrentSettings();
    if (!currentSettings) {
      throw new Error('Failed to load validation settings');
    }

    // Delegate to batch orchestrator
    return this.batchOrchestrator.validateBatch(resources, currentSettings, options);
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private async checkResourceFiltering(resource: any): Promise<{ shouldValidate: boolean; reason?: string }> {
    const filteringService = getValidationResourceTypeFilteringService();
    await filteringService.initialize();
    
    return filteringService.shouldValidateResource(
      resource.resourceType,
      resource.meta?.versionId === '1'
    );
  }

  private createFilteredResult(resource: any, reason?: string): {
    validationResults: StoredValidationResult[];
    detailedResult: DetailedValidationResult;
    wasRevalidated: boolean;
  } {
    console.log(`[ConsolidatedValidation] Skipping validation for ${resource.resourceType}/${resource.id}: ${reason}`);
    
    const detailedResult = this.resultBuilder.createEmpty(resource);
    detailedResult.wasFiltered = true;
    detailedResult.filterReason = reason;

    return {
      validationResults: [],
      detailedResult,
      wasRevalidated: false,
    };
  }


  private determineRevalidationNeed(
    dbResource: FhirResourceWithValidation | undefined,
    forceRevalidation: boolean,
    skipUnchanged: boolean
  ): boolean {
    if (!dbResource) {
      return true;
    }

    if (forceRevalidation) {
      return true;
    }

    if (!skipUnchanged) {
      return true;
    }

    const validationResults = dbResource.validationResults || [];
    if (validationResults.length === 0) {
      return true;
    }

    const latestResult = this.cacheHelper.getLatestResult(validationResults);
    if (!latestResult) {
      return true;
    }

    // Check if result is stale (1 hour)
    return this.cacheHelper.isResultStale(latestResult, 3600000);
  }

  private async executeValidation(
    resource: any,
    options: ValidateResourceOptions
  ): Promise<EngineValidationResult> {
    const currentSettings = options.validationSettingsOverride || await this.getCurrentSettings();
    if (!currentSettings) {
      throw new Error('Failed to load validation settings');
    }

    // Merge explicit profile URLs with existing resource meta.profile
    let resourceWithProfiles = { ...resource };
    if (options.profileUrls && options.profileUrls.length > 0) {
      // Ensure meta.profile exists and merge with explicit profile URLs
      if (!resourceWithProfiles.meta) {
        resourceWithProfiles.meta = {};
      }
      if (!resourceWithProfiles.meta.profile) {
        resourceWithProfiles.meta.profile = [];
      }
      
      // Add explicit profile URLs that aren't already present
      const existingProfiles = new Set(resourceWithProfiles.meta.profile);
      const newProfiles = options.profileUrls.filter(url => !existingProfiles.has(url));
      resourceWithProfiles.meta.profile = [...resourceWithProfiles.meta.profile, ...newProfiles];
    }

    const requestContext = options.requestContext || {};
    const pipelineRequest: ValidationPipelineRequest = {
      resources: [
        {
          resource: resourceWithProfiles,
          resourceType: resource.resourceType,
          resourceId: resource.id,
          profileUrl: options.profileUrls?.[0], // Use first profile URL if available
          settings: currentSettings,
        } as any,
      ],
      context: {
        requestId: requestContext.requestId ?? `validation_${Date.now()}`,
        requestedBy: requestContext.requestedBy ?? 'consolidated-validation-service',
        metadata: requestContext.metadata,
      },
    };

    if (options.pipelineConfig) {
      pipelineRequest.config = options.pipelineConfig;
    }

    const pipelineResult = await this.pipeline.executePipeline(pipelineRequest);
    if (!pipelineResult.results || pipelineResult.results.length === 0) {
      throw new Error('Validation pipeline returned no results');
    }

    return pipelineResult.results[0];
  }

  private buildResultFromCached(
    dbResource: FhirResourceWithValidation | undefined,
    resource: any
  ): DetailedValidationResult {
    const validationResults = dbResource?.validationResults || [];
    const latestResult = this.cacheHelper.getLatestResult(validationResults);

    if (latestResult) {
      return this.resultBuilder.buildFromStored(
        latestResult,
        resource.resourceType,
        resource.id ?? null
      );
    }

    return this.resultBuilder.createEmpty(resource);
  }



  // ========================================================================
  // Public Accessors
  // ========================================================================

  getPipeline() {
    return this.pipeline;
  }

  getValidationEngine() {
    return this.validationEngine;
  }

  getCacheStats() {
    return {
      pipeline: this.pipeline.getCacheStats(),
      settings: this.settingsCache.getCacheStats(),
    };
  }

  clearCaches(): void {
    this.pipeline.clearCache();
    this.settingsCache.clearCache();
    cacheManager.clear();
  }

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
      database: false,
    };

    try {
      health.settingsService = await this.settingsCache.isHealthy();
      health.pipeline = !!this.pipeline;
      health.engine = !!this.validationEngine;
      
      // Check database
      try {
        await storage.getActiveFhirServer();
        health.database = true;
      } catch {
        health.database = false;
      }

      health.healthy = health.settingsService && health.pipeline && health.engine && health.database;
    } catch (error) {
      console.error('[ConsolidatedValidation] Health check failed:', error);
      health.healthy = false;
    }

    return health;
  }
}

// Singleton instance
let consolidatedServiceInstance: ConsolidatedValidationService | null = null;

/**
 * Get singleton instance of ConsolidatedValidationService
 */
export function getConsolidatedValidationService(): ConsolidatedValidationService {
  if (!consolidatedServiceInstance) {
    consolidatedServiceInstance = new ConsolidatedValidationService();
  }
  return consolidatedServiceInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetConsolidatedValidationService(): void {
  consolidatedServiceInstance = null;
}

