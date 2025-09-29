/**
 * Performance Measurement Utility for FHIR Validation
 * 
 * Provides comprehensive timing measurements for each validator,
 * caching performance, and overall validation pipeline performance.
 */

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ValidatorPerformanceMetrics extends PerformanceMetrics {
  validator: string;
  resourceType: string;
  resourceId?: string;
  aspectTimes: Record<string, number>;
  totalIssues: number;
  cacheHits?: number;
  cacheMisses?: number;
  externalCalls?: number;
  externalCallTimes: Record<string, number>;
}

export interface CachingPerformanceMetrics extends PerformanceMetrics {
  cacheKey: string;
  cacheOperation: 'get' | 'set' | 'delete' | 'clear';
  hit: boolean;
  size?: number;
  ttl?: number;
}

export interface PipelinePerformanceMetrics extends PerformanceMetrics {
  pipelineStage: string;
  totalResources: number;
  processedResources: number;
  averageTimePerResource: number;
  throughput: number; // resources per second
  bottlenecks: string[];
}

export class PerformanceMeasurer {
  private static metrics: Map<string, PerformanceMetrics> = new Map();
  private static validatorMetrics: Map<string, ValidatorPerformanceMetrics> = new Map();
  private static cachingMetrics: Map<string, CachingPerformanceMetrics> = new Map();
  private static pipelineMetrics: Map<string, PipelinePerformanceMetrics> = new Map();

  /**
   * Start timing an operation
   */
  static startTiming(operationId: string, operation: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetrics = {
      operation,
      startTime: Date.now(),
      metadata
    };
    this.metrics.set(operationId, metric);
  }

  /**
   * End timing an operation and return duration
   */
  static endTiming(operationId: string): number {
    const metric = this.metrics.get(operationId);
    if (!metric) {
      console.warn(`[PerformanceMeasurer] No metric found for operation: ${operationId}`);
      return 0;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    
    console.log(`[PerformanceMeasurer] ⏱️ ${metric.operation} completed in ${metric.duration}ms`);
    
    return metric.duration;
  }

  /**
   * Start timing a validator operation
   */
  static startValidatorTiming(
    operationId: string,
    validator: string,
    resourceType: string,
    resourceId?: string
  ): void {
    const metric: ValidatorPerformanceMetrics = {
      operation: `validator-${validator}`,
      validator,
      resourceType,
      resourceId,
      startTime: Date.now(),
      aspectTimes: {},
      totalIssues: 0,
      externalCalls: 0,
      externalCallTimes: {}
    };
    this.validatorMetrics.set(operationId, metric);
  }

  /**
   * Record aspect timing for a validator
   */
  static recordAspectTiming(operationId: string, aspect: string, duration: number): void {
    const metric = this.validatorMetrics.get(operationId);
    if (metric) {
      metric.aspectTimes[aspect] = duration;
    }
  }

  /**
   * Record external call timing for a validator
   */
  static recordExternalCall(operationId: string, service: string, duration: number): void {
    const metric = this.validatorMetrics.get(operationId);
    if (metric) {
      metric.externalCalls = (metric.externalCalls || 0) + 1;
      metric.externalCallTimes[service] = (metric.externalCallTimes[service] || 0) + duration;
    }
  }

  /**
   * End validator timing and return comprehensive metrics
   */
  static endValidatorTiming(operationId: string, totalIssues: number): ValidatorPerformanceMetrics | null {
    const metric = this.validatorMetrics.get(operationId);
    if (!metric) {
      console.warn(`[PerformanceMeasurer] No validator metric found for operation: ${operationId}`);
      return null;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.totalIssues = totalIssues;

    // Calculate performance insights
    const totalAspectTime = Object.values(metric.aspectTimes).reduce((sum, time) => sum + time, 0);
    const totalExternalTime = Object.values(metric.externalCallTimes).reduce((sum, time) => sum + time, 0);
    const overheadTime = metric.duration - totalAspectTime - totalExternalTime;

    console.log(`[PerformanceMeasurer] 🔍 ${metric.validator} validation completed:`);
    console.log(`  📊 Total Time: ${metric.duration}ms`);
    console.log(`  🎯 Issues Found: ${totalIssues}`);
    console.log(`  ⚡ Aspect Time: ${totalAspectTime}ms`);
    console.log(`  🌐 External Time: ${totalExternalTime}ms`);
    console.log(`  🔧 Overhead Time: ${overheadTime}ms`);
    
    if (metric.externalCalls && metric.externalCalls > 0) {
      console.log(`  📞 External Calls: ${metric.externalCalls}`);
    }

    return metric;
  }

  /**
   * Start timing a caching operation
   */
  static startCachingTiming(
    operationId: string,
    cacheKey: string,
    cacheOperation: CachingPerformanceMetrics['cacheOperation']
  ): void {
    const metric: CachingPerformanceMetrics = {
      operation: `cache-${cacheOperation}`,
      cacheKey,
      cacheOperation,
      startTime: Date.now(),
      hit: false
    };
    this.cachingMetrics.set(operationId, metric);
  }

  /**
   * End caching timing and record hit/miss
   */
  static endCachingTiming(
    operationId: string,
    hit: boolean,
    size?: number,
    ttl?: number
  ): CachingPerformanceMetrics | null {
    const metric = this.cachingMetrics.get(operationId);
    if (!metric) {
      console.warn(`[PerformanceMeasurer] No caching metric found for operation: ${operationId}`);
      return null;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.hit = hit;
    metric.size = size;
    metric.ttl = ttl;

    const status = hit ? 'HIT' : 'MISS';
    console.log(`[PerformanceMeasurer] 💾 Cache ${metric.cacheOperation.toUpperCase()} ${status} in ${metric.duration}ms`);
    
    if (size) {
      console.log(`  📦 Size: ${size} bytes`);
    }
    if (ttl) {
      console.log(`  ⏰ TTL: ${ttl}ms`);
    }

    return metric;
  }

  /**
   * Start timing a pipeline operation
   */
  static startPipelineTiming(
    operationId: string,
    pipelineStage: string,
    totalResources: number
  ): void {
    const metric: PipelinePerformanceMetrics = {
      operation: `pipeline-${pipelineStage}`,
      pipelineStage,
      totalResources,
      processedResources: 0,
      startTime: Date.now(),
      averageTimePerResource: 0,
      throughput: 0,
      bottlenecks: []
    };
    this.pipelineMetrics.set(operationId, metric);
  }

  /**
   * Update pipeline progress
   */
  static updatePipelineProgress(operationId: string, processedResources: number): void {
    const metric = this.pipelineMetrics.get(operationId);
    if (metric) {
      metric.processedResources = processedResources;
      
      const elapsedTime = Date.now() - metric.startTime;
      metric.averageTimePerResource = elapsedTime / processedResources;
      metric.throughput = (processedResources / elapsedTime) * 1000; // resources per second
    }
  }

  /**
   * Record pipeline bottleneck
   */
  static recordPipelineBottleneck(operationId: string, bottleneck: string): void {
    const metric = this.pipelineMetrics.get(operationId);
    if (metric && !metric.bottlenecks.includes(bottleneck)) {
      metric.bottlenecks.push(bottleneck);
    }
  }

  /**
   * End pipeline timing and return comprehensive metrics
   */
  static endPipelineTiming(operationId: string): PipelinePerformanceMetrics | null {
    const metric = this.pipelineMetrics.get(operationId);
    if (!metric) {
      console.warn(`[PerformanceMeasurer] No pipeline metric found for operation: ${operationId}`);
      return null;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.averageTimePerResource = metric.duration / metric.totalResources;
    metric.throughput = (metric.totalResources / metric.duration) * 1000;

    console.log(`[PerformanceMeasurer] 🚀 Pipeline ${metric.pipelineStage} completed:`);
    console.log(`  📊 Total Resources: ${metric.totalResources}`);
    console.log(`  ⏱️ Total Time: ${metric.duration}ms`);
    console.log(`  📈 Throughput: ${metric.throughput.toFixed(2)} resources/second`);
    console.log(`  ⚡ Avg Time/Resource: ${metric.averageTimePerResource.toFixed(2)}ms`);
    
    if (metric.bottlenecks.length > 0) {
      console.log(`  🚧 Bottlenecks: ${metric.bottlenecks.join(', ')}`);
    }

    return metric;
  }

  /**
   * Get performance summary for all operations
   */
  static getPerformanceSummary(): {
    totalOperations: number;
    averageDuration: number;
    validatorMetrics: ValidatorPerformanceMetrics[];
    cachingMetrics: CachingPerformanceMetrics[];
    pipelineMetrics: PipelinePerformanceMetrics[];
    topBottlenecks: string[];
  } {
    const allMetrics = Array.from(this.metrics.values());
    const completedMetrics = allMetrics.filter(m => m.duration !== undefined);
    const averageDuration = completedMetrics.length > 0 
      ? completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / completedMetrics.length 
      : 0;

    const validatorMetrics = Array.from(this.validatorMetrics.values());
    const cachingMetrics = Array.from(this.cachingMetrics.values());
    const pipelineMetrics = Array.from(this.pipelineMetrics.values());

    // Calculate top bottlenecks
    const bottleneckCounts: Record<string, number> = {};
    pipelineMetrics.forEach(metric => {
      metric.bottlenecks.forEach(bottleneck => {
        bottleneckCounts[bottleneck] = (bottleneckCounts[bottleneck] || 0) + 1;
      });
    });
    const topBottlenecks = Object.entries(bottleneckCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([bottleneck]) => bottleneck);

    return {
      totalOperations: allMetrics.length,
      averageDuration,
      validatorMetrics,
      cachingMetrics,
      pipelineMetrics,
      topBottlenecks
    };
  }

  /**
   * Clear all metrics (useful for testing or periodic cleanup)
   */
  static clearMetrics(): void {
    this.metrics.clear();
    this.validatorMetrics.clear();
    this.cachingMetrics.clear();
    this.pipelineMetrics.clear();
    console.log('[PerformanceMeasurer] 🧹 All performance metrics cleared');
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(): string {
    const summary = this.getPerformanceSummary();
    
    let report = '\n🎯 Performance Report\n';
    report += '==================\n\n';
    
    report += `📊 Overall Performance:\n`;
    report += `  Total Operations: ${summary.totalOperations}\n`;
    report += `  Average Duration: ${summary.averageDuration.toFixed(2)}ms\n\n`;
    
    if (summary.validatorMetrics.length > 0) {
      report += `🔍 Validator Performance:\n`;
      summary.validatorMetrics.forEach(metric => {
        report += `  ${metric.validator}: ${metric.duration}ms (${metric.totalIssues} issues)\n`;
      });
      report += '\n';
    }
    
    if (summary.cachingMetrics.length > 0) {
      report += `💾 Caching Performance:\n`;
      const hits = summary.cachingMetrics.filter(m => m.hit).length;
      const misses = summary.cachingMetrics.filter(m => !m.hit).length;
      const hitRate = hits / (hits + misses) * 100;
      report += `  Cache Hit Rate: ${hitRate.toFixed(1)}% (${hits} hits, ${misses} misses)\n\n`;
    }
    
    if (summary.pipelineMetrics.length > 0) {
      report += `🚀 Pipeline Performance:\n`;
      summary.pipelineMetrics.forEach(metric => {
        report += `  ${metric.pipelineStage}: ${metric.throughput.toFixed(2)} resources/sec\n`;
      });
      report += '\n';
    }
    
    if (summary.topBottlenecks.length > 0) {
      report += `🚧 Top Bottlenecks:\n`;
      summary.topBottlenecks.forEach(bottleneck => {
        report += `  - ${bottleneck}\n`;
      });
    }
    
    return report;
  }

  /**
   * Performance decorator for methods
   */
  static measureMethod(operationName: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        PerformanceMeasurer.startTiming(operationId, operationName);
        
        try {
          const result = await method.apply(this, args);
          PerformanceMeasurer.endTiming(operationId);
          return result;
        } catch (error) {
          PerformanceMeasurer.endTiming(operationId);
          throw error;
        }
      };
    };
  }

  /**
   * Performance decorator for validator methods
   */
  static measureValidator(validatorName: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const operationId = `${validatorName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const resourceType = args[1] || 'unknown'; // Assuming second argument is resourceType
        const resourceId = args[2] || 'unknown'; // Assuming third argument is resourceId
        
        PerformanceMeasurer.startValidatorTiming(operationId, validatorName, resourceType, resourceId);
        
        try {
          const result = await method.apply(this, args);
          const totalIssues = result?.issues?.length || 0;
          PerformanceMeasurer.endValidatorTiming(operationId, totalIssues);
          return result;
        } catch (error) {
          PerformanceMeasurer.endValidatorTiming(operationId, 0);
          throw error;
        }
      };
    };
  }
}
