// ============================================================================
// Validation Error Handler - Comprehensive error handling for validation API
// ============================================================================

import { Request, Response } from 'express';

export interface ValidationError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
  userMessage: string;
  httpStatus: number;
  category: 'validation' | 'database' | 'network' | 'authentication' | 'authorization' | 'rate_limit' | 'server' | 'client';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  retryAfter?: number;
  suggestions?: string[];
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    userMessage: string;
    category: string;
    severity: string;
    timestamp: string;
    requestId?: string;
    retryable: boolean;
    retryAfter?: number;
    suggestions?: string[];
  };
  details?: any;
  debug?: {
    stack?: string;
    originalError?: any;
  };
}

export class ValidationErrorHandler {
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static getErrorCategory(error: any): ValidationError['category'] {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return 'network';
    }
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      return 'database';
    }
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return 'authorization';
    }
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return 'rate_limit';
    }
    if (error.message?.toLowerCase().includes('validation') || 
        error.message?.toLowerCase().includes('invalid') ||
        error.message?.toLowerCase().includes('required') ||
        error.message?.toLowerCase().includes('format')) {
      return 'validation';
    }
    if (error.message?.includes('timeout') || error.message?.includes('connection')) {
      return 'network';
    }
    return 'server';
  }

  private static getErrorSeverity(error: any, category: ValidationError['category']): ValidationError['severity'] {
    if (category === 'database' && error.code === 'ER_DUP_ENTRY') {
      return 'medium';
    }
    if (category === 'network') {
      return 'high';
    }
    if (category === 'validation') {
      return 'low';
    }
    if (category === 'server') {
      return 'critical';
    }
    return 'medium';
  }

  private static isRetryable(error: any, category: ValidationError['category']): boolean {
    if (category === 'network') {
      return true;
    }
    if (category === 'rate_limit') {
      return true;
    }
    if (category === 'server' && error.message?.includes('timeout')) {
      return true;
    }
    return false;
  }

  private static getRetryAfter(error: any, category: ValidationError['category']): number | undefined {
    if (category === 'rate_limit') {
      return 60; // 1 minute
    }
    if (category === 'network') {
      return 5; // 5 seconds
    }
    if (category === 'server' && error.message?.includes('timeout')) {
      return 10; // 10 seconds
    }
    return undefined;
  }

  private static getUserFriendlyMessage(error: any, category: ValidationError['category']): string {
    switch (category) {
      case 'validation':
        return 'The request contains invalid data. Please check your input and try again.';
      case 'database':
        return 'A database error occurred. Please try again in a moment.';
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'authentication':
        return 'Authentication required. Please log in and try again.';
      case 'authorization':
        return 'You do not have permission to perform this action.';
      case 'rate_limit':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'server':
        return 'A server error occurred. Please try again later.';
      case 'client':
        return 'Invalid request. Please check your input and try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private static getSuggestions(error: any, category: ValidationError['category']): string[] {
    const suggestions: string[] = [];
    
    switch (category) {
      case 'validation':
        suggestions.push('Check that all required fields are provided');
        suggestions.push('Verify that field values are in the correct format');
        suggestions.push('Ensure that resource types and validation aspects are valid');
        break;
      case 'database':
        suggestions.push('Try refreshing the page');
        suggestions.push('Check if the server is experiencing high load');
        break;
      case 'network':
        suggestions.push('Check your internet connection');
        suggestions.push('Try refreshing the page');
        suggestions.push('Contact support if the problem persists');
        break;
      case 'rate_limit':
        suggestions.push('Wait a few minutes before making more requests');
        suggestions.push('Consider reducing the frequency of your requests');
        break;
      case 'server':
        suggestions.push('Try again in a few minutes');
        suggestions.push('Contact support if the problem persists');
        break;
    }
    
    return suggestions;
  }

  private static getHttpStatus(error: any, category: ValidationError['category']): number {
    switch (category) {
      case 'validation':
      case 'client':
        return 400;
      case 'authentication':
        return 401;
      case 'authorization':
        return 403;
      case 'rate_limit':
        return 429;
      case 'network':
        return 503;
      case 'database':
        return 500;
      case 'server':
        return 500;
      default:
        return 500;
    }
  }

  static handleError(error: any, req: Request, res: Response, context?: string): void {
    const requestId = ValidationErrorHandler.generateRequestId();
    const category = ValidationErrorHandler.getErrorCategory(error);
    const severity = ValidationErrorHandler.getErrorSeverity(error, category);
    const retryable = ValidationErrorHandler.isRetryable(error, category);
    const retryAfter = ValidationErrorHandler.getRetryAfter(error, category);
    const userMessage = ValidationErrorHandler.getUserFriendlyMessage(error, category);
    const suggestions = ValidationErrorHandler.getSuggestions(error, category);
    const httpStatus = ValidationErrorHandler.getHttpStatus(error, category);

    // Log the error with context
    const logMessage = `[ValidationErrorHandler] ${context ? `[${context}] ` : ''}Error: ${error.message}`;
    const logData = {
      requestId,
      category,
      severity,
      retryable,
      retryAfter,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
      }
    };

    if (severity === 'critical' || severity === 'high') {
      console.error(logMessage, logData);
    } else {
      console.warn(logMessage, logData);
    }

    // Prepare error response
    const errorResponse: ErrorResponse = {
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        userMessage,
        category,
        severity,
        timestamp: new Date().toISOString(),
        requestId,
        retryable,
        retryAfter,
        suggestions
      },
      details: process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        stack: error.stack
      } : undefined
    };

    // Set appropriate headers
    if (retryAfter) {
      res.set('Retry-After', retryAfter.toString());
    }
    res.set('X-Request-ID', requestId);
    res.set('X-Error-Category', category);
    res.set('X-Error-Severity', severity);

    // Send error response
    res.status(httpStatus).json(errorResponse);
  }

  static handleValidationError(errors: string[], req: Request, res: Response, context?: string): void {
    const requestId = ValidationErrorHandler.generateRequestId();
    
    console.warn(`[ValidationErrorHandler] ${context ? `[${context}] ` : ''}Validation errors:`, {
      requestId,
      errors,
      request: {
        method: req.method,
        url: req.url,
        body: req.body
      }
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        userMessage: 'The request contains invalid data. Please check your input and try again.',
        category: 'validation',
        severity: 'low',
        timestamp: new Date().toISOString(),
        requestId,
        retryable: false,
        suggestions: [
          'Check that all required fields are provided',
          'Verify that field values are in the correct format',
          'Ensure that resource types and validation aspects are valid'
        ]
      },
      details: {
        validationErrors: errors
      }
    };

    res.set('X-Request-ID', requestId);
    res.set('X-Error-Category', 'validation');
    res.set('X-Error-Severity', 'low');
    res.status(400).json(errorResponse);
  }

  static handleNotFoundError(resource: string, req: Request, res: Response, context?: string): void {
    const requestId = ValidationErrorHandler.generateRequestId();
    
    console.warn(`[ValidationErrorHandler] ${context ? `[${context}] ` : ''}Resource not found:`, {
      requestId,
      resource,
      request: {
        method: req.method,
        url: req.url
      }
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: `${resource} not found`,
        userMessage: `The requested ${resource.toLowerCase()} could not be found.`,
        category: 'client',
        severity: 'low',
        timestamp: new Date().toISOString(),
        requestId,
        retryable: false,
        suggestions: [
          'Check that the resource ID is correct',
          'Verify that the resource exists',
          'Try refreshing the page'
        ]
      }
    };

    res.set('X-Request-ID', requestId);
    res.set('X-Error-Category', 'client');
    res.set('X-Error-Severity', 'low');
    res.status(404).json(errorResponse);
  }

  static handleRateLimitError(req: Request, res: Response, retryAfter: number = 60, context?: string): void {
    const requestId = ValidationErrorHandler.generateRequestId();
    
    console.warn(`[ValidationErrorHandler] ${context ? `[${context}] ` : ''}Rate limit exceeded:`, {
      requestId,
      retryAfter,
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip
      }
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        category: 'rate_limit',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        requestId,
        retryable: true,
        retryAfter,
        suggestions: [
          'Wait a few minutes before making more requests',
          'Consider reducing the frequency of your requests'
        ]
      }
    };

    res.set('Retry-After', retryAfter.toString());
    res.set('X-Request-ID', requestId);
    res.set('X-Error-Category', 'rate_limit');
    res.set('X-Error-Severity', 'medium');
    res.status(429).json(errorResponse);
  }

  static handleTimeoutError(req: Request, res: Response, timeout: number, context?: string): void {
    const requestId = ValidationErrorHandler.generateRequestId();
    
    console.warn(`[ValidationErrorHandler] ${context ? `[${context}] ` : ''}Request timeout:`, {
      requestId,
      timeout,
      request: {
        method: req.method,
        url: req.url
      }
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: 'REQUEST_TIMEOUT',
        message: `Request timed out after ${timeout}ms`,
        userMessage: 'The request took too long to process. Please try again.',
        category: 'server',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        requestId,
        retryable: true,
        retryAfter: 5,
        suggestions: [
          'Try again in a few seconds',
          'Check if the server is experiencing high load',
          'Contact support if the problem persists'
        ]
      }
    };

    res.set('Retry-After', '5');
    res.set('X-Request-ID', requestId);
    res.set('X-Error-Category', 'server');
    res.set('X-Error-Severity', 'medium');
    res.status(408).json(errorResponse);
  }

  // Helper method to wrap async route handlers with error handling
  static wrapAsync(fn: Function, context?: string) {
    return (req: Request, res: Response, next: Function) => {
      Promise.resolve(fn(req, res, next)).catch((error) => {
        ValidationErrorHandler.handleError(error, req, res, context);
      });
    };
  }

  // Helper method to validate request and handle validation errors
  static validateRequest(validator: (req: Request) => string[], context?: string) {
    return (req: Request, res: Response, next: Function) => {
      const errors = validator(req);
      if (errors.length > 0) {
        ValidationErrorHandler.handleValidationError(errors, req, res, context);
        return;
      }
      next();
    };
  }
}

// Export convenience functions
export const handleError = ValidationErrorHandler.handleError;
export const handleValidationError = ValidationErrorHandler.handleValidationError;
export const handleNotFoundError = ValidationErrorHandler.handleNotFoundError;
export const handleRateLimitError = ValidationErrorHandler.handleRateLimitError;
export const handleTimeoutError = ValidationErrorHandler.handleTimeoutError;
export const wrapAsync = ValidationErrorHandler.wrapAsync;
export const validateRequest = ValidationErrorHandler.validateRequest;
