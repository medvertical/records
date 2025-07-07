import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { FhirClient } from "./services/fhir-client.js";
import { ValidationEngine } from "./services/validation-engine.js";
import { profileManager } from "./services/profile-manager.js";
import { BulkValidationService } from "./services/bulk-validation.js";
import { insertFhirServerSchema, insertFhirResourceSchema, insertValidationProfileSchema } from "@shared/schema.js";
import { validationWebSocket, initializeWebSocket } from "./services/websocket-server.js";
import { z } from "zod";

let fhirClient: FhirClient;
let validationEngine: ValidationEngine;
let bulkValidationService: BulkValidationService;

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize FHIR client with active server
  const activeServer = await storage.getActiveFhirServer();
  if (activeServer) {
    fhirClient = new FhirClient(activeServer.url);
    validationEngine = new ValidationEngine(fhirClient);
    bulkValidationService = new BulkValidationService(fhirClient, validationEngine);
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

  // Test connection to a custom FHIR server
  app.get("/api/fhir/connection/test-custom", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ connected: false, error: "URL parameter is required" });
      }

      // Create a temporary FHIR client to test the connection
      const tempClient = new FhirClient(url);
      const result = await tempClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ connected: false, error: error.message });
    }
  });

  // Get all FHIR servers
  app.get("/api/fhir/servers", async (req, res) => {
    try {
      const servers = await storage.getFhirServers();
      res.json(servers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new FHIR server
  app.post("/api/fhir/servers", async (req, res) => {
    try {
      const { name, url, authConfig } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ message: "Name and URL are required" });
      }

      // Deactivate other servers first
      const existingServers = await storage.getFhirServers();
      for (const server of existingServers) {
        if (server.isActive) {
          await storage.updateFhirServerStatus(server.id, false);
        }
      }

      // Create new server
      const newServer = await storage.createFhirServer({
        name,
        url,
        isActive: true,
        authConfig
      });

      // Update the global FHIR client
      fhirClient = new FhirClient(url);
      
      res.json(newServer);
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
      const resourceId = req.params.id;
      console.log(`[Resource Detail] Looking for resource ID: ${resourceId}`);
      
      // Check if it's a numeric ID (database ID) or a UUID (FHIR resource ID)
      const isNumeric = /^\d+$/.test(resourceId);
      console.log(`[Resource Detail] Is numeric: ${isNumeric}`);
      
      let resource;
      if (isNumeric) {
        const id = parseInt(resourceId);
        console.log(`[Resource Detail] Searching by database ID: ${id}`);
        resource = await storage.getFhirResourceById(id);
      } else {
        // Look up by FHIR resource ID using database query
        console.log(`[Resource Detail] Searching by FHIR resource ID: ${resourceId}`);
        resource = await storage.getFhirResourceByTypeAndId("", resourceId);
        console.log(`[Resource Detail] Found resource by FHIR ID:`, resource ? 'YES' : 'NO');
        if (resource) {
          // Get full resource with validation results
          console.log(`[Resource Detail] Getting full resource with validation for DB ID: ${resource.id}`);
          resource = await storage.getFhirResourceById(resource.id);
        }
      }
      
      if (!resource) {
        console.log(`[Resource Detail] Resource not found for ID: ${resourceId}`);
        return res.status(404).json({ message: "Resource not found" });
      }
      
      console.log(`[Resource Detail] Returning resource:`, resource.resourceType, resource.resourceId);
      res.json(resource);
    } catch (error: any) {
      console.error(`[Resource Detail] Error:`, error.message);
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

  app.post("/api/validation/validate-resource-detailed", async (req, res) => {
    try {
      if (!validationEngine) {
        return res.status(400).json({ message: "Validation engine not initialized" });
      }

      const { resource, config } = req.body;
      
      // Create enhanced config with profiles from installed packages
      const installedProfiles = await storage.getValidationProfiles(resource?.resourceType);
      const enhancedConfig = {
        strictMode: config?.strictMode || false,
        requiredFields: config?.requiredFields || [],
        customRules: config?.customRules || [],
        autoValidate: true,
        profiles: installedProfiles.map(p => p.url).slice(0, 3), // Limit to 3 profiles for performance
        fetchFromSimplifier: config?.fetchFromSimplifier !== false,
        fetchFromFhirServer: config?.fetchFromFhirServer !== false,
        autoDetectProfiles: config?.autoDetectProfiles !== false
      };
      
      const result = await validationEngine.validateResourceDetailed(resource, enhancedConfig);
      
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

  app.get("/api/validation/settings", async (req, res) => {
    try {
      // Return default validation settings
      const settings = {
        fetchFromSimplifier: true,
        fetchFromFhirServer: true,
        autoDetectProfiles: true,
        strictMode: false,
        maxProfiles: 3,
        cacheDuration: 3600 // 1 hour in seconds
      };
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/settings", async (req, res) => {
    try {
      const settings = req.body;
      
      // Update terminology server configuration if provided
      if (settings.terminologyServer && validationEngine) {
        validationEngine.updateTerminologyConfig(settings);
      }
      
      res.json({
        message: "Validation settings updated successfully",
        settings: settings
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/packages", async (req, res) => {
    try {
      const packages = await fhirClient.scanInstalledPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk validation endpoints
  app.post("/api/validation/bulk/start", async (req, res) => {
    try {
      if (!bulkValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      if (bulkValidationService.isValidationRunning()) {
        return res.status(409).json({ message: "Bulk validation is already running" });
      }

      const options = req.body || {};
      
      // Broadcast validation start via WebSocket
      if (validationWebSocket) {
        validationWebSocket.broadcastValidationStart();
      }

      // Start bulk validation asynchronously
      bulkValidationService.validateAllResources({
        batchSize: options.batchSize || 50,
        skipUnchanged: options.skipUnchanged !== false, // Default to true
        resourceTypes: options.resourceTypes
      }).catch(error => {
        console.error('Bulk validation error:', error);
        if (validationWebSocket) {
          validationWebSocket.broadcastError(error.message);
        }
      });

      res.json({ 
        message: "Bulk validation started",
        status: "running"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/bulk/progress", async (req, res) => {
    try {
      if (!bulkValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      const progress = bulkValidationService.getCurrentProgress();
      if (!progress) {
        return res.json({ status: "not_running" });
      }

      let status = "not_running";
      if (progress.isComplete) {
        status = "completed";
      } else if (bulkValidationService.isValidationPaused()) {
        status = "paused";
      } else if (bulkValidationService.isValidationRunning()) {
        status = "running";
      }

      res.json({
        status,
        ...progress
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/bulk/summary", async (req, res) => {
    try {
      if (!bulkValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      const summary = await bulkValidationService.getServerValidationSummary();
      res.json(summary);
    } catch (error: any) {
      console.error('Error getting validation summary:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/pause", async (req, res) => {
    try {
      if (!bulkValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      if (!bulkValidationService.isValidationRunning()) {
        return res.status(400).json({ message: "No validation is currently running" });
      }

      bulkValidationService.pauseValidation();
      res.json({ message: "Validation paused successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/resume", async (req, res) => {
    try {
      if (!bulkValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      if (!bulkValidationService.isValidationPaused()) {
        return res.status(400).json({ message: "No paused validation to resume" });
      }

      // Resume the validation (just change state, don't restart)
      const resumedProgress = await bulkValidationService.resumeValidation({
        batchSize: 50,
        skipUnchanged: true
      });
      
      // Broadcast resume status
      if (validationWebSocket) {
        validationWebSocket.broadcastProgress(resumedProgress);
      }

      res.json({ message: "Validation resumed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/stop", async (req, res) => {
    try {
      if (!bulkValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      bulkValidationService.stopValidation();
      res.json({ message: "Validation stopped successfully" });
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

  // Profile Management endpoints
  app.get("/api/profiles/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }
      const packages = await profileManager.searchPackages(query as string);
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/profiles/installed", async (req, res) => {
    try {
      const packages = await profileManager.getInstalledPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profiles/install", async (req, res) => {
    try {
      const { packageId, version } = req.body;
      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }
      const result = await profileManager.installPackage(packageId, version);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/profiles/uninstall/:packageId", async (req, res) => {
    try {
      const { packageId } = req.params;
      const result = await profileManager.uninstallPackage(packageId);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/profiles/update/:packageId", async (req, res) => {
    try {
      const { packageId } = req.params;
      const result = await profileManager.updatePackage(packageId);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/profiles/updates", async (req, res) => {
    try {
      const updates = await profileManager.checkForUpdates();
      res.json(updates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for real-time validation updates
  initializeWebSocket(httpServer);
  
  return httpServer;
}
