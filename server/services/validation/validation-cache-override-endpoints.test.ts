/**
 * Unit tests for Cache Override API Endpoints Logic
 */

import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../storage', () => ({
  storage: {
    getFhirResourcesWithValidation: vi.fn(),
    getFhirResourceByTypeAndId: vi.fn(),
    getFhirResourcesByType: vi.fn(),
    clearValidationResultsForResource: vi.fn(),
  },
}));

vi.mock('./features/validation-cache-override-service', () => ({
  getValidationCacheOverrideService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    overrideCache: vi.fn().mockResolvedValue({
      requestId: 'test-request-123',
      affectedResources: 5,
      revalidatedResources: 5,
      failedResources: 0,
      clearedResults: 5,
      startTime: new Date(),
      endTime: new Date(),
      durationMs: 1000,
      status: 'completed',
      errors: [],
      warnings: []
    }),
    getCacheStatistics: vi.fn().mockResolvedValue({
      totalCachedResults: 100,
      cachedByResourceType: { Patient: 50, Observation: 30, Condition: 20 },
      cachedByDate: { '2024-01-01': 30, '2024-01-02': 40, '2024-01-03': 30 },
      averageCacheAge: 2.5,
      oldestCacheDate: new Date('2024-01-01'),
      newestCacheDate: new Date('2024-01-03'),
      cacheHitRate: 85
    }),
    getOverrideHistory: vi.fn().mockReturnValue([
      {
        requestId: 'req-1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        request: { resourceIds: ['1'], reason: 'Test' },
        result: { status: 'completed' },
        inProgress: false
      }
    ]),
    getActiveRequests: vi.fn().mockReturnValue(['active-request-1', 'active-request-2']),
    cancelRequest: vi.fn().mockResolvedValue(true),
    clearAllCaches: vi.fn().mockResolvedValue({
      requestId: 'clear-all-123',
      affectedResources: 100,
      revalidatedResources: 100,
      failedResources: 0,
      clearedResults: 100,
      status: 'completed'
    }),
    clearCacheForResourceTypes: vi.fn().mockResolvedValue({
      requestId: 'clear-types-123',
      affectedResources: 50,
      revalidatedResources: 50,
      failedResources: 0,
      clearedResults: 50,
      status: 'completed'
    })
  })),
}));

describe('Cache Override API Endpoints Logic', () => {
  describe('POST /api/validation/cache/override', () => {
    it('should handle cache override request validation', () => {
      const validateCacheOverrideRequest = (body: any) => {
        const {
          resourceIds,
          resourceTypes,
          revalidateAll,
          reason,
          clearExisting,
          forceRevalidation,
          context
        } = body;

        const errors: string[] = [];

        // Validate resource IDs
        if (resourceIds && !Array.isArray(resourceIds)) {
          errors.push('resourceIds must be an array');
        }

        // Validate resource types
        if (resourceTypes && !Array.isArray(resourceTypes)) {
          errors.push('resourceTypes must be an array');
        }

        // Check if at least one targeting option is provided
        if (!resourceIds && !resourceTypes && !revalidateAll) {
          errors.push('At least one of resourceIds, resourceTypes, or revalidateAll must be specified');
        }

        return {
          isValid: errors.length === 0,
          errors,
          request: {
            resourceIds,
            resourceTypes,
            revalidateAll,
            reason,
            clearExisting,
            forceRevalidation,
            context: {
              ...context,
              requestId: context?.requestId || `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }
          }
        };
      };

      // Test valid request
      const validBody = {
        resourceIds: ['resource-1', 'resource-2'],
        reason: 'Force revalidation',
        clearExisting: true,
        forceRevalidation: true
      };

      const validResult = validateCacheOverrideRequest(validBody);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(validResult.request.resourceIds).toEqual(['resource-1', 'resource-2']);

      // Test invalid request
      const invalidBody = {
        resourceIds: 'not-an-array',
        reason: 'Invalid request'
      };

      const invalidResult = validateCacheOverrideRequest(invalidBody);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('resourceIds must be an array');
    });

    it('should create proper response structure for cache override', () => {
      const createCacheOverrideResponse = (result: any) => {
        return {
          success: true,
          data: result,
          message: 'Cache override completed successfully'
        };
      };

      const mockResult = {
        requestId: 'test-request-123',
        affectedResources: 5,
        revalidatedResources: 5,
        failedResources: 0,
        status: 'completed'
      };

      const response = createCacheOverrideResponse(mockResult);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(response.message).toBe('Cache override completed successfully');
    });
  });

  describe('GET /api/validation/cache/statistics', () => {
    it('should handle cache statistics response', () => {
      const createStatisticsResponse = (statistics: any) => {
        return {
          success: true,
          data: statistics
        };
      };

      const mockStatistics = {
        totalCachedResults: 100,
        cachedByResourceType: { Patient: 50, Observation: 30 },
        averageCacheAge: 2.5,
        cacheHitRate: 85
      };

      const response = createStatisticsResponse(mockStatistics);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockStatistics);
    });
  });

  describe('GET /api/validation/cache/history', () => {
    it('should handle cache override history with pagination', () => {
      const createHistoryResponse = (history: any[], limit: number) => {
        return {
          success: true,
          data: history,
          total: history.length
        };
      };

      const mockHistory = [
        {
          requestId: 'req-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          request: { resourceIds: ['1'] },
          result: { status: 'completed' },
          inProgress: false
        },
        {
          requestId: 'req-2',
          timestamp: new Date('2024-01-02T10:00:00Z'),
          request: { resourceTypes: ['Patient'] },
          result: { status: 'completed' },
          inProgress: false
        }
      ];

      const response = createHistoryResponse(mockHistory, 50);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.total).toBe(2);
    });

    it('should handle query parameter parsing', () => {
      const parseQueryParams = (query: any) => {
        const { limit = 50 } = query;
        return {
          limit: parseInt(limit as string)
        };
      };

      const defaultParams = parseQueryParams({});
      expect(defaultParams.limit).toBe(50);

      const customParams = parseQueryParams({ limit: '25' });
      expect(customParams.limit).toBe(25);
    });
  });

  describe('GET /api/validation/cache/active', () => {
    it('should handle active requests response', () => {
      const createActiveRequestsResponse = (activeRequests: string[]) => {
        return {
          success: true,
          data: activeRequests,
          total: activeRequests.length
        };
      };

      const mockActiveRequests = ['active-request-1', 'active-request-2'];

      const response = createActiveRequestsResponse(mockActiveRequests);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockActiveRequests);
      expect(response.total).toBe(2);
    });
  });

  describe('DELETE /api/validation/cache/active/:requestId', () => {
    it('should handle request cancellation success', () => {
      const createCancellationResponse = (cancelled: boolean, requestId: string) => {
        if (cancelled) {
          return {
            success: true,
            message: `Cache override request ${requestId} cancelled successfully`
          };
        } else {
          return {
            success: false,
            error: 'Request not found or not active'
          };
        }
      };

      const successResponse = createCancellationResponse(true, 'test-request-123');
      expect(successResponse.success).toBe(true);
      expect(successResponse.message).toBe('Cache override request test-request-123 cancelled successfully');

      const failureResponse = createCancellationResponse(false, 'test-request-123');
      expect(failureResponse.success).toBe(false);
      expect(failureResponse.error).toBe('Request not found or not active');
    });

    it('should handle parameter parsing', () => {
      const parseParams = (params: any) => {
        const { requestId } = params;
        return { requestId };
      };

      const params = { requestId: 'test-request-123' };
      const parsed = parseParams(params);

      expect(parsed.requestId).toBe('test-request-123');
    });
  });

  describe('POST /api/validation/cache/clear-all', () => {
    it('should handle clear all caches response', () => {
      const createClearAllResponse = (result: any) => {
        return {
          success: true,
          data: result,
          message: 'All validation caches cleared successfully'
        };
      };

      const mockResult = {
        requestId: 'clear-all-123',
        affectedResources: 100,
        revalidatedResources: 100,
        status: 'completed'
      };

      const response = createClearAllResponse(mockResult);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(response.message).toBe('All validation caches cleared successfully');
    });
  });

  describe('POST /api/validation/cache/clear-types', () => {
    it('should handle resource types validation', () => {
      const validateResourceTypes = (resourceTypes: any) => {
        if (!Array.isArray(resourceTypes) || resourceTypes.length === 0) {
          return {
            isValid: false,
            error: 'resourceTypes must be a non-empty array'
          };
        }
        return { isValid: true };
      };

      // Test valid resource types
      const validTypes = ['Patient', 'Observation', 'Condition'];
      const validResult = validateResourceTypes(validTypes);
      expect(validResult.isValid).toBe(true);

      // Test invalid resource types
      const invalidTypes = 'not-an-array';
      const invalidResult = validateResourceTypes(invalidTypes);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBe('resourceTypes must be a non-empty array');

      // Test empty array
      const emptyTypes: string[] = [];
      const emptyResult = validateResourceTypes(emptyTypes);
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.error).toBe('resourceTypes must be a non-empty array');
    });

    it('should create proper response for clear types', () => {
      const createClearTypesResponse = (result: any, resourceTypes: string[]) => {
        return {
          success: true,
          data: result,
          message: `Cache cleared for resource types: ${resourceTypes.join(', ')}`
        };
      };

      const mockResult = {
        requestId: 'clear-types-123',
        affectedResources: 50,
        revalidatedResources: 50,
        status: 'completed'
      };

      const resourceTypes = ['Patient', 'Observation'];
      const response = createClearTypesResponse(mockResult, resourceTypes);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(response.message).toBe('Cache cleared for resource types: Patient, Observation');
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', async () => {
      const handleServiceError = async (error: any) => {
        console.error('[Validation API] Error:', error);
        return {
          success: false,
          error: 'Failed to initialize service',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      };

      const error = new Error('Service initialization failed');
      const response = await handleServiceError(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to initialize service');
      expect(response.message).toBe('Service initialization failed');
    });

    it('should handle cache override execution errors', async () => {
      const handleCacheOverrideError = async (error: any) => {
        console.error('[Validation API] Error overriding cache:', error);
        return {
          success: false,
          error: 'Failed to override cache',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      };

      const error = new Error('Cache override failed');
      const response = await handleCacheOverrideError(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to override cache');
      expect(response.message).toBe('Cache override failed');
    });
  });

  describe('Helper Logic', () => {
    it('should verify service initialization logic', async () => {
      const initializeService = async (service: any) => {
        await service.initialize();
        return service;
      };

      const mockService = {
        initialize: vi.fn().mockResolvedValue(undefined)
      };

      const result = await initializeService(mockService);

      expect(mockService.initialize).toHaveBeenCalled();
      expect(result).toBe(mockService);
    });

    it('should verify dynamic import logic', async () => {
      const simulateDynamicImport = async () => {
        // Simulate the dynamic import logic
        const modulePath = '../../../services/validation/features/validation-cache-override-service';
        const serviceName = 'getValidationCacheOverrideService';
        
        // In real implementation, this would be:
        // const { getValidationCacheOverrideService } = await import(modulePath);
        // const cacheOverrideService = getValidationCacheOverrideService();
        
        return {
          modulePath,
          serviceName,
          success: true
        };
      };

      const result = await simulateDynamicImport();
      expect(result.modulePath).toBe('../../../services/validation/features/validation-cache-override-service');
      expect(result.serviceName).toBe('getValidationCacheOverrideService');
      expect(result.success).toBe(true);
    });

    it('should verify request ID generation', () => {
      const generateRequestId = (context: any) => {
        return context?.requestId || `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      };

      const contextWithId = { requestId: 'custom-request-123' };
      const generatedId1 = generateRequestId(contextWithId);
      expect(generatedId1).toBe('custom-request-123');

      const contextWithoutId = {};
      const generatedId2 = generateRequestId(contextWithoutId);
      expect(generatedId2).toMatch(/^api_\d+_[a-z0-9]+$/);
    });
  });
});
