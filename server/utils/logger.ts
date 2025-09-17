// ============================================================================
// Standardized Logging System
// ============================================================================

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogContext {
  service: string;
  operation?: string;
  resourceId?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: any;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isProduction: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set the log level for the application
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get the current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Log an error message
   */
  error(message: string, context: LogContext, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: LogContext, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log an info message
   */
  info(message: string, context: LogContext, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log a trace message
   */
  trace(message: string, context: LogContext, data?: any): void {
    this.log(LogLevel.TRACE, message, context, data);
  }

  /**
   * Log FHIR client operations
   */
  fhir(level: LogLevel, message: string, operation: string, data?: any): void {
    this.log(level, message, {
      service: 'fhir-client',
      operation
    }, data);
  }

  /**
   * Log validation operations
   */
  validation(level: LogLevel, message: string, operation: string, resourceType?: string, data?: any): void {
    this.log(level, message, {
      service: 'validation-engine',
      operation,
      metadata: { resourceType }
    }, data);
  }

  /**
   * Log bulk validation operations
   */
  bulkValidation(level: LogLevel, message: string, operation: string, data?: any): void {
    this.log(level, message, {
      service: 'bulk-validation',
      operation
    }, data);
  }

  /**
   * Log SSE operations
   */
  sse(level: LogLevel, message: string, operation: string, data?: any): void {
    this.log(level, message, {
      service: 'sse',
      operation
    }, data);
  }

  /**
   * Log database operations
   */
  database(level: LogLevel, message: string, operation: string, data?: any): void {
    this.log(level, message, {
      service: 'database',
      operation
    }, data);
  }

  /**
   * Log server operations
   */
  server(level: LogLevel, message: string, operation: string, data?: any): void {
    this.log(level, message, {
      service: 'server',
      operation
    }, data);
  }

  /**
   * Get recent log entries for debugging
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear the log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    total: number;
    byLevel: Record<string, number>;
    byService: Record<string, number>;
    recentErrors: LogEntry[];
  } {
    const byLevel = this.logBuffer.reduce((acc, entry) => {
      const level = LogLevel[entry.level];
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byService = this.logBuffer.reduce((acc, entry) => {
      const service = entry.context.service;
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentErrors = this.logBuffer
      .filter(entry => entry.level === LogLevel.ERROR)
      .slice(-10);

    return {
      total: this.logBuffer.length,
      byLevel,
      byService,
      recentErrors
    };
  }

  private log(level: LogLevel, message: string, context: LogContext, data?: any, error?: Error): void {
    // Skip logging if level is below threshold
    if (level > this.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      data,
      error
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Format and output the log
    this.outputLog(logEntry);
  }

  private outputLog(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const service = entry.context.service.padEnd(15);
    const operation = entry.context.operation ? `[${entry.context.operation}]` : '';
    
    let logMessage = `${timestamp} ${level} [${service}] ${operation} ${entry.message}`;

    // Add context information
    if (entry.context.resourceId) {
      logMessage += ` (resource: ${entry.context.resourceId})`;
    }
    if (entry.context.requestId) {
      logMessage += ` (request: ${entry.context.requestId})`;
    }

    // Add data if present and not in production
    if (entry.data && !this.isProduction) {
      logMessage += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    // Add error if present
    if (entry.error) {
      logMessage += `\n  Error: ${entry.error.message}`;
      if (!this.isProduction && entry.error.stack) {
        logMessage += `\n  Stack: ${entry.error.stack}`;
      }
    }

    // Output to console with appropriate level
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.TRACE:
        console.trace(logMessage);
        break;
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logError = (message: string, context: LogContext, data?: any, error?: Error) => 
  logger.error(message, context, data, error);

export const logWarn = (message: string, context: LogContext, data?: any) => 
  logger.warn(message, context, data);

export const logInfo = (message: string, context: LogContext, data?: any) => 
  logger.info(message, context, data);

export const logDebug = (message: string, context: LogContext, data?: any) => 
  logger.debug(message, context, data);

export const logTrace = (message: string, context: LogContext, data?: any) => 
  logger.trace(message, context, data);

