/**
 * Validation Settings Service - Unified Settings Management
 * 
 * This service orchestrates all validation settings functionality by combining
 * core settings management, caching, presets, and other specialized services.
 * It provides a unified API for all validation settings operations.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  ValidationSettingsPreset
} from '@shared/validation-settings';
import { ValidationSettingsCoreService } from './settings-core-service';
import { ValidationSettingsCacheService } from './settings-cache-service';
import { ValidationSettingsPresetService } from './settings-preset-service';

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
  
  /** Maximum cache size */
  maxCacheSize: number;
  
  /** Whether to enable cache metrics */
  enableCacheMetrics: boolean;
}

export class ValidationSettingsService extends EventEmitter {
  private config: ValidationSettingsServiceConfig;
  private coreService: ValidationSettingsCoreService;
  private cacheService: ValidationSettingsCacheService;
  private presetService: ValidationSettingsPresetService;
  private isInitialized = false;

  constructor(config: Partial<ValidationSettingsServiceConfig> = {}) {
    super();
    
    this.config = {
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
      maxVersions: 10,
      enableRealTimeSync: true,
      enableAutoBackup: true,
      backupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      maxCacheSize: 100,
      enableCacheMetrics: true,
      ...config
    };
    
    // Initialize sub-services
    this.coreService = new ValidationSettingsCoreService({
      enableRealTimeSync: this.config.enableRealTimeSync,
      enableAutoBackup: this.config.enableAutoBackup,
      backupIntervalMs: this.config.backupIntervalMs
    });
    
    this.cacheService = new ValidationSettingsCacheService({
      cacheTtlMs: this.config.cacheTtlMs,
      maxCacheSize: this.config.maxCacheSize,
      enableMetrics: this.config.enableCacheMetrics
    });
    
    this.presetService = new ValidationSettingsPresetService();
    
    // Forward events from sub-services
    this.setupEventForwarding();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize all sub-services
      await Promise.all([
        this.coreService.initialize(),
        this.cacheService.initialize(),
        this.presetService.initialize()
      ]);
      
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
      // Shutdown all sub-services
      await Promise.all([
        this.coreService.shutdown(),
        this.cacheService.shutdown(),
        this.presetService.shutdown()
      ]);
      
      this.isInitialized = false;
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to shutdown ValidationSettingsService: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========================================================================
  // Settings Management (Delegated to Core Service)
  // ========================================================================

  /**
   * Get current active settings
   */
  async getActiveSettings(): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try cache first
    const cached = this.cacheService.getCachedSettings('active');
    if (cached) {
      return cached;
    }

    // Get from core service
    const settings = await this.coreService.getActiveSettings();
    
    // Cache the result
    this.cacheService.cacheSettings('active', settings);
    
    return settings;
  }

  /**
   * Get settings by ID
   */
  async getSettingsById(settingsId: string): Promise<ValidationSettings | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try cache first
    const cached = this.cacheService.getCachedSettings(settingsId);
    if (cached) {
      return cached;
    }

    // Get from core service
    const settings = await this.coreService.getSettingsById(settingsId);
    
    // Cache the result if found
    if (settings) {
      this.cacheService.cacheSettings(settingsId, settings);
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

    // Update via core service
    const updatedSettings = await this.coreService.updateSettings(update);
    
    // Invalidate cache
    this.cacheService.invalidateCache('active');
    
    return updatedSettings;
  }

  /**
   * Create new settings
   */
  async createSettings(settings: Partial<ValidationSettings>, createdBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Create via core service
    const newSettings = await this.coreService.createSettings(settings, createdBy);
    
    return newSettings;
  }

  /**
   * Delete settings
   */
  async deleteSettings(settingsId: string, deletedBy?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Delete via core service
    await this.coreService.deleteSettings(settingsId, deletedBy);
    
    // Invalidate cache
    this.cacheService.invalidateCache(settingsId);
  }

  /**
   * Validate settings
   */
  async validateSettings(settings: unknown): Promise<ValidationSettingsValidationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.coreService.validateSettings(settings);
  }

  // ========================================================================
  // Preset Management (Delegated to Preset Service)
  // ========================================================================

  /**
   * Get all built-in presets
   */
  getBuiltInPresets(): ValidationSettingsPreset[] {
    return this.presetService.getBuiltInPresets();
  }

  /**
   * Get built-in preset by ID
   */
  getBuiltInPreset(presetId: string): ValidationSettingsPreset | null {
    return this.presetService.getBuiltInPreset(presetId);
  }

  /**
   * Apply built-in preset
   */
  async applyBuiltInPreset(presetId: string, createdBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result = await this.presetService.applyBuiltInPreset(presetId, createdBy);
    if (!result.success || !result.settings) {
      throw new Error(result.error || 'Failed to apply built-in preset');
    }

    // Invalidate cache
    this.cacheService.invalidateCache('active');
    
    return result.settings;
  }

  /**
   * Get all custom presets
   */
  getCustomPresets() {
    return this.presetService.getCustomPresets();
  }

  /**
   * Create custom preset
   */
  async createCustomPreset(
    name: string,
    description: string,
    settings: ValidationSettings,
    createdBy: string
  ) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.presetService.createCustomPreset(name, description, settings, createdBy);
  }

  /**
   * Apply custom preset
   */
  async applyCustomPreset(presetId: string, createdBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result = await this.presetService.applyCustomPreset(presetId, createdBy);
    if (!result.success || !result.settings) {
      throw new Error(result.error || 'Failed to apply custom preset');
    }

    // Invalidate cache
    this.cacheService.invalidateCache('active');
    
    return result.settings;
  }

  // ========================================================================
  // Cache Management (Delegated to Cache Service)
  // ========================================================================

  /**
   * Get cache metrics
   */
  getCacheMetrics() {
    return this.cacheService.getCacheMetrics();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getCacheStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cacheService.clearCache();
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Get service health status
   */
  getHealthStatus(): {
    isInitialized: boolean;
    coreService: boolean;
    cacheService: boolean;
    presetService: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      coreService: this.coreService !== null,
      cacheService: this.cacheService !== null,
      presetService: this.presetService !== null
    };
  }

  /**
   * Get service configuration
   */
  getConfig(): ValidationSettingsServiceConfig {
    return { ...this.config };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Setup event forwarding from sub-services
   */
  private setupEventForwarding(): void {
    // Forward core service events
    this.coreService.on('settingsChanged', (event) => {
      this.emit('settingsChanged', event);
    });

    // Forward cache service events
    this.cacheService.on('cacheWarmed', (event) => {
      this.emit('cacheWarmed', event);
    });

    this.cacheService.on('cacheCleaned', (event) => {
      this.emit('cacheCleaned', event);
    });

    // Forward preset service events
    this.presetService.on('presetApplied', (event) => {
      this.emit('presetApplied', event);
    });

    this.presetService.on('customPresetCreated', (event) => {
      this.emit('customPresetCreated', event);
    });
  }

  /**
   * Get current validation settings
   */
  async getCurrentSettings(): Promise<ValidationSettings> {
    return this.coreService.getSettings();
  }

  /**
   * Get settings (alias for getCurrentSettings for backward compatibility)
   */
  async getSettings(): Promise<ValidationSettings> {
    return this.getCurrentSettings();
  }

  /**
   * Notify settings change (for polling-based notifications)
   */
  async notifySettingsChange(changeType: string, details?: any): Promise<void> {
    try {
      console.log(`[ValidationSettingsService] Settings change notification: ${changeType}`, details);
      // Emit event for any listeners
      this.emit('settingsChanged', { changeType, details, timestamp: new Date() });
    } catch (error) {
      console.error('[ValidationSettingsService] Failed to notify settings change:', error);
      throw error;
    }
  }
}

// Factory function for backward compatibility
let validationSettingsServiceInstance: ValidationSettingsService | null = null;

export function getValidationSettingsService(): ValidationSettingsService {
  if (!validationSettingsServiceInstance) {
    validationSettingsServiceInstance = new ValidationSettingsService();
  }
  return validationSettingsServiceInstance;
}
