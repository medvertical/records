/**
 * Performance Baseline Tests
 * Task 10.2: Test baseline metrics tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceBaselineTracker } from '../performance-baseline';

describe('PerformanceBaselineTracker', () => {
  let tracker: PerformanceBaselineTracker;

  beforeEach(() => {
    tracker = new PerformanceBaselineTracker();
  });

  // ========================================================================
  // Basic Recording
  // ========================================================================

  describe('Recording Measurements', () => {
    it('should record validation times', () => {
      tracker.recordValidationTime('Patient', 'structural', 150, false);
      tracker.recordValidationTime('Patient', 'metadata', 20, true);

      const baseline = tracker.generateBaseline();

      expect(baseline).toBeDefined();
      expect(baseline.byResourceType['Patient']).toBeDefined();
      expect(baseline.byResourceType['Patient'].sampleCount).toBe(2);
    });

    it('should record cold start time', () => {
      tracker.recordColdStart(500);

      const baseline = tracker.generateBaseline();

      expect(baseline.coldStartTimeMs).toBe(500);
    });

    it('should record warm cache time', () => {
      tracker.recordWarmCache(50);

      const baseline = tracker.generateBaseline();

      expect(baseline.warmCacheTimeMs).toBe(50);
    });

    it('should calculate cache effectiveness', () => {
      // Record cache hits
      tracker.recordValidationTime('Patient', 'structural', 30, true);
      tracker.recordValidationTime('Patient', 'structural', 25, true);
      tracker.recordValidationTime('Patient', 'structural', 28, true);

      // Record cache misses
      tracker.recordValidationTime('Patient', 'structural', 150, false);

      const baseline = tracker.generateBaseline();

      expect(baseline.cacheEffectiveness.hitRate).toBe(0.75); // 3 hits out of 4 total
      expect(baseline.cacheEffectiveness.missRate).toBe(0.25);
    });
  });

  // ========================================================================
  // Statistics Calculation
  // ========================================================================

  describe('Statistics Calculation', () => {
    it('should calculate average, min, max', () => {
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      tracker.recordValidationTime('Patient', 'structural', 150, false);
      tracker.recordValidationTime('Patient', 'structural', 200, false);

      const baseline = tracker.generateBaseline();
      const patientStats = baseline.byResourceType['Patient'];

      expect(patientStats.avgTimeMs).toBe(150);
      expect(patientStats.minTimeMs).toBe(100);
      expect(patientStats.maxTimeMs).toBe(200);
    });

    it('should calculate percentiles', () => {
      // Record 100 samples
      for (let i = 1; i <= 100; i++) {
        tracker.recordValidationTime('Observation', 'metadata', i, false);
      }

      const baseline = tracker.generateBaseline();
      const obsStats = baseline.byResourceType['Observation'];

      expect(obsStats.p50TimeMs).toBeCloseTo(50, 0);
      expect(obsStats.p95TimeMs).toBeCloseTo(95, 0);
      expect(obsStats.p99TimeMs).toBeCloseTo(99, 0);
    });

    it('should group by aspect', () => {
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      tracker.recordValidationTime('Observation', 'structural', 120, false);
      tracker.recordValidationTime('Patient', 'metadata', 20, false);

      const baseline = tracker.generateBaseline();

      expect(baseline.byAspect['structural']).toBeDefined();
      expect(baseline.byAspect['structural'].sampleCount).toBe(2);
      expect(baseline.byAspect['metadata']).toBeDefined();
      expect(baseline.byAspect['metadata'].sampleCount).toBe(1);
    });

    it('should calculate throughput', () => {
      // Record 10 validations with total time 1000ms
      for (let i = 0; i < 10; i++) {
        tracker.recordValidationTime('Patient', 'structural', 100, false);
      }

      const baseline = tracker.generateBaseline();

      // 10 resources / 1000ms = 10 resources/second
      expect(baseline.throughputResourcesPerSecond).toBe(10);
    });
  });

  // ========================================================================
  // Baseline Management
  // ========================================================================

  describe('Baseline Management', () => {
    it('should store multiple baselines', () => {
      // Generate first baseline
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      const baseline1 = tracker.generateBaseline();

      // Reset and generate second baseline
      tracker.resetCurrentMeasurements();
      tracker.recordValidationTime('Patient', 'structural', 90, false);
      const baseline2 = tracker.generateBaseline();

      const allBaselines = tracker.getAllBaselines();

      expect(allBaselines.length).toBe(2);
      expect(allBaselines[0]).toEqual(baseline1);
      expect(allBaselines[1]).toEqual(baseline2);
    });

    it('should limit history to MAX_HISTORY', () => {
      // Generate 150 baselines
      for (let i = 0; i < 150; i++) {
        tracker.recordValidationTime('Patient', 'structural', 100 + i, false);
        tracker.generateBaseline();
        tracker.resetCurrentMeasurements();
      }

      const allBaselines = tracker.getAllBaselines();

      // Should keep only last 100
      expect(allBaselines.length).toBe(100);
    });

    it('should get current baseline', () => {
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      const baseline = tracker.generateBaseline();

      const current = tracker.getCurrentBaseline();

      expect(current).toEqual(baseline);
    });

    it('should return null when no baseline exists', () => {
      const current = tracker.getCurrentBaseline();

      expect(current).toBeNull();
    });
  });

  // ========================================================================
  // Comparison and Trends
  // ========================================================================

  describe('Baseline Comparison', () => {
    it('should detect performance regression', () => {
      // Generate baseline
      tracker.recordColdStart(100);
      tracker.recordWarmCache(20);
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      const baseline = tracker.generateBaseline();

      // Reset and record slower performance
      tracker.resetCurrentMeasurements();
      tracker.recordColdStart(150); // 50% slower - should be flagged
      tracker.recordWarmCache(25);
      tracker.recordValidationTime('Patient', 'structural', 130, false);
      tracker.generateBaseline();

      const comparison = tracker.compareToBaseline(baseline);

      expect(comparison.regressions.length).toBeGreaterThan(0);
      expect(comparison.regressions.some(r => r.includes('Cold start'))).toBe(true);
    });

    it('should detect performance improvement', () => {
      // Generate baseline
      tracker.recordColdStart(100);
      tracker.recordWarmCache(20);
      const baseline = tracker.generateBaseline();

      // Reset and record faster performance
      tracker.resetCurrentMeasurements();
      tracker.recordColdStart(70); // 30% faster
      tracker.recordWarmCache(15); // 25% faster
      tracker.generateBaseline();

      const comparison = tracker.compareToBaseline(baseline);

      expect(comparison.improvements.length).toBeGreaterThan(0);
      expect(comparison.improvements.some(i => i.includes('Cold start'))).toBe(true);
    });

    it('should calculate trend direction', () => {
      // First baseline
      tracker.recordColdStart(100);
      tracker.recordWarmCache(20);
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      tracker.generateBaseline();

      // Second baseline - improved
      tracker.resetCurrentMeasurements();
      tracker.recordColdStart(80);
      tracker.recordWarmCache(15);
      tracker.recordValidationTime('Patient', 'structural', 90, false);
      tracker.generateBaseline();

      const summary = tracker.getSummary();

      expect(summary.trend.coldStartTrend).toBe('improving');
      expect(summary.trend.warmCacheTrend).toBe('improving');
    });
  });

  // ========================================================================
  // Export/Import
  // ========================================================================

  describe('Export and Import', () => {
    it('should export baselines as JSON', () => {
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      tracker.generateBaseline();

      const json = tracker.exportBaselines();
      const data = JSON.parse(json);

      expect(data.baselines).toBeDefined();
      expect(data.baselines.length).toBe(1);
      expect(data.exportedAt).toBeDefined();
    });

    it('should import baselines from JSON', () => {
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      tracker.generateBaseline();

      const json = tracker.exportBaselines();

      // Create new tracker and import
      const newTracker = new PerformanceBaselineTracker();
      newTracker.importBaselines(json);

      const imported = newTracker.getAllBaselines();
      expect(imported.length).toBe(1);
    });

    it('should reject invalid import data', () => {
      expect(() => {
        tracker.importBaselines('invalid json');
      }).toThrow();
    });
  });

  // ========================================================================
  // Memory Tracking
  // ========================================================================

  describe('Memory Usage Tracking', () => {
    it('should track memory usage in baseline', () => {
      tracker.recordValidationTime('Patient', 'structural', 100, false);
      const baseline = tracker.generateBaseline();

      expect(baseline.memoryUsageMB.heapUsed).toBeGreaterThan(0);
      expect(baseline.memoryUsageMB.heapTotal).toBeGreaterThan(0);
      expect(baseline.memoryUsageMB.rss).toBeGreaterThan(0);
    });
  });
});


