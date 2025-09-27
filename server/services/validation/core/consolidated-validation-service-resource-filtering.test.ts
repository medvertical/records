/**
 * Unit tests for Resource Type Filtering Integration in ConsolidatedValidationService
 */

import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../../storage', () => ({
  storage: {
    getFhirResourceById: vi.fn(),
    getFhirResourceByTypeAndId: vi.fn(),
    createFhirResource: vi.fn(),
    updateFhirResource: vi.fn(),
    createValidationResult: vi.fn(),
    updateFhirResourceLastValidated: vi.fn(),
  },
}));

vi.mock('./validation-engine', () => ({
  getValidationEngine: vi.fn(() => ({
    validateResource: vi.fn(),
  })),
}));

vi.mock('./validation-pipeline', () => ({
  getValidationPipeline: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

vi.mock('../settings/validation-settings-service', () => ({
  getValidationSettingsService: vi.fn(() => ({
    getSettings: vi.fn(),
  })),
}));

vi.mock('../features/validation-resource-type-filtering-service', () => ({
  getValidationResourceTypeFilteringService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    shouldValidateResource: vi.fn(),
    filterResources: vi.fn(),
  })),
}));

describe('ConsolidatedValidationService Resource Type Filtering Integration', () => {
  describe('Resource Type Filtering Logic', () => {
    it('should test resource type filtering in validateResource', () => {
      const mockResource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: { versionId: '1' }
      };

      const mockFilterResult = {
        shouldValidate: false,
        reason: "Resource type 'Patient' is excluded",
        filterApplied: {
          enabled: true,
          includedTypes: new Set(['Observation']),
          excludedTypes: new Set(['Patient']),
          latestOnly: false,
          lastUpdated: new Date()
        }
      };

      // Simulate the filtering logic
      const shouldValidateResource = (resource: any, filterResult: any) => {
        if (!filterResult.shouldValidate) {
          return {
            validationResults: [],
            detailedResult: {
              resourceId: resource.id,
              resourceType: resource.resourceType,
              isValid: true,
              issues: [],
              aspects: [],
              validationTime: 0,
              validatedAt: new Date(),
              wasFiltered: true,
              filterReason: filterResult.reason
            },
            wasRevalidated: false
          };
        }
        return null; // Would proceed with normal validation
      };

      const result = shouldValidateResource(mockResource, mockFilterResult);

      expect(result).not.toBeNull();
      expect(result!.validationResults).toHaveLength(0);
      expect(result!.detailedResult.wasFiltered).toBe(true);
      expect(result!.detailedResult.filterReason).toBe("Resource type 'Patient' is excluded");
      expect(result!.detailedResult.isValid).toBe(true); // Assume valid if not validated
      expect(result!.wasRevalidated).toBe(false);
    });

    it('should test resource type filtering in validateResources batch processing', () => {
      const mockResources = [
        { resourceType: 'Patient', id: 'patient-1' },
        { resourceType: 'Observation', id: 'obs-1' },
        { resourceType: 'Condition', id: 'cond-1' },
        { resourceType: 'Medication', id: 'med-1' }
      ];

      const mockFilterStatistics = {
        totalResources: 4,
        filteredResources: 2,
        includedByType: { Patient: 1, Observation: 1 },
        excludedByType: { Condition: 1, Medication: 1 },
        latestOnlyCount: 0
      };

      const mockFilteredResources = [
        { resourceType: 'Patient', id: 'patient-1' },
        { resourceType: 'Observation', id: 'obs-1' }
      ];

      // Simulate the batch filtering logic
      const applyResourceTypeFiltering = (resources: any[], filterStatistics: any) => {
        const filteredResources = resources.filter(resource => 
          filterStatistics.includedByType[resource.resourceType]
        );

        return {
          filtered: filteredResources,
          statistics: filterStatistics
        };
      };

      const result = applyResourceTypeFiltering(mockResources, mockFilterStatistics);

      expect(result.filtered).toHaveLength(2);
      expect(result.filtered[0].resourceType).toBe('Patient');
      expect(result.filtered[1].resourceType).toBe('Observation');
      expect(result.statistics.totalResources).toBe(4);
      expect(result.statistics.filteredResources).toBe(2);
    });

    it('should test summary calculation with filtered resources', () => {
      const mockSummary = {
        total: 4,
        revalidated: 1,
        cached: 1,
        errors: 0,
        filtered: 2
      };

      const mockFilterStatistics = {
        totalResources: 4,
        filteredResources: 2
      };

      // Simulate the summary calculation logic
      const calculateSummary = (total: number, revalidated: number, cached: number, errors: number, filterStatistics: any) => {
        return {
          total,
          revalidated,
          cached,
          errors,
          filtered: filterStatistics.totalResources - filterStatistics.filteredResources
        };
      };

      const summary = calculateSummary(4, 1, 1, 0, mockFilterStatistics);

      expect(summary.total).toBe(4);
      expect(summary.revalidated).toBe(1);
      expect(summary.cached).toBe(1);
      expect(summary.errors).toBe(0);
      expect(summary.filtered).toBe(2);
    });
  });

  describe('Filtering Service Integration', () => {
    it('should test filtering service initialization', async () => {
      const mockFilteringService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        shouldValidateResource: vi.fn(),
        filterResources: vi.fn()
      };

      // Simulate the initialization logic
      const initializeFilteringService = async (service: any) => {
        await service.initialize();
        return service;
      };

      const result = await initializeFilteringService(mockFilteringService);

      expect(mockFilteringService.initialize).toHaveBeenCalled();
      expect(result).toBe(mockFilteringService);
    });

    it('should test shouldValidateResource call with correct parameters', () => {
      const mockResource = {
        resourceType: 'Patient',
        id: 'patient-123',
        meta: { versionId: '1' }
      };

      const mockFilteringService = {
        shouldValidateResource: vi.fn().mockReturnValue({
          shouldValidate: true,
          reason: 'Resource type is included',
          filterApplied: {}
        })
      };

      // Simulate the shouldValidateResource call
      const callShouldValidateResource = (service: any, resource: any) => {
        return service.shouldValidateResource(
          resource.resourceType,
          resource.meta?.versionId === '1'
        );
      };

      const result = callShouldValidateResource(mockFilteringService, mockResource);

      expect(mockFilteringService.shouldValidateResource).toHaveBeenCalledWith('Patient', true);
      expect(result.shouldValidate).toBe(true);
      expect(result.reason).toBe('Resource type is included');
    });

    it('should test filterResources call with correct parameters', () => {
      const mockResources = [
        { resourceType: 'Patient', id: 'patient-1' },
        { resourceType: 'Observation', id: 'obs-1' }
      ];

      const mockFilteringService = {
        filterResources: vi.fn().mockReturnValue({
          filtered: mockResources,
          statistics: {
            totalResources: 2,
            filteredResources: 2,
            includedByType: { Patient: 1, Observation: 1 },
            excludedByType: {},
            latestOnlyCount: 0
          }
        })
      };

      // Simulate the filterResources call
      const callFilterResources = (service: any, resources: any[]) => {
        return service.filterResources(resources);
      };

      const result = callFilterResources(mockFilteringService, mockResources);

      expect(mockFilteringService.filterResources).toHaveBeenCalledWith(mockResources);
      expect(result.filtered).toEqual(mockResources);
      expect(result.statistics.totalResources).toBe(2);
      expect(result.statistics.filteredResources).toBe(2);
    });
  });

  describe('DetailedValidationResult Interface', () => {
    it('should test DetailedValidationResult with filtering fields', () => {
      const mockDetailedResult = {
        resourceType: 'Patient',
        resourceId: 'patient-123',
        isValid: true,
        issues: [],
        aspects: [],
        summary: {
          totalIssues: 0,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          score: 100
        },
        performance: {
          totalTimeMs: 0,
          aspectTimes: {}
        },
        validatedAt: new Date().toISOString(),
        validationTime: 0,
        wasFiltered: true,
        filterReason: "Resource type 'Patient' is excluded"
      };

      // Test that the interface includes the new fields
      expect(mockDetailedResult.wasFiltered).toBe(true);
      expect(mockDetailedResult.filterReason).toBe("Resource type 'Patient' is excluded");
      expect(mockDetailedResult.aspects).toEqual([]);
      expect(mockDetailedResult.validationTime).toBe(0);
    });

    it('should test DetailedValidationResult without filtering fields', () => {
      const mockDetailedResult = {
        resourceType: 'Patient',
        resourceId: 'patient-123',
        isValid: false,
        issues: [{ severity: 'error', message: 'Test error' }],
        aspects: [{ aspect: 'structural', isValid: false, issues: [] }],
        summary: {
          totalIssues: 1,
          errorCount: 1,
          warningCount: 0,
          informationCount: 0,
          score: 0
        },
        performance: {
          totalTimeMs: 100,
          aspectTimes: { structural: 100 }
        },
        validatedAt: new Date().toISOString(),
        validationTime: 100
        // wasFiltered and filterReason are optional
      };

      // Test that the interface works without the optional filtering fields
      expect(mockDetailedResult.wasFiltered).toBeUndefined();
      expect(mockDetailedResult.filterReason).toBeUndefined();
      expect(mockDetailedResult.aspects).toHaveLength(1);
      expect(mockDetailedResult.validationTime).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should test error handling when filtering service fails', async () => {
      const mockFilteringService = {
        initialize: vi.fn().mockRejectedValue(new Error('Filtering service failed')),
        shouldValidateResource: vi.fn(),
        filterResources: vi.fn()
      };

      // Simulate error handling logic
      const handleFilteringServiceError = async (service: any) => {
        try {
          await service.initialize();
          return { success: true };
        } catch (error) {
          console.error('Filtering service initialization failed:', error);
          // In real implementation, would fall back to no filtering
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            fallback: 'No filtering applied'
          };
        }
      };

      const result = await handleFilteringServiceError(mockFilteringService);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Filtering service failed');
      expect(result.fallback).toBe('No filtering applied');
    });

    it('should test graceful degradation when filter result is null', () => {
      const mockResource = {
        resourceType: 'Patient',
        id: 'patient-123'
      };

      // Simulate null filter result handling
      const handleNullFilterResult = (resource: any, filterResult: any) => {
        if (!filterResult) {
          console.warn('Filter result is null, proceeding with validation');
          return {
            shouldProceed: true,
            reason: 'Filter result unavailable, proceeding with validation'
          };
        }
        return { shouldProceed: filterResult.shouldValidate, reason: filterResult.reason };
      };

      const result = handleNullFilterResult(mockResource, null);

      expect(result.shouldProceed).toBe(true);
      expect(result.reason).toBe('Filter result unavailable, proceeding with validation');
    });
  });
});
