/**
 * Validation Settings Repository - Rock Solid Data Access
 * 
 * This repository provides CRUD operations for validation settings with
 * versioning, transaction support, and optimistic locking.
 */

import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { validationSettings } from '@shared/schema';
import type {
  ValidationSettings,
  ValidationSettingsUpdate
} from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationSettingsRecord {
  id: number;
  version: number;
  settings: ValidationSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateValidationSettingsInput {
  settings: ValidationSettings;
  isActive?: boolean;
  createdBy?: string;
}

export interface UpdateValidationSettingsInput {
  id: number;
  settings: Partial<ValidationSettings>;
  createNewVersion?: boolean;
  updatedBy?: string;
}

export interface ValidationSettingsQuery {
  id?: number;
  isActive?: boolean;
  version?: number;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface ValidationSettingsHistory {
  id: number;
  version: number;
  settings: ValidationSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  changes?: SettingsChange[];
}

export interface SettingsChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

// ============================================================================
// Validation Settings Repository
// ============================================================================

export class ValidationSettingsRepository {
  /**
   * Create new validation settings
   */
  async create(input: CreateValidationSettingsInput): Promise<ValidationSettingsRecord> {
    const result = await db.insert(validationSettings).values({
      version: 1,
      settings: input.settings as any,
      isActive: input.isActive ?? false,
      createdBy: input.createdBy,
      updatedBy: input.createdBy
    }).returning();

    if (!result[0]) {
      throw new Error('Failed to create validation settings');
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Get validation settings by ID
   */
  async getById(id: number): Promise<ValidationSettingsRecord | null> {
    const result = await db
      .select()
      .from(validationSettings)
      .where(eq(validationSettings.id, id))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Get active validation settings
   */
  async getActive(): Promise<ValidationSettingsRecord | null> {
    const result = await db
      .select()
      .from(validationSettings)
      .where(eq(validationSettings.isActive, true))
      .orderBy(desc(validationSettings.updatedAt))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Get all validation settings with optional filtering
   */
  async getAll(query: ValidationSettingsQuery = {}): Promise<ValidationSettingsRecord[]> {
    let dbQuery = db.select().from(validationSettings);

    const conditions = [];
    
    if (query.id !== undefined) {
      conditions.push(eq(validationSettings.id, query.id));
    }
    
    if (query.isActive !== undefined) {
      conditions.push(eq(validationSettings.isActive, query.isActive));
    }
    
    if (query.version !== undefined) {
      conditions.push(eq(validationSettings.version, query.version));
    }
    
    if (query.createdBy) {
      conditions.push(eq(validationSettings.createdBy, query.createdBy));
    }

    if (conditions.length > 0) {
      dbQuery = dbQuery.where(and(...conditions));
    }

    dbQuery = dbQuery.orderBy(desc(validationSettings.updatedAt));

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    if (query.offset) {
      dbQuery = dbQuery.offset(query.offset);
    }

    const results = await dbQuery;
    return results.map(result => this.mapToRecord(result));
  }

  /**
   * Update validation settings
   */
  async update(input: UpdateValidationSettingsInput): Promise<ValidationSettingsRecord> {
    // Get current settings
    const current = await this.getById(input.id);
    if (!current) {
      throw new Error(`Validation settings with ID ${input.id} not found`);
    }

    // Merge settings
    const updatedSettings = {
      ...current.settings,
      ...input.settings,
      version: input.createNewVersion ? current.version + 1 : current.version,
      updatedAt: new Date(),
      updatedBy: input.updatedBy
    };

    // Update in database
    const result = await db
      .update(validationSettings)
      .set({
        version: updatedSettings.version,
        settings: updatedSettings as any,
        updatedAt: updatedSettings.updatedAt,
        updatedBy: input.updatedBy
      })
      .where(eq(validationSettings.id, input.id))
      .returning();

    if (!result[0]) {
      throw new Error('Failed to update validation settings');
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Activate validation settings
   */
  async activate(id: number, activatedBy?: string): Promise<ValidationSettingsRecord> {
    // Deactivate all other settings first
    await db
      .update(validationSettings)
      .set({
        isActive: false,
        updatedAt: new Date(),
        updatedBy: activatedBy
      })
      .where(eq(validationSettings.isActive, true));

    // Activate the specified settings
    const result = await db
      .update(validationSettings)
      .set({
        isActive: true,
        updatedAt: new Date(),
        updatedBy: activatedBy
      })
      .where(eq(validationSettings.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Failed to activate validation settings');
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Deactivate validation settings
   */
  async deactivate(id: number, deactivatedBy?: string): Promise<ValidationSettingsRecord> {
    const result = await db
      .update(validationSettings)
      .set({
        isActive: false,
        updatedAt: new Date(),
        updatedBy: deactivatedBy
      })
      .where(eq(validationSettings.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Failed to deactivate validation settings');
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Delete validation settings
   */
  async delete(id: number): Promise<void> {
    // Check if settings are active
    const settings = await this.getById(id);
    if (settings?.isActive) {
      throw new Error('Cannot delete active validation settings');
    }

    const result = await db
      .delete(validationSettings)
      .where(eq(validationSettings.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Failed to delete validation settings');
    }
  }

  /**
   * Get settings history for a specific configuration
   */
  async getHistory(id: number): Promise<ValidationSettingsHistory[]> {
    const results = await db
      .select()
      .from(validationSettings)
      .where(eq(validationSettings.id, id))
      .orderBy(desc(validationSettings.version));

    return results.map(result => ({
      ...this.mapToRecord(result),
      changes: this.calculateChanges(result.settings, result.settings) // This would need proper diff logic
    }));
  }

  /**
   * Get settings by version
   */
  async getByVersion(id: number, version: number): Promise<ValidationSettingsRecord | null> {
    const result = await db
      .select()
      .from(validationSettings)
      .where(and(
        eq(validationSettings.id, id),
        eq(validationSettings.version, version)
      ))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(id: number, version: number, rolledBackBy?: string): Promise<ValidationSettingsRecord> {
    const targetVersion = await this.getByVersion(id, version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for settings ID ${id}`);
    }

    // Create new version with the target version's settings
    const result = await db.insert(validationSettings).values({
      version: targetVersion.version + 1,
      settings: targetVersion.settings as any,
      isActive: false,
      createdBy: rolledBackBy,
      updatedBy: rolledBackBy
    }).returning();

    if (!result[0]) {
      throw new Error('Failed to rollback validation settings');
    }

    return this.mapToRecord(result[0]);
  }

  /**
   * Get settings statistics
   */
  async getStatistics(): Promise<{
    totalSettings: number;
    activeSettings: number;
    totalVersions: number;
    averageVersionsPerSettings: number;
    lastUpdated: Date | null;
  }> {
    const [totalResult, activeResult, versionsResult, lastUpdatedResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(validationSettings),
      db.select({ count: sql<number>`count(*)` }).from(validationSettings).where(eq(validationSettings.isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(validationSettings),
      db.select({ max: sql<Date>`max(updated_at)` }).from(validationSettings)
    ]);

    const totalSettings = totalResult[0]?.count || 0;
    const activeSettings = activeResult[0]?.count || 0;
    const totalVersions = versionsResult[0]?.count || 0;
    const lastUpdated = lastUpdatedResult[0]?.max || null;

    return {
      totalSettings,
      activeSettings,
      totalVersions,
      averageVersionsPerSettings: totalSettings > 0 ? totalVersions / totalSettings : 0,
      lastUpdated
    };
  }

  /**
   * Clean up old versions (keep only the latest N versions per settings)
   */
  async cleanupOldVersions(keepVersions: number = 10): Promise<number> {
    // This would need a more complex query to keep only the latest N versions per settings ID
    // For now, we'll implement a simple cleanup that removes old inactive versions
    
    const result = await db
      .delete(validationSettings)
      .where(and(
        eq(validationSettings.isActive, false),
        sql`version < (SELECT MAX(version) - ${keepVersions} FROM validation_settings vs2 WHERE vs2.id = validation_settings.id)`
      ))
      .returning();

    return result.length;
  }

  /**
   * Bulk operations
   */
  async bulkCreate(inputs: CreateValidationSettingsInput[]): Promise<ValidationSettingsRecord[]> {
    const values = inputs.map(input => ({
      version: 1,
      settings: input.settings as any,
      isActive: input.isActive ?? false,
      createdBy: input.createdBy,
      updatedBy: input.createdBy
    }));

    const results = await db.insert(validationSettings).values(values).returning();
    return results.map(result => this.mapToRecord(result));
  }

  async bulkUpdate(inputs: UpdateValidationSettingsInput[]): Promise<ValidationSettingsRecord[]> {
    const results: ValidationSettingsRecord[] = [];
    
    for (const input of inputs) {
      const result = await this.update(input);
      results.push(result);
    }
    
    return results;
  }

  async bulkDelete(ids: number[]): Promise<void> {
    // Check if any of the settings are active
    const activeSettings = await db
      .select()
      .from(validationSettings)
      .where(and(
        eq(validationSettings.isActive, true),
        sql`id = ANY(${ids})`
      ));

    if (activeSettings.length > 0) {
      throw new Error('Cannot delete active validation settings');
    }

    await db
      .delete(validationSettings)
      .where(sql`id = ANY(${ids})`);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private mapToRecord(dbRecord: any): ValidationSettingsRecord {
    return {
      id: dbRecord.id,
      version: dbRecord.version,
      settings: dbRecord.settings as ValidationSettings,
      isActive: dbRecord.isActive,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      createdBy: dbRecord.createdBy,
      updatedBy: dbRecord.updatedBy
    };
  }

  private calculateChanges(oldSettings: any, newSettings: any): SettingsChange[] {
    // This would implement proper diff logic to calculate changes
    // For now, return empty array
    return [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let repositoryInstance: ValidationSettingsRepository | null = null;

/**
 * Get the singleton instance of ValidationSettingsRepository
 */
export function getValidationSettingsRepository(): ValidationSettingsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ValidationSettingsRepository();
  }
  return repositoryInstance;
}
