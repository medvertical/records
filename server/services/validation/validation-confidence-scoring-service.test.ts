/**
 * Unit tests for Validation Confidence Scoring Service
 * 
 * Tests confidence scoring calculation including accuracy factors,
 * confidence issues, and recommended actions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ValidationConfidenceScoringService } from './validation-confidence-scoring-service';
import type { 
  ValidationConfidenceMetrics,
  ValidationResultWithConfidence
} from '@shared/types/validation';

// Mock storage
vi.mock('../../storage', () => ({
  storage: {
    getValidationResults: vi.fn(),
    getValidationHistory: vi.fn()
  }
}));

describe('ValidationConfidenceScoringService', () => {
  let service: ValidationConfidenceScoringService;
  let mockResult: any;
  let mockHistoricalResults: any[];
  let mockSettings: any;
  let mockExternalDependencyStatus: any;

  beforeEach(() => {
    service = new ValidationConfidenceScoringService();

    mockResult = {
      id: '1',
      resourceType: 'Patient',
      isValid: true,
      validationScore: 95,
      errorCount: 0,
      warningCount: 1,
      aspectBreakdown: {
        structural: { passed: true, issues: [], duration: 100 },
        profile: { passed: true, issues: [], duration: 150 },
        terminology: { passed: true, issues: [], duration: 200 },
        reference: { passed: true, issues: [], duration: 120 },
        businessRule: { passed: true, issues: [], duration: 180 },
        metadata: { passed: true, issues: [], duration: 80 }
      },
      validatedAt: new Date('2024-01-01T10:00:00Z'),
      settingsUsed: {}
    };

    mockHistoricalResults = [
      {
        id: '2',
        resourceType: 'Patient',
        isValid: true,
        validationScore: 92,
        errorCount: 0,
        warningCount: 1,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 105 },
          profile: { passed: true, issues: [], duration: 155 }
        },
        validatedAt: new Date('2024-01-01T09:00:00Z'),
        settingsUsed: {}
      },
      {
        id: '3',
        resourceType: 'Patient',
        isValid: true,
        validationScore: 88,
        errorCount: 0,
        warningCount: 2,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 110 },
          profile: { passed: true, issues: [], duration: 160 }
        },
        validatedAt: new Date('2024-01-01T08:00:00Z'),
        settingsUsed: {}
      }
    ];

    mockSettings = {
      structural: { enabled: true },
      profile: { enabled: true },
      terminology: { enabled: true },
      reference: { enabled: true },
      businessRule: { enabled: true },
      metadata: { enabled: true }
    };

    mockExternalDependencyStatus = {
      terminologyServers: true,
      profileServers: true,
      referenceServers: true
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateConfidenceMetrics', () => {
    it('should calculate confidence metrics with complete data', async () => {
      const result = await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.confidenceLevel).toMatch(/^(very_low|low|medium|high|very_high)$/);
      expect(result.confidenceFactors).toBeDefined();
      expect(result.confidenceIssues).toBeDefined();
      expect(result.validationCertainty).toBeGreaterThanOrEqual(0);
      expect(result.validationCertainty).toBeLessThanOrEqual(100);
      expect(result.confidenceTrend).toMatch(/^(improving|stable|declining|unknown)$/);
      expect(typeof result.explanation).toBe('string');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should calculate confidence factors correctly', async () => {
      const result = await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result.confidenceFactors).toBeDefined();
      expect(result.confidenceFactors.aspectCompleteness).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.aspectCompleteness).toBeLessThanOrEqual(100);
      expect(result.confidenceFactors.dataSourceQuality).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.dataSourceQuality).toBeLessThanOrEqual(100);
      expect(result.confidenceFactors.resultConsistency).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.resultConsistency).toBeLessThanOrEqual(100);
      expect(result.confidenceFactors.ruleCoverage).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.ruleCoverage).toBeLessThanOrEqual(100);
      expect(result.confidenceFactors.historicalAccuracy).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.historicalAccuracy).toBeLessThanOrEqual(100);
      expect(result.confidenceFactors.engineReliability).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.engineReliability).toBeLessThanOrEqual(100);
      expect(result.confidenceFactors.resourceComplexity).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.resourceComplexity).toBeLessThanOrEqual(100);
      expect(result.confidenceFactors.externalDependencyReliability).toBeGreaterThanOrEqual(0);
      expect(result.confidenceFactors.externalDependencyReliability).toBeLessThanOrEqual(100);
    });

    it('should identify confidence issues correctly', async () => {
      const resultWithIssues = {
        ...mockResult,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 100 },
          profile: { passed: false, issues: [], duration: 150 }
          // Missing other aspects
        }
      };

      const result = await service.calculateConfidenceMetrics(
        resultWithIssues,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result.confidenceIssues).toBeDefined();
      expect(Array.isArray(result.confidenceIssues)).toBe(true);
      
      if (result.confidenceIssues.length > 0) {
        result.confidenceIssues.forEach(issue => {
          expect(issue.type).toMatch(/^(missing_data|incomplete_validation|external_dependency_failure|rule_ambiguity|historical_inconsistency)$/);
          expect(typeof issue.description).toBe('string');
          expect(issue.confidenceImpact).toBeGreaterThanOrEqual(0);
          expect(issue.confidenceImpact).toBeLessThanOrEqual(100);
          expect(issue.severity).toMatch(/^(low|medium|high|critical)$/);
        });
      }
    });

    it('should handle external dependency failures', async () => {
      const failedDependencyStatus = {
        terminologyServers: false,
        profileServers: true,
        referenceServers: false
      };

      const result = await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        failedDependencyStatus
      );

      expect(result.confidenceFactors.externalDependencyReliability).toBeLessThan(100);
      expect(result.confidenceIssues.some(issue => issue.type === 'external_dependency_failure')).toBe(true);
    });

    it('should calculate validation certainty correctly', async () => {
      const result = await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result.validationCertainty).toBeGreaterThanOrEqual(0);
      expect(result.validationCertainty).toBeLessThanOrEqual(100);
      
      // High validation score should result in high certainty
      expect(result.validationCertainty).toBeGreaterThan(80);
    });

    it('should generate recommendations based on confidence level', async () => {
      const lowConfidenceResult = {
        ...mockResult,
        validationScore: 50,
        errorCount: 5,
        warningCount: 3,
        aspectBreakdown: {
          structural: { passed: false, issues: [], duration: 100 }
          // Missing other aspects
        }
      };

      const result = await service.calculateConfidenceMetrics(
        lowConfidenceResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      result.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });
  });

  describe('enhanceValidationResultWithConfidence', () => {
    it('should enhance validation result with confidence data', async () => {
      const result = await service.enhanceValidationResultWithConfidence(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result).toBeDefined();
      expect(result.validationResult).toEqual(mockResult);
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidenceSufficient).toBe('boolean');
      expect(Array.isArray(result.recommendedActions)).toBe(true);
    });

    it('should determine confidence sufficiency correctly', async () => {
      const highConfidenceResult = {
        ...mockResult,
        validationScore: 95,
        errorCount: 0,
        warningCount: 0,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 100 },
          profile: { passed: true, issues: [], duration: 150 },
          terminology: { passed: true, issues: [], duration: 200 },
          reference: { passed: true, issues: [], duration: 120 },
          businessRule: { passed: true, issues: [], duration: 180 },
          metadata: { passed: true, issues: [], duration: 80 }
        }
      };

      const result = await service.enhanceValidationResultWithConfidence(
        highConfidenceResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result.confidenceSufficient).toBe(true);
    });

    it('should generate recommended actions based on confidence', async () => {
      const lowConfidenceResult = {
        ...mockResult,
        validationScore: 40,
        errorCount: 8,
        warningCount: 5
      };

      const result = await service.enhanceValidationResultWithConfidence(
        lowConfidenceResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result.recommendedActions).toBeDefined();
      expect(Array.isArray(result.recommendedActions)).toBe(true);
      
      result.recommendedActions.forEach(action => {
        expect(action.type).toMatch(/^(review_manually|seek_additional_validation|trust_result|investigate_further|retry_validation)$/);
        expect(typeof action.description).toBe('string');
        expect(action.priority).toMatch(/^(low|medium|high|critical)$/);
        expect(action.expectedConfidenceImprovement).toBeGreaterThanOrEqual(0);
        expect(action.effort).toMatch(/^(low|medium|high)$/);
      });
    });
  });

  describe('confidence level determination', () => {
    it('should determine valid confidence levels', async () => {
      // Test with various validation scenarios
      const testResults = [
        {
          ...mockResult,
          validationScore: 15,
          errorCount: 10,
          warningCount: 5,
          aspectBreakdown: {
            structural: { passed: false, issues: [], duration: 100 }
          }
        },
        {
          ...mockResult,
          validationScore: 90,
          errorCount: 0,
          warningCount: 1,
          aspectBreakdown: {
            structural: { passed: true, issues: [], duration: 100 },
            profile: { passed: true, issues: [], duration: 150 },
            terminology: { passed: true, issues: [], duration: 200 },
            reference: { passed: true, issues: [], duration: 120 },
            businessRule: { passed: true, issues: [], duration: 180 },
            metadata: { passed: true, issues: [], duration: 80 }
          }
        }
      ];

      for (const testResult of testResults) {
        const confidence = await service.calculateConfidenceMetrics(
          testResult,
          mockHistoricalResults,
          mockSettings,
          mockExternalDependencyStatus
        );

        expect(['very_low', 'low', 'medium', 'high', 'very_high']).toContain(confidence.confidenceLevel);
        expect(confidence.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(confidence.confidenceScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('confidence trend calculation', () => {
    it('should calculate confidence trends correctly', async () => {
      // First call - no history
      const result1 = await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result1.confidenceTrend).toBe('unknown');

      // Store some history
      service['storeConfidenceScore']('Patient', 80);
      service['storeConfidenceScore']('Patient', 85);
      service['storeConfidenceScore']('Patient', 90);

      // Second call - with improving trend
      const result2 = await service.calculateConfidenceMetrics(
        { ...mockResult, validationScore: 95 },
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(['improving', 'stable', 'declining', 'unknown']).toContain(result2.confidenceTrend);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        factorWeights: {
          aspectCompleteness: 0.3,
          dataSourceQuality: 0.2,
          resultConsistency: 0.2,
          ruleCoverage: 0.15,
          historicalAccuracy: 0.1,
          engineReliability: 0.05,
          resourceComplexity: 0.05,
          externalDependencyReliability: 0.05
        }
      };

      service.updateConfig(newConfig);
      const updatedConfig = service.getConfig();

      expect(updatedConfig.factorWeights.aspectCompleteness).toBe(0.3);
      expect(updatedConfig.factorWeights.dataSourceQuality).toBe(0.2);
    });

    it('should return health status', () => {
      const healthStatus = service.getHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(typeof healthStatus.isHealthy).toBe('boolean');
      expect(typeof healthStatus.confidenceHistorySize).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const invalidResult = null as any;

      await expect(service.calculateConfidenceMetrics(
        invalidResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      )).rejects.toThrow();
    });

    it('should emit events correctly', async () => {
      const eventSpy = vi.fn();
      service.on('confidenceCalculated', eventSpy);

      await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.any(Object),
          confidenceMetrics: expect.any(Object)
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty historical results', async () => {
      const result = await service.calculateConfidenceMetrics(
        mockResult,
        [],
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceLevel).toBeDefined();
    });

    it('should handle missing aspect breakdown', async () => {
      const resultWithoutBreakdown = {
        ...mockResult,
        aspectBreakdown: {}
      };

      const result = await service.calculateConfidenceMetrics(
        resultWithoutBreakdown,
        mockHistoricalResults,
        mockSettings,
        mockExternalDependencyStatus
      );

      expect(result).toBeDefined();
      expect(result.confidenceFactors.aspectCompleteness).toBeLessThan(100);
    });

    it('should handle missing settings', async () => {
      const result = await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        {},
        mockExternalDependencyStatus
      );

      expect(result).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle all external dependencies failing', async () => {
      const allFailedDependencies = {
        terminologyServers: false,
        profileServers: false,
        referenceServers: false
      };

      const result = await service.calculateConfidenceMetrics(
        mockResult,
        mockHistoricalResults,
        mockSettings,
        allFailedDependencies
      );

      expect(result.confidenceFactors.externalDependencyReliability).toBeLessThan(50);
      expect(result.confidenceIssues.some(issue => issue.type === 'external_dependency_failure')).toBe(true);
    });
  });
});
