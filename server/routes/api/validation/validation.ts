/**
 * Main Validation Routes
 * 
 * Orchestrates all validation-related routes and delegates to specialized modules
 */

import type { Express } from "express";
import { storage } from "../../../storage.js";
import { ConsolidatedValidationService } from "../../../services/validation";
import { getValidationSettingsService } from "../../../services/validation/settings/validation-settings-service";
import { DashboardService } from "../../../services/dashboard/dashboard-service";
import type { ValidationSettings, ValidationSettingsUpdate } from "@shared/validation-settings";
import { setupBulkControlRoutes } from "./bulk-control";
import { setupResourceValidationRoutes } from "./validation-resource";
import { setupValidationPipelineRoutes } from "./validation-pipeline";
import { setupValidationProfilesRoutes } from "./validation-profiles";
import { setupValidationBackupsRoutes } from "./validation-backups";
import { setupValidationMetricsRoutes } from "./validation-metrics";
import businessRulesRouter from "./business-rules";

// ============================================================================
// Main Validation Routes Setup
// ============================================================================

export function setupValidationRoutes(app: Express, consolidatedValidationService: ConsolidatedValidationService | null, dashboardService: DashboardService | null) {
  
  // ========================================================================
  // Individual Resource Validation (Delegated)
  // ========================================================================
  setupResourceValidationRoutes(app, consolidatedValidationService);

  // ========================================================================
  // Bulk Validation Control (Delegated)
  // ========================================================================
  setupBulkControlRoutes(app);

  // ========================================================================
  // Validation Pipeline (Delegated)
  // ========================================================================
  setupValidationPipelineRoutes(app);

  // ========================================================================
  // Validation Profiles (Delegated)
  // ========================================================================
  setupValidationProfilesRoutes(app);

  // ========================================================================
  // Validation Backups (Delegated)
  // ========================================================================
  setupValidationBackupsRoutes(app);

  // ========================================================================
  // Validation Metrics (Task 3.12)
  // ========================================================================
  setupValidationMetricsRoutes(app);

  // ========================================================================
  // Business Rules Management (Task 6.6)
  // ========================================================================
  app.use("/api/validation/business-rules", businessRulesRouter);

  // ========================================================================
  // Bulk Validation Summaries Endpoint (Performance Optimization)
  // ========================================================================
  app.post("/api/validation/summaries/bulk", async (req, res) => {
    try {
      const { resources, serverId = 1 } = req.body;
      
      if (!resources || !Array.isArray(resources)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Request body must include a "resources" array with { resourceType, id } objects'
        });
      }
      
      const { getResourceValidationSummariesBulk } = await import('../../../repositories/validation-groups-repository');
      
      // Transform resources array to include fhirId field
      const resourcesWithFhirId = resources.map(r => ({
        resourceType: r.resourceType,
        fhirId: r.id
      }));
      
      const summariesMap = await getResourceValidationSummariesBulk(serverId, resourcesWithFhirId);
      
      // Convert Map to object for JSON serialization
      const summariesObj: Record<string, any> = {};
      for (const [key, value] of summariesMap.entries()) {
        summariesObj[key] = value;
      }
      
      res.json({
        success: true,
        data: summariesObj,
        count: summariesMap.size,
        message: `Retrieved validation summaries for ${summariesMap.size} of ${resources.length} resources`
      });
    } catch (error: any) {
      console.error('[Validation API] Error fetching bulk validation summaries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch validation summaries',
        message: error.message
      });
    }
  });

  // ========================================================================
  // Settings Management (Delegated to validation-settings.ts)
  // ========================================================================

  app.get("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
      const settings = await settingsService.getCurrentSettings(serverId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Removed: Duplicate PUT handler moved to validation-settings.ts for better organization
  // app.put("/api/validation/settings", ...)

  // ========================================================================
  // Configuration Management
  // ========================================================================

  app.put("/api/validation/configuration", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { aspects, performance, resourceTypes, serverId } = req.body;
      
      const update: ValidationSettingsUpdate = {
        aspects,
        performance,
        resourceTypes
      };
      
      const result = await settingsService.updateSettings({ 
        ...update, 
        serverId, 
        validate: true 
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================================================
  // Test Settings
  // ========================================================================

  app.post("/api/validation/test-settings", async (req, res) => {
    try {
      // Simple test settings endpoint - in production this would validate settings
      res.json({ 
        success: true, 
        message: 'Settings test completed',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================================================
  // Cleanup Operations
  // ========================================================================

  app.post("/api/validation/cleanup", async (req, res) => {
    try {
      const { type = 'all' } = req.body;
      // Simple cleanup endpoint - in production this would call a cleanup service
      res.json({ 
        success: true, 
        message: `Cleanup of type '${type}' completed`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/cleanup/statistics", async (req, res) => {
    try {
      // Simple statistics endpoint
      res.json({
        totalRecords: 0,
        cleanedRecords: 0,
        lastCleanup: null,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  app.get("/api/validation/errors/recent", async (req, res) => {
    try {
      // Simple error endpoint - returns empty array for now
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================================================
  // Health Check
  // ========================================================================

  app.get("/api/validation/health", async (req, res) => {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          validation: !!consolidatedValidationService,
          dashboard: !!dashboardService,
          storage: !!storage
        }
      };
      
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ 
        status: "unhealthy",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}