import type { Express } from "express";
import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { profileManager } from "../../../../services/fhir/profile-manager";
import { getCurrentFhirClient } from "../helpers/fhir-client-helper";

/**
 * Setup generic FHIR routes (parameterized endpoints)
 * These routes provide generic access to FHIR resources by type
 */
export function setupGenericFhirRoutes(app: Express, fhirClient: FhirClient | null) {
  // GET /api/fhir/packages - List installed FHIR packages
  app.get("/api/fhir/packages", async (req, res) => {
    try {
      const packages = await profileManager.getInstalledPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/fhir/:resourceType - List resources of a specific type
  app.get("/api/fhir/:resourceType", async (req, res) => {
    try {
      const { resourceType } = req.params;
      const { limit = 20, offset = 0, search } = req.query;
      
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

  // GET /api/fhir/:resourceType/:id - Get a specific resource
  app.get("/api/fhir/:resourceType/:id", async (req, res) => {
    try {
      const { resourceType, id } = req.params;
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

