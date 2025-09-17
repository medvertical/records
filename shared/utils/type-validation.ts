// ============================================================================
// Type Validation Utilities - Runtime Type Safety
// ============================================================================

import { z } from 'zod';
import { 
  ApiResponse, 
  ApiError, 
  PaginatedResponse, 
  PaginationParams,
  FhirServerTestRequest,
  FhirServerTestResponse,
  CreateFhirServerRequest,
  UpdateFhirServerRequest,
  StartValidationRequest,
  StartValidationResponse,
  ValidationStatusResponse,
  ValidationProgressResponse,
  DashboardStatsResponse,
  FhirVersionInfoResponse,
  SSEMessage,
  ValidationProgressSSEMessage,
  ValidationCompletedSSEMessage,
  ValidationErrorSSEMessage
} from '../types/api.js';
import { 
  ValidationProgress, 
  ValidationControlsState, 
  ValidationConfiguration,
  ValidationRunHistory,
  ValidationMetrics 
} from '../types/validation.js';
import { 
  FhirServerStats, 
  ValidationStats, 
  DashboardData 
} from '../types/dashboard.js';
import { 
  BaseError, 
  ValidationError, 
  FhirServerError, 
  DatabaseError, 
  NetworkError 
} from '../types/errors.js';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * API Response validation schema
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.string().optional(),
    field: z.string().optional(),
    context: z.record(z.any()).optional(),
    timestamp: z.string()
  }).optional(),
  timestamp: z.string(),
  requestId: z.string().optional()
});

/**
 * Pagination parameters validation schema
 */
export const paginationParamsSchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

/**
 * FHIR server test request validation schema
 */
export const fhirServerTestRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  authConfig: z.object({
    type: z.enum(['none', 'basic', 'bearer', 'oauth2']),
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional()
  }).optional()
});

/**
 * Validation progress validation schema
 */
export const validationProgressSchema = z.object({
  totalResources: z.number().min(0),
  processedResources: z.number().min(0),
  validResources: z.number().min(0),
  errorResources: z.number().min(0),
  warningResources: z.number().min(0),
  currentResourceType: z.string().optional(),
  startTime: z.union([z.date(), z.string()]),
  estimatedTimeRemaining: z.number().min(0).optional(),
  isComplete: z.boolean(),
  errors: z.array(z.string()),
  status: z.enum(['not_running', 'running', 'paused', 'completed', 'error']),
  processingRate: z.number().min(0),
  currentBatch: z.object({
    batchNumber: z.number().min(1),
    totalBatches: z.number().min(1),
    batchSize: z.number().min(1),
    resourcesInBatch: z.number().min(0)
  }).optional(),
  performance: z.object({
    averageTimePerResource: z.number().min(0),
    totalTimeMs: z.number().min(0),
    memoryUsage: z.number().min(0).optional()
  }).optional()
});

/**
 * FHIR server stats validation schema
 */
export const fhirServerStatsSchema = z.object({
  totalResources: z.number().min(0),
  resourceCounts: z.record(z.string(), z.number().min(0)),
  serverInfo: z.object({
    version: z.string(),
    connected: z.boolean(),
    lastChecked: z.union([z.date(), z.string()]),
    error: z.string().optional()
  }),
  resourceBreakdown: z.array(z.object({
    type: z.string(),
    count: z.number().min(0),
    percentage: z.number().min(0).max(100)
  }))
});

/**
 * Validation stats validation schema
 */
export const validationStatsSchema = z.object({
  totalValidated: z.number().min(0),
  validResources: z.number().min(0),
  errorResources: z.number().min(0),
  warningResources: z.number().min(0),
  unvalidatedResources: z.number().min(0),
  validationCoverage: z.number().min(0).max(100),
  validationProgress: z.number().min(0).max(100),
  lastValidationRun: z.union([z.date(), z.string()]).optional(),
  resourceTypeBreakdown: z.record(z.string(), z.object({
    total: z.number().min(0),
    validated: z.number().min(0),
    valid: z.number().min(0),
    errors: z.number().min(0),
    warnings: z.number().min(0),
    unvalidated: z.number().min(0),
    validationRate: z.number().min(0).max(100),
    successRate: z.number().min(0).max(100)
  }))
});

/**
 * SSE message validation schema
 */
export const sseMessageSchema = z.object({
  type: z.enum([
    'validation-progress',
    'validation-completed',
    'validation-error',
    'validation-paused',
    'validation-resumed',
    'validation-stopped',
    'connection-status',
    'heartbeat'
  ]),
  timestamp: z.string(),
  data: z.any()
});

// ============================================================================
// Type Validation Functions
// ============================================================================

/**
 * Validate API response
 */
export function validateApiResponse<T = any>(data: any): data is ApiResponse<T> {
  try {
    apiResponseSchema.parse(data);
    return true;
  } catch (error) {
    console.warn('API response validation failed:', error);
    return false;
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(data: any): data is PaginationParams {
  try {
    paginationParamsSchema.parse(data);
    return true;
  } catch (error) {
    console.warn('Pagination params validation failed:', error);
    return false;
  }
}

/**
 * Validate FHIR server test request
 */
export function validateFhirServerTestRequest(data: any): data is FhirServerTestRequest {
  try {
    fhirServerTestRequestSchema.parse(data);
    return true;
  } catch (error) {
    console.warn('FHIR server test request validation failed:', error);
    return false;
  }
}

/**
 * Validate validation progress
 */
export function validateValidationProgress(data: any): data is ValidationProgress {
  try {
    validationProgressSchema.parse(data);
    return true;
  } catch (error) {
    console.warn('Validation progress validation failed:', error);
    return false;
  }
}

/**
 * Validate FHIR server stats
 */
export function validateFhirServerStats(data: any): data is FhirServerStats {
  try {
    fhirServerStatsSchema.parse(data);
    return true;
  } catch (error) {
    console.warn('FHIR server stats validation failed:', error);
    return false;
  }
}

/**
 * Validate validation stats
 */
export function validateValidationStats(data: any): data is ValidationStats {
  try {
    validationStatsSchema.parse(data);
    return true;
  } catch (error) {
    console.warn('Validation stats validation failed:', error);
    return false;
  }
}

/**
 * Validate SSE message
 */
export function validateSSEMessage(data: any): data is SSEMessage {
  try {
    sseMessageSchema.parse(data);
    return true;
  } catch (error) {
    console.warn('SSE message validation failed:', error);
    return false;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for API response
 */
export function isApiResponse<T = any>(obj: any): obj is ApiResponse<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.success === 'boolean' &&
    typeof obj.timestamp === 'string' &&
    (obj.data !== undefined || obj.error !== undefined)
  );
}

/**
 * Type guard for API error
 */
export function isApiError(obj: any): obj is ApiError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.code === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.timestamp === 'string'
  );
}

/**
 * Type guard for paginated response
 */
export function isPaginatedResponse<T>(obj: any): obj is PaginatedResponse<T> {
  return (
    isApiResponse<T[]>(obj) &&
    typeof obj.pagination === 'object' &&
    obj.pagination !== null &&
    typeof obj.pagination.page === 'number' &&
    typeof obj.pagination.limit === 'number' &&
    typeof obj.pagination.total === 'number' &&
    typeof obj.pagination.totalPages === 'number' &&
    typeof obj.pagination.hasNext === 'boolean' &&
    typeof obj.pagination.hasPrev === 'boolean'
  );
}

/**
 * Type guard for validation progress
 */
export function isValidationProgress(obj: any): obj is ValidationProgress {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.totalResources === 'number' &&
    typeof obj.processedResources === 'number' &&
    typeof obj.validResources === 'number' &&
    typeof obj.errorResources === 'number' &&
    typeof obj.warningResources === 'number' &&
    typeof obj.isComplete === 'boolean' &&
    Array.isArray(obj.errors) &&
    typeof obj.status === 'string' &&
    typeof obj.processingRate === 'number'
  );
}

/**
 * Type guard for FHIR server stats
 */
export function isFhirServerStats(obj: any): obj is FhirServerStats {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.totalResources === 'number' &&
    typeof obj.resourceCounts === 'object' &&
    obj.resourceCounts !== null &&
    typeof obj.serverInfo === 'object' &&
    obj.serverInfo !== null &&
    typeof obj.serverInfo.version === 'string' &&
    typeof obj.serverInfo.connected === 'boolean' &&
    Array.isArray(obj.resourceBreakdown)
  );
}

/**
 * Type guard for validation stats
 */
export function isValidationStats(obj: any): obj is ValidationStats {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.totalValidated === 'number' &&
    typeof obj.validResources === 'number' &&
    typeof obj.errorResources === 'number' &&
    typeof obj.warningResources === 'number' &&
    typeof obj.unvalidatedResources === 'number' &&
    typeof obj.validationCoverage === 'number' &&
    typeof obj.validationProgress === 'number' &&
    typeof obj.resourceTypeBreakdown === 'object' &&
    obj.resourceTypeBreakdown !== null
  );
}

/**
 * Type guard for dashboard data
 */
export function isDashboardData(obj: any): obj is DashboardData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    isFhirServerStats(obj.fhirServer) &&
    isValidationStats(obj.validation) &&
    typeof obj.lastUpdated === 'string' &&
    typeof obj.dataFreshness === 'object' &&
    obj.dataFreshness !== null
  );
}

/**
 * Type guard for SSE message
 */
export function isSSEMessage(obj: any): obj is SSEMessage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.type === 'string' &&
    typeof obj.timestamp === 'string' &&
    obj.data !== undefined
  );
}

/**
 * Type guard for validation progress SSE message
 */
export function isValidationProgressSSEMessage(obj: any): obj is ValidationProgressSSEMessage {
  return isSSEMessage(obj) && obj.type === 'validation-progress';
}

/**
 * Type guard for validation completed SSE message
 */
export function isValidationCompletedSSEMessage(obj: any): obj is ValidationCompletedSSEMessage {
  return isSSEMessage(obj) && obj.type === 'validation-completed';
}

/**
 * Type guard for validation error SSE message
 */
export function isValidationErrorSSEMessage(obj: any): obj is ValidationErrorSSEMessage {
  return isSSEMessage(obj) && obj.type === 'validation-error';
}

// ============================================================================
// Data Sanitization Functions
// ============================================================================

/**
 * Sanitize API response data
 */
export function sanitizeApiResponse<T>(data: any): ApiResponse<T> {
  if (isApiResponse<T>(data)) {
    return data;
  }

  // Create a safe fallback response
  return {
    success: false,
    error: {
      code: 'INVALID_RESPONSE',
      message: 'Invalid API response format',
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Sanitize validation progress data
 */
export function sanitizeValidationProgress(data: any): ValidationProgress {
  if (isValidationProgress(data)) {
    return data;
  }

  // Create a safe fallback progress
  return {
    totalResources: 0,
    processedResources: 0,
    validResources: 0,
    errorResources: 0,
    warningResources: 0,
    isComplete: false,
    errors: [],
    status: 'not_running',
    processingRate: 0,
    startTime: new Date()
  };
}

/**
 * Sanitize FHIR server stats data
 */
export function sanitizeFhirServerStats(data: any): FhirServerStats {
  if (isFhirServerStats(data)) {
    return data;
  }

  // Create a safe fallback stats
  return {
    totalResources: 0,
    resourceCounts: {},
    serverInfo: {
      version: 'Unknown',
      connected: false,
      lastChecked: new Date(),
      error: 'Invalid data format'
    },
    resourceBreakdown: []
  };
}

/**
 * Sanitize validation stats data
 */
export function sanitizeValidationStats(data: any): ValidationStats {
  if (isValidationStats(data)) {
    return data;
  }

  // Create a safe fallback stats
  return {
    totalValidated: 0,
    validResources: 0,
    errorResources: 0,
    warningResources: 0,
    unvalidatedResources: 0,
    validationCoverage: 0,
    validationProgress: 0,
    resourceTypeBreakdown: {}
  };
}

/**
 * Sanitize dashboard data
 */
export function sanitizeDashboardData(data: any): DashboardData {
  if (isDashboardData(data)) {
    return data;
  }

  // Create a safe fallback dashboard data
  return {
    fhirServer: sanitizeFhirServerStats(data?.fhirServer),
    validation: sanitizeValidationStats(data?.validation),
    lastUpdated: new Date().toISOString(),
    dataFreshness: {
      fhirServer: new Date().toISOString(),
      validation: new Date().toISOString()
    }
  };
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate and sanitize data with fallback
 */
export function validateAndSanitize<T>(
  data: any,
  validator: (data: any) => data is T,
  sanitizer: (data: any) => T,
  fallback: T
): T {
  try {
    if (validator(data)) {
      return data;
    }
    
    return sanitizer(data);
  } catch (error) {
    console.warn('Data validation and sanitization failed:', error);
    return fallback;
  }
}

/**
 * Validate array of data
 */
export function validateArray<T>(
  data: any,
  validator: (item: any) => item is T
): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(validator);
}

/**
 * Validate object properties
 */
export function validateObjectProperties<T extends Record<string, any>>(
  obj: any,
  validators: { [K in keyof T]: (value: any) => value is T[K] }
): Partial<T> {
  if (typeof obj !== 'object' || obj === null) {
    return {};
  }

  const result: Partial<T> = {};
  
  for (const [key, validator] of Object.entries(validators)) {
    if (key in obj && validator(obj[key])) {
      result[key as keyof T] = obj[key];
    }
  }

  return result;
}

/**
 * Safe JSON parse with validation
 */
export function safeJsonParse<T>(
  jsonString: string,
  validator: (data: any) => data is T,
  fallback: T
): T {
  try {
    const parsed = JSON.parse(jsonString);
    if (validator(parsed)) {
      return parsed;
    }
    return fallback;
  } catch (error) {
    console.warn('JSON parse failed:', error);
    return fallback;
  }
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(obj: any, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn('JSON stringify failed:', error);
    return fallback;
  }
}

// ============================================================================
// Type Assertion Utilities
// ============================================================================

/**
 * Assert that data is of a specific type
 */
export function assertType<T>(data: any, validator: (data: any) => data is T): asserts data is T {
  if (!validator(data)) {
    throw new Error(`Type assertion failed: expected ${typeof data} to match expected type`);
  }
}

/**
 * Assert that data is an API response
 */
export function assertApiResponse<T>(data: any): asserts data is ApiResponse<T> {
  assertType(data, isApiResponse<T>);
}

/**
 * Assert that data is validation progress
 */
export function assertValidationProgress(data: any): asserts data is ValidationProgress {
  assertType(data, isValidationProgress);
}

/**
 * Assert that data is FHIR server stats
 */
export function assertFhirServerStats(data: any): asserts data is FhirServerStats {
  assertType(data, isFhirServerStats);
}

/**
 * Assert that data is validation stats
 */
export function assertValidationStats(data: any): asserts data is ValidationStats {
  assertType(data, isValidationStats);
}

/**
 * Assert that data is dashboard data
 */
export function assertDashboardData(data: any): asserts data is DashboardData {
  assertType(data, isDashboardData);
}

/**
 * Assert that data is an SSE message
 */
export function assertSSEMessage(data: any): asserts data is SSEMessage {
  assertType(data, isSSEMessage);
}

