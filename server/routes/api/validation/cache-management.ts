/**
 * Cache Management API
 * 
 * Task 7.11: Add cache management API endpoints
 * 
 * Endpoints:
 * - GET /api/validation/cache/stats - Get cache statistics
 * - DELETE /api/validation/cache/clear - Clear all caches
 * - DELETE /api/validation/cache/clear/:category - Clear specific category
 * - POST /api/validation/cache/warm - Trigger cache warming
 * - POST /api/validation/cache/invalidate - Invalidate all caches
 */

import { Router } from 'express';
import { getValidationCacheManager } from '../../../services/validation/cache/validation-cache-manager.js';
import { logger } from '../../../utils/logger.js';

const router = Router();

/**
 * GET /api/validation/cache/stats
 * Get comprehensive cache statistics for all layers
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('[CacheManagement] Getting cache statistics', {
      service: 'cache-management',
      operation: 'get-stats',
      timestamp: new Date().toISOString()
    });

    const cacheManager = getValidationCacheManager();
    const stats = await cacheManager.getStats();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheManagement] Error getting cache stats:', {
      service: 'cache-management',
      operation: 'get-stats'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/validation/cache/clear
 * Clear all caches (all layers, all categories)
 */
router.delete('/clear', async (req, res) => {
  try {
    logger.info('[CacheManagement] Clearing all caches', {
      service: 'cache-management',
      operation: 'clear-all',
      timestamp: new Date().toISOString()
    });

    const cacheManager = getValidationCacheManager();
    await cacheManager.clear();

    const stats = await cacheManager.getStats();

    logger.info('[CacheManagement] All caches cleared successfully', {
      service: 'cache-management',
      operation: 'clear-all',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'All caches cleared successfully',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheManagement] Error clearing caches:', {
      service: 'cache-management',
      operation: 'clear-all'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to clear caches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/validation/cache/clear/:category
 * Clear cache for a specific category (validation, profile, terminology, igPackage)
 */
router.delete('/clear/:category', async (req, res) => {
  try {
    const { category } = req.params;

    // Validate category
    const validCategories = ['validation', 'profile', 'terminology', 'igPackage'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category',
        message: `Category must be one of: ${validCategories.join(', ')}`,
        validCategories
      });
    }

    logger.info('[CacheManagement] Clearing cache category', {
      service: 'cache-management',
      operation: 'clear-category',
      category,
      timestamp: new Date().toISOString()
    });

    const cacheManager = getValidationCacheManager();
    await cacheManager.invalidateCategory(category as any);

    const stats = await cacheManager.getStats();

    logger.info('[CacheManagement] Cache category cleared successfully', {
      service: 'cache-management',
      operation: 'clear-category',
      category,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Cache category '${category}' cleared successfully`,
      category,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheManagement] Error clearing cache category:', {
      service: 'cache-management',
      operation: 'clear-category',
      category: req.params.category
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to clear cache category',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/validation/cache/warm
 * Trigger cache warming with optional configuration
 * 
 * Body (optional):
 * {
 *   profiles?: string[],
 *   terminologySystems?: string[],
 *   categories?: ('profile' | 'terminology')[]
 * }
 */
router.post('/warm', async (req, res) => {
  try {
    const options = req.body || {};

    logger.info('[CacheManagement] Starting cache warming', {
      service: 'cache-management',
      operation: 'warm-cache',
      options,
      timestamp: new Date().toISOString()
    });

    const cacheManager = getValidationCacheManager();
    const result = await cacheManager.warmCache(options);

    logger.info('[CacheManagement] Cache warming completed', {
      service: 'cache-management',
      operation: 'warm-cache',
      profilesWarmed: result.profilesWarmed,
      terminologyWarmed: result.terminologyWarmed,
      totalWarmed: result.totalWarmed,
      errors: result.errors.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Cache warming completed',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheManagement] Error warming cache:', {
      service: 'cache-management',
      operation: 'warm-cache'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to warm cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/validation/cache/invalidate
 * Invalidate all caches (triggers cache-invalidated-all event)
 */
router.post('/invalidate', async (req, res) => {
  try {
    logger.info('[CacheManagement] Invalidating all caches', {
      service: 'cache-management',
      operation: 'invalidate-all',
      timestamp: new Date().toISOString()
    });

    const cacheManager = getValidationCacheManager();
    await cacheManager.invalidateAll();

    const stats = await cacheManager.getStats();

    logger.info('[CacheManagement] All caches invalidated successfully', {
      service: 'cache-management',
      operation: 'invalidate-all',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'All caches invalidated successfully',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheManagement] Error invalidating caches:', {
      service: 'cache-management',
      operation: 'invalidate-all'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to invalidate caches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/validation/cache/config
 * Get current cache configuration
 */
router.get('/config', async (req, res) => {
  try {
    logger.info('[CacheManagement] Getting cache configuration', {
      service: 'cache-management',
      operation: 'get-config',
      timestamp: new Date().toISOString()
    });

    const cacheManager = getValidationCacheManager();
    const config = cacheManager.getConfig();

    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheManagement] Error getting cache config:', {
      service: 'cache-management',
      operation: 'get-config'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to get cache configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/validation/cache/config
 * Update cache configuration
 * 
 * Body:
 * {
 *   layers?: { L1?: 'enabled' | 'disabled', L2?: 'enabled' | 'disabled', L3?: 'enabled' | 'disabled' },
 *   l1MaxSizeMb?: number,
 *   l2MaxSizeGb?: number,
 *   l3MaxSizeGb?: number,
 *   ttl?: {
 *     validation?: number,
 *     profile?: number,
 *     terminology?: number,
 *     igPackage?: number,
 *     default?: number
 *   }
 * }
 */
router.put('/config', async (req, res) => {
  try {
    const updates = req.body;

    logger.info('[CacheManagement] Updating cache configuration', {
      service: 'cache-management',
      operation: 'update-config',
      updates,
      timestamp: new Date().toISOString()
    });

    const cacheManager = getValidationCacheManager();
    await cacheManager.updateConfig(updates);

    const config = cacheManager.getConfig();

    logger.info('[CacheManagement] Cache configuration updated successfully', {
      service: 'cache-management',
      operation: 'update-config',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Cache configuration updated successfully',
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[CacheManagement] Error updating cache config:', {
      service: 'cache-management',
      operation: 'update-config'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to update cache configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


