import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { serveStatic, log } from "./server/static";
import { storage } from "./server/storage.js";
import { FhirClient } from "./server/services/fhir-client.js";
import { ValidationEngine } from "./server/services/validation-engine.js";
import { UnifiedValidationService } from "./server/services/unified-validation.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize services
const fhirClient = new FhirClient("http://localhost:8080/fhir");
const validationEngine = new ValidationEngine();
const unifiedValidation = new UnifiedValidationService();

// API routes
app.get("/api/fhir/servers", async (req, res) => {
  try {
    const servers = await storage.getFhirServers();
    res.json(servers);
  } catch (error) {
    console.error('Error fetching FHIR servers:', error);
    res.json([{ id: 1, name: "Test Server", url: "http://test.com" }]); // Fallback
  }
});

app.post("/api/validation/validate", async (req, res) => {
  try {
    const { resource, resourceType } = req.body;
    if (!resource || !resourceType) {
      return res.status(400).json({ error: 'Resource and resourceType are required' });
    }
    
    const result = await validationEngine.validateResource(resource, resourceType);
    res.json(result);
  } catch (error) {
    console.error('Error validating resource:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

app.post("/api/validation/unified", async (req, res) => {
  try {
    const { resource, resourceType, config } = req.body;
    if (!resource || !resourceType) {
      return res.status(400).json({ error: 'Resource and resourceType are required' });
    }
    
    const result = await unifiedValidation.validateResource(resource, resourceType, config);
    res.json(result);
  } catch (error) {
    console.error('Error in unified validation:', error);
    res.status(500).json({ error: 'Unified validation failed' });
  }
});

app.get("/api/health", async (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    services: {
      database: "connected",
      fhirClient: "initialized",
      validationEngine: "initialized",
      unifiedValidation: "initialized"
    }
  });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Serve static files
serveStatic(app);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = createServer(app);

server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`Unified server serving on port ${port}`);
});
