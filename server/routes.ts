import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { FhirClient } from "./services/fhir-client.js";
import { ValidationEngine } from "./services/validation-engine.js";
import { insertFhirServerSchema, insertFhirResourceSchema, insertValidationProfileSchema } from "@shared/schema.js";
import { z } from "zod";

let fhirClient: FhirClient;
let validationEngine: ValidationEngine;

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize FHIR client with active server
  const activeServer = await storage.getActiveFhirServer();
  if (activeServer) {
    fhirClient = new FhirClient(activeServer.url);
    validationEngine = new ValidationEngine(fhirClient);
  }

  // FHIR Server endpoints
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
      const data = insertFhirServerSchema.parse(req.body);
      const server = await storage.createFhirServer(data);
      res.json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers/:id/activate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateFhirServerStatus(id, true);
      
      // Reinitialize FHIR client with new server
      const servers = await storage.getFhirServers();
      const activeServer = servers.find(s => s.id === id);
      if (activeServer) {
        fhirClient = new FhirClient(activeServer.url);
        validationEngine = new ValidationEngine(fhirClient);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/connection/test", async (req, res) => {
    try {
      if (!fhirClient) {
        return res.status(400).json({ message: "No active FHIR server configured" });
      }
      
      const result = await fhirClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Resource endpoints
  app.get("/api/fhir/resources", async (req, res) => {
    try {
      if (!fhirClient) {
        return res.status(400).json({ message: "No active FHIR server configured" });
      }

      const { resourceType, _count = '20', page = '0', search } = req.query;
      const count = parseInt(_count as string);
      const offset = parseInt(page as string) * count;

      if (search) {
        // Perform search
        const results = await storage.searchFhirResources(search as string, resourceType as string);
        res.json({
          resources: results.slice(offset, offset + count),
          total: results.length,
        });
      } else {
        // Fetch from FHIR server
        const bundle = await fhirClient.searchResources(
          resourceType as string || 'Patient',
          {},
          count
        );

        const resources = bundle.entry?.map(entry => entry.resource) || [];
        
        // For servers that don't provide total, estimate based on entries and pagination
        let total = bundle.total || 0;
        if (total === 0 && resources.length > 0) {
          // If we have resources but no total, estimate
          if (bundle.link?.some(link => link.relation === 'next')) {
            total = resources.length * 20; // Rough estimate for pagination
          } else {
            total = resources.length;
          }
        }
        
        // Store resources locally for validation
        for (const resource of resources) {
          const existing = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
          if (!existing) {
            await storage.createFhirResource({
              serverId: (await storage.getActiveFhirServer())?.id || 1,
              resourceType: resource.resourceType,
              resourceId: resource.id,
              versionId: resource.meta?.versionId,
              data: resource,
            });
          }
        }

        res.json({
          resources,
          total,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/resources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const resource = await storage.getFhirResourceById(id);
      
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      res.json(resource);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/resource-types", async (req, res) => {
    try {
      if (!fhirClient) {
        return res.status(400).json({ message: "No active FHIR server configured" });
      }
      
      const resourceTypes = await fhirClient.getAllResourceTypes();
      res.json(resourceTypes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/resource-counts", async (req, res) => {
    try {
      if (!fhirClient) {
        return res.status(400).json({ message: "No active FHIR server configured" });
      }
      
      const counts: Record<string, number> = {};
      
      // Get counts for common resource types with parallel requests
      const commonTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 'Organization'];
      const countPromises = commonTypes.map(async (type) => {
        try {
          const count = await fhirClient.getResourceCount(type);
          return { type, count };
        } catch (error) {
          console.warn(`Failed to get count for ${type}:`, error);
          return { type, count: 0 };
        }
      });
      
      const results = await Promise.all(countPromises);
      results.forEach(({ type, count }) => {
        counts[type] = count;
      });
      
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation endpoints
  app.post("/api/validation/validate-resource", async (req, res) => {
    try {
      if (!validationEngine) {
        return res.status(400).json({ message: "Validation engine not initialized" });
      }

      const { resource, profileUrl, config } = req.body;
      
      const result = await validationEngine.validateResource(resource, profileUrl, config);
      
      // Store validation result
      const resourceRecord = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
      if (resourceRecord) {
        await storage.createValidationResult({
          resourceId: resourceRecord.id,
          profileId: null, // TODO: link to profile if available
          isValid: result.isValid,
          errors: result.errors,
          warnings: result.warnings,
        });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/profiles", async (req, res) => {
    try {
      const { resourceType } = req.query;
      const profiles = await storage.getValidationProfiles(resourceType as string);
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/profiles", async (req, res) => {
    try {
      const data = insertValidationProfileSchema.parse(req.body);
      const profile = await storage.createValidationProfile(data);
      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/validation/errors/recent", async (req, res) => {
    try {
      const { limit = '10' } = req.query;
      const errors = await storage.getRecentValidationErrors(parseInt(limit as string));
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard endpoints
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getResourceStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/cards", async (req, res) => {
    try {
      const cards = await storage.getDashboardCards();
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
