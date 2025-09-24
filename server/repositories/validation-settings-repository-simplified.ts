/**
 * Simplified Validation Settings Repository
 * 
 * This repository provides basic CRUD operations for validation settings
 * without versioning, audit trails, or complex history management.
 */

import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { validationSettings } from '@shared/schema';
import type {
  ValidationSettings
} from '@shared/validation-settings-simplified';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationSettingsRecord {
  id: number;
  settings: ValidationSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateValidationSettingsInput {
  settings: ValidationSettings;
  isActive?: boolean;
}

export interface UpdateValidationSettingsInput {
  id: number;
  settings: ValidationSettings;
  isActive?: boolean;
}

// ============================================================================
// Simplified Validation Settings Repository
// ============================================================================

export class ValidationSettingsRepository {
  /**
   * Get active validation settings
   */
  async getActiveSettings(): Promise<ValidationSettings | null> {
    try {
      const result = await db
        .select({
          settings: validationSettings.settings
        })
        .from(validationSettings)
        .where(eq(validationSettings.isActive, true))
        .orderBy(desc(validationSettings.updatedAt))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0].settings as ValidationSettings;
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting active settings:', error);
      throw error;
    }
  }

  /**
   * Get settings by ID
   */
  async getById(id: number): Promise<ValidationSettingsRecord | null> {
    try {
      const result = await db
        .select()
        .from(validationSettings)
        .where(eq(validationSettings.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        id: row.id,
        settings: row.settings as ValidationSettings,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting settings by ID:', error);
      throw error;
    }
  }

  /**
   * Create new validation settings
   */
  async create(input: CreateValidationSettingsInput): Promise<ValidationSettingsRecord> {
    try {
      // Deactivate all existing settings if this is being set as active
      if (input.isActive !== false) {
        await this.deactivateAllSettings();
      }

      const result = await db
        .insert(validationSettings)
        .values({
          settings: input.settings,
          isActive: input.isActive !== false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      const row = result[0];
      return {
        id: row.id,
        settings: row.settings as ValidationSettings,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error creating settings:', error);
      throw error;
    }
  }

  /**
   * Update existing validation settings
   */
  async update(input: UpdateValidationSettingsInput): Promise<ValidationSettingsRecord> {
    try {
      // Deactivate all existing settings if this is being set as active
      if (input.isActive !== false) {
        await this.deactivateAllSettings();
      }

      const result = await db
        .update(validationSettings)
        .set({
          settings: input.settings,
          isActive: input.isActive !== false,
          updatedAt: new Date()
        })
        .where(eq(validationSettings.id, input.id))
        .returning();

      if (result.length === 0) {
        throw new Error(`Settings with ID ${input.id} not found`);
      }

      const row = result[0];
      return {
        id: row.id,
        settings: row.settings as ValidationSettings,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Create or update validation settings (upsert)
   */
  async createOrUpdate(settings: ValidationSettings): Promise<ValidationSettings> {
    try {
      // Get the most recent settings record
      const existing = await db
        .select()
        .from(validationSettings)
        .orderBy(desc(validationSettings.updatedAt))
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        const result = await this.update({
          id: existing[0].id,
          settings,
          isActive: true
        });
        return result.settings;
      } else {
        // Create new record
        const result = await this.create({
          settings,
          isActive: true
        });
        return result.settings;
      }
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error creating or updating settings:', error);
      throw error;
    }
  }

  /**
   * Delete validation settings
   */
  async delete(id: number): Promise<void> {
    try {
      const result = await db
        .delete(validationSettings)
        .where(eq(validationSettings.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error(`Settings with ID ${id} not found`);
      }
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error deleting settings:', error);
      throw error;
    }
  }

  /**
   * Get all validation settings
   */
  async getAll(): Promise<ValidationSettingsRecord[]> {
    try {
      const result = await db
        .select()
        .from(validationSettings)
        .orderBy(desc(validationSettings.updatedAt));

      return result.map(row => ({
        id: row.id,
        settings: row.settings as ValidationSettings,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting all settings:', error);
      throw error;
    }
  }

  /**
   * Get settings statistics
   */
  async getStatistics(): Promise<{
    totalSettings: number;
    activeSettings: number;
    lastUpdated: Date | null;
  }> {
    try {
      const [totalResult, activeResult, lastUpdatedResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(validationSettings),
        db.select({ count: sql<number>`count(*)` }).from(validationSettings).where(eq(validationSettings.isActive, true)),
        db.select({ lastUpdated: sql<Date>`max(updated_at)` }).from(validationSettings)
      ]);

      return {
        totalSettings: totalResult[0]?.count || 0,
        activeSettings: activeResult[0]?.count || 0,
        lastUpdated: lastUpdatedResult[0]?.lastUpdated || null
      };
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old settings (keep only the latest N records)
   */
  async cleanupOldSettings(keepCount: number = 10): Promise<number> {
    try {
      // Get IDs of settings to keep (most recent)
      const keepResult = await db
        .select({ id: validationSettings.id })
        .from(validationSettings)
        .orderBy(desc(validationSettings.updatedAt))
        .limit(keepCount);

      const keepIds = keepResult.map(row => row.id);

      if (keepIds.length === 0) {
        return 0;
      }

      // Delete settings not in the keep list
      const deleteResult = await db
        .delete(validationSettings)
        .where(sql`id NOT IN (${keepIds.join(',')})`)
        .returning();

      return deleteResult.length;
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error cleaning up old settings:', error);
      throw error;
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Deactivate all existing settings
   */
  private async deactivateAllSettings(): Promise<void> {
    try {
      await db
        .update(validationSettings)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(validationSettings.isActive, true));
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error deactivating all settings:', error);
      throw error;
    }
  }
}
