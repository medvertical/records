import type { Express } from "express";
import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { getCurrentFhirClient } from "../helpers/fhir-client-helper";

/**
 * Setup version history routes for FHIR resources
 */
export function setupVersionHistoryRoutes(app: Express, fhirClient: FhirClient | null) {
  // GET /api/fhir/resources/version-history - Bulk endpoint for version counts and recent versions
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

      // Fetch histories in parallel with concurrency limit
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
}

