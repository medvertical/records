import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { serveStatic, log } from "./server/static";
import { storage } from "./server/storage.js";
import { FhirClient } from "./server/services/fhir-client.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize services
const fhirClient = new FhirClient("http://localhost:8080/fhir");

// API routes
app.get("/api/fhir/servers", async (req, res) => {
  try {
    const servers = await storage.getFhirServers();
    res.json(servers);
  } catch (error) {
    console.error('Error fetching FHIR servers:', error);
    res.status(500).json({ error: 'Failed to fetch FHIR servers' });
  }
});

app.post("/api/fhir/servers", async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }
    
    const server = await storage.addFhirServer({ name, url });
    res.json(server);
  } catch (error) {
    console.error('Error adding FHIR server:', error);
    res.status(500).json({ error: 'Failed to add FHIR server' });
  }
});

app.get("/api/health", async (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    services: {
      database: "connected",
      fhirClient: "initialized"
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
  log(`Enhanced server serving on port ${port}`);
});
