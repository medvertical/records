/**
 * Winston Logger Configuration
 * Provides structured logging for the application
 */

import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  // Add stack trace if present (for errors)
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create Winston logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    errors({ stack: true }), // Log stack traces for errors
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json() // Use JSON format for file logs
  ),
  defaultMeta: { service: 'records-fhir-platform' },
  transports: [
    // Error log - only errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined log - all levels
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      consoleFormat
    ),
  }));
}

// Convenience methods for common logging patterns
export const log = {
  /**
   * Log info message
   */
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },
  
  /**
   * Log warning message
   */
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },
  
  /**
   * Log error message
   */
  error: (message: string, error?: Error | any, meta?: any) => {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else if (error) {
      logger.error(message, { error, ...meta });
    } else {
      logger.error(message, meta);
    }
  },
  
  /**
   * Log debug message (only in development)
   */
  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
  
  /**
   * Log HTTP request
   */
  http: (method: string, url: string, status?: number, duration?: number) => {
    logger.http('HTTP Request', {
      method,
      url,
      status,
      duration,
    });
  },
  
  /**
   * Log database query
   */
  db: (query: string, duration?: number) => {
    logger.debug('Database Query', {
      query: query.substring(0, 200), // Truncate long queries
      duration,
    });
  },
  
  /**
   * Log validation event
   */
  validation: (event: string, details: any) => {
    logger.info(`[Validation] ${event}`, details);
  },
  
  /**
   * Log audit event
   */
  audit: (event: string, details: any) => {
    logger.info(`[Audit] ${event}`, { ...details, audit: true });
  },
};

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add custom database logging method used in query-optimizer
// database(level, message, operation, metadata)
// Level: 0=error, 1=warn, 2=info, 3=debug
(logger as any).database = (level: number, message: string, operation?: string, metadata?: any) => {
  const logLevel = level === 0 ? 'error' : level === 1 ? 'warn' : level === 2 ? 'info' : 'debug';
  const opStr = operation ? ` [${operation}]` : '';
  logger.log(logLevel, `[Database${opStr}] ${message}`, metadata);
};

export default logger;
