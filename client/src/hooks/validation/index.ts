/**
 * Validation Hooks - Main Entry Point
 * 
 * This module provides all validation-related React hooks organized by functionality:
 * 
 * - Core Hooks: Primary validation functionality and data fetching
 * - Enhanced Hooks: Hooks for normalized validation results
 * - Settings Hooks: Settings management and configuration
 * - Quality Hooks: Quality metrics and assessment
 * - Dashboard Hooks: Dashboard integration and data wiring
 * - Legacy Hooks: Backward compatibility hooks
 * 
 * Follows global rules: Simple exports, no custom logic, single responsibility
 */

// Core validation hooks - Primary functionality
export { useValidationPolling } from '../use-validation-polling';
export { useValidationSettings } from '../use-validation-settings';
export { useFHIRVersionDetection } from '../use-fhir-version-detection';
export { useValidationSettingsMigration } from '../use-validation-settings-migration';

// Enhanced validation hooks - Normalized results
export { useValidationResults, useValidationResultsBatch } from '../use-validation-results';
export { useValidationAspects, useValidationAspectsForResource } from '../use-validation-aspects';

// Settings hooks - Settings management
export { useValidationSettingsPolling } from '../use-validation-settings-polling';

// Quality hooks - Quality metrics and assessment
export { useValidationCompleteness } from '../use-validation-completeness';
export { useValidationConfidence } from '../use-validation-confidence';
export { useValidationQualityMetrics } from '../use-validation-quality-metrics';

// Dashboard hooks - Dashboard integration
export { useDashboardDataWiring } from '../use-dashboard-data-wiring';

// Control hooks - User interaction and controls
export { useValidationControls } from '../use-validation-controls';
export { useValidationControls as useValidationControlsSimple } from '../use-validation-controls-simple';

// Type exports - Hook types and interfaces
export type { ValidationProgress } from '../use-validation-polling';
export type { ValidationSettingsPollingState, ValidationSettingsPollingOptions } from '../use-validation-settings-polling';
export type { ValidationResultsState, ValidationResultsActions, ValidationResultsOptions } from '../use-validation-results';
export type { ValidationAspectData, ValidationAspectsState, ValidationAspectsActions, ValidationAspectsOptions } from '../use-validation-aspects';
export type { DashboardDataWiring, UseDashboardDataWiringOptions } from '../use-dashboard-data-wiring';
export type { ValidationControlsState, ValidationControlsActions } from '../use-validation-controls';
export type { ValidationCompletenessState, ValidationCompletenessActions } from '../use-validation-completeness';
export type { ValidationConfidenceState, ValidationConfidenceActions } from '../use-validation-confidence';
export type { ValidationQualityMetricsState, ValidationQualityMetricsActions } from '../use-validation-quality-metrics';
export type { FHIRServerMetadata, UseFHIRVersionDetectionOptions, UseFHIRVersionDetectionReturn } from '../use-fhir-version-detection';
export type { UseValidationSettingsMigrationOptions, UseValidationSettingsMigrationReturn } from '../use-validation-settings-migration';
