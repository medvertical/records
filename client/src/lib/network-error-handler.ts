import { toast } from '@/hooks/use-toast';

/**
 * Comprehensive network error handling utilities for validation control panel
 */

export interface NetworkError {
  type: 'network' | 'timeout' | 'server' | 'client' | 'unknown';
  message: string;
  status?: number;
  statusText?: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  originalError?: Error;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryCondition?: (error: NetworkError) => boolean;
}

export interface NetworkErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  retryConfig?: RetryConfig;
  onRetry?: (error: NetworkError, attempt: number) => void;
  onMaxRetriesReached?: (error: NetworkError) => void;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error: NetworkError) => error.retryable,
};

/**
 * Network error types and their characteristics
 */
export const NETWORK_ERROR_TYPES = {
  NETWORK: {
    type: 'network' as const,
    retryable: true,
    message: 'Network connection failed',
  },
  TIMEOUT: {
    type: 'timeout' as const,
    retryable: true,
    message: 'Request timed out',
  },
  SERVER_ERROR: {
    type: 'server' as const,
    retryable: true,
    message: 'Server error occurred',
  },
  CLIENT_ERROR: {
    type: 'client' as const,
    retryable: false,
    message: 'Client error occurred',
  },
  UNKNOWN: {
    type: 'unknown' as const,
    retryable: true,
    message: 'Unknown error occurred',
  },
} as const;

/**
 * HTTP status codes that are retryable
 */
export const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Parse an error into a NetworkError object
 */
export function parseNetworkError(error: any, response?: Response): NetworkError {
  // Network error (no response)
  if (!response && error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network connection failed. Please check your internet connection.',
      retryable: true,
      originalError: error,
    };
  }

  // Timeout error
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return {
      type: 'timeout',
      message: 'Request timed out. The server is taking too long to respond.',
      retryable: true,
      originalError: error,
    };
  }

  // HTTP response error
  if (response) {
    const status = response.status;
    const statusText = response.statusText;

    if (status >= 500) {
      return {
        type: 'server',
        message: `Server error (${status}): ${statusText}`,
        status,
        statusText,
        retryable: RETRYABLE_STATUS_CODES.includes(status),
        originalError: error,
      };
    }

    if (status >= 400) {
      return {
        type: 'client',
        message: `Client error (${status}): ${statusText}`,
        status,
        statusText,
        retryable: false,
        originalError: error,
      };
    }
  }

  // Unknown error
  return {
    type: 'unknown',
    message: error.message || 'An unexpected error occurred',
    retryable: true,
    originalError: error,
  };
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhanced fetch with retry logic and error handling
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: NetworkError | null = null;

  for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = parseNetworkError(new Error(`HTTP ${response.status}`), response);
        lastError = error;

        if (attempt < retryConfig.maxRetries && retryConfig.retryCondition?.(error)) {
          const delay = calculateRetryDelay(attempt, retryConfig);
          console.log(`[NetworkErrorHandler] Retrying request (attempt ${attempt + 1}/${retryConfig.maxRetries}) after ${delay}ms`);
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (error) {
      const networkError = parseNetworkError(error);
      lastError = networkError;

      if (attempt < retryConfig.maxRetries && retryConfig.retryCondition?.(networkError)) {
        const delay = calculateRetryDelay(attempt, retryConfig);
        console.log(`[NetworkErrorHandler] Retrying request (attempt ${attempt + 1}/${retryConfig.maxRetries}) after ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || parseNetworkError(new Error('Max retries reached'));
}

/**
 * Network error handler with toast notifications
 */
export class NetworkErrorHandler {
  private options: NetworkErrorHandlerOptions;

  constructor(options: NetworkErrorHandlerOptions = {}) {
    this.options = {
      showToast: true,
      logError: true,
      retryConfig: DEFAULT_RETRY_CONFIG,
      ...options,
    };
  }

  /**
   * Handle a network error with appropriate user feedback
   */
  handleError(error: NetworkError, context?: string): void {
    if (this.options.logError) {
      console.error(`[NetworkErrorHandler] ${context || 'Network error'}:`, error);
    }

    if (this.options.showToast) {
      this.showErrorToast(error, context);
    }
  }

  /**
   * Show appropriate toast notification for the error
   */
  private showErrorToast(error: NetworkError, context?: string): void {
    const title = this.getErrorTitle(error, context);
    const description = this.getErrorDescription(error);

    toast({
      title,
      description,
      variant: 'destructive',
    });
  }

  /**
   * Get error title based on error type and context
   */
  private getErrorTitle(error: NetworkError, context?: string): string {
    const contextPrefix = context ? `${context}: ` : '';
    
    switch (error.type) {
      case 'network':
        return `${contextPrefix}Connection Failed`;
      case 'timeout':
        return `${contextPrefix}Request Timeout`;
      case 'server':
        return `${contextPrefix}Server Error`;
      case 'client':
        return `${contextPrefix}Request Error`;
      default:
        return `${contextPrefix}Error`;
    }
  }

  /**
   * Get error description with helpful information
   */
  private getErrorDescription(error: NetworkError): string {
    let description = error.message;

    if (error.retryable) {
      description += ' The request will be retried automatically.';
    }

    if (error.retryAfter) {
      description += ` Retry after ${error.retryAfter} seconds.`;
    }

    return description;
  }

  /**
   * Execute a function with retry logic and error handling
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: NetworkError | null = null;
    const config = this.options.retryConfig!;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const networkError = parseNetworkError(error);
        lastError = networkError;

        if (attempt < config.maxRetries && config.retryCondition?.(networkError)) {
          this.options.onRetry?.(networkError, attempt);
          const delay = calculateRetryDelay(attempt, config);
          await sleep(delay);
          continue;
        }
      }
    }

    if (lastError) {
      this.handleError(lastError, context);
      this.options.onMaxRetriesReached?.(lastError);
    }

    throw lastError || parseNetworkError(new Error('Max retries reached'));
  }
}

/**
 * Global network error handler instance
 */
export const networkErrorHandler = new NetworkErrorHandler();

/**
 * Hook for network error handling in React components
 */
export function useNetworkErrorHandler(options?: NetworkErrorHandlerOptions) {
  const handler = new NetworkErrorHandler(options);

  const handleNetworkError = (error: any, context?: string) => {
    const networkError = parseNetworkError(error);
    handler.handleError(networkError, context);
  };

  const executeWithRetry = <T>(fn: () => Promise<T>, context?: string) => {
    return handler.executeWithRetry(fn, context);
  };

  return {
    handleNetworkError,
    executeWithRetry,
    parseNetworkError,
  };
}

/**
 * Utility functions for common network operations
 */
export const NetworkUtils = {
  /**
   * Check if the user is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  },

  /**
   * Get connection quality indicator
   */
  getConnectionQuality(): 'good' | 'poor' | 'offline' {
    if (!navigator.onLine) return 'offline';
    
    // Simple heuristic based on navigator.connection if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return 'poor';
      }
    }
    
    return 'good';
  },

  /**
   * Create a timeout promise
   */
  timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });
  },

  /**
   * Race a promise against a timeout
   */
  withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      this.timeout(ms),
    ]);
  },
};

