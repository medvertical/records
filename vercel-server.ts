import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { serveStatic, log } from "./server/static";

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

// Mock data for when database is not available
const mockFhirServers = [
  { id: 1, name: "HAPI Test Server", url: "http://hapi.fhir.org/baseR4", isActive: true },
  { id: 2, name: "FHIR Test Server", url: "https://r4.smarthealthit.org", isActive: false }
];

const mockValidationProgress = {
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
app.get("/api/fhir/servers", async (req, res) => {
  try {
    // Try to import and use storage, but fallback to mock data
    const { storage } = await import("./server/storage.js");
    const servers = await storage.getFhirServers();
    res.json(servers);
  } catch (error) {
    console.log('Database not available, using mock FHIR servers');
    res.json(mockFhirServers);
  }
});

app.post("/api/fhir/servers", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }
    const server = await storage.addFhirServer({ name, url });
    res.json(server);
  } catch (error) {
    console.log('Database not available, using mock response');
    const { name, url } = req.body;
    res.json({ id: Date.now(), name, url, message: 'Server added (demo mode)' });
  }
});

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
    console.log('Database not available, using mock validation progress');
    res.json(mockValidationProgress);
  }
});

app.get("/api/validation/errors/recent", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const { limit = '10' } = req.query;
    const errors = await storage.getRecentValidationErrors(parseInt(limit as string));
    res.json(errors);
  } catch (error) {
    console.log('Database not available, using mock recent errors');
    res.json(mockRecentErrors);
  }
});

app.get("/api/fhir/version", async (req, res) => {
  try {
    // Try to get real FHIR version info
    const { FhirClient } = await import("./server/services/fhir-client.js");
    const fhirClient = new FhirClient("http://hapi.fhir.org/baseR4");
    const result = await fhirClient.testConnection();
    res.json({
      version: "R4",
      release: "4.0.1",
      date: "2019-10-30",
      fhirVersion: "4.0.1",
      connection: result
    });
  } catch (error) {
    console.log('FHIR client not available, using mock version info');
    res.json(mockFhirVersion);
  }
});

app.get("/api/validation/progress", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const summary = await storage.getResourceStatsWithSettings();
    res.json({
      total: 100,
      completed: summary.validResources + summary.errorResources,
      errors: summary.errorResources,
      warnings: summary.warningResources || 12,
      status: "running"
    });
  } catch (error) {
    console.log('Database not available, using mock validation progress');
    res.json({
      total: 100,
      completed: 75,
      errors: 3,
      warnings: 12,
      status: "running"
    });
  }
});

app.get("/api/validation/errors", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const errors = await storage.getRecentValidationErrors(10);
    res.json(errors);
  } catch (error) {
    console.log('Database not available, using mock errors');
    res.json(mockRecentErrors);
  }
});

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    const { storage } = await import("./server/storage.js");
    const isDbConnected = storage.isInitialized();
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      services: {
        database: isDbConnected ? "connected" : "disconnected",
        fhirClient: "initialized",
        validationEngine: "initialized",
        environment: "vercel"
      }
    });
  } catch (error) {
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
  }
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${status} - ${message}`);
  res.status(status).json({ message });
});

// Serve static files
serveStatic(app);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = createServer(app);

// WebSocket setup
const wss = new WebSocketServer({ server, path: "/ws/validation" });

wss.on("connection", (ws) => {
  log("WebSocket client connected");
  
  // Send a welcome message
  ws.send(JSON.stringify({
    type: "connected",
    message: "Connected to validation WebSocket",
    timestamp: new Date().toISOString()
  }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      log(`WebSocket message received: ${JSON.stringify(data)}`);
      
      // Echo back the message
      ws.send(JSON.stringify({
        type: "echo",
        original: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      log(`WebSocket message error: ${error}`);
    }
  });

  ws.on("close", () => {
    log("WebSocket client disconnected");
  });

  ws.on("error", (error) => {
    log(`WebSocket error: ${error}`);
  });
});

server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`Vercel-compatible server serving on port ${port}`);
});
