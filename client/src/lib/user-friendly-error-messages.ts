import { toast } from '@/hooks/use-toast';

/**
 * User-friendly error messages and recovery suggestions system
 */

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  timestamp: Date;
  additionalInfo?: Record<string, any>;
}

export interface RecoverySuggestion {
  id: string;
  title: string;
  description: string;
  action: () => void | Promise<void>;
  priority: 'high' | 'medium' | 'low';
  category: 'network' | 'service' | 'validation' | 'configuration' | 'permission' | 'data';
  icon?: string;
  requiresUserAction?: boolean;
}

export interface UserFriendlyError {
  id: string;
  title: string;
  message: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'network' | 'service' | 'validation' | 'configuration' | 'permission' | 'data' | 'system';
  suggestions: RecoverySuggestion[];
  context: ErrorContext;
  timestamp: Date;
  dismissed?: boolean;
  autoRetry?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface ErrorMessageConfig {
  showToast: boolean;
  showInUI: boolean;
  logToConsole: boolean;
  autoRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  dismissible: boolean;
  persistent: boolean;
}

/**
 * Error Message Templates
 */
export const ERROR_TEMPLATES = {
  // Network Errors
  NETWORK_CONNECTION_FAILED: {
    title: "Connection Problem",
    message: "Unable to connect to the validation service",
    description: "There seems to be a network connectivity issue. Please check your internet connection and try again.",
    severity: 'error' as const,
    category: 'network' as const,
  },
  
  NETWORK_TIMEOUT: {
    title: "Request Timeout",
    message: "The request took too long to complete",
    description: "The server is taking longer than expected to respond. This might be due to high load or network issues.",
    severity: 'warning' as const,
    category: 'network' as const,
  },

  // Service Errors
  SERVICE_UNAVAILABLE: {
    title: "Service Unavailable",
    message: "The validation service is currently unavailable",
    description: "Our validation service is temporarily down for maintenance or experiencing issues. Please try again later.",
    severity: 'error' as const,
    category: 'service' as const,
  },

  SERVICE_OVERLOADED: {
    title: "Service Busy",
    message: "The validation service is currently overloaded",
    description: "Too many users are currently using the validation service. Please wait a moment and try again.",
    severity: 'warning' as const,
    category: 'service' as const,
  },

  // Validation Errors
  VALIDATION_FAILED: {
    title: "Validation Failed",
    message: "The validation process encountered an error",
    description: "Something went wrong during the validation process. Please check your data and try again.",
    severity: 'error' as const,
    category: 'validation' as const,
  },

  INVALID_CONFIGURATION: {
    title: "Invalid Configuration",
    message: "The validation configuration is invalid",
    description: "The current validation settings are not valid. Please review and update your configuration.",
    severity: 'error' as const,
    category: 'configuration' as const,
  },

  // Permission Errors
  PERMISSION_DENIED: {
    title: "Access Denied",
    message: "You don't have permission to perform this action",
    description: "Your account doesn't have the necessary permissions to perform this validation operation.",
    severity: 'error' as const,
    category: 'permission' as const,
  },

  // Data Errors
  DATA_CORRUPTION: {
    title: "Data Issue",
    message: "The data appears to be corrupted or invalid",
    description: "The data you're trying to validate seems to be corrupted or in an invalid format.",
    severity: 'error' as const,
    category: 'data' as const,
  },

  // System Errors
  SYSTEM_ERROR: {
    title: "System Error",
    message: "An unexpected system error occurred",
    description: "Something went wrong on our end. Our team has been notified and is working to fix the issue.",
    severity: 'critical' as const,
    category: 'system' as const,
  },
} as const;

/**
 * Recovery Suggestions Templates
 */
export const RECOVERY_SUGGESTIONS = {
  // Network Recovery
  CHECK_CONNECTION: {
    id: 'check-connection',
    title: 'Check Internet Connection',
    description: 'Verify that your internet connection is working properly',
    priority: 'high' as const,
    category: 'network' as const,
    requiresUserAction: true,
  },

  RETRY_OPERATION: {
    id: 'retry-operation',
    title: 'Try Again',
    description: 'Retry the operation after a short delay',
    priority: 'high' as const,
    category: 'network' as const,
    requiresUserAction: false,
  },

  REFRESH_PAGE: {
    id: 'refresh-page',
    title: 'Refresh Page',
    description: 'Reload the page to reset the connection',
    priority: 'medium' as const,
    category: 'network' as const,
    requiresUserAction: true,
  },

  // Service Recovery
  WAIT_AND_RETRY: {
    id: 'wait-and-retry',
    title: 'Wait and Retry',
    description: 'Wait a few minutes and try again when the service is less busy',
    priority: 'medium' as const,
    category: 'service' as const,
    requiresUserAction: true,
  },

  CONTACT_SUPPORT: {
    id: 'contact-support',
    title: 'Contact Support',
    description: 'Get help from our support team if the issue persists',
    priority: 'low' as const,
    category: 'service' as const,
    requiresUserAction: true,
  },

  // Configuration Recovery
  RESET_SETTINGS: {
    id: 'reset-settings',
    title: 'Reset to Default Settings',
    description: 'Reset your validation settings to the default configuration',
    priority: 'medium' as const,
    category: 'configuration' as const,
    requiresUserAction: true,
  },

  REVIEW_CONFIGURATION: {
    id: 'review-configuration',
    title: 'Review Configuration',
    description: 'Check and update your validation configuration settings',
    priority: 'high' as const,
    category: 'configuration' as const,
    requiresUserAction: true,
  },

  // Data Recovery
  VALIDATE_DATA_FORMAT: {
    id: 'validate-data-format',
    title: 'Check Data Format',
    description: 'Ensure your data is in the correct FHIR format',
    priority: 'high' as const,
    category: 'data' as const,
    requiresUserAction: true,
  },

  UPLOAD_NEW_DATA: {
    id: 'upload-new-data',
    title: 'Upload New Data',
    description: 'Try uploading a fresh copy of your data',
    priority: 'medium' as const,
    category: 'data' as const,
    requiresUserAction: true,
  },
} as const;

/**
 * User-Friendly Error Message Manager
 */
export class UserFriendlyErrorManager {
  private errors = new Map<string, UserFriendlyError>();
  private config: ErrorMessageConfig;

  constructor(config: Partial<ErrorMessageConfig> = {}) {
    this.config = {
      showToast: true,
      showInUI: true,
      logToConsole: true,
      autoRetry: false,
      maxRetries: 3,
      retryDelay: 2000,
      dismissible: true,
      persistent: false,
      ...config,
    };
  }

  /**
   * Create a user-friendly error message
   */
  createError(
    template: keyof typeof ERROR_TEMPLATES,
    context: ErrorContext,
    suggestions: RecoverySuggestion[] = [],
    customMessage?: string
  ): UserFriendlyError {
    const errorTemplate = ERROR_TEMPLATES[template];
    const errorId = `${template}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const error: UserFriendlyError = {
      id: errorId,
      title: errorTemplate.title,
      message: customMessage || errorTemplate.message,
      description: errorTemplate.description,
      severity: errorTemplate.severity,
      category: errorTemplate.category,
      suggestions: suggestions.length > 0 ? suggestions : this.getDefaultSuggestions(errorTemplate.category),
      context,
      timestamp: new Date(),
      autoRetry: this.config.autoRetry,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    this.errors.set(errorId, error);
    return error;
  }

  /**
   * Get default recovery suggestions for a category
   */
  private getDefaultSuggestions(category: string): RecoverySuggestion[] {
    switch (category) {
      case 'network':
        return [
          this.createSuggestion('retry-operation', () => this.retryLastOperation()),
          this.createSuggestion('check-connection', () => this.checkConnection()),
          this.createSuggestion('refresh-page', () => window.location.reload()),
        ];
      
      case 'service':
        return [
          this.createSuggestion('wait-and-retry', () => this.waitAndRetry()),
          this.createSuggestion('contact-support', () => this.contactSupport()),
        ];
      
      case 'configuration':
        return [
          this.createSuggestion('review-configuration', () => this.openSettings()),
          this.createSuggestion('reset-settings', () => this.resetSettings()),
        ];
      
      case 'data':
        return [
          this.createSuggestion('validate-data-format', () => this.showDataFormatHelp()),
          this.createSuggestion('upload-new-data', () => this.uploadNewData()),
        ];
      
      default:
        return [
          this.createSuggestion('retry-operation', () => this.retryLastOperation()),
        ];
    }
  }

  /**
   * Create a recovery suggestion
   */
  private createSuggestion(
    templateId: keyof typeof RECOVERY_SUGGESTIONS,
    action: () => void | Promise<void>
  ): RecoverySuggestion {
    const template = RECOVERY_SUGGESTIONS[templateId];
    return {
      ...template,
      action,
    };
  }

  /**
   * Display an error message
   */
  displayError(error: UserFriendlyError): void {
    if (this.config.logToConsole) {
      console.error(`[UserFriendlyError] ${error.title}: ${error.message}`, {
        error,
        context: error.context,
        suggestions: error.suggestions,
      });
    }

    if (this.config.showToast) {
      this.showErrorToast(error);
    }

    if (this.config.showInUI) {
      this.showErrorInUI(error);
    }

    // Auto-retry if enabled
    if (error.autoRetry && error.retryCount! < error.maxRetries!) {
      setTimeout(() => {
        this.retryError(error);
      }, this.config.retryDelay);
    }
  }

  /**
   * Show error as toast notification
   */
  private showErrorToast(error: UserFriendlyError): void {
    const variant = error.severity === 'critical' || error.severity === 'error' ? 'destructive' : 'default';
    
    toast({
      title: error.title,
      description: error.description,
      variant,
      action: error.suggestions.length > 0 ? {
        altText: error.suggestions[0].title,
        onClick: error.suggestions[0].action,
      } : undefined,
    });
  }

  /**
   * Show error in UI (placeholder for future implementation)
   */
  private showErrorInUI(error: UserFriendlyError): void {
    // This would integrate with a global error display component
    console.log('[UserFriendlyError] Displaying error in UI:', error);
  }

  /**
   * Retry an error
   */
  private retryError(error: UserFriendlyError): void {
    if (error.retryCount! >= error.maxRetries!) {
      console.log(`[UserFriendlyError] Max retries reached for error ${error.id}`);
      return;
    }

    error.retryCount!++;
    console.log(`[UserFriendlyError] Retrying error ${error.id} (attempt ${error.retryCount})`);
    
    // This would trigger the original operation retry
    // Implementation depends on the specific error context
  }

  /**
   * Recovery action implementations
   */
  private retryLastOperation(): void {
    console.log('[UserFriendlyError] Retrying last operation');
    // Implementation would depend on the last operation context
  }

  private checkConnection(): void {
    console.log('[UserFriendlyError] Checking connection');
    // Implementation would check network connectivity
  }

  private waitAndRetry(): void {
    console.log('[UserFriendlyError] Waiting and retrying');
    // Implementation would wait and then retry
  }

  private contactSupport(): void {
    console.log('[UserFriendlyError] Contacting support');
    // Implementation would open support contact form
  }

  private openSettings(): void {
    console.log('[UserFriendlyError] Opening settings');
    // Implementation would open settings modal
  }

  private resetSettings(): void {
    console.log('[UserFriendlyError] Resetting settings');
    // Implementation would reset settings to defaults
  }

  private showDataFormatHelp(): void {
    console.log('[UserFriendlyError] Showing data format help');
    // Implementation would show data format documentation
  }

  private uploadNewData(): void {
    console.log('[UserFriendlyError] Uploading new data');
    // Implementation would trigger data upload
  }

  /**
   * Get all errors
   */
  getAllErrors(): UserFriendlyError[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: string): UserFriendlyError[] {
    return Array.from(this.errors.values()).filter(error => error.category === category);
  }

  /**
   * Dismiss an error
   */
  dismissError(errorId: string): void {
    const error = this.errors.get(errorId);
    if (error) {
      error.dismissed = true;
    }
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.errors.clear();
  }

  /**
   * Clear dismissed errors
   */
  clearDismissedErrors(): void {
    for (const [id, error] of this.errors.entries()) {
      if (error.dismissed) {
        this.errors.delete(id);
      }
    }
  }
}

/**
 * Global error message manager
 */
export const userFriendlyErrorManager = new UserFriendlyErrorManager();

/**
 * Hook for using user-friendly error messages in React components
 */
export function useUserFriendlyErrors(config?: Partial<ErrorMessageConfig>) {
  const manager = config ? new UserFriendlyErrorManager(config) : userFriendlyErrorManager;

  const createAndDisplayError = (
    template: keyof typeof ERROR_TEMPLATES,
    context: ErrorContext,
    suggestions?: RecoverySuggestion[],
    customMessage?: string
  ) => {
    const error = manager.createError(template, context, suggestions, customMessage);
    manager.displayError(error);
    return error;
  };

  const getErrors = () => manager.getAllErrors();
  const getErrorsByCategory = (category: string) => manager.getErrorsByCategory(category);
  const dismissError = (errorId: string) => manager.dismissError(errorId);
  const clearAllErrors = () => manager.clearAllErrors();

  return {
    createAndDisplayError,
    getErrors,
    getErrorsByCategory,
    dismissError,
    clearAllErrors,
  };
}

/**
 * Utility functions for common error scenarios
 */
export const ErrorMessageUtils = {
  /**
   * Create network error
   */
  createNetworkError: (context: ErrorContext, customMessage?: string) => {
    return userFriendlyErrorManager.createError(
      'NETWORK_CONNECTION_FAILED',
      context,
      undefined,
      customMessage
    );
  },

  /**
   * Create service error
   */
  createServiceError: (context: ErrorContext, customMessage?: string) => {
    return userFriendlyErrorManager.createError(
      'SERVICE_UNAVAILABLE',
      context,
      undefined,
      customMessage
    );
  },

  /**
   * Create validation error
   */
  createValidationError: (context: ErrorContext, customMessage?: string) => {
    return userFriendlyErrorManager.createError(
      'VALIDATION_FAILED',
      context,
      undefined,
      customMessage
    );
  },

  /**
   * Create configuration error
   */
  createConfigurationError: (context: ErrorContext, customMessage?: string) => {
    return userFriendlyErrorManager.createError(
      'INVALID_CONFIGURATION',
      context,
      undefined,
      customMessage
    );
  },

  /**
   * Create permission error
   */
  createPermissionError: (context: ErrorContext, customMessage?: string) => {
    return userFriendlyErrorManager.createError(
      'PERMISSION_DENIED',
      context,
      undefined,
      customMessage
    );
  },

  /**
   * Create data error
   */
  createDataError: (context: ErrorContext, customMessage?: string) => {
    return userFriendlyErrorManager.createError(
      'DATA_CORRUPTION',
      context,
      undefined,
      customMessage
    );
  },

  /**
   * Create system error
   */
  createSystemError: (context: ErrorContext, customMessage?: string) => {
    return userFriendlyErrorManager.createError(
      'SYSTEM_ERROR',
      context,
      undefined,
      customMessage
    );
  },

  /**
   * Get user-friendly message for HTTP status codes
   */
  getHttpStatusMessage: (status: number): string => {
    switch (status) {
      case 400:
        return 'The request was invalid. Please check your data and try again.';
      case 401:
        return 'You need to log in to perform this action.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
        return 'The request timed out. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'A server error occurred. Please try again later.';
      case 502:
        return 'The service is temporarily unavailable. Please try again later.';
      case 503:
        return 'The service is currently unavailable. Please try again later.';
      case 504:
        return 'The request timed out. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  },

  /**
   * Get recovery suggestions for HTTP status codes
   */
  getHttpStatusSuggestions: (status: number): RecoverySuggestion[] => {
    const suggestions: RecoverySuggestion[] = [];

    switch (status) {
      case 400:
        suggestions.push(
          RECOVERY_SUGGESTIONS.VALIDATE_DATA_FORMAT,
          RECOVERY_SUGGESTIONS.REVIEW_CONFIGURATION
        );
        break;
      case 401:
        suggestions.push(
          RECOVERY_SUGGESTIONS.CONTACT_SUPPORT
        );
        break;
      case 403:
        suggestions.push(
          RECOVERY_SUGGESTIONS.CONTACT_SUPPORT
        );
        break;
      case 404:
        suggestions.push(
          RECOVERY_SUGGESTIONS.REFRESH_PAGE,
          RECOVERY_SUGGESTIONS.CONTACT_SUPPORT
        );
        break;
      case 408:
      case 504:
        suggestions.push(
          RECOVERY_SUGGESTIONS.RETRY_OPERATION,
          RECOVERY_SUGGESTIONS.CHECK_CONNECTION
        );
        break;
      case 429:
        suggestions.push(
          RECOVERY_SUGGESTIONS.WAIT_AND_RETRY
        );
        break;
      case 500:
      case 502:
      case 503:
        suggestions.push(
          RECOVERY_SUGGESTIONS.WAIT_AND_RETRY,
          RECOVERY_SUGGESTIONS.CONTACT_SUPPORT
        );
        break;
      default:
        suggestions.push(
          RECOVERY_SUGGESTIONS.RETRY_OPERATION
        );
    }

    return suggestions;
  },
};

