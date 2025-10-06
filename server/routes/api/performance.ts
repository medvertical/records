import { Router } from "express";
import { getValidationPerformanceMonitor } from "../../services/performance/validation-performance-monitor";

export const performanceRoutes = Router();

// Get performance metrics
performanceRoutes.get("/metrics", (req, res) => {
  try {
    const performanceMonitor = getValidationPerformanceMonitor();
    const metrics = performanceMonitor.getMetrics();
    const health = performanceMonitor.getHealthStatus();
    const analytics = performanceMonitor.getAnalytics();

    res.json({
      metrics,
      health,
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Performance] Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear performance metrics
performanceRoutes.delete("/metrics", (req, res) => {
  try {
    const performanceMonitor = getValidationPerformanceMonitor();
    performanceMonitor.clearMetrics();

    res.json({
      message: 'Performance metrics cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Performance] Error clearing metrics:', error);
    res.status(500).json({
      error: 'Failed to clear performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get health status
performanceRoutes.get("/health", (req, res) => {
  try {
    const performanceMonitor = getValidationPerformanceMonitor();
    const health = performanceMonitor.getHealthStatus();

    res.json({
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Performance] Error getting health status:', error);
    res.status(500).json({
      error: 'Failed to get health status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analytics
performanceRoutes.get("/analytics", (req, res) => {
  try {
    const performanceMonitor = getValidationPerformanceMonitor();
    const analytics = performanceMonitor.getAnalytics();

    res.json({
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Performance] Error getting analytics:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export function setupPerformanceRoutes(app: any) {
  app.use('/api/performance', performanceRoutes);
}
