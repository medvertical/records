/**
 * Simplified Validation Settings Repository
 * 
 * This repository provides basic CRUD operations for validation settings
 * without versioning, audit trails, or complex history management.
 */

import { eq, desc, sql, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { validationSettings } from '@shared/schema';
import type {
  ValidationSettings
} from '@shared/validation-settings-simplified';

// ============================================================================
// Backup Types and Interfaces
// ============================================================================

export interface ValidationSettingsBackup {
  id: string;
  serverId: number;
  settings: ValidationSettings;
  timestamp: Date;
  version: string;
  description?: string;
}

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationSettingsRecord {
  id: number;
  serverId: number | null;
  settings: ValidationSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateValidationSettingsInput {
  settings: ValidationSettings;
  serverId?: number;
  isActive?: boolean;
}

export interface UpdateValidationSettingsInput {
  id: number;
  settings: ValidationSettings;
  serverId?: number;
  isActive?: boolean;
}

// ============================================================================
// Simplified Validation Settings Repository
// ============================================================================

export class ValidationSettingsRepository {
  /**
   * Get active validation settings for a specific server
   */
  async getActiveSettings(serverId?: number): Promise<ValidationSettings | null> {
    try {
      const conditions = [eq(validationSettings.isActive, true)];
      
      // If serverId is provided, get server-specific settings
      if (serverId !== undefined) {
        conditions.push(eq(validationSettings.serverId, serverId));
      } else {
        // Get global settings (serverId is null)
        conditions.push(isNull(validationSettings.serverId));
      }

      const result = await db
        .select({
          settings: validationSettings.settings
        })
        .from(validationSettings)
        .where(and(...conditions))
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
        serverId: row.serverId,
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
          serverId: input.serverId || null,
          settings: input.settings,
          isActive: input.isActive !== false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      const row = result[0];
      return {
        id: row.id,
        serverId: row.serverId,
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
          serverId: input.serverId || null,
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
        serverId: row.serverId,
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
  async createOrUpdate(settings: ValidationSettings, serverId?: number): Promise<ValidationSettings> {
    try {
      // Get the most recent settings record for this server
      const conditions = [];
      if (serverId !== undefined) {
        conditions.push(eq(validationSettings.serverId, serverId));
      } else {
        conditions.push(isNull(validationSettings.serverId));
      }

      const existing = await db
        .select()
        .from(validationSettings)
        .where(and(...conditions))
        .orderBy(desc(validationSettings.updatedAt))
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        const result = await this.update({
          id: existing[0].id,
          settings,
          serverId,
          isActive: true
        });
        return result.settings;
      } else {
        // Create new record
        const result = await this.create({
          settings,
          serverId,
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
        serverId: row.serverId,
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
   * Delete validation settings for a specific server
   */
  async deleteSettingsForServer(serverId: number): Promise<void> {
    try {
      await db.delete(validationSettings)
        .where(eq(validationSettings.serverId, serverId));
      
      console.log(`[ValidationSettingsRepository] Deleted settings for server: ${serverId}`);
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error deleting settings for server:`, error);
      throw error;
    }
  }

  /**
   * Check if settings exist for a server
   */
  async hasSettings(serverId: number): Promise<boolean> {
    try {
      const result = await db.select({ id: validationSettings.id })
        .from(validationSettings)
        .where(eq(validationSettings.serverId, serverId))
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error checking settings existence:`, error);
      throw error;
    }
  }

  /**
   * Get last modified timestamp for settings
   */
  async getLastModified(serverId: number): Promise<Date | null> {
    try {
      const result = await db.select({ updatedAt: validationSettings.updatedAt })
        .from(validationSettings)
        .where(eq(validationSettings.serverId, serverId))
        .orderBy(desc(validationSettings.updatedAt))
        .limit(1);
      
      return result.length > 0 ? result[0].updatedAt : null;
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error getting last modified:`, error);
      throw error;
    }
  }

  /**
   * Save backup (stored in settings table with special backup flag)
   */
  async saveBackup(backup: ValidationSettingsBackup): Promise<void> {
    try {
      // For now, we'll store backups in the same table with a special naming convention
      // In a production system, you might want a separate backups table
      const backupSettings = {
        ...backup.settings,
        _backup: {
          id: backup.id,
          timestamp: backup.timestamp,
          version: backup.version,
          description: backup.description
        }
      };

      await db.insert(validationSettings)
        .values({
          serverId: backup.serverId,
          settings: backupSettings as any,
          isActive: false, // Backups are never active
          createdAt: backup.timestamp,
          updatedAt: backup.timestamp
        });
      
      console.log(`[ValidationSettingsRepository] Saved backup: ${backup.id}`);
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error saving backup:`, error);
      throw error;
    }
  }

  /**
   * Get backup by ID
   */
  async getBackup(backupId: string): Promise<ValidationSettingsBackup | null> {
    try {
      const result = await db.select()
        .from(validationSettings)
        .where(
          and(
            sql`${validationSettings.settings}->'_backup'->>'id' = ${backupId}`,
            eq(validationSettings.isActive, false)
          )
        )
        .limit(1);
      
      if (result.length === 0) {
        return null;
      }

      const record = result[0];
      const backupData = (record.settings as any)._backup;
      
      return {
        id: backupData.id,
        serverId: record.serverId!,
        settings: record.settings as ValidationSettings,
        timestamp: backupData.timestamp,
        version: backupData.version,
        description: backupData.description
      };
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error getting backup:`, error);
      throw error;
    }
  }

  /**
   * Get all backups for a server
   */
  async getBackups(serverId: number): Promise<ValidationSettingsBackup[]> {
    try {
      const result = await db.select()
        .from(validationSettings)
        .where(
          and(
            eq(validationSettings.serverId, serverId),
            eq(validationSettings.isActive, false),
            sql`${validationSettings.settings}->'_backup' IS NOT NULL`
          )
        )
        .orderBy(desc(validationSettings.createdAt));
      
      return result.map(record => {
        const backupData = (record.settings as any)._backup;
        return {
          id: backupData.id,
          serverId: record.serverId!,
          settings: record.settings as ValidationSettings,
          timestamp: backupData.timestamp,
          version: backupData.version,
          description: backupData.description
        };
      });
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error getting backups:`, error);
      throw error;
    }
  }

  /**
   * Delete backup by ID
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      await db.delete(validationSettings)
        .where(
          and(
            sql`${validationSettings.settings}->'_backup'->>'id' = ${backupId}`,
            eq(validationSettings.isActive, false)
          )
        );
      
      console.log(`[ValidationSettingsRepository] Deleted backup: ${backupId}`);
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error deleting backup:`, error);
      throw error;
    }
  }

  /**
   * Clean up old backups (keep only the most recent ones)
   */
  async cleanupOldBackups(serverId: number, maxBackups: number = 10): Promise<void> {
    try {
      const backups = await this.getBackups(serverId);
      
      if (backups.length > maxBackups) {
        const toDelete = backups.slice(maxBackups);
        
        for (const backup of toDelete) {
          await this.deleteBackup(backup.id);
        }
        
        console.log(`[ValidationSettingsRepository] Cleaned up ${toDelete.length} old backups for server ${serverId}`);
      }
    } catch (error) {
      console.error(`[ValidationSettingsRepository] Error cleaning up backups:`, error);
      throw error;
    }
  }

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
