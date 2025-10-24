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
        
        // Enhance and paginate (skip validation for fast loading)
        const enhancedResources = await enhanceResourcesWithValidationData(allResources, false);
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
        
        // Set a shorter timeout for list queries
        const fetchPromise = currentFhirClient.searchResources(
          resourceType as string,
          searchParams
        );
        
        // Race with a 30-second timeout (FHIR servers can be slow for large queries)
        bundle = await Promise.race([
          fetchPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('External FHIR server timeout after 30s')), 30000)
          )
        ]) as any;
        
      } catch (error: any) {
        console.error(`[Resource List] FHIR server request failed: ${error.message}`);
        
        // No database fallback - resources are only stored in FHIR server
        // Last resort: mock data if enabled
        if (FeatureFlags.DEMO_MOCKS) {
          console.warn(`Using mock data (DEMO_MOCKS=true)`);
          bundle = createMockBundle(resourceType as string, parseInt(limit as string), parseInt(offset as string));
        } else {
          return res.status(503).json({
            error: 'FHIR Server Unavailable',
            message: 'Unable to fetch resources from the FHIR server.',
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

      // Enhance resources without validation data (for fast loading)
      const enhancedResources = await enhanceResourcesWithValidationData(resources, false);

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

  // GET /api/fhir/resource-counts - Get resource counts with batching and retry
  app.get("/api/fhir/resource-counts", async (req, res) => {
    try {
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({ message: "FHIR client not initialized" });
      }
      
      // Get requested types from query param, or fetch all types
      let typesToFetch: string[] | undefined;
      
      if (req.query.types) {
        typesToFetch = (req.query.types as string).split(',').map(t => t.trim());
        console.log(`[Resource Counts] Fetching ${typesToFetch.length} specific types: ${typesToFetch.join(', ')}`);
      } else {
        console.log(`[Resource Counts] Fetching all resource types from server`);
        typesToFetch = undefined; // Let the batched method fetch all types
      }
      
      // Use the new batched method with queue, retry, and caching
      const startTime = Date.now();
      const counts = await (currentFhirClient as any).getResourceCountsBatched(typesToFetch, {
        batchSize: 8,
        batchDelay: 100,
        useCache: true,
      });
      
      // Convert counts object to array format
      const resourceTypes = Object.entries(counts).map(([resourceType, count]) => ({
        resourceType,
        count: count as number,
      }));
      
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

