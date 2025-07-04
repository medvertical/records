import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ValidationResults } from '@/components/validation/validation-results';

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
  
  // Find validation issues for this specific path
  const nodeIssues = validationIssues.filter(issue => 
    issue.location?.some((loc: string) => loc === currentPath || loc.startsWith(currentPath + '.') || loc.startsWith(currentPath + '['))
  );
  
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return (
      <div style={{ paddingLeft: level * 20 }} className="py-1 flex items-center">
        <span className="font-medium text-gray-700 min-w-0 flex-shrink-0 mr-2">
          {keyName}:
        </span>
        <span className="text-sm text-gray-400">
          {value === null ? 'null' : 'undefined'}
        </span>
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
              <div key={index} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                <div className="font-medium">{issue.severity}: {issue.code}</div>
                <div>{issue.humanReadable || issue.details}</div>
              </div>
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
            <div key={index} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              <div className="font-medium">{issue.severity}: {issue.code}</div>
              <div>{issue.humanReadable || issue.details}</div>
            </div>
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

  // Auto-validate when resourceData changes
  useEffect(() => {
    if (resourceData) {
      validateResource();
    }
  }, [resourceData]);

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
            fetchFromSimplifier: true,
            fetchFromFhirServer: true,
            autoDetectProfiles: true,
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
    if (validationResult) {
      if (validationResult.isValid) {
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Valid
          </Badge>
        );
      } else {
        const errorCount = (validationResult.summary?.errorCount || 0) + (validationResult.summary?.fatalCount || 0);
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
                validationIssues={validationResult?.issues || []}
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

      {validationResult && !isValidating && !validationError && (
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
              result={validationResult} 
              onRetry={validateResource}
            />
          </CardContent>
        </Card>
      )}

      {!validationResult && !isValidating && !validationError && (
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