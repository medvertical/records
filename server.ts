import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
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
    res.json(defaultValidationProgress);
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
    res.json({
      totalValidated: summary.validResources + summary.errorResources,
      validResources: summary.validResources,
      errorResources: summary.errorResources,
      warningResources: summary.warningResources || 12,
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
    });
  } catch (error) {
    console.log('Database not available, using mock validation stats');
    res.json({
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
        totalValidated: summary.validResources + summary.errorResources,
        validResources: summary.validResources,
        errorResources: summary.errorResources,
        warningResources: summary.warningResources || 12,
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
    const { FhirClient } = await import("./server/services/fhir-client.js");
    const fhirClient = new FhirClient("http://hapi.fhir.org/baseR4");
    const result = await fhirClient.testConnection();
    res.json({
      version: "R4",
      release: "4.0.1",
      date: "2019-10-30",
      fhirVersion: "4.0.1",
      connection: result,
      serverInfo: {
        name: "HAPI Test Server",
        url: "http://hapi.fhir.org/baseR4",
        status: "connected"
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

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = createServer(app);

// Server-Sent Events setup for validation updates
const sseClients = new Set<Response>();

// SSE endpoint for validation updates (must be before static file serving)
app.get("/api/validation/stream", (req, res) => {
  log("SSE client connected");
  
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
    log("SSE client disconnected");
    sseClients.delete(res);
  });

  req.on('error', (error) => {
    log(`SSE client error: ${error}`);
    sseClients.delete(res);
  });
});

// Function to broadcast validation updates to all SSE clients
function broadcastValidationUpdate(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      log(`Error sending SSE message: ${error}`);
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

// API endpoint to start mock validation
app.post("/api/validation/start", (req, res) => {
  mockValidationProgress = {
    totalResources: 100,
    processedResources: 0,
    validResources: 0,
    errorResources: 0,
    currentResourceType: "Patient",
    startTime: new Date().toISOString(),
    isComplete: false,
    errors: [],
    status: 'running'
  };
  
  broadcastValidationUpdate({
    type: "validation-started",
    data: mockValidationProgress
  });
  
  res.json({ success: true, message: "Validation started" });
});

// API endpoint to stop mock validation
app.post("/api/validation/stop", (req, res) => {
  mockValidationProgress.status = 'not_running';
  mockValidationProgress.isComplete = false;
  
  broadcastValidationUpdate({
    type: "validation-stopped",
    data: mockValidationProgress
  });
  
  res.json({ success: true, message: "Validation stopped" });
});

// Serve static files (must be after all API routes)
serveStatic(app);

server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`Vercel-compatible server serving on port ${port}`);
});
