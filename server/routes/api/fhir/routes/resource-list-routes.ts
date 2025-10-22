import type { Express } from "express";
import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { FeatureFlags } from "../../../../config/feature-flags";
import { getCurrentFhirClient } from "../helpers/fhir-client-helper";
import { createMockBundle } from "../helpers/mock-data-generator";
import { enhanceResourcesWithValidationData } from "../helpers/resource-enhancer";

/**
 * Setup FHIR resource listing and counting routes
 */
export function setupResourceListRoutes(app: Express, fhirClient: FhirClient | null) {
  // GET /api/fhir/resources - List resources with filtering and pagination
  app.get("/api/fhir/resources", async (req, res) => {
    try {
      const { resourceType, limit = 20, offset = 0, search, page, pageSize, ...fhirSearchParams } = req.query;
      
      // If no resource type is specified, fetch from ALL resource types
      if (!resourceType) {
        const requestedLimit = parseInt(limit as string);
        const offsetValue = parseInt(offset as string) || 0;
        
        const currentFhirClient = getCurrentFhirClient(fhirClient);
        if (!currentFhirClient) {
          throw new Error("FHIR client not initialized");
        }
        
        // Get all supported resource types from the server
        const allResourceTypes = await currentFhirClient.getAllResourceTypes();
        const allResources = [];
        let totalCount = 0;
        
        const countPerType = Math.max(requestedLimit, 20);
        
        // Fetch resources from all types in parallel with sorting
        const fetchPromises = allResourceTypes.map(async (type) => {
          try {
            const searchParams: Record<string, string | number> = {
              _count: countPerType,
              _sort: '-_lastUpdated',
              _total: 'accurate'
            };
            
            Object.entries(fhirSearchParams).forEach(([key, value]) => {
              if (value && typeof value === 'string') {
                searchParams[key] = value;
              }
            });
            
            const bundle = await currentFhirClient.searchResources(type, searchParams);
            const resources = bundle.entry?.map(entry => entry.resource) || [];
            
            return { type, resources, total: bundle.total || 0 };
          } catch (error: any) {
            console.warn(`Failed to fetch ${type} resources:`, error.message);
            return { type, resources: [], total: 0 };
          }
        });
        
        const results = await Promise.all(fetchPromises);
        
        results.forEach(({ resources, total }) => {
          allResources.push(...resources);
          totalCount += total;
        });
        
        // Sort by lastUpdated timestamp (most recent first)
        allResources.sort((a, b) => {
          const dateA = a.meta?.lastUpdated ? new Date(a.meta.lastUpdated).getTime() : 0;
          const dateB = b.meta?.lastUpdated ? new Date(b.meta.lastUpdated).getTime() : 0;
          return dateB - dateA;
        });
        
        // Enhance and paginate
        const enhancedResources = await enhanceResourcesWithValidationData(allResources);
        const paginatedResources = enhancedResources.slice(offsetValue, offsetValue + requestedLimit);
        
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
          _total: 'accurate'
        };
        
        if (search) {
          searchParams._content = search as string;
        }
        
        Object.entries(fhirSearchParams).forEach(([key, value]) => {
          if (value && typeof value === 'string') {
            searchParams[key] = value;
          }
        });
        
        if (parseInt(offset as string) > 0) {
          searchParams._skip = parseInt(offset as string);
        }
        
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
          return res.status(503).json({
            error: 'FHIR Server Unavailable',
            message: 'Unable to fetch resources from the FHIR server. Please check the server connection.',
            details: error.message,
          });
        }
      }

      // Transform FHIR Bundle to expected format
      const resources = bundle.entry?.map((entry: any) => entry.resource) || [];
      
      // Try to get total from various locations in the Bundle
      let total = 0;
      if (bundle.total !== undefined) {
        total = bundle.total;
      } else if (bundle.meta?.total !== undefined) {
        total = bundle.meta.total;
      } else if (resources.length > 0) {
        total = resources.length;
      }

      // Enhance resources with validation data
      const enhancedResources = await enhanceResourcesWithValidationData(resources);

      res.json({
        resources: enhancedResources,
        total,
        bundle
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/fhir/resource-types - Get all resource types
  app.get("/api/fhir/resource-types", async (req, res) => {
    try {
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

  // GET /api/fhir/resource-counts - Get resource counts
  app.get("/api/fhir/resource-counts", async (req, res) => {
    try {
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      
      // Get requested types from query param, or fetch all types
      let typesToFetch: string[] = [];
      
      if (req.query.types) {
        typesToFetch = (req.query.types as string).split(',').map(t => t.trim());
        console.log(`[Resource Counts] Fetching ${typesToFetch.length} specific types: ${typesToFetch.join(', ')}`);
      } else {
        typesToFetch = await currentFhirClient.getAllResourceTypes();
        console.log(`[Resource Counts] Fetching all ${typesToFetch.length} resource types from server`);
      }
      
      if (typesToFetch.length === 0) {
        return res.json({ resourceTypes: [], totalResources: 0 });
      }
      
      // Fetch all types in parallel
      const startTime = Date.now();
      
      const countPromises = typesToFetch.map(async (type) => {
        try {
          const count = await currentFhirClient.getResourceCount(type);
          return { resourceType: type, count: count ?? 0 };
        } catch (err) {
          console.warn(`[Resource Counts] Failed to get count for ${type}:`, err instanceof Error ? err.message : err);
          return { resourceType: type, count: 0 };
        }
      });
      
      const resourceTypes = await Promise.all(countPromises);
      const totalResources = resourceTypes.reduce((sum, rt) => sum + rt.count, 0);
      
      const duration = Date.now() - startTime;
      console.log(`[Resource Counts] Completed in ${duration}ms - ${resourceTypes.length} types, ${totalResources} total resources`);
      
      res.json({ resourceTypes, totalResources });
    } catch (error: any) {
      console.error('[Resource Counts] Error:', error);
      res.status(500).json({
        message: "Failed to fetch resource counts",
        error: error.message
      });
    }
  });
}

