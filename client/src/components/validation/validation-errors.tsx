import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  CheckCircle, 
  Info,
  RotateCcw
} from 'lucide-react';
import { ValidationResult, ValidationError } from '@shared/schema';
import { ValidationFilterControls } from './validation-filter-controls';
import { ValidationGroupedView } from './validation-grouped-view';
import { ValidationFlatView } from './validation-flat-view';
import { ValidationAggregatedView } from './validation-aggregated-view';
import { 
  filterIssuesBySearch, 
  filterIssuesByCategoryAndSeverity 
} from './validation-grouping-logic';

// ============================================================================
// Types
// ============================================================================

type ValidationCategory = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
type ValidationSeverity = 'error' | 'warning' | 'information';
type ViewMode = 'grouped' | 'flat' | 'aggregated';
type GroupBy = 'category' | 'severity' | 'message' | 'path';

interface ValidationErrorsProps {
  validationResults: ValidationResult[];
  resourceData?: any;
}

// ============================================================================
// Component
// ============================================================================

export default function ValidationErrors({ validationResults, resourceData }: ValidationErrorsProps) {
  // State management
  const [selectedCategory, setSelectedCategory] = useState<ValidationCategory | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<ValidationSeverity | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [selectedIssueForResolution, setSelectedIssueForResolution] = useState<ValidationError | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);

  // Extract all issues from validation results
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  validationResults.forEach(result => {
    if (Array.isArray(result.errors)) {
      allErrors.push(...result.errors);
    }
    if (Array.isArray(result.warnings)) {
      allWarnings.push(...result.warnings);
    }
  });

  const allIssues = [...allErrors, ...allWarnings];

  const hasErrors = allErrors.length > 0;
  const hasWarnings = allWarnings.length > 0;
  const isValid = !hasErrors;

  // Filter issues based on selected filters and search query
  const filteredIssues = React.useMemo(() => {
    let filtered = allIssues;
    
    // Apply category and severity filters
    filtered = filterIssuesByCategoryAndSeverity(filtered, selectedCategory, selectedSeverity);
    
    // Apply search filter
    filtered = filterIssuesBySearch(filtered, searchQuery);
    
    return filtered;
  }, [allIssues, selectedCategory, selectedSeverity, searchQuery]);

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSearchQuery('');
    setViewMode('grouped');
    setGroupBy('category');
  };

  // Handle resolution actions
  const handleResolutionAction = (issue: ValidationError, action: 'acknowledge' | 'resolve' | 'ignore') => {
    console.log(`Resolution action: ${action} for issue:`, issue);
    // TODO: Implement resolution logic
    setSelectedIssueForResolution(issue);
    setShowResolutionDialog(true);
  };

  // Handle export
  const handleExport = () => {
    console.log('Exporting validation results...');
    // TODO: Implement export logic
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-fhir-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-fhir-error" />
            )}
            <span>Validation Results</span>
          </CardTitle>
          <Badge variant={isValid ? "default" : "destructive"}>
            {isValid ? "Valid" : `${allErrors.length} Error${allErrors.length !== 1 ? 's' : ''}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {validationResults.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This resource has not been validated yet. Run validation to see detailed results.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Retry Information */}
            {validationResults.some(result => result.isRetry || result.retryAttemptCount > 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCcw className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-700">Validation Retry Summary</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Retries:</span>
                    <span className="ml-1 font-medium">
                      {validationResults.reduce((sum, result) => sum + (result.retryAttemptCount || 0), 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Resources with Retries:</span>
                    <span className="ml-1 font-medium">
                      {validationResults.filter(result => result.isRetry).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Duration:</span>
                    <span className="ml-1 font-medium">
                      {validationResults.reduce((sum, result) => sum + (result.totalRetryDurationMs || 0), 0)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Can Retry:</span>
                    <span className={`ml-1 font-medium ${
                      validationResults.some(result => result.canRetry) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {validationResults.some(result => result.canRetry) ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                
                {/* Individual retry details */}
                <details className="mt-3">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer">Show Individual Retry Details</summary>
                  <div className="mt-2 space-y-2">
                    {validationResults
                      .filter(result => result.isRetry || result.retryAttemptCount > 0)
                      .map((result, index) => (
                        <div key={index} className="p-3 bg-white rounded border text-xs">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Resource #{result.resourceId}</span>
                            <Badge variant="secondary">
                              {result.retryAttemptCount}/{result.maxRetryAttempts} attempts
                            </Badge>
                          </div>
                          <div className="text-gray-600 space-y-1">
                            <div>Duration: {result.totalRetryDurationMs}ms</div>
                            {result.retryReason && (
                              <div>Reason: {result.retryReason}</div>
                            )}
                            <div className="flex items-center gap-1">
                              <span>Status:</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                result.canRetry ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {result.canRetry ? 'Can Retry' : 'Max Retries Reached'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            )}

            {isValid && !hasWarnings ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-fhir-success" />
                <AlertDescription className="text-green-800">
                  This resource passes all validation checks and conforms to the specified profiles.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {/* Filter Controls */}
                {allIssues.length > 0 && (
                  <ValidationFilterControls
                    selectedCategory={selectedCategory}
                    selectedSeverity={selectedSeverity}
                    viewMode={viewMode}
                    groupBy={groupBy}
                    searchQuery={searchQuery}
                    onCategoryChange={setSelectedCategory}
                    onSeverityChange={setSelectedSeverity}
                    onViewModeChange={setViewMode}
                    onGroupByChange={setGroupBy}
                    onSearchChange={setSearchQuery}
                    onClearFilters={handleClearFilters}
                    totalIssues={allIssues.length}
                    filteredIssues={filteredIssues.length}
                  />
                )}

                {/* Issues Display */}
                {filteredIssues.length > 0 ? (
                  viewMode === 'aggregated' ? (
                    <ValidationAggregatedView
                      issues={filteredIssues}
                      onExport={handleExport}
                    />
                  ) : viewMode === 'grouped' ? (
                    <ValidationGroupedView
                      issues={filteredIssues}
                      groupBy={groupBy}
                      onResolutionAction={handleResolutionAction}
                    />
                  ) : (
                    <ValidationFlatView
                      issues={filteredIssues}
                      onResolutionAction={handleResolutionAction}
                    />
                  )
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No validation issues found matching the current filters.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearFilters}
                      className="mt-2"
                    >
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
