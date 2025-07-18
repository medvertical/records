import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Info, Hash, Calendar, User, Link2, List, FileText, Code } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ValidationResult } from '@shared/schema';

interface ResourceTreeViewerProps {
  resourceData: any;
  validationResults: ValidationResult[];
  selectedCategory?: string;
  selectedSeverity?: string;
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string) => void;
}

interface TreeNodeProps {
  nodeKey: string;
  value: any;
  path: string;
  depth: number;
  validationIssues: ValidationIssue[];
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
}

interface ValidationIssue {
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
  togglePath
}) => {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;
  const isExpanded = expandedPaths.has(path);
  
  // Filter issues for this exact path
  const directIssues = validationIssues.filter(issue => {
    // For root level, only match issues without a path or with the resource type itself
    if (path === '') {
      return !issue.path || issue.path === nodeKey;
    }
    
    // For nested paths, match exact path or child paths
    const normalizedIssuePath = issue.path.toLowerCase();
    const normalizedCurrentPath = path.toLowerCase();
    
    // Debug logging for first few levels
    if (depth < 2) {
      console.log(`[TreeNode] Checking path "${path}" against issue path "${issue.path}"`);
    }
    
    // Match exact path or child paths
    return normalizedIssuePath === normalizedCurrentPath || 
           normalizedIssuePath.startsWith(`${normalizedCurrentPath}.`) ||
           normalizedIssuePath.startsWith(`${normalizedCurrentPath}[`);
  });
  
  const hasErrors = directIssues.some(i => i.severity === 'error');
  const hasWarnings = directIssues.some(i => i.severity === 'warning');
  const hasInfo = directIssues.some(i => i.severity === 'information');

  return (
    <div className="group">
      <div 
        className={cn(
          "flex items-start py-1 hover:bg-gray-50 rounded px-2 -mx-2 cursor-pointer",
          hasErrors && "bg-red-50 hover:bg-red-100",
          !hasErrors && hasWarnings && "bg-orange-50 hover:bg-orange-100",
          !hasErrors && !hasWarnings && hasInfo && "bg-blue-50 hover:bg-blue-100"
        )}
        style={{ paddingLeft: `${depth * 1.5}rem` }}
        onClick={() => isExpandable && togglePath(path)}
      >
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

        {/* Value or Summary */}
        {!isExpandable && (
          <>
            <span className="text-gray-500 mr-2">:</span>
            <div className="flex items-center gap-1">
              {getValueIcon(value)}
              <span className="font-mono text-sm text-gray-900">
                {formatValue(value)}
              </span>
            </div>
          </>
        )}
        
        {isArray && (
          <Badge variant="outline" className="ml-2 text-xs">
            {value.length} items
          </Badge>
        )}
        
        {isObject && !isArray && (
          <Badge variant="outline" className="ml-2 text-xs">
            {Object.keys(value).length} properties
          </Badge>
        )}

        {/* Validation Indicators */}
        <div className="ml-auto flex items-center gap-1">
          {hasErrors && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {directIssues.filter(i => i.severity === 'error').length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {directIssues.filter(i => i.severity === 'error').length} validation error(s)
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {hasWarnings && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-orange-100 text-orange-800 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {directIssues.filter(i => i.severity === 'warning').length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {directIssues.filter(i => i.severity === 'warning').length} warning(s)
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {hasInfo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                    <Info className="h-3 w-3 mr-1" />
                    {directIssues.filter(i => i.severity === 'information').length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {directIssues.filter(i => i.severity === 'information').length} information message(s)
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Validation Messages for this node */}
      {isExpanded && directIssues.filter(i => i.path === path).length > 0 && (
        <div 
          className="mt-1 space-y-1"
          style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}
        >
          {directIssues.filter(i => i.path === path).map((issue, idx) => (
            <Card key={idx} className={cn(
              "border-l-4",
              issue.severity === 'error' && "border-l-red-500 bg-red-50",
              issue.severity === 'warning' && "border-l-orange-500 bg-orange-50",
              issue.severity === 'information' && "border-l-blue-500 bg-blue-50"
            )}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  {issue.severity === 'error' && <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                  {issue.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />}
                  {issue.severity === 'information' && <Info className="h-4 w-4 text-blue-600 mt-0.5" />}
                  
                  <div className="flex-1">
                    <p className="text-sm">{issue.message}</p>
                    
                    {issue.category && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {issue.category}
                      </Badge>
                    )}
                    
                    {issue.recommendation && (
                      <p className="text-xs text-gray-600 mt-1">
                        💡 {issue.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
  onCategoryChange,
  onSeverityChange
}: ResourceTreeViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']));
  const [expandAll, setExpandAll] = useState(false);

  // Process validation results into a more usable format and deduplicate
  const allValidationIssues = useMemo(() => {
    const issuesMap = new Map<string, ValidationIssue>();
    
    validationResults.forEach(result => {
      if (result.issues) {
        result.issues.forEach((issue: any) => {
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
      
      return true;
    });
  }, [allValidationIssues, selectedCategory, selectedSeverity]);

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

  const errorCount = validationIssues.filter(i => i.severity === 'error').length;
  const warningCount = validationIssues.filter(i => i.severity === 'warning').length;
  const infoCount = validationIssues.filter(i => i.severity === 'information').length;
  
  // Get unique categories from all issues
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allValidationIssues.forEach(issue => {
      if (issue.category) cats.add(issue.category);
    });
    return Array.from(cats).sort();
  }, [allValidationIssues]);

  return (
    <div className="space-y-4">
      {/* Controls and Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandAll}
            >
              {expandAll ? 'Collapse All' : 'Expand All'}
            </Button>
            
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <Badge variant="destructive">
                  {errorCount} Error{errorCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-orange-100 text-orange-800">
                  {warningCount} Warning{warningCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {infoCount > 0 && (
                <Badge className="bg-blue-100 text-blue-800">
                  {infoCount} Info
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Active Filter Summary */}
        {allValidationIssues.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Showing {validationIssues.length} of {allValidationIssues.length} issues
            {(selectedCategory !== 'all' || selectedSeverity !== 'all') && (
              <span className="ml-2">
                (filtered by {selectedCategory !== 'all' && `category: ${selectedCategory}`}
                {selectedCategory !== 'all' && selectedSeverity !== 'all' && ', '}
                {selectedSeverity !== 'all' && `severity: ${selectedSeverity}`})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tree View */}
      <Card>
        <CardContent className="p-4">
          <TreeNode
            nodeKey={resourceData.resourceType || 'Resource'}
            value={resourceData}
            path=""
            depth={0}
            validationIssues={validationIssues}
            expandedPaths={expandedPaths}
            togglePath={togglePath}
          />
        </CardContent>
      </Card>
      

    </div>
  );
}