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
      
      // Process resources
      const results = await this.processResources(request.resources, settings, requestId);
      
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
    requestId: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    if (this.config.enableParallelProcessing) {
      // Parallel processing
      const chunks = this.chunkArray(resources, this.config.maxConcurrentValidations);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(resource => this.processResource(resource, settings, requestId));
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      }
    } else {
      // Sequential processing
      for (const resource of resources) {
        const result = await this.processResource(resource, settings, requestId);
        results.push(result);
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

    // Validate resource
    const result = await this.engine.validateResource(resource);
    
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
    return JSON.stringify(obj).split('').reduce((hash, char) => {
      const code = char.charCodeAt(0);
      hash = ((hash << 5) - hash) + code;
      return hash & hash;
    }, 0).toString(36);
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
