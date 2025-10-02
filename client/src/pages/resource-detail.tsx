import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import ValidationErrors from "@/components/validation/validation-errors";
import ResourceViewer from "@/components/resources/resource-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FhirResourceWithValidation } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, ArrowLeft, AlertCircle, AlertTriangle, Info, Settings, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  
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

  // Listen for validation settings changes from polling and refresh resource detail
  useEffect(() => {
    if (lastChange) {
      console.log('[ResourceDetail] Validation settings changed, refreshing resource detail');
      // Invalidate resource queries to refresh with new validation settings
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources', id] });
    }
  }, [lastChange, queryClient, id]);
  
  // Listen for validation settings changes to invalidate resource cache
  useEffect(() => {
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_changed' && data.data?.type === 'validation_settings_updated') {
          console.log('[ResourceDetail] Validation settings updated, invalidating resource cache');
          // Invalidate resource queries to refresh with new validation settings
          queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources', id] });
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
              <Link href="/resources">
                <Button variant="outline" className="inline-flex items-center">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
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
              <Link href="/resources">
                <Button variant="outline" size="sm" className="inline-flex items-center">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {resource.resourceType} Resource
                </h1>
                <p className="text-gray-600">ID: {resource.resourceId}</p>
                {validationSummary && (
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-2">
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
                    </div>
                    {validationSummary.lastValidated && (
                      <span className="text-xs text-gray-500">
                        Last validated: {new Date(validationSummary.lastValidated).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {validationSummary && (
              <div className="flex items-center space-x-4">
                <CircularProgress 
                  value={validationSummary.score} 
                  size="lg"
                  showValue={true}
                />
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">Validation Score</p>
                  <p className="text-xs text-gray-500">
                    {validationSummary.totalIssues} issue{validationSummary.totalIssues !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Main content - single column with integrated validation */}
        <div>
          <ResourceViewer 
            resource={resource} 
            resourceId={resource.resourceId}
            resourceType={resource.resourceType}
          />
        </div>
      </div>
    </div>
  );
}