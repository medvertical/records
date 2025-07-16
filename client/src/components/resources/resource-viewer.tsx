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
function OptimizedValidationResults({ result, onRevalidate, isValidating }: { result: any; onRevalidate: () => void; isValidating: boolean }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  // Group issues by category and severity
  const groupedIssues = result.issues.reduce((acc: any, issue: any) => {
    const category = issue.category || 'general';
    const severity = issue.severity || 'information';
    
    if (!acc[category]) acc[category] = {};
    if (!acc[category][severity]) acc[category][severity] = [];
    acc[category][severity].push(issue);
    
    return acc;
  }, {});

  // Filter issues based on selected filters
  const filteredIssues = result.issues.filter((issue: any) => {
    const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
    const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
    return categoryMatch && severityMatch;
  });

  // Get unique categories and severities
  const categories = ['all', ...new Set(result.issues.map((issue: any) => issue.category || 'general'))];
  const severities = ['all', 'error', 'warning', 'information'];

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'structural': return <Shield className="w-4 h-4" />;
      case 'profile': return <CheckCircle className="w-4 h-4" />;
      case 'terminology': return <AlertTriangle className="w-4 h-4" />;
      case 'reference': return <Info className="w-4 h-4" />;
      case 'business-rule': return <AlertCircle className="w-4 h-4" />;
      case 'metadata': return <Shield className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getCategoryDescription = (category: string) => {
    switch(category) {
      case 'structural': return 'FHIR structure, data types, and cardinality rules';
      case 'profile': return 'Profile conformance (US Core, HL7 profiles)';
      case 'terminology': return 'Code systems, terminology bindings, and vocabulary';
      case 'reference': return 'Resource references and relationship integrity';
      case 'business-rule': return 'Clinical logic and healthcare business rules';
      case 'metadata': return 'Resource metadata, security labels, and extensions';
      case 'general': return 'General validation findings';
      default: return 'Validation checks';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              FHIR Validation Results
            </CardTitle>
            <CardDescription className="mt-1">
              Validation Score: {result.summary?.score || 0}% • {result.issues.length} total issues found
            </CardDescription>
          </div>
          <Button 
            onClick={onRevalidate} 
            disabled={isValidating}
            variant="outline"
            size="sm"
          >
            {isValidating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1" />
                Revalidate
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Validation Score Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Validation Score</span>
              <span className="font-medium">{result.summary?.score || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  (result.summary?.score || 0) >= 80 ? 'bg-green-500' :
                  (result.summary?.score || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${result.summary?.score || 0}%` }}
              />
            </div>
          </div>

          {/* Issue Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-700">{result.summary?.errorCount || 0}</div>
              <div className="text-xs text-red-600">Errors</div>
              <div className="text-xs text-red-500 mt-1">Must be fixed</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-yellow-700">{result.summary?.warningCount || 0}</div>
              <div className="text-xs text-yellow-600">Warnings</div>
              <div className="text-xs text-yellow-500 mt-1">Should address</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-700">{result.summary?.informationCount || 0}</div>
              <div className="text-xs text-blue-600">Information</div>
              <div className="text-xs text-blue-500 mt-1">Recommendations</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Category:</span>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border rounded px-2 py-1 text-xs"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Severity:</span>
              <select 
                value={selectedSeverity} 
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="border rounded px-2 py-1 text-xs"
              >
                {severities.map(sev => (
                  <option key={sev} value={sev}>
                    {sev === 'all' ? 'All Severities' : sev}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-gray-500">
              Showing {filteredIssues.length} of {result.issues.length} issues
            </span>
          </div>

          {/* Issues by Category */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(groupedIssues).map(([category, severityGroups]: [string, any]) => {
              const categoryIssues = Object.values(severityGroups).flat();
              const visibleCategoryIssues = categoryIssues.filter((issue: any) => {
                const categoryMatch = selectedCategory === 'all' || category === selectedCategory;
                const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
                return categoryMatch && severityMatch;
              });

              if (visibleCategoryIssues.length === 0) return null;

              return (
                <div key={category} className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    {getCategoryIcon(category)}
                    <div className="ml-2">
                      <div className="font-medium text-sm capitalize">{category} Validation</div>
                      <div className="text-xs text-gray-600">{getCategoryDescription(category)}</div>
                    </div>
                    <Badge variant="outline" className="ml-auto">
                      {visibleCategoryIssues.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {visibleCategoryIssues.map((issue: any, index: number) => (
                      <ValidationIssueDetails key={index} issue={issue} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredIssues.length === 0 && result.issues.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              No issues match the selected filters
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
      </CardContent>
    </Card>
  );
}

// Validation issue indicator component
function ValidationIssueIndicator({ issue }: { issue: any }) {
  const getSeverityConfig = (severity: string) => {
    switch(severity) {
      case 'error': 
        return { color: 'text-red-500', icon: AlertCircle };
      case 'warning': 
        return { color: 'text-yellow-500', icon: AlertTriangle };
      case 'information': 
        return { color: 'text-blue-500', icon: Info };
      default: 
        return { color: 'text-gray-500', icon: AlertTriangle };
    }
  };

  const config = getSeverityConfig(issue.severity);
  const Icon = config.icon;

  return (
    <div className="flex items-center">
      <Icon className={`h-4 w-4 ${config.color}`} />
      <span className={`text-xs ml-1 ${config.color}`}>
        {issue.severity}
      </span>
    </div>
  );
}

// Validation issue details component
function ValidationIssueDetails({ issue }: { issue: any }) {
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
  
  // Get category explanation
  const getCategoryDescription = (category: string) => {
    switch(category) {
      case 'structural': return 'FHIR structure and data types';
      case 'profile': return 'Profile conformance (US Core, etc.)';
      case 'terminology': return 'Code systems and terminology';
      case 'reference': return 'Resource references and relationships';
      case 'business-rule': return 'Clinical logic and business rules';
      case 'metadata': return 'Resource metadata and extensions';
      default: return 'Validation check';
    }
  };

  return (
    <div className={`text-xs rounded-lg px-3 py-2 border-l-4 ${config.color}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold flex items-center">
          <span className="uppercase tracking-wide">{config.label}</span>
          <span className="mx-1">•</span>
          <span className="font-normal opacity-75">{issue.code}</span>
        </div>
        {issue.category && (
          <span className="text-xs bg-white bg-opacity-50 px-1 py-0.5 rounded">
            {getCategoryDescription(issue.category)}
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

  // Use existing validation results from resource
  const existingValidationResults = resource?.validationResults || [];
  const hasExistingValidation = existingValidationResults.length > 0;
  
  // Convert database validation results to the format expected by the UI
  const displayValidationResult = hasExistingValidation ? {
    isValid: existingValidationResults.every(vr => vr.isValid),
    issues: existingValidationResults.flatMap(vr => (vr.issues || []).map(issue => ({
      ...issue,
      location: Array.isArray(issue.location) ? issue.location : [issue.location || 'resource'],
      expression: Array.isArray(issue.expression) ? issue.expression : issue.expression ? [issue.expression] : []
    }))),
    summary: {
      totalIssues: existingValidationResults.reduce((sum, vr) => sum + (vr.issues?.length || 0), 0),
      errorCount: existingValidationResults.reduce((sum, vr) => sum + (vr.errorCount || 0), 0),
      warningCount: existingValidationResults.reduce((sum, vr) => sum + (vr.warningCount || 0), 0),
      informationCount: existingValidationResults.reduce((sum, vr) => sum + (vr.issues?.filter(i => i.severity === 'information').length || 0), 0),
      fatalCount: 0,
      score: existingValidationResults.length > 0 ? Math.round(existingValidationResults[0].validationScore || 0) : 0
    },
    resourceType: resource?.resourceType || 'Unknown',
    resourceId: resource?.resourceId,
    validatedAt: new Date(existingValidationResults[0]?.validatedAt || new Date())
  } : validationResult;

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
      if (displayValidationResult.isValid) {
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Valid
          </Badge>
        );
      } else {
        const errorCount = (displayValidationResult.summary?.errorCount || 0) + (displayValidationResult.summary?.fatalCount || 0);
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {errorCount} Error{errorCount !== 1 ? 's' : ''}
          </Badge>
        );
      }
    }
    return null;
  };




  return (
    <>
      {/* Resource Structure Card */}
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResourceTreeViewer 
            resourceData={resourceData} 
            validationResults={existingValidationResults || []}
          />
        </CardContent>
      </Card>

      {/* Validation Results */}
      {isValidating && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-muted-foreground">Validating resource...</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {validationError && (
        <Card className="mt-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>
      )}

      {displayValidationResult && displayValidationResult.issues.length > 0 && (
        <div className="mt-6">
          <OptimizedValidationResults 
            result={displayValidationResult}
            onRevalidate={validateResource}
            isValidating={isValidating}
          />
        </div>
      )}
    </>
  );
}