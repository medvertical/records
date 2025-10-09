/**
 * Validation Settings Service Errors - Simplified Error Handling
 * 
 * This module provides simple error handling for the validation settings service
 * with basic error types and user-friendly messages.
 */

// ============================================================================
// Simple Error Types
// ============================================================================

export enum ValidationSettingsErrorCode {
  // Basic errors
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SETTINGS_NOT_FOUND = 'SETTINGS_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export class ValidationSettingsError extends Error {
  public readonly code: ValidationSettingsErrorCode;
  public readonly userMessage: string;

  constructor(
    code: ValidationSettingsErrorCode,
    message: string,
    userMessage?: string
  ) {
    super(message);
    
    this.name = 'ValidationSettingsError';
    this.code = code;
    this.userMessage = userMessage || this.getDefaultUserMessage(code);

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, ValidationSettingsError.prototype);
  }

  private getDefaultUserMessage(code: ValidationSettingsErrorCode): string {
    const userMessages: Record<ValidationSettingsErrorCode, string> = {
      [ValidationSettingsErrorCode.INITIALIZATION_FAILED]: 'Failed to initialize settings service. Please try again.',
      [ValidationSettingsErrorCode.DATABASE_ERROR]: 'Database operation failed. Please try again.',
      [ValidationSettingsErrorCode.VALIDATION_ERROR]: 'Settings validation failed. Please check your input.',
      [ValidationSettingsErrorCode.SETTINGS_NOT_FOUND]: 'The requested settings could not be found.',
      [ValidationSettingsErrorCode.INVALID_INPUT]: 'Invalid input provided. Please check your data.',
      [ValidationSettingsErrorCode.SYSTEM_ERROR]: 'A system error occurred. Please try again.'
    };

    return userMessages[code] || 'An unexpected error occurred. Please try again.';
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      stack: this.stack
    };
  }
}

// ============================================================================
// Simple Error Factory Functions
// ============================================================================

export function createInitializationError(message: string): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.INITIALIZATION_FAILED,
    message
  );
}

export function createDatabaseError(message: string): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.DATABASE_ERROR,
    message
  );
}

export function createValidationError(message: string): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.VALIDATION_ERROR,
    message
  );
}

export function createSettingsNotFoundError(settingsId: string): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.SETTINGS_NOT_FOUND,
    `Settings with ID ${settingsId} not found`
  );
}

export function createInvalidInputError(message: string): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.INVALID_INPUT,
    message
  );
}

export function createSystemError(message: string): ValidationSettingsError {
  return new ValidationSettingsError(
    ValidationSettingsErrorCode.SYSTEM_ERROR,
    message
  );
}

// ============================================================================
// Simple Error Handler
// ============================================================================

export class SimpleErrorHandler {
  public static handleError(error: unknown, operation: string): ValidationSettingsError {
    if (error instanceof ValidationSettingsError) {
      return error;
    }

    if (error instanceof Error) {
      return new ValidationSettingsError(
        ValidationSettingsErrorCode.SYSTEM_ERROR,
        `${operation} failed: ${error.message}`,
        `Operation failed. Please try again.`
      );
    }

    return new ValidationSettingsError(
      ValidationSettingsErrorCode.SYSTEM_ERROR,
      `${operation} failed: Unknown error`,
      `Operation failed. Please try again.`
    );
  }

  public static logError(error: ValidationSettingsError, operation: string): void {
    console.error(`[ValidationSettingsService] ${operation} error:`, {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      timestamp: new Date().toISOString()
    });
  }
}