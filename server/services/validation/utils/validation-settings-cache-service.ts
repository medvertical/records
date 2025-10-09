/**
 * Validation Settings Cache Service
 * 
 * Extracted from ConsolidatedValidationService to handle settings caching
 * and event management. Follows Single Responsibility Principle.
 * 
 * Responsibilities:
 * - Load and cache validation settings
 * - Listen for settings changes
 * - Provide cached settings with TTL
 * - Handle settings service events
 * 
 * File size: Target <200 lines (utility service)
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings/validation-settings-service';
import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Validation Settings Cache Service
// ============================================================================

export class ValidationSettingsCacheService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private cachedSettings: ValidationSettings | null = null;
  private settingsCacheTime: number = 0;
  private readonly SETTINGS_CACHE_TTL = 60000; // Cache for 1 minute

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for settings changes
   */
  private setupEventListeners(): void {
    // Listen for settings changes
    this.settingsService.on('settingsChanged', (event) => {
      console.log('[ValidationSettingsCache] Settings changed, clearing cache');
      this.clearCache();
      this.emit('settingsInvalidated', event);
      
      // Auto-reload settings
      this.loadSettings().catch(error => {
        console.error('[ValidationSettingsCache] Failed to reload after change:', error);
      });
    });

    // Listen for settings activation
    this.settingsService.on('settingsActivated', (event) => {
      console.log('[ValidationSettingsCache] Settings activated, clearing cache');
      this.clearCache();
      this.emit('settingsInvalidated', event);
      
      // Auto-reload settings
      this.loadSettings().catch(error => {
        console.error('[ValidationSettingsCache] Failed to reload after activation:', error);
      });
    });

    // Listen for settings service errors
    this.settingsService.on('error', (error) => {
      console.error('[ValidationSettingsCache] Settings service error:', error);
      this.clearCache(); // Force reload on next access
      this.emit('error', error);
    });
  }

  /**
   * Load validation settings from database with caching
   */
  async loadSettings(): Promise<ValidationSettings | null> {
    // Check if cached settings are still valid
    const now = Date.now();
    if (this.cachedSettings && (now - this.settingsCacheTime) < this.SETTINGS_CACHE_TTL) {
      return this.cachedSettings;
    }
    
    try {
      const settings = await this.settingsService.getCurrentSettings();
      if (settings) {
        this.cachedSettings = settings;
        this.settingsCacheTime = now;
        this.emit('settingsLoaded', { settings });
      }
      return settings;
    } catch (error) {
      console.error('[ValidationSettingsCache] Failed to load settings:', error);
      this.emit('settingsError', { error });
      throw error;
    }
  }

  /**
   * Force reload of settings (bypass cache)
   */
  async forceReload(): Promise<ValidationSettings | null> {
    this.clearCache();
    return this.loadSettings();
  }

  /**
   * Get current settings (from cache or load if needed)
   */
  async getSettings(): Promise<ValidationSettings | null> {
    if (!this.cachedSettings) {
      return this.loadSettings();
    }
    
    // Check if cache is still valid
    const now = Date.now();
    if ((now - this.settingsCacheTime) >= this.SETTINGS_CACHE_TTL) {
      return this.loadSettings();
    }
    
    return this.cachedSettings;
  }

  /**
   * Get cached settings without reloading (may be null or stale)
   */
  getCachedSettings(): ValidationSettings | null {
    return this.cachedSettings;
  }

  /**
   * Check if settings service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.settingsService.getCurrentSettings();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    if (!this.cachedSettings) {
      return false;
    }
    const now = Date.now();
    return (now - this.settingsCacheTime) < this.SETTINGS_CACHE_TTL;
  }

  /**
   * Get cache age in milliseconds
   */
  getCacheAge(): number {
    if (!this.cachedSettings) {
      return -1;
    }
    return Date.now() - this.settingsCacheTime;
  }

  /**
   * Clear settings cache
   */
  clearCache(): void {
    this.cachedSettings = null;
    this.settingsCacheTime = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      hasCachedSettings: !!this.cachedSettings,
      cacheAge: this.getCacheAge(),
      cacheValid: this.isCacheValid(),
      cacheTtl: this.SETTINGS_CACHE_TTL,
    };
  }
}

// Singleton instance
let settingsCacheInstance: ValidationSettingsCacheService | null = null;

/**
 * Get singleton instance of ValidationSettingsCacheService
 */
export function getValidationSettingsCacheService(): ValidationSettingsCacheService {
  if (!settingsCacheInstance) {
    settingsCacheInstance = new ValidationSettingsCacheService();
  }
  return settingsCacheInstance;
}

