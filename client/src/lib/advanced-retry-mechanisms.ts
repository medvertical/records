import { NetworkError, RetryConfig } from './network-error-handler';

/**
 * Advanced retry mechanisms with circuit breaker patterns, jitter, and adaptive strategies
 */

export interface AdvancedRetryConfig extends RetryConfig {
  jitter?: boolean;
  jitterType?: 'full' | 'equal' | 'decorrelated';
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  adaptiveRetry?: AdaptiveRetryConfig;
  retryStrategy?: 'exponential' | 'linear' | 'fibonacci' | 'adaptive';
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number; // Number of failures before opening circuit
  recoveryTimeout: number; // Time in ms before attempting to close circuit
  halfOpenMaxCalls: number; // Max calls allowed in half-open state
  successThreshold: number; // Number of successes needed to close circuit
}

export interface AdaptiveRetryConfig {
  enabled: boolean;
  baseDelay: number;
  maxDelay: number;
  successMultiplier: number; // Multiply delay by this on success
  failureMultiplier: number; // Multiply delay by this on failure
  minDelay: number;
}

export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageDelay: number;
  lastDelay: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  adaptiveDelay: number;
}

export interface RetryContext {
  operation: string;
  startTime: number;
  attempt: number;
  lastError?: NetworkError;
  stats: RetryStats;
}

/**
 * Circuit Breaker States
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

/**
 * Advanced Retry Manager with Circuit Breaker and Adaptive Strategies
 */
export class AdvancedRetryManager {
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;
  private adaptiveDelay: number;
  private stats: RetryStats;

  constructor(
    private config: AdvancedRetryConfig,
    private operationName: string
  ) {
    this.adaptiveDelay = config.adaptiveRetry?.baseDelay || config.baseDelay;
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageDelay: 0,
      lastDelay: 0,
      circuitBreakerState: 'closed',
      adaptiveDelay: this.adaptiveDelay,
    };
  }

  /**
   * Execute operation with advanced retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: NetworkError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      // Check circuit breaker
      if (this.config.circuitBreaker?.enabled && !this.canExecute()) {
        throw new Error(`Circuit breaker is ${this.circuitBreakerState} for operation: ${this.operationName}`);
      }

      try {
        this.stats.totalAttempts++;
        const result = await operation();
        
        // Record success
        this.recordSuccess();
        this.stats.successfulAttempts++;
        
        return result;
      } catch (error) {
        lastError = this.parseError(error);
        this.stats.failedAttempts++;
        
        // Record failure
        this.recordFailure();
        
        // Check if we should retry
        if (attempt >= this.config.maxRetries || !this.shouldRetry(lastError)) {
          break;
        }

        // Calculate delay with advanced strategies
        const delay = this.calculateAdvancedDelay(attempt, lastError);
        this.stats.lastDelay = delay;
        this.updateAverageDelay(delay);

        console.log(`[AdvancedRetry] ${this.operationName} attempt ${attempt} failed, retrying in ${delay}ms (${context || 'no context'})`);
        
        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`Max retries reached for operation: ${this.operationName}`);
  }

  /**
   * Check if circuit breaker allows execution
   */
  private canExecute(): boolean {
    if (!this.config.circuitBreaker?.enabled) return true;

    switch (this.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return true;
      
      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has passed
        if (Date.now() - this.lastFailureTime > this.config.circuitBreaker.recoveryTimeout) {
          this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
          this.halfOpenCalls = 0;
          this.stats.circuitBreakerState = 'half-open';
          return true;
        }
        return false;
      
      case CircuitBreakerState.HALF_OPEN:
        return this.halfOpenCalls < (this.config.circuitBreaker.halfOpenMaxCalls || 1);
      
      default:
        return true;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.successCount++;
    this.failureCount = 0;

    if (this.config.circuitBreaker?.enabled) {
      if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
        this.halfOpenCalls++;
        if (this.successCount >= (this.config.circuitBreaker.successThreshold || 1)) {
          this.circuitBreakerState = CircuitBreakerState.CLOSED;
          this.stats.circuitBreakerState = 'closed';
          this.successCount = 0;
          this.halfOpenCalls = 0;
        }
      }
    }

    // Update adaptive delay on success
    if (this.config.adaptiveRetry?.enabled) {
      this.adaptiveDelay = Math.max(
        this.adaptiveDelay * (this.config.adaptiveRetry.successMultiplier || 0.9),
        this.config.adaptiveRetry.minDelay || 100
      );
      this.stats.adaptiveDelay = this.adaptiveDelay;
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    this.lastFailureTime = Date.now();

    if (this.config.circuitBreaker?.enabled) {
      if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
        this.circuitBreakerState = CircuitBreakerState.OPEN;
        this.stats.circuitBreakerState = 'open';
        this.halfOpenCalls = 0;
      } else if (this.failureCount >= (this.config.circuitBreaker.failureThreshold || 5)) {
        this.circuitBreakerState = CircuitBreakerState.OPEN;
        this.stats.circuitBreakerState = 'open';
      }
    }

    // Update adaptive delay on failure
    if (this.config.adaptiveRetry?.enabled) {
      this.adaptiveDelay = Math.min(
        this.adaptiveDelay * (this.config.adaptiveRetry.failureMultiplier || 1.1),
        this.config.adaptiveRetry.maxDelay || 30000
      );
      this.stats.adaptiveDelay = this.adaptiveDelay;
    }
  }

  /**
   * Calculate advanced delay with jitter and different strategies
   */
  private calculateAdvancedDelay(attempt: number, error: NetworkError): number {
    let baseDelay: number;

    switch (this.config.retryStrategy || 'exponential') {
      case 'linear':
        baseDelay = this.config.baseDelay * attempt;
        break;
      
      case 'fibonacci':
        baseDelay = this.config.baseDelay * this.fibonacci(attempt);
        break;
      
      case 'adaptive':
        baseDelay = this.adaptiveDelay;
        break;
      
      case 'exponential':
      default:
        baseDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
        break;
    }

    // Apply jitter
    if (this.config.jitter) {
      baseDelay = this.applyJitter(baseDelay, this.config.jitterType || 'full');
    }

    // Cap at max delay
    return Math.min(baseDelay, this.config.maxDelay);
  }

  /**
   * Apply jitter to delay
   */
  private applyJitter(delay: number, jitterType: 'full' | 'equal' | 'decorrelated'): number {
    const random = Math.random();

    switch (jitterType) {
      case 'full':
        // Full jitter: random delay between 0 and calculated delay
        return delay * random;
      
      case 'equal':
        // Equal jitter: delay ± 50% of calculated delay
        return delay * (0.5 + random * 0.5);
      
      case 'decorrelated':
        // Decorrelated jitter: more sophisticated jitter
        return delay * (0.5 + random * 0.5) + (Math.random() * 1000);
      
      default:
        return delay;
    }
  }

  /**
   * Calculate Fibonacci number
   */
  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 1;
    
    let a = 1, b = 1;
    for (let i = 3; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  /**
   * Update average delay
   */
  private updateAverageDelay(delay: number): void {
    if (this.stats.totalAttempts === 1) {
      this.stats.averageDelay = delay;
    } else {
      this.stats.averageDelay = (this.stats.averageDelay * (this.stats.totalAttempts - 1) + delay) / this.stats.totalAttempts;
    }
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: NetworkError): boolean {
    if (this.config.retryCondition) {
      return this.config.retryCondition(error);
    }
    return error.retryable;
  }

  /**
   * Parse error into NetworkError
   */
  private parseError(error: any): NetworkError {
    // This is a simplified version - in practice, you'd use the full parseNetworkError function
    return {
      type: 'unknown',
      message: error.message || 'Unknown error',
      retryable: true,
      originalError: error,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current retry statistics
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * Reset retry statistics
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      averageDelay: 0,
      lastDelay: 0,
      circuitBreakerState: 'closed',
      adaptiveDelay: this.adaptiveDelay,
    };
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
  }
}

/**
 * Validation-specific retry configurations
 */
export const VALIDATION_RETRY_CONFIGS = {
  // For validation start operations
  validationStart: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
    jitterType: 'full' as const,
    retryStrategy: 'exponential' as const,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      recoveryTimeout: 30000,
      halfOpenMaxCalls: 1,
      successThreshold: 1,
    },
    adaptiveRetry: {
      enabled: true,
      baseDelay: 1000,
      maxDelay: 5000,
      successMultiplier: 0.9,
      failureMultiplier: 1.2,
      minDelay: 500,
    },
  },

  // For validation progress polling
  validationProgress: {
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 1.5,
    jitter: true,
    jitterType: 'equal' as const,
    retryStrategy: 'linear' as const,
    circuitBreaker: {
      enabled: false, // Don't use circuit breaker for polling
      failureThreshold: 0,
      recoveryTimeout: 0,
      halfOpenMaxCalls: 0,
      successThreshold: 0,
    },
  },

  // For validation stop operations
  validationStop: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 2,
    jitter: true,
    jitterType: 'decorrelated' as const,
    retryStrategy: 'exponential' as const,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 2,
      recoveryTimeout: 15000,
      halfOpenMaxCalls: 1,
      successThreshold: 1,
    },
  },

  // For validation settings operations
  validationSettings: {
    maxRetries: 3,
    baseDelay: 800,
    maxDelay: 4000,
    backoffMultiplier: 1.8,
    jitter: true,
    jitterType: 'full' as const,
    retryStrategy: 'fibonacci' as const,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 4,
      recoveryTimeout: 20000,
      halfOpenMaxCalls: 2,
      successThreshold: 2,
    },
  },
} as const;

/**
 * Global retry manager registry
 */
class RetryManagerRegistry {
  private managers = new Map<string, AdvancedRetryManager>();

  getManager(operationName: string, config: AdvancedRetryConfig): AdvancedRetryManager {
    const key = `${operationName}-${JSON.stringify(config)}`;
    
    if (!this.managers.has(key)) {
      this.managers.set(key, new AdvancedRetryManager(config, operationName));
    }
    
    return this.managers.get(key)!;
  }

  getStats(operationName: string): RetryStats[] {
    const stats: RetryStats[] = [];
    for (const [key, manager] of this.managers) {
      if (key.startsWith(operationName)) {
        stats.push(manager.getStats());
      }
    }
    return stats;
  }

  resetStats(operationName?: string): void {
    if (operationName) {
      for (const [key, manager] of this.managers) {
        if (key.startsWith(operationName)) {
          manager.resetStats();
        }
      }
    } else {
      for (const manager of this.managers.values()) {
        manager.resetStats();
      }
    }
  }
}

export const retryManagerRegistry = new RetryManagerRegistry();

/**
 * Hook for using advanced retry mechanisms in React components
 */
export function useAdvancedRetry(operationName: string, config: AdvancedRetryConfig) {
  const manager = retryManagerRegistry.getManager(operationName, config);

  const executeWithRetry = async <T>(operation: () => Promise<T>, context?: string): Promise<T> => {
    return manager.execute(operation, context);
  };

  const getStats = (): RetryStats => {
    return manager.getStats();
  };

  const resetStats = (): void => {
    manager.resetStats();
  };

  return {
    executeWithRetry,
    getStats,
    resetStats,
  };
}

/**
 * Utility functions for retry mechanisms
 */
export const RetryUtils = {
  /**
   * Create a retry manager for a specific operation
   */
  createManager(operationName: string, config: AdvancedRetryConfig): AdvancedRetryManager {
    return new AdvancedRetryManager(config, operationName);
  },

  /**
   * Get all retry statistics
   */
  getAllStats(): Record<string, RetryStats[]> {
    const stats: Record<string, RetryStats[]> = {};
    const operations = new Set<string>();
    
    for (const [key] of retryManagerRegistry['managers']) {
      const operationName = key.split('-')[0];
      operations.add(operationName);
    }
    
    for (const operation of operations) {
      stats[operation] = retryManagerRegistry.getStats(operation);
    }
    
    return stats;
  },

  /**
   * Reset all retry statistics
   */
  resetAllStats(): void {
    retryManagerRegistry.resetStats();
  },

  /**
   * Get circuit breaker status for all operations
   */
  getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};
    const stats = this.getAllStats();
    
    for (const [operation, operationStats] of Object.entries(stats)) {
      if (operationStats.length > 0) {
        status[operation] = operationStats[0].circuitBreakerState as CircuitBreakerState;
      }
    }
    
    return status;
  },
};
