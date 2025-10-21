import type { Express } from "express";
import { storage } from "../../../storage.js";
import { FhirClient } from "../../../services/fhir/fhir-client";
import { profileManager } from "../../../services/fhir/profile-manager";
import { FeatureFlags } from "../../../config/feature-flags";
import { serverActivationService } from "../../../services/server-activation-service";
import * as ValidationGroupsRepository from "../../../repositories/validation-groups-repository";
import crypto from 'crypto';
import { db } from "../../../db";
import { editAuditTrail, validationSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { validationQueue } from '../../../services/validation/queue/validation-queue-simple';
import type { ValidationSettings } from '@shared/validation-settings';
import logger from '../../../utils/logger';

// Helper function to get the current FHIR client from server activation service
function getCurrentFhirClient(fhirClient: FhirClient | null): FhirClient | null {
  const currentClient = serverActivationService.getFhirClient();
  return currentClient || fhirClient;
}

// Helper function to compute SHA-256 hash of resource content for audit trail
function computeResourceHash(resource: any): string {
  const normalized = JSON.stringify(resource, Object.keys(resource).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Helper function to validate FHIR resource structure (basic validation)
function validateFhirResourceStructure(resource: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!resource.resourceType) {
    errors.push('Missing required field: resourceType');
  }
  
  if (!resource.id) {
    errors.push('Missing required field: id');
  }
  
  // Check for basic FHIR structure requirements
  if (resource.meta && typeof resource.meta !== 'object') {
    errors.push('meta must be an object');
  }
  
  if (resource.text && typeof resource.text !== 'object') {
    errors.push('text must be an object');
  }
  
  // Size check (max 5MB)
  const resourceSize = JSON.stringify(resource).length;
  if (resourceSize > 5 * 1024 * 1024) {
    errors.push('Resource size exceeds 5MB limit');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Helper function to enhance resources with validation data
async function enhanceResourcesWithValidationData(resources: any[]): Promise<any[]> {
  console.log(`[FHIR API] enhanceResourcesWithValidationData called with ${resources.length} resources`);
  const enhancedResources = [];
  
  // OPTIMIZATION: Batch database operations instead of sequential
  const activeServer = await storage.getActiveFhirServer();
  console.log(`[FHIR API] Active server:`, activeServer);
  
  for (const resource of resources) {
    try {
      // Try to find the resource in our database
      let dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
      console.log(`[FHIR API] Looking up resource ${resource.resourceType}/${resource.id} in database:`, dbResource ? `Found with ID ${dbResource.id}` : 'Not found');
      console.log(`[FHIR API] Resource data for lookup:`, { resourceType: resource.resourceType, id: resource.id });
      
      // If resource doesn't exist in database, create it
      if (!dbResource) {
        try {
          if (activeServer) {
            // Create resource in database
            const resourceData = {
              serverId: activeServer.id,
              resourceType: resource.resourceType,
              resourceId: resource.id,
              versionId: resource.meta?.versionId || '1',
              data: resource,
              resourceHash: null, // Will be calculated during validation
              lastValidated: null
            };
            console.log(`[FHIR API] Creating database entry for ${resource.resourceType}/${resource.id} with data:`, resourceData);
            dbResource = await storage.createFhirResource(resourceData);
            console.log(`[FHIR API] Successfully created database entry for ${resource.resourceType}/${resource.id} with ID: ${dbResource.id}`);
          } else {
            console.warn(`[FHIR API] No active server found, cannot create database entry for ${resource.resourceType}/${resource.id}`);
          }
        } catch (createError: any) {
          console.error(`[FHIR API] Failed to create database entry for ${resource.resourceType}/${resource.id}:`, createError);
          console.error(`[FHIR API] Error details:`, {
            message: createError.message,
            stack: createError.stack,
            code: createError.code,
            detail: createError.detail
          });
        }
      }
      
      if (dbResource) {
        // Get validation summary from per-aspect tables
        const activeServer = await storage.getActiveFhirServer();
        const validationSummary = await ValidationGroupsRepository.getResourceValidationSummary(
          activeServer?.id || 1,
          resource.resourceType,
          resource.id
        );
        
        if (validationSummary) {
          console.log(`[FHIR API] Enhanced ${resource.resourceType}/${resource.id} with per-aspect validation data:`, validationSummary);
        } else {
          console.log(`[FHIR API] No per-aspect validation results found for ${resource.resourceType}/${resource.id}`);
        }
        
        // Enhance the resource with database ID and validation data
        enhancedResources.push({
          ...resource,
          resourceId: resource.id,  // Map FHIR id to resourceId for consistency
          _dbId: dbResource.id,
          _validationSummary: validationSummary
        });
      } else {
        // Resource not in database and couldn't be created, no validation data
        enhancedResources.push({
          ...resource,
          resourceId: resource.id,  // Map FHIR id to resourceId
          _validationSummary: null
        });
      }
    } catch (error: any) {
      console.warn(`[FHIR API] Error enhancing resource ${resource.resourceType}/${resource.id} with validation data:`, error.message);
      // Add resource without validation data if enhancement fails
      enhancedResources.push({
        ...resource,
        resourceId: resource.id,  // Map FHIR id to resourceId
        _validationSummary: null
      });
    }
  }
  
  return enhancedResources;
}

// Mock data helper for testing when FHIR server is unavailable
function createMockBundle(resourceType: string, batchSize: number, offset: number): any {
  const entries = [];
  const actualBatchSize = Math.min(batchSize, 10); // Limit mock batch size
  
  for (let i = 0; i < actualBatchSize; i++) {
    const resourceId = `mock-${resourceType.toLowerCase()}-${offset + i + 1}`;
    const resource = {
      resourceType,
      id: resourceId,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      },
      // Add minimal required fields for validation
      ...(resourceType === 'Patient' && {
        name: [{ family: `Test${i + 1}`, given: ['Patient'] }],
        gender: i % 2 === 0 ? 'male' : 'female',
        birthDate: '1990-01-01'
      }),
      ...(resourceType === 'Observation' && {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '33747-0', display: 'Test Observation' }] },
        subject: { reference: `Patient/mock-patient-${i + 1}` }
      }),
      ...(resourceType === 'Encounter' && {
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
        subject: { reference: `Patient/mock-patient-${i + 1}` }
      })
    };
    
    entries.push({
      fullUrl: `https://mock.server/${resourceType}/${resourceId}`,
      resource,
      search: { mode: 'match' }
    });
  }
  
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 150, // Mock total
    entry: entries
  };
}

/**
 * Perform FHIR text search with fallback strategies
 */
async function performFhirTextSearch(
  fhirClient: FhirClient,
  resourceTypes: string[],
  searchTerm: string,
  filterOptions: any
): Promise<any> {
  console.log(`[FHIR Text Search] Searching for "${searchTerm}" in ${resourceTypes.length} resource types`);
  console.log(`[FHIR Text Search] Pagination: offset=${filterOptions.pagination.offset}, limit=${filterOptions.pagination.limit}`);
  
  const allResults: any[] = [];
  let totalAvailableCount = 0;
  let searchMethod = 'none';
  const bundleMetadata: { total?: number; hasNext?: boolean }[] = [];
  
  // Calculate how many results to fetch from FHIR server
  // IMPORTANT: This function is now called for ALL pages, not just the first one
  const offset = filterOptions.pagination.offset || 0;
  const limit = filterOptions.pagination.limit || 50;
  
  // For pagination, we'll fetch results from the FHIR server with _skip parameter
  // Fetch the exact amount requested for the current page
  const fetchCount = limit;
  
  // Define resource-specific search parameters
  const resourceSearchParams: Record<string, string[]> = {
    'Patient': ['name', 'family', 'given', 'identifier', 'birthdate'],
    'Practitioner': ['name', 'family', 'given', 'identifier'],
    'Organization': ['name', 'identifier'],
    'Observation': ['code', 'value-string', 'value-quantity'],
    'Medication': ['name', 'code'],
    'Condition': ['code', 'clinical-status'],
    'DiagnosticReport': ['code', 'status'],
    'Encounter': ['status', 'class', 'type'],
    'Procedure': ['code', 'status'],
    'AllergyIntolerance': ['code', 'clinical-status'],
    'Immunization': ['vaccine-code', 'status'],
    'DocumentReference': ['type', 'status'],
    'Location': ['name', 'address'],
    'Appointment': ['status', 'service-type']
  };
  
  for (const resourceType of resourceTypes) {
    try {
      let searchSuccessful = false;
      const resourceResults: any[] = [];
      let bundle: any = null;
      
      // Strategy 1: Try _content search parameter (searches narrative and text)
      try {
        console.log(`[FHIR Text Search] Trying _content search for ${resourceType} with term: "${searchTerm}", offset: ${offset}`);
        const searchParams: any = {
          '_content': searchTerm,
          '_count': fetchCount
        };
        
        // Add pagination support with _skip parameter
        if (offset > 0) {
          searchParams._skip = offset;
        }
        
        // Add sorting support
        if (filterOptions.fhirSort) {
          searchParams._sort = filterOptions.fhirSort;
        }
        
        const contentBundle = await fhirClient.searchResources(resourceType, searchParams);
        
        if (contentBundle.entry && contentBundle.entry.length > 0) {
          resourceResults.push(...contentBundle.entry.map((e: any) => e.resource));
          bundle = contentBundle;
          searchMethod = '_content';
          searchSuccessful = true;
          console.log(`[FHIR Text Search] _content search found ${contentBundle.entry.length} results for ${resourceType}`);
        } else {
          console.log(`[FHIR Text Search] _content search returned 0 results for ${resourceType}`);
        }
      } catch (error: any) {
        console.log(`[FHIR Text Search] _content search failed for ${resourceType}:`, error.message);
        
        // Check if this is an OperationOutcome error with structured details
        if (error.outcomeDetails) {
          console.log(`[FHIR Text Search] FHIR server returned OperationOutcome:`, error.outcomeDetails);
          if (error.outcomeDetails.isUnsupportedParam) {
            // Return early with error information from OperationOutcome
            return {
              resources: [],
              totalCount: 0,
              returnedCount: 0,
              hasMore: false,
              pagination: {
                limit: filterOptions.pagination.limit,
                offset: filterOptions.pagination.offset,
                hasMore: false
              },
              searchMethod: 'none',
              error: {
                type: 'unsupported_parameter',
                message: error.outcomeDetails.message,
                details: error.outcomeDetails.details,
                operationOutcome: error.operationOutcome
              }
            };
          }
        }
        
        // Check if this is a "parameter not supported" error (fallback)
        if (error.message && (error.message.includes('not supported') || error.message.includes('not enabled'))) {
          console.log(`[FHIR Text Search] FHIR server does not support _content search parameter`);
          return {
            resources: [],
            totalCount: 0,
            returnedCount: 0,
            hasMore: false,
            pagination: {
              limit: filterOptions.pagination.limit,
              offset: filterOptions.pagination.offset,
              hasMore: false
            },
            searchMethod: 'none',
            error: {
              type: 'unsupported_parameter',
              message: 'FHIR server does not support full-text search (_content parameter)',
              details: error.message
            }
          };
        }
        // Continue to next strategy
      }
      
      // Strategy 2: Try _text search parameter (full-text search)
      if (!searchSuccessful) {
        try {
          console.log(`[FHIR Text Search] Trying _text search for ${resourceType}, offset: ${offset}`);
          const searchParams: any = {
            '_text': searchTerm,
            '_count': fetchCount
          };
          
          // Add pagination support with _skip parameter
          if (offset > 0) {
            searchParams._skip = offset;
          }
          
          // Add sorting support
          if (filterOptions.fhirSort) {
            searchParams._sort = filterOptions.fhirSort;
          }
          
          const textBundle = await fhirClient.searchResources(resourceType, searchParams);
          
          if (textBundle.entry && textBundle.entry.length > 0) {
            resourceResults.push(...textBundle.entry.map((e: any) => e.resource));
            bundle = textBundle;
            searchMethod = '_text';
            searchSuccessful = true;
            console.log(`[FHIR Text Search] _text search found ${textBundle.entry.length} results for ${resourceType}`);
          }
        } catch (error: any) {
          console.log(`[FHIR Text Search] _text search failed for ${resourceType}:`, error.message);
          
          // Check if this is an OperationOutcome error with structured details
          if (error.outcomeDetails) {
            console.log(`[FHIR Text Search] FHIR server returned OperationOutcome:`, error.outcomeDetails);
            if (error.outcomeDetails.isUnsupportedParam) {
              // Return early with error information from OperationOutcome
              return {
                resources: [],
                totalCount: 0,
                returnedCount: 0,
                hasMore: false,
                pagination: {
                  limit: filterOptions.pagination.limit,
                  offset: filterOptions.pagination.offset,
                  hasMore: false
                },
                searchMethod: 'none',
                error: {
                  type: 'unsupported_parameter',
                  message: error.outcomeDetails.message,
                  details: error.outcomeDetails.details,
                  operationOutcome: error.operationOutcome
                }
              };
            }
          }
          
          // Check if this is a "parameter not supported" error (fallback)
          if (error.message && (error.message.includes('not supported') || error.message.includes('not enabled'))) {
            console.log(`[FHIR Text Search] FHIR server does not support _text search parameter`);
            return {
              resources: [],
              totalCount: 0,
              returnedCount: 0,
              hasMore: false,
              pagination: {
                limit: filterOptions.pagination.limit,
                offset: filterOptions.pagination.offset,
                hasMore: false
              },
              searchMethod: 'none',
              error: {
                type: 'unsupported_parameter',
                message: 'FHIR server does not support full-text search (_text parameter)',
                details: error.message
              }
            };
          }
          // Continue to next strategy
        }
      }
      
      // Strategy 3: Resource-specific field searches
      if (!searchSuccessful && resourceSearchParams[resourceType]) {
        console.log(`[FHIR Text Search] Trying resource-specific field searches for ${resourceType}`);
        
        const searchFields = resourceSearchParams[resourceType];
        for (const field of searchFields) {
          try {
            const fieldSearchParams: any = {
              [field]: searchTerm,
              '_count': fetchCount
            };
            
            // Add sorting support
            if (filterOptions.fhirSort) {
              fieldSearchParams._sort = filterOptions.fhirSort;
            }
            
            const fieldBundle = await fhirClient.searchResources(resourceType, fieldSearchParams);
            
            if (fieldBundle.entry && fieldBundle.entry.length > 0) {
              resourceResults.push(...fieldBundle.entry.map((e: any) => e.resource));
              bundle = fieldBundle;
              searchMethod = `field:${field}`;
              searchSuccessful = true;
              console.log(`[FHIR Text Search] Field search (${field}) found ${fieldBundle.entry.length} results for ${resourceType}`);
              break; // Use first successful field search
            }
          } catch (error: any) {
            console.log(`[FHIR Text Search] Field search (${field}) failed for ${resourceType}:`, error.message);
            // Continue to next field
          }
        }
      }
      
      // Strategy 4: Generic search with contains modifier
      if (!searchSuccessful) {
        console.log(`[FHIR Text Search] Trying generic contains search for ${resourceType}`);
        try {
          // Try a generic search that might work on some servers
          const genericSearchParams: any = {
            'name': searchTerm, // Many resources have a name field
            '_count': fetchCount
          };
          
          // Add sorting support
          if (filterOptions.fhirSort) {
            genericSearchParams._sort = filterOptions.fhirSort;
          }
          
          const genericBundle = await fhirClient.searchResources(resourceType, genericSearchParams);
          
          if (genericBundle.entry && genericBundle.entry.length > 0) {
            resourceResults.push(...genericBundle.entry.map((e: any) => e.resource));
            bundle = genericBundle;
            searchMethod = 'generic:name';
            searchSuccessful = true;
            console.log(`[FHIR Text Search] Generic name search found ${genericBundle.entry.length} results for ${resourceType}`);
          }
        } catch (error: any) {
          console.log(`[FHIR Text Search] Generic search failed for ${resourceType}:`, error.message);
        }
      }
      
      if (searchSuccessful && bundle) {
        allResults.push(...resourceResults);
        
        // Extract metadata from bundle
        const metadata: { total?: number; hasNext?: boolean } = {};
        if (bundle.total !== undefined && bundle.total > 0) {
          metadata.total = bundle.total;
          totalAvailableCount += bundle.total;
        } else if (resourceResults.length > 0) {
          // If bundle.total is 0 or undefined but we have results,
          // use the actual result count (FHIR server bug workaround)
          console.log(`[FHIR Text Search] WARNING: Bundle total is ${bundle.total} but got ${resourceResults.length} results`);
          metadata.total = resourceResults.length;
          totalAvailableCount += resourceResults.length;
        }
        // Check for next link in bundle
        if (bundle.link) {
          const nextLink = bundle.link.find((l: any) => l.relation === 'next');
          metadata.hasNext = !!nextLink;
        }
        bundleMetadata.push(metadata);
        
        console.log(`[FHIR Text Search] Bundle metadata for ${resourceType}:`, metadata);
      } else {
        console.log(`[FHIR Text Search] No search strategy worked for ${resourceType}`);
      }
      
    } catch (error: any) {
      console.error(`[FHIR Text Search] Error searching ${resourceType}:`, error);
    }
  }
  
  // Remove duplicates based on resource id and type
  const uniqueResults = allResults.filter((resource, index, self) => 
    index === self.findIndex(r => r.id === resource.id && r.resourceType === resource.resourceType)
  );
  
  console.log(`[FHIR Text Search] Total unique results fetched: ${uniqueResults.length} (method: ${searchMethod})`);
  console.log(`[FHIR Text Search] Search term was: "${searchTerm}"`);
  console.log(`[FHIR Text Search] Resource types searched: ${resourceTypes.join(', ')}`);
  
  // If no search method worked and we have results, this indicates a problem
  // The search should either find specific results or return 0 results
  if (searchMethod === 'none' && uniqueResults.length > 0) {
    console.log(`[FHIR Text Search] WARNING: No search method worked but got ${uniqueResults.length} results - this indicates a bug`);
    // Return 0 results instead of potentially incorrect results
    return {
      resources: [],
      totalCount: 0,
      returnedCount: 0,
      hasMore: false,
      pagination: {
        limit: filterOptions.pagination.limit,
        offset: filterOptions.pagination.offset,
        hasMore: false
      },
      searchMethod: 'none',
      error: {
        type: 'search_failed',
        message: 'FHIR search failed - no search method worked',
        details: 'All search strategies failed but results were returned'
      }
    };
  }
  
  // Enhance resources with validation data
  const enhancedResources = await enhanceResourcesWithValidationData(uniqueResults);
  
  // Apply pagination for the first page (offset is always 0 here)
  const paginatedResources = enhancedResources.slice(0, limit);
  
  // Calculate hasMore based on fetched results
  // We have more if: we fetched more than the page size, OR bundles indicated more results
  const hasMoreFromFetch = enhancedResources.length > limit;
  const hasMoreFromBundles = bundleMetadata.some(m => m.hasNext || (m.total && m.total > fetchCount));
  const hasMore = hasMoreFromFetch || hasMoreFromBundles;
  
  // Use bundle total if available, otherwise use fetched count (conservative estimate)
  const finalTotalCount = totalAvailableCount > 0 ? totalAvailableCount : enhancedResources.length;
  
  console.log(`[FHIR Text Search] First page result: total=${finalTotalCount}, returned=${paginatedResources.length}, hasMore=${hasMore}`);
  
  return {
    resources: paginatedResources,
    totalCount: finalTotalCount,
    returnedCount: paginatedResources.length,
    pagination: {
      limit: limit,
      offset: 0, // Always first page for FHIR text search
      hasMore: hasMore
    },
    filterSummary: {
      resourceTypes: resourceTypes,
      validationStatus: {
        hasErrors: paginatedResources.filter(r => r._validationSummary?.hasErrors).length,
        hasWarnings: paginatedResources.filter(r => r._validationSummary?.hasWarnings).length,
        hasInformation: 0,
        isValid: paginatedResources.filter(r => r._validationSummary?.isValid).length
      },
      totalMatching: finalTotalCount
    },
    appliedFilters: filterOptions,
    searchMethod: searchMethod
  };
}

export function setupFhirRoutes(app: Express, fhirClient: FhirClient | null) {
  console.log('[FHIR Routes] Setting up FHIR routes...');
  console.log('[FHIR Routes] fhirClient is:', fhirClient ? 'initialized' : 'NULL');
  // Note: PUT route for editing resources is registered directly below alongside other /api/fhir/resources routes
  // Batch edit routes would be registered here if needed (currently using direct implementation)

  // NOTE: Server management endpoints have been moved to /api/servers 
  // See server/routes/api/servers.ts for the canonical server management API

  // FHIR Connection Testing
  app.get("/api/fhir/connection/test", async (req, res) => {
    try {
      const { url, auth } = req.query;
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      const result = await currentFhirClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/connection/test-custom", async (req, res) => {
    try {
      const { url, auth } = req.query;
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      const result = await currentFhirClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =========================================================================
  // Filtered Resources Endpoint
  // =========================================================================
  // CRITICAL: These specific routes MUST come BEFORE /api/fhir/resources/:id
  // to prevent Express from matching "filtered" as the :id parameter

  // GET /api/fhir/capability/search-params/:resourceType - Get search params from CapabilityStatement
  app.get("/api/fhir/capability/search-params/:resourceType", async (req, res) => {
    try {
      const { resourceType } = req.params;
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }

      const capability = await currentFhirClient.getCapabilityStatement();
      if (!capability?.rest?.[0]?.resource) {
        return res.json({ resourceType, searchParameters: [] });
      }

      const resourceDef = capability.rest[0].resource.find((r: any) => r.type === resourceType);
      const params: any[] = resourceDef?.searchParam || [];

      // Map FHIR search param types to supported operators (simplified)
      const operatorMap: Record<string, string[]> = {
        string: ["contains", "exact"],
        token: ["equals", "notEquals"],
        date: ["eq", "gt", "lt", "ge", "le"],
        number: ["eq", "gt", "lt", "ge", "le"],
        quantity: ["eq", "gt", "lt", "ge", "le"],
        reference: ["equals"],
        uri: ["equals", "contains"],
      };

      // Special handling for parameters that support the "exists" modifier
      const existsSupportedParams = ['_profile', '_security', '_tag', '_source', 'identifier', 'active', 'deceased', 'gender', 'language'];

      const searchParameters = params.map((p: any) => {
        let operators = operatorMap[p.type] || ["eq"];
        
        // Add "exists" operator for parameters that support it
        if (existsSupportedParams.includes(p.name)) {
          operators = [...operators, "exists"];
        }
        
        return {
          name: p.name,
          type: p.type,
          documentation: p.documentation || "",
          operators: operators,
        };
      });

      res.json({ resourceType, searchParameters });
    } catch (error: any) {
      console.error('[FHIR API] Error getting capability search params:', error);
      res.status(500).json({ message: error.message || 'Failed to get search parameters' });
    }
  });

  // GET /api/fhir/resources/filtered - Get filtered resources with validation data
  app.get("/api/fhir/resources/filtered", async (req, res) => {
    try {
      const {
        resourceTypes,
        hasErrors,
        hasWarnings,
        hasInformation,
        isValid,
        validationAspects,
        severities,
        hasIssuesInAspects,
        // Issue-based filters
        issueIds,
        issueSeverity,
        issueCategory,
        issueMessageContains,
        issuePathContains,
        search,
        limit = 20,
        offset = 0,
        sortBy = 'lastValidated',
        sortDirection = 'desc',
        serverId = 1,
        // New: FHIR search parameters (JSON string)
        fhirParams,
        // FHIR sort parameter
        _sort
      } = req.query;

      console.log('[FHIR API] Filtered resources endpoint called with filters:', {
        resourceTypes,
        validationAspects,
        severities,
        hasIssuesInAspects
      });

      // Get the backend filtering service
      const { getValidationBackendFilteringService } = await import('../../../services/validation/features/validation-backend-filtering-service');
      const filteringService = getValidationBackendFilteringService();
      
      // Initialize if not already done
      await filteringService.initialize();

      // Parse resource types
      const resourceTypesArray: string[] = resourceTypes 
        ? (Array.isArray(resourceTypes) ? resourceTypes.map(String) : resourceTypes.toString().split(','))
        : [];

      // Parse validation aspects filter
      const aspectsArray: string[] = validationAspects
        ? (Array.isArray(validationAspects) ? validationAspects.map(String) : validationAspects.toString().split(','))
        : [];

      // Parse severities filter
      const severitiesArray: string[] = severities
        ? (Array.isArray(severities) ? severities.map(String) : severities.toString().split(','))
        : [];

      // Parse issue-based filters
      const issueIdsArray: string[] = issueIds
        ? (Array.isArray(issueIds) ? issueIds.map(String) : issueIds.toString().split(','))
        : [];

      const issueFilter: any = {};
      if (issueIdsArray.length > 0) issueFilter.issueIds = issueIdsArray;
      if (issueSeverity) issueFilter.severity = issueSeverity as string;
      if (issueCategory) issueFilter.category = issueCategory as string;
      if (issueMessageContains) issueFilter.messageContains = issueMessageContains as string;
      if (issuePathContains) issueFilter.pathContains = issuePathContains as string;

      // Parse validation status filters
      const validationStatus: any = {};
      if (hasErrors !== undefined) validationStatus.hasErrors = hasErrors === 'true';
      if (hasWarnings !== undefined) validationStatus.hasWarnings = hasWarnings === 'true';
      if (hasInformation !== undefined) validationStatus.hasInformation = hasInformation === 'true';
      if (isValid !== undefined) validationStatus.isValid = isValid === 'true';

      // Create filter options
      const filterOptions = {
        resourceTypes: resourceTypesArray,
        validationStatus: Object.keys(validationStatus).length > 0 ? validationStatus : undefined,
        validationAspects: aspectsArray.length > 0 ? aspectsArray : undefined,
        severities: severitiesArray.length > 0 ? severitiesArray : undefined,
        hasIssuesInAspects: hasIssuesInAspects === 'true',
        issueFilter: Object.keys(issueFilter).length > 0 ? issueFilter : undefined,
        serverId: parseInt(serverId as string),
        search: search as string,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        },
        sorting: {
          field: sortBy as any,
          direction: sortDirection as 'asc' | 'desc'
        },
        fhirSort: _sort as string | undefined
      };

      // If search parameter is provided, perform FHIR text search using multiple strategies
      // IMPORTANT: ALWAYS use FHIR server for text searches, never local database
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      
      if (currentFhirClient && search) {
        // If no resource types specified, search common resource types
        const searchResourceTypes = resourceTypesArray.length > 0 
          ? resourceTypesArray 
          : ['Patient', 'Practitioner', 'Organization', 'Observation', 'Condition', 'DiagnosticReport', 'Medication', 'Encounter', 'Procedure', 'AllergyIntolerance', 'Immunization', 'DocumentReference', 'Location', 'Appointment'];
        console.log('[FHIR API] Using FHIR text search for query:', search, 'in resource types:', searchResourceTypes);
        console.log('[FHIR API] Pagination:', filterOptions.pagination);
        try {
          const searchResults = await performFhirTextSearch(
            currentFhirClient, 
            searchResourceTypes, 
            search as string, 
            filterOptions
          );
          
          console.log('[FHIR API] FHIR text search completed. Results:', searchResults.resources.length, 'Method:', searchResults.searchMethod);
          
          if (searchResults.resources.length > 0) {
            return res.json({
              success: true,
              data: searchResults,
              message: `Found ${searchResults.totalCount} resources via FHIR search (method: ${searchResults.searchMethod})`
            });
          } else {
            console.log('[FHIR API] FHIR text search returned no results');
            
            // Check if there's an error (unsupported parameter with OperationOutcome)
            if (searchResults.error) {
              return res.json({
                success: true,
                data: {
                  resources: [],
                  totalCount: 0,
                  returnedCount: 0,
                  hasMore: false,
                  pagination: {
                    limit: filterOptions.pagination.limit,
                    offset: filterOptions.pagination.offset,
                    hasMore: false
                  },
                  filterSummary: {
                    resourceTypes: resourceTypesArray,
                    validationStatus: { hasErrors: 0, hasWarnings: 0, hasInformation: 0, isValid: 0 },
                    totalMatching: 0
                  },
                  appliedFilters: {
                    resourceTypes: resourceTypesArray,
                    serverId: filterOptions.serverId,
                    search: search,
                    pagination: filterOptions.pagination,
                    sorting: filterOptions.sorting
                  },
                  searchMethod: searchResults.searchMethod || 'none',
                  error: searchResults.error
                },
                message: searchResults.error.message,
                warning: {
                  type: 'unsupported_search_parameter',
                  message: searchResults.error.message,
                  details: searchResults.error.details
                }
              });
            }
            
            // Return empty results for normal "no results found" case
            return res.json({
              success: true,
              data: {
                resources: [],
                totalCount: 0,
                returnedCount: 0,
                hasMore: false,
                pagination: {
                  limit: filterOptions.pagination.limit,
                  offset: filterOptions.pagination.offset,
                  hasMore: false
                },
                filterSummary: {
                  resourceTypes: resourceTypesArray,
                  validationStatus: { hasErrors: 0, hasWarnings: 0, hasInformation: 0, isValid: 0 },
                  totalMatching: 0
                },
                appliedFilters: {
                  resourceTypes: resourceTypesArray,
                  serverId: filterOptions.serverId,
                  search: search,
                  pagination: filterOptions.pagination,
                  sorting: filterOptions.sorting
                },
                searchMethod: searchResults.searchMethod || 'none'
              },
              message: `No results found for "${search}"`
            });
          }
        } catch (error: any) {
          console.error('[FHIR API] FHIR text search failed:', error.message);
          console.error('[FHIR API] Full error:', error);
          
          // Return error response instead of falling back to local filtering
          return res.status(503).json({
            success: false,
            error: 'FHIR server search failed',
            message: error.message,
            details: 'Text search requires connection to FHIR server. Local database filtering is not available for text searches.'
          });
        }
      } else if (!currentFhirClient && search) {
        // No FHIR client available but search is requested
        console.log('[FHIR API] Search requested but no FHIR client available');
        return res.status(503).json({
          success: false,
          error: 'FHIR server not available',
          message: 'Text search requires connection to FHIR server',
          details: 'Please ensure a FHIR server is configured and connected.'
        });
      }

      // Handle special case: _profile:exists parameter for searching resources with/without profiles
      // Check if there's a _profile:exists parameter in the query (both URL params and JSON fhirParams)
      let profileExistsValue: boolean | null = null;
      
      // First check direct URL parameters with colons
      Object.entries(req.query).forEach(([key, value]) => {
        if (key.includes(':')) {
          const [paramName, operator] = key.split(':');
          if (paramName === '_profile' && operator === 'exists') {
            profileExistsValue = value === 'true';
          }
        }
      });
      
      // Also check JSON fhirParams if not found in URL params
      if (profileExistsValue === null && fhirParams) {
        try {
          const parsedFhirParams = typeof fhirParams === 'string' ? JSON.parse(fhirParams) : fhirParams;
          if (parsedFhirParams._profile && parsedFhirParams._profile.operator === 'exists') {
            profileExistsValue = parsedFhirParams._profile.value === 'true';
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      // If we have _profile:exists, search FHIR server and filter for resources with/without profiles
      if (profileExistsValue !== null) {
        console.log(`[FHIR API] Searching for resources ${profileExistsValue ? 'with' : 'without'} profiles (_profile:exists=${profileExistsValue})`);
        
        // Use FHIR server search and then filter results
        if (currentFhirClient) {
          try {
            const searchResourceTypes = resourceTypesArray.length > 0 ? resourceTypesArray : ['Patient', 'Practitioner', 'Organization', 'Observation', 'Condition'];
            const allResults: any[] = [];
            const userPageSize = filterOptions.pagination.limit || 50;
            const userOffset = filterOptions.pagination.offset || 0;
            
            // Simple approach: Just fill the page quickly, don't worry about total count
            let allFoundResources: any[] = [];
            let totalProcessed = 0;
            const MAX_BATCHES_PER_TYPE = 10; // Max 10 batches (1000 resources) per type
            const MAX_TOTAL_PROCESSED = 5000; // Hard limit on total resources processed across all types
            
            console.log(`[FHIR API] Fast page-filling approach: Get ${userPageSize} results as quickly as possible`);
            
            for (const resourceType of searchResourceTypes) {
              try {
                let resourceTypeOffset = 0;
                let batchCount = 0;
                let consecutiveEmptyBatches = 0;
                
                console.log(`[FHIR API] Fetching ${resourceType} resources to fill page...`);
                
                // Keep fetching until we have enough results for the page, with smart bailout conditions
                while (allFoundResources.length < userPageSize && 
                       batchCount < MAX_BATCHES_PER_TYPE && 
                       totalProcessed < MAX_TOTAL_PROCESSED) {
                  const bundle = await currentFhirClient.searchResources(resourceType, {
                    _count: 100, // Server's actual batch size
                    _skip: resourceTypeOffset,
                    _total: 'accurate'
                  });
                  
                  if (!bundle?.entry || bundle.entry.length === 0) {
                    break; // No more results
                  }
                  
                  // Filter for resources based on profile existence
                  const filteredResources = bundle.entry
                    .map((entry: any) => entry.resource)
                    .filter((resource: any) => {
                      const hasProfile = resource.meta?.profile && 
                                        Array.isArray(resource.meta.profile) && 
                                        resource.meta.profile.length > 0;
                      return profileExistsValue ? hasProfile : !hasProfile;
                    })
                    .map((resource: any) => ({
                      ...resource,
                      resourceType,
                      _validationSummary: {
                        isValid: true,
                        hasErrors: false,
                        hasWarnings: false,
                        errorCount: 0,
                        warningCount: 0,
                        informationCount: 0,
                        validationScore: 100,
                        lastValidated: new Date().toISOString(),
                        hasValidationData: false
                      }
                    }));
                  
                  // Add only what we need to fill the page
                  const needed = userPageSize - allFoundResources.length;
                  const toAdd = filteredResources.slice(0, needed);
                  allFoundResources.push(...toAdd);
                  
                  totalProcessed += bundle.entry.length;
                  resourceTypeOffset += bundle.entry.length;
                  batchCount++;
                  
                  // Track consecutive empty batches to bail out early
                  if (filteredResources.length === 0) {
                    consecutiveEmptyBatches++;
                  } else {
                    consecutiveEmptyBatches = 0;
                  }
                  
                  console.log(`[FHIR API] ${resourceType} batch ${batchCount}: Found ${filteredResources.length} resources ${profileExistsValue ? 'with' : 'without'} profiles (${allFoundResources.length}/${userPageSize} for page, ${totalProcessed} total processed)`);
                  
                  // Bail out if we've had 3 consecutive batches with no matching resources
                  if (consecutiveEmptyBatches >= 3) {
                    console.log(`[FHIR API] No matches found in ${consecutiveEmptyBatches} consecutive batches, giving up on ${resourceType}`);
                    break;
                  }
                  
                  // If we got fewer results than expected, we might be at the end
                  if (bundle.entry.length < 100) {
                    console.log(`[FHIR API] Reached end of ${resourceType} data`);
                    break;
                  }
                  
                  // If we have enough for the page, stop
                  if (allFoundResources.length >= userPageSize) {
                    console.log(`[FHIR API] Page filled with ${allFoundResources.length} results`);
                    break;
                  }
                }
                
                // Check if we hit the global limit
                if (totalProcessed >= MAX_TOTAL_PROCESSED) {
                  console.log(`[FHIR API] Hit global processing limit of ${MAX_TOTAL_PROCESSED} resources`);
                  break;
                }
                
                console.log(`[FHIR API] Completed ${resourceType}: Found ${allFoundResources.length} resources for page out of ${totalProcessed} processed`);
              } catch (error: any) {
                console.log(`[FHIR API] Failed to fetch ${resourceType}:`, error.message);
                // Continue with other resource types
              }
            }
            
            // Get the requested page
            const paginatedResults = allFoundResources.slice(userOffset, userOffset + userPageSize);
            
            // Calculate pagination metadata
            const totalFound = allFoundResources.length;
            const hasMore = totalFound >= userPageSize; // If we filled the page, there might be more
            
            // Provide helpful message if no results found
            const progressMessage = totalFound === 0 
              ? `No resources found ${profileExistsValue ? 'with' : 'without'} profiles after checking ${totalProcessed} resources. Try searching ${profileExistsValue ? 'without' : 'with'} the profile filter.`
              : `Found ${totalFound} resources ${profileExistsValue ? 'with' : 'without'} profiles after processing ${totalProcessed} resources`;
            
            res.json({
              success: true,
              data: {
                resources: paginatedResults,
                totalCount: totalFound,
                returnedCount: paginatedResults.length,
                hasMore: hasMore,
                pagination: {
                  limit: userPageSize,
                  offset: userOffset,
                  hasMore: hasMore
                },
                searchMethod: 'fhir_profile_filter',
                filterSummary: {
                  resourceTypes: searchResourceTypes,
                  totalMatching: totalFound,
                  processedResources: totalProcessed,
                  progressMessage
                },
                appliedFilters: {
                  resourceTypes: searchResourceTypes,
                  serverId: filterOptions.serverId,
                  pagination: filterOptions.pagination,
                  sorting: filterOptions.sorting,
                  profileExists: profileExistsValue
                }
              },
              message: `Found ${allResults.length} resources ${profileExistsValue ? 'with' : 'without'} profiles`
            });
            return;
          } catch (error: any) {
            console.error('[FHIR API] Profile search failed:', error.message);
            return res.status(503).json({
              success: false,
              error: 'Profile search failed',
              message: error.message
            });
          }
        }
      }

      // Parse FHIR search parameters from query string
      let parsedParams: Record<string, { operator?: string; value: any }> = {};
      
      // First, try to parse fhirParams JSON if provided
      if (fhirParams) {
        try {
          parsedParams = typeof fhirParams === 'string' ? JSON.parse(fhirParams) : {};
        } catch (e) {
          console.warn('[FHIR API] Invalid fhirParams JSON, ignoring:', fhirParams);
          parsedParams = {};
        }
      }
      
      // Also parse FHIR search parameters from URL query parameters
      // Look for parameters like "_profile:equals", "name:contains", etc.
      Object.entries(req.query).forEach(([key, value]) => {
        if (key.includes(':')) {
          const [paramName, operator] = key.split(':');
          // Skip if this is already in parsedParams from JSON
          if (!parsedParams[paramName]) {
            // Handle special case: _profile:exists=true means "has any profile"
            if (paramName === '_profile' && operator === 'exists' && value === 'true') {
              // This is a special case - we'll handle it separately
              // Don't add it to parsedParams, it's handled before this section
              console.log('[FHIR API] Detected _profile:exists=true - handled separately');
            } else {
              parsedParams[paramName] = {
                operator: operator,
                value: value
              };
            }
          }
        }
      });

      // If FHIR search parameters are provided and there are resource types selected,
      // perform server-side FHIR search and enhance results, bypassing local store filtering.
      if (currentFhirClient && resourceTypesArray.length > 0 && Object.keys(parsedParams).length > 0) {

        const allResources: any[] = [];
        let totalFromBundles = 0;
        let hasNextLink = false;
        
        for (const rt of resourceTypesArray) {
          // Construct query params for FHIR search
          const q: Record<string, string | number> = {};
          Object.entries(parsedParams).forEach(([name, cfg]) => {
            if (cfg && (cfg as any).value !== undefined && (cfg as any).value !== null && (cfg as any).value !== '') {
              const op = (cfg as any).operator || 'eq';
              const val = (cfg as any).value;
              // Map operator to FHIR search prefix/modifier where applicable
              switch (op) {
                case 'eq':
                  q[name] = String(val);
                  break;
                case 'gt':
                case 'lt':
                case 'ge':
                case 'le':
                  q[name] = `${op}${val}`;
                  break;
                case 'contains':
                  q[`${name}:contains`] = String(val);
                  break;
                case 'exact':
                  q[`${name}:exact`] = String(val);
                  break;
                case 'notEquals':
                  q[`${name}:not`] = String(val);
                  break;
                default:
                  q[name] = String(val);
              }
            }
          });

          // Pagination
          q['_count'] = filterOptions.pagination.limit;
          if (filterOptions.pagination.offset > 0) {
            q['_skip'] = filterOptions.pagination.offset;
          }
          
          // Sorting
          if (filterOptions.fhirSort) {
            q['_sort'] = filterOptions.fhirSort;
          }

          try {
            const bundle = await currentFhirClient.searchResources(rt, q, filterOptions.pagination.limit);
            const resources = bundle.entry?.map((e: any) => e.resource) || [];
            allResources.push(...resources);
            
            // Extract pagination metadata from bundle
            if (bundle.total !== undefined) {
              totalFromBundles += bundle.total;
              console.log(`[FHIR API] Bundle for ${rt} has total: ${bundle.total}`);
            }
            
            // Check for next link
            if (bundle.link) {
              const nextLink = bundle.link.find((l: any) => l.relation === 'next');
              if (nextLink) {
                hasNextLink = true;
                console.log(`[FHIR API] Bundle for ${rt} has next link`);
              }
            }
          } catch (err: any) {
            console.warn(`[FHIR API] FHIR search failed for ${rt}:`, err.message);
          }
        }

        // Enhance resources and build result
        const enhanced = await enhanceResourcesWithValidationData(allResources);
        const returnedCount = enhanced.length;
        
        // Use bundle total if available, otherwise use returned count
        const totalCount = totalFromBundles > 0 ? totalFromBundles : returnedCount;
        
        // Calculate hasMore: either we have a next link, or returned count equals limit (might be more)
        const hasMore = hasNextLink || (returnedCount >= filterOptions.pagination.limit);
        
        console.log(`[FHIR API] FHIR parameter search result: total=${totalCount}, returned=${returnedCount}, hasMore=${hasMore}`);

        return res.json({
          success: true,
          data: {
            resources: enhanced,
            totalCount,
            returnedCount,
            hasMore: hasMore,
            pagination: {
              limit: filterOptions.pagination.limit,
              offset: filterOptions.pagination.offset,
              hasMore: hasMore
            },
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
              availableResourceTypes: resourceTypesArray,
            }
          },
          message: `Found ${totalCount} resources via FHIR search`
        });
      }


      // Filter resources with aspect/severity support
      // Use the new filtering method that supports issue-based filtering
      const result = await filteringService.filterResourcesWithAspects(filterOptions);

      console.log('[FHIR API] Filtered resources result:', {
        totalCount: result.totalCount,
        returnedCount: result.returnedCount
      });

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

  // GET /api/fhir/resources/filtered/statistics - Get filtering statistics
  app.get("/api/fhir/resources/filtered/statistics", async (req, res) => {
    try {
      // Get the backend filtering service
      const { getValidationBackendFilteringService } = await import('../../../services/validation/features/validation-backend-filtering-service');
      const filteringService = getValidationBackendFilteringService();
      
      // Initialize if not already done
      await filteringService.initialize();

      // Get available resource types
      const availableResourceTypes = await filteringService.getAvailableResourceTypes();

      // Get validation status statistics
      const validationStatistics = await filteringService.getValidationStatusStatistics();

      res.json({
        success: true,
        data: {
          availableResourceTypes,
          validationStatistics
        }
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

  // ============================================================================
  // FHIR Resource Edit
  // ============================================================================
  // PUT route MUST come BEFORE the GET route to ensure proper matching
  
  console.log('[FHIR Routes] Registering PUT route: /api/fhir/resources/:resourceType/:id');
  app.put("/api/fhir/resources/:resourceType/:id", async (req, res) => {
    console.log(`[FHIR Routes] PUT route hit: ${req.params.resourceType}/${req.params.id}`);
    try {
      const { resourceType, id } = req.params;
      const rawResource = req.body;
      const ifMatch = req.headers['if-match'] as string | undefined;
      
      // Strip out internal fields that were added by our system
      const { _dbId, _validationSummary, resourceId, ...resource } = rawResource;
      console.log(`[Edit] Stripped internal fields:`, { hasDbId: !!_dbId, hasValidationSummary: !!_validationSummary, hasResourceId: !!resourceId });
      
      // Validate FHIR resource structure
      const fhirValidation = validateFhirResourceStructure(resource);
      if (!fhirValidation.valid) {
        return res.status(422).json({
          success: false,
          error: 'FHIR validation failed',
          details: fhirValidation.errors,
        });
      }
      
      // Ensure resource type and ID match the URL
      if (resource.resourceType !== resourceType) {
        return res.status(400).json({
          success: false,
          error: 'Resource type mismatch',
          message: `Expected ${resourceType}, got ${resource.resourceType}`,
        });
      }
      
      if (resource.id !== id) {
        return res.status(400).json({
          success: false,
          error: 'Resource ID mismatch',
          message: `Expected ${id}, got ${resource.id}`,
        });
      }
      
      // Get FHIR client
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      console.log(`[Edit] FHIR client available:`, !!currentFhirClient);
      
      if (!currentFhirClient) {
        return res.status(503).json({
          success: false,
          error: 'FHIR client not initialized',
          message: 'Cannot edit resource: FHIR server connection not available'
        });
      }
      
      // Fetch current resource from FHIR server using getResource
      let currentResource: any;
      try {
        console.log(`[Edit] Fetching current resource: ${resourceType}/${id}`);
        currentResource = await currentFhirClient.getResource(resourceType, id);
        console.log(`[Edit] Fetched resource:`, !!currentResource, currentResource ? `versionId: ${currentResource.meta?.versionId}` : 'undefined');
      } catch (error: any) {
        console.error(`[Edit] Failed to fetch resource:`, error.message);
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          resourceType,
          id,
          details: error.message,
        });
      }
      
      // Verify resource was actually fetched
      if (!currentResource) {
        console.error(`[Edit] Resource is null/undefined after fetch`);
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          resourceType,
          id,
        });
      }
      
      // Check If-Match if provided (optimistic concurrency control)
      if (ifMatch) {
        const currentVersionId = currentResource.meta?.versionId;
        const currentETag = currentVersionId ? `W/"${currentVersionId}"` : undefined;
        
        if (currentETag && ifMatch !== currentETag && ifMatch !== currentVersionId) {
          return res.status(409).json({
            success: false,
            error: 'Version conflict',
            message: 'Resource has been modified by another user',
            currentVersionId,
            requestedVersionId: ifMatch,
          });
        }
      }
      
      // Compute before/after hashes for audit trail
      console.log(`[Edit] Computing hashes...`);
      const beforeHash = computeResourceHash(currentResource);
      const afterHash = computeResourceHash(resource);
      console.log(`[Edit] Hashes computed - changed: ${beforeHash !== afterHash}`);
      
      // Update resource on FHIR server using PUT request
      let updatedResource: any;
      try {
        const baseUrl = (currentFhirClient as any).baseUrl;
        const headers = (currentFhirClient as any).headers;
        
        console.log(`[Edit] Sending PUT to FHIR server: ${baseUrl}/${resourceType}/${id}`);
        const updateResponse = await fetch(`${baseUrl}/${resourceType}/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(resource),
        });
        
        console.log(`[Edit] FHIR server response: ${updateResponse.status} ${updateResponse.statusText}`);
        
        if (!updateResponse.ok) {
          const errorBody = await updateResponse.text();
          console.error(`[Edit] FHIR server error response:`, errorBody.substring(0, 500));
          return res.status(updateResponse.status).json({
            success: false,
            error: 'FHIR server rejected the update',
            message: `HTTP ${updateResponse.status}: ${updateResponse.statusText}`,
            details: errorBody.substring(0, 1000),
          });
        }
        
        updatedResource = await updateResponse.json();
        console.log(`[Edit] Successfully updated resource, new versionId: ${updatedResource.meta?.versionId}`);
      } catch (error: any) {
        console.error(`[Edit] Exception during FHIR server update:`, error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update resource on FHIR server',
          message: error.message || 'Unknown error',
        });
      }
      
      // Get FHIR version from server
      let fhirVersion: string | null = null;
      try {
        fhirVersion = await currentFhirClient.getFhirVersion();
      } catch (error) {
        logger.warn('[Edit] Could not detect FHIR version:', error);
      }
      
      // Create and persist audit record
      const serverId = 1; // TODO: Get from active server
      try {
        await db.insert(editAuditTrail).values({
          serverId,
          resourceType,
          fhirId: id,
          beforeHash,
          afterHash,
          fhirVersion: fhirVersion || undefined,
          editedAt: new Date(),
          editedBy: 'system',
          operation: 'single_edit',
          result: 'success',
          versionBefore: currentResource.meta?.versionId,
          versionAfter: updatedResource.meta?.versionId,
        });
        
        logger.info(`[Audit] Recorded successful edit: ${resourceType}/${id}`);
      } catch (auditError) {
        logger.error('[Audit] Failed to record audit trail:', auditError);
      }
      
      // Check auto-revalidation settings
      let queuedRevalidation = false;
      try {
        const settingsResult = await db
          .select()
          .from(validationSettings)
          .where(eq(validationSettings.serverId, serverId))
          .limit(1);
        
        const settings: ValidationSettings | null = settingsResult.length > 0 
          ? (settingsResult[0] as any).settings
          : null;
        
        const shouldAutoRevalidate = settings?.autoRevalidateAfterEdit !== false;
        
        if (shouldAutoRevalidate) {
          validationQueue.enqueue({
            serverId,
            resourceType,
            fhirId: id,
            priority: 'high',
          });
          queuedRevalidation = true;
          logger.info(`[Edit] Auto-revalidation queued for ${resourceType}/${id}`);
        }
      } catch (settingsError) {
        logger.warn('[Edit] Failed to check auto-revalidation settings, defaulting to revalidate:', settingsError);
        validationQueue.enqueue({
          serverId,
          resourceType,
          fhirId: id,
          priority: 'high',
        });
        queuedRevalidation = true;
      }
      
      res.json({
        success: true,
        resourceType,
        id,
        versionId: updatedResource.meta?.versionId,
        beforeHash,
        afterHash,
        changed: beforeHash !== afterHash,
        queuedRevalidation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating resource:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update resource',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================================
  // Version History Endpoint
  // ============================================================================
  // Version History - Bulk endpoint for fetching version counts and recent versions
  // MUST come BEFORE /api/fhir/resources/:id to avoid "version-history" being treated as an ID
  app.get("/api/fhir/resources/version-history", async (req, res) => {
    try {
      const { resources: resourcesParam } = req.query;
      
      if (!resourcesParam) {
        return res.status(400).json({ 
          error: 'Missing required parameter: resources',
          message: 'resources parameter should be a JSON array of {resourceType, id} objects'
        });
      }

      // Parse resources parameter
      let resources: Array<{ resourceType: string; id: string }>;
      try {
        resources = JSON.parse(resourcesParam as string);
      } catch (parseError) {
        return res.status(400).json({ 
          error: 'Invalid resources parameter',
          message: 'resources must be a valid JSON array'
        });
      }

      if (!Array.isArray(resources) || resources.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid resources parameter',
          message: 'resources must be a non-empty array'
        });
      }

      // Get the current FHIR client
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }

      // Fetch version history for each resource
      const versionData: Record<string, {
        total: number;
        currentVersion?: string;
        versions: Array<{
          versionId: string;
          lastModified: string;
        }>;
        error?: string;
      }> = {};

      // Fetch histories in parallel with a concurrency limit
      const CONCURRENCY_LIMIT = 5;
      const results = [];
      
      for (let i = 0; i < resources.length; i += CONCURRENCY_LIMIT) {
        const batch = resources.slice(i, i + CONCURRENCY_LIMIT);
        const batchPromises = batch.map(async (resource) => {
          const key = `${resource.resourceType}/${resource.id}`;
          try {
            const history = await currentFhirClient.getResourceHistory(
              resource.resourceType,
              resource.id,
              5 // Get 5 most recent versions
            );
            
            return {
              key,
              data: {
                total: history.total,
                currentVersion: history.versions[0]?.versionId,
                versions: history.versions.map(v => ({
                  versionId: v.versionId,
                  lastModified: v.lastModified,
                })),
              }
            };
          } catch (error: any) {
            console.error(`[Version History] Error fetching history for ${key}:`, error.message);
            return {
              key,
              data: {
                total: 1,
                versions: [],
                error: error.message,
              }
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // Build response object
      for (const result of results) {
        versionData[result.key] = result.data;
      }

      res.json(versionData);
    } catch (error: any) {
      console.error('[Version History] Error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch version history',
        message: error.message 
      });
    }
  });

  // ============================================================================
  // FHIR Individual Resource
  // ============================================================================
  // This route MUST come AFTER /api/fhir/resources/filtered to avoid conflicts
  
  app.get("/api/fhir/resources/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let { resourceType } = req.query;
      
      console.log(`[FHIR API] Individual resource endpoint called for: ${resourceType || 'unknown'}/${id}`);

      // If resourceType is provided, use it directly
      if (resourceType) {
        try {
          // Get the current FHIR client (may have been updated due to server activation)
          const currentFhirClient = getCurrentFhirClient(fhirClient);
          if (!currentFhirClient) {
            return res.status(503).json({ message: "FHIR client not initialized" });
          }
          const resource = await currentFhirClient.getResource(resourceType as string, id);
          
          if (!resource) {
            return res.status(404).json({ 
              message: `Resource ${resourceType}/${id} not found`,
              resourceType,
              id
            });
          }

          console.log(`[FHIR API] Successfully fetched ${resourceType} resource ${id}`);
          
          // Enhance resource with validation data
          console.log(`[FHIR API] About to enhance resource with validation data`);
          const enhancedResources = await enhanceResourcesWithValidationData([resource]);
          console.log(`[FHIR API] Enhancement completed, returning enhanced resource`);
          res.json(enhancedResources[0]);
          return;
          
        } catch (error: any) {
          console.error(`[FHIR API] Failed to fetch ${resourceType} resource ${id}:`, error.message);
          
          if (error.message.includes('404') || error.message.includes('not found')) {
            return res.status(404).json({ 
              message: `Resource ${resourceType}/${id} not found`,
              resourceType,
              id
            });
          }
          
          throw error;
        }
      }

      // If no resourceType provided, try common resource types
      const commonTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'DiagnosticReport', 'Medication', 'MedicationRequest', 'Procedure', 'AllergyIntolerance', 'Immunization', 'DocumentReference', 'Organization', 'Practitioner', 'AuditEvent'];
      
      for (const type of commonTypes) {
        try {
          console.log(`[FHIR API] Trying to fetch ${type}/${id}`);
          // Get the current FHIR client (may have been updated due to server activation)
          const currentFhirClient = getCurrentFhirClient(fhirClient);
          if (!currentFhirClient) {
            return res.status(503).json({ message: "FHIR client not initialized" });
          }
          const resource = await currentFhirClient.getResource(type, id);
          
          if (resource) {
            console.log(`[FHIR API] Successfully fetched ${type} resource ${id}`);
            
            // Enhance resource with validation data
            console.log(`[FHIR API] About to enhance resource with validation data (type search)`);
            const enhancedResources = await enhanceResourcesWithValidationData([resource]);
            console.log(`[FHIR API] Enhancement completed, returning enhanced resource (type search)`);
            res.json(enhancedResources[0]);
            return;
          }
        } catch (error: any) {
          // Continue to next type if this one fails
          console.log(`[FHIR API] ${type}/${id} not found, trying next type`);
        }
      }

      // If we get here, resource wasn't found with any type
      return res.status(404).json({ 
        message: `Resource ${id} not found with any resource type`,
        id
      });

    } catch (error: any) {
      console.error('[FHIR API] Error fetching individual resource:', error);
      res.status(500).json({ 
        message: "Failed to fetch resource",
        error: error.message 
      });
    }
  });

  // FHIR Resources
  app.get("/api/fhir/resources", async (req, res) => {
    try {
      const { resourceType, limit = 20, offset = 0, search, ...fhirSearchParams } = req.query;
      
    // If no resource type is specified, fetch from ALL resource types on the server
    if (!resourceType) {
      const requestedLimit = parseInt(limit as string);
      const offsetValue = parseInt(offset as string) || 0;
      console.log('[FHIR API] No resource type specified, fetching from ALL resource types on server', {
        requestedLimit,
        offset: offsetValue
      });
      
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        throw new Error("FHIR client not initialized");
      }
      
      // Get all supported resource types from the server's capability statement
      const allResourceTypes = await currentFhirClient.getAllResourceTypes();
      console.log(`[FHIR API] Server supports ${allResourceTypes.length} resource types`);
      
      const allResources = [];
      let totalCount = 0;
      
      // Fetch enough resources from each type to ensure we have enough after sorting
      // We need more than requested to account for sorting across all types
      const countPerType = Math.max(
        requestedLimit,  // Fetch at least the page size from each type
        20  // Minimum to ensure good coverage
      );
      
      console.log('[FHIR API] Fetching resources from all types:', {
        requestedLimit,
        offsetValue,
        countPerType,
        numTypes: allResourceTypes.length
      });
      
      // Fetch resources from all types in parallel with sorting by _lastUpdated
      const fetchPromises = allResourceTypes.map(async (type) => {
        try {
          const searchParams: Record<string, string | number> = {
            _count: countPerType,
            _sort: '-_lastUpdated',  // Sort by last updated descending (most recent first)
            _total: 'accurate'
          };
          
          // Add FHIR search parameters from query string
          Object.entries(fhirSearchParams).forEach(([key, value]) => {
            if (value && typeof value === 'string') {
              searchParams[key] = value;
            }
          });
          
          const bundle = await currentFhirClient.searchResources(type, searchParams);
          const resources = bundle.entry?.map(entry => entry.resource) || [];
          
          return {
            type,
            resources,
            total: bundle.total || 0
          };
        } catch (error: any) {
          console.warn(`Failed to fetch ${type} resources:`, error.message);
          return {
            type,
            resources: [],
            total: 0
          };
        }
      });
      
      // Wait for all fetches to complete
      const results = await Promise.all(fetchPromises);
      
      // Aggregate all resources and total counts
      results.forEach(({ resources, total }) => {
        allResources.push(...resources);
        totalCount += total;
      });
      
      console.log('[FHIR API] Fetched resources from all types:', {
        totalFetched: allResources.length,
        totalCount
      });
      
      // Sort all resources by lastUpdated timestamp (most recent first)
      allResources.sort((a, b) => {
        const dateA = a.meta?.lastUpdated ? new Date(a.meta.lastUpdated).getTime() : 0;
        const dateB = b.meta?.lastUpdated ? new Date(b.meta.lastUpdated).getTime() : 0;
        return dateB - dateA;  // Descending order (newest first)
      });
      
      console.log('[FHIR API] Sorted resources by lastUpdated:', {
        totalResources: allResources.length,
        firstLastUpdated: allResources[0]?.meta?.lastUpdated,
        lastLastUpdated: allResources[allResources.length - 1]?.meta?.lastUpdated
      });
      
      // Enhance all resources with validation data
      const enhancedResources = await enhanceResourcesWithValidationData(allResources);
      
      // Apply offset and limit to the sorted results
      const paginatedResources = enhancedResources.slice(offsetValue, offsetValue + requestedLimit);
      
      console.log('[FHIR API] Pagination result:', {
        totalFetched: allResources.length,
        afterEnhancement: enhancedResources.length,
        afterPagination: paginatedResources.length,
        requestedLimit
      });
      
      return res.json({
        resources: paginatedResources,
        total: totalCount,
        message: `Fetched from ${allResourceTypes.length} resource types, sorted by last updated`,
        resourceType: "All Types"
      });
    }

      let bundle;
      try {
        // Build search parameters
        const searchParams: Record<string, string | number> = {
          _count: parseInt(limit as string),
          _total: 'accurate' // Request accurate total count
        };
        
        if (search) {
          searchParams._content = search as string;
        }
        
        // Add FHIR search parameters from query string
        Object.entries(fhirSearchParams).forEach(([key, value]) => {
          if (value && typeof value === 'string') {
            searchParams[key] = value;
          }
        });
        
        if (parseInt(offset as string) > 0) {
          // Fire.ly server uses _skip instead of _offset for pagination
          searchParams._skip = parseInt(offset as string);
        }
        
        // Get the current FHIR client (may have been updated due to server activation)
        const currentFhirClient = getCurrentFhirClient(fhirClient);
        if (!currentFhirClient) {
          throw new Error("FHIR client not initialized");
        }
        bundle = await currentFhirClient.searchResources(
          resourceType as string,
          searchParams
        );
      } catch (error: any) {
        // Fallback to mock data ONLY if DEMO_MOCKS is enabled
        if (FeatureFlags.DEMO_MOCKS) {
          console.warn(`FHIR server unavailable, using mock data (DEMO_MOCKS=true): ${error.message}`);
          bundle = createMockBundle(resourceType as string, parseInt(limit as string), parseInt(offset as string));
        } else {
          // Production: return error instead of mock data
          console.error(`FHIR server unavailable: ${error.message}`);
          return res.status(503).json({
            error: 'FHIR Server Unavailable',
            message: 'Unable to fetch resources from the FHIR server. Please check the server connection.',
            details: error.message,
          });
        }
      }

      // Transform FHIR Bundle to expected frontend format
      const resources = bundle.entry?.map((entry: any) => entry.resource) || [];
      
      // Try to get total from various possible locations in the Bundle
      let total = 0;
      if (bundle.total !== undefined) {
        total = bundle.total;
      } else if (bundle.meta?.total !== undefined) {
        total = bundle.meta.total;
      } else if (resources.length > 0) {
        // If we have resources but no total, estimate based on current page
        // This is not ideal but better than showing 0
        total = resources.length;
      }

      // Enhance resources with validation data
      const enhancedResources = await enhanceResourcesWithValidationData(resources);

      res.json({
        resources: enhancedResources,
        total,
        bundle // Include original bundle for debugging if needed
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  // FHIR Resource Types
  app.get("/api/fhir/resource-types", async (req, res) => {
    try {
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ 
          error: 'No FHIR server connected',
          message: 'Please connect to a FHIR server first'
        });
      }
      const resourceTypes = await currentFhirClient.getAllResourceTypes();
      res.json({ resourceTypes });
    } catch (error: any) {
      console.error('[FHIR] Error fetching resource types:', error);
      res.status(500).json({ 
        error: 'Failed to fetch resource types',
        message: error.message 
      });
    }
  });

  // FHIR Resource Counts
  app.get("/api/fhir/resource-counts", async (req, res) => {
    try {
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      
      // Get active server ID for cache key
      const { getActiveServerId } = await import('../../../utils/server-scoping.js');
      const serverId = await getActiveServerId();
      
      if (!serverId) {
        return res.status(503).json({ message: "No active FHIR server" });
      }
      
      // Import cache service
      const { resourceCountCache } = await import('../../../services/cache/resource-count-cache.js');
      
      // Check if caller wants ALL resource types (bypass settings filter)
      const getAllTypes = req.query.all === 'true';
      
      // Check if specific resource types are requested via query param
      const requestedTypes = req.query.types 
        ? (req.query.types as string).split(',').map(t => t.trim())
        : undefined;
      
      let resourceTypesToQuery: string[] | undefined = undefined;
      
      if (getAllTypes) {
        // Explicitly bypass validation settings - get ALL types from server
        resourceTypesToQuery = undefined;
        console.log('[Resource Counts] Getting ALL resource types from server (bypassing validation settings)');
      } else if (requestedTypes && requestedTypes.length > 0) {
        // Use requested types if provided
        resourceTypesToQuery = requestedTypes;
        console.log(`[Resource Counts] Using requested types: ${requestedTypes.join(', ')}`);
      } else {
        // Fall back to validation settings logic
        const { ValidationSettingsService } = await import('../../../services/validation/settings/validation-settings-service');
        const settingsService = new ValidationSettingsService();
        await settingsService.initialize();
        const settings = await settingsService.getCurrentSettings();
        
        // Check if resource type filtering is enabled
        // When enabled=false, it means "Validate All" - ignore includedTypes
        if (settings?.resourceTypes?.enabled === true) {
          const includedTypes = settings.resourceTypes.includedTypes || [];
          resourceTypesToQuery = includedTypes.length > 0 ? includedTypes : undefined;
          console.log(`[Resource Counts] Filtering enabled: ${includedTypes.length} types included`);
        } else {
          console.log('[Resource Counts] Filtering disabled (Validate All) - using all server types from CapabilityStatement');
          resourceTypesToQuery = undefined; // Will use getAllResourceTypes() from CapabilityStatement
        }
      }
      
      // Try to get from cache first
      const cached = await resourceCountCache.get(serverId);
      
      if (cached) {
        const age = Math.round((Date.now() - cached.lastUpdated.getTime()) / 1000);
        const statusLabel = cached.isStale ? 'STALE' : (cached.isPartial ? 'PARTIAL' : 'FRESH');
        console.log(`[Resource Counts] ⚡ Returning cached data (${statusLabel}, age: ${age}s)`);
        
        // Transform cached counts to expected format
        const resourceTypes = Object.entries(cached.counts)
          .map(([resourceType, count]) => ({
            resourceType,
            count
          }));
        
        // Return cached data immediately with partial flag
        res.json({
          resourceTypes,
          totalResources: cached.totalResources,
          isPartial: cached.isPartial || false,
          loadedTypes: cached.loadedTypes || Object.keys(cached.counts),
          pendingTypes: cached.pendingTypes || []
        });
        
        // If stale, trigger background refresh (don't await)
        if (cached.isStale) {
          console.log('[Resource Counts] 🔄 Triggering background refresh for stale cache');
          resourceCountCache.refresh(serverId, currentFhirClient, resourceTypesToQuery).catch(err => {
            console.error('[Resource Counts] Background refresh failed:', err);
          });
        }
        
        return;
      }
      
      // No cache - use priority-based fetch (fast initial response)
      console.log('[Resource Counts] ❌ Cache miss - starting priority-based fetch...');
      
      try {
        // Trigger priority-based refresh (will set partial cache and return)
        await resourceCountCache.refresh(serverId, currentFhirClient, resourceTypesToQuery);
        
        // Get the newly cached data (should be partial at this point)
        const newlyCached = await resourceCountCache.get(serverId);
        
        if (newlyCached) {
          const resourceTypes = Object.entries(newlyCached.counts)
            .map(([resourceType, count]) => ({
              resourceType,
              count
            }));
          
          res.json({
            resourceTypes,
            totalResources: newlyCached.totalResources,
            isPartial: newlyCached.isPartial || false,
            loadedTypes: newlyCached.loadedTypes || Object.keys(newlyCached.counts),
            pendingTypes: newlyCached.pendingTypes || []
          });
        } else {
          // Fallback if somehow cache isn't set
          res.json({
            resourceTypes: [],
            totalResources: 0,
            isPartial: false,
            loadedTypes: [],
            pendingTypes: []
          });
        }
      } catch (error: any) {
        console.error('[Resource Counts] Failed to fetch fresh data:', error);
        // Return empty counts on error
        res.json({
          resourceTypes: [],
          totalResources: 0,
          isPartial: false,
          loadedTypes: [],
          pendingTypes: []
        });
      }
    } catch (error: any) {
      console.error('[Resource Counts] Unexpected error:', error);
      res.status(500).json({ 
        message: 'Failed to get resource counts',
        error: error.message 
      });
    }
  });

  // FHIR Packages
  app.get("/api/fhir/packages", async (req, res) => {
    try {
      const packages = await profileManager.getInstalledPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // Generic FHIR Resource Access
  // ============================================================================
  // IMPORTANT: These generic parameterized routes come AFTER specific routes

  app.get("/api/fhir/:resourceType", async (req, res) => {
    try {
      const { resourceType } = req.params;
      const { limit = 20, offset = 0, search } = req.query;
      
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : (limit as number);
      const offsetNum = typeof offset === 'string' ? parseInt(offset, 10) : (offset as number);
      
      // Build search params object
      const searchParams: Record<string, string | number> = {};
      if (search) searchParams._content = search as string;
      if (offsetNum > 0) searchParams._offset = offsetNum;
      
      const resources = await currentFhirClient.searchResources(
        resourceType,
        searchParams,
        limitNum
      );
      
      res.json(resources);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/:resourceType/:id", async (req, res) => {
    try {
      const { resourceType, id } = req.params;
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      const resource = await currentFhirClient.getResource(resourceType, id);
      res.json(resource);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

}
