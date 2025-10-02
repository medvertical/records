/**
 * Batch Processor
 * 
 * Handles batch processing of validation requests with parallel and sequential processing options.
 */

import { EventEmitter } from 'events';
import { getValidationEngine } from '../core/validation-engine';
import type { ValidationRequest, ValidationResult } from '../types/validation-types';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { ValidationPipelineConfig } from './pipeline-types';

// ============================================================================
// Batch Processor Class
// ============================================================================

export class BatchProcessor extends EventEmitter {
  private engine = getValidationEngine();
  private config: ValidationPipelineConfig;
  private resultCache = new Map<string, { result: ValidationResult; timestamp: Date }>();

  constructor(config: ValidationPipelineConfig) {
    super();
    this.config = config;
  }

  // ========================================================================
  // Batch Processing Methods
  // ========================================================================

  /**
   * Process multiple resources in batch
   */
  async processResources(
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
        progressStats.processedResources++;
        if (result.isValid) {
          progressStats.validResources++;
        } else {
          progressStats.errorResources++;
        }
      }
      
      this.emit('progressUpdate', {
        requestId,
        progress: {
          total: progressStats.totalResources,
          processed: progressStats.processedResources,
          valid: progressStats.validResources,
          errors: progressStats.errorResources,
          percentage: Math.round((progressStats.processedResources / progressStats.totalResources) * 100)
        }
      });
    };

    if (this.config.enableParallelProcessing) {
      // Parallel processing with concurrency limit
      const concurrencyLimit = Math.min(
        this.config.maxConcurrentValidations,
        resources.length
      );
      
      const chunks = this.chunkArray(resources, concurrencyLimit);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(resource => 
          this.processResource(resource, settings, requestId)
        );
        
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
        
        // Emit progress for each result
        chunkResults.forEach(emitProgress);
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

  /**
   * Process a single resource
   */
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
        this.emit('resourceCached', { requestId, resource, result: cached });
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
      result = this.createErrorResult(resource, error, settings);
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
  // Caching Methods
  // ========================================================================

  private generateCacheKey(resource: ValidationRequest): string {
    // Create a cache key based on resource content and settings
    const resourceKey = `${resource.resourceType}:${resource.resourceId}:${JSON.stringify(resource.resource)}`;
    return Buffer.from(resourceKey).toString('base64');
  }

  private getCachedResult(cacheKey: string): ValidationResult | null {
    const cached = this.resultCache.get(cacheKey);
    if (!cached) return null;

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

    // Clean up old cache entries periodically
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.resultCache.entries()) {
      const age = now - cached.timestamp.getTime();
      if (age > this.config.cacheTtlMs) {
        this.resultCache.delete(key);
      }
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private resolveTimeoutMs(settings: ValidationSettings): number {
    // Use settings timeout if available, otherwise use config default
    return settings.timeoutMs || this.config.defaultTimeoutMs;
  }

  private createErrorResult(
    resource: ValidationRequest, 
    error: unknown, 
    settings: ValidationSettings
  ): ValidationResult {
    const now = new Date();
    const isTimeout = error instanceof Error && error.message === 'PIPELINE_TIMEOUT';
    
    return {
      isValid: false,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      profileUrl: resource.profileUrl,
      issues: [{
        severity: 'error',
        code: isTimeout ? 'PIPELINE_TIMEOUT' : 'PIPELINE_ERROR',
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

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear all cached results
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
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    if (this.resultCache.size === 0) {
      return {
        size: 0,
        hitRate: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }

    const entries = Array.from(this.resultCache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.resultCache.size,
      hitRate: 0, // This would need to be tracked separately
      oldestEntry: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      newestEntry: new Date(Math.max(...timestamps.map(t => t.getTime())))
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ValidationPipelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { config: this.config });
  }
}
