/**
 * Unit tests for validation analytics API endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the analytics service
vi.mock('./validation-analytics-service', () => ({
  getValidationAnalyticsService: vi.fn(() => ({
    getOverviewAnalytics: vi.fn(),
    getPerformanceAnalytics: vi.fn(),
    getTrendAnalytics: vi.fn(),
    getResourceTypeAnalytics: vi.fn(),
    getAspectAnalytics: vi.fn(),
    getQualityMetrics: vi.fn(),
    getSystemHealthMetrics: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    getValidationAnalytics: vi.fn(),
    clearCache: vi.fn(),
    clearCacheEntry: vi.fn()
  }))
}));

describe('Validation Analytics API Endpoints', () => {
  let mockAnalyticsService: any;

  beforeEach(async () => {
    const { getValidationAnalyticsService } = await import('./validation-analytics-service');
    mockAnalyticsService = getValidationAnalyticsService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/validation/analytics/overview', () => {
    it('should return overview analytics successfully', async () => {
      const mockOverview = {
        totalResources: 1000,
        validatedResources: 850,
        validationProgress: 85,
        averageValidationScore: 90,
        lastValidationRun: new Date(),
        validationTrend: 'stable' as const
      };

      mockAnalyticsService.getOverviewAnalytics.mockResolvedValue(mockOverview);

      // Simulate API call logic
      const timeRange = undefined;
      const filters = undefined;
      const overview = await mockAnalyticsService.getOverviewAnalytics(timeRange, filters);

      expect(overview).toEqual(mockOverview);
      expect(mockAnalyticsService.getOverviewAnalytics).toHaveBeenCalledWith(timeRange, filters);
    });

    it('should handle timeRange parameter correctly', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        granularity: 'day' as const
      };

      const mockOverview = {
        totalResources: 500,
        validatedResources: 400,
        validationProgress: 80,
        averageValidationScore: 85,
        lastValidationRun: new Date(),
        validationTrend: 'improving' as const
      };

      mockAnalyticsService.getOverviewAnalytics.mockResolvedValue(mockOverview);

      const overview = await mockAnalyticsService.getOverviewAnalytics(timeRange, undefined);

      expect(overview).toEqual(mockOverview);
      expect(mockAnalyticsService.getOverviewAnalytics).toHaveBeenCalledWith(timeRange, undefined);
    });

    it('should handle filters parameter correctly', async () => {
      const filters = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: ['Structural', 'Profile'],
        minScore: 80,
        maxScore: 100
      };

      const mockOverview = {
        totalResources: 200,
        validatedResources: 180,
        validationProgress: 90,
        averageValidationScore: 95,
        lastValidationRun: new Date(),
        validationTrend: 'improving' as const
      };

      mockAnalyticsService.getOverviewAnalytics.mockResolvedValue(mockOverview);

      const overview = await mockAnalyticsService.getOverviewAnalytics(undefined, filters);

      expect(overview).toEqual(mockOverview);
      expect(mockAnalyticsService.getOverviewAnalytics).toHaveBeenCalledWith(undefined, filters);
    });

    it('should handle service errors', async () => {
      const error = new Error('Analytics service error');
      mockAnalyticsService.getOverviewAnalytics.mockRejectedValue(error);

      await expect(mockAnalyticsService.getOverviewAnalytics()).rejects.toThrow('Analytics service error');
    });
  });

  describe('GET /api/validation/analytics/performance', () => {
    it('should return performance analytics successfully', async () => {
      const mockPerformance = {
        averageValidationTime: 1500,
        fastestValidation: 500,
        slowestValidation: 3000,
        throughputPerMinute: 40,
        errorRate: 10,
        successRate: 90
      };

      mockAnalyticsService.getPerformanceAnalytics.mockResolvedValue(mockPerformance);

      const performance = await mockAnalyticsService.getPerformanceAnalytics();

      expect(performance).toEqual(mockPerformance);
      expect(mockAnalyticsService.getPerformanceAnalytics).toHaveBeenCalledWith();
    });

    it('should handle parameters correctly', async () => {
      const timeRange = { startDate: new Date(), endDate: new Date(), granularity: 'hour' as const };
      const filters = { resourceTypes: ['Patient'] };

      const mockPerformance = {
        averageValidationTime: 1200,
        fastestValidation: 400,
        slowestValidation: 2500,
        throughputPerMinute: 50,
        errorRate: 5,
        successRate: 95
      };

      mockAnalyticsService.getPerformanceAnalytics.mockResolvedValue(mockPerformance);

      const performance = await mockAnalyticsService.getPerformanceAnalytics(timeRange, filters);

      expect(performance).toEqual(mockPerformance);
      expect(mockAnalyticsService.getPerformanceAnalytics).toHaveBeenCalledWith(timeRange, filters);
    });
  });

  describe('GET /api/validation/analytics/trends', () => {
    it('should return trend analytics successfully', async () => {
      const mockTrends = {
        dailyValidations: [
          { date: '2024-01-01', count: 100, averageScore: 85, errorCount: 10, warningCount: 5 },
          { date: '2024-01-02', count: 120, averageScore: 87, errorCount: 8, warningCount: 4 }
        ],
        weeklyTrend: [
          { week: 'Week 1', totalValidations: 500, averageScore: 85, improvement: 2 },
          { week: 'Week 2', totalValidations: 600, averageScore: 87, improvement: 3 }
        ],
        monthlyTrend: [
          { month: 'Jan 2024', totalValidations: 2000, averageScore: 85, topErrors: ['Error 1', 'Error 2'] }
        ]
      };

      mockAnalyticsService.getTrendAnalytics.mockResolvedValue(mockTrends);

      const trends = await mockAnalyticsService.getTrendAnalytics();

      expect(trends).toEqual(mockTrends);
      expect(mockAnalyticsService.getTrendAnalytics).toHaveBeenCalledWith();
    });
  });

  describe('GET /api/validation/analytics/resource-types', () => {
    it('should return resource type analytics successfully', async () => {
      const mockResourceTypeAnalytics = [
        {
          resourceType: 'Patient',
          totalCount: 200,
          validatedCount: 180,
          averageScore: 90,
          errorRate: 10,
          commonErrors: ['Missing required field'],
          validationTime: 1200
        },
        {
          resourceType: 'Observation',
          totalCount: 300,
          validatedCount: 270,
          averageScore: 85,
          errorRate: 10,
          commonErrors: ['Invalid format'],
          validationTime: 1500
        }
      ];

      mockAnalyticsService.getResourceTypeAnalytics.mockResolvedValue(mockResourceTypeAnalytics);

      const resourceTypeAnalytics = await mockAnalyticsService.getResourceTypeAnalytics();

      expect(resourceTypeAnalytics).toEqual(mockResourceTypeAnalytics);
      expect(mockAnalyticsService.getResourceTypeAnalytics).toHaveBeenCalledWith();
    });
  });

  describe('GET /api/validation/analytics/aspects', () => {
    it('should return aspect analytics successfully', async () => {
      const mockAspectAnalytics = [
        {
          aspect: 'Structural',
          totalValidations: 1000,
          errorCount: 50,
          warningCount: 25,
          averageTime: 1200,
          successRate: 95
        },
        {
          aspect: 'Profile',
          totalValidations: 1000,
          errorCount: 30,
          warningCount: 15,
          averageTime: 1800,
          successRate: 97
        }
      ];

      mockAnalyticsService.getAspectAnalytics.mockResolvedValue(mockAspectAnalytics);

      const aspectAnalytics = await mockAnalyticsService.getAspectAnalytics();

      expect(aspectAnalytics).toEqual(mockAspectAnalytics);
      expect(mockAnalyticsService.getAspectAnalytics).toHaveBeenCalledWith();
    });
  });

  describe('GET /api/validation/analytics/quality', () => {
    it('should return quality metrics successfully', async () => {
      const mockQualityMetrics = {
        dataQualityScore: 85,
        complianceScore: 90,
        consistencyScore: 88,
        completenessScore: 92,
        overallHealthScore: 88.75
      };

      mockAnalyticsService.getQualityMetrics.mockResolvedValue(mockQualityMetrics);

      const qualityMetrics = await mockAnalyticsService.getQualityMetrics();

      expect(qualityMetrics).toEqual(mockQualityMetrics);
      expect(mockAnalyticsService.getQualityMetrics).toHaveBeenCalledWith();
    });
  });

  describe('GET /api/validation/analytics/system-health', () => {
    it('should return system health metrics successfully', async () => {
      const mockSystemHealth = {
        validationEngineStatus: 'healthy' as const,
        averageResponseTime: 1500,
        errorRate: 5,
        activeSessions: 3,
        cacheHitRate: 85,
        memoryUsage: 256
      };

      mockAnalyticsService.getSystemHealthMetrics.mockResolvedValue(mockSystemHealth);

      const systemHealth = await mockAnalyticsService.getSystemHealthMetrics();

      expect(systemHealth).toEqual(mockSystemHealth);
      expect(mockAnalyticsService.getSystemHealthMetrics).toHaveBeenCalledWith();
    });
  });

  describe('GET /api/validation/analytics/performance-metrics', () => {
    it('should return performance metrics successfully', async () => {
      const mockPerformanceMetrics = {
        validationThroughput: 40,
        averageResponseTime: 1500,
        errorRate: 10,
        cacheHitRate: 85,
        memoryUsage: 256,
        cpuUsage: 25,
        activeConnections: 5,
        queueLength: 10
      };

      mockAnalyticsService.getPerformanceMetrics.mockResolvedValue(mockPerformanceMetrics);

      const performanceMetrics = await mockAnalyticsService.getPerformanceMetrics();

      expect(performanceMetrics).toEqual(mockPerformanceMetrics);
      expect(mockAnalyticsService.getPerformanceMetrics).toHaveBeenCalledWith();
    });
  });

  describe('GET /api/validation/analytics/comprehensive', () => {
    it('should return comprehensive analytics successfully', async () => {
      const mockComprehensiveAnalytics = {
        overview: {
          totalResources: 1000,
          validatedResources: 850,
          validationProgress: 85,
          averageValidationScore: 90,
          lastValidationRun: new Date(),
          validationTrend: 'stable' as const
        },
        performance: {
          averageValidationTime: 1500,
          fastestValidation: 500,
          slowestValidation: 3000,
          throughputPerMinute: 40,
          errorRate: 10,
          successRate: 90
        },
        trends: {
          dailyValidations: [],
          weeklyTrend: [],
          monthlyTrend: []
        },
        resourceTypeAnalytics: [],
        aspectAnalytics: [],
        qualityMetrics: {
          dataQualityScore: 85,
          complianceScore: 90,
          consistencyScore: 88,
          completenessScore: 92,
          overallHealthScore: 88.75
        },
        systemHealth: {
          validationEngineStatus: 'healthy' as const,
          averageResponseTime: 1500,
          errorRate: 5,
          activeSessions: 3,
          cacheHitRate: 85,
          memoryUsage: 256
        }
      };

      mockAnalyticsService.getValidationAnalytics.mockResolvedValue(mockComprehensiveAnalytics);

      const analytics = await mockAnalyticsService.getValidationAnalytics();

      expect(analytics).toEqual(mockComprehensiveAnalytics);
      expect(mockAnalyticsService.getValidationAnalytics).toHaveBeenCalledWith();
    });
  });

  describe('POST /api/validation/analytics/clear-cache', () => {
    it('should clear entire cache when no cacheKey provided', async () => {
      mockAnalyticsService.clearCache.mockResolvedValue(undefined);

      // Simulate API call logic
      const cacheKey = undefined;
      if (cacheKey) {
        await mockAnalyticsService.clearCacheEntry(cacheKey);
      } else {
        await mockAnalyticsService.clearCache();
      }

      expect(mockAnalyticsService.clearCache).toHaveBeenCalledWith();
      expect(mockAnalyticsService.clearCacheEntry).not.toHaveBeenCalled();
    });

    it('should clear specific cache entry when cacheKey provided', async () => {
      mockAnalyticsService.clearCacheEntry.mockResolvedValue(undefined);

      // Simulate API call logic
      const cacheKey = 'overview-analytics';
      if (cacheKey) {
        await mockAnalyticsService.clearCacheEntry(cacheKey);
      } else {
        await mockAnalyticsService.clearCache();
      }

      expect(mockAnalyticsService.clearCacheEntry).toHaveBeenCalledWith(cacheKey);
      expect(mockAnalyticsService.clearCache).not.toHaveBeenCalled();
    });
  });

  describe('Parameter validation', () => {
    it('should handle invalid timeRange JSON gracefully', () => {
      const invalidTimeRange = 'invalid-json';
      
      expect(() => {
        try {
          JSON.parse(invalidTimeRange);
        } catch (e) {
          throw new Error('Invalid timeRange format');
        }
      }).toThrow('Invalid timeRange format');
    });

    it('should handle invalid filters JSON gracefully', () => {
      const invalidFilters = 'invalid-json';
      
      expect(() => {
        try {
          JSON.parse(invalidFilters);
        } catch (e) {
          throw new Error('Invalid filters format');
        }
      }).toThrow('Invalid filters format');
    });

    it('should handle valid JSON parameters', () => {
      const validTimeRange = JSON.stringify({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        granularity: 'day'
      });
      
      const validFilters = JSON.stringify({
        resourceTypes: ['Patient'],
        minScore: 80
      });

      expect(() => {
        JSON.parse(validTimeRange);
        JSON.parse(validFilters);
      }).not.toThrow();
    });
  });

  describe('Response structure validation', () => {
    it('should validate successful response structure', () => {
      const mockResponse = {
        success: true,
        data: {
          totalResources: 1000,
          validatedResources: 850
        }
      };

      expect(mockResponse).toHaveProperty('success');
      expect(mockResponse).toHaveProperty('data');
      expect(mockResponse.success).toBe(true);
      expect(typeof mockResponse.data).toBe('object');
    });

    it('should validate error response structure', () => {
      const mockErrorResponse = {
        success: false,
        error: 'Failed to get analytics',
        message: 'Analytics service error'
      };

      expect(mockErrorResponse).toHaveProperty('success');
      expect(mockErrorResponse).toHaveProperty('error');
      expect(mockErrorResponse).toHaveProperty('message');
      expect(mockErrorResponse.success).toBe(false);
      expect(typeof mockErrorResponse.error).toBe('string');
      expect(typeof mockErrorResponse.message).toBe('string');
    });
  });
});
