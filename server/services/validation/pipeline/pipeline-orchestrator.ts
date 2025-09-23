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
        settings = await this.settingsService.getActiveSettings();
      } catch (error) {
        console.warn('[ValidationPipeline] Failed to load settings, using defaults:', error instanceof Error ? error.message : error);
        // Use default settings when database is unavailable
        settings = {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'warning' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' },
          maxConcurrentValidations: 5,
          profileResolutionServers: [],
          terminologyServers: [],
          customRules: []
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
      
      // Process resources (this will be handled by the batch processor)
      const results: ValidationResult[] = [];
      
      // Emit pipeline started event
      this.emit('pipelineStarted', { 
        requestId, 
        totalResources: totalResourcesPlanned,
        config: this.config
      });

      // Update timestamps
      timestamps.completedAt = new Date();

      const pipelineResult: ValidationPipelineResult = {
        requestId,
        status: 'completed',
        results,
        summary: this.createEmptySummary(),
        performance: this.createEmptyPerformance(startTime),
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
