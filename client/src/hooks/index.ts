/**
 * Hooks - Main Entry Point
 * 
 * This module provides the main entry point for all React hooks.
 * It re-exports all hooks from their individual files and subdirectories.
 */

// Validation hooks
export * from './validation';

// Core hooks
export { useToast } from './use-toast';
export { useIsMobile } from './use-mobile';
export { useServerData } from './use-server-data';
export { useSystemSettings } from './use-system-settings';
export { useFhirServerPackages } from './use-fhir-data';
export { useResponsiveLayout } from './use-responsive-layout';
export { useSettingsNotifications } from './use-settings-notifications';

// Dashboard hooks
export { useDashboardData } from './use-dashboard-data';
export { useDashboardDataWiring } from './use-dashboard-data-wiring';
export { useDashboardState } from './use-dashboard-state';

// Individual validation hooks (for direct imports)
export { useValidationPolling } from './use-validation-polling';
export { useValidationSSE } from './use-validation-sse';
export { useValidationSettings } from './use-validation-settings';
export { useValidationSettingsPolling } from './use-validation-settings-polling';
export { useValidationSettingsRealTime } from './use-validation-settings-realtime';
export { useValidationResults, useValidationResultsBatch } from './use-validation-results';
export { useValidationAspects, useValidationAspectsForResource } from './use-validation-aspects';
export { useValidationCompleteness } from './use-validation-completeness';
export { useValidationConfidence } from './use-validation-confidence';
export { useValidationQualityMetrics } from './use-validation-quality-metrics';
export { useValidationControls } from './use-validation-controls';
export { useValidationControls as useValidationControlsSimple } from './use-validation-controls-simple';
export { useValidationGroups, useValidationGroupMembers } from './use-validation-groups';

// Reactive hooks for server and settings changes
export { useServerReactiveQueries, useActiveServerId, useServerQueryKey } from './use-server-reactive-queries';
export { useAspectSettingsReactive, useAspectStyles } from './use-aspect-settings-reactive';

// Type exports
export type { ServerStatus } from './use-server-data';
export type { ValidationProgress } from './use-validation-polling';
export type { ValidationSettingsPollingState, ValidationSettingsPollingOptions } from './use-validation-settings-polling';
export type { ValidationResultsState, ValidationResultsActions, ValidationResultsOptions } from './use-validation-results';
export type { ValidationAspectData, ValidationAspectsState, ValidationAspectsActions, ValidationAspectsOptions } from './use-validation-aspects';
export type { DashboardDataWiring, UseDashboardDataWiringOptions } from './use-dashboard-data-wiring';
export type { ValidationControlsState, ValidationControlsActions } from './use-validation-controls';
export type { ValidationCompletenessState, ValidationCompletenessActions } from './use-validation-completeness';
export type { ValidationConfidenceState, ValidationConfidenceActions } from './use-validation-confidence';
export type { ValidationQualityMetricsState, ValidationQualityMetricsActions } from './use-validation-quality-metrics';
