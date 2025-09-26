/**
 * Validation Services - Main Entry Point
 * 
 * This module provides the main entry point for all validation-related services.
 * It organizes services into clear module boundaries:
 * 
 * - Core: Main validation services (ConsolidatedValidationService, ValidationEngine, ValidationPipeline)
 * - Settings: Settings management and configuration
 * - Quality: Quality assessment and metrics
 * - Performance: Performance monitoring and optimization
 * - Features: Feature-specific services and utilities
 * - Engine: Individual validation engines and validators
 * - Pipeline: Pipeline orchestration and processing
 * 
 * Follows global rules: Simple exports, no custom logic, single responsibility
 */

// Core validation services - Primary entry points
export * from './core';

// Settings management services - Configuration and settings
export * from './settings';

// Quality assessment services - Quality metrics and scoring
export * from './quality';

// Performance and scheduling services - Performance monitoring
export * from './performance';

// Feature-specific services - Advanced features and utilities
export * from './features';

// Engine components - Individual validators and engines
export * from './engine';

// Pipeline components - Orchestration and processing
export * from './pipeline';

// Legacy services - To be migrated to new architecture
export { ValidationSettingsBackupService } from './validation-settings-backup-service';
export { ValidationSettingsError } from './validation-settings-errors';
export { ValidationSettingsService } from './validation-settings-service';

// Types - Re-export commonly used types for convenience
export type {
  ValidationResult,
  ValidationError,
  ValidationSettings,
  ValidationAspect
} from '@shared/schema';

export type {
  ValidationStatus,
  ValidationAction,
  ValidationProgress,
  ValidationControlsState
} from '@shared/types/validation';
