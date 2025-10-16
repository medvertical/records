/**
 * Performance Baseline Metrics Service
 * Task 10.2: Establish baseline metrics for validation performance
 */

/**
 * Performance baseline metrics interface
 */
export interface PerformanceBaseline {
  timestamp: Date;
  coldStartTimeMs: number;
  warmCacheTimeMs: number;
  throughputResourcesPerSecond: number;
  byResourceType: {
    [resourceType: string]: {
      avgTimeMs: number;
      minTimeMs: number;
      maxTimeMs: number;
      p50TimeMs: number;
      p95TimeMs: number;
      p99TimeMs: number;
      sampleCount: number;
    };
  };
  byAspect: {
    [aspect: string]: {
      avgTimeMs: number;
      sampleCount: number;
    };
  };
  memoryUsageMB: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cacheEffectiveness: {
    hitRate: number;
    missRate: number;
    avgHitTimeMs: number;
    avgMissTimeMs: number;
  };
}

/**
 * Performance metrics tracker
 */
export class PerformanceBaselineTracker {
  private measurements: PerformanceBaseline[] = [];
  private currentMeasurements: Map<string, number[]> = new Map();
  private readonly MAX_HISTORY = 100; // Keep last 100 baseline measurements

  /**
   * Record a validation timing measurement
   */
  recordValidationTime(
    resourceType: string,
    aspect: string,
    timeMs: number,
    cacheHit: boolean = false
  ): void {
    const key = `${resourceType}:${aspect}`;
    const times = this.currentMeasurements.get(key) || [];
    times.push(timeMs);
    this.currentMeasurements.set(key, times);

    // Also track cache performance
    const cacheKey = cacheHit ? 'cache:hit' : 'cache:miss';
    const cacheTimes = this.currentMeasurements.get(cacheKey) || [];
    cacheTimes.push(timeMs);
    this.currentMeasurements.set(cacheKey, cacheTimes);
  }

  /**
   * Record cold start time
   */
  recordColdStart(timeMs: number): void {
    const existing = this.currentMeasurements.get('coldStart') || [];
    existing.push(timeMs);
    this.currentMeasurements.set('coldStart', existing);
  }

  /**
   * Record warm cache time
   */
  recordWarmCache(timeMs: number): void {
    const existing = this.currentMeasurements.get('warmCache') || [];
    existing.push(timeMs);
    this.currentMeasurements.set('warmCache', existing);
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Calculate statistics from array of times
   */
  private calculateStats(times: number[]): {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (times.length === 0) {
      return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((acc, t) => acc + t, 0);

    return {
      avg: sum / times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
    };
  }

  /**
   * Generate baseline from current measurements
   */
  generateBaseline(): PerformanceBaseline {
    const coldStartTimes = this.currentMeasurements.get('coldStart') || [0];
    const warmCacheTimes = this.currentMeasurements.get('warmCache') || [0];

    // Calculate throughput from all measurements
    const allTimes: number[] = [];
    this.currentMeasurements.forEach((times, key) => {
      if (!key.startsWith('coldStart') && !key.startsWith('warmCache') && !key.startsWith('cache:')) {
        allTimes.push(...times);
      }
    });

    const totalTimeMs = allTimes.reduce((sum, t) => sum + t, 0);
    const throughput = allTimes.length > 0 ? (allTimes.length / totalTimeMs) * 1000 : 0;

    // Group by resource type
    const byResourceType: PerformanceBaseline['byResourceType'] = {};
    const resourceTypeKeys = Array.from(this.currentMeasurements.keys()).filter(
      (k) => !k.startsWith('coldStart') && !k.startsWith('warmCache') && !k.startsWith('cache:')
    );

    const resourceTypes = new Set(
      resourceTypeKeys.map((k) => k.split(':')[0])
    );

    resourceTypes.forEach((resourceType) => {
      const resourceTimes: number[] = [];
      resourceTypeKeys.forEach((key) => {
        if (key.startsWith(resourceType + ':')) {
          const times = this.currentMeasurements.get(key) || [];
          resourceTimes.push(...times);
        }
      });

      if (resourceTimes.length > 0) {
        const stats = this.calculateStats(resourceTimes);
        byResourceType[resourceType] = {
          avgTimeMs: stats.avg,
          minTimeMs: stats.min,
          maxTimeMs: stats.max,
          p50TimeMs: stats.p50,
          p95TimeMs: stats.p95,
          p99TimeMs: stats.p99,
          sampleCount: resourceTimes.length,
        };
      }
    });

    // Group by aspect
    const byAspect: PerformanceBaseline['byAspect'] = {};
    const aspects = new Set(
      resourceTypeKeys.map((k) => k.split(':')[1]).filter(Boolean)
    );

    aspects.forEach((aspect) => {
      const aspectTimes: number[] = [];
      resourceTypeKeys.forEach((key) => {
        if (key.endsWith(':' + aspect)) {
          const times = this.currentMeasurements.get(key) || [];
          aspectTimes.push(...times);
        }
      });

      if (aspectTimes.length > 0) {
        byAspect[aspect] = {
          avgTimeMs: aspectTimes.reduce((sum, t) => sum + t, 0) / aspectTimes.length,
          sampleCount: aspectTimes.length,
        };
      }
    });

    // Calculate cache effectiveness
    const cacheHitTimes = this.currentMeasurements.get('cache:hit') || [];
    const cacheMissTimes = this.currentMeasurements.get('cache:miss') || [];
    const totalCacheOps = cacheHitTimes.length + cacheMissTimes.length;

    const cacheEffectiveness = {
      hitRate: totalCacheOps > 0 ? cacheHitTimes.length / totalCacheOps : 0,
      missRate: totalCacheOps > 0 ? cacheMissTimes.length / totalCacheOps : 0,
      avgHitTimeMs: cacheHitTimes.length > 0
        ? cacheHitTimes.reduce((sum, t) => sum + t, 0) / cacheHitTimes.length
        : 0,
      avgMissTimeMs: cacheMissTimes.length > 0
        ? cacheMissTimes.reduce((sum, t) => sum + t, 0) / cacheMissTimes.length
        : 0,
    };

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      heapUsed: memoryUsage.heapUsed / 1024 / 1024,
      heapTotal: memoryUsage.heapTotal / 1024 / 1024,
      external: memoryUsage.external / 1024 / 1024,
      rss: memoryUsage.rss / 1024 / 1024,
    };

    const baseline: PerformanceBaseline = {
      timestamp: new Date(),
      coldStartTimeMs: coldStartTimes[coldStartTimes.length - 1] || 0,
      warmCacheTimeMs: warmCacheTimes[warmCacheTimes.length - 1] || 0,
      throughputResourcesPerSecond: throughput,
      byResourceType,
      byAspect,
      memoryUsageMB,
      cacheEffectiveness,
    };

    // Store baseline
    this.measurements.push(baseline);
    if (this.measurements.length > this.MAX_HISTORY) {
      this.measurements.shift(); // Remove oldest
    }

    return baseline;
  }

  /**
   * Get current baseline
   */
  getCurrentBaseline(): PerformanceBaseline | null {
    return this.measurements.length > 0
      ? this.measurements[this.measurements.length - 1]
      : null;
  }

  /**
   * Get all baseline measurements
   */
  getAllBaselines(): PerformanceBaseline[] {
    return [...this.measurements];
  }

  /**
   * Compare current performance to baseline
   */
  compareToBaseline(baseline: PerformanceBaseline): {
    coldStartDiff: number;
    warmCacheDiff: number;
    throughputDiff: number;
    regressions: string[];
    improvements: string[];
  } {
    const current = this.getCurrentBaseline();
    if (!current) {
      return {
        coldStartDiff: 0,
        warmCacheDiff: 0,
        throughputDiff: 0,
        regressions: ['No current baseline to compare'],
        improvements: [],
      };
    }

    const regressions: string[] = [];
    const improvements: string[] = [];

    // Cold start comparison
    const coldStartDiff = current.coldStartTimeMs - baseline.coldStartTimeMs;
    if (coldStartDiff > baseline.coldStartTimeMs * 0.2) {
      regressions.push(`Cold start is ${coldStartDiff.toFixed(0)}ms slower (${((coldStartDiff / baseline.coldStartTimeMs) * 100).toFixed(1)}%)`);
    } else if (coldStartDiff < -baseline.coldStartTimeMs * 0.1) {
      improvements.push(`Cold start is ${Math.abs(coldStartDiff).toFixed(0)}ms faster`);
    }

    // Warm cache comparison
    const warmCacheDiff = current.warmCacheTimeMs - baseline.warmCacheTimeMs;
    if (warmCacheDiff > baseline.warmCacheTimeMs * 0.2) {
      regressions.push(`Warm cache is ${warmCacheDiff.toFixed(0)}ms slower`);
    } else if (warmCacheDiff < -baseline.warmCacheTimeMs * 0.1) {
      improvements.push(`Warm cache is ${Math.abs(warmCacheDiff).toFixed(0)}ms faster`);
    }

    // Throughput comparison
    const throughputDiff = current.throughputResourcesPerSecond - baseline.throughputResourcesPerSecond;
    if (throughputDiff < -baseline.throughputResourcesPerSecond * 0.2) {
      regressions.push(`Throughput decreased by ${Math.abs(throughputDiff).toFixed(1)} resources/sec`);
    } else if (throughputDiff > baseline.throughputResourcesPerSecond * 0.1) {
      improvements.push(`Throughput increased by ${throughputDiff.toFixed(1)} resources/sec`);
    }

    // Resource type comparisons
    Object.keys(baseline.byResourceType).forEach((resourceType) => {
      const baselineRT = baseline.byResourceType[resourceType];
      const currentRT = current.byResourceType[resourceType];

      if (currentRT) {
        const avgDiff = currentRT.avgTimeMs - baselineRT.avgTimeMs;
        if (avgDiff > baselineRT.avgTimeMs * 0.2) {
          regressions.push(`${resourceType} avg time increased by ${avgDiff.toFixed(0)}ms`);
        } else if (avgDiff < -baselineRT.avgTimeMs * 0.1) {
          improvements.push(`${resourceType} avg time decreased by ${Math.abs(avgDiff).toFixed(0)}ms`);
        }
      }
    });

    return {
      coldStartDiff,
      warmCacheDiff,
      throughputDiff,
      regressions,
      improvements,
    };
  }

  /**
   * Clear all measurements
   */
  clearMeasurements(): void {
    this.measurements = [];
    this.currentMeasurements.clear();
  }

  /**
   * Reset current measurements (start new baseline)
   */
  resetCurrentMeasurements(): void {
    this.currentMeasurements.clear();
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalMeasurements: number;
    latestBaseline: PerformanceBaseline | null;
    trend: {
      coldStartTrend: 'improving' | 'stable' | 'degrading';
      warmCacheTrend: 'improving' | 'stable' | 'degrading';
      throughputTrend: 'improving' | 'stable' | 'degrading';
    };
  } {
    if (this.measurements.length < 2) {
      return {
        totalMeasurements: this.measurements.length,
        latestBaseline: this.getCurrentBaseline(),
        trend: {
          coldStartTrend: 'stable',
          warmCacheTrend: 'stable',
          throughputTrend: 'stable',
        },
      };
    }

    const latest = this.measurements[this.measurements.length - 1];
    const previous = this.measurements[this.measurements.length - 2];

    const coldStartTrend = this.calculateTrend(latest.coldStartTimeMs, previous.coldStartTimeMs, false);
    const warmCacheTrend = this.calculateTrend(latest.warmCacheTimeMs, previous.warmCacheTimeMs, false);
    const throughputTrend = this.calculateTrend(latest.throughputResourcesPerSecond, previous.throughputResourcesPerSecond, true);

    return {
      totalMeasurements: this.measurements.length,
      latestBaseline: latest,
      trend: {
        coldStartTrend,
        warmCacheTrend,
        throughputTrend,
      },
    };
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(
    current: number,
    previous: number,
    higherIsBetter: boolean
  ): 'improving' | 'stable' | 'degrading' {
    const diff = current - previous;
    const threshold = previous * 0.1; // 10% threshold

    if (higherIsBetter) {
      if (diff > threshold) return 'improving';
      if (diff < -threshold) return 'degrading';
    } else {
      if (diff < -threshold) return 'improving';
      if (diff > threshold) return 'degrading';
    }

    return 'stable';
  }

  /**
   * Export baselines to JSON
   */
  exportBaselines(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        measurementCount: this.measurements.length,
        baselines: this.measurements,
      },
      null,
      2
    );
  }

  /**
   * Import baselines from JSON
   */
  importBaselines(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.baselines && Array.isArray(data.baselines)) {
        this.measurements = data.baselines.map((b: any) => ({
          ...b,
          timestamp: new Date(b.timestamp),
        }));
      }
    } catch (error) {
      console.error('[PerformanceBaseline] Import failed:', error);
      throw new Error('Invalid baseline data format');
    }
  }
}

/**
 * Singleton instance
 */
export const performanceBaselineTracker = new PerformanceBaselineTracker();

