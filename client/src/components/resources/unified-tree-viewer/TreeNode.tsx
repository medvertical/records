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
}: TreeNodeProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Generate path string for this node
  const pathString = path.length === 0 ? nodeKey : `${path.join('.')}.${nodeKey}`;
  
  // Check if this node is expanded from shared state
  const isExpanded = expandedPaths?.has(pathString) ?? (level < 2);
  
  const fullPath = [...path, nodeKey];
  const isRequired = resourceType ? isFieldRequired(resourceType, nodeKey) : false;
  const valueType = getTypeName(value);
  const isComplex = valueType === 'object' || valueType === 'array';

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
  }, [pathString, onExpandedPathsChange]);


  // Get validation issues for this path (view mode)
  const pathIssues = validationIssues.filter(issue => 
    issue.path === pathString || issue.location?.join('.') === pathString
  );
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
  const handleSeverityClick = (severity: string) => {
    onSeverityChange?.(severity, pathString);
  };
  
  const handleCategoryClick = (category: string) => {
    onCategoryChange?.(category);
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
        {renderViewValue(val)}
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
    <div className={cn(
      'relative transition-all duration-200',
      !isEditMode && hasIssues && `border-l-2 ${severityColor}`
    )}>
      <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 group">
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

          <span className="text-sm font-medium text-gray-700 truncate font-mono transition-all duration-200">
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
            // View mode: validation badges
            <div className="animate-in fade-in duration-200">
              {hasIssues && pathIssues.map((issue, index) => (
                <div key={issue.id || index} className="flex items-center gap-1">
                  <Badge
                    variant={issue.severity === 'error' ? 'destructive' : 'secondary'}
                    className="h-5 text-xs cursor-pointer transition-all duration-150 hover:scale-105"
                    onClick={() => handleSeverityClick(issue.severity || 'information')}
                  >
                    {getSeverityIcon(issue.severity || 'information')}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="h-5 text-xs cursor-pointer transition-all duration-150 hover:scale-105"
                    onClick={() => handleCategoryClick(issue.category || 'general')}
                  >
                    {getCategoryIcon(issue.category || 'general')}
                  </Badge>
                </div>
              ))}
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
              />
            )}
            {valueType === 'object' && (
              <ObjectContainer
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
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

