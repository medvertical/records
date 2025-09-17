// ============================================================================
// API Type Definitions - Comprehensive Type Safety
// ============================================================================

import { z } from 'zod';

// ============================================================================
// Base API Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
  requestId?: string;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: string;
  field?: string;
  context?: Record<string, any>;
  timestamp: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// FHIR Server API Types
// ============================================================================

/**
 * FHIR server connection test request
 */
export interface FhirServerTestRequest {
  url: string;
  authConfig?: {
    type: 'none' | 'basic' | 'bearer' | 'oauth2';
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

/**
 * FHIR server connection test response
 */
export interface FhirServerTestResponse {
  connected: boolean;
  version?: string;
  url?: string;
  serverName?: string;
  error?: string;
  errorType?: string;
  statusCode?: number;
  timestamp: string;
  responseTime: number;
}

/**
 * FHIR server creation request
 */
export interface CreateFhirServerRequest {
  name: string;
  url: string;
  authConfig?: FhirServerTestRequest['authConfig'];
}

/**
 * FHIR server update request
 */
export interface UpdateFhirServerRequest {
  name?: string;
  url?: string;
  authConfig?: FhirServerTestRequest['authConfig'];
}

// ============================================================================
// Validation API Types
// ============================================================================

/**
 * Validation start request
 */
export interface StartValidationRequest {
  batchSize?: number;
  forceRevalidation?: boolean;
  skipUnchanged?: boolean;
  resourceTypes?: string[];
  customConfiguration?: Record<string, any>;
}

/**
 * Validation start response
 */
export interface StartValidationResponse {
  success: boolean;
  validationId: string;
  estimatedDuration?: number;
  message: string;
}

/**
 * Validation status response
 */
export interface ValidationStatusResponse {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'stopping';
  isRunning: boolean;
  isPaused: boolean;
  progress: ValidationProgressResponse | null;
}

/**
 * Validation progress response
 */
export interface ValidationProgressResponse {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  currentResourceType?: string;
  startTime: string;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: 'not_running' | 'running' | 'paused' | 'completed' | 'error';
  processingRate: number;
  currentBatch?: {
    batchNumber: number;
    totalBatches: number;
    batchSize: number;
    resourcesInBatch: number;
  };
  performance?: {
    averageTimePerResource: number;
    totalTimeMs: number;
    memoryUsage?: number;
  };
}

// ============================================================================
// Dashboard API Types
// ============================================================================

/**
 * Dashboard stats response
 */
export interface DashboardStatsResponse {
  fhirServer: {
    totalResources: number;
    resourceCounts: Record<string, number>;
    serverInfo: {
      version: string;
      connected: boolean;
      lastChecked: string;
      error?: string;
    };
    resourceBreakdown: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
  validation: {
    totalValidated: number;
    validResources: number;
    errorResources: number;
    warningResources: number;
    unvalidatedResources: number;
    validationCoverage: number;
    validationProgress: number;
    lastValidationRun?: string;
    resourceTypeBreakdown: Record<string, {
      total: number;
      validated: number;
      valid: number;
      errors: number;
      warnings: number;
      unvalidated: number;
      validationRate: number;
      successRate: number;
    }>;
  };
  lastUpdated: string;
  dataFreshness: {
    fhirServer: string;
    validation: string;
  };
}

/**
 * FHIR version info response
 */
export interface FhirVersionInfoResponse {
  version: string | null;
  isR5: boolean;
  totalResourceTypes: number;
  priorityResourceTypes: string[];
  allResourceTypes: string[];
}

// ============================================================================
// SSE (Server-Sent Events) Types
// ============================================================================

/**
 * SSE message types
 */
export type SSEMessageType = 
  | 'validation-progress'
  | 'validation-completed'
  | 'validation-error'
  | 'validation-paused'
  | 'validation-resumed'
  | 'validation-stopped'
  | 'connection-status'
  | 'heartbeat';

/**
 * Base SSE message
 */
export interface SSEMessage {
  type: SSEMessageType;
  timestamp: string;
  data: any;
}

/**
 * Validation progress SSE message
 */
export interface ValidationProgressSSEMessage extends SSEMessage {
  type: 'validation-progress';
  data: ValidationProgressResponse;
}

/**
 * Validation completed SSE message
 */
export interface ValidationCompletedSSEMessage extends SSEMessage {
  type: 'validation-completed';
  data: {
    progress: ValidationProgressResponse;
    summary: {
      totalResources: number;
      processedResources: number;
      validResources: number;
      errorResources: number;
      warningResources: number;
      duration: number;
      successRate: number;
    };
  };
}

/**
 * Validation error SSE message
 */
export interface ValidationErrorSSEMessage extends SSEMessage {
  type: 'validation-error';
  data: {
    error: string;
    code?: string;
    recoverable: boolean;
    retryAfter?: number;
  };
}

/**
 * Connection status SSE message
 */
export interface ConnectionStatusSSEMessage extends SSEMessage {
  type: 'connection-status';
  data: {
    connected: boolean;
    timestamp: string;
    clientId?: string;
  };
}

/**
 * Heartbeat SSE message
 */
export interface HeartbeatSSEMessage extends SSEMessage {
  type: 'heartbeat';
  data: {
    timestamp: string;
    serverTime: string;
  };
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

/**
 * FHIR server test request schema
 */
export const fhirServerTestRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  authConfig: z.object({
    type: z.enum(['none', 'basic', 'bearer', 'oauth2']),
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }).optional(),
});

/**
 * Create FHIR server request schema
 */
export const createFhirServerRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Invalid URL format'),
  authConfig: fhirServerTestRequestSchema.shape.authConfig.optional(),
});

/**
 * Update FHIR server request schema
 */
export const updateFhirServerRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  url: z.string().url('Invalid URL format').optional(),
  authConfig: fhirServerTestRequestSchema.shape.authConfig.optional(),
});

/**
 * Start validation request schema
 */
export const startValidationRequestSchema = z.object({
  batchSize: z.number().min(1).max(1000).optional(),
  forceRevalidation: z.boolean().optional(),
  skipUnchanged: z.boolean().optional(),
  resourceTypes: z.array(z.string()).optional(),
  customConfiguration: z.record(z.any()).optional(),
});

/**
 * Pagination parameters schema
 */
export const paginationParamsSchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for API response
 */
export function isApiResponse<T>(obj: any): obj is ApiResponse<T> {
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
// Utility Types
// ============================================================================

/**
 * Make all properties optional except specified ones
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Make all properties required except specified ones
 */
export type RequiredExcept<T, K extends keyof T> = Required<T> & Partial<Pick<T, K>>;

/**
 * Extract the data type from an API response
 */
export type ApiResponseData<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Extract the error type from an API response
 */
export type ApiResponseError<T> = T extends ApiResponse<any, infer E> ? E : never;

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * API endpoint configuration
 */
export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description?: string;
  requestSchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
  requiresAuth?: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * API route handler type
 */
export type ApiRouteHandler<TRequest = any, TResponse = any> = (
  req: TRequest,
  res: TResponse
) => Promise<ApiResponse<TResponse>> | ApiResponse<TResponse>;

