/**
 * Connectivity Status API Routes
 * 
 * Provides endpoints for monitoring and controlling validation engine connectivity.
 * Task 5.10: API endpoints for connectivity status
 */

import { Router } from 'express';
import { getConnectivityDetector } from '../../../services/validation/utils/connectivity-detector';
import { getValidationEngine } from '../../../services/validation/core/validation-engine';

const router = Router();

// ============================================================================
// GET /api/validation/connectivity/status
// Get current connectivity status with feature availability
// ============================================================================

router.get('/status', async (req, res) => {
  try {
    const engine = getValidationEngine();
    const status = engine.getConnectivityStatus();

    res.json(status);
  } catch (error) {
    console.error('[Connectivity API] Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get connectivity status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /api/validation/connectivity/health
// Get detailed server health information
// ============================================================================

router.get('/health', async (req, res) => {
  try {
    const detector = getConnectivityDetector();
    const summary = detector.getHealthSummary();
    const allStatuses = detector.getAllServerStatuses();

    res.json({
      ...summary,
      servers: allStatuses,
    });
  } catch (error) {
    console.error('[Connectivity API] Error getting health:', error);
    res.status(500).json({
      error: 'Failed to get server health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /api/validation/connectivity/mode
// Set manual mode override
// Body: { mode: 'online' | 'degraded' | 'offline' | null }
// ============================================================================

router.post('/mode', async (req, res) => {
  try {
    const { mode } = req.body;

    if (mode !== null && !['online', 'degraded', 'offline'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode',
        message: 'Mode must be "online", "degraded", "offline", or null',
      });
    }

    const detector = getConnectivityDetector();
    detector.setManualMode(mode);

    const summary = detector.getHealthSummary();

    res.json({
      success: true,
      mode: summary.mode,
      detectedMode: summary.detectedMode,
      manualOverride: summary.manualOverride,
    });
  } catch (error) {
    console.error('[Connectivity API] Error setting mode:', error);
    res.status(500).json({
      error: 'Failed to set mode',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /api/validation/connectivity/check
// Trigger immediate health check
// ============================================================================

router.post('/check', async (req, res) => {
  try {
    const detector = getConnectivityDetector();
    await detector.performHealthCheck();

    const summary = detector.getHealthSummary();

    res.json({
      success: true,
      mode: summary.mode,
      healthyServers: summary.healthyServers,
      totalServers: summary.totalServers,
    });
  } catch (error) {
    console.error('[Connectivity API] Error performing health check:', error);
    res.status(500).json({
      error: 'Failed to perform health check',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /api/validation/connectivity/history
// Get connectivity mode change history (if implemented)
// ============================================================================

router.get('/history', async (req, res) => {
  try {
    // This could be implemented by storing mode changes in memory or database
    // For now, return empty array
    res.json({
      history: [],
      message: 'History tracking not yet implemented',
    });
  } catch (error) {
    console.error('[Connectivity API] Error getting history:', error);
    res.status(500).json({
      error: 'Failed to get history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /api/validation/connectivity/reset-circuit-breaker
// Reset circuit breaker for a specific server
// Body: { serverName: string }
// ============================================================================

router.post('/reset-circuit-breaker', async (req, res) => {
  try {
    const { serverName } = req.body;

    if (!serverName) {
      return res.status(400).json({
        error: 'Missing server name',
        message: 'serverName is required',
      });
    }

    const detector = getConnectivityDetector();
    const success = detector.resetCircuitBreaker(serverName);

    if (success) {
      // Trigger immediate health check after reset
      await detector.performHealthCheck();

      res.json({
        success: true,
        message: `Circuit breaker reset for ${serverName}`,
        serverName,
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Circuit breaker not found or not open',
        message: `No open circuit breaker found for server: ${serverName}`,
      });
    }
  } catch (error) {
    console.error('[Connectivity API] Error resetting circuit breaker:', error);
    res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /api/validation/connectivity/stats
// Get detailed connectivity statistics
// ============================================================================

router.get('/stats', async (req, res) => {
  try {
    const detector = getConnectivityDetector();
    const stats = detector.getConnectivityStats();

    res.json(stats);
  } catch (error) {
    console.error('[Connectivity API] Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get connectivity stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

