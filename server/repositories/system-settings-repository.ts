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
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  enableSSE: boolean;
  dataRetentionDays: number;
  maxLogFileSize: number;
  enableAutoUpdates: boolean;
  theme: 'light' | 'dark' | 'system';
  cardLayout: 'grid' | 'list';
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  logLevel: 'info',
  enableAnalytics: false,
  enableCrashReporting: true,
  enableSSE: true,
  dataRetentionDays: 30,
  maxLogFileSize: 100,
  enableAutoUpdates: true,
  theme: 'system',
  cardLayout: 'grid',
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
        // Merge with defaults to ensure all fields exist (including new theme/cardLayout)
        return {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...dbSettings,
        } as SystemSettings;
      }
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
      const current = await this.getCurrentSettings();
      const mergedSettings = { ...current, ...updates };

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
        return updated[0].settings as SystemSettings;
      } else {
        const created = await db
          .insert(systemSettings)
          .values({ settings: mergedSettings })
          .returning();
        return created[0].settings as SystemSettings;
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
