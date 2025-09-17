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
  expectedVersion?: number; // For optimistic locking
  retryCount?: number; // For retry logic
  changeReason?: string;
  changeType?: 'created' | 'updated' | 'activated' | 'deactivated' | 'migrated' | 'rolled_back';
  tags?: string[];
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
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
  changeReason?: string;
  changeType?: 'created' | 'updated' | 'activated' | 'deactivated' | 'migrated' | 'rolled_back';
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface VersionComparison {
  fromVersion: number;
  toVersion: number;
  changes: SettingsChange[];
  summary: {
    added: number;
    removed: number;
    modified: number;
  };
  hasBreakingChanges: boolean;
  migrationRequired: boolean;
}

export interface AuditTrailEntry {
  id: number;
  settingsId: number;
  version: number;
  action: 'created' | 'updated' | 'activated' | 'deactivated' | 'deleted' | 'migrated' | 'rolled_back';
  performedBy?: string;
  performedAt: Date;
  changeReason?: string;
  changes?: SettingsChange[];
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface VersionTag {
  id: number;
  settingsId: number;
  version: number;
  tag: string;
  description?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface SettingsChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

export interface RepositoryError extends Error {
  code: string;
  retryable: boolean;
  details?: any;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// ============================================================================
// Validation Settings Repository
// ============================================================================

export class ValidationSettingsRepository {
  private retryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 2000,
    backoffMultiplier: 2
  };

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    const options = { ...this.retryOptions, ...retryOptions };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === options.maxRetries) {
          throw this.createRepositoryError(error, operationName);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt),
          options.maxDelayMs
        );

        console.warn(`[ValidationSettingsRepository] ${operationName} failed (attempt ${attempt + 1}/${options.maxRetries + 1}), retrying in ${delay}ms:`, error);
        
        await this.sleep(delay);
      }
    }

    throw this.createRepositoryError(lastError, operationName);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Database connection errors, timeouts, and deadlocks are retryable
    const retryableCodes = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ER_LOCK_DEADLOCK',
      'ER_LOCK_WAIT_TIMEOUT',
      'ER_QUERY_INTERRUPTED'
    ];

    return retryableCodes.some(code => 
      error.code === code || 
      error.message?.includes(code) ||
      error.message?.includes('timeout') ||
      error.message?.includes('connection')
    );
  }

  /**
   * Create repository error with proper typing
   */
  private createRepositoryError(error: any, operation: string): RepositoryError {
    const repoError = new Error(`Repository operation '${operation}' failed: ${error.message}`) as RepositoryError;
    repoError.code = error.code || 'REPOSITORY_ERROR';
    repoError.retryable = this.isRetryableError(error);
    repoError.details = {
      originalError: error,
      operation,
      timestamp: new Date().toISOString()
    };
    return repoError;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  /**
   * Create new validation settings
   */
  async create(input: CreateValidationSettingsInput): Promise<ValidationSettingsRecord> {
    return await this.executeWithRetry(async () => {
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
    }, 'create');
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
   * Get recent validation settings
   */
  async getRecent(limit: number = 10): Promise<ValidationSettingsRecord[]> {
    return await this.executeWithRetry(async () => {
      const results = await db
        .select()
        .from(validationSettings)
        .orderBy(desc(validationSettings.updatedAt))
        .limit(limit);

      return results.map(result => this.mapToRecord(result));
    }, 'getRecent');
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
   * Update validation settings with optimistic locking and comprehensive change tracking
   */
  async update(input: UpdateValidationSettingsInput): Promise<ValidationSettingsRecord> {
    return await this.executeWithRetry(async () => {
    // Get current settings
    const current = await this.getById(input.id);
    if (!current) {
      throw new Error(`Validation settings with ID ${input.id} not found`);
    }

      // Check optimistic locking
      if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
        throw new Error(`Optimistic lock failed: expected version ${input.expectedVersion}, but current version is ${current.version}`);
      }

      // Calculate changes for audit trail
      const changes = this.calculateChanges(current.settings, input.settings);
      const newVersion = input.createNewVersion ? current.version + 1 : current.version;

    // Merge settings
    const updatedSettings = {
      ...current.settings,
      ...input.settings,
        version: newVersion,
      updatedAt: new Date(),
      updatedBy: input.updatedBy
    };

      // Update in database with version check
    const result = await db
      .update(validationSettings)
      .set({
        version: updatedSettings.version,
        settings: updatedSettings as any,
        updatedAt: updatedSettings.updatedAt,
        updatedBy: input.updatedBy
      })
        .where(and(
          eq(validationSettings.id, input.id),
          eq(validationSettings.version, current.version) // Ensure version hasn't changed
        ))
      .returning();

    if (!result[0]) {
        throw new Error('Failed to update validation settings - version may have changed');
      }

      const updatedRecord = this.mapToRecord(result[0]);

      // Create audit trail entry
      await this.createAuditTrailEntry({
        settingsId: input.id,
        version: newVersion,
        action: input.changeType || 'updated',
        performedBy: input.updatedBy,
        performedAt: new Date(),
        changeReason: input.changeReason,
        changes: changes,
        metadata: {
          ...input.metadata,
          previousVersion: current.version,
          hasChanges: changes.length > 0,
          changeCount: changes.length
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });

      // Add version tags if provided
      if (input.tags && input.tags.length > 0) {
        await this.addVersionTags(input.id, newVersion, input.tags, input.updatedBy);
      }

      return updatedRecord;
    }, 'update');
  }

  /**
   * Activate validation settings with transaction and retry logic
   */
  async activate(id: number, activatedBy?: string): Promise<ValidationSettingsRecord> {
    return await this.executeWithRetry(async () => {
      return await db.transaction(async (tx) => {
        // Check if settings exist
        const settings = await tx
          .select()
          .from(validationSettings)
          .where(eq(validationSettings.id, id))
          .limit(1);

        if (!settings[0]) {
          throw new Error(`Validation settings with ID ${id} not found`);
        }

    // Deactivate all other settings first
        await tx
      .update(validationSettings)
      .set({
        isActive: false,
        updatedAt: new Date(),
        updatedBy: activatedBy
      })
      .where(eq(validationSettings.isActive, true));

    // Activate the specified settings
        const result = await tx
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
      });
    }, 'activate');
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
   * Get settings history for a specific configuration with comprehensive change tracking
   */
  async getHistory(id: number): Promise<ValidationSettingsHistory[]> {
    return await this.executeWithRetry(async () => {
    const results = await db
      .select()
      .from(validationSettings)
      .where(eq(validationSettings.id, id))
      .orderBy(desc(validationSettings.version));

      const history: ValidationSettingsHistory[] = [];
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const record = this.mapToRecord(result);
        
        // Calculate changes from previous version
        let changes: SettingsChange[] = [];
        if (i < results.length - 1) {
          const previousResult = results[i + 1];
          changes = this.calculateChanges(previousResult.settings, result.settings);
        }
        
        // Get audit trail for this version
        const auditEntry = await this.getAuditTrailByVersion(id, result.version);
        
        history.push({
          ...record,
          changes,
          changeReason: auditEntry?.changeReason,
          changeType: auditEntry?.action as any,
          tags: await this.getVersionTags(id, result.version),
          metadata: auditEntry?.metadata
        });
      }
      
      return history;
    }, 'getHistory');
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

  /**
   * Execute multiple operations in a single transaction
   */
  async executeTransaction<T>(
    operations: (tx: any) => Promise<T>
  ): Promise<T> {
    return await db.transaction(operations);
  }

  /**
   * Create settings and activate them in a single transaction
   */
  async createAndActivate(
    input: CreateValidationSettingsInput & { activate: true }
  ): Promise<ValidationSettingsRecord> {
    return await db.transaction(async (tx) => {
      // Create new settings
      const createResult = await tx.insert(validationSettings).values({
        version: 1,
        settings: input.settings as any,
        isActive: false, // Don't activate immediately
        createdBy: input.createdBy,
        updatedBy: input.createdBy
      }).returning();

      if (!createResult[0]) {
        throw new Error('Failed to create validation settings');
      }

      const newSettings = this.mapToRecord(createResult[0]);

      // Deactivate all other settings
      await tx
        .update(validationSettings)
        .set({
          isActive: false,
          updatedAt: new Date(),
          updatedBy: input.createdBy
        })
        .where(eq(validationSettings.isActive, true));

      // Activate the new settings
      const activateResult = await tx
        .update(validationSettings)
        .set({
          isActive: true,
          updatedAt: new Date(),
          updatedBy: input.createdBy
        })
        .where(eq(validationSettings.id, newSettings.id))
        .returning();

      if (!activateResult[0]) {
        throw new Error('Failed to activate validation settings');
      }

      return this.mapToRecord(activateResult[0]);
    });
  }

  /**
   * Update settings and handle versioning in a single transaction
   */
  async updateWithVersioning(
    input: UpdateValidationSettingsInput
  ): Promise<ValidationSettingsRecord> {
    return await db.transaction(async (tx) => {
      // Get current settings
      const currentSettings = await tx
        .select()
        .from(validationSettings)
        .where(eq(validationSettings.id, input.id))
        .limit(1);

      if (!currentSettings[0]) {
        throw new Error('Settings not found');
      }

      const current = currentSettings[0];
      const newVersion = input.createNewVersion ? current.version + 1 : current.version;

      // Update settings
      const result = await tx
        .update(validationSettings)
        .set({
          version: newVersion,
          settings: {
            ...current.settings,
            ...input.settings
          } as any,
          updatedAt: new Date(),
          updatedBy: input.updatedBy
        })
        .where(eq(validationSettings.id, input.id))
        .returning();

      if (!result[0]) {
        throw new Error('Failed to update validation settings');
      }

      return this.mapToRecord(result[0]);
    });
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

  /**
   * Compare two versions of settings
   */
  async compareVersions(id: number, fromVersion: number, toVersion: number): Promise<VersionComparison> {
    return await this.executeWithRetry(async () => {
      const fromSettings = await this.getByVersion(id, fromVersion);
      const toSettings = await this.getByVersion(id, toVersion);

      if (!fromSettings || !toSettings) {
        throw new Error(`One or both versions not found: ${fromVersion}, ${toVersion}`);
      }

      const changes = this.calculateChanges(fromSettings.settings, toSettings.settings);
      
      const summary = {
        added: changes.filter(c => c.changeType === 'added').length,
        removed: changes.filter(c => c.changeType === 'removed').length,
        modified: changes.filter(c => c.changeType === 'modified').length
      };

      // Determine if there are breaking changes
      const hasBreakingChanges = this.detectBreakingChanges(changes);
      
      // Determine if migration is required
      const migrationRequired = this.requiresMigration(changes);

      return {
        fromVersion,
        toVersion,
        changes,
        summary,
        hasBreakingChanges,
        migrationRequired
      };
    }, 'compareVersions');
  }

  /**
   * Create audit trail entry
   */
  private async createAuditTrailEntry(entry: Omit<AuditTrailEntry, 'id'>): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO validation_settings_audit_trail (
          settings_id, version, action, performed_by, performed_at, 
          change_reason, changes, metadata, ip_address, user_agent
        ) VALUES (
          ${entry.settingsId}, ${entry.version}, ${entry.action}, 
          ${entry.performedBy || null}, ${entry.performedAt}, 
          ${entry.changeReason || null}, ${JSON.stringify(entry.changes || [])}, 
          ${JSON.stringify(entry.metadata || {})}, 
          ${entry.ipAddress || null}, ${entry.userAgent || null}
        )
      `);
      
      console.log('[ValidationSettingsRepository] Audit trail entry created:', {
        settingsId: entry.settingsId,
        version: entry.version,
        action: entry.action,
        changeCount: entry.changes?.length || 0
      });
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error creating audit trail entry:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Get audit trail by version
   */
  private async getAuditTrailByVersion(settingsId: number, version: number): Promise<AuditTrailEntry | null> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, settings_id, version, action, performed_by, performed_at,
          change_reason, changes, metadata, ip_address, user_agent
        FROM validation_settings_audit_trail
        WHERE settings_id = ${settingsId} AND version = ${version}
        ORDER BY performed_at DESC
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        settingsId: row.settings_id,
        version: row.version,
        action: row.action,
        performedBy: row.performed_by,
        performedAt: row.performed_at,
        changeReason: row.change_reason,
        changes: row.changes,
        metadata: row.metadata,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      };
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting audit trail by version:', error);
      return null;
    }
  }

  /**
   * Add version tags
   */
  private async addVersionTags(settingsId: number, version: number, tags: string[], createdBy?: string): Promise<void> {
    try {
      for (const tag of tags) {
        await db.execute(sql`
          INSERT INTO validation_settings_version_tags (
            settings_id, version, tag, description, created_by
          ) VALUES (
            ${settingsId}, ${version}, ${tag}, ${null}, ${createdBy || null}
          )
          ON CONFLICT (settings_id, version, tag) DO NOTHING
        `);
      }
      
      console.log('[ValidationSettingsRepository] Version tags added:', {
        settingsId,
        version,
        tags,
        createdBy
      });
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error adding version tags:', error);
    }
  }

  /**
   * Get version tags
   */
  private async getVersionTags(settingsId: number, version: number): Promise<string[]> {
    try {
      const result = await db.execute(sql`
        SELECT tag FROM validation_settings_version_tags
        WHERE settings_id = ${settingsId} AND version = ${version}
        ORDER BY created_at
      `);
      
      return result.rows.map(row => row.tag);
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting version tags:', error);
      return [];
    }
  }

  /**
   * Detect breaking changes in settings
   */
  private detectBreakingChanges(changes: SettingsChange[]): boolean {
    const breakingChangePatterns = [
      'validationAspects.structural.enabled',
      'validationAspects.profile.enabled',
      'validationAspects.terminology.enabled',
      'terminologyServers',
      'profileResolutionServers',
      'timeoutSettings.defaultTimeoutMs'
    ];

    return changes.some(change => 
      breakingChangePatterns.some(pattern => 
        change.field.startsWith(pattern) && change.changeType === 'removed'
      )
    );
  }

  /**
   * Determine if migration is required
   */
  private requiresMigration(changes: SettingsChange[]): boolean {
    const migrationRequiredPatterns = [
      'validationAspects',
      'terminologyServers',
      'profileResolutionServers',
      'timeoutSettings',
      'cacheSettings'
    ];

    return changes.some(change => 
      migrationRequiredPatterns.some(pattern => 
        change.field.startsWith(pattern)
      )
    );
  }

  /**
   * Get audit trail for settings
   */
  async getAuditTrail(settingsId: number, limit: number = 50): Promise<AuditTrailEntry[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, settings_id, version, action, performed_by, performed_at,
          change_reason, changes, metadata, ip_address, user_agent
        FROM validation_settings_audit_trail
        WHERE settings_id = ${settingsId}
        ORDER BY performed_at DESC
        LIMIT ${limit}
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        settingsId: row.settings_id,
        version: row.version,
        action: row.action,
        performedBy: row.performed_by,
        performedAt: row.performed_at,
        changeReason: row.change_reason,
        changes: row.changes,
        metadata: row.metadata,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      }));
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting audit trail:', error);
      return [];
    }
  }

  /**
   * Get audit trail by date range
   */
  async getAuditTrailByDateRange(
    settingsId: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<AuditTrailEntry[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, settings_id, version, action, performed_by, performed_at,
          change_reason, changes, metadata, ip_address, user_agent
        FROM validation_settings_audit_trail
        WHERE settings_id = ${settingsId}
          AND performed_at >= ${startDate}
          AND performed_at <= ${endDate}
        ORDER BY performed_at DESC
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        settingsId: row.settings_id,
        version: row.version,
        action: row.action,
        performedBy: row.performed_by,
        performedAt: row.performed_at,
        changeReason: row.change_reason,
        changes: row.changes,
        metadata: row.metadata,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      }));
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting audit trail by date range:', error);
      return [];
    }
  }

  /**
   * Get audit trail by user
   */
  async getAuditTrailByUser(userId: string, limit: number = 50): Promise<AuditTrailEntry[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, settings_id, version, action, performed_by, performed_at,
          change_reason, changes, metadata, ip_address, user_agent
        FROM validation_settings_audit_trail
        WHERE performed_by = ${userId}
        ORDER BY performed_at DESC
        LIMIT ${limit}
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        settingsId: row.settings_id,
        version: row.version,
        action: row.action,
        performedBy: row.performed_by,
        performedAt: row.performed_at,
        changeReason: row.change_reason,
        changes: row.changes,
        metadata: row.metadata,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      }));
    } catch (error) {
      console.error('[ValidationSettingsRepository] Error getting audit trail by user:', error);
      return [];
    }
  }

  private calculateChanges(oldSettings: any, newSettings: any): SettingsChange[] {
    const changes: SettingsChange[] = [];
    
    if (!oldSettings || !newSettings) {
      return changes;
    }

    // Helper function to get nested value
    const getNestedValue = (obj: any, path: string): any => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    // Helper function to set nested value
    const setNestedValue = (obj: any, path: string, value: any): void => {
      const keys = path.split('.');
      const lastKey = keys.pop()!;
      const target = keys.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
      }, obj);
      target[lastKey] = value;
    };

    // Compare all fields in newSettings
    const compareObjects = (oldObj: any, newObj: any, basePath: string = ''): void => {
      for (const key in newObj) {
        const currentPath = basePath ? `${basePath}.${key}` : key;
        const oldValue = getNestedValue(oldObj, currentPath);
        const newValue = newObj[key];

        if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
          // Recursively compare nested objects
          compareObjects(oldObj, newValue, currentPath);
        } else if (Array.isArray(newValue)) {
          // Compare arrays
          if (!Array.isArray(oldValue) || JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({
              field: currentPath,
              oldValue,
              newValue,
              changeType: oldValue === undefined ? 'added' : 'modified'
            });
          }
        } else {
          // Compare primitive values
          if (oldValue !== newValue) {
            changes.push({
              field: currentPath,
              oldValue,
              newValue,
              changeType: oldValue === undefined ? 'added' : 
                         newValue === undefined ? 'removed' : 'modified'
            });
          }
        }
      }

      // Check for removed fields
      for (const key in oldObj) {
        const currentPath = basePath ? `${basePath}.${key}` : key;
        const oldValue = getNestedValue(oldObj, currentPath);
        const newValue = getNestedValue(newObj, currentPath);

        if (newValue === undefined && oldValue !== undefined) {
          changes.push({
            field: currentPath,
            oldValue,
            newValue,
            changeType: 'removed'
          });
        }
      }
    };

    compareObjects(oldSettings, newSettings);
    return changes;
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
