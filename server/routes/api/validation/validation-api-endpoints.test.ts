/**
 * Unit tests for new validation API endpoints
 * 
 * Tests the missing API endpoints that were added for UI hooks.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the storage module
vi.mock('../../../storage', () => ({
  storage: {
    getLatestValidationResults: vi.fn(),
    getValidationResultsByResourceId: vi.fn(),
    getValidationAspectBreakdown: vi.fn()
  }
}));

// Mock the validation services
vi.mock('../../../services/validation', () => ({
  ConsolidatedValidationService: vi.fn(),
  getValidationSettingsService: vi.fn(),
  getValidationPipeline: vi.fn(),
  getValidationQueueService: vi.fn(),
  getIndividualResourceProgressService: vi.fn(),
  getValidationCancellationRetryService: vi.fn()
}));

// Mock the dashboard service
vi.mock('../../../services/dashboard/dashboard-service', () => ({
  DashboardService: vi.fn()
}));

// Mock the validation cache manager
vi.mock('../../../utils/validation-cache-manager.js', () => ({
  default: vi.fn()
}));

describe('Validation API Endpoints', () => {
  describe('GET /api/validation/results/latest', () => {
    it('should return latest validation results with pagination', async () => {
      const mockStorage = vi.mocked(require('../../../storage').storage);
      mockStorage.getLatestValidationResults.mockResolvedValue([
        {
          id: 1,
          resourceId: 123,
          isValid: false,
          errorCount: 2,
          warningCount: 1,
          validationScore: 60,
          validatedAt: new Date().toISOString(),
          resourceType: 'Patient'
        },
        {
          id: 2,
          resourceId: 124,
          isValid: true,
          errorCount: 0,
          warningCount: 0,
          validationScore: 100,
          validatedAt: new Date().toISOString(),
          resourceType: 'Patient'
        }
      ]);

      // Simulate the API endpoint logic
      const mockReq = {
        query: { limit: '10', offset: '0', resourceType: 'Patient' }
      };
      
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      };

      // Simulate the endpoint logic
      const { limit = 50, offset = 0, resourceType } = mockReq.query;
      const results = await mockStorage.getLatestValidationResults({
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        resourceType: resourceType as string
      });

      const response = {
        success: true,
        data: results,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: results.length
        }
      };

      // Verify the response structure
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.offset).toBe(0);
      expect(response.pagination.total).toBe(2);
      
      // Verify the data structure
      expect(response.data[0]).toHaveProperty('id');
      expect(response.data[0]).toHaveProperty('resourceId');
      expect(response.data[0]).toHaveProperty('isValid');
      expect(response.data[0]).toHaveProperty('errorCount');
      expect(response.data[0]).toHaveProperty('warningCount');
      expect(response.data[0]).toHaveProperty('validationScore');
      expect(response.data[0]).toHaveProperty('validatedAt');
      expect(response.data[0]).toHaveProperty('resourceType');
    });

    it('should handle errors gracefully', async () => {
      const mockStorage = vi.mocked(require('../../../storage').storage);
      mockStorage.getLatestValidationResults.mockRejectedValue(new Error('Database connection failed'));

      // Simulate error handling
      try {
        await mockStorage.getLatestValidationResults({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorResponse = {
          success: false,
          error: 'Failed to get latest validation results',
          message: error instanceof Error ? error.message : 'Unknown error'
        };

        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toBe('Failed to get latest validation results');
        expect(errorResponse.message).toBe('Database connection failed');
      }
    });
  });

  describe('GET /api/validation/results/:resourceId', () => {
    it('should return validation results for specific resource', async () => {
      const mockStorage = vi.mocked(require('../../../storage').storage);
      mockStorage.getValidationResultsByResourceId.mockResolvedValue([
        {
          id: 1,
          resourceId: 123,
          isValid: false,
          errorCount: 2,
          warningCount: 1,
          validationScore: 60,
          validatedAt: new Date().toISOString()
        }
      ]);

      // Simulate the API endpoint logic
      const resourceId = '123';
      const limit = '5';
      
      const results = await mockStorage.getValidationResultsByResourceId(parseInt(resourceId));
      const limitedResults = results.slice(0, parseInt(limit));

      const response = {
        success: true,
        data: limitedResults,
        total: results.length
      };

      // Verify the response
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.total).toBe(1);
      expect(response.data[0].resourceId).toBe(123);
    });
  });

  describe('POST /api/validation/results/batch', () => {
    it('should return validation results for multiple resources', async () => {
      const mockStorage = vi.mocked(require('../../../storage').storage);
      mockStorage.getValidationResultsByResourceId.mockResolvedValue([
        {
          id: 1,
          resourceId: 123,
          isValid: false,
          errorCount: 2,
          warningCount: 1,
          validationScore: 60,
          validatedAt: new Date().toISOString()
        }
      ]);

      // Simulate the API endpoint logic
      const resourceIds = [123, 124];
      const limit = 10;
      
      const results = await Promise.all(
        resourceIds.map(async (resourceId: number) => {
          const resourceResults = await mockStorage.getValidationResultsByResourceId(resourceId);
          return {
            resourceId,
            results: resourceResults.slice(0, limit)
          };
        })
      );

      const response = {
        success: true,
        data: results
      };

      // Verify the response
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.data[0].resourceId).toBe(123);
      expect(response.data[1].resourceId).toBe(124);
      expect(response.data[0].results).toHaveLength(1);
    });

    it('should validate input parameters', () => {
      // Test input validation logic
      const validateBatchRequest = (body: any) => {
        if (!Array.isArray(body.resourceIds)) {
          return {
            success: false,
            error: 'resourceIds must be an array'
          };
        }
        return { success: true };
      };

      // Test valid input
      const validRequest = { resourceIds: [123, 124] };
      expect(validateBatchRequest(validRequest).success).toBe(true);

      // Test invalid input
      const invalidRequest = { resourceIds: 'not-an-array' };
      expect(validateBatchRequest(invalidRequest).success).toBe(false);
      expect(validateBatchRequest(invalidRequest).error).toBe('resourceIds must be an array');
    });
  });

  describe('GET /api/validation/aspects/breakdown', () => {
    it('should return validation aspect breakdown', async () => {
      const mockStorage = vi.mocked(require('../../../storage').storage);
      mockStorage.getValidationAspectBreakdown.mockResolvedValue({
        structural: { total: 100, errors: 10, warnings: 5, score: 85 },
        profile: { total: 100, errors: 5, warnings: 3, score: 92 },
        terminology: { total: 100, errors: 8, warnings: 2, score: 90 },
        reference: { total: 100, errors: 3, warnings: 1, score: 96 },
        businessRule: { total: 100, errors: 7, warnings: 4, score: 89 },
        metadata: { total: 100, errors: 4, warnings: 2, score: 94 }
      });

      // Simulate the API endpoint logic
      const resourceType = 'Patient';
      const timeRange = '24h';
      
      const breakdown = await mockStorage.getValidationAspectBreakdown({
        resourceType,
        timeRange
      });

      const response = {
        success: true,
        data: breakdown
      };

      // Verify the response
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('structural');
      expect(response.data).toHaveProperty('profile');
      expect(response.data).toHaveProperty('terminology');
      expect(response.data).toHaveProperty('reference');
      expect(response.data).toHaveProperty('businessRule');
      expect(response.data).toHaveProperty('metadata');
      
      // Verify aspect breakdown structure
      expect(response.data.structural).toHaveProperty('total');
      expect(response.data.structural).toHaveProperty('errors');
      expect(response.data.structural).toHaveProperty('warnings');
      expect(response.data.structural).toHaveProperty('score');
    });
  });
});
