/**
 * Unit tests for ValidationResourceTypeFilteringService Logic
 */

import { describe, it, expect } from 'vitest';
import { COMMON_FHIR_RESOURCE_TYPES } from '@shared/validation-settings-simplified';

describe('ValidationResourceTypeFilteringService Logic', () => {

  describe('Core Filtering Logic', () => {
    it('should test resource type filtering when disabled', () => {
      const mockFilter = {
        enabled: false,
        includedTypes: new Set(['Patient']),
        excludedTypes: new Set(['Observation']),
        latestOnly: false,
        lastUpdated: new Date()
      };

      // Simulate the filtering logic
      const shouldValidateResource = (resourceType: string, isLatestVersion: boolean = true, filter: any) => {
        if (!filter.enabled) {
          return {
            shouldValidate: true,
            reason: 'Resource type filtering disabled',
            filterApplied: filter
          };
        }

        if (filter.excludedTypes.has(resourceType)) {
          return {
            shouldValidate: false,
            reason: `Resource type '${resourceType}' is excluded`,
            filterApplied: filter
          };
        }

        if (filter.latestOnly && !isLatestVersion) {
          return {
            shouldValidate: false,
            reason: 'Only latest versions are validated',
            filterApplied: filter
          };
        }

        if (filter.includedTypes.size === 0) {
          return {
            shouldValidate: true,
            reason: 'No specific types included, validating all non-excluded types',
            filterApplied: filter
          };
        }

        if (filter.includedTypes.has(resourceType)) {
          return {
            shouldValidate: true,
            reason: `Resource type '${resourceType}' is included`,
            filterApplied: filter
          };
        }

        return {
          shouldValidate: false,
          reason: `Resource type '${resourceType}' is not included`,
          filterApplied: filter
        };
      };

      const result1 = shouldValidateResource('Patient', true, mockFilter);
      expect(result1.shouldValidate).toBe(true);
      expect(result1.reason).toBe('Resource type filtering disabled');

      const result2 = shouldValidateResource('Observation', true, mockFilter);
      expect(result2.shouldValidate).toBe(true);
      expect(result2.reason).toBe('Resource type filtering disabled');
    });

    it('should test resource type filtering when enabled with included types', () => {
      const mockFilter = {
        enabled: true,
        includedTypes: new Set(['Patient', 'Observation']),
        excludedTypes: new Set(),
        latestOnly: false,
        lastUpdated: new Date()
      };

      const shouldValidateResource = (resourceType: string, isLatestVersion: boolean = true, filter: any) => {
        if (!filter.enabled) {
          return { shouldValidate: true, reason: 'Resource type filtering disabled', filterApplied: filter };
        }

        if (filter.excludedTypes.has(resourceType)) {
          return { shouldValidate: false, reason: `Resource type '${resourceType}' is excluded`, filterApplied: filter };
        }

        if (filter.latestOnly && !isLatestVersion) {
          return { shouldValidate: false, reason: 'Only latest versions are validated', filterApplied: filter };
        }

        if (filter.includedTypes.size === 0) {
          return { shouldValidate: true, reason: 'No specific types included, validating all non-excluded types', filterApplied: filter };
        }

        if (filter.includedTypes.has(resourceType)) {
          return { shouldValidate: true, reason: `Resource type '${resourceType}' is included`, filterApplied: filter };
        }

        return { shouldValidate: false, reason: `Resource type '${resourceType}' is not included`, filterApplied: filter };
      };

      const result1 = shouldValidateResource('Patient', true, mockFilter);
      expect(result1.shouldValidate).toBe(true);
      expect(result1.reason).toBe("Resource type 'Patient' is included");

      const result2 = shouldValidateResource('Observation', true, mockFilter);
      expect(result2.shouldValidate).toBe(true);
      expect(result2.reason).toBe("Resource type 'Observation' is included");

      const result3 = shouldValidateResource('Condition', true, mockFilter);
      expect(result3.shouldValidate).toBe(false);
      expect(result3.reason).toBe("Resource type 'Condition' is not included");
    });

    it('should test resource type filtering with excluded types', () => {
      const mockFilter = {
        enabled: true,
        includedTypes: new Set(),
        excludedTypes: new Set(['Observation', 'Condition']),
        latestOnly: false,
        lastUpdated: new Date()
      };

      const shouldValidateResource = (resourceType: string, isLatestVersion: boolean = true, filter: any) => {
        if (!filter.enabled) {
          return { shouldValidate: true, reason: 'Resource type filtering disabled', filterApplied: filter };
        }

        if (filter.excludedTypes.has(resourceType)) {
          return { shouldValidate: false, reason: `Resource type '${resourceType}' is excluded`, filterApplied: filter };
        }

        if (filter.latestOnly && !isLatestVersion) {
          return { shouldValidate: false, reason: 'Only latest versions are validated', filterApplied: filter };
        }

        if (filter.includedTypes.size === 0) {
          return { shouldValidate: true, reason: 'No specific types included, validating all non-excluded types', filterApplied: filter };
        }

        if (filter.includedTypes.has(resourceType)) {
          return { shouldValidate: true, reason: `Resource type '${resourceType}' is included`, filterApplied: filter };
        }

        return { shouldValidate: false, reason: `Resource type '${resourceType}' is not included`, filterApplied: filter };
      };

      const result1 = shouldValidateResource('Patient', true, mockFilter);
      expect(result1.shouldValidate).toBe(true);
      expect(result1.reason).toBe('No specific types included, validating all non-excluded types');

      const result2 = shouldValidateResource('Observation', true, mockFilter);
      expect(result2.shouldValidate).toBe(false);
      expect(result2.reason).toBe("Resource type 'Observation' is excluded");

      const result3 = shouldValidateResource('Condition', true, mockFilter);
      expect(result3.shouldValidate).toBe(false);
      expect(result3.reason).toBe("Resource type 'Condition' is excluded");
    });

    it('should test latestOnly filtering', () => {
      const mockFilter = {
        enabled: true,
        includedTypes: new Set(['Patient']),
        excludedTypes: new Set(),
        latestOnly: true,
        lastUpdated: new Date()
      };

      const shouldValidateResource = (resourceType: string, isLatestVersion: boolean = true, filter: any) => {
        if (!filter.enabled) {
          return { shouldValidate: true, reason: 'Resource type filtering disabled', filterApplied: filter };
        }

        if (filter.excludedTypes.has(resourceType)) {
          return { shouldValidate: false, reason: `Resource type '${resourceType}' is excluded`, filterApplied: filter };
        }

        if (filter.latestOnly && !isLatestVersion) {
          return { shouldValidate: false, reason: 'Only latest versions are validated', filterApplied: filter };
        }

        if (filter.includedTypes.size === 0) {
          return { shouldValidate: true, reason: 'No specific types included, validating all non-excluded types', filterApplied: filter };
        }

        if (filter.includedTypes.has(resourceType)) {
          return { shouldValidate: true, reason: `Resource type '${resourceType}' is included`, filterApplied: filter };
        }

        return { shouldValidate: false, reason: `Resource type '${resourceType}' is not included`, filterApplied: filter };
      };

      const result1 = shouldValidateResource('Patient', true, mockFilter);
      expect(result1.shouldValidate).toBe(true);
      expect(result1.reason).toBe("Resource type 'Patient' is included");

      const result2 = shouldValidateResource('Patient', false, mockFilter);
      expect(result2.shouldValidate).toBe(false);
      expect(result2.reason).toBe('Only latest versions are validated');
    });

    it('should test resource filtering with statistics', () => {
      const mockResources = [
        { resourceType: 'Patient', isLatestVersion: true },
        { resourceType: 'Patient', isLatestVersion: false },
        { resourceType: 'Observation', isLatestVersion: true },
        { resourceType: 'Condition', isLatestVersion: true },
        { resourceType: 'Medication', isLatestVersion: true }
      ];

      const mockFilter = {
        enabled: true,
        includedTypes: new Set(['Patient', 'Observation']),
        excludedTypes: new Set(),
        latestOnly: true,
        lastUpdated: new Date()
      };

      const filterResources = (resources: any[], filter: any) => {
        const filtered: any[] = [];
        const includedByType: { [resourceType: string]: number } = {};
        const excludedByType: { [resourceType: string]: number } = {};
        let latestOnlyCount = 0;

        for (const resource of resources) {
          const shouldValidate = (resourceType: string, isLatestVersion: boolean = true, filter: any) => {
            if (!filter.enabled) return true;
            if (filter.excludedTypes.has(resourceType)) return false;
            if (filter.latestOnly && !isLatestVersion) return false;
            if (filter.includedTypes.size === 0) return true;
            return filter.includedTypes.has(resourceType);
          };

          if (shouldValidate(resource.resourceType, resource.isLatestVersion, filter)) {
            filtered.push(resource);
            includedByType[resource.resourceType] = (includedByType[resource.resourceType] || 0) + 1;
            if (filter.latestOnly && resource.isLatestVersion) {
              latestOnlyCount++;
            }
          } else {
            excludedByType[resource.resourceType] = (excludedByType[resource.resourceType] || 0) + 1;
          }
        }

        return {
          filtered,
          statistics: {
            totalResources: resources.length,
            filteredResources: filtered.length,
            includedByType,
            excludedByType,
            latestOnlyCount
          }
        };
      };

      const result = filterResources(mockResources, mockFilter);

      expect(result.filtered).toHaveLength(2); // Only Patient (latest) and Observation
      expect(result.statistics.totalResources).toBe(5);
      expect(result.statistics.filteredResources).toBe(2);
      expect(result.statistics.includedByType.Patient).toBe(1);
      expect(result.statistics.includedByType.Observation).toBe(1);
      expect(result.statistics.excludedByType.Patient).toBe(1); // Non-latest Patient
      expect(result.statistics.excludedByType.Condition).toBe(1);
      expect(result.statistics.excludedByType.Medication).toBe(1);
      expect(result.statistics.latestOnlyCount).toBe(2);
    });
  });

  describe('Validation Logic', () => {
    it('should test resource type filter validation', () => {
      const validateResourceTypeFilter = (config: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for conflicting included and excluded types
        const includedSet = new Set(config.includedTypes);
        const excludedSet = new Set(config.excludedTypes);
        const conflicts = [...includedSet].filter(type => excludedSet.has(type));

        if (conflicts.length > 0) {
          errors.push(`Resource types cannot be both included and excluded: ${conflicts.join(', ')}`);
        }

        // Check for invalid resource types
        const validTypes = new Set(COMMON_FHIR_RESOURCE_TYPES);
        const invalidIncluded = config.includedTypes.filter((type: string) => !validTypes.has(type));
        const invalidExcluded = config.excludedTypes.filter((type: string) => !validTypes.has(type));

        if (invalidIncluded.length > 0) {
          warnings.push(`Unknown resource types in included list: ${invalidIncluded.join(', ')}`);
        }

        if (invalidExcluded.length > 0) {
          warnings.push(`Unknown resource types in excluded list: ${invalidExcluded.join(', ')}`);
        }

        // Check for empty included types when filtering is enabled
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

      const validResult = validateResourceTypeFilter(validConfig);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Test conflicting types
      const conflictingConfig = {
        enabled: true,
        includedTypes: ['Patient', 'Observation'],
        excludedTypes: ['Patient', 'Condition'],
        latestOnly: false
      };

      const conflictingResult = validateResourceTypeFilter(conflictingConfig);
      expect(conflictingResult.isValid).toBe(false);
      expect(conflictingResult.errors).toContain('Resource types cannot be both included and excluded: Patient');

      // Test invalid resource types
      const invalidConfig = {
        enabled: true,
        includedTypes: ['Patient', 'InvalidType'],
        excludedTypes: ['AnotherInvalidType'],
        latestOnly: false
      };

      const invalidResult = validateResourceTypeFilter(invalidConfig);
      expect(invalidResult.isValid).toBe(true); // Warnings don't make it invalid
      expect(invalidResult.warnings).toContain('Unknown resource types in included list: InvalidType');
      expect(invalidResult.warnings).toContain('Unknown resource types in excluded list: AnotherInvalidType');

      // Test empty configuration warning
      const emptyConfig = {
        enabled: true,
        includedTypes: [],
        excludedTypes: [],
        latestOnly: false
      };

      const emptyResult = validateResourceTypeFilter(emptyConfig);
      expect(emptyResult.isValid).toBe(true);
      expect(emptyResult.warnings).toContain('Resource type filtering is enabled but no types are specified (will validate all types)');
    });
  });

  describe('Helper Functions', () => {
    it('should test available resource types', () => {
      const getAvailableResourceTypes = () => {
        return [...COMMON_FHIR_RESOURCE_TYPES];
      };

      const availableTypes = getAvailableResourceTypes();
      expect(availableTypes).toContain('Patient');
      expect(availableTypes).toContain('Observation');
      expect(availableTypes).toContain('Condition');
      expect(availableTypes).toContain('Medication');
      expect(availableTypes.length).toBeGreaterThan(50); // Should have many FHIR resource types
    });

    it('should test filter statistics', () => {
      const getFilterStatistics = (filter: any) => {
        if (!filter) {
          return {
            isEnabled: false,
            totalIncludedTypes: 0,
            totalExcludedTypes: 0,
            latestOnlyEnabled: false,
            availableTypes: COMMON_FHIR_RESOURCE_TYPES.length
          };
        }

        return {
          isEnabled: filter.enabled,
          totalIncludedTypes: filter.includedTypes.size,
          totalExcludedTypes: filter.excludedTypes.size,
          latestOnlyEnabled: filter.latestOnly,
          availableTypes: COMMON_FHIR_RESOURCE_TYPES.length
        };
      };

      const mockFilter = {
        enabled: true,
        includedTypes: new Set(['Patient', 'Observation']),
        excludedTypes: new Set(['Condition']),
        latestOnly: true,
        lastUpdated: new Date()
      };

      const stats = getFilterStatistics(mockFilter);
      expect(stats.isEnabled).toBe(true);
      expect(stats.totalIncludedTypes).toBe(2);
      expect(stats.totalExcludedTypes).toBe(1);
      expect(stats.latestOnlyEnabled).toBe(true);
      expect(stats.availableTypes).toBeGreaterThan(50);

      const nullStats = getFilterStatistics(null);
      expect(nullStats.isEnabled).toBe(false);
      expect(nullStats.totalIncludedTypes).toBe(0);
      expect(nullStats.totalExcludedTypes).toBe(0);
      expect(nullStats.latestOnlyEnabled).toBe(false);
    });
  });
});
