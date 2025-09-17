// ============================================================================
// Enhanced Error Handling Utility with Comprehensive Type Safety
// ============================================================================

import { AxiosError } from 'axios';
import { 
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
} from '@shared/types/errors.js';
import { logger } from './logger.js';

/**
 * Enhanced error handler with comprehensive type safety
 */
export class EnhancedErrorHandler {
  private static instance: EnhancedErrorHandler;
  private errorLog: BaseError[] = [];
  private errorMetrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    errorsByService: {},
    errorRate: 0,
    recoveryRate: 0,
    averageRecoveryTime: 0,
    criticalErrorCount: 0,
    lastErrorTime: undefined,
    errorTrend: 'stable'
  };
  private alertConfig: ErrorAlertConfig = {
    enabled: true,
    severityThreshold: 'high',
    categoryThresholds: {
      'fhir-server': 5,
      'database': 3,
      'validation': 10,
      'network': 8
    },
    timeWindow: 5, // 5 minutes
    notificationChannels: ['console', 'log'],
    escalationRules: [
      {
        severity: 'critical',
        escalationTime: 1,
        escalationChannels: ['console', 'log', 'alert']
      }
    ]
  };

  private constructor() {
    this.initializeMetrics();
  }

  static getInstance(): EnhancedErrorHandler {
    if (!EnhancedErrorHandler.instance) {
      EnhancedErrorHandler.instance = new EnhancedErrorHandler();
    }
    return EnhancedErrorHandler.instance;
  }

  /**
   * Handle and standardize errors with comprehensive type safety
   */
  handleError(
    error: Error | BaseError,
    context: ErrorHandlerContext
  ): ErrorHandlerResult {
    const baseError = this.standardizeError(error, context);
    const result = this.processError(baseError, context);
    
    this.updateMetrics(baseError);
    this.logError(baseError, result);
    this.checkAlerts(baseError);
    
    return result;
  }

  /**
   * Handle validation errors
   */
  handleValidationError(
    error: Error | BaseError,
    context: ErrorHandlerContext,
    resourceType?: string,
    resourceId?: string
  ): ErrorHandlerResult {
    const validationError: ValidationError = {
      ...this.standardizeError(error, context),
      category: 'validation',
      field: this.extractFieldFromError(error),
      value: this.extractValueFromError(error),
      expectedType: this.extractExpectedTypeFromError(error),
      validationRule: this.extractValidationRuleFromError(error),
      resourceId,
      resourceType
    };

    return this.handleError(validationError, context);
  }

  /**
   * Handle FHIR server errors
   */
  handleFhirServerError(
    error: Error | BaseError,
    context: ErrorHandlerContext,
    serverUrl?: string,
    operation?: string,
    resourceType?: string,
    resourceId?: string
  ): ErrorHandlerResult {
    const fhirError: FhirServerError = {
      ...this.standardizeError(error, context),
      category: 'fhir-server',
      serverUrl,
      statusCode: this.extractStatusCodeFromError(error),
      responseTime: this.extractResponseTimeFromError(error),
      operation,
      resourceType,
      resourceId
    };

    return this.handleError(fhirError, context);
  }

  /**
   * Handle database errors
   */
  handleDatabaseError(
    error: Error | BaseError,
    context: ErrorHandlerContext,
    operation?: string,
    table?: string,
    query?: string
  ): ErrorHandlerResult {
    const dbError: DatabaseError = {
      ...this.standardizeError(error, context),
      category: 'database',
      operation,
      table,
      query,
      constraint: this.extractConstraintFromError(error),
      connectionId: this.extractConnectionIdFromError(error)
    };

    return this.handleError(dbError, context);
  }

  /**
   * Handle network errors
   */
  handleNetworkError(
    error: Error | BaseError,
    context: ErrorHandlerContext,
    url?: string,
    method?: string
  ): ErrorHandlerResult {
    const networkError: NetworkError = {
      ...this.standardizeError(error, context),
      category: 'network',
      url,
      method,
      statusCode: this.extractStatusCodeFromError(error),
      responseTime: this.extractResponseTimeFromError(error),
      retryCount: this.extractRetryCountFromError(error),
      maxRetries: this.extractMaxRetriesFromError(error)
    };

    return this.handleError(networkError, context);
  }

  /**
   * Handle authentication errors
   */
  handleAuthenticationError(
    error: Error | BaseError,
    context: ErrorHandlerContext,
    authType?: string,
    serverUrl?: string
  ): ErrorHandlerResult {
    const authError: AuthenticationError = {
      ...this.standardizeError(error, context),
      category: 'authentication',
      authType,
      serverUrl,
      username: this.extractUsernameFromError(error),
      tokenExpired: this.isTokenExpiredError(error),
      invalidCredentials: this.isInvalidCredentialsError(error)
    };

    return this.handleError(authError, context);
  }

  /**
   * Handle configuration errors
   */
  handleConfigurationError(
    error: Error | BaseError,
    context: ErrorHandlerContext,
    configKey?: string,
    configValue?: any
  ): ErrorHandlerResult {
    const configError: ConfigurationError = {
      ...this.standardizeError(error, context),
      category: 'configuration',
      configKey,
      configValue,
      expectedType: this.extractExpectedTypeFromError(error),
      environment: process.env.NODE_ENV
    };

    return this.handleError(configError, context);
  }

  /**
   * Handle system errors
   */
  handleSystemError(
    error: Error | BaseError,
    context: ErrorHandlerContext,
    component?: string
  ): ErrorHandlerResult {
    const systemError: SystemError = {
      ...this.standardizeError(error, context),
      category: 'system',
      component,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user,
      diskUsage: this.getDiskUsage(),
      processId: process.pid
    };

    return this.handleError(systemError, context);
  }

  /**
   * Get error collection for batch operations
   */
  getErrorCollection(): ErrorCollection {
    const errors = this.errorLog.filter(e => e.severity === 'high' || e.severity === 'critical');
    const warnings = this.errorLog.filter(e => e.severity === 'low' || e.severity === 'medium');
    
    const categories = this.groupByCategory(this.errorLog);
    const severities = this.groupBySeverity(this.errorLog);
    
    return {
      errors,
      warnings,
      totalCount: this.errorLog.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      criticalCount: this.errorLog.filter(e => e.severity === 'critical').length,
      recoverableCount: this.errorLog.filter(e => e.recoverable).length,
      nonRecoverableCount: this.errorLog.filter(e => !e.recoverable).length,
      categories,
      severities
    };
  }

  /**
   * Get error summary
   */
  getErrorSummary(): ErrorSummary {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentErrors = this.errorLog.filter(e => e.timestamp >= oneHourAgo);
    
    const categories = this.groupByCategory(this.errorLog);
    const severities = this.groupBySeverity(this.errorLog);
    
    const mostCommonCategory = Object.entries(categories).reduce((a, b) => 
      categories[a[0]] > categories[b[0]] ? a : b
    )[0] as ErrorCategory;
    
    const mostCommonSeverity = Object.entries(severities).reduce((a, b) => 
      severities[a[0]] > severities[b[0]] ? a : b
    )[0] as ErrorSeverity;
    
    const errorRate = recentErrors.length / 60; // Errors per minute
    
    return {
      totalErrors: this.errorLog.length,
      criticalErrors: this.errorLog.filter(e => e.severity === 'critical').length,
      recoverableErrors: this.errorLog.filter(e => e.recoverable).length,
      mostCommonCategory,
      mostCommonSeverity,
      oldestError: this.errorLog.length > 0 ? this.errorLog[0].timestamp : undefined,
      newestError: this.errorLog.length > 0 ? this.errorLog[this.errorLog.length - 1].timestamp : undefined,
      errorRate
    };
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Generate error report
   */
  generateErrorReport(): ErrorReport {
    const summary = this.getErrorSummary();
    const systemInfo = {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage().heapUsed,
      uptime: process.uptime()
    };

    return {
      id: `error-report-${Date.now()}`,
      timestamp: new Date(),
      summary,
      errors: this.errorLog.slice(-100), // Last 100 errors
      context: {
        service: 'error-handler',
        operation: 'generate-report',
        timestamp: new Date()
      },
      systemInfo
    };
  }

  /**
   * Clear old error logs
   */
  clearOldLogs(olderThanDays: number = 7): void {
    const cutoff = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    this.errorLog = this.errorLog.filter(error => error.timestamp >= cutoff);
    this.initializeMetrics();
  }

  /**
   * Set alert configuration
   */
  setAlertConfig(config: Partial<ErrorAlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  private standardizeError(error: Error | BaseError, context: ErrorHandlerContext): BaseError {
    if (this.isBaseError(error)) {
      return error;
    }

    const category = this.determineErrorCategory(error, context);
    const severity = this.determineErrorSeverity(error, category);
    const recoverable = this.isRecoverable(error, category);
    const recoveryAction = this.determineRecoveryAction(error, category, recoverable);

    return {
      code: this.extractErrorCode(error),
      message: this.extractErrorMessage(error),
      details: this.extractErrorDetails(error),
      category,
      severity,
      recoverable,
      recoveryAction,
      context: {
        ...context,
        timestamp: new Date()
      },
      timestamp: new Date(),
      stack: error.stack,
      cause: error
    };
  }

  private processError(error: BaseError, context: ErrorHandlerContext): ErrorHandlerResult {
    const shouldRetry = error.recoverable && error.recoveryAction === 'retry';
    const retryAfter = shouldRetry ? this.calculateRetryDelay(error) : undefined;
    const fallbackData = this.generateFallbackData(error, context);
    const userMessage = this.generateUserMessage(error);
    const logLevel = this.determineLogLevel(error.severity);

    return {
      handled: true,
      error,
      shouldRetry,
      retryAfter,
      fallbackData,
      userMessage,
      logLevel
    };
  }

  private updateMetrics(error: BaseError): void {
    this.errorMetrics.totalErrors++;
    this.errorMetrics.errorsByCategory[error.category] = 
      (this.errorMetrics.errorsByCategory[error.category] || 0) + 1;
    this.errorMetrics.errorsBySeverity[error.severity] = 
      (this.errorMetrics.errorsBySeverity[error.severity] || 0) + 1;
    this.errorMetrics.errorsByService[error.context.service] = 
      (this.errorMetrics.errorsByService[error.context.service] || 0) + 1;
    
    if (error.severity === 'critical') {
      this.errorMetrics.criticalErrorCount++;
    }
    
    this.errorMetrics.lastErrorTime = error.timestamp;
    
    // Calculate error rate (errors per minute)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const recentErrors = this.errorLog.filter(e => e.timestamp >= oneMinuteAgo);
    this.errorMetrics.errorRate = recentErrors.length;
    
    // Calculate recovery rate
    const recoverableErrors = this.errorLog.filter(e => e.recoverable);
    this.errorMetrics.recoveryRate = this.errorLog.length > 0 
      ? (recoverableErrors.length / this.errorLog.length) * 100 
      : 0;
  }

  private logError(error: BaseError, result: ErrorHandlerResult): void {
    this.errorLog.push(error);
    
    const logMessage = `[${error.context.service}] ${error.message} (${error.code})`;
    const logData = {
      error: error.code,
      message: error.message,
      category: error.category,
      severity: error.severity,
      recoverable: error.recoverable,
      service: error.context.service,
      operation: error.context.operation,
      shouldRetry: result.shouldRetry,
      retryAfter: result.retryAfter
    };

    switch (result.logLevel) {
      case 'fatal':
        logger.error(logMessage, { service: 'error-handler', operation: 'logError', ...logData });
        break;
      case 'error':
        logger.error(logMessage, { service: 'error-handler', operation: 'logError', ...logData });
        break;
      case 'warn':
        logger.warn(logMessage, { service: 'error-handler', operation: 'logError', ...logData });
        break;
      case 'info':
        logger.info(logMessage, { service: 'error-handler', operation: 'logError', ...logData });
        break;
      case 'debug':
        logger.debug(logMessage, { service: 'error-handler', operation: 'logError', ...logData });
        break;
    }
  }

  private checkAlerts(error: BaseError): void {
    if (!this.alertConfig.enabled) return;
    
    const shouldAlert = this.shouldTriggerAlert(error);
    if (shouldAlert) {
      this.triggerAlert(error);
    }
  }

  private shouldTriggerAlert(error: BaseError): boolean {
    // Check severity threshold
    const severityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
    const errorSeverityLevel = severityLevels[error.severity];
    const thresholdLevel = severityLevels[this.alertConfig.severityThreshold];
    
    if (errorSeverityLevel < thresholdLevel) return false;
    
    // Check category threshold
    const categoryThreshold = this.alertConfig.categoryThresholds[error.category];
    if (categoryThreshold) {
      const recentErrors = this.getRecentErrorsByCategory(error.category);
      if (recentErrors.length >= categoryThreshold) return true;
    }
    
    return false;
  }

  private triggerAlert(error: BaseError): void {
    const alertMessage = `ALERT: ${error.severity.toUpperCase()} error in ${error.context.service}`;
    const alertData = {
      error: error.code,
      message: error.message,
      category: error.category,
      severity: error.severity,
      service: error.context.service,
      operation: error.context.operation,
      timestamp: error.timestamp
    };

    logger.error(alertMessage, { service: 'error-handler', operation: 'triggerAlert', ...alertData });
  }

  private getRecentErrorsByCategory(category: ErrorCategory): BaseError[] {
    const now = new Date();
    const timeWindow = new Date(now.getTime() - this.alertConfig.timeWindow * 60 * 1000);
    return this.errorLog.filter(e => 
      e.category === category && e.timestamp >= timeWindow
    );
  }

  private determineErrorCategory(error: Error, context: ErrorHandlerContext): ErrorCategory {
    if (error.message?.includes('validation')) return 'validation';
    if (error.message?.includes('fhir') || context.service === 'fhir') return 'fhir-server';
    if (error.message?.includes('database') || context.service === 'database') return 'database';
    if (error.message?.includes('network') || error.message?.includes('connection')) return 'network';
    if (error.message?.includes('auth') || error.message?.includes('token')) return 'authentication';
    if (error.message?.includes('config') || error.message?.includes('setting')) return 'configuration';
    if (error.message?.includes('timeout')) return 'timeout';
    if (error.message?.includes('rate limit')) return 'rate-limit';
    return 'unknown';
  }

  private determineErrorSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    if (error.message?.includes('fatal') || error.message?.includes('critical')) return 'critical';
    if (error.message?.includes('error')) return 'high';
    if (error.message?.includes('warning')) return 'medium';
    if (error.message?.includes('info')) return 'low';
    
    // Category-based severity
    switch (category) {
      case 'system':
      case 'database':
        return 'high';
      case 'fhir-server':
      case 'network':
        return 'medium';
      case 'validation':
      case 'user-input':
        return 'low';
      default:
        return 'medium';
    }
  }

  private isRecoverable(error: Error, category: ErrorCategory): boolean {
    // Network errors are usually recoverable
    if (category === 'network') return true;
    if (category === 'timeout') return true;
    if (category === 'rate-limit') return true;
    
    // System errors are usually not recoverable
    if (category === 'system') return false;
    if (category === 'configuration') return false;
    
    // Check error message for recoverability indicators
    if (error.message?.includes('retry')) return true;
    if (error.message?.includes('temporary')) return true;
    if (error.message?.includes('permanent')) return false;
    
    return false;
  }

  private determineRecoveryAction(
    error: Error, 
    category: ErrorCategory, 
    recoverable: boolean
  ): ErrorRecoveryAction {
    if (!recoverable) return 'abort';
    
    switch (category) {
      case 'network':
      case 'timeout':
        return 'retry';
      case 'rate-limit':
        return 'retry';
      case 'validation':
        return 'skip';
      case 'fhir-server':
        return 'fallback';
      default:
        return 'retry';
    }
  }

  private calculateRetryDelay(error: BaseError): number {
    // Base delay in milliseconds
    let delay = 1000;
    
    // Increase delay based on severity
    switch (error.severity) {
      case 'critical': delay *= 10; break;
      case 'high': delay *= 5; break;
      case 'medium': delay *= 2; break;
      case 'low': delay *= 1; break;
    }
    
    // Increase delay based on category
    switch (error.category) {
      case 'rate-limit': delay *= 5; break;
      case 'timeout': delay *= 3; break;
      case 'network': delay *= 2; break;
    }
    
    return Math.min(delay, 30000); // Max 30 seconds
  }

  private generateFallbackData(error: BaseError, context: ErrorHandlerContext): any {
    switch (error.category) {
      case 'fhir-server':
        return { connected: false, error: error.message };
      case 'validation':
        return { isValid: false, errors: [error.message] };
      case 'database':
        return { data: [], error: error.message };
      default:
        return { error: error.message };
    }
  }

  private generateUserMessage(error: BaseError): string {
    switch (error.category) {
      case 'fhir-server':
        return 'Unable to connect to FHIR server. Please check your connection and try again.';
      case 'validation':
        return 'Validation failed. Please check your data and try again.';
      case 'database':
        return 'Database operation failed. Please try again later.';
      case 'network':
        return 'Network error occurred. Please check your connection and try again.';
      case 'authentication':
        return 'Authentication failed. Please check your credentials.';
      case 'configuration':
        return 'Configuration error. Please contact support.';
      default:
        return 'An error occurred. Please try again later.';
    }
  }

  private determineLogLevel(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' | 'fatal' {
    switch (severity) {
      case 'critical': return 'fatal';
      case 'high': return 'error';
      case 'medium': return 'warn';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  private extractErrorCode(error: Error): string {
    if ('code' in error && typeof error.code === 'string') return error.code;
    if (error.name) return error.name.toLowerCase().replace(/\s+/g, '-');
    return 'unknown-error';
  }

  private extractErrorMessage(error: Error): string {
    return error.message || 'An unknown error occurred';
  }

  private extractErrorDetails(error: Error): string | undefined {
    if ('details' in error && typeof error.details === 'string') return error.details;
    if (error.stack) return error.stack;
    return undefined;
  }

  private extractFieldFromError(error: Error): string | undefined {
    if ('field' in error && typeof error.field === 'string') return error.field;
    return undefined;
  }

  private extractValueFromError(error: Error): any {
    if ('value' in error) return error.value;
    return undefined;
  }

  private extractExpectedTypeFromError(error: Error): string | undefined {
    if ('expectedType' in error && typeof error.expectedType === 'string') return error.expectedType;
    return undefined;
  }

  private extractValidationRuleFromError(error: Error): string | undefined {
    if ('validationRule' in error && typeof error.validationRule === 'string') return error.validationRule;
    return undefined;
  }

  private extractStatusCodeFromError(error: Error): number | undefined {
    if ('status' in error && typeof error.status === 'number') return error.status;
    if ('statusCode' in error && typeof error.statusCode === 'number') return error.statusCode;
    return undefined;
  }

  private extractResponseTimeFromError(error: Error): number | undefined {
    if ('responseTime' in error && typeof error.responseTime === 'number') return error.responseTime;
    return undefined;
  }

  private extractRetryCountFromError(error: Error): number | undefined {
    if ('retryCount' in error && typeof error.retryCount === 'number') return error.retryCount;
    return undefined;
  }

  private extractMaxRetriesFromError(error: Error): number | undefined {
    if ('maxRetries' in error && typeof error.maxRetries === 'number') return error.maxRetries;
    return undefined;
  }

  private extractConstraintFromError(error: Error): string | undefined {
    if ('constraint' in error && typeof error.constraint === 'string') return error.constraint;
    return undefined;
  }

  private extractConnectionIdFromError(error: Error): string | undefined {
    if ('connectionId' in error && typeof error.connectionId === 'string') return error.connectionId;
    return undefined;
  }

  private extractUsernameFromError(error: Error): string | undefined {
    if ('username' in error && typeof error.username === 'string') return error.username;
    return undefined;
  }

  private isTokenExpiredError(error: Error): boolean {
    return error.message?.includes('token') && error.message?.includes('expired') || false;
  }

  private isInvalidCredentialsError(error: Error): boolean {
    return error.message?.includes('invalid') && error.message?.includes('credential') || false;
  }

  private getDiskUsage(): number {
    // This would need to be implemented based on the platform
    return 0;
  }

  private groupByCategory(errors: BaseError[]): Record<ErrorCategory, number> {
    return errors.reduce((groups, error) => {
      groups[error.category] = (groups[error.category] || 0) + 1;
      return groups;
    }, {} as Record<ErrorCategory, number>);
  }

  private groupBySeverity(errors: BaseError[]): Record<ErrorSeverity, number> {
    return errors.reduce((groups, error) => {
      groups[error.severity] = (groups[error.severity] || 0) + 1;
      return groups;
    }, {} as Record<ErrorSeverity, number>);
  }

  private initializeMetrics(): void {
    this.errorMetrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByService: {},
      errorRate: 0,
      recoveryRate: 0,
      averageRecoveryTime: 0,
      criticalErrorCount: 0,
      lastErrorTime: undefined,
      errorTrend: 'stable'
    };
  }

  private isBaseError(obj: any): obj is BaseError {
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
}

// Export singleton instance
export const enhancedErrorHandler = EnhancedErrorHandler.getInstance();

