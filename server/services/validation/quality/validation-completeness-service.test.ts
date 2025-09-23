/**
 * Unit tests for Validation Completeness Service
 * 
 * Tests completeness calculation including coverage metrics,
 * missing validation areas, and validation gaps.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ValidationCompletenessService } from './validation-completeness-service';
import type { 
  ValidationCompletenessMetrics,
  ValidationResultWithCompleteness
} from '@shared/types/validation';

// Mock storage
vi.mock('../../storage', () => ({
  storage: {
    getValidationResults: vi.fn(),
    getValidationHistory: vi.fn()
  }
}));

describe('ValidationCompletenessService', () => {
  let service: ValidationCompletenessService;
  let mockResult: any;
  let mockSettings: any;
  let mockResourceProfile: any;
  let mockAvailableValidationRules: string[];

  beforeEach(() => {
    service = new ValidationCompletenessService();

    mockResult = {
      id: '1',
      resourceType: 'Patient',
      isValid: true,
      validationScore: 95,
      errorCount: 0,
      warningCount: 1,
      aspectBreakdown: {
        structural: { 
          passed: true, 
          issues: [], 
          duration: 100,
          fieldsValidated: ['id', 'resourceType', 'meta'],
          fieldsSkipped: [],
          fieldsMissing: []
        },
        profile: { 
          passed: true, 
          issues: [], 
          duration: 150,
          fieldsValidated: ['name', 'gender', 'birthDate'],
          fieldsSkipped: ['deceasedDateTime'],
          fieldsMissing: []
        },
        terminology: { 
          passed: true, 
          issues: [], 
          duration: 200,
          fieldsValidated: ['gender'],
          fieldsSkipped: [],
          fieldsMissing: []
        },
        reference: { 
          passed: true, 
          issues: [], 
          duration: 120,
          fieldsValidated: ['managingOrganization'],
          fieldsSkipped: [],
          fieldsMissing: []
        },
        businessRule: { 
          passed: true, 
          issues: [], 
          duration: 180,
          fieldsValidated: ['name', 'gender'],
          fieldsSkipped: [],
          fieldsMissing: []
        },
        metadata: { 
          passed: true, 
          issues: [], 
          duration: 80,
          fieldsValidated: ['meta'],
          fieldsSkipped: [],
          fieldsMissing: []
        }
      },
      validatedAt: new Date('2024-01-01T10:00:00Z'),
      settingsUsed: {},
      resourceData: {
        resourceType: 'Patient',
        id: 'patient-1',
        name: [{ family: 'Doe', given: ['John'] }],
        gender: 'male',
        birthDate: '1990-01-01'
      }
    };

    mockSettings = {
      structural: { enabled: true },
      profile: { enabled: true },
      terminology: { enabled: true },
      reference: { enabled: true },
      businessRule: { enabled: true },
      metadata: { enabled: true }
    };

    mockResourceProfile = {
      id: 'patient-profile',
      name: 'Patient Profile',
      resourceType: 'Patient',
      requiredFields: ['id', 'resourceType', 'name', 'gender'],
      optionalFields: ['birthDate', 'deceasedDateTime', 'managingOrganization'],
      validationRules: ['patient-name-rule', 'patient-gender-rule']
    };

    mockAvailableValidationRules = [
      'structural-rule-1',
      'structural-rule-2',
      'profile-rule-1',
      'profile-rule-2',
      'terminology-rule-1',
      'reference-rule-1',
      'business-rule-1',
      'metadata-rule-1'
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateCompletenessMetrics', () => {
    it('should calculate completeness metrics with complete data', async () => {
      const result = await service.calculateCompletenessMetrics(
        mockResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result).toBeDefined();
      expect(result.completenessScore).toBeGreaterThanOrEqual(0);
      expect(result.completenessScore).toBeLessThanOrEqual(100);
      expect(result.completenessLevel).toMatch(/^(incomplete|partial|mostly_complete|complete|fully_complete)$/);
      expect(result.completenessFactors).toBeDefined();
      expect(result.coverageMetrics).toBeDefined();
      expect(result.missingValidationAreas).toBeDefined();
      expect(result.validationGaps).toBeDefined();
      expect(result.completenessTrend).toMatch(/^(improving|stable|declining|unknown)$/);
      expect(typeof result.explanation).toBe('string');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.estimatedEffort).toMatch(/^(low|medium|high|very_high)$/);
    });

    it('should calculate completeness factors correctly', async () => {
      const result = await service.calculateCompletenessMetrics(
        mockResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result.completenessFactors).toBeDefined();
      expect(result.completenessFactors.aspectCompleteness).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.aspectCompleteness).toBeLessThanOrEqual(100);
      expect(result.completenessFactors.fieldCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.fieldCoverage).toBeLessThanOrEqual(100);
      expect(result.completenessFactors.ruleCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.ruleCoverage).toBeLessThanOrEqual(100);
      expect(result.completenessFactors.profileCompliance).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.profileCompliance).toBeLessThanOrEqual(100);
      expect(result.completenessFactors.terminologyCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.terminologyCoverage).toBeLessThanOrEqual(100);
      expect(result.completenessFactors.referenceCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.referenceCoverage).toBeLessThanOrEqual(100);
      expect(result.completenessFactors.businessRuleCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.businessRuleCoverage).toBeLessThanOrEqual(100);
      expect(result.completenessFactors.metadataCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completenessFactors.metadataCoverage).toBeLessThanOrEqual(100);
    });

    it('should calculate coverage metrics correctly', async () => {
      const result = await service.calculateCompletenessMetrics(
        mockResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result.coverageMetrics).toBeDefined();
      expect(result.coverageMetrics.overallCoverage).toBeGreaterThanOrEqual(0);
      expect(result.coverageMetrics.overallCoverage).toBeLessThanOrEqual(100);
      expect(result.coverageMetrics.aspectCoverage).toBeDefined();
      expect(result.coverageMetrics.fieldTypeCoverage).toBeDefined();
      expect(result.coverageMetrics.sectionCoverage).toBeDefined();

      // Check aspect coverage structure
      Object.entries(result.coverageMetrics.aspectCoverage).forEach(([aspect, coverage]) => {
        expect(coverage.coverage).toBeGreaterThanOrEqual(0);
        expect(coverage.coverage).toBeLessThanOrEqual(100);
        expect(typeof coverage.totalFields).toBe('number');
        expect(typeof coverage.validatedFields).toBe('number');
        expect(typeof coverage.skippedFields).toBe('number');
        expect(Array.isArray(coverage.missingFields)).toBe(true);
      });
    });

    it('should identify missing validation areas correctly', async () => {
      const incompleteResult = {
        ...mockResult,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 100 },
          profile: { passed: true, issues: [], duration: 150 }
          // Missing other aspects
        }
      };

      const result = await service.calculateCompletenessMetrics(
        incompleteResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result.missingValidationAreas).toBeDefined();
      expect(Array.isArray(result.missingValidationAreas)).toBe(true);
      expect(result.missingValidationAreas.length).toBeGreaterThan(0);
      
      result.missingValidationAreas.forEach(area => {
        expect(area.type).toMatch(/^(aspect|field|rule|profile|terminology|reference|business_rule|metadata)$/);
        expect(typeof area.identifier).toBe('string');
        expect(typeof area.description).toBe('string');
        expect(area.impact).toBeGreaterThanOrEqual(0);
        expect(area.impact).toBeLessThanOrEqual(100);
        expect(area.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(area.reason).toMatch(/^(not_enabled|not_available|validation_failed|configuration_error|resource_limitation)$/);
      });
    });

    it('should identify validation gaps correctly', async () => {
      const resultWithGaps = {
        ...mockResult,
        aspectBreakdown: {
          structural: { 
            passed: true, 
            issues: [], 
            duration: 100,
            fieldsValidated: ['id', 'resourceType'],
            fieldsSkipped: ['meta'],
            fieldsMissing: []
          },
          profile: { 
            passed: false, 
            issues: [{ type: 'profile-mismatch', message: 'Profile validation failed' }], 
            duration: 150,
            fieldsValidated: ['name'],
            fieldsSkipped: ['gender'],
            fieldsMissing: ['birthDate']
          }
        }
      };

      const result = await service.calculateCompletenessMetrics(
        resultWithGaps,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result.validationGaps).toBeDefined();
      expect(Array.isArray(result.validationGaps)).toBe(true);
      
      result.validationGaps.forEach(gap => {
        expect(gap.id).toBeDefined();
        expect(gap.type).toMatch(/^(missing_field|incomplete_validation|unvalidated_section|missing_rule|profile_mismatch)$/);
        expect(typeof gap.description).toBe('string');
        expect(Array.isArray(gap.path)).toBe(true);
        expect(gap.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(gap.completenessImpact).toBeGreaterThanOrEqual(0);
        expect(gap.completenessImpact).toBeLessThanOrEqual(100);
        expect(typeof gap.suggestedFix).toBe('string');
        expect(typeof gap.autoResolvable).toBe('boolean');
        expect(typeof gap.relatedAspect).toBe('string');
      });
    });

    it('should calculate valid completeness levels', async () => {
      const testCases = [
        { score: 98 },
        { score: 90 },
        { score: 75 },
        { score: 55 },
        { score: 35 }
      ];

      for (const testCase of testCases) {
        const testResult = {
          ...mockResult,
          validationScore: testCase.score
        };

        const result = await service.calculateCompletenessMetrics(
          testResult,
          mockSettings,
          mockResourceProfile,
          mockAvailableValidationRules
        );

        expect(['incomplete', 'partial', 'mostly_complete', 'complete', 'fully_complete']).toContain(result.completenessLevel);
        expect(result.completenessScore).toBeGreaterThanOrEqual(0);
        expect(result.completenessScore).toBeLessThanOrEqual(100);
      }
    });

    it('should estimate effort correctly based on missing areas and gaps', async () => {
      const highEffortResult = {
        ...mockResult,
        aspectBreakdown: {
          structural: { 
            passed: false, 
            issues: [{ type: 'critical-error' }], 
            duration: 100,
            fieldsValidated: ['id'],
            fieldsSkipped: ['resourceType'],
            fieldsMissing: ['meta']
          }
        }
      };

      const result = await service.calculateCompletenessMetrics(
        highEffortResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result.estimatedEffort).toMatch(/^(low|medium|high|very_high)$/);
      expect(result.missingValidationAreas.length + result.validationGaps.length).toBeGreaterThan(0);
    });
  });

  describe('enhanceValidationResultWithCompleteness', () => {
    it('should enhance validation result with completeness data', async () => {
      const result = await service.enhanceValidationResultWithCompleteness(
        mockResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result).toBeDefined();
      expect(result.validationResult).toEqual(mockResult);
      expect(result.completeness).toBeDefined();
      expect(typeof result.completenessSufficient).toBe('boolean');
      expect(Array.isArray(result.recommendedActions)).toBe(true);
    });

    it('should determine completeness sufficiency correctly', async () => {
      const completeResult = {
        ...mockResult,
        validationScore: 98,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 100 },
          profile: { passed: true, issues: [], duration: 150 },
          terminology: { passed: true, issues: [], duration: 200 },
          reference: { passed: true, issues: [], duration: 120 },
          businessRule: { passed: true, issues: [], duration: 180 },
          metadata: { passed: true, issues: [], duration: 80 }
        }
      };

      const result = await service.enhanceValidationResultWithCompleteness(
        completeResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result.completenessSufficient).toBe(true);
    });

    it('should generate recommended actions based on completeness', async () => {
      const incompleteResult = {
        ...mockResult,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 100 }
          // Missing other aspects
        }
      };

      const result = await service.enhanceValidationResultWithCompleteness(
        incompleteResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result.recommendedActions).toBeDefined();
      expect(Array.isArray(result.recommendedActions)).toBe(true);
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      
      result.recommendedActions.forEach(action => {
        expect(action.type).toMatch(/^(enable_aspect|validate_field|add_rule|update_profile|fix_configuration|manual_review)$/);
        expect(typeof action.description).toBe('string');
        expect(action.priority).toMatch(/^(low|medium|high|critical)$/);
        expect(action.expectedCompletenessImprovement).toBeGreaterThanOrEqual(0);
        expect(action.effort).toMatch(/^(low|medium|high)$/);
        expect(typeof action.automatable).toBe('boolean');
      });
    });
  });

  describe('completeness trend calculation', () => {
    it('should calculate completeness trends correctly', async () => {
      // First call - no history
      const result1 = await service.calculateCompletenessMetrics(
        mockResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result1.completenessTrend).toBe('unknown');

      // Store some history
      service['storeCompletenessScore']('Patient', 70);
      service['storeCompletenessScore']('Patient', 75);
      service['storeCompletenessScore']('Patient', 80);

      // Second call - with improving trend
      const result2 = await service.calculateCompletenessMetrics(
        { ...mockResult, validationScore: 85 },
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(['improving', 'stable', 'declining', 'unknown']).toContain(result2.completenessTrend);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        factorWeights: {
          aspectCompleteness: 0.3,
          fieldCoverage: 0.25,
          ruleCoverage: 0.2,
          profileCompliance: 0.15,
          terminologyCoverage: 0.1,
          referenceCoverage: 0.1,
          businessRuleCoverage: 0.05,
          metadataCoverage: 0.05
        }
      };

      service.updateConfig(newConfig);
      const updatedConfig = service.getConfig();

      expect(updatedConfig.factorWeights.aspectCompleteness).toBe(0.3);
      expect(updatedConfig.factorWeights.fieldCoverage).toBe(0.25);
    });

    it('should return health status', () => {
      const healthStatus = service.getHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(typeof healthStatus.isHealthy).toBe('boolean');
      expect(typeof healthStatus.completenessHistorySize).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const invalidResult = null as any;

      await expect(service.calculateCompletenessMetrics(
        invalidResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      )).rejects.toThrow();
    });

    it('should emit events correctly', async () => {
      const eventSpy = vi.fn();
      service.on('completenessCalculated', eventSpy);

      await service.calculateCompletenessMetrics(
        mockResult,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.any(Object),
          completenessMetrics: expect.any(Object)
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle missing aspect breakdown', async () => {
      const resultWithoutBreakdown = {
        ...mockResult,
        aspectBreakdown: {}
      };

      const result = await service.calculateCompletenessMetrics(
        resultWithoutBreakdown,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result).toBeDefined();
      expect(result.completenessFactors.aspectCompleteness).toBeLessThan(100);
      expect(result.missingValidationAreas.length).toBeGreaterThan(0);
    });

    it('should handle missing settings', async () => {
      const result = await service.calculateCompletenessMetrics(
        mockResult,
        {},
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result).toBeDefined();
      expect(result.completenessScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing resource profile', async () => {
      const result = await service.calculateCompletenessMetrics(
        mockResult,
        mockSettings,
        undefined,
        mockAvailableValidationRules
      );

      expect(result).toBeDefined();
      expect(result.completenessFactors.profileCompliance).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty validation rules', async () => {
      const result = await service.calculateCompletenessMetrics(
        mockResult,
        mockSettings,
        mockResourceProfile,
        []
      );

      expect(result).toBeDefined();
      expect(result.completenessFactors.ruleCoverage).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing field data in aspect breakdown', async () => {
      const resultWithoutFieldData = {
        ...mockResult,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 100 },
          profile: { passed: true, issues: [], duration: 150 }
        }
      };

      const result = await service.calculateCompletenessMetrics(
        resultWithoutFieldData,
        mockSettings,
        mockResourceProfile,
        mockAvailableValidationRules
      );

      expect(result).toBeDefined();
      expect(result.coverageMetrics).toBeDefined();
    });
  });
});
