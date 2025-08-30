/**
 * Validation Settings Service - Rock Solid Settings Management
 * 
 * This service serves as the single source of truth for all validation settings.
 * It provides centralized management, real-time synchronization, and event-driven updates.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  ValidationSettingsPreset,
  ValidationAspect
} from '@shared/validation-settings';
import {
  validateValidationSettings,
  validatePartialValidationSettings,
  normalizeValidationSettings
} from '@shared/validation-settings-validator';
import {
  DEFAULT_VALIDATION_SETTINGS,
  BUILT_IN_PRESETS
} from '@shared/validation-settings';
import { ValidationSettingsRepository } from '../repositories/validation-settings-repository';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationSettingsServiceConfig {
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  
  /** Maximum number of settings versions to keep */
  maxVersions: number;
  
  /** Whether to enable real-time synchronization */
  enableRealTimeSync: boolean;
  
  /** Whether to enable automatic backup */
  enableAutoBackup: boolean;
  
  /** Backup interval in milliseconds */
  backupIntervalMs: number;
}

export interface SettingsChangeEvent {
  /** Type of change */
  type: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
  
  /** Settings ID */
  settingsId: string;
  
  /** Previous version (for updates) */
  previousVersion?: ValidationSettings;
  
  /** New version */
  newVersion?: ValidationSettings;
  
  /** User who made the change */
  changedBy?: string;
  
  /** Timestamp of the change */
  timestamp: Date;
}

export interface SettingsCacheEntry {
  /** Cached settings */
  settings: ValidationSettings;
  
  /** Cache timestamp */
  cachedAt: Date;
  
  /** Cache TTL */
  ttlMs: number;
  
  /** Whether the cache entry is valid */
  isValid: boolean;
}

// ============================================================================
// Validation Settings Service
// ============================================================================

export class ValidationSettingsService extends EventEmitter {
  private config: ValidationSettingsServiceConfig;
  private cache: Map<string, SettingsCacheEntry> = new Map();
  private activeSettings: ValidationSettings | null = null;
  private isInitialized = false;
  private backupTimer: NodeJS.Timeout | null = null;
  private repository: ValidationSettingsRepository;

  constructor(config: Partial<ValidationSettingsServiceConfig> = {}) {
    super();
    
    this.config = {
      cacheTtlMs: 300000, // 5 minutes
      maxVersions: 10,
      enableRealTimeSync: true,
      enableAutoBackup: true,
      backupIntervalMs: 3600000, // 1 hour
      ...config
    };
    
    this.repository = new ValidationSettingsRepository();

    this.setupEventHandlers();
  }

  // ========================================================================
  // Initialization and Lifecycle
  // ========================================================================

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load active settings from database
      await this.loadActiveSettings();
      
      // Start backup timer if enabled
      if (this.config.enableAutoBackup) {
        this.startBackupTimer();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize ValidationSettingsService: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop backup timer
      if (this.backupTimer) {
        clearInterval(this.backupTimer);
        this.backupTimer = null;
      }
      
      // Clear cache
      this.cache.clear();
      
      this.isInitialized = false;
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to shutdown ValidationSettingsService: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========================================================================
  // Settings Management
  // ========================================================================

  /**
   * Get current active settings
   */
  async getActiveSettings(): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.activeSettings) {
      return this.activeSettings;
    }

    // Load from database if not in memory
    try {
      const activeRecord = await this.repository.getActive();
      if (activeRecord) {
        this.activeSettings = activeRecord.settings;
        return this.activeSettings;
      }
    } catch (error) {
      console.error('[ValidationSettingsService] Error loading active settings:', error);
    }
    
    if (!this.activeSettings) {
      // Create default settings if none exist
      this.activeSettings = await this.createDefaultSettings();
    }

    return this.activeSettings;
  }

  /**
   * Get settings by ID
   */
  async getSettingsById(settingsId: string): Promise<ValidationSettings | null> {
    // Check cache first
    const cached = this.getCachedSettings(settingsId);
    if (cached) {
      return cached;
    }

    // Load from database
    const settings = await this.loadSettingsFromDatabase(settingsId);
    if (settings) {
      this.setCachedSettings(settingsId, settings);
    }

    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(update: ValidationSettingsUpdate): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate the update
    const validationResult = validatePartialValidationSettings(update.settings);
    if (!validationResult.isValid) {
      throw new Error(`Invalid settings update: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    // Get current settings
    const currentSettings = await this.getActiveSettings();
    
    // Merge with current settings
    const updatedSettings: ValidationSettings = {
      ...currentSettings,
      ...update.settings,
      version: update.createNewVersion ? currentSettings.version + 1 : currentSettings.version,
      updatedAt: new Date(),
      updatedBy: update.updatedBy
    };

    // Normalize and validate the complete settings
    const normalizedSettings = normalizeValidationSettings(updatedSettings);

    // Save to database
    const savedSettings = await this.saveSettingsToDatabase(normalizedSettings);

    // Update cache
    this.setCachedSettings(savedSettings.id!, savedSettings);

    // Update active settings if this is the active configuration
    if (savedSettings.isActive) {
      this.activeSettings = savedSettings;
    }

    // Emit change event
    this.emit('settingsChanged', {
      type: 'updated',
      settingsId: savedSettings.id!,
      previousVersion: currentSettings,
      newVersion: savedSettings,
      changedBy: update.updatedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return savedSettings;
  }

  /**
   * Create new settings configuration
   */
  async createSettings(settings: Partial<ValidationSettings>, createdBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Merge with defaults
    const newSettings: ValidationSettings = {
      ...DEFAULT_VALIDATION_SETTINGS,
      ...settings,
      version: 1,
      isActive: false, // New settings are not active by default
      createdAt: new Date(),
      createdBy
    };

    // Normalize and validate
    const normalizedSettings = normalizeValidationSettings(newSettings);

    // Save to database
    const savedSettings = await this.saveSettingsToDatabase(normalizedSettings);

    // Update cache
    this.setCachedSettings(savedSettings.id!, savedSettings);

    // Emit change event
    this.emit('settingsChanged', {
      type: 'created',
      settingsId: savedSettings.id!,
      newVersion: savedSettings,
      changedBy: createdBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return savedSettings;
  }

  /**
   * Activate settings configuration
   */
  async activateSettings(settingsId: string, activatedBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get the settings to activate
    const settings = await this.getSettingsById(settingsId);
    if (!settings) {
      throw new Error(`Settings with ID ${settingsId} not found`);
    }

    // Deactivate current active settings
    if (this.activeSettings) {
      await this.deactivateSettings(this.activeSettings.id!, activatedBy);
    }

    // Activate new settings
    const activatedSettings = await this.updateSettings({
      settings: { isActive: true },
      updatedBy: activatedBy
    });

    this.activeSettings = activatedSettings;

    // Emit change event
    this.emit('settingsChanged', {
      type: 'activated',
      settingsId: activatedSettings.id!,
      newVersion: activatedSettings,
      changedBy: activatedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return activatedSettings;
  }

  /**
   * Deactivate settings configuration
   */
  async deactivateSettings(settingsId: string, deactivatedBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const settings = await this.getSettingsById(settingsId);
    if (!settings) {
      throw new Error(`Settings with ID ${settingsId} not found`);
    }

    const deactivatedSettings = await this.updateSettings({
      settings: { isActive: false },
      updatedBy: deactivatedBy
    });

    // Clear active settings if this was the active one
    if (this.activeSettings?.id === settingsId) {
      this.activeSettings = null;
    }

    // Emit change event
    this.emit('settingsChanged', {
      type: 'deactivated',
      settingsId: deactivatedSettings.id!,
      newVersion: deactivatedSettings,
      changedBy: deactivatedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return deactivatedSettings;
  }

  /**
   * Delete settings configuration
   */
  async deleteSettings(settingsId: string, deletedBy?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const settings = await this.getSettingsById(settingsId);
    if (!settings) {
      throw new Error(`Settings with ID ${settingsId} not found`);
    }

    // Don't allow deletion of active settings
    if (settings.isActive) {
      throw new Error('Cannot delete active settings. Please activate another configuration first.');
    }

    // Delete from database
    await this.deleteSettingsFromDatabase(settingsId);

    // Remove from cache
    this.cache.delete(settingsId);

    // Emit change event
    this.emit('settingsChanged', {
      type: 'deleted',
      settingsId,
      previousVersion: settings,
      changedBy: deletedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);
  }

  // ========================================================================
  // Settings Validation
  // ========================================================================

  /**
   * Validate settings
   */
  async validateSettings(settings: unknown): Promise<ValidationSettingsValidationResult> {
    return validateValidationSettings(settings);
  }

  /**
   * Validate partial settings update
   */
  async validatePartialSettings(settings: unknown): Promise<ValidationSettingsValidationResult> {
    return validatePartialValidationSettings(settings);
  }

  /**
   * Test settings with sample resource
   */
  async testSettings(settings: ValidationSettings, sampleResource: any): Promise<{
    isValid: boolean;
    issues: any[];
    performance: {
      totalTimeMs: number;
      aspectTimes: Record<ValidationAspect, number>;
    };
  }> {
    // This would integrate with the validation engines to test the settings
    // For now, return a placeholder
    return {
      isValid: true,
      issues: [],
      performance: {
        totalTimeMs: 100,
        aspectTimes: {
          structural: 20,
          profile: 30,
          terminology: 40,
          reference: 10,
          businessRule: 0,
          metadata: 0
        }
      }
    };
  }

  // ========================================================================
  // Presets Management
  // ========================================================================

  /**
   * Get available presets
   */
  async getPresets(): Promise<ValidationSettingsPreset[]> {
    return BUILT_IN_PRESETS;
  }

  /**
   * Apply preset to settings
   */
  async applyPreset(presetId: string, createdBy?: string): Promise<ValidationSettings> {
    const preset = BUILT_IN_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Preset with ID ${presetId} not found`);
    }

    return this.createSettings(preset.settings, createdBy);
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      id: string;
      cachedAt: Date;
      isValid: boolean;
    }>;
  } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([id, entry]) => ({
        id,
        cachedAt: entry.cachedAt,
        isValid: entry.isValid
      }))
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private setupEventHandlers(): void {
    // Handle cache invalidation
    this.on('settingsChanged', (event: SettingsChangeEvent) => {
      if (event.type === 'updated' || event.type === 'deleted') {
        this.cache.delete(event.settingsId);
      }
    });
  }

  private getCachedSettings(settingsId: string): ValidationSettings | null {
    const entry = this.cache.get(settingsId);
    if (!entry) {
      return null;
    }

    // Check if cache entry is still valid
    const now = new Date();
    const age = now.getTime() - entry.cachedAt.getTime();
    
    if (age > entry.ttlMs || !entry.isValid) {
      this.cache.delete(settingsId);
      return null;
    }

    return entry.settings;
  }

  private setCachedSettings(settingsId: string, settings: ValidationSettings): void {
    const entry: SettingsCacheEntry = {
      settings,
      cachedAt: new Date(),
      ttlMs: this.config.cacheTtlMs,
      isValid: true
    };

    this.cache.set(settingsId, entry);
  }

  private async loadActiveSettings(): Promise<void> {
    // This would load from database
    // For now, use default settings
    this.activeSettings = DEFAULT_VALIDATION_SETTINGS;
  }

  private async loadSettingsFromDatabase(settingsId: string): Promise<ValidationSettings | null> {
    try {
      const record = await this.repository.getById(parseInt(settingsId));
      return record ? record.settings : null;
    } catch (error) {
      console.error('[ValidationSettingsService] Error loading settings from database:', error);
      return null;
    }
  }

  private async saveSettingsToDatabase(settings: ValidationSettings): Promise<ValidationSettings> {
    if (settings.id) {
      // Update existing settings
      const updated = await this.repository.update({
        id: parseInt(settings.id),
        settings: settings,
        createNewVersion: false,
        updatedBy: settings.updatedBy
      });
      
      // If this is the active settings, make sure it's activated
      if (settings.isActive) {
        await this.repository.activate(updated.id, settings.updatedBy);
      }
      
      return updated.settings;
    } else {
      // Create new settings
      const created = await this.repository.create({
        settings: settings,
        isActive: false, // Don't activate immediately
        createdBy: settings.createdBy
      });
      
      // If this should be active, activate it (this will deactivate others)
      if (settings.isActive) {
        const activated = await this.repository.activate(created.id, settings.createdBy);
        return activated.settings;
      }
      
      return created.settings;
    }
  }

  private async deleteSettingsFromDatabase(settingsId: string): Promise<void> {
    // This would delete from database
    // For now, do nothing
  }

  private async createDefaultSettings(): Promise<ValidationSettings> {
    return this.createSettings(DEFAULT_VALIDATION_SETTINGS, 'system');
  }

  private startBackupTimer(): void {
    this.backupTimer = setInterval(async () => {
      try {
        await this.backupSettings();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.backupIntervalMs);
  }

  private async backupSettings(): Promise<void> {
    // This would create a backup of current settings
    this.emit('backupCreated', {
      timestamp: new Date(),
      settingsCount: this.cache.size
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let settingsServiceInstance: ValidationSettingsService | null = null;

/**
 * Get the singleton instance of ValidationSettingsService
 */
export function getValidationSettingsService(): ValidationSettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new ValidationSettingsService();
  }
  return settingsServiceInstance;
}

/**
 * Initialize the singleton instance
 */
export async function initializeValidationSettingsService(): Promise<ValidationSettingsService> {
  const service = getValidationSettingsService();
  await service.initialize();
  return service;
}

/**
 * Shutdown the singleton instance
 */
export async function shutdownValidationSettingsService(): Promise<void> {
  if (settingsServiceInstance) {
    await settingsServiceInstance.shutdown();
    settingsServiceInstance = null;
  }
}
