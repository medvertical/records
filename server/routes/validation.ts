/**
 * Main Validation Routes
 * 
 * Orchestrates all validation-related routes and delegates to specialized modules
 */

import type { Express } from "express";
import { storage } from "../storage.js";
import { ConsolidatedValidationService } from "../services/validation";
import { DashboardService } from "../services/dashboard/dashboard-service";
import { FhirClient } from "../services/fhir/fhir-client.js";
import { setupBulkControlRoutes } from "./api/validation/bulk-control";
import { setupResourceValidationRoutes } from "./api/validation/validation-resource";
import { setupValidationPipelineRoutes } from "./api/validation/validation-pipeline";
import { setupValidationProfilesRoutes } from "./api/validation/validation-profiles";
import { setupValidationBackupsRoutes } from "./api/validation/validation-backups";

// ============================================================================
// Main Validation Routes Setup
// ============================================================================

export function setupValidationRoutes(app: Express) {
  // Initialize services
  const consolidatedValidationService = new ConsolidatedValidationService();
  const fhirClient = new FhirClient('http://localhost:8080/fhir'); // Default FHIR server URL
  const dashboardService = new DashboardService(fhirClient, storage);

  // ========================================================================
  // Bulk Control Routes (Delegated)
  // ========================================================================
  setupBulkControlRoutes(app);

  // ========================================================================
  // Resource Validation Routes (Delegated)
  // ========================================================================
  setupResourceValidationRoutes(app, consolidatedValidationService);

  // ========================================================================
  // Pipeline Routes (Delegated)
  // ========================================================================
  setupValidationPipelineRoutes(app);

  // ========================================================================
  // Profiles Routes (Delegated)
  // ========================================================================
  setupValidationProfilesRoutes(app);

  // ========================================================================
  // Backups Routes (Delegated)
  // ========================================================================
  setupValidationBackupsRoutes(app);

  // ========================================================================
  // Settings Management (Delegated to validation-settings.ts)
  // ========================================================================
  // Settings endpoints are handled by validation-settings.ts module

  // ========================================================================
  // Configuration Management (Delegated to validation-settings.ts)
  // ========================================================================
  // Configuration endpoints are handled by validation-settings.ts module

  // ========================================================================
  // Test Settings Endpoint (Delegated to validation-settings.ts)
  // ========================================================================
  // Test settings endpoints are handled by validation-settings.ts module

  // ========================================================================
  // Dashboard Integration
  // ========================================================================

  app.get("/api/validation/dashboard-stats", async (req, res) => {
    try {
      const fhirStats = await dashboardService.getFhirServerStats();
      const validationStats = await dashboardService.getValidationStats();
      const stats = {
        fhir: fhirStats,
        validation: validationStats,
        timestamp: new Date().toISOString()
      };
      res.json(stats);
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
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          validation: true,
          settings: true,
          dashboard: true
        }
      };
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ 
        status: 'unhealthy',
        message: error.message 
      });
    }
  });

  // SSE/WebSocket endpoints removed - using polling only
}