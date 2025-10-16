import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { FhirClient } from "./services/fhir/fhir-client";
import { getConsolidatedValidationService, ConsolidatedValidationService } from "./services/validation";
import { DashboardService } from "./services/dashboard/dashboard-service";
import { setupAllRoutes } from "./routes/index.js";
import { serverActivationService } from "./services/server-activation-service";
import { initializeHapiProcessPool } from "./services/validation/engine/hapi-process-pool";

let fhirClient: FhirClient;
let consolidatedValidationService: ConsolidatedValidationService;
let dashboardService: DashboardService;

// Make services available globally
declare global {
  var fhirClient: FhirClient | undefined;
  var dashboardService: DashboardService | undefined;
  var serverActivationEmitter: any;
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
    
    // Make FHIR client available globally
    global.fhirClient = fhirClient;
    
    // Register FHIR client with server activation service for dynamic updates
    serverActivationService.setFhirClient(fhirClient);
    
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
  
  // NOTE: HAPI process pool warmup disabled
  // The pool implementation spawns new processes anyway (doesn't reuse warm ones)
  // This wastes 40-60s on startup for no benefit
  // TODO: Implement stdin/stdout IPC to actually reuse processes
  // 
  // try {
  //   console.log('[Routes] Initializing HAPI process pool...');
  //   await initializeHapiProcessPool();
  //   console.log('[Routes] HAPI process pool initialized successfully');
  // } catch (error) {
  //   console.warn('[Routes] HAPI process pool initialization failed (validation will use fallback):', error);
  // }

  // Setup all routes using modular structure
  setupAllRoutes(app, fhirClient, consolidatedValidationService, dashboardService);

  const httpServer = createServer(app);
  
  return httpServer;
}
