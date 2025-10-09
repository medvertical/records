/**
 * Centralized Error Handling Utilities
 * 
 * Provides consistent error handling and validation across all API endpoints
 */

import type { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ValidationError extends Error implements ApiError {
  public statusCode = 400;
  public code = 'VALIDATION_ERROR';
  public details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error implements ApiError {
  public statusCode = 404;
  public code = 'NOT_FOUND';

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ServiceError extends Error implements ApiError {
  public statusCode = 500;
  public code = 'SERVICE_ERROR';
  public details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ServiceError';
    this.details = details;
  }
}

/**
 * Centralized error handler middleware
 */
export function errorHandler(error: ApiError, req: Request, res: Response, next: NextFunction) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  
  // Log error for debugging
  console.error(`[API Error] ${code}: ${error.message}`, {
    url: req.url,
    method: req.method,
    statusCode,
    details: error.details,
    stack: error.stack
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      path: req.url
    }
  });
}

/**
 * Async error wrapper to catch async errors in route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

  /**
 * Input validation utilities
 */
export class InputValidator {
  static validateRequired(value: any, fieldName: string): void {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  static validateString(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
    this.validateRequired(value, fieldName);
    
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`);
    }
    
    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
    }
    
    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters long`);
    }
  }

  static validateNumber(value: any, fieldName: string, min?: number, max?: number): void {
    this.validateRequired(value, fieldName);
    
    const num = Number(value);
    if (isNaN(num)) {
      throw new ValidationError(`${fieldName} must be a valid number`);
    }
    
    if (min !== undefined && num < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`);
    }
    
    if (max !== undefined && num > max) {
      throw new ValidationError(`${fieldName} must be no more than ${max}`);
    }
  }

  static validateArray(value: any, fieldName: string, minLength?: number): void {
    this.validateRequired(value, fieldName);
    
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`);
    }
    
    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(`${fieldName} must contain at least ${minLength} items`);
    }
  }

  static validateObject(value: any, fieldName: string, requiredFields?: string[]): void {
    this.validateRequired(value, fieldName);
    
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an object`);
    }
    
    if (requiredFields) {
      for (const field of requiredFields) {
        if (!(field in value)) {
          throw new ValidationError(`${fieldName} must contain field: ${field}`);
        }
      }
    }
  }

  static validateEnum(value: any, fieldName: string, allowedValues: string[]): void {
    this.validateRequired(value, fieldName);
    
    if (!allowedValues.includes(value)) {
      throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
  }
}

/**
 * Response utilities for consistent API responses
 */
export class ApiResponse {
  static success(res: Response, data: any, message?: string, statusCode = 200) {
    res.status(statusCode).json({
      success: true,
      message: message || 'Operation completed successfully',
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res: Response, error: ApiError) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString()
      }
    });
  }

  static validationError(res: Response, message: string, details?: any) {
    const error = new ValidationError(message, details);
    this.error(res, error);
  }

  static notFound(res: Response, message: string) {
    const error = new NotFoundError(message);
    this.error(res, error);
  }

  static serviceError(res: Response, message: string, details?: any) {
    const error = new ServiceError(message, details);
    this.error(res, error);
  }
}