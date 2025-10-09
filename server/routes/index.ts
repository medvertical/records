import type { Express } from "express";
import { FhirClient } from "../services/fhir/fhir-client";
import { ConsolidatedValidationService } from "../services/validation";
import { DashboardService } from "../services/dashboard/dashboard-service";

// Import route modules
import { 
  setupValidationRoutes, 
  setupValidationSettingsRoutes
} from "./api/validation";
import { setupFhirRoutes, setupProfileRoutes, resourceEditRoutes, batchEditRoutes } from "./api/fhir";
import { setupDashboardRoutes } from "./api/dashboard";
import { setupServerRoutes } from "./api/servers";
import { performanceRoutes } from "./api/performance";
import adminRoutes from "./api/admin/clear-validation-results";

export function setupAllRoutes(app: Express, fhirClient: FhirClient | null, consolidatedValidationService: ConsolidatedValidationService | null, dashboardService: DashboardService | null) {
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
  setupServerRoutes(app);
  
  // Validation API routes
  // Note: validationClearRoutes and validationGroupsRoutes removed during simplification
  
  // FHIR resource edit routes
  app.use('/api/fhir/resources/:resourceType/:id', resourceEditRoutes);
  app.use('/api/fhir/resources/batch-edit', batchEditRoutes);
  
  // Performance monitoring routes
  app.use('/api/performance', performanceRoutes);
  
  
  // Admin routes
  app.use('/api/admin', adminRoutes);
}

