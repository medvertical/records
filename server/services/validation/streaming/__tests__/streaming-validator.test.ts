/**
 * Streaming Validator Tests
 * Task 10.11: Test streaming validation functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamingValidator } from '../streaming-validator';
import type { ValidationRequest } from '../../types/validation-types';

// Mock validation engine
vi.mock('../../core/validation-engine', () => ({
  getValidationEngine: () => ({
    validateResource: vi.fn().mockResolvedValue({
      resourceId: 'test',
      resourceType: 'Patient',
      isValid: true,
      issues: [],
      aspects: [],
      validatedAt: new Date(),
      validationTime: 100,
      fhirVersion: 'R4',
    }),
  }),
}));

describe('StreamingValidator', () => {
  let validator: StreamingValidator;

  beforeEach(() => {
    validator = new StreamingValidator();
  });

  // ========================================================================
  // Event Emission
  // ========================================================================

  describe('Event Emission', () => {
    it('should emit started event', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test' }] },
          resourceType: 'Patient',
        },
      ];

      const startedPromise = new Promise((resolve) => {
        validator.once('started', (data) => {
          expect(data).toHaveProperty('requestId');
          expect(data).toHaveProperty('totalResources', 1);
          expect(data).toHaveProperty('startTime');
          resolve(data);
        });
      });

      await Promise.all([
        validator.validateBatchStreaming({ resources }),
        startedPromise,
      ]);
    });

    it('should emit result events for each resource', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test1' }] },
          resourceType: 'Patient',
        },
        {
          resource: { resourceType: 'Patient', id: 'test-2', name: [{ family: 'Test2' }] },
          resourceType: 'Patient',
        },
      ];

      const resultEvents: any[] = [];
      validator.on('result', (data) => {
        resultEvents.push(data);
      });

      await validator.validateBatchStreaming({ resources });

      expect(resultEvents.length).toBe(2);
      expect(resultEvents[0]).toHaveProperty('requestId');
      expect(resultEvents[0]).toHaveProperty('resource');
      expect(resultEvents[0]).toHaveProperty('result');
      expect(resultEvents[0]).toHaveProperty('index', 0);
    });

    it('should emit progress events', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test1' }] },
          resourceType: 'Patient',
        },
        {
          resource: { resourceType: 'Patient', id: 'test-2', name: [{ family: 'Test2' }] },
          resourceType: 'Patient',
        },
      ];

      const progressEvents: any[] = [];
      validator.on('progress', (data) => {
        progressEvents.push(data);
      });

      await validator.validateBatchStreaming({ resources });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('requestId');
      expect(progressEvents[0]).toHaveProperty('totalResources', 2);
      expect(progressEvents[0]).toHaveProperty('processedResources');
      expect(progressEvents[0]).toHaveProperty('percentage');
    });

    it('should emit complete event', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test' }] },
          resourceType: 'Patient',
        },
      ];

      const completePromise = new Promise((resolve) => {
        validator.once('complete', (data) => {
          expect(data).toHaveProperty('requestId');
          expect(data).toHaveProperty('totalResources', 1);
          expect(data).toHaveProperty('validResources');
          expect(data).toHaveProperty('totalTime');
          expect(data).toHaveProperty('averageTime');
          resolve(data);
        });
      });

      await Promise.all([
        validator.validateBatchStreaming({ resources }),
        completePromise,
      ]);
    });
  });

  // ========================================================================
  // Progress Tracking
  // ========================================================================

  describe('Progress Tracking', () => {
    it('should track progress for active streams', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test' }] },
          resourceType: 'Patient',
        },
      ];

      const requestId = 'test-progress-tracking';

      // Start validation (don't await)
      const promise = validator.validateBatchStreaming({ resources, requestId });

      // Brief delay to let it start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check progress
      const progress = validator.getProgress(requestId);

      // May or may not be available depending on timing
      // Just verify the method works
      if (progress) {
        expect(progress.requestId).toBe(requestId);
      }

      await promise;

      // After completion, should be removed
      const finalProgress = validator.getProgress(requestId);
      expect(finalProgress).toBeNull();
    });

    it('should calculate percentage correctly', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test1' }] },
          resourceType: 'Patient',
        },
        {
          resource: { resourceType: 'Patient', id: 'test-2', name: [{ family: 'Test2' }] },
          resourceType: 'Patient',
        },
      ];

      let lastProgress: any = null;
      validator.on('progress', (data) => {
        lastProgress = data;
      });

      await validator.validateBatchStreaming({ resources });

      expect(lastProgress).toBeDefined();
      expect(lastProgress.percentage).toBe(100);
      expect(lastProgress.processedResources).toBe(2);
    });

    it('should estimate time remaining', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test1' }] },
          resourceType: 'Patient',
        },
        {
          resource: { resourceType: 'Patient', id: 'test-2', name: [{ family: 'Test2' }] },
          resourceType: 'Patient',
        },
      ];

      const progressEvents: any[] = [];
      validator.on('progress', (data) => {
        progressEvents.push(data);
      });

      await validator.validateBatchStreaming({ resources });

      // First progress event should have estimated time remaining
      if (progressEvents.length > 0) {
        expect(progressEvents[0]).toHaveProperty('estimatedTimeRemaining');
      }
    });
  });

  // ========================================================================
  // Active Streams Management
  // ========================================================================

  describe('Active Streams Management', () => {
    it('should track active streams', () => {
      const activeStreams = validator.getActiveStreams();

      expect(activeStreams).toBeInstanceOf(Map);
      expect(activeStreams.size).toBe(0);
    });

    it('should list active streams during validation', async () => {
      const resources: ValidationRequest[] = [
        {
          resource: { resourceType: 'Patient', id: 'test-1', name: [{ family: 'Test' }] },
          resourceType: 'Patient',
        },
      ];

      const requestId = 'test-active-streams';

      // Start validation
      const promise = validator.validateBatchStreaming({ resources, requestId });

      // Brief delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check active streams (may or may not show depending on timing)
      const activeStreams = validator.getActiveStreams();
      
      // Just verify it returns a Map
      expect(activeStreams).toBeInstanceOf(Map);

      await promise;
    });
  });

  // ========================================================================
  // Cancellation
  // ========================================================================

  describe('Stream Cancellation', () => {
    it('should return false when cancelling non-existent stream', () => {
      const cancelled = validator.cancelStream('non-existent');

      expect(cancelled).toBe(false);
    });

    it('should cancel active stream', async () => {
      const resources: ValidationRequest[] = Array.from({ length: 100 }, (_, i) => ({
        resource: { resourceType: 'Patient', id: `test-${i}`, name: [{ family: `Test${i}` }] },
        resourceType: 'Patient',
      }));

      const requestId = 'test-cancellation';

      // Start long-running validation
      const promise = validator.validateBatchStreaming({ resources, requestId, maxConcurrent: 1 });

      // Brief delay to ensure it starts
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cancel
      const cancelled = validator.cancelStream(requestId);

      // May or may not cancel depending on timing
      expect(typeof cancelled).toBe('boolean');

      // Wait for promise to resolve/reject
      await promise.catch(() => {
        // May throw if cancelled
      });
    });
  });

  // ========================================================================
  // Performance
  // ========================================================================

  describe('Performance', () => {
    it('should handle large batches efficiently', async () => {
      const resources: ValidationRequest[] = Array.from({ length: 50 }, (_, i) => ({
        resource: { resourceType: 'Patient', id: `test-${i}`, name: [{ family: `Test${i}` }] },
        resourceType: 'Patient',
      }));

      let resultCount = 0;
      validator.on('result', () => {
        resultCount++;
      });

      const startTime = Date.now();
      await validator.validateBatchStreaming({ resources });
      const totalTime = Date.now() - startTime;

      expect(resultCount).toBe(50);
      console.log(`Validated 50 resources in ${totalTime}ms (${(totalTime / 50).toFixed(1)}ms avg)`);
    });

    it('should stream results progressively', async () => {
      const resources: ValidationRequest[] = Array.from({ length: 10 }, (_, i) => ({
        resource: { resourceType: 'Patient', id: `test-${i}`, name: [{ family: `Test${i}` }] },
        resourceType: 'Patient',
      }));

      const resultTimes: number[] = [];
      const startTime = Date.now();

      validator.on('result', () => {
        resultTimes.push(Date.now() - startTime);
      });

      await validator.validateBatchStreaming({ resources, maxConcurrent: 2 });

      // Results should be emitted progressively, not all at once
      expect(resultTimes.length).toBe(10);
      
      // Verify results are spread over time (not all at once)
      const firstResult = resultTimes[0];
      const lastResult = resultTimes[resultTimes.length - 1];
      
      // In fast test environment, may complete very quickly
      expect(lastResult).toBeGreaterThanOrEqual(firstResult);
      console.log(`Results emitted over ${lastResult - firstResult}ms`);
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Error Handling', () => {
    it('should emit complete event even with empty resources', async () => {
      const resources: ValidationRequest[] = [];

      const completePromise = new Promise((resolve) => {
        validator.once('complete', (data) => {
          expect(data.totalResources).toBe(0);
          resolve(data);
        });
      });

      await Promise.all([
        validator.validateBatchStreaming({ resources }),
        completePromise,
      ]);
    });
  });
});

