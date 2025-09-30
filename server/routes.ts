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

async function initializeServices(): Promise<void> {
  try {
    // Import storage first
    const storageModule = await import('./storage');
    const storageInstance = storageModule.storage;
    
    // Get the active FHIR server from database
    const activeServer = await storageInstance.getActiveFhirServer();
    
    if (!activeServer) {
      throw new Error('No active FHIR server configured. Please configure a FHIR server in the settings.');
    }
    
    const serverUrl = activeServer.url;
    console.log(`[Routes] Using FHIR server from database: ${serverUrl}`);
    console.log(`[Routes] Active server from DB:`, activeServer);
    fhirClient = new FhirClient(serverUrl);
    
    // Initialize dashboard service after fhirClient is available
    dashboardService = new DashboardService(fhirClient, storageInstance);
    global.dashboardService = dashboardService;
  } catch (error: any) {
    console.warn('FHIR client creation failed:', error.message);
    fhirClient = null;
    throw error;
  }
}

export async function setupRoutes(app: Express): Promise<Server> {
  // Initialize services
  consolidatedValidationService = getConsolidatedValidationService();

  // Initialize database and FHIR client first
  await initializeServices();

  // Setup all routes using modular structure
  setupAllRoutes(app, fhirClient, consolidatedValidationService, dashboardService);

  const httpServer = createServer(app);
  
  return httpServer;
}
