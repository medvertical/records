import { toast } from '@/hooks/use-toast';

/**
 * Error recovery mechanisms for partial failures
 */

export interface RecoveryCheckpoint {
  id: string;
  operationId: string;
  timestamp: Date;
  state: any;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  context: {
    component?: string;
    operation?: string;
    userId?: string;
    additionalInfo?: Record<string, any>;
  };
  metadata: {
    version: string;
    checksum: string;
    recoveryType: 'automatic' | 'manual' | 'user-initiated';
  };
}

export interface PartialFailure {
  id: string;
  operationId: string;
  timestamp: Date;
  failureType: 'network' | 'service' | 'validation' | 'timeout' | 'data' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedItems: string[];
  completedItems: string[];
  failedItems: string[];
  error: Error;
  context: {
    component?: string;
    operation?: string;
    userId?: string;
    additionalInfo?: Record<string, any>;
  };
  recoveryOptions: RecoveryOption[];
}

export interface RecoveryOption {
  id: string;
  name: string;
  description: string;
  type: 'retry' | 'skip' | 'fallback' | 'manual' | 'checkpoint';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number; // milliseconds
  successRate: number; // percentage
  action: () => Promise<RecoveryResult>;
  prerequisites?: string[];
  sideEffects?: string[];
}

export interface RecoveryResult {
  success: boolean;
  recoveredItems: string[];
  failedItems: string[];
  skippedItems: string[];
  duration: number;
  error?: Error;
  checkpoint?: RecoveryCheckpoint;
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicableFailures: string[];
  recoverySteps: RecoveryStep[];
  fallbackStrategy?: string;
  maxRetries: number;
  timeout: number;
}

export interface RecoveryStep {
  id: string;
  name: string;
  type: 'validate' | 'retry' | 'skip' | 'fallback' | 'checkpoint' | 'manual';
  condition?: (failure: PartialFailure) => boolean;
  action: (failure: PartialFailure) => Promise<RecoveryResult>;
  timeout: number;
  retryCount: number;
}

export interface RecoveryConfig {
  enableAutomaticRecovery: boolean;
  enableCheckpointRecovery: boolean;
  enablePartialResultPreservation: boolean;
  maxRecoveryAttempts: number;
  recoveryTimeout: number;
  checkpointInterval: number; // milliseconds
  maxCheckpoints: number;
  enableUserRecovery: boolean;
  enableFallbackStrategies: boolean;
}

/**
 * Error Recovery Manager Class
 */
export class ErrorRecoveryManager {
  private checkpoints = new Map<string, RecoveryCheckpoint[]>();
  private partialFailures = new Map<string, PartialFailure[]>();
  private recoveryStrategies = new Map<string, RecoveryStrategy>();
  private config: RecoveryConfig;

  constructor(config: RecoveryConfig) {
    this.config = config;
    this.initializeDefaultStrategies();
    this.loadStoredData();
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Network failure recovery strategy
    this.recoveryStrategies.set('network-failure', {
      id: 'network-failure',
      name: 'Network Failure Recovery',
      description: 'Recovery strategy for network-related failures',
      applicableFailures: ['network', 'timeout'],
      maxRetries: 3,
      timeout: 30000,
      recoverySteps: [
        {
          id: 'validate-connection',
          name: 'Validate Network Connection',
          type: 'validate',
          timeout: 5000,
          retryCount: 0,
          action: async (failure) => {
            // Simulate connection validation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
              success: true,
              recoveredItems: [],
              failedItems: [],
              skippedItems: [],
              duration: 1000,
            };
          },
        },
        {
          id: 'retry-operation',
          name: 'Retry Failed Operation',
          type: 'retry',
          timeout: 10000,
          retryCount: 0,
          action: async (failure) => {
            // Simulate retry operation
            await new Promise(resolve => setTimeout(resolve, 2000));
            return {
              success: true,
              recoveredItems: failure.failedItems,
              failedItems: [],
              skippedItems: [],
              duration: 2000,
            };
          },
        },
      ],
    });

    // Service failure recovery strategy
    this.recoveryStrategies.set('service-failure', {
      id: 'service-failure',
      name: 'Service Failure Recovery',
      description: 'Recovery strategy for service-related failures',
      applicableFailures: ['service', 'timeout'],
      maxRetries: 2,
      timeout: 60000,
      recoverySteps: [
        {
          id: 'check-service-health',
          name: 'Check Service Health',
          type: 'validate',
          timeout: 5000,
          retryCount: 0,
          action: async (failure) => {
            // Simulate service health check
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
              success: true,
              recoveredItems: [],
              failedItems: [],
              skippedItems: [],
              duration: 1000,
            };
          },
        },
        {
          id: 'fallback-service',
          name: 'Use Fallback Service',
          type: 'fallback',
          timeout: 15000,
          retryCount: 0,
          action: async (failure) => {
            // Simulate fallback service
            await new Promise(resolve => setTimeout(resolve, 3000));
            return {
              success: true,
              recoveredItems: failure.failedItems,
              failedItems: [],
              skippedItems: [],
              duration: 3000,
            };
          },
        },
      ],
    });

    // Validation failure recovery strategy
    this.recoveryStrategies.set('validation-failure', {
      id: 'validation-failure',
      name: 'Validation Failure Recovery',
      description: 'Recovery strategy for validation-related failures',
      applicableFailures: ['validation', 'data'],
      maxRetries: 1,
      timeout: 30000,
      recoverySteps: [
        {
          id: 'validate-data',
          name: 'Validate Data Format',
          type: 'validate',
          timeout: 5000,
          retryCount: 0,
          action: async (failure) => {
            // Simulate data validation
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
              success: true,
              recoveredItems: [],
              failedItems: [],
              skippedItems: [],
              duration: 1000,
            };
          },
        },
        {
          id: 'skip-invalid-items',
          name: 'Skip Invalid Items',
          type: 'skip',
          timeout: 2000,
          retryCount: 0,
          action: async (failure) => {
            // Simulate skipping invalid items
            await new Promise(resolve => setTimeout(resolve, 500));
            return {
              success: true,
              recoveredItems: [],
              failedItems: [],
              skippedItems: failure.failedItems,
              duration: 500,
            };
          },
        },
      ],
    });
  }

  /**
   * Load stored data from localStorage
   */
  private loadStoredData(): void {
    try {
      const storedCheckpoints = localStorage.getItem('recovery-checkpoints');
      if (storedCheckpoints) {
        const parsedCheckpoints = JSON.parse(storedCheckpoints);
        for (const [operationId, checkpoints] of Object.entries(parsedCheckpoints)) {
          this.checkpoints.set(operationId, (checkpoints as any[]).map(cp => ({
            ...cp,
            timestamp: new Date(cp.timestamp),
          })));
        }
      }

      const storedFailures = localStorage.getItem('partial-failures');
      if (storedFailures) {
        const parsedFailures = JSON.parse(storedFailures);
        for (const [operationId, failures] of Object.entries(parsedFailures)) {
          this.partialFailures.set(operationId, (failures as any[]).map(f => ({
            ...f,
            timestamp: new Date(f.timestamp),
            error: new Error(f.error.message),
          })));
        }
      }
    } catch (error) {
      console.warn('[ErrorRecoveryManager] Failed to load stored data:', error);
    }
  }

  /**
   * Save data to localStorage
   */
  private saveData(): void {
    try {
      const checkpointsToSave: Record<string, any[]> = {};
      for (const [operationId, checkpoints] of this.checkpoints.entries()) {
        checkpointsToSave[operationId] = checkpoints;
      }
      localStorage.setItem('recovery-checkpoints', JSON.stringify(checkpointsToSave));

      const failuresToSave: Record<string, any[]> = {};
      for (const [operationId, failures] of this.partialFailures.entries()) {
        failuresToSave[operationId] = failures.map(f => ({
          ...f,
          error: { message: f.error.message, stack: f.error.stack },
        }));
      }
      localStorage.setItem('partial-failures', JSON.stringify(failuresToSave));
    } catch (error) {
      console.warn('[ErrorRecoveryManager] Failed to save data:', error);
    }
  }

  /**
   * Create a recovery checkpoint
   */
  createCheckpoint(
    operationId: string,
    state: any,
    progress: { completed: number; total: number },
    context: PartialFailure['context'] = {}
  ): RecoveryCheckpoint {
    const checkpoint: RecoveryCheckpoint = {
      id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operationId,
      timestamp: new Date(),
      state,
      progress: {
        completed: progress.completed,
        total: progress.total,
        percentage: (progress.completed / progress.total) * 100,
      },
      context,
      metadata: {
        version: '1.0',
        checksum: this.generateChecksum(state),
        recoveryType: 'automatic',
      },
    };

    // Store checkpoint
    if (!this.checkpoints.has(operationId)) {
      this.checkpoints.set(operationId, []);
    }
    const operationCheckpoints = this.checkpoints.get(operationId)!;
    operationCheckpoints.push(checkpoint);

    // Limit number of checkpoints
    if (operationCheckpoints.length > this.config.maxCheckpoints) {
      operationCheckpoints.shift(); // Remove oldest checkpoint
    }

    this.saveData();
    return checkpoint;
  }

  /**
   * Get latest checkpoint for operation
   */
  getLatestCheckpoint(operationId: string): RecoveryCheckpoint | null {
    const checkpoints = this.checkpoints.get(operationId);
    if (!checkpoints || checkpoints.length === 0) {
      return null;
    }
    return checkpoints[checkpoints.length - 1];
  }

  /**
   * Record a partial failure
   */
  recordPartialFailure(
    operationId: string,
    failureType: PartialFailure['failureType'],
    severity: PartialFailure['severity'],
    affectedItems: string[],
    completedItems: string[],
    failedItems: string[],
    error: Error,
    context: PartialFailure['context'] = {}
  ): PartialFailure {
    const failure: PartialFailure = {
      id: `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operationId,
      timestamp: new Date(),
      failureType,
      severity,
      affectedItems,
      completedItems,
      failedItems,
      error,
      context,
      recoveryOptions: this.generateRecoveryOptions(failureType, severity, failedItems),
    };

    // Store failure
    if (!this.partialFailures.has(operationId)) {
      this.partialFailures.set(operationId, []);
    }
    const operationFailures = this.partialFailures.get(operationId)!;
    operationFailures.push(failure);

    this.saveData();
    return failure;
  }

  /**
   * Generate recovery options for a failure
   */
  private generateRecoveryOptions(
    failureType: PartialFailure['failureType'],
    severity: PartialFailure['severity'],
    failedItems: string[]
  ): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    // Retry option
    options.push({
      id: 'retry',
      name: 'Retry Failed Items',
      description: 'Retry the failed items with the same operation',
      type: 'retry',
      priority: severity === 'critical' ? 'high' : 'medium',
      estimatedTime: 5000,
      successRate: 70,
      action: async () => {
        // Simulate retry operation
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
          success: true,
          recoveredItems: failedItems,
          failedItems: [],
          skippedItems: [],
          duration: 2000,
        };
      },
    });

    // Skip option
    if (severity !== 'critical') {
      options.push({
        id: 'skip',
        name: 'Skip Failed Items',
        description: 'Skip the failed items and continue with completed items',
        type: 'skip',
        priority: 'low',
        estimatedTime: 1000,
        successRate: 100,
        action: async () => {
          return {
            success: true,
            recoveredItems: [],
            failedItems: [],
            skippedItems: failedItems,
            duration: 1000,
          };
        },
      });
    }

    // Fallback option
    if (failureType === 'service' || failureType === 'network') {
      options.push({
        id: 'fallback',
        name: 'Use Fallback Method',
        description: 'Use an alternative method to process the failed items',
        type: 'fallback',
        priority: 'medium',
        estimatedTime: 10000,
        successRate: 60,
        action: async () => {
          // Simulate fallback operation
          await new Promise(resolve => setTimeout(resolve, 3000));
          return {
            success: true,
            recoveredItems: failedItems,
            failedItems: [],
            skippedItems: [],
            duration: 3000,
          };
        },
      });
    }

    // Checkpoint recovery option
    options.push({
      id: 'checkpoint',
      name: 'Restore from Checkpoint',
      description: 'Restore the operation state from the latest checkpoint',
      type: 'checkpoint',
      priority: 'high',
      estimatedTime: 2000,
      successRate: 90,
      action: async () => {
        // Simulate checkpoint recovery
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          success: true,
          recoveredItems: failedItems,
          failedItems: [],
          skippedItems: [],
          duration: 1000,
        };
      },
    });

    return options;
  }

  /**
   * Attempt automatic recovery
   */
  async attemptAutomaticRecovery(failure: PartialFailure): Promise<RecoveryResult> {
    if (!this.config.enableAutomaticRecovery) {
      return {
        success: false,
        recoveredItems: [],
        failedItems: failure.failedItems,
        skippedItems: [],
        duration: 0,
        error: new Error('Automatic recovery is disabled'),
      };
    }

    const strategy = this.recoveryStrategies.get(`${failure.failureType}-failure`);
    if (!strategy) {
      return {
        success: false,
        recoveredItems: [],
        failedItems: failure.failedItems,
        skippedItems: [],
        duration: 0,
        error: new Error(`No recovery strategy found for failure type: ${failure.failureType}`),
      };
    }

    const startTime = Date.now();
    let recoveredItems: string[] = [];
    let failedItems: string[] = failure.failedItems;
    let skippedItems: string[] = [];

    try {
      for (const step of strategy.recoverySteps) {
        if (failedItems.length === 0) {
          break; // All items recovered
        }

        const stepResult = await step.action(failure);
        recoveredItems.push(...stepResult.recoveredItems);
        failedItems = stepResult.failedItems;
        skippedItems.push(...stepResult.skippedItems);

        if (stepResult.success && stepResult.recoveredItems.length > 0) {
          // Create checkpoint after successful recovery
          if (this.config.enableCheckpointRecovery) {
            this.createCheckpoint(
              failure.operationId,
              { recoveredItems, failedItems, skippedItems },
              { completed: recoveredItems.length, total: failure.affectedItems.length },
              failure.context
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      return {
        success: failedItems.length === 0,
        recoveredItems,
        failedItems,
        skippedItems,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        recoveredItems,
        failedItems,
        skippedItems,
        duration,
        error: error instanceof Error ? error : new Error('Unknown recovery error'),
      };
    }
  }

  /**
   * Execute manual recovery option
   */
  async executeRecoveryOption(
    failure: PartialFailure,
    optionId: string
  ): Promise<RecoveryResult> {
    const option = failure.recoveryOptions.find(opt => opt.id === optionId);
    if (!option) {
      return {
        success: false,
        recoveredItems: [],
        failedItems: failure.failedItems,
        skippedItems: [],
        duration: 0,
        error: new Error(`Recovery option not found: ${optionId}`),
      };
    }

    const startTime = Date.now();
    try {
      const result = await option.action();
      const duration = Date.now() - startTime;

      // Create checkpoint after successful recovery
      if (result.success && this.config.enableCheckpointRecovery) {
        this.createCheckpoint(
          failure.operationId,
          { recoveredItems: result.recoveredItems, failedItems: result.failedItems },
          { completed: result.recoveredItems.length, total: failure.affectedItems.length },
          failure.context
        );
      }

      return {
        ...result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        recoveredItems: [],
        failedItems: failure.failedItems,
        skippedItems: [],
        duration,
        error: error instanceof Error ? error : new Error('Unknown recovery error'),
      };
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalFailures: number;
    totalRecoveries: number;
    successRate: number;
    failuresByType: Record<string, number>;
    recoveriesByType: Record<string, number>;
  } {
    let totalFailures = 0;
    let totalRecoveries = 0;
    const failuresByType: Record<string, number> = {};
    const recoveriesByType: Record<string, number> = {};

    for (const failures of this.partialFailures.values()) {
      totalFailures += failures.length;
      for (const failure of failures) {
        failuresByType[failure.failureType] = (failuresByType[failure.failureType] || 0) + 1;
        // Assume recovery was attempted for each failure
        totalRecoveries++;
        recoveriesByType[failure.failureType] = (recoveriesByType[failure.failureType] || 0) + 1;
      }
    }

    return {
      totalFailures,
      totalRecoveries,
      successRate: totalFailures > 0 ? (totalRecoveries / totalFailures) * 100 : 0,
      failuresByType,
      recoveriesByType,
    };
  }

  /**
   * Generate checksum for state
   */
  private generateChecksum(state: any): string {
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear old data
   */
  clearOldData(): void {
    const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days

    for (const [operationId, checkpoints] of this.checkpoints.entries()) {
      const filteredCheckpoints = checkpoints.filter(cp => cp.timestamp >= cutoff);
      if (filteredCheckpoints.length === 0) {
        this.checkpoints.delete(operationId);
      } else {
        this.checkpoints.set(operationId, filteredCheckpoints);
      }
    }

    for (const [operationId, failures] of this.partialFailures.entries()) {
      const filteredFailures = failures.filter(f => f.timestamp >= cutoff);
      if (filteredFailures.length === 0) {
        this.partialFailures.delete(operationId);
      } else {
        this.partialFailures.set(operationId, filteredFailures);
      }
    }

    this.saveData();
  }

  /**
   * Clear all data
   */
  clearAllData(): void {
    this.checkpoints.clear();
    this.partialFailures.clear();
    this.saveData();
  }
}

/**
 * Default recovery configuration
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  enableAutomaticRecovery: true,
  enableCheckpointRecovery: true,
  enablePartialResultPreservation: true,
  maxRecoveryAttempts: 3,
  recoveryTimeout: 60000,
  checkpointInterval: 30000, // 30 seconds
  maxCheckpoints: 10,
  enableUserRecovery: true,
  enableFallbackStrategies: true,
};

/**
 * Global error recovery manager
 */
export const errorRecoveryManager = new ErrorRecoveryManager(DEFAULT_RECOVERY_CONFIG);

/**
 * Hook for using error recovery mechanisms in React components
 */
export function useErrorRecovery(config?: Partial<RecoveryConfig>) {
  const manager = config ? new ErrorRecoveryManager({ ...DEFAULT_RECOVERY_CONFIG, ...config }) : errorRecoveryManager;

  const createCheckpoint = (
    operationId: string,
    state: any,
    progress: { completed: number; total: number },
    context?: PartialFailure['context']
  ) => {
    return manager.createCheckpoint(operationId, state, progress, context);
  };

  const getLatestCheckpoint = (operationId: string) => {
    return manager.getLatestCheckpoint(operationId);
  };

  const recordPartialFailure = (
    operationId: string,
    failureType: PartialFailure['failureType'],
    severity: PartialFailure['severity'],
    affectedItems: string[],
    completedItems: string[],
    failedItems: string[],
    error: Error,
    context?: PartialFailure['context']
  ) => {
    return manager.recordPartialFailure(
      operationId,
      failureType,
      severity,
      affectedItems,
      completedItems,
      failedItems,
      error,
      context
    );
  };

  const attemptAutomaticRecovery = (failure: PartialFailure) => {
    return manager.attemptAutomaticRecovery(failure);
  };

  const executeRecoveryOption = (failure: PartialFailure, optionId: string) => {
    return manager.executeRecoveryOption(failure, optionId);
  };

  const getRecoveryStats = () => {
    return manager.getRecoveryStats();
  };

  return {
    createCheckpoint,
    getLatestCheckpoint,
    recordPartialFailure,
    attemptAutomaticRecovery,
    executeRecoveryOption,
    getRecoveryStats,
    manager,
  };
}

/**
 * Utility functions for error recovery
 */
export const RecoveryUtils = {
  /**
   * Create recovery toast notification
   */
  createRecoveryToast: (failure: PartialFailure, recoveryResult: RecoveryResult) => {
    if (recoveryResult.success) {
      toast({
        title: "Recovery Successful",
        description: `Successfully recovered ${recoveryResult.recoveredItems.length} items from ${failure.failureType} failure.`,
      });
    } else {
      toast({
        title: "Recovery Failed",
        description: `Failed to recover items from ${failure.failureType} failure. ${recoveryResult.error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  },

  /**
   * Get recovery priority color
   */
  getRecoveryPriorityColor: (priority: RecoveryOption['priority']): string => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  },

  /**
   * Format recovery time
   */
  formatRecoveryTime: (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  },

  /**
   * Get recovery success rate color
   */
  getRecoverySuccessRateColor: (rate: number): string => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    if (rate >= 40) return 'text-orange-600';
    return 'text-red-600';
  },
};

