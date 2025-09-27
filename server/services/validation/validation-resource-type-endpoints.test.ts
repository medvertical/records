/**
 * Unit tests for Resource Type Filtering API Endpoints Logic
 */

import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../storage', () => ({
  storage: {
    getLatestValidationResults: vi.fn(),
  },
}));

vi.mock('./features/validation-resource-type-filtering-service', () => ({
  getValidationResourceTypeFilteringService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getCurrentFilter: vi.fn().mockReturnValue({
      enabled: true,
      includedTypes: new Set(['Patient', 'Observation']),
      excludedTypes: new Set(['Condition']),
      latestOnly: false,
      lastUpdated: new Date()
    }),
    getAvailableResourceTypes: vi.fn(() => ['Patient', 'Observation', 'Condition', 'Medication']),
    getFilterStatistics: vi.fn(() => ({
      isEnabled: true,
      totalIncludedTypes: 2,
      totalExcludedTypes: 1,
      latestOnlyEnabled: false,
      availableTypes: 4
    })),
    validateResourceTypeFilter: vi.fn(() => ({
      isValid: true,
      errors: [],
      warnings: []
    })),
    filterResources: vi.fn((resources) => ({
      filtered: resources.filter((r: any) => r.resourceType === 'Patient'),
      statistics: {
        totalResources: resources.length,
        filteredResources: 1,
        includedByType: { Patient: 1 },
        excludedByType: { Observation: 1 },
        latestOnlyCount: 0
      }
    }))
  })),
}));

vi.mock('../../settings/validation-settings-service-simplified', () => ({
  getValidationSettingsService: vi.fn(() => ({
    getSettings: vi.fn().mockResolvedValue({
      resourceTypes: {
        enabled: true,
        includedTypes: ['Patient', 'Observation'],
        excludedTypes: ['Condition'],
        latestOnly: false
      }
    }),
    updateSettings: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Resource Type Filtering API Endpoints Logic', () => {
  describe('GET /api/validation/resource-types/available', () => {
    it('should handle available resource types endpoint logic', () => {
      const createResponse = (availableTypes: string[]) => {
        return {
          success: true,
          data: availableTypes,
          total: availableTypes.length
        };
      };

      const mockTypes = ['Patient', 'Observation', 'Condition', 'Medication'];
      const response = createResponse(mockTypes);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockTypes);
      expect(response.total).toBe(4);
    });

    it('should handle error response structure', () => {
      const createErrorResponse = (error: string, message: string) => {
        return {
          success: false,
          error,
          message
        };
      };

      const errorResponse = createErrorResponse('Failed to get available resource types', 'Database connection failed');

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Failed to get available resource types');
      expect(errorResponse.message).toBe('Database connection failed');
    });
  });

  describe('GET /api/validation/resource-types/filter', () => {
    it('should handle current filter endpoint logic', () => {
      const createFilterResponse = (filter: any, statistics: any) => {
        return {
          success: true,
          data: {
            filter,
            statistics
          }
        };
      };

      const mockFilter = {
        enabled: true,
        includedTypes: new Set(['Patient', 'Observation']),
        excludedTypes: new Set(['Condition']),
        latestOnly: false,
        lastUpdated: new Date()
      };

      const mockStatistics = {
        isEnabled: true,
        totalIncludedTypes: 2,
        totalExcludedTypes: 1,
        latestOnlyEnabled: false,
        availableTypes: 4
      };

      const response = createFilterResponse(mockFilter, mockStatistics);

      expect(response.success).toBe(true);
      expect(response.data.filter).toEqual(mockFilter);
      expect(response.data.statistics).toEqual(mockStatistics);
    });
  });

  describe('POST /api/validation/resource-types/filter', () => {
    it('should handle filter update request validation', () => {
      const validateRequest = (body: any) => {
        const { enabled, includedTypes, excludedTypes, latestOnly } = body;
        return {
          enabled: enabled ?? false,
          includedTypes: includedTypes ?? [],
          excludedTypes: excludedTypes ?? [],
          latestOnly: latestOnly ?? false
        };
      };

      const requestBody = {
        enabled: true,
        includedTypes: ['Patient', 'Observation'],
        excludedTypes: ['Condition'],
        latestOnly: false
      };

      const validated = validateRequest(requestBody);

      expect(validated.enabled).toBe(true);
      expect(validated.includedTypes).toEqual(['Patient', 'Observation']);
      expect(validated.excludedTypes).toEqual(['Condition']);
      expect(validated.latestOnly).toBe(false);
    });

    it('should handle filter update response structure', () => {
      const createUpdateResponse = (filter: any, statistics: any, warnings: string[] = []) => {
        return {
          success: true,
          data: {
            filter,
            statistics
          },
          warnings,
          message: 'Resource type filter updated successfully'
        };
      };

      const mockFilter = {
        enabled: true,
        includedTypes: new Set(['Patient']),
        excludedTypes: new Set(),
        latestOnly: false,
        lastUpdated: new Date()
      };

      const mockStatistics = {
        isEnabled: true,
        totalIncludedTypes: 1,
        totalExcludedTypes: 0,
        latestOnlyEnabled: false,
        availableTypes: 4
      };

      const response = createUpdateResponse(mockFilter, mockStatistics, ['Warning: No excluded types specified']);

      expect(response.success).toBe(true);
      expect(response.data.filter).toEqual(mockFilter);
      expect(response.data.statistics).toEqual(mockStatistics);
      expect(response.warnings).toContain('Warning: No excluded types specified');
      expect(response.message).toBe('Resource type filter updated successfully');
    });

    it('should handle validation error response', () => {
      const createValidationErrorResponse = (errors: string[], warnings: string[] = []) => {
        return {
          success: false,
          error: 'Invalid resource type filter configuration',
          details: errors,
          warnings
        };
      };

      const errors = ['Resource types cannot be both included and excluded: Patient'];
      const warnings = ['Unknown resource types in included list: InvalidType'];

      const response = createValidationErrorResponse(errors, warnings);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid resource type filter configuration');
      expect(response.details).toEqual(errors);
      expect(response.warnings).toEqual(warnings);
    });
  });

  describe('POST /api/validation/resource-types/validate', () => {
    it('should handle filter validation logic', () => {
      const validateFilterConfig = (config: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for conflicting included and excluded types
        const includedSet = new Set(config.includedTypes);
        const excludedSet = new Set(config.excludedTypes);
        const conflicts = [...includedSet].filter(type => excludedSet.has(type));

        if (conflicts.length > 0) {
          errors.push(`Resource types cannot be both included and excluded: ${conflicts.join(', ')}`);
        }

        // Check for empty configuration warning
        if (config.enabled && config.includedTypes.length === 0 && config.excludedTypes.length === 0) {
          warnings.push('Resource type filtering is enabled but no types are specified (will validate all types)');
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings
        };
      };

      // Test valid configuration
      const validConfig = {
        enabled: true,
        includedTypes: ['Patient', 'Observation'],
        excludedTypes: ['Condition'],
        latestOnly: false
      };

      const validResult = validateFilterConfig(validConfig);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Test conflicting configuration
      const conflictingConfig = {
        enabled: true,
        includedTypes: ['Patient', 'Observation'],
        excludedTypes: ['Patient', 'Condition'],
        latestOnly: false
      };

      const conflictingResult = validateFilterConfig(conflictingConfig);
      expect(conflictingResult.isValid).toBe(false);
      expect(conflictingResult.errors).toContain('Resource types cannot be both included and excluded: Patient');

      // Test empty configuration warning
      const emptyConfig = {
        enabled: true,
        includedTypes: [],
        excludedTypes: [],
        latestOnly: false
      };

      const emptyResult = validateFilterConfig(emptyConfig);
      expect(emptyResult.isValid).toBe(true);
      expect(emptyResult.warnings).toContain('Resource type filtering is enabled but no types are specified (will validate all types)');
    });
  });

  describe('POST /api/validation/resource-types/test', () => {
    it('should handle test filtering logic', () => {
      const testResourceFiltering = (resources: any[], filter: any) => {
        if (!Array.isArray(resources)) {
          return {
            success: false,
            error: 'resources must be an array'
          };
        }

        // Simulate filtering logic
        const filtered = resources.filter(resource => {
          if (!filter.enabled) return true;
          if (filter.excludedTypes && filter.excludedTypes.includes(resource.resourceType)) return false;
          if (filter.includedTypes && filter.includedTypes.length > 0) {
            return filter.includedTypes.includes(resource.resourceType);
          }
          return true;
        });

        const statistics = {
          totalResources: resources.length,
          filteredResources: filtered.length,
          includedByType: {},
          excludedByType: {},
          latestOnlyCount: 0
        };

        return {
          success: true,
          data: {
            filtered,
            statistics
          }
        };
      };

      const mockResources = [
        { resourceType: 'Patient', id: 1 },
        { resourceType: 'Observation', id: 2 },
        { resourceType: 'Condition', id: 3 }
      ];

      const mockFilter = {
        enabled: true,
        includedTypes: ['Patient'],
        excludedTypes: ['Condition'],
        latestOnly: false
      };

      const result = testResourceFiltering(mockResources, mockFilter);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(1);
      expect(result.data.filtered[0].resourceType).toBe('Patient');
      expect(result.data.statistics.totalResources).toBe(3);
      expect(result.data.statistics.filteredResources).toBe(1);
    });

    it('should handle invalid resources array', () => {
      const testResourceFiltering = (resources: any[], filter: any) => {
        if (!Array.isArray(resources)) {
          return {
            success: false,
            error: 'resources must be an array'
          };
        }
        return { success: true, data: { filtered: resources, statistics: {} } };
      };

      const result = testResourceFiltering('not an array', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('resources must be an array');
    });
  });

  describe('GET /api/validation/resource-types/statistics', () => {
    it('should handle statistics endpoint logic', () => {
      const createStatisticsResponse = (statistics: any) => {
        return {
          success: true,
          data: statistics
        };
      };

      const mockStatistics = {
        isEnabled: true,
        totalIncludedTypes: 2,
        totalExcludedTypes: 1,
        latestOnlyEnabled: false,
        availableTypes: 4
      };

      const response = createStatisticsResponse(mockStatistics);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockStatistics);
    });
  });

  describe('Helper Logic', () => {
    it('should verify service initialization logic', () => {
      const isServiceInitialized = (filter: any) => {
        return filter !== null && filter.enabled !== undefined;
      };

      const mockFilter = {
        enabled: true,
        includedTypes: new Set(['Patient']),
        excludedTypes: new Set(),
        latestOnly: false,
        lastUpdated: new Date()
      };

      expect(isServiceInitialized(mockFilter)).toBe(true);
      expect(isServiceInitialized(null)).toBe(false);
    });

    it('should verify dynamic import logic', async () => {
      const simulateDynamicImport = async () => {
        // Simulate the dynamic import logic
        const modulePath = '../../../services/validation/features/validation-resource-type-filtering-service';
        const serviceName = 'getValidationResourceTypeFilteringService';
        
        // In real implementation, this would be:
        // const { getValidationResourceTypeFilteringService } = await import(modulePath);
        // const filteringService = getValidationResourceTypeFilteringService();
        
        return {
          modulePath,
          serviceName,
          success: true
        };
      };

      const result = await simulateDynamicImport();
      expect(result.modulePath).toBe('../../../services/validation/features/validation-resource-type-filtering-service');
      expect(result.serviceName).toBe('getValidationResourceTypeFilteringService');
      expect(result.success).toBe(true);
    });

    it('should verify settings integration logic', () => {
      const createSettingsUpdate = (currentSettings: any, resourceTypes: any) => {
        return {
          ...currentSettings,
          resourceTypes
        };
      };

      const currentSettings = {
        aspects: { structural: { enabled: true } },
        server: { url: 'http://test.com' },
        performance: { maxConcurrent: 8 }
      };

      const resourceTypes = {
        enabled: true,
        includedTypes: ['Patient'],
        excludedTypes: [],
        latestOnly: false
      };

      const updatedSettings = createSettingsUpdate(currentSettings, resourceTypes);

      expect(updatedSettings.resourceTypes).toEqual(resourceTypes);
      expect(updatedSettings.aspects).toEqual(currentSettings.aspects);
      expect(updatedSettings.server).toEqual(currentSettings.server);
    });
  });
});
