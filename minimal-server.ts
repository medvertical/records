import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { serveStatic, log } from "./server/static";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple API routes
app.get("/api/fhir/servers", async (req, res) => {
  res.json([{ id: 1, name: "Test Server", url: "http://test.com" }]);
});

app.get("/api/health", async (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
  log(`Minimal server serving on port ${port}`);
});
