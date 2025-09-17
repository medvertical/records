// ============================================================================
// Validation Performance Service
// ============================================================================

import { storage } from '../../storage';

export interface ValidationPerformanceMetrics {
  id: string;
  validationRunId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  totalResources: number;
  processedResources: number;
  throughput: number; // resources per second
  averageProcessingTime: number; // milliseconds per resource
  peakThroughput: number; // maximum resources per second
  efficiency: number; // percentage of time spent processing vs waiting
  resourceTypeMetrics: Record<string, {
    count: number;
    averageTime: number;
    throughput: number;
    errors: number;
  }>;
  systemMetrics: {
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
    networkLatency: number; // milliseconds
  };
  bottlenecks: string[];
  recommendations: string[];
}

export interface PerformanceBenchmark {
  id: string;
  name: string;
  description: string;
  baselineMetrics: ValidationPerformanceMetrics;
  currentMetrics: ValidationPerformanceMetrics;
  improvement: number; // percentage improvement
  status: 'improved' | 'degraded' | 'stable';
  timestamp: Date;
}

export interface PerformanceOptimization {
  id: string;
  type: 'batch_size' | 'parallel_processing' | 'caching' | 'network' | 'memory' | 'cpu';
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  recommendation: string;
  expectedImprovement: number; // percentage
}

export class ValidationPerformanceService {
  private static instance: ValidationPerformanceService;
  private activeMetrics: Map<string, ValidationPerformanceMetrics> = new Map();
  private performanceHistory: ValidationPerformanceMetrics[] = [];

  private constructor() {}

  static getInstance(): ValidationPerformanceService {
    if (!ValidationPerformanceService.instance) {
      ValidationPerformanceService.instance = new ValidationPerformanceService();
    }
    return ValidationPerformanceService.instance;
  }

  /**
   * Start performance tracking for a validation run
   */
  startTracking(validationRunId: string, totalResources: number): ValidationPerformanceMetrics {
    const metrics: ValidationPerformanceMetrics = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      validationRunId,
      startTime: new Date(),
      totalResources,
      processedResources: 0,
      throughput: 0,
      averageProcessingTime: 0,
      peakThroughput: 0,
      efficiency: 0,
      resourceTypeMetrics: {},
      systemMetrics: {
        memoryUsage: 0,
        cpuUsage: 0,
        networkLatency: 0
      },
      bottlenecks: [],
      recommendations: []
    };

    this.activeMetrics.set(validationRunId, metrics);
    return metrics;
  }

  /**
   * Update performance metrics during validation
   */
  updateMetrics(validationRunId: string, updates: {
    processedResources?: number;
    resourceType?: string;
    processingTime?: number;
    errors?: number;
  }): void {
    const metrics = this.activeMetrics.get(validationRunId);
    if (!metrics) return;

    // Update processed resources
    if (updates.processedResources !== undefined) {
      metrics.processedResources = updates.processedResources;
    }

    // Update resource type metrics
    if (updates.resourceType && updates.processingTime !== undefined) {
      const resourceType = updates.resourceType;
      if (!metrics.resourceTypeMetrics[resourceType]) {
        metrics.resourceTypeMetrics[resourceType] = {
          count: 0,
          averageTime: 0,
          throughput: 0,
          errors: 0
        };
      }

      const typeMetrics = metrics.resourceTypeMetrics[resourceType];
      typeMetrics.count++;
      typeMetrics.averageTime = (typeMetrics.averageTime * (typeMetrics.count - 1) + updates.processingTime) / typeMetrics.count;
      
      if (updates.errors) {
        typeMetrics.errors += updates.errors;
      }
    }

    // Calculate current throughput
    const elapsed = Date.now() - metrics.startTime.getTime();
    if (elapsed > 0) {
      metrics.throughput = (metrics.processedResources / elapsed) * 1000; // resources per second
      metrics.peakThroughput = Math.max(metrics.peakThroughput, metrics.throughput);
    }

    // Calculate average processing time
    if (metrics.processedResources > 0) {
      metrics.averageProcessingTime = elapsed / metrics.processedResources;
    }

    // Update system metrics
    this.updateSystemMetrics(metrics);

    // Identify bottlenecks
    this.identifyBottlenecks(metrics);

    // Generate recommendations
    this.generateRecommendations(metrics);
  }

  /**
   * Complete performance tracking
   */
  completeTracking(validationRunId: string): ValidationPerformanceMetrics | null {
    const metrics = this.activeMetrics.get(validationRunId);
    if (!metrics) return null;

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();

    // Final calculations
    if (metrics.duration > 0) {
      metrics.throughput = (metrics.processedResources / metrics.duration) * 1000;
      metrics.efficiency = this.calculateEfficiency(metrics);
    }

    // Store in history
    this.performanceHistory.push(metrics);
    
    // Persist to database
    this.persistMetrics(metrics);

    // Remove from active tracking
    this.activeMetrics.delete(validationRunId);

    return metrics;
  }

  /**
   * Get performance metrics for a validation run
   */
  getMetrics(validationRunId: string): ValidationPerformanceMetrics | null {
    return this.activeMetrics.get(validationRunId) || null;
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(limit: number = 10): ValidationPerformanceMetrics[] {
    return this.performanceHistory
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get performance benchmarks
   */
  async getPerformanceBenchmarks(): Promise<PerformanceBenchmark[]> {
    try {
      const history = this.getPerformanceHistory(20);
      if (history.length < 2) return [];

      const benchmarks: PerformanceBenchmark[] = [];
      const baseline = history[history.length - 1]; // Most recent as baseline

      for (let i = 0; i < history.length - 1; i++) {
        const current = history[i];
        const improvement = this.calculateImprovement(baseline, current);
        
        benchmarks.push({
          id: `benchmark_${current.id}`,
          name: `Validation Run ${i + 1}`,
          description: `Performance comparison with baseline run`,
          baselineMetrics: baseline,
          currentMetrics: current,
          improvement,
          status: improvement > 5 ? 'improved' : improvement < -5 ? 'degraded' : 'stable',
          timestamp: current.startTime
        });
      }

      return benchmarks;
    } catch (error) {
      console.error('Failed to get performance benchmarks:', error);
      return [];
    }
  }

  /**
   * Get performance optimization recommendations
   */
  getOptimizationRecommendations(metrics: ValidationPerformanceMetrics): PerformanceOptimization[] {
    const recommendations: PerformanceOptimization[] = [];

    // Batch size optimization
    if (metrics.throughput < 10) {
      recommendations.push({
        id: 'batch_size_opt',
        type: 'batch_size',
        description: 'Low throughput detected',
        impact: 'high',
        effort: 'low',
        recommendation: 'Increase batch size to improve throughput',
        expectedImprovement: 30
      });
    }

    // Parallel processing optimization
    if (metrics.efficiency < 70) {
      recommendations.push({
        id: 'parallel_opt',
        type: 'parallel_processing',
        description: 'Low efficiency detected',
        impact: 'medium',
        effort: 'medium',
        recommendation: 'Implement parallel processing for resource validation',
        expectedImprovement: 25
      });
    }

    // Memory optimization
    if (metrics.systemMetrics.memoryUsage > 1000) {
      recommendations.push({
        id: 'memory_opt',
        type: 'memory',
        description: 'High memory usage detected',
        impact: 'medium',
        effort: 'high',
        recommendation: 'Optimize memory usage and implement garbage collection',
        expectedImprovement: 20
      });
    }

    // Network optimization
    if (metrics.systemMetrics.networkLatency > 1000) {
      recommendations.push({
        id: 'network_opt',
        type: 'network',
        description: 'High network latency detected',
        impact: 'high',
        effort: 'medium',
        recommendation: 'Optimize network requests and implement connection pooling',
        expectedImprovement: 40
      });
    }

    // CPU optimization
    if (metrics.systemMetrics.cpuUsage > 80) {
      recommendations.push({
        id: 'cpu_opt',
        type: 'cpu',
        description: 'High CPU usage detected',
        impact: 'medium',
        effort: 'high',
        recommendation: 'Optimize CPU-intensive operations and implement caching',
        expectedImprovement: 15
      });
    }

    return recommendations;
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(metrics: ValidationPerformanceMetrics): void {
    try {
      // Get memory usage (simplified)
      const memUsage = process.memoryUsage();
      metrics.systemMetrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

      // Get CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      metrics.systemMetrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // percentage

      // Network latency (simplified)
      metrics.systemMetrics.networkLatency = Math.random() * 100; // placeholder
    } catch (error) {
      console.warn('Failed to update system metrics:', error);
    }
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: ValidationPerformanceMetrics): void {
    const bottlenecks: string[] = [];

    if (metrics.throughput < 5) {
      bottlenecks.push('Low throughput - consider increasing batch size');
    }

    if (metrics.efficiency < 60) {
      bottlenecks.push('Low efficiency - consider parallel processing');
    }

    if (metrics.systemMetrics.memoryUsage > 1000) {
      bottlenecks.push('High memory usage - consider memory optimization');
    }

    if (metrics.systemMetrics.cpuUsage > 80) {
      bottlenecks.push('High CPU usage - consider CPU optimization');
    }

    if (metrics.systemMetrics.networkLatency > 1000) {
      bottlenecks.push('High network latency - consider network optimization');
    }

    metrics.bottlenecks = bottlenecks;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: ValidationPerformanceMetrics): void {
    const recommendations: string[] = [];

    if (metrics.throughput < 10) {
      recommendations.push('Increase batch size to improve throughput');
    }

    if (metrics.efficiency < 70) {
      recommendations.push('Implement parallel processing for better efficiency');
    }

    if (metrics.systemMetrics.memoryUsage > 1000) {
      recommendations.push('Optimize memory usage and implement garbage collection');
    }

    if (metrics.systemMetrics.networkLatency > 1000) {
      recommendations.push('Optimize network requests and implement connection pooling');
    }

    if (metrics.systemMetrics.cpuUsage > 80) {
      recommendations.push('Optimize CPU-intensive operations and implement caching');
    }

    metrics.recommendations = recommendations;
  }

  /**
   * Calculate efficiency percentage
   */
  private calculateEfficiency(metrics: ValidationPerformanceMetrics): number {
    if (!metrics.duration || metrics.duration === 0) return 0;
    
    const processingTime = metrics.processedResources * metrics.averageProcessingTime;
    const efficiency = (processingTime / metrics.duration) * 100;
    
    return Math.min(100, Math.max(0, efficiency));
  }

  /**
   * Calculate performance improvement percentage
   */
  private calculateImprovement(baseline: ValidationPerformanceMetrics, current: ValidationPerformanceMetrics): number {
    if (baseline.throughput === 0) return 0;
    
    const improvement = ((current.throughput - baseline.throughput) / baseline.throughput) * 100;
    return Math.round(improvement * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(metrics: ValidationPerformanceMetrics): Promise<void> {
    try {
      await storage.saveValidationPerformanceMetrics(metrics);
    } catch (error) {
      console.error('Failed to persist performance metrics:', error);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalRuns: number;
    averageThroughput: number;
    averageEfficiency: number;
    totalResourcesProcessed: number;
    averageProcessingTime: number;
    topBottlenecks: string[];
  } {
    if (this.performanceHistory.length === 0) {
      return {
        totalRuns: 0,
        averageThroughput: 0,
        averageEfficiency: 0,
        totalResourcesProcessed: 0,
        averageProcessingTime: 0,
        topBottlenecks: []
      };
    }

    const totalRuns = this.performanceHistory.length;
    const averageThroughput = this.performanceHistory.reduce((sum, m) => sum + m.throughput, 0) / totalRuns;
    const averageEfficiency = this.performanceHistory.reduce((sum, m) => sum + m.efficiency, 0) / totalRuns;
    const totalResourcesProcessed = this.performanceHistory.reduce((sum, m) => sum + m.processedResources, 0);
    const averageProcessingTime = this.performanceHistory.reduce((sum, m) => sum + m.averageProcessingTime, 0) / totalRuns;

    // Get top bottlenecks
    const bottleneckCounts = new Map<string, number>();
    this.performanceHistory.forEach(metrics => {
      metrics.bottlenecks.forEach(bottleneck => {
        bottleneckCounts.set(bottleneck, (bottleneckCounts.get(bottleneck) || 0) + 1);
      });
    });

    const topBottlenecks = Array.from(bottleneckCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([bottleneck]) => bottleneck);

    return {
      totalRuns,
      averageThroughput,
      averageEfficiency,
      totalResourcesProcessed,
      averageProcessingTime,
      topBottlenecks
    };
  }
}
