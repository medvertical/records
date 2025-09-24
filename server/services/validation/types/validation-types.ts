/**
 * Shared Validation Types
 * 
 * This file contains all shared type definitions for the validation system.
 * These types are used across all validation components to ensure consistency.
 */

import type { ValidationSettings, ValidationAspect, ValidationSeverity } from '@shared/validation-settings';

// Canonical list of validation aspects used across engine, pipeline, and UI
export const ALL_VALIDATION_ASPECTS: ValidationAspect[] = [
  'structural',
  'profile',
  'terminology',
  'reference',
  'businessRule',
  'metadata'
];

export type ValidationAspectExecutionStatus = 'executed' | 'skipped' | 'disabled' | 'failed';

// ============================================================================
// Core Validation Types
// ============================================================================

export interface ValidationRequest {
  resource: any;
  resourceType: string;
  profileUrl?: string;
  aspects?: ValidationAspect[];
  settings?: ValidationSettings;
}

export interface ValidationResult {
  resourceId: string;
  resourceType: string;
  isValid: boolean;
  issues: ValidationIssue[];
  aspects: ValidationAspectResult[];
  validatedAt: Date;
  validationTime: number;
}

export interface ValidationIssue {
  id?: string;
  aspect: ValidationAspect;
  severity: ValidationSeverity;
  message: string;
  path?: string;
  code?: string;
  details?: any;
  location?: string[];
  humanReadable?: string;
}

export interface ValidationAspectResult {
  aspect: ValidationAspect;
  isValid: boolean;
  issues: ValidationIssue[];
  validationTime: number;
  status?: ValidationAspectExecutionStatus;
  reason?: string;
}

// ============================================================================
// Validator Interface Types
// ============================================================================

export interface ValidationContext {
  resourceType: string;
  profileUrl?: string;
  settings: ValidationSettings;
}

export interface ValidatorInterface {
  validate(resource: any, resourceType: string, ...args: any[]): Promise<ValidationIssue[]>;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface ValidationPipelineConfig {
  enableParallelProcessing: boolean;
  maxConcurrentValidations: number;
  batchSize: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface ValidationPipelineRequest {
  requests: ValidationRequest[];
  config?: Partial<ValidationPipelineConfig>;
  settings?: ValidationSettings;
}

export interface ValidationPipelineResult {
  results: ValidationResult[];
  summary: ValidationPipelineSummary;
  performance: ValidationPipelinePerformance;
  timestamps: ValidationPipelineTimestamps;
}

export interface ValidationPipelineSummary {
  totalRequests: number;
  successfulValidations: number;
  failedValidations: number;
  totalIssues: number;
  issuesBySeverity: Record<ValidationSeverity, number>;
  issuesByAspect: Record<ValidationAspect, number>;
}

export interface ValidationPipelinePerformance {
  totalTime: number;
  averageTimePerRequest: number;
  throughput: number; // requests per second
  memoryUsage: MemoryUsage;
  concurrencyStats: ConcurrencyStats;
}

export interface ValidationPipelineTimestamps {
  startedAt: Date;
  completedAt: Date;
  firstResultAt?: Date;
  lastResultAt?: Date;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface ConcurrencyStats {
  maxConcurrent: number;
  averageConcurrent: number;
  peakConcurrency: number;
}

// ============================================================================
// Queue Types
// ============================================================================

export enum ValidationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface ValidationQueueItem {
  id: string;
  request: ValidationRequest;
  priority: ValidationPriority;
  createdAt: Date;
  scheduledFor?: Date;
  retryCount: number;
  maxRetries: number;
  status: ValidationQueueStatus;
}

export enum ValidationQueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// ============================================================================
// Progress Types
// ============================================================================

export interface ValidationProgress {
  id: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  currentItem?: string;
  percentage: number;
  estimatedTimeRemaining?: number;
  startedAt: Date;
  lastUpdatedAt: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public aspect?: ValidationAspect,
    public resourceId?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ValidationTimeoutError extends ValidationError {
  constructor(timeoutMs: number, resourceId?: string) {
    super(`Validation timed out after ${timeoutMs}ms`, 'VALIDATION_TIMEOUT', undefined, resourceId);
    this.name = 'ValidationTimeoutError';
  }
}

export class ValidationCancellationError extends ValidationError {
  constructor(resourceId?: string) {
    super('Validation was cancelled', 'VALIDATION_CANCELLED', undefined, resourceId);
    this.name = 'ValidationCancellationError';
  }
}
