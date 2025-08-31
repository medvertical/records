import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  }, []);

  // Parse URL parameters and update state when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    const searchParam = urlParams.get('search');
    
    // Update state directly - this will trigger the query to re-run
    setResourceType(typeParam || "");
    setSearchQuery(searchParam || "");
    setPage(0); // Reset to first page when navigating
  }, [location]);

  // Additional effect to monitor URL changes more frequently
  useEffect(() => {
    const interval = setInterval(() => {
      const currentSearch = window.location.search;
      const urlParams = new URLSearchParams(currentSearch);
      const typeParam = urlParams.get('type');
      
      // Only update if the type parameter is different from current state
      if (typeParam !== resourceType && (typeParam || resourceType)) {
        setResourceType(typeParam || "");
        setPage(0);
      }
    }, 500); // Check every 500ms
    
    return () => clearInterval(interval);
  }, [resourceType]);



  // Listen for validation settings changes to invalidate resource cache
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
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

    // Add event listener for WebSocket messages
    const ws = (window as any).validationWebSocket;
    if (ws) {
      ws.addEventListener('message', handleWebSocketMessage);
      return () => ws.removeEventListener('message', handleWebSocketMessage);
    }
  }, [queryClient]);

  // WebSocket connection for real-time validation updates
  useEffect(() => {
    // Temporarily disable WebSocket to prevent connection errors
    return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || 'localhost:3000';
    const wsUrl = `${protocol}//${host}/ws`;

    console.log('[Resource Browser] Connecting to WebSocket for validation updates:', wsUrl);
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('[Resource Browser] WebSocket connected for validation updates');
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ValidationUpdateMessage;
        
        if (message.type === 'resource_validation_updated') {
          console.log('[Resource Browser] Received validation update for resource:', message.fhirResourceId);
          
          // Update the cached resource data with new validation summary
          const queryKey = ["/api/fhir/resources", { resourceType, search: searchQuery, page }];
          queryClient.setQueryData(queryKey, (oldData: ResourcesResponse | undefined) => {
            if (!oldData) return oldData;
            
            return {
              ...oldData,
              resources: oldData.resources.map(resource => {
                if (resource._dbId === message.resourceId) {
                  return {
                    ...resource,
                    _validationSummary: {
                      ...message.validationSummary,
                      needsValidation: false // Clear the validation pending flag
                    }
                  };
                }
                return resource;
              })
            };
          });
        }
      } catch (error) {
        console.warn('[Resource Browser] Failed to parse WebSocket message:', error);
      }
    };
    
    socket.onclose = () => {
      console.log('[Resource Browser] WebSocket disconnected');
    };
    
    socket.onerror = (error) => {
      console.error('[Resource Browser] WebSocket error:', error);
    };
    
    return () => {
      socket.close();
    };
  }, [queryClient, resourceType, searchQuery, page]);

  const { data: resourceTypes } = useQuery<string[]>({
    queryKey: ["/api/fhir/resource-types"],
  });



  const { data: resourcesData, isLoading } = useQuery<ResourcesResponse>({
    queryKey: ["/api/fhir/resources", { resourceType, search: searchQuery, page, location }],
    queryFn: ({ queryKey }) => {
      const [url, params] = queryKey as [string, { resourceType?: string; search?: string; page: number; location: string }];
      const searchParams = new URLSearchParams();
      
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.page !== undefined) searchParams.set('page', params.page.toString());
      
      const fullUrl = `${url}?${searchParams}`;
      
      return fetch(fullUrl).then(res => res.json());
    },
    enabled: true, // Explicitly enable the query
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