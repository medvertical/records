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
import { getValidationPipeline } from './validation-pipeline';
import { getValidationSettingsService } from '../settings/validation-settings-service-simplified';
import { getValidationResourceTypeFilteringService } from '../features/validation-resource-type-filtering-service';
import { cacheManager } from '../../../utils/cache-manager';
import type {
  FhirResourceWithValidation,
  InsertFhirResource,
  InsertValidationResult,
  ValidationResult as StoredValidationResult,
} from '@shared/schema';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import type {
  ValidationPipelineRequest,
  ValidationPipelineConfig,
} from '../pipeline/pipeline-types';
import type {
  ValidationAspectResult,
  ValidationIssue as EngineValidationIssue,
  ValidationResult as EngineValidationResult,
} from '../types/validation-types';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

interface DetailedValidationIssue extends EngineValidationIssue {
  category?: string;
}

interface ValidationSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  score: number;
}

interface ValidationPerformanceSummary {
  totalTimeMs: number;
  aspectTimes: Record<string, number>;
}

interface DetailedValidationResult {
  resourceType: string;
  resourceId: string | null;
  isValid: boolean;
  issues: DetailedValidationIssue[];
  aspects: ValidationAspectResult[];
  summary: ValidationSummary;
  performance: ValidationPerformanceSummary;
  validatedAt: string;
  validationTime: number;
  wasFiltered?: boolean;
  filterReason?: string;
}

interface ValidateResourceOptions {
  pipelineConfig?: Partial<ValidationPipelineConfig>;
  validationSettingsOverride?: ValidationSettings;
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
      console.log('[ConsolidatedValidation] Settings changed, clearing ALL caches and reloading configuration');
      this.clearCaches(); // Clear all caches, not just settings cache
      this.loadValidationSettings().catch(error => {
        console.error('[ConsolidatedValidation] Failed to reload settings after change:', error);
      });
    });

    // Listen for settings activation
    this.settingsService.on('settingsActivated', (event) => {
      console.log('[ConsolidatedValidation] Settings activated, clearing ALL caches and reloading configuration');
      this.clearCaches(); // Clear all caches, not just settings cache
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
      const settings = await this.settingsService.getCurrentSettings();
      if (settings) {
        this.cachedSettings = settings;
        this.settingsCacheTime = now;
        
        // Update pipeline configuration based on settings
        this.pipeline.updateConfig({
          maxConcurrentValidations: settings.performance?.maxConcurrent || 10,
          defaultTimeoutMs: settings.server?.timeout || 300000,
          enableParallelProcessing: true, // Always enable parallel processing
          enableResultCaching: true, // Always enable result caching
          cacheTtlMs: 300000 // Default cache TTL
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
      await this.settingsService.getCurrentSettings();
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
   * Respects validation settings to determine which aspects to run
   * Only runs validation aspects that are enabled in current settings
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
    console.log(`[ConsolidatedValidation] validateResource called for ${resource.resourceType}/${resource.id}`);
    
    // Check resource type filtering
    const resourceTypeFilteringService = getValidationResourceTypeFilteringService();
    await resourceTypeFilteringService.initialize();
    
    const filterResult = resourceTypeFilteringService.shouldValidateResource(
      resource.resourceType,
      resource.meta?.versionId === '1' // Assume version 1 is latest if no version info
    );
    
    if (!filterResult.shouldValidate) {
      console.log(`[ConsolidatedValidation] Skipping validation for ${resource.resourceType}/${resource.id}: ${filterResult.reason}`);
      
      // Return empty result for filtered resources
      return {
        validationResults: [],
        detailedResult: {
          resourceId: resource.id,
          resourceType: resource.resourceType,
          isValid: true, // Assume valid if not validated
          issues: [],
          aspects: [],
          validationTime: 0,
          validatedAt: new Date(),
          wasFiltered: true,
          filterReason: filterResult.reason
        },
        wasRevalidated: false
      };
    }
    
    const resourceHash = this.createResourceHash(resource);

    let dbResource: FhirResourceWithValidation | undefined;
    let dbResourceId: number | undefined;

    try {
      if (resource._dbId) {
        dbResource = await storage.getFhirResourceById(resource._dbId);
        dbResourceId = dbResource?.id;
      } else if (resource.id) {
        const existing = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
        if (existing) {
          dbResourceId = existing.id;
        }
      }

      if (resource.id) {
        const resourceData: InsertFhirResource = {
          resourceType: resource.resourceType,
          resourceId: resource.id,
          versionId: resource.meta?.versionId,
          data: resource,
          resourceHash,
          serverId: 1 // TODO: inject active server
        };

        if (dbResourceId) {
          await storage.updateFhirResource(dbResourceId, resource);
        } else {
          const created = await storage.createFhirResource(resourceData);
          dbResourceId = created.id;
        }

        if (dbResourceId) {
          dbResource = await storage.getFhirResourceById(dbResourceId);
        }
      }
    } catch (error) {
      console.error('[ConsolidatedValidation] Failed to persist resource before validation:', error);
      throw error;
    }

    let wasRevalidated = false;
    let detailedResult: DetailedValidationResult | null = null;

    const needsRevalidation = !dbResource
      ? true
      : this.shouldRevalidateResource(dbResource, forceRevalidation, skipUnchanged);

    if (needsRevalidation) {
      // Get current validation settings to determine which aspects to run
      const currentSettings = await this.getCurrentSettings();
      if (!currentSettings) {
        throw new Error('Failed to load validation settings');
      }

      const requestContext = options.requestContext || {};
      const pipelineRequest: ValidationPipelineRequest = {
        resources: [
          {
            resource,
            resourceType: resource.resourceType,
            resourceId: resource.id,
            profileUrl: undefined,
            settings: options.validationSettingsOverride || currentSettings, // Use current settings if no override
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

      try {
        const pipelineResult = await this.pipeline.executePipeline(pipelineRequest);
        if (!pipelineResult.results || pipelineResult.results.length === 0) {
          throw new Error('Validation pipeline returned no results');
        }

        const pipelineValidationResult = pipelineResult.results[0];
        detailedResult = this.buildDetailedResultFromEngine(
          pipelineValidationResult,
          resource.resourceType,
          resource.id ?? null
        );
        wasRevalidated = true;

        if (dbResourceId) {
          const insertData = this.buildInsertValidationResult(
            dbResourceId,
            detailedResult,
            resourceHash,
            pipelineValidationResult
          );

          // Get active server ID for FHIR identity
          const activeServer = await storage.getActiveFhirServer();
          const serverId = activeServer?.id || 1;

          console.log(`[ConsolidatedValidation] Saving validation result for resource ID: ${dbResourceId} with FHIR identity: ${serverId}:${resource.resourceType}:${resource.id}`);
          await storage.createValidationResultWithFhirIdentity(
            insertData,
            serverId,
            resource.resourceType,
            resource.id
          );
          await storage.updateFhirResourceLastValidated(dbResourceId, detailedResult.validatedAt);
          
          // Persist per-aspect results and messages into new schema
          try {
            const { persistEngineResultPerAspect } = await import('../persistence/per-aspect-persistence');
            const settingsSnapshot = { aspects: {
              structural: { enabled: true },
              profile: { enabled: true },
              terminology: { enabled: true },
              reference: { enabled: true },
              businessRule: { enabled: true },
              metadata: { enabled: true },
            }} as any;
            await persistEngineResultPerAspect({
              serverId,
              resourceType: resource.resourceType,
              fhirId: resource.id,
              settingsSnapshot,
              engineResult: pipelineValidationResult as any,
            });
          } catch (e) {
            console.error('[ConsolidatedValidation] Failed to persist per-aspect results:', e);
          }

          // Clear all cache entries to ensure fresh data
          cacheManager.clear();
          console.log(`[ConsolidatedValidation] Cleared all cache for resource ID: ${dbResourceId}`);
          
          dbResource = await storage.getFhirResourceById(dbResourceId);
        }
      } catch (error) {
        console.error('[ConsolidatedValidation] Validation failed:', error);
        throw error;
      }
    }

    if (!detailedResult) {
      const latestStored = dbResource?.validationResults
        ? this.getLatestStoredValidationResult(dbResource.validationResults)
        : undefined;

      if (latestStored) {
        detailedResult = this.buildDetailedResultFromStored(
          latestStored,
          resource.resourceType,
          resource.id ?? null
        );
      }
    }

    if (!detailedResult) {
      detailedResult = this.createEmptyDetailedResult(resource);
    }

    return {
      validationResults: dbResource?.validationResults || [],
      detailedResult,
      wasRevalidated,
    };
  }

  private buildDetailedResultFromEngine(
    result: EngineValidationResult,
    resourceType: string,
    resourceId: string | null
  ): DetailedValidationResult {
    const issues = this.normalizeIssues(result.issues || []);
    const summary = this.buildSummary(issues, result.isValid, undefined);
    const performance = this.buildPerformanceSummaryFromEngine(result);
    const validatedAt = result.validatedAt instanceof Date
      ? result.validatedAt.toISOString()
      : new Date().toISOString();

    return {
      resourceType,
      resourceId,
      isValid: result.isValid,
      issues,
      summary,
      performance,
      validatedAt,
    };
  }

  private buildDetailedResultFromStored(
    stored: StoredValidationResult,
    resourceType: string,
    resourceId: string | null
  ): DetailedValidationResult {
    const issues = this.normalizeIssues(Array.isArray(stored.issues) ? stored.issues : []);
    const summary = this.buildSummary(issues, stored.isValid, {
      totalIssues: Array.isArray(stored.issues) ? stored.issues.length : undefined,
      errorCount: stored.errorCount ?? undefined,
      warningCount: stored.warningCount ?? undefined,
      informationCount: undefined,
      score: stored.validationScore ?? undefined,
    });
    const performance = this.buildPerformanceSummaryFromStored(stored);
    const validatedAt = stored.validatedAt
      ? new Date(stored.validatedAt).toISOString()
      : new Date().toISOString();

    return {
      resourceType,
      resourceId,
      isValid: stored.isValid,
      issues,
      summary,
      performance,
      validatedAt,
    };
  }

  private createEmptyDetailedResult(resource: any): DetailedValidationResult {
    return {
      resourceType: resource?.resourceType || 'Unknown',
      resourceId: resource?.id ?? null,
      isValid: true,
      issues: [],
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        informationCount: 0,
        score: 100,
      },
      performance: {
        totalTimeMs: 0,
        aspectTimes: {},
      },
      validatedAt: new Date().toISOString(),
    };
  }

  private buildInsertValidationResult(
    resourceId: number,
    detailedResult: DetailedValidationResult,
    resourceHash: string,
    engineResult?: EngineValidationResult
  ): InsertValidationResult {
    const errorIssues = detailedResult.issues.filter(issue => this.isErrorSeverity(issue.severity));
    const warningIssues = detailedResult.issues.filter(issue => issue.severity === 'warning');

    return {
      resourceId,
      profileId: null,
      isValid: detailedResult.isValid,
      errors: errorIssues,
      warnings: warningIssues,
      issues: detailedResult.issues,
      errorCount: detailedResult.summary.errorCount,
      warningCount: detailedResult.summary.warningCount,
      validationScore: detailedResult.summary.score,
      validatedAt: new Date(detailedResult.validatedAt),
      resourceHash,
      performanceMetrics: detailedResult.performance,
      aspectBreakdown: this.buildAspectBreakdown(engineResult?.aspects),
      validationDurationMs: detailedResult.performance.totalTimeMs,
    };
  }

  private buildAspectBreakdown(aspects?: ValidationAspectResult[]): Record<string, any> {
    const baseline = ALL_VALIDATION_ASPECTS.reduce<Record<string, any>>((acc, aspect) => {
      const key = this.normalizeAspectKey(aspect) ?? aspect;
      acc[key] = {
        issueCount: 0,
        errorCount: 0,
        warningCount: 0,
        informationCount: 0,
        validationScore: 0,
        passed: false,
        enabled: false,
        status: 'skipped',
        reason: 'Aspect result unavailable',
        duration: 0,
        issues: []
      };
      return acc;
    }, {});

    if (!aspects || aspects.length === 0) {
      return baseline;
    }

    return aspects.reduce<Record<string, any>>((acc, aspect) => {
      const normalizedKey = this.normalizeAspectKey(aspect.aspect);
      if (!normalizedKey) {
        return acc;
      }

      const aspectIssues = this.normalizeIssues(aspect.issues || []);
      const errorCount = aspectIssues.filter(issue => this.isErrorSeverity(issue.severity)).length;
      const warningCount = aspectIssues.filter(issue => issue.severity === 'warning').length;
      const informationCount = aspectIssues.filter(issue => this.isInformationSeverity(issue.severity)).length;

      acc[normalizedKey] = {
        issueCount: aspectIssues.length,
        errorCount,
        warningCount,
        informationCount,
        validationScore: aspect.isValid ? 100 : 0,
        passed: aspect.isValid,
        enabled: aspect.status !== 'disabled',
        status: aspect.status ?? 'executed',
        reason: aspect.reason,
        duration: aspect.validationTime ?? 0,
        issues: aspectIssues
      };
      return acc;
    }, baseline);
  }

  private buildSummary(
    issues: DetailedValidationIssue[],
    isValid: boolean,
    existing?: Partial<ValidationSummary>
  ): ValidationSummary {
    const errorCount = existing?.errorCount ?? issues.filter(issue => this.isErrorSeverity(issue.severity)).length;
    const warningCount = existing?.warningCount ?? issues.filter(issue => issue.severity === 'warning').length;
    const informationCount = existing?.informationCount ?? issues.filter(issue => this.isInformationSeverity(issue.severity)).length;
    const totalIssues = existing?.totalIssues ?? issues.length;
    const score = existing?.score ?? (isValid ? 100 : 0);

    return {
      totalIssues,
      errorCount,
      warningCount,
      informationCount,
      score,
    };
  }

  private buildPerformanceSummaryFromEngine(result: EngineValidationResult): ValidationPerformanceSummary {
    const totalTimeMs = typeof result.validationTime === 'number' ? result.validationTime : 0;
    const aspectTimes = (result.aspects || []).reduce<Record<string, number>>((acc, aspect) => {
      const key = this.normalizeAspectKey(aspect.aspect);
      acc[key] = aspect.validationTime || 0;
      return acc;
    }, {});

    return {
      totalTimeMs,
      aspectTimes,
    };
  }

  private buildPerformanceSummaryFromStored(stored: StoredValidationResult): ValidationPerformanceSummary {
    const metrics = (stored.performanceMetrics || {}) as Record<string, any>;
    const totalTimeMs = typeof metrics.totalTimeMs === 'number'
      ? metrics.totalTimeMs
      : stored.validationDurationMs ?? 0;
    const aspectTimes = metrics.aspectTimes && typeof metrics.aspectTimes === 'object'
      ? metrics.aspectTimes
      : {};

    return {
      totalTimeMs,
      aspectTimes,
    };
  }

  private normalizeIssues(issues: Array<EngineValidationIssue | any>): DetailedValidationIssue[] {
    if (!Array.isArray(issues)) {
      return [];
    }

    return issues.map((issue, index) => {
      const severity = typeof issue.severity === 'string' ? issue.severity : 'info';
      const category = issue.category ?? this.mapAspectToCategory(issue.aspect);
      return {
        id: issue.id ?? `issue-${index}`,
        aspect: issue.aspect,
        severity,
        message: issue.message,
        path: issue.path,
        code: issue.code,
        details: issue.details,
        location: issue.location,
        humanReadable: issue.humanReadable,
        category,
      } as DetailedValidationIssue;
    });
  }

  private mapAspectToCategory(aspect?: string): string {
    if (!aspect) {
      return 'general';
    }

    const normalized = aspect.toLowerCase();
    if (normalized.includes('business')) {
      return 'business-rule';
    }
    if (normalized.includes('struct')) {
      return 'structural';
    }
    if (normalized.includes('terminology')) {
      return 'terminology';
    }
    if (normalized.includes('profile')) {
      return 'profile';
    }
    if (normalized.includes('reference')) {
      return 'reference';
    }
    if (normalized.includes('metadata')) {
      return 'metadata';
    }
    return this.normalizeAspectKey(normalized);
  }

  private normalizeAspectKey(aspect?: string): string {
    if (!aspect) {
      return 'general';
    }

    return aspect
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();
  }

  private getLatestStoredValidationResult(results: StoredValidationResult[]): StoredValidationResult | undefined {
    if (!Array.isArray(results) || results.length === 0) {
      return undefined;
    }

    return results
      .slice()
      .sort((a, b) => {
        const aTime = a.validatedAt ? new Date(a.validatedAt).getTime() : 0;
        const bTime = b.validatedAt ? new Date(b.validatedAt).getTime() : 0;
        return bTime - aTime;
      })[0];
  }

  private isErrorSeverity(severity?: string): boolean {
    return severity === 'error' || severity === 'fatal';
  }

  private isInformationSeverity(severity?: string): boolean {
    return severity === 'info';
  }

  /**
   * Check if resource needs revalidation
   */
  private shouldRevalidateResource(
    dbResource: FhirResourceWithValidation,
    forceRevalidation: boolean,
    skipUnchanged: boolean
  ): boolean {
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

    const latestValidation = this.getLatestStoredValidationResult(validationResults);
    if (!latestValidation?.validatedAt) {
      return true;
    }

    const validationAge = Date.now() - new Date(latestValidation.validatedAt).getTime();
    const maxAge = 60 * 60 * 1000; // 1 hour

    return validationAge > maxAge;
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
    const needsRevalidation = this.shouldRevalidateResource(
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
      const latest = this.getLatestStoredValidationResult(validationResults);
      if (latest) {
        detailedResult = this.buildDetailedResultFromStored(
          latest,
          resourceWithValidation.resourceType,
          resourceWithValidation.resourceId
        );
      } else {
        detailedResult = this.createEmptyDetailedResult(resourceWithValidation.data ?? {
          resourceType: resourceWithValidation.resourceType,
          id: resourceWithValidation.resourceId,
        });
      }
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
    const { forceRevalidation = false, skipUnchanged = true, maxConcurrency = 5 } = options;

    // Apply resource type filtering
    const resourceTypeFilteringService = getValidationResourceTypeFilteringService();
    await resourceTypeFilteringService.initialize();
    
    const { filtered: filteredResources, statistics: filterStatistics } = resourceTypeFilteringService.filterResources(resources);
    
    console.log(`[ConsolidatedValidation] Resource type filtering: ${filterStatistics.totalResources} total, ${filterStatistics.filteredResources} to validate, ${filterStatistics.totalResources - filterStatistics.filteredResources} filtered out`);

    // Get current validation settings to determine which aspects to run
    const currentSettings = await this.getCurrentSettings();
    if (!currentSettings) {
      throw new Error('Failed to load validation settings');
    }

    // Create validation requests for filtered resources only
    const validationRequests = filteredResources.map(resource => ({
      resource,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      profileUrl: undefined,
      settings: currentSettings, // Use current settings for each resource
    })) as any[];

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
      const results = [] as Array<{
        resource: any;
        validationResults: StoredValidationResult[];
        detailedResult: DetailedValidationResult;
        wasRevalidated: boolean;
      }>;
      let revalidated = 0;
      let cached = 0;
      let errors = 0;

      for (let i = 0; i < resources.length; i++) {
        const resource = resources[i];
        const validationResult = pipelineResult.results?.[i];

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

          let dbResource = resource.id
            ? await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id)
            : undefined;

          if (resource.id) {
            if (dbResource) {
              await storage.updateFhirResource(dbResource.id, resource);
            } else {
              dbResource = await storage.createFhirResource(resourceData);
            }
          }

          let storedResults: StoredValidationResult[] = [];
          let detailedResult: DetailedValidationResult;
          let wasResourceRevalidated = false;

          if (validationResult && dbResource?.id) {
            const detailed = this.buildDetailedResultFromEngine(
              validationResult,
              resource.resourceType,
              resource.id ?? null
            );
            const insertData = this.buildInsertValidationResult(
              dbResource.id,
              detailed,
              resourceData.resourceHash,
              validationResult
            );

            // Get active server ID for FHIR identity
            const activeServer = await storage.getActiveFhirServer();
            const serverId = activeServer?.id || 1;

            const savedResult = await storage.createValidationResultWithFhirIdentity(
              insertData,
              serverId,
              resource.resourceType,
              resource.id
            );
            await storage.updateFhirResourceLastValidated(dbResource.id, detailed.validatedAt);
            
            // Clear all cache entries to ensure fresh data
            cacheManager.clear();
            
            const refreshed = await storage.getFhirResourceById(dbResource.id);
            storedResults = refreshed?.validationResults || [savedResult];
            detailedResult = detailed;
            wasResourceRevalidated = true;
            revalidated++;
          } else if (validationResult) {
            detailedResult = this.buildDetailedResultFromEngine(
              validationResult,
              resource.resourceType,
              resource.id ?? null
            );
            wasResourceRevalidated = true;
            storedResults = [];
            revalidated++;
          } else {
            const refreshed = dbResource?.id ? await storage.getFhirResourceById(dbResource.id) : undefined;
            storedResults = refreshed?.validationResults || [];
            const latest = this.getLatestStoredValidationResult(storedResults);
            detailedResult = latest
              ? this.buildDetailedResultFromStored(latest, resource.resourceType, resource.id ?? null)
              : this.createEmptyDetailedResult(resource);
            cached++;
          }

          results.push({
            resource,
            validationResults: storedResults,
            detailedResult,
            wasRevalidated: wasResourceRevalidated,
          });

        } catch (error) {
          console.error(`[ConsolidatedValidation] Failed to process resource ${resource.id}:`, error);
          errors++;
          results.push({
            resource,
            validationResults: [],
            detailedResult: this.createEmptyDetailedResult(resource),
            wasRevalidated: false,
          });
        }
      }

      return {
        results,
        summary: {
          total: resources.length,
          revalidated,
          cached,
          errors,
          filtered: filterStatistics.totalResources - filterStatistics.filteredResources
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
