import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Simple logging function
function log(message, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Mock data for when database is not available
const mockFhirServers = [
  { id: 1, name: "HAPI Test Server", url: "http://hapi.fhir.org/baseR4", isActive: true },
  { id: 2, name: "FHIR Test Server", url: "https://r4.smarthealthit.org", isActive: false }
];

// Basic API routes with fallbacks for Vercel deployment
app.get("/api/health", async (req, res) => {
  try {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      services: {
        database: "disconnected",
        fhirClient: "initialized",
        validationEngine: "initialized",
        environment: "vercel"
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/api/fhir/servers", async (req, res) => {
  try {
    res.json(mockFhirServers.map(server => ({
      id: server.id,
      name: server.name,
      url: server.url,
      isActive: server.isActive,
      hasAuth: false,
      authType: 'none',
      createdAt: new Date().toISOString()
    })));
  } catch (error) {
    res.status(500).json({
      error: "Failed to get FHIR servers",
      message: error.message
    });
  }
});

app.get("/api/dashboard/stats", async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({
      error: "Failed to get dashboard stats",
      message: error.message
    });
  }
});

// Validation settings endpoints
app.get("/api/validation/settings", async (req, res) => {
  try {
    res.json({
      id: 1,
      name: "Default Settings",
      isActive: true,
      settings: {
        structural: { enabled: true, severity: "error" },
        profile: { enabled: true, severity: "error" },
        terminology: { enabled: true, severity: "warning" },
        reference: { enabled: true, severity: "error" },
        businessRule: { enabled: true, severity: "warning" },
        metadata: { enabled: true, severity: "info" }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get validation settings",
      message: error.message
    });
  }
});

// Validation progress endpoints
app.get("/api/validation/progress", async (req, res) => {
  try {
    res.json({
      isRunning: false,
      progress: 0,
      totalResources: 100,
      processedResources: 0,
      errors: 0,
      warnings: 0,
      startTime: null,
      endTime: null,
      currentResource: null,
      status: "idle"
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get validation progress",
      message: error.message
    });
  }
});

// Recent errors endpoint
app.get("/api/validation/recent-errors", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get recent errors",
      message: error.message
    });
  }
});

// FHIR server connection endpoints
app.post("/api/fhir/servers/connect", async (req, res) => {
  try {
    const { serverId } = req.body;
    res.json({
      success: true,
      message: "Server connected successfully",
      serverId: serverId || 1,
      connectedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to connect to server",
      message: error.message
    });
  }
});

app.post("/api/fhir/servers/disconnect", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Server disconnected successfully",
      disconnectedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to disconnect server",
      message: error.message
    });
  }
});

// Dashboard specific endpoints
app.get("/api/dashboard/fhir-server-stats", async (req, res) => {
  try {
    res.json({
      totalResources: 100,
      connectedServers: 1,
      activeServers: 1,
      totalCapacity: 1000,
      usedCapacity: 100,
      averageResponseTime: 150.0,
      uptime: 99.9,
      lastConnected: new Date().toISOString(),
      serverBreakdown: [
        { 
          serverId: 1, 
          name: "HAPI Test Server", 
          resourceCount: 100, 
          status: "connected",
          responseTime: 150.0,
          uptime: 99.9,
          lastConnected: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get FHIR server stats",
      message: error.message
    });
  }
});

app.get("/api/dashboard/validation-stats", async (req, res) => {
  try {
    res.json({
      totalResources: 100,
      validResources: 60,
      errorResources: 15,
      warningResources: 12,
      unvalidatedResources: 25,
      validationCoverage: 75.0,
      validationProgress: 75.0,
      activeProfiles: 3,
      successRate: 85.0,
      averageValidationTime: 2.5,
      lastValidationTime: new Date().toISOString(),
      aspectBreakdown: {
        structural: { total: 100, errors: 5, warnings: 10, info: 15, score: 85.0 },
        profile: { total: 100, errors: 8, warnings: 12, info: 20, score: 80.0 },
        terminology: { total: 100, errors: 2, warnings: 8, info: 5, score: 95.0 },
        reference: { total: 100, errors: 0, warnings: 3, info: 2, score: 97.0 },
        businessRule: { total: 100, errors: 0, warnings: 2, info: 1, score: 98.0 },
        metadata: { total: 100, errors: 0, warnings: 1, info: 0, score: 99.0 }
      },
      resourceBreakdown: [
        { type: "Patient", count: 45, valid: 40, errors: 3, warnings: 2 },
        { type: "Observation", count: 30, valid: 25, errors: 2, warnings: 3 },
        { type: "Encounter", count: 15, valid: 12, errors: 1, warnings: 2 },
        { type: "Medication", count: 10, valid: 8, errors: 1, warnings: 1 }
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get validation stats",
      message: error.message
    });
  }
});

app.get("/api/dashboard/combined", async (req, res) => {
  try {
    res.json({
      fhirServerStats: {
        totalResources: 100,
        connectedServers: 1,
        activeServers: 1,
        totalCapacity: 1000,
        usedCapacity: 100,
        averageResponseTime: 150.0,
        uptime: 99.9,
        lastConnected: new Date().toISOString()
      },
      validationStats: {
        totalResources: 100,
        validResources: 60,
        errorResources: 15,
        warningResources: 12,
        unvalidatedResources: 25,
        validationCoverage: 75.0,
        validationProgress: 75.0,
        activeProfiles: 3,
        successRate: 85.0,
        averageValidationTime: 2.5,
        lastValidationTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get combined dashboard data",
      message: error.message
    });
  }
});

// FHIR resource counts endpoint
app.get("/api/fhir/resource-counts", async (req, res) => {
  try {
    res.json({
      Patient: 45,
      Observation: 30,
      Encounter: 15,
      Medication: 10
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get resource counts",
      message: error.message
    });
  }
});

// FHIR connection test endpoint
app.get("/api/fhir/connection/test", async (req, res) => {
  try {
    res.json({
      connected: true,
      serverId: 1,
      serverName: "HAPI Test Server",
      lastTested: new Date().toISOString(),
      responseTime: 150
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to test FHIR connection",
      message: error.message
    });
  }
});

// Validation bulk progress endpoint
app.get("/api/validation/bulk/progress", async (req, res) => {
  try {
    res.json({
      isRunning: false,
      progress: 0,
      totalResources: 100,
      processedResources: 0,
      errors: 0,
      warnings: 0,
      startTime: null,
      endTime: null,
      currentResource: null,
      status: "idle"
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get bulk validation progress",
      message: error.message
    });
  }
});

// Validation errors recent endpoint
app.get("/api/validation/errors/recent", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get recent validation errors",
      message: error.message
    });
  }
});

// Validation settings notify change endpoint
app.post("/api/validation/settings/notify-change", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Settings change notification sent",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to notify settings change",
      message: error.message
    });
  }
});

// Validation queue endpoints
app.get("/api/validation/queue/stats", async (req, res) => {
  try {
    res.json({
      totalItems: 0,
      pendingItems: 0,
      processingItems: 0,
      completedItems: 0,
      failedItems: 0,
      averageProcessingTime: 0,
      queueHealth: "healthy"
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get queue stats",
      message: error.message
    });
  }
});

app.get("/api/validation/queue/items", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get queue items",
      message: error.message
    });
  }
});

app.get("/api/validation/queue/processing", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get processing items",
      message: error.message
    });
  }
});

// Individual resource progress endpoints
app.get("/api/validation/progress/individual/stats", async (req, res) => {
  try {
    res.json({
      totalTracked: 0,
      activeTracked: 0,
      completedTracked: 0,
      failedTracked: 0,
      averageProcessingTime: 0,
      successRate: 100
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get individual progress stats",
      message: error.message
    });
  }
});

app.get("/api/validation/progress/individual/active", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get active individual progress",
      message: error.message
    });
  }
});

app.get("/api/validation/progress/individual/completed", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get completed individual progress",
      message: error.message
    });
  }
});

// Validation cancellation retry endpoints
app.get("/api/validation/cancellation-retry/stats", async (req, res) => {
  try {
    res.json({
      totalCancellations: 0,
      totalRetries: 0,
      activeCancellations: 0,
      activeRetries: 0,
      successRate: 100,
      averageCancellationTime: 0,
      averageRetryTime: 0
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get cancellation retry stats",
      message: error.message
    });
  }
});

app.get("/api/validation/cancellation-retry/active", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get active cancellation retry operations",
      message: error.message
    });
  }
});

// API route handler - catch all API routes and return 404 if not found
app.use("/api/*", (req, res) => {
  log(`API route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "API endpoint not found",
    message: `No handler for ${req.method} ${req.path}`,
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${status} - ${message}`);
  res.status(status).json({ message });
});

// Serve static files (must be last)
const distPath = path.resolve(__dirname, "../dist/public");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // fall through to index.html if the file doesn't exist (for SPA routing)
  app.use("*", (req, res) => {
    log(`Serving index.html for: ${req.path}`);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
} else {
  // Fallback if static files don't exist
  app.use("*", (req, res) => {
    log(`Static files not found for: ${req.path}`);
    res.status(404).json({
      error: "Static files not found",
      message: "Please ensure the frontend is built before deployment"
    });
  });
}

// Export for Vercel
export default app;
