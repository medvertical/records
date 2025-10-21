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
  /** Issue-based filtering */
  issueFilter?: {
    /** Filter by specific issue IDs */
    issueIds?: string[];
    /** Filter by issue severity */
    severity?: 'error' | 'warning' | 'information';
    /** Filter by issue category/aspect */
    category?: string;
    /** Filter by issue message content */
    messageContains?: string;
    /** Filter by issue path */
    pathContains?: string;
  };
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
  hasErrors?: boolean;
  hasWarnings?: boolean;
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
      sorting = { field: 'lastValidated', direction: 'desc' },
      issueFilter = {}
    } = options;

    try {
      // Get all resources
      const allResources = await storage.getFhirResources();
      console.log(`[BackendFiltering] Found ${allResources.length} resources`);
      console.log(`[BackendFiltering] First resource has data field:`, !!allResources[0]?.data);
      if (allResources[0]?.data) {
        console.log(`[BackendFiltering] First resource data keys:`, Object.keys(allResources[0].data).slice(0, 10));
      }

      // Apply resource type filtering
      let filteredResources = allResources;
      if (resourceTypes.length > 0) {
        filteredResources = allResources.filter(resource => 
          resourceTypes.includes(resource.resourceType)
        );
        console.log(`[BackendFiltering] After resource type filtering: ${filteredResources.length} resources`);
      }

      // Apply validation status filtering
      filteredResources = await this.applyValidationStatusFiltering(filteredResources, validationStatus);
      console.log(`[BackendFiltering] After validation status filtering: ${filteredResources.length} resources`);

      // Apply issue-based filtering
      if (issueFilter && Object.keys(issueFilter).length > 0) {
        filteredResources = await this.applyIssueFiltering(filteredResources, issueFilter);
        console.log(`[BackendFiltering] After issue filtering: ${filteredResources.length} resources`);
      }

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
      const filterSummary = await this.calculateFilterSummary(allResources, resourceTypes, validationStatus);

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
      const { fhirResources } = await import('@shared/schema');
      const { validationResultsPerAspect, validationMessages } = await import('@shared/schema-validation-per-aspect');
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
        // Build WHERE conditions array
        const whereConditions = [eq(validationResultsPerAspect.serverId, serverId)];

        if (validationAspects.length > 0) {
          whereConditions.push(inArray(validationResultsPerAspect.aspect, validationAspects));
        }

        if (severities.length > 0) {
          whereConditions.push(inArray(validationMessages.severity, severities));
        }

        // Query validation messages with correct column names and joins
        const matchingMessages = await db
          .select({
            serverId: validationResultsPerAspect.serverId,
            resourceType: validationResultsPerAspect.resourceType,
            fhirId: validationResultsPerAspect.fhirId,
            aspect: validationResultsPerAspect.aspect,
            severity: validationMessages.severity,
          })
          .from(validationMessages)
          .innerJoin(
            validationResultsPerAspect,
            eq(validationMessages.validationResultId, validationResultsPerAspect.id)
          )
          .where(and(...whereConditions));

        console.log(`[BackendFiltering] Found ${matchingMessages.length} messages matching aspect/severity filters`);

        // Create lookup map of (serverId-resourceType-resourceId) -> resource.id
        const resourceLookup = new Map<string, number>();
        for (const resource of allResources) {
          const key = `${serverId}-${resource.resourceType}-${resource.resourceId}`;
          resourceLookup.set(key, resource.id);
        }

        // Collect matching resource IDs using composite key
        const resourceIdsWithMatchingIssues = new Set<number>();
        for (const message of matchingMessages) {
          const key = `${message.serverId}-${message.resourceType}-${message.fhirId}`;
          const resourceId = resourceLookup.get(key);
          if (resourceId) {
            resourceIdsWithMatchingIssues.add(resourceId);
          }
        }

        // Filter resources to only those with matching issues
        if (hasIssuesInAspects) {
          allResources = allResources.filter(r => resourceIdsWithMatchingIssues.has(r.id));
          console.log(`[BackendFiltering] Filtered to ${allResources.length} resources with matching issues`);
        }
      }

      // Fetch validation results for remaining resources using composite key matching
      // Use batching to avoid SQL parameter limit issues with large resource sets
      let validationResults: any[] = [];
      if (allResources.length > 0) {
        const BATCH_SIZE = 100; // Query 100 resources at a time to avoid SQL parameter limits
        
        console.log(`[BackendFiltering] Fetching validation results for ${allResources.length} resources in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < allResources.length; i += BATCH_SIZE) {
          const batch = allResources.slice(i, i + BATCH_SIZE);
          
          // Build conditions for this batch
          const resourceConditions = batch.map(r => 
            and(
              eq(validationResultsPerAspect.serverId, serverId),
              eq(validationResultsPerAspect.resourceType, r.resourceType),
              eq(validationResultsPerAspect.fhirId, r.resourceId)
            )
          );
          
          // Query validation results for this batch
          const batchResults = await db
            .select()
            .from(validationResultsPerAspect)
            .where(or(...resourceConditions));
          
          validationResults.push(...batchResults);
        }
        
        console.log(`[BackendFiltering] Fetched ${validationResults.length} validation results in ${Math.ceil(allResources.length / BATCH_SIZE)} batches`);
      }

      // Attach validation results to resources using composite key lookup
      const resourceMap = new Map<number, any>();
      for (const resource of allResources) {
        resourceMap.set(resource.id, {
          ...resource,
          validationResults: []
        });
      }

      // Create reverse lookup: (serverId-resourceType-fhirId) -> resource.id
      const reverseLookup = new Map<string, number>();
      for (const resource of allResources) {
        const key = `${serverId}-${resource.resourceType}-${resource.resourceId}`;
        reverseLookup.set(key, resource.id);
      }

      for (const result of validationResults) {
        const key = `${result.serverId}-${result.resourceType}-${result.fhirId}`;
        const resourceId = reverseLookup.get(key);
        if (resourceId) {
          const resource = resourceMap.get(resourceId);
          if (resource) {
            resource.validationResults.push(result);
          }
        }
      }

      allResources = Array.from(resourceMap.values());

      // Apply validation status filtering
      let filteredResources = await this.applyValidationStatusFiltering(allResources, validationStatus);
      console.log(`[BackendFiltering] After validation status filtering: ${filteredResources.length} resources`);

      // Apply text search if provided
      if (search) {
        filteredResources = this.applyTextSearch(filteredResources, search);
        console.log(`[BackendFiltering] After text search: ${filteredResources.length} resources`);
      }

      // Apply sorting
      filteredResources = this.applySorting(filteredResources, sorting);

      // Calculate filter summary
      const filterSummary = await this.calculateFilterSummary(filteredResources, resourceTypes, validationStatus);

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

  private async applyValidationStatusFiltering(
    resources: any[],
    validationStatus: BackendFilterOptions['validationStatus']
  ): Promise<any[]> {
    if (!validationStatus || Object.keys(validationStatus).length === 0) {
      return resources;
    }

    const { getResourceValidationSummary } = await import('../../../repositories/validation-groups-repository');
    const activeServer = await storage.getActiveFhirServer();
    const serverId = activeServer?.id || 1;

    // Filter resources asynchronously by fetching validation data
    const filteredResources = [];
    for (const resource of resources) {
      const validationSummary = await getResourceValidationSummary(
        serverId,
        resource.resourceType,
        resource.resourceId
      );

      if (!validationSummary) {
        // No validation data - include if isValid is requested
        if (validationStatus.isValid === true) {
          filteredResources.push(resource);
        }
        continue;
      }

      const hasErrors = validationSummary.errorCount > 0;
      const hasWarnings = validationSummary.warningCount > 0;
      const hasInformation = validationSummary.informationCount > 0;
      const isValid = validationSummary.isValid;

      // Apply validation status filters
      if (validationStatus.hasErrors !== undefined && validationStatus.hasErrors !== hasErrors) {
        continue;
      }
      if (validationStatus.hasWarnings !== undefined && validationStatus.hasWarnings !== hasWarnings) {
        continue;
      }
      if (validationStatus.hasInformation !== undefined && validationStatus.hasInformation !== hasInformation) {
        continue;
      }
      if (validationStatus.isValid !== undefined && validationStatus.isValid !== isValid) {
        continue;
      }

      filteredResources.push(resource);
    }

    return filteredResources;
  }

  private applyTextSearch(resources: any[], search: string): any[] {
    if (!search) return resources;

    const searchLower = search.toLowerCase();
    
    return resources.filter(resource => {
      // Search in resource data
      const resourceData = resource.data;
      if (resourceData) {
        // Handle dot notation searches (e.g., "meta.profile") FIRST
        if (searchLower.includes('.')) {
          const pathParts = searchLower.split('.');
          let current: any = resourceData;
          
          for (const part of pathParts) {
            if (current && typeof current === 'object') {
              current = current[part];
            } else {
              current = null;
              break;
            }
          }
          
          // If we found a value at this path, check if it has actual content
          if (current !== null && current !== undefined) {
            // Exclude empty arrays and empty objects
            if (Array.isArray(current) && current.length === 0) {
              return false; // Empty array - no actual values
            }
            if (typeof current === 'object' && Object.keys(current).length === 0) {
              return false; // Empty object - no actual values
            }
            return true; // Has actual values
          } else {
            return false;
          }
        }
        
        // Fallback to general text search for non-dot-notation searches
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
    const { getResourceValidationSummary } = await import('../../../repositories/validation-groups-repository');
    const activeServer = await storage.getActiveFhirServer();
    const serverId = activeServer?.id || 1;

    for (const resource of resources) {
      try {
        // Fetch validation summary from per-aspect tables
        const validationSummary = await getResourceValidationSummary(
          serverId,
          resource.resourceType,
          resource.resourceId
        );

        // Transform to the format expected by the UI
        const formattedSummary: ResourceValidationSummary = validationSummary ? {
          resourceId: resource.resourceId,
          resourceType: resource.resourceType,
          isValid: validationSummary.isValid,
          errorCount: validationSummary.errorCount,
          warningCount: validationSummary.warningCount,
          informationCount: validationSummary.informationCount,
          validationScore: validationSummary.validationScore,
          lastValidated: validationSummary.lastValidated,
          hasValidationData: true,
          hasErrors: validationSummary.hasErrors,
          hasWarnings: validationSummary.hasWarnings
        } : {
          resourceId: resource.resourceId,
          resourceType: resource.resourceType,
          isValid: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 0,
          lastValidated: null,
          hasValidationData: false,
          hasErrors: false,
          hasWarnings: false
        };

        // Enhance resource with validation data
        // Use _validationSummary for consistency with the rest of the app
        const enhancedResource = {
          ...resource.data,
          resourceId: resource.resourceId, // Map FHIR id to resourceId for consistency
          _validationSummary: formattedSummary,
          _dbId: resource.id
        };

        enhancedResources.push(enhancedResource);
      } catch (error) {
        console.error(`[BackendFiltering] Error enhancing resource ${resource.id}:`, error);
        // Include resource without validation data
        enhancedResources.push({
          ...resource.data,
          resourceId: resource.resourceId,
          _validationSummary: {
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

  private async calculateFilterSummary(
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

    const { getResourceValidationSummary } = await import('../../../repositories/validation-groups-repository');
    const activeServer = await storage.getActiveFhirServer();
    const serverId = activeServer?.id || 1;

    // Count validation status across all resources
    for (const resource of allResources) {
      const validationSummary = await getResourceValidationSummary(
        serverId,
        resource.resourceType,
        resource.resourceId
      );
      
      if (validationSummary) {
        if (validationSummary.errorCount > 0) summary.validationStatus.hasErrors++;
        if (validationSummary.warningCount > 0) summary.validationStatus.hasWarnings++;
        if (validationSummary.informationCount > 0) summary.validationStatus.hasInformation++;
        if (validationSummary.isValid) summary.validationStatus.isValid++;
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
      const { getResourceValidationSummary } = await import('../../../repositories/validation-groups-repository');
      const activeServer = await storage.getActiveFhirServer();
      const serverId = activeServer?.id || 1;
      
      let withValidationData = 0;
      let hasErrors = 0;
      let hasWarnings = 0;
      let hasInformation = 0;
      let isValid = 0;

      for (const resource of resources) {
        const validationSummary = await getResourceValidationSummary(
          serverId,
          resource.resourceType,
          resource.resourceId
        );
        
        if (validationSummary) {
          withValidationData++;
          if (validationSummary.errorCount > 0) hasErrors++;
          if (validationSummary.warningCount > 0) hasWarnings++;
          if (validationSummary.informationCount > 0) hasInformation++;
          if (validationSummary.isValid) isValid++;
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

  /**
   * Apply issue-based filtering to resources
   */
  private async applyIssueFiltering(
    resources: any[],
    issueFilter: BackendFilterOptions['issueFilter']
  ): Promise<any[]> {
    if (!issueFilter || Object.keys(issueFilter).length === 0) {
      return resources;
    }

    try {
      const filteredResources = [];

      for (const resource of resources) {
        // Get validation results for this resource
        const validationResults = await storage.getValidationResultsByResourceId(resource.id);
        
        if (!validationResults || validationResults.length === 0) {
          continue; // Skip resources without validation results
        }

        // Check if resource matches issue filter criteria
        let matchesFilter = false;

        // Iterate through all validation results for this resource
        for (const result of validationResults) {
          const issues = (result.issues as any[]) || [];
          
          for (const issue of issues) {
          // Filter by specific issue IDs
          if (issueFilter.issueIds && issueFilter.issueIds.length > 0) {
            if (!issueFilter.issueIds.includes(issue.id)) {
              continue;
            }
          }

          // Filter by severity
          if (issueFilter.severity && issue.severity?.toLowerCase() !== issueFilter.severity?.toLowerCase()) {
            continue;
          }

          // Filter by category/aspect
          if (issueFilter.category && issue.category !== issueFilter.category) {
            continue;
          }

          // Filter by message content
          if (issueFilter.messageContains) {
            const messageLower = issue.message?.toLowerCase() || '';
            if (!messageLower.includes(issueFilter.messageContains.toLowerCase())) {
              continue;
            }
          }

          // Filter by path
          if (issueFilter.pathContains) {
            const pathLower = issue.path?.toLowerCase() || '';
            if (!pathLower.includes(issueFilter.pathContains.toLowerCase())) {
              continue;
            }
          }

            // If we get here, this issue matches all filter criteria
            matchesFilter = true;
            break;
          }
          
          if (matchesFilter) break;
        }

        if (matchesFilter) {
          filteredResources.push(resource);
        }
      }

      return filteredResources;
    } catch (error) {
      console.error('[BackendFiltering] Error applying issue filtering:', error);
      // Return original resources if filtering fails
      return resources;
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
