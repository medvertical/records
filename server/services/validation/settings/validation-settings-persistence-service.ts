/**
 * Validation Settings Persistence Service
 * 
 * Handles persistent storage and retrieval of validation settings with proper
 * server scoping and data isolation.
 */

import { EventEmitter } from 'events';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { ValidationSettingsRepository } from '../../../repositories/validation-settings-repository-simplified';
import { getActiveServerId, getActiveServer } from '../../../utils/server-scoping';

export interface ValidationSettingsPersistenceConfig {
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  
  /** Maximum cache size */
  maxCacheSize: number;
  
  /** Whether to enable automatic backup */
  enableAutoBackup: boolean;
  
  /** Backup interval in milliseconds */
  backupIntervalMs: number;
  
  /** Maximum number of backups to keep */
  maxBackups: number;
  
  /** Whether to enable server scoping */
  enableServerScoping: boolean;
  
  /** Whether to enable settings migration */
  enableMigration: boolean;
}

export interface ValidationSettingsBackup {
  id: string;
  serverId: number;
  settings: ValidationSettings;
  timestamp: Date;
  version: string;
  description?: string;
}

export interface ValidationSettingsPersistenceResult {
  success: boolean;
  settings?: ValidationSettings;
  error?: string;
  serverId?: number;
  timestamp?: Date;
  backupId?: string;
}

export class ValidationSettingsPersistenceService extends EventEmitter {
  private config: ValidationSettingsPersistenceConfig;
  private repository: ValidationSettingsRepository;
  private isInitialized = false;
  private cache: Map<string, { settings: ValidationSettings; timestamp: number }> = new Map();
  private backupTimer: NodeJS.Timeout | null = null;
  private currentServerId: number | null = null;

  constructor(config: Partial<ValidationSettingsPersistenceConfig> = {}) {
    super();
    
    this.config = {
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 100,
      enableAutoBackup: true,
      backupIntervalMs: 30 * 60 * 1000, // 30 minutes
      maxBackups: 10,
      enableServerScoping: true,
      enableMigration: true,
      ...config
    };
    
    this.repository = new ValidationSettingsRepository();
  }

  /**
   * Initialize the persistence service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get current active server
      if (this.config.enableServerScoping) {
        this.currentServerId = await getActiveServerId();
        console.log(`[ValidationSettingsPersistence] Initialized for server ID: ${this.currentServerId}`);
      }

      // Start auto-backup if enabled
      if (this.config.enableAutoBackup) {
        this.startAutoBackup();
      }

      this.isInitialized = true;
      this.emit('initialized', { serverId: this.currentServerId });
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Save validation settings with proper server scoping
   */
  async saveSettings(
    settings: ValidationSettings, 
    serverId?: number,
    options: { createBackup?: boolean; description?: string } = {}
  ): Promise<ValidationSettingsPersistenceResult> {
    await this.ensureInitialized();

    try {
      const targetServerId = serverId || this.currentServerId;
      if (!targetServerId) {
        throw new Error('No server ID available for settings persistence');
      }

      // Create backup if requested
      let backupId: string | undefined;
      if (options.createBackup) {
        backupId = await this.createBackup(targetServerId, settings, options.description);
      }

      // Save settings to database
      await this.repository.saveSettings(settings, targetServerId);

      // Update cache
      const cacheKey = this.getCacheKey(targetServerId);
      this.cache.set(cacheKey, {
        settings,
        timestamp: Date.now()
      });

      // Clean up cache if needed
      this.cleanupCache();

      const result: ValidationSettingsPersistenceResult = {
        success: true,
        settings,
        serverId: targetServerId,
        timestamp: new Date(),
        backupId
      };

      this.emit('settingsSaved', result);
      return result;
    } catch (error) {
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      this.emit('settingsSaveError', result);
      return result;
    }
  }

  /**
   * Load validation settings with proper server scoping
   */
  async loadSettings(serverId?: number): Promise<ValidationSettingsPersistenceResult> {
    await this.ensureInitialized();

    try {
      const targetServerId = serverId || this.currentServerId;
      if (!targetServerId) {
        throw new Error('No server ID available for settings loading');
      }

      // Check cache first
      const cacheKey = this.getCacheKey(targetServerId);
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached.timestamp)) {
        const result: ValidationSettingsPersistenceResult = {
          success: true,
          settings: cached.settings,
          serverId: targetServerId,
          timestamp: new Date(cached.timestamp)
        };

        this.emit('settingsLoaded', result);
        return result;
      }

      // Load from database
      const settings = await this.repository.getSettings(targetServerId);

      // Update cache
      this.cache.set(cacheKey, {
        settings,
        timestamp: Date.now()
      });

      const result: ValidationSettingsPersistenceResult = {
        success: true,
        settings,
        serverId: targetServerId,
        timestamp: new Date()
      };

      this.emit('settingsLoaded', result);
      return result;
    } catch (error) {
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      this.emit('settingsLoadError', result);
      return result;
    }
  }

  /**
   * Delete validation settings for a specific server
   */
  async deleteSettings(serverId?: number): Promise<ValidationSettingsPersistenceResult> {
    await this.ensureInitialized();

    try {
      const targetServerId = serverId || this.currentServerId;
      if (!targetServerId) {
        throw new Error('No server ID available for settings deletion');
      }

      // Delete from database
      await this.repository.deleteSettings(targetServerId);

      // Remove from cache
      const cacheKey = this.getCacheKey(targetServerId);
      this.cache.delete(cacheKey);

      const result: ValidationSettingsPersistenceResult = {
        success: true,
        serverId: targetServerId,
        timestamp: new Date()
      };

      this.emit('settingsDeleted', result);
      return result;
    } catch (error) {
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      this.emit('settingsDeleteError', result);
      return result;
    }
  }

  /**
   * Create a backup of current settings
   */
  async createBackup(
    serverId: number, 
    settings: ValidationSettings, 
    description?: string
  ): Promise<string> {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const backup: ValidationSettingsBackup = {
      id: backupId,
      serverId,
      settings,
      timestamp: new Date(),
      version: '1.0.0',
      description
    };

    // Save backup to database
    await this.repository.saveBackup(backup);

    this.emit('backupCreated', backup);
    return backupId;
  }

  /**
   * Restore settings from a backup
   */
  async restoreFromBackup(backupId: string, serverId?: number): Promise<ValidationSettingsPersistenceResult> {
    await this.ensureInitialized();

    try {
      const targetServerId = serverId || this.currentServerId;
      if (!targetServerId) {
        throw new Error('No server ID available for backup restoration');
      }

      // Load backup
      const backup = await this.repository.getBackup(backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Verify server ID matches
      if (backup.serverId !== targetServerId) {
        throw new Error(`Backup server ID (${backup.serverId}) does not match target server ID (${targetServerId})`);
      }

      // Restore settings
      const result = await this.saveSettings(backup.settings, targetServerId, {
        createBackup: true,
        description: `Restored from backup: ${backupId}`
      });

      this.emit('settingsRestored', { backupId, result });
      return result;
    } catch (error) {
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      this.emit('settingsRestoreError', result);
      return result;
    }
  }

  /**
   * Get list of available backups for a server
   */
  async getBackups(serverId?: number): Promise<ValidationSettingsBackup[]> {
    await this.ensureInitialized();

    const targetServerId = serverId || this.currentServerId;
    if (!targetServerId) {
      throw new Error('No server ID available for backup listing');
    }

    return await this.repository.getBackups(targetServerId);
  }

  /**
   * Migrate settings from one server to another
   */
  async migrateSettings(
    fromServerId: number, 
    toServerId: number,
    options: { createBackup?: boolean; description?: string } = {}
  ): Promise<ValidationSettingsPersistenceResult> {
    await this.ensureInitialized();

    try {
      // Load settings from source server
      const sourceResult = await this.loadSettings(fromServerId);
      if (!sourceResult.success || !sourceResult.settings) {
        throw new Error(`Failed to load settings from server ${fromServerId}: ${sourceResult.error}`);
      }

      // Save settings to target server
      const targetResult = await this.saveSettings(sourceResult.settings, toServerId, {
        createBackup: options.createBackup,
        description: options.description || `Migrated from server ${fromServerId}`
      });

      this.emit('settingsMigrated', { fromServerId, toServerId, result: targetResult });
      return targetResult;
    } catch (error) {
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      this.emit('settingsMigrationError', result);
      return result;
    }
  }

  /**
   * Get settings statistics for a server
   */
  async getSettingsStatistics(serverId?: number): Promise<{
    serverId: number;
    hasSettings: boolean;
    lastModified?: Date;
    backupCount: number;
    cacheSize: number;
  }> {
    await this.ensureInitialized();

    const targetServerId = serverId || this.currentServerId;
    if (!targetServerId) {
      throw new Error('No server ID available for statistics');
    }

    const hasSettings = await this.repository.hasSettings(targetServerId);
    const lastModified = await this.repository.getLastModified(targetServerId);
    const backups = await this.repository.getBackups(targetServerId);
    const cacheSize = this.cache.size;

    return {
      serverId: targetServerId,
      hasSettings,
      lastModified,
      backupCount: backups.length,
      cacheSize
    };
  }

  /**
   * Clear cache for a specific server or all servers
   */
  clearCache(serverId?: number): void {
    if (serverId) {
      const cacheKey = this.getCacheKey(serverId);
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }

    this.emit('cacheCleared', { serverId });
  }

  /**
   * Update current server ID when server changes
   */
  async updateCurrentServer(serverId: number): Promise<void> {
    if (this.config.enableServerScoping) {
      this.currentServerId = serverId;
      console.log(`[ValidationSettingsPersistence] Updated current server ID: ${serverId}`);
      this.emit('serverChanged', { serverId });
    }
  }

  /**
   * Start automatic backup timer
   */
  private startAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(async () => {
      try {
        if (this.currentServerId) {
          const result = await this.loadSettings(this.currentServerId);
          if (result.success && result.settings) {
            await this.createBackup(
              this.currentServerId, 
              result.settings, 
              'Automatic backup'
            );
          }
        }
      } catch (error) {
        console.error('[ValidationSettingsPersistence] Auto-backup failed:', error);
      }
    }, this.config.backupIntervalMs);

    console.log(`[ValidationSettingsPersistence] Auto-backup started (interval: ${this.config.backupIntervalMs}ms)`);
  }

  /**
   * Stop automatic backup timer
   */
  private stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
      console.log('[ValidationSettingsPersistence] Auto-backup stopped');
    }
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Get cache key for a server
   */
  private getCacheKey(serverId: number): string {
    return `settings_${serverId}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.config.cacheTtlMs;
  }

  /**
   * Clean up cache if it exceeds maximum size
   */
  private cleanupCache(): void {
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, entries.length - this.config.maxCacheSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoBackup();
    this.cache.clear();
    this.isInitialized = false;
    this.emit('destroyed');
  }
}

/**
 * Global validation settings persistence service instance
 */
let globalPersistenceService: ValidationSettingsPersistenceService | null = null;

/**
 * Get the global validation settings persistence service instance
 */
export function getValidationSettingsPersistenceService(): ValidationSettingsPersistenceService {
  if (!globalPersistenceService) {
    globalPersistenceService = new ValidationSettingsPersistenceService();
  }
  return globalPersistenceService;
}

/**
 * Initialize the global validation settings persistence service
 */
export async function initializeValidationSettingsPersistence(): Promise<void> {
  const service = getValidationSettingsPersistenceService();
  await service.initialize();
}

/**
 * Destroy the global validation settings persistence service
 */
export function destroyValidationSettingsPersistence(): void {
  if (globalPersistenceService) {
    globalPersistenceService.destroy();
    globalPersistenceService = null;
  }
}

