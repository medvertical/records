import type { Express } from "express";
import { storage } from "../../../storage.js";
import { FhirClient } from "../../../services/fhir/fhir-client";
import { profileManager } from "../../../services/fhir/profile-manager";
import { FeatureFlags } from "../../../config/feature-flags";
import { serverActivationService } from "../../../services/server-activation-service";
import * as ValidationGroupsRepository from "../../../repositories/validation-groups-repository";

// Helper function to get the current FHIR client from server activation service
function getCurrentFhirClient(fhirClient: FhirClient): FhirClient {
  const currentClient = serverActivationService.getFhirClient();
  return currentClient || fhirClient;
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

export function setupFhirRoutes(app: Express, fhirClient: FhirClient) {
  // FHIR Server Management
  app.get("/api/fhir/servers", async (req, res) => {
    try {
      const servers = await storage.getFhirServers();
      res.json(servers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers", async (req, res) => {
    try {
      const server = await storage.createFhirServer(req.body);
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers/:id/activate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // First deactivate all servers
      const servers = await storage.getFhirServers();
      for (const server of servers) {
        if (server.isActive) {
          await storage.updateFhirServerStatus(server.id, false);
        }
      }
      // Then activate the selected server
      await storage.updateFhirServerStatus(id, true);
      const server = await storage.getActiveFhirServer();
      res.json({ message: 'Server activated successfully', server });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers/:id/deactivate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateFhirServerStatus(id, false);
      res.json({ message: 'Server deactivated successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/fhir/servers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const server = await storage.updateFhirServer(parseInt(id), req.body);
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/fhir/servers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFhirServer(parseInt(id));
      res.json({ message: "Server deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR Connection Testing
  app.get("/api/fhir/connection/test", async (req, res) => {
    try {
      const { url, auth } = req.query;
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
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
      const result = await currentFhirClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // Filtered Resources Endpoint
  // ============================================================================
  // CRITICAL: These specific routes MUST come BEFORE /api/fhir/resources/:id
  // to prevent Express from matching "filtered" as the :id parameter

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
        search,
        limit = 20,
        offset = 0,
        sortBy = 'lastValidated',
        sortDirection = 'desc',
        serverId = 1
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
        hasIssuesInAspects: hasIssuesInAspects === 'true' || undefined,
        serverId: parseInt(serverId as string),
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

      // Filter resources with aspect/severity support
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
      const commonTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'DiagnosticReport', 'Medication', 'MedicationRequest', 'Procedure', 'AllergyIntolerance', 'Immunization', 'DocumentReference', 'Organization', 'Practitioner'];
      
      for (const type of commonTypes) {
        try {
          console.log(`[FHIR API] Trying to fetch ${type}/${id}`);
          // Get the current FHIR client (may have been updated due to server activation)
          const currentFhirClient = getCurrentFhirClient(fhirClient);
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
      const { resourceType, limit = 20, offset = 0, search } = req.query;
      
    // If no resource type is specified, fetch from all common resource types (expensive but requested)
    if (!resourceType) {
      console.log('[FHIR API] No resource type specified, fetching from all common resource types');
      
      const commonResourceTypes = [
        'Patient', 'Observation', 'Encounter', 'Condition', 'Procedure',
        'Medication', 'MedicationRequest', 'DiagnosticReport', 'Organization',
        'Practitioner', 'Location', 'Appointment', 'AllergyIntolerance'
      ];
      
      const allResources = [];
      let totalCount = 0;
      
      for (const type of commonResourceTypes) {
        try {
          const searchParams: Record<string, string | number> = {
            _count: Math.min(parseInt(limit as string), 10), // Limit per type to avoid huge responses
            _total: 'accurate'
          };
          
          if (parseInt(offset as string) > 0) {
            // Fire.ly server uses _skip instead of _offset for pagination
            searchParams._skip = Math.floor(parseInt(offset as string) / commonResourceTypes.length);
          }
          
          // Get the current FHIR client (may have been updated due to server activation)
          const currentFhirClient = getCurrentFhirClient(fhirClient);
          const bundle = await currentFhirClient.searchResources(type, searchParams);
          const resources = bundle.entry?.map(entry => entry.resource) || [];
          
          allResources.push(...resources);
          totalCount += bundle.total || 0;
          
        } catch (error: any) {
          console.warn(`Failed to fetch ${type} resources:`, error.message);
        }
      }
      
      // Enhance all resources with validation data
      const enhancedResources = await enhanceResourcesWithValidationData(allResources);
      
      return res.json({
        resources: enhancedResources,
        total: totalCount,
        message: `Fetched from ${commonResourceTypes.length} resource types`,
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
        
        if (parseInt(offset as string) > 0) {
          // Fire.ly server uses _skip instead of _offset for pagination
          searchParams._skip = parseInt(offset as string);
        }
        
        // Get the current FHIR client (may have been updated due to server activation)
        const currentFhirClient = getCurrentFhirClient(fhirClient);
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
      const resourceTypes = await currentFhirClient.getResourceTypes();
      res.json(resourceTypes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR Resource Counts
  app.get("/api/fhir/resource-counts", async (req, res) => {
    try {
      // Get the current FHIR client (may have been updated due to server activation)
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      
      // Get validation settings to check filtering
      const { ValidationSettingsService } = await import('../../../services/validation/settings/validation-settings-service');
      const settingsService = new ValidationSettingsService();
      await settingsService.initialize();
      const settings = await settingsService.getCurrentSettings();
      
      let resourceTypesToQuery: string[] | undefined = undefined;
      
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
      
      // Add timeout to the entire operation (15s should be enough with parallel requests)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000);
      });
      
      const startTime = Date.now();
      const countsPromise = currentFhirClient.getResourceCounts(resourceTypesToQuery);
      const counts = await Promise.race([countsPromise, timeoutPromise]) as Record<string, number>;
      const duration = Date.now() - startTime;
      console.log(`[Resource Counts] Completed in ${duration}ms`);
      
      // Transform the counts into the expected format
      const resourceTypes = Object.entries(counts)
        .map(([resourceType, count]) => ({
          resourceType,
          count
        }));
      
      const totalResources = Object.values(counts).reduce((sum, count) => sum + count, 0);
      
      res.json({
        resourceTypes,
        totalResources
      });
    } catch (error: any) {
      console.warn('Failed to get resource counts:', error.message);
      // Return empty counts on error
      res.json({
        resourceTypes: [],
        totalResources: 0
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
      const resource = await currentFhirClient.getResource(resourceType, id);
      res.json(resource);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
