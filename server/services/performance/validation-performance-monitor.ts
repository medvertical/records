import { EventEmitter } from 'events';
import { db } from '../../db';
import { validationProgressState } from '../../../shared/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

export interface PerformanceMetrics {
  timestamp: Date;
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ValidationPerformanceMetrics {
  totalValidations: number;
  averageValidationTime: number;
  successRate: number;
  errorRate: number;
  throughput: number; // validations per minute
  peakThroughput: number;
  averageResourceProcessingTime: number;
  totalResourcesProcessed: number;
  totalErrors: number;
  totalWarnings: number;
  performanceByAspect: Record<string, {
    count: number;
    averageTime: number;
    successRate: number;
    errorRate: number;
  }>;
  performanceByResourceType: Record<string, {
    count: number;
    averageTime: number;
    successRate: number;
    errorRate: number;
  }>;
  timeSeries: Array<{
    timestamp: Date;
    throughput: number;
    successRate: number;
    averageTime: number;
  }>;
}

export interface SystemPerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  activeConnections: number;
  cacheHitRate: number;
  databaseConnectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  apiResponseTimes: Record<string, {
    average: number;
    p95: number;
    p99: number;
    count: number;
  }>;
}

export class ValidationPerformanceMonitor extends EventEmitter {
  private static instance: ValidationPerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 10000;
  private collectionInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): ValidationPerformanceMonitor {
    if (!ValidationPerformanceMonitor.instance) {
      ValidationPerformanceMonitor.instance = new ValidationPerformanceMonitor();
    }
    return ValidationPerformanceMonitor.instance;
  }

  /**
   * Start collecting performance metrics
   */
  public startCollection(intervalMs: number = 30000): void {
    if (this.isCollecting) {
      console.log('[PerformanceMonitor] Already collecting metrics');
      return;
    }

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);

    console.log(`[PerformanceMonitor] Started collecting metrics every ${intervalMs}ms`);
  }

  /**
   * Stop collecting performance metrics
   */
  public stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    this.isCollecting = false;
    console.log('[PerformanceMonitor] Stopped collecting metrics');
  }

  /**
   * Record a performance metric
   */
  public recordMetric(operation: string, duration: number, success: boolean, error?: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetrics = {
      timestamp: new Date(),
      operation,
      duration,
      success,
      error,
      metadata,
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Emit event for real-time monitoring
    this.emit('metric', metric);

    // Log significant performance issues
    if (duration > 5000) { // 5 seconds
      console.warn(`[PerformanceMonitor] Slow operation detected: ${operation} took ${duration}ms`);
    }

    if (!success) {
      console.error(`[PerformanceMonitor] Failed operation: ${operation} - ${error}`);
    }
  }

  /**
   * Get validation performance metrics
   */
  public async getValidationPerformanceMetrics(timeRangeHours: number = 24): Promise<ValidationPerformanceMetrics> {
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    const validationMetrics = recentMetrics.filter(m => m.operation.startsWith('validation'));
    const totalValidations = validationMetrics.length;
    const successfulValidations = validationMetrics.filter(m => m.success).length;
    const failedValidations = totalValidations - successfulValidations;

    const averageValidationTime = totalValidations > 0 
      ? validationMetrics.reduce((sum, m) => sum + m.duration, 0) / totalValidations 
      : 0;

    const successRate = totalValidations > 0 ? (successfulValidations / totalValidations) * 100 : 0;
    const errorRate = totalValidations > 0 ? (failedValidations / totalValidations) * 100 : 0;

    // Calculate throughput (validations per minute)
    const timeSpanMinutes = timeRangeHours * 60;
    const throughput = timeSpanMinutes > 0 ? totalValidations / timeSpanMinutes : 0;

    // Calculate peak throughput (highest throughput in any 5-minute window)
    const peakThroughput = this.calculatePeakThroughput(validationMetrics, 5);

    // Calculate resource processing metrics
    const resourceMetrics = recentMetrics.filter(m => m.operation === 'process-resource');
    const averageResourceProcessingTime = resourceMetrics.length > 0
      ? resourceMetrics.reduce((sum, m) => sum + m.duration, 0) / resourceMetrics.length
      : 0;

    const totalResourcesProcessed = resourceMetrics.length;
    const totalErrors = recentMetrics.filter(m => m.operation === 'validation-error').length;
    const totalWarnings = recentMetrics.filter(m => m.operation === 'validation-warning').length;

    // Performance by aspect
    const performanceByAspect = this.calculatePerformanceByAspect(recentMetrics);

    // Performance by resource type
    const performanceByResourceType = this.calculatePerformanceByResourceType(recentMetrics);

    // Time series data (hourly buckets)
    const timeSeries = this.calculateTimeSeries(validationMetrics, timeRangeHours);

    return {
      totalValidations,
      averageValidationTime,
      successRate,
      errorRate,
      throughput,
      peakThroughput,
      averageResourceProcessingTime,
      totalResourcesProcessed,
      totalErrors,
      totalWarnings,
      performanceByAspect,
      performanceByResourceType,
      timeSeries,
    };
  }

  /**
   * Get system performance metrics
   */
  public async getSystemPerformanceMetrics(): Promise<SystemPerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;

    const cpuUsage = await this.getCpuUsage();
    const activeConnections = await this.getActiveConnections();
    const cacheHitRate = await this.getCacheHitRate();
    const databaseConnectionPool = await this.getDatabaseConnectionPool();
    const apiResponseTimes = this.calculateApiResponseTimes();

    return {
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      cpuUsage,
      activeConnections,
      cacheHitRate,
      databaseConnectionPool,
      apiResponseTimes,
    };
  }

  /**
   * Get performance metrics for a specific operation
   */
  public getOperationMetrics(operation: string, timeRangeHours: number = 24): PerformanceMetrics[] {
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    return this.metrics.filter(m => 
      m.operation === operation && m.timestamp >= cutoffTime
    );
  }

  /**
   * Get performance summary for all operations
   */
  public getPerformanceSummary(timeRangeHours: number = 24): Record<string, {
    count: number;
    averageTime: number;
    successRate: number;
    p95Time: number;
    p99Time: number;
  }> {
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    const operationGroups = recentMetrics.reduce((groups, metric) => {
      if (!groups[metric.operation]) {
        groups[metric.operation] = [];
      }
      groups[metric.operation].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    const summary: Record<string, any> = {};

    for (const [operation, metrics] of Object.entries(operationGroups)) {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const successful = metrics.filter(m => m.success).length;

      summary[operation] = {
        count: metrics.length,
        averageTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        successRate: (successful / metrics.length) * 100,
        p95Time: this.percentile(durations, 0.95),
        p99Time: this.percentile(durations, 0.99),
      };
    }

    return summary;
  }

  /**
   * Clear old metrics
   */
  public clearOldMetrics(olderThanHours: number = 168): void { // 7 days default
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    const removedCount = initialCount - this.metrics.length;
    
    if (removedCount > 0) {
      console.log(`[PerformanceMonitor] Cleared ${removedCount} old metrics`);
    }
  }

  /**
   * Export metrics for analysis
   */
  public exportMetrics(timeRangeHours: number = 24): PerformanceMetrics[] {
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoffTime);
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const systemMetrics = await this.getSystemPerformanceMetrics();
      this.emit('system-metrics', systemMetrics);
    } catch (error) {
      console.error('[PerformanceMonitor] Error collecting system metrics:', error);
    }
  }

  private calculatePeakThroughput(metrics: PerformanceMetrics[], windowMinutes: number): number {
    if (metrics.length === 0) return 0;

    const windowMs = windowMinutes * 60 * 1000;
    const sortedMetrics = metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let maxThroughput = 0;
    let windowStart = 0;

    for (let i = 0; i < sortedMetrics.length; i++) {
      const currentTime = sortedMetrics[i].timestamp.getTime();
      
      // Move window start to include current metric
      while (windowStart < i && 
             currentTime - sortedMetrics[windowStart].timestamp.getTime() > windowMs) {
        windowStart++;
      }

      const windowSize = i - windowStart + 1;
      const windowDurationMinutes = windowMs / (60 * 1000);
      const throughput = windowSize / windowDurationMinutes;
      
      maxThroughput = Math.max(maxThroughput, throughput);
    }

    return maxThroughput;
  }

  private calculatePerformanceByAspect(metrics: PerformanceMetrics[]): Record<string, any> {
    const aspectMetrics = metrics.filter(m => m.metadata?.aspect);
    const aspectGroups = aspectMetrics.reduce((groups, metric) => {
      const aspect = metric.metadata!.aspect;
      if (!groups[aspect]) {
        groups[aspect] = [];
      }
      groups[aspect].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    const performance: Record<string, any> = {};
    for (const [aspect, aspectMetrics] of Object.entries(aspectGroups)) {
      const successful = aspectMetrics.filter(m => m.success).length;
      performance[aspect] = {
        count: aspectMetrics.length,
        averageTime: aspectMetrics.reduce((sum, m) => sum + m.duration, 0) / aspectMetrics.length,
        successRate: (successful / aspectMetrics.length) * 100,
        errorRate: ((aspectMetrics.length - successful) / aspectMetrics.length) * 100,
      };
    }

    return performance;
  }

  private calculatePerformanceByResourceType(metrics: PerformanceMetrics[]): Record<string, any> {
    const resourceMetrics = metrics.filter(m => m.metadata?.resourceType);
    const resourceGroups = resourceMetrics.reduce((groups, metric) => {
      const resourceType = metric.metadata!.resourceType;
      if (!groups[resourceType]) {
        groups[resourceType] = [];
      }
      groups[resourceType].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    const performance: Record<string, any> = {};
    for (const [resourceType, resourceMetrics] of Object.entries(resourceGroups)) {
      const successful = resourceMetrics.filter(m => m.success).length;
      performance[resourceType] = {
        count: resourceMetrics.length,
        averageTime: resourceMetrics.reduce((sum, m) => sum + m.duration, 0) / resourceMetrics.length,
        successRate: (successful / resourceMetrics.length) * 100,
        errorRate: ((resourceMetrics.length - successful) / resourceMetrics.length) * 100,
      };
    }

    return performance;
  }

  private calculateTimeSeries(metrics: PerformanceMetrics[], timeRangeHours: number): Array<any> {
    const hourlyBuckets: Record<string, PerformanceMetrics[]> = {};
    const bucketSizeMs = 60 * 60 * 1000; // 1 hour

    for (const metric of metrics) {
      const bucketTime = new Date(Math.floor(metric.timestamp.getTime() / bucketSizeMs) * bucketSizeMs);
      const bucketKey = bucketTime.toISOString();
      
      if (!hourlyBuckets[bucketKey]) {
        hourlyBuckets[bucketKey] = [];
      }
      hourlyBuckets[bucketKey].push(metric);
    }

    const timeSeries = Object.entries(hourlyBuckets).map(([timestamp, bucketMetrics]) => {
      const successful = bucketMetrics.filter(m => m.success).length;
      const averageTime = bucketMetrics.reduce((sum, m) => sum + m.duration, 0) / bucketMetrics.length;
      const throughput = bucketMetrics.length; // per hour

      return {
        timestamp: new Date(timestamp),
        throughput,
        successRate: (successful / bucketMetrics.length) * 100,
        averageTime,
      };
    });

    return timeSeries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        const cpuUsage = (totalUsage / 1) * 100; // 1 second interval
        resolve(Math.min(cpuUsage, 100));
      }, 1000);
    });
  }

  private async getActiveConnections(): Promise<number> {
    // This would need to be implemented based on your connection tracking
    // For now, return a placeholder
    return 0;
  }

  private async getCacheHitRate(): Promise<number> {
    // This would need to be implemented based on your cache implementation
    // For now, return a placeholder
    return 0;
  }

  private async getDatabaseConnectionPool(): Promise<any> {
    // This would need to be implemented based on your database connection pool
    // For now, return a placeholder
    return {
      active: 0,
      idle: 0,
      total: 0,
    };
  }

  private calculateApiResponseTimes(): Record<string, any> {
    const apiMetrics = this.metrics.filter(m => m.operation.startsWith('api-'));
    const apiGroups = apiMetrics.reduce((groups, metric) => {
      if (!groups[metric.operation]) {
        groups[metric.operation] = [];
      }
      groups[metric.operation].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    const responseTimes: Record<string, any> = {};
    for (const [endpoint, endpointMetrics] of Object.entries(apiGroups)) {
      const durations = endpointMetrics.map(m => m.duration).sort((a, b) => a - b);
      responseTimes[endpoint] = {
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        p95: this.percentile(durations, 0.95),
        p99: this.percentile(durations, 0.99),
        count: durations.length,
      };
    }

    return responseTimes;
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Get all metrics
   */
  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
    console.log('[ValidationPerformanceMonitor] All metrics cleared');
  }

  /**
   * Get health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const totalOperations = metrics.length;
    
    if (totalOperations === 0) {
      return {
        status: 'healthy',
        score: 100,
        issues: [],
        recommendations: ['Start some validation operations to collect performance data']
      };
    }

    const successfulOperations = metrics.filter(m => m.success).length;
    const successRate = successfulOperations / totalOperations;
    
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalDuration / totalOperations;
    
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check success rate
    if (successRate < 0.7) {
      score -= 30;
      issues.push('Low success rate (< 70%)');
      recommendations.push('Review error logs and fix failing operations');
    } else if (successRate < 0.9) {
      score -= 15;
      issues.push('Moderate success rate (< 90%)');
      recommendations.push('Monitor error patterns and improve reliability');
    }
    
    // Check response time
    if (averageResponseTime > 5000) {
      score -= 30;
      issues.push('High average response time (> 5s)');
      recommendations.push('Optimize slow operations and consider caching');
    } else if (averageResponseTime > 2000) {
      score -= 15;
      issues.push('Moderate response time (> 2s)');
      recommendations.push('Review performance bottlenecks');
    }
    
    // Determine status
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 50) {
      status = 'warning';
    } else {
      status = 'critical';
    }
    
    return {
      status,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  /**
   * Get analytics
   */
  public getAnalytics(): {
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    slowestOperations: Array<{
      operation: string;
      averageDuration: number;
      count: number;
    }>;
    errorBreakdown: Array<{
      error: string;
      count: number;
      percentage: number;
    }>;
    performanceTrends: Array<{
      timestamp: string;
      averageResponseTime: number;
      successRate: number;
    }>;
  } {
    const metrics = this.getMetrics();
    const totalOperations = metrics.length;
    
    if (totalOperations === 0) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowestOperations: [],
        errorBreakdown: [],
        performanceTrends: []
      };
    }
    
    const successfulOperations = metrics.filter(m => m.success).length;
    const successRate = successfulOperations / totalOperations;
    
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalDuration / totalOperations;
    
    const errorRate = (totalOperations - successfulOperations) / totalOperations;

    // Get slowest operations
    const operationStats = new Map<string, { total: number; count: number }>();
    metrics.forEach(m => {
      const current = operationStats.get(m.operation) || { total: 0, count: 0 };
      operationStats.set(m.operation, {
        total: current.total + m.duration,
        count: current.count + 1
      });
    });

    const slowestOperations = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        averageDuration: stats.total / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    // Get error breakdown
    const errorCounts = new Map<string, number>();
    metrics.filter(m => !m.success && m.error).forEach(m => {
      const count = errorCounts.get(m.error!) || 0;
      errorCounts.set(m.error!, count + 1);
    });

    const errorBreakdown = Array.from(errorCounts.entries())
      .map(([error, count]) => ({
        error,
        count,
        percentage: count / totalOperations
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get performance trends (last 10 data points)
    const recentMetrics = metrics.slice(-100); // Last 100 metrics
    const trendSize = 10;
    const performanceTrends: Array<{
      timestamp: string;
      averageResponseTime: number;
      successRate: number;
    }> = [];

    for (let i = 0; i < Math.min(trendSize, recentMetrics.length); i++) {
      const startIdx = Math.floor((i * recentMetrics.length) / trendSize);
      const endIdx = Math.floor(((i + 1) * recentMetrics.length) / trendSize);
      const chunk = recentMetrics.slice(startIdx, endIdx);

      if (chunk.length > 0) {
        const chunkSuccessRate = chunk.filter(m => m.success).length / chunk.length;
        const chunkAvgTime = chunk.reduce((sum, m) => sum + m.duration, 0) / chunk.length;

        performanceTrends.push({
          timestamp: chunk[chunk.length - 1].timestamp.toISOString(),
          averageResponseTime: chunkAvgTime,
          successRate: chunkSuccessRate
        });
      }
    }

    return {
      totalOperations,
      successRate,
      averageResponseTime,
      errorRate,
      slowestOperations,
      errorBreakdown,
      performanceTrends
    };
  }
}

export function getValidationPerformanceMonitor(): ValidationPerformanceMonitor {
  return ValidationPerformanceMonitor.getInstance();
}
