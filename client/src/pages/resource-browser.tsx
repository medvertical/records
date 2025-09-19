import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useServerData } from "@/hooks/use-server-data";
import ResourceSearch from "@/components/resources/resource-search";
import ResourceList from "@/components/resources/resource-list";
import { Skeleton } from "@/components/ui/skeleton";

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
  const queryClient = useQueryClient();



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

  // Get active server with minimal re-renders - use local state instead of hook
  const [stableActiveServer, setStableActiveServer] = useState<any>(null);
  
  // Fetch active server once on mount and when location changes
  useEffect(() => {
    const fetchActiveServer = async () => {
      try {
        const response = await fetch('/api/fhir/servers');
        if (response.ok) {
          const servers = await response.json();
          const activeServer = servers.find((server: any) => server.isActive);
          setStableActiveServer(activeServer);
        }
      } catch (error) {
        console.error('Failed to fetch active server:', error);
      }
    };
    
    fetchActiveServer();
  }, [location]); // Only refetch when location changes

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
    },
    onSuccess: (data) => {
      console.log('[ResourceBrowser] Resource types query success:', {
        resourceTypeCount: data?.length || 0,
        timestamp: new Date().toISOString()
      });
    },
    onError: (error) => {
      console.error('[ResourceBrowser] Resource types query error:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
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
    },
    onSuccess: (data) => {
      console.log('[ResourceBrowser] Query success:', {
        resourceCount: data.resources?.length || 0,
        totalResources: data.total || 0,
        timestamp: new Date().toISOString()
      });
    },
    onError: (error) => {
      console.error('[ResourceBrowser] Query error:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="space-y-6">
        <ResourceSearch 
          resourceTypes={resourceTypes || []}
          onSearch={handleSearch}
          defaultResourceType={resourceType}
          defaultQuery={searchQuery}
        />

        
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
          />
        )}
      </div>
    </div>
  );
}