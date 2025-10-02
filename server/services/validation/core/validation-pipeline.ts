/**
 * Validation Pipeline - Unified Validation Orchestration
 * 
 * This service orchestrates the validation process using the validation
 * engine and centralized settings with improved modularity.
 */

import { EventEmitter } from 'events';
import { PipelineOrchestrator } from '../pipeline/pipeline-orchestrator';
import { BatchProcessor } from '../pipeline/batch-processor';
import { PipelineConfig } from '../pipeline/pipeline-config';
import { PipelineCalculator } from '../pipeline/pipeline-calculator';
import type { ValidationRequest, ValidationResult } from '../types/validation-types';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { 
  ValidationPipelineConfig, 
  ValidationPipelineRequest, 
  ValidationPipelineResult,
  ValidationProgress,
  PipelineStatus
} from '../pipeline/pipeline-types';

// ============================================================================
// Validation Pipeline Class
// ============================================================================

export class ValidationPipeline extends EventEmitter {
  private orchestrator: PipelineOrchestrator;
  private batchProcessor: BatchProcessor;
  private config: PipelineConfig;

  constructor(config: Partial<ValidationPipelineConfig> = {}) {
    super();
    
    // Initialize components
    this.config = new PipelineConfig(config);
    this.orchestrator = new PipelineOrchestrator(config);
    this.batchProcessor = new BatchProcessor(this.config.getConfig());

    // Setup event forwarding
    this.setupEventForwarding();
  }

  // ========================================================================
  // Main Pipeline Methods
  // ========================================================================

  /**
   * Execute validation pipeline
   */
  async executePipeline(request: ValidationPipelineRequest): Promise<ValidationPipelineResult> {
    return this.orchestrator.executePipeline(request);
  }

  /**
   * Get pipeline progress
   */
  getPipelineProgress(requestId: string): ValidationProgress | null {
    return this.orchestrator.getPipelineProgress(requestId);
  }

  /**
   * Cancel pipeline
   */
  async cancelPipeline(requestId: string): Promise<void> {
    return this.orchestrator.cancelPipeline(requestId);
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus(requestId: string): PipelineStatus {
    return this.orchestrator.getPipelineStatus(requestId);
  }

  // ========================================================================
  // Configuration Management
  // ========================================================================

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<ValidationPipelineConfig>): void {
    this.config.updateConfig(newConfig);
    this.orchestrator.updateConfig(newConfig);
    this.batchProcessor.updateConfig(newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): ValidationPipelineConfig {
    return this.config.getConfig();
  }

  /**
   * Get settings-aware configuration
   */
  async getSettingsAwareConfig(): Promise<ValidationPipelineConfig> {
    return this.config.getSettingsAwareConfig();
  }

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    this.config.resetToDefaults();
    const defaultConfig = this.config.getConfig();
    this.orchestrator.updateConfig(defaultConfig);
    this.batchProcessor.updateConfig(defaultConfig);
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear result cache
   */
  clearCache(): void {
    this.batchProcessor.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.batchProcessor.getCacheStats();
  }

  // ========================================================================
  // Pipeline Information
  // ========================================================================

  /**
   * Get active pipeline count
   */
  getActivePipelineCount(): number {
    return this.orchestrator.getActivePipelineCount();
  }

  /**
   * Get active pipeline IDs
   */
  getActivePipelineIds(): string[] {
    return this.orchestrator.getActivePipelineIds();
  }

  /**
   * Check if pipeline is active
   */
  isPipelineActive(requestId: string): boolean {
    return this.orchestrator.isPipelineActive(requestId);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Get configuration recommendations
   */
  getConfigRecommendations() {
    return this.config.getConfigRecommendations();
  }

  /**
   * Get configuration summary
   */
  getConfigSummary() {
    return this.config.getConfigSummary();
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    return this.config.exportConfig();
  }

  /**
   * Import configuration
   */
  importConfig(configJson: string): void {
    this.config.importConfig(configJson);
    const newConfig = this.config.getConfig();
    this.orchestrator.updateConfig(newConfig);
    this.batchProcessor.updateConfig(newConfig);
  }

  // ========================================================================
  // Event Forwarding
  // ========================================================================

  private setupEventForwarding(): void {
    // Forward orchestrator events
    this.orchestrator.on('pipelineStarted', (data) => {
      this.emit('pipelineStarted', data);
    });

    this.orchestrator.on('pipelineCompleted', (data) => {
      this.emit('pipelineCompleted', data);
    });

    this.orchestrator.on('pipelineFailed', (data) => {
      this.emit('pipelineFailed', data);
    });

    this.orchestrator.on('pipelineCancelled', (data) => {
      this.emit('pipelineCancelled', data);
    });

    // Forward batch processor events
    this.batchProcessor.on('resourceProcessed', (data) => {
      this.emit('resourceProcessed', data);
    });

    this.batchProcessor.on('progressUpdate', (data) => {
      this.emit('progressUpdate', data);
    });

    this.batchProcessor.on('resourceCached', (data) => {
      this.emit('resourceCached', data);
    });

    this.batchProcessor.on('cacheCleared', () => {
      this.emit('cacheCleared');
    });

    // Forward config events
    this.config.on('configUpdated', (data) => {
      this.emit('configUpdated', data);
    });

    this.config.on('configReset', (data) => {
      this.emit('configReset', data);
    });
  }

  // ========================================================================
  // Static Utility Methods
  // ========================================================================

  /**
   * Create empty pipeline summary
   */
  static createEmptySummary() {
    return PipelineCalculator.createEmptySummary();
  }

  /**
   * Create empty performance metrics
   */
  static createEmptyPerformance(startTime: number) {
    return PipelineCalculator.createEmptyPerformance(startTime);
  }

  /**
   * Calculate pipeline summary
   */
  static calculateSummary(results: ValidationResult[]) {
    return PipelineCalculator.calculatePipelineSummary(results);
  }

  /**
   * Calculate pipeline performance
   */
  static calculatePerformance(results: ValidationResult[], startTime: number) {
    return PipelineCalculator.calculatePipelinePerformance(results, startTime);
  }

  /**
   * Analyze performance bottlenecks
   */
  static analyzePerformance(results: ValidationResult[]) {
    return PipelineCalculator.analyzePerformanceBottlenecks(results);
  }

  /**
   * Calculate validation statistics
   */
  static calculateStats(results: ValidationResult[]) {
    return PipelineCalculator.calculateValidationStats(results);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let pipelineInstance: ValidationPipeline | null = null;

/**
 * Get validation pipeline instance (singleton)
 */
export function getValidationPipeline(): ValidationPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new ValidationPipeline();
  }
  return pipelineInstance;
}

/**
 * Create new validation pipeline instance
 */
export function createValidationPipeline(config?: Partial<ValidationPipelineConfig>): ValidationPipeline {
  return new ValidationPipeline(config);
}

/**
 * Reset pipeline instance (for testing)
 */
export function resetValidationPipeline(): void {
  pipelineInstance = null;
}

// ============================================================================
// Facade for Backward Compatibility
// ============================================================================

export class ValidationPipelineFacade {
  private pipeline: ValidationPipeline;

  constructor(config?: Partial<ValidationPipelineConfig>) {
    this.pipeline = new ValidationPipeline(config);
  }

  async executePipeline(request: ValidationPipelineRequest): Promise<ValidationPipelineResult> {
    return this.pipeline.executePipeline(request);
  }

  getPipelineProgress(requestId: string): ValidationProgress | null {
    return this.pipeline.getPipelineProgress(requestId);
  }

  async cancelPipeline(requestId: string): Promise<void> {
    return this.pipeline.cancelPipeline(requestId);
  }

  getPipelineStatus(requestId: string): PipelineStatus {
    return this.pipeline.getPipelineStatus(requestId);
  }

  updateConfig(newConfig: Partial<ValidationPipelineConfig>): void {
    this.pipeline.updateConfig(newConfig);
  }

  getConfig(): ValidationPipelineConfig {
    return this.pipeline.getConfig();
  }

  clearCache(): void {
    this.pipeline.clearCache();
  }

  getCacheStats() {
    return this.pipeline.getCacheStats();
  }

  getActivePipelineCount(): number {
    return this.pipeline.getActivePipelineCount();
  }

  getActivePipelineIds(): string[] {
    return this.pipeline.getActivePipelineIds();
  }

  isPipelineActive(requestId: string): boolean {
    return this.pipeline.isPipelineActive(requestId);
  }
}

/**
 * Get validation pipeline facade (singleton)
 */
export function getValidationPipelineFacade(): ValidationPipelineFacade {
  return new ValidationPipelineFacade();
}
