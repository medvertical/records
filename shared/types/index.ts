// ============================================================================
// Type Safety Index - Comprehensive Type Exports
// ============================================================================

// ============================================================================
// API Types
// ============================================================================
export * from './api.js';

// ============================================================================
// Error Types
// ============================================================================
export * from './errors.js';

// ============================================================================
// Service Types
// ============================================================================
export * from './services.js';

// ============================================================================
// Validation Types
// ============================================================================
export * from './validation.js';

// Note: Validation types are already exported above via export * from './validation.js'

// ============================================================================
// Dashboard Types
// ============================================================================
export * from './dashboard.js';

// ============================================================================
// Schema Types
// ============================================================================
export * from '../schema.js';

// ============================================================================
// Type Validation Utilities
// ============================================================================
export * from '../utils/type-validation.js';

// ============================================================================
// Re-export commonly used types for convenience
// ============================================================================

// API Types
export type {
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
} from './api.js';

// Error Types
export type {
  BaseError,
  ValidationError,
  FhirServerError,
  DatabaseError,
  NetworkError,
  AuthenticationError,
  ConfigurationError,
  SystemError,
  ErrorHandlerContext,
  ErrorHandlerResult,
  ErrorCategory,
  ErrorSeverity,
  ErrorRecoveryAction,
  ErrorCollection,
  ErrorSummary,
  ErrorReport,
  ErrorNotification,
  ErrorMetrics,
  ErrorAlertConfig
} from './errors.js';

// Service Types
export type {
  BaseService,
  ServiceMetrics,
  FhirClientService,
  StorageService,
  ValidationService,
  DashboardService,
  CacheService,
  SSEService,
  ServiceRegistry,
  ServiceFactory,
  ServiceConfig,
  ServiceError,
  ServiceInitializationError,
  ServiceHealthCheckError,
  ServiceEventType,
  ServiceEvent,
  ServiceEventHandler,
  ServiceEventEmitter
} from './services.js';

// Note: Validation types are already exported above via export * from './validation.js'

// Dashboard Types
export type {
  FhirServerStats,
  ValidationStats,
  DashboardData,
  ValidationProgress as DashboardValidationProgress,
  DashboardCard,
  DataSourceIndicator,
  DashboardError
} from './dashboard.js';

// Schema Types
export type {
  FhirServer,
  InsertFhirServer,
  FhirResource,
  InsertFhirResource,
  ValidationProfile,
  InsertValidationProfile,
  ValidationResult,
  InsertValidationResult,
  DashboardCard as SchemaDashboardCard,
  InsertDashboardCard,
  ValidationSettings,
  InsertValidationSettings,
  FhirResourceWithValidation,
  ValidationError as SchemaValidationError,
  ResourceStats
} from '../schema.js';

// Type Validation Utilities
export {
  validateApiResponse,
  validatePaginationParams,
  validateFhirServerTestRequest,
  validateValidationProgress,
  validateFhirServerStats,
  validateValidationStats,
  validateSSEMessage,
  isApiResponse,
  isApiError,
  isPaginatedResponse,
  isValidationProgress,
  isFhirServerStats,
  isValidationStats,
  isDashboardData,
  isSSEMessage,
  isValidationProgressSSEMessage,
  isValidationCompletedSSEMessage,
  isValidationErrorSSEMessage,
  sanitizeApiResponse,
  sanitizeValidationProgress,
  sanitizeFhirServerStats,
  sanitizeValidationStats,
  sanitizeDashboardData,
  validateAndSanitize,
  validateArray,
  validateObjectProperties,
  safeJsonParse,
  safeJsonStringify,
  assertType,
  assertApiResponse,
  assertValidationProgress,
  assertFhirServerStats,
  assertValidationStats,
  assertDashboardData,
  assertSSEMessage
} from '../utils/type-validation.js';

// ============================================================================
// Type Safety Constants
// ============================================================================

/**
 * Common error codes
 */
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_RESOURCE: 'INVALID_RESOURCE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',
  
  // FHIR server errors
  FHIR_SERVER_CONNECTION_FAILED: 'FHIR_SERVER_CONNECTION_FAILED',
  FHIR_SERVER_TIMEOUT: 'FHIR_SERVER_TIMEOUT',
  FHIR_SERVER_AUTHENTICATION_FAILED: 'FHIR_SERVER_AUTHENTICATION_FAILED',
  FHIR_RESOURCE_NOT_FOUND: 'FHIR_RESOURCE_NOT_FOUND',
  
  // Database errors
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  DATABASE_CONSTRAINT_VIOLATION: 'DATABASE_CONSTRAINT_VIOLATION',
  
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_REFUSED: 'NETWORK_CONNECTION_REFUSED',
  NETWORK_DNS_ERROR: 'NETWORK_DNS_ERROR',
  
  // Authentication errors
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Configuration errors
  CONFIGURATION_INVALID: 'CONFIGURATION_INVALID',
  CONFIGURATION_MISSING: 'CONFIGURATION_MISSING',
  CONFIGURATION_TYPE_MISMATCH: 'CONFIGURATION_TYPE_MISMATCH',
  
  // System errors
  SYSTEM_OUT_OF_MEMORY: 'SYSTEM_OUT_OF_MEMORY',
  SYSTEM_DISK_FULL: 'SYSTEM_DISK_FULL',
  SYSTEM_PROCESS_CRASHED: 'SYSTEM_PROCESS_CRASHED',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_QUOTA_EXCEEDED: 'RATE_LIMIT_QUOTA_EXCEEDED',
  
  // Unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
} as const;

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.VALIDATION_FAILED]: 'Validation failed',
  [ERROR_CODES.INVALID_RESOURCE]: 'Invalid resource format',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ERROR_CODES.INVALID_FIELD_TYPE]: 'Invalid field type',
  [ERROR_CODES.FHIR_SERVER_CONNECTION_FAILED]: 'Failed to connect to FHIR server',
  [ERROR_CODES.FHIR_SERVER_TIMEOUT]: 'FHIR server request timeout',
  [ERROR_CODES.FHIR_SERVER_AUTHENTICATION_FAILED]: 'FHIR server authentication failed',
  [ERROR_CODES.FHIR_RESOURCE_NOT_FOUND]: 'FHIR resource not found',
  [ERROR_CODES.DATABASE_CONNECTION_FAILED]: 'Database connection failed',
  [ERROR_CODES.DATABASE_QUERY_FAILED]: 'Database query failed',
  [ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION]: 'Database constraint violation',
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Network request timeout',
  [ERROR_CODES.NETWORK_CONNECTION_REFUSED]: 'Network connection refused',
  [ERROR_CODES.NETWORK_DNS_ERROR]: 'DNS resolution failed',
  [ERROR_CODES.AUTHENTICATION_REQUIRED]: 'Authentication required',
  [ERROR_CODES.AUTHENTICATION_FAILED]: 'Authentication failed',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Authentication token expired',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid credentials',
  [ERROR_CODES.CONFIGURATION_INVALID]: 'Invalid configuration',
  [ERROR_CODES.CONFIGURATION_MISSING]: 'Missing configuration',
  [ERROR_CODES.CONFIGURATION_TYPE_MISMATCH]: 'Configuration type mismatch',
  [ERROR_CODES.SYSTEM_OUT_OF_MEMORY]: 'System out of memory',
  [ERROR_CODES.SYSTEM_DISK_FULL]: 'System disk full',
  [ERROR_CODES.SYSTEM_PROCESS_CRASHED]: 'System process crashed',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ERROR_CODES.RATE_LIMIT_QUOTA_EXCEEDED]: 'Rate limit quota exceeded',
  [ERROR_CODES.UNKNOWN_ERROR]: 'Unknown error occurred',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Internal server error'
} as const;

/**
 * Common HTTP status codes
 */
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * Common validation statuses
 */
export const VALIDATION_STATUSES = {
  NOT_RUNNING: 'not_running',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
  STOPPING: 'stopping'
} as const;

/**
 * Common validation actions
 */
export const VALIDATION_ACTIONS = {
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  STOP: 'stop',
  RESET: 'reset'
} as const;

/**
 * Common error severities
 */
export const ERROR_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

/**
 * Common error categories
 */
export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  FHIR_SERVER: 'fhir-server',
  DATABASE: 'database',
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  CONFIGURATION: 'configuration',
  SYSTEM: 'system',
  USER_INPUT: 'user-input',
  EXTERNAL_SERVICE: 'external-service',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate-limit',
  UNKNOWN: 'unknown'
} as const;

/**
 * Common recovery actions
 */
export const RECOVERY_ACTIONS = {
  RETRY: 'retry',
  FALLBACK: 'fallback',
  SKIP: 'skip',
  ABORT: 'abort',
  USER_INTERVENTION: 'user-intervention',
  SYSTEM_RESTART: 'system-restart',
  NONE: 'none'
} as const;

// ============================================================================
// Type Safety Utilities
// ============================================================================

/**
 * Create a type-safe error
 */
export function createTypedError(
  code: keyof typeof ERROR_CODES,
  message?: string,
  context?: Record<string, any>
): BaseError {
  return {
    code: ERROR_CODES[code],
    message: message || ERROR_MESSAGES[ERROR_CODES[code]],
    category: 'unknown',
    severity: 'medium',
    recoverable: false,
    recoveryAction: 'none',
    context: {
      service: 'type-safety',
      operation: 'create-typed-error',
      timestamp: new Date(),
      ...context
    },
    timestamp: new Date()
  };
}

/**
 * Create a type-safe API response
 */
export function createTypedApiResponse<T>(
  success: boolean,
  data?: T,
  error?: ApiError
): ApiResponse<T> {
  return {
    success,
    data,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a type-safe paginated response
 */
export function createTypedPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
): PaginatedResponse<T> {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    }
  };
}

/**
 * Type-safe object key access
 */
export function getTypedProperty<T, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  return obj[key];
}

/**
 * Type-safe array access
 */
export function getTypedArrayItem<T>(array: T[], index: number): T | undefined {
  return array[index];
}

/**
 * Type-safe object property check
 */
export function hasTypedProperty<T, K extends keyof T>(obj: T, key: K): obj is T & Record<K, T[K]> {
  return key in obj;
}

/**
 * Type-safe string to enum conversion
 */
export function stringToEnum<T extends Record<string, string>>(
  enumObject: T,
  value: string
): T[keyof T] | undefined {
  return Object.values(enumObject).includes(value as T[keyof T]) 
    ? (value as T[keyof T]) 
    : undefined;
}

/**
 * Type-safe enum to string conversion
 */
export function enumToString<T extends Record<string, string>>(
  enumObject: T,
  value: T[keyof T]
): string {
  return value;
}

// ============================================================================
// Type Safety Decorators (for future use)
// ============================================================================

/**
 * Type safety decorator for methods
 */
export function typeSafe(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    // Add type safety checks here
    return originalMethod.apply(this, args);
  };
  
  return descriptor;
}

/**
 * Type safety decorator for classes
 */
export function typeSafeClass<T extends new (...args: any[]) => any>(constructor: T) {
  return class extends constructor {
    constructor(...args: any[]) {
      super(...args);
      // Add type safety initialization here
    }
  };
}

