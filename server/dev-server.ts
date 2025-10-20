import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { setupAllRoutes } from "./routes/index.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from public directory
app.use(express.static('server/public'));

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

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize services properly
  const { setupRoutes } = await import('./routes.js');
  await setupRoutes(app);

  // Warm up resource count cache for active server in background
  console.log('[Server] Starting cache warmup...');
  setTimeout(async () => {
    try {
      const { getActiveServerId } = await import('./utils/server-scoping.js');
      const { resourceCountCache } = await import('./services/cache/resource-count-cache.js');
      
      const serverId = await getActiveServerId();
      if (serverId && global.fhirClient) {
        console.log(`[Server] 🔥 Warming up resource count cache for server ${serverId}...`);
        await resourceCountCache.refresh(serverId, global.fhirClient);
        console.log('[Server] ✅ Cache warmup complete!');
      } else {
        console.log('[Server] ⚠️  No active server or FHIR client - skipping cache warmup');
      }
    } catch (error) {
      console.warn('[Server] ⚠️  Cache warmup failed (will retry on first request):', error);
    }
  }, 2000); // Wait 2 seconds after server start before warming cache

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // In development, Vite handles static files and client-side routing
  // Only serve API routes from Express

  // Default backend API to 3000 so Vite proxy and docs stay in sync
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Development server serving on port ${port} (Replit-compatible)`);
  });
})();
