import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  AlertCircle,
  Eye,
  Loader2,
  Filter
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useValidationResults } from "@/hooks/validation";
import type { ValidationProgress, EnhancedValidationSummary } from '@shared/types/validation';
import { getFilteredValidationSummary } from '@/lib/validation-filtering-utils';
import { getShortId, getShortReference } from "@/lib/resource-utils";

// Extended types for this component
interface ExtendedValidationProgress extends ValidationProgress {
  resourceId: number;
  progress: number; // 0-100
  currentAspect?: string; // Current validation aspect being processed
  completedAspects: string[]; // List of completed validation aspects
  totalAspects: number; // Total number of validation aspects
}

interface ExtendedEnhancedValidationSummary extends EnhancedValidationSummary {
  isValid: boolean;
  overallConfidence: number;
  overallCompleteness: number;
  totalDurationMs: number;
  aspectResults: {
    structural: { isValid: boolean; score: number; issues: any[] };
    profile: { isValid: boolean; score: number; issues: any[] };
    terminology: { isValid: boolean; score: number; issues: any[] };
    reference: { isValid: boolean; score: number; issues: any[] };
    businessRule: { isValid: boolean; score: number; issues: any[] };
    metadata: { isValid: boolean; score: number; issues: any[] };
  };
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
    issueCountByAspect: Record<string, number>;
  };
  performance: {
    totalDurationMs: number;
    durationByAspect: Record<string, number>;
  };
}

export interface ResourceListProps {
  resources: any[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void; // Callback for page size changes
  validatingResourceIds?: Set<number>; // Track which resources are currently being validated
  validationProgress?: Map<number, ValidationProgress>; // Track validation progress per resource
  availableResourceTypes?: string[]; // Available resource types when none is selected
  noResourceTypeMessage?: string; // Message to show when no resource type is selected
  isLoading?: boolean; // Whether the resource list is loading
  selectionMode?: boolean; // Enable selection mode with checkboxes
  selectedIds?: Set<string>; // Set of selected resource keys (resourceType/id)
  onSelectionChange?: (resourceKey: string, selected: boolean) => void; // Callback for selection changes
  highlightedResourceId?: string; // Resource ID to highlight (resourceType/resourceId)
}

export default function ResourceList({
  resources,
  total,
  page,
  onPageChange,
  pageSize = 20,
  onPageSizeChange,
  validatingResourceIds = new Set(),
  validationProgress = new Map(),
  availableResourceTypes = [],
  noResourceTypeMessage = "Please select a resource type to view resources.",
  isLoading = false,
  selectionMode = false,
  selectedIds = new Set(),
  onSelectionChange,
  highlightedResourceId,
}: ResourceListProps) {
  // Fetch current validation settings for UI filtering
  const { data: validationSettingsData } = useQuery({
    queryKey: ['/api/validation/settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      if (!response.ok) throw new Error('Failed to fetch validation settings');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: false,
  });

  // Ensure page is a valid number and at least 0
  const currentPage = Math.max(0, isNaN(page) ? 0 : page);
  const validTotal = Math.max(0, isNaN(total) ? 0 : total);
  
  const totalPages = Math.ceil(validTotal / pageSize);
  const startIndex = validTotal > 0 ? currentPage * pageSize + 1 : 0;
  const endIndex = validTotal > 0 ? Math.min((currentPage + 1) * pageSize, validTotal) : 0;

  // Get current validation settings for filtering
  const currentSettings = validationSettingsData;

  const getResourceDisplayName = (resource: any) => {
    switch (resource.resourceType) {
      case 'Patient':
        if (resource.name && resource.name[0]) {
          const name = resource.name[0];
          return `${name.given?.[0] || ''} ${name.family || ''}`.trim() || 'Unnamed Patient';
        }
        return 'Unnamed Patient';
      case 'Observation':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Observation';
      case 'Encounter':
        return resource.type?.[0]?.text || resource.type?.[0]?.coding?.[0]?.display || 'Encounter';
      case 'Condition':
        return resource.code?.text || resource.code?.coding?.[0]?.display || 'Condition';
      default:
        return `${resource.resourceType} Resource`;
    }
  };

  const getResourceSubtext = (resource: any) => {
    switch (resource.resourceType) {
      case 'Patient':
        const birthDate = resource.birthDate ? new Date(resource.birthDate).toLocaleDateString() : null;
        const gender = resource.gender ? resource.gender.charAt(0).toUpperCase() + resource.gender.slice(1) : null;
        return [birthDate && `DOB: ${birthDate}`, gender].filter(Boolean).join(' | ') || 'Patient';
      case 'Observation':
        const subject = resource.subject?.reference || '';
        const shortSubject = subject ? getShortReference(subject) : '';
        const date = resource.effectiveDateTime ? new Date(resource.effectiveDateTime).toLocaleDateString() : '';
        return [shortSubject, date].filter(Boolean).join(' | ') || 'Observation';
      case 'Encounter':
        const encounterDate = resource.period?.start ? new Date(resource.period.start).toLocaleDateString() : '';
        return encounterDate || 'Encounter';
      default:
        return resource.id || 'Resource';
    }
  };

  const renderResourceCardSkeleton = (index: number) => (
    <div key={`skeleton-${index}`} className="mb-4 last:mb-0">
      <Card className="border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <Skeleton className="h-3 w-3 rounded-full" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-48 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            
            <div className="flex items-center space-x-4 ml-6">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const getValidationStatus = (resource: any) => {
    const resourceId = resource._dbId || resource.id;
    const isValidating = validatingResourceIds.has(resourceId);
    
    // If currently validating (either from state or optimistic update flag), show as validating
    if (isValidating || resource._isRevalidating) {
      return 'validating';
    }
    
    // Check for enhanced validation results first
    const enhancedValidation = resource._enhancedValidationSummary;
    if (enhancedValidation) {
      // Use enhanced validation data
      if (!enhancedValidation.isValid) {
        return 'error';
      }
      if (enhancedValidation.summary.warningCount > 0) {
        return 'warning';
      }
      return 'valid';
    }

    // Fallback to legacy validation results
    const validationSummary = resource._validationSummary;
    
    // Only consider a resource validated if it has actual validation data from the database
    if (!validationSummary || !validationSummary.lastValidated) {
      return 'not-validated';
    }
    
    // Apply UI filtering based on enabled aspects
    const filteredSummary = getFilteredValidationSummary(validationSummary, currentSettings);
    
    // If no filtered summary, return not-validated
    if (!filteredSummary) {
      return 'not-validated';
    }
    
    // Check if this is an old validation result where all aspects were skipped due to the validation engine bug
    if (validationSummary.aspectBreakdown && typeof validationSummary.aspectBreakdown === 'object') {
      const allAspectsSkipped = Object.values(validationSummary.aspectBreakdown).every((aspect: any) => 
        aspect.status === 'skipped' && aspect.reason === 'Aspect result unavailable'
      );
      
      if (allAspectsSkipped) {
        // This is an old validation result that should be treated as not validated
        return 'not-validated';
      }
    }
    
    if (filteredSummary.hasErrors) {
      return 'error';
    }
    
    if (filteredSummary.hasWarnings) {
      return 'warning';
    }
    
    if (filteredSummary.isValid) {
      return 'valid';
    }
    
    return 'not-validated';
  };

  const renderValidationBadge = (resource: any) => {
    const enhancedValidation = resource._enhancedValidationSummary;
    const legacyValidationSummary = resource._validationSummary;
    const status = getValidationStatus(resource);
    const resourceId = resource._dbId || resource.id;
    const isValidating = validatingResourceIds.has(resourceId) || resource._isRevalidating;
    const progress = validationProgress.get(resourceId);
    
    // Use enhanced validation data if available, otherwise fallback to legacy
    const validationSummary = enhancedValidation || legacyValidationSummary;
    
    // Apply UI filtering to get the filtered validation summary (only for legacy data)
    const filteredSummary = enhancedValidation ? enhancedValidation : getFilteredValidationSummary(legacyValidationSummary, currentSettings);
    
    // Determine the validation score to display
    const getValidationScore = () => {
      if (status === 'not-validated') {
        return 0; // Always show 0% for unvalidated resources
      }
      
      if (status === 'validating') {
        // Show progress percentage if available, otherwise show 0%
        return progress?.progress || 0;
      }
      
      // Use enhanced validation score if available
      if (enhancedValidation) {
        return enhancedValidation.overallScore || 0;
      }
      
      // If no validation data exists, show 0%
      if (!legacyValidationSummary || !legacyValidationSummary.lastValidated) {
        return 0;
      }
      
      return filteredSummary?.validationScore || 0;
    };
    
    const validationScore = getValidationScore();
    
    // Show detailed loading indicator for resources currently being validated
    if (isValidating) {
      const progressValue = progress?.progress || 0;
      const currentAspect = progress?.currentAspect || 'Starting validation...';
      const completedCount = progress?.completedAspects?.length || 0;
      const totalAspects = progress?.totalAspects || 6;
      
      return (
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger>
              <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {progressValue > 0 ? `${Math.round(progressValue)}%` : 'Validating...'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Validation Progress</p>
                <p className="text-sm">{currentAspect}</p>
                <p className="text-xs text-gray-500">
                  {completedCount}/{totalAspects} aspects completed
                </p>
                {progress?.completedAspects && progress.completedAspects.length > 0 && (
                  <div className="text-xs">
                    <p className="text-gray-500">Completed:</p>
                    <p className="text-green-600">{progress.completedAspects.join(', ')}</p>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          {progressValue > 0 && (
            <CircularProgress 
              value={progressValue} 
              size="sm"
              animate={false}
            />
          )}
        </div>
      );
    }
    
    switch (status) {
      case 'valid':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-50 text-fhir-success border-green-200 hover:bg-green-50">
              <CheckCircle className="h-3 w-3 mr-1" />
              Valid
            </Badge>
            {(filteredSummary?.lastValidated || validationScore > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CircularProgress 
                    value={validationScore} 
                    size="sm"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">Validation Score: {validationScore}%</p>
                      <p className="text-sm text-gray-500">Last validated: {filteredSummary?.lastValidated ? new Date(filteredSummary.lastValidated).toLocaleString() : 'Never'}</p>
                    </div>
                    {filteredSummary?.aspectBreakdown && (
                      <div className="border-t pt-2">
                        <p className="text-sm font-medium mb-1">Aspect Breakdown:</p>
                        <div className="space-y-1 text-xs">
                          {filteredSummary.aspectBreakdown && typeof filteredSummary.aspectBreakdown === 'object' && Object.entries(filteredSummary.aspectBreakdown).map(([aspect, data]: [string, any]) => (
                            <div key={aspect} className="flex justify-between items-center">
                              <span className="capitalize">{aspect.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <div className="flex items-center gap-2">
                                {data.enabled === false && <span className="text-gray-400">(Disabled)</span>}
                                <span className={`font-medium ${data.validationScore === 100 ? 'text-green-600' : data.validationScore >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {data.validationScore}%
                                </span>
                                {data.errorCount > 0 && <span className="text-red-500">({data.errorCount} errors)</span>}
                                {data.warningCount > 0 && <span className="text-yellow-500">({data.warningCount} warnings)</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end space-y-1">
              <div className="flex items-center gap-1">
                <Badge className="bg-red-50 text-fhir-error border-red-200 hover:bg-red-50">
                  <XCircle className="h-3 w-3 mr-1" />
                  {filteredSummary?.errorCount || 0} Error{(filteredSummary?.errorCount || 0) !== 1 ? 's' : ''}
                </Badge>
                {/* Retry indicator */}
                {resource.retryInfo && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                        🔄 {resource.retryInfo.attemptCount}/{resource.retryInfo.maxAttempts}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">Retry Information</p>
                        <p className="text-sm">Attempts: {resource.retryInfo.attemptCount}/{resource.retryInfo.maxAttempts}</p>
                        <p className="text-sm">Duration: {resource.retryInfo.totalRetryDurationMs}ms</p>
                        <p className="text-sm">Status: {resource.retryInfo.canRetry ? 'Can retry' : 'Max retries reached'}</p>
                        {resource.retryInfo.retryReason && (
                          <p className="text-xs text-gray-500">Reason: {resource.retryInfo.retryReason}</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {filteredSummary?.hasWarnings && (
                <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50 text-xs">
                  {filteredSummary.warningCount} Warning{filteredSummary.warningCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {(filteredSummary?.lastValidated || validationScore > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CircularProgress 
                    value={validationScore} 
                    size="sm"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">Validation Score: {validationScore}%</p>
                      <p className="text-sm text-gray-500">Last validated: {filteredSummary?.lastValidated ? new Date(filteredSummary.lastValidated).toLocaleString() : 'Never'}</p>
                    </div>
                    {filteredSummary?.aspectBreakdown && (
                      <div className="border-t pt-2">
                        <p className="text-sm font-medium mb-1">Aspect Breakdown:</p>
                        <div className="space-y-1 text-xs">
                          {filteredSummary.aspectBreakdown && typeof filteredSummary.aspectBreakdown === 'object' && Object.entries(filteredSummary.aspectBreakdown).map(([aspect, data]: [string, any]) => (
                            <div key={aspect} className="flex justify-between items-center">
                              <span className="capitalize">{aspect.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <div className="flex items-center gap-2">
                                {data.enabled === false && <span className="text-gray-400">(Disabled)</span>}
                                <span className={`font-medium ${data.validationScore === 100 ? 'text-green-600' : data.validationScore >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {data.validationScore}%
                                </span>
                                {data.errorCount > 0 && <span className="text-red-500">({data.errorCount} errors)</span>}
                                {data.warningCount > 0 && <span className="text-yellow-500">({data.warningCount} warnings)</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {filteredSummary?.warningCount || 0} Warning{(filteredSummary?.warningCount || 0) !== 1 ? 's' : ''}
            </Badge>
            {(filteredSummary?.lastValidated || validationScore > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CircularProgress 
                    value={validationScore} 
                    size="sm"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">Validation Score: {validationScore}%</p>
                      <p className="text-sm text-gray-500">Last validated: {filteredSummary?.lastValidated ? new Date(filteredSummary.lastValidated).toLocaleString() : 'Never'}</p>
                    </div>
                    {filteredSummary?.aspectBreakdown && (
                      <div className="border-t pt-2">
                        <p className="text-sm font-medium mb-1">Aspect Breakdown:</p>
                        <div className="space-y-1 text-xs">
                          {filteredSummary.aspectBreakdown && typeof filteredSummary.aspectBreakdown === 'object' && Object.entries(filteredSummary.aspectBreakdown).map(([aspect, data]: [string, any]) => (
                            <div key={aspect} className="flex justify-between items-center">
                              <span className="capitalize">{aspect.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <div className="flex items-center gap-2">
                                {data.enabled === false && <span className="text-gray-400">(Disabled)</span>}
                                <span className={`font-medium ${data.validationScore === 100 ? 'text-green-600' : data.validationScore >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {data.validationScore}%
                                </span>
                                {data.errorCount > 0 && <span className="text-red-500">({data.errorCount} errors)</span>}
                                {data.warningCount > 0 && <span className="text-yellow-500">({data.warningCount} warnings)</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Validated
            </Badge>
            {(filteredSummary?.lastValidated || validationScore > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CircularProgress 
                    value={validationScore} 
                    size="sm"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Validation Score: {validationScore}% (Not validated)</p>
                  <p>Last validated: Never</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {startIndex} to {endIndex} of {validTotal} resources
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(0)}
            disabled={currentPage === 0 || isLoading}
            className="hidden sm:inline-flex"
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1 || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={currentPage >= totalPages - 1 || isLoading}
            className="hidden sm:inline-flex"
          >
            Last
          </Button>
        </div>
      </div>

      {/* Resource List */}
      <div className="resource-cards-container">
        {resources.length > 0 ? (
          resources.map((resource, index) => {
            const validationStatus = getValidationStatus(resource);
            const resourceId = resource._dbId || resource.id;
            const isValidating = validatingResourceIds.has(resourceId);
            const resourceKey = `${resource.resourceType}/${resource.id || resource.resourceId}`;
            const isSelected = selectedIds.has(resourceKey);
            const isHighlighted = highlightedResourceId === resourceKey;
            
            const cardContent = (
              <Card className={cn(
                selectionMode ? "" : "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer",
                validationStatus === 'not-validated' && "border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50",
                isSelected && "ring-2 ring-blue-500 bg-blue-50/50",
                isHighlighted && "ring-2 ring-orange-500 bg-orange-50/50 animate-pulse"
              )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {selectionMode && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (onSelectionChange) {
                            onSelectionChange(resourceKey, checked as boolean);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className={cn(
                      "rounded-full flex-shrink-0",
                      validationStatus === 'valid' ? "w-3 h-3 bg-fhir-success" :
                      validationStatus === 'error' ? "w-3 h-3 bg-fhir-error" :
                      validationStatus === 'warning' ? "w-3 h-3 bg-fhir-warning" :
                      "w-4 h-4 bg-gray-400 border-2 border-gray-300"
                    )} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {resource.resourceType}/{getShortId(resource.id)}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {resource.resourceType}
                          </Badge>
                          {validationStatus === 'not-validated' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-3 w-3 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This resource has not been validated</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {getResourceDisplayName(resource)}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {getResourceSubtext(resource)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 ml-6">
                    {renderValidationBadge(resource)}
                    {!selectionMode && <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>
              </CardContent>
              </Card>
            );
            
            return (
              <div key={resource.id || `${resource.resourceType}-${index}`} className="mb-4 last:mb-0">
                {selectionMode ? (
                  cardContent
                ) : (
                  <Link href={`/resources/${resource.resourceId || resource.id}?type=${resource.resourceType}`}>
                    {cardContent}
                  </Link>
                )}
              </div>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <XCircle className="h-12 w-12 mx-auto" />
              </div>
              {noResourceTypeMessage ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Resource Type</h3>
                  <p className="text-gray-600 mb-4">
                    {noResourceTypeMessage}
                  </p>
                  {availableResourceTypes.length > 0 && (
                    <div className="mt-6">
                      <p className="text-sm text-gray-500 mb-3">Available resource types:</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {availableResourceTypes.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Resources Found</h3>
                  <p className="text-gray-600">
                    No resources match your current search criteria. Try adjusting your filters.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          {/* Left side - Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Resources per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange?.(parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Right side - Pagination controls */}
          <div className="flex items-center space-x-2">
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <Skeleton className="h-9 w-16 hidden sm:block" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-8" />
                <Skeleton className="h-9 w-8" />
                <Skeleton className="h-9 w-8" />
                <Skeleton className="h-9 w-8" />
                <Skeleton className="h-9 w-8" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-12 hidden sm:block" />
              </div>
            ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onPageChange(0)}
                disabled={currentPage === 0 || isLoading}
                className="hidden sm:inline-flex"
              >
                First
              </Button>
              <Button
                variant="outline"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "outline"}
                    onClick={() => onPageChange(pageNum)}
                    disabled={isLoading}
                    className={pageNum === page ? "bg-fhir-blue text-white" : ""}
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
              
              <Button
                variant="outline"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1 || isLoading}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>
              <Button
                variant="outline"
                onClick={() => onPageChange(totalPages - 1)}
                disabled={currentPage >= totalPages - 1 || isLoading}
                className="hidden sm:inline-flex"
              >
                Last
              </Button>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
