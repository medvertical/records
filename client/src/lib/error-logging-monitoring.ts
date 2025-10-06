import { toast } from '@/hooks/use-toast';

/**
 * Error logging and monitoring system
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'network' | 'service' | 'validation' | 'configuration' | 'permission' | 'data' | 'system' | 'ui' | 'performance';
  message: string;
  details?: any;
  context: {
    component?: string;
    operation?: string;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    url?: string;
    stack?: string;
    additionalInfo?: Record<string, any>;
  };
  metadata: {
    severity: number; // 1-10 scale
    retryable: boolean;
    userVisible: boolean;
    tags: string[];
    correlationId?: string;
  };
}

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  operation: string;
  duration: number; // milliseconds
  success: boolean;
  context: {
    component?: string;
    operation?: string;
    userId?: string;
    sessionId?: string;
    additionalInfo?: Record<string, any>;
  };
  metadata: {
    category: 'api' | 'ui' | 'validation' | 'database' | 'network';
    tags: string[];
  };
}

export interface MonitoringConfig {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  enablePerformanceMonitoring: boolean;
  enableErrorAnalytics: boolean;
  enableRealTimeAlerts: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  maxLogEntries: number;
  logRetentionDays: number;
  performanceThresholds: {
    apiResponseTime: number; // milliseconds
    uiRenderTime: number; // milliseconds
    validationTime: number; // milliseconds
  };
  alertThresholds: {
    errorRate: number; // percentage
    responseTime: number; // milliseconds
    consecutiveFailures: number;
  };
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsByLevel: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorTrends: Array<{
    timestamp: Date;
    count: number;
    category: string;
  }>;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: Date;
  }>;
  performanceMetrics: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface Alert {
  id: string;
  timestamp: Date;
  type: 'error' | 'performance' | 'availability' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  context: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * Error Logger
 */
export class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private config: MonitoringConfig;
  private sessionId: string;
  private userId?: string;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.loadStoredLogs();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load stored logs from localStorage
   */
  private loadStoredLogs(): void {
    try {
      const stored = localStorage.getItem('error-logs');
      if (stored) {
        const parsedLogs = JSON.parse(stored);
        this.logs = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
      }
    } catch (error) {
      console.warn('[ErrorLogger] Failed to load stored logs:', error);
    }
  }

  /**
   * Save logs to localStorage
   */
  private saveLogs(): void {
    try {
      const logsToSave = this.logs.slice(-this.config.maxLogEntries);
      localStorage.setItem('error-logs', JSON.stringify(logsToSave));
    } catch (error) {
      console.warn('[ErrorLogger] Failed to save logs:', error);
    }
  }

  /**
   * Log an error entry
   */
  log(
    level: ErrorLogEntry['level'],
    category: ErrorLogEntry['category'],
    message: string,
    details?: any,
    context: Partial<ErrorLogEntry['context']> = {}
  ): ErrorLogEntry {
    const logEntry: ErrorLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      category,
      message,
      details,
      context: {
        sessionId: this.sessionId,
        userId: this.userId,
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...context,
      },
      metadata: {
        severity: this.getSeverityLevel(level),
        retryable: this.isRetryable(category, details),
        userVisible: this.shouldShowToUser(level, category),
        tags: this.generateTags(category, context),
        correlationId: this.generateCorrelationId(),
      },
    };

    this.logs.push(logEntry);

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }

    // Remote logging
    if (this.config.enableRemoteLogging) {
      this.logToRemote(logEntry);
    }

    // Save to localStorage
    this.saveLogs();

    // Check for alerts
    if (this.config.enableRealTimeAlerts) {
      this.checkForAlerts(logEntry);
    }

    return logEntry;
  }

  /**
   * Get severity level (1-10)
   */
  private getSeverityLevel(level: ErrorLogEntry['level']): number {
    switch (level) {
      case 'debug': return 1;
      case 'info': return 3;
      case 'warn': return 5;
      case 'error': return 7;
      case 'critical': return 10;
      default: return 5;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(category: ErrorLogEntry['category'], details?: any): boolean {
    switch (category) {
      case 'network':
        return true;
      case 'service':
        return details?.statusCode >= 500;
      case 'validation':
        return false;
      case 'configuration':
        return false;
      case 'permission':
        return false;
      case 'data':
        return false;
      case 'system':
        return details?.statusCode >= 500;
      default:
        return false;
    }
  }

  /**
   * Check if error should be shown to user
   */
  private shouldShowToUser(level: ErrorLogEntry['level'], category: ErrorLogEntry['category']): boolean {
    if (level === 'critical' || level === 'error') {
      return true;
    }
    if (level === 'warn' && ['network', 'service', 'validation'].includes(category)) {
      return true;
    }
    return false;
  }

  /**
   * Generate tags for the log entry
   */
  private generateTags(category: ErrorLogEntry['category'], context: Partial<ErrorLogEntry['context']>): string[] {
    const tags = [category];
    if (context.component) tags.push(`component:${context.component}`);
    if (context.operation) tags.push(`operation:${context.operation}`);
    return tags;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log to console
   */
  private logToConsole(logEntry: ErrorLogEntry): void {
    const logMethod = this.getConsoleMethod(logEntry.level);
    const message = `[${logEntry.category.toUpperCase()}] ${logEntry.message}`;
    
    if (logEntry.details) {
      logMethod(message, logEntry.details, logEntry.context);
    } else {
      logMethod(message, logEntry.context);
    }
  }

  /**
   * Get console method for log level
   */
  private getConsoleMethod(level: ErrorLogEntry['level']): (...args: any[]) => void {
    switch (level) {
      case 'debug': return console.debug;
      case 'info': return console.info;
      case 'warn': return console.warn;
      case 'error': return console.error;
      case 'critical': return console.error;
      default: return console.log;
    }
  }

  /**
   * Log to remote service
   */
  private async logToRemote(logEntry: ErrorLogEntry): Promise<void> {
    try {
      await fetch('/api/logs/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.warn('[ErrorLogger] Failed to send log to remote service:', error);
    }
  }

  /**
   * Check for alerts
   */
  private checkForAlerts(logEntry: ErrorLogEntry): void {
    // Check error rate
    const recentErrors = this.getRecentErrors(5 * 60 * 1000); // Last 5 minutes
    const errorRate = (recentErrors.length / this.logs.length) * 100;
    
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        title: 'High Error Rate Detected',
        message: `Error rate is ${errorRate.toFixed(2)}%, exceeding threshold of ${this.config.alertThresholds.errorRate}%`,
        context: { errorRate, threshold: this.config.alertThresholds.errorRate },
      });
    }

    // Check consecutive failures
    const consecutiveFailures = this.getConsecutiveFailures();
    if (consecutiveFailures >= this.config.alertThresholds.consecutiveFailures) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        title: 'Consecutive Failures Detected',
        message: `${consecutiveFailures} consecutive failures detected`,
        context: { consecutiveFailures, threshold: this.config.alertThresholds.consecutiveFailures },
      });
    }
  }

  /**
   * Get recent errors
   */
  private getRecentErrors(timeWindow: number): ErrorLogEntry[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.logs.filter(log => 
      log.timestamp >= cutoff && 
      (log.level === 'error' || log.level === 'critical')
    );
  }

  /**
   * Get consecutive failures
   */
  private getConsecutiveFailures(): number {
    let count = 0;
    for (let i = this.logs.length - 1; i >= 0; i--) {
      if (this.logs[i].level === 'error' || this.logs[i].level === 'critical') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Create an alert
   */
  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'acknowledged'>): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      acknowledged: false,
      ...alertData,
    };

    // Store alert
    this.storeAlert(alert);

    // Show alert to user if critical
    if (alert.severity === 'critical') {
      toast({
        title: alert.title,
        description: alert.message,
        variant: 'destructive',
      });
    }
  }

  /**
   * Store alert
   */
  private storeAlert(alert: Alert): void {
    try {
      const stored = localStorage.getItem('error-alerts');
      const alerts = stored ? JSON.parse(stored) : [];
      alerts.push(alert);
      localStorage.setItem('error-alerts', JSON.stringify(alerts.slice(-50))); // Keep last 50 alerts
    } catch (error) {
      console.warn('[ErrorLogger] Failed to store alert:', error);
    }
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Get all logs
   */
  getAllLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(timeWindow: number = 24 * 60 * 60 * 1000): ErrorLogEntry[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.logs.filter(log => log.timestamp >= cutoff);
  }

  /**
   * Clear old logs
   */
  clearOldLogs(): void {
    const cutoff = new Date(Date.now() - (this.config.logRetentionDays * 24 * 60 * 60 * 1000));
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
    this.saveLogs();
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): void {
    this.logs = [];
    this.saveLogs();
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.loadStoredMetrics();
  }

  /**
   * Load stored metrics from localStorage
   */
  private loadStoredMetrics(): void {
    try {
      const stored = localStorage.getItem('performance-metrics');
      if (stored) {
        const parsedMetrics = JSON.parse(stored);
        this.metrics = parsedMetrics.map((metric: any) => ({
          ...metric,
          timestamp: new Date(metric.timestamp),
        }));
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to load stored metrics:', error);
    }
  }

  /**
   * Save metrics to localStorage
   */
  private saveMetrics(): void {
    try {
      const metricsToSave = this.metrics.slice(-1000); // Keep last 1000 metrics
      localStorage.setItem('performance-metrics', JSON.stringify(metricsToSave));
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to save metrics:', error);
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    operation: string,
    duration: number,
    success: boolean,
    context: Partial<PerformanceMetric['context']> = {},
    metadata: Partial<PerformanceMetric['metadata']> = {}
  ): PerformanceMetric {
    const metric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      operation,
      duration,
      success,
      context: {
        sessionId: this.getSessionId(),
        ...context,
      },
      metadata: {
        category: 'api',
        tags: [],
        ...metadata,
      },
    };

    this.metrics.push(metric);

    // Save to localStorage
    this.saveMetrics();

    // Check performance thresholds
    this.checkPerformanceThresholds(metric);

    return metric;
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check performance thresholds
   */
  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    const thresholds = this.config.performanceThresholds;
    
    if (metric.metadata.category === 'api' && metric.duration > thresholds.apiResponseTime) {
      this.createPerformanceAlert(metric, 'API Response Time', thresholds.apiResponseTime);
    }
    
    if (metric.metadata.category === 'ui' && metric.duration > thresholds.uiRenderTime) {
      this.createPerformanceAlert(metric, 'UI Render Time', thresholds.uiRenderTime);
    }
    
    if (metric.metadata.category === 'validation' && metric.duration > thresholds.validationTime) {
      this.createPerformanceAlert(metric, 'Validation Time', thresholds.validationTime);
    }
  }

  /**
   * Create performance alert
   */
  private createPerformanceAlert(metric: PerformanceMetric, type: string, threshold: number): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: 'performance',
      severity: 'medium',
      title: `${type} Threshold Exceeded`,
      message: `${metric.operation} took ${metric.duration}ms, exceeding threshold of ${threshold}ms`,
      context: { metric, threshold },
      resolved: false,
      acknowledged: false,
    };

    this.storeAlert(alert);
  }

  /**
   * Store alert
   */
  private storeAlert(alert: Alert): void {
    try {
      const stored = localStorage.getItem('performance-alerts');
      const alerts = stored ? JSON.parse(stored) : [];
      alerts.push(alert);
      localStorage.setItem('performance-alerts', JSON.stringify(alerts.slice(-50)));
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to store alert:', error);
    }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics by operation
   */
  getMetricsByOperation(operation: string): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.operation === operation);
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(timeWindow: number = 24 * 60 * 60 * 1000): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
    totalOperations: number;
  } {
    const recentMetrics = this.getRecentMetrics();
    
    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        successRate: 0,
        errorRate: 0,
        totalOperations: 0,
      };
    }

    const totalDuration = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const successfulOperations = recentMetrics.filter(metric => metric.success).length;
    const failedOperations = recentMetrics.length - successfulOperations;

    return {
      averageResponseTime: totalDuration / recentMetrics.length,
      successRate: (successfulOperations / recentMetrics.length) * 100,
      errorRate: (failedOperations / recentMetrics.length) * 100,
      totalOperations: recentMetrics.length,
    };
  }
}

/**
 * Error Analytics
 */
export class ErrorAnalytics {
  private logger: ErrorLogger;
  private performanceMonitor: PerformanceMonitor;

  constructor(logger: ErrorLogger, performanceMonitor: PerformanceMonitor) {
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Get comprehensive error analytics
   */
  getAnalytics(): ErrorAnalytics {
    const logs = this.logger.getAllLogs();
    const metrics = this.performanceMonitor.getAllMetrics();

    return {
      totalErrors: logs.filter(log => log.level === 'error' || log.level === 'critical').length,
      errorsByCategory: this.getErrorsByCategory(logs),
      errorsByLevel: this.getErrorsByLevel(logs),
      errorsByComponent: this.getErrorsByComponent(logs),
      errorTrends: this.getErrorTrends(logs),
      topErrors: this.getTopErrors(logs),
      performanceMetrics: this.performanceMonitor.getPerformanceStats(),
    };
  }

  /**
   * Get errors by category
   */
  private getErrorsByCategory(logs: ErrorLogEntry[]): Record<string, number> {
    const categoryCounts: Record<string, number> = {};
    logs.forEach(log => {
      categoryCounts[log.category] = (categoryCounts[log.category] || 0) + 1;
    });
    return categoryCounts;
  }

  /**
   * Get errors by level
   */
  private getErrorsByLevel(logs: ErrorLogEntry[]): Record<string, number> {
    const levelCounts: Record<string, number> = {};
    logs.forEach(log => {
      levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
    });
    return levelCounts;
  }

  /**
   * Get errors by component
   */
  private getErrorsByComponent(logs: ErrorLogEntry[]): Record<string, number> {
    const componentCounts: Record<string, number> = {};
    logs.forEach(log => {
      const component = log.context.component || 'unknown';
      componentCounts[component] = (componentCounts[component] || 0) + 1;
    });
    return componentCounts;
  }

  /**
   * Get error trends
   */
  private getErrorTrends(logs: ErrorLogEntry[]): Array<{ timestamp: Date; count: number; category: string }> {
    const trends: Array<{ timestamp: Date; count: number; category: string }> = [];
    const now = new Date();
    
    // Group by hour for last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourEnd = new Date(now.getTime() - ((i - 1) * 60 * 60 * 1000));
      
      const hourLogs = logs.filter(log => 
        log.timestamp >= hourStart && log.timestamp < hourEnd
      );
      
      trends.push({
        timestamp: hourStart,
        count: hourLogs.length,
        category: 'all',
      });
    }
    
    return trends;
  }

  /**
   * Get top errors
   */
  private getTopErrors(logs: ErrorLogEntry[]): Array<{ message: string; count: number; lastOccurrence: Date }> {
    const errorCounts: Record<string, { count: number; lastOccurrence: Date }> = {};
    
    logs.forEach(log => {
      if (log.level === 'error' || log.level === 'critical') {
        if (errorCounts[log.message]) {
          errorCounts[log.message].count++;
          if (log.timestamp > errorCounts[log.message].lastOccurrence) {
            errorCounts[log.message].lastOccurrence = log.timestamp;
          }
        } else {
          errorCounts[log.message] = {
            count: 1,
            lastOccurrence: log.timestamp,
          };
        }
      }
    });
    
    return Object.entries(errorCounts)
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

/**
 * Default monitoring configuration
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableConsoleLogging: true,
  enableRemoteLogging: true,
  enablePerformanceMonitoring: true,
  enableErrorAnalytics: true,
  enableRealTimeAlerts: true,
  logLevel: 'info',
  maxLogEntries: 1000,
  logRetentionDays: 7,
  performanceThresholds: {
    apiResponseTime: 5000, // 5 seconds
    uiRenderTime: 1000, // 1 second
    validationTime: 10000, // 10 seconds
  },
  alertThresholds: {
    errorRate: 10, // 10%
    responseTime: 10000, // 10 seconds
    consecutiveFailures: 5,
  },
};

/**
 * Global error logging and monitoring system
 */
export const errorLogger = new ErrorLogger(DEFAULT_MONITORING_CONFIG);
export const performanceMonitor = new PerformanceMonitor(DEFAULT_MONITORING_CONFIG);
export const errorAnalytics = new ErrorAnalytics(errorLogger, performanceMonitor);

/**
 * Hook for using error logging and monitoring in React components
 */
export function useErrorLogging(config?: Partial<MonitoringConfig>) {
  const logger = config ? new ErrorLogger({ ...DEFAULT_MONITORING_CONFIG, ...config }) : errorLogger;
  const monitor = config ? new PerformanceMonitor({ ...DEFAULT_MONITORING_CONFIG, ...config }) : performanceMonitor;
  const analytics = config ? new ErrorAnalytics(logger, monitor) : errorAnalytics;

  const logError = (
    category: ErrorLogEntry['category'],
    message: string,
    details?: any,
    context?: Partial<ErrorLogEntry['context']>
  ) => {
    return logger.log('error', category, message, details, context);
  };

  const logWarning = (
    category: ErrorLogEntry['category'],
    message: string,
    details?: any,
    context?: Partial<ErrorLogEntry['context']>
  ) => {
    return logger.log('warn', category, message, details, context);
  };

  const logInfo = (
    category: ErrorLogEntry['category'],
    message: string,
    details?: any,
    context?: Partial<ErrorLogEntry['context']>
  ) => {
    return logger.log('info', category, message, details, context);
  };

  const recordPerformance = (
    operation: string,
    duration: number,
    success: boolean,
    context?: Partial<PerformanceMetric['context']>,
    metadata?: Partial<PerformanceMetric['metadata']>
  ) => {
    return monitor.recordMetric(operation, duration, success, context, metadata);
  };

  const getAnalytics = () => analytics.getAnalytics();

  return {
    logError,
    logWarning,
    logInfo,
    recordPerformance,
    getAnalytics,
    logger,
    monitor,
    analytics,
  };
}

/**
 * Utility functions for error logging and monitoring
 */
export const LoggingUtils = {
  /**
   * Log network error
   */
  logNetworkError: (message: string, details?: any, context?: Partial<ErrorLogEntry['context']>) => {
    return errorLogger.log('error', 'network', message, details, context);
  },

  /**
   * Log service error
   */
  logServiceError: (message: string, details?: any, context?: Partial<ErrorLogEntry['context']>) => {
    return errorLogger.log('error', 'service', message, details, context);
  },

  /**
   * Log validation error
   */
  logValidationError: (message: string, details?: any, context?: Partial<ErrorLogEntry['context']>) => {
    return errorLogger.log('error', 'validation', message, details, context);
  },

  /**
   * Log performance metric
   */
  logPerformanceMetric: (operation: string, duration: number, success: boolean) => {
    return performanceMonitor.recordMetric(operation, duration, success);
  },

  /**
   * Get error analytics
   */
  getErrorAnalytics: () => errorAnalytics.getAnalytics(),

  /**
   * Clear old logs
   */
  clearOldLogs: () => {
    errorLogger.clearOldLogs();
  },
};
