import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import { useServerData } from "@/hooks/use-server-data";
import { useToast } from "@/hooks/use-toast";
import ValidationErrors from "@/components/validation/validation-errors";
import ResourceViewer from "@/components/resources/resource-viewer";
import { ValidationMessagesPerAspect } from "@/components/validation/validation-messages-per-aspect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FhirResourceWithValidation } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, ArrowLeft, AlertCircle, AlertTriangle, Info, Settings, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { activeServer } = useServerData();
  const { toast } = useToast();
  const [isRevalidating, setIsRevalidating] = useState(false);
  
  // Parse query parameters
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const highlightSignature = searchParams.get('highlightSignature') || undefined;
  
  // Use validation settings polling to detect changes and refresh resource detail
  const { lastChange } = useValidationSettingsPolling({
    pollingInterval: 60000, // Poll every 60 seconds (reduced frequency)
    enabled: true,
    showNotifications: false, // Don't show toast notifications in resource detail
    invalidateCache: true, // Invalidate cache when settings change
  });

  // Fetch current validation settings for display
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

  // Listen for validation settings changes from polling
  // Note: Settings changes only affect UI filtering, not data fetching
  useEffect(() => {
    if (lastChange) {
      console.log('[ResourceDetail] Validation settings changed');
      // No need to refetch - settings only affect UI filtering of validation results
    }
  }, [lastChange, queryClient, id]);
  
  // Listen for validation settings changes
  useEffect(() => {
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_changed' && data.data?.type === 'validation_settings_updated') {
          console.log('[ResourceDetail] Validation settings updated');
          // No need to refetch - settings only affect UI filtering of validation results
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    // Add event listener for SSE messages
    const sse = (window as any).validationSSE;
    if (sse) {
      sse.addEventListener('message', handleSSEMessage);
      return () => sse.removeEventListener('message', handleSSEMessage);
    }
  }, [queryClient, id]);

  // Handle revalidation
  const handleRevalidate = async () => {
    if (!resource) return;

    setIsRevalidating(true);
    
    try {
      const response = await fetch(
        `/api/validation/resources/${resource.resourceType}/${resource.resourceId}/revalidate?serverId=${activeServer?.id || 1}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Revalidation failed');
      }

      const result = await response.json();

      // Optimistic update: Keep resource visible, only update validation status
      const currentData = queryClient.getQueryData(['/api/fhir/resources', id]);
      if (currentData) {
        queryClient.setQueryData(['/api/fhir/resources', id], {
          ...currentData,
          _isRevalidating: true,
          _validationSummary: {
            ...(currentData as any)._validationSummary,
            status: 'validating',
          },
        });
      }

      toast({
        title: "Revalidation queued",
        description: `Resource has been enqueued for validation.`,
      });

      // Soft refetch after 3 seconds to get updated validation results
      // This won't trigger loading state since we already have data in cache
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: ['/api/fhir/resources', id],
          exact: true,
        });
      }, 3000);
      
    } catch (error) {
      console.error('Revalidation error:', error);
      toast({
        title: "Revalidation failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsRevalidating(false);
    }
  };
  
  const { data: resource, isLoading, error } = useQuery<FhirResourceWithValidation>({
    queryKey: ["/api/fhir/resources", id],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, resourceId] = queryKey;
      console.log('Fetching resource with ID:', resourceId);
      const response = await fetch(`${baseUrl}/${resourceId}`);
      if (!response.ok) {
        console.error('Resource fetch failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch resource: ${response.status}`);
      }
      const data = await response.json();
      console.log('Resource fetched successfully:', data);
      return data;
    },
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Resource Not Found</h3>
              <p className="text-gray-600 mb-4">
                The requested resource could not be found or has been removed.
              </p>
              <Button 
                variant="outline" 
                className="inline-flex items-center"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasValidationResults = resource.validationResults && Array.isArray(resource.validationResults) && resource.validationResults.length > 0;
  const hasErrors = hasValidationResults && resource.validationResults?.some(r => !r.isValid);
  const currentSettings = validationSettingsData?.settings;
  
  // Calculate validation summary from filtered validation results
  const validationSummary = hasValidationResults ? (() => {
    // Use the filtered validation results from the server
    const latestResult = resource.validationResults![0]; // Server already filters to latest result
    const allIssues = Array.isArray(latestResult.issues) ? latestResult.issues : [];
    
    // Filter issues based on enabled aspects
    const filteredIssues = allIssues.filter((issue: any) => {
      const aspect = issue.aspect || 'structural';
      switch (aspect) {
        case 'structural':
          return currentSettings?.aspects?.structural?.enabled !== false;
        case 'profile':
          return currentSettings?.aspects?.profile?.enabled !== false;
        case 'terminology':
          return currentSettings?.aspects?.terminology?.enabled !== false;
        case 'reference':
          return currentSettings?.aspects?.reference?.enabled !== false;
        case 'businessRule':
          return currentSettings?.aspects?.businessRule?.enabled !== false;
        case 'metadata':
          return currentSettings?.aspects?.metadata?.enabled !== false;
        default:
          return currentSettings?.aspects?.structural?.enabled !== false; // Default to structural
      }
    });
    
    // Calculate counts from filtered issues
    const errorCount = filteredIssues.filter((issue: any) => 
      issue.severity === 'error' || issue.severity === 'fatal'
    ).length;
    const warningCount = filteredIssues.filter((issue: any) => 
      issue.severity === 'warning'
    ).length;
    const informationCount = filteredIssues.filter((issue: any) => 
      issue.severity === 'information'
    ).length;
    
    // Calculate aspect-specific breakdowns
    const aspectBreakdown = {
      structural: { issues: 0, errors: 0, warnings: 0, info: 0, enabled: currentSettings?.aspects?.structural?.enabled !== false },
      profile: { issues: 0, errors: 0, warnings: 0, info: 0, enabled: currentSettings?.aspects?.profile?.enabled !== false },
      terminology: { issues: 0, errors: 0, warnings: 0, info: 0, enabled: currentSettings?.aspects?.terminology?.enabled !== false },
      reference: { issues: 0, errors: 0, warnings: 0, info: 0, enabled: currentSettings?.aspects?.reference?.enabled !== false },
      businessRule: { issues: 0, errors: 0, warnings: 0, info: 0, enabled: currentSettings?.aspects?.businessRule?.enabled !== false },
      metadata: { issues: 0, errors: 0, warnings: 0, info: 0, enabled: currentSettings?.aspects?.metadata?.enabled !== false }
    };
    
    // Count issues by aspect
    filteredIssues.forEach((issue: any) => {
      const aspect = issue.aspect || 'structural';
      if (aspectBreakdown[aspect as keyof typeof aspectBreakdown]) {
        const breakdown = aspectBreakdown[aspect as keyof typeof aspectBreakdown];
        breakdown.issues++;
        if (issue.severity === 'error' || issue.severity === 'fatal') {
          breakdown.errors++;
        } else if (issue.severity === 'warning') {
          breakdown.warnings++;
        } else if (issue.severity === 'information') {
          breakdown.info++;
        }
      }
    });
    
    // Calculate filtered validation score based on enabled aspects
    let filteredScore = 100;
    filteredScore -= errorCount * 15;  // Error issues: -15 points each
    filteredScore -= warningCount * 5; // Warning issues: -5 points each
    filteredScore -= informationCount * 1; // Information issues: -1 point each
    filteredScore = Math.max(0, Math.round(filteredScore));
    
    return {
      totalIssues: filteredIssues.length,
      errorCount,
      warningCount,
      informationCount,
      score: filteredScore, // Use filtered score that reflects enabled aspects
      isValid: errorCount === 0,
      aspectBreakdown,
      lastValidated: latestResult.validatedAt
    };
  })() : null;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Header section with validation summary */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="inline-flex items-center"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {resource.resourceType} Resource
                </h1>
                <p className="text-gray-600">ID: {resource.resourceId}</p>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center space-x-2">
                    {/* Show revalidating badge when validation is in progress */}
                    {(isRevalidating || (resource as any)._isRevalidating) && (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Revalidating...
                      </Badge>
                    )}
                    {validationSummary ? (
                      <>
                        {validationSummary.isValid ? (
                          <Badge className="bg-green-50 text-green-600 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-600 border-red-200">
                            <XCircle className="h-3 w-3 mr-1" />
                            {validationSummary.errorCount} Error{validationSummary.errorCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {validationSummary.warningCount > 0 && (
                          <Badge className="bg-orange-50 text-orange-600 border-orange-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {validationSummary.warningCount} Warning{validationSummary.warningCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Validated
                      </Badge>
                    )}
                  </div>
                  {validationSummary?.lastValidated && (
                    <span className="text-xs text-gray-500">
                      Last validated: {new Date(validationSummary.lastValidated).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevalidate}
                disabled={isRevalidating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRevalidating ? 'animate-spin' : ''}`} />
                {validationSummary ? 'Revalidate' : 'Validate'}
              </Button>
              <CircularProgress 
                value={validationSummary?.score || 0} 
                size="lg"
                showValue={true}
              />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Validation Score</p>
                <p className="text-xs text-gray-500">
                  {validationSummary 
                    ? `${validationSummary.totalIssues} issue${validationSummary.totalIssues !== 1 ? 's' : ''} found`
                    : 'Not validated'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* Main content - two columns: Resource Structure (left) and Validation Messages (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Resource Structure */}
          <div>
            <ResourceViewer 
              resource={resource} 
              resourceId={resource.resourceId}
              resourceType={resource.resourceType}
            />
          </div>
          
          {/* Right: Per-Aspect Validation Messages */}
          <div>
            <ValidationMessagesPerAspect
              resourceType={resource.resourceType}
              resourceId={resource.resourceId}
              serverId={activeServer?.id}
              highlightSignature={highlightSignature}
            />
          </div>
        </div>
      </div>
    </div>
  );
}