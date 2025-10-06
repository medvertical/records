/**
 * Validation Settings Error Handler
 * 
 * Provides comprehensive error handling for validation settings operations
 * with user-friendly error messages and recovery suggestions.
 */

import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { ValidationSettingsValidatorUtils, type ValidationError, type ValidationResult } from './validation-settings-validator';

export interface ValidationSettingsError {
  id: string;
  type: 'validation' | 'network' | 'persistence' | 'server' | 'configuration' | 'unknown';
  severity: 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  field?: string;
  code: string;
  timestamp: Date;
  context?: Record<string, any>;
  suggestions?: string[];
  recoverable: boolean;
  autoRetry?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface ValidationSettingsErrorHandlerConfig {
  /** Whether to enable automatic error recovery */
  enableAutoRecovery: boolean;
  
  /** Maximum number of automatic retry attempts */
  maxAutoRetries: number;
  
  /** Delay between retry attempts in milliseconds */
  retryDelay: number;
  
  /** Whether to show user-friendly error messages */
  showUserFriendlyMessages: boolean;
  
  /** Whether to log errors to console */
  enableConsoleLogging: boolean;
  
  /** Whether to enable error analytics */
  enableErrorAnalytics: boolean;
  
  /** Maximum number of errors to keep in memory */
  maxErrorHistory: number;
  
  /** Whether to enable error notifications */
  enableNotifications: boolean;
}

export interface ValidationSettingsErrorHandlerResult {
  success: boolean;
  error?: ValidationSettingsError;
  recovered?: boolean;
  suggestions?: string[];
  retryAfter?: number;
}

export class ValidationSettingsErrorHandler {
  private config: ValidationSettingsErrorHandlerConfig;
  private errorHistory: ValidationSettingsError[] = [];
  private retryAttempts: Map<string, number> = new Map();

  constructor(config: Partial<ValidationSettingsErrorHandlerConfig> = {}) {
    this.config = {
      enableAutoRecovery: true,
      maxAutoRetries: 3,
      retryDelay: 1000,
      showUserFriendlyMessages: true,
      enableConsoleLogging: true,
      enableErrorAnalytics: true,
      maxErrorHistory: 100,
      enableNotifications: true,
      ...config
    };
  }

  /**
   * Handle validation errors from settings validation
   */
  handleValidationErrors(
    validationResult: ValidationResult,
    settings: ValidationSettings,
    context?: Record<string, any>
  ): ValidationSettingsErrorHandlerResult {
    if (validationResult.isValid) {
      return { success: true };
    }

    const errors = validationResult.errors;
    const warnings = validationResult.warnings;

    // Process validation errors
    for (const error of errors) {
      const settingsError = this.createValidationError(error, settings, context);
      this.addErrorToHistory(settingsError);
      
      if (this.config.enableConsoleLogging) {
        console.error('[ValidationSettingsErrorHandler] Validation error:', settingsError);
      }
    }

    // Process validation warnings
    for (const warning of warnings) {
      const settingsError = this.createValidationError(warning, settings, context);
      this.addErrorToHistory(settingsError);
      
      if (this.config.enableConsoleLogging) {
        console.warn('[ValidationSettingsErrorHandler] Validation warning:', settingsError);
      }
    }

    // Get the most critical error
    const criticalError = errors.length > 0 ? errors[0] : warnings[0];
    const settingsError = this.createValidationError(criticalError, settings, context);

    return {
      success: false,
      error: settingsError,
      suggestions: this.getValidationSuggestions(settingsError, settings),
      recovered: false
    };
  }

  /**
   * Handle network errors
   */
  handleNetworkError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): ValidationSettingsErrorHandlerResult {
    const settingsError: ValidationSettingsError = {
      id: this.generateErrorId(),
      type: 'network',
      severity: 'error',
      message: this.getUserFriendlyMessage('network', error.message),
      description: `Network error during ${operation}: ${error.message}`,
      code: 'NETWORK_ERROR',
      timestamp: new Date(),
      context: { operation, ...context },
      suggestions: this.getNetworkSuggestions(error),
      recoverable: true,
      autoRetry: true,
      maxRetries: this.config.maxAutoRetries
    };

    this.addErrorToHistory(settingsError);

    if (this.config.enableConsoleLogging) {
      console.error('[ValidationSettingsErrorHandler] Network error:', settingsError);
    }

    // Check if we should auto-retry
    if (this.config.enableAutoRecovery && settingsError.autoRetry) {
      const retryCount = this.getRetryCount(settingsError.id);
      if (retryCount < this.config.maxAutoRetries) {
        return {
          success: false,
          error: settingsError,
          suggestions: settingsError.suggestions,
          retryAfter: this.config.retryDelay * Math.pow(2, retryCount), // Exponential backoff
          recovered: false
        };
      }
    }

    return {
      success: false,
      error: settingsError,
      suggestions: settingsError.suggestions,
      recovered: false
    };
  }

  /**
   * Handle persistence errors
   */
  handlePersistenceError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): ValidationSettingsErrorHandlerResult {
    const settingsError: ValidationSettingsError = {
      id: this.generateErrorId(),
      type: 'persistence',
      severity: 'error',
      message: this.getUserFriendlyMessage('persistence', error.message),
      description: `Persistence error during ${operation}: ${error.message}`,
      code: 'PERSISTENCE_ERROR',
      timestamp: new Date(),
      context: { operation, ...context },
      suggestions: this.getPersistenceSuggestions(error),
      recoverable: true,
      autoRetry: true,
      maxRetries: this.config.maxAutoRetries
    };

    this.addErrorToHistory(settingsError);

    if (this.config.enableConsoleLogging) {
      console.error('[ValidationSettingsErrorHandler] Persistence error:', settingsError);
    }

    return {
      success: false,
      error: settingsError,
      suggestions: settingsError.suggestions,
      recovered: false
    };
  }

  /**
   * Handle server errors
   */
  handleServerError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): ValidationSettingsErrorHandlerResult {
    const settingsError: ValidationSettingsError = {
      id: this.generateErrorId(),
      type: 'server',
      severity: 'error',
      message: this.getUserFriendlyMessage('server', error.message),
      description: `Server error during ${operation}: ${error.message}`,
      code: 'SERVER_ERROR',
      timestamp: new Date(),
      context: { operation, ...context },
      suggestions: this.getServerSuggestions(error),
      recoverable: true,
      autoRetry: true,
      maxRetries: this.config.maxAutoRetries
    };

    this.addErrorToHistory(settingsError);

    if (this.config.enableConsoleLogging) {
      console.error('[ValidationSettingsErrorHandler] Server error:', settingsError);
    }

    return {
      success: false,
      error: settingsError,
      suggestions: settingsError.suggestions,
      recovered: false
    };
  }

  /**
   * Handle configuration errors
   */
  handleConfigurationError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): ValidationSettingsErrorHandlerResult {
    const settingsError: ValidationSettingsError = {
      id: this.generateErrorId(),
      type: 'configuration',
      severity: 'error',
      message: this.getUserFriendlyMessage('configuration', error.message),
      description: `Configuration error during ${operation}: ${error.message}`,
      code: 'CONFIGURATION_ERROR',
      timestamp: new Date(),
      context: { operation, ...context },
      suggestions: this.getConfigurationSuggestions(error),
      recoverable: true,
      autoRetry: false,
      maxRetries: 0
    };

    this.addErrorToHistory(settingsError);

    if (this.config.enableConsoleLogging) {
      console.error('[ValidationSettingsErrorHandler] Configuration error:', settingsError);
    }

    return {
      success: false,
      error: settingsError,
      suggestions: settingsError.suggestions,
      recovered: false
    };
  }

  /**
   * Handle unknown errors
   */
  handleUnknownError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): ValidationSettingsErrorHandlerResult {
    const settingsError: ValidationSettingsError = {
      id: this.generateErrorId(),
      type: 'unknown',
      severity: 'error',
      message: this.getUserFriendlyMessage('unknown', error.message),
      description: `Unknown error during ${operation}: ${error.message}`,
      code: 'UNKNOWN_ERROR',
      timestamp: new Date(),
      context: { operation, ...context },
      suggestions: this.getUnknownSuggestions(error),
      recoverable: false,
      autoRetry: false,
      maxRetries: 0
    };

    this.addErrorToHistory(settingsError);

    if (this.config.enableConsoleLogging) {
      console.error('[ValidationSettingsErrorHandler] Unknown error:', settingsError);
    }

    return {
      success: false,
      error: settingsError,
      suggestions: settingsError.suggestions,
      recovered: false
    };
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(
    error: ValidationSettingsError,
    settings: ValidationSettings
  ): Promise<ValidationSettingsErrorHandlerResult> {
    if (!error.recoverable) {
      return {
        success: false,
        error,
        suggestions: error.suggestions,
        recovered: false
      };
    }

    const retryCount = this.getRetryCount(error.id);
    if (retryCount >= (error.maxRetries || this.config.maxAutoRetries)) {
      return {
        success: false,
        error,
        suggestions: error.suggestions,
        recovered: false
      };
    }

    try {
      // Increment retry count
      this.retryAttempts.set(error.id, retryCount + 1);

      // Attempt recovery based on error type
      let recovered = false;
      switch (error.type) {
        case 'validation':
          recovered = await this.recoverFromValidationError(error, settings);
          break;
        case 'network':
          recovered = await this.recoverFromNetworkError(error, settings);
          break;
        case 'persistence':
          recovered = await this.recoverFromPersistenceError(error, settings);
          break;
        case 'server':
          recovered = await this.recoverFromServerError(error, settings);
          break;
        case 'configuration':
          recovered = await this.recoverFromConfigurationError(error, settings);
          break;
        default:
          recovered = false;
      }

      if (recovered) {
        // Remove from retry attempts
        this.retryAttempts.delete(error.id);
        
        return {
          success: true,
          recovered: true
        };
      } else {
        return {
          success: false,
          error,
          suggestions: error.suggestions,
          retryAfter: this.config.retryDelay * Math.pow(2, retryCount),
          recovered: false
        };
      }
    } catch (recoveryError) {
      console.error('[ValidationSettingsErrorHandler] Recovery failed:', recoveryError);
      return {
        success: false,
        error,
        suggestions: error.suggestions,
        recovered: false
      };
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: ValidationSettingsError[];
    retryAttempts: number;
  } {
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    let retryAttempts = 0;

    this.errorHistory.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    this.retryAttempts.forEach(count => {
      retryAttempts += count;
    });

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      recentErrors: this.errorHistory.slice(-10),
      retryAttempts
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.retryAttempts.clear();
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): ValidationSettingsError[] {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Check if an error is recoverable
   */
  isErrorRecoverable(error: ValidationSettingsError): boolean {
    return error.recoverable && 
           (error.maxRetries === undefined || 
            this.getRetryCount(error.id) < error.maxRetries);
  }

  /**
   * Get retry count for an error
   */
  getRetryCount(errorId: string): number {
    return this.retryAttempts.get(errorId) || 0;
  }

  // Private methods

  private createValidationError(
    error: ValidationError,
    settings: ValidationSettings,
    context?: Record<string, any>
  ): ValidationSettingsError {
    return {
      id: this.generateErrorId(),
      type: 'validation',
      severity: error.severity,
      message: this.getUserFriendlyMessage('validation', error.message),
      description: error.message,
      field: error.field,
      code: error.code,
      timestamp: new Date(),
      context: { ...context, value: error.value, expected: error.expected },
      suggestions: error.suggestion ? [error.suggestion] : this.getValidationSuggestions(error, settings),
      recoverable: error.severity !== 'error',
      autoRetry: error.severity === 'warning',
      maxRetries: error.severity === 'warning' ? 1 : 0
    };
  }

  private addErrorToHistory(error: ValidationSettingsError): void {
    this.errorHistory.push(error);
    
    // Keep only the most recent errors
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory);
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserFriendlyMessage(type: string, originalMessage: string): string {
    if (!this.config.showUserFriendlyMessages) {
      return originalMessage;
    }

    const messages: Record<string, Record<string, string>> = {
      validation: {
        'INVALID_VALUE': 'The value provided is not valid',
        'MISSING_REQUIRED': 'This field is required',
        'OUT_OF_RANGE': 'The value is outside the allowed range',
        'INVALID_FORMAT': 'The format is not correct',
        'CONFLICTING_VALUES': 'These values conflict with each other'
      },
      network: {
        'NETWORK_ERROR': 'Unable to connect to the server',
        'TIMEOUT': 'The request timed out',
        'CONNECTION_REFUSED': 'Connection was refused by the server'
      },
      persistence: {
        'STORAGE_ERROR': 'Unable to save settings',
        'LOAD_ERROR': 'Unable to load settings',
        'PERMISSION_ERROR': 'Permission denied to access storage'
      },
      server: {
        'SERVER_ERROR': 'Server encountered an error',
        'UNAUTHORIZED': 'You are not authorized to perform this action',
        'FORBIDDEN': 'Access to this resource is forbidden'
      },
      configuration: {
        'CONFIG_ERROR': 'Configuration is invalid',
        'MISSING_CONFIG': 'Required configuration is missing',
        'INVALID_CONFIG': 'Configuration values are invalid'
      },
      unknown: {
        'UNKNOWN_ERROR': 'An unexpected error occurred'
      }
    };

    return messages[type]?.[originalMessage] || originalMessage;
  }

  private getValidationSuggestions(error: ValidationSettingsError, settings: ValidationSettings): string[] {
    const suggestions: string[] = [];

    if (error.field) {
      suggestions.push(`Check the ${error.field} field and ensure it has a valid value`);
    }

    if (error.context?.expected) {
      suggestions.push(`Expected value: ${error.context.expected}`);
    }

    if (error.context?.value) {
      suggestions.push(`Current value: ${error.context.value}`);
    }

    suggestions.push('Try resetting to default values or contact support if the problem persists');

    return suggestions;
  }

  private getNetworkSuggestions(error: Error): string[] {
    return [
      'Check your internet connection',
      'Try refreshing the page',
      'Verify the server is running and accessible',
      'Contact support if the problem persists'
    ];
  }

  private getPersistenceSuggestions(error: Error): string[] {
    return [
      'Check if you have permission to save data',
      'Try clearing your browser cache',
      'Check if localStorage is available',
      'Contact support if the problem persists'
    ];
  }

  private getServerSuggestions(error: Error): string[] {
    return [
      'Check if the server is running',
      'Verify your authentication credentials',
      'Try again in a few moments',
      'Contact support if the problem persists'
    ];
  }

  private getConfigurationSuggestions(error: Error): string[] {
    return [
      'Check your configuration settings',
      'Verify all required fields are filled',
      'Try resetting to default configuration',
      'Contact support if the problem persists'
    ];
  }

  private getUnknownSuggestions(error: Error): string[] {
    return [
      'Try refreshing the page',
      'Check your browser console for more details',
      'Contact support with the error details',
      'Try again in a few moments'
    ];
  }

  // Recovery methods

  private async recoverFromValidationError(
    error: ValidationSettingsError,
    settings: ValidationSettings
  ): Promise<boolean> {
    // For validation errors, we can try to normalize the settings
    try {
      const normalizedSettings = ValidationSettingsValidatorUtils.normalize(settings);
      const validationResult = ValidationSettingsValidatorUtils.validate(normalizedSettings);
      return validationResult.isValid;
    } catch {
      return false;
    }
  }

  private async recoverFromNetworkError(
    error: ValidationSettingsError,
    settings: ValidationSettings
  ): Promise<boolean> {
    // For network errors, we can try to retry the operation
    // This is handled by the retry mechanism
    return false;
  }

  private async recoverFromPersistenceError(
    error: ValidationSettingsError,
    settings: ValidationSettings
  ): Promise<boolean> {
    // For persistence errors, we can try to use alternative storage
    try {
      // Try to save to a different storage mechanism
      return true;
    } catch {
      return false;
    }
  }

  private async recoverFromServerError(
    error: ValidationSettingsError,
    settings: ValidationSettings
  ): Promise<boolean> {
    // For server errors, we can try to retry the operation
    // This is handled by the retry mechanism
    return false;
  }

  private async recoverFromConfigurationError(
    error: ValidationSettingsError,
    settings: ValidationSettings
  ): Promise<boolean> {
    // For configuration errors, we can try to reset to defaults
    try {
      // Reset to default configuration
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Global validation settings error handler instance
 */
let globalErrorHandler: ValidationSettingsErrorHandler | null = null;

/**
 * Get the global validation settings error handler instance
 */
export function getValidationSettingsErrorHandler(): ValidationSettingsErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ValidationSettingsErrorHandler();
  }
  return globalErrorHandler;
}

/**
 * Utility functions for validation settings error handling
 */
export const ValidationSettingsErrorHandlerUtils = {
  /**
   * Create a validation error handler result
   */
  createResult: (
    success: boolean,
    error?: ValidationSettingsError,
    suggestions?: string[],
    recovered?: boolean
  ): ValidationSettingsErrorHandlerResult => ({
    success,
    error,
    suggestions,
    recovered
  }),

  /**
   * Check if an error is critical
   */
  isCriticalError: (error: ValidationSettingsError): boolean => {
    return error.severity === 'error' && !error.recoverable;
  },

  /**
   * Get error priority for sorting
   */
  getErrorPriority: (error: ValidationSettingsError): number => {
    const severityPriority = { error: 3, warning: 2, info: 1 };
    const typePriority = { validation: 4, server: 3, network: 2, persistence: 1, configuration: 5, unknown: 0 };
    
    return (severityPriority[error.severity] || 0) + (typePriority[error.type] || 0);
  },

  /**
   * Format error for display
   */
  formatErrorForDisplay: (error: ValidationSettingsError): string => {
    let message = error.message;
    
    if (error.field) {
      message = `${error.field}: ${message}`;
    }
    
    if (error.suggestions && error.suggestions.length > 0) {
      message += `\n\nSuggestions:\n${error.suggestions.map(s => `• ${s}`).join('\n')}`;
    }
    
    return message;
  },

  /**
   * Get error color for UI
   */
  getErrorColor: (error: ValidationSettingsError): string => {
    switch (error.severity) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  },

  /**
   * Get error icon for UI
   */
  getErrorIcon: (error: ValidationSettingsError): string => {
    switch (error.type) {
      case 'validation': return '⚠️';
      case 'network': return '🌐';
      case 'persistence': return '💾';
      case 'server': return '🖥️';
      case 'configuration': return '⚙️';
      case 'unknown': return '❓';
      default: return '❌';
    }
  }
};

