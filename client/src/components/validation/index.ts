/**
 * Validation Components - Unified Export
 * 
 * Exports all validation related components for easy importing.
 */

// Main components
export { default as ValidationErrors } from './validation-errors-new';

// Filter and control components
export { ValidationFilterControls } from './validation-filter-controls';

// View components
export { ValidationGroupedView } from './validation-grouped-view';
export { ValidationFlatView } from './validation-flat-view';
export { ValidationAggregatedView } from './validation-aggregated-view';

// Issue components
export { ValidationIssueCard } from './validation-issue-card';

// Utility functions and logic
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

// Types (re-exported for convenience)
export type {
  ValidationResult,
  ValidationError
} from '@shared/schema';
