/**
 * Simplified Validation Settings Service
 * 
 * This service provides basic CRUD operations for validation settings
 * without versioning, audit trails, or complex history management.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  ValidationSettingsPreset
} from '@shared/validation-settings-simplified';
import { DEFAULT_VALIDATION_SETTINGS } from '@shared/validation-settings-simplified';
import { ValidationSettingsRepository } from '../../../repositories/validation-settings-repository-simplified';

export interface ValidationSettingsServiceConfig {
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  
  /** Maximum cache size */
  maxCacheSize: number;
}

export class ValidationSettingsService extends EventEmitter {
  private config: ValidationSettingsServiceConfig;
  private repository: ValidationSettingsRepository;
  private isInitialized = false;
  private currentSettings: ValidationSettings | null = null;
  private lastCacheTime: number = 0;

  constructor(config: Partial<ValidationSettingsServiceConfig> = {}) {
    super();
    
    this.config = {
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 100,
      ...config
    };
    
    this.repository = new ValidationSettingsRepository();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load current settings
      await this.loadCurrentSettings();
      this.isInitialized = true;
      
      this.emit('initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Get current validation settings
   */
  async getCurrentSettings(): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    // Check cache
    if (this.currentSettings && this.isCacheValid()) {
      return this.currentSettings;
    }
    
    // Load from database
    await this.loadCurrentSettings();
    return this.currentSettings!;
  }

  /**
   * Update validation settings
   */
  async updateSettings(update: ValidationSettingsUpdate): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    try {
      // Get current settings
      const currentSettings = await this.getCurrentSettings();
      
      // Merge with update - settings are at top level, not nested
      const updatedSettings: ValidationSettings = {
        ...currentSettings,
        ...update.settings
      };
      
      // Validate the updated settings (only if validation is enabled)
      if (update.validate !== false) {
        const validation = this.validateSettings(updatedSettings);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
      }
      
      // Save to database
      const savedSettings = await this.repository.createOrUpdate(updatedSettings);
      
      // Update cache
      this.currentSettings = savedSettings;
      this.lastCacheTime = Date.now();
      
      // Emit event
      this.emit('settingsChanged', {
        type: 'updated',
        data: this.currentSettings
      });
      
      return this.currentSettings;
    } catch (error) {
      this.emit('updateError', error);
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    try {
      const defaultSettings = { ...DEFAULT_VALIDATION_SETTINGS };
      const savedSettings = await this.repository.createOrUpdate(defaultSettings);
      
      // Update cache
      this.currentSettings = savedSettings;
      this.lastCacheTime = Date.now();
      
      // Emit event
      this.emit('settingsReset', {
        newSettings: savedSettings
      });
      
      return savedSettings;
    } catch (error) {
      this.emit('resetError', error);
      throw error;
    }
  }

  /**
   * Apply a preset
   */
  async applyPreset(presetId: string): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    try {
      const preset = this.getPreset(presetId);
      if (!preset) {
        throw new Error(`Preset not found: ${presetId}`);
      }
      
      const currentSettings = await this.getCurrentSettings();
      const updatedSettings: ValidationSettings = {
        ...currentSettings,
        ...preset.settings
      };
      
      return await this.updateSettings({ settings: updatedSettings });
    } catch (error) {
      this.emit('presetError', error);
      throw error;
    }
  }

  /**
   * Get available presets
   */
  getPresets(): ValidationSettingsPreset[] {
    return BUILT_IN_PRESETS;
  }

  /**
   * Get a specific preset
   */
  getPreset(presetId: string): ValidationSettingsPreset | null {
    return BUILT_IN_PRESETS.find(preset => preset.id === presetId) || null;
  }

  /**
   * Validate settings
   */
  validateSettings(settings: ValidationSettings): ValidationSettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    if (!settings.aspects) {
      errors.push('Aspects configuration is required');
    }
    
    if (!settings.server) {
      errors.push('Server configuration is required');
    }
    
    if (!settings.performance) {
      errors.push('Performance configuration is required');
    }
    
    // Check aspect configurations
    if (settings.aspects) {
      const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
      for (const aspect of aspects) {
        const aspectConfig = (settings.aspects as any)[aspect];
        if (aspectConfig) {
          if (typeof aspectConfig.enabled !== 'boolean') {
            errors.push(`${aspect} validation enabled must be a boolean`);
          }
          
          if (!['error', 'warning', 'info'].includes(aspectConfig.severity)) {
            errors.push(`${aspect} validation severity must be 'error', 'warning', or 'info'`);
          }
        }
      }
    }
    
    // Check server configuration
    if (settings.server) {
      if (!settings.server.url) {
        errors.push('Server URL is required');
      } else if (!this.isValidUrl(settings.server.url)) {
        errors.push('Server URL must be a valid URL');
      }
      
      if (settings.server.timeout && settings.server.timeout < 1000) {
        warnings.push('Server timeout should be at least 1000ms');
      }
      
      if (settings.server.retries && settings.server.retries < 0) {
        warnings.push('Server retries should be at least 0');
      }
    }
    
    // Check performance configuration
    if (settings.performance) {
      if (settings.performance.maxConcurrent < 1) {
        errors.push('Max concurrent validations must be at least 1');
      }
      
      if (settings.performance.batchSize < 1) {
        errors.push('Batch size must be at least 1');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Reset settings to default values
   */
  async resetToDefault(): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    const defaultSettings = { ...DEFAULT_VALIDATION_SETTINGS };
    const result = await this.repository.createOrUpdate(defaultSettings);
    
    this.currentSettings = result;
    this.lastCacheTime = Date.now();
    
    this.emit('settingsChanged', {
      type: 'reset',
      data: this.currentSettings
    });
    
    return this.currentSettings;
  }

  /**
   * Get built-in presets
   */
  async getBuiltInPresets(): Promise<ValidationSettingsPreset[]> {
    return [
      {
        id: 'strict',
        name: 'Strict Validation',
        description: 'Maximum validation rigor for compliance',
        settings: {
          aspects: {
            structural: { enabled: true, severity: 'error' },
            profile: { enabled: true, severity: 'error' },
            terminology: { enabled: true, severity: 'error' },
            reference: { enabled: true, severity: 'error' },
            businessRule: { enabled: true, severity: 'error' },
            metadata: { enabled: true, severity: 'error' }
          },
          server: {
            url: 'https://server.fire.ly',
            timeout: 30000,
            retries: 3
          },
          performance: {
            maxConcurrent: 4,
            batchSize: 50
          }
        }
      },
      {
        id: 'permissive',
        name: 'Permissive Validation',
        description: 'Minimal validation for development',
        settings: {
          aspects: {
            structural: { enabled: true, severity: 'warning' },
            profile: { enabled: false, severity: 'info' },
            terminology: { enabled: false, severity: 'info' },
            reference: { enabled: true, severity: 'warning' },
            businessRule: { enabled: false, severity: 'info' },
            metadata: { enabled: false, severity: 'info' }
          },
          server: {
            url: 'https://server.fire.ly',
            timeout: 30000,
            retries: 3
          },
          performance: {
            maxConcurrent: 16,
            batchSize: 200
          }
        }
      }
    ];
  }

  /**
   * Apply a preset
   */
  async applyPreset(presetId: string): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    const presets = await this.getBuiltInPresets();
    const preset = presets.find(p => p.id === presetId);
    
    if (!preset) {
      throw new Error(`Preset '${presetId}' not found`);
    }
    
    const result = await this.repository.createOrUpdate(preset.settings);
    
    this.currentSettings = result;
    this.lastCacheTime = Date.now();
    
    this.emit('settingsChanged', {
      type: 'presetApplied',
      data: { presetId, settings: this.currentSettings }
    });
    
    return this.currentSettings;
  }

  /**
   * Test settings with a sample resource
   */
  async testSettings(settings: ValidationSettings, testResource: any): Promise<any> {
    // This is a simplified test that just validates the settings structure
    const validation = await this.validateSettings(settings);
    
    return {
      isValid: validation.isValid,
      issues: validation.errors.map(error => ({
        severity: 'error',
        message: error
      })).concat(validation.warnings.map(warning => ({
        severity: 'warning',
        message: warning
      }))),
      testResource: testResource
    };
  }

  /**
   * Get settings statistics
   */
  async getSettingsStatistics(): Promise<any> {
    await this.ensureInitialized();
    
    return await this.repository.getSettingsStatistics();
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<any> {
    await this.ensureInitialized();
    
    return await this.repository.getHealthStatus();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.currentSettings = null;
    this.lastCacheTime = 0;
    this.emit('cacheCleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { isCached: boolean; cacheAge: number; cacheTtl: number } {
    return {
      isCached: this.currentSettings !== null,
      cacheAge: this.lastCacheTime > 0 ? Date.now() - this.lastCacheTime : 0,
      cacheTtl: this.config.cacheTtlMs
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async loadCurrentSettings(): Promise<void> {
    try {
      const settings = await this.repository.getActiveSettings();
      this.currentSettings = settings || { ...DEFAULT_VALIDATION_SETTINGS };
      this.lastCacheTime = Date.now();
    } catch (error) {
      // Fallback to defaults if database is unavailable
      this.currentSettings = { ...DEFAULT_VALIDATION_SETTINGS };
      this.lastCacheTime = Date.now();
      console.warn('[ValidationSettingsService] Failed to load settings from database, using defaults:', error);
    }
  }

  private isCacheValid(): boolean {
    return this.lastCacheTime > 0 && (Date.now() - this.lastCacheTime) < this.config.cacheTtlMs;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let settingsServiceInstance: ValidationSettingsService | null = null;

export function getValidationSettingsService(): ValidationSettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new ValidationSettingsService();
  }
  return settingsServiceInstance;
}

export function resetValidationSettingsService(): void {
  settingsServiceInstance = null;
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
