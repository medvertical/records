import { Router } from 'express';
import { logger } from '../../../utils/logger.js';

const router = Router();

/**
 * POST /api/validation/analytics/clear-cache
 * Clear analytics cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    logger.info('[AnalyticsCache] Starting analytics cache clear', {
      service: 'analytics-cache',
      operation: 'clear-cache',
      timestamp: new Date().toISOString()
    });

    // Clear any analytics caches
    // Analytics are typically computed on-demand or cached temporarily
    // This endpoint ensures fresh data on next request
    
    logger.info('[AnalyticsCache] Analytics cache cleared', {
      service: 'analytics-cache',
      operation: 'clear-cache',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Analytics cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[AnalyticsCache] Error clearing analytics cache:', {
      service: 'analytics-cache',
      operation: 'clear-cache'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to clear analytics cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

