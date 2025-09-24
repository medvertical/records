/**
 * Validation Settings Services - Unified Export
 * 
 * Exports all validation settings related services and types.
 * Provides a clean API for importing validation settings functionality.
 */

// Main simplified service
export { ValidationSettingsService } from './validation-settings-service-simplified';
export type { ValidationSettingsServiceConfig } from './validation-settings-service-simplified';

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
export { getValidationSettingsService } from './validation-settings-service-simplified';
export { initializeValidationSettingsService } from './validation-settings-service-simplified';
export { shutdownValidationSettingsService } from './validation-settings-service-simplified';
