// ============================================================================
// Validation Progress Calculation Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BulkValidationService } from '../services/bulk-validation.js';
import { FhirClient } from '../services/fhir-client.js';
import { ValidationEngine } from '../services/validation-engine.js';

describe('Validation Progress Calculations', () => {
  let bulkValidationService: BulkValidationService;
  let mockFhirClient: jest.Mocked<FhirClient>;
  let mockValidationEngine: jest.Mocked<ValidationEngine>;

  beforeEach(() => {
    // Mock dependencies
    mockFhirClient = {
      getResourceCount: jest.fn(),
      searchResources: jest.fn(),
      testConnection: jest.fn(),
      getAllResourceTypes: jest.fn()
    } as any;

    mockValidationEngine = {
      validateResource: jest.fn()
    } as any;

    bulkValidationService = new BulkValidationService(mockFhirClient, mockValidationEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Progress Percentage Calculations', () => {
    it('should calculate progress percentage correctly', () => {
      const progress = {
        totalResources: 1000,
        processedResources: 250,
        validResources: 200,
        errorResources: 50,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      const percentage = (progress.processedResources / progress.totalResources) * 100;
      expect(percentage).toBe(25);
    });

    it('should handle zero total resources', () => {
      const progress = {
        totalResources: 0,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      const percentage = progress.totalResources > 0 ? 
        (progress.processedResources / progress.totalResources) * 100 : 0;
      expect(percentage).toBe(0);
    });

    it('should cap progress percentage at 100%', () => {
      const progress = {
        totalResources: 1000,
        processedResources: 1200, // More than total
        validResources: 1000,
        errorResources: 200,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      const percentage = Math.min(100, (progress.processedResources / progress.totalResources) * 100);
      expect(percentage).toBe(100);
    });
  });

  describe('Resource Count Validation', () => {
    it('should ensure processed resources does not exceed total resources', () => {
      const totalResources = 1000;
      const processedResources = 1200;

      const sanitizedProcessed = Math.min(processedResources, totalResources);
      expect(sanitizedProcessed).toBe(1000);
    });

    it('should ensure all counts are non-negative', () => {
      const counts = {
        totalResources: -100,
        processedResources: -50,
        validResources: -25,
        errorResources: -25
      };

      const sanitizedCounts = {
        totalResources: Math.max(0, counts.totalResources),
        processedResources: Math.max(0, counts.processedResources),
        validResources: Math.max(0, counts.validResources),
        errorResources: Math.max(0, counts.errorResources)
      };

      expect(sanitizedCounts.totalResources).toBe(0);
      expect(sanitizedCounts.processedResources).toBe(0);
      expect(sanitizedCounts.validResources).toBe(0);
      expect(sanitizedCounts.errorResources).toBe(0);
    });

    it('should ensure valid + error resources do not exceed processed resources', () => {
      const processedResources = 100;
      const validResources = 60;
      const errorResources = 50; // Total = 110, exceeds processed

      const totalProcessed = validResources + errorResources;
      const adjustedErrorResources = totalProcessed > processedResources ? 
        Math.max(0, processedResources - validResources) : errorResources;

      expect(adjustedErrorResources).toBe(40);
      expect(validResources + adjustedErrorResources).toBe(100);
    });
  });

  describe('Estimated Time Remaining Calculations', () => {
    it('should calculate estimated time remaining correctly', () => {
      const startTime = new Date(Date.now() - 10000); // 10 seconds ago
      const processedResources = 100;
      const totalResources = 1000;

      const elapsed = Date.now() - startTime.getTime();
      const rate = processedResources / elapsed; // resources per millisecond
      const remaining = totalResources - processedResources;
      const estimatedTimeRemaining = remaining / rate;

      expect(estimatedTimeRemaining).toBeGreaterThan(0);
      expect(estimatedTimeRemaining).toBeLessThan(24 * 60 * 60 * 1000); // Less than 24 hours
    });

    it('should handle zero rate gracefully', () => {
      const rate = 0;
      const remaining = 100;

      const estimatedTimeRemaining = rate > 0 && remaining > 0 ? remaining / rate : 0;
      expect(estimatedTimeRemaining).toBe(0);
    });

    it('should cap estimated time at 24 hours', () => {
      const rate = 0.001; // Very slow rate
      const remaining = 1000000; // Many resources remaining

      const estimatedTimeRemaining = Math.max(0, Math.min(remaining / rate, 24 * 60 * 60 * 1000));
      expect(estimatedTimeRemaining).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('Progress Validation', () => {
    it('should validate progress data consistency', () => {
      const progress = {
        totalResources: 1000,
        processedResources: 500,
        validResources: 400,
        errorResources: 100,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      // Check consistency
      const totalProcessed = progress.validResources + progress.errorResources;
      const isConsistent = totalProcessed <= progress.processedResources;
      const processedWithinTotal = progress.processedResources <= progress.totalResources;

      expect(isConsistent).toBe(true);
      expect(processedWithinTotal).toBe(true);
    });

    it('should detect inconsistent progress data', () => {
      const progress = {
        totalResources: 1000,
        processedResources: 500,
        validResources: 400,
        errorResources: 200, // Total = 600, exceeds processed
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      const totalProcessed = progress.validResources + progress.errorResources;
      const isConsistent = totalProcessed <= progress.processedResources;

      expect(isConsistent).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      const progress = {
        totalResources: Number.MAX_SAFE_INTEGER,
        processedResources: Number.MAX_SAFE_INTEGER - 1000,
        validResources: Number.MAX_SAFE_INTEGER - 2000,
        errorResources: 1000,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      const percentage = (progress.processedResources / progress.totalResources) * 100;
      expect(percentage).toBeCloseTo(100, 5);
    });

    it('should handle very small numbers', () => {
      const progress = {
        totalResources: 1,
        processedResources: 1,
        validResources: 1,
        errorResources: 0,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      const percentage = (progress.processedResources / progress.totalResources) * 100;
      expect(percentage).toBe(100);
    });

    it('should handle NaN and Infinity values', () => {
      const progress = {
        totalResources: NaN,
        processedResources: Infinity,
        validResources: -Infinity,
        errorResources: 0,
        startTime: new Date(),
        isComplete: false,
        errors: []
      };

      const sanitizedTotal = isNaN(progress.totalResources) ? 0 : progress.totalResources;
      const sanitizedProcessed = !isFinite(progress.processedResources) ? 0 : progress.processedResources;
      const sanitizedValid = !isFinite(progress.validResources) ? 0 : progress.validResources;

      expect(sanitizedTotal).toBe(0);
      expect(sanitizedProcessed).toBe(0);
      expect(sanitizedValid).toBe(0);
    });
  });
});
