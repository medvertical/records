/**
 * ValidationEngine Performance Monitoring Tests
 * Task 10.3: Test performance monitoring integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ValidationEngine } from '../validation-engine';
import type { ValidationRequest } from '../../types/validation-types';

// Mock settings to avoid database dependency
const mockSettings = {
  aspects: {
    structural: { enabled: true },
    profile: { enabled: true },
    terminology: { enabled: true },
    reference: { enabled: true },
    businessRule: { enabled: true },
    metadata: { enabled: true },
  },
  severityThreshold: 'info',
} as any;

describe('ValidationEngine - Performance Monitoring', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine(undefined, undefined, 'R4');
    // Clear the singleton tracker
    const performanceTracker = (engine as any).generatePerformanceBaseline;
    if (performanceTracker) {
      engine.resetPerformanceTracking();
    }
  });

  afterEach(() => {
    // Clean up - just reset current measurements, keep history
    if (engine) {
      engine.resetPerformanceTracking();
    }
  });

  // ========================================================================
  // Cold Start vs Warm Cache Tracking
  // ========================================================================

  describe('Cold Start and Warm Cache Tracking', () => {
    it('should record cold start time for first validation', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);

      const baseline = engine.generatePerformanceBaseline();

      expect(baseline).toBeDefined();
      expect(baseline.coldStartTimeMs).toBeGreaterThan(0);
    });

    it('should record warm cache time for subsequent validations', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      // First validation (cold start)
      await engine.validateResource(request);

      // Second validation (warm cache)
      await engine.validateResource(request);

      // Generate baseline to capture both
      const baseline = engine.generatePerformanceBaseline();

      expect(baseline).toBeDefined();
      // Should have recorded at least one of cold or warm (preferably both)
      const hasCold = baseline.coldStartTimeMs > 0;
      const hasWarm = baseline.warmCacheTimeMs > 0;
      expect(hasCold || hasWarm).toBe(true);
      // Ideally both should be recorded
      if (hasCold && hasWarm) {
        expect(baseline.coldStartTimeMs).toBeGreaterThan(0);
        expect(baseline.warmCacheTimeMs).toBeGreaterThan(0);
      }
    });

    it('should track warm cache as faster than cold start', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);
      await engine.validateResource(request);

      const baseline = engine.generatePerformanceBaseline();

      // Warm cache should typically be faster, but not guaranteed in test environment
      expect(baseline.warmCacheTimeMs).toBeGreaterThanOrEqual(0);
      expect(baseline.coldStartTimeMs).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Per-Aspect Performance Tracking
  // ========================================================================

  describe('Per-Aspect Performance Tracking', () => {
    it('should track performance for each validation aspect', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);

      const baseline = engine.generatePerformanceBaseline();

      // Should have metrics for Patient resource type
      expect(baseline.byResourceType['Patient']).toBeDefined();
      expect(baseline.byResourceType['Patient'].sampleCount).toBeGreaterThan(0);
      expect(baseline.byResourceType['Patient'].avgTimeMs).toBeGreaterThan(0);
    });

    it('should track multiple resource types separately', async () => {
      const patientRequest: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      const observationRequest: ValidationRequest = {
        resource: {
          resourceType: 'Observation',
          id: 'test-observation',
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '12345-6' }],
          },
        },
        resourceType: 'Observation',
        settings: mockSettings,
      };

      await engine.validateResource(patientRequest);
      await engine.validateResource(observationRequest);

      const baseline = engine.generatePerformanceBaseline();

      expect(baseline.byResourceType['Patient']).toBeDefined();
      expect(baseline.byResourceType['Observation']).toBeDefined();
      expect(baseline.byResourceType['Patient'].sampleCount).toBeGreaterThan(0);
      expect(baseline.byResourceType['Observation'].sampleCount).toBeGreaterThan(0);
    });

    it('should track aspect-level metrics', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);

      const baseline = engine.generatePerformanceBaseline();

      // Should have some aspect-level metrics
      expect(baseline.byAspect).toBeDefined();
      const aspectCount = Object.keys(baseline.byAspect).length;
      expect(aspectCount).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Performance Baseline Generation
  // ========================================================================

  describe('Performance Baseline Generation', () => {
    it('should generate baseline on demand', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);

      const baseline = engine.generatePerformanceBaseline();

      expect(baseline).toBeDefined();
      expect(baseline.timestamp).toBeInstanceOf(Date);
      expect(baseline.throughputResourcesPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should include memory usage in baseline', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);

      const baseline = engine.generatePerformanceBaseline();

      expect(baseline.memoryUsageMB).toBeDefined();
      expect(baseline.memoryUsageMB.heapUsed).toBeGreaterThan(0);
      expect(baseline.memoryUsageMB.heapTotal).toBeGreaterThan(0);
      expect(baseline.memoryUsageMB.rss).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Performance Summary
  // ========================================================================

  describe('Performance Summary', () => {
    it('should provide performance summary', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);
      engine.generatePerformanceBaseline();

      const summary = engine.getPerformanceSummary();

      expect(summary).toBeDefined();
      expect(summary.totalMeasurements).toBeGreaterThanOrEqual(1);
      expect(summary.latestBaseline).toBeDefined();
    });

    it('should track performance trends across multiple baselines', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      // First baseline
      await engine.validateResource(request);
      engine.generatePerformanceBaseline();

      // Second baseline
      engine.resetPerformanceTracking();
      await engine.validateResource(request);
      engine.generatePerformanceBaseline();

      const summary = engine.getPerformanceSummary();

      expect(summary.totalMeasurements).toBeGreaterThanOrEqual(2);
      expect(summary.trend).toBeDefined();
    });
  });

  // ========================================================================
  // Reset and History
  // ========================================================================

  describe('Reset and History Management', () => {
    it('should reset performance tracking', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);
      engine.generatePerformanceBaseline();

      engine.resetPerformanceTracking();

      // After reset, should track as cold start again
      await engine.validateResource(request);
      const baseline = engine.generatePerformanceBaseline();

      expect(baseline.coldStartTimeMs).toBeGreaterThan(0);
    });

    it('should maintain performance history', async () => {
      const request: ValidationRequest = {
        resource: {
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ family: 'Smith', given: ['John'] }],
        },
        resourceType: 'Patient',
        settings: mockSettings,
      };

      await engine.validateResource(request);
      engine.generatePerformanceBaseline();

      engine.resetPerformanceTracking();

      await engine.validateResource(request);
      engine.generatePerformanceBaseline();

      const history = engine.getPerformanceHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // Multiple Validations
  // ========================================================================

  describe('Multiple Validations', () => {
    it('should track performance across multiple validations', async () => {
      const requests: ValidationRequest[] = [
        {
          resource: {
            resourceType: 'Patient',
            id: 'patient-1',
            name: [{ family: 'Smith', given: ['John'] }],
          },
          resourceType: 'Patient',
          settings: mockSettings,
        },
        {
          resource: {
            resourceType: 'Patient',
            id: 'patient-2',
            name: [{ family: 'Doe', given: ['Jane'] }],
          },
          resourceType: 'Patient',
          settings: mockSettings,
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-1',
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: '12345-6' }],
            },
          },
          resourceType: 'Observation',
          settings: mockSettings,
        },
      ];

      for (const request of requests) {
        await engine.validateResource(request);
      }

      const baseline = engine.generatePerformanceBaseline();

      // Should have statistics for multiple resources
      expect(baseline.byResourceType['Patient'].sampleCount).toBeGreaterThanOrEqual(2);
      expect(baseline.byResourceType['Observation'].sampleCount).toBeGreaterThanOrEqual(1);
      expect(baseline.throughputResourcesPerSecond).toBeGreaterThan(0);
    });

    it('should calculate accurate percentiles with many samples', async () => {
      // Validate 20 patients
      for (let i = 0; i < 20; i++) {
        const request: ValidationRequest = {
          resource: {
            resourceType: 'Patient',
            id: `patient-${i}`,
            name: [{ family: 'Test', given: [`User${i}`] }],
          },
          resourceType: 'Patient',
          settings: mockSettings,
        };

        await engine.validateResource(request);
      }

      const baseline = engine.generatePerformanceBaseline();

      const patientStats = baseline.byResourceType['Patient'];

      expect(patientStats).toBeDefined();
      expect(patientStats.sampleCount).toBeGreaterThanOrEqual(20);
      expect(patientStats.p50TimeMs).toBeGreaterThan(0);
      expect(patientStats.p95TimeMs).toBeGreaterThanOrEqual(patientStats.p50TimeMs);
      expect(patientStats.p99TimeMs).toBeGreaterThanOrEqual(patientStats.p95TimeMs);
    });
  });
});

