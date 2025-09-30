/**
 * Resource Components - Unified Export
 * 
 * Exports all resource related components for easy importing.
 */

// Main components
export { default as ResourceViewer } from './resource-viewer';
export { default as ResourceTreeViewer } from './resource-tree-viewer';
export { ResourceListView } from './ResourceListView';
export { VirtualizedResourceList } from './VirtualizedResourceList';
export { ResourceEditor } from './ResourceEditor';
export { ResourceDetailHeader } from './ResourceDetailHeader';
export { ResourceDetailActions } from './ResourceDetailActions';
export { ResourceDetailSplitPane } from './ResourceDetailSplitPane';

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
export { OptimizedValidationResults } from './optimized-validation-results';
export { 
  ValidationIssueIndicator, 
  ValidationIssueDetails, 
  ValidationIssueList 
} from './validation-issue-components';

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
