import { useEffect, useRef } from "react";
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
  Filter,
  Info
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useValidationResults } from "@/hooks/validation";
import type { ValidationProgress, EnhancedValidationSummary } from '@shared/types/validation';
import { getFilteredValidationSummary } from '@/lib/validation-filtering-utils';
import { getShortId, getShortReference } from "@/lib/resource-utils";
import ProfileBadge from "@/components/resources/ProfileBadge";
import { getResourceTypeIcon } from "@/lib/resource-type-icons";
import { ResourceVersionCount } from "@/components/resources/resource-version-count";
import { useResourceVersionsBulk } from "@/hooks/use-resource-versions";

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
  onSeverityBadgeClick?: (severity: 'error' | 'warning' | 'information') => void; // Callback when severity badge is clicked
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
  onSeverityBadgeClick,
}: ResourceListProps) {
  const [, setLocation] = useLocation();
  
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

  // Helper function to handle severity badge clicks
  const handleSeverityBadgeClick = (severity: 'error' | 'warning' | 'information') => {
    if (onSeverityBadgeClick) {
      onSeverityBadgeClick(severity);
    }
  };

  // Fetch version data for all resources on the current page
  const resourceIdentifiers = resources.map(r => ({
    resourceType: r.resourceType,
    id: r.resourceId || r.id,
  }));
  const { data: versionData, isLoading: isLoadingVersions } = useResourceVersionsBulk(
    resourceIdentifiers,
    { enabled: resources.length > 0 }
  );

  // Create a ref map to track resource elements for auto-scroll
  const resourceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Ensure page is a valid number and at least 0
  const currentPage = Math.max(0, isNaN(page) ? 0 : page);
  const validTotal = Math.max(0, isNaN(total) ? 0 : total);
  
  const totalPages = Math.ceil(validTotal / pageSize);
  const startIndex = validTotal > 0 ? currentPage * pageSize + 1 : 0;
  const endIndex = validTotal > 0 ? Math.min((currentPage + 1) * pageSize, validTotal) : 0;

  // Get current validation settings for filtering
  const currentSettings = validationSettingsData;

  // Auto-scroll to highlighted resource
  useEffect(() => {
    if (highlightedResourceId) {
      console.log('[ResourceList] Highlighting resource:', {
        highlightedResourceId,
        availableKeys: Array.from(resourceRefs.current.keys()),
        hasMatch: resourceRefs.current.has(highlightedResourceId)
      });

      if (resourceRefs.current.has(highlightedResourceId)) {
        const element = resourceRefs.current.get(highlightedResourceId);
        if (element) {
          // Small delay to ensure the element is rendered and highlighted
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    }
  }, [highlightedResourceId]);

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
    <div key={`skeleton-${index}`} className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
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
                Validating...
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
          <CircularProgress 
            value={0} 
            size="sm"
            animate={false}
            showValue={false}
          />
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
            <div className="flex items-center gap-2">
              {/* Error badge */}
              {filteredSummary && filteredSummary.errorCount > 0 && (
                <Badge 
                  data-severity-badge="error"
                  className="severity-badge h-6 px-2 text-xs flex items-center gap-1.5 bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer transition-all"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSeverityBadgeClick('error');
                  }}
                  title="Click to view error messages"
                >
                  <XCircle className="h-3 w-3" />
                  {filteredSummary.errorCount}
                </Badge>
              )}
              
              {/* Warning badge */}
              {filteredSummary?.hasWarnings && filteredSummary.warningCount > 0 && (
                <Badge 
                  data-severity-badge="warning"
                  className="severity-badge h-6 px-2 text-xs flex items-center gap-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer transition-all"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSeverityBadgeClick('warning');
                  }}
                  title="Click to view warning messages"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {filteredSummary.warningCount}
                </Badge>
              )}
              
              {/* Information badge */}
              {((filteredSummary?.informationCount || filteredSummary?.infoCount || filteredSummary?.summary?.informationCount || 0) > 0) && (
                <Badge 
                  data-severity-badge="information"
                  className="severity-badge h-6 px-2 text-xs flex items-center gap-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer transition-all"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSeverityBadgeClick('information');
                  }}
                  title="Click to view information messages"
                >
                  <Info className="h-3 w-3" />
                  {filteredSummary.informationCount || filteredSummary.infoCount || filteredSummary.summary?.informationCount || 0}
                </Badge>
              )}
            </div>
            
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
            <div className="flex items-center gap-2">
              {/* Error column - empty placeholder for alignment */}
              <div className="flex flex-col items-center min-w-[3rem]">
              </div>
              
              {/* Warning column */}
              <div className="flex flex-col items-center min-w-[3rem]">
                <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {filteredSummary?.warningCount || 0}
                </Badge>
              </div>
              
              {/* Info column */}
              <div className="flex flex-col items-center min-w-[3rem]">
                {((filteredSummary?.informationCount || filteredSummary?.infoCount || filteredSummary?.summary?.informationCount || 0) > 0) && (
                  <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
                    <Info className="h-3 w-3 mr-1" />
                    {filteredSummary.informationCount || filteredSummary.infoCount || filteredSummary.summary?.informationCount || 0}
                  </Badge>
                )}
              </div>
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
      <Card className="overflow-hidden">
        {resources.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {resources.map((resource, index) => {
              const validationStatus = getValidationStatus(resource);
              const resourceId = resource._dbId || resource.id;
              const isValidating = validatingResourceIds.has(resourceId);
              const resourceKey = `${resource.resourceType}/${resource.id || resource.resourceId}`;
              const isSelected = selectedIds.has(resourceKey);
              const isHighlighted = highlightedResourceId === resourceKey;
              
              const itemContent = (
                <div className={cn(
                  "p-4 transition-colors",
                  !selectionMode && "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer",
                  validationStatus === 'not-validated' && "bg-gray-50/50 dark:bg-gray-800/50",
                  isSelected && "bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500",
                  isHighlighted && "ring-2 ring-inset ring-blue-500"
                )}>
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
                      
                      <div className="flex-1 min-w-0 max-w-full">
                        <div className="flex items-center space-x-3 mb-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate shrink min-w-0">
                            {resource.resourceType}/{getShortId(resource.id)}
                          </h3>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                              {(() => {
                                const Icon = getResourceTypeIcon(resource.resourceType);
                                return <Icon className="h-3 w-3" />;
                              })()}
                              {resource.resourceType}
                            </Badge>
                            {/* Display profile badges */}
                            {(resource.meta?.profile || resource.data?.meta?.profile) && (
                              <ProfileBadge 
                                profiles={resource.meta?.profile || resource.data?.meta?.profile || []}
                                size="sm"
                                maxDisplay={2}
                              />
                            )}
                            {/* Display version count */}
                            <ResourceVersionCount
                              versionData={versionData?.[`${resource.resourceType}/${resource.resourceId || resource.id}`]}
                              isLoading={isLoadingVersions}
                              compact
                            />
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap block w-full">
                          {getResourceDisplayName(resource)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap block w-full mt-1">
                          {getResourceSubtext(resource)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 ml-6">
                      {renderValidationBadge(resource)}
                      {!selectionMode && <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>
                </div>
              );
              
              return (
                <div 
                  key={resource.id || `${resource.resourceType}-${index}`}
                  ref={(el) => {
                    if (el) {
                      resourceRefs.current.set(resourceKey, el);
                    } else {
                      resourceRefs.current.delete(resourceKey);
                    }
                  }}
                  style={{ cursor: selectionMode ? 'default' : 'pointer' }}
                  onClick={(e) => {
                    // Don't navigate if in selection mode
                    if (selectionMode) return;
                    
                    const target = e.target as HTMLElement;
                    
                    // Check if click is on a severity badge or inside one
                    if (
                      target.classList.contains('severity-badge') ||
                      target.closest('.severity-badge') ||
                      target.closest('[data-severity-badge]') ||
                      target.closest('button') ||
                      target.closest('[role="checkbox"]')
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    
                    setLocation(`/resources/${resource.resourceType}/${resource.resourceId || resource.id}`);
                  }}
                >
                  {itemContent}
                </div>
              );
            })}
          </div>
        ) : (
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <XCircle className="h-12 w-12 mx-auto" />
            </div>
            {noResourceTypeMessage ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Select a Resource Type</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Resources Found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  No resources match your current search criteria. Try adjusting your filters.
                </p>
              </>
            )}
          </CardContent>
        )}
      </Card>

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
