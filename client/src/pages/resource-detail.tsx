import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import { useServerData } from "@/hooks/use-server-data";
import { useValidationMessages } from "@/hooks/use-validation-messages";
import ResourceViewer from "@/components/resources/resource-viewer";
import { ResourceDetailActions } from "@/components/resources";
import { ValidationMessagesPerAspect } from "@/components/validation/validation-messages-per-aspect";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FhirResourceWithValidation } from "@shared/schema";
import { ResourceDetailSkeleton } from "@/components/resources/resource-detail-skeleton";
import { ArrowLeft, XCircle } from "lucide-react";
import { CircularProgress } from "@/components/ui/circular-progress";
import ProfileBadge from "@/components/resources/ProfileBadge";
import { getShortId } from "@/lib/resource-utils";
import { ResourceVersionCount } from "@/components/resources/resource-version-count";
import { useResourceVersions } from "@/hooks/use-resource-versions";

// Extracted hooks
import { useResourceDetailState } from "@/hooks/use-resource-detail-state";
import { useResourceRevalidation } from "@/hooks/use-resource-revalidation";
import { useResourceEditor } from "@/hooks/use-resource-editor";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";

// Extracted utilities
import {
  isUUID,
  calculateValidationScore,
  extractValidationIssues,
  getValidationSummary,
  extractProfileUrls,
} from "@/lib/resource-detail-utils";

// Extracted handlers
import {
  createPathClickHandler,
  createSeverityClickHandler,
} from "@/pages/resource-detail-handlers";

export default function ResourceDetail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { activeServer } = useServerData();
  
  // Extracted state management hook
  const {
    isRevalidating,
    setIsRevalidating,
    revalidationTimers,
    setRevalidationTimers,
    isEditMode,
    setIsEditMode,
    editedResource,
    setEditedResource,
    autoRevalidate,
    setAutoRevalidate,
    hasChanges,
    setHasChanges,
    highlightedPath,
    setHighlightedPath,
    highlightedMessageSignatures,
    setHighlightedMessageSignatures,
    getExpandedPaths,
    setExpandedPaths,
  } = useResourceDetailState();
  
  // Parse query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const highlightSignature = searchParams.get('highlightSignature') || undefined;
  const resourceType = type; // Get resourceType from URL params instead of query params
  const initialSeverity = searchParams.get('severity') as 'error' | 'warning' | 'information' | undefined;
  
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

  // Cleanup revalidation timers on unmount
  useEffect(() => {
    return () => {
      revalidationTimers.forEach(timerId => clearTimeout(timerId));
    };
  }, [revalidationTimers]);


  // Try to get cached resource data from list view for instant display
  const getCachedResourceFromList = useCallback(() => {
    // Try to find the resource in any of the cached list queries
    const queryCache = queryClient.getQueryCache();
    const resourcesQueries = queryCache.findAll({ queryKey: ['resources'] });
    
    for (const query of resourcesQueries) {
      const data = query.state.data as any;
      if (data?.resources) {
        const cachedResource = data.resources.find(
          (r: any) => r.resourceType === type && r.resourceId === id
        );
        if (cachedResource) {
          console.log('[ResourceDetail] Using cached resource from list view');
          return cachedResource;
        }
      }
    }
    return undefined;
  }, [queryClient, type, id]);

  const { data: resource, isLoading, error, isFetching } = useQuery<any>({
    queryKey: ["/api/fhir/resources", id, resourceType],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, resourceId, type] = queryKey;
      console.log('Fetching resource with ID:', resourceId, 'Type:', type);
      const url = `${baseUrl}/${resourceId}?resourceType=${type}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error('Resource fetch failed:', response.status, response.statusText);
        
        // Try to parse error details from response
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch (e) {
          errorDetails = { message: response.statusText };
        }
        
        // Create detailed error message
        const errorMessage = errorDetails.message || `Failed to fetch resource: ${response.status}`;
        const error: any = new Error(errorMessage);
        error.status = response.status;
        error.details = errorDetails;
        throw error;
      }
      const data = await response.json();
      console.log('Resource fetched successfully:', data);
      return data;
    },
    enabled: !!id,
    // Use cached data from list view as initial data for instant display
    initialData: getCachedResourceFromList,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (not found) or 403 (forbidden)
      if (error?.status === 404 || error?.status === 403) {
        return false;
      }
      // Retry up to 3 times on 500 errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 300ms, 600ms, 1200ms
      return Math.min(300 * Math.pow(2, attemptIndex), 3000);
    },
  });
  
  // Fetch version data for this resource
  const { data: versionData, isLoading: isLoadingVersions } = useResourceVersions(
    resource?.resourceType,
    resource?.resourceId
  );

  // Extracted hooks that depend on resource (must be after resource is fetched)
  const { handleRevalidate } = useResourceRevalidation({
    resource,
    resourceId: id || '',
    activeServerId: typeof activeServer?.id === 'number' ? activeServer.id : undefined,
    validationSettingsData,
    revalidationTimers,
    setRevalidationTimers,
    setIsRevalidating,
  });

  const {
    handleEdit,
    handleSave,
    handleView,
    handleResourceChange,
  } = useResourceEditor({
    resource,
    resourceId: id || '',
    isEditMode,
    setIsEditMode,
    editedResource,
    setEditedResource,
    hasChanges,
    setHasChanges,
    autoRevalidate,
    onRevalidate: handleRevalidate,
  });
  
  // Fetch validation messages using shared hook
  // This automatically uses cached data from list view if available
  const { data: validationMessages, isLoading: isLoadingMessages } = useValidationMessages(
    type || '',
    id || ''
  );

  // Handle path clicks from validation messages
  // Extracted navigation hook
  const { handleResourceClick } = useResourceNavigation();

  // Create handlers using factory functions
  const handlePathClick = useCallback(
    createPathClickHandler(resource, getExpandedPaths, setExpandedPaths, setHighlightedPath),
    [resource, getExpandedPaths, setExpandedPaths, setHighlightedPath]
  );
  
  const handleSeverityClick = useCallback(
    createSeverityClickHandler(),
    []
  );

  // Only show skeleton when we have no data at all (not even cached)
  // If we have cached data, show it even while fetching fresh data
  if (isLoading && !resource) {
    return <ResourceDetailSkeleton />;
  }

  if (!resource) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Resource Not Found</h3>
              <p className="text-gray-600 mb-4">
                The requested resource could not be found or has been removed.
              </p>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => window.history.back()}
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use extracted utility functions for validation
  const enhancedValidation = (resource as any)._enhancedValidationSummary;
  const legacyValidation = (resource as any)._validationSummary;
  const validationSummary = getValidationSummary(resource);
  const currentSettings = validationSettingsData?.settings;
  
  // Calculate validation score using utility function
  const validationScore = calculateValidationScore(enhancedValidation, legacyValidation);
  
  console.log('[ResourceDetail] Validation score calculation:', {
    hasEnhanced: !!enhancedValidation,
    hasLegacy: !!legacyValidation,
    enhancedScore: enhancedValidation?.overallScore,
    legacyScore: legacyValidation?.validationScore,
    finalScore: validationScore
  });
  
  // Convert validation messages using utility function
  const validationIssues = extractValidationIssues(validationMessages, resource?.resourceType || '');
  
  console.log('[ResourceDetail] Passing', validationIssues.length, 'validation issues to ResourceViewer');
  if (validationIssues.length > 0) {
    const severityCounts = validationIssues.reduce((acc: any, issue: any) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});
    console.log('[ResourceDetail] Severity breakdown:', severityCounts);
    console.log('[ResourceDetail] Paths after stripping resource type:', validationIssues.slice(0, 5).map((i: any) => ({
      path: i.path,
      severity: i.severity
    })));
  }

  // Extract profile URLs using utility function
  const profileUrls = extractProfileUrls(resource);
  console.log('[ResourceDetail] Profile URLs for slice detection:', profileUrls);

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header section with resource identifier and version count */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => window.history.back()}
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {isUUID(resource.resourceId) 
                    ? `${resource.resourceType}/${getShortId(resource.resourceId)}` 
                    : `${resource.resourceType}/${resource.resourceId}`}
                </h1>
                <div className="flex items-center gap-3">
                  {/* Display declared profiles */}
                  {(resource.data?.meta?.profile || resource.meta?.profile) && (
                    <ProfileBadge 
                      profiles={resource.data?.meta?.profile || resource.meta?.profile || []}
                      size="md"
                    />
                  )}
                  {/* Display version count */}
                  <ResourceVersionCount
                    versionData={versionData}
                    isLoading={isLoadingVersions}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Validation Score Circle */}
              <CircularProgress 
                value={validationScore} 
                size="lg"
                showValue={true}
                className="flex-shrink-0"
              />
              <ResourceDetailActions
                resourceType={resource.resourceType}
                resourceId={resource.resourceId}
                resource={resource}
                versionId={resource.meta?.versionId}
                isEditMode={isEditMode}
                onEdit={handleEdit}
                onSave={handleSave}
                onView={handleView}
                onRevalidate={handleRevalidate}
                isRevalidating={isRevalidating}
                canSave={hasChanges}
              />
            </div>
          </div>
        </div>


        {/* Main content - two columns: Resource Structure (left) and Validation Messages (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* Left: Resource Structure */}
          <div>
            <ResourceViewer 
              resource={resource} 
              resourceId={resource.resourceId}
              resourceType={resource.resourceType}
              isEditMode={isEditMode}
              editedResource={editedResource}
              onResourceChange={handleResourceChange}
              onEdit={handleEdit}
              autoRevalidate={autoRevalidate}
              onAutoRevalidateChange={setAutoRevalidate}
              expandedPaths={getExpandedPaths(resource.resourceId)}
              onExpandedPathsChange={(paths) => setExpandedPaths(resource.resourceId, paths)}
              highlightPath={highlightedPath}
              onSeverityClick={handleSeverityClick}
              validationIssues={validationIssues as any}
              profileUrls={profileUrls}
            />
          </div>
          
          {/* Right: Per-Aspect Validation Messages */}
          <div>
            <ValidationMessagesPerAspect
              resourceType={resource.resourceType}
              resourceId={resource.resourceId}
              serverId={typeof activeServer?.id === 'number' ? activeServer.id : undefined}
              highlightSignature={highlightSignature}
              initialSeverity={initialSeverity}
              onPathClick={handlePathClick}
              onResourceClick={handleResourceClick}
              profiles={resource.data?.meta?.profile || resource.meta?.profile || []}
              isValid={validationSummary?.isValid}
              errorCount={validationSummary?.errorCount}
              warningCount={validationSummary?.warningCount}
              informationCount={validationSummary?.informationCount}
              isRevalidating={isRevalidating || (resource as any)._isRevalidating}
              lastValidated={validationSummary?.lastValidated}
            />
          </div>
        </div>
      </div>
    </div>
  );
}