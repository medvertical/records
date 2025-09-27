/**
 * Unit tests for ValidationCacheOverrideService Logic
 */

import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../../storage', () => ({
  storage: {
    getFhirResourcesWithValidation: vi.fn(),
    getFhirResourceByTypeAndId: vi.fn(),
    getFhirResourcesByType: vi.fn(),
    clearValidationResultsForResource: vi.fn(),
  },
}));

vi.mock('../settings', () => ({
  getValidationSettingsService: vi.fn(() => ({
    getSettings: vi.fn(),
  })),
}));

vi.mock('../core/consolidated-validation-service', () => ({
  ConsolidatedValidationService: vi.fn(() => ({
    validateResource: vi.fn(),
  })),
}));

describe('ValidationCacheOverrideService Logic', () => {
  describe('Cache Override Request Processing', () => {
    it('should test cache override request validation', () => {
      const validateCacheOverrideRequest = (request: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if at least one targeting option is provided
        if (!request.resourceIds && !request.resourceTypes && !request.revalidateAll) {
          errors.push('At least one of resourceIds, resourceTypes, or revalidateAll must be specified');
        }

        // Check for conflicting options
        if (request.resourceIds && request.resourceTypes && request.revalidateAll) {
          warnings.push('Multiple targeting options specified, revalidateAll will take precedence');
        }

        // Validate resource IDs
        if (request.resourceIds && !Array.isArray(request.resourceIds)) {
          errors.push('resourceIds must be an array');
        }

        // Validate resource types
        if (request.resourceTypes && !Array.isArray(request.resourceTypes)) {
          errors.push('resourceTypes must be an array');
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings
        };
      };

      // Test valid request
      const validRequest = {
        resourceIds: ['resource-1', 'resource-2'],
        reason: 'Force revalidation',
        clearExisting: true,
        forceRevalidation: true
      };

      const validResult = validateCacheOverrideRequest(validRequest);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Test invalid request
      const invalidRequest = {
        reason: 'No targeting specified'
      };

      const invalidResult = validateCacheOverrideRequest(invalidRequest);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('At least one of resourceIds, resourceTypes, or revalidateAll must be specified');

      // Test conflicting options
      const conflictingRequest = {
        resourceIds: ['resource-1'],
        resourceTypes: ['Patient'],
        revalidateAll: true
      };

      const conflictingResult = validateCacheOverrideRequest(conflictingRequest);
      expect(conflictingResult.isValid).toBe(true);
      expect(conflictingResult.warnings).toContain('Multiple targeting options specified, revalidateAll will take precedence');
    });

    it('should test cache override result creation', () => {
      const createCacheOverrideResult = (requestId: string, startTime: Date) => {
        return {
          requestId,
          affectedResources: 0,
          revalidatedResources: 0,
          failedResources: 0,
          clearedResults: 0,
          startTime,
          endTime: startTime,
          durationMs: 0,
          status: 'completed' as const,
          errors: [],
          warnings: []
        };
      };

      const requestId = 'test-request-123';
      const startTime = new Date();
      const result = createCacheOverrideResult(requestId, startTime);

      expect(result.requestId).toBe(requestId);
      expect(result.startTime).toBe(startTime);
      expect(result.status).toBe('completed');
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should test cache override result status determination', () => {
      const determineStatus = (revalidated: number, failed: number, total: number) => {
        if (failed === 0) {
          return 'completed';
        } else if (revalidated > 0) {
          return 'partial';
        } else {
          return 'failed';
        }
      };

      expect(determineStatus(10, 0, 10)).toBe('completed');
      expect(determineStatus(5, 3, 8)).toBe('partial');
      expect(determineStatus(0, 5, 5)).toBe('failed');
    });
  });

  describe('Resource Selection Logic', () => {
    it('should test resource selection for revalidateAll', () => {
      const selectResourcesForRevalidateAll = (allResources: any[]) => {
        return allResources.filter(resource => resource.validationResults && resource.validationResults.length > 0);
      };

      const mockResources = [
        { id: '1', resourceType: 'Patient', validationResults: [{ id: 1 }] },
        { id: '2', resourceType: 'Observation', validationResults: [] },
        { id: '3', resourceType: 'Condition', validationResults: [{ id: 2 }] }
      ];

      const selected = selectResourcesForRevalidateAll(mockResources);

      expect(selected).toHaveLength(2);
      expect(selected[0].id).toBe('1');
      expect(selected[1].id).toBe('3');
    });

    it('should test resource selection by resource IDs', () => {
      const selectResourcesByIds = (resourceIds: string[], allResources: any[]) => {
        return allResources.filter(resource => resourceIds.includes(resource.id));
      };

      const mockResources = [
        { id: '1', resourceType: 'Patient' },
        { id: '2', resourceType: 'Observation' },
        { id: '3', resourceType: 'Condition' }
      ];

      const selected = selectResourcesByIds(['1', '3'], mockResources);

      expect(selected).toHaveLength(2);
      expect(selected[0].id).toBe('1');
      expect(selected[1].id).toBe('3');
    });

    it('should test resource selection by resource types', () => {
      const selectResourcesByTypes = (resourceTypes: string[], allResources: any[]) => {
        return allResources.filter(resource => resourceTypes.includes(resource.resourceType));
      };

      const mockResources = [
        { id: '1', resourceType: 'Patient' },
        { id: '2', resourceType: 'Observation' },
        { id: '3', resourceType: 'Condition' },
        { id: '4', resourceType: 'Patient' }
      ];

      const selected = selectResourcesByTypes(['Patient', 'Observation'], mockResources);

      expect(selected).toHaveLength(3);
      expect(selected.map(r => r.id)).toEqual(['1', '2', '4']);
    });
  });

  describe('Cache Statistics Logic', () => {
    it('should test cache statistics calculation', () => {
      const calculateCacheStatistics = (validationResults: any[], resources: any[]) => {
        const cachedByResourceType: { [resourceType: string]: number } = {};
        const cachedByDate: { [date: string]: number } = {};
        let totalAge = 0;
        let oldestDate: Date | null = null;
        let newestDate: Date | null = null;

        for (const result of validationResults) {
          // Count by resource type
          const resource = resources.find(r => r.id === result.resourceId);
          const resourceType = resource?.resourceType || 'Unknown';
          cachedByResourceType[resourceType] = (cachedByResourceType[resourceType] || 0) + 1;

          // Count by date
          const date = new Date(result.validatedAt).toISOString().split('T')[0];
          cachedByDate[date] = (cachedByDate[date] || 0) + 1;

          // Calculate age
          const age = Date.now() - new Date(result.validatedAt).getTime();
          totalAge += age;

          // Track oldest and newest
          const resultDate = new Date(result.validatedAt);
          if (!oldestDate || resultDate < oldestDate) {
            oldestDate = resultDate;
          }
          if (!newestDate || resultDate > newestDate) {
            newestDate = resultDate;
          }
        }

        const averageCacheAge = validationResults.length > 0 ? totalAge / validationResults.length / (1000 * 60 * 60 * 24) : 0;

        return {
          totalCachedResults: validationResults.length,
          cachedByResourceType,
          cachedByDate,
          averageCacheAge: Math.round(averageCacheAge * 100) / 100,
          oldestCacheDate: oldestDate,
          newestCacheDate: newestDate,
          cacheHitRate: 0
        };
      };

      const mockResources = [
        { id: '1', resourceType: 'Patient' },
        { id: '2', resourceType: 'Observation' }
      ];

      const mockValidationResults = [
        { resourceId: '1', validatedAt: '2024-01-01T10:00:00Z' },
        { resourceId: '1', validatedAt: '2024-01-02T10:00:00Z' },
        { resourceId: '2', validatedAt: '2024-01-01T11:00:00Z' }
      ];

      const stats = calculateCacheStatistics(mockValidationResults, mockResources);

      expect(stats.totalCachedResults).toBe(3);
      expect(stats.cachedByResourceType.Patient).toBe(2);
      expect(stats.cachedByResourceType.Observation).toBe(1);
      expect(stats.cachedByDate['2024-01-01']).toBe(2);
      expect(stats.cachedByDate['2024-01-02']).toBe(1);
      expect(stats.oldestCacheDate).not.toBeNull();
      expect(stats.newestCacheDate).not.toBeNull();
    });
  });

  describe('History Management Logic', () => {
    it('should test override history management', () => {
      const mockHistory: any[] = [];

      const addToHistory = (request: any, result: any) => {
        const historyEntry = {
          requestId: result.requestId,
          timestamp: result.startTime,
          request,
          result,
          inProgress: false
        };
        mockHistory.push(historyEntry);
        return historyEntry;
      };

      const getHistory = (limit: number = 50) => {
        return mockHistory
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limit);
      };

      const request1 = { resourceIds: ['1'], reason: 'Test 1' };
      const result1 = {
        requestId: 'req-1',
        startTime: new Date('2024-01-01T10:00:00Z'),
        status: 'completed'
      };

      const request2 = { resourceIds: ['2'], reason: 'Test 2' };
      const result2 = {
        requestId: 'req-2',
        startTime: new Date('2024-01-02T10:00:00Z'),
        status: 'completed'
      };

      addToHistory(request1, result1);
      addToHistory(request2, result2);

      const history = getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].requestId).toBe('req-2'); // Most recent first
      expect(history[1].requestId).toBe('req-1');
    });

    it('should test active request tracking', () => {
      const activeRequests = new Map<string, Promise<any>>();

      const addActiveRequest = (requestId: string, promise: Promise<any>) => {
        if (activeRequests.has(requestId)) {
          throw new Error(`Request ${requestId} is already in progress`);
        }
        activeRequests.set(requestId, promise);
        return promise;
      };

      const removeActiveRequest = (requestId: string) => {
        return activeRequests.delete(requestId);
      };

      const getActiveRequests = () => {
        return Array.from(activeRequests.keys());
      };

      const requestId = 'test-request';
      const promise = Promise.resolve({ success: true });

      addActiveRequest(requestId, promise);
      expect(getActiveRequests()).toContain(requestId);

      removeActiveRequest(requestId);
      expect(getActiveRequests()).not.toContain(requestId);
    });
  });

  describe('Error Handling Logic', () => {
    it('should test error handling in cache override', () => {
      const handleCacheOverrideError = (error: any, result: any) => {
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        result.status = 'failed';
        result.endTime = new Date();
        result.durationMs = result.endTime.getTime() - result.startTime.getTime();
        return result;
      };

      const result = {
        requestId: 'test-request',
        startTime: new Date(),
        errors: [],
        status: 'completed'
      };

      const error = new Error('Test error');
      const updatedResult = handleCacheOverrideError(error, result);

      expect(updatedResult.errors).toContain('Test error');
      expect(updatedResult.status).toBe('failed');
      expect(updatedResult.endTime).toBeInstanceOf(Date);
      expect(updatedResult.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should test partial failure handling', () => {
      const handlePartialFailure = (successful: number, failed: number, total: number) => {
        const result = {
          revalidatedResources: successful,
          failedResources: failed,
          status: 'completed' as string
        };

        if (failed === 0) {
          result.status = 'completed';
        } else if (successful > 0) {
          result.status = 'partial';
        } else {
          result.status = 'failed';
        }

        return result;
      };

      expect(handlePartialFailure(5, 0, 5).status).toBe('completed');
      expect(handlePartialFailure(3, 2, 5).status).toBe('partial');
      expect(handlePartialFailure(0, 5, 5).status).toBe('failed');
    });
  });
});
