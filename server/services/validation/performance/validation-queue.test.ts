/**
 * Validation Queue Service Integration Tests
 * 
 * Tests for pause/resume controls, priority handling, and basic queue functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock dependencies
vi.mock('../../../db', () => ({ db: {} }));

class MockSettingsService extends EventEmitter {
  async getCurrentSettings() {
    return {
      aspects: {
        structural: { enabled: true, severity: 'error' as const },
        profile: { enabled: true, severity: 'warning' as const }
      }
    };
  }
}

vi.mock('../settings/validation-settings-service', () => ({
  getValidationSettingsService: () => new MockSettingsService()
}));

vi.mock('../core/validation-pipeline', () => ({
  getValidationPipeline: () => ({
    executePipeline: vi.fn().mockResolvedValue({
      success: true,
      aspects: []
    })
  })
}));

import { getValidationQueueService, ValidationPriority } from './validation-queue-service';

describe('Validation Queue - Core Functionality', () => {
  let queueService: ReturnType<typeof getValidationQueueService>;

  beforeEach(() => {
    queueService = getValidationQueueService({
      maxConcurrentValidations: 2,
      maxQueueSize: 100,
      retryAttempts: 2,
      retryDelayMs: 100,
      processingIntervalMs: 50,
      enablePriorityProcessing: true,
      enableRetryMechanism: true
    });
  });

  afterEach(() => {
    if (queueService) {
      queueService.stopProcessing();
    }
  });

  describe('Queue Statistics', () => {
    it('should return initial empty statistics', () => {
      const stats = queueService.getStats();
      
      expect(stats.totalItems).toBe(0);
      expect(stats.queuedItems).toBe(0);
      expect(stats.processingItems).toBe(0);
      expect(stats.completedItems).toBe(0);
      expect(stats.failedItems).toBe(0);
      expect(stats.cancelledItems).toBe(0);
    });

    it('should track queued items', async () => {
      await queueService.queueValidation(
        {
          serverId: 1,
          resourceType: 'Patient',
          fhirId: 'test-1',
          resource: { resourceType: 'Patient', id: 'test-1' },
          requestedAspects: ['structural'],
          settings: {
            aspects: {
              structural: { enabled: true, severity: 'error' }
            }
          } as any
        },
        {
          requestedBy: 'test',
          requestId: 'req-1',
          priority: ValidationPriority.NORMAL
        }
      );

      const stats = queueService.getStats();
      expect(stats.totalItems).toBe(1);
      expect(stats.queuedItems).toBe(1);
    });
  });

  describe('Pause and Resume Controls', () => {
    it('should start processing without errors', () => {
      expect(() => queueService.startProcessing()).not.toThrow();
    });

    it('should pause processing without errors', () => {
      queueService.startProcessing();
      expect(() => queueService.pauseProcessing()).not.toThrow();
    });

    it('should resume processing without errors', () => {
      queueService.startProcessing();
      queueService.pauseProcessing();
      expect(() => queueService.resumeProcessing()).not.toThrow();
    });

    it('should stop processing without errors', () => {
      queueService.startProcessing();
      expect(() => queueService.stopProcessing()).not.toThrow();
    });
  });

  describe('Priority Processing', () => {
    it('should queue items with different priorities', async () => {
      // Clear any existing items from singleton
      queueService.clearCompletedItems();
      
      // Add high priority item
      await queueService.queueValidation(
        {
          serverId: 1,
          resourceType: 'Patient',
          fhirId: 'high-priority',
          resource: { resourceType: 'Patient', id: 'high-priority' },
          requestedAspects: ['structural'],
          settings: {
            aspects: {
              structural: { enabled: true, severity: 'error' }
            }
          } as any
        },
        {
          requestedBy: 'test',
          requestId: 'req-high',
          priority: ValidationPriority.HIGH
        }
      );

      // Add normal priority item
      await queueService.queueValidation(
        {
          serverId: 1,
          resourceType: 'Patient',
          fhirId: 'normal-priority',
          resource: { resourceType: 'Patient', id: 'normal-priority' },
          requestedAspects: ['structural'],
          settings: {
            aspects: {
              structural: { enabled: true, severity: 'error' }
            }
          } as any
        },
        {
          requestedBy: 'test',
          requestId: 'req-normal',
          priority: ValidationPriority.NORMAL
        }
      );

      const stats = queueService.getStats();
      expect(stats.totalItems).toBeGreaterThanOrEqual(2);
      expect(stats.queuedItems).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Cancel Operations', () => {
    it('should cancel a validation item', async () => {
      const itemId = await queueService.queueValidation(
        {
          serverId: 1,
          resourceType: 'Patient',
          fhirId: 'cancel-test',
          resource: { resourceType: 'Patient', id: 'cancel-test' },
          requestedAspects: ['structural'],
          settings: {
            aspects: {
              structural: { enabled: true, severity: 'error' }
            }
          } as any
        },
        {
          requestedBy: 'test',
          requestId: 'req-cancel'
        }
      );

      const cancelled = queueService.cancelValidation(itemId);
      expect(cancelled).toBe(true);

      const stats = queueService.getStats();
      expect(stats.cancelledItems).toBe(1);
    });

    it('should cancel batch validations', async () => {
      const batchId = 'batch-123';
      
      // Queue multiple items with same batchId
      await queueService.queueValidation(
        {
          serverId: 1,
          resourceType: 'Patient',
          fhirId: 'batch-1',
          resource: { resourceType: 'Patient', id: 'batch-1' },
          requestedAspects: ['structural'],
          settings: {
            aspects: {
              structural: { enabled: true, severity: 'error' }
            }
          } as any
        },
        {
          requestedBy: 'test',
          requestId: 'req-batch-1',
          batchId
        }
      );

      await queueService.queueValidation(
        {
          serverId: 1,
          resourceType: 'Patient',
          fhirId: 'batch-2',
          resource: { resourceType: 'Patient', id: 'batch-2' },
          requestedAspects: ['structural'],
          settings: {
            aspects: {
              structural: { enabled: true, severity: 'error' }
            }
          } as any
        },
        {
          requestedBy: 'test',
          requestId: 'req-batch-2',
          batchId
        }
      );

      const cancelledCount = queueService.cancelBatch(batchId);
      expect(cancelledCount).toBe(2);
    });
  });

  describe('Event Emissions', () => {
    it('should emit processing state events', async () => {
      const events: string[] = [];

      queueService.on('processingStarted', () => {
        events.push('started');
      });

      queueService.on('processingPaused', () => {
        events.push('paused');
      });

      queueService.on('processingResumed', () => {
        events.push('resumed');
      });

      queueService.on('processingStopped', () => {
        events.push('stopped');
      });

      // Trigger state changes
      queueService.startProcessing();
      queueService.pauseProcessing();
      queueService.resumeProcessing();
      queueService.stopProcessing();

      // Wait a bit for events to emit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify all events were emitted
      expect(events).toContain('started');
      expect(events).toContain('paused');
      expect(events).toContain('resumed');
      expect(events).toContain('stopped');
    });
  });
});
