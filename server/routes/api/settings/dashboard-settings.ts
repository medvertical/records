import { Router } from 'express';
import type { Request, Response } from 'express';
import logger from '../../../utils/logger';
import { getDashboardSettingsRepository } from '../../../repositories/dashboard-settings-repository';

const router = Router();

/**
 * GET /api/dashboard-settings
 * Get current dashboard settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('[DashboardSettings] Fetching settings');
    
    const repository = getDashboardSettingsRepository();
    const settings = await repository.getCurrentSettings();
    
    logger.info('[DashboardSettings] Settings fetched successfully');
    res.json(settings);
  } catch (error) {
    logger.error('[DashboardSettings] Error fetching settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Update dashboard settings handler
 */
const updateSettings = async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    logger.info('[DashboardSettings] Update request received:', {
      updates,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    
    const repository = getDashboardSettingsRepository();
    const updatedSettings = await repository.updateSettings(updates);
    
    logger.info('[DashboardSettings] Settings updated successfully:', updatedSettings);
    res.json(updatedSettings);
  } catch (error) {
    logger.error('[DashboardSettings] Error updating settings:', error);
    res.status(500).json({ 
      error: 'Failed to update dashboard settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * POST /api/dashboard-settings
 * Update dashboard settings (legacy)
 */
router.post('/', updateSettings);

/**
 * PUT /api/dashboard-settings
 * Update dashboard settings
 */
router.put('/', updateSettings);

export default router;

