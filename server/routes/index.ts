import type { Express } from "express";
import { FhirClient } from "../services/fhir/fhir-client";
import { ConsolidatedValidationService } from "../services/validation";
import { DashboardService } from "../services/dashboard/dashboard-service";

// Import route modules
import { 
  setupValidationRoutes, 
  setupValidationQueueRoutes, 
  setupValidationSettingsRoutes, 
  validationClearRoutes,
  validationGroupsRoutes,
  resourceMessagesRoutes
} from "./api/validation";
import { setupFhirRoutes, setupProfileRoutes } from "./api/fhir";
import { setupDashboardRoutes } from "./api/dashboard";
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
  setupValidationQueueRoutes(app);
  
  // Validation API routes
  app.use('/api/validation/clear', validationClearRoutes);
  app.use('/api/validation/issues/groups', validationGroupsRoutes);
  app.use('/api/validation/resources', resourceMessagesRoutes);
  
  // Admin routes
  app.use('/api/admin', adminRoutes);
}

