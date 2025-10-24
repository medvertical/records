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

  // Note: Cache warmup removed - we now fetch resource counts on-demand without caching

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
    
    // Pre-warm HAPI validation pool in background
    // This improves first validation time from 18-42s to 6-8s
    import('./services/validation/engine/hapi-process-pool.js').then(({ getHapiProcessPool }) => {
      const pool = getHapiProcessPool();
      console.log('[Server] Initializing HAPI validation pool...');
      
      pool.preWarmProcesses()
        .then(() => {
          console.log('[Server] HAPI validation pool ready');
        })
        .catch(err => {
          console.error('[Server] Failed to pre-warm HAPI pool:', err);
          console.error('[Server] First validations may be slower until pool warms up');
        });
    }).catch(err => {
      console.error('[Server] Failed to import HAPI pool:', err);
    });
  });
})();
