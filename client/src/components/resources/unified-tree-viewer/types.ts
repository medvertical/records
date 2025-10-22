// ============================================================================
// Type Definitions for UnifiedTreeViewer
// ============================================================================

export interface ValidationIssue {
  id?: string;
  code?: string;
  message?: string;
  category?: string;
  severity?: string;
  path?: string;
  location?: string[];
}

export interface ExtensionInfo {
  url: string;
  valueType: string;
  value: any;
  displayName: string;
  isModifier: boolean;
}

export interface SliceInfo {
  name: string;
  discriminator: string;
}

export interface SliceMatch {
  sliceName: string;
  confirmed: boolean; // true if from profile, false if heuristic
  confidence?: 'high' | 'medium' | 'low';
}

export interface UnifiedTreeViewerProps {
  resourceData: any;
  resourceType?: string;
  isEditMode?: boolean;
  // View mode props
  validationResults?: ValidationIssue[];
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string, path?: string) => void;
  onIssueClick?: (issueId: string) => void;
  onEdit?: () => void;
  // Edit mode props
  onResourceChange?: (resource: any) => void;
  // Shared
  expandAll?: boolean;
  expandAllTrigger?: number;
  // State management
  expandedPaths?: Set<string>;
  onExpandedPathsChange?: (expandedPaths: Set<string>) => void;
  // Highlighting
  highlightedPath?: string;
  // Profile URLs for slice detection
  profileUrls?: string[];
}

export interface TreeNodeProps {
  nodeKey: string;
  value: any;
  path: string[];
  level?: number;
  // Shared props
  resourceType?: string;
  isEditMode?: boolean;
  expandAll?: boolean;
  // State management
  expandedPaths?: Set<string>;
  onExpandedPathsChange?: (expandedPaths: Set<string>) => void;
  // View mode props
  validationIssues?: ValidationIssue[];
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string, path?: string) => void;
  onIssueClick?: (issueId: string) => void;
  onEdit?: () => void;
  // Edit mode props
  onValueChange?: (path: string[], newValue: any) => void;
  onDeleteNode?: (path: string[]) => void;
  // Highlighting
  highlightedPath?: string;
  // Ghost node (validation path that doesn't exist in data)
  isGhost?: boolean;
  onCreateField?: (path: string[], fieldName: string) => void;
  // FHIR-specific rendering
  isExtension?: boolean;
  extensionInfo?: ExtensionInfo;
  sliceMatch?: SliceMatch | null;
  profileUrls?: string[];
}

export interface ContainerProps {
  value: any;
  path: string[];
  level: number;
  resourceType?: string;
  isEditMode?: boolean;
  expandAll?: boolean;
  expandedPaths?: Set<string>;
  onExpandedPathsChange?: (expandedPaths: Set<string>) => void;
  validationIssues?: ValidationIssue[];
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string, path?: string) => void;
  onIssueClick?: (issueId: string) => void;
  onValueChange?: (path: string[], newValue: any) => void;
  onDeleteNode?: (path: string[]) => void;
  onCreateField?: (path: string[], fieldName: string) => void;
  onEdit?: () => void;
  highlightedPath?: string;
  // FHIR-specific
  parentKey?: string;
  profileUrls?: string[];
}

export interface ArrayContainerProps extends ContainerProps {
  value: any[];
}

export interface ObjectContainerProps extends ContainerProps {
  value: Record<string, any>;
}

