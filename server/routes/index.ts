import type { Express } from "express";
import { FhirClient } from "../services/fhir/fhir-client";
import { ConsolidatedValidationService, UnifiedValidationService } from "../services/validation";
import { DashboardService } from "../services/dashboard/dashboard-service";

// Import route modules
import { setupValidationRoutes, setupValidationQueueRoutes, setupValidationSettingsRoutes } from "./api/validation";
import { setupFhirRoutes, setupProfileRoutes } from "./api/fhir";
import { setupDashboardRoutes } from "./api/dashboard";

export function setupAllRoutes(app: Express, fhirClient: FhirClient, consolidatedValidationService: InstanceType<typeof UnifiedValidationService>, dashboardService: DashboardService) {
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Setup all route modules
  setupValidationRoutes(app, consolidatedValidationService, dashboardService);
  setupFhirRoutes(app, fhirClient);
  setupDashboardRoutes(app, dashboardService);
  setupProfileRoutes(app);
  setupValidationSettingsRoutes(app);
  setupValidationQueueRoutes(app);
}

export async function registerRoutes(app: Express) {
  // Create services with error handling
  let fhirClient, consolidatedValidationService, dashboardService;
  
  try {
    fhirClient = new FhirClient('https://hapi.fhir.org/baseR4'); // Default FHIR server
  } catch (error) {
    console.warn('FHIR client creation failed:', error.message);
    fhirClient = null;
  }
  
  try {
    consolidatedValidationService = new ConsolidatedValidationService();
  } catch (error) {
    console.warn('Consolidated validation service creation failed:', error.message);
    consolidatedValidationService = null;
  }
  
  try {
    const { storage } = await import('../storage');
    dashboardService = new DashboardService(fhirClient, storage);
  } catch (error) {
    console.warn('Dashboard service creation failed:', error.message);
    dashboardService = null;
  }

  // Setup all routes
  setupAllRoutes(app, fhirClient, consolidatedValidationService, dashboardService);

  // Return the Express app itself for server startup
  return app;
}
