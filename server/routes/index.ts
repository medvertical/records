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
  validateByIdsRoutes,
  cacheClearRoutes,
  analyticsCacheRoutes
} from "./api/validation";
import { setupFhirRoutes, setupProfileRoutes } from "./api/fhir";
import { setupDashboardRoutes } from "./api/dashboard";
import { setupServerRoutes } from "./api/servers";
import { performanceRoutes } from "./api/performance";
import adminRoutes from "./api/admin/clear-validation-results";
import healthCheckRoutes from "./api/health/health-checks";
import dashboardSettingsRouter from "./api/settings/dashboard-settings";
import systemSettingsRouter from "./api/settings/system-settings";

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
  app.use('/api/validation/cache', cacheClearRoutes);
  app.use('/api/validation/analytics', analyticsCacheRoutes);
  
  // FHIR resource edit routes are registered inside setupFhirRoutes() to ensure fhirClient middleware is applied
  
  // Performance monitoring routes
  app.use('/api/performance', performanceRoutes);
  
  // Admin routes
  app.use('/api/admin', adminRoutes);
  
  // Settings routes
  app.use('/api/dashboard-settings', dashboardSettingsRouter);
  app.use('/api/system-settings', systemSettingsRouter);
}

