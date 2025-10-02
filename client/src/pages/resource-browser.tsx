import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useServerData } from "@/hooks/use-server-data";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import ResourceSearch from "@/components/resources/resource-search";
import ResourceList from "@/components/resources/resource-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Play, Settings, TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  const [validationDebounceTimer, setValidationDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Use validation settings polling to detect changes and refresh resource list
  const { lastChange, isPolling, error: pollingError } = useValidationSettingsPolling({
    pollingInterval: 60000, // Poll every 60 seconds (reduced frequency)
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
      // Clear validation cache to force revalidation with new settings
      validatedResourcesCache.clear();
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
    // Only fetch resources when there's an active server (resourceType can be empty for "all types")
    enabled: !!stableActiveServer,
    staleTime: 2 * 60 * 1000, // 2 minutes - resources don't change that frequently
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache longer
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data is fresh
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
            // More gradual progress increase with better distribution
            const baseProgress = (currentAspectIndex / totalAspects) * 100;
            const aspectProgress = (1 / totalAspects) * 100;
            // Don't cap at 95% - let it go to 99% and stay there until completion
            const progress = Math.min(baseProgress + (aspectProgress * 0.4), 99);
            
            const completedAspects = aspects.slice(0, currentAspectIndex);
            
            updated.set(id, {
              ...current,
              progress: Math.min(progress, 99), // Don't show 100% until actually complete
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
    }, 600); // Faster updates to prevent hanging

    // Don't timeout the progress simulation - let the actual validation control completion
    // The progress simulation will continue until validation actually completes or fails

    // Return cleanup function
    return () => {
      clearInterval(updateInterval);
    };
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
    const progressCleanup = simulateValidationProgress(resourceIds);
    
    try {
      console.log('[ResourceBrowser] Starting validation for current page resources:', {
        resourceCount: resourcesData.resources.length,
        resourceType,
        page
      });

      // Batch validation requests to avoid payload size limits
      const batchSize = 10; // Process 10 resources per batch
      const allResults = [];
      const totalBatches = Math.ceil(resourcesData.resources.length / batchSize);
      
      for (let i = 0; i < resourcesData.resources.length; i += batchSize) {
        const batch = resourcesData.resources.slice(i, i + batchSize);
        const batchNumber = Math.floor(i/batchSize) + 1;
        console.log(`[ResourceBrowser] Processing validation batch ${batchNumber}/${totalBatches} (${batch.length} resources)`);
        
        // Update progress to show current batch being processed
        setValidationProgress(prev => {
          const updated = new Map(prev);
          resourceIds.forEach(id => {
            const current = updated.get(id);
            if (current) {
              const batchProgress = (batchNumber / totalBatches) * 100;
              updated.set(id, {
                ...current,
                progress: Math.min(batchProgress, 99),
                currentAspect: `Processing batch ${batchNumber}/${totalBatches}...`
              });
            }
          });
          return updated;
        });
        
        // Create a timeout promise for the fetch request
        const fetchWithTimeout = (url: string, options: any, timeoutMs: number = 120000) => {
          return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);
        };

        const response = await fetchWithTimeout('/api/validation/validate-by-ids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Always send the resources array with database IDs
            resources: batch.map((resource: any) => ({
              ...resource,
              _dbId: resource._dbId || resource.id // Ensure _dbId is available
            }))
          })
        }, 120000); // 2 minute timeout per batch

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ResourceBrowser] Validation batch failed: ${response.status} ${response.statusText}`, errorText);
          // Continue with other batches even if one fails
          continue;
        }

        const batchResult = await response.json();
        console.log(`[ResourceBrowser] Validation batch ${batchNumber} completed:`, {
          success: batchResult.success,
          validatedCount: batchResult.validatedCount,
          requestedCount: batchResult.requestedCount
        });
        allResults.push(...(batchResult.detailedResults || []));
      }

      // Combine all batch results
      const result = {
        success: true,
        validatedCount: allResults.length,
        requestedCount: resourcesData.resources.length,
        message: `Successfully validated ${allResults.length} out of ${resourcesData.resources.length} resources`,
        detailedResults: allResults
      };
      
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
      if (progressCleanup) {
        progressCleanup();
      }
      
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
      if (progressCleanup) {
        progressCleanup();
      }
      setValidationProgress(new Map());
      // You could add a toast notification here for user feedback
    } finally {
      setIsValidating(false);
      setValidatingResourceIds(new Set()); // Clear validating state
    }
  }, [resourcesData, resourceType, page, queryClient, simulateValidationProgress]);

  // Debounced validation function to prevent rapid successive calls
  const debouncedValidateUnvalidatedResources = useCallback((delay: number = 1000) => {
    // Clear existing timer
    if (validationDebounceTimer) {
      clearTimeout(validationDebounceTimer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      validateUnvalidatedResources();
    }, delay);
    
    setValidationDebounceTimer(timer);
  }, [validationDebounceTimer]);

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
        // Check if validation is recent enough (within last 5 minutes)
        const lastValidated = new Date(validationSummary.lastValidated);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isRecent = lastValidated > fiveMinutesAgo;
        
        if (isRecent) {
          console.log(`[ResourceBrowser] Resource ${resource.id} recently validated (${validationSummary.lastValidated}), skipping`);
          return false;
        } else {
          console.log(`[ResourceBrowser] Resource ${resource.id} validation is stale (${validationSummary.lastValidated}), needs revalidation`);
          return true;
        }
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
    const progressCleanup = simulateValidationProgress(resourceIds);

    // Use the new validate-by-ids endpoint with batching for background validation
    try {
      // Batch background validation requests to avoid payload size limits
      const batchSize = 10; // Process 10 resources per batch
      const allResults = [];
      
      for (let i = 0; i < unvalidatedResources.length; i += batchSize) {
        const batch = unvalidatedResources.slice(i, i + batchSize);
        console.log(`[ResourceBrowser] Processing background validation batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(unvalidatedResources.length/batchSize)} (${batch.length} resources)`);
        
        const response = await fetch('/api/validation/validate-by-ids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Always send the resources array with database IDs
            resources: batch.map((resource: any) => ({
              ...resource,
              _dbId: resource._dbId || resource.id // Ensure _dbId is available
            }))
          })
        });

        if (!response.ok) {
          console.warn(`[ResourceBrowser] Background validation batch failed: ${response.status} ${response.statusText}`);
          // Continue with other batches even if one fails
          continue;
        }

        const batchResult = await response.json();
        allResults.push(...(batchResult.detailedResults || []));
      }

      // Combine all batch results
      const result = {
        success: true,
        validatedCount: allResults.length,
        requestedCount: unvalidatedResources.length,
        message: `Successfully validated ${allResults.length} out of ${unvalidatedResources.length} resources`,
        detailedResults: allResults
      };
      
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
      if (progressCleanup) {
        progressCleanup();
      }
      
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
      if (progressCleanup) {
        progressCleanup();
      }
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

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (validationDebounceTimer) {
        clearTimeout(validationDebounceTimer);
      }
    };
  }, [validationDebounceTimer]);

  // Auto-validate resources when they're loaded (controlled from Settings page)
  useEffect(() => {
    if (resourcesData?.resources && resourcesData.resources.length > 0 && !hasValidatedCurrentPage) {
      // Use debounced validation to prevent rapid successive calls
      debouncedValidateUnvalidatedResources(1500); // 1.5 second delay
      setHasValidatedCurrentPage(true);
    }
  }, [resourcesData?.resources?.length, resourceType, page, hasValidatedCurrentPage, debouncedValidateUnvalidatedResources]);

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
              {/* Enhanced Validation Summary */}
              {(() => {
                const totalResources = resourcesData.resources.length;
                const validatedResources = resourcesData.resources.filter((resource: any) => 
                  resource._validationSummary?.lastValidated
                );
                const unvalidatedResources = totalResources - validatedResources.length;
                
                // Calculate detailed statistics from validation results
                let totalErrors = 0;
                let totalWarnings = 0;
                let totalInformation = 0;
                let validResources = 0;
                let averageScore = 0;
                
                // Aspect breakdown statistics (using server-side normalized keys)
                const aspectStats = {
                  structural: { errors: 0, warnings: 0, info: 0, total: 0, score: 0 },
                  profile: { errors: 0, warnings: 0, info: 0, total: 0, score: 0 },
                  terminology: { errors: 0, warnings: 0, info: 0, total: 0, score: 0 },
                  reference: { errors: 0, warnings: 0, info: 0, total: 0, score: 0 },
                  'business-rule': { errors: 0, warnings: 0, info: 0, total: 0, score: 0 },
                  metadata: { errors: 0, warnings: 0, info: 0, total: 0, score: 0 }
                };
                
                validatedResources.forEach((resource: any) => {
                  const summary = resource._validationSummary;
                  if (summary) {
                    // Aggregate total counts with null safety
                    totalErrors += summary.errorCount || 0;
                    totalWarnings += summary.warningCount || 0;
                    totalInformation += summary.informationCount || 0;
                    
                    // Count valid resources (no errors or warnings)
                    if (summary.isValid && !summary.hasErrors && !summary.hasWarnings) {
                      validResources++;
                    }
                    
                    // Aggregate validation scores
                    averageScore += summary.validationScore || 0;
                    
                    // Aggregate aspect breakdown statistics with enhanced error handling
                    if (summary.aspectBreakdown && typeof summary.aspectBreakdown === 'object') {
                      Object.keys(aspectStats).forEach(aspect => {
                        const aspectData = summary.aspectBreakdown[aspect];
                        if (aspectData && typeof aspectData === 'object') {
                          // Ensure counts are numbers and handle null/undefined
                          aspectStats[aspect].errors += Number(aspectData.errorCount) || 0;
                          aspectStats[aspect].warnings += Number(aspectData.warningCount) || 0;
                          aspectStats[aspect].info += Number(aspectData.informationCount) || 0;
                          aspectStats[aspect].total += 1;
                          aspectStats[aspect].score += Number(aspectData.validationScore) || 0;
                        }
                      });
                    }
                  }
                });
                
                averageScore = validatedResources.length > 0 ? Math.round(averageScore / validatedResources.length) : 0;
                
                // Calculate overall trend based on validation quality
                const totalIssues = totalErrors + totalWarnings + totalInformation;
                const avgIssuesPerResource = validatedResources.length > 0 ? totalIssues / validatedResources.length : 0;
                const overallTrend = avgIssuesPerResource === 0 ? 'excellent' : 
                                   avgIssuesPerResource <= 1 ? 'good' : 
                                   avgIssuesPerResource <= 3 ? 'stable' : 'declining';
                
                // Additional statistics
                const invalidResources = validatedResources.length - validResources;
                const validationCoverage = totalResources > 0 ? Math.round((validatedResources.length / totalResources) * 100) : 0;
                
                // Calculate average aspect scores and trends
                Object.keys(aspectStats).forEach(aspect => {
                  if (aspectStats[aspect].total > 0) {
                    aspectStats[aspect].score = Math.round(aspectStats[aspect].score / aspectStats[aspect].total);
                    
                    // Simple trend calculation based on issue counts
                    // More issues = declining trend, fewer issues = improving trend
                    const totalIssues = aspectStats[aspect].errors + aspectStats[aspect].warnings + aspectStats[aspect].info;
                    const avgIssuesPerResource = totalIssues / aspectStats[aspect].total;
                    
                    if (avgIssuesPerResource === 0) {
                      aspectStats[aspect].trend = 'excellent';
                    } else if (avgIssuesPerResource <= 1) {
                      aspectStats[aspect].trend = 'good';
                    } else if (avgIssuesPerResource <= 3) {
                      aspectStats[aspect].trend = 'stable';
                    } else {
                      aspectStats[aspect].trend = 'declining';
                    }
                  }
                });
                
                return (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {/* Resource Count Summary */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{totalResources} total</span>
                      {validatedResources.length > 0 && (
                        <>
                          <span className="text-green-600">
                            {validatedResources.length} validated
                          </span>
                          {unvalidatedResources > 0 && (
                            <span className="text-orange-600">
                              • {unvalidatedResources} pending
                            </span>
                          )}
                          <span className="text-gray-500">
                            ({validationCoverage}% coverage)
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* Validation Quality Summary */}
                    {validatedResources.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-green-600">
                            ✓ {validResources} valid
                          </span>
                          {invalidResources > 0 && (
                            <span className="text-red-600">
                              ✗ {invalidResources} invalid
                            </span>
                          )}
                          {totalErrors > 0 && (
                            <span className="text-red-600">
                              ⚠ {totalErrors} errors
                            </span>
                          )}
                          {totalWarnings > 0 && (
                            <span className="text-yellow-600">
                              ⚡ {totalWarnings} warnings
                            </span>
                          )}
                          {totalInformation > 0 && (
                            <span className="text-blue-600">
                              ℹ {totalInformation} info
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            {overallTrend === 'excellent' && <TrendingUp className="h-3 w-3 text-green-500" />}
                            {overallTrend === 'good' && <TrendingUp className="h-3 w-3 text-green-400" />}
                            {overallTrend === 'stable' && <Minus className="h-3 w-3 text-gray-400" />}
                            {overallTrend === 'declining' && <TrendingDown className="h-3 w-3 text-red-400" />}
                            <span className="text-gray-600">
                              Avg: {averageScore}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Aspect Breakdown */}
                        {validatedResources.length > 0 && (
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(aspectStats).map(([aspect, stats]) => {
                              if (stats.total === 0) return null;
                              const aspectName = aspect.replace(/-/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, str => str.toUpperCase());
                              const hasIssues = stats.errors > 0 || stats.warnings > 0;
                              const scoreColor = stats.score >= 90 ? 'text-green-600' : stats.score >= 70 ? 'text-yellow-600' : 'text-red-600';
                              
                              // Trend indicator
                              const getTrendIcon = (trend: string) => {
                                switch (trend) {
                                  case 'excellent': return <TrendingUp className="h-3 w-3 text-green-500" />;
                                  case 'good': return <TrendingUp className="h-3 w-3 text-green-400" />;
                                  case 'stable': return <Minus className="h-3 w-3 text-gray-400" />;
                                  case 'declining': return <TrendingDown className="h-3 w-3 text-red-400" />;
                                  default: return <Minus className="h-3 w-3 text-gray-400" />;
                                }
                              };
                              
                              const getTrendColor = (trend: string) => {
                                switch (trend) {
                                  case 'excellent': return 'text-green-600';
                                  case 'good': return 'text-green-500';
                                  case 'stable': return 'text-gray-500';
                                  case 'declining': return 'text-red-500';
                                  default: return 'text-gray-500';
                                }
                              };
                              
                              return (
                                <Tooltip key={aspect}>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between cursor-help">
                                      <span className="text-gray-600">{aspectName}:</span>
                                      <div className="flex items-center gap-1">
                                        {getTrendIcon(stats.trend)}
                                        <span className={scoreColor}>{stats.score}%</span>
                                        {hasIssues && (
                                          <span className="text-gray-400">
                                            ({stats.errors > 0 && `${stats.errors}E`}{stats.warnings > 0 && `${stats.warnings}W`})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="font-medium">{aspectName} Validation</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">Score: {stats.score}%</span>
                                        <span className={`text-xs ${getTrendColor(stats.trend)}`}>
                                          ({stats.trend})
                                        </span>
                                      </div>
                                      {stats.errors > 0 && <p className="text-sm text-red-500">Errors: {stats.errors}</p>}
                                      {stats.warnings > 0 && <p className="text-sm text-yellow-500">Warnings: {stats.warnings}</p>}
                                      {stats.info > 0 && <p className="text-sm text-blue-500">Info: {stats.info}</p>}
                                      <p className="text-xs text-gray-400">Resources: {stats.total}</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(i => (
              <div key={i} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {/* Resource type icon skeleton */}
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    
                    {/* Resource details skeleton */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-16" /> {/* Resource type */}
                        <Skeleton className="h-4 w-20" /> {/* Resource ID */}
                      </div>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-48" /> {/* Resource name/description */}
                        <Skeleton className="h-3 w-32" /> {/* Last updated */}
                      </div>
                    </div>
                  </div>
                  
                  {/* Validation status skeleton */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" /> {/* Validation badge */}
                      <Skeleton className="h-8 w-8 rounded-full" /> {/* Progress circle */}
                    </div>
                    <Skeleton className="h-4 w-4" /> {/* Chevron */}
                  </div>
                </div>
              </div>
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
            isLoading={isLoading}
            noResourceTypeMessage={resourcesData?.message}
          />
        )}
      </div>
    </div>
  );
}
