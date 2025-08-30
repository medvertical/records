// ============================================================================
// Validation Control Types
// ============================================================================

/**
 * Validation control state types
 */
export type ValidationStatus = 'not_running' | 'running' | 'paused' | 'completed' | 'error' | 'stopping';

export type ValidationAction = 'start' | 'pause' | 'resume' | 'stop' | 'reset';

/**
 * Validation progress with enhanced typing
 */
export interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  currentResourceType?: string;
  startTime: Date | string;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: ValidationStatus;
  processingRate: number; // Resources per minute
  currentBatch?: {
    batchNumber: number;
    totalBatches: number;
    batchSize: number;
    resourcesInBatch: number;
  };
  performance?: {
    averageTimePerResource: number;
    totalTimeMs: number;
    memoryUsage?: number;
  };
}

/**
 * Validation controls state with comprehensive typing
 */
export interface ValidationControlsState {
  isRunning: boolean;
  isPaused: boolean;
  isStopping: boolean;
  progress: ValidationProgress | null;
  error: string | null;
  lastAction: ValidationAction | null;
  batchSize: number;
  configuration: ValidationConfiguration;
  history: ValidationRunHistory[];
  metrics: ValidationMetrics;
}

/**
 * Validation configuration options
 */
export interface ValidationConfiguration {
  batchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  enablePersistence: boolean;
  retryAttempts: number;
  retryDelay: number;
  autoRetry: boolean;
  strictMode: boolean;
  validationAspects: {
    structural: boolean;
    profile: boolean;
    terminology: boolean;
    reference: boolean;
    businessRule: boolean;
    metadata: boolean;
  };
  performance: {
    maxConcurrentValidations: number;
    timeoutMs: number;
    memoryLimitMB: number;
  };
}

/**
 * Validation run history entry
 */
export interface ValidationRunHistory {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: ValidationStatus;
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  batchSize: number;
  duration?: number;
  error?: string;
  configuration: ValidationConfiguration;
}

/**
 * Validation metrics for performance tracking
 */
export interface ValidationMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  averageThroughput: number; // Resources per minute
  bestThroughput: number;
  worstThroughput: number;
  averageSuccessRate: number;
  totalResourcesProcessed: number;
  totalValidResources: number;
  totalErrorResources: number;
  lastRunDate?: Date;
}

/**
 * Validation control actions with proper typing
 */
export interface ValidationControlsActions {
  startValidation: (options?: StartValidationOptions) => Promise<void>;
  pauseValidation: () => Promise<void>;
  resumeValidation: () => Promise<void>;
  stopValidation: () => Promise<void>;
  updateBatchSize: (batchSize: number) => void;
  updateConfiguration: (config: Partial<ValidationConfiguration>) => void;
  clearError: () => void;
  resetState: () => void;
  clearHistory: () => void;
  exportResults: (format: 'json' | 'csv' | 'pdf') => Promise<void>;
  getHistory: () => ValidationRunHistory[];
  getMetrics: () => ValidationMetrics;
}

/**
 * Options for starting validation
 */
export interface StartValidationOptions {
  batchSize?: number;
  forceRevalidation?: boolean;
  skipUnchanged?: boolean;
  resourceTypes?: string[];
  customConfiguration?: Partial<ValidationConfiguration>;
}

/**
 * WebSocket message types for validation updates
 */
export interface ValidationWebSocketMessage {
  type: 'validation-progress' | 'validation-completed' | 'validation-error' | 'validation-paused' | 'validation-resumed';
  timestamp: Date;
  data: any;
}

export interface ValidationProgressMessage extends ValidationWebSocketMessage {
  type: 'validation-progress';
  data: ValidationProgress;
}

export interface ValidationCompletedMessage extends ValidationWebSocketMessage {
  type: 'validation-completed';
  data: {
    progress: ValidationProgress;
    summary: ValidationRunSummary;
  };
}

export interface ValidationErrorMessage extends ValidationWebSocketMessage {
  type: 'validation-error';
  data: {
    error: string;
    code?: string;
    recoverable: boolean;
    retryAfter?: number;
  };
}

/**
 * Validation run summary
 */
export interface ValidationRunSummary {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  skippedResources: number;
  duration: number;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  resourceTypeBreakdown: Record<string, {
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    skipped: number;
  }>;
}

/**
 * Validation error types
 */
export interface ValidationError {
  code: string;
  message: string;
  severity: 'fatal' | 'error' | 'warning' | 'information';
  recoverable: boolean;
  retryAfter?: number;
  context?: Record<string, any>;
}

/**
 * Validation hook configuration
 */
export interface ValidationControlsConfig {
  defaultBatchSize?: number;
  minBatchSize?: number;
  maxBatchSize?: number;
  enablePersistence?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  autoRetry?: boolean;
  strictMode?: boolean;
  enableMetrics?: boolean;
  maxHistoryEntries?: number;
  performanceMonitoring?: boolean;
}

/**
 * Validation hook return type
 */
export interface ValidationControlsHook {
  state: ValidationControlsState;
  actions: ValidationControlsActions;
  isLoading: boolean;
  isConnected: boolean;
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  progressPercentage: number;
  estimatedTimeRemaining: number | null;
  currentThroughput: number;
  successRate: number;
}

/**
 * Validation result export formats
 */
export interface ValidationExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeHistory?: boolean;
  includeMetrics?: boolean;
  includeConfiguration?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  resourceTypes?: string[];
}

/**
 * Validation performance benchmark
 */
export interface ValidationBenchmark {
  name: string;
  description: string;
  targetThroughput: number; // Resources per minute
  targetSuccessRate: number; // Percentage
  targetDuration: number; // Milliseconds
  actualThroughput?: number;
  actualSuccessRate?: number;
  actualDuration?: number;
  passed: boolean;
  score: number; // 0-100
}
