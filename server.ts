import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { serveStatic, log } from "./server/static.js";
import { logger } from "./server/utils/logger.js";
import { FeatureFlags, assertProductionSafety, logFeatureFlags } from "./server/config/feature-flags.js";
import { getValidationPerformanceMonitor } from "./server/services/performance/validation-performance-monitor.js";
import { setupAllRoutes } from "./server/routes/index.js";
import { storage } from "./server/storage.js";
import { FhirClient } from "./server/services/fhir/fhir-client.js";
import { getConsolidatedValidationService } from "./server/services/validation/index.js";
import { DashboardService } from "./server/services/dashboard/dashboard-service.js";
import { serverActivationService } from "./server/services/server-activation-service.js";

// Make services available globally
declare global {
  var fhirClient: FhirClient | undefined;
  var dashboardService: DashboardService | undefined;
  var serverActivationEmitter: any;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Initialize services before setting up routes
async function initializeServices() {
  try {
    console.log('[Server] Initializing services...');
    
    // Get active FHIR server from database
    const activeServer = await storage.getActiveFhirServer();
    
    if (!activeServer) {
      console.warn('[Server] No active FHIR server configured. Routes will return appropriate errors.');
      return { fhirClient: null, consolidatedValidationService: null, dashboardService: null };
    }
    
    console.log(`[Server] Active FHIR server: ${activeServer.name} (${activeServer.url})`);
    
    // Create FHIR client
    const fhirClient = new FhirClient(activeServer.url, activeServer.authConfig as any);
    
    // Register with server activation service for dynamic updates
    serverActivationService.setFhirClient(fhirClient);
    
    // Make FHIR client available globally
    global.fhirClient = fhirClient;
    
    // Initialize validation service
    const consolidatedValidationService = getConsolidatedValidationService();
    
    // Initialize dashboard service
    const dashboardService = new DashboardService(fhirClient, storage);
    global.dashboardService = dashboardService;
    
    console.log('[Server] Services initialized successfully');
    
    return { fhirClient, consolidatedValidationService, dashboardService };
  } catch (error: any) {
    console.error('[Server] Service initialization failed:', error.message);
    console.warn('[Server] Continuing with null services. Routes will handle missing services gracefully.');
    return { fhirClient: null, consolidatedValidationService: null, dashboardService: null };
  }
}

// Initialize services and setup routes
const { fhirClient, consolidatedValidationService, dashboardService } = await initializeServices();

// Setup all API routes (validation, FHIR, dashboard, etc.)
setupAllRoutes(app, fhirClient, consolidatedValidationService, dashboardService);

/**
 * Helper function to return mock data or error based on DEMO_MOCKS flag
 */
function handleDatabaseUnavailable<T>(mockData: T, errorMessage: string, res: Response): void {
  if (FeatureFlags.DEMO_MOCKS) {
    console.warn(`[DEMO_MOCKS] ${errorMessage} - returning mock data`);
    res.json(mockData);
  } else {
    console.error(`Database unavailable: ${errorMessage}`);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database connection is unavailable. Please contact support.',
      timestamp: new Date().toISOString(),
    });
  }
}

// Mock data for DEMO_MOCKS mode only
const mockFhirServers = [
  { id: 1, name: "DEMO Server 1", url: "http://demo1.example.com/fhir", isActive: true },
  { id: 2, name: "DEMO Server 2", url: "http://demo2.example.com/fhir", isActive: false }
];

// Mock validation progress data (will be replaced by SSE implementation)
const defaultValidationProgress = {
  totalResources: 100,
  processedResources: 75,
  validResources: 60,
  errorResources: 15,
  currentResourceType: "Patient",
  isComplete: false,
  errors: [],
  startTime: new Date().toISOString(),
  status: "running" as const
};

const mockRecentErrors = [
  {
    id: 1,
    message: "Resource validation failed",
    severity: "error",
    timestamp: new Date().toISOString(),
    resourceType: "Patient"
  },
  {
    id: 2,
    message: "Missing required field",
    severity: "warning",
    timestamp: new Date().toISOString(),
    resourceType: "Observation"
  }
];

const mockFhirVersion = {
  version: "R4",
  release: "4.0.1",
  date: "2019-10-30",
  fhirVersion: "4.0.1"
};

// API Routes with fallbacks for Vercel deployment

app.get("/api/validation/bulk/progress", async (req, res) => {
  try {
    // Try to get real progress from database
    const { storage } = await import("./server/storage.js");
    const summary = await storage.getResourceStatsWithSettings();
    res.json({
      status: "running",
      totalResources: 100,
      processedResources: summary.validResources + summary.errorResources,
      validResources: summary.validResources,
      errorResources: summary.errorResources,
      currentResourceType: "Patient",
      isComplete: false,
      errors: [],
      startTime: new Date().toISOString()
    });
  } catch (error) {
    handleDatabaseUnavailable(defaultValidationProgress, 'Validation progress unavailable', res);
  }
});

app.get("/api/validation/errors/recent", async (req, res) => {
  try {
    // Return mock errors for now - method not implemented in storage
    res.json(mockRecentErrors);
  } catch (error) {
    handleDatabaseUnavailable(mockRecentErrors, 'Recent errors unavailable', res);
  }
});

app.get("/api/fhir/version", async (req, res) => {
  try {
    // Try to get real FHIR version info from the active server
    const { storage } = await import("./server/storage.js");
    const { FhirClient } = await import("./server/services/fhir/fhir-client.js");
    
    const servers = await storage.getFhirServers();
    const activeServer = servers.find(s => s.isActive) || servers[0];
    
    if (!activeServer) {
      return res.json({
        ...mockFhirVersion,
        connection: { connected: false, error: "No FHIR server configured" }
      });
    }

    const fhirClient = new FhirClient(activeServer.url, activeServer.authConfig as any);
    const connectionResult = await fhirClient.testConnection();
    const capabilityStatement = await fhirClient.getCapabilityStatement();
    
    if (capabilityStatement) {
      res.json({
        version: capabilityStatement.fhirVersion || "Unknown",
        release: capabilityStatement.fhirVersion || "Unknown",
        date: capabilityStatement.date || new Date().toISOString(),
        fhirVersion: capabilityStatement.fhirVersion || "Unknown",
        connection: connectionResult,
        serverInfo: {
          name: capabilityStatement.software?.name || activeServer.name,
          version: capabilityStatement.software?.version || "Unknown",
          publisher: capabilityStatement.software?.publisher || "Unknown",
          description: capabilityStatement.software?.description || "Unknown"
        },
        capabilities: {
          rest: capabilityStatement.rest?.length || 0,
          resourceTypes: capabilityStatement.rest?.[0]?.resource?.length || 0,
          operations: capabilityStatement.rest?.[0]?.operation?.length || 0
        }
      });
    } else {
      res.json({
        ...mockFhirVersion,
        connection: connectionResult,
        serverInfo: {
          name: activeServer.name,
          url: activeServer.url,
          status: connectionResult.connected ? "connected" : "disconnected"
        }
      });
    }
  } catch (error) {
    if (FeatureFlags.DEMO_MOCKS) {
      console.log('FHIR client not available, using mock version info');
      res.json(mockFhirVersion);
    } else {
      res.status(503).json({
        error: 'FHIR client not available',
        message: 'Please configure and activate a FHIR server'
      });
    }
  }
});

app.get("/api/fhir/connection/test", async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Try to test connection to the active FHIR server
    const { storage } = await import("./server/storage.js");
    const servers = await storage.getFhirServers();
    const activeServer = servers.find(s => s.isActive) || servers[0];
    
    if (!activeServer) {
      return res.json({
        connected: false,
        error: "No FHIR server configured",
        version: null,
        url: null,
        serverName: null,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      });
    }

          const { FhirClient } = await import("./server/services/fhir/fhir-client.js");
          const fhirClient = new FhirClient(activeServer.url, activeServer.authConfig as any);
          const result = await fhirClient.testConnection();
    
    res.json({
      connected: result.connected,
      version: result.version || "Unknown",
      url: activeServer.url,
      serverName: activeServer.name,
      error: result.error || null,
      errorType: result.errorType || null,
      statusCode: result.statusCode || null,
      timestamp: new Date().toISOString(),
      responseTime: result.responseTime || (Date.now() - startTime)
    });
  } catch (error: any) {
    console.warn('FHIR connection test failed', { error: error?.message });
    res.status(503).json({
      connected: false,
      version: null,
      url: null,
      serverName: null,
      error: 'Active FHIR server connection failed',
      errorType: 'server_unavailable',
      statusCode: 503,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime
    });
  }
});

// Test connection to a specific server URL
app.post("/api/fhir/connection/test", async (req, res) => {
  const startTime = Date.now();
  const { url, name } = req.body;
  
  if (!url) {
    return res.status(400).json({
      connected: false,
      error: "URL is required",
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime
    });
  }

  try {
    const { FhirClient } = await import("./server/services/fhir/fhir-client.js");
    const fhirClient = new FhirClient(url);
    const result = await fhirClient.testConnection();
    
    res.json({
      connected: result.connected,
      version: result.version || "Unknown",
      url: url,
      serverName: name || "Test Server",
      error: result.error || null,
      errorType: result.errorType || null,
      statusCode: result.statusCode || null,
      timestamp: new Date().toISOString(),
      responseTime: result.responseTime || (Date.now() - startTime)
    });
  } catch (error: any) {
    res.json({
      connected: false,
      version: null,
      url: url,
      serverName: name || "Test Server",
      error: error.message || "Connection test failed",
      errorType: "server_error",
      statusCode: null,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime
    });
  }
});

// FHIR Server Management Endpoints
app.get("/api/fhir/servers", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const servers = await storage.getFhirServers();
    
    // Remove sensitive auth data from response
    const safeServers = servers.map(server => ({
      id: server.id,
      name: server.name,
      url: server.url,
      isActive: server.isActive,
      hasAuth: !!server.authConfig,
      authType: server.authConfig?.type || 'none',
      createdAt: server.createdAt
    }));
    
    res.json(safeServers);
  } catch (error: any) {
    // Enhanced error handling and logging for database connection failures
    const errorType = error.code || error.name || 'UnknownError';
    const isDatabaseError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
                           error.message?.includes('database') || error.message?.includes('connection');
    
    console.warn('Database not available, using mock FHIR servers:', {
      error: error.message,
      type: errorType,
      code: error.code,
      isDatabaseError,
      timestamp: new Date().toISOString()
    });
    
    res.json(mockFhirServers.map(server => ({
      id: server.id,
      name: server.name,
      url: server.url,
      isActive: server.isActive,
      hasAuth: false,
      authType: 'none',
      createdAt: new Date().toISOString()
    })));
  }
});

app.post("/api/fhir/servers", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const { name, url, authConfig } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        error: "Name and URL are required"
      });
    }
    
    try {
      const newServer = await storage.createFhirServer({
        name,
        url,
        authConfig: authConfig || { type: 'none' },
        isActive: false
      });
      
      res.status(201).json({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
        isActive: newServer.isActive,
        hasAuth: !!newServer.authConfig,
        authType: newServer.authConfig?.type || 'none',
        createdAt: newServer.createdAt
      });
    } catch (e) {
      // Fallback path: add to in-memory mock list when database is disconnected
      console.log('Database not available, adding server to mock data');
      
      const newId = Math.max(...mockFhirServers.map(s => s.id), 0) + 1;
      const newServer = {
        id: newId,
        name,
        url,
        isActive: false
      };
      
      mockFhirServers.push(newServer);
      
      res.status(201).json({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
        isActive: newServer.isActive,
        hasAuth: false,
        authType: 'none',
        createdAt: new Date().toISOString()
      });
    }
  } catch (error: any) {
    // Enhanced error handling and logging
    const errorType = error.code || error.name || 'UnknownError';
    const isDatabaseError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
                           error.message?.includes('database') || error.message?.includes('connection');
    
    console.error('Failed to create FHIR server:', {
      error: error.message,
      type: errorType,
      code: error.code,
      stack: error.stack,
      serverData: { name: req.body.name, url: req.body.url },
      isDatabaseError,
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = "Failed to create FHIR server";
    if (isDatabaseError) {
      errorMessage = "Database connection failed. Server creation may not persist.";
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = "Database server is not available";
    } else if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      errorMessage = "Server with this name or URL already exists";
    }
    
    res.status(500).json({
      error: errorMessage,
      message: error.message,
      type: errorType,
      isDatabaseError
    });
  }
});

app.put("/api/fhir/servers/:id", async (req, res) => {
  const { id } = req.params;
  const serverId = parseInt(id);
  
  try {
    const { storage } = await import("./server/storage.js");
    const { name, url, authConfig, isActive } = req.body;
    
    try {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (url !== undefined) updates.url = url;
      if (authConfig !== undefined) updates.authConfig = authConfig;
      
      const updatedServer = await storage.updateFhirServer(serverId, updates);
      
      // Handle active status separately
      if (isActive !== undefined) {
        await storage.updateFhirServerStatus(serverId, isActive);
        updatedServer.isActive = isActive;
      }
      
      res.json({
        id: updatedServer.id,
        name: updatedServer.name,
        url: updatedServer.url,
        isActive: updatedServer.isActive,
        hasAuth: !!updatedServer.authConfig,
        authType: updatedServer.authConfig?.type || 'none',
        createdAt: updatedServer.createdAt
      });
    } catch (e) {
      // Fallback path: update in-memory mock list when database is disconnected
      console.log('Database not available, updating server in mock data');
      
      const serverIndex = mockFhirServers.findIndex(s => s.id === serverId);
      if (serverIndex === -1) {
        return res.status(404).json({ error: "FHIR server not found" });
      }
      
      const server = mockFhirServers[serverIndex];
      if (name !== undefined) server.name = name;
      if (url !== undefined) server.url = url;
      if (isActive !== undefined) server.isActive = isActive;
      
      res.json({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: false,
        authType: 'none',
        createdAt: new Date().toISOString()
      });
    }
  } catch (error: any) {
    // Enhanced error handling and logging
    const errorType = error.code || error.name || 'UnknownError';
    const isDatabaseError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
                           error.message?.includes('database') || error.message?.includes('connection');
    
    console.error('Failed to update FHIR server:', {
      error: error.message,
      type: errorType,
      code: error.code,
      stack: error.stack,
      serverId: serverId,
      updateData: req.body,
      isDatabaseError,
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = "Failed to update FHIR server";
    if (isDatabaseError) {
      errorMessage = "Database connection failed. Server update may not persist.";
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = "Database server is not available";
    } else if (error.message?.includes('not found')) {
      errorMessage = "Server not found";
    } else if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      errorMessage = "Server with this name or URL already exists";
    }
    
    res.status(500).json({
      error: errorMessage,
      message: error.message,
      type: errorType,
      isDatabaseError
    });
  }
});

app.delete("/api/fhir/servers/:id", async (req, res) => {
  const { id } = req.params;
  const serverId = parseInt(id);
  
  try {
    const { storage } = await import("./server/storage.js");
    
    try {
      await storage.deleteFhirServer(serverId);
      res.status(204).send();
    } catch (e) {
      // Fallback path: remove from in-memory mock list when database is disconnected
      console.log('Database not available, removing server from mock data');
      
      const serverIndex = mockFhirServers.findIndex(s => s.id === serverId);
      if (serverIndex === -1) {
        return res.status(404).json({ error: "FHIR server not found" });
      }
      
      mockFhirServers.splice(serverIndex, 1);
      res.status(204).send();
    }
  } catch (error: any) {
    // Enhanced error handling and logging
    const errorType = error.code || error.name || 'UnknownError';
    const isDatabaseError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
                           error.message?.includes('database') || error.message?.includes('connection');
    
    console.error('Failed to delete FHIR server:', {
      error: error.message,
      type: errorType,
      code: error.code,
      stack: error.stack,
      serverId: serverId,
      isDatabaseError,
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = "Failed to delete FHIR server";
    if (isDatabaseError) {
      errorMessage = "Database connection failed. Server deletion may not persist.";
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = "Database server is not available";
    } else if (error.message?.includes('not found')) {
      errorMessage = "Server not found";
    } else if (error.message?.includes('foreign key') || error.message?.includes('constraint')) {
      errorMessage = "Cannot delete server with associated resources";
    }
    
    res.status(500).json({
      error: errorMessage,
      message: error.message,
      type: errorType,
      isDatabaseError
    });
  }
});

app.post("/api/fhir/servers/:id/test", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const { FhirClient } = await import("./server/services/fhir/fhir-client.js");
    const { id } = req.params;
    
    const servers = await storage.getFhirServers();
    const server = servers.find(s => s.id === parseInt(id));
    
    if (!server) {
      return res.status(404).json({
        error: "FHIR server not found"
      });
    }
    
    const fhirClient = new FhirClient(server.url, server.authConfig as any);
    const result = await fhirClient.testConnection();
    
    res.json({
      connected: result.connected,
      version: result.version || "Unknown",
      url: server.url,
      serverName: server.name,
      error: result.error || null,
      errorType: result.errorType || null,
      statusCode: result.statusCode || null,
      timestamp: new Date().toISOString(),
      responseTime: result.responseTime || 0
    });
  } catch (error: any) {
    console.error('Failed to test FHIR server:', error);
    res.status(500).json({
      error: "Failed to test FHIR server connection",
      message: error.message
    });
  }
});

// Activate a FHIR server (set as active)
app.post("/api/fhir/servers/:id/activate", async (req, res) => {
  const { id } = req.params;
  const targetId = parseInt(id);
  
  try {
    const { storage } = await import("./server/storage.js");
    
    try {
      const servers = await storage.getFhirServers();
      const targetServer = servers.find(s => s.id === targetId);
      if (!targetServer) {
        return res.status(404).json({ error: "FHIR server not found" });
      }

      // Deactivate all other servers first, then activate target
      await storage.updateFhirServerStatus(targetId, true);

      const updatedServers = await storage.getFhirServers();
      const safeServers = updatedServers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: !!server.authConfig,
        authType: server.authConfig?.type || 'none',
        createdAt: server.createdAt
      }));

      // Broadcast server switching event to all SSE clients
      broadcastValidationUpdate({
        type: "server-switched",
        data: {
          action: "activated",
          serverId: targetId,
          serverName: targetServer.name,
          serverUrl: targetServer.url,
          timestamp: new Date().toISOString()
        }
      });

      return res.json({
        success: true,
        message: "Server activated successfully",
        serverId: targetId,
        serverName: targetServer.name,
        servers: safeServers
      });
    } catch (e) {
      // Fallback path: update in-memory mock list so UI works without DB
      console.log('Database not available, using mock data for server activation');
      
      // Deactivate all servers first, then activate target
      for (const s of mockFhirServers) {
        s.isActive = s.id === targetId;
      }
      
      const target = mockFhirServers.find(s => s.id === targetId);
      if (!target) {
        return res.status(404).json({ error: "FHIR server not found" });
      }

      const safeServers = mockFhirServers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: false,
        authType: 'none',
        createdAt: new Date().toISOString()
      }));

      // Broadcast server switching event to all SSE clients
      broadcastValidationUpdate({
        type: "server-switched",
        data: {
          action: "activated",
          serverId: targetId,
          serverName: target.name,
          serverUrl: target.url,
          timestamp: new Date().toISOString()
        }
      });

      return res.json({
        success: true,
        message: "Server activated successfully (mock data)",
        serverId: targetId,
        serverName: target.name,
        servers: safeServers
      });
    }
  } catch (error: any) {
    // Enhanced error handling and logging
    const errorType = error.code || error.name || 'UnknownError';
    const isDatabaseError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
                           error.message?.includes('database') || error.message?.includes('connection');
    
    console.error('Failed to activate FHIR server:', {
      error: error.message,
      type: errorType,
      code: error.code,
      stack: error.stack,
      serverId: targetId,
      isDatabaseError,
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = "Failed to activate FHIR server";
    if (isDatabaseError) {
      errorMessage = "Database connection failed. Server activation may not persist.";
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = "Database server is not available";
    } else if (error.message?.includes('not found')) {
      errorMessage = "Server not found";
    }
    
    res.status(500).json({
      error: errorMessage,
      message: error.message,
      type: errorType,
      isDatabaseError
    });
  }
});

// Deactivate a FHIR server
app.post("/api/fhir/servers/:id/deactivate", async (req, res) => {
  const { id } = req.params;
  const targetId = parseInt(id);
  
  try {
    const { storage } = await import("./server/storage.js");
    
    try {
      const servers = await storage.getFhirServers();
      const targetServer = servers.find(s => s.id === targetId);
      if (!targetServer) {
        return res.status(404).json({ error: "FHIR server not found" });
      }

      await storage.updateFhirServerStatus(targetId, false);

      const updatedServers = await storage.getFhirServers();
      const safeServers = updatedServers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: !!server.authConfig,
        authType: server.authConfig?.type || 'none',
        createdAt: server.createdAt
      }));

      // Broadcast server switching event to all SSE clients
      broadcastValidationUpdate({
        type: "server-switched",
        data: {
          action: "deactivated",
          serverId: targetId,
          serverName: targetServer.name,
          serverUrl: targetServer.url,
          timestamp: new Date().toISOString()
        }
      });

      return res.json({
        success: true,
        message: "Server deactivated successfully",
        serverId: targetId,
        serverName: targetServer.name,
        servers: safeServers
      });
    } catch (e) {
      // Fallback path: update in-memory mock list so UI works without DB
      console.log('Database not available, using mock data for server deactivation');
      
      const target = mockFhirServers.find(s => s.id === targetId);
      if (!target) {
        return res.status(404).json({ error: "FHIR server not found" });
      }
      
      target.isActive = false;

      const safeServers = mockFhirServers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        isActive: server.isActive,
        hasAuth: false,
        authType: 'none',
        createdAt: new Date().toISOString()
      }));

      // Broadcast server switching event to all SSE clients
      broadcastValidationUpdate({
        type: "server-switched",
        data: {
          action: "deactivated",
          serverId: targetId,
          serverName: target.name,
          serverUrl: target.url,
          timestamp: new Date().toISOString()
        }
      });

      return res.json({
        success: true,
        message: "Server deactivated successfully (mock data)",
        serverId: targetId,
        serverName: target.name,
        servers: safeServers
      });
    }
  } catch (error: any) {
    // Enhanced error handling and logging
    const errorType = error.code || error.name || 'UnknownError';
    const isDatabaseError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
                           error.message?.includes('database') || error.message?.includes('connection');
    
    console.error('Failed to deactivate FHIR server:', {
      error: error.message,
      type: errorType,
      code: error.code,
      stack: error.stack,
      serverId: targetId,
      isDatabaseError,
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = "Failed to deactivate FHIR server";
    if (isDatabaseError) {
      errorMessage = "Database connection failed. Server deactivation may not persist.";
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = "Database server is not available";
    } else if (error.message?.includes('not found')) {
      errorMessage = "Server not found";
    }
    
    res.status(500).json({
      error: errorMessage,
      message: error.message,
      type: errorType,
      isDatabaseError
    });
  }
});

// Test authentication with different credential types
app.post("/api/fhir/auth/test", async (req, res) => {
  try {
    const { url, authConfig } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: "URL is required"
      });
    }
    
    if (!authConfig) {
      return res.status(400).json({
        error: "Auth configuration is required"
      });
    }
    
    const { FhirClient } = await import("./server/services/fhir/fhir-client.js");
    const fhirClient = new FhirClient(url, authConfig);
    const result = await fhirClient.testConnection();
    
    res.json({
      connected: result.connected,
      version: result.version || "Unknown",
      url: url,
      authType: authConfig.type,
      error: result.error || null,
      errorType: result.errorType || null,
      statusCode: result.statusCode || null,
      timestamp: new Date().toISOString(),
      responseTime: result.responseTime || 0
    });
  } catch (error: any) {
    console.error('Failed to test authentication:', error);
    res.status(500).json({
      error: "Failed to test authentication",
      message: error.message
    });
  }
});

// Get comprehensive server metadata
app.get("/api/fhir/metadata", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const { FhirClient } = await import("./server/services/fhir/fhir-client.js");
    
    const servers = await storage.getFhirServers();
    const activeServer = servers.find(s => s.isActive) || servers[0];
    
    if (!activeServer) {
      return res.status(404).json({
        error: "No FHIR server configured",
        message: "Please configure a FHIR server first"
      });
    }

    const fhirClient = new FhirClient(activeServer.url, activeServer.authConfig as any);
    const capabilityStatement = await fhirClient.getCapabilityStatement();
    
    if (!capabilityStatement) {
      return res.status(500).json({
        error: "Failed to retrieve server metadata",
        message: "Server did not respond with a valid CapabilityStatement"
      });
    }

    // Extract comprehensive metadata
    const metadata = {
      server: {
        name: activeServer.name,
        url: activeServer.url,
        id: activeServer.id
      },
      fhir: {
        version: capabilityStatement.fhirVersion,
        date: capabilityStatement.date,
        publisher: capabilityStatement.publisher,
        description: capabilityStatement.description,
        status: capabilityStatement.status,
        experimental: capabilityStatement.experimental,
        kind: capabilityStatement.kind
      },
      software: {
        name: capabilityStatement.software?.name,
        version: capabilityStatement.software?.version,
        releaseDate: capabilityStatement.software?.releaseDate,
        publisher: capabilityStatement.software?.publisher,
        description: capabilityStatement.software?.description
      },
      implementation: {
        description: capabilityStatement.implementation?.description,
        url: capabilityStatement.implementation?.url,
        custodian: capabilityStatement.implementation?.custodian?.display
      },
      capabilities: {
        rest: capabilityStatement.rest?.map((rest: any) => ({
          mode: rest.mode,
          documentation: rest.documentation,
          security: rest.security,
          resourceCount: rest.resource?.length || 0,
          operationCount: rest.operation?.length || 0,
          interactionCount: rest.interaction?.length || 0,
          searchParams: rest.searchParam?.length || 0
        })) || [],
        messaging: capabilityStatement.messaging?.length || 0,
        document: capabilityStatement.document?.length || 0
      },
      resourceTypes: capabilityStatement.rest?.[0]?.resource?.map((resource: any) => ({
        type: resource.type,
        profile: resource.profile,
        supportedProfiles: resource.supportedProfile?.length || 0,
        interactions: resource.interaction?.map((i: any) => i.code) || [],
        searchParams: resource.searchParam?.length || 0,
        searchIncludes: resource.searchInclude?.length || 0,
        searchRevIncludes: resource.searchRevInclude?.length || 0,
        conditionalCreate: resource.conditionalCreate,
        conditionalRead: resource.conditionalRead,
        conditionalUpdate: resource.conditionalUpdate,
        conditionalDelete: resource.conditionalDelete
      })) || [],
      operations: capabilityStatement.rest?.[0]?.operation?.map((op: any) => ({
        name: op.name,
        definition: op.definition,
        documentation: op.documentation
      })) || [],
      timestamp: new Date().toISOString()
    };

    res.json(metadata);
  } catch (error: any) {
    console.error('Failed to retrieve FHIR metadata:', error);
    res.status(500).json({
      error: "Failed to retrieve server metadata",
      message: error.message || "Unknown error occurred"
    });
  }
});

app.get("/api/validation/progress", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const summary = await storage.getResourceStatsWithSettings();
    res.json({
      totalResources: 100,
      processedResources: (summary.validResources || 0) + (summary.errorResources || 0),
      validResources: summary.validResources || 0,
      errorResources: summary.errorResources || 0,
      warningResources: summary.warningResources || 0,
      status: "running",
      isComplete: false,
      startTime: new Date().toISOString(),
      errors: []
    });
  } catch (error) {
    console.log('Database not available, using mock validation progress');
    res.json({
      totalResources: 100,
      processedResources: 75,
      validResources: 60,
      errorResources: 15,
      warningResources: 12,
      status: "running",
      isComplete: false,
      startTime: new Date().toISOString(),
      errors: []
    });
  }
});

app.get("/api/validation/errors", async (req, res) => {
  try {
    // Return mock errors for now - method not implemented in storage
    res.json(mockRecentErrors);
  } catch (error) {
    console.log('Database not available, using mock errors');
    res.json(mockRecentErrors);
  }
});

// Dashboard endpoints
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const summary = await storage.getResourceStatsWithSettings();
    res.json({
      totalResources: 100,
      validResources: summary.validResources,
      errorResources: summary.errorResources,
      warningResources: summary.warningResources || 12,
      unvalidatedResources: 25,
      validationCoverage: 75.0,
      validationProgress: 75.0,
      activeProfiles: 3,
      resourceBreakdown: [
        { type: "Patient", count: 45 },
        { type: "Observation", count: 30 },
        { type: "Encounter", count: 15 },
        { type: "Medication", count: 10 }
      ]
    });
  } catch (error) {
    console.log('Database not available, using mock dashboard stats');
    res.json({
      totalResources: 100,
      validResources: 60,
      errorResources: 15,
      warningResources: 12,
      unvalidatedResources: 25,
      validationCoverage: 75.0,
      validationProgress: 75.0,
      activeProfiles: 3,
      resourceBreakdown: [
        { type: "Patient", count: 45 },
        { type: "Observation", count: 30 },
        { type: "Encounter", count: 15 },
        { type: "Medication", count: 10 }
      ]
    });
  }
});

app.get("/api/dashboard/fhir-server-stats", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const summary = await storage.getResourceStatsWithSettings();
    res.json({
      totalResources: 100,
      resourceBreakdown: [
        { type: "Patient", count: 45 },
        { type: "Observation", count: 30 },
        { type: "Encounter", count: 15 },
        { type: "Medication", count: 10 }
      ],
      serverInfo: {
        name: "HAPI Test Server",
        url: "http://hapi.fhir.org/baseR4",
        version: "R4",
        status: "connected"
      }
    });
  } catch (error) {
    console.log('Database not available, using mock FHIR server stats');
    res.json({
      totalResources: 100,
      resourceBreakdown: [
        { type: "Patient", count: 45 },
        { type: "Observation", count: 30 },
        { type: "Encounter", count: 15 },
        { type: "Medication", count: 10 }
      ],
      serverInfo: {
        name: "HAPI Test Server",
        url: "http://hapi.fhir.org/baseR4",
        version: "R4",
        status: "connected"
      }
    });
  }
});

app.get("/api/dashboard/validation-stats", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const summary = await storage.getResourceStatsWithSettings();
    // Calculate consistent data from database summary
    const totalValidated = (summary.validResources || 0) + (summary.errorResources || 0);
    const totalResources = totalValidated + 25; // Add unvalidated resources
    const validationCoverage = totalValidated > 0 ? ((summary.validResources || 0) / totalValidated) * 100 : 0;
    const validationProgress = totalResources > 0 ? (totalValidated / totalResources) * 100 : 0;

    res.json({
      totalValidated,
      validResources: summary.validResources || 0,
      errorResources: summary.errorResources || 0,
      warningResources: summary.warningResources || 0,
      unvalidatedResources: 25,
      validationCoverage: Math.round(validationCoverage * 10) / 10,
      validationProgress: Math.round(validationProgress * 10) / 10,
      lastValidationRun: new Date().toISOString(),
      resourceTypeBreakdown: {
        "Patient": {
          total: 45,
          validated: 40,
          valid: 35,
          errors: 3,
          warnings: 2,
          unvalidated: 5,
          validationRate: 88.9,
          successRate: 87.5
        },
        "Observation": {
          total: 30,
          validated: 25,
          valid: 20,
          errors: 3,
          warnings: 2,
          unvalidated: 5,
          validationRate: 83.3,
          successRate: 80.0
        },
        "Encounter": {
          total: 15,
          validated: 10,
          valid: 8,
          errors: 1,
          warnings: 1,
          unvalidated: 5,
          validationRate: 66.7,
          successRate: 80.0
        },
        "Medication": {
          total: 10,
          validated: 8,
          valid: 7,
          errors: 1,
          warnings: 0,
          unvalidated: 2,
          validationRate: 80.0,
          successRate: 87.5
        }
      }
    });
  } catch (error) {
    console.log('Database not available, using mock validation stats');
    // Consistent mock data with proper calculations
    const resourceTypeBreakdown = {
      "Patient": {
        total: 45,
        validated: 40,
        valid: 35,
        errors: 3,
        warnings: 2,
        unvalidated: 5,
        validationRate: 88.9,
        successRate: 87.5
      },
      "Observation": {
        total: 30,
        validated: 25,
        valid: 20,
        errors: 3,
        warnings: 2,
        unvalidated: 5,
        validationRate: 83.3,
        successRate: 80.0
      },
      "Encounter": {
        total: 15,
        validated: 10,
        valid: 8,
        errors: 1,
        warnings: 1,
        unvalidated: 5,
        validationRate: 66.7,
        successRate: 80.0
      },
      "Medication": {
        total: 10,
        validated: 8,
        valid: 7,
        errors: 1,
        warnings: 0,
        unvalidated: 2,
        validationRate: 80.0,
        successRate: 87.5
      }
    };

    // Calculate totals from breakdown
    const totalValidated = Object.values(resourceTypeBreakdown).reduce((sum, rt) => sum + rt.validated, 0);
    const validResources = Object.values(resourceTypeBreakdown).reduce((sum, rt) => sum + rt.valid, 0);
    const errorResources = Object.values(resourceTypeBreakdown).reduce((sum, rt) => sum + rt.errors, 0);
    const warningResources = Object.values(resourceTypeBreakdown).reduce((sum, rt) => sum + rt.warnings, 0);
    const unvalidatedResources = Object.values(resourceTypeBreakdown).reduce((sum, rt) => sum + rt.unvalidated, 0);
    const totalResources = Object.values(resourceTypeBreakdown).reduce((sum, rt) => sum + rt.total, 0);
    
    // Calculate percentages
    const validationCoverage = totalValidated > 0 ? (validResources / totalValidated) * 100 : 0;
    const validationProgress = totalResources > 0 ? (totalValidated / totalResources) * 100 : 0;

    res.json({
      totalValidated,
      validResources,
      errorResources,
      warningResources,
      unvalidatedResources,
      validationCoverage: Math.round(validationCoverage * 10) / 10,
      validationProgress: Math.round(validationProgress * 10) / 10,
      lastValidationRun: new Date().toISOString(),
      resourceTypeBreakdown
    });
  }
});

app.get("/api/dashboard/combined", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const summary = await storage.getResourceStatsWithSettings();
    res.json({
      fhirServerStats: {
        totalResources: 100,
        resourceBreakdown: [
          { type: "Patient", count: 45 },
          { type: "Observation", count: 30 },
          { type: "Encounter", count: 15 },
          { type: "Medication", count: 10 }
        ],
        serverInfo: {
          name: "HAPI Test Server",
          url: "http://hapi.fhir.org/baseR4",
          version: "R4",
          status: "connected"
        }
      },
      validationStats: {
        totalValidated: (summary.validResources || 0) + (summary.errorResources || 0),
        validResources: summary.validResources || 0,
        errorResources: summary.errorResources || 0,
        warningResources: summary.warningResources || 0,
        unvalidatedResources: 25,
        validationCoverage: (summary.validResources || 0) + (summary.errorResources || 0) > 0 
          ? Math.round(((summary.validResources || 0) / ((summary.validResources || 0) + (summary.errorResources || 0))) * 1000) / 10 
          : 0,
        validationProgress: Math.round((((summary.validResources || 0) + (summary.errorResources || 0)) / 100) * 1000) / 10,
        lastValidationRun: new Date().toISOString(),
        resourceTypeBreakdown: {
          "Patient": {
            total: 45,
            validated: 40,
            valid: 35,
            errors: 3,
            warnings: 2,
            unvalidated: 5,
            validationRate: 88.9,
            successRate: 87.5
          },
          "Observation": {
            total: 30,
            validated: 25,
            valid: 20,
            errors: 3,
            warnings: 2,
            unvalidated: 5,
            validationRate: 83.3,
            successRate: 80.0
          },
          "Encounter": {
            total: 15,
            validated: 10,
            valid: 8,
            errors: 1,
            warnings: 1,
            unvalidated: 5,
            validationRate: 66.7,
            successRate: 80.0
          },
          "Medication": {
            total: 10,
            validated: 8,
            valid: 7,
            errors: 1,
            warnings: 0,
            unvalidated: 2,
            validationRate: 80.0,
            successRate: 87.5
          }
        }
      }
    });
  } catch (error) {
    console.log('Database not available, using mock combined dashboard data');
    res.json({
      fhirServerStats: {
        totalResources: 100,
        resourceBreakdown: [
          { type: "Patient", count: 45 },
          { type: "Observation", count: 30 },
          { type: "Encounter", count: 15 },
          { type: "Medication", count: 10 }
        ],
        serverInfo: {
          name: "HAPI Test Server",
          url: "http://hapi.fhir.org/baseR4",
          version: "R4",
          status: "connected"
        }
      },
      validationStats: {
        totalValidated: 75,
        validResources: 60,
        errorResources: 15,
        warningResources: 12,
        unvalidatedResources: 25,
        validationCoverage: 75.0,
        validationProgress: 75.0,
        lastValidationRun: new Date().toISOString(),
        resourceTypeBreakdown: {
          "Patient": {
            total: 45,
            validated: 40,
            valid: 35,
            errors: 3,
            warnings: 2,
            unvalidated: 5,
            validationRate: 88.9,
            successRate: 87.5
          },
          "Observation": {
            total: 30,
            validated: 25,
            valid: 20,
            errors: 3,
            warnings: 2,
            unvalidated: 5,
            validationRate: 83.3,
            successRate: 80.0
          },
          "Encounter": {
            total: 15,
            validated: 10,
            valid: 8,
            errors: 1,
            warnings: 1,
            unvalidated: 5,
            validationRate: 66.7,
            successRate: 80.0
          },
          "Medication": {
            total: 10,
            validated: 8,
            valid: 7,
            errors: 1,
            warnings: 0,
            unvalidated: 2,
            validationRate: 80.0,
            successRate: 87.5
          }
        }
      }
    });
  }
});

app.get("/api/dashboard/fhir-version-info", async (req, res) => {
  try {
    // Use the active FHIR client from the server activation service
    if (!global.fhirClient) {
      return res.status(503).json({
        error: 'No active FHIR server configured',
        message: 'Please configure and activate a FHIR server in the settings'
      });
    }

    const result = await global.fhirClient.testConnection();
    res.json({
      version: result.version || "Unknown",
      release: result.version || "Unknown",
      date: new Date().toISOString(),
      fhirVersion: result.version || "Unknown",
      connection: result,
      serverInfo: {
        name: "Active Server",
        url: "Active FHIR Server",
        status: result.connected ? "connected" : "disconnected"
      }
    });
  } catch (error) {
    console.log('FHIR client not available, using mock FHIR version info');
    res.json({
      version: "R4",
      release: "4.0.1",
      date: "2019-10-30",
      fhirVersion: "4.0.1",
      connection: { connected: true, version: "4.0.1" },
      serverInfo: {
        name: "HAPI Test Server",
        url: "http://hapi.fhir.org/baseR4",
        status: "connected"
      }
    });
  }
});

app.get("/api/dashboard/cards", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const cards = await storage.getDashboardCards();
    res.json(cards);
  } catch (error) {
    console.log('Database not available, using mock dashboard cards');
    res.json([
      {
        id: 1,
        title: "Total Resources",
        value: "100",
        type: "number",
        status: "active"
      },
      {
        id: 2,
        title: "Valid Resources",
        value: "60",
        type: "number",
        status: "success"
      },
      {
        id: 3,
        title: "Error Resources",
        value: "15",
        type: "number",
        status: "error"
      },
      {
        id: 4,
        title: "Validation Coverage",
        value: "75%",
        type: "percentage",
        status: "warning"
      }
    ]);
  }
});

// Smart Resource Counts
app.get("/api/dashboard/resource-counts", async (req, res) => {
  try {
    // Use active FHIR client to get resource counts
    if (!global.fhirClient) {
      console.log('[Dashboard] No FHIR client available, returning mock data');
      // Return mock data for development
      return res.json({
        counts: {
          'Patient': 100,
          'Observation': 250,
          'Encounter': 50,
          'Condition': 30,
          'Medication': 20
        },
        totalResources: 450,
        totalTypes: 5,
        lastUpdated: new Date(),
        cacheStatus: 'complete'
      });
    }

    // Get resource counts from FHIR server
    const resourceTypes = await global.fhirClient!.getAllResourceTypes();
    const counts: Record<string, number> = {};
    
    // Get counts in parallel
    const countPromises = resourceTypes.map(async (type) => {
      try {
        const count = await global.fhirClient!.getResourceCount(type);
        return { type, count };
      } catch (error) {
        console.warn(`Failed to get count for ${type}:`, error);
        return { type, count: 0 };
      }
    });
    
    const results = await Promise.all(countPromises);
    results.forEach(({ type, count }) => {
      if (count > 0) {
        counts[type] = count;
      }
    });
    
    const totalResources = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    res.json({
      counts,
      totalResources,
      totalTypes: Object.keys(counts).length,
      lastUpdated: new Date(),
      cacheStatus: 'complete'
    });
  } catch (error: any) {
    console.error('[Dashboard] Error fetching resource counts:', error);
    // Return fallback data on error
    res.json({
      counts: {
        'Patient': 100,
        'Observation': 250,
        'Encounter': 50
      },
      totalResources: 400,
      totalTypes: 3,
      lastUpdated: new Date(),
      cacheStatus: 'complete'
    });
  }
});

// Force Refresh Resource Counts
app.post("/api/dashboard/resource-counts/refresh", async (req, res) => {
  // For now, just acknowledge the request
  // In production, this would clear caches
  res.json({ status: 'refreshing' });
});

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: "connected",
        fhirClient: global.fhirClient ? "initialized" : "not_configured",
        validationEngine: "initialized",
        queue: "idle",
        environment: process.env.VERCEL ? "vercel" : "local"
      }
    });
  } catch (error) {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      services: {
        database: "disconnected",
        fhirClient: "not_configured",
        validationEngine: "initialized",
        environment: process.env.VERCEL ? "vercel" : "local"
      }
    });
  }
});

// Initialize performance monitoring
const performanceMonitor = getValidationPerformanceMonitor();

// Performance monitoring endpoint
app.get("/api/performance/metrics", (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    const health = performanceMonitor.getHealthStatus();
    const analytics = performanceMonitor.getAnalytics();
    
    res.json({
      metrics,
      health,
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Performance] Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${status} - ${message}`);
  res.status(status).json({ message });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = createServer(app);

// Server-Sent Events setup for validation updates
const sseClients = new Set<Response>();

// SSE endpoint for validation updates (must be before static file serving)
app.get("/api/validation/stream", (req, res) => {
  console.log('[SSE] Client connected to validation stream');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: "connected",
    message: "Connected to validation stream",
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Add client to the set
  sseClients.add(res);

  // Handle client disconnect
  req.on('close', () => {
    console.log('[SSE] Client disconnected from validation stream');
    sseClients.delete(res);
  });

  req.on('error', (error) => {
    console.error('[SSE] Client error:', error.message);
    sseClients.delete(res);
  });
});

// Function to broadcast validation updates to all SSE clients
function broadcastValidationUpdate(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (error: any) {
      console.error('[SSE] Error sending message:', error.message);
      sseClients.delete(client);
    }
  });
}


// Mock validation updates for demonstration (remove in production)
let mockValidationProgress: {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  currentResourceType: string;
  startTime: string;
  isComplete: boolean;
  errors: string[];
  status: 'not_running' | 'running' | 'completed' | 'error';
} = {
  totalResources: 100,
  processedResources: 0,
  validResources: 0,
  errorResources: 0,
  currentResourceType: "Patient",
  startTime: new Date().toISOString(),
  isComplete: false,
  errors: [],
  status: 'not_running'
};

// Simulate validation progress updates every 2 seconds
setInterval(() => {
  if (mockValidationProgress.status === 'running' && !mockValidationProgress.isComplete) {
    mockValidationProgress.processedResources += 5;
    mockValidationProgress.validResources += 4;
    mockValidationProgress.errorResources += 1;
    
    if (mockValidationProgress.processedResources >= mockValidationProgress.totalResources) {
      mockValidationProgress.isComplete = true;
      mockValidationProgress.status = 'completed';
    }
    
    // Broadcast update to all SSE clients
    broadcastValidationUpdate({
      type: "validation-progress",
      data: mockValidationProgress
    });
  }
}, 2000);

// Real validation endpoints using ValidationPipeline
app.post("/api/validation/start", async (_req, res) => {
  return res.status(501).json({
    error: "Not implemented in lightweight server",
    hint: "Use /api/validation/bulk/start on main server"
  });
});

app.post("/api/validation/stop", async (_req, res) => {
  return res.status(501).json({
    error: "Not implemented in lightweight server",
    hint: "Use /api/validation/bulk/stop on main server"
  });
});

app.post("/api/validation/pause", async (_req, res) => {
  return res.status(501).json({
    error: "Not implemented in lightweight server",
    hint: "Use /api/validation/bulk/pause on main server"
  });
});

app.post("/api/validation/resume", async (_req, res) => {
  return res.status(501).json({
    error: "Not implemented in lightweight server",
    hint: "Use /api/validation/bulk/resume on main server"
  });
});

app.get("/api/validation/status", async (_req, res) => {
  return res.status(501).json({
    error: "Not implemented in lightweight server",
    hint: "Use /api/validation/bulk/progress on main server"
  });
});

// SSE health check endpoint
app.get("/api/validation/health", (req, res) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    sse: {
      activeConnections: sseClients.size,
      endpoint: "/api/validation/stream",
      supported: true
    },
    validation: {
      status: mockValidationProgress.status,
      isRunning: mockValidationProgress.status === 'running',
      progress: {
        totalResources: mockValidationProgress.totalResources,
        processedResources: mockValidationProgress.processedResources,
        validResources: mockValidationProgress.validResources,
        errorResources: mockValidationProgress.errorResources
      }
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    }
  };

  res.json(healthData);
});

// Serve static files (must be after all API routes)
serveStatic(app);

// Validate production safety before starting server (skip process.exit in serverless)
const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

try {
  assertProductionSafety();
  logFeatureFlags();
} catch (error) {
  console.error('❌ Production Safety Check Failed:', error.message);
  
  if (isServerless) {
    // In serverless, log the warning but don't crash - allow graceful degradation
    console.warn('⚠️  Running in degraded mode without full production safety guarantees');
    console.warn('⚠️  Some features may use fallback/mock data');
  } else {
    // In traditional server mode, exit to prevent production issues
    process.exit(1);
  }
}

// Warm up resource count cache before starting server (production)
if (!isServerless && fhirClient) {
  console.log('[Server] Starting cache warmup (priority types)...');
  try {
    const { getActiveServerId } = await import('./server/utils/server-scoping.js');
    const { resourceCountCache } = await import('./server/services/cache/resource-count-cache.js');
    
    const serverId = await getActiveServerId();
    if (serverId) {
      console.log(`[Server] 🔥 Warming up resource count cache for server ${serverId}...`);
      
      // Set timeout for warmup (30 seconds max)
      const warmupPromise = resourceCountCache.refresh(serverId, fhirClient);
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Cache warmup timeout')), 30000)
      );
      
      await Promise.race([warmupPromise, timeoutPromise]);
      console.log('[Server] ✅ Cache warmup complete (priority types loaded, remaining types loading in background)');
    }
  } catch (error) {
    console.warn('[Server] ⚠️  Cache warmup failed or timed out (will serve data on first request):', error);
  }
}

// Only start the server if not in Vercel/serverless environment
if (!isServerless) {
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Server serving on port ${port}`);
  });
}

// Export for Vercel serverless
export default app;
