import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { FhirClient } from "./services/fhir/fhir-client";
import { getConsolidatedValidationService, ConsolidatedValidationService } from "./services/validation";
import { DashboardService } from "./services/dashboard/dashboard-service";
import { setupAllRoutes } from "./routes/index.js";

let fhirClient: FhirClient;
let consolidatedValidationService: ConsolidatedValidationService;
let dashboardService: DashboardService;

// Make dashboard service available globally for validation settings service
declare global {
  var dashboardService: DashboardService | undefined;
}

export function setupRoutes(app: Express): Server {
  // Initialize services
  fhirClient = new FhirClient("https://hapi.fhir.org/baseR4"); // Default FHIR server
  consolidatedValidationService = getConsolidatedValidationService();
  dashboardService = new DashboardService(fhirClient, storage);
  
  // Make dashboard service globally available
  global.dashboardService = dashboardService;

  // Setup all routes using modular structure
  setupAllRoutes(app, fhirClient, consolidatedValidationService, dashboardService);

  const httpServer = createServer(app);
  
  return httpServer;
}
