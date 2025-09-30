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
