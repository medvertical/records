import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { setupRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { setupSecurityMiddleware, corsConfig } from "./middleware/security-config";
import logger from "./utils/logger";

const app = express();

// Apply security middleware (Helmet, CORS, Rate Limiting)
setupSecurityMiddleware(app);
app.use(cors(corsConfig));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await setupRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error with context
    logger.error(`[Error] ${req.method} ${req.path} - ${status}: ${message}`, {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    res.status(status).json({ message });
    throw err;
  });

  // In production, serve static files
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  }

  // Serve the app on port 3000 for local development
  // this serves both the API and the client.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    logger.info(`[Server] Application started successfully on port ${port}`);
    logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[Server] Node version: ${process.version}`);
  });
})();
