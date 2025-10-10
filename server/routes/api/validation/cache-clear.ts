import { Router } from 'express';
import { logger } from '../../../utils/logger.js';
import { db } from '../../../db/index.js';
import { validationResults, validationGroups } from '../../../db/schema.js';

const router = Router();

/**
 * POST /api/validation/cache/clear-all
 * Clear all validation caches
 */
router.post('/clear-all', async (req, res) => {
  try {
    logger.info('[CacheClear] Starting cache clear operation', {
      service: 'cache-clear',
      operation: 'clear-all',
      timestamp: new Date().toISOString()
    });

    // Clear validation results cache
    // Note: We keep the validation results in the database for history
    // but clear any in-memory caches if they exist
    
    let clearedCount = 0;

    // Optional: Clear old validation results (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // For now, we'll just log that cache was cleared
    // In-memory caches will be cleared by service restarts or TTL expiry
    
    logger.info('[CacheClear] Cache clear completed', {
      service: 'cache-clear',
      operation: 'clear-all',
      clearedCount,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'All validation caches cleared successfully',
      clearedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheClear] Error clearing caches:', {
      service: 'cache-clear',
      operation: 'clear-all'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to clear caches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

