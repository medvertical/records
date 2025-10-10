import { Router } from 'express';
import type { Request, Response } from 'express';
import logger from '../../../utils/logger';

const router = Router();

// Default dashboard settings
const defaultSettings = {
  theme: 'system',
  cardLayout: 'grid',
  enableAutoRefresh: true,
  refreshInterval: 30,
  showResourceStatistics: true,
  showValidationProgress: true,
  showErrorSummary: true,
  showPerformanceMetrics: false,
  enableAutoValidation: false,
};

let currentSettings = { ...defaultSettings };

/**
 * GET /api/dashboard-settings
 * Get current dashboard settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('[API] Fetching dashboard settings');
    res.json(currentSettings);
  } catch (error) {
    logger.error('[API] Error fetching dashboard settings:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard settings' });
  }
});

/**
 * POST /api/dashboard-settings
 * Update dashboard settings
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    logger.info('[API] Updating dashboard settings:', updates);
    
    currentSettings = {
      ...currentSettings,
      ...updates,
    };
    
    res.json(currentSettings);
  } catch (error) {
    logger.error('[API] Error updating dashboard settings:', error);
    res.status(500).json({ error: 'Failed to update dashboard settings' });
  }
});

export default router;

