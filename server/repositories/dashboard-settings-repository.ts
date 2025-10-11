/**
 * Dashboard Settings Repository
 * Manages persistence of dashboard settings in PostgreSQL database.
 * This is a single-row table - only one set of dashboard settings exists.
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { dashboardSettings } from '@shared/schema';

// ============================================================================
// Types
// ============================================================================

export interface DashboardSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  showResourceStats: boolean;
  showValidationProgress: boolean;
  showErrorSummary: boolean;
  showPerformanceMetrics: boolean;
  autoValidateEnabled: boolean;
  polling: {
    enabled: boolean;
    fastIntervalMs: number;
    slowIntervalMs: number;
    verySlowIntervalMs: number;
    maxRetries: number;
    backoffMultiplier: number;
    jitterEnabled: boolean;
    pauseOnHidden: boolean;
  };
}

const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  autoRefresh: true,
  refreshInterval: 30,
  showResourceStats: true,
  showValidationProgress: true,
  showErrorSummary: true,
  showPerformanceMetrics: false,
  autoValidateEnabled: false,
  polling: {
    enabled: true,
    fastIntervalMs: 5000,
    slowIntervalMs: 30000,
    verySlowIntervalMs: 60000,
    maxRetries: 3,
    backoffMultiplier: 2,
    jitterEnabled: true,
    pauseOnHidden: true,
  },
};

// ============================================================================
// Dashboard Settings Repository
// ============================================================================

export class DashboardSettingsRepository {
  /**
   * Get current dashboard settings
   * Returns default settings if none exist
   */
  async getCurrentSettings(): Promise<DashboardSettings> {
    try {
      const result = await db
        .select()
        .from(dashboardSettings)
        .orderBy(desc(dashboardSettings.updatedAt))
        .limit(1);

      if (result.length > 0) {
        const dbSettings = result[0].settings as any;
        // Merge with defaults to ensure all fields exist and remove deprecated fields
        const { theme, cardLayout, ...validSettings } = dbSettings;
        return {
          ...DEFAULT_DASHBOARD_SETTINGS,
          ...validSettings,
        } as DashboardSettings;
      }
      return DEFAULT_DASHBOARD_SETTINGS;
    } catch (error) {
      console.error('[DashboardSettingsRepository] Error getting current settings:', error);
      throw error;
    }
  }

  /**
   * Update dashboard settings
   * Creates new record if none exists, otherwise updates existing
   */
  async updateSettings(updates: Partial<DashboardSettings>): Promise<DashboardSettings> {
    try {
      const current = await this.getCurrentSettings();
      const mergedSettings = { ...current, ...updates };

      const existing = await db.select().from(dashboardSettings).limit(1);

      if (existing.length > 0) {
        const updated = await db
          .update(dashboardSettings)
          .set({ 
            settings: mergedSettings, 
            updatedAt: new Date() 
          })
          .where(eq(dashboardSettings.id, existing[0].id))
          .returning();
        return updated[0].settings as DashboardSettings;
      } else {
        const created = await db
          .insert(dashboardSettings)
          .values({ settings: mergedSettings })
          .returning();
        return created[0].settings as DashboardSettings;
      }
    } catch (error) {
      console.error('[DashboardSettingsRepository] Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults(): Promise<DashboardSettings> {
    try {
      const existing = await db.select().from(dashboardSettings).limit(1);

      if (existing.length > 0) {
        const updated = await db
          .update(dashboardSettings)
          .set({ 
            settings: DEFAULT_DASHBOARD_SETTINGS, 
            updatedAt: new Date() 
          })
          .where(eq(dashboardSettings.id, existing[0].id))
          .returning();
        return updated[0].settings as DashboardSettings;
      } else {
        const created = await db
          .insert(dashboardSettings)
          .values({ settings: DEFAULT_DASHBOARD_SETTINGS })
          .returning();
        return created[0].settings as DashboardSettings;
      }
    } catch (error) {
      console.error('[DashboardSettingsRepository] Error resetting to defaults:', error);
      throw error;
    }
  }
}

// Singleton instance
let repositoryInstance: DashboardSettingsRepository | null = null;

export function getDashboardSettingsRepository(): DashboardSettingsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new DashboardSettingsRepository();
  }
  return repositoryInstance;
}
