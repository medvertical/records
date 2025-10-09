/**
 * Error Mapping Statistics API
 * 
 * Task 5.12: Error mapping statistics endpoint
 * 
 * Features:
 * - GET /api/validation/error-mapping/stats
 * - Mapping coverage statistics
 * - Unmapped error codes tracking
 * - Usage analytics
 */

import { Router } from 'express';
import errorMap from '../../../config/error_map.json' assert { type: 'json' };

const router = Router();

// ============================================================================
// In-Memory Stats Tracking (would be persisted in production)
// ============================================================================

interface ErrorMappingStats {
  totalMappings: number;
  mappingsByCategory: Record<string, number>;
  mappingsBySeverity: Record<string, number>;
  coverageRate: number;
  unmappedCodes: Array<{
    code: string;
    count: number;
    lastSeen: string;
    exampleMessage?: string;
  }>;
  recentlyUsed: Array<{
    code: string;
    count: number;
    lastUsed: string;
  }>;
}

// Simulated tracking (would be from database in production)
const unmappedCodesTracker = new Map<string, {
  count: number;
  lastSeen: Date;
  exampleMessage?: string;
}>();

const usageTracker = new Map<string, {
  count: number;
  lastUsed: Date;
}>();

// ============================================================================
// Helper Functions
// ============================================================================

function calculateStats(): ErrorMappingStats {
  // Count mappings by category
  const mappingsByCategory: Record<string, number> = {};
  const mappingsBySeverity: Record<string, number> = {};

  for (const [code, mapping] of Object.entries(errorMap)) {
    const category = (mapping as any).category || 'uncategorized';
    const severity = (mapping as any).severity || 'unknown';

    mappingsByCategory[category] = (mappingsByCategory[category] || 0) + 1;
    mappingsBySeverity[severity] = (mappingsBySeverity[severity] || 0) + 1;
  }

  // Calculate coverage (assuming ~150 total HAPI codes)
  const totalMappings = Object.keys(errorMap).length;
  const estimatedTotalCodes = 150;
  const coverageRate = (totalMappings / estimatedTotalCodes) * 100;

  // Get unmapped codes
  const unmappedCodes = Array.from(unmappedCodesTracker.entries())
    .map(([code, data]) => ({
      code,
      count: data.count,
      lastSeen: data.lastSeen.toISOString(),
      exampleMessage: data.exampleMessage
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20

  // Get recently used mappings
  const recentlyUsed = Array.from(usageTracker.entries())
    .map(([code, data]) => ({
      code,
      count: data.count,
      lastUsed: data.lastUsed.toISOString()
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  return {
    totalMappings,
    mappingsByCategory,
    mappingsBySeverity,
    coverageRate: Math.round(coverageRate * 100) / 100,
    unmappedCodes,
    recentlyUsed
  };
}

// ============================================================================
// Public API: Track unmapped code
// ============================================================================

export function trackUnmappedCode(code: string, exampleMessage?: string): void {
  const existing = unmappedCodesTracker.get(code);
  
  if (existing) {
    existing.count++;
    existing.lastSeen = new Date();
    if (exampleMessage && !existing.exampleMessage) {
      existing.exampleMessage = exampleMessage;
    }
  } else {
    unmappedCodesTracker.set(code, {
      count: 1,
      lastSeen: new Date(),
      exampleMessage
    });
  }
}

// ============================================================================
// Public API: Track mapping usage
// ============================================================================

export function trackMappingUsage(code: string): void {
  const existing = usageTracker.get(code);
  
  if (existing) {
    existing.count++;
    existing.lastUsed = new Date();
  } else {
    usageTracker.set(code, {
      count: 1,
      lastUsed: new Date()
    });
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/validation/error-mapping/stats
 * Get error mapping statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = calculateStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ErrorMappingStats] Failed to get stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get error mapping statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/validation/error-mapping/unmapped
 * Get list of unmapped error codes
 */
router.get('/unmapped', (req, res) => {
  try {
    const unmapped = Array.from(unmappedCodesTracker.entries())
      .map(([code, data]) => ({
        code,
        count: data.count,
        lastSeen: data.lastSeen.toISOString(),
        exampleMessage: data.exampleMessage
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        total: unmapped.length,
        codes: unmapped
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ErrorMappingStats] Failed to get unmapped codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unmapped error codes',
      error: error.message
    });
  }
});

/**
 * GET /api/validation/error-mapping/coverage
 * Get mapping coverage summary
 */
router.get('/coverage', (req, res) => {
  try {
    const totalMappings = Object.keys(errorMap).length;
    const estimatedTotalCodes = 150;
    const coverageRate = (totalMappings / estimatedTotalCodes) * 100;

    res.json({
      success: true,
      data: {
        totalMappings,
        estimatedTotalCodes,
        coverageRate: Math.round(coverageRate * 100) / 100,
        coveragePercentage: `${Math.round(coverageRate)}%`,
        status: coverageRate >= 90 ? 'excellent' : coverageRate >= 70 ? 'good' : 'needs-improvement'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ErrorMappingStats] Failed to get coverage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mapping coverage',
      error: error.message
    });
  }
});

export default router;

