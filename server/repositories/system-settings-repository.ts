/**
 * System Settings Repository
 * Manages persistence of system settings in PostgreSQL database.
 * This is a single-row table - only one set of system settings exists.
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { systemSettings } from '@shared/schema';

// ============================================================================
// Types
// ============================================================================

export interface SystemSettings {
  theme: 'light' | 'dark' | 'system';
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    maxFileSize: number;
  };
  privacy: {
    telemetry: boolean;
    crashReporting: boolean;
  };
  dataRetentionDays: number;
  features: {
    sse: boolean;
    autoUpdate: boolean;
  };
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  theme: 'system',
  logging: {
    level: 'info',
    maxFileSize: 100,
  },
  privacy: {
    telemetry: false,
    crashReporting: true,
  },
  dataRetentionDays: 30,
  features: {
    sse: true,
    autoUpdate: true,
  },
};

// ============================================================================
// System Settings Repository
// ============================================================================

export class SystemSettingsRepository {
  /**
   * Get current system settings
   * Returns default settings if none exist
   */
  async getCurrentSettings(): Promise<SystemSettings> {
    try {
      const result = await db
        .select()
        .from(systemSettings)
        .orderBy(desc(systemSettings.updatedAt))
        .limit(1);

      if (result.length > 0) {
        const dbSettings = result[0].settings as any;
        console.log('[SystemSettingsRepository] Raw DB settings:', JSON.stringify(dbSettings, null, 2));
        
        // Deep merge to properly handle nested objects
        // Only extract fields that match our new structure
        const merged: SystemSettings = {
          theme: dbSettings.theme ?? DEFAULT_SYSTEM_SETTINGS.theme,
          logging: {
            level: dbSettings.logging?.level ?? DEFAULT_SYSTEM_SETTINGS.logging.level,
            maxFileSize: dbSettings.logging?.maxFileSize ?? DEFAULT_SYSTEM_SETTINGS.logging.maxFileSize,
          },
          privacy: {
            telemetry: dbSettings.privacy?.telemetry ?? DEFAULT_SYSTEM_SETTINGS.privacy.telemetry,
            crashReporting: dbSettings.privacy?.crashReporting ?? DEFAULT_SYSTEM_SETTINGS.privacy.crashReporting,
          },
          dataRetentionDays: dbSettings.dataRetentionDays ?? DEFAULT_SYSTEM_SETTINGS.dataRetentionDays,
          features: {
            sse: dbSettings.features?.sse ?? DEFAULT_SYSTEM_SETTINGS.features.sse,
            autoUpdate: dbSettings.features?.autoUpdate ?? DEFAULT_SYSTEM_SETTINGS.features.autoUpdate,
          },
        };
        
        console.log('[SystemSettingsRepository] Merged settings:', JSON.stringify(merged, null, 2));
        return merged;
      }
      console.log('[SystemSettingsRepository] No settings in DB, returning defaults');
      return DEFAULT_SYSTEM_SETTINGS;
    } catch (error) {
      console.error('[SystemSettingsRepository] Error getting current settings:', error);
      throw error;
    }
  }

  /**
   * Update system settings
   * Creates new record if none exists, otherwise updates existing
   */
  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      console.log('[SystemSettingsRepository] Update request:', JSON.stringify(updates, null, 2));
      const current = await this.getCurrentSettings();
      console.log('[SystemSettingsRepository] Current settings:', JSON.stringify(current, null, 2));
      
      // Deep merge nested objects properly
      const mergedSettings: SystemSettings = {
        theme: updates.theme ?? current.theme,
        logging: {
          level: updates.logging?.level ?? current.logging.level,
          maxFileSize: updates.logging?.maxFileSize ?? current.logging.maxFileSize,
        },
        privacy: {
          telemetry: updates.privacy?.telemetry ?? current.privacy.telemetry,
          crashReporting: updates.privacy?.crashReporting ?? current.privacy.crashReporting,
        },
        dataRetentionDays: updates.dataRetentionDays ?? current.dataRetentionDays,
        features: {
          sse: updates.features?.sse ?? current.features.sse,
          autoUpdate: updates.features?.autoUpdate ?? current.features.autoUpdate,
        },
      };
      
      console.log('[SystemSettingsRepository] Merged settings to save:', JSON.stringify(mergedSettings, null, 2));

      const existing = await db.select().from(systemSettings).limit(1);

      if (existing.length > 0) {
        const updated = await db
          .update(systemSettings)
          .set({ 
            settings: mergedSettings, 
            updatedAt: new Date() 
          })
          .where(eq(systemSettings.id, existing[0].id))
          .returning();
        
        // Return only the new structure, stripping old fields
        return this.getCurrentSettings();
      } else {
        await db
          .insert(systemSettings)
          .values({ settings: mergedSettings });
        
        // Return only the new structure, stripping old fields
        return this.getCurrentSettings();
      }
    } catch (error) {
      console.error('[SystemSettingsRepository] Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults(): Promise<SystemSettings> {
    try {
      const existing = await db.select().from(systemSettings).limit(1);

      if (existing.length > 0) {
        const updated = await db
          .update(systemSettings)
          .set({ 
            settings: DEFAULT_SYSTEM_SETTINGS, 
            updatedAt: new Date() 
          })
          .where(eq(systemSettings.id, existing[0].id))
          .returning();
        return updated[0].settings as SystemSettings;
      } else {
        const created = await db
          .insert(systemSettings)
          .values({ settings: DEFAULT_SYSTEM_SETTINGS })
          .returning();
        return created[0].settings as SystemSettings;
      }
    } catch (error) {
      console.error('[SystemSettingsRepository] Error resetting to defaults:', error);
      throw error;
    }
  }
}

// Singleton instance
let repositoryInstance: SystemSettingsRepository | null = null;

export function getSystemSettingsRepository(): SystemSettingsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new SystemSettingsRepository();
  }
  return repositoryInstance;
}
