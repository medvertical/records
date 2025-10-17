import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  validateField,
  isFieldRequired,
  getTypeName,
} from '@/utils/fhir-validation';
import { cn } from '@/lib/utils';
import { getCategoryIcon, getSeverityIcon } from './utils';
import { TreeNodeProps, ValidationIssue } from './types';
import ArrayContainer from './ArrayContainer';
import ObjectContainer from './ObjectContainer';

// ============================================================================
// Tree Node Component
// ============================================================================

export default function TreeNode({
  nodeKey,
  value,
  path,
  level = 0,
  resourceType,
  isEditMode = false,
  expandAll = false,
  expandedPaths,
  onExpandedPathsChange,
  validationIssues = [],
  onCategoryChange,
  onSeverityChange,
  onIssueClick,
  onValueChange,
  onDeleteNode,
  highlightedPath,
  isGhost = false,
}: TreeNodeProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  
  // Generate path string for this node
  const pathString = path.length === 0 ? nodeKey : `${path.join('.')}.${nodeKey}`;
  
  const fullPath = [...path, nodeKey];
  const isRequired = resourceType ? isFieldRequired(resourceType, nodeKey) : false;
  const valueType = getTypeName(value);
  // Ghost nodes with nested validation issues should be treated as complex (expandable)
  const hasNestedIssues = isGhost && validationIssues.some(issue => {
    const issuePath = issue.path?.toLowerCase() || '';
    const currentPath = pathString.toLowerCase();
    return issuePath.startsWith(currentPath + '.') && issuePath !== currentPath;
  });
  const isComplex = valueType === 'object' || valueType === 'array' || hasNestedIssues;
  
  // Check if this node is expanded from shared state
  const isExpanded = expandedPaths?.has(pathString) ?? (level < 2);
  
  // Debug logging for arrays (commented out to reduce noise)
  // if (valueType === 'array' || (nodeKey.startsWith('[') && nodeKey.endsWith(']'))) {
  //   console.log('[TreeNode]', pathString, '- isExpanded:', isExpanded, 'in expandedPaths:', expandedPaths?.has(pathString), 'type:', valueType);
  // }

  // Handle highlighting effect and scroll into view
  useEffect(() => {
    // Normalize paths by removing array indices for comparison
    // e.g., "identifier.[0].assigner" becomes "identifier.assigner"
    const normalizePathForComparison = (path: string) => {
      return path.toLowerCase().replace(/\.\[\d+\]/g, '');
    };
    
    // Strip resource type prefix from tree path for comparison
    // Tree paths now start with resource type (e.g., "Patient.meta.lastUpdated")
    // but validation paths don't (e.g., "meta.lastupdated")
    const stripResourceTypePrefix = (treePath: string) => {
      // If we have a resource type and the path starts with it, strip it
      if (resourceType && treePath.toLowerCase().startsWith(resourceType.toLowerCase() + '.')) {
        return treePath.substring(resourceType.length + 1); // +1 for the dot
      }
      return treePath;
    };
    
    const pathForComparison = stripResourceTypePrefix(pathString);
    
    const normalizedHighlightPath = highlightedPath ? normalizePathForComparison(highlightedPath) : '';
    const normalizedPathString = normalizePathForComparison(pathForComparison);
    
    // Special case: Root node should match when highlightedPath is empty or equals resource type
    const isRootNode = path.length === 0 && resourceType && nodeKey.toLowerCase() === resourceType.toLowerCase();
    const isRootMatch = isRootNode && highlightedPath !== undefined && 
                       (highlightedPath === '' || highlightedPath.toLowerCase() === resourceType.toLowerCase());
    
    // Also check exact match (case-insensitive) as fallback
    const isExactMatch = highlightedPath && highlightedPath.toLowerCase() === pathForComparison.toLowerCase();
    const isNormalizedMatch = highlightedPath && normalizedHighlightPath === normalizedPathString;
    const isMatch = isRootMatch || isExactMatch || isNormalizedMatch;
    
    if (isMatch && !isHighlighted) {
      console.log('[TreeNode] Highlighting and scrolling to:', pathString, '(matched with:', highlightedPath, ')');
      setIsHighlighted(true);
      
      // Scroll into view after a brief delay to ensure rendering is complete
      setTimeout(() => {
        nodeRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    } else if (!isMatch && isHighlighted) {
      // Clear highlight when path no longer matches (parent cleared highlightedPath)
      console.log('[TreeNode] Clearing highlight for:', pathString);
      setIsHighlighted(false);
    }
  }, [highlightedPath, pathString, isHighlighted, resourceType, path.length, nodeKey]);

  // Handle expand/collapse toggle
  const handleToggleExpanded = useCallback(() => {
    console.log('[TreeNode] Toggle clicked:', {
      pathString,
      hasExpandedPaths: !!expandedPaths,
      hasOnExpandedPathsChange: !!onExpandedPathsChange,
      currentlyExpanded: expandedPaths?.has(pathString)
    });
    
    if (!onExpandedPathsChange || !expandedPaths) {
      console.log('[TreeNode] Cannot toggle - missing props');
      return;
    }
    
    const newExpandedPaths = new Set(expandedPaths);
    if (expandedPaths.has(pathString)) {
      console.log('[TreeNode] Collapsing:', pathString);
      newExpandedPaths.delete(pathString);
    } else {
      console.log('[TreeNode] Expanding:', pathString);
      newExpandedPaths.add(pathString);
    }
    onExpandedPathsChange(newExpandedPaths);
  }, [pathString, expandedPaths, onExpandedPathsChange]);


  // Get validation issues for this path (view mode) - case insensitive matching
  // Normalize paths by removing array indices for comparison
  const normalizePathForMatching = (path: string) => {
    return path.toLowerCase().replace(/\.\[\d+\]/g, '');
  };
  
  // Strip resource type prefix from tree path for comparison with validation paths
  const stripResourceTypePrefixForValidation = (treePath: string) => {
    if (resourceType && treePath.toLowerCase().startsWith(resourceType.toLowerCase() + '.')) {
      return treePath.substring(resourceType.length + 1);
    }
    return treePath;
  };
  
  const directPathIssues = validationIssues.filter(issue => {
    const issuePath = issue.path?.toLowerCase() || '';
    const locationPath = issue.location?.join('.').toLowerCase() || '';
    const currentPath = pathString.toLowerCase();
    const currentPathWithoutResourceType = stripResourceTypePrefixForValidation(currentPath).toLowerCase();
    
    // Special case: Root node (when pathString is just the resource type, like "Patient")
    // Should match validation paths that are empty strings (resource-level validation)
    // because resource-detail.tsx strips "patient" from path, leaving empty string
    const isRootNode = path.length === 0 && resourceType && nodeKey.toLowerCase() === resourceType.toLowerCase();
    if (isRootNode) {
      // Root node should match empty validation paths (resource-level validation)
      const rootMatch = issuePath === '' || 
                       locationPath === '' ||
                       issuePath === currentPath || 
                       locationPath === currentPath ||
                       issuePath === resourceType.toLowerCase() ||
                       locationPath === resourceType.toLowerCase();
      if (rootMatch) return true;
    }
    
    // Check exact match first (highest priority) - try both with and without resource type prefix
    const exactMatch = issuePath === currentPath || locationPath === currentPath ||
                       issuePath === currentPathWithoutResourceType || locationPath === currentPathWithoutResourceType;
    if (exactMatch) return true;
    
    // For array element nodes like [0], only match if validation path is MORE SPECIFIC
    // This prevents showing parent-level issues on array element nodes
    const isArrayElement = /^\[\d+\]$/.test(nodeKey);
    if (isArrayElement) {
      // For array elements, only show issues that go deeper than just the element itself
      const normalizedIssuePath = normalizePathForMatching(issuePath);
      const normalizedLocationPath = normalizePathForMatching(locationPath);
      const normalizedCurrentPath = normalizePathForMatching(currentPath);
      
      // Check if issue path is more specific (has more parts after normalization)
      const issueDepth = normalizedIssuePath.split('.').length;
      const locationDepth = normalizedLocationPath.split('.').length;
      const currentDepth = normalizedCurrentPath.split('.').length;
      
      // Only match if issue goes deeper than current node
      const issueMatches = normalizedIssuePath === normalizedCurrentPath && issueDepth > currentDepth;
      const locationMatches = normalizedLocationPath === normalizedCurrentPath && locationDepth > currentDepth;
      
      return false; // Don't show badges on array element nodes themselves
    }
    
    // For other nodes with array indices in the path, use normalized matching
    if (/\[\d+\]/.test(pathString)) {
      const normalizedIssuePath = normalizePathForMatching(issuePath);
      const normalizedLocationPath = normalizePathForMatching(locationPath);
      const normalizedCurrentPath = normalizePathForMatching(currentPath);
      const normalizedCurrentPathWithoutResourceType = normalizePathForMatching(currentPathWithoutResourceType);
      
      const normalizedMatch = normalizedIssuePath === normalizedCurrentPath || 
                             normalizedLocationPath === normalizedCurrentPath ||
                             normalizedIssuePath === normalizedCurrentPathWithoutResourceType ||
                             normalizedLocationPath === normalizedCurrentPathWithoutResourceType;
      
      return normalizedMatch;
    }
    
    // For simple paths without array indices (including resource-level paths like "Patient")
    // Check if issue path matches directly (already handled by exactMatch above)
    // or if issue path starts with current path (child issue)
    return false; // Already handled by exactMatch, no need for fuzzy matching
  });
  
  // If node is collapsed and complex, get all child issues for aggregation
  const childPathIssues = (!isExpanded && isComplex) ? validationIssues.filter(issue => {
    const issuePath = issue.path?.toLowerCase() || '';
    const currentPath = pathString.toLowerCase();
    const currentPathWithoutResourceType = stripResourceTypePrefixForValidation(currentPath).toLowerCase();
    
    // Check exact match first (with and without resource type prefix)
    const exactChildMatch = (issuePath.startsWith(currentPath + '.') && issuePath !== currentPath) ||
                           (issuePath.startsWith(currentPathWithoutResourceType + '.') && issuePath !== currentPathWithoutResourceType);
    
    // Also check normalized match (without array indices)
    const normalizedIssuePath = normalizePathForMatching(issuePath);
    const normalizedCurrentPath = normalizePathForMatching(currentPath);
    const normalizedCurrentPathWithoutResourceType = normalizePathForMatching(currentPathWithoutResourceType);
    const normalizedChildMatch = (normalizedIssuePath.startsWith(normalizedCurrentPath + '.') && normalizedIssuePath !== normalizedCurrentPath) ||
                                 (normalizedIssuePath.startsWith(normalizedCurrentPathWithoutResourceType + '.') && normalizedIssuePath !== normalizedCurrentPathWithoutResourceType);
    
    return exactChildMatch || normalizedChildMatch;
  }) : [];
  
  // Use direct issues when expanded, or aggregated (direct + children) when collapsed
  const pathIssues = isExpanded ? directPathIssues : [...directPathIssues, ...childPathIssues];
  const hasIssues = pathIssues.length > 0;
  
  // Get highest severity color
  const getHighestSeverityColor = (issues: ValidationIssue[]) => {
    if (issues.length === 0) return '';
    const hasError = issues.some(issue => issue.severity === 'error');
    const hasWarning = issues.some(issue => issue.severity === 'warning');
    if (hasError) return 'border-l-red-500 bg-red-50';
    if (hasWarning) return 'border-l-yellow-500 bg-yellow-50';
    return 'border-l-blue-500 bg-blue-50';
  };
  
  const severityColor = getHighestSeverityColor(pathIssues);

  // Handle value changes (edit mode)
  const handleValueChange = useCallback((newValue: any) => {
    if (!onValueChange) return;
    const validation = validateField(nodeKey, newValue, resourceType);
    if (!validation.valid) {
      setValidationError(validation.error || null);
    } else {
      setValidationError(null);
    }
    onValueChange(fullPath, newValue);
  }, [nodeKey, fullPath, onValueChange, resourceType]);

  // Handle node deletion (edit mode)
  const handleDelete = useCallback(() => {
    if (!onDeleteNode || isRequired) return;
    if (window.confirm(`Are you sure you want to delete "${nodeKey}"?`)) {
      onDeleteNode(fullPath);
    }
  }, [isRequired, nodeKey, fullPath, onDeleteNode]);

  // Handle severity/category clicks (view mode)
  const handleSeverityClick = (severity: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSeverityChange?.(severity, pathString);
  };
  
  const handleCategoryClick = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onCategoryChange?.(category);
  };
  
  // Group issues by severity
  const issuesBySeverity = {
    error: pathIssues.filter(issue => issue.severity === 'error'),
    warning: pathIssues.filter(issue => issue.severity === 'warning'),
    info: pathIssues.filter(issue => issue.severity === 'info' || issue.severity === 'information'),
  };

  // Render value for view mode
  const renderViewValue = (val: any): React.ReactNode => {
    if (val === null) return <span className="text-gray-500 italic font-mono">null</span>;
    if (val === undefined) return <span className="text-gray-500 italic font-mono">undefined</span>;
    if (typeof val === 'boolean') return <span className="text-blue-600 font-mono">{val.toString()}</span>;
    if (typeof val === 'number') return <span className="text-green-600 font-mono">{val}</span>;
    if (typeof val === 'string') {
      if (val.startsWith('http') || val.startsWith('urn:')) {
        return <span className="text-blue-600 underline font-mono">{val}</span>;
      }
      return <span className="text-gray-800 font-mono">{val}</span>;
    }
    if (Array.isArray(val)) {
      return <span className="text-gray-600 italic font-mono">Array[{val.length}]</span>;
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val || {}).filter(key => !key.startsWith('_'));
      return <span className="text-gray-600 italic font-mono">Object{'{' + keys.length + '}'}</span>;
    }
    return <span className="font-mono">{String(val)}</span>;
  };

  // Render view value with consistent height
  const renderViewValueWithHeight = (val: any): React.ReactNode => {
    return (
      <div className="flex items-center h-8">
        {isGhost ? (
          <span className="text-gray-400 italic font-mono text-xs">
            (missing field with validation issues)
          </span>
        ) : (
          renderViewValue(val)
        )}
      </div>
    );
  };

  // Render value editor for edit mode
  const renderEditValue = () => {
    if (valueType === 'string') {
      return (
        <Input
          type="text"
          value={value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className={cn(
            'h-8 text-sm font-mono',
            'focus:ring-1 focus:ring-blue-400 focus:border-blue-300',
            validationError && 'border-red-500 focus:ring-red-400 focus:border-red-400'
          )}
          placeholder="Enter value..."
        />
      );
    }

    if (valueType === 'number') {
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => handleValueChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          className={cn(
            'h-8 text-sm font-mono',
            'focus:ring-1 focus:ring-blue-400 focus:border-blue-300',
            validationError && 'border-red-500 focus:ring-red-400 focus:border-red-400'
          )}
        />
      );
    }

    if (valueType === 'boolean') {
      return (
        <div className="flex items-center gap-2 h-8">
          <Checkbox
            checked={value === true}
            onCheckedChange={(checked) => handleValueChange(checked === true)}
            className="focus:ring-1 focus:ring-blue-400 focus:ring-offset-1"
          />
          <span className="text-sm text-gray-600 font-mono">{value ? 'true' : 'false'}</span>
        </div>
      );
    }

    if (valueType === 'null') {
      return (
        <Input
          type="text"
          value="null"
          disabled
          className="h-8 text-sm font-mono bg-gray-100 text-gray-500"
        />
      );
    }

    // For arrays and objects, just show type
    return (
      <div className="flex items-center h-8">
        {renderViewValue(value)}
      </div>
    );
  };

  return (
    <div 
      className="mb-1"
    >
      <div 
        ref={nodeRef}
        id={`node-${pathString.replace(/\./g, '-').replace(/\[|\]/g, '_')}`}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 group transition-all duration-300 rounded-md",
          !isEditMode && hasIssues && `border-l-4 ${severityColor}`,
          isHighlighted ? 'bg-yellow-100 animate-in fade-in duration-300' : 'hover:bg-gray-50'
        )}
      >
        {/* Key column: 280px fixed width with indentation */}
        <div 
          className="flex items-center gap-1 flex-shrink-0 transition-all duration-200"
          style={{ width: '280px', paddingLeft: `${level === 0 ? 0.25 : level * 1.5 + 0.5}rem` }}
        >
          {/* Expand/Collapse Button */}
          {(() => {
            // Check if this is the root node
            const isRootNode = path.length === 0 && resourceType && nodeKey.toLowerCase() === resourceType.toLowerCase();
            
            // Root node shouldn't have expand/collapse button (always expanded)
            if (isRootNode) {
              return <div className="w-5 flex-shrink-0" />;
            }
            
            // Regular nodes
            if (isComplex) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleToggleExpanded();
                  }}
                  className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded transition-colors duration-150"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-600 transition-transform duration-150" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-600 transition-transform duration-150" />
                  )}
                </button>
              );
            } else {
              return <div className="w-5 flex-shrink-0" />;
            }
          })()}

          <span className={cn(
            "text-sm font-medium truncate font-mono transition-all duration-200",
            isGhost ? "text-gray-400 italic" : "text-gray-700"
          )}>
            {nodeKey}
            {isEditMode && isRequired && (
              <span className="text-red-500 ml-1 transition-opacity duration-200">*</span>
            )}
          </span>
          {isEditMode && (
            <span className="text-xs text-gray-400 flex-shrink-0 transition-opacity duration-200 animate-in fade-in">
              ({valueType})
            </span>
          )}
        </div>

        {/* Value column: flex-1 with smooth transition */}
        <div className="flex-1 flex items-center gap-2 min-w-0 transition-all duration-200">
          <div className="w-full animate-in fade-in duration-200">
            {isEditMode ? renderEditValue() : renderViewValueWithHeight(value)}
          </div>
        </div>

        {/* Right column: badges OR delete button with smooth transition */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isEditMode ? (
            // View mode: validation badges grouped by severity
            <div className="flex items-center gap-1 animate-in fade-in duration-200">
              {hasIssues && (
                <>
                  {issuesBySeverity.error.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-6 px-2 text-xs cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-md flex items-center gap-1.5"
                      onClick={(e) => handleSeverityClick('error', e)}
                      title={`${issuesBySeverity.error.length} error${issuesBySeverity.error.length > 1 ? 's' : ''}`}
                    >
                      <span>{getSeverityIcon('error')}</span>
                      <span>{issuesBySeverity.error.length}</span>
                    </Badge>
                  )}
                  {issuesBySeverity.warning.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-6 px-2 text-xs cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-md bg-orange-100 text-orange-700 hover:bg-orange-200 flex items-center gap-1.5"
                      onClick={(e) => handleSeverityClick('warning', e)}
                      title={`${issuesBySeverity.warning.length} warning${issuesBySeverity.warning.length > 1 ? 's' : ''}`}
                    >
                      <span>{getSeverityIcon('warning')}</span>
                      <span>{issuesBySeverity.warning.length}</span>
                    </Badge>
                  )}
                  {issuesBySeverity.info.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-6 px-2 text-xs cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-md bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-1.5"
                      onClick={(e) => handleSeverityClick('information', e)}
                      title={`${issuesBySeverity.info.length} info message${issuesBySeverity.info.length > 1 ? 's' : ''}`}
                    >
                      <span>{getSeverityIcon('information')}</span>
                      <span>{issuesBySeverity.info.length}</span>
                    </Badge>
                  )}
                </>
              )}
            </div>
          ) : (
            // Edit mode: delete button (only for optional fields)
            !isRequired && (
              <div className="animate-in fade-in duration-200">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      className="h-8 w-8 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Trash2 className="h-4 w-4 text-gray-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Delete field
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          )}
        </div>
      </div>

      {/* Validation error (edit mode only) */}
      {isEditMode && validationError && (
        <div className="flex items-center gap-1 text-xs text-red-600 mt-1 ml-[288px] animate-in fade-in duration-200">
          <AlertCircle className="h-3 w-3" />
          {validationError}
        </div>
      )}

      {/* Children with smooth transition */}
      {isComplex && (
        <div 
          className={cn(
            "overflow-hidden transition-all duration-200 ease-in-out",
            isExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="mt-1">
            {valueType === 'array' && (
              <ArrayContainer
                value={value}
                path={fullPath}
                level={level + 1}
                resourceType={resourceType}
                isEditMode={isEditMode}
                expandAll={expandAll}
                expandedPaths={expandedPaths}
                onExpandedPathsChange={onExpandedPathsChange}
                validationIssues={validationIssues}
                onCategoryChange={onCategoryChange}
                onSeverityChange={onSeverityChange}
                onIssueClick={onIssueClick}
                onValueChange={onValueChange}
                onDeleteNode={onDeleteNode}
                highlightedPath={highlightedPath}
              />
            )}
            {(valueType === 'object' || (isGhost && isExpanded)) && (
              <ObjectContainer
                value={value || {}}
                path={fullPath}
                level={level + 1}
                resourceType={resourceType}
                isEditMode={isEditMode}
                expandAll={expandAll}
                expandedPaths={expandedPaths}
                onExpandedPathsChange={onExpandedPathsChange}
                validationIssues={validationIssues}
                onCategoryChange={onCategoryChange}
                onSeverityChange={onSeverityChange}
                onIssueClick={onIssueClick}
                onValueChange={onValueChange}
                onDeleteNode={onDeleteNode}
                highlightedPath={highlightedPath}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

