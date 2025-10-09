import type { Express } from "express";
import { FhirClient } from "../services/fhir/fhir-client";
import { ConsolidatedValidationService } from "../services/validation";
import { DashboardService } from "../services/dashboard/dashboard-service";

// Import route modules
import { 
  setupValidationRoutes, 
  setupValidationSettingsRoutes,
  validationGroupsRoutes,
  resourceMessagesRoutes,
  validationProgressRoutes,
  batchRevalidateRoutes,
  singleRevalidateRoutes,
  validateByIdsRoutes
} from "./api/validation";
import { setupFhirRoutes, setupProfileRoutes, resourceEditRoutes, batchEditRoutes } from "./api/fhir";
import { setupDashboardRoutes } from "./api/dashboard";
import { setupServerRoutes } from "./api/servers";
import { performanceRoutes } from "./api/performance";
import adminRoutes from "./api/admin/clear-validation-results";
import healthCheckRoutes from "./api/health/health-checks";

export function setupAllRoutes(app: Express, fhirClient: FhirClient | null, consolidatedValidationService: ConsolidatedValidationService | null, dashboardService: DashboardService | null) {
  // Health check endpoints
  app.use('/api/health', healthCheckRoutes);

  // Setup all route modules
  setupValidationRoutes(app, consolidatedValidationService, dashboardService);
  setupFhirRoutes(app, fhirClient);
  setupDashboardRoutes(app, dashboardService);
  setupProfileRoutes(app);
  setupValidationSettingsRoutes(app);
  setupServerRoutes(app);
  
  // Validation API routes
  app.use('/api/validation', validationGroupsRoutes);
  app.use('/api/validation', resourceMessagesRoutes);
  app.use('/api/validation', validationProgressRoutes);
  app.use('/api/validation', batchRevalidateRoutes);
  app.use('/api/validation', singleRevalidateRoutes);
  app.use('/api/validation', validateByIdsRoutes);
  
  // FHIR resource edit routes
  app.use('/api/fhir/resources/:resourceType/:id', resourceEditRoutes);
  app.use('/api/fhir/resources/batch-edit', batchEditRoutes);
  
  // Performance monitoring routes
  app.use('/api/performance', performanceRoutes);
  
  // Admin routes
  app.use('/api/admin', adminRoutes);
}

