import { Router, Request, Response } from 'express';
import { 
  clearPerAspectData, 
  clearLegacyData, 
  clearAllValidationData,
  getValidationStats 
} from '../../../db/scripts/clear-validation-data';

const router = Router();

/**
 * GET /api/validation/clear/stats
 * Get validation data statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getValidationStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting validation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get validation statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/validation/clear/per-aspect
 * Clear per-aspect validation data
 */
router.delete('/per-aspect', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const result = await clearPerAspectData(force);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Operation cancelled or failed',
      });
    }
    
    res.json({
      success: true,
      cleared: result.cleared,
      type: 'per-aspect',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing per-aspect data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear per-aspect validation data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/validation/clear/legacy
 * Clear legacy validation results
 */
router.delete('/legacy', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const result = await clearLegacyData(force);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Operation cancelled or failed',
      });
    }
    
    res.json({
      success: true,
      cleared: result.cleared,
      type: 'legacy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing legacy data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear legacy validation data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/validation/clear/all
 * Clear all validation data (per-aspect + legacy)
 */
router.delete('/all', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const result = await clearAllValidationData(force);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Operation cancelled or failed',
      });
    }
    
    res.json({
      success: true,
      cleared: {
        perAspect: result.perAspect,
        legacy: result.legacy,
        total: result.perAspect + result.legacy,
      },
      type: 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing all validation data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear all validation data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
