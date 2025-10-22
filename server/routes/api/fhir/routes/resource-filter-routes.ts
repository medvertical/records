import type { Express } from "express";
import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { storage } from "../../../../storage.js";
import { getCurrentFhirClient } from "../helpers/fhir-client-helper";
import { enhanceResourcesWithValidationData } from "../helpers/resource-enhancer";
import { performFhirTextSearch } from "../search/text-search-service";

/**
 * Setup filtered resources routes
 * Handles complex resource filtering with validation data, text search, and FHIR parameters
 */
export function setupResourceFilterRoutes(app: Express, fhirClient: FhirClient | null) {
  // GET /api/fhir/resources/filtered - Get filtered resources with validation data
  app.get("/api/fhir/resources/filtered", async (req, res) => {
    try {
      const {
        resourceTypes, hasErrors, hasWarnings, hasInformation, isValid,
        validationAspects, severities, hasIssuesInAspects,
        issueIds, issueSeverity, issueCategory, issueMessageContains, issuePathContains,
        search, limit = 20, offset = 0, sortBy = 'lastValidated', sortDirection = 'desc',
        serverId = 1, fhirParams, _sort
      } = req.query;

      console.log('[FHIR API] Filtered resources endpoint called with filters:', {
        resourceTypes, validationAspects, severities, hasIssuesInAspects
      });

      const { getValidationBackendFilteringService } = await import('../../../../services/validation/features/validation-backend-filtering-service');
      const filteringService = getValidationBackendFilteringService();
      await filteringService.initialize();

      // Parse query parameters
      const resourceTypesArray = resourceTypes ? (Array.isArray(resourceTypes) ? resourceTypes.map(String) : resourceTypes.toString().split(',')) : [];
      const aspectsArray = validationAspects ? (Array.isArray(validationAspects) ? validationAspects.map(String) : validationAspects.toString().split(',')) : [];
      const severitiesArray = severities ? (Array.isArray(severities) ? severities.map(String) : severities.toString().split(',')) : [];
      const issueIdsArray = issueIds ? (Array.isArray(issueIds) ? issueIds.map(String) : issueIds.toString().split(',')) : [];

      const issueFilter: any = {};
      if (issueIdsArray.length > 0) issueFilter.issueIds = issueIdsArray;
      if (issueSeverity) issueFilter.severity = issueSeverity as string;
      if (issueCategory) issueFilter.category = issueCategory as string;
      if (issueMessageContains) issueFilter.messageContains = issueMessageContains as string;
      if (issuePathContains) issueFilter.pathContains = issuePathContains as string;

      const validationStatus: any = {};
      if (hasErrors !== undefined) validationStatus.hasErrors = hasErrors === 'true';
      if (hasWarnings !== undefined) validationStatus.hasWarnings = hasWarnings === 'true';
      if (hasInformation !== undefined) validationStatus.hasInformation = hasInformation === 'true';
      if (isValid !== undefined) validationStatus.isValid = isValid === 'true';

      const filterOptions = {
        resourceTypes: resourceTypesArray,
        validationStatus: Object.keys(validationStatus).length > 0 ? validationStatus : undefined,
        validationAspects: aspectsArray.length > 0 ? aspectsArray : undefined,
        severities: severitiesArray.length > 0 ? severitiesArray : undefined,
        hasIssuesInAspects: hasIssuesInAspects === 'true',
        issueFilter: Object.keys(issueFilter).length > 0 ? issueFilter : undefined,
        serverId: parseInt(serverId as string),
        search: search as string,
        pagination: { limit: parseInt(limit as string), offset: parseInt(offset as string) },
        sorting: { field: sortBy as any, direction: sortDirection as 'asc' | 'desc' },
        fhirSort: _sort as string | undefined
      };

      const currentFhirClient = getCurrentFhirClient(fhirClient);
      
      // Handle text search
      if (currentFhirClient && search) {
        return await handleTextSearch(res, currentFhirClient, resourceTypesArray, search as string, filterOptions);
      } else if (!currentFhirClient && search) {
        return res.status(503).json({
          success: false,
          error: 'FHIR server not available',
          message: 'Text search requires connection to FHIR server'
        });
      }

      // Handle profile existence filtering
      const profileFilterResult = await handleProfileExistenceFilter(req, currentFhirClient, resourceTypesArray, filterOptions);
      if (profileFilterResult) {
        return res.json(profileFilterResult);
      }

      // Handle FHIR parameter search
      let parsedParams = parseFhirParams(req, fhirParams);
      if (currentFhirClient && resourceTypesArray.length > 0 && Object.keys(parsedParams).length > 0) {
        return await handleFhirParameterSearch(res, currentFhirClient, resourceTypesArray, parsedParams, filterOptions);
      }

      // Default: Use backend filtering service
      const result = await filteringService.filterResourcesWithAspects(filterOptions);
      res.json({
        success: true,
        data: result,
        message: `Found ${result.totalCount} resources matching the filter criteria`
      });
    } catch (error) {
      console.error('[FHIR API] Error filtering resources:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to filter resources',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/fhir/resources/filtered/statistics
  app.get("/api/fhir/resources/filtered/statistics", async (req, res) => {
    try {
      const { getValidationBackendFilteringService } = await import('../../../../services/validation/features/validation-backend-filtering-service');
      const filteringService = getValidationBackendFilteringService();
      await filteringService.initialize();

      const availableResourceTypes = await filteringService.getAvailableResourceTypes();
      const validationStatistics = await filteringService.getValidationStatusStatistics();

      res.json({
        success: true,
        data: { availableResourceTypes, validationStatistics }
      });
    } catch (error) {
      console.error('[FHIR API] Error getting filtering statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get filtering statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * Handle text search requests
 */
async function handleTextSearch(res: any, fhirClient: FhirClient, resourceTypesArray: string[], search: string, filterOptions: any) {
  const searchResourceTypes = resourceTypesArray.length > 0 ? resourceTypesArray :
    ['Patient', 'Practitioner', 'Organization', 'Observation', 'Condition', 'DiagnosticReport', 'Medication', 'Encounter', 'Procedure', 'AllergyIntolerance', 'Immunization', 'DocumentReference', 'Location', 'Appointment'];
  
  console.log('[FHIR API] Using FHIR text search:', search, 'in:', searchResourceTypes);
  
  try {
    const searchResults = await performFhirTextSearch(fhirClient, searchResourceTypes, search, filterOptions);
    
    if (searchResults.resources.length > 0) {
      return res.json({
        success: true,
        data: searchResults,
        message: `Found ${searchResults.totalCount} resources via FHIR search (method: ${searchResults.searchMethod})`
      });
    } else {
      if (searchResults.error) {
        return res.json({
          success: true,
          data: { ...searchResults, resources: [], totalCount: 0 },
          message: searchResults.error.message,
          warning: { type: 'unsupported_search_parameter', message: searchResults.error.message }
        });
      }
      return res.json({
        success: true,
        data: { ...searchResults, resources: [], totalCount: 0 },
        message: `No results found for "${search}"`
      });
    }
  } catch (error: any) {
    console.error('[FHIR API] FHIR text search failed:', error.message);
    return res.status(503).json({
      success: false,
      error: 'FHIR server search failed',
      message: error.message
    });
  }
}

/**
 * Handle profile existence filter (_profile:exists or _profile:missing)
 */
async function handleProfileExistenceFilter(req: any, fhirClient: FhirClient | null, resourceTypesArray: string[], filterOptions: any) {
  let profileExistsValue: boolean | null = null;
  let existsModifier: 'exists' | 'missing' | null = null;
  
  // Check URL parameters
  Object.entries(req.query).forEach(([key, value]) => {
    if (key.includes(':')) {
      const [paramName, operator] = key.split(':');
      if (paramName === '_profile') {
        if (operator === 'exists') {
          profileExistsValue = value === 'true';
          existsModifier = 'exists';
        } else if (operator === 'missing') {
          profileExistsValue = value === 'false';
          existsModifier = 'missing';
        }
      }
    }
  });
  
  if (profileExistsValue === null) return null;
  
  // Check server capabilities
  let useClientSideFiltering = false;
  if (existsModifier && fhirClient) {
    try {
      const { ServerCapabilitiesCache } = await import('../../../../services/fhir/server-capabilities-cache.js');
      const activeServer = await storage.getActiveFhirServer();
      
      if (activeServer) {
        const capabilities = await ServerCapabilitiesCache.getCapabilities(activeServer.id, fhirClient, activeServer.url);
        useClientSideFiltering = !capabilities.searchModifiers[existsModifier];
      }
    } catch (error) {
      useClientSideFiltering = true;
    }
  }
  
  if (!useClientSideFiltering && fhirClient) {
    return await serverSideProfileFilter(fhirClient, resourceTypesArray, profileExistsValue, existsModifier!, filterOptions);
  } else if (fhirClient) {
    return await clientSideProfileFilter(fhirClient, resourceTypesArray, profileExistsValue, existsModifier!, filterOptions);
  }
  
  return null;
}

/**
 * Server-side profile filtering
 */
async function serverSideProfileFilter(fhirClient: FhirClient, resourceTypes: string[], profileExists: boolean, modifier: string, filterOptions: any) {
  const searchParams: Record<string, any> = {
    _count: filterOptions.pagination.limit || 50,
    _skip: filterOptions.pagination.offset || 0,
    _total: 'accurate'
  };
  
  if (modifier === 'missing') {
    searchParams['_profile:missing'] = profileExists ? 'false' : 'true';
  } else {
    searchParams['_profile:exists'] = profileExists ? 'true' : 'false';
  }
  
  const types = resourceTypes.length > 0 ? resourceTypes : ['Patient', 'Observation', 'Condition', 'Procedure', 'Encounter'];
  const results = await Promise.all(types.map(async (type) => {
    try {
      const bundle = await fhirClient.searchResources(type, searchParams);
      return { resources: bundle.entry?.map(e => e.resource) || [], total: bundle.total || 0 };
    } catch (error: any) {
      return { resources: [], total: 0 };
    }
  }));
  
  const allResources = results.flatMap(r => r.resources);
  const totalCount = results.reduce((sum, r) => sum + r.total, 0);
  const enhanced = await enhanceResourcesWithValidationData(allResources);
  
  return {
    success: true,
    data: {
      resources: enhanced,
      totalCount: totalCount > 0 ? totalCount : enhanced.length,
      returnedCount: enhanced.length,
      pagination: { limit: filterOptions.pagination.limit || 50, offset: filterOptions.pagination.offset || 0, hasMore: enhanced.length >= (filterOptions.pagination.limit || 50) },
      searchMethod: 'server_side_filter'
    },
    message: `Found ${enhanced.length} resources ${profileExists ? 'with' : 'without'} profiles using server-side filtering`
  };
}

/**
 * Client-side profile filtering
 */
async function clientSideProfileFilter(fhirClient: FhirClient, resourceTypes: string[], profileExists: boolean, modifier: string, filterOptions: any) {
  const types = resourceTypes.length > 0 ? resourceTypes : ['Patient', 'Practitioner', 'Organization', 'Observation', 'Condition'];
  const userPageSize = filterOptions.pagination.limit || 50;
  const userOffset = filterOptions.pagination.offset || 0;
  
  let allFoundResources: any[] = [];
  let totalProcessed = 0;
  const MAX_BATCHES_PER_TYPE = 50;
  const MAX_TOTAL_PROCESSED = 10000;
  
  for (const resourceType of types) {
    if (allFoundResources.length >= userPageSize || totalProcessed >= MAX_TOTAL_PROCESSED) break;
    
    let resourceTypeOffset = 0;
    let batchCount = 0;
    let consecutiveEmptyBatches = 0;
    
    while (allFoundResources.length < userPageSize && batchCount < MAX_BATCHES_PER_TYPE && totalProcessed < MAX_TOTAL_PROCESSED) {
      try {
        const bundle = await fhirClient.searchResources(resourceType, {
          _count: 100,
          _skip: resourceTypeOffset,
          _total: 'accurate'
        });
        
        if (!bundle?.entry || bundle.entry.length === 0) break;
        
        const filteredResources = bundle.entry
          .map((entry: any) => entry.resource)
          .filter((resource: any) => {
            const hasProfile = resource.meta?.profile && Array.isArray(resource.meta.profile) && resource.meta.profile.length > 0;
            return profileExists ? hasProfile : !hasProfile;
          });
        
        const needed = userPageSize - allFoundResources.length;
        allFoundResources.push(...filteredResources.slice(0, needed));
        
        totalProcessed += bundle.entry.length;
        resourceTypeOffset += bundle.entry.length;
        batchCount++;
        
        if (filteredResources.length === 0) {
          consecutiveEmptyBatches++;
          if (consecutiveEmptyBatches >= 10) break;
        } else {
          consecutiveEmptyBatches = 0;
        }
        
        if (bundle.entry.length < 100) break;
        if (allFoundResources.length >= userPageSize) break;
      } catch (error: any) {
        console.log(`[FHIR API] Failed to fetch ${resourceType}:`, error.message);
        break;
      }
    }
  }
  
  const paginatedResults = allFoundResources.slice(userOffset, userOffset + userPageSize);
  
  return {
    success: true,
    data: {
      resources: paginatedResults,
      totalCount: allFoundResources.length,
      returnedCount: paginatedResults.length,
      pagination: { limit: userPageSize, offset: userOffset, hasMore: allFoundResources.length >= userPageSize },
      searchMethod: 'client_side_filter'
    },
    message: `Found ${allFoundResources.length} resources ${profileExists ? 'with' : 'without'} profiles`
  };
}

/**
 * Parse FHIR parameters from request
 */
function parseFhirParams(req: any, fhirParams: any): Record<string, { operator?: string; value: any }> {
  let parsedParams: Record<string, { operator?: string; value: any }> = {};
  
  if (fhirParams) {
    try {
      parsedParams = typeof fhirParams === 'string' ? JSON.parse(fhirParams) : {};
    } catch (e) {
      parsedParams = {};
    }
  }
  
  Object.entries(req.query).forEach(([key, value]) => {
    if (key.includes(':')) {
      const [paramName, operator] = key.split(':');
      if (!parsedParams[paramName] && !(paramName === '_profile' && operator === 'exists' && value === 'true')) {
        parsedParams[paramName] = { operator, value };
      }
    }
  });
  
  return parsedParams;
}

/**
 * Handle FHIR parameter search
 */
async function handleFhirParameterSearch(res: any, fhirClient: FhirClient, resourceTypes: string[], parsedParams: any, filterOptions: any) {
  const allResources: any[] = [];
  let totalFromBundles = 0;
  let hasNextLink = false;
  
  for (const rt of resourceTypes) {
    const q: Record<string, string | number> = {};
    
    Object.entries(parsedParams).forEach(([name, cfg]: [string, any]) => {
      if (cfg?.value !== undefined && cfg.value !== null && cfg.value !== '') {
        const op = cfg.operator || 'eq';
        const val = cfg.value;
        
        switch (op) {
          case 'eq': q[name] = String(val); break;
          case 'gt': case 'lt': case 'ge': case 'le': q[name] = `${op}${val}`; break;
          case 'contains': q[`${name}:contains`] = String(val); break;
          case 'exact': q[`${name}:exact`] = String(val); break;
          case 'notEquals': q[`${name}:not`] = String(val); break;
          default: q[name] = String(val);
        }
      }
    });

    q['_count'] = filterOptions.pagination.limit;
    if (filterOptions.pagination.offset > 0) q['_skip'] = filterOptions.pagination.offset;
    if (filterOptions.fhirSort) q['_sort'] = filterOptions.fhirSort;

    try {
      const bundle = await fhirClient.searchResources(rt, q, filterOptions.pagination.limit);
      const resources = bundle.entry?.map((e: any) => e.resource) || [];
      allResources.push(...resources);
      
      if (bundle.total !== undefined) totalFromBundles += bundle.total;
      if (bundle.link?.find((l: any) => l.relation === 'next')) hasNextLink = true;
    } catch (err: any) {
      console.warn(`[FHIR API] FHIR search failed for ${rt}:`, err.message);
    }
  }

  const enhanced = await enhanceResourcesWithValidationData(allResources);
  const returnedCount = enhanced.length;
  const totalCount = totalFromBundles > 0 ? totalFromBundles : returnedCount;
  const hasMore = hasNextLink || (returnedCount >= filterOptions.pagination.limit);

  return res.json({
    success: true,
    data: {
      resources: enhanced,
      totalCount,
      returnedCount,
      hasMore,
      pagination: { limit: filterOptions.pagination.limit, offset: filterOptions.pagination.offset, hasMore },
      statistics: {
        validationStatistics: {
          totalResources: totalCount,
          withValidationData: enhanced.filter(r => !!r._validationSummary).length,
          withoutValidationData: enhanced.filter(r => !r._validationSummary).length,
          hasErrors: enhanced.filter(r => r._validationSummary?.hasErrors).length,
          hasWarnings: enhanced.filter(r => r._validationSummary?.hasWarnings).length,
          hasInformation: 0,
          isValid: enhanced.filter(r => r._validationSummary?.isValid).length,
        },
        availableResourceTypes: resourceTypes,
      }
    },
    message: `Found ${totalCount} resources via FHIR search`
  });
}

