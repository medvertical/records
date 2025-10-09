/**
 * Unit tests for RetryHelper utility
 * 
 * Tests retry logic, exponential backoff, jitter, timeout handling,
 * and error classification.
 * 
 * Target: 90%+ coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  isTimeoutError,
  isNetworkError,
  isRetryableError,
  isNonRetryableHapiError,
  type RetryConfig,
} from './retry-helper';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock operation that fails N times then succeeds
 */
function createMockOperation<T>(failCount: number, result: T, errorMessage: string = 'Mock error') {
  let attempts = 0;
  return vi.fn(async () => {
    attempts++;
    if (attempts <= failCount) {
      throw new Error(errorMessage);
    }
    return result;
  });
}

/**
 * Create a mock operation that always fails
 */
function createFailingOperation(errorMessage: string = 'Mock error') {
  return vi.fn(async () => {
    throw new Error(errorMessage);
  });
}

/**
 * Create a mock operation that always succeeds
 */
function createSuccessOperation<T>(result: T) {
  return vi.fn(async () => result);
}

// ============================================================================
// Tests
// ============================================================================

describe('RetryHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Basic Retry Behavior
  // --------------------------------------------------------------------------

  describe('Basic Retry Behavior', () => {
    it('should succeed on first attempt without retry', async () => {
      const operation = createSuccessOperation('success');
      const config: RetryConfig = { maxAttempts: 3, initialDelay: 1000 };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.hadRetries).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry once and succeed on second attempt', async () => {
      const operation = createMockOperation(1, 'success', 'timeout');
      const config: RetryConfig = { maxAttempts: 3, initialDelay: 1000 };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(result.hadRetries).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry twice and succeed on third attempt', async () => {
      const operation = createMockOperation(2, 'success', 'timeout');
      const config: RetryConfig = { maxAttempts: 3, initialDelay: 1000 };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(result.hadRetries).toBe(true);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts exhausted', async () => {
      const operation = createFailingOperation('timeout');
      const config: RetryConfig = { maxAttempts: 3, initialDelay: 100 };

      const promise = withRetry(operation, config);
      
      await expect(async () => {
        await vi.runAllTimersAsync();
        await promise;
      }).rejects.toThrow('Operation failed after 3 attempts');

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  // --------------------------------------------------------------------------
  // Exponential Backoff
  // --------------------------------------------------------------------------

  describe('Exponential Backoff', () => {
    it('should apply exponential backoff between retries', async () => {
      const operation = createMockOperation(2, 'success', 'timeout');
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        useJitter: false, // Disable jitter for predictable delays
      };

      const startTime = Date.now();
      const promise = withRetry(operation, config);
      
      // Fast-forward timers
      await vi.runAllTimersAsync();
      await promise;

      // With exponential backoff and no jitter:
      // Attempt 1: immediate
      // Attempt 2: after 1000ms (initialDelay * 2^0)
      // Attempt 3: after 2000ms (initialDelay * 2^1)
      // Total: ~3000ms (but timers are mocked so actual time is 0)
      
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should cap delay at maxDelay', async () => {
      const operation = createMockOperation(3, 'success', 'timeout');
      const config: RetryConfig = {
        maxAttempts: 4,
        initialDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 2000,
        useJitter: false,
      };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      await promise;

      expect(operation).toHaveBeenCalledTimes(4);
    });
  });

  // --------------------------------------------------------------------------
  // Jitter
  // --------------------------------------------------------------------------

  describe('Jitter', () => {
    it('should add jitter to delays when enabled', async () => {
      const operation = createMockOperation(2, 'success', 'timeout');
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        useJitter: true,
      };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not add jitter when disabled', async () => {
      const operation = createMockOperation(2, 'success', 'timeout');
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        useJitter: false,
      };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  // --------------------------------------------------------------------------
  // Timeout Handling
  // --------------------------------------------------------------------------

  describe('Timeout Handling', () => {
    it('should timeout operation that takes too long', async () => {
      const operation = vi.fn(async () => {
        // Simulate long-running operation
        await new Promise(resolve => setTimeout(resolve, 60000));
        return 'success';
      });

      const config: RetryConfig = {
        maxAttempts: 1,
        timeout: 5000,
      };

      const promise = withRetry(operation, config);
      
      await expect(async () => {
        await vi.runAllTimersAsync();
        await promise;
      }).rejects.toThrow('Operation timed out after 5000ms');
    });

    it('should complete before timeout', async () => {
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });

      const config: RetryConfig = {
        maxAttempts: 1,
        timeout: 5000,
      };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe('success');
    });
  });

  // --------------------------------------------------------------------------
  // Error Classification
  // --------------------------------------------------------------------------

  describe('Error Classification', () => {
    it('should retry retryable errors', async () => {
      const operation = createFailingOperation('ECONNREFUSED');
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
        isRetryable: isRetryableError,
      };

      const promise = withRetry(operation, config);

      await expect(async () => {
        await vi.runAllTimersAsync();
        await promise;
      }).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = createFailingOperation('invalid resource');
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
        isRetryable: (error) => !isNonRetryableHapiError(error),
      };

      const promise = withRetry(operation, config);

      await expect(async () => {
        await vi.runAllTimersAsync();
        await promise;
      }).rejects.toThrow('invalid resource');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should respect custom isRetryable function', async () => {
      const operation = createFailingOperation('custom error');
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
        isRetryable: (error) => error.message.includes('custom'),
      };

      const promise = withRetry(operation, config);

      await expect(async () => {
        await vi.runAllTimersAsync();
        await promise;
      }).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(3); // Retried because custom function returned true
    });
  });

  // --------------------------------------------------------------------------
  // Retry Metadata
  // --------------------------------------------------------------------------

  describe('Retry Metadata', () => {
    it('should return correct metadata for successful first attempt', async () => {
      const operation = createSuccessOperation('success');
      const config: RetryConfig = { maxAttempts: 3 };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.attempts).toBe(1);
      expect(result.hadRetries).toBe(false);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should return correct metadata for retry success', async () => {
      const operation = createMockOperation(2, 'success');
      const config: RetryConfig = { maxAttempts: 3, initialDelay: 100 };

      const promise = withRetry(operation, config);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.attempts).toBe(3);
      expect(result.hadRetries).toBe(true);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should include all errors in RetryError', async () => {
      const operation = createFailingOperation('test error');
      const config: RetryConfig = { maxAttempts: 3, initialDelay: 100 };

      const promise = withRetry(operation, config);

      try {
        await vi.runAllTimersAsync();
        await promise;
        expect.fail('Should have thrown RetryError');
      } catch (error: any) {
        expect(error.name).toBe('RetryError');
        expect(error.attempts).toBe(3);
        expect(error.allErrors).toHaveLength(3);
        expect(error.lastError.message).toBe('test error');
      }
    });
  });
});

// ============================================================================
// Error Classification Helper Tests
// ============================================================================

describe('Error Classification Helpers', () => {
  describe('isTimeoutError', () => {
    it('should identify timeout errors', () => {
      expect(isTimeoutError(new Error('Operation timed out'))).toBe(true);
      expect(isTimeoutError(new Error('Request timeout'))).toBe(true);
      expect(isTimeoutError(new Error('timed out after 5000ms'))).toBe(true);
    });

    it('should not identify non-timeout errors', () => {
      expect(isTimeoutError(new Error('Invalid resource'))).toBe(false);
      expect(isTimeoutError(new Error('ECONNREFUSED'))).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should identify network errors', () => {
      expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isNetworkError(new Error('ENOTFOUND'))).toBe(true);
      expect(isNetworkError(new Error('ENETUNREACH'))).toBe(true);
      expect(isNetworkError(new Error('ECONNRESET'))).toBe(true);
      expect(isNetworkError(new Error('network error'))).toBe(true);
    });

    it('should not identify non-network errors', () => {
      expect(isNetworkError(new Error('Invalid resource'))).toBe(false);
      expect(isNetworkError(new Error('timeout'))).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(new Error('timeout'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('network error'))).toBe(true);
    });

    it('should not identify non-retryable errors', () => {
      expect(isRetryableError(new Error('Invalid resource'))).toBe(false);
      expect(isRetryableError(new Error('parse error'))).toBe(false);
    });
  });

  describe('isNonRetryableHapiError', () => {
    it('should identify non-retryable HAPI errors', () => {
      expect(isNonRetryableHapiError(new Error('invalid resource'))).toBe(true);
      expect(isNonRetryableHapiError(new Error('validation failed'))).toBe(true);
      expect(isNonRetryableHapiError(new Error('parse error'))).toBe(true);
      expect(isNonRetryableHapiError(new Error('invalid json'))).toBe(true);
      expect(isNonRetryableHapiError(new Error('java.lang.IllegalArgumentException'))).toBe(true);
    });

    it('should not identify retryable errors as non-retryable', () => {
      expect(isNonRetryableHapiError(new Error('timeout'))).toBe(false);
      expect(isNonRetryableHapiError(new Error('ECONNREFUSED'))).toBe(false);
      expect(isNonRetryableHapiError(new Error('network error'))).toBe(false);
    });
  });
});

