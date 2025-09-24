import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface ValidationProgress {
  resourceId: number;
  progress: number; // 0-100
  currentAspect?: string; // Current validation aspect being processed
  completedAspects: string[]; // List of completed validation aspects
  totalAspects: number; // Total number of validation aspects
}

interface ResourceListProps {
  resources: any[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  validatingResourceIds?: Set<number>; // Track which resources are currently being validated
  validationProgress?: Map<number, ValidationProgress>; // Track validation progress per resource
  availableResourceTypes?: string[]; // Available resource types when none is selected
  noResourceTypeMessage?: string; // Message to show when no resource type is selected
}

export default function ResourceList({
  resources,
  total,
  page,
  onPageChange,
  pageSize = 20,
  validatingResourceIds = new Set(),
  validationProgress = new Map(),
  availableResourceTypes = [],
  noResourceTypeMessage,
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
  const currentSettings = validationSettingsData?.settings;
  
  // Function to filter validation results based on enabled aspects
  const getFilteredValidationSummary = (validationSummary: any) => {
    if (!validationSummary || !currentSettings) {
      return validationSummary;
    }

    // If we have aspect breakdown data, filter it based on enabled aspects
    if (validationSummary.aspectBreakdown) {
      const filteredBreakdown = { ...validationSummary.aspectBreakdown };
      let filteredErrorCount = 0;
      let filteredWarningCount = 0;
      let filteredInfoCount = 0;
      let filteredTotalIssues = 0;

      // Filter each aspect based on enabled status
      Object.keys(filteredBreakdown).forEach(aspect => {
        // Use top-level settings (the correct ones), fallback to nested settings if needed
        const aspectEnabled = currentSettings[aspect]?.enabled !== false || currentSettings.settings?.[aspect]?.enabled !== false;
        
        if (!aspectEnabled) {
          // Reset counts for disabled aspects
          filteredBreakdown[aspect] = {
            ...filteredBreakdown[aspect],
            issueCount: 0,
            errorCount: 0,
            warningCount: 0,
            informationCount: 0,
            validationScore: 100,
            passed: true,
            enabled: false
          };
        } else {
          // Include counts from enabled aspects
          filteredErrorCount += filteredBreakdown[aspect].errorCount || 0;
          filteredWarningCount += filteredBreakdown[aspect].warningCount || 0;
          filteredInfoCount += filteredBreakdown[aspect].informationCount || 0;
          filteredTotalIssues += filteredBreakdown[aspect].issueCount || 0;
        }
      });

      // Calculate filtered validation score
      let filteredScore = 100;
      filteredScore -= filteredErrorCount * 15;  // Error issues: -15 points each
      filteredScore -= filteredWarningCount * 5; // Warning issues: -5 points each
      filteredScore -= filteredInfoCount * 1;    // Information issues: -1 point each
      filteredScore = Math.max(0, Math.round(filteredScore));

      return {
        ...validationSummary,
        errorCount: filteredErrorCount,
        warningCount: filteredWarningCount,
        informationCount: filteredInfoCount,
        totalIssues: filteredTotalIssues,
        validationScore: filteredScore,
        hasErrors: filteredErrorCount > 0,
        hasWarnings: filteredWarningCount > 0,
        isValid: filteredErrorCount === 0,
        aspectBreakdown: filteredBreakdown
      };
    }

    return validationSummary;
  };

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
        const date = resource.effectiveDateTime ? new Date(resource.effectiveDateTime).toLocaleDateString() : '';
        return [subject, date].filter(Boolean).join(' | ') || 'Observation';
      case 'Encounter':
        const encounterDate = resource.period?.start ? new Date(resource.period.start).toLocaleDateString() : '';
        return encounterDate || 'Encounter';
      default:
        return resource.id || 'Resource';
    }
  };

  const getValidationStatus = (resource: any) => {
    // Use real validation results from the database
    const validationSummary = resource._validationSummary;
    
    // Only consider a resource validated if it has actual validation data from the database
    if (!validationSummary || !validationSummary.lastValidated) {
      return 'not-validated';
    }
    
    // Apply UI filtering based on enabled aspects
    const filteredSummary = getFilteredValidationSummary(validationSummary);
    
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
    const validationSummary = resource._validationSummary;
    const status = getValidationStatus(resource);
    const resourceId = resource._dbId || resource.id;
    const isValidating = validatingResourceIds.has(resourceId);
    const progress = validationProgress.get(resourceId);
    
    // Apply UI filtering to get the filtered validation summary
    const filteredSummary = getFilteredValidationSummary(validationSummary);
    
    // Determine the validation score to display
    const getValidationScore = () => {
      if (status === 'not-validated') {
        return 0; // Always show 0% for unvalidated resources
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
          <CircularProgress 
            value={progressValue} 
            size="sm"
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
            <Tooltip>
              <TooltipTrigger asChild>
                <CircularProgress 
                  value={validationScore} 
                  size="sm"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Validation Score: {validationScore}%</p>
                <p>Last validated: {filteredSummary?.lastValidated ? new Date(filteredSummary.lastValidated).toLocaleString() : 'Never'}</p>
              </TooltipContent>
            </Tooltip>
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
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <CircularProgress 
                  value={validationScore} 
                  size="sm"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Validation Score: {validationScore}%</p>
                <p>Last validated: {filteredSummary?.lastValidated ? new Date(filteredSummary.lastValidated).toLocaleString() : 'Never'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-50 text-fhir-warning border-orange-200 hover:bg-orange-50">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {filteredSummary?.warningCount || 0} Warning{(filteredSummary?.warningCount || 0) !== 1 ? 's' : ''}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <CircularProgress 
                  value={validationScore} 
                  size="sm"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Validation Score: {validationScore}%</p>
                <p>Last validated: {filteredSummary?.lastValidated ? new Date(filteredSummary.lastValidated).toLocaleString() : 'Never'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50">
              <AlertCircle className="h-3 w-3 mr-1" />
              Not Validated
            </Badge>
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
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
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
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resource List */}
      <div className="resource-cards-container">
        {resources.length > 0 ? (
          resources.map((resource, index) => {
            const validationStatus = getValidationStatus(resource);
            
            return (
              <div key={resource.id || `${resource.resourceType}-${index}`} className="mb-4 last:mb-0">
                <Link href={`/resources/${resource.resourceId || resource.id}?type=${resource.resourceType}`}>
                  <Card className={cn(
                    "hover:bg-gray-50 transition-colors cursor-pointer",
                    validationStatus === 'not-validated' && "border-dashed border-gray-300 bg-gray-50/50"
                  )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
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
                              {resource.resourceType}/{resource.id}
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
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                  </Card>
                </Link>
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
        <div className="flex items-center justify-center space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onPageChange(0)}
            disabled={currentPage === 0}
            className="hidden sm:inline-flex"
          >
            First
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
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
                className={pageNum === page ? "bg-fhir-blue text-white" : ""}
              >
                {pageNum + 1}
              </Button>
            );
          })}
          
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 sm:ml-1" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="hidden sm:inline-flex"
          >
            Last
          </Button>
        </div>
      )}
    </div>
  );
}
