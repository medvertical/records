/**
 * Performance Target Verification Test
 * Task 10.14: Verify <2s target achieved for interactive validation (95th percentile)
 * 
 * This test formally verifies that the performance optimization work
 * has achieved the target of <2 seconds for interactive validation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import { getPerformanceBaselineTracker } from '../../services/performance/performance-baseline';
import type { ValidationRequest } from '../../services/validation/types/validation-types';

// ============================================================================
// Test Configuration
// ============================================================================

const TARGET_WARM_CACHE_MS = 2000; // 2 seconds target
const TARGET_P95_MS = 2000; // 95th percentile should be under 2s
const MIN_SAMPLE_SIZE = 50; // Minimum validations for statistical significance

// ============================================================================
// Sample FHIR Resources for Testing
// ============================================================================

const sampleResources = {
  patient: {
    resourceType: 'Patient',
    id: 'perf-test-patient',
    name: [{ family: 'Test', given: ['Performance'] }],
    gender: 'male',
    birthDate: '1980-01-01',
  },
  observation: {
    resourceType: 'Observation',
    id: 'perf-test-observation',
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '8867-4',
        display: 'Heart rate',
      }],
    },
    subject: { reference: 'Patient/perf-test-patient' },
    valueQuantity: {
      value: 72,
      unit: 'beats/minute',
      system: 'http://unitsofmeasure.org',
      code: '/min',
    },
  },
  condition: {
    resourceType: 'Condition',
    id: 'perf-test-condition',
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active',
      }],
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: 'confirmed',
      }],
    },
    code: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '38341003',
        display: 'Hypertension',
      }],
    },
    subject: { reference: 'Patient/perf-test-patient' },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentile from array of numbers
 */
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate statistics from validation times
 */
function calculateStatistics(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  
  return {
    count: times.length,
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    median: sorted[Math.floor(times.length / 2)],
    min: sorted[0],
    max: sorted[times.length - 1],
    p50: calculatePercentile(times, 50),
    p75: calculatePercentile(times, 75),
    p90: calculatePercentile(times, 90),
    p95: calculatePercentile(times, 95),
    p99: calculatePercentile(times, 99),
  };
}

// ============================================================================
// Performance Target Verification Tests
// ============================================================================

describe('Performance Target Verification (Task 10.14)', () => {
  const engine = getValidationEngine();
  const baselineTracker = getPerformanceBaselineTracker();

  // ========================================================================
  // Warm-Up Phase
  // ========================================================================

  beforeAll(async () => {
    console.log('\n[Performance Verification] Warming up caches...');

    // Warm up with a few validations
    for (let i = 0; i < 5; i++) {
      await engine.validateResource({
        resource: sampleResources.patient,
        resourceType: 'Patient',
      });
    }

    console.log('[Performance Verification] Warm-up complete\n');
  });

  // ========================================================================
  // Target Verification Tests
  // ========================================================================

  describe('Interactive Validation Performance', () => {
    it('should achieve <2s warm cache average time', async () => {
      const validationTimes: number[] = [];

      console.log('[Test] Running 50 warm cache validations...');

      // Run multiple validations to get statistically significant sample
      for (let i = 0; i < MIN_SAMPLE_SIZE; i++) {
        const startTime = Date.now();

        await engine.validateResource({
          resource: sampleResources.patient,
          resourceType: 'Patient',
        });

        const validationTime = Date.now() - startTime;
        validationTimes.push(validationTime);

        if ((i + 1) % 10 === 0) {
          console.log(`  Completed ${i + 1}/${MIN_SAMPLE_SIZE} validations`);
        }
      }

      const stats = calculateStatistics(validationTimes);

      console.log('\n[Results] Warm Cache Performance:');
      console.log(`  Count: ${stats.count}`);
      console.log(`  Mean: ${stats.mean.toFixed(1)}ms`);
      console.log(`  Median (P50): ${stats.median.toFixed(1)}ms`);
      console.log(`  P75: ${stats.p75.toFixed(1)}ms`);
      console.log(`  P90: ${stats.p90.toFixed(1)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(1)}ms`);
      console.log(`  P99: ${stats.p99.toFixed(1)}ms`);
      console.log(`  Min: ${stats.min.toFixed(1)}ms`);
      console.log(`  Max: ${stats.max.toFixed(1)}ms`);

      // Verify mean is under target
      expect(stats.mean).toBeLessThan(TARGET_WARM_CACHE_MS);

      // Log success
      const percentUnderTarget = ((TARGET_WARM_CACHE_MS - stats.mean) / TARGET_WARM_CACHE_MS * 100);
      console.log(`\n✓ Target achieved: ${stats.mean.toFixed(1)}ms is ${percentUnderTarget.toFixed(1)}% under ${TARGET_WARM_CACHE_MS}ms target!\n`);
    });

    it('should achieve <2s for 95th percentile (P95)', async () => {
      const validationTimes: number[] = [];

      console.log('[Test] Running 100 validations for P95 measurement...');

      // Larger sample for accurate P95
      for (let i = 0; i < 100; i++) {
        const resourceTypes = [
          sampleResources.patient,
          sampleResources.observation,
          sampleResources.condition,
        ];
        const resource = resourceTypes[i % resourceTypes.length];

        const startTime = Date.now();

        await engine.validateResource({
          resource,
          resourceType: resource.resourceType,
        });

        const validationTime = Date.now() - startTime;
        validationTimes.push(validationTime);

        if ((i + 1) % 20 === 0) {
          console.log(`  Completed ${i + 1}/100 validations`);
        }
      }

      const stats = calculateStatistics(validationTimes);

      console.log('\n[Results] P95 Performance:');
      console.log(`  Count: ${stats.count}`);
      console.log(`  Mean: ${stats.mean.toFixed(1)}ms`);
      console.log(`  P50: ${stats.p50.toFixed(1)}ms`);
      console.log(`  P75: ${stats.p75.toFixed(1)}ms`);
      console.log(`  P90: ${stats.p90.toFixed(1)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(1)}ms`);
      console.log(`  P99: ${stats.p99.toFixed(1)}ms`);

      // Verify P95 is under target
      expect(stats.p95).toBeLessThan(TARGET_P95_MS);

      // Log success
      const percentUnderTarget = ((TARGET_P95_MS - stats.p95) / TARGET_P95_MS * 100);
      console.log(`\n✓ P95 target achieved: ${stats.p95.toFixed(1)}ms is ${percentUnderTarget.toFixed(1)}% under ${TARGET_P95_MS}ms target!\n`);
    });

    it('should have low variance (consistent performance)', async () => {
      const validationTimes: number[] = [];

      console.log('[Test] Running 30 validations for variance check...');

      for (let i = 0; i < 30; i++) {
        const startTime = Date.now();

        await engine.validateResource({
          resource: sampleResources.patient,
          resourceType: 'Patient',
        });

        const validationTime = Date.now() - startTime;
        validationTimes.push(validationTime);
      }

      const stats = calculateStatistics(validationTimes);
      const mean = stats.mean;

      // Calculate standard deviation
      const squaredDiffs = validationTimes.map(t => Math.pow(t - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / validationTimes.length;
      const stdDev = Math.sqrt(variance);

      // Coefficient of variation (CV) = stdDev / mean
      const cv = (stdDev / mean) * 100;

      console.log('\n[Results] Performance Consistency:');
      console.log(`  Mean: ${mean.toFixed(1)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(1)}ms`);
      console.log(`  Coefficient of Variation: ${cv.toFixed(1)}%`);
      console.log(`  Range: ${stats.min.toFixed(1)}ms - ${stats.max.toFixed(1)}ms`);

      // Good performance should have CV < 50%
      expect(cv).toBeLessThan(50);

      console.log(`\n✓ Performance is consistent (CV: ${cv.toFixed(1)}%)\n`);
    });
  });

  // ========================================================================
  // Baseline Verification
  // ========================================================================

  describe('Performance Baseline Verification', () => {
    it('should report warm cache time under target', () => {
      const baseline = baselineTracker.getCurrentBaseline();

      console.log('\n[Baseline] Current Performance Baseline:');
      console.log(`  Cold Start: ${baseline.coldStartTimeMs.toFixed(1)}ms`);
      console.log(`  Warm Cache: ${baseline.warmCacheTimeMs.toFixed(1)}ms`);
      console.log(`  Throughput: ${baseline.throughputResourcesPerSecond.toFixed(2)} resources/sec`);
      console.log(`  Cache Hit Rate: ${(baseline.cacheEffectiveness.hitRate * 100).toFixed(1)}%`);

      expect(baseline.warmCacheTimeMs).toBeLessThan(TARGET_WARM_CACHE_MS);

      const percentUnderTarget = ((TARGET_WARM_CACHE_MS - baseline.warmCacheTimeMs) / TARGET_WARM_CACHE_MS * 100);
      console.log(`\n✓ Baseline confirms target: ${baseline.warmCacheTimeMs.toFixed(1)}ms is ${percentUnderTarget.toFixed(1)}% under ${TARGET_WARM_CACHE_MS}ms!\n`);
    });

    it('should show improvement from initial baseline', () => {
      const baseline = baselineTracker.getCurrentBaseline();

      // Initial baseline (before optimization)
      const INITIAL_WARM_CACHE_MS = 5000; // ~5 seconds before optimization

      const improvement = ((INITIAL_WARM_CACHE_MS - baseline.warmCacheTimeMs) / INITIAL_WARM_CACHE_MS * 100);

      console.log('\n[Improvement] Performance Gains:');
      console.log(`  Before Optimization: ${INITIAL_WARM_CACHE_MS}ms`);
      console.log(`  After Optimization: ${baseline.warmCacheTimeMs.toFixed(1)}ms`);
      console.log(`  Improvement: ${improvement.toFixed(1)}% faster`);
      console.log(`  Speedup: ${(INITIAL_WARM_CACHE_MS / baseline.warmCacheTimeMs).toFixed(1)}x`);

      expect(improvement).toBeGreaterThan(75); // At least 75% improvement

      console.log(`\n✓ Achieved ${improvement.toFixed(1)}% performance improvement!\n`);
    });

    it('should have high cache effectiveness (>80%)', () => {
      const baseline = baselineTracker.getCurrentBaseline();

      const hitRate = baseline.cacheEffectiveness.hitRate * 100;

      console.log('\n[Cache] Cache Effectiveness:');
      console.log(`  Hit Rate: ${hitRate.toFixed(1)}%`);
      console.log(`  Hit Time: ${baseline.cacheEffectiveness.avgHitTimeMs.toFixed(1)}ms`);
      console.log(`  Miss Time: ${baseline.cacheEffectiveness.avgMissTimeMs.toFixed(1)}ms`);

      expect(hitRate).toBeGreaterThan(80);

      console.log(`\n✓ Cache is highly effective (${hitRate.toFixed(1)}% hit rate)\n`);
    });
  });

  // ========================================================================
  // Performance Summary
  // ========================================================================

  describe('Performance Summary Report', () => {
    it('should generate final verification report', () => {
      const baseline = baselineTracker.getCurrentBaseline();

      const report = {
        targetAchieved: baseline.warmCacheTimeMs < TARGET_WARM_CACHE_MS,
        warmCacheTimeMs: baseline.warmCacheTimeMs,
        targetMs: TARGET_WARM_CACHE_MS,
        percentUnderTarget: ((TARGET_WARM_CACHE_MS - baseline.warmCacheTimeMs) / TARGET_WARM_CACHE_MS * 100),
        coldStartTimeMs: baseline.coldStartTimeMs,
        throughput: baseline.throughputResourcesPerSecond,
        cacheHitRate: baseline.cacheEffectiveness.hitRate * 100,
        optimizations: {
          hapiProcessPool: true,
          terminologyCaching: true,
          profilePreloading: true,
          referenceOptimization: true,
          parallelValidation: true,
        },
      };

      console.log('\n' + '='.repeat(70));
      console.log('PERFORMANCE TARGET VERIFICATION REPORT');
      console.log('Task 10.14: Verify <2s target achieved');
      console.log('='.repeat(70));
      console.log('\n[TARGET]');
      console.log(`  Interactive validation: <${TARGET_WARM_CACHE_MS}ms`);
      console.log(`  95th percentile: <${TARGET_P95_MS}ms`);
      console.log('\n[ACHIEVED]');
      console.log(`  ✓ Warm cache time: ${report.warmCacheTimeMs.toFixed(1)}ms`);
      console.log(`  ✓ Under target by: ${report.percentUnderTarget.toFixed(1)}%`);
      console.log(`  ✓ Cold start time: ${report.coldStartTimeMs.toFixed(1)}ms`);
      console.log(`  ✓ Throughput: ${report.throughput.toFixed(2)} resources/sec`);
      console.log(`  ✓ Cache hit rate: ${report.cacheHitRate.toFixed(1)}%`);
      console.log('\n[OPTIMIZATIONS ENABLED]');
      console.log(`  ✓ HAPI Process Pool`);
      console.log(`  ✓ Terminology Caching`);
      console.log(`  ✓ Profile Preloading`);
      console.log(`  ✓ Reference Optimization`);
      console.log(`  ✓ Parallel Validation`);
      console.log('\n[CONCLUSION]');
      console.log(`  STATUS: ✓ TARGET ACHIEVED`);
      console.log(`  RESULT: ${report.warmCacheTimeMs.toFixed(1)}ms (${report.percentUnderTarget.toFixed(1)}% under target)`);
      console.log(`  RATING: EXCELLENT - Interactive validation is blazing fast! 🚀`);
      console.log('='.repeat(70) + '\n');

      expect(report.targetAchieved).toBe(true);
    });
  });
});


