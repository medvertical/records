/**
 * Terminology Performance Monitor
 * 
 * Tracks and reports performance metrics for terminology validation operations.
 * Measures validation times, cache performance, server response times, and throughput.
 * 
 * Metrics Tracked:
 * - Validation time (per code, per resource, per batch)
 * - Cache hit rate and effectiveness
 * - Server response times (p50, p95, p99)
 * - Throughput (codes/second, resources/minute)
 * - Circuit breaker activations
 * 
 * Responsibilities: Performance tracking and metrics ONLY
 * - Does not perform validation (handled by other components)
 * - Does not manage cache (handled by TerminologyCache)
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 */

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetrics {
  /** Total validations performed */
  totalValidations: number;
  
  /** Total codes validated */
  totalCodes: number;
  
  /** Cache hit rate percentage */
  cacheHitRate: number;
  
  /** Average validation time per code (ms) */
  avgTimePerCode: number;
  
  /** Average validation time per resource (ms) */
  avgTimePerResource: number;
  
  /** Response time percentiles */
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  
  /** Throughput metrics */
  throughput: {
    codesPerSecond: number;
    resourcesPerMinute: number;
  };
  
  /** Circuit breaker activations */
  circuitBreakerActivations: number;
  
  /** Errors encountered */
  errorCount: number;
  
  /** Time window for metrics (ms) */
  timeWindow: number;
}

export interface ValidationTiming {
  /** Validation ID */
  id: string;
  
  /** Resource type */
  resourceType: string;
  
  /** Number of codes validated */
  codeCount: number;
  
  /** Total time (ms) */
  totalTime: number;
  
  /** Time breakdown */
  breakdown: {
    extraction: number;
    cacheCheck: number;
    validation: number;
    processing: number;
  };
  
  /** Cache hits */
  cacheHits: number;
  
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Performance Monitor
// ============================================================================

export class TerminologyPerformanceMonitor {
  private timings: ValidationTiming[] = [];
  private responseTimes: number[] = [];
  private maxTimings: number = 1000; // Keep last 1000 timings
  private maxResponseTimes: number = 10000; // Keep last 10000 response times
  private windowStartTime: number = Date.now();
  private totalValidations: number = 0;
  private totalCodes: number = 0;
  private totalCacheHits: number = 0;
  private errorCount: number = 0;
  private circuitBreakerActivations: number = 0;

  /**
   * Record a validation operation
   * 
   * @param timing - Validation timing information
   */
  recordValidation(timing: ValidationTiming): void {
    this.timings.push(timing);
    this.totalValidations++;
    this.totalCodes += timing.codeCount;
    this.totalCacheHits += timing.cacheHits;

    // Trim old timings if needed
    if (this.timings.length > this.maxTimings) {
      this.timings.shift();
    }
  }

  /**
   * Record a server response time
   * 
   * @param responseTime - Response time in milliseconds
   */
  recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // Trim old response times if needed
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.errorCount++;
  }

  /**
   * Record circuit breaker activation
   */
  recordCircuitBreakerActivation(): void {
    this.circuitBreakerActivations++;
  }

  /**
   * Get current performance metrics
   * 
   * @returns Current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const timeWindow = Date.now() - this.windowStartTime;
    const timeWindowSeconds = timeWindow / 1000;

    // Calculate cache hit rate
    const totalRequests = this.totalCodes;
    const cacheHitRate = totalRequests > 0 
      ? (this.totalCacheHits / totalRequests) * 100 
      : 0;

    // Calculate average times
    const avgTimePerCode = this.calculateAverageCodeTime();
    const avgTimePerResource = this.calculateAverageResourceTime();

    // Calculate response time percentiles
    const responseTimePercentiles = this.calculatePercentiles(this.responseTimes);

    // Calculate throughput
    const codesPerSecond = timeWindowSeconds > 0 
      ? this.totalCodes / timeWindowSeconds 
      : 0;
    const resourcesPerMinute = timeWindowSeconds > 0 
      ? (this.totalValidations / timeWindowSeconds) * 60 
      : 0;

    return {
      totalValidations: this.totalValidations,
      totalCodes: this.totalCodes,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      avgTimePerCode: Math.round(avgTimePerCode * 100) / 100,
      avgTimePerResource: Math.round(avgTimePerResource * 100) / 100,
      responseTime: {
        p50: Math.round(responseTimePercentiles.p50),
        p95: Math.round(responseTimePercentiles.p95),
        p99: Math.round(responseTimePercentiles.p99),
        max: Math.round(responseTimePercentiles.max),
      },
      throughput: {
        codesPerSecond: Math.round(codesPerSecond * 100) / 100,
        resourcesPerMinute: Math.round(resourcesPerMinute * 100) / 100,
      },
      circuitBreakerActivations: this.circuitBreakerActivations,
      errorCount: this.errorCount,
      timeWindow,
    };
  }

  /**
   * Get recent validation timings
   * 
   * @param limit - Maximum number of timings to return
   * @returns Recent validation timings
   */
  getRecentTimings(limit: number = 100): ValidationTiming[] {
    return this.timings.slice(-limit);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.timings = [];
    this.responseTimes = [];
    this.windowStartTime = Date.now();
    this.totalValidations = 0;
    this.totalCodes = 0;
    this.totalCacheHits = 0;
    this.errorCount = 0;
    this.circuitBreakerActivations = 0;
    
    console.log('[PerformanceMonitor] Metrics reset');
  }

  /**
   * Log performance summary
   */
  logSummary(): void {
    const metrics = this.getMetrics();
    
    console.log('='.repeat(70));
    console.log('[PerformanceMonitor] Terminology Validation Performance Summary');
    console.log('='.repeat(70));
    console.log(`Total Validations:        ${metrics.totalValidations}`);
    console.log(`Total Codes:              ${metrics.totalCodes}`);
    console.log(`Cache Hit Rate:           ${metrics.cacheHitRate}%`);
    console.log(`Avg Time per Code:        ${metrics.avgTimePerCode}ms`);
    console.log(`Avg Time per Resource:    ${metrics.avgTimePerResource}ms`);
    console.log(`Response Time (p50/p95):  ${metrics.responseTime.p50}ms / ${metrics.responseTime.p95}ms`);
    console.log(`Throughput:               ${metrics.throughput.codesPerSecond} codes/sec`);
    console.log(`Circuit Breaker Trips:    ${metrics.circuitBreakerActivations}`);
    console.log(`Errors:                   ${metrics.errorCount}`);
    console.log(`Time Window:              ${Math.round(metrics.timeWindow / 1000)}s`);
    console.log('='.repeat(70));
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Calculate average validation time per code
   */
  private calculateAverageCodeTime(): number {
    if (this.timings.length === 0) return 0;

    const totalTime = this.timings.reduce((sum, t) => sum + t.totalTime, 0);
    const totalCodes = this.timings.reduce((sum, t) => sum + t.codeCount, 0);

    return totalCodes > 0 ? totalTime / totalCodes : 0;
  }

  /**
   * Calculate average validation time per resource
   */
  private calculateAverageResourceTime(): number {
    if (this.timings.length === 0) return 0;

    const totalTime = this.timings.reduce((sum, t) => sum + t.totalTime, 0);
    return totalTime / this.timings.length;
  }

  /**
   * Calculate percentiles from array of numbers
   */
  private calculatePercentiles(values: number[]): {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    
    return {
      p50: this.getPercentile(sorted, 50),
      p95: this.getPercentile(sorted, 95),
      p99: this.getPercentile(sorted, 99),
      max: sorted[sorted.length - 1],
    };
  }

  /**
   * Get percentile value from sorted array
   */
  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// ============================================================================
// Timing Helper
// ============================================================================

export class ValidationTimer {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Mark a checkpoint
   */
  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime);
  }

  /**
   * Get elapsed time
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get time breakdown
   */
  getBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    let lastTime = 0;
    for (const [name, time] of this.checkpoints.entries()) {
      breakdown[name] = time - lastTime;
      lastTime = time;
    }

    return breakdown;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let monitorInstance: TerminologyPerformanceMonitor | null = null;

/**
 * Get or create singleton TerminologyPerformanceMonitor instance
 */
export function getPerformanceMonitor(): TerminologyPerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new TerminologyPerformanceMonitor();
  }
  return monitorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetPerformanceMonitor(): void {
  monitorInstance = null;
}

