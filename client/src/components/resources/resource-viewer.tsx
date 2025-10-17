import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism.css';
import { OptimizedValidationResults } from './optimized-validation-results';
import UnifiedTreeViewer from './UnifiedTreeViewer';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

import type { ValidationIssue, ValidationResult } from '@shared/types/validation';

// Extended types for this component
export interface ExtendedValidationIssue extends ValidationIssue {
  category?: string;
  location?: string[];
  humanReadable?: string;
}

export interface ExtendedValidationResult extends ValidationResult {
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    score: number;
  };
  performance?: {
    totalTimeMs: number;
    aspectTimes: Record<string, number>;
  };
}

interface ResourceViewerProps {
  resource: any;
  resourceId: string;
  resourceType: string;
  data?: any;
  title?: string;
  isEditMode?: boolean;
  editedResource?: any | null;
  onResourceChange?: (resource: any) => void;
  autoRevalidate?: boolean;
  onAutoRevalidateChange?: (value: boolean) => void;
  expandedPaths: Set<string>;
  onExpandedPathsChange: (expandedPaths: Set<string>) => void;
  highlightPath?: string;
  onSeverityClick?: (severity: string, path: string) => void;
  validationIssues?: ValidationIssue[];
}

// ============================================================================
// Helper Functions
// ============================================================================

interface ValidationError {
  path: string;
  message: string;
  line?: number;
}

function validateJSON(json: string): { valid: boolean; errors: ValidationError[]; parsed?: any } {
  const errors: ValidationError[] = [];
  
  // Try to parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch (error: any) {
    const match = error.message.match(/position (\d+)/);
    const position = match ? parseInt(match[1]) : 0;
    const lines = json.substring(0, position).split('\n');
    const line = lines.length;
    
    errors.push({
      path: 'root',
      message: error.message,
      line,
    });
    return { valid: false, errors };
  }

  // Validate FHIR resource structure
  if (!parsed || typeof parsed !== 'object') {
    errors.push({
      path: 'root',
      message: 'Resource must be a JSON object',
    });
  }

  if (!parsed.resourceType) {
    errors.push({
      path: 'resourceType',
      message: 'Missing required field: resourceType',
    });
  }

  if (!parsed.id) {
    errors.push({
      path: 'id',
      message: 'Missing required field: id',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed,
  };
}

function formatJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

// ============================================================================
// Component
// ============================================================================

export default function ResourceViewer({ 
  resource, 
  resourceId, 
  resourceType, 
  data, 
  title = "Resource Structure",
  isEditMode = false,
  editedResource = null,
  onResourceChange,
  autoRevalidate = false,
  onAutoRevalidateChange,
  expandedPaths,
  onExpandedPathsChange,
  highlightPath,
  onSeverityClick,
  validationIssues: externalValidationIssues,
}: ResourceViewerProps) {
  // Use data if provided, otherwise use resource.data or resource
  // Handle different resource structures: {data: {...}} or direct resource object
  const resourceData = data || resource?.data || resource;
  
  
  // State management
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  
  // Track which resources have been initialized to prevent re-initialization
  const initializedResourcesRef = useRef<Set<string>>(new Set());
  
  // Track expand all clicks to only apply when button is explicitly clicked
  const expandAllTriggeredRef = useRef<number>(0);
  
  // Initialize expandedPaths with first two levels expanded by default for new resources
  useEffect(() => {
    if (!resourceData || typeof resourceData !== 'object') return;
    if (!resourceId) return;
    
    // Only initialize once per resource
    if (initializedResourcesRef.current.has(resourceId)) return;
    
    // Only initialize if expandedPaths is empty (new resource)
    if (expandedPaths.size === 0) {
      const newExpandedPaths = new Set<string>();
      
      Object.keys(resourceData).forEach(key => {
        if (!key.startsWith('_') && key !== 'resourceId') {
          const value = resourceData[key];
          const valueType = typeof value;
          
          // Expand first level if it's complex
          if ((valueType === 'object' && value !== null && !Array.isArray(value)) || Array.isArray(value)) {
            newExpandedPaths.add(key);
            
            // Auto-expand second level for objects
            if (valueType === 'object' && value !== null) {
              Object.keys(value).forEach(subKey => {
                if (!subKey.startsWith('_') && subKey !== 'resourceId') {
                  const subValue = value[subKey];
                  const subValueType = typeof subValue;
                  
                  if ((subValueType === 'object' && subValue !== null && !Array.isArray(subValue)) || Array.isArray(subValue)) {
                    newExpandedPaths.add(`${key}.${subKey}`);
                  }
                }
              });
            }
          }
        }
      });
      
      // Only update if we actually have new paths to set
      if (newExpandedPaths.size > 0) {
        onExpandedPathsChange(newExpandedPaths);
        initializedResourcesRef.current.add(resourceId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);
  
  // Edit mode state
  const [activeTab, setActiveTab] = useState<'tree' | 'json' | 'form'>('tree');
  const [jsonContent, setJsonContent] = useState('');
  const [jsonValidation, setJsonValidation] = useState<{ valid: boolean; errors: ValidationError[] }>({
    valid: true,
    errors: [],
  });
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  
  // Initialize JSON content when entering edit mode
  useEffect(() => {
    if (isEditMode && editedResource) {
      setJsonContent(formatJSON(editedResource));
      setActiveTab('form');
    } else if (!isEditMode) {
      setActiveTab('tree');
    }
  }, [isEditMode, editedResource]);

  // Handler for severity changes that can also handle path
  const handleSeverityChange = (severity: string, path?: string) => {
    setSelectedSeverity(severity);
    setSelectedPath(path);
    // If both severity and path are provided, call the callback for tree → messages navigation
    if (severity && path && onSeverityClick) {
      console.log('[ResourceViewer] Severity clicked with path:', { severity, path });
      onSeverityClick(severity, path);
    }
  };

  // Handler for clearing all filters
  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedPath(undefined);
  };

  // Handler for expand all button
  const handleExpandAll = () => {
    setExpandAll(!expandAll);
    expandAllTriggeredRef.current += 1; // Increment on each click
  };

  // Handler for JSON content changes
  const handleJsonChange = useCallback((value: string) => {
    setJsonContent(value);
    const result = validateJSON(value);
    setJsonValidation(result);
    
    if (result.valid && result.parsed && onResourceChange) {
      onResourceChange(result.parsed);
    }
  }, [onResourceChange]);

  // Handler for copy to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [jsonContent]);

  // Handler for format JSON
  const handleFormat = useCallback(() => {
    const result = validateJSON(jsonContent);
    if (result.valid && result.parsed) {
      setJsonContent(formatJSON(result.parsed));
    }
  }, [jsonContent]);

  // Handler for navigating to a specific path from validation issues
  const handleNavigateToPath = (path: string) => {
    console.log(`[ResourceViewer] Navigating to path: ${path}`);
    
    // Normalize path by removing resource type prefix if present
    // e.g., "AuditEvent.agent.type" becomes "agent.type"
    let normalizedPath = path;
    const resourceTypePrefixPattern = /^[A-Z][a-zA-Z]+\./;
    if (resourceTypePrefixPattern.test(path)) {
      normalizedPath = path.replace(resourceTypePrefixPattern, '');
    }
    
    setSelectedPath(normalizedPath);
    
    // Auto-expand the tree to show the path
    setExpandAll(true);
  };

  // Handle external path highlighting
  useEffect(() => {
    if (highlightPath) {
      handleNavigateToPath(highlightPath);
    }
  }, [highlightPath]);

  // Validation function
  const validateResource = async () => {
    if (!resourceData) return;
    
    console.log('[ResourceViewer] Starting validation with resource data:', resourceData);
    console.log('[ResourceViewer] Resource ID:', resourceData.id);
    console.log('[ResourceViewer] Resource Type:', resourceData.resourceType);
    
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
      console.log('[ResourceViewer] Validation response:', result);
      
      const issues = Array.isArray(result.issues) ? result.issues : [];
      const sanitizedResult: ValidationResult = {
        ...result,
        issues,
        summary: {
          ...(result.summary || {}),
          totalIssues: result.summary?.totalIssues ?? issues.length,
          errorCount: result.summary?.errorCount ?? 0,
          warningCount: result.summary?.warningCount ?? 0,
          informationCount: result.summary?.informationCount ?? 0,
          score: result.summary?.score ?? 0,
        },
      };
      console.log('[ResourceViewer] Sanitized validation result:', sanitizedResult);
      setValidationResult(sanitizedResult);
    } catch (error: any) {
      console.error('[ResourceViewer] Validation error:', error);
      console.error('[ResourceViewer] Error response:', await error.response?.text?.() || 'No response text');
      setValidationError(error.message || 'Failed to validate resource');
    } finally {
      setIsValidating(false);
    }
  };

  // Note: Automatic validation on mount is disabled to allow immediate resource display.
  // Validation is only performed when explicitly requested via the Revalidate button.
  // The resource already has validation data from the database (_validationSummary).

  // Get validation badge
  const getValidationBadge = () => {
    if (isValidating) {
      return <Badge variant="secondary">Validating...</Badge>;
    }
    if (validationError) {
      return <Badge variant="destructive">Validation Error</Badge>;
    }
    if (validationResult) {
      const errorCount = validationResult.summary?.errorCount || 0;
      const warningCount = validationResult.summary?.warningCount || 0;
      const score = validationResult.summary?.score || 0;
      
      if (validationResult.isValid && errorCount === 0) {
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

  // Use external validation issues if provided, otherwise use validation result
  const validationIssues = externalValidationIssues && externalValidationIssues.length > 0
    ? externalValidationIssues
    : (Array.isArray(validationResult?.issues)
      ? (validationResult?.issues as ValidationIssue[])
      : []);
  
  console.log('[ResourceViewer] Using', validationIssues.length, 'validation issues for tree');
  if (validationIssues.length > 0) {
    console.log('[ResourceViewer] First 3 issue paths:', validationIssues.slice(0, 3).map(i => i.path));
  }

  return (
    <Card>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tree' | 'json' | 'form')}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>{title}</CardTitle>
              {getValidationBadge()}
            </div>
            <TabsList className="grid grid-cols-2">
              {!isEditMode ? (
                <>
                  <TabsTrigger value="tree">Tree</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="form">Form</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </>
              )}
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="pt-0">

          {/* Tree View (View Mode Only) */}
          {!isEditMode && (
            <TabsContent value="tree" className="mt-0">
              <div className="flex items-center justify-end mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExpandAll}
                  className="text-xs"
                >
                  {expandAll ? 'Collapse All' : 'Expand All'}
                </Button>
              </div>
              <UnifiedTreeViewer 
                resourceData={resourceData}
                resourceType={resourceType}
                isEditMode={false}
                validationResults={validationIssues}
                onCategoryChange={setSelectedCategory}
                onSeverityChange={handleSeverityChange}
                onIssueClick={setHighlightedIssueId}
                expandAll={expandAll}
                expandAllTrigger={expandAllTriggeredRef.current}
                expandedPaths={expandedPaths}
                onExpandedPathsChange={onExpandedPathsChange}
                highlightedPath={highlightPath}
              />
            </TabsContent>
          )}

          {/* JSON View/Edit */}
          <TabsContent value="json" className="mt-0">
            {!isEditMode ? (
              // Read-only JSON view
              <div className="space-y-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(formatJSON(resourceData));
                        setCopiedToClipboard(true);
                        setTimeout(() => setCopiedToClipboard(false), 2000);
                      } catch (error) {
                        console.error('Failed to copy to clipboard:', error);
                      }
                    }}
                  >
                    {copiedToClipboard ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="border rounded-md overflow-hidden bg-gray-50">
                  <SyntaxHighlighter
                    language="json"
                    style={prism}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      fontSize: '0.875rem',
                      maxHeight: '600px',
                      overflow: 'auto',
                      backgroundColor: '#f9fafb',
                    }}
                    wrapLongLines={false}
                  >
                    {formatJSON(resourceData)}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              // Editable JSON
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {jsonValidation.valid ? (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Valid JSON</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{jsonValidation.errors.length} error(s)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFormat}
                      disabled={!jsonValidation.valid}
                    >
                      Format
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyToClipboard}
                    >
                      {copiedToClipboard ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Validation Errors */}
                {!jsonValidation.valid && jsonValidation.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {jsonValidation.errors.map((error, index) => (
                          <li key={index} className="text-sm">
                            {error.line && <span className="font-mono">Line {error.line}: </span>}
                            <span className="font-semibold">{error.path}</span> - {error.message}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* JSON Editor */}
                <div className="border rounded-md overflow-hidden bg-white">
                  <Editor
                    value={jsonContent}
                    onValueChange={handleJsonChange}
                    highlight={(code) => highlight(code, languages.json, 'json')}
                    padding={16}
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                      minHeight: '500px',
                      maxHeight: '500px',
                      overflow: 'auto',
                    }}
                    textareaClassName="focus:outline-none"
                    placeholder="Enter FHIR resource JSON..."
                  />
                </div>

                {/* Auto-Revalidate Checkbox */}
                {onAutoRevalidateChange && (
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="auto-revalidate-json"
                      checked={autoRevalidate}
                      onCheckedChange={(checked) => onAutoRevalidateChange(checked as boolean)}
                    />
                    <Label 
                      htmlFor="auto-revalidate-json" 
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Automatically revalidate after save
                    </Label>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Form View (Edit Mode Only) */}
          {isEditMode && (
            <TabsContent value="form" className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-end mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExpandAll}
                    className="text-xs"
                  >
                    {expandAll ? 'Collapse All' : 'Expand All'}
                  </Button>
                </div>
                <UnifiedTreeViewer
                  resourceData={editedResource || resourceData}
                  resourceType={resourceType}
                  isEditMode={true}
                  onResourceChange={onResourceChange}
                  expandAll={expandAll}
                  expandAllTrigger={expandAllTriggeredRef.current}
                  expandedPaths={expandedPaths}
                  onExpandedPathsChange={onExpandedPathsChange}
                />
                
                {/* Auto-Revalidate Checkbox */}
                {onAutoRevalidateChange && (
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <Checkbox
                      id="auto-revalidate-form"
                      checked={autoRevalidate}
                      onCheckedChange={(checked) => onAutoRevalidateChange(checked as boolean)}
                    />
                    <Label 
                      htmlFor="auto-revalidate-form" 
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Automatically revalidate after save
                    </Label>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </CardContent>
      </Tabs>
    </Card>
  );
}
