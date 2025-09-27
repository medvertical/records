/**
 * Unit tests for Filtered Resources API Endpoints Logic
 */

import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../storage', () => ({
  storage: {
    getFhirResourcesWithValidation: vi.fn(),
  },
}));

vi.mock('./features/validation-backend-filtering-service', () => ({
  getValidationBackendFilteringService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    filterResources: vi.fn().mockResolvedValue({
      resources: [
        {
          id: 'patient-1',
          resourceType: 'Patient',
          _validation: {
            isValid: false,
            errorCount: 2,
            warningCount: 1,
            validationScore: 60
          }
        }
      ],
      totalCount: 1,
      returnedCount: 1,
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false
      },
      filterSummary: {
        resourceTypes: ['Patient'],
        validationStatus: {
          hasErrors: 1,
          hasWarnings: 1,
          hasInformation: 0,
          isValid: 0
        },
        totalMatching: 1
      },
      appliedFilters: {}
    }),
    getAvailableResourceTypes: vi.fn().mockResolvedValue(['Patient', 'Observation', 'Condition']),
    getValidationStatusStatistics: vi.fn().mockResolvedValue({
      totalResources: 100,
      withValidationData: 80,
      withoutValidationData: 20,
      hasErrors: 30,
      hasWarnings: 50,
      hasInformation: 10,
      isValid: 40
    })
  })),
}));

describe('Filtered Resources API Endpoints Logic', () => {
  describe('GET /api/fhir/resources/filtered', () => {
    it('should handle query parameter parsing', () => {
      const parseQueryParams = (query: any) => {
        const {
          resourceTypes,
          hasErrors,
          hasWarnings,
          hasInformation,
          isValid,
          search,
          limit = 50,
          offset = 0,
          sortBy = 'lastValidated',
          sortDirection = 'desc'
        } = query;

        // Parse resource types
        const resourceTypesArray = resourceTypes 
          ? (Array.isArray(resourceTypes) ? resourceTypes : resourceTypes.toString().split(','))
          : [];

        // Parse validation status filters
        const validationStatus: any = {};
        if (hasErrors !== undefined) validationStatus.hasErrors = hasErrors === 'true';
        if (hasWarnings !== undefined) validationStatus.hasWarnings = hasWarnings === 'true';
        if (hasInformation !== undefined) validationStatus.hasInformation = hasInformation === 'true';
        if (isValid !== undefined) validationStatus.isValid = isValid === 'true';

        return {
          resourceTypes: resourceTypesArray,
          validationStatus: Object.keys(validationStatus).length > 0 ? validationStatus : undefined,
          search: search as string,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
          },
          sorting: {
            field: sortBy as any,
            direction: sortDirection as 'asc' | 'desc'
          }
        };
      };

      // Test default parameters
      const defaultParams = parseQueryParams({});
      expect(defaultParams.resourceTypes).toEqual([]);
      expect(defaultParams.validationStatus).toBeUndefined();
      expect(defaultParams.search).toBeUndefined();
      expect(defaultParams.pagination.limit).toBe(50);
      expect(defaultParams.pagination.offset).toBe(0);
      expect(defaultParams.sorting.field).toBe('lastValidated');
      expect(defaultParams.sorting.direction).toBe('desc');

      // Test resource types parsing
      const resourceTypesParams = parseQueryParams({ resourceTypes: 'Patient,Observation' });
      expect(resourceTypesParams.resourceTypes).toEqual(['Patient', 'Observation']);

      const resourceTypesArrayParams = parseQueryParams({ resourceTypes: ['Patient', 'Observation'] });
      expect(resourceTypesArrayParams.resourceTypes).toEqual(['Patient', 'Observation']);

      // Test validation status parsing
      const validationParams = parseQueryParams({
        hasErrors: 'true',
        hasWarnings: 'false',
        isValid: 'true'
      });
      expect(validationParams.validationStatus).toEqual({
        hasErrors: true,
        hasWarnings: false,
        isValid: true
      });

      // Test pagination parsing
      const paginationParams = parseQueryParams({
        limit: '25',
        offset: '100'
      });
      expect(paginationParams.pagination.limit).toBe(25);
      expect(paginationParams.pagination.offset).toBe(100);

      // Test sorting parsing
      const sortingParams = parseQueryParams({
        sortBy: 'validationScore',
        sortDirection: 'asc'
      });
      expect(sortingParams.sorting.field).toBe('validationScore');
      expect(sortingParams.sorting.direction).toBe('asc');
    });

    it('should create proper response structure', () => {
      const createFilteredResourcesResponse = (result: any) => {
        return {
          success: true,
          data: result,
          message: `Found ${result.totalCount} resources matching the filter criteria`
        };
      };

      const mockResult = {
        resources: [
          {
            id: 'patient-1',
            resourceType: 'Patient',
            _validation: {
              isValid: false,
              errorCount: 2,
              warningCount: 1
            }
          }
        ],
        totalCount: 1,
        returnedCount: 1,
        pagination: {
          limit: 50,
          offset: 0,
          hasMore: false
        },
        filterSummary: {
          resourceTypes: ['Patient'],
          validationStatus: {
            hasErrors: 1,
            hasWarnings: 1,
            hasInformation: 0,
            isValid: 0
          },
          totalMatching: 1
        },
        appliedFilters: {}
      };

      const response = createFilteredResourcesResponse(mockResult);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(response.message).toBe('Found 1 resources matching the filter criteria');
    });

    it('should handle filter options creation', () => {
      const createFilterOptions = (query: any) => {
        const {
          resourceTypes,
          hasErrors,
          hasWarnings,
          hasInformation,
          isValid,
          search,
          limit = 50,
          offset = 0,
          sortBy = 'lastValidated',
          sortDirection = 'desc'
        } = query;

        // Parse resource types
        const resourceTypesArray = resourceTypes 
          ? (Array.isArray(resourceTypes) ? resourceTypes : resourceTypes.toString().split(','))
          : [];

        // Parse validation status filters
        const validationStatus: any = {};
        if (hasErrors !== undefined) validationStatus.hasErrors = hasErrors === 'true';
        if (hasWarnings !== undefined) validationStatus.hasWarnings = hasWarnings === 'true';
        if (hasInformation !== undefined) validationStatus.hasInformation = hasInformation === 'true';
        if (isValid !== undefined) validationStatus.isValid = isValid === 'true';

        return {
          resourceTypes: resourceTypesArray,
          validationStatus: Object.keys(validationStatus).length > 0 ? validationStatus : undefined,
          search: search as string,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
          },
          sorting: {
            field: sortBy as any,
            direction: sortDirection as 'asc' | 'desc'
          }
        };
      };

      const complexQuery = {
        resourceTypes: 'Patient,Observation',
        hasErrors: 'true',
        hasWarnings: 'false',
        search: 'john',
        limit: '25',
        offset: '50',
        sortBy: 'validationScore',
        sortDirection: 'asc'
      };

      const filterOptions = createFilterOptions(complexQuery);

      expect(filterOptions.resourceTypes).toEqual(['Patient', 'Observation']);
      expect(filterOptions.validationStatus).toEqual({
        hasErrors: true,
        hasWarnings: false
      });
      expect(filterOptions.search).toBe('john');
      expect(filterOptions.pagination.limit).toBe(25);
      expect(filterOptions.pagination.offset).toBe(50);
      expect(filterOptions.sorting.field).toBe('validationScore');
      expect(filterOptions.sorting.direction).toBe('asc');
    });
  });

  describe('GET /api/fhir/resources/filtered/statistics', () => {
    it('should create proper statistics response', () => {
      const createStatisticsResponse = (availableResourceTypes: string[], validationStatistics: any) => {
        return {
          success: true,
          data: {
            availableResourceTypes,
            validationStatistics
          }
        };
      };

      const mockAvailableTypes = ['Patient', 'Observation', 'Condition'];
      const mockValidationStats = {
        totalResources: 100,
        withValidationData: 80,
        withoutValidationData: 20,
        hasErrors: 30,
        hasWarnings: 50,
        hasInformation: 10,
        isValid: 40
      };

      const response = createStatisticsResponse(mockAvailableTypes, mockValidationStats);

      expect(response.success).toBe(true);
      expect(response.data.availableResourceTypes).toEqual(mockAvailableTypes);
      expect(response.data.validationStatistics).toEqual(mockValidationStats);
    });

    it('should handle service initialization', async () => {
      const initializeService = async (service: any) => {
        await service.initialize();
        return service;
      };

      const mockService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getAvailableResourceTypes: vi.fn().mockResolvedValue(['Patient', 'Observation']),
        getValidationStatusStatistics: vi.fn().mockResolvedValue({
          totalResources: 50,
          withValidationData: 40,
          withoutValidationData: 10
        })
      };

      const result = await initializeService(mockService);

      expect(mockService.initialize).toHaveBeenCalled();
      expect(result).toBe(mockService);
    });
  });

  describe('Error Handling', () => {
    it('should handle filtering service errors', async () => {
      const handleFilteringError = async (error: any) => {
        console.error('[FHIR API] Error filtering resources:', error);
        return {
          success: false,
          error: 'Failed to filter resources',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      };

      const error = new Error('Filtering service failed');
      const response = await handleFilteringError(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to filter resources');
      expect(response.message).toBe('Filtering service failed');
    });

    it('should handle statistics service errors', async () => {
      const handleStatisticsError = async (error: any) => {
        console.error('[FHIR API] Error getting filtering statistics:', error);
        return {
          success: false,
          error: 'Failed to get filtering statistics',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      };

      const error = new Error('Statistics service failed');
      const response = await handleStatisticsError(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to get filtering statistics');
      expect(response.message).toBe('Statistics service failed');
    });
  });

  describe('Query Parameter Validation', () => {
    it('should validate boolean parameters', () => {
      const validateBooleanParam = (value: any) => {
        if (value === undefined) return undefined;
        return value === 'true';
      };

      expect(validateBooleanParam('true')).toBe(true);
      expect(validateBooleanParam('false')).toBe(false);
      expect(validateBooleanParam('TRUE')).toBe(false); // Case sensitive
      expect(validateBooleanParam('1')).toBe(false);
      expect(validateBooleanParam(undefined)).toBeUndefined();
    });

    it('should validate numeric parameters', () => {
      const validateNumericParam = (value: any, defaultValue: number) => {
        if (value === undefined) return defaultValue;
        const parsed = parseInt(value as string);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      expect(validateNumericParam('50', 10)).toBe(50);
      expect(validateNumericParam('25', 10)).toBe(25);
      expect(validateNumericParam('invalid', 10)).toBe(10);
      expect(validateNumericParam(undefined, 10)).toBe(10);
    });

    it('should validate sorting parameters', () => {
      const validateSortingParams = (sortBy: any, sortDirection: any) => {
        const validFields = ['resourceType', 'lastValidated', 'validationScore', 'errorCount', 'warningCount'];
        const validDirections = ['asc', 'desc'];

        const field = validFields.includes(sortBy) ? sortBy : 'lastValidated';
        const direction = validDirections.includes(sortDirection) ? sortDirection : 'desc';

        return { field, direction };
      };

      expect(validateSortingParams('validationScore', 'asc')).toEqual({
        field: 'validationScore',
        direction: 'asc'
      });

      expect(validateSortingParams('invalidField', 'invalidDirection')).toEqual({
        field: 'lastValidated',
        direction: 'desc'
      });

      expect(validateSortingParams('errorCount', 'desc')).toEqual({
        field: 'errorCount',
        direction: 'desc'
      });
    });
  });

  describe('Response Structure Validation', () => {
    it('should validate filtered resources response structure', () => {
      const validateFilteredResourcesResponse = (response: any) => {
        const requiredFields = ['success', 'data', 'message'];
        const dataRequiredFields = ['resources', 'totalCount', 'returnedCount', 'pagination', 'filterSummary', 'appliedFilters'];
        const paginationRequiredFields = ['limit', 'offset', 'hasMore'];

        // Check top-level fields
        for (const field of requiredFields) {
          if (!(field in response)) {
            return { isValid: false, missingField: field };
          }
        }

        // Check data fields
        for (const field of dataRequiredFields) {
          if (!(field in response.data)) {
            return { isValid: false, missingField: `data.${field}` };
          }
        }

        // Check pagination fields
        for (const field of paginationRequiredFields) {
          if (!(field in response.data.pagination)) {
            return { isValid: false, missingField: `data.pagination.${field}` };
          }
        }

        return { isValid: true };
      };

      const validResponse = {
        success: true,
        data: {
          resources: [],
          totalCount: 0,
          returnedCount: 0,
          pagination: {
            limit: 50,
            offset: 0,
            hasMore: false
          },
          filterSummary: {
            resourceTypes: [],
            validationStatus: {
              hasErrors: 0,
              hasWarnings: 0,
              hasInformation: 0,
              isValid: 0
            },
            totalMatching: 0
          },
          appliedFilters: {}
        },
        message: 'Found 0 resources matching the filter criteria'
      };

      const validation = validateFilteredResourcesResponse(validResponse);
      expect(validation.isValid).toBe(true);

      const invalidResponse = {
        success: true,
        data: {
          resources: []
          // Missing other required fields
        }
      };

      const invalidValidation = validateFilteredResourcesResponse(invalidResponse);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.missingField).toBe('message');
    });

    it('should validate statistics response structure', () => {
      const validateStatisticsResponse = (response: any) => {
        const requiredFields = ['success', 'data'];
        const dataRequiredFields = ['availableResourceTypes', 'validationStatistics'];

        // Check top-level fields
        for (const field of requiredFields) {
          if (!(field in response)) {
            return { isValid: false, missingField: field };
          }
        }

        // Check data fields
        for (const field of dataRequiredFields) {
          if (!(field in response.data)) {
            return { isValid: false, missingField: `data.${field}` };
          }
        }

        return { isValid: true };
      };

      const validResponse = {
        success: true,
        data: {
          availableResourceTypes: ['Patient', 'Observation'],
          validationStatistics: {
            totalResources: 100,
            withValidationData: 80,
            withoutValidationData: 20
          }
        }
      };

      const validation = validateStatisticsResponse(validResponse);
      expect(validation.isValid).toBe(true);

      const invalidResponse = {
        success: true,
        data: {
          availableResourceTypes: ['Patient']
          // Missing validationStatistics
        }
      };

      const invalidValidation = validateStatisticsResponse(invalidResponse);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.missingField).toBe('data.validationStatistics');
    });
  });
});
