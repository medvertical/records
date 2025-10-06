import { Request, Response, NextFunction } from 'express';
import { getValidationPerformanceMonitor } from '../services/performance/validation-performance-monitor';

export interface PerformanceMonitoringOptions {
  enabled: boolean;
  trackApiCalls: boolean;
  trackValidationOperations: boolean;
  trackDatabaseOperations: boolean;
  slowOperationThreshold: number; // milliseconds
  excludePaths: string[];
}

const defaultOptions: PerformanceMonitoringOptions = {
  enabled: true,
  trackApiCalls: true,
  trackValidationOperations: true,
  trackDatabaseOperations: true,
  slowOperationThreshold: 1000,
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
};

export function performanceMonitoringMiddleware(options: Partial<PerformanceMonitoringOptions> = {}) {
  const config = { ...defaultOptions, ...options };
  const monitor = getValidationPerformanceMonitor();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) {
      return next();
    }

    // Skip excluded paths
    if (config.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const operation = `api-${req.method}-${req.route?.path || req.path}`;

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;

      if (config.trackApiCalls) {
        monitor.recordMetric(operation, duration, success, undefined, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      }

      // Log slow operations
      if (duration > config.slowOperationThreshold) {
        console.warn(`[PerformanceMonitoring] Slow API call: ${operation} took ${duration}ms`);
      }

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

export function trackValidationOperation(operation: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const monitor = getValidationPerformanceMonitor();

    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;

      try {
        const result = await method.apply(this, args);
        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const duration = Date.now() - startTime;
        monitor.recordMetric(`validation-${operation}`, duration, success, error, {
          operation,
          timestamp: new Date().toISOString(),
        });
      }
    };

    return descriptor;
  };
}

export function trackDatabaseOperation(operation: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const monitor = getValidationPerformanceMonitor();

    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;

      try {
        const result = await method.apply(this, args);
        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const duration = Date.now() - startTime;
        monitor.recordMetric(`database-${operation}`, duration, success, error, {
          operation,
          timestamp: new Date().toISOString(),
        });
      }
    };

    return descriptor;
  };
}

