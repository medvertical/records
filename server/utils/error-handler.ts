// ============================================================================
// Standardized Error Handling Utility
// ============================================================================

export interface ErrorContext {
  service: string;
  operation: string;
  resourceId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface StandardizedError {
  code: string;
  message: string;
  details?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestions: string[];
  timestamp: Date;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: StandardizedError[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and standardize errors across all services
   */
  handleError(
    error: any,
    context: Omit<ErrorContext, 'timestamp'>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): StandardizedError {
    const standardizedError: StandardizedError = {
      code: this.extractErrorCode(error),
      message: this.extractErrorMessage(error),
      details: this.extractErrorDetails(error),
      context: {
        ...context,
        timestamp: new Date()
      },
      severity,
      recoverable: this.isRecoverable(error),
      suggestions: this.generateSuggestions(error, context),
      timestamp: new Date()
    };

    // Log the error
    this.logError(standardizedError);

    return standardizedError;
  }

  /**
   * Handle FHIR-specific errors
   */
  handleFhirError(
    error: any,
    context: Omit<ErrorContext, 'timestamp'>,
    fhirOperation?: string
  ): StandardizedError {
    const fhirContext = {
      ...context,
      operation: fhirOperation ? `${context.operation} (${fhirOperation})` : context.operation
    };

    return this.handleError(error, fhirContext, this.getFhirErrorSeverity(error));
  }

  /**
   * Handle validation-specific errors
   */
  handleValidationError(
    error: any,
    context: Omit<ErrorContext, 'timestamp'>,
    resourceType?: string
  ): StandardizedError {
    const validationContext = {
      ...context,
      operation: resourceType ? `${context.operation} (${resourceType})` : context.operation
    };

    return this.handleError(error, validationContext, this.getValidationErrorSeverity(error));
  }

  /**
   * Handle database-specific errors
   */
  handleDatabaseError(
    error: any,
    context: Omit<ErrorContext, 'timestamp'>,
    operation?: string
  ): StandardizedError {
    const dbContext = {
      ...context,
      operation: operation ? `${context.operation} (${operation})` : context.operation
    };

    return this.handleError(error, dbContext, this.getDatabaseErrorSeverity(error));
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(timeframe: 'hour' | 'day' | 'week' = 'day'): {
    total: number;
    bySeverity: Record<string, number>;
    byService: Record<string, number>;
    byCode: Record<string, number>;
  } {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.getTimeframeMs(timeframe));

    const recentErrors = this.errorLog.filter(error => error.timestamp >= cutoff);

    return {
      total: recentErrors.length,
      bySeverity: this.groupBy(recentErrors, 'severity'),
      byService: this.groupBy(recentErrors, 'context.service'),
      byCode: this.groupBy(recentErrors, 'code')
    };
  }

  /**
   * Clear old error logs
   */
  clearOldLogs(olderThanDays: number = 7): void {
    const cutoff = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    this.errorLog = this.errorLog.filter(error => error.timestamp >= cutoff);
  }

  private extractErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.name) return error.name.toLowerCase().replace(/\s+/g, '-');
    if (error.status) return `http-${error.status}`;
    return 'unknown-error';
  }

  private extractErrorMessage(error: any): string {
    if (error.message) return error.message;
    if (error.error) return error.error;
    if (typeof error === 'string') return error;
    return 'An unknown error occurred';
  }

  private extractErrorDetails(error: any): string | undefined {
    if (error.details) return error.details;
    if (error.stack) return error.stack;
    if (error.response?.data) return JSON.stringify(error.response.data);
    return undefined;
  }

  private isRecoverable(error: any): boolean {
    // Network errors are usually recoverable
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    
    // HTTP 5xx errors are usually recoverable
    if (error.status >= 500) return true;
    
    // HTTP 4xx errors are usually not recoverable
    if (error.status >= 400 && error.status < 500) return false;
    
    // Database connection errors are recoverable
    if (error.code === 'ECONNREFUSED' && error.message?.includes('database')) return true;
    
    return false;
  }

  private generateSuggestions(error: any, context: ErrorContext): string[] {
    const suggestions: string[] = [];

    // Network-related suggestions
    if (error.code === 'ENOTFOUND') {
      suggestions.push('Check if the server URL is correct and accessible');
      suggestions.push('Verify network connectivity');
    }

    if (error.code === 'ECONNREFUSED') {
      suggestions.push('Check if the target service is running');
      suggestions.push('Verify the port and host configuration');
    }

    if (error.code === 'ETIMEDOUT') {
      suggestions.push('Check network latency and server performance');
      suggestions.push('Consider increasing timeout values');
    }

    // HTTP-related suggestions
    if (error.status === 401) {
      suggestions.push('Check authentication credentials');
      suggestions.push('Verify token expiration');
    }

    if (error.status === 403) {
      suggestions.push('Check user permissions');
      suggestions.push('Verify access rights');
    }

    if (error.status === 404) {
      suggestions.push('Verify the resource exists');
      suggestions.push('Check the resource ID or URL');
    }

    if (error.status >= 500) {
      suggestions.push('Retry the operation after a short delay');
      suggestions.push('Check server logs for more details');
    }

    // Database-related suggestions
    if (error.message?.includes('database') || error.message?.includes('connection')) {
      suggestions.push('Check database connectivity');
      suggestions.push('Verify database credentials');
    }

    // Validation-related suggestions
    if (context.service === 'validation') {
      suggestions.push('Check the resource structure and format');
      suggestions.push('Verify required fields are present');
    }

    // FHIR-related suggestions
    if (context.service === 'fhir') {
      suggestions.push('Check FHIR server status');
      suggestions.push('Verify FHIR resource format');
    }

    return suggestions;
  }

  private getFhirErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.status >= 500) return 'high';
    if (error.status === 404) return 'medium';
    if (error.status === 401 || error.status === 403) return 'high';
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') return 'high';
    return 'medium';
  }

  private getValidationErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.message?.includes('fatal')) return 'critical';
    if (error.message?.includes('error')) return 'high';
    if (error.message?.includes('warning')) return 'medium';
    return 'low';
  }

  private getDatabaseErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.code === 'ECONNREFUSED') return 'critical';
    if (error.message?.includes('connection')) return 'high';
    if (error.message?.includes('timeout')) return 'medium';
    return 'medium';
  }

  private logError(error: StandardizedError): void {
    this.errorLog.push(error);
    
    // Log to console with appropriate level
    const logMessage = `[${error.context.service}] ${error.message} (${error.code})`;
    
    switch (error.severity) {
      case 'critical':
        console.error(logMessage, error);
        break;
      case 'high':
        console.error(logMessage, error);
        break;
      case 'medium':
        console.warn(logMessage, error);
        break;
      case 'low':
        console.info(logMessage, error);
        break;
    }
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = String(item[key]);
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private getTimeframeMs(timeframe: 'hour' | 'day' | 'week'): number {
    switch (timeframe) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

