import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { setupAllRoutes } from "./routes/index.js";

const app = express();
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

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize services properly
  const { setupRoutes } = await import('./routes.js');
  await setupRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static files from dist/public in development
  app.use(express.static('dist/public'));

  // Fall through to index.html for client-side routing (SPA)
  app.use("*", (_req, res) => {
    res.sendFile('dist/public/index.html', { root: process.cwd() });
  });

  // Default backend API to 3000 so Vite proxy and docs stay in sync
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Development server serving on port ${port} (Replit-compatible)`);
  });
})();
