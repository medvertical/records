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
import { ResourceDetailSkeleton } from "@/components/resources/resource-detail-skeleton";
import { ArrowLeft, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ProfileBadge from "@/components/resources/ProfileBadge";
import { getShortId } from "@/lib/resource-utils";
import { ResourceVersionCount } from "@/components/resources/resource-version-count";
import { useResourceVersions } from "@/hooks/use-resource-versions";
import { useGroupNavigation } from "@/hooks/use-group-navigation";

// Helper function to check if a string is a UUID
const isUUID = (str: string): boolean => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
};

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
  
  // Path highlighting state
  const [highlightedPath, setHighlightedPath] = useState<string | undefined>(undefined);
  // Message highlighting state for tree → messages navigation
  const [highlightedMessageSignatures, setHighlightedMessageSignatures] = useState<string[]>([]);
  
  // Per-resource expanded paths state - keyed by resourceId
  const [expandedPathsMap, setExpandedPathsMap] = useState<Map<string, Set<string>>>(new Map());
  
  // Get expanded paths for current resource
  const getExpandedPaths = (resourceId: string) => {
    return expandedPathsMap.get(resourceId) || new Set<string>();
  };
  
  // Set expanded paths for current resource
  const setExpandedPaths = useCallback((resourceId: string, expandedPaths: Set<string>) => {
    console.log('[ResourceDetail] setExpandedPaths called:', {
      resourceId,
      pathCount: expandedPaths.size,
      paths: Array.from(expandedPaths)
    });
    setExpandedPathsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(resourceId, expandedPaths);
      return newMap;
    });
  }, []);
  
  // Parse query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const highlightSignature = searchParams.get('highlightSignature') || undefined;
  const resourceType = searchParams.get('type') || undefined;
  
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
    
    // Extract profile URLs from resource meta
    const profileUrls = resource.data?.meta?.profile || resource.meta?.profile || [];
    console.log('[Revalidate] Profile URLs found:', profileUrls);
    
    setIsRevalidating(true);
    
    try {
      const url = `/api/validation/resources/${resource.resourceType}/${resource.resourceId}/revalidate?serverId=${activeServer?.id || 1}`;
      console.log('[Revalidate] Calling URL:', url);
      
      const response = await fetch(url, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrls })
      });
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
    queryKey: ["/api/fhir/resources", id, resourceType],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, resourceId, type] = queryKey;
      console.log('Fetching resource with ID:', resourceId, 'Type:', type);
      const url = type 
        ? `${baseUrl}/${resourceId}?resourceType=${type}`
        : `${baseUrl}/${resourceId}`;
      const response = await fetch(url);
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
  
  // Fetch version data for this resource
  const { data: versionData, isLoading: isLoadingVersions } = useResourceVersions(
    resource?.resourceType,
    resource?.resourceId
  );
  
  // Fetch validation messages to pass to ResourceViewer for tree badges
  const { data: validationMessages } = useQuery({
    queryKey: ['/api/validation/resources', resource?.resourceType, resource?.resourceId, 'messages', activeServer?.id],
    queryFn: async () => {
      if (!resource) return null;
      const response = await fetch(
        `/api/validation/resources/${resource.resourceType}/${resource.resourceId}/messages?serverId=${activeServer?.id || 1}`
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!resource?.resourceType && !!resource?.resourceId,
    refetchInterval: 30000,
  });

  // Handle path clicks from validation messages
  const handlePathClick = useCallback((path: string) => {
    console.log('[ResourceDetail] Path clicked:', path);
    if (!resource?.resourceId) return;
    
    // Remove resource type prefix if present (e.g., "patient.status" -> "status" or "Patient.status" -> "status")
    const parts = path.split('.');
    // Check if first part is a resource type (starts with letter, case-insensitive)
    const treePath = parts.length > 0 && /^[a-zA-Z]/.test(parts[0]) && resource?.resourceType?.toLowerCase() === parts[0].toLowerCase()
      ? parts.slice(1).join('.')
      : path;
    console.log('[ResourceDetail] Converted to tree path:', treePath);
    
    // Generate all parent paths that need to be expanded
    // For a path like "identifier.[0].assigner.identifier.system", we need to expand:
    // - resourceType (root)
    // - resourceType.identifier
    // - resourceType.identifier.[0]
    // - resourceType.identifier.[0].assigner
    // - resourceType.identifier.[0].assigner.identifier
    const pathsToExpand = new Set<string>();
    const resourceType = resource.resourceType || 'Resource';
    
    // Always expand the root
    pathsToExpand.add(resourceType);
    
    if (treePath) {
      const segments = treePath.split('.');
      let currentPath = resourceType;
      
      for (let i = 0; i < segments.length; i++) {
        currentPath += '.' + segments[i];
        pathsToExpand.add(currentPath);
      }
    }
    
    // Merge with existing expanded paths
    const currentExpandedPaths = getExpandedPaths(resource.resourceId);
    const newExpandedPaths = new Set([...currentExpandedPaths, ...pathsToExpand]);
    
    console.log('[ResourceDetail] Expanding paths:', Array.from(pathsToExpand));
    setExpandedPaths(resource.resourceId, newExpandedPaths);
    
    // Set highlighted path after a small delay to allow expansion to happen first
    setTimeout(() => {
      setHighlightedPath(treePath);
      // Clear the highlight after enough time to see it
      setTimeout(() => {
        console.log('[ResourceDetail] Clearing highlighted path');
        setHighlightedPath(undefined);
      }, 3500);
    }, 100);
  }, [resource?.resourceType, resource?.resourceId, getExpandedPaths, setExpandedPaths]);
  
  // Handle severity clicks from tree nodes
  const handleSeverityClick = useCallback((severity: string, path: string) => {
    console.log('[ResourceDetail] Severity clicked:', { severity, path });
    // This will be used to highlight messages based on path and severity
    // We'll pass this through ResourceViewer to the tree
    // For now, we'll trigger a custom event that ValidationMessagesPerAspect can listen to
    const event = new CustomEvent('highlight-messages', {
      detail: { severity, path }
    });
    window.dispatchEvent(event);
  }, []);

  // Handle resource clicks from validation messages
  const { navigateToResourceDetail } = useGroupNavigation();
  const handleResourceClick = useCallback((resourceType: string, resourceId: string) => {
    console.log('[ResourceDetail] Resource clicked:', { resourceType, resourceId });
    navigateToResourceDetail(resourceType, resourceId);
  }, [navigateToResourceDetail]);

  if (isLoading) {
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

  // Convert validation messages to the format ResourceViewer expects
  const validationIssues = validationMessages?.aspects?.flatMap((aspect: any) =>
    aspect.messages.map((msg: any) => {
      // Strip resource type prefix from path (e.g., "patient.meta.profile" -> "meta.profile" or "Patient.meta.profile" -> "meta.profile")
      const pathParts = msg.canonicalPath.split('.');
      // Check if first part is a resource type (case-insensitive match)
      const pathWithoutResourceType = pathParts.length > 0 && 
        /^[a-zA-Z]/.test(pathParts[0]) && 
        resource?.resourceType?.toLowerCase() === pathParts[0].toLowerCase()
        ? pathParts.slice(1).join('.') 
        : msg.canonicalPath;
      
      return {
        id: msg.signature,
        code: msg.code,
        message: msg.text,
        severity: msg.severity,
        category: aspect.aspect,
        path: pathWithoutResourceType,
        location: [pathWithoutResourceType],
      };
    })
  ) || [];
  
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
              highlightPath={highlightedPath}
              onSeverityClick={handleSeverityClick}
              validationIssues={validationIssues}
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