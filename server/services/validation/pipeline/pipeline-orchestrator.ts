/**
 * Pipeline Orchestrator
 * 
 * Handles the main pipeline execution, coordination, and lifecycle management.
 */

import { EventEmitter } from 'events';
import { getValidationEngine } from '../core/validation-engine';
import { getValidationSettingsService } from '../settings/validation-settings-service';
import type { ValidationRequest, ValidationResult } from '../types/validation-types';
import type { ValidationSettings } from '@shared/validation-settings';
import { ValidationPipelineConfig, ValidationPipelineRequest, ValidationPipelineResult, PipelineTimestamps } from './pipeline-types';

// ============================================================================
// Pipeline Orchestrator Class
// ============================================================================

export class PipelineOrchestrator extends EventEmitter {
  private engine = getValidationEngine();
  private settingsService = getValidationSettingsService();
  private config: ValidationPipelineConfig;
  private activePipelines = new Map<string, Promise<ValidationPipelineResult>>();

  constructor(config: Partial<ValidationPipelineConfig> = {}) {
    super();
    
    console.log('[PipelineOrchestrator] Constructor called');
    
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
    
    console.log(`[PipelineOrchestrator] executePipeline called with requestId: ${requestId}`);
    console.log(`[PipelineOrchestrator] Resources to process: ${request.resources.length}`);
    
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
  getPipelineProgress(requestId: string): any | null {
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
      // Get validation settings with fallback
      let settings: ValidationSettings;
      try {
        settings = await this.settingsService.getCurrentSettings();
      } catch (error) {
        console.warn('[ValidationPipeline] Failed to load settings, using defaults:', error instanceof Error ? error.message : error);
        // Use default settings when database is unavailable
        settings = {
          aspects: {
            structural: { enabled: true, severity: 'error' },
            profile: { enabled: true, severity: 'warning' },
            terminology: { enabled: true, severity: 'warning' },
            reference: { enabled: true, severity: 'error' },
            businessRules: { enabled: true, severity: 'error' },
            metadata: { enabled: true, severity: 'error' }
          },
          performance: {
            maxConcurrent: 5,
            batchSize: 50
          },
          resourceTypes: {
            enabled: true,
            includedTypes: [],
            excludedTypes: []
          }
        };
      }
      
      // Initialize progress stats
      const totalResourcesPlanned = request.resources.length;
      const progressStats = {
        totalResources: totalResourcesPlanned,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
        startTime: new Date(timestamps.startedAt).toISOString()
      };
      
      // Process resources using the validation engine
      const results: ValidationResult[] = [];
      
      // Emit pipeline started event
      this.emit('pipelineStarted', { 
        requestId, 
        totalResources: totalResourcesPlanned,
        config: this.config
      });

      // Process each resource
      for (const resourceRequest of request.resources) {
        try {
          console.log(`[PipelineOrchestrator] Processing resource: ${resourceRequest.resourceType}/${resourceRequest.resourceId}`);
          
          // Convert to validation request format
          const validationRequest: ValidationRequest = {
            resource: resourceRequest.resource,
            resourceType: resourceRequest.resourceType,
            profileUrl: resourceRequest.profileUrl,
            settings: resourceRequest.settings || settings // Use resource-specific settings if available, fallback to global settings
          };

          // Validate the resource
          const result = await this.engine.validateResource(validationRequest);
          results.push(result);
          
          progressStats.processedResources++;
          if (result.isValid) {
            progressStats.validResources++;
          } else {
            progressStats.errorResources++;
          }
          
          console.log(`[PipelineOrchestrator] Completed validation for ${resourceRequest.resourceType}/${resourceRequest.resourceId}: ${result.isValid ? 'valid' : 'invalid'}`);
        } catch (error) {
          console.error(`[PipelineOrchestrator] Failed to validate resource ${resourceRequest.resourceType}/${resourceRequest.resourceId}:`, error);
          progressStats.errorResources++;
          
          // Create error result
          const errorResult: ValidationResult = {
            resourceType: resourceRequest.resourceType,
            resourceId: resourceRequest.resourceId,
            isValid: false,
            issues: [{
              severity: 'error',
              code: 'validation-error',
              message: error instanceof Error ? error.message : 'Unknown validation error',
              path: '',
              details: {}
            }],
            summary: {
              score: 0,
              totalIssues: 1,
              errorCount: 1,
              warningCount: 0,
              informationCount: 0
            },
            validatedAt: new Date(),
            performance: {
              totalTimeMs: 0,
              validationTimeMs: 0,
              cacheHit: false
            }
          };
          results.push(errorResult);
        }
      }

      // Update timestamps
      timestamps.completedAt = new Date();

      const pipelineResult: ValidationPipelineResult = {
        requestId,
        status: 'completed',
        results,
        summary: this.createSummaryFromResults(results),
        performance: this.createPerformanceFromResults(results, startTime),
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

  // ========================================================================
  // Settings Management
  // ========================================================================

  private setupSettingsListeners(): void {
    // Listen for settings changes and reconfigure
    this.settingsService.on('settingsUpdated', (newSettings) => {
      this.emit('pipelineReconfigured', { settings: newSettings });
    });
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<ValidationPipelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('pipelineConfigUpdated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): ValidationPipelineConfig {
    return { ...this.config };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private createEmptySummary() {
    return {
      totalResources: 0,
      successfulValidations: 0,
      failedValidations: 0,
      resourcesWithErrors: 0,
      resourcesWithWarnings: 0,
      overallValidationScore: 0,
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

  private createEmptyPerformance(startTime: number) {
    return {
      totalTimeMs: Date.now() - startTime,
      averageValidationTimeMs: 0,
      fastestValidationTimeMs: 0,
      slowestValidationTimeMs: 0,
      throughput: 0,
      memoryUsage: {
        peakMemoryMB: 0,
        averageMemoryMB: 0,
        finalMemoryMB: 0
      },
      concurrency: {
        maxConcurrentValidations: this.config.maxConcurrentValidations,
        averageConcurrency: 0,
        peakConcurrency: 0
      }
    };
  }

  private createSummaryFromResults(results: ValidationResult[]) {
    const totalResources = results.length;
    const successfulValidations = results.filter(r => r.isValid).length;
    const failedValidations = totalResources - successfulValidations;
    
    let totalIssues = 0;
    let errorCount = 0;
    let warningCount = 0;
    let informationCount = 0;
    
    results.forEach(result => {
      if (result.issues) {
        totalIssues += result.issues.length;
        errorCount += result.issues.filter(i => i.severity === 'error' || i.severity === 'fatal').length;
        warningCount += result.issues.filter(i => i.severity === 'warning').length;
        informationCount += result.issues.filter(i => i.severity === 'info').length;
      }
    });
    
    const overallValidationScore = totalResources > 0 ? Math.round((successfulValidations / totalResources) * 100) : 0;
    
    return {
      totalResources,
      successfulValidations,
      failedValidations,
      resourcesWithErrors: results.filter(r => r.issues?.some(i => i.severity === 'error' || i.severity === 'fatal')).length,
      resourcesWithWarnings: results.filter(r => r.issues?.some(i => i.severity === 'warning')).length,
      overallValidationScore,
      issuesByAspect: {
        structural: 0, // TODO: categorize issues by aspect
        profile: 0,
        terminology: 0,
        reference: 0,
        businessRule: 0,
        metadata: 0
      },
      commonIssues: [] // TODO: analyze common issues
    };
  }

  private createPerformanceFromResults(results: ValidationResult[], startTime: number) {
    const totalTimeMs = Date.now() - startTime;
    const averageTimePerResourceMs = results.length > 0 ? totalTimeMs / results.length : 0;
    
    let totalValidationTime = 0;
    let cacheHits = 0;
    
    results.forEach(result => {
      if (result.performance) {
        totalValidationTime += result.performance.validationTimeMs || 0;
        if (result.performance.cacheHit) {
          cacheHits++;
        }
      }
    });
    
    const cacheHitRate = results.length > 0 ? (cacheHits / results.length) * 100 : 0;
    const throughput = totalTimeMs > 0 ? (results.length / totalTimeMs) * 1000 : 0; // resources per second
    
    return {
      totalTimeMs,
      averageTimePerResourceMs,
      validationTimeMs: totalValidationTime,
      cacheHitRate,
      memoryUsageMB: 0, // TODO: implement memory tracking
      throughput
    };
  }

  /**
   * Get active pipeline count
   */
  getActivePipelineCount(): number {
    return this.activePipelines.size;
  }

  /**
   * Get active pipeline IDs
   */
  getActivePipelineIds(): string[] {
    return Array.from(this.activePipelines.keys());
  }

  /**
   * Check if pipeline is active
   */
  isPipelineActive(requestId: string): boolean {
    return this.activePipelines.has(requestId);
  }
}
