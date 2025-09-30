/**
 * Validation Components - Main Entry Point
 * 
 * This module provides all validation-related UI components organized by functionality:
 * 
 * - Main Components: Primary validation display components
 * - View Components: Different views for validation results
 * - Control Components: User interaction and filtering controls
 * - Issue Components: Individual issue display and management
 * - Utility Functions: Helper functions for validation logic
 * 
 * Follows global rules: Simple exports, no custom logic, single responsibility
 */

// Main components - Primary validation display
export { default as ValidationErrors } from './validation-errors-new';
export { ValidationResults } from './validation-results';
export { ServerValidation } from './server-validation';

// View components - Different result display modes
export { ValidationGroupedView } from './validation-grouped-view';
export { ValidationFlatView } from './validation-flat-view';
export { ValidationAggregatedView } from './validation-aggregated-view';

// Control components - User interaction and filtering
export { ValidationFilterControls } from './validation-filter-controls';
export { ValidationQueueManagement } from './validation-queue-management';
export { ValidationCancellationRetry } from './validation-cancellation-retry';

// Issue components - Individual issue display
export { ValidationIssueCard } from './validation-issue-card';

// Group components - Message grouping and members
export { GroupList } from './GroupList';
export { GroupMembers } from './GroupMembers';
export { ValidationStatusIndicator } from './ValidationStatusIndicator';
export type { ResourceValidationStatus, AspectValidationStatus } from './ValidationStatusIndicator';
export { ValidationMessageList } from './ValidationMessageList';
export type { ValidationMessage } from './ValidationMessageList';
export { ValidationAspectTabs } from './ValidationAspectTabs';
export type { AspectMessages } from './ValidationAspectTabs';

// Settings components - Settings management UI
export { ValidationSettingsAuditTrail } from './validation-settings-audit-trail';
export { ValidationSettingsDashboardDemo } from './validation-settings-dashboard-demo';
export { ValidationSettingsPollingDemo } from './validation-settings-polling-demo';
export { ValidationSettingsRealtimeIndicator } from './validation-settings-realtime-indicator';

// Progress components - Progress tracking and display
export { IndividualResourceProgress } from './individual-resource-progress';

// Utility functions and logic - Helper functions
export { 
  groupIssuesByCategoryAndSeverity,
  groupIssuesBy,
  getGroupKey,
  filterIssuesBySearch,
  filterIssuesByCategoryAndSeverity,
  calculateAggregatedStats,
  getQuickFixes,
  getCategoryInfo
} from './validation-grouping-logic';

// Types - Re-exported for convenience
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
