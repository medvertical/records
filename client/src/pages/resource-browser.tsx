import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useServerData } from "@/hooks/use-server-data";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import ResourceSearch from "@/components/resources/resource-search";
import ResourceList from "@/components/resources/resource-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Settings } from "lucide-react";

// Simple client-side cache to track validated resources
const validatedResourcesCache = new Set<string>();

// Cache clearing event system
let cacheClearedListeners: (() => void)[] = [];

// Make cache accessible globally for other components
if (typeof window !== 'undefined') {
  (window as any).validatedResourcesCache = validatedResourcesCache;
  (window as any).onCacheCleared = (callback: () => void) => {
    cacheClearedListeners.push(callback);
  };
  (window as any).triggerCacheCleared = () => {
    validatedResourcesCache.clear();
    cacheClearedListeners.forEach(listener => listener());
  };
}

interface ResourcesResponse {
  resources: any[];
  total: number;
}

interface ValidationUpdateMessage {
  type: 'resource_validation_updated';
  resourceId: number;
  fhirResourceId: string;
  resourceType: string;
  validationSummary: {
    hasErrors: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
    isValid: boolean;
    lastValidated: Date;
  };
}

export default function ResourceBrowser() {
  const [location] = useLocation();
  const [resourceType, setResourceType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [validatingResourceIds, setValidatingResourceIds] = useState<Set<number>>(new Set());
  const [validationProgress, setValidationProgress] = useState<Map<number, any>>(new Map());
  const [hasValidatedCurrentPage, setHasValidatedCurrentPage] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const queryClient = useQueryClient();

  // Use validation settings polling to detect changes and refresh resource list
  const { lastChange, isPolling, error: pollingError } = useValidationSettingsPolling({
    pollingInterval: 5000, // Poll every 5 seconds
    enabled: true,
    showNotifications: false, // Don't show toast notifications in resource browser
    invalidateCache: true, // Invalidate cache when settings change
  });

  // Listen for validation settings changes and refresh resource list
  useEffect(() => {
    if (lastChange) {
      console.log('[ResourceBrowser] Validation settings changed, refreshing resource list');
      // Reset validation flag when settings change to allow re-validation with new settings
      setHasValidatedCurrentPage(false);
      // Invalidate resource queries to refresh with new validation settings
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
    }
  }, [lastChange, queryClient]);



  // Define handleSearch function before using it in useEffect
  const handleSearch = useCallback((query: string, type: string) => {
    setSearchQuery(query);
    setResourceType(type);
    setPage(0);
    
    // Update URL to reflect the search parameters
    const searchParams = new URLSearchParams();
    if (type && type !== "all") {
      searchParams.set('type', type);
    }
    if (query) {
      searchParams.set('search', query);
    }
    
    const newUrl = searchParams.toString() ? `/resources?${searchParams.toString()}` : '/resources';
    window.history.pushState({}, '', newUrl);
    
    // Trigger a custom event to notify the sidebar of URL changes
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  // Parse URL parameters and update state when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    const searchParam = urlParams.get('search');
    
    console.log('[ResourceBrowser] URL changed:', {
      location,
      typeParam,
      searchParam,
      currentResourceType: resourceType,
      currentSearchQuery: searchQuery
    });
    
    // Update state directly - this will trigger the query to re-run
    setResourceType(typeParam || "");
    setSearchQuery(searchParam || "");
    setPage(0); // Reset to first page when navigating
  }, [location]);

  // Also listen for popstate events to handle programmatic URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const typeParam = urlParams.get('type');
      const searchParam = urlParams.get('search');
      
      console.log('[ResourceBrowser] Popstate event:', {
        typeParam,
        searchParam,
        currentResourceType: resourceType,
        currentSearchQuery: searchQuery
      });
      
      // Update state when URL changes programmatically
      setResourceType(typeParam || "");
      setSearchQuery(searchParam || "");
      setPage(0);
    };
    
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []); // No dependencies to avoid re-adding listeners

  // Removed excessive URL monitoring that was causing flickering



  // Listen for validation settings changes to invalidate resource cache
  useEffect(() => {
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_changed' && data.data?.type === 'validation_settings_updated') {
          console.log('[ResourceBrowser] Validation settings updated, invalidating resource cache');
          // Invalidate resource queries to refresh with new validation settings
          queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
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
  }, [queryClient]);

  // SSE connection for real-time validation updates
  useEffect(() => {
    // SSE connection is handled by useValidationSSE hook
    // Real-time validation updates are managed through SSE events
    return;
  }, []);

  // Get active server using the proper hook
  const { activeServer: stableActiveServer } = useServerData();

  // Debug logging for component state - reduced frequency
  useEffect(() => {
    console.log('[ResourceBrowser] Component state changed:', {
      activeServer: stableActiveServer ? {
        id: stableActiveServer.id,
        name: stableActiveServer.name
      } : null,
      resourceType,
      searchQuery,
      page,
      location
    });
  }, [stableActiveServer?.id, resourceType, searchQuery, page, location]); // Only log when meaningful changes occur

  const { data: resourceTypes, isLoading: isLoadingResourceTypes } = useQuery<string[]>({
    queryKey: ["/api/fhir/resource-types"],
    // Only fetch resource types when there's an active server
    enabled: !!stableActiveServer,
    staleTime: 5 * 60 * 1000, // 5 minutes - resource types don't change often
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
    queryFn: async () => {
      console.log('[ResourceBrowser] Starting resource types fetch:', {
        url: '/api/fhir/resource-types',
        timestamp: new Date().toISOString()
      });
      
      const startTime = Date.now();
      
      try {
        const response = await fetch('/api/fhir/resource-types');
        const fetchTime = Date.now() - startTime;
        
        console.log('[ResourceBrowser] Resource types response received:', {
          status: response.status,
          statusText: response.statusText,
          fetchTime: `${fetchTime}ms`,
          timestamp: new Date().toISOString()
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ResourceBrowser] Resource types fetch failed:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
            fetchTime: `${fetchTime}ms`,
            timestamp: new Date().toISOString()
          });
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const totalTime = Date.now() - startTime;
        
        console.log('[ResourceBrowser] Resource types data received:', {
          resourceTypeCount: data?.length || 0,
          fetchTime: `${fetchTime}ms`,
          totalTime: `${totalTime}ms`,
          timestamp: new Date().toISOString()
        });
        
        return data;
      } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error('[ResourceBrowser] Resource types fetch error:', {
          error: error instanceof Error ? error.message : String(error),
          fetchTime: `${totalTime}ms`,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }
  });

  const { data: resourcesData, isLoading, error } = useQuery<ResourcesResponse>({
    queryKey: ["/api/fhir/resources", { resourceType, search: searchQuery, page, location }],
    // Only fetch resources when there's an active server
    enabled: !!stableActiveServer,
    staleTime: 30 * 1000, // 30 seconds - resources can change more frequently
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey as [string, { resourceType?: string; search?: string; page: number; location: string }];
      const searchParams = new URLSearchParams();
      
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.page !== undefined) searchParams.set('page', params.page.toString());
      
      const fullUrl = `${url}?${searchParams}`;
      
      console.log('[ResourceBrowser] Starting resource fetch:', {
        url: fullUrl,
        params: {
          resourceType: params?.resourceType || 'all',
          search: params?.search || '',
          page: params?.page || 0,
          location: params?.location || ''
        },
        timestamp: new Date().toISOString()
      });
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(fullUrl);
        const fetchTime = Date.now() - startTime;
        
        console.log('[ResourceBrowser] Fetch response received:', {
          status: response.status,
          statusText: response.statusText,
          fetchTime: `${fetchTime}ms`,
          url: fullUrl,
          timestamp: new Date().toISOString()
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ResourceBrowser] Fetch failed:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
            url: fullUrl,
            fetchTime: `${fetchTime}ms`,
            timestamp: new Date().toISOString()
          });
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const totalTime = Date.now() - startTime;
        
        console.log('[ResourceBrowser] Resource data received:', {
          resourceCount: data.resources?.length || 0,
          totalResources: data.total || 0,
          fetchTime: `${fetchTime}ms`,
          totalTime: `${totalTime}ms`,
          url: fullUrl,
          timestamp: new Date().toISOString()
        });
        
        return data;
      } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error('[ResourceBrowser] Resource fetch error:', {
          error: error instanceof Error ? error.message : String(error),
          fetchTime: `${totalTime}ms`,
          url: fullUrl,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Function to simulate validation progress updates
  const simulateValidationProgress = useCallback((resourceIds: number[]) => {
    const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const totalAspects = aspects.length;
    
    // Initialize progress for all resources
    const initialProgress = new Map<number, any>();
    resourceIds.forEach(id => {
      initialProgress.set(id, {
        resourceId: id,
        progress: 0,
        currentAspect: 'Starting validation...',
        completedAspects: [],
        totalAspects: totalAspects
      });
    });
    setValidationProgress(initialProgress);

    // Simulate progress updates with more realistic timing
    let currentAspectIndex = 0;
    const updateInterval = setInterval(() => {
      setValidationProgress(prev => {
        const updated = new Map(prev);
        let allComplete = true;

        resourceIds.forEach(id => {
          const current = updated.get(id);
          if (current && currentAspectIndex < totalAspects) {
            // More gradual progress increase
            const baseProgress = (currentAspectIndex / totalAspects) * 100;
            const aspectProgress = (1 / totalAspects) * 100;
            const progress = Math.min(baseProgress + (aspectProgress * 0.3), 95); // Cap at 95% until completion
            
            const completedAspects = aspects.slice(0, currentAspectIndex);
            
            updated.set(id, {
              ...current,
              progress: Math.min(progress, 95), // Don't show 100% until actually complete
              currentAspect: currentAspectIndex < totalAspects ? `Validating ${aspects[currentAspectIndex]}...` : 'Completing...',
              completedAspects: completedAspects
            });

            if (currentAspectIndex < totalAspects) {
              allComplete = false;
            }
          }
        });

        if (allComplete) {
          clearInterval(updateInterval);
        }

        return updated;
      });

      currentAspectIndex++;
    }, 800); // Slower updates for more realistic feel

    return updateInterval;
  }, []);

  // Function to validate resources on the current page
  const validateCurrentPage = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) {
      console.log('[ResourceBrowser] No resources to validate');
      return;
    }

    setIsValidating(true);
    
    // Track which resources are being validated
    const resourceIds = resourcesData.resources.map((resource: any) => resource._dbId || resource.id);
    setValidatingResourceIds(new Set(resourceIds));
    
    // Start progress simulation
    const progressInterval = simulateValidationProgress(resourceIds);
    
    try {
      console.log('[ResourceBrowser] Starting validation for current page resources:', {
        resourceCount: resourcesData.resources.length,
        resourceType,
        page
      });

      // Use the validate-by-ids endpoint for more efficient validation
      const response = await fetch('/api/validation/validate-by-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Always send the resources array with database IDs
          resources: resourcesData.resources.map((resource: any) => ({
            ...resource,
            _dbId: resource._dbId || resource.id // Ensure _dbId is available
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('[ResourceBrowser] Validation completed:', {
        validatedCount: result.validatedCount,
        requestedCount: result.requestedCount
      });

      // Mark resources as validated in cache
      if (result.validatedCount > 0) {
        resourcesData.resources.forEach((resource: any) => {
          const cacheKey = `${resource.resourceType}/${resource.id}`;
          validatedResourcesCache.add(cacheKey);
        });
      }

      // Clear the progress simulation and show completion
      clearInterval(progressInterval);
      
      // Show completion state briefly before clearing
      setValidationProgress(prev => {
        const completed = new Map(prev);
        resourceIds.forEach(id => {
          const current = completed.get(id);
          if (current) {
            completed.set(id, {
              ...current,
              progress: 100,
              currentAspect: 'Validation complete'
            });
          }
        });
        return completed;
      });

      // Clear progress after showing completion
      setTimeout(() => {
        setValidationProgress(new Map());
      }, 1500);

      // Invalidate the resource query to refresh with new validation results
      // Add a small delay to ensure validation results are saved to database
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
      }, 1000);

    } catch (error) {
      console.error('[ResourceBrowser] Validation error:', error);
      // Clear progress on error
      clearInterval(progressInterval);
      setValidationProgress(new Map());
      // You could add a toast notification here for user feedback
    } finally {
      setIsValidating(false);
      setValidatingResourceIds(new Set()); // Clear validating state
    }
  }, [resourcesData, resourceType, page, queryClient, simulateValidationProgress]);

  // Function to check if resources need validation and validate them automatically
  const validateUnvalidatedResources = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) {
      return;
    }

    // Don't start validation if already validating
    if (isValidating || validatingResourceIds.size > 0) {
      console.log('[ResourceBrowser] Validation already in progress, skipping');
      return;
    }

    // Check if any resources need validation (only based on database results)
    const unvalidatedResources = resourcesData.resources.filter((resource: any) => {
      const validationSummary = resource._validationSummary;
      
      // Only consider a resource validated if it has actual validation data from the database
      const hasValidationData = validationSummary?.lastValidated;
      
      if (hasValidationData) {
        console.log(`[ResourceBrowser] Resource ${resource.id} already validated (lastValidated: ${validationSummary.lastValidated})`);
      }
      
      return !hasValidationData;
    });

    if (unvalidatedResources.length === 0) {
      console.log('[ResourceBrowser] All resources on current page are already validated');
      // Show a brief notification that all resources are validated
      // This helps users understand why no validation is happening
      return;
    }

    console.log(`[ResourceBrowser] Found ${unvalidatedResources.length} unvalidated resources, starting background validation`);

    // Track which resources are being validated
    const resourceIds = unvalidatedResources.map((resource: any) => resource._dbId || resource.id);
    setValidatingResourceIds(new Set(resourceIds));

    // Start progress simulation for background validation
    const progressInterval = simulateValidationProgress(resourceIds);

    // Use the new validate-by-ids endpoint for more efficient validation
    try {
      const response = await fetch('/api/validation/validate-by-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Always send the resources array with database IDs
          resources: unvalidatedResources.map((resource: any) => ({
            ...resource,
            _dbId: resource._dbId || resource.id // Ensure _dbId is available
          }))
        })
      });

      if (!response.ok) {
        console.warn('[ResourceBrowser] Background validation failed:', response.status, response.statusText);
        clearInterval(progressInterval);
        setValidationProgress(new Map());
        return;
      }

      const result = await response.json();
      
      console.log('[ResourceBrowser] Background validation completed:', {
        validatedCount: result.validatedCount,
        requestedCount: result.requestedCount
      });

      // Only add resources to cache if validation was actually successful
      if (result.validatedCount > 0) {
        console.log(`[ResourceBrowser] Validation completed for ${result.validatedCount} resources`);
        // Mark resources as validated in cache
        unvalidatedResources.forEach((resource: any) => {
          const cacheKey = `${resource.resourceType}/${resource.id}`;
          validatedResourcesCache.add(cacheKey);
        });
      }

      // Clear the progress simulation and show completion
      clearInterval(progressInterval);
      
      // Show completion state briefly before clearing
      setValidationProgress(prev => {
        const completed = new Map(prev);
        resourceIds.forEach(id => {
          const current = completed.get(id);
          if (current) {
            completed.set(id, {
              ...current,
              progress: 100,
              currentAspect: 'Validation complete'
            });
          }
        });
        return completed;
      });

      // Clear progress after showing completion
      setTimeout(() => {
        setValidationProgress(new Map());
      }, 1500);

      // Invalidate the resource query to refresh with new validation results
      // Add a small delay to ensure validation results are saved to database
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
      }, 1000);

    } catch (error) {
      console.warn('[ResourceBrowser] Background validation error:', error);
      clearInterval(progressInterval);
      setValidationProgress(new Map());
      // Don't show error to user for background validation
    } finally {
      setValidatingResourceIds(new Set()); // Clear validating state
    }
  }, [resourcesData, queryClient, simulateValidationProgress]);

  // Reset validation flag when page or resource type changes
  useEffect(() => {
    setHasValidatedCurrentPage(false);
  }, [resourceType, page]);

  // Listen for cache clearing events
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).onCacheCleared) {
      (window as any).onCacheCleared(() => {
        console.log('[ResourceBrowser] Cache cleared event received, forcing revalidation');
        setCacheCleared(true);
        setHasValidatedCurrentPage(false);
        // Force revalidation of current page resources
        if (resourcesData?.resources && resourcesData.resources.length > 0) {
          setTimeout(() => {
            validateCurrentPage();
          }, 100);
        }
      });
    }
  }, [resourcesData?.resources]);

  // Auto-validate resources when they're loaded (controlled from Settings page)
  useEffect(() => {
    if (resourcesData?.resources && resourcesData.resources.length > 0 && !hasValidatedCurrentPage) {
      // Add a small delay to avoid interfering with the initial page load
      const timeoutId = setTimeout(() => {
        validateUnvalidatedResources();
        setHasValidatedCurrentPage(true);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [resourcesData?.resources?.length, resourceType, page, hasValidatedCurrentPage]); // Remove validateUnvalidatedResources from deps to prevent loop

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <ResourceSearch 
              resourceTypes={resourceTypes || []}
              onSearch={handleSearch}
              defaultResourceType={resourceType}
              defaultQuery={searchQuery}
            />
          </div>
          
          {/* Validation Controls */}
          {resourcesData?.resources && resourcesData.resources.length > 0 && (
            <div className="flex items-center space-x-4 lg:ml-4">
              {/* Validation Status Indicator */}
              {(() => {
                const totalResources = resourcesData.resources.length;
                const validatedResources = resourcesData.resources.filter((resource: any) => 
                  resource._validationSummary?.lastValidated
                ).length;
                const unvalidatedResources = totalResources - validatedResources;
                
                return (
                  <div className="text-sm text-muted-foreground">
                    {validatedResources > 0 && (
                      <span className="text-green-600">
                        {validatedResources} validated
                      </span>
                    )}
                    {validatedResources > 0 && unvalidatedResources > 0 && (
                      <span className="mx-2">•</span>
                    )}
                    {unvalidatedResources > 0 && (
                      <span className="text-orange-600">
                        {unvalidatedResources} need validation
                      </span>
                    )}
                    {validatedResources === totalResources && unvalidatedResources === 0 && (
                      <span className="text-green-600">
                        All {totalResources} validated
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Manual Validation Button */}
              <Button
                onClick={validateCurrentPage}
                disabled={isValidating}
                variant="outline"
                size="sm"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Revalidate
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <ResourceList 
            resources={resourcesData?.resources || []}
            total={resourcesData?.total || 0}
            page={page}
            onPageChange={handlePageChange}
            validatingResourceIds={validatingResourceIds}
            validationProgress={validationProgress}
            availableResourceTypes={resourcesData?.availableResourceTypes}
            noResourceTypeMessage={resourcesData?.message}
          />
        )}
      </div>
    </div>
  );
}
