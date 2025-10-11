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
} from '@shared/validation-settings';

// ============================================================================
// Simplified Types and Interfaces
// ============================================================================

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
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    // Repository initialization - no special setup needed
  }

  /**
   * Get current validation settings for a specific server (alias for getActiveSettings)
   */
  async getCurrentSettings(serverId?: number): Promise<ValidationSettings | null> {
    return this.getActiveSettings(serverId);
  }

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
          aspects: validationSettings.aspects,
          performance: validationSettings.performance,
          resourceTypes: validationSettings.resourceTypes
        })
        .from(validationSettings)
        .where(and(...conditions))
        .orderBy(desc(validationSettings.updatedAt))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      // Merge performance with defaults to ensure new fields get default values
      const dbPerformance = result[0].performance as any;
      const mergedPerformance = {
        batchSize: dbPerformance?.batchSize ?? 50,
        // Fix old default of 5 to new default of 4 (to match dropdown options)
        maxConcurrent: dbPerformance?.maxConcurrent === 5 ? 4 : (dbPerformance?.maxConcurrent ?? 4),
      };

      // Return with default values for optional fields that aren't persisted in DB
      return {
        aspects: result[0].aspects,
        performance: mergedPerformance,
        resourceTypes: result[0].resourceTypes,
        // Default optional fields that aren't stored in DB
        mode: 'online' as const, // Default to online mode
        terminologyFallback: {
          local: 'http://localhost:8081/fhir',
          remote: 'https://tx.fhir.org/r4'
        },
        useFhirValidateOperation: false,
        autoRevalidateAfterEdit: false,
      } as ValidationSettings;
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
      
      // Build settings with defaults for optional fields
      const settings: ValidationSettings = {
        aspects: row.aspects as any,
        performance: row.performance as any,
        resourceTypes: row.resourceTypes as any,
        // Default optional fields that aren't stored in DB
        mode: 'online' as const,
        terminologyFallback: {
          local: 'http://localhost:8081/fhir',
          remote: 'https://tx.fhir.org/r4'
        },
        useFhirValidateOperation: false,
        autoRevalidateAfterEdit: false,
      };
      
      return {
        id: row.id,
        serverId: row.serverId,
        settings,
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
          aspects: input.settings.aspects,
          performance: input.settings.performance,
          resourceTypes: input.settings.resourceTypes,
          isActive: input.isActive !== false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      const row = result[0];
      // IMPORTANT: Drizzle ORM doesn't return JSONB fields in .returning()
      return {
        id: row.id,
        serverId: row.serverId,
        settings: input.settings, // Use input instead of row.settings
        isActive: row.isActive !== undefined ? row.isActive : (input.isActive !== false),
        createdAt: row.createdAt || new Date(),
        updatedAt: row.updatedAt || new Date()
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

      console.log('[ValidationSettingsRepository] Updating with settings.aspects.structural:', JSON.stringify(input.settings.aspects?.structural));
      
      const result = await db
        .update(validationSettings)
        .set({
          serverId: input.serverId || null,
          aspects: input.settings.aspects,
          performance: input.settings.performance,
          resourceTypes: input.settings.resourceTypes,
          isActive: input.isActive !== false,
          updatedAt: new Date()
        })
        .where(eq(validationSettings.id, input.id))
        .returning();

      console.log('[ValidationSettingsRepository] Update result:', result.length, 'rows');
      console.log('[ValidationSettingsRepository] Updated row.settings type:', typeof result[0]?.settings);
      console.log('[ValidationSettingsRepository] Updated row.settings:', JSON.stringify(result[0]?.settings));

      if (result.length === 0) {
        throw new Error(`Settings with ID ${input.id} not found`);
      }

      const row = result[0];
      
      // IMPORTANT: Drizzle ORM doesn't return JSONB fields in .returning()
      // So we use the input settings which are the current/correct values
      const returnValue = {
        id: row.id,
        serverId: row.serverId,
        settings: input.settings, // Use input instead of row.settings which is undefined
        isActive: row.isActive !== undefined ? row.isActive : (input.isActive !== false),
        createdAt: row.createdAt || new Date(),
        updatedAt: row.updatedAt || new Date()
      };
      
      console.log('[ValidationSettingsRepository] Returning settings.aspects.structural:', JSON.stringify(returnValue.settings.aspects?.structural));
      return returnValue;
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
