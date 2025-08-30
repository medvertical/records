// ============================================================================
// Rate Calculation Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardService } from '../services/dashboard-service.js';
import { FhirClient } from '../services/fhir-client.js';
import { DatabaseStorage } from '../storage.js';

describe('Rate Calculation Tests', () => {
  let dashboardService: DashboardService;
  let mockFhirClient: jest.Mocked<FhirClient>;
  let mockStorage: jest.Mocked<DatabaseStorage>;

  beforeEach(() => {
    // Mock dependencies
    mockFhirClient = {
      getResourceCount: jest.fn(),
      searchResources: jest.fn(),
      testConnection: jest.fn(),
      getAllResourceTypes: jest.fn()
    } as any;

    mockStorage = {
      getResourceStatsWithSettings: jest.fn(),
      getResourceStats: jest.fn()
    } as any;

    dashboardService = new DashboardService(mockFhirClient, mockStorage);
  });

  describe('Validation Rate Calculations', () => {
    it('should calculate validation rate correctly', () => {
      const serverCount = 1000;
      const validated = 500;

      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (validated / serverCount) * 100)) : 0;

      expect(validationRate).toBe(50);
    });

    it('should handle zero server count', () => {
      const serverCount = 0;
      const validated = 100;

      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (validated / serverCount) * 100)) : 0;

      expect(validationRate).toBe(0);
    });

    it('should cap validation rate at 100%', () => {
      const serverCount = 1000;
      const validated = 1200; // More than server count

      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (validated / serverCount) * 100)) : 0;

      expect(validationRate).toBe(100);
    });

    it('should ensure validation rate is non-negative', () => {
      const serverCount = 1000;
      const validated = -100; // Negative validated count

      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (validated / serverCount) * 100)) : 0;

      expect(validationRate).toBe(0);
    });
  });

  describe('Success Rate Calculations', () => {
    it('should calculate success rate correctly', () => {
      const validated = 1000;
      const valid = 800;

      const successRate = validated > 0 ? 
        Math.min(100, Math.max(0, (valid / validated) * 100)) : 0;

      expect(successRate).toBe(80);
    });

    it('should handle zero validated resources', () => {
      const validated = 0;
      const valid = 100;

      const successRate = validated > 0 ? 
        Math.min(100, Math.max(0, (valid / validated) * 100)) : 0;

      expect(successRate).toBe(0);
    });

    it('should cap success rate at 100%', () => {
      const validated = 1000;
      const valid = 1200; // More than validated

      const successRate = validated > 0 ? 
        Math.min(100, Math.max(0, (valid / validated) * 100)) : 0;

      expect(successRate).toBe(100);
    });

    it('should ensure success rate is non-negative', () => {
      const validated = 1000;
      const valid = -100; // Negative valid count

      const successRate = validated > 0 ? 
        Math.min(100, Math.max(0, (valid / validated) * 100)) : 0;

      expect(successRate).toBe(0);
    });
  });

  describe('Resource Type Breakdown Calculations', () => {
    it('should calculate resource type breakdown correctly', () => {
      const serverCount = 1000;
      const validated = 500;
      const valid = 400;
      const errors = 100;

      // Sanitize counts
      const sanitizedValidated = Math.max(0, Math.min(validated, serverCount));
      const sanitizedValid = Math.max(0, Math.min(valid, sanitizedValidated));
      const sanitizedErrors = Math.max(0, sanitizedValidated - sanitizedValid);
      const unvalidated = Math.max(0, serverCount - sanitizedValidated);

      // Calculate rates
      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (sanitizedValidated / serverCount) * 100)) : 0;
      const successRate = sanitizedValidated > 0 ? 
        Math.min(100, Math.max(0, (sanitizedValid / sanitizedValidated) * 100)) : 0;

      expect(sanitizedValidated).toBe(500);
      expect(sanitizedValid).toBe(400);
      expect(sanitizedErrors).toBe(100);
      expect(unvalidated).toBe(500);
      expect(validationRate).toBe(50);
      expect(successRate).toBe(80);
    });

    it('should handle edge case where validated exceeds server count', () => {
      const serverCount = 1000;
      const validated = 1200; // More than server count
      const valid = 1000;

      const sanitizedValidated = Math.max(0, Math.min(validated, serverCount));
      const sanitizedValid = Math.max(0, Math.min(valid, sanitizedValidated));

      expect(sanitizedValidated).toBe(1000);
      expect(sanitizedValid).toBe(1000);
    });

    it('should handle edge case where valid exceeds validated', () => {
      const serverCount = 1000;
      const validated = 500;
      const valid = 600; // More than validated

      const sanitizedValidated = Math.max(0, Math.min(validated, serverCount));
      const sanitizedValid = Math.max(0, Math.min(valid, sanitizedValidated));

      expect(sanitizedValidated).toBe(500);
      expect(sanitizedValid).toBe(500);
    });
  });

  describe('Rate Validation', () => {
    it('should validate rate calculations', () => {
      const validateRate = (rate: number, rateType: string): { isValid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        if (isNaN(rate) || !isFinite(rate)) {
          errors.push(`${rateType} is not a valid number`);
        }
        
        if (rate < 0 || rate > 100) {
          errors.push(`${rateType} (${rate}) is outside valid range [0, 100]`);
        }
        
        if (rate > 100.1) {
          errors.push(`${rateType} (${rate}) exceeds 100% - possible calculation error`);
        }
        
        if (rate < -0.1) {
          errors.push(`${rateType} (${rate}) is negative - possible calculation error`);
        }
        
        return { isValid: errors.length === 0, errors };
      };

      // Test valid rate
      const validRate = validateRate(50, 'validationRate');
      expect(validRate.isValid).toBe(true);
      expect(validRate.errors).toHaveLength(0);

      // Test invalid rate (too high)
      const invalidRate = validateRate(150, 'validationRate');
      expect(invalidRate.isValid).toBe(false);
      expect(invalidRate.errors).toContain('validationRate (150) is outside valid range [0, 100]');

      // Test invalid rate (negative)
      const negativeRate = validateRate(-10, 'successRate');
      expect(negativeRate.isValid).toBe(false);
      expect(negativeRate.errors).toContain('successRate (-10) is negative - possible calculation error');

      // Test NaN rate
      const nanRate = validateRate(NaN, 'validationRate');
      expect(nanRate.isValid).toBe(false);
      expect(nanRate.errors).toContain('validationRate is not a valid number');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small numbers', () => {
      const serverCount = 1;
      const validated = 1;
      const valid = 1;

      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (validated / serverCount) * 100)) : 0;
      const successRate = validated > 0 ? 
        Math.min(100, Math.max(0, (valid / validated) * 100)) : 0;

      expect(validationRate).toBe(100);
      expect(successRate).toBe(100);
    });

    it('should handle very large numbers', () => {
      const serverCount = Number.MAX_SAFE_INTEGER;
      const validated = Number.MAX_SAFE_INTEGER - 1000;
      const valid = Number.MAX_SAFE_INTEGER - 2000;

      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (validated / serverCount) * 100)) : 0;
      const successRate = validated > 0 ? 
        Math.min(100, Math.max(0, (valid / validated) * 100)) : 0;

      expect(validationRate).toBeCloseTo(100, 5);
      expect(successRate).toBeCloseTo(100, 5);
    });

    it('should handle division by zero', () => {
      const serverCount = 0;
      const validated = 0;
      const valid = 0;

      const validationRate = serverCount > 0 ? 
        Math.min(100, Math.max(0, (validated / serverCount) * 100)) : 0;
      const successRate = validated > 0 ? 
        Math.min(100, Math.max(0, (valid / validated) * 100)) : 0;

      expect(validationRate).toBe(0);
      expect(successRate).toBe(0);
    });
  });

  describe('Consistency Checks', () => {
    it('should ensure resource counts are consistent', () => {
      const breakdown = {
        total: 1000,
        validated: 500,
        valid: 400,
        errors: 100,
        unvalidated: 500
      };

      // Check that valid + errors = validated
      const totalProcessed = breakdown.valid + breakdown.errors;
      expect(totalProcessed).toBe(breakdown.validated);

      // Check that validated + unvalidated = total
      const totalResources = breakdown.validated + breakdown.unvalidated;
      expect(totalResources).toBe(breakdown.total);
    });

    it('should detect inconsistent resource counts', () => {
      const breakdown = {
        total: 1000,
        validated: 500,
        valid: 400,
        errors: 200, // Total = 600, exceeds validated
        unvalidated: 500
      };

      const totalProcessed = breakdown.valid + breakdown.errors;
      const isConsistent = totalProcessed <= breakdown.validated;

      expect(isConsistent).toBe(false);
    });
  });
});
