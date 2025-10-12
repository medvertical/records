import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import { useServerData } from "@/hooks/use-server-data";
import { useToast } from "@/hooks/use-toast";
import ValidationErrors from "@/components/validation/validation-errors";
import ResourceViewer from "@/components/resources/resource-viewer";
import { ResourceDetailActions } from "@/components/resources";
import { ValidationMessagesPerAspect } from "@/components/validation/validation-messages-per-aspect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FhirResourceWithValidation } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, ArrowLeft, AlertCircle, AlertTriangle, Info, Settings, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { activeServer } = useServerData();
  const { toast } = useToast();
  const [isRevalidating, setIsRevalidating] = useState(false);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedResource, setEditedResource] = useState<any>(null);
  const [autoRevalidate, setAutoRevalidate] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Per-resource expanded paths state - keyed by resourceId
  const [expandedPathsMap, setExpandedPathsMap] = useState<Map<string, Set<string>>>(new Map());
  
  // Get expanded paths for current resource
  const getExpandedPaths = (resourceId: string) => {
    return expandedPathsMap.get(resourceId) || new Set<string>();
  };
  
  // Set expanded paths for current resource
  const setExpandedPaths = useCallback((resourceId: string, expandedPaths: Set<string>) => {
    setExpandedPathsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(resourceId, expandedPaths);
      return newMap;
    });
  }, []);
  
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

    console.log('[Revalidate] Button clicked, resource:', resource);
    console.log('[Revalidate] Resource type:', resource.resourceType);
    console.log('[Revalidate] Resource ID:', resource.resourceId);
    
    setIsRevalidating(true);
    
    try {
      const url = `/api/validation/resources/${resource.resourceType}/${resource.resourceId}/revalidate?serverId=${activeServer?.id || 1}`;
      console.log('[Revalidate] Calling URL:', url);
      
      const response = await fetch(url, { method: 'POST' });
      console.log('[Revalidate] Response status:', response.status);
      console.log('[Revalidate] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Revalidate] Error response:', errorText);
        throw new Error('Revalidation failed');
      }

      const result = await response.json();
      console.log('[Revalidate] Full response data:', result);
      console.log('[Revalidate] Validation result:', result.validationResult);
      console.log('[Revalidate] Is valid:', result.validationResult?.isValid);
      console.log('[Revalidate] Aspects:', result.validationResult?.aspects);

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
        description: `Resource has been enqueued for validation. Results will appear shortly.`,
      });

      // Poll for updated validation results multiple times
      // Background validation jobs may take several seconds to complete
      const refetchDelays = [2000, 4000, 6000, 10000]; // 2s, 4s, 6s, 10s
      refetchDelays.forEach((delay) => {
        setTimeout(() => {
          // Refetch resource data
          queryClient.refetchQueries({
            queryKey: ['/api/fhir/resources', id],
            exact: true,
          });
          // Also refetch validation messages to update the right panel immediately
          const serverKey = activeServer?.id || 1;
          queryClient.invalidateQueries({
            queryKey: ['/api/validation/resources', resource.resourceType, resource.resourceId, 'messages', serverKey],
          });
          queryClient.refetchQueries({
            queryKey: ['/api/validation/resources', resource.resourceType, resource.resourceId, 'messages', serverKey],
            exact: true,
          });
        }, delay);
      });
      
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

  // Handle entering edit mode
  const handleEdit = () => {
    if (!resource) return;
    // Store the current resource data for editing
    const resourceData = resource.data || resource;
    setEditedResource(resourceData);
    setIsEditMode(true);
    setHasChanges(false);
  };

  // Handle saving edits
  const handleSave = async () => {
    if (!editedResource || !resource) return;

    try {
      const response = await fetch(
        `/api/fhir/resources/${resource.resourceType}/${resource.resourceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editedResource),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save resource');
      }

      const updatedResource = await response.json();

      toast({
        title: "Resource saved",
        description: "Your changes have been saved successfully.",
      });

      // Refetch resource data
      queryClient.invalidateQueries({
        queryKey: ['/api/fhir/resources', id],
      });

      // Exit edit mode
      setIsEditMode(false);
      setEditedResource(null);
      setHasChanges(false);

      // Auto-revalidate if enabled
      if (autoRevalidate) {
        setTimeout(() => handleRevalidate(), 500);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  // Handle canceling edit mode
  const handleView = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmed) return;
    }
    setIsEditMode(false);
    setEditedResource(null);
    setHasChanges(false);
  };

  // Handle resource changes in edit mode
  const handleResourceChange = useCallback((updatedResource: any) => {
    setEditedResource(updatedResource);
    setHasChanges(true);
  }, []);
  
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
      <div className="p-6 space-y-6">
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

  // Use _validationSummary from the API (matches how list view works)
  const validationSummary = resource._validationSummary;
  const currentSettings = validationSettingsData?.settings;
  
  // Check if resource has validation data
  const hasValidationData = validationSummary && validationSummary.lastValidated;
  const hasErrors = hasValidationData && !validationSummary.isValid;
  
  // Calculate total issues from the summary counts
  const totalIssues = validationSummary ? (
    (validationSummary.errorCount || 0) + 
    (validationSummary.warningCount || 0) + 
    (validationSummary.informationCount || 0)
  ) : 0;

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header section with validation summary */}
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
              autoRevalidate={autoRevalidate}
              onAutoRevalidateChange={setAutoRevalidate}
              expandedPaths={getExpandedPaths(resource.resourceId)}
              onExpandedPathsChange={(paths) => setExpandedPaths(resource.resourceId, paths)}
            />
          </div>
          
          {/* Right: Per-Aspect Validation Messages - Sticky */}
          <div className="sticky top-20 self-start">
            <ValidationMessagesPerAspect
              resourceType={resource.resourceType}
              resourceId={resource.resourceId}
              serverId={activeServer?.id}
              highlightSignature={highlightSignature}
              validationScore={validationSummary?.validationScore || 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}