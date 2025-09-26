/**
 * Validation Types - Main Entry Point
 * 
 * This module provides all validation-related type definitions:
 * - Server-specific validation types
 * - Shared validation types (re-exported)
 * - Type constants and utilities
 * 
 * Follows global rules: Simple exports, no custom logic, single responsibility
 */

// Server-specific validation types
export * from './validation-types';

// Re-export shared validation types for convenience
export type {
  ValidationResult,
  ValidationIssue,
  ValidationProgress,
  ValidationStatus,
  ValidationAction,
  ValidationControlsState,
  ValidationConfiguration,
  ValidationRunHistory,
  ValidationMetrics,
  ValidationControlsActions,
  StartValidationOptions,
  ValidationWebSocketMessage,
  ValidationProgressMessage,
  ValidationCompletedMessage,
  ValidationErrorMessage,
  ValidationRunSummary,
  ValidationError,
  ValidationControlsConfig,
  ValidationControlsHook,
  ValidationExportOptions,
  ValidationBenchmark,
  EnhancedValidationBadgeProps,
  EnhancedValidationSummary
} from '@shared/types/validation';
