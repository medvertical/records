/**
 * Validation Pipeline - Rock Solid Validation Orchestration
 * 
 * This service orchestrates the validation process using the rock-solid
 * validation engine and centralized settings.
 */

import { EventEmitter } from 'events';
import { getRockSolidValidationEngine, type ValidationRequest, type ValidationResult } from './rock-solid-validation-engine';
import { getValidationSettingsService } from './validation-settings-service';
import type { ValidationSettings, ValidationAspect } from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationPipelineConfig {
  /** Whether to enable parallel processing */
  enableParallelProcessing: boolean;
  
  /** Maximum number of concurrent validations */
  maxConcurrentValidations: number;
  
  /** Default timeout in milliseconds */
  defaultTimeoutMs: number;
  
  /** Whether to enable progress tracking */
  enableProgressTracking: boolean;
  
  /** Whether to enable result caching */
  enableResultCaching: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
}

export interface ValidationPipelineRequest {
  /** Resources to validate */
  resources: ValidationRequest[];
  
  /** Pipeline configuration */
  config?: Partial<ValidationPipelineConfig>;
  
  /** Request context */
  context?: {
    requestedBy?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  };
}

export interface ValidationPipelineResult {
  /** Pipeline request ID */
  requestId: string;
  
  /** Overall pipeline status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** Pipeline results */
  results: ValidationResult[];
  
  /** Pipeline summary */
  summary: PipelineSummary;
  
  /** Pipeline performance */
  performance: PipelinePerformance;
  
  /** Timestamps */
  timestamps: PipelineTimestamps;
  
  /** Error information */
  error?: string;
}

export interface PipelineSummary {
  /** Total number of resources processed */
  totalResources: number;
  
  /** Number of successfully validated resources */
  successfulValidations: number;
  
  /** Number of failed validations */
  failedValidations: number;
  
  /** Number of resources with errors */
  resourcesWithErrors: number;
  
  /** Number of resources with warnings */
  resourcesWithWarnings: number;
  
  /** Overall validation score */
  overallValidationScore: number;
  
  /** Issues by aspect */
  issuesByAspect: Record<ValidationAspect, number>;
  
  /** Most common issues */
  commonIssues: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}

export interface PipelinePerformance {
  /** Total pipeline execution time */
  totalTimeMs: number;
  
  /** Average validation time per resource */
  averageValidationTimeMs: number;
  
  /** Fastest validation time */
  fastestValidationTimeMs: number;
  
  /** Slowest validation time */
  slowestValidationTimeMs: number;
  
  /** Throughput (resources per second) */
  throughput: number;
  
  /** Memory usage */
  memoryUsage: {
    peak: number;
    average: number;
    current: number;
  };
}

export interface PipelineTimestamps {
  /** When the pipeline started */
  startedAt: Date;
  
  /** When the pipeline completed */
  completedAt?: Date;
  
  /** When the pipeline failed */
  failedAt?: Date;
  
  /** When the pipeline was cancelled */
  cancelledAt?: Date;
}

export interface ValidationProgress {
  /** Pipeline request ID */
  requestId: string;
  
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Current resource being processed */
  currentResource?: {
    resourceType: string;
    resourceId?: string;
    index: number;
    total: number;
  };
  
  /** Resources completed */
  completed: number;
  
  /** Resources remaining */
  remaining: number;
  
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemainingMs?: number;
  
  /** Current throughput */
  currentThroughput: number;
}

// ============================================================================
// Validation Pipeline
// ============================================================================

export class ValidationPipeline extends EventEmitter {
  private engine = getRockSolidValidationEngine();
  private settingsService = getValidationSettingsService();
  private config: ValidationPipelineConfig;
  private activePipelines = new Map<string, Promise<ValidationPipelineResult>>();
  private resultCache = new Map<string, { result: ValidationResult; timestamp: Date }>();

  constructor(config: Partial<ValidationPipelineConfig> = {}) {
    super();
    
    this.config = {
      enableParallelProcessing: true,
      maxConcurrentValidations: 10,
      defaultTimeoutMs: 300000, // 5 minutes
      enableProgressTracking: true,
      enableResultCaching: true,
      cacheTtlMs: 300000, // 5 minutes
      ...config
    };

    // Reconfigure on settings changes
    this.setupSettingsListeners();
  }

  // ========================================================================
  // Main Pipeline Methods
  // ========================================================================

  /**
   * Execute validation pipeline
   */
  async executePipeline(request: ValidationPipelineRequest): Promise<ValidationPipelineResult> {
    const requestId = request.context?.requestId || `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check for concurrent pipeline limit
    if (this.activePipelines.size >= this.config.maxConcurrentValidations) {
      throw new Error('Maximum concurrent pipelines reached');
    }

    // Create pipeline promise
    const pipelinePromise = this.performPipeline(request, requestId);
    this.activePipelines.set(requestId, pipelinePromise);

    try {
      const result = await pipelinePromise;
      this.emit('pipelineCompleted', { requestId, result });
      return result;
    } catch (error) {
      this.emit('pipelineFailed', { requestId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      this.activePipelines.delete(requestId);
    }
  }

  /**
   * Get pipeline progress
   */
  getPipelineProgress(requestId: string): ValidationProgress | null {
    // This would track progress for active pipelines
    // For now, return null as we don't have real-time progress tracking
    return null;
  }

  /**
   * Cancel pipeline
   */
  async cancelPipeline(requestId: string): Promise<void> {
    const pipeline = this.activePipelines.get(requestId);
    if (pipeline) {
      // Cancel the pipeline
      this.emit('pipelineCancelled', { requestId });
      this.activePipelines.delete(requestId);
    }
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus(requestId: string): 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'not_found' {
    if (this.activePipelines.has(requestId)) {
      return 'running';
    }
    
    // Check cache for completed pipelines
    // This would need to be implemented with persistent storage
    return 'not_found';
  }

  // ========================================================================
  // Pipeline Execution
  // ========================================================================

  private async performPipeline(
    request: ValidationPipelineRequest,
    requestId: string
  ): Promise<ValidationPipelineResult> {
    const startTime = Date.now();
    const timestamps: PipelineTimestamps = {
      startedAt: new Date()
    };

    try {
      // Get validation settings
      const settings = await this.settingsService.getActiveSettings();
      
      // Initialize progress stats
      const totalResourcesPlanned = request.resources.length;
      const progressStats = {
        totalResources: totalResourcesPlanned,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
        startTime: new Date(timestamps.startedAt).toISOString()
      };
      
      // Process resources
      const results = await this.processResources(request.resources, settings, requestId, progressStats);
      
      // Calculate summary
      const summary = this.calculatePipelineSummary(results);
      
      // Calculate performance metrics
      const performance = this.calculatePipelinePerformance(results, startTime);
      
      // Update timestamps
      timestamps.completedAt = new Date();

      const pipelineResult: ValidationPipelineResult = {
        requestId,
        status: 'completed',
        results,
        summary,
        performance,
        timestamps
      };

      this.emit('pipelineCompleted', { requestId, result: pipelineResult });
      return pipelineResult;

    } catch (error) {
      timestamps.failedAt = new Date();
      
      const pipelineResult: ValidationPipelineResult = {
        requestId,
        status: 'failed',
        results: [],
        summary: this.createEmptySummary(),
        performance: this.createEmptyPerformance(startTime),
        timestamps,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('pipelineFailed', { requestId, error: pipelineResult.error });
      return pipelineResult;
    }
  }

  private async processResources(
    resources: ValidationRequest[],
    settings: ValidationSettings,
    requestId: string,
    progressStats?: {
      totalResources: number;
      processedResources: number;
      validResources: number;
      errorResources: number;
      startTime: string;
    }
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    const emitProgress = (result?: ValidationResult) => {
      if (!this.config.enableProgressTracking || !progressStats) return;
      if (result) {
        progressStats.processedResources += 1;
        if (result.isValid) progressStats.validResources += 1;
        if (!result.isValid || result.summary.errorCount > 0) progressStats.errorResources += 1;
      }
      this.emit('pipelineProgress', {
        requestId,
        totalResources: progressStats.totalResources,
        processedResources: progressStats.processedResources,
        validResources: progressStats.validResources,
        errorResources: progressStats.errorResources,
        startTime: progressStats.startTime,
        isComplete: progressStats.processedResources >= progressStats.totalResources,
        status: progressStats.processedResources >= progressStats.totalResources ? 'completed' : 'running'
      });
    };
    
    if (this.config.enableParallelProcessing) {
      // Parallel processing
      const chunks = this.chunkArray(resources, this.config.maxConcurrentValidations);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(resource => this.processResource(resource, settings, requestId));
        const chunkResults = await Promise.all(chunkPromises);
        for (const r of chunkResults) {
          results.push(r);
          emitProgress(r);
        }
      }
    } else {
      // Sequential processing
      for (const resource of resources) {
        const result = await this.processResource(resource, settings, requestId);
        results.push(result);
        emitProgress(result);
      }
    }
    
    return results;
  }

  private async processResource(
    resource: ValidationRequest,
    settings: ValidationSettings,
    requestId: string
  ): Promise<ValidationResult> {
    // Check cache first
    if (this.config.enableResultCaching) {
      const cacheKey = this.generateCacheKey(resource);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const timeoutMs = this.resolveTimeoutMs(settings);

    // Validate resource with timeout
    const validationPromise = this.engine.validateResource(resource);
    const timed = new Promise<ValidationResult>((resolve, reject) => {
      const to = setTimeout(() => {
        reject(new Error('PIPELINE_TIMEOUT'));
      }, timeoutMs);
      validationPromise.then(res => { clearTimeout(to); resolve(res); }).catch(err => { clearTimeout(to); reject(err); });
    });

    let result: ValidationResult;
    try {
      result = await timed;
    } catch (error) {
      // Build a timeout/error result
      const now = new Date();
      result = {
        isValid: false,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        profileUrl: resource.profileUrl,
        issues: [{
          severity: 'error',
          code: error instanceof Error && error.message === 'PIPELINE_TIMEOUT' ? 'PIPELINE_TIMEOUT' : 'PIPELINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown pipeline error',
          location: [],
          humanReadable: 'Validation failed in pipeline',
          aspect: 'structural'
        }],
        summary: {
          totalIssues: 1,
          errorCount: 1,
          warningCount: 0,
          informationCount: 0,
          validationScore: 0,
          passed: false,
          issuesByAspect: {
            structural: 1,
            profile: 0,
            terminology: 0,
            reference: 0,
            businessRule: 0,
            metadata: 0
          }
        },
        performance: {
          totalTimeMs: this.config.defaultTimeoutMs,
          aspectTimes: {
            structural: this.config.defaultTimeoutMs,
            profile: 0,
            terminology: 0,
            reference: 0,
            businessRule: 0,
            metadata: 0
          },
          structuralTimeMs: this.config.defaultTimeoutMs,
          profileTimeMs: 0,
          terminologyTimeMs: 0,
          referenceTimeMs: 0,
          businessRuleTimeMs: 0,
          metadataTimeMs: 0
        },
        validatedAt: now,
        settingsUsed: settings,
        context: resource.context
      };
    }
    
    // Cache result
    if (this.config.enableResultCaching) {
      const cacheKey = this.generateCacheKey(resource);
      this.setCachedResult(cacheKey, result);
    }

    // Emit progress event
    this.emit('resourceProcessed', {
      requestId,
      resource: {
        resourceType: resource.resourceType,
        resourceId: resource.resourceId
      },
      result
    });

    return result;
  }

  // ========================================================================
  // Summary and Performance Calculation
  // ========================================================================

  private calculatePipelineSummary(results: ValidationResult[]): PipelineSummary {
    const totalResources = results.length;
    const successfulValidations = results.filter(r => r.isValid).length;
    const failedValidations = results.filter(r => !r.isValid).length;
    const resourcesWithErrors = results.filter(r => r.summary.errorCount > 0).length;
    const resourcesWithWarnings = results.filter(r => r.summary.warningCount > 0).length;
    
    const overallValidationScore = results.length > 0 
      ? results.reduce((sum, r) => sum + r.summary.validationScore, 0) / results.length
      : 100;

    // Calculate issues by aspect
    const issuesByAspect: Record<ValidationAspect, number> = {
      structural: 0,
      profile: 0,
      terminology: 0,
      reference: 0,
      businessRule: 0,
      metadata: 0
    };

    for (const result of results) {
      for (const [aspect, count] of Object.entries(result.summary.issuesByAspect)) {
        issuesByAspect[aspect as ValidationAspect] += count;
      }
    }

    // Calculate common issues
    const issueCounts = new Map<string, { code: string; message: string; count: number }>();
    
    for (const result of results) {
      for (const issue of result.issues) {
        const key = `${issue.code}:${issue.message}`;
        const existing = issueCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          issueCounts.set(key, {
            code: issue.code,
            message: issue.message,
            count: 1
          });
        }
      }
    }

    const commonIssues = Array.from(issueCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalResources,
      successfulValidations,
      failedValidations,
      resourcesWithErrors,
      resourcesWithWarnings,
      overallValidationScore,
      issuesByAspect,
      commonIssues
    };
  }

  private calculatePipelinePerformance(results: ValidationResult[], startTime: number): PipelinePerformance {
    const totalTimeMs = Date.now() - startTime;
    const validationTimes = results.map(r => r.performance.totalTimeMs);
    
    const averageValidationTimeMs = validationTimes.length > 0
      ? validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length
      : 0;
    
    const fastestValidationTimeMs = validationTimes.length > 0 ? Math.min(...validationTimes) : 0;
    const slowestValidationTimeMs = validationTimes.length > 0 ? Math.max(...validationTimes) : 0;
    
    const throughput = totalTimeMs > 0 ? (results.length / totalTimeMs) * 1000 : 0;

    return {
      totalTimeMs,
      averageValidationTimeMs,
      fastestValidationTimeMs,
      slowestValidationTimeMs,
      throughput,
      memoryUsage: {
        peak: 0, // Would need memory monitoring
        average: 0,
        current: 0
      }
    };
  }

  private createEmptySummary(): PipelineSummary {
    return {
      totalResources: 0,
      successfulValidations: 0,
      failedValidations: 0,
      resourcesWithErrors: 0,
      resourcesWithWarnings: 0,
      overallValidationScore: 100,
      issuesByAspect: {
        structural: 0,
        profile: 0,
        terminology: 0,
        reference: 0,
        businessRule: 0,
        metadata: 0
      },
      commonIssues: []
    };
  }

  private createEmptyPerformance(startTime: number): PipelinePerformance {
    return {
      totalTimeMs: Date.now() - startTime,
      averageValidationTimeMs: 0,
      fastestValidationTimeMs: 0,
      slowestValidationTimeMs: 0,
      throughput: 0,
      memoryUsage: {
        peak: 0,
        average: 0,
        current: 0
      }
    };
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  private generateCacheKey(resource: ValidationRequest): string {
    // Generate a cache key based on resource content and settings
    const resourceHash = this.hashObject(resource.resource);
    const settingsHash = this.hashObject(resource.context);
    return `${resourceHash}_${settingsHash}`;
  }

  private getCachedResult(cacheKey: string): ValidationResult | null {
    const cached = this.resultCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.config.cacheTtlMs) {
      this.resultCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  private setCachedResult(cacheKey: string, result: ValidationResult): void {
    this.resultCache.set(cacheKey, {
      result,
      timestamp: new Date()
    });
  }

  private hashObject(obj: any): string {
    // Simple hash function for objects
    const jsonString = JSON.stringify(obj);
    if (typeof jsonString !== 'string') return 0;
    return jsonString.split('').reduce((hash, char) => {
      const code = char.charCodeAt(0);
      hash = ((hash << 5) - hash) + code;
      return hash & hash;
    }, 0).toString(36);
  }

  private resolveTimeoutMs(settings: ValidationSettings): number {
    const settingsTimeout = (settings as any)?.timeoutSettings?.defaultTimeoutMs;
    return typeof settingsTimeout === 'number' && settingsTimeout > 0 ? settingsTimeout : this.config.defaultTimeoutMs;
  }

  private setupSettingsListeners(): void {
    const apply = async () => {
      try {
        const settings = await this.settingsService.getActiveSettings();
        this.applySettingsToConfig(settings);
        this.clearCache();
        this.emit('settingsApplied');
      } catch (error) {
        // Non-fatal
      }
    };

    this.settingsService.on('settingsChanged', apply);
    this.settingsService.on('settingsActivated', apply);
  }

  private applySettingsToConfig(settings: ValidationSettings): void {
    // Concurrency
    if (typeof settings.maxConcurrentValidations === 'number' && settings.maxConcurrentValidations > 0) {
      this.config.maxConcurrentValidations = settings.maxConcurrentValidations;
    }
    // Cache controls
    const cache = (settings as any)?.cacheSettings;
    if (cache) {
      this.config.enableResultCaching = Boolean(cache.enabled);
      if (typeof cache.ttlMs === 'number' && cache.ttlMs > 0) {
        this.config.cacheTtlMs = cache.ttlMs;
      }
    }
    // Timeouts
    const timeouts = (settings as any)?.timeoutSettings;
    if (timeouts && typeof timeouts.defaultTimeoutMs === 'number' && timeouts.defaultTimeoutMs > 0) {
      this.config.defaultTimeoutMs = timeouts.defaultTimeoutMs;
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Clear result cache
   */
  clearCache(): void {
    this.resultCache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      key: string;
      timestamp: Date;
      age: number;
    }>;
  } {
    const now = Date.now();
    return {
      size: this.resultCache.size,
      entries: Array.from(this.resultCache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        age: now - entry.timestamp.getTime()
      }))
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let pipelineInstance: ValidationPipeline | null = null;

/**
 * Get the singleton instance of ValidationPipeline
 */
export function getValidationPipeline(): ValidationPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new ValidationPipeline();
  }
  return pipelineInstance;
}

// ============================================================================
// Facade for DI/Testing
// ============================================================================

export type ValidationPipelineFacade = {
  execute: (resources: ValidationRequest[], context?: ValidationPipelineRequest['context']) => Promise<ValidationPipelineResult>;
  onProgress: (listener: (evt: {
    requestId: string;
    totalResources: number;
    processedResources: number;
    validResources: number;
    errorResources: number;
    startTime: string;
    isComplete: boolean;
    status: string;
  }) => void) => () => void;
  cancel: (requestId: string) => Promise<void>;
  status: (requestId: string) => ReturnType<ValidationPipeline['getPipelineStatus']>;
  clearCache: () => void;
  getCacheStats: () => ReturnType<ValidationPipeline['getCacheStats']>;
};

export function getValidationPipelineFacade(): ValidationPipelineFacade {
  const pipeline = getValidationPipeline();
  return {
    execute: (resources, context) => pipeline.executePipeline({ resources, context }),
    onProgress: (listener) => {
      const handler = (evt: any) => listener(evt);
      pipeline.on('pipelineProgress', handler);
      return () => pipeline.off('pipelineProgress', handler as any);
    },
    cancel: (requestId) => pipeline.cancelPipeline(requestId),
    status: (requestId) => pipeline.getPipelineStatus(requestId),
    clearCache: () => pipeline.clearCache(),
    getCacheStats: () => pipeline.getCacheStats()
  };
}
