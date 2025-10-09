/**
 * Batch Validation Orchestrator
 * 
 * Extracted from ConsolidatedValidationService to handle batch validation operations.
 * Follows Single Responsibility Principle.
 * 
 * Responsibilities:
 * - Orchestrate batch validation pipelines
 * - Process batch results
 * - Persist batch validation data
 * - Calculate batch summaries
 * 
 * File size: Target <350 lines
 */

import { storage } from '../../../storage';
import { getValidationPipeline } from './validation-pipeline';
import { getValidationResourceTypeFilteringService } from '../features/validation-resource-type-filtering-service';
import { getValidationResultBuilder, type DetailedValidationResult } from '../utils/validation-result-builder';
import { getValidationCacheHelper } from '../utils/validation-cache-helper';
import { cacheManager } from '../../../utils/cache-manager';
import type {
  InsertFhirResource,
  ValidationResult as StoredValidationResult,
} from '@shared/schema';
import type { ValidationSettings } from '@shared/validation-settings';
import type {
  ValidationPipelineRequest,
} from '../pipeline/pipeline-types';
import type {
  ValidationResult as EngineValidationResult,
} from '../types/validation-types';

// ============================================================================
// Types
// ============================================================================

export interface BatchValidationOptions {
  forceRevalidation?: boolean;
  skipUnchanged?: boolean;
  maxConcurrency?: number;
}

export interface BatchValidationResult {
  resource: any;
  validationResults: StoredValidationResult[];
  detailedResult: DetailedValidationResult;
  wasRevalidated: boolean;
}

export interface BatchValidationSummary {
  total: number;
  revalidated: number;
  cached: number;
  errors: number;
  filtered: number;
}

// ============================================================================
// Batch Validation Orchestrator
// ============================================================================

export class BatchValidationOrchestrator {
  private pipeline = getValidationPipeline();
  private resultBuilder = getValidationResultBuilder();
  private cacheHelper = getValidationCacheHelper();

  /**
   * Validate multiple resources in batch
   */
  async validateBatch(
    resources: any[],
    settings: ValidationSettings,
    options: BatchValidationOptions = {}
  ): Promise<{
    results: BatchValidationResult[];
    summary: BatchValidationSummary;
  }> {
    const { forceRevalidation = false, maxConcurrency = 5 } = options;

    // Apply resource type filtering
    const { filteredResources, filterStats } = await this.applyResourceFiltering(resources);
    
    console.log(
      `[BatchValidationOrchestrator] Filtering: ${filterStats.total} total, ` +
      `${filterStats.filtered} to validate, ${filterStats.skipped} filtered out`
    );

    // Execute batch validation
    const validationResults = await this.executePipelineValidation(
      filteredResources,
      settings,
      maxConcurrency,
      forceRevalidation
    );

    // Process and persist results
    const results = await this.processBatchResults(resources, validationResults);

    // Calculate summary
    const summary = this.calculateSummary(results, filterStats);

    return { results, summary };
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private async applyResourceFiltering(resources: any[]): Promise<{
    filteredResources: any[];
    filterStats: { total: number; filtered: number; skipped: number };
  }> {
    const filteringService = getValidationResourceTypeFilteringService();
    await filteringService.initialize();
    
    const { filtered: filteredResources, statistics } = filteringService.filterResources(resources);
    
    return {
      filteredResources,
      filterStats: {
        total: statistics.totalResources,
        filtered: statistics.filteredResources,
        skipped: statistics.totalResources - statistics.filteredResources,
      },
    };
  }

  private async executePipelineValidation(
    resources: any[],
    settings: ValidationSettings,
    maxConcurrency: number,
    forceRevalidation: boolean
  ): Promise<EngineValidationResult[]> {
    const validationRequests = resources.map(resource => ({
      resource,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      profileUrl: undefined,
      settings,
    })) as any[];

    const pipelineRequest: ValidationPipelineRequest = {
      resources: validationRequests,
      config: {
        maxConcurrentValidations: maxConcurrency,
        enableParallelProcessing: true,
        enableResultCaching: !forceRevalidation,
      },
      context: {
        requestId: `batch_validation_${Date.now()}`,
        requestedBy: 'batch-validation-orchestrator',
      },
    };

    const pipelineResult = await this.pipeline.executePipeline(pipelineRequest);
    return pipelineResult.results || [];
  }

  private async processBatchResults(
    resources: any[],
    validationResults: EngineValidationResult[]
  ): Promise<BatchValidationResult[]> {
    const results: BatchValidationResult[] = [];

    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      const validationResult = validationResults[i];

      try {
        const result = await this.processSingleResult(resource, validationResult);
        results.push(result);
      } catch (error) {
        console.error(`[BatchValidationOrchestrator] Failed to process resource ${resource.id}:`, error);
        results.push(this.createErrorResult(resource));
      }
    }

    return results;
  }

  private async processSingleResult(
    resource: any,
    validationResult: EngineValidationResult | undefined
  ): Promise<BatchValidationResult> {
    // Save resource to database
    const resourceHash = this.cacheHelper.createResourceHash(resource);
    const dbResource = await this.ensureResourcePersisted(resource, resourceHash);

    let storedResults: StoredValidationResult[] = [];
    let detailedResult: DetailedValidationResult;
    let wasRevalidated = false;

    if (validationResult && dbResource?.id) {
      // Build and persist new validation result
      const result = await this.persistValidationResult(
        dbResource.id,
        resource,
        validationResult,
        resourceHash
      );
      storedResults = result.storedResults;
      detailedResult = result.detailedResult;
      wasRevalidated = true;
    } else if (validationResult) {
      // Resource not persisted, but validation result available
      detailedResult = this.resultBuilder.buildFromEngine(
        validationResult,
        resource.resourceType,
        resource.id ?? null
      );
      wasRevalidated = true;
    } else {
      // Use cached results
      const result = await this.loadCachedResult(dbResource, resource);
      storedResults = result.storedResults;
      detailedResult = result.detailedResult;
    }

    return {
      resource,
      validationResults: storedResults,
      detailedResult,
      wasRevalidated,
    };
  }

  private async ensureResourcePersisted(
    resource: any,
    resourceHash: string
  ): Promise<any> {
    if (!resource.id) {
      return undefined;
    }

    const resourceData: InsertFhirResource = {
      resourceType: resource.resourceType,
      resourceId: resource.id,
      versionId: resource.meta?.versionId,
      data: resource,
      resourceHash,
      serverId: 1,
    };

    let dbResource = await storage.getFhirResourceByTypeAndId(
      resource.resourceType,
      resource.id
    );

    if (dbResource) {
      await storage.updateFhirResource(dbResource.id, resource);
    } else {
      dbResource = await storage.createFhirResource(resourceData);
    }

    return dbResource;
  }

  private async persistValidationResult(
    dbResourceId: number,
    resource: any,
    validationResult: EngineValidationResult,
    resourceHash: string
  ): Promise<{
    storedResults: StoredValidationResult[];
    detailedResult: DetailedValidationResult;
  }> {
    const detailedResult = this.resultBuilder.buildFromEngine(
      validationResult,
      resource.resourceType,
      resource.id ?? null
    );
    
    const insertData = this.resultBuilder.buildInsertResult(
      dbResourceId,
      detailedResult,
      resourceHash,
      validationResult
    );

    const activeServer = await storage.getActiveFhirServer();
    const serverId = activeServer?.id || 1;

    const savedResult = await storage.createValidationResultWithFhirIdentity(
      insertData,
      serverId,
      resource.resourceType,
      resource.id
    );
    
    await storage.updateFhirResourceLastValidated(dbResourceId, detailedResult.validatedAt);
    
    // Clear cache
    cacheManager.clear();

    // Reload to get fresh data
    const refreshed = await storage.getFhirResourceById(dbResourceId);
    const storedResults = refreshed?.validationResults || [savedResult];

    return {
      storedResults,
      detailedResult,
    };
  }

  private async loadCachedResult(
    dbResource: any,
    resource: any
  ): Promise<{
    storedResults: StoredValidationResult[];
    detailedResult: DetailedValidationResult;
  }> {
    const refreshed = dbResource?.id 
      ? await storage.getFhirResourceById(dbResource.id) 
      : undefined;
    
    const storedResults = refreshed?.validationResults || [];
    const latestResult = this.cacheHelper.getLatestResult(storedResults);
    
    const detailedResult = latestResult
      ? this.resultBuilder.buildFromStored(latestResult, resource.resourceType, resource.id ?? null)
      : this.resultBuilder.createEmpty(resource);

    return {
      storedResults,
      detailedResult,
    };
  }

  private createErrorResult(resource: any): BatchValidationResult {
    return {
      resource,
      validationResults: [],
      detailedResult: this.resultBuilder.createEmpty(resource),
      wasRevalidated: false,
    };
  }

  private calculateSummary(
    results: BatchValidationResult[],
    filterStats: { total: number; skipped: number }
  ): BatchValidationSummary {
    const revalidated = results.filter(r => r.wasRevalidated).length;
    const cached = results.filter(r => !r.wasRevalidated).length;

    return {
      total: filterStats.total,
      revalidated,
      cached,
      errors: 0, // Errors are caught and included in results
      filtered: filterStats.skipped,
    };
  }
}

// Singleton instance
let orchestratorInstance: BatchValidationOrchestrator | null = null;

/**
 * Get singleton instance of BatchValidationOrchestrator
 */
export function getBatchValidationOrchestrator(): BatchValidationOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new BatchValidationOrchestrator();
  }
  return orchestratorInstance;
}

