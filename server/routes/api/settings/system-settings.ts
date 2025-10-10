import { Router } from 'express';
import type { Request, Response } from 'express';
import logger from '../../../utils/logger';

const router = Router();

// Default system settings
const defaultSettings = {
  logLevel: 'info',
  enableAnalytics: false,
  enableCrashReporting: true,
  enableSSE: true,
  dataRetentionDays: 30,
  maxLogFileSize: 100,
  enableAutoUpdates: true,
};

let currentSettings = { ...defaultSettings };

/**
 * GET /api/system-settings
 * Get current system settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('[API] Fetching system settings');
    res.json(currentSettings);
  } catch (error) {
    logger.error('[API] Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

/**
 * POST /api/system-settings
 * Update system settings
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    logger.info('[API] Updating system settings:', updates);
    
    currentSettings = {
      ...currentSettings,
      ...updates,
    };
    
    res.json(currentSettings);
  } catch (error) {
    logger.error('[API] Error updating system settings:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

/**
 * GET /api/system-settings/export
 * Export system settings as JSON
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    logger.info('[API] Exporting system settings');
    
    const exportData = {
      ...currentSettings,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="system-settings.json"');
    res.json(exportData);
  } catch (error) {
    logger.error('[API] Error exporting system settings:', error);
    res.status(500).json({ error: 'Failed to export system settings' });
  }
});

export default router;

