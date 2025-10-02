/**
 * Pipeline Types
 * 
 * Type definitions for the validation pipeline system.
 */

import type { ValidationRequest, ValidationResult } from '../types/validation-types';
import type { ValidationAspect } from '@shared/validation-settings-simplified';

// ============================================================================
// Configuration Types
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

// ============================================================================
// Request and Response Types
// ============================================================================

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

// ============================================================================
// Summary Types
// ============================================================================

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

// ============================================================================
// Performance Types
// ============================================================================

export interface PipelinePerformance {
  /** Total pipeline execution time in milliseconds */
  totalTimeMs: number;
  
  /** Average validation time per resource in milliseconds */
  averageValidationTimeMs: number;
  
  /** Fastest validation time in milliseconds */
  fastestValidationTimeMs: number;
  
  /** Slowest validation time in milliseconds */
  slowestValidationTimeMs: number;
  
  /** Throughput (resources per second) */
  throughput: number;
  
  /** Memory usage statistics */
  memoryUsage: MemoryUsage;
  
  /** Concurrency statistics */
  concurrency: ConcurrencyStats;
}

export interface MemoryUsage {
  /** Peak memory usage in MB */
  peakMemoryMB: number;
  
  /** Average memory usage in MB */
  averageMemoryMB: number;
  
  /** Final memory usage in MB */
  finalMemoryMB: number;
}

export interface ConcurrencyStats {
  /** Maximum concurrent validations configured */
  maxConcurrentValidations: number;
  
  /** Average concurrency during execution */
  averageConcurrency: number;
  
  /** Peak concurrency during execution */
  peakConcurrency: number;
}

// ============================================================================
// Timestamp Types
// ============================================================================

export interface PipelineTimestamps {
  /** When the pipeline started */
  startedAt: Date;
  
  /** When the pipeline completed (if successful) */
  completedAt?: Date;
  
  /** When the pipeline failed (if failed) */
  failedAt?: Date;
  
  /** When the pipeline was cancelled (if cancelled) */
  cancelledAt?: Date;
}

// ============================================================================
// Progress Types
// ============================================================================

export interface ValidationProgress {
  /** Request ID */
  requestId: string;
  
  /** Total number of resources */
  totalResources: number;
  
  /** Number of resources processed */
  processedResources: number;
  
  /** Number of valid resources */
  validResources: number;
  
  /** Number of resources with errors */
  errorResources: number;
  
  /** Progress percentage (0-100) */
  percentage: number;
  
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemainingMs?: number;
  
  /** Current processing rate (resources per second) */
  currentRate?: number;
  
  /** Start time */
  startTime: string;
  
  /** Last update time */
  lastUpdateTime: string;
}

// ============================================================================
// Event Types
// ============================================================================

export interface PipelineEvent {
  /** Event type */
  type: string;
  
  /** Request ID */
  requestId: string;
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Event data */
  data?: any;
}

export interface PipelineStartedEvent extends PipelineEvent {
  type: 'pipelineStarted';
  data: {
    totalResources: number;
    config: ValidationPipelineConfig;
  };
}

export interface PipelineCompletedEvent extends PipelineEvent {
  type: 'pipelineCompleted';
  data: {
    result: ValidationPipelineResult;
  };
}

export interface PipelineFailedEvent extends PipelineEvent {
  type: 'pipelineFailed';
  data: {
    error: string;
  };
}

export interface PipelineCancelledEvent extends PipelineEvent {
  type: 'pipelineCancelled';
  data: {};
}

export interface ResourceProcessedEvent extends PipelineEvent {
  type: 'resourceProcessed';
  data: {
    resource: {
      resourceType: string;
      resourceId: string;
    };
    result: ValidationResult;
  };
}

export interface ProgressUpdateEvent extends PipelineEvent {
  type: 'progressUpdate';
  data: {
    progress: {
      total: number;
      processed: number;
      valid: number;
      errors: number;
      percentage: number;
    };
  };
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  /** Cached result */
  result: ValidationResult;
  
  /** Cache timestamp */
  timestamp: Date;
  
  /** Cache key */
  key: string;
  
  /** Cache hit count */
  hitCount: number;
  
  /** Last access time */
  lastAccessed: Date;
}

export interface CacheStats {
  /** Total cache size */
  size: number;
  
  /** Cache hit rate (0-1) */
  hitRate: number;
  
  /** Oldest cache entry */
  oldestEntry: Date | null;
  
  /** Newest cache entry */
  newestEntry: Date | null;
  
  /** Total memory usage in MB */
  memoryUsageMB: number;
  
  /** Average entry size in bytes */
  averageEntrySizeBytes: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface PipelineError extends Error {
  /** Error code */
  code: string;
  
  /** Request ID */
  requestId: string;
  
  /** Error context */
  context?: Record<string, any>;
  
  /** Retry information */
  retryable?: boolean;
  
  /** Suggested retry delay in milliseconds */
  retryDelayMs?: number;
}

export interface ValidationError extends PipelineError {
  code: 'VALIDATION_ERROR';
  resourceId: string;
  resourceType: string;
}

export interface TimeoutError extends PipelineError {
  code: 'TIMEOUT_ERROR';
  timeoutMs: number;
}

export interface ConcurrencyError extends PipelineError {
  code: 'CONCURRENCY_ERROR';
  maxConcurrent: number;
  currentConcurrent: number;
}

export interface ConfigurationError extends PipelineError {
  code: 'CONFIGURATION_ERROR';
  configPath: string;
  expectedType: string;
  actualValue: any;
}

// ============================================================================
// Utility Types
// ============================================================================

export type PipelineEventType = 
  | 'pipelineStarted'
  | 'pipelineCompleted'
  | 'pipelineFailed'
  | 'pipelineCancelled'
  | 'resourceProcessed'
  | 'progressUpdate'
  | 'configUpdated'
  | 'cacheCleared';

export type PipelineStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'not_found';

export type ProcessingMode = 'parallel' | 'sequential';

export type CacheStrategy = 'lru' | 'ttl' | 'hybrid';

// ============================================================================
// Factory Types
// ============================================================================

export interface PipelineFactory {
  /** Create a new pipeline instance */
  createPipeline(config?: Partial<ValidationPipelineConfig>): ValidationPipeline;
  
  /** Get default configuration */
  getDefaultConfig(): ValidationPipelineConfig;
  
  /** Validate configuration */
  validateConfig(config: Partial<ValidationPipelineConfig>): boolean;
}

export interface ValidationPipeline {
  /** Execute pipeline */
  executePipeline(request: ValidationPipelineRequest): Promise<ValidationPipelineResult>;
  
  /** Get pipeline status */
  getPipelineStatus(requestId: string): PipelineStatus;
  
  /** Cancel pipeline */
  cancelPipeline(requestId: string): Promise<void>;
  
  /** Get pipeline progress */
  getPipelineProgress(requestId: string): ValidationProgress | null;
  
  /** Update configuration */
  updateConfig(config: Partial<ValidationPipelineConfig>): void;
  
  /** Get current configuration */
  getConfig(): ValidationPipelineConfig;
  
  /** Clear cache */
  clearCache(): void;
  
  /** Get cache statistics */
  getCacheStats(): CacheStats;
}
