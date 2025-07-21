import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Shield, CheckCircle, AlertTriangle, RefreshCw, Info, AlertCircle } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ValidationResults } from '@/components/validation/validation-results';
import ResourceTreeViewer from '@/components/resources/resource-tree-viewer';
import { Progress } from "@/components/ui/progress";
import { 
  getCategoryIcon, 
  getSeverityIcon, 
  getCategoryColor, 
  getSeverityColor,
  categoryDescriptions
} from "@/lib/validation-icons";
import { CircularProgress } from "@/components/ui/circular-progress";

// Validation summary badge component
function ValidationSummaryBadge({ result }: { result: any }) {
  const { summary } = result;
  const totalIssues = summary?.totalIssues || 0;
  const errorCount = summary?.errorCount || 0;
  const warningCount = summary?.warningCount || 0;
  const score = summary?.score || 0;

  if (totalIssues === 0) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Valid ({score}%)
      </Badge>
    );
  }

  if (errorCount > 0) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        {errorCount} errors, {warningCount} warnings ({score}%)
      </Badge>
    );
  }

  return (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {warningCount} warnings ({score}%)
    </Badge>
  );
}

// Optimized validation results component
function OptimizedValidationResults({ result, onRevalidate, isValidating, selectedCategory, selectedSeverity, selectedPath, highlightedIssueId, onClearFilters }: { 
  result: any; 
  onRevalidate: () => void; 
  isValidating: boolean;
  selectedCategory: string;
  selectedSeverity: string;
  selectedPath?: string;
  highlightedIssueId?: string | null;
  onClearFilters?: () => void;
}) {

  // Filter issues based on selected filters
  const filteredIssues = result.issues.filter((issue: any) => {
    const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
    const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
    
    // Apply path filter if specified
    let pathMatch = true;
    if (selectedPath !== undefined) {
      const issuePath = issue.path || (issue.location && issue.location[0]) || '';
      
      if (selectedPath === '') {
        // Root level - only show issues without dots in the path
        pathMatch = !issuePath.includes('.');
      } else {
        // Check if the issue path matches in various ways
        const isExactMatch = issuePath === selectedPath;
        const isChildPath = issuePath.startsWith(selectedPath + '.') || 
                           issuePath.startsWith(selectedPath + '[');
        // Also check if issue path ends with the selected path (e.g., "AuditEvent.extension" ends with "extension")
        const endsWithPath = issuePath.endsWith('.' + selectedPath) || 
                            issuePath.endsWith('[' + selectedPath);
        // Or if the issue path contains the selected path as a segment
        const containsAsSegment = issuePath.split(/[\.\[\]]+/).includes(selectedPath);
        
        pathMatch = isExactMatch || isChildPath || endsWithPath || containsAsSegment;
      }
    }
    
    return categoryMatch && severityMatch && pathMatch;
  });

  const getCategoryDescription = (category: string) => {
    return categoryDescriptions[category] || categoryDescriptions.general;
  };

  // Group issues by category
  const groupedIssues = filteredIssues.reduce((acc: any, issue: any) => {
    const category = issue.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(issue);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Results summary and active filters */}
      <div className="space-y-2">
        <div className="text-sm text-gray-500">
          Showing {filteredIssues.length} of {result.issues.length} issues
        </div>
        
        {/* Active filters indicator */}
        {(selectedCategory !== 'all' || selectedSeverity !== 'all' || selectedPath !== undefined) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600">Active filters:</span>
            {selectedCategory !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                Category: {selectedCategory}
              </Badge>
            )}
            {selectedSeverity !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                Severity: {selectedSeverity}
              </Badge>
            )}
            {selectedPath !== undefined && (
              <Badge variant="secondary" className="text-xs">
                Path: {selectedPath || 'root'}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => {
                if (onClearFilters) {
                  onClearFilters();
                }
              }}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Issues by Category */}
      {Object.entries(groupedIssues).map(([category, categoryIssues]: [string, any]) => (
        <div key={category} className="border rounded-lg p-4">
          <div className="flex items-center mb-3">
            {getCategoryIcon(category, "w-4 h-4")}
            <div className="ml-2">
              <div className="font-medium text-sm capitalize">{category} Validation</div>
              <div className="text-xs text-gray-600">{getCategoryDescription(category)}</div>
            </div>
            <Badge variant="outline" className="ml-auto">
              {categoryIssues.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {categoryIssues.map((issue: any, index: number) => (
              <ValidationIssueDetails 
                key={index} 
                issue={issue} 
                isHighlighted={highlightedIssueId === issue.id}
              />
            ))}
          </div>
        </div>
      ))}

      {filteredIssues.length === 0 && result.issues.length > 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <div className="text-gray-600 font-medium">No issues match the selected filters</div>
          <div className="text-sm text-gray-500 mt-1">
            {result.issues.length} validation {result.issues.length === 1 ? 'message is' : 'messages are'} hidden by filters
          </div>
          {onClearFilters && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onClearFilters}
            >
              Clear filters to see all messages
            </Button>
          )}
        </div>
      )}

      {result.issues.length === 0 && (
        <div className="text-center py-8 text-green-600">
          <CheckCircle className="w-8 h-8 mx-auto mb-2" />
          <div className="font-medium">Validation Passed!</div>
          <div className="text-sm text-gray-600">This resource conforms to FHIR standards</div>
        </div>
      )}
    </div>
  );
}

// Validation issue indicator component
function ValidationIssueIndicator({ issue }: { issue: any }) {
  return (
    <div className="flex items-center">
      <span className={getSeverityColor(issue.severity)}>
        {getSeverityIcon(issue.severity, "h-4 w-4")}
      </span>
      <span className={`text-xs ml-1 ${getSeverityColor(issue.severity)}`}>
        {issue.severity}
      </span>
    </div>
  );
}

// Validation issue details component
function ValidationIssueDetails({ issue, isHighlighted }: { issue: any; isHighlighted?: boolean }) {
  const getSeverityConfig = (severity: string) => {
    switch(severity) {
      case 'error': 
        return { 
          color: 'border-red-200 bg-red-50 text-red-700',
          label: 'Error',
          description: 'Must be fixed for FHIR compliance'
        };
      case 'warning': 
        return { 
          color: 'border-yellow-200 bg-yellow-50 text-yellow-700',
          label: 'Warning', 
          description: 'Should be addressed for best practices'
        };
      case 'information': 
        return { 
          color: 'border-blue-200 bg-blue-50 text-blue-700',
          label: 'Information',
          description: 'Recommendation for optimal FHIR usage'
        };
      default: 
        return { 
          color: 'border-gray-200 bg-gray-50 text-gray-600',
          label: 'Issue',
          description: 'Validation finding'
        };
    }
  };

  const config = getSeverityConfig(issue.severity);
  


  return (
    <div className={`text-xs rounded-lg px-3 py-2 border-l-4 ${config.color} ${
      isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold flex items-center">
          <span className="uppercase tracking-wide">{config.label}</span>
          <span className="mx-1">•</span>
          <span className="font-normal opacity-75">{issue.code}</span>
        </div>
        {issue.category && (
          <span className="text-xs bg-white bg-opacity-50 px-1 py-0.5 rounded">
            {categoryDescriptions[issue.category] || categoryDescriptions.general}
          </span>
        )}
      </div>
      <div className="mb-2 leading-relaxed">
        {issue.message || issue.humanReadable || issue.details}
      </div>
      {issue.suggestion && (
        <div className="mt-2 p-2 bg-white bg-opacity-30 rounded text-xs">
          <div className="font-medium mb-1">💡 Recommendation:</div>
          <div>{issue.suggestion}</div>
        </div>
      )}
      {issue.path && (
        <div className="mt-1 text-xs opacity-60">
          Path: <code className="bg-black bg-opacity-10 px-1 rounded">{issue.path}</code>
        </div>
      )}
    </div>
  );
}

interface ResourceViewerProps {
  resource: any;
  resourceId: string;
  resourceType: string;
  data?: any;
  title?: string;
}

interface CollapsibleNodeProps {
  keyName: string;
  value: any;
  level?: number;
  validationIssues?: any[];
  path?: string;
}

function CollapsibleNode({ keyName, value, level = 0, validationIssues = [], path = '' }: CollapsibleNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Helper function to get the highest severity color for a set of issues
  const getHighestSeverityColor = (issues: any[]) => {
    if (issues.length === 0) return null;
    
    const hasError = issues.some(issue => issue.severity === 'error');
    const hasWarning = issues.some(issue => issue.severity === 'warning');
    const hasInformation = issues.some(issue => issue.severity === 'information');
    
    if (hasError) return 'text-red-700';
    if (hasWarning) return 'text-yellow-700';
    if (hasInformation) return 'text-blue-700';
    return 'text-gray-700';
  };
  
  // Build current path for this node
  const currentPath = path ? `${path}.${keyName}` : keyName;
  
  // Find validation issues for this specific path - check both path and location
  const nodeIssues = validationIssues.filter(issue => {
    // Check if the issue path matches the current path
    const issuePath = issue.path || issue.location?.[0] || '';
    
    // Exact match or starts with current path
    return issuePath === currentPath || 
           issuePath.startsWith(currentPath + '.') || 
           issuePath.startsWith(currentPath + '[') ||
           currentPath.startsWith(issuePath + '.') ||
           currentPath.startsWith(issuePath + '[');
  });
  
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return (
      <div style={{ paddingLeft: level * 20 }} className="py-1">
        <div className="flex items-center">
          <span className="font-medium text-gray-700 min-w-0 flex-shrink-0 mr-2">
            {keyName}:
          </span>
          <span className="text-sm text-gray-400">
            {value === null ? 'null' : 'undefined'}
          </span>
          {nodeIssues.length > 0 && (
            <div className="ml-2 flex items-center space-x-1">
              {nodeIssues.map((issue, index) => (
                <ValidationIssueIndicator key={index} issue={issue} />
              ))}
            </div>
          )}
        </div>
        {nodeIssues.length > 0 && (
          <div className="mt-1">
            {nodeIssues.map((issue, index) => (
              <ValidationIssueDetails key={index} issue={issue} />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isPrimitive = !isObject && !isArray;

  const getSummary = (val: any): string => {
    if (isPrimitive) {
      if (typeof val === 'string' && val.length > 50) {
        return `"${val.substring(0, 47)}..."`;
      }
      return typeof val === 'string' ? `"${val}"` : String(val);
    }
    
    if (isArray) {
      return `Array[${val.length}]`;
    }
    
    if (isObject) {
      const keys = Object.keys(val);
      if (keys.length === 0) return '{}';
      if (keys.length === 1) return `{ ${keys[0]}: ... }`;
      return `{ ${keys[0]}, ${keys[1]}${keys.length > 2 ? `, +${keys.length - 2} more` : ''} }`;
    }
    
    return String(val);
  };

  const getValueType = (val: any): string => {
    if (isArray) return 'array';
    if (isObject) return 'object';
    return typeof val;
  };

  const paddingLeft = level * 20;

  if (isPrimitive) {
    return (
      <div style={{ paddingLeft }} className="py-1">
        <div className="flex items-center">
          <span className={`font-medium min-w-0 flex-shrink-0 mr-2 ${
            getHighestSeverityColor(nodeIssues) || 'text-gray-700'
          }`}>
            {keyName}:
          </span>
          <span className={`text-sm ${
            typeof value === 'string' ? 'text-green-600' :
            typeof value === 'number' ? 'text-blue-600' :
            typeof value === 'boolean' ? 'text-purple-600' :
            'text-gray-600'
          }`}>
            {getSummary(value)}
          </span>
          {nodeIssues.length > 0 && (
            <div className="ml-2 flex items-center space-x-1">
              {nodeIssues.map((issue, index) => (
                <ValidationIssueIndicator key={index} issue={issue} />
              ))}
            </div>
          )}
        </div>
        {nodeIssues.length > 0 && (
          <div className="mt-1 ml-4 space-y-1">
            {nodeIssues.map((issue, index) => (
              <ValidationIssueDetails key={index} issue={issue} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft }} className="py-1">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-6 w-6 mr-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        <span className={`font-medium mr-2 ${
          getHighestSeverityColor(nodeIssues) || 'text-gray-700'
        }`}>
          {keyName}:
        </span>
        <span className="text-sm text-gray-500">
          {getSummary(value)}
        </span>
        <span className="text-xs text-gray-400 ml-2 px-1 py-0.5 bg-gray-100 rounded">
          {getValueType(value)}
        </span>
        {nodeIssues.length > 0 && (
          <div className="ml-2 flex items-center space-x-1">
            {nodeIssues.map((issue, index) => (
              <ValidationIssueIndicator key={index} issue={issue} />
            ))}
          </div>
        )}
      </div>
      
      {nodeIssues.length > 0 && (
        <div className="mt-1 ml-4 space-y-1">
          {nodeIssues.map((issue, index) => (
            <ValidationIssueDetails key={index} issue={issue} />
          ))}
        </div>
      )}
      
      {isExpanded && (
        <div className="mt-1">
          {isArray ? (
            value.map((item: any, index: number) => (
              <CollapsibleNode
                key={index}
                keyName={`[${index}]`}
                value={item}
                level={level + 1}
                validationIssues={validationIssues}
                path={currentPath}
              />
            ))
          ) : isObject ? (
            Object.entries(value || {}).map(([key, val]) => (
              <CollapsibleNode
                key={key}
                keyName={key}
                value={val}
                level={level + 1}
                validationIssues={validationIssues}
                path={currentPath}
              />
            ))
          ) : null}
        </div>
      )}
    </div>
  );
}

function FormView({ data, validationIssues = [] }: { data: any; validationIssues?: any[] }) {
  if (!data || typeof data !== 'object') {
    return (
      <div className="text-gray-500 italic p-4">
        No data available to display
      </div>
    );
  }

  // Handle error responses
  if (data.message && typeof data.message === 'string') {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded">
        <p className="font-medium">Error:</p>
        <p>{data.message}</p>
      </div>
    );
  }

  const entries = Array.isArray(data) 
    ? data.map((item, index) => [`[${index}]`, item])
    : Object.entries(data);

  return (
    <div className="space-y-2 max-h-96 overflow-auto">
      {entries.map(([key, value]) => (
        <CollapsibleNode 
          key={key} 
          keyName={key} 
          value={value} 
          validationIssues={validationIssues}
          path=""
        />
      ))}
    </div>
  );
}

function JsonView({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="text-gray-500 italic p-4">
        No data available to display
      </div>
    );
  }

  // Handle error responses
  if (data.message && typeof data.message === 'string') {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded">
        <p className="font-medium">Error:</p>
        <p>{data.message}</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-auto">
      <SyntaxHighlighter
        language="json"
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        }}
        showLineNumbers
        wrapLines
      >
        {JSON.stringify(data, null, 2)}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ResourceViewer({ resource, resourceId, resourceType, data, title = "Resource Structure" }: ResourceViewerProps) {
  // Use data if provided, otherwise use resource.data
  const resourceData = data || resource?.data;
  
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null);

  // Handler for severity changes that can also handle path
  const handleSeverityChange = (severity: string, path?: string) => {
    setSelectedSeverity(severity);
    setSelectedPath(path);
  };

  // Handler for clearing all filters
  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedPath(undefined);
  };

  // Use existing validation results from resource
  const existingValidationResults = resource?.validationResults || [];
  const hasExistingValidation = existingValidationResults.length > 0;
  
  // Convert database validation results to the format expected by the UI
  const displayValidationResult = hasExistingValidation ? (() => {
    const allIssues = existingValidationResults.flatMap(vr => (vr.issues || []).map(issue => ({
      ...issue,
      location: Array.isArray(issue.location) ? issue.location : [issue.location || 'resource'],
      expression: Array.isArray(issue.expression) ? issue.expression : issue.expression ? [issue.expression] : []
    })));
    
    // Get the latest validation result (already filtered by settings in the API)
    const latestValidation = existingValidationResults.length > 0 ? 
      existingValidationResults.reduce((latest, current) => 
        new Date(current.validatedAt) > new Date(latest.validatedAt) ? current : latest
      ) : null;
    
    // Use the score from the latest validation result which was already calculated with filtered issues
    const validationScore = latestValidation?.validationScore ?? resource?._validationSummary?.validationScore ?? 0;
    
    return {
      isValid: latestValidation?.isValid ?? resource?._validationSummary?.isValid ?? false,
      issues: allIssues,
      summary: {
        totalIssues: allIssues.length,
        errorCount: latestValidation?.errorCount ?? resource?._validationSummary?.errorCount ?? 0,
        warningCount: latestValidation?.warningCount ?? resource?._validationSummary?.warningCount ?? 0,
        informationCount: allIssues.filter(i => i.severity === 'information').length,
        fatalCount: 0,
        score: validationScore
      },
      resourceType: resource?.resourceType || 'Unknown',
      resourceId: resource?.resourceId,
      validatedAt: new Date(latestValidation?.validatedAt || new Date())
    };
  })() : validationResult;

  const validateResource = async () => {
    if (!resourceData) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      const response = await fetch('/api/validation/validate-resource-detailed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resource: resourceData,
          config: {
            strictMode: false,
            requiredFields: ['resourceType'],
            customRules: [],
            autoValidate: true,
            profiles: [],
            fetchFromSimplifier: false, // Disable to prevent timeouts
            fetchFromFhirServer: true,  // Keep enabled for basic validation
            autoDetectProfiles: false,  // Disable to prevent profile guessing
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const result = await response.json();
      setValidationResult(result);
    } catch (error: any) {
      console.error('Validation error:', error);
      setValidationError(error.message || 'Failed to validate resource');
    } finally {
      setIsValidating(false);
    }
  };

  const getValidationBadge = () => {
    if (isValidating) {
      return <Badge variant="secondary">Validating...</Badge>;
    }
    if (validationError) {
      return <Badge variant="destructive">Validation Error</Badge>;
    }
    if (displayValidationResult) {
      // Use the error and warning counts from the summary (already filtered by settings)
      const errorCount = displayValidationResult.summary?.errorCount || 0;
      const warningCount = displayValidationResult.summary?.warningCount || 0;
      const score = displayValidationResult.summary?.score || 0;
      
      if (displayValidationResult.isValid && errorCount === 0) {
        return (
          <Badge className="bg-green-50 text-green-600 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Valid ({score}%)
          </Badge>
        );
      } else if (errorCount > 0) {
        return (
          <Badge className="bg-red-50 text-red-600 border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            {errorCount} Error{errorCount !== 1 ? 's' : ''} ({score}%)
          </Badge>
        );
      } else if (warningCount > 0) {
        return (
          <Badge className="bg-orange-50 text-orange-600 border-orange-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {warningCount} Warning{warningCount !== 1 ? 's' : ''} ({score}%)
          </Badge>
        );
      }
    }
    return null;
  };




  // Calculate filter counts from displayValidationResult
  const categoryCounts = displayValidationResult?.issues?.reduce((acc: any, issue: any) => {
    const category = issue.category || 'general';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {}) || {};
  
  const severityCounts = displayValidationResult?.issues?.reduce((acc: any, issue: any) => {
    const severity = issue.severity || 'information';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {}) || {};

  const categories = [
    { value: 'all', label: 'All', count: displayValidationResult?.issues?.length || 0 },
    { value: 'structural', label: 'Structural', count: categoryCounts.structural || 0 },
    { value: 'profile', label: 'Profile', count: categoryCounts.profile || 0 },
    { value: 'terminology', label: 'Terminology', count: categoryCounts.terminology || 0 },
    { value: 'reference', label: 'Reference', count: categoryCounts.reference || 0 },
    { value: 'business-rule', label: 'Business Rule', count: categoryCounts['business-rule'] || 0 },
    { value: 'metadata', label: 'Metadata', count: categoryCounts.metadata || 0 }
  ].filter(cat => cat.value === 'all' || cat.count > 0);

  const severities = [
    { value: 'all', label: 'All', count: displayValidationResult?.issues?.length || 0 },
    { value: 'error', label: 'Errors', count: severityCounts.error || 0 },
    { value: 'warning', label: 'Warnings', count: severityCounts.warning || 0 },
    { value: 'information', label: 'Information', count: severityCounts.information || 0 }
  ].filter(sev => sev.value === 'all' || sev.count > 0);

  return (
    <div className="space-y-4">
      {/* Header with circular score and filters */}
      <div className="bg-white rounded-lg border">
        <div className="flex items-center justify-between p-4">
          {/* Title and badges on the left */}
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <div className="flex items-center gap-2 mt-2">
              {getValidationBadge()}
              {/* Show warning badge separately if there are errors AND warnings */}
              {displayValidationResult?.summary?.errorCount > 0 && displayValidationResult?.summary?.warningCount > 0 && (
                <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-xs">
                  {displayValidationResult.summary.warningCount} Warning{displayValidationResult.summary.warningCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
          
          
        </div>
        
        {/* Horizontal filters in 2 columns */}
        {displayValidationResult?.issues?.length > 0 && (
          <div className="border-t pt-4 px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Filter Column */}
              <div>
                <div className="text-xs font-medium text-gray-700 mb-2">Categories:</div>
                <div className="flex flex-wrap gap-1">
                  {categories.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
                        selectedCategory === cat.value
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {cat.value !== 'all' && getCategoryIcon(cat.value, "h-3 w-3")}
                      {cat.label} ({cat.count})
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Severity Filter Column */}
              <div>
                <div className="text-xs font-medium text-gray-700 mb-2">Severity:</div>
                <div className="flex flex-wrap gap-1">
                  {severities.map(sev => (
                    <button
                      key={sev.value}
                      onClick={() => setSelectedSeverity(sev.value)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
                        selectedSeverity === sev.value
                          ? sev.value === 'error' ? 'bg-red-500 text-white border-red-500' :
                            sev.value === 'warning' ? 'bg-yellow-500 text-white border-yellow-500' :
                            sev.value === 'information' ? 'bg-blue-500 text-white border-blue-500' :
                            'bg-gray-600 text-white border-gray-600'
                          : sev.value === 'error' ? 'bg-white text-red-600 border-red-300 hover:border-red-400' :
                            sev.value === 'warning' ? 'bg-white text-yellow-600 border-yellow-300 hover:border-yellow-400' :
                            sev.value === 'information' ? 'bg-white text-blue-600 border-blue-300 hover:border-blue-400' :
                            'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {sev.value !== 'all' && getSeverityIcon(sev.value, "h-3 w-3")}
                      {sev.label} ({sev.count})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main content: Resource structure on left, validation messages on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resource Structure - Left side */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceTreeViewer 
              resourceData={resourceData} 
              validationResults={existingValidationResults || []}
              selectedCategory={selectedCategory}
              selectedSeverity={selectedSeverity}
              selectedPath={selectedPath}
              onCategoryChange={setSelectedCategory}
              onSeverityChange={handleSeverityChange}
              onIssueClick={setHighlightedIssueId}
            />
          </CardContent>
        </Card>

        {/* Validation Messages - Right side */}
        {displayValidationResult && displayValidationResult.issues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Validation Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <OptimizedValidationResults 
                result={displayValidationResult}
                onRevalidate={validateResource}
                isValidating={isValidating}
                selectedCategory={selectedCategory}
                selectedSeverity={selectedSeverity}
                selectedPath={selectedPath}
                highlightedIssueId={highlightedIssueId}
                onClearFilters={handleClearFilters}
              />
            </CardContent>
          </Card>
        )}
        
        {/* Show validation loading or error in right column if no validation results */}
        {!displayValidationResult && (isValidating || validationError) && (
          <Card>
            <CardHeader>
              <CardTitle>Validation Messages</CardTitle>
            </CardHeader>
            <CardContent>
              {isValidating && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Validating resource...</p>
                </div>
              )}
              
              {validationError && (
                <div className="bg-red-50 p-4 rounded">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-4 h-4" />
                    <p className="font-medium">Validation Error</p>
                  </div>
                  <p className="text-sm text-red-700 mt-1">{validationError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={validateResource}
                    className="mt-3"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}