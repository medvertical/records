/**
 * Unit tests for Validation Quality Metrics Service
 * 
 * Tests comprehensive quality metrics calculation including accuracy,
 * completeness, consistency, performance, and reliability scoring.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ValidationQualityMetricsService } from './validation-quality-metrics-service';
import type { 
  ValidationQualityMetrics,
  ValidationQualityConfig 
} from '@shared/types/validation';

// Mock storage
vi.mock('../../storage', () => ({
  storage: {
    getValidationResults: vi.fn(),
    getValidationHistory: vi.fn(),
    getValidationSettings: vi.fn()
  }
}));

describe('ValidationQualityMetricsService', () => {
  let service: ValidationQualityMetricsService;
  let mockConfig: ValidationQualityConfig;

  // Helper function to generate sufficient mock data
  const generateMockResults = (count: number = 5) => {
    const results = [];
    for (let i = 1; i <= count; i++) {
      results.push({
        id: i.toString(),
        resourceType: 'Patient',
        isValid: i % 4 !== 0, // Some invalid results
        validationScore: 85 + (i % 3) * 5, // Vary scores
        errorCount: i % 3 === 0 ? 2 : 0,
        warningCount: i % 2 === 0 ? 1 : 0,
        aspectBreakdown: {
          structural: { passed: true, issues: [], duration: 100 + i * 10 },
          profile: { passed: true, issues: [], duration: 150 + i * 10 },
          terminology: { passed: true, issues: [], duration: 200 + i * 10 },
          reference: { passed: true, issues: [], duration: 120 + i * 10 },
          businessRule: { passed: true, issues: [], duration: 180 + i * 10 },
          metadata: { passed: true, issues: [], duration: 80 + i * 10 }
        },
        validatedAt: new Date(`2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`),
        settingsUsed: {}
      });
    }
    return results;
  };

  beforeEach(() => {
    mockConfig = {
      thresholds: {
        excellent: 90,
        good: 80,
        acceptable: 70,
        poor: 60
      },
      weights: {
        accuracy: 0.3,
        completeness: 0.25,
        consistency: 0.2,
        performance: 0.15,
        reliability: 0.1
      },
      minSampleSize: 5,
      trendAnalysisWindow: 30,
      enableRecommendations: true,
      monitoringInterval: 15
    };

    service = new ValidationQualityMetricsService(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateQualityMetrics', () => {
    it('should calculate quality metrics with sufficient data', async () => {
      const mockResults = generateMockResults(5);

      // Mock the service's private method
      const getValidationResultsSpy = vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await service.calculateQualityMetrics(timeRange);

      expect(getValidationResultsSpy).toHaveBeenCalledWith(timeRange, undefined);
      expect(result).toBeDefined();
      expect(result.overallQualityScore).toBeGreaterThan(0);
      expect(result.accuracy).toBeDefined();
      expect(result.completeness).toBeDefined();
      expect(result.consistency).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.reliability).toBeDefined();
      expect(result.aspectQualityScores).toBeDefined();
      expect(result.qualityTrends).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should throw error with insufficient data', async () => {
      const mockResults = [
        {
          id: '1',
          resourceType: 'Patient',
          isValid: true,
          validationScore: 95,
          errorCount: 0,
          warningCount: 1,
          aspectBreakdown: {},
          validatedAt: new Date('2024-01-01T10:00:00Z'),
          settingsUsed: {}
        }
      ];

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      await expect(service.calculateQualityMetrics(timeRange))
        .rejects.toThrow('Insufficient data for quality calculation');
    });

    it('should calculate accuracy metrics correctly', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await service.calculateQualityMetrics(timeRange);

      expect(result.accuracy).toBeDefined();
      expect(result.accuracy.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy.accuracy).toBeLessThanOrEqual(100);
      expect(result.accuracy.precision).toBeGreaterThanOrEqual(0);
      expect(result.accuracy.precision).toBeLessThanOrEqual(1);
      expect(result.accuracy.recall).toBeGreaterThanOrEqual(0);
      expect(result.accuracy.recall).toBeLessThanOrEqual(1);
      expect(result.accuracy.f1Score).toBeGreaterThanOrEqual(0);
      expect(result.accuracy.f1Score).toBeLessThanOrEqual(1);
      expect(result.accuracy.confidence).toBeGreaterThanOrEqual(0);
      expect(result.accuracy.confidence).toBeLessThanOrEqual(100);
    });

    it('should calculate completeness metrics correctly', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await service.calculateQualityMetrics(timeRange);

      expect(result.completeness).toBeDefined();
      expect(result.completeness.fullValidationCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completeness.fullValidationCoverage).toBeLessThanOrEqual(100);
      expect(result.completeness.aspectCoverage).toBeGreaterThanOrEqual(0);
      expect(result.completeness.aspectCoverage).toBeLessThanOrEqual(100);
      expect(result.completeness.completenessScore).toBeGreaterThanOrEqual(0);
      expect(result.completeness.completenessScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.completeness.missingAreas)).toBe(true);
    });

    it('should calculate consistency metrics correctly', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await service.calculateQualityMetrics(timeRange);

      expect(result.consistency).toBeDefined();
      expect(result.consistency.runConsistency).toBeGreaterThanOrEqual(0);
      expect(result.consistency.runConsistency).toBeLessThanOrEqual(100);
      expect(result.consistency.resourceConsistency).toBeGreaterThanOrEqual(0);
      expect(result.consistency.resourceConsistency).toBeLessThanOrEqual(100);
      expect(result.consistency.aspectConsistency).toBeGreaterThanOrEqual(0);
      expect(result.consistency.aspectConsistency).toBeLessThanOrEqual(100);
      expect(result.consistency.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(result.consistency.consistencyScore).toBeLessThanOrEqual(100);
      expect(typeof result.consistency.scoreStandardDeviation).toBe('number');
      expect(typeof result.consistency.coefficientOfVariation).toBe('number');
      expect(typeof result.consistency.inconsistentValidations).toBe('number');
    });

    it('should calculate performance metrics correctly', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await service.calculateQualityMetrics(timeRange);

      expect(result.performance).toBeDefined();
      expect(result.performance.averageValidationTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.medianValidationTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.p95ValidationTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.throughput).toBeGreaterThanOrEqual(0);
      expect(result.performance.resourceUtilization).toBeGreaterThanOrEqual(0);
      expect(result.performance.resourceUtilization).toBeLessThanOrEqual(100);
      expect(result.performance.memoryEfficiency).toBeGreaterThanOrEqual(0);
      expect(result.performance.memoryEfficiency).toBeLessThanOrEqual(100);
      expect(result.performance.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.performance.performanceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.performance.bottlenecks)).toBe(true);
    });

    it('should calculate reliability metrics correctly', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await service.calculateQualityMetrics(timeRange);

      expect(result.reliability).toBeDefined();
      expect(result.reliability.uptime).toBeGreaterThanOrEqual(0);
      expect(result.reliability.uptime).toBeLessThanOrEqual(100);
      expect(result.reliability.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.reliability.errorRate).toBeLessThanOrEqual(100);
      expect(result.reliability.recoveryTime).toBeGreaterThanOrEqual(0);
      expect(result.reliability.retrySuccessRate).toBeGreaterThanOrEqual(0);
      expect(result.reliability.retrySuccessRate).toBeLessThanOrEqual(100);
      expect(result.reliability.dataIntegrity).toBeGreaterThanOrEqual(0);
      expect(result.reliability.dataIntegrity).toBeLessThanOrEqual(100);
      expect(result.reliability.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.reliability.reliabilityScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.reliability.reliabilityIssues)).toBe(true);
    });

    it('should generate quality recommendations when enabled', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await service.calculateQualityMetrics(timeRange);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Check recommendation structure
      result.recommendations.forEach(rec => {
        expect(rec.id).toBeDefined();
        expect(rec.type).toBeDefined();
        expect(rec.priority).toBeDefined();
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.expectedImpact).toBeGreaterThanOrEqual(0);
        expect(rec.effort).toBeDefined();
        expect(Array.isArray(rec.relatedAspects)).toBe(true);
        expect(Array.isArray(rec.actionItems)).toBe(true);
      });
    });

    it('should not generate recommendations when disabled', async () => {
      const serviceWithoutRecommendations = new ValidationQualityMetricsService({
        ...mockConfig,
        enableRecommendations: false
      });

      const mockResults = generateMockResults(5);

      vi.spyOn(serviceWithoutRecommendations as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const result = await serviceWithoutRecommendations.calculateQualityMetrics(timeRange);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBe(0);
    });
  });

  describe('generateQualityReport', () => {
    it('should generate comprehensive quality report', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const report = await service.generateQualityReport(timeRange);

      expect(report).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period).toEqual(timeRange);
      expect(report.qualityMetrics).toBeDefined();
      expect(report.qualityGrade).toMatch(/^[A-F]$/);
      expect(['excellent', 'good', 'acceptable', 'poor', 'unacceptable']).toContain(report.status);
      expect(Array.isArray(report.keyFindings)).toBe(true);
      expect(typeof report.trendsSummary).toBe('string');
      expect(Array.isArray(report.topRecommendations)).toBe(true);
      expect(report.benchmarkComparison).toBeDefined();
      expect(report.resourceTypeQuality).toBeDefined();
      expect(Array.isArray(report.qualityHistory)).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        thresholds: {
          excellent: 95,
          good: 85,
          acceptable: 75,
          poor: 65
        }
      };

      service.updateConfig(newConfig);
      const updatedConfig = service.getConfig();

      expect(updatedConfig.thresholds.excellent).toBe(95);
      expect(updatedConfig.thresholds.good).toBe(85);
      expect(updatedConfig.thresholds.acceptable).toBe(75);
      expect(updatedConfig.thresholds.poor).toBe(65);
    });

    it('should return health status', () => {
      const healthStatus = service.getHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(typeof healthStatus.isHealthy).toBe('boolean');
      expect(typeof healthStatus.lastCalculated).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      vi.spyOn(service as any, 'getValidationResults')
        .mockRejectedValue(new Error('Database connection failed'));

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      await expect(service.calculateQualityMetrics(timeRange))
        .rejects.toThrow('Database connection failed');
    });

    it('should emit events correctly', async () => {
      const mockResults = generateMockResults(5);

      vi.spyOn(service as any, 'getValidationResults')
        .mockResolvedValue(mockResults);

      const eventSpy = vi.fn();
      service.on('qualityMetricsCalculated', eventSpy);

      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      await service.calculateQualityMetrics(timeRange);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          qualityMetrics: expect.any(Object),
          timeRange: expect.any(Object)
        })
      );
    });
  });
});
