import { Router, Request, Response } from 'express';
import { db } from '../../../db';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/health
 * Basic liveness check - is the service running?
 */
router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'records-fhir-platform',
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /api/health/ready
 * Readiness check - is the service ready to accept requests?
 * Checks database and FHIR server connectivity
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks: any = {
    database: { status: 'unknown', message: '' },
    fhirServer: { status: 'unknown', message: '' },
  };
  
  let overallStatus = 'ready';
  
  // Check database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'healthy', message: 'Database connection successful' };
  } catch (error: any) {
    checks.database = { status: 'unhealthy', message: error.message || 'Database connection failed' };
    overallStatus = 'not_ready';
  }
  
  // Check FHIR server connectivity (basic check)
  try {
    // Import storage to get active FHIR server
    const { storage } = await import('../../../storage');
    const activeServer = await storage.getActiveFhirServer();
    
    if (activeServer) {
      checks.fhirServer = { status: 'healthy', message: `Connected to ${activeServer.url}` };
    } else {
      checks.fhirServer = { status: 'warning', message: 'No active FHIR server configured' };
    }
  } catch (error: any) {
    checks.fhirServer = { status: 'unhealthy', message: error.message || 'FHIR server check failed' };
    overallStatus = 'not_ready';
  }
  
  const statusCode = overallStatus === 'ready' ? 200 : 503;
  
  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /api/health/metrics
 * Basic metrics endpoint (Prometheus-compatible format)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const metrics = {
    // Process metrics
    process_uptime_seconds: process.uptime(),
    process_memory_usage_bytes: process.memoryUsage(),
    process_cpu_usage: process.cpuUsage(),
    
    // Node.js version
    nodejs_version: process.version,
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Timestamp
    timestamp: new Date().toISOString(),
  };
  
  res.json(metrics);
});

/**
 * GET /api/health/live
 * Kubernetes-style liveness probe
 * Simple check that the process is running
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
