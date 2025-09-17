import { useState, useEffect, useCallback } from "react";
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

  const { activeServer } = useServerData();

  const { data: resourceTypes } = useQuery<string[]>({
    queryKey: ["/api/fhir/resource-types"],
    // Only fetch resource types when there's an active server
    enabled: !!activeServer,
  });

  const { data: resourcesData, isLoading } = useQuery<ResourcesResponse>({
    queryKey: ["/api/fhir/resources", { resourceType, search: searchQuery, page, location }],
    // Only fetch resources when there's an active server
    enabled: !!activeServer,
    queryFn: ({ queryKey }) => {
      const [url, params] = queryKey as [string, { resourceType?: string; search?: string; page: number; location: string }];
      const searchParams = new URLSearchParams();
      
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.page !== undefined) searchParams.set('page', params.page.toString());
      
      const fullUrl = `${url}?${searchParams}`;
      
      return fetch(fullUrl).then(res => res.json());
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