// ============================================================================
// Error Handling Types - Comprehensive Error Management
// ============================================================================

import { z } from 'zod';

// ============================================================================
// Base Error Types
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories
 */
export type ErrorCategory = 
  | 'validation'
  | 'fhir-server'
  | 'database'
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'configuration'
  | 'system'
  | 'user-input'
  | 'external-service'
  | 'timeout'
  | 'rate-limit'
  | 'unknown';

/**
 * Error recovery actions
 */
export type ErrorRecoveryAction = 
  | 'retry'
  | 'fallback'
  | 'skip'
  | 'abort'
  | 'user-intervention'
  | 'system-restart'
  | 'none';

/**
 * Base error interface
 */
export interface BaseError {
  code: string;
  message: string;
  details?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  recoveryAction: ErrorRecoveryAction;
  context?: Record<string, any>;
  timestamp: Date;
  stack?: string;
  cause?: Error;
}

// ============================================================================
// Specific Error Types
// ============================================================================

/**
 * Validation error
 */
export interface ValidationError extends BaseError {
  category: 'validation';
  field?: string;
  value?: any;
  expectedType?: string;
  validationRule?: string;
  resourceId?: string;
  resourceType?: string;
}

/**
 * FHIR server error
 */
export interface FhirServerError extends BaseError {
  category: 'fhir-server';
  serverUrl?: string;
  statusCode?: number;
  responseTime?: number;
  operation?: string;
  resourceType?: string;
  resourceId?: string;
}

/**
 * Database error
 */
export interface DatabaseError extends BaseError {
  category: 'database';
  operation?: string;
  table?: string;
  query?: string;
  constraint?: string;
  connectionId?: string;
}

/**
 * Network error
 */
export interface NetworkError extends BaseError {
  category: 'network';
  url?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Authentication error
 */
export interface AuthenticationError extends BaseError {
  category: 'authentication';
  authType?: string;
  serverUrl?: string;
  username?: string;
  tokenExpired?: boolean;
  invalidCredentials?: boolean;
}

/**
 * Configuration error
 */
export interface ConfigurationError extends BaseError {
  category: 'configuration';
  configKey?: string;
  configValue?: any;
  expectedType?: string;
  environment?: string;
}

/**
 * System error
 */
export interface SystemError extends BaseError {
  category: 'system';
  component?: string;
  memoryUsage?: number;
  cpuUsage?: number;
  diskUsage?: number;
  processId?: number;
}

/**
 * User input error
 */
export interface UserInputError extends BaseError {
  category: 'user-input';
  field?: string;
  value?: any;
  expectedFormat?: string;
  validationMessage?: string;
}

/**
 * External service error
 */
export interface ExternalServiceError extends BaseError {
  category: 'external-service';
  serviceName?: string;
  serviceUrl?: string;
  operation?: string;
  statusCode?: number;
  responseTime?: number;
}

/**
 * Timeout error
 */
export interface TimeoutError extends BaseError {
  category: 'timeout';
  operation?: string;
  timeoutMs?: number;
  elapsedMs?: number;
  retryCount?: number;
}

/**
 * Rate limit error
 */
export interface RateLimitError extends BaseError {
  category: 'rate-limit';
  service?: string;
  limit?: number;
  remaining?: number;
  resetTime?: Date;
  retryAfter?: number;
}

// ============================================================================
// Error Handler Types
// ============================================================================

/**
 * Error handler context
 */
export interface ErrorHandlerContext {
  service: string;
  operation: string;
  resourceId?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Error handler result
 */
export interface ErrorHandlerResult {
  handled: boolean;
  error: BaseError;
  shouldRetry: boolean;
  retryAfter?: number;
  fallbackData?: any;
  userMessage?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

/**
 * Error handler function type
 */
export type ErrorHandler = (
  error: Error | BaseError,
  context: ErrorHandlerContext
) => Promise<ErrorHandlerResult> | ErrorHandlerResult;

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  action: ErrorRecoveryAction;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  fallbackHandler?: ErrorHandler;
  userNotification?: boolean;
}

// ============================================================================
// Error Collection Types
// ============================================================================

/**
 * Error collection for batch operations
 */
export interface ErrorCollection {
  errors: BaseError[];
  warnings: BaseError[];
  totalCount: number;
  errorCount: number;
  warningCount: number;
  criticalCount: number;
  recoverableCount: number;
  nonRecoverableCount: number;
  categories: Record<ErrorCategory, number>;
  severities: Record<ErrorSeverity, number>;
}

/**
 * Error summary
 */
export interface ErrorSummary {
  totalErrors: number;
  criticalErrors: number;
  recoverableErrors: number;
  mostCommonCategory: ErrorCategory;
  mostCommonSeverity: ErrorSeverity;
  oldestError?: Date;
  newestError?: Date;
  errorRate: number; // Errors per minute
}

// ============================================================================
// Error Reporting Types
// ============================================================================

/**
 * Error report
 */
export interface ErrorReport {
  id: string;
  timestamp: Date;
  summary: ErrorSummary;
  errors: BaseError[];
  context: ErrorHandlerContext;
  systemInfo: {
    version: string;
    environment: string;
    nodeVersion: string;
    memoryUsage: number;
    uptime: number;
  };
}

/**
 * Error notification
 */
export interface ErrorNotification {
  id: string;
  timestamp: Date;
  error: BaseError;
  context: ErrorHandlerContext;
  userMessage: string;
  technicalMessage: string;
  actionRequired: boolean;
  actionDescription?: string;
}

// ============================================================================
// Zod Schemas for Error Validation
// ============================================================================

/**
 * Base error schema
 */
export const baseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
  category: z.enum([
    'validation',
    'fhir-server',
    'database',
    'network',
    'authentication',
    'authorization',
    'configuration',
    'system',
    'user-input',
    'external-service',
    'timeout',
    'rate-limit',
    'unknown'
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  recoverable: z.boolean(),
  recoveryAction: z.enum([
    'retry',
    'fallback',
    'skip',
    'abort',
    'user-intervention',
    'system-restart',
    'none'
  ]),
  context: z.record(z.any()).optional(),
  timestamp: z.date(),
  stack: z.string().optional(),
});

/**
 * Validation error schema
 */
export const validationErrorSchema = baseErrorSchema.extend({
  category: z.literal('validation'),
  field: z.string().optional(),
  value: z.any().optional(),
  expectedType: z.string().optional(),
  validationRule: z.string().optional(),
  resourceId: z.string().optional(),
  resourceType: z.string().optional(),
});

/**
 * FHIR server error schema
 */
export const fhirServerErrorSchema = baseErrorSchema.extend({
  category: z.literal('fhir-server'),
  serverUrl: z.string().optional(),
  statusCode: z.number().optional(),
  responseTime: z.number().optional(),
  operation: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

/**
 * Database error schema
 */
export const databaseErrorSchema = baseErrorSchema.extend({
  category: z.literal('database'),
  operation: z.string().optional(),
  table: z.string().optional(),
  query: z.string().optional(),
  constraint: z.string().optional(),
  connectionId: z.string().optional(),
});

/**
 * Network error schema
 */
export const networkErrorSchema = baseErrorSchema.extend({
  category: z.literal('network'),
  url: z.string().optional(),
  method: z.string().optional(),
  statusCode: z.number().optional(),
  responseTime: z.number().optional(),
  retryCount: z.number().optional(),
  maxRetries: z.number().optional(),
});

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for base error
 */
export function isBaseError(obj: any): obj is BaseError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.code === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.category === 'string' &&
    typeof obj.severity === 'string' &&
    typeof obj.recoverable === 'boolean' &&
    typeof obj.recoveryAction === 'string' &&
    obj.timestamp instanceof Date
  );
}

/**
 * Type guard for validation error
 */
export function isValidationError(obj: any): obj is ValidationError {
  return isBaseError(obj) && obj.category === 'validation';
}

/**
 * Type guard for FHIR server error
 */
export function isFhirServerError(obj: any): obj is FhirServerError {
  return isBaseError(obj) && obj.category === 'fhir-server';
}

/**
 * Type guard for database error
 */
export function isDatabaseError(obj: any): obj is DatabaseError {
  return isBaseError(obj) && obj.category === 'database';
}

/**
 * Type guard for network error
 */
export function isNetworkError(obj: any): obj is NetworkError {
  return isBaseError(obj) && obj.category === 'network';
}

/**
 * Type guard for authentication error
 */
export function isAuthenticationError(obj: any): obj is AuthenticationError {
  return isBaseError(obj) && obj.category === 'authentication';
}

/**
 * Type guard for configuration error
 */
export function isConfigurationError(obj: any): obj is ConfigurationError {
  return isBaseError(obj) && obj.category === 'configuration';
}

/**
 * Type guard for system error
 */
export function isSystemError(obj: any): obj is SystemError {
  return isBaseError(obj) && obj.category === 'system';
}

/**
 * Type guard for timeout error
 */
export function isTimeoutError(obj: any): obj is TimeoutError {
  return isBaseError(obj) && obj.category === 'timeout';
}

/**
 * Type guard for rate limit error
 */
export function isRateLimitError(obj: any): obj is RateLimitError {
  return isBaseError(obj) && obj.category === 'rate-limit';
}

// ============================================================================
// Error Factory Types
// ============================================================================

/**
 * Error factory function type
 */
export type ErrorFactory<T extends BaseError = BaseError> = (
  message: string,
  context?: Partial<T>,
  cause?: Error
) => T;

/**
 * Error factory registry
 */
export interface ErrorFactoryRegistry {
  validation: ErrorFactory<ValidationError>;
  fhirServer: ErrorFactory<FhirServerError>;
  database: ErrorFactory<DatabaseError>;
  network: ErrorFactory<NetworkError>;
  authentication: ErrorFactory<AuthenticationError>;
  configuration: ErrorFactory<ConfigurationError>;
  system: ErrorFactory<SystemError>;
  userInput: ErrorFactory<UserInputError>;
  externalService: ErrorFactory<ExternalServiceError>;
  timeout: ErrorFactory<TimeoutError>;
  rateLimit: ErrorFactory<RateLimitError>;
}

// ============================================================================
// Error Metrics Types
// ============================================================================

/**
 * Error metrics
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByService: Record<string, number>;
  errorRate: number; // Errors per minute
  recoveryRate: number; // Percentage of recoverable errors
  averageRecoveryTime: number; // Milliseconds
  criticalErrorCount: number;
  lastErrorTime?: Date;
  errorTrend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Error alert configuration
 */
export interface ErrorAlertConfig {
  enabled: boolean;
  severityThreshold: ErrorSeverity;
  categoryThresholds: Partial<Record<ErrorCategory, number>>;
  timeWindow: number; // Minutes
  notificationChannels: string[];
  escalationRules: {
    severity: ErrorSeverity;
    escalationTime: number; // Minutes
    escalationChannels: string[];
  }[];
}

