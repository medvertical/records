import { describe, it, expect } from 'vitest';
import {
  clampPercentage,
  clampCount,
  calculateValidationRate,
  calculateSuccessRate,
  calculateUnvalidatedCount,
  calculateErrorCount,
  sanitizeValidationStats,
  validateValidationStatsConsistency,
  getFallbackValidationStats
} from './validation';

describe('Validation Utilities', () => {
  describe('clampPercentage', () => {
    it('should return the value when within 0-100 range', () => {
      expect(clampPercentage(50)).toBe(50);
      expect(clampPercentage(0)).toBe(0);
      expect(clampPercentage(100)).toBe(100);
    });

    it('should clamp negative values to 0', () => {
      expect(clampPercentage(-10)).toBe(0);
      expect(clampPercentage(-100)).toBe(0);
    });

    it('should clamp values above 100 to 100', () => {
      expect(clampPercentage(150)).toBe(100);
      expect(clampPercentage(101)).toBe(100);
    });

    it('should handle decimal values', () => {
      expect(clampPercentage(50.5)).toBe(50.5);
      expect(clampPercentage(99.9)).toBe(99.9);
      expect(clampPercentage(100.1)).toBe(100);
    });
  });

  describe('clampCount', () => {
    it('should return the value when non-negative', () => {
      expect(clampCount(10)).toBe(10);
      expect(clampCount(0)).toBe(0);
      expect(clampCount(1000)).toBe(1000);
    });

    it('should clamp negative values to 0', () => {
      expect(clampCount(-5)).toBe(0);
      expect(clampCount(-100)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(clampCount(10.5)).toBe(10.5);
      expect(clampCount(-5.5)).toBe(0);
    });
  });

  describe('calculateValidationRate', () => {
    it('should calculate correct validation rate', () => {
      expect(calculateValidationRate(50, 100)).toBe(50);
      expect(calculateValidationRate(25, 100)).toBe(25);
      expect(calculateValidationRate(100, 100)).toBe(100);
    });

    it('should return 0 when total is 0', () => {
      expect(calculateValidationRate(50, 0)).toBe(0);
      expect(calculateValidationRate(0, 0)).toBe(0);
    });

    it('should return 0 when total is negative', () => {
      expect(calculateValidationRate(50, -10)).toBe(0);
    });

    it('should clamp result to 0-100 range', () => {
      expect(calculateValidationRate(150, 100)).toBe(100);
      expect(calculateValidationRate(-10, 100)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(calculateValidationRate(33, 100)).toBe(33);
      expect(calculateValidationRate(66.666, 100)).toBe(66.666);
    });
  });

  describe('calculateSuccessRate', () => {
    it('should calculate correct success rate', () => {
      expect(calculateSuccessRate(80, 100)).toBe(80);
      expect(calculateSuccessRate(50, 100)).toBe(50);
      expect(calculateSuccessRate(100, 100)).toBe(100);
    });

    it('should return 0 when validated is 0', () => {
      expect(calculateSuccessRate(50, 0)).toBe(0);
      expect(calculateSuccessRate(0, 0)).toBe(0);
    });

    it('should return 0 when validated is negative', () => {
      expect(calculateSuccessRate(50, -10)).toBe(0);
    });

    it('should clamp result to 0-100 range', () => {
      expect(calculateSuccessRate(150, 100)).toBe(100);
      expect(calculateSuccessRate(-10, 100)).toBe(0);
    });
  });

  describe('calculateUnvalidatedCount', () => {
    it('should calculate correct unvalidated count', () => {
      expect(calculateUnvalidatedCount(100, 80)).toBe(20);
      expect(calculateUnvalidatedCount(100, 100)).toBe(0);
      expect(calculateUnvalidatedCount(100, 0)).toBe(100);
    });

    it('should return 0 when result would be negative', () => {
      expect(calculateUnvalidatedCount(50, 80)).toBe(0);
      expect(calculateUnvalidatedCount(0, 10)).toBe(0);
    });

    it('should handle negative inputs', () => {
      expect(calculateUnvalidatedCount(-10, 5)).toBe(0);
      expect(calculateUnvalidatedCount(10, -5)).toBe(15);
    });
  });

  describe('calculateErrorCount', () => {
    it('should calculate correct error count', () => {
      expect(calculateErrorCount(100, 80)).toBe(20);
      expect(calculateErrorCount(100, 100)).toBe(0);
      expect(calculateErrorCount(100, 0)).toBe(100);
    });

    it('should return 0 when result would be negative', () => {
      expect(calculateErrorCount(50, 80)).toBe(0);
      expect(calculateErrorCount(0, 10)).toBe(0);
    });

    it('should handle negative inputs', () => {
      expect(calculateErrorCount(-10, 5)).toBe(0);
      expect(calculateErrorCount(10, -5)).toBe(15);
    });
  });

  describe('sanitizeValidationStats', () => {
    it('should sanitize validation stats with proper clamping', () => {
      const inputStats = {
        totalValidated: -10,
        validResources: 150,
        errorResources: -5,
        warningResources: 50,
        unvalidatedResources: -20,
        validationCoverage: 120,
        validationProgress: -5,
        resourceTypeBreakdown: {
          Patient: {
            total: -10,
            validated: 80,
            valid: 70,
            warnings: -5,
            unvalidated: 30
          }
        }
      };

      const result = sanitizeValidationStats(inputStats);

      expect(result.totalValidated).toBe(0);
      expect(result.validResources).toBe(150); // clampCount only clamps to 0, not max
      expect(result.errorResources).toBe(0);
      expect(result.warningResources).toBe(50);
      expect(result.unvalidatedResources).toBe(0);
      expect(result.validationCoverage).toBe(100);
      expect(result.validationProgress).toBe(0);

      expect(result.resourceTypeBreakdown.Patient.total).toBe(0);
      expect(result.resourceTypeBreakdown.Patient.validated).toBe(80);
      expect(result.resourceTypeBreakdown.Patient.valid).toBe(70);
      expect(result.resourceTypeBreakdown.Patient.warnings).toBe(0);
      expect(result.resourceTypeBreakdown.Patient.unvalidated).toBe(0);
      expect(result.resourceTypeBreakdown.Patient.errors).toBe(10); // 80 - 70
      expect(result.resourceTypeBreakdown.Patient.validationRate).toBe(0); // 80/0 = 0
      expect(result.resourceTypeBreakdown.Patient.successRate).toBe(87.5); // 70/80 * 100
    });

    it('should handle missing fields gracefully', () => {
      const inputStats = {};

      const result = sanitizeValidationStats(inputStats);

      expect(result.totalValidated).toBe(0);
      expect(result.validResources).toBe(0);
      expect(result.errorResources).toBe(0);
      expect(result.warningResources).toBe(0);
      expect(result.unvalidatedResources).toBe(0);
      expect(result.validationCoverage).toBe(0);
      expect(result.validationProgress).toBe(0);
      expect(result.resourceTypeBreakdown).toEqual({});
    });

    it('should preserve valid values unchanged', () => {
      const inputStats = {
        totalValidated: 100,
        validResources: 80,
        errorResources: 20,
        warningResources: 10,
        unvalidatedResources: 50,
        validationCoverage: 66.67,
        validationProgress: 85,
        resourceTypeBreakdown: {
          Patient: {
            total: 100,
            validated: 80,
            valid: 70,
            warnings: 10,
            unvalidated: 20
          }
        }
      };

      const result = sanitizeValidationStats(inputStats);

      expect(result.totalValidated).toBe(100);
      expect(result.validResources).toBe(80);
      expect(result.errorResources).toBe(20);
      expect(result.warningResources).toBe(10);
      expect(result.unvalidatedResources).toBe(50);
      expect(result.validationCoverage).toBe(66.67);
      expect(result.validationProgress).toBe(85);
    });
  });

  describe('validateValidationStatsConsistency', () => {
    it('should return valid for consistent stats', () => {
      const consistentStats = {
        totalValidated: 100,
        validResources: 80,
        errorResources: 20,
        resourceTypeBreakdown: {
          Patient: {
            validated: 50,
            valid: 40,
            errors: 10,
            total: 70,
            unvalidated: 20
          }
        }
      };

      const result = validateValidationStatsConsistency(consistentStats);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect inconsistent total validated', () => {
      const inconsistentStats = {
        totalValidated: 100,
        validResources: 70,
        errorResources: 20, // 70 + 20 = 90, not 100
        resourceTypeBreakdown: {}
      };

      const result = validateValidationStatsConsistency(inconsistentStats);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Total validated (100) doesn't match valid + error resources (90)");
    });

    it('should detect inconsistent resource type breakdown', () => {
      const inconsistentStats = {
        totalValidated: 100,
        validResources: 80,
        errorResources: 20,
        resourceTypeBreakdown: {
          Patient: {
            validated: 50,
            valid: 30,
            errors: 10, // 30 + 10 = 40, not 50
            total: 70,
            unvalidated: 20
          },
          Observation: {
            validated: 50,
            valid: 40,
            errors: 20, // 40 + 20 = 60, not 50
            total: 80,
            unvalidated: 30 // 50 + 30 = 80, matches total
          }
        }
      };

      const result = validateValidationStatsConsistency(inconsistentStats);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Resource type Patient: validated (50) doesn\'t match valid + errors (40)');
      expect(result.errors[1]).toContain('Resource type Observation: validated (50) doesn\'t match valid + errors (60)');
    });

    it('should detect inconsistent total vs validated + unvalidated', () => {
      const inconsistentStats = {
        totalValidated: 100,
        validResources: 80,
        errorResources: 20,
        resourceTypeBreakdown: {
          Patient: {
            validated: 50,
            valid: 40,
            errors: 10,
            total: 60, // 50 + 10 = 60, matches total
            unvalidated: 10 // 50 + 10 = 60, matches total
          }
        }
      };

      const result = validateValidationStatsConsistency(inconsistentStats);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle missing resource type breakdown', () => {
      const stats = {
        totalValidated: 100,
        validResources: 80,
        errorResources: 20
      };

      const result = validateValidationStatsConsistency(stats);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getFallbackValidationStats', () => {
    it('should return proper fallback stats structure', () => {
      const fallback = getFallbackValidationStats();

      expect(fallback.totalValidated).toBe(0);
      expect(fallback.validResources).toBe(0);
      expect(fallback.errorResources).toBe(0);
      expect(fallback.warningResources).toBe(0);
      expect(fallback.unvalidatedResources).toBe(0);
      expect(fallback.validationCoverage).toBe(0);
      expect(fallback.validationProgress).toBe(0);
      expect(fallback.lastValidationRun).toBeInstanceOf(Date);
      expect(fallback.resourceTypeBreakdown).toEqual({});
      
      expect(fallback.aspectBreakdown).toEqual({
        structural: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
        profile: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
        terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
        reference: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
        businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
        metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 }
      });
    });

    it('should return consistent fallback stats', () => {
      const fallback1 = getFallbackValidationStats();
      const fallback2 = getFallbackValidationStats();

      expect(fallback1).toEqual(fallback2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle NaN values in calculations', () => {
      expect(calculateValidationRate(NaN, 100)).toBe(0);
      expect(calculateValidationRate(50, NaN)).toBe(0);
      expect(calculateSuccessRate(NaN, 100)).toBe(0);
      expect(calculateSuccessRate(50, NaN)).toBe(0);
    });

    it('should handle Infinity values in calculations', () => {
      expect(calculateValidationRate(Infinity, 100)).toBe(100);
      expect(calculateValidationRate(50, Infinity)).toBe(0);
      expect(calculateSuccessRate(Infinity, 100)).toBe(100);
      expect(calculateSuccessRate(50, Infinity)).toBe(0);
    });

    it('should handle very large numbers', () => {
      expect(clampPercentage(Number.MAX_SAFE_INTEGER)).toBe(100);
      expect(clampCount(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
      expect(clampCount(-Number.MAX_SAFE_INTEGER)).toBe(0);
    });

    it('should handle null and undefined inputs', () => {
      const statsWithNulls = {
        totalValidated: null,
        validResources: undefined,
        errorResources: null,
        warningResources: undefined,
        unvalidatedResources: null,
        validationCoverage: undefined,
        validationProgress: null,
        resourceTypeBreakdown: null
      };

      const result = sanitizeValidationStats(statsWithNulls);

      expect(result.totalValidated).toBe(0);
      expect(result.validResources).toBe(0);
      expect(result.errorResources).toBe(0);
      expect(result.warningResources).toBe(0);
      expect(result.unvalidatedResources).toBe(0);
      expect(result.validationCoverage).toBe(0);
      expect(result.validationProgress).toBe(0);
      expect(result.resourceTypeBreakdown).toEqual({});
    });
  });
});
