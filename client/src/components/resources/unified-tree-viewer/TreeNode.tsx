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
    
    const normalizedHighlightPath = highlightedPath ? normalizePathForComparison(highlightedPath) : '';
    const normalizedPathString = normalizePathForComparison(pathString);
    
    // Also check exact match (case-insensitive) as fallback
    const isExactMatch = highlightedPath && highlightedPath.toLowerCase() === pathString.toLowerCase();
    const isNormalizedMatch = highlightedPath && normalizedHighlightPath === normalizedPathString;
    const isMatch = isExactMatch || isNormalizedMatch;
    
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
  }, [highlightedPath, pathString, isHighlighted]);

  // Handle expand/collapse toggle
  const handleToggleExpanded = useCallback(() => {
    if (!onExpandedPathsChange || !expandedPaths) return;
    
    const newExpandedPaths = new Set(expandedPaths);
    if (expandedPaths.has(pathString)) {
      newExpandedPaths.delete(pathString);
    } else {
      newExpandedPaths.add(pathString);
    }
    onExpandedPathsChange(newExpandedPaths);
  }, [pathString, expandedPaths, onExpandedPathsChange]);


  // Get validation issues for this path (view mode) - case insensitive matching
  // Normalize paths by removing array indices for comparison
  const normalizePathForMatching = (path: string) => {
    return path.toLowerCase().replace(/\.\[\d+\]/g, '');
  };
  
  const directPathIssues = validationIssues.filter(issue => {
    const issuePath = issue.path?.toLowerCase() || '';
    const locationPath = issue.location?.join('.').toLowerCase() || '';
    const currentPath = pathString.toLowerCase();
    
    // Check exact match first (highest priority)
    const exactMatch = issuePath === currentPath || locationPath === currentPath;
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
      const normalizedMatch = normalizedIssuePath === normalizedCurrentPath || normalizedLocationPath === normalizedCurrentPath;
      
      return normalizedMatch;
    }
    
    return false;
  });
  
  // If node is collapsed and complex, get all child issues for aggregation
  const childPathIssues = (!isExpanded && isComplex) ? validationIssues.filter(issue => {
    const issuePath = issue.path?.toLowerCase() || '';
    const currentPath = pathString.toLowerCase();
    
    // Check exact match first
    const exactChildMatch = issuePath.startsWith(currentPath + '.') && issuePath !== currentPath;
    
    // Also check normalized match (without array indices)
    const normalizedIssuePath = normalizePathForMatching(issuePath);
    const normalizedCurrentPath = normalizePathForMatching(currentPath);
    const normalizedChildMatch = normalizedIssuePath.startsWith(normalizedCurrentPath + '.') && normalizedIssuePath !== normalizedCurrentPath;
    
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
      ref={nodeRef}
      id={`node-${pathString.replace(/\./g, '-').replace(/\[|\]/g, '_')}`}
      className={cn(
        'relative transition-all duration-300 mb-1 rounded-md',
        !isEditMode && hasIssues && `border-l-4 ${severityColor}`,
        isHighlighted && 'animate-in fade-in duration-300'
      )}
    >
      <div className={cn(
        "flex items-center gap-2 py-1.5 px-2 group transition-all duration-300",
        isHighlighted ? 'bg-yellow-100' : 'hover:bg-gray-50'
      )}>
        {/* Key column: 280px fixed width with indentation */}
        <div 
          className="flex items-center gap-1 flex-shrink-0 transition-all duration-200"
          style={{ width: '280px', paddingLeft: `${level * 1.5 + 0.5}rem` }}
        >
          {/* Expand/Collapse Button */}
          {isComplex ? (
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
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

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
                      className="h-6 px-2 text-xs cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-md"
                      onClick={(e) => handleSeverityClick('error', e)}
                      title={`${issuesBySeverity.error.length} error${issuesBySeverity.error.length > 1 ? 's' : ''}`}
                    >
                      {getSeverityIcon('error')} {issuesBySeverity.error.length}
                    </Badge>
                  )}
                  {issuesBySeverity.warning.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-6 px-2 text-xs cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-md bg-orange-100 text-orange-700 hover:bg-orange-200"
                      onClick={(e) => handleSeverityClick('warning', e)}
                      title={`${issuesBySeverity.warning.length} warning${issuesBySeverity.warning.length > 1 ? 's' : ''}`}
                    >
                      {getSeverityIcon('warning')} {issuesBySeverity.warning.length}
                    </Badge>
                  )}
                  {issuesBySeverity.info.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-6 px-2 text-xs cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-md bg-blue-100 text-blue-700 hover:bg-blue-200"
                      onClick={(e) => handleSeverityClick('information', e)}
                      title={`${issuesBySeverity.info.length} info message${issuesBySeverity.info.length > 1 ? 's' : ''}`}
                    >
                      {getSeverityIcon('information')} {issuesBySeverity.info.length}
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

