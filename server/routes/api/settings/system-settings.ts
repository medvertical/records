import { Router } from 'express';
import type { Request, Response } from 'express';
import logger from '../../../utils/logger';
import { getSystemSettingsRepository } from '../../../repositories/system-settings-repository';

const router = Router();

/**
 * GET /api/system-settings
 * Get current system settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('[SystemSettings] Fetching settings');
    
    const repository = getSystemSettingsRepository();
    const settings = await repository.getCurrentSettings();
    
    logger.info('[SystemSettings] Settings fetched successfully');
    res.json(settings);
  } catch (error) {
    logger.error('[SystemSettings] Error fetching settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch system settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Update system settings handler
 */
const updateSettings = async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    logger.info('[SystemSettings] Update request received:', {
      updates,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    
    const repository = getSystemSettingsRepository();
    const updatedSettings = await repository.updateSettings(updates);
    
    logger.info('[SystemSettings] Settings updated successfully:', updatedSettings);
    res.json(updatedSettings);
  } catch (error) {
    logger.error('[SystemSettings] Error updating settings:', error);
    res.status(500).json({ 
      error: 'Failed to update system settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * POST /api/system-settings
 * Update system settings (legacy)
 */
router.post('/', updateSettings);

/**
 * PUT /api/system-settings
 * Update system settings
 */
router.put('/', updateSettings);

/**
 * GET /api/system-settings/export
 * Export system settings as JSON
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    logger.info('[SystemSettings] Exporting settings');
    
    const repository = getSystemSettingsRepository();
    const settings = await repository.getCurrentSettings();
    
    const exportData = {
      ...settings,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="system-settings.json"');
    res.json(exportData);
  } catch (error) {
    logger.error('[SystemSettings] Error exporting settings:', error);
    res.status(500).json({ 
      error: 'Failed to export system settings',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

