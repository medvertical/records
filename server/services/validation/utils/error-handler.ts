/**
 * Comprehensive Error Handler for FHIR Validation
 * 
 * Provides robust error handling with try-catch blocks, graceful degradation,
 * retry logic, detailed logging, and user-friendly error messages.
 */

export interface ErrorContext {
  validator?: string;
  resourceType?: string;
  resourceId?: string;
  operation?: string;
  externalService?: string;
  timestamp?: Date;
  retryAttempt?: number;
  maxRetries?: number;
}

export interface ErrorDetails {
  type: 'validation' | 'network' | 'timeout' | 'service' | 'data' | 'unknown';
  code: string;
  message: string;
  context: ErrorContext;
  stack?: string;
  cause?: Error;
  userMessage?: string;
  technicalMessage?: string;
  retryable?: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export class ValidationErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'HTTP_5XX',
      'HTTP_429',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT'
    ]
  };

  /**
   * Execute a function with comprehensive error handling
   */
  static async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.DEFAULT_RETRY_CONFIG, ...retryConfig };
    let lastError: ErrorDetails | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        this.logOperationStart(context, attempt);
        const result = await operation();
        this.logOperationSuccess(context, attempt);
        return result;
      } catch (error) {
        const errorDetails = this.createErrorDetails(error, context, attempt, config.maxAttempts);
        lastError = errorDetails;
        
        this.logError(errorDetails);
        
        // Check if we should retry
        if (attempt < config.maxAttempts && this.shouldRetry(errorDetails, config)) {
          const delay = this.calculateRetryDelay(attempt, config);
          this.logRetryAttempt(errorDetails, attempt + 1, delay);
          await this.sleep(delay);
          continue;
        } else {
          // No more retries, throw the error
          throw this.createUserFriendlyError(errorDetails);
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw this.createUserFriendlyError(lastError!);
  }

  /**
   * Execute external service calls with enhanced error handling
   */
  static async executeExternalServiceCall<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: {
      timeout?: number;
      retryConfig?: Partial<RetryConfig>;
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    const enhancedContext = {
      ...context,
      externalService: serviceName,
      operation: operation.name || 'external-service-call'
    };

    try {
      return await this.executeWithErrorHandling(operation, enhancedContext, options?.retryConfig);
    } catch (error) {
      // Try fallback if available
      if (options?.fallback) {
        try {
          this.logFallbackAttempt(enhancedContext);
          return await options.fallback();
        } catch (fallbackError) {
          this.logFallbackFailure(enhancedContext, fallbackError);
          throw error; // Throw original error, not fallback error
        }
      }
      throw error;
    }
  }

  /**
   * Create detailed error information
   */
  private static createErrorDetails(
    error: any,
    context: ErrorContext,
    attempt: number,
    maxAttempts: number
  ): ErrorDetails {
    const errorType = this.determineErrorType(error);
    const errorCode = this.extractErrorCode(error);
    const severity = this.determineErrorSeverity(error, errorType);
    const retryable = this.isRetryableError(error, errorCode);

    return {
      type: errorType,
      code: errorCode,
      message: error instanceof Error ? error.message : String(error),
      context: {
        ...context,
        retryAttempt: attempt,
        maxRetries: maxAttempts,
        timestamp: new Date()
      },
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error : undefined,
      userMessage: this.createUserFriendlyMessage(error, context, errorType),
      technicalMessage: this.createTechnicalMessage(error, context, errorType),
      retryable,
      severity
    };
  }

  /**
   * Determine error type based on error characteristics
   */
  private static determineErrorType(error: any): ErrorDetails['type'] {
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.name === 'AbortError') {
        return 'timeout';
      }
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return 'network';
      }
      if (error.message.includes('HTTP') || error.message.includes('status')) {
        return 'service';
      }
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return 'validation';
      }
      if (error.message.includes('parse') || error.message.includes('JSON')) {
        return 'data';
      }
    }
    return 'unknown';
  }

  /**
   * Extract error code from error
   */
  private static extractErrorCode(error: any): string {
    if (error instanceof Error) {
      // HTTP status codes
      const statusMatch = error.message.match(/HTTP (\d+)/);
      if (statusMatch) {
        return `HTTP_${statusMatch[1]}`;
      }

      // Network error codes
      if (error.message.includes('ECONNRESET')) return 'ECONNRESET';
      if (error.message.includes('ETIMEDOUT')) return 'ETIMEDOUT';
      if (error.message.includes('ENOTFOUND')) return 'ENOTFOUND';
      if (error.message.includes('ECONNREFUSED')) return 'ECONNREFUSED';

      // Timeout errors
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return 'TIMEOUT';
      }

      // Service errors
      if (error.message.includes('service unavailable')) return 'SERVICE_UNAVAILABLE';
      if (error.message.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Determine error severity
   */
  private static determineErrorSeverity(error: any, errorType: ErrorDetails['type']): ErrorDetails['severity'] {
    if (errorType === 'network' || errorType === 'timeout') {
      return 'medium';
    }
    if (errorType === 'service') {
      const statusMatch = error.message?.match(/HTTP (\d+)/);
      if (statusMatch) {
        const status = parseInt(statusMatch[1]);
        if (status >= 500) return 'high';
        if (status >= 400) return 'medium';
      }
      return 'low';
    }
    if (errorType === 'validation') {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: any, errorCode: string): boolean {
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'HTTP_5XX',
      'HTTP_429',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT'
    ];

    return retryableCodes.some(code => errorCode.includes(code));
  }

  /**
   * Check if we should retry based on error and configuration
   */
  private static shouldRetry(errorDetails: ErrorDetails, config: RetryConfig): boolean {
    if (!errorDetails.retryable) return false;
    
    const isRetryableCode = config.retryableErrors.some(code => 
      errorDetails.code.includes(code)
    );
    
    return isRetryableCode && errorDetails.context.retryAttempt! < config.maxAttempts;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private static calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Create user-friendly error message
   */
  private static createUserFriendlyMessage(
    error: any,
    context: ErrorContext,
    errorType: ErrorDetails['type']
  ): string {
    const service = context.externalService || 'validation service';
    const resource = context.resourceType || 'resource';

    switch (errorType) {
      case 'network':
        return `Unable to connect to ${service}. Please check your internet connection and try again.`;
      case 'timeout':
        return `The ${service} is taking too long to respond. Please try again in a moment.`;
      case 'service':
        return `The ${service} is temporarily unavailable. Please try again later.`;
      case 'validation':
        return `There was an issue validating the ${resource}. Please check the data and try again.`;
      case 'data':
        return `There was an issue processing the ${resource} data. Please verify the format and try again.`;
      default:
        return `An unexpected error occurred while processing the ${resource}. Please try again.`;
    }
  }

  /**
   * Create technical error message for logging
   */
  private static createTechnicalMessage(
    error: any,
    context: ErrorContext,
    errorType: ErrorDetails['type']
  ): string {
    const details = [
      `Type: ${errorType}`,
      `Service: ${context.externalService || 'unknown'}`,
      `Operation: ${context.operation || 'unknown'}`,
      `Resource: ${context.resourceType || 'unknown'}`,
      `Attempt: ${context.retryAttempt || 1}/${context.maxRetries || 1}`
    ];

    return `${error instanceof Error ? error.message : String(error)} (${details.join(', ')})`;
  }

  /**
   * Create user-friendly error for throwing
   */
  private static createUserFriendlyError(errorDetails: ErrorDetails): Error {
    const error = new Error(errorDetails.userMessage || errorDetails.message);
    (error as any).errorDetails = errorDetails;
    (error as any).isValidationError = true;
    return error;
  }

  /**
   * Log operation start
   */
  private static logOperationStart(context: ErrorContext, attempt: number): void {
    const message = `[ErrorHandler] Starting ${context.operation || 'operation'} on ${context.externalService || 'service'}`;
    const details = [
      `Resource: ${context.resourceType || 'unknown'}`,
      `Attempt: ${attempt}`,
      `Validator: ${context.validator || 'unknown'}`
    ];
    console.log(`${message} (${details.join(', ')})`);
  }

  /**
   * Log operation success
   */
  private static logOperationSuccess(context: ErrorContext, attempt: number): void {
    const message = `[ErrorHandler] ✅ Successfully completed ${context.operation || 'operation'} on ${context.externalService || 'service'}`;
    const details = [
      `Resource: ${context.resourceType || 'unknown'}`,
      `Attempt: ${attempt}`,
      `Validator: ${context.validator || 'unknown'}`
    ];
    console.log(`${message} (${details.join(', ')})`);
  }

  /**
   * Log error details
   */
  private static logError(errorDetails: ErrorDetails): void {
    const { context, type, code, message, severity } = errorDetails;
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    
    const logMessage = `[ErrorHandler] ${logLevel.toUpperCase()} ${type.toUpperCase()} error in ${context.externalService || 'service'}`;
    const details = [
      `Code: ${code}`,
      `Message: ${message}`,
      `Severity: ${severity}`,
      `Resource: ${context.resourceType || 'unknown'}`,
      `Attempt: ${context.retryAttempt || 1}/${context.maxRetries || 1}`,
      `Retryable: ${errorDetails.retryable ? 'Yes' : 'No'}`
    ];
    
    console[logLevel](`${logMessage} (${details.join(', ')})`);
    
    if (errorDetails.stack && severity === 'critical') {
      console.error('[ErrorHandler] Stack trace:', errorDetails.stack);
    }
  }

  /**
   * Log retry attempt
   */
  private static logRetryAttempt(errorDetails: ErrorDetails, nextAttempt: number, delay: number): void {
    console.warn(`[ErrorHandler] 🔄 Retrying ${errorDetails.context.operation || 'operation'} in ${delay}ms (attempt ${nextAttempt}/${errorDetails.context.maxRetries})`);
  }

  /**
   * Log fallback attempt
   */
  private static logFallbackAttempt(context: ErrorContext): void {
    console.warn(`[ErrorHandler] 🔄 Attempting fallback for ${context.externalService || 'service'} ${context.operation || 'operation'}`);
  }

  /**
   * Log fallback failure
   */
  private static logFallbackFailure(context: ErrorContext, error: any): void {
    console.error(`[ErrorHandler] ❌ Fallback failed for ${context.externalService || 'service'} ${context.operation || 'operation'}:`, error.message);
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrap external service calls with comprehensive error handling
   */
  static wrapExternalServiceCall<T extends any[], R>(
    serviceName: string,
    fn: (...args: T) => Promise<R>,
    options?: {
      retryConfig?: Partial<RetryConfig>;
      fallback?: (...args: T) => Promise<R>;
    }
  ) {
    return async (...args: T): Promise<R> => {
      const context: ErrorContext = {
        externalService: serviceName,
        operation: fn.name || 'external-service-call'
      };

      return this.executeExternalServiceCall(
        serviceName,
        () => fn(...args),
        context,
        options
      );
    };
  }
}
