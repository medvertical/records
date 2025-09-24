import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { OptimizedValidationResults } from './optimized-validation-results';
import ResourceTreeViewer from './resource-tree-viewer';

// ============================================================================
// Types
// ============================================================================

export interface ValidationIssue {
  id?: string;
  code?: string;
  message?: string;
  category?: string;
  severity?: string;
  path?: string;
  location?: string[];
  humanReadable?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
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
}

// ============================================================================
// Component
// ============================================================================

export default function ResourceViewer({ 
  resource, 
  resourceId, 
  resourceType, 
  data, 
  title = "Resource Structure" 
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

  // Handler for expand all button
  const handleExpandAll = () => {
    setExpandAll(!expandAll);
  };

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

  // Auto-validate on mount if resource data is available
  useEffect(() => {
    if (resourceData && !validationResult && !isValidating) {
      validateResource();
    }
  }, [resourceData]);

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

  const validationIssues = Array.isArray(validationResult?.issues)
    ? (validationResult?.issues as ValidationIssue[])
    : [];

  return (
    <div className="space-y-4">
      {/* Main content: Resource structure full width when no validation messages, otherwise two columns */}
      <div className={`grid gap-4 ${
        validationResult && validationIssues.length > 0 
          ? 'grid-cols-1 lg:grid-cols-2' 
          : 'grid-cols-1'
      }`}>
        {/* Resource Structure - Left side */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>{title}</CardTitle>
                {getValidationBadge()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExpandAll}
                className="text-xs"
              >
                {expandAll ? 'Collapse All' : 'Expand All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResourceTreeViewer 
              resourceData={resourceData} 
              validationResults={validationIssues}
              selectedCategory={selectedCategory}
              selectedSeverity={selectedSeverity}
              selectedPath={selectedPath}
              onCategoryChange={setSelectedCategory}
              onSeverityChange={handleSeverityChange}
              onIssueClick={setHighlightedIssueId}
              expandAll={expandAll}
              onExpandAll={handleExpandAll}
            />
          </CardContent>
        </Card>

        {/* Validation Messages - Right side */}
        {validationResult && validationIssues.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Validation Messages</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={validateResource}
                  disabled={isValidating}
                  className="text-xs"
                >
                  {isValidating ? 'Revalidating...' : 'Revalidate'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <OptimizedValidationResults 
                result={validationResult}
                onRevalidate={validateResource}
                isValidating={isValidating}
                selectedCategory={selectedCategory}
                selectedSeverity={selectedSeverity}
                selectedPath={selectedPath}
                highlightedIssueId={highlightedIssueId}
                onClearFilters={handleClearFilters}
                onNavigateToPath={handleNavigateToPath}
              />
            </CardContent>
          </Card>
        )}
        
        {/* Show validation loading or error in right column if no validation results */}
        {!validationResult && (isValidating || validationError) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Validation Messages</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={validateResource}
                  disabled={isValidating}
                  className="text-xs"
                >
                  {isValidating ? 'Revalidating...' : 'Revalidate'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isValidating && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Validating resource...</p>
                </div>
              )}
              
              {validationError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">Validation Error</p>
                      <p className="text-sm">{validationError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={validateResource}
                        className="mt-2"
                      >
                        Try Again
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
