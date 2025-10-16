/**
 * Performance Baseline API Routes
 * Task 10.2: API endpoints for baseline metrics
 */

import express from 'express';
import { performanceBaselineTracker } from '../services/performance/performance-baseline';
import { globalTimingAggregator } from '../services/validation/utils/validation-timing'; // Task 10.4
import { hapiValidatorClient } from '../services/validation/engine/hapi-validator-client'; // Task 10.6
import { getBatchValidator } from '../services/validation/terminology/batch-validator'; // Task 10.7
import { getTerminologyCache } from '../services/validation/terminology/terminology-cache'; // Task 10.7
import { getProfilePreloader } from '../services/validation/profiles/profile-preloader'; // Task 10.8
import { getBatchedReferenceChecker } from '../services/validation/utils/batched-reference-checker'; // Task 10.9
import { getValidationEngine } from '../services/validation/core/validation-engine'; // Task 10.10

const router = express.Router();

/**
 * GET /api/performance/baseline/current
 * Get current performance baseline
 */
router.get('/baseline/current', (req, res) => {
  try {
    const baseline = performanceBaselineTracker.getCurrentBaseline();

    if (!baseline) {
      return res.status(404).json({
        error: 'No baseline available',
        message: 'No performance measurements have been recorded yet',
      });
    }

    res.json(baseline);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching current baseline:', error);
    res.status(500).json({
      error: 'Failed to fetch baseline',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/baseline/history
 * Get all baseline measurements
 */
router.get('/baseline/history', (req, res) => {
  try {
    const baselines = performanceBaselineTracker.getAllBaselines();

    res.json({
      count: baselines.length,
      baselines,
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching baseline history:', error);
    res.status(500).json({
      error: 'Failed to fetch baseline history',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/baseline/summary
 * Get performance summary with trends
 */
router.get('/baseline/summary', (req, res) => {
  try {
    const summary = performanceBaselineTracker.getSummary();

    res.json(summary);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching summary:', error);
    res.status(500).json({
      error: 'Failed to fetch summary',
      message: error.message,
    });
  }
});

/**
 * POST /api/performance/baseline/generate
 * Generate new baseline from current measurements
 */
router.post('/baseline/generate', (req, res) => {
  try {
    const baseline = performanceBaselineTracker.generateBaseline();

    res.json({
      success: true,
      baseline,
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error generating baseline:', error);
    res.status(500).json({
      error: 'Failed to generate baseline',
      message: error.message,
    });
  }
});

/**
 * POST /api/performance/baseline/record
 * Record a performance measurement
 */
router.post('/baseline/record', (req, res) => {
  try {
    const { resourceType, aspect, timeMs, cacheHit } = req.body;

    if (!resourceType || !aspect || timeMs === undefined) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'resourceType, aspect, and timeMs are required',
      });
    }

    performanceBaselineTracker.recordValidationTime(
      resourceType,
      aspect,
      timeMs,
      cacheHit
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error recording measurement:', error);
    res.status(500).json({
      error: 'Failed to record measurement',
      message: error.message,
    });
  }
});

/**
 * POST /api/performance/baseline/reset
 * Reset current measurements
 */
router.post('/baseline/reset', (req, res) => {
  try {
    performanceBaselineTracker.resetCurrentMeasurements();

    res.json({
      success: true,
      message: 'Current measurements reset',
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error resetting measurements:', error);
    res.status(500).json({
      error: 'Failed to reset measurements',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/baseline/export
 * Export baselines as JSON
 */
router.get('/baseline/export', (req, res) => {
  try {
    const jsonData = performanceBaselineTracker.exportBaselines();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="performance-baselines-${new Date().toISOString().split('T')[0]}.json"`
    );

    res.send(jsonData);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error exporting baselines:', error);
    res.status(500).json({
      error: 'Failed to export baselines',
      message: error.message,
    });
  }
});

/**
 * POST /api/performance/baseline/import
 * Import baselines from JSON
 */
router.post('/baseline/import', (req, res) => {
  try {
    const jsonData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    performanceBaselineTracker.importBaselines(jsonData);

    res.json({
      success: true,
      message: 'Baselines imported successfully',
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error importing baselines:', error);
    res.status(400).json({
      error: 'Failed to import baselines',
      message: error.message,
    });
  }
});

// ============================================================================
// Task 10.4: Detailed Timing Breakdown API
// ============================================================================

/**
 * GET /api/performance/timing/stats
 * Get aggregated timing statistics
 */
router.get('/timing/stats', (req, res) => {
  try {
    const stats = globalTimingAggregator.getStats();

    res.json(stats);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching timing stats:', error);
    res.status(500).json({
      error: 'Failed to fetch timing stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/timing/breakdowns
 * Get all timing breakdowns
 */
router.get('/timing/breakdowns', (req, res) => {
  try {
    const { limit = 100, resourceType, aspect } = req.query;
    
    let breakdowns = globalTimingAggregator.getAll();

    // Filter by resource type if provided
    if (resourceType && typeof resourceType === 'string') {
      breakdowns = breakdowns.filter((b) => b.resourceType === resourceType);
    }

    // Filter by aspect if provided
    if (aspect && typeof aspect === 'string') {
      breakdowns = breakdowns.filter((b) => b.aspect === aspect);
    }

    // Limit results
    const limitNum = parseInt(limit as string, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      breakdowns = breakdowns.slice(-limitNum); // Get most recent
    }

    res.json({
      count: breakdowns.length,
      breakdowns,
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching timing breakdowns:', error);
    res.status(500).json({
      error: 'Failed to fetch timing breakdowns',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/performance/timing/clear
 * Clear all timing data
 */
router.delete('/timing/clear', (req, res) => {
  try {
    globalTimingAggregator.clear();

    res.json({
      success: true,
      message: 'Timing data cleared successfully',
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error clearing timing data:', error);
    res.status(500).json({
      error: 'Failed to clear timing data',
      message: error.message,
    });
  }
});

// ============================================================================
// Task 10.6: HAPI Process Pool API
// ============================================================================

/**
 * GET /api/performance/pool/stats
 * Get HAPI process pool statistics
 */
router.get('/pool/stats', (req, res) => {
  try {
    const stats = hapiValidatorClient.getPoolStats();

    res.json(stats);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching pool stats:', error);
    res.status(500).json({
      error: 'Failed to fetch pool stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/pool/enabled
 * Check if process pool is enabled
 */
router.get('/pool/enabled', (req, res) => {
  try {
    const enabled = hapiValidatorClient.isPoolEnabled();

    res.json({
      enabled,
      envVar: process.env.HAPI_USE_PROCESS_POOL,
      recommendation: enabled 
        ? 'Process pool is enabled for optimal performance'
        : 'Enable process pool with HAPI_USE_PROCESS_POOL=true for better performance',
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error checking pool status:', error);
    res.status(500).json({
      error: 'Failed to check pool status',
      message: error.message,
    });
  }
});

// ============================================================================
// Task 10.7: Terminology Optimization API
// ============================================================================

/**
 * GET /api/performance/terminology/cache-stats
 * Get terminology cache statistics
 */
router.get('/terminology/cache-stats', (req, res) => {
  try {
    const cache = getTerminologyCache();
    const stats = cache.getStats();

    res.json(stats);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching terminology cache stats:', error);
    res.status(500).json({
      error: 'Failed to fetch cache stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/terminology/batch-stats
 * Get batch validator deduplication statistics
 */
router.get('/terminology/batch-stats', (req, res) => {
  try {
    const batchValidator = getBatchValidator();
    const stats = batchValidator.getDeduplicationStats();

    res.json(stats);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching batch validator stats:', error);
    res.status(500).json({
      error: 'Failed to fetch batch stats',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/performance/terminology/cache-clear
 * Clear terminology cache
 */
router.delete('/terminology/cache-clear', (req, res) => {
  try {
    const cache = getTerminologyCache();
    cache.clear();

    res.json({
      success: true,
      message: 'Terminology cache cleared successfully',
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error clearing terminology cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message,
    });
  }
});

// ============================================================================
// Task 10.8: Profile Preloading API
// ============================================================================

/**
 * POST /api/performance/profiles/preload
 * Pre-load common German profiles
 */
router.post('/profiles/preload', async (req, res) => {
  try {
    const { fhirVersions, maxConcurrent, timeout, includeDependencies } = req.body;

    const preloader = getProfilePreloader();

    // Check if already preloading
    if (preloader.isPreloadInProgress()) {
      return res.status(409).json({
        error: 'Preload already in progress',
        message: 'Profile preloading is already running. Please wait for it to complete.',
      });
    }

    const stats = await preloader.preloadCommonProfiles({
      fhirVersions,
      maxConcurrent,
      timeout,
      includeDependencies,
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error preloading profiles:', error);
    res.status(500).json({
      error: 'Failed to preload profiles',
      message: error.message,
    });
  }
});

/**
 * POST /api/performance/profiles/preload-custom
 * Pre-load specific profiles
 */
router.post('/profiles/preload-custom', async (req, res) => {
  try {
    const { profileUrls, fhirVersion = 'R4', maxConcurrent, timeout } = req.body;

    if (!profileUrls || !Array.isArray(profileUrls) || profileUrls.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'profileUrls array is required',
      });
    }

    const preloader = getProfilePreloader();

    const stats = await preloader.preloadProfiles(profileUrls, fhirVersion, {
      maxConcurrent,
      timeout,
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error preloading custom profiles:', error);
    res.status(500).json({
      error: 'Failed to preload profiles',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/profiles/preload-stats
 * Get last preload statistics
 */
router.get('/profiles/preload-stats', (req, res) => {
  try {
    const preloader = getProfilePreloader();
    const stats = preloader.getLastPreloadStats();

    if (!stats) {
      return res.status(404).json({
        error: 'No preload stats available',
        message: 'No profile preloading has been performed yet',
      });
    }

    res.json(stats);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching preload stats:', error);
    res.status(500).json({
      error: 'Failed to fetch preload stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/performance/profiles/preload-status
 * Check if preloading is in progress
 */
router.get('/profiles/preload-status', (req, res) => {
  try {
    const preloader = getProfilePreloader();
    const inProgress = preloader.isPreloadInProgress();

    res.json({
      inProgress,
      lastStats: preloader.getLastPreloadStats(),
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error checking preload status:', error);
    res.status(500).json({
      error: 'Failed to check preload status',
      message: error.message,
    });
  }
});

// ============================================================================
// Task 10.9: Reference Validation Optimization API
// ============================================================================

/**
 * GET /api/performance/reference/stats
 * Get reference validation optimization statistics
 */
router.get('/reference/stats', (req, res) => {
  try {
    const checker = getBatchedReferenceChecker();
    const stats = checker.getStats();
    const dedupStats = checker.getDeduplicationStats();
    const config = checker.getOptimizationConfig();

    res.json({
      cache: stats,
      deduplication: dedupStats,
      config,
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching reference stats:', error);
    res.status(500).json({
      error: 'Failed to fetch reference stats',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/performance/reference/cache-clear
 * Clear reference validation cache
 */
router.delete('/reference/cache-clear', (req, res) => {
  try {
    const checker = getBatchedReferenceChecker();
    checker.clearCache();

    res.json({
      success: true,
      message: 'Reference cache cleared successfully',
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error clearing reference cache:', error);
    res.status(500).json({
      error: 'Failed to clear reference cache',
      message: error.message,
    });
  }
});

// ============================================================================
// Task 10.10: Parallel Validation API
// ============================================================================

/**
 * GET /api/performance/validation/mode
 * Get current validation mode (parallel/sequential)
 */
router.get('/validation/mode', (req, res) => {
  try {
    const engine = getValidationEngine();
    const mode = engine.getValidationMode();

    res.json(mode);
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error fetching validation mode:', error);
    res.status(500).json({
      error: 'Failed to fetch validation mode',
      message: error.message,
    });
  }
});

/**
 * POST /api/performance/validation/mode
 * Set validation mode (enable/disable parallel validation)
 */
router.post('/validation/mode', (req, res) => {
  try {
    const { parallel } = req.body;

    if (typeof parallel !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'parallel field must be a boolean',
      });
    }

    const engine = getValidationEngine();
    engine.setParallelValidation(parallel);

    res.json({
      success: true,
      mode: engine.getValidationMode(),
    });
  } catch (error: any) {
    console.error('[PerformanceBaselineAPI] Error setting validation mode:', error);
    res.status(500).json({
      error: 'Failed to set validation mode',
      message: error.message,
    });
  }
});

export default router;

