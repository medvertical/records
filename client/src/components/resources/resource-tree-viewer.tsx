import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Info, Hash, Calendar, User, Link2, List, FileText, Code } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ValidationResult } from '@shared/schema';
import { 
  getCategoryIcon, 
  getSeverityIcon, 
  getCategoryColor, 
  getSeverityColor
} from "@/lib/validation-icons";

interface ResourceTreeViewerProps {
  resourceData: any;
  validationResults: ValidationResult[];
  selectedCategory?: string;
  selectedSeverity?: string;
  selectedPath?: string;
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string, path?: string) => void;
  onIssueClick?: (issueId: string) => void;
}

interface TreeNodeProps {
  nodeKey: string;
  value: any;
  path: string;
  depth: number;
  validationIssues: ValidationIssue[];
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  onIssueClick?: (issueId: string) => void;
  selectedSeverity?: string;
  selectedPath?: string;
  onSeverityChange?: (severity: string, path?: string) => void;
}

interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'information';
  message: string;
  path: string;
  category?: string;
  recommendation?: string;
}

// Helper to determine the icon for a value type
const getValueIcon = (value: any) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) return <Calendar className="h-3 w-3" />;
    if (value.match(/^https?:\/\//)) return <Link2 className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  }
  if (typeof value === 'number') return <Hash className="h-3 w-3" />;
  if (typeof value === 'boolean') return <Code className="h-3 w-3" />;
  if (Array.isArray(value)) return <List className="h-3 w-3" />;
  return <Code className="h-3 w-3" />;
};

// Helper to format values for display
const formatValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  return '';
};

const TreeNode: React.FC<TreeNodeProps> = ({ 
  nodeKey, 
  value, 
  path, 
  depth, 
  validationIssues,
  expandedPaths,
  togglePath,
  onIssueClick,
  selectedSeverity,
  selectedPath,
  onSeverityChange
}) => {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;
  const isExpanded = expandedPaths.has(path);
  
  // Get all issues for this path and its descendants
  const getAllDescendantIssues = (currentPath: string) => {
    return validationIssues.filter(issue => {
      if (currentPath === '') {
        return !issue.path || issue.path === nodeKey;
      }
      const normalizedIssuePath = issue.path.toLowerCase();
      const normalizedCurrentPath = currentPath.toLowerCase();
      return normalizedIssuePath === normalizedCurrentPath || 
             normalizedIssuePath.startsWith(`${normalizedCurrentPath}.`) ||
             normalizedIssuePath.startsWith(`${normalizedCurrentPath}[`);
    });
  };

  // Check if a child path is currently expanded and visible
  const isChildPathExpanded = (childPath: string) => {
    // Check if the direct parent is expanded all the way down to this child
    const pathSegments = childPath.split(/[\.\[\]]+/).filter(Boolean);
    const currentSegments = path.split(/[\.\[\]]+/).filter(Boolean);
    
    // Build the path progressively to check each level
    for (let i = currentSegments.length; i < pathSegments.length - 1; i++) {
      const intermediatePath = pathSegments.slice(0, i + 1).join('.');
      if (!expandedPaths.has(intermediatePath)) {
        return false;
      }
    }
    return true;
  };

  // Get issues to display at this level
  const displayIssues = getAllDescendantIssues(path).filter(issue => {
    const normalizedIssuePath = issue.path.toLowerCase();
    const normalizedCurrentPath = path.toLowerCase();
    
    // For collapsed nodes, show all descendant issues EXCEPT those visible in expanded children
    if (!isExpanded && isExpandable) {
      // Check if this issue is being displayed by a visible child
      // First check immediate children
      const immediateChildren = isArray 
        ? Array.from({ length: value.length }, (_, i) => `${path}[${i}]`)
        : Object.keys(value).map(key => path ? `${path}.${key}` : key);
      
      // If any immediate child is expanded and has this issue, don't show it here
      for (const childPath of immediateChildren) {
        if (expandedPaths.has(childPath)) {
          // Check if the expanded child would display this issue
          const childIssues = getAllDescendantIssues(childPath);
          const hasIssue = childIssues.some(childIssue => 
            childIssue.code === issue.code && 
            childIssue.message === issue.message &&
            childIssue.path === issue.path
          );
          if (hasIssue) {
            return false; // Don't show at parent level
          }
        }
      }
      
      return true; // Show at this level
    }
    
    // For expanded nodes or leaf nodes, only show direct issues
    if (path === '') {
      return !issue.path || issue.path === nodeKey;
    }
    // Only show direct issues when expanded
    const segments = normalizedIssuePath.split(/[\.\[\]]+/).filter(Boolean);
    const currentSegments = normalizedCurrentPath.split(/[\.\[\]]+/).filter(Boolean);
    return segments.length === currentSegments.length || 
           normalizedIssuePath === normalizedCurrentPath;
  });
  
  const hasErrors = displayIssues.some(i => i.severity === 'error');
  const hasWarnings = displayIssues.some(i => i.severity === 'warning');
  const hasInfo = displayIssues.some(i => i.severity === 'information');

  return (
    <div className="group">
      <div 
        className={cn(
          "grid grid-cols-[1fr,auto] gap-4 py-1 hover:bg-gray-50 rounded px-2 -mx-2 cursor-pointer",
          hasErrors && "bg-red-50 hover:bg-red-100",
          !hasErrors && hasWarnings && "bg-orange-50 hover:bg-orange-100",
          !hasErrors && !hasWarnings && hasInfo && "bg-blue-50 hover:bg-blue-100"
        )}
        onClick={() => isExpandable && togglePath(path)}
      >
        {/* Left column: Hierarchy */}
        <div className="flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
          {/* Expand/Collapse Icon */}
          {isExpandable && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 mr-1"
              onClick={(e) => {
                e.stopPropagation();
                togglePath(path);
              }}
            >
              {isExpanded ? 
                <ChevronDown className="h-3 w-3" /> : 
                <ChevronRight className="h-3 w-3" />
              }
            </Button>
          )}
          {!isExpandable && <div className="w-6" />}
          
          {/* Property Name */}
          <span className="font-mono text-sm font-semibold text-gray-700 mr-2">
            {nodeKey}
          </span>
          
          {/* Type indicators for complex types */}
          {isArray && (
            <Badge variant="outline" className="ml-2 text-xs">
              Array [{value.length}]
            </Badge>
          )}
          
          {isObject && !isArray && (
            <Badge variant="outline" className="ml-2 text-xs">
              Object
            </Badge>
          )}
        </div>

        {/* Right column: Value display and validation badges */}
        <div className="flex items-center gap-2 justify-between">
          {/* Value display for simple types */}
          {!isExpandable && (
            <div className="flex items-center gap-1">
              {getValueIcon(value)}
              <span className="font-mono text-sm text-gray-900 max-w-[400px] truncate text-left">
                {formatValue(value)}
              </span>
            </div>
          )}
          
          {/* Empty div for expandable items to push badges to the right */}
          {isExpandable && <div />}
          
          {/* Validation Indicators */}
          <div className="flex items-center gap-1 flex-shrink-0">
          {hasErrors && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSeverityChange) {
                        // Toggle severity filter with path
                        const isActive = selectedSeverity === 'error' && selectedPath === path;
                        onSeverityChange(isActive ? 'all' : 'error', isActive ? undefined : path);
                      }
                    }}
                  >
                    <Badge 
                      variant="destructive" 
                      className={`text-xs cursor-pointer ${
                        selectedSeverity === 'error' && selectedPath === path 
                          ? 'bg-red-700 hover:bg-red-800' 
                          : ''
                      }`}
                    >
                      {getSeverityIcon('error', "h-3 w-3 mr-1")}
                      {displayIssues.filter(i => i.severity === 'error').length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {displayIssues.filter(i => i.severity === 'error').length} validation error(s)
                    <br />
                    <span className="text-xs text-gray-400">
                      Click to {selectedSeverity === 'error' ? 'remove filter' : 'filter by errors'}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {hasWarnings && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSeverityChange) {
                        // Toggle severity filter with path
                        const isActive = selectedSeverity === 'warning' && selectedPath === path;
                        onSeverityChange(isActive ? 'all' : 'warning', isActive ? undefined : path);
                      }
                    }}
                  >
                    <Badge 
                      className={`text-xs cursor-pointer ${
                        selectedSeverity === 'warning' && selectedPath === path
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {getSeverityIcon('warning', "h-3 w-3 mr-1")}
                      {displayIssues.filter(i => i.severity === 'warning').length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {displayIssues.filter(i => i.severity === 'warning').length} warning(s)
                    <br />
                    <span className="text-xs text-gray-400">
                      Click to {selectedSeverity === 'warning' ? 'remove filter' : 'filter by warnings'}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {hasInfo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSeverityChange) {
                        // Toggle severity filter with path
                        const isActive = selectedSeverity === 'information' && selectedPath === path;
                        onSeverityChange(isActive ? 'all' : 'information', isActive ? undefined : path);
                      }
                    }}
                  >
                    <Badge 
                      className={`text-xs cursor-pointer ${
                        selectedSeverity === 'information' && selectedPath === path
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {getSeverityIcon('information', "h-3 w-3 mr-1")}
                      {displayIssues.filter(i => i.severity === 'information').length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {displayIssues.filter(i => i.severity === 'information').length} information message(s)
                    <br />
                    <span className="text-xs text-gray-400">
                      Click to {selectedSeverity === 'information' ? 'remove filter' : 'filter by information'}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          </div>
        </div>
      </div>

      {/* Render children if expanded */}
      {isExpanded && isExpandable && (
        <div className="mt-1">
          {isArray ? (
            value.map((item: any, index: number) => (
              <TreeNode
                key={index}
                nodeKey={`[${index}]`}
                value={item}
                path={`${path}[${index}]`}
                depth={depth + 1}
                validationIssues={validationIssues}
                expandedPaths={expandedPaths}
                togglePath={togglePath}
                onIssueClick={onIssueClick}
                selectedSeverity={selectedSeverity}
                selectedPath={selectedPath}
                onSeverityChange={onSeverityChange}
              />
            ))
          ) : (
            Object.entries(value).map(([key, val]) => (
              <TreeNode
                key={key}
                nodeKey={key}
                value={val}
                path={path ? `${path}.${key}` : key}
                depth={depth + 1}
                validationIssues={validationIssues}
                expandedPaths={expandedPaths}
                togglePath={togglePath}
                onIssueClick={onIssueClick}
                selectedSeverity={selectedSeverity}
                selectedPath={selectedPath}
                onSeverityChange={onSeverityChange}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default function ResourceTreeViewer({ 
  resourceData, 
  validationResults,
  selectedCategory = 'all',
  selectedSeverity = 'all',
  selectedPath,
  onCategoryChange,
  onSeverityChange,
  onIssueClick
}: ResourceTreeViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']));
  const [expandAll, setExpandAll] = useState(false);

  // Process validation results into a more usable format and deduplicate
  const allValidationIssues = useMemo(() => {
    const issuesMap = new Map<string, ValidationIssue>();
    
    validationResults.forEach(result => {
      if (result.issues && Array.isArray(result.issues)) {
        (result.issues as any[]).forEach((issue: any, index: number) => {
          // Extract path from various formats
          let path = '';
          
          // Try different path formats
          if (issue.path) {
            // Handle complex paths like "Patient.identifier, element Patient(...).identifier"
            // Extract the simple field path after the resource type
            const pathMatch = issue.path.match(/^[A-Z][a-zA-Z]+\.(.+?)(?:,|$)/);
            if (pathMatch) {
              path = pathMatch[1];
            } else {
              // Handle simple paths that are already in the right format
              path = issue.path;
            }
            
            // Remove any resource type prefix (e.g., "Patient." from "Patient.identifier")
            path = path.replace(/^[A-Z][a-zA-Z]+\./, '');
            
            // Clean up any remaining complex parts
            if (path.includes(', element')) {
              path = path.split(', element')[0];
            }
          } else if (issue.expression) {
            // Handle expression-based paths
            path = issue.expression;
          } else if (issue.location && Array.isArray(issue.location)) {
            // Handle location arrays
            path = issue.location.join('.');
          }
          
          // Create unique key for deduplication
          const issueKey = `${path}|${issue.severity}|${issue.message}`;
          
          // Only add if not already present (deduplication)
          if (!issuesMap.has(issueKey)) {
            issuesMap.set(issueKey, {
              id: `${result.id}-${index}`,
              severity: issue.severity || 'information',
              message: issue.message || '',
              path: path,
              category: issue.category || 'structural',
              recommendation: issue.recommendation
            });
          }
        });
      }
    });
    
    return Array.from(issuesMap.values());
  }, [validationResults]);
  
  // Apply filters to validation issues
  const validationIssues = useMemo(() => {
    return allValidationIssues.filter(issue => {
      // Filter by category
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) {
        return false;
      }
      
      // Filter by severity
      if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) {
        return false;
      }
      
      // Filter by path if specified
      if (selectedPath !== undefined) {
        // For exact path match or child paths
        // If selectedPath is empty string, it's the root level
        if (selectedPath === '') {
          // Root level - only show issues without dots in the path
          if (issue.path.includes('.')) {
            return false;
          }
        } else {
          // Check if the issue path matches exactly or is a child
          // e.g., selectedPath "agent" should match "agent", "agent.type", "agent[0]", etc.
          // but NOT "entity.agent" or other paths containing "agent" elsewhere
          const isExactMatch = issue.path === selectedPath;
          const isChildPath = issue.path.startsWith(selectedPath + '.') || 
                             issue.path.startsWith(selectedPath + '[');
          
          if (!isExactMatch && !isChildPath) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [allValidationIssues, selectedCategory, selectedSeverity, selectedPath]);

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpandedPaths(new Set(['']));
    } else {
      // Recursively find all paths
      const allPaths = new Set<string>(['']);
      
      const findPaths = (obj: any, currentPath: string) => {
        if (obj && typeof obj === 'object') {
          allPaths.add(currentPath);
          
          if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
              findPaths(item, `${currentPath}[${index}]`);
            });
          } else {
            Object.entries(obj).forEach(([key, value]) => {
              const newPath = currentPath ? `${currentPath}.${key}` : key;
              findPaths(value, newPath);
            });
          }
        }
      };
      
      findPaths(resourceData, '');
      setExpandedPaths(allPaths);
    }
    setExpandAll(!expandAll);
  };

  // Get raw counts from validation results to match counts shown elsewhere
  const totalErrorCount = validationResults.reduce((sum, vr) => sum + (vr.errorCount || 0), 0);
  const totalWarningCount = validationResults.reduce((sum, vr) => sum + (vr.warningCount || 0), 0);
  const totalInfoCount = validationResults.reduce((sum, vr) => {
    if (vr.issues && Array.isArray(vr.issues)) {
      return sum + (vr.issues as any[]).filter((i: any) => i.severity === 'information').length;
    }
    return sum;
  }, 0);
  
  // Count from filtered issues (for display when filters are active)
  const filteredErrorCount = validationIssues.filter(i => i.severity === 'error').length;
  const filteredWarningCount = validationIssues.filter(i => i.severity === 'warning').length;
  const filteredInfoCount = validationIssues.filter(i => i.severity === 'information').length;
  
  // Get unique categories from all issues
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allValidationIssues.forEach(issue => {
      if (issue.category) cats.add(issue.category);
    });
    return Array.from(cats).sort();
  }, [allValidationIssues]);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExpandAll}
        className="absolute right-0 top-0 text-xs z-10"
      >
        {expandAll ? 'Collapse All' : 'Expand All'}
      </Button>
      <div className="pr-24">
        <TreeNode
          nodeKey={resourceData.resourceType || 'Resource'}
          value={resourceData}
          path=""
          depth={0}
          validationIssues={validationIssues}
          expandedPaths={expandedPaths}
          togglePath={togglePath}
          onIssueClick={onIssueClick}
          selectedSeverity={selectedSeverity}
          selectedPath={selectedPath}
          onSeverityChange={onSeverityChange}
        />
      </div>
    </div>
  );
}