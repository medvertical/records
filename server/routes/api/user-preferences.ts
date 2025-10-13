import { Router } from 'express';
import { db } from '../../db.js';
import { userPreferences } from '../../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/user-preferences/quick-access
 * Fetch user's quick access items
 */
router.get('/quick-access', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default';
    
    const preferences = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (preferences.length === 0) {
      // Create default preferences if none exist
      const defaultPrefs = await db
        .insert(userPreferences)
        .values({
          userId,
          quickAccessItems: ['Patient', 'Observation', 'Encounter', 'Condition']
        })
        .returning();
      
      return res.json({
        quickAccessItems: defaultPrefs[0].quickAccessItems
      });
    }

    res.json({
      quickAccessItems: preferences[0].quickAccessItems
    });
  } catch (error) {
    console.error('[UserPreferences] Error fetching quick access items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch quick access items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/user-preferences/quick-access
 * Update user's quick access items
 */
router.put('/quick-access', async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    const { quickAccessItems } = req.body;

    if (!Array.isArray(quickAccessItems)) {
      return res.status(400).json({ 
        error: 'quickAccessItems must be an array' 
      });
    }

    // Validate that all items are strings
    if (!quickAccessItems.every(item => typeof item === 'string')) {
      return res.status(400).json({ 
        error: 'All quick access items must be strings' 
      });
    }

    const existingPrefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    let result;
    if (existingPrefs.length === 0) {
      // Create new preferences
      result = await db
        .insert(userPreferences)
        .values({
          userId,
          quickAccessItems
        })
        .returning();
    } else {
      // Update existing preferences
      result = await db
        .update(userPreferences)
        .set({
          quickAccessItems,
          updatedAt: new Date()
        })
        .where(eq(userPreferences.userId, userId))
        .returning();
    }

    // Auto-add new resource types to validation settings
    try {
      const { ValidationSettingsService } = await import('../../services/validation/settings/validation-settings-service');
      const settingsService = new ValidationSettingsService();
      await settingsService.initialize();
      const currentSettings = await settingsService.getCurrentSettings();
      
      const currentIncludedTypes = currentSettings?.resourceTypes?.includedTypes || [];
      const newTypes = quickAccessItems.filter(type => !currentIncludedTypes.includes(type));
      
      if (newTypes.length > 0) {
        console.log(`[UserPreferences] Auto-adding ${newTypes.length} new resource types to validation settings:`, newTypes);
        const updatedIncludedTypes = [...currentIncludedTypes, ...newTypes];
        await settingsService.updateSettings({
          ...currentSettings,
          resourceTypes: {
            ...currentSettings.resourceTypes,
            enabled: true,
            includedTypes: updatedIncludedTypes
          }
        });
        console.log(`[UserPreferences] Successfully added new types to validation settings`);
      }
    } catch (validationError) {
      console.warn('[UserPreferences] Failed to update validation settings:', validationError);
      // Don't fail the request if validation settings update fails
    }
    
    return res.json({
      quickAccessItems: result[0].quickAccessItems
    });
  } catch (error) {
    console.error('[UserPreferences] Error updating quick access items:', error);
    res.status(500).json({ 
      error: 'Failed to update quick access items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/user-preferences/quick-access/reset
 * Reset quick access items to defaults
 */
router.post('/quick-access/reset', async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    const defaultItems = ['Patient', 'Observation', 'Encounter', 'Condition'];

    const existingPrefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existingPrefs.length === 0) {
      // Create new preferences with defaults
      const newPrefs = await db
        .insert(userPreferences)
        .values({
          userId,
          quickAccessItems: defaultItems
        })
        .returning();
      
      return res.json({
        quickAccessItems: newPrefs[0].quickAccessItems
      });
    } else {
      // Update existing preferences to defaults
      const updatedPrefs = await db
        .update(userPreferences)
        .set({
          quickAccessItems: defaultItems,
          updatedAt: new Date()
        })
        .where(eq(userPreferences.userId, userId))
        .returning();
      
      return res.json({
        quickAccessItems: updatedPrefs[0].quickAccessItems
      });
    }
  } catch (error) {
    console.error('[UserPreferences] Error resetting quick access items:', error);
    res.status(500).json({ 
      error: 'Failed to reset quick access items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
