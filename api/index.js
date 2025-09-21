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
