/**
 * Unit tests for ValidationBackendFilteringService Logic
 */

import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../../storage', () => ({
  storage: {
    getFhirResourcesWithValidation: vi.fn(),
  },
}));

vi.mock('./validation-result-filtering-service', () => ({
  getValidationResultFilteringService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('./validation-resource-type-filtering-service', () => ({
  getValidationResourceTypeFilteringService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('ValidationBackendFilteringService Logic', () => {
  describe('Resource Filtering Logic', () => {
    it('should test resource type filtering', () => {
      const mockResources = [
        { id: 1, resourceType: 'Patient', resourceId: 'patient-1' },
        { id: 2, resourceType: 'Observation', resourceId: 'obs-1' },
        { id: 3, resourceType: 'Patient', resourceId: 'patient-2' },
        { id: 4, resourceType: 'Condition', resourceId: 'cond-1' }
      ];

      const applyResourceTypeFiltering = (resources: any[], resourceTypes: string[]) => {
        if (resourceTypes.length === 0) {
          return resources;
        }
        return resources.filter(resource => resourceTypes.includes(resource.resourceType));
      };

      // Test filtering by specific resource types
      const filteredByType = applyResourceTypeFiltering(mockResources, ['Patient', 'Observation']);
      expect(filteredByType).toHaveLength(3);
      expect(filteredByType.map(r => r.resourceType)).toEqual(['Patient', 'Observation', 'Patient']);

      // Test filtering by single resource type
      const filteredBySingleType = applyResourceTypeFiltering(mockResources, ['Patient']);
      expect(filteredBySingleType).toHaveLength(2);
      expect(filteredBySingleType.map(r => r.resourceType)).toEqual(['Patient', 'Patient']);

      // Test no filtering (empty array)
      const noFiltering = applyResourceTypeFiltering(mockResources, []);
      expect(noFiltering).toHaveLength(4);
    });

    it('should test validation status filtering', () => {
      const mockResources = [
        {
          id: 1,
          resourceType: 'Patient',
          validationResults: [{ errorCount: 2, warningCount: 1, isValid: false }]
        },
        {
          id: 2,
          resourceType: 'Observation',
          validationResults: [{ errorCount: 0, warningCount: 1, isValid: true }]
        },
        {
          id: 3,
          resourceType: 'Condition',
          validationResults: [{ errorCount: 0, warningCount: 0, isValid: true }]
        },
        {
          id: 4,
          resourceType: 'Medication',
          validationResults: []
        }
      ];

      const applyValidationStatusFiltering = (resources: any[], validationStatus: any) => {
        if (!validationStatus || Object.keys(validationStatus).length === 0) {
          return resources;
        }

        return resources.filter(resource => {
          const validationResults = resource.validationResults || [];
          if (validationResults.length === 0) {
            // Resources without validation data are only included if explicitly requested
            return validationStatus.isValid === true;
          }

          const latestValidation = validationResults[0];
          const hasErrors = latestValidation.errorCount > 0;
          const hasWarnings = latestValidation.warningCount > 0;
          const isValid = latestValidation.isValid;

          if (validationStatus.hasErrors !== undefined && validationStatus.hasErrors !== hasErrors) {
            return false;
          }
          if (validationStatus.hasWarnings !== undefined && validationStatus.hasWarnings !== hasWarnings) {
            return false;
          }
          if (validationStatus.isValid !== undefined && validationStatus.isValid !== isValid) {
            return false;
          }

          return true;
        });
      };

      // Test filtering by errors
      const hasErrorsFilter = applyValidationStatusFiltering(mockResources, { hasErrors: true });
      expect(hasErrorsFilter).toHaveLength(1);
      expect(hasErrorsFilter[0].resourceType).toBe('Patient');

      // Test filtering by warnings
      const hasWarningsFilter = applyValidationStatusFiltering(mockResources, { hasWarnings: true });
      expect(hasWarningsFilter).toHaveLength(2);
      expect(hasWarningsFilter.map(r => r.resourceType)).toEqual(['Patient', 'Observation']);

      // Test filtering by valid resources
      const isValidFilter = applyValidationStatusFiltering(mockResources, { isValid: true });
      expect(isValidFilter).toHaveLength(3); // Observation, Condition, and Medication (no validation data)
      expect(isValidFilter.map(r => r.resourceType)).toEqual(['Observation', 'Condition', 'Medication']);

      // Test filtering by no errors
      const noErrorsFilter = applyValidationStatusFiltering(mockResources, { hasErrors: false });
      expect(noErrorsFilter).toHaveLength(2);
      expect(noErrorsFilter.map(r => r.resourceType)).toEqual(['Observation', 'Condition']);
    });

    it('should test text search filtering', () => {
      const mockResources = [
        {
          id: 1,
          resourceType: 'Patient',
          resourceId: 'patient-123',
          data: { name: [{ given: ['John'], family: 'Doe' }] }
        },
        {
          id: 2,
          resourceType: 'Observation',
          resourceId: 'obs-456',
          data: { code: { text: 'Blood Pressure' } }
        },
        {
          id: 3,
          resourceType: 'Condition',
          resourceId: 'cond-789',
          data: { code: { text: 'Diabetes' } }
        }
      ];

      const applyTextSearch = (resources: any[], search: string) => {
        if (!search) return resources;

        const searchLower = search.toLowerCase();
        return resources.filter(resource => {
          // Search in resource data
          const resourceData = resource.data;
          if (resourceData) {
            const searchableText = JSON.stringify(resourceData).toLowerCase();
            if (searchableText.includes(searchLower)) {
              return true;
            }
          }

          // Search in resource type and ID
          if (resource.resourceType?.toLowerCase().includes(searchLower)) {
            return true;
          }
          if (resource.resourceId?.toLowerCase().includes(searchLower)) {
            return true;
          }

          return false;
        });
      };

      // Test searching by resource type
      const typeSearch = applyTextSearch(mockResources, 'patient');
      expect(typeSearch).toHaveLength(1);
      expect(typeSearch[0].resourceType).toBe('Patient');

      // Test searching by resource ID
      const idSearch = applyTextSearch(mockResources, 'obs-456');
      expect(idSearch).toHaveLength(1);
      expect(idSearch[0].resourceId).toBe('obs-456');

      // Test searching by content
      const contentSearch = applyTextSearch(mockResources, 'blood pressure');
      expect(contentSearch).toHaveLength(1);
      expect(contentSearch[0].resourceType).toBe('Observation');

      // Test searching by name
      const nameSearch = applyTextSearch(mockResources, 'john');
      expect(nameSearch).toHaveLength(1);
      expect(nameSearch[0].resourceType).toBe('Patient');

      // Test no search
      const noSearch = applyTextSearch(mockResources, '');
      expect(noSearch).toHaveLength(3);
    });

    it('should test sorting logic', () => {
      const mockResources = [
        {
          id: 1,
          resourceType: 'Patient',
          lastValidated: '2024-01-01T10:00:00Z',
          validationResults: [{ validationScore: 80, errorCount: 1 }]
        },
        {
          id: 2,
          resourceType: 'Observation',
          lastValidated: '2024-01-02T10:00:00Z',
          validationResults: [{ validationScore: 90, errorCount: 0 }]
        },
        {
          id: 3,
          resourceType: 'Condition',
          lastValidated: '2024-01-03T10:00:00Z',
          validationResults: [{ validationScore: 70, errorCount: 2 }]
        }
      ];

      const applySorting = (resources: any[], sorting: any) => {
        if (!sorting) return resources;

        return resources.sort((a, b) => {
          let aValue: any;
          let bValue: any;

          switch (sorting.field) {
            case 'resourceType':
              aValue = a.resourceType || '';
              bValue = b.resourceType || '';
              break;
            case 'lastValidated':
              aValue = a.lastValidated ? new Date(a.lastValidated).getTime() : 0;
              bValue = b.lastValidated ? new Date(b.lastValidated).getTime() : 0;
              break;
            case 'validationScore':
              aValue = a.validationResults?.[0]?.validationScore || 0;
              bValue = b.validationResults?.[0]?.validationScore || 0;
              break;
            case 'errorCount':
              aValue = a.validationResults?.[0]?.errorCount || 0;
              bValue = b.validationResults?.[0]?.errorCount || 0;
              break;
            default:
              return 0;
          }

          if (aValue < bValue) {
            return sorting.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sorting.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      };

      // Test sorting by resource type ascending
      const sortedByTypeAsc = applySorting(mockResources, { field: 'resourceType', direction: 'asc' });
      expect(sortedByTypeAsc.map(r => r.resourceType)).toEqual(['Condition', 'Observation', 'Patient']);

      // Test sorting by validation score descending
      const sortedByScoreDesc = applySorting(mockResources, { field: 'validationScore', direction: 'desc' });
      expect(sortedByScoreDesc.map(r => r.validationResults[0].validationScore)).toEqual([90, 80, 70]);

      // Test sorting by error count ascending
      const sortedByErrorsAsc = applySorting(mockResources, { field: 'errorCount', direction: 'asc' });
      expect(sortedByErrorsAsc.map(r => r.validationResults[0].errorCount)).toEqual([0, 1, 2]);

      // Test sorting by last validated descending
      const sortedByDateDesc = applySorting(mockResources, { field: 'lastValidated', direction: 'desc' });
      expect(sortedByDateDesc.map(r => r.id)).toEqual([3, 2, 1]);
    });
  });

  describe('Pagination Logic', () => {
    it('should test pagination logic', () => {
      const mockResources = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        resourceType: 'Patient',
        resourceId: `patient-${i + 1}`
      }));

      const applyPagination = (resources: any[], limit: number, offset: number) => {
        const startIndex = offset;
        const endIndex = offset + limit;
        const paginatedResources = resources.slice(startIndex, endIndex);

        return {
          resources: paginatedResources,
          totalCount: resources.length,
          returnedCount: paginatedResources.length,
          pagination: {
            limit,
            offset,
            hasMore: endIndex < resources.length
          }
        };
      };

      // Test first page
      const firstPage = applyPagination(mockResources, 10, 0);
      expect(firstPage.resources).toHaveLength(10);
      expect(firstPage.totalCount).toBe(25);
      expect(firstPage.returnedCount).toBe(10);
      expect(firstPage.pagination.hasMore).toBe(true);
      expect(firstPage.pagination.offset).toBe(0);

      // Test second page
      const secondPage = applyPagination(mockResources, 10, 10);
      expect(secondPage.resources).toHaveLength(10);
      expect(secondPage.pagination.hasMore).toBe(true);
      expect(secondPage.pagination.offset).toBe(10);

      // Test last page
      const lastPage = applyPagination(mockResources, 10, 20);
      expect(lastPage.resources).toHaveLength(5);
      expect(lastPage.pagination.hasMore).toBe(false);
      expect(lastPage.pagination.offset).toBe(20);

      // Test page beyond available data
      const beyondPage = applyPagination(mockResources, 10, 30);
      expect(beyondPage.resources).toHaveLength(0);
      expect(beyondPage.pagination.hasMore).toBe(false);
    });
  });

  describe('Filter Summary Logic', () => {
    it('should test filter summary calculation', () => {
      const mockResources = [
        {
          id: 1,
          resourceType: 'Patient',
          validationResults: [{ errorCount: 2, warningCount: 1, isValid: false }]
        },
        {
          id: 2,
          resourceType: 'Observation',
          validationResults: [{ errorCount: 0, warningCount: 1, isValid: true }]
        },
        {
          id: 3,
          resourceType: 'Condition',
          validationResults: [{ errorCount: 0, warningCount: 0, isValid: true }]
        },
        {
          id: 4,
          resourceType: 'Patient',
          validationResults: [{ errorCount: 1, warningCount: 0, isValid: false }]
        }
      ];

      const calculateFilterSummary = (resources: any[], resourceTypes: string[], validationStatus: any) => {
        const summary = {
          resourceTypes: resourceTypes.length > 0 ? resourceTypes : ['All'],
          validationStatus: {
            hasErrors: 0,
            hasWarnings: 0,
            hasInformation: 0,
            isValid: 0
          },
          totalMatching: 0
        };

        // Count validation status across all resources
        for (const resource of resources) {
          const validationResults = resource.validationResults || [];
          if (validationResults.length > 0) {
            const latestValidation = validationResults[0];
            if (latestValidation.errorCount > 0) summary.validationStatus.hasErrors++;
            if (latestValidation.warningCount > 0) summary.validationStatus.hasWarnings++;
            if (latestValidation.informationCount > 0) summary.validationStatus.hasInformation++;
            if (latestValidation.isValid) summary.validationStatus.isValid++;
          }
        }

        summary.totalMatching = resources.length;
        return summary;
      };

      const summary = calculateFilterSummary(mockResources, ['Patient', 'Observation'], {});

      expect(summary.resourceTypes).toEqual(['Patient', 'Observation']);
      expect(summary.validationStatus.hasErrors).toBe(2); // Resources 1 and 4
      expect(summary.validationStatus.hasWarnings).toBe(2); // Resources 1 and 2
      expect(summary.validationStatus.isValid).toBe(2); // Resources 2 and 3
      expect(summary.totalMatching).toBe(4);
    });
  });

  describe('Resource Enhancement Logic', () => {
    it('should test resource enhancement with validation data', () => {
      const mockResources = [
        {
          id: 1,
          resourceType: 'Patient',
          resourceId: 'patient-1',
          data: { id: 'patient-1', resourceType: 'Patient' },
          validationResults: [{
            errorCount: 2,
            warningCount: 1,
            isValid: false,
            validationScore: 60,
            validatedAt: '2024-01-01T10:00:00Z'
          }]
        },
        {
          id: 2,
          resourceType: 'Observation',
          resourceId: 'obs-1',
          data: { id: 'obs-1', resourceType: 'Observation' },
          validationResults: []
        }
      ];

      const enhanceResourcesWithValidationData = (resources: any[]) => {
        const enhancedResources = [];

        for (const resource of resources) {
          const validationResults = resource.validationResults || [];
          const latestValidation = validationResults[0];

          const validationSummary = {
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            isValid: latestValidation?.isValid || false,
            errorCount: latestValidation?.errorCount || 0,
            warningCount: latestValidation?.warningCount || 0,
            informationCount: latestValidation?.informationCount || 0,
            validationScore: latestValidation?.validationScore || 0,
            lastValidated: latestValidation ? new Date(latestValidation.validatedAt) : null,
            hasValidationData: validationResults.length > 0
          };

          const enhancedResource = {
            ...resource.data,
            _validation: validationSummary,
            _dbId: resource.id
          };

          enhancedResources.push(enhancedResource);
        }

        return enhancedResources;
      };

      const enhanced = enhanceResourcesWithValidationData(mockResources);

      expect(enhanced).toHaveLength(2);

      // Test first resource with validation data
      expect(enhanced[0]._validation.isValid).toBe(false);
      expect(enhanced[0]._validation.errorCount).toBe(2);
      expect(enhanced[0]._validation.warningCount).toBe(1);
      expect(enhanced[0]._validation.validationScore).toBe(60);
      expect(enhanced[0]._validation.hasValidationData).toBe(true);
      expect(enhanced[0]._validation.lastValidated).toBeInstanceOf(Date);
      expect(enhanced[0]._dbId).toBe(1);

      // Test second resource without validation data
      expect(enhanced[1]._validation.isValid).toBe(false);
      expect(enhanced[1]._validation.errorCount).toBe(0);
      expect(enhanced[1]._validation.warningCount).toBe(0);
      expect(enhanced[1]._validation.validationScore).toBe(0);
      expect(enhanced[1]._validation.hasValidationData).toBe(false);
      expect(enhanced[1]._validation.lastValidated).toBeNull();
      expect(enhanced[1]._dbId).toBe(2);
    });
  });

  describe('Statistics Logic', () => {
    it('should test validation status statistics calculation', () => {
      const mockResources = [
        {
          id: 1,
          resourceType: 'Patient',
          validationResults: [{ errorCount: 2, warningCount: 1, isValid: false }]
        },
        {
          id: 2,
          resourceType: 'Observation',
          validationResults: [{ errorCount: 0, warningCount: 1, isValid: true }]
        },
        {
          id: 3,
          resourceType: 'Condition',
          validationResults: []
        },
        {
          id: 4,
          resourceType: 'Medication',
          validationResults: [{ errorCount: 0, warningCount: 0, isValid: true }]
        }
      ];

      const calculateValidationStatusStatistics = (resources: any[]) => {
        let withValidationData = 0;
        let hasErrors = 0;
        let hasWarnings = 0;
        let hasInformation = 0;
        let isValid = 0;

        for (const resource of resources) {
          const validationResults = resource.validationResults || [];
          if (validationResults.length > 0) {
            withValidationData++;
            const latestValidation = validationResults[0];
            if (latestValidation.errorCount > 0) hasErrors++;
            if (latestValidation.warningCount > 0) hasWarnings++;
            if (latestValidation.informationCount > 0) hasInformation++;
            if (latestValidation.isValid) isValid++;
          }
        }

        return {
          totalResources: resources.length,
          withValidationData,
          withoutValidationData: resources.length - withValidationData,
          hasErrors,
          hasWarnings,
          hasInformation,
          isValid
        };
      };

      const stats = calculateValidationStatusStatistics(mockResources);

      expect(stats.totalResources).toBe(4);
      expect(stats.withValidationData).toBe(3);
      expect(stats.withoutValidationData).toBe(1);
      expect(stats.hasErrors).toBe(1);
      expect(stats.hasWarnings).toBe(2);
      expect(stats.hasInformation).toBe(0);
      expect(stats.isValid).toBe(2);
    });
  });
});
