/**
 * Validation Settings Service Errors - Rock Solid Error Handling
 * 
 * This module provides comprehensive error handling for the validation settings service
 * with proper error types, recovery strategies, and user-friendly messages.
 */

// ============================================================================
// Error Types and Classes
// ============================================================================

export enum ValidationSettingsErrorCode {
  // Initialization errors
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SERVICE_NOT_INITIALIZED = 'SERVICE_NOT_INITIALIZED',
  
  // Database errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_OPERATION_FAILED = 'DATABASE_OPERATION_FAILED',
  SETTINGS_NOT_FOUND = 'SETTINGS_NOT_FOUND',
  SETTINGS_ALREADY_EXISTS = 'SETTINGS_ALREADY_EXISTS',
  
  // Validation errors
  INVALID_SETTINGS = 'INVALID_SETTINGS',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SETTINGS_CONFLICT = 'SETTINGS_CONFLICT',
  
  // Cache errors
  CACHE_OPERATION_FAILED = 'CACHE_OPERATION_FAILED',
  CACHE_CORRUPTION = 'CACHE_CORRUPTION',
  
  // Configuration errors
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Permission errors
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // System errors
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  MANUAL_INTERVENTION = 'manual_intervention',
  SYSTEM_RESTART = 'system_restart'
}

export interface ValidationSettingsErrorContext {
  operation?: string;
  settingsId?: string;
  userId?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
  loadTime?: number;
  backupId?: string;
  version?: number;
  fallbackUsed?: boolean;
  migrationApplied?: boolean;
}

export class ValidationSettingsError extends Error {
  public readonly code: ValidationSettingsErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly context: ValidationSettingsErrorContext;
  public readonly isRetryable: boolean;
  public readonly userMessage: string;
  public readonly technicalMessage: string;

  constructor(
    code: ValidationSettingsErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      recoveryStrategy?: RecoveryStrategy;
      isRetryable?: boolean;
      userMessage?: string;
      context?: ValidationSettingsErrorContext;
    } = {}
  ) {
    super(message);
    
    this.name = 'ValidationSettingsError';
    this.code = code;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.recoveryStrategy = options.recoveryStrategy || RecoveryStrategy.MANUAL_INTERVENTION;
    this.isRetryable = options.isRetryable || false;
    this.userMessage = options.userMessage || this.getDefaultUserMessage(code);
    this.technicalMessage = message;
    this.context = {
      timestamp: new Date(),
      ...options.context
    };

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, ValidationSettingsError.prototype);
  }

  private getDefaultUserMessage(code: ValidationSettingsErrorCode): string {
    const userMessages: Record<ValidationSettingsErrorCode, string> = {
      [ValidationSettingsErrorCode.INITIALIZATION_FAILED]: 'Failed to initialize settings service. Please try again or contact support.',
      [ValidationSettingsErrorCode.SERVICE_NOT_INITIALIZED]: 'Settings service is not ready. Please wait a moment and try again.',
      [ValidationSettingsErrorCode.DATABASE_CONNECTION_FAILED]: 'Unable to connect to database. Please check your connection and try again.',
      [ValidationSettingsErrorCode.DATABASE_OPERATION_FAILED]: 'Database operation failed. Please try again or contact support.',
      [ValidationSettingsErrorCode.SETTINGS_NOT_FOUND]: 'The requested settings could not be found.',
      [ValidationSettingsErrorCode.SETTINGS_ALREADY_EXISTS]: 'Settings with this configuration already exist.',
      [ValidationSettingsErrorCode.INVALID_SETTINGS]: 'The provided settings are invalid. Please check your input and try again.',
      [ValidationSettingsErrorCode.VALIDATION_FAILED]: 'Settings validation failed. Please review the errors and correct them.',
      [ValidationSettingsErrorCode.SETTINGS_CONFLICT]: 'Settings conflict detected. Please resolve conflicts and try again.',
      [ValidationSettingsErrorCode.CACHE_OPERATION_FAILED]: 'Cache operation failed. Settings may not be up to date.',
      [ValidationSettingsErrorCode.CACHE_CORRUPTION]: 'Cache corruption detected. Settings will be reloaded.',
      [ValidationSettingsErrorCode.INVALID_CONFIGURATION]: 'Invalid service configuration. Please check your settings.',
      [ValidationSettingsErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing. Please provide all required information.',
      [ValidationSettingsErrorCode.UNAUTHORIZED_ACCESS]: 'You are not authorized to perform this action.',
      [ValidationSettingsErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have sufficient permissions for this operation.',
      [ValidationSettingsErrorCode.SYSTEM_ERROR]: 'A system error occurred. Please try again or contact support.',
      [ValidationSettingsErrorCode.TIMEOUT_ERROR]: 'Operation timed out. Please try again.',
      [ValidationSettingsErrorCode.RESOURCE_EXHAUSTED]: 'System resources are exhausted. Please try again later.'
    };

    return userMessages[code] || 'An unexpected error occurred. Please try again or contact support.';
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      isRetryable: this.isRetryable,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      context: this.context,
      stack: this.stack
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

export function createInitializationError(
  message: string,
  context?: ValidationSettingsErrorContext
): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.INITIALIZATION_FAILED,
    message,
    {
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.SYSTEM_RESTART,
      isRetryable: true,
      context
    }
  );
}

export function createDatabaseError(
  message: string,
  context?: ValidationSettingsErrorContext
): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.DATABASE_OPERATION_FAILED,
    message,
    {
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.RETRY,
      isRetryable: true,
      context
    }
  );
}

export function createValidationError(
  message: string,
  context?: ValidationSettingsErrorContext
): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.VALIDATION_FAILED,
    message,
    {
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      isRetryable: false,
      context
    }
  );
}

export function createSettingsNotFoundError(
  settingsId: string,
  context?: ValidationSettingsErrorContext
): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.SETTINGS_NOT_FOUND,
    `Settings with ID ${settingsId} not found`,
    {
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
      isRetryable: false,
      context: { ...context, settingsId }
    }
  );
}

export function createCacheError(
  message: string,
  context?: ValidationSettingsErrorContext
): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.CACHE_OPERATION_FAILED,
    message,
    {
      severity: ErrorSeverity.LOW,
      recoveryStrategy: RecoveryStrategy.FALLBACK,
      isRetryable: true,
      context
    }
  );
}

export function createSystemError(
  message: string,
  context?: ValidationSettingsErrorContext
): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.SYSTEM_ERROR,
    message,
    {
      severity: ErrorSeverity.CRITICAL,
      recoveryStrategy: RecoveryStrategy.SYSTEM_RESTART,
      isRetryable: true,
      context
    }
  );
}

// ============================================================================
// Error Recovery Utilities
// ============================================================================

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  fallbackAction?: () => Promise<any>;
  onRetry?: (attempt: number, error: ValidationSettingsError) => void;
  onFallback?: (error: ValidationSettingsError) => void;
}

export async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  error: ValidationSettingsError,
  options: ErrorRecoveryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelayMs = 1000,
    fallbackAction,
    onRetry,
    onFallback
  } = options;

  if (!error.isRetryable) {
    if (fallbackAction) {
      onFallback?.(error);
      return await fallbackAction();
    }
    throw error;
  }

  let lastError = error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      onRetry?.(attempt, error);
      return await operation();
    } catch (retryError) {
      lastError = retryError instanceof ValidationSettingsError 
        ? retryError 
        : createSystemError(
            retryError instanceof Error ? retryError.message : 'Unknown error',
            { operation: 'retry_operation', additionalData: { attempt } }
          );

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
    }
  }

  // All retries failed, try fallback if available
  if (fallbackAction) {
    onFallback?.(lastError);
    return await fallbackAction();
  }

  throw lastError;
}

// ============================================================================
// Error Logging and Monitoring
// ============================================================================

export interface ErrorLogEntry {
  error: ValidationSettingsError;
  timestamp: Date;
  operation: string;
  userId?: string;
  additionalContext?: Record<string, any>;
}

export class ValidationSettingsErrorLogger {
  private errorHistory: ErrorLogEntry[] = [];
  private maxHistorySize = 1000;

  public logError(
    error: ValidationSettingsError,
    operation: string,
    additionalContext?: Record<string, any>
  ): void {
    const logEntry: ErrorLogEntry = {
      error,
      timestamp: new Date(),
      operation,
      additionalContext
    };

    this.errorHistory.push(logEntry);

    // Keep only the most recent errors
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }

    // Log to console with appropriate level
    this.logToConsole(error, operation, additionalContext);
  }

  private logToConsole(
    error: ValidationSettingsError,
    operation: string,
    additionalContext?: Record<string, any>
  ): void {
    const logData = {
      code: error.code,
      severity: error.severity,
      operation,
      message: error.message,
      context: error.context,
      additionalContext,
      timestamp: new Date().toISOString()
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('[ValidationSettingsService] CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('[ValidationSettingsService] HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('[ValidationSettingsService] MEDIUM SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('[ValidationSettingsService] LOW SEVERITY ERROR:', logData);
        break;
    }
  }

  public getErrorHistory(): ErrorLogEntry[] {
    return [...this.errorHistory];
  }

  public getErrorStats(): {
    totalErrors: number;
    errorsBySeverity: Record<ErrorSeverity, number>;
    errorsByCode: Record<ValidationSettingsErrorCode, number>;
    recentErrors: ErrorLogEntry[];
  } {
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };

    const errorsByCode: Record<ValidationSettingsErrorCode, number> = {} as any;

    this.errorHistory.forEach(entry => {
      errorsBySeverity[entry.error.severity]++;
      errorsByCode[entry.error.code] = (errorsByCode[entry.error.code] || 0) + 1;
    });

    return {
      totalErrors: this.errorHistory.length,
      errorsBySeverity,
      errorsByCode,
      recentErrors: this.errorHistory.slice(-10) // Last 10 errors
    };
  }

  public clearHistory(): void {
    this.errorHistory = [];
  }
}

// ============================================================================
// Export Types and Utilities
// ============================================================================

export type {
  ValidationSettingsErrorContext as ErrorContext,
  ErrorRecoveryOptions,
  ErrorLogEntry
};
