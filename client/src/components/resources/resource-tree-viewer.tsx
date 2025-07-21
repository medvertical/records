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
  onCategoryChange?: (category: string) => void;
  onSeverityChange?: (severity: string) => void;
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
  onIssueClick
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
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      const errorIssues = directIssues.filter(i => i.severity === 'error');
                      if (errorIssues.length > 0 && onIssueClick) {
                        onIssueClick(errorIssues[0].id);
                      }
                    }}
                  >
                    <Badge variant="destructive" className="text-xs cursor-pointer">
                      {getSeverityIcon('error', "h-3 w-3 mr-1")}
                      {directIssues.filter(i => i.severity === 'error').length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {directIssues.filter(i => i.severity === 'error').length} validation error(s)
                    <br />
                    <span className="text-xs text-gray-400">Click to view details</span>
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
                      const warningIssues = directIssues.filter(i => i.severity === 'warning');
                      if (warningIssues.length > 0 && onIssueClick) {
                        onIssueClick(warningIssues[0].id);
                      }
                    }}
                  >
                    <Badge className="bg-orange-100 text-orange-800 text-xs cursor-pointer">
                      {getSeverityIcon('warning', "h-3 w-3 mr-1")}
                      {directIssues.filter(i => i.severity === 'warning').length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {directIssues.filter(i => i.severity === 'warning').length} warning(s)
                    <br />
                    <span className="text-xs text-gray-400">Click to view details</span>
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
                      const infoIssues = directIssues.filter(i => i.severity === 'information');
                      if (infoIssues.length > 0 && onIssueClick) {
                        onIssueClick(infoIssues[0].id);
                      }
                    }}
                  >
                    <Badge className="bg-blue-100 text-blue-800 text-xs cursor-pointer">
                      {getSeverityIcon('information', "h-3 w-3 mr-1")}
                      {directIssues.filter(i => i.severity === 'information').length}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    {directIssues.filter(i => i.severity === 'information').length} information message(s)
                    <br />
                    <span className="text-xs text-gray-400">Click to view details</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
        />
      </div>
    </div>
  );
}