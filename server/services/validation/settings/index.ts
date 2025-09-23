/**
 * Validation Settings Services - Unified Export
 * 
 * Exports all validation settings related services and types.
 * Provides a clean API for importing validation settings functionality.
 */

// Main unified service
export { ValidationSettingsService } from '../settings/validation-settings-service';
export type { ValidationSettingsServiceConfig } from '../settings/validation-settings-service';

// Core services
export { ValidationSettingsCoreService } from './settings-core-service';
export type { ValidationSettingsCoreConfig, SettingsChangeEvent } from './settings-core-service';

// Cache service
export { ValidationSettingsCacheService } from './settings-cache-service';
export type { 
  SettingsCacheEntry, 
  CacheMetrics, 
  SettingsCacheConfig 
} from './settings-cache-service';

// Preset service
export { ValidationSettingsPresetService } from './settings-preset-service';
export type { 
  CustomPreset, 
  PresetApplicationResult 
} from './settings-preset-service';

// Factory functions for backward compatibility
export { getValidationSettingsService } from '../validation-settings-service';
export { initializeValidationSettingsService } from '../validation-settings-service';
export { shutdownValidationSettingsService } from '../validation-settings-service';
