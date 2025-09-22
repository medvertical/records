// ============================================================================
// Error Handling Utilities - User-friendly error handling and messaging
// ============================================================================

/**
 * Error Handling Utilities - Single responsibility: User-friendly error handling and messaging
 * Follows global rules: Under 200 lines, single responsibility, focused on error handling
 */

export interface ErrorInfo {
  code?: string;
  message: string;
  details?: string;
  timestamp: Date;
  context?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  userAction?: string;
}

export interface ErrorDisplay {
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Error types and their user-friendly messages
 */
export const ERROR_TYPES = {
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    title: 'Connection Problem',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
    severity: 'error' as const,
    recoverable: true,
    userAction: 'Check your internet connection and refresh the page',
  },
  
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    title: 'Validation Failed',
    message: 'There was a problem with the validation process. Please try again or contact support.',
    severity: 'error' as const,
    recoverable: true,
    userAction: 'Try restarting the validation process',
  },
  
  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    title: 'Server Error',
    message: 'The server encountered an unexpected error. Please try again later.',
    severity: 'error' as const,
    recoverable: true,
    userAction: 'Try again in a few minutes',
  },
  
  PERMISSION_ERROR: {
    code: 'PERMISSION_ERROR',
    title: 'Access Denied',
    message: 'You don\'t have permission to perform this action. Please contact your administrator.',
    severity: 'error' as const,
    recoverable: false,
    userAction: 'Contact your system administrator',
  },
  
  DATA_ERROR: {
    code: 'DATA_ERROR',
    title: 'Data Problem',
    message: 'There was a problem loading or processing the data. Please refresh the page.',
    severity: 'warning' as const,
    recoverable: true,
    userAction: 'Refresh the page to reload data',
  },
  
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
    severity: 'warning' as const,
    recoverable: true,
    userAction: 'Try the action again',
  },
  
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    severity: 'error' as const,
    recoverable: true,
    userAction: 'Try again or contact support',
  },
} as const;

/**
 * Parse error and return user-friendly information
 */
export const parseError = (error: any, context?: string): ErrorDisplay => {
  // Handle string errors
  if (typeof error === 'string') {
    return {
      title: 'Error',
      message: error,
      severity: 'error',
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    // Network-related errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return {
        ...ERROR_TYPES.NETWORK_ERROR,
        action: {
          label: 'Retry',
          onClick: () => window.location.reload(),
        },
      };
    }
    
    // Timeout errors
    if (errorMessage.includes('timeout')) {
      return {
        ...ERROR_TYPES.TIMEOUT_ERROR,
        action: {
          label: 'Retry',
          onClick: () => window.location.reload(),
        },
      };
    }
    
    // Generic error
    return {
      title: 'Error',
      message: error.message || 'An unexpected error occurred',
      severity: 'error',
      action: {
        label: 'Retry',
        onClick: () => window.location.reload(),
      },
    };
  }

  // Handle API response errors
  if (error?.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.response.statusText;
    
    switch (status) {
      case 400:
        return {
          title: 'Invalid Request',
          message: message || 'The request was invalid. Please check your input and try again.',
          severity: 'warning',
        };
        
      case 401:
        return {
          title: 'Authentication Required',
          message: 'Please log in to continue.',
          severity: 'error',
          action: {
            label: 'Login',
            onClick: () => window.location.href = '/login',
          },
        };
        
      case 403:
        return ERROR_TYPES.PERMISSION_ERROR;
        
      case 404:
        return {
          title: 'Not Found',
          message: 'The requested resource was not found.',
          severity: 'warning',
        };
        
      case 429:
        return {
          title: 'Too Many Requests',
          message: 'You\'ve made too many requests. Please wait a moment and try again.',
          severity: 'warning',
          action: {
            label: 'Retry Later',
            onClick: () => setTimeout(() => window.location.reload(), 5000),
          },
        };
        
      case 500:
      case 502:
      case 503:
      case 504:
        return ERROR_TYPES.SERVER_ERROR;
        
      default:
        return {
          title: 'Server Error',
          message: message || 'The server encountered an error.',
          severity: 'error',
          action: {
            label: 'Retry',
            onClick: () => window.location.reload(),
          },
        };
    }
  }

  // Handle validation-specific errors
  if (context?.includes('validation')) {
    return ERROR_TYPES.VALIDATION_ERROR;
  }

  // Default fallback
  return ERROR_TYPES.UNKNOWN_ERROR;
};

/**
 * Create error info object for logging
 */
export const createErrorInfo = (
  error: any,
  context?: string,
  severity: ErrorInfo['severity'] = 'medium'
): ErrorInfo => {
  const parsed = parseError(error, context);
  
  return {
    code: parsed.title.replace(/\s+/g, '_').toUpperCase(),
    message: parsed.message,
    details: error?.stack || error?.toString(),
    timestamp: new Date(),
    context,
    severity,
    recoverable: !!parsed.action,
    userAction: parsed.action?.label,
  };
};

/**
 * Error boundary helper
 */
export const getErrorBoundaryFallback = (error: Error, context?: string) => {
  const parsed = parseError(error, context);
  
  return {
    title: parsed.title,
    message: parsed.message,
    action: parsed.action,
    severity: parsed.severity,
  };
};

/**
 * Toast notification helpers
 */
export const createErrorToast = (error: any, context?: string) => {
  const parsed = parseError(error, context);
  
  return {
    type: parsed.severity,
    title: parsed.title,
    description: parsed.message,
    action: parsed.action,
    duration: parsed.severity === 'critical' ? 0 : 5000, // Critical errors don't auto-dismiss
  };
};

export default {
  ERROR_TYPES,
  parseError,
  createErrorInfo,
  getErrorBoundaryFallback,
  createErrorToast,
};
