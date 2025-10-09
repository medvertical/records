/**
 * Validation Backend Filtering Service
 * 
 * This service provides backend filtering capabilities for the resource browser,
 * allowing users to filter resources by validation status (errors/warnings) and
 * resource type in combination.
 */

import { EventEmitter } from 'events';
import { storage } from '../../../storage';
import { getValidationResultFilteringService } from './validation-result-filtering-service';
import { getValidationResourceTypeFilteringService } from './validation-resource-type-filtering-service';
import type { ValidationResult } from '../types/validation-types';

export interface BackendFilterOptions {
  /** Resource types to include (empty means all types) */
  resourceTypes?: string[];
  /** Validation status filters */
  validationStatus?: {
    /** Include resources with errors */
    hasErrors?: boolean;
    /** Include resources with warnings */
    hasWarnings?: boolean;
    /** Include resources with information issues */
    hasInformation?: boolean;
    /** Include resources that are valid (no errors) */
    isValid?: boolean;
  };
  /** Validation aspects to filter by (structural, profile, terminology, reference, businessRule, metadata) */
  validationAspects?: string[];
  /** Severities to filter by (error, warning, information) */
  severities?: string[];
  /** Only show resources with issues in the specified aspects */
  hasIssuesInAspects?: boolean;
  /** Server ID to filter by */
  serverId?: number;
  /** Text search across resource content */
  search?: string;
  /** Pagination options */
  pagination?: {
    limit?: number;
    offset?: number;
  };
  /** Sorting options */
  sorting?: {
    field: 'resourceType' | 'lastValidated' | 'validationScore' | 'errorCount' | 'warningCount';
    direction: 'asc' | 'desc';
  };
}

export interface FilteredResourceResult {
  /** The filtered resources */
  resources: any[];
  /** Total count of resources matching the filter */
  totalCount: number;
  /** Number of resources returned in this page */
  returnedCount: number;
  /** Pagination information */
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** Filter summary */
  filterSummary: {
    resourceTypes: string[];
    validationStatus: {
      hasErrors: number;
      hasWarnings: number;
      hasInformation: number;
      isValid: number;
    };
    totalMatching: number;
  };
  /** Applied filters */
  appliedFilters: BackendFilterOptions;
}

export interface ResourceValidationSummary {
  resourceId: string;
  resourceType: string;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  validationScore: number;
  lastValidated: Date | null;
  hasValidationData: boolean;
}

class ValidationBackendFilteringService extends EventEmitter {
  private resultFilteringService: ReturnType<typeof getValidationResultFilteringService>;
  private resourceTypeFilteringService: ReturnType<typeof getValidationResourceTypeFilteringService>;
  private isInitialized = false;

  constructor() {
    super();
    this.resultFilteringService = getValidationResultFilteringService();
    this.resourceTypeFilteringService = getValidationResourceTypeFilteringService();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.resultFilteringService.initialize();
    await this.resourceTypeFilteringService.initialize();
    
    this.isInitialized = true;
  }

  /**
   * Filter resources based on the provided options
   */
  async filterResources(options: BackendFilterOptions = {}): Promise<FilteredResourceResult> {
    await this.initialize();

    const {
      resourceTypes = [],
      validationStatus = {},
      search = '',
      pagination = { limit: 50, offset: 0 },
      sorting = { field: 'lastValidated', direction: 'desc' }
    } = options;

    try {
      // Get all resources
      const allResources = await storage.getFhirResources();
      console.log(`[BackendFiltering] Found ${allResources.length} resources`);

      // Apply resource type filtering
      let filteredResources = allResources;
      if (resourceTypes.length > 0) {
        filteredResources = allResources.filter(resource => 
          resourceTypes.includes(resource.resourceType)
        );
        console.log(`[BackendFiltering] After resource type filtering: ${filteredResources.length} resources`);
      }

      // Apply validation status filtering
      filteredResources = this.applyValidationStatusFiltering(filteredResources, validationStatus);
      console.log(`[BackendFiltering] After validation status filtering: ${filteredResources.length} resources`);

      // Apply text search if provided
      if (search) {
        filteredResources = this.applyTextSearch(filteredResources, search);
        console.log(`[BackendFiltering] After text search: ${filteredResources.length} resources`);
      }

      // Apply sorting
      filteredResources = this.applySorting(filteredResources, sorting);
      console.log(`[BackendFiltering] After sorting: ${filteredResources.length} resources`);

      // Apply pagination
      const totalCount = filteredResources.length;
      const startIndex = pagination.offset || 0;
      const endIndex = startIndex + (pagination.limit || 50);
      const paginatedResources = filteredResources.slice(startIndex, endIndex);

      // Enhance resources with validation data
      const enhancedResources = await this.enhanceResourcesWithValidationData(paginatedResources);

      // Calculate filter summary
      const filterSummary = this.calculateFilterSummary(allResources, resourceTypes, validationStatus);

      return {
        resources: enhancedResources,
        totalCount,
        returnedCount: paginatedResources.length,
        pagination: {
          limit: pagination.limit || 50,
          offset: pagination.offset || 0,
          hasMore: endIndex < totalCount
        },
        filterSummary,
        appliedFilters: options
      };
    } catch (error) {
      console.error('[BackendFiltering] Error filtering resources:', error);
      throw error;
    }
  }

  /**
   * Filter resources with aspect and severity support
   * Uses database queries to filter by validation aspects and message severities
   */
  async filterResourcesWithAspects(options: BackendFilterOptions = {}): Promise<FilteredResourceResult> {
    await this.initialize();

    const {
      resourceTypes = [],
      validationStatus = {},
      validationAspects = [],
      severities = [],
      hasIssuesInAspects = false,
      serverId = 1,
      search = '',
      pagination = { limit: 50, offset: 0 },
      sorting = { field: 'lastValidated', direction: 'desc' }
    } = options;

    try {
      const { db } = await import('../../../db');
      const { fhirResources, validationResultsPerAspect, validationMessages } = await import('@shared/schema-validation-per-aspect');
      const { eq, inArray, and, or, desc, asc, sql } = await import('drizzle-orm');

      // Build base query
      let query = db
        .select({
          id: fhirResources.id,
          resourceType: fhirResources.resourceType,
          resourceId: fhirResources.resourceId,
          data: fhirResources.data,
          lastValidated: fhirResources.lastValidated,
        })
        .from(fhirResources)
        .where(eq(fhirResources.serverId, serverId))
        .$dynamic();

      // Apply resource type filtering
      if (resourceTypes.length > 0) {
        query = query.where(inArray(fhirResources.resourceType, resourceTypes));
      }

      // Fetch all matching resources
      let allResources = await query;
      console.log(`[BackendFiltering] Found ${allResources.length} resources after resource type filtering`);

      // Apply aspect/severity filtering if specified
      if (validationAspects.length > 0 || severities.length > 0) {
        const resourceIdsWithMatchingIssues = new Set<number>();

        // Query validation messages for resources with matching aspects/severities
        const messagesQuery = db
          .select({
            resourceId: validationMessages.resourceId,
            aspect: validationResultsPerAspect.aspect,
            severity: validationMessages.severity,
          })
          .from(validationMessages)
          .innerJoin(
            validationResultsPerAspect,
            eq(validationMessages.aspectResultId, validationResultsPerAspect.id)
          )
          .innerJoin(
            fhirResources,
            eq(validationResultsPerAspect.resourceId, fhirResources.id)
          )
          .where(eq(fhirResources.serverId, serverId))
          .$dynamic();

        // Add aspect filter
        if (validationAspects.length > 0) {
          messagesQuery.where(inArray(validationResultsPerAspect.aspect, validationAspects));
        }

        // Add severity filter
        if (severities.length > 0) {
          messagesQuery.where(inArray(validationMessages.severity, severities));
        }

        const matchingMessages = await messagesQuery;
        console.log(`[BackendFiltering] Found ${matchingMessages.length} messages matching aspect/severity filters`);

        // Collect resource IDs with matching issues
        for (const message of matchingMessages) {
          resourceIdsWithMatchingIssues.add(message.resourceId);
        }

        // Filter resources to only those with matching issues
        if (hasIssuesInAspects) {
          allResources = allResources.filter(r => resourceIdsWithMatchingIssues.has(r.id));
          console.log(`[BackendFiltering] Filtered to ${allResources.length} resources with matching issues`);
        }
      }

      // Fetch validation results for remaining resources
      const resourceIds = allResources.map(r => r.id);
      const validationResults = resourceIds.length > 0 
        ? await db
            .select()
            .from(validationResultsPerAspect)
            .where(inArray(validationResultsPerAspect.resourceId, resourceIds))
        : [];

      // Attach validation results to resources
      const resourceMap = new Map<number, any>();
      for (const resource of allResources) {
        resourceMap.set(resource.id, {
          ...resource,
          validationResults: []
        });
      }

      for (const result of validationResults) {
        const resource = resourceMap.get(result.resourceId);
        if (resource) {
          resource.validationResults.push(result);
        }
      }

      allResources = Array.from(resourceMap.values());

      // Apply validation status filtering
      let filteredResources = this.applyValidationStatusFiltering(allResources, validationStatus);
      console.log(`[BackendFiltering] After validation status filtering: ${filteredResources.length} resources`);

      // Apply text search if provided
      if (search) {
        filteredResources = this.applyTextSearch(filteredResources, search);
        console.log(`[BackendFiltering] After text search: ${filteredResources.length} resources`);
      }

      // Apply sorting
      filteredResources = this.applySorting(filteredResources, sorting);

      // Calculate filter summary
      const filterSummary = this.calculateFilterSummary(filteredResources, resourceTypes, validationStatus);

      // Apply pagination
      const totalCount = filteredResources.length;
      const startIndex = pagination.offset || 0;
      const endIndex = startIndex + (pagination.limit || 50);
      const paginatedResources = filteredResources.slice(startIndex, endIndex);

      // Enhance resources with validation data
      const enhancedResources = await this.enhanceResourcesWithValidationData(paginatedResources);

      return {
        resources: enhancedResources,
        totalCount,
        returnedCount: paginatedResources.length,
        pagination: {
          limit: pagination.limit || 50,
          offset: pagination.offset || 0,
          hasMore: endIndex < totalCount
        },
        filterSummary,
        appliedFilters: options
      };
    } catch (error) {
      console.error('[BackendFiltering] Error filtering resources with aspects:', error);
      throw error;
    }
  }

  private applyValidationStatusFiltering(
    resources: any[],
    validationStatus: BackendFilterOptions['validationStatus']
  ): any[] {
    if (!validationStatus || Object.keys(validationStatus).length === 0) {
      return resources;
    }

    return resources.filter(resource => {
      const validationResults = resource.validationResults || [];
      if (validationResults.length === 0) {
        // No validation data - include if isValid is requested
        return validationStatus.isValid === true;
      }

      const latestValidation = validationResults[0]; // Assuming results are sorted by date desc
      const hasErrors = latestValidation.errorCount > 0;
      const hasWarnings = latestValidation.warningCount > 0;
      const hasInformation = latestValidation.informationCount > 0;
      const isValid = latestValidation.isValid;

      // Apply validation status filters
      if (validationStatus.hasErrors !== undefined && validationStatus.hasErrors !== hasErrors) {
        return false;
      }
      if (validationStatus.hasWarnings !== undefined && validationStatus.hasWarnings !== hasWarnings) {
        return false;
      }
      if (validationStatus.hasInformation !== undefined && validationStatus.hasInformation !== hasInformation) {
        return false;
      }
      if (validationStatus.isValid !== undefined && validationStatus.isValid !== isValid) {
        return false;
      }

      return true;
    });
  }

  private applyTextSearch(resources: any[], search: string): any[] {
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
  }

  private applySorting(resources: any[], sorting: BackendFilterOptions['sorting']): any[] {
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
          const aValidation = a.validationResults?.[0];
          const bValidation = b.validationResults?.[0];
          aValue = aValidation?.validationScore || 0;
          bValue = bValidation?.validationScore || 0;
          break;
        case 'errorCount':
          const aErrors = a.validationResults?.[0]?.errorCount || 0;
          const bErrors = b.validationResults?.[0]?.errorCount || 0;
          aValue = aErrors;
          bValue = bErrors;
          break;
        case 'warningCount':
          const aWarnings = a.validationResults?.[0]?.warningCount || 0;
          const bWarnings = b.validationResults?.[0]?.warningCount || 0;
          aValue = aWarnings;
          bValue = bWarnings;
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
  }

  private async enhanceResourcesWithValidationData(resources: any[]): Promise<any[]> {
    const enhancedResources = [];

    for (const resource of resources) {
      try {
        const validationResults = resource.validationResults || [];
        const latestValidation = validationResults[0];

        // Create validation summary
        const validationSummary: ResourceValidationSummary = {
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

        // Enhance resource with validation data
        const enhancedResource = {
          ...resource.data,
          _validation: validationSummary,
          _dbId: resource.id
        };

        enhancedResources.push(enhancedResource);
      } catch (error) {
        console.error(`[BackendFiltering] Error enhancing resource ${resource.id}:`, error);
        // Include resource without validation data
        enhancedResources.push({
          ...resource.data,
          _validation: {
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            isValid: false,
            errorCount: 0,
            warningCount: 0,
            informationCount: 0,
            validationScore: 0,
            lastValidated: null,
            hasValidationData: false
          },
          _dbId: resource.id
        });
      }
    }

    return enhancedResources;
  }

  private calculateFilterSummary(
    allResources: any[],
    resourceTypes: string[],
    validationStatus: BackendFilterOptions['validationStatus']
  ) {
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
    for (const resource of allResources) {
      const validationResults = resource.validationResults || [];
      if (validationResults.length > 0) {
        const latestValidation = validationResults[0];
        if (latestValidation.errorCount > 0) summary.validationStatus.hasErrors++;
        if (latestValidation.warningCount > 0) summary.validationStatus.hasWarnings++;
        if (latestValidation.informationCount > 0) summary.validationStatus.hasInformation++;
        if (latestValidation.isValid) summary.validationStatus.isValid++;
      }
    }

    summary.totalMatching = allResources.length;
    return summary;
  }

  /**
   * Get available resource types for filtering
   */
  async getAvailableResourceTypes(): Promise<string[]> {
    await this.initialize();
    
    try {
      const resources = await storage.getFhirResources();
      const resourceTypes = [...new Set(resources.map(r => r.resourceType))];
      return resourceTypes.sort();
    } catch (error) {
      console.error('[BackendFiltering] Error getting available resource types:', error);
      return [];
    }
  }

  /**
   * Get validation status statistics
   */
  async getValidationStatusStatistics(): Promise<{
    totalResources: number;
    withValidationData: number;
    withoutValidationData: number;
    hasErrors: number;
    hasWarnings: number;
    hasInformation: number;
    isValid: number;
  }> {
    await this.initialize();

    try {
      const resources = await storage.getFhirResources();
      
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
    } catch (error) {
      console.error('[BackendFiltering] Error getting validation status statistics:', error);
      throw error;
    }
  }
}

let backendFilteringServiceInstance: ValidationBackendFilteringService;

export function getValidationBackendFilteringService(): ValidationBackendFilteringService {
  if (!backendFilteringServiceInstance) {
    backendFilteringServiceInstance = new ValidationBackendFilteringService();
  }
  return backendFilteringServiceInstance;
}

export function resetValidationBackendFilteringService(): void {
  if (backendFilteringServiceInstance) {
    backendFilteringServiceInstance.removeAllListeners();
    backendFilteringServiceInstance = null as any;
  }
}
