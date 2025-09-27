/**
 * Validation Resource Type Filtering Service
 * 
 * This service handles filtering of resources based on resource type settings.
 * It determines which resources should be validated based on the current
 * validation settings configuration.
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { COMMON_FHIR_RESOURCE_TYPES } from '@shared/validation-settings-simplified';

export interface ResourceTypeFilter {
  enabled: boolean;
  includedTypes: Set<string>;
  excludedTypes: Set<string>;
  latestOnly: boolean;
  lastUpdated: Date;
}

export interface ResourceTypeFilterResult {
  shouldValidate: boolean;
  reason?: string;
  filterApplied: ResourceTypeFilter;
}

export interface ResourceTypeStatistics {
  totalResources: number;
  filteredResources: number;
  includedByType: { [resourceType: string]: number };
  excludedByType: { [resourceType: string]: number };
  latestOnlyCount: number;
}

class ValidationResourceTypeFilteringService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private currentFilter: ResourceTypeFilter | null = null;
  private isInitialized = false;

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
    this.settingsService.on('settingsChanged', this.handleSettingsChanged.bind(this));
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.updateFilterFromSettings();
    this.isInitialized = true;
  }

  private async updateFilterFromSettings(): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      const resourceTypesConfig = settings.resourceTypes;

      this.currentFilter = {
        enabled: resourceTypesConfig.enabled,
        includedTypes: new Set(resourceTypesConfig.includedTypes),
        excludedTypes: new Set(resourceTypesConfig.excludedTypes),
        latestOnly: resourceTypesConfig.latestOnly,
        lastUpdated: new Date(),
      };

      this.emit('filterChanged', this.currentFilter);
    } catch (error) {
      console.error('[ValidationResourceTypeFilteringService] Error updating filter from settings:', error);
      // Fallback to no filtering if settings cannot be retrieved
      this.currentFilter = {
        enabled: false,
        includedTypes: new Set(),
        excludedTypes: new Set(),
        latestOnly: false,
        lastUpdated: new Date(),
      };
      this.emit('filterChanged', this.currentFilter);
    }
  }

  private handleSettingsChanged(): void {
    this.updateFilterFromSettings();
  }

  getCurrentFilter(): ResourceTypeFilter | null {
    return this.currentFilter;
  }

  /**
   * Determines if a resource should be validated based on its type and current filter settings.
   */
  shouldValidateResource(resourceType: string, isLatestVersion: boolean = true): ResourceTypeFilterResult {
    if (!this.currentFilter) {
      console.warn('[ValidationResourceTypeFilteringService] Filter not initialized, allowing validation.');
      return {
        shouldValidate: true,
        reason: 'Filter not initialized',
        filterApplied: {
          enabled: false,
          includedTypes: new Set(),
          excludedTypes: new Set(),
          latestOnly: false,
          lastUpdated: new Date(),
        }
      };
    }

    const filter = this.currentFilter;

    // If filtering is disabled, validate all resources
    if (!filter.enabled) {
      return {
        shouldValidate: true,
        reason: 'Resource type filtering disabled',
        filterApplied: filter
      };
    }

    // Check if resource type is explicitly excluded
    if (filter.excludedTypes.has(resourceType)) {
      return {
        shouldValidate: false,
        reason: `Resource type '${resourceType}' is excluded`,
        filterApplied: filter
      };
    }

    // Check if latestOnly is enabled and this is not the latest version
    if (filter.latestOnly && !isLatestVersion) {
      return {
        shouldValidate: false,
        reason: 'Only latest versions are validated',
        filterApplied: filter
      };
    }

    // If includedTypes is empty, validate all non-excluded types
    if (filter.includedTypes.size === 0) {
      return {
        shouldValidate: true,
        reason: 'No specific types included, validating all non-excluded types',
        filterApplied: filter
      };
    }

    // Check if resource type is in the included list
    if (filter.includedTypes.has(resourceType)) {
      return {
        shouldValidate: true,
        reason: `Resource type '${resourceType}' is included`,
        filterApplied: filter
      };
    }

    // Resource type is not in included list
    return {
      shouldValidate: false,
      reason: `Resource type '${resourceType}' is not included`,
      filterApplied: filter
    };
  }

  /**
   * Filters a list of resources based on the current filter settings.
   */
  filterResources<T extends { resourceType: string; isLatestVersion?: boolean }>(
    resources: T[]
  ): { filtered: T[]; statistics: ResourceTypeStatistics } {
    if (!this.currentFilter) {
      return {
        filtered: resources,
        statistics: {
          totalResources: resources.length,
          filteredResources: resources.length,
          includedByType: {},
          excludedByType: {},
          latestOnlyCount: 0
        }
      };
    }

    const filtered: T[] = [];
    const includedByType: { [resourceType: string]: number } = {};
    const excludedByType: { [resourceType: string]: number } = {};
    let latestOnlyCount = 0;

    for (const resource of resources) {
      const result = this.shouldValidateResource(
        resource.resourceType,
        resource.isLatestVersion ?? true
      );

      if (result.shouldValidate) {
        filtered.push(resource);
        includedByType[resource.resourceType] = (includedByType[resource.resourceType] || 0) + 1;
        
        if (this.currentFilter.latestOnly && resource.isLatestVersion) {
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
  }

  /**
   * Gets available resource types for selection in UI.
   */
  getAvailableResourceTypes(): string[] {
    return [...COMMON_FHIR_RESOURCE_TYPES];
  }

  /**
   * Validates resource type filter configuration.
   */
  validateResourceTypeFilter(config: {
    enabled: boolean;
    includedTypes: string[];
    excludedTypes: string[];
    latestOnly: boolean;
  }): { isValid: boolean; errors: string[]; warnings: string[] } {
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
    const invalidIncluded = config.includedTypes.filter(type => !validTypes.has(type));
    const invalidExcluded = config.excludedTypes.filter(type => !validTypes.has(type));

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
  }

  /**
   * Gets statistics about the current filter configuration.
   */
  getFilterStatistics(): {
    isEnabled: boolean;
    totalIncludedTypes: number;
    totalExcludedTypes: number;
    latestOnlyEnabled: boolean;
    availableTypes: number;
  } {
    if (!this.currentFilter) {
      return {
        isEnabled: false,
        totalIncludedTypes: 0,
        totalExcludedTypes: 0,
        latestOnlyEnabled: false,
        availableTypes: COMMON_FHIR_RESOURCE_TYPES.length
      };
    }

    return {
      isEnabled: this.currentFilter.enabled,
      totalIncludedTypes: this.currentFilter.includedTypes.size,
      totalExcludedTypes: this.currentFilter.excludedTypes.size,
      latestOnlyEnabled: this.currentFilter.latestOnly,
      availableTypes: COMMON_FHIR_RESOURCE_TYPES.length
    };
  }
}

let resourceTypeFilteringServiceInstance: ValidationResourceTypeFilteringService;

export function getValidationResourceTypeFilteringService(): ValidationResourceTypeFilteringService {
  if (!resourceTypeFilteringServiceInstance) {
    resourceTypeFilteringServiceInstance = new ValidationResourceTypeFilteringService();
  }
  return resourceTypeFilteringServiceInstance;
}

export function resetValidationResourceTypeFilteringService(): void {
  if (resourceTypeFilteringServiceInstance) {
    resourceTypeFilteringServiceInstance.removeAllListeners();
    resourceTypeFilteringServiceInstance = null as any;
  }
}
