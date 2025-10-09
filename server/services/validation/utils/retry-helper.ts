/**
 * Retry Helper Utility
 * 
 * Provides retry logic with exponential backoff for validation operations.
 * Used by HAPI validator client and other services that need resilient external calls.
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry attempts
 * - Timeout handling
 * - Error classification (retryable vs non-retryable)
 * 
 * File size: Target <200 lines (utility module)
 */

// ============================================================================
// Types
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  
  /** Initial delay in milliseconds (default: 1000ms) */
  initialDelay?: number;
  
  /** Maximum delay in milliseconds (default: 10000ms) */
  maxDelay?: number;
  
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  
  /** Add jitter to delays (default: true) */
  useJitter?: boolean;
  
  /** Timeout for each attempt in milliseconds (default: 30000ms) */
  timeout?: number;
  
  /** Function to determine if error is retryable (default: all errors retryable) */
  isRetryable?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  /** Result of the operation */
  result: T;
  
  /** Number of attempts made */
  attempts: number;
  
  /** Total time taken including retries */
  totalTime: number;
  
  /** Whether any retries were needed */
  hadRetries: boolean;
}

export interface RetryError extends Error {
  attempts: number;
  lastError: Error;
  allErrors: Error[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  useJitter: true,
  timeout: 30000,
  isRetryable: () => true, // All errors retryable by default
};

// ============================================================================
// Retry Helper
// ============================================================================

/**
 * Execute an operation with retry logic and exponential backoff
 * 
 * @param operation - Async function to execute
 * @param config - Retry configuration
 * @returns Result with retry metadata
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const errors: Error[] = [];
  
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      console.log(`[RetryHelper] Attempt ${attempt}/${cfg.maxAttempts}`);
      
      // Execute operation with timeout
      const result = await executeWithTimeout(operation, cfg.timeout);
      
      const totalTime = Date.now() - startTime;
      console.log(`[RetryHelper] Success on attempt ${attempt} (${totalTime}ms total)`);
      
      return {
        result,
        attempts: attempt,
        totalTime,
        hadRetries: attempt > 1,
      };
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      
      console.warn(`[RetryHelper] Attempt ${attempt} failed:`, err.message);
      
      // Check if error is retryable
      if (!cfg.isRetryable(err)) {
        console.log(`[RetryHelper] Error not retryable, failing immediately`);
        throw createRetryError(errors, attempt);
      }
      
      // If last attempt, throw
      if (attempt === cfg.maxAttempts) {
        console.error(`[RetryHelper] All ${cfg.maxAttempts} attempts failed`);
        throw createRetryError(errors, attempt);
      }
      
      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, cfg);
      console.log(`[RetryHelper] Waiting ${delay}ms before retry ${attempt + 1}`);
      
      // Wait before next attempt
      await sleep(delay);
    }
  }
  
  // Should never reach here
  throw createRetryError(errors, cfg.maxAttempts);
}

/**
 * Execute operation with timeout
 */
async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  // Exponential backoff: initialDelay * (backoffMultiplier ^ (attempt - 1))
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  
  // Cap at maxDelay
  delay = Math.min(delay, config.maxDelay);
  
  // Add jitter to avoid thundering herd
  if (config.useJitter) {
    // Random jitter: ±20% of calculated delay
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    delay = delay + jitter;
  }
  
  return Math.round(delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a comprehensive retry error
 */
function createRetryError(errors: Error[], attempts: number): RetryError {
  const retryError = new Error(
    `Operation failed after ${attempts} attempts. Last error: ${errors[errors.length - 1].message}`
  ) as RetryError;
  
  retryError.name = 'RetryError';
  retryError.attempts = attempts;
  retryError.lastError = errors[errors.length - 1];
  retryError.allErrors = errors;
  
  return retryError;
}

// ============================================================================
// Error Classification Helpers
// ============================================================================

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
  return error.message.includes('timeout') || error.message.includes('timed out');
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('econnrefused') ||
         message.includes('enotfound') ||
         message.includes('enetunreach') ||
         message.includes('econnreset') ||
         message.includes('network');
}

/**
 * Check if error is retryable (default: timeout and network errors)
 */
export function isRetryableError(error: Error): boolean {
  return isTimeoutError(error) || isNetworkError(error);
}

/**
 * Check if error is a Java/HAPI specific error that should not be retried
 */
export function isNonRetryableHapiError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Non-retryable HAPI errors
  return message.includes('invalid resource') ||
         message.includes('validation failed') ||
         message.includes('parse error') ||
         message.includes('invalid json') ||
         message.includes('java.lang.illegalargumentexception');
}

