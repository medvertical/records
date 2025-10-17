/**
 * Resource Components - Unified Export
 * 
 * Exports all resource related components for easy importing.
 */

// Main components
export { default as ResourceViewer } from './resource-viewer';
export { default as UnifiedTreeViewer } from './UnifiedTreeViewer';
export { ResourceEditor } from './ResourceEditor';
export { ResourceDetailHeader } from './ResourceDetailHeader';
export { ResourceDetailActions } from './ResourceDetailActions';

// State components
export {
  ResourceDetailLoadingSkeleton,
  ValidationMessagesLoadingSkeleton,
  ResourceDetailError,
  ValidationError,
  EmptyValidationMessages,
  NoResourceSelected,
  ValidationLoadingIndicator,
} from './ResourceDetailStates';
export type {
  ResourceDetailErrorProps,
  ValidationErrorProps,
  EmptyValidationMessagesProps,
} from './ResourceDetailStates';

// Validation components
export { ValidationSummaryBadge } from './validation-summary-badge';

// Utility functions
export { 
  getHumanReadableMessage, 
  getShortMessage, 
  getSeverityInfo, 
  getCategoryInfo 
} from './validation-message-converter';

// Types (re-exported for convenience)
export type {
  ValidationIssue,
  ValidationResult
} from './resource-viewer';
