import { useState, useEffect } from "react";
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

  // Parse URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    const searchParam = urlParams.get('search');
    
    if (typeParam) {
      setResourceType(typeParam);
    }
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [location]);

  // WebSocket connection for real-time validation updates
  useEffect(() => {
    // Temporarily disable WebSocket to prevent connection errors
    console.log('[Resource Browser] WebSocket temporarily disabled');
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
    queryKey: ["/api/fhir/resources", { resourceType, search: searchQuery, page }],
    queryFn: ({ queryKey }) => {
      const [url, params] = queryKey as [string, { resourceType?: string; search?: string; page: number }];
      const searchParams = new URLSearchParams();
      
      if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.page !== undefined) searchParams.set('page', params.page.toString());
      
      return fetch(`${url}?${searchParams}`).then(res => res.json());
    },
  });

  const handleSearch = (query: string, type: string) => {
    setSearchQuery(query);
    setResourceType(type);
    setPage(0);
  };

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