/**
 * Performance Regression Integration Tests
 * Task 11.10: Validate against time thresholds to detect regressions
 * 
 * Tests that validation performance meets thresholds and hasn't regressed.
 */

import { describe, it, expect } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import { getTestDataManager } from '../fixtures/test-data-manager';
import { getPerformanceBaselineTracker } from '../../services/performance/performance-baseline';

const engine = getValidationEngine();
const testData = getTestDataManager();
const baselineTracker = getPerformanceBaselineTracker();

// ============================================================================
// Performance Thresholds
// ============================================================================

const PERFORMANCE_THRESHOLDS = {
  // Interactive validation (warm cache) should be under 2 seconds
  warmCacheMaxMs: 2000,
  
  // Cold start should be under 5 seconds
  coldStartMaxMs: 5000,
  
  // Individual resource validation should be under 3 seconds
  singleResourceMaxMs: 3000,
  
  // Batch validation throughput should be > 0.5 resources/sec
  minThroughputResourcesPerSec: 0.5,
  
  // Cache hit rate should be > 50% after warm-up
  minCacheHitRate: 0.5,
};

// ============================================================================
// Performance Regression Tests
// ============================================================================

describe('Performance Regression Integration', () => {
  describe('Interactive Validation Performance', () => {
    it('should meet warm cache validation threshold (<2s)', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (!patient) {
        return;
      }

      // Warm up cache
      await engine.validateResource({
        resource: patient.content,
        resourceType: 'Patient',
      });

      // Measure warm cache performance
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
        });
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`  Warm cache - Avg: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms`);

      // Average should be under threshold
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.warmCacheMaxMs);
      
      // Maximum (worst case) should also be reasonable
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.warmCacheMaxMs * 2);
    });

    it('should meet cold start threshold (<5s)', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (!patient) {
        return;
      }

      // Create unique resource to ensure cold start
      const uniquePatient = {
        ...patient.content,
        id: `test-patient-cold-${Date.now()}`,
      };

      const start = Date.now();
      await engine.validateResource({
        resource: uniquePatient,
        resourceType: 'Patient',
      });
      const coldStartTime = Date.now() - start;

      console.log(`  Cold start: ${coldStartTime}ms`);

      expect(coldStartTime).toBeLessThan(PERFORMANCE_THRESHOLDS.coldStartMaxMs);
    });
  });

  // ========================================================================
  // Single Resource Performance
  // ========================================================================

  describe('Single Resource Validation Performance', () => {
    it('should validate Patient under threshold', async () => {
      const patients = testData.getValidResourcesByType('Patient');

      for (const patient of patients) {
        const start = Date.now();
        await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
        });
        const time = Date.now() - start;

        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.singleResourceMaxMs);
        console.log(`  Patient validation: ${time}ms`);
      }
    });

    it('should validate Observation under threshold', async () => {
      const observations = testData.getValidResourcesByType('Observation');

      for (const observation of observations) {
        const start = Date.now();
        await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
        });
        const time = Date.now() - start;

        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.singleResourceMaxMs);
        console.log(`  Observation validation: ${time}ms`);
      }
    });

    it('should validate Condition under threshold', async () => {
      const conditions = testData.getValidResourcesByType('Condition');

      for (const condition of conditions) {
        const start = Date.now();
        await engine.validateResource({
          resource: condition.content,
          resourceType: 'Condition',
        });
        const time = Date.now() - start;

        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.singleResourceMaxMs);
        console.log(`  Condition validation: ${time}ms`);
      }
    });
  });

  // ========================================================================
  // Batch Validation Performance
  // ========================================================================

  describe('Batch Validation Performance', () => {
    it('should meet throughput threshold (>0.5 resources/sec)', async () => {
      const resources = testData.getSampleSet(10);

      const start = Date.now();
      
      for (const testResource of resources) {
        await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });
      }
      
      const totalTime = Date.now() - start;
      const throughput = resources.length / (totalTime / 1000);

      console.log(`  Batch throughput: ${throughput.toFixed(2)} resources/sec (${totalTime}ms for ${resources.length} resources)`);

      expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.minThroughputResourcesPerSec);
    });

    it('should maintain performance across multiple batches', async () => {
      const batchSize = 5;
      const numBatches = 3;
      const throughputs: number[] = [];

      for (let batch = 0; batch < numBatches; batch++) {
        const resources = testData.getSampleSet(batchSize);
        
        const start = Date.now();
        for (const testResource of resources) {
          await engine.validateResource({
            resource: testResource.content,
            resourceType: testResource.resourceType,
          });
        }
        const time = Date.now() - start;
        
        const throughput = resources.length / (time / 1000);
        throughputs.push(throughput);
      }

      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;

      console.log(`  Batch throughputs: ${throughputs.map(t => t.toFixed(2)).join(', ')} resources/sec`);
      console.log(`  Average: ${avgThroughput.toFixed(2)} resources/sec`);

      expect(avgThroughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.minThroughputResourcesPerSec);
    });
  });

  // ========================================================================
  // Cache Performance
  // ========================================================================

  describe('Cache Performance', () => {
    it('should achieve minimum cache hit rate', async () => {
      const resources = testData.getSampleSet(10);

      // Validate each resource twice to populate cache
      for (const testResource of resources) {
        await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });
        
        // Second validation (should hit cache)
        await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });
      }

      const baseline = baselineTracker.getCurrentBaseline();
      
      console.log(`  Cache hit rate: ${(baseline.cacheEffectiveness.hitRate * 100).toFixed(1)}%`);

      expect(baseline.cacheEffectiveness.hitRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.minCacheHitRate);
    });

    it('should show cache hit time significantly faster than miss', async () => {
      const baseline = baselineTracker.getCurrentBaseline();

      if (baseline.cacheEffectiveness.hitRate > 0) {
        const speedup = baseline.cacheEffectiveness.avgMissTimeMs / baseline.cacheEffectiveness.avgHitTimeMs;
        
        console.log(`  Hit time: ${baseline.cacheEffectiveness.avgHitTimeMs.toFixed(1)}ms`);
        console.log(`  Miss time: ${baseline.cacheEffectiveness.avgMissTimeMs.toFixed(1)}ms`);
        console.log(`  Speedup: ${speedup.toFixed(1)}x`);

        // Cache hits should be faster
        expect(baseline.cacheEffectiveness.avgHitTimeMs).toBeLessThan(
          baseline.cacheEffectiveness.avgMissTimeMs
        );
      }
    });
  });

  // ========================================================================
  // Baseline Performance Tests
  // ========================================================================

  describe('Baseline Performance Metrics', () => {
    it('should meet baseline warm cache threshold', async () => {
      // Run some validations to establish baseline
      const resources = testData.getSampleSet(5);
      
      for (const testResource of resources) {
        await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });
      }

      const baseline = baselineTracker.getCurrentBaseline();

      console.log('\n  Current Baseline:');
      console.log(`    Warm Cache: ${baseline.warmCacheTimeMs.toFixed(0)}ms`);
      console.log(`    Cold Start: ${baseline.coldStartTimeMs.toFixed(0)}ms`);
      console.log(`    Throughput: ${baseline.throughputResourcesPerSecond.toFixed(2)} res/sec`);
      console.log(`    Cache Hit Rate: ${(baseline.cacheEffectiveness.hitRate * 100).toFixed(1)}%`);

      expect(baseline.warmCacheTimeMs).toBeLessThan(PERFORMANCE_THRESHOLDS.warmCacheMaxMs);
    });

    it('should meet baseline throughput threshold', async () => {
      const baseline = baselineTracker.getCurrentBaseline();

      expect(baseline.throughputResourcesPerSecond).toBeGreaterThan(
        PERFORMANCE_THRESHOLDS.minThroughputResourcesPerSec
      );
    });
  });

  // ========================================================================
  // Performance Consistency Tests
  // ========================================================================

  describe('Performance Consistency', () => {
    it('should have consistent validation times', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (!patient) {
        return;
      }

      // Measure multiple validations
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
        });
        times.push(Date.now() - start);
      }

      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      const cv = (stdDev / mean) * 100; // Coefficient of variation

      console.log(`  Mean: ${mean.toFixed(1)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(1)}ms`);
      console.log(`  CV: ${cv.toFixed(1)}%`);

      // Coefficient of variation should be reasonable (<100%)
      expect(cv).toBeLessThan(100);
    });

    it('should not have performance outliers', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (!patient) {
        return;
      }

      // Measure multiple validations
      const times: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
        });
        times.push(Date.now() - start);
      }

      const sorted = [...times].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(times.length * 0.95)];
      const p99 = sorted[Math.floor(times.length * 0.99)];

      console.log(`  P95: ${p95}ms`);
      console.log(`  P99: ${p99}ms`);

      // P95 should be under threshold
      expect(p95).toBeLessThan(PERFORMANCE_THRESHOLDS.warmCacheMaxMs);
      
      // P99 should be under 2x threshold
      expect(p99).toBeLessThan(PERFORMANCE_THRESHOLDS.warmCacheMaxMs * 2);
    });
  });

  // ========================================================================
  // Resource Type Performance Tests
  // ========================================================================

  describe('Resource Type Performance', () => {
    it('should meet performance thresholds for all resource types', async () => {
      const resourceTypes = testData.getResourceTypes();

      for (const resourceType of resourceTypes) {
        const resources = testData.getValidResourcesByType(resourceType);
        
        if (resources.length > 0) {
          const times: number[] = [];
          
          for (const testResource of resources) {
            const start = Date.now();
            await engine.validateResource({
              resource: testResource.content,
              resourceType,
            });
            times.push(Date.now() - start);
          }

          const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
          
          console.log(`  ${resourceType}: ${avgTime.toFixed(0)}ms avg`);
          
          expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.singleResourceMaxMs);
        }
      }
    });
  });

  // ========================================================================
  // Performance Summary
  // ========================================================================

  describe('Performance Summary Report', () => {
    it('should generate performance summary passing all thresholds', async () => {
      // Run validations to populate metrics
      const resources = testData.getSampleSet(10);
      
      for (const testResource of resources) {
        await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });
      }

      const baseline = baselineTracker.getCurrentBaseline();

      const summary = {
        warmCache: {
          actual: baseline.warmCacheTimeMs,
          threshold: PERFORMANCE_THRESHOLDS.warmCacheMaxMs,
          passes: baseline.warmCacheTimeMs < PERFORMANCE_THRESHOLDS.warmCacheMaxMs,
        },
        coldStart: {
          actual: baseline.coldStartTimeMs,
          threshold: PERFORMANCE_THRESHOLDS.coldStartMaxMs,
          passes: baseline.coldStartTimeMs < PERFORMANCE_THRESHOLDS.coldStartMaxMs,
        },
        throughput: {
          actual: baseline.throughputResourcesPerSecond,
          threshold: PERFORMANCE_THRESHOLDS.minThroughputResourcesPerSec,
          passes: baseline.throughputResourcesPerSecond > PERFORMANCE_THRESHOLDS.minThroughputResourcesPerSec,
        },
        cacheHitRate: {
          actual: baseline.cacheEffectiveness.hitRate,
          threshold: PERFORMANCE_THRESHOLDS.minCacheHitRate,
          passes: baseline.cacheEffectiveness.hitRate > PERFORMANCE_THRESHOLDS.minCacheHitRate,
        },
      };

      console.log('\n  Performance Summary:');
      console.log(`    Warm Cache: ${summary.warmCache.actual.toFixed(0)}ms / ${summary.warmCache.threshold}ms ${summary.warmCache.passes ? '✓' : '✗'}`);
      console.log(`    Cold Start: ${summary.coldStart.actual.toFixed(0)}ms / ${summary.coldStart.threshold}ms ${summary.coldStart.passes ? '✓' : '✗'}`);
      console.log(`    Throughput: ${summary.throughput.actual.toFixed(2)} / ${summary.throughput.threshold} res/sec ${summary.throughput.passes ? '✓' : '✗'}`);
      console.log(`    Cache Hit Rate: ${(summary.cacheHitRate.actual * 100).toFixed(1)}% / ${(summary.cacheHitRate.threshold * 100).toFixed(1)}% ${summary.cacheHitRate.passes ? '✓' : '✗'}`);

      // All checks should pass
      expect(summary.warmCache.passes).toBe(true);
      expect(summary.coldStart.passes).toBe(true);
      expect(summary.throughput.passes).toBe(true);
      expect(summary.cacheHitRate.passes).toBe(true);
    });
  });
});

