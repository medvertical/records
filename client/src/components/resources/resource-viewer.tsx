import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Shield, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ValidationResults } from '@/components/validation/validation-results';

// Validation issue indicator component
function ValidationIssueIndicator({ issue }: { issue: any }) {
  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'information': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="flex items-center">
      <AlertTriangle className={`h-4 w-4 ${getSeverityColor(issue.severity)}`} />
      <span className={`text-xs ml-1 ${getSeverityColor(issue.severity)}`}>
        {issue.severity}
      </span>
    </div>
  );
}

// Validation issue details component
function ValidationIssueDetails({ issue }: { issue: any }) {
  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'error': return 'border-red-200 bg-red-50 text-red-600';
      case 'warning': return 'border-yellow-200 bg-yellow-50 text-yellow-600';
      case 'information': return 'border-blue-200 bg-blue-50 text-blue-600';
      default: return 'border-gray-200 bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className={`text-xs rounded px-2 py-1 border ${getSeverityColor(issue.severity)}`}>
      <div className="font-medium">{issue.severity}: {issue.code}</div>
      <div>{issue.message || issue.humanReadable || issue.details}</div>
      {issue.suggestion && (
        <div className="mt-1 text-xs opacity-80">
          💡 {issue.suggestion}
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
            nodeIssues.length > 0 ? 'text-red-700' : 'text-gray-700'
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
            <div className="ml-2 flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-red-600 ml-1">{nodeIssues.length}</span>
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
          nodeIssues.length > 0 ? 'text-red-700' : 'text-gray-700'
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
          <div className="ml-2 flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-600 ml-1">{nodeIssues.length}</span>
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

  // Use existing validation results from resource instead of internal state
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
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <div className="flex items-center gap-2">
              {getValidationBadge()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="form" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="form">Hierarchy</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            
            <TabsContent value="form" className="mt-4">
              <FormView 
                data={resourceData} 
                validationIssues={displayValidationResult?.issues || []}
              />
            </TabsContent>
            
            <TabsContent value="json" className="mt-4">
              <JsonView data={resourceData} />
            </TabsContent>
          </Tabs>
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

      {displayValidationResult && !isValidating && !validationError && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Validation Results
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={validateResource}
                disabled={isValidating}
              >
                <RefreshCw className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Revalidate</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ValidationResults 
              result={displayValidationResult} 
              onRetry={validateResource}
            />
          </CardContent>
        </Card>
      )}

      {!displayValidationResult && !isValidating && !validationError && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                This resource will be automatically validated against FHIR standards and installed profiles.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}