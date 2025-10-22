/**
 * Retry Handler
 * 
 * Implements retry logic with exponential backoff for failed requests.
 * Handles transient errors like 503, 429, timeouts, and network issues.
 */

interface RetryConfig {
  maxRetries: number;
  delays: number[];
  retryableStatuses: number[];
  retryableErrors: string[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  delays: [1000, 2000, 4000], // 1s, 2s, 4s
  retryableStatuses: [429, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
};

export interface RetryOptions {
  requestId?: string;
  config?: Partial<RetryConfig>;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, config: RetryConfig): boolean {
  // Check HTTP status codes
  if (error.response?.status && config.retryableStatuses.includes(error.response.status)) {
    return true;
  }
  
  if (error.statusCode && config.retryableStatuses.includes(error.statusCode)) {
    return true;
  }

  // Check error codes
  if (error.code && config.retryableErrors.includes(error.code)) {
    return true;
  }

  // Check error message
  const errorMessage = error.message?.toLowerCase() || '';
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('503') ||
    errorMessage.includes('429') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('service unavailable') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('socket hang up')
  ) {
    return true;
  }

  return false;
}

/**
 * Delay for a specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config: RetryConfig = {
    ...DEFAULT_CONFIG,
    ...options.config,
  };

  const requestId = options.requestId || 'unknown';
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = config.delays[attempt - 1] || config.delays[config.delays.length - 1];
        console.log(`[RetryHandler] Attempt ${attempt + 1}/${config.maxRetries + 1} for ${requestId} after ${delayMs}ms delay`);
        await delay(delayMs);
      }

      const result = await fn();
      
      if (attempt > 0) {
        console.log(`[RetryHandler] Success on attempt ${attempt + 1} for ${requestId}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;

      const isRetryable = isRetryableError(error, config);
      const isLastAttempt = attempt >= config.maxRetries;

      if (!isRetryable || isLastAttempt) {
        if (isLastAttempt && isRetryable) {
          console.error(`[RetryHandler] All ${config.maxRetries + 1} attempts failed for ${requestId}`);
        } else {
          console.error(`[RetryHandler] Non-retryable error for ${requestId}:`, error instanceof Error ? error.message : error);
        }
        throw error;
      }

      console.warn(`[RetryHandler] Retryable error for ${requestId} (attempt ${attempt + 1}):`, error instanceof Error ? error.message : error);

      if (options.onRetry) {
        options.onRetry(attempt + 1, error);
      }
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for a function
 */
export function createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Omit<RetryOptions, 'requestId'> = {}
): T {
  return (async (...args: any[]) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}

/**
 * Batch execute with retry - processes items in batches with retry logic for each item
 */
export async function batchExecuteWithRetry<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: {
    batchSize: number;
    batchDelay?: number;
    retryOptions?: RetryOptions;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{ results: R[]; errors: Map<T, any> }> {
  const { batchSize, batchDelay = 100, retryOptions = {}, onProgress } = options;
  const results: R[] = [];
  const errors = new Map<T, any>();

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    console.log(`[BatchExecute] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)`);

    const batchPromises = batch.map(async (item) => {
      try {
        const result = await withRetry(
          () => fn(item),
          {
            ...retryOptions,
            requestId: retryOptions.requestId ? `${retryOptions.requestId}-${i}` : undefined,
          }
        );
        results.push(result);
      } catch (error) {
        errors.set(item, error);
        console.error(`[BatchExecute] Failed to process item:`, error instanceof Error ? error.message : error);
      }
    });

    await Promise.all(batchPromises);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }

    // Add delay between batches (except after the last batch)
    if (i + batchSize < items.length && batchDelay > 0) {
      await delay(batchDelay);
    }
  }

  return { results, errors };
}

