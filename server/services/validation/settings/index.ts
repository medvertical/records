/**
 * Validation Settings Services - Simplified Export
 * 
 * Exports the simplified validation settings service only.
 * Provides a clean API for importing validation settings functionality.
 */

// Main simplified service
export { ValidationSettingsService } from './validation-settings-service';
export type { ValidationSettingsServiceConfig } from './validation-settings-service';

// Factory functions for backward compatibility
export { 
  getValidationSettingsService,
  resetValidationSettingsService,
  initializeValidationSettingsService,
  shutdownValidationSettingsService
} from './validation-settings-service';
