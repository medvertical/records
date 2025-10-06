import { toast } from '@/hooks/use-toast';

/**
 * Timeout handling system for long-running operations
 */

export interface TimeoutConfig {
  defaultTimeout: number; // milliseconds
  maxTimeout: number; // milliseconds
  minTimeout: number; // milliseconds
  warningThreshold: number; // percentage of timeout to show warning
  retryTimeout: number; // milliseconds
  userNotificationTimeout: number; // milliseconds
}

export interface TimeoutOperation {
  id: string;
  name: string;
  startTime: Date;
  timeout: number;
  warningThreshold: number;
  onTimeout: () => void;
  onWarning: () => void;
  onProgress?: (elapsed: number, remaining: number) => void;
  context?: {
    component?: string;
    operation?: string;
    userId?: string;
    additionalInfo?: Record<string, any>;
  };
}

export interface TimeoutManager {
  operations: Map<string, TimeoutOperation>;
  timers: Map<string, NodeJS.Timeout>;
  warningTimers: Map<string, NodeJS.Timeout>;
  config: TimeoutConfig;
}

export interface TimeoutResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  timedOut: boolean;
  duration: number;
  operation: string;
}

export interface TimeoutOptions {
  timeout?: number;
  warningThreshold?: number;
  retryOnTimeout?: boolean;
  maxRetries?: number;
  onTimeout?: () => void;
  onWarning?: () => void;
  onProgress?: (elapsed: number, remaining: number) => void;
  context?: {
    component?: string;
    operation?: string;
    userId?: string;
    additionalInfo?: Record<string, any>;
  };
}

/**
 * Timeout Manager Class
 */
export class TimeoutManagerClass {
  private operations = new Map<string, TimeoutOperation>();
  private timers = new Map<string, NodeJS.Timeout>();
  private warningTimers = new Map<string, NodeJS.Timeout>();
  private config: TimeoutConfig;

  constructor(config: TimeoutConfig) {
    this.config = config;
  }

  /**
   * Start a timeout operation
   */
  startOperation(
    name: string,
    timeout: number,
    onTimeout: () => void,
    options: Partial<TimeoutOptions> = {}
  ): string {
    const operationId = `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const actualTimeout = Math.min(Math.max(timeout, this.config.minTimeout), this.config.maxTimeout);
    const warningThreshold = options.warningThreshold || this.config.warningThreshold;

    const operation: TimeoutOperation = {
      id: operationId,
      name,
      startTime: new Date(),
      timeout: actualTimeout,
      warningThreshold,
      onTimeout,
      onWarning: options.onWarning || (() => {}),
      onProgress: options.onProgress,
      context: options.context,
    };

    this.operations.set(operationId, operation);

    // Set up warning timer
    const warningTime = actualTimeout * (warningThreshold / 100);
    if (warningTime > 0) {
      const warningTimer = setTimeout(() => {
        this.handleWarning(operationId);
      }, warningTime);
      this.warningTimers.set(operationId, warningTimer);
    }

    // Set up timeout timer
    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(operationId);
    }, actualTimeout);
    this.timers.set(operationId, timeoutTimer);

    // Set up progress timer if callback provided
    if (operation.onProgress) {
      this.startProgressTracking(operationId);
    }

    return operationId;
  }

  /**
   * Complete a timeout operation
   */
  completeOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    // Clear timers
    const timer = this.timers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(operationId);
    }

    const warningTimer = this.warningTimers.get(operationId);
    if (warningTimer) {
      clearTimeout(warningTimer);
      this.warningTimers.delete(operationId);
    }

    // Remove operation
    this.operations.delete(operationId);

    return true;
  }

  /**
   * Cancel a timeout operation
   */
  cancelOperation(operationId: string): boolean {
    return this.completeOperation(operationId);
  }

  /**
   * Get operation status
   */
  getOperationStatus(operationId: string): {
    exists: boolean;
    elapsed: number;
    remaining: number;
    progress: number;
  } | null {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return null;
    }

    const elapsed = Date.now() - operation.startTime.getTime();
    const remaining = Math.max(0, operation.timeout - elapsed);
    const progress = Math.min(100, (elapsed / operation.timeout) * 100);

    return {
      exists: true,
      elapsed,
      remaining,
      progress,
    };
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): Array<{
    id: string;
    name: string;
    elapsed: number;
    remaining: number;
    progress: number;
  }> {
    const activeOperations: Array<{
      id: string;
      name: string;
      elapsed: number;
      remaining: number;
      progress: number;
    }> = [];

    for (const [id, operation] of this.operations.entries()) {
      const status = this.getOperationStatus(id);
      if (status) {
        activeOperations.push({
          id,
          name: operation.name,
          elapsed: status.elapsed,
          remaining: status.remaining,
          progress: status.progress,
        });
      }
    }

    return activeOperations;
  }

  /**
   * Handle timeout
   */
  private handleTimeout(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    // Clear warning timer
    const warningTimer = this.warningTimers.get(operationId);
    if (warningTimer) {
      clearTimeout(warningTimer);
      this.warningTimers.delete(operationId);
    }

    // Execute timeout callback
    try {
      operation.onTimeout();
    } catch (error) {
      console.error(`[TimeoutManager] Error in timeout callback for operation ${operationId}:`, error);
    }

    // Remove operation
    this.operations.delete(operationId);
    this.timers.delete(operationId);
  }

  /**
   * Handle warning
   */
  private handleWarning(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    // Execute warning callback
    try {
      operation.onWarning();
    } catch (error) {
      console.error(`[TimeoutManager] Error in warning callback for operation ${operationId}:`, error);
    }
  }

  /**
   * Start progress tracking
   */
  private startProgressTracking(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation || !operation.onProgress) {
      return;
    }

    const progressInterval = setInterval(() => {
      const status = this.getOperationStatus(operationId);
      if (!status) {
        clearInterval(progressInterval);
        return;
      }

      try {
        operation.onProgress!(status.elapsed, status.remaining);
      } catch (error) {
        console.error(`[TimeoutManager] Error in progress callback for operation ${operationId}:`, error);
      }
    }, 1000); // Update every second

    // Store interval for cleanup
    (operation as any).progressInterval = progressInterval;
  }

  /**
   * Cleanup all operations
   */
  cleanup(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.warningTimers.values()) {
      clearTimeout(timer);
    }

    // Clear all progress intervals
    for (const operation of this.operations.values()) {
      if ((operation as any).progressInterval) {
        clearInterval((operation as any).progressInterval);
      }
    }

    // Clear all maps
    this.operations.clear();
    this.timers.clear();
    this.warningTimers.clear();
  }
}

/**
 * Timeout-aware fetch wrapper
 */
export async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutOptions: TimeoutOptions = {}
): Promise<TimeoutResult<T>> {
  const startTime = Date.now();
  const timeout = timeoutOptions.timeout || 30000; // 30 seconds default
  const operationName = `fetch-${url}`;

  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      resolve({
        success: false,
        error: new Error(`Request to ${url} timed out after ${timeout}ms`),
        timedOut: true,
        duration: Date.now() - startTime,
        operation: operationName,
      });
    }, timeout);

    fetch(url, {
      ...options,
      signal: controller.signal,
    })
      .then(async (response) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          resolve({
            success: true,
            data,
            timedOut: false,
            duration,
            operation: operationName,
          });
        } else {
          resolve({
            success: false,
            error: new Error(`HTTP ${response.status}: ${response.statusText}`),
            timedOut: false,
            duration,
            operation: operationName,
          });
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        const timedOut = error.name === 'AbortError';

        resolve({
          success: false,
          error: timedOut ? new Error(`Request to ${url} timed out after ${timeout}ms`) : error,
          timedOut,
          duration,
          operation: operationName,
        });
      });
  });
}

/**
 * Timeout-aware operation wrapper
 */
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  operationName: string,
  timeoutOptions: TimeoutOptions = {}
): Promise<TimeoutResult<T>> {
  const startTime = Date.now();
  const timeout = timeoutOptions.timeout || 30000; // 30 seconds default

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: new Error(`Operation ${operationName} timed out after ${timeout}ms`),
        timedOut: true,
        duration: Date.now() - startTime,
        operation: operationName,
      });
    }, timeout);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve({
          success: true,
          data: result,
          timedOut: false,
          duration: Date.now() - startTime,
          operation: operationName,
        });
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error,
          timedOut: false,
          duration: Date.now() - startTime,
          operation: operationName,
        });
      });
  });
}

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  defaultTimeout: 30000, // 30 seconds
  maxTimeout: 300000, // 5 minutes
  minTimeout: 1000, // 1 second
  warningThreshold: 80, // 80% of timeout
  retryTimeout: 5000, // 5 seconds
  userNotificationTimeout: 10000, // 10 seconds
};

/**
 * Global timeout manager
 */
export const timeoutManager = new TimeoutManagerClass(DEFAULT_TIMEOUT_CONFIG);

/**
 * Hook for using timeout handling in React components
 */
export function useTimeoutHandling(config?: Partial<TimeoutConfig>) {
  const manager = config ? new TimeoutManagerClass({ ...DEFAULT_TIMEOUT_CONFIG, ...config }) : timeoutManager;

  const startOperation = (
    name: string,
    timeout: number,
    onTimeout: () => void,
    options?: Partial<TimeoutOptions>
  ) => {
    return manager.startOperation(name, timeout, onTimeout, options);
  };

  const completeOperation = (operationId: string) => {
    return manager.completeOperation(operationId);
  };

  const cancelOperation = (operationId: string) => {
    return manager.cancelOperation(operationId);
  };

  const getOperationStatus = (operationId: string) => {
    return manager.getOperationStatus(operationId);
  };

  const getActiveOperations = () => {
    return manager.getActiveOperations();
  };

  const executeWithTimeout = async <T>(
    operation: () => Promise<T>,
    operationName: string,
    timeoutOptions?: TimeoutOptions
  ) => {
    return executeWithTimeout(operation, operationName, timeoutOptions);
  };

  const fetchWithTimeout = async <T>(
    url: string,
    options?: RequestInit,
    timeoutOptions?: TimeoutOptions
  ) => {
    return fetchWithTimeout<T>(url, options, timeoutOptions);
  };

  return {
    startOperation,
    completeOperation,
    cancelOperation,
    getOperationStatus,
    getActiveOperations,
    executeWithTimeout,
    fetchWithTimeout,
    manager,
  };
}

/**
 * Utility functions for timeout handling
 */
export const TimeoutUtils = {
  /**
   * Format duration in milliseconds to human-readable string
   */
  formatDuration: (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)}m`;
    } else {
      return `${(ms / 3600000).toFixed(1)}h`;
    }
  },

  /**
   * Get timeout message for user
   */
  getTimeoutMessage: (operation: string, timeout: number): string => {
    return `The ${operation} operation is taking longer than expected (${TimeoutUtils.formatDuration(timeout)}). Please wait or try again.`;
  },

  /**
   * Get warning message for user
   */
  getWarningMessage: (operation: string, remaining: number): string => {
    return `The ${operation} operation is taking longer than usual. ${TimeoutUtils.formatDuration(remaining)} remaining.`;
  },

  /**
   * Create timeout toast notification
   */
  createTimeoutToast: (operation: string, timeout: number) => {
    toast({
      title: "Operation Timeout",
      description: TimeoutUtils.getTimeoutMessage(operation, timeout),
      variant: "destructive",
    });
  },

  /**
   * Create warning toast notification
   */
  createWarningToast: (operation: string, remaining: number) => {
    toast({
      title: "Operation Taking Longer",
      description: TimeoutUtils.getWarningMessage(operation, remaining),
      variant: "default",
    });
  },

  /**
   * Check if operation should timeout based on context
   */
  shouldTimeout: (operation: string, context?: Record<string, any>): boolean => {
    // Some operations might be intentionally long-running
    const longRunningOperations = ['validation', 'bulk-validation', 'data-import'];
    return !longRunningOperations.some(op => operation.toLowerCase().includes(op));
  },

  /**
   * Get appropriate timeout for operation
   */
  getTimeoutForOperation: (operation: string, context?: Record<string, any>): number => {
    const operationLower = operation.toLowerCase();
    
    if (operationLower.includes('validation')) {
      return 300000; // 5 minutes for validation
    } else if (operationLower.includes('bulk')) {
      return 600000; // 10 minutes for bulk operations
    } else if (operationLower.includes('import') || operationLower.includes('export')) {
      return 900000; // 15 minutes for import/export
    } else if (operationLower.includes('fetch') || operationLower.includes('api')) {
      return 30000; // 30 seconds for API calls
    } else {
      return 60000; // 1 minute default
    }
  },
};

