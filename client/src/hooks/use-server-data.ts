import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';

interface FhirServer {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
  hasAuth?: boolean;
  authType?: string;
  createdAt: string;
}

export interface ServerStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

// Global refresh trigger for server data
let globalRefreshTrigger = 0;

export function useServerData() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const queryClient = useQueryClient();

  const { data: servers, isLoading, error } = useQuery<FhirServer[]>({
    queryKey: ["/api/fhir/servers", refreshTrigger],
    queryFn: async () => {
      const response = await fetch('/api/fhir/servers');
      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    // Don't keep previous data to ensure UI updates immediately when server status changes
    keepPreviousData: false,
    // Ensure data is always considered fresh to prevent stale data issues
    staleTime: 0,
    onSuccess: (data) => {
      console.log('Server data fetched:', data);
    },
    onError: (error) => {
      console.error('Server data fetch error:', error);
    }
  });

  const activeServer = servers?.find(server => server.isActive);
  
  const { data: serverStatus } = useQuery<ServerStatus>({
    queryKey: ["/api/fhir/connection/test", refreshTrigger],
    queryFn: async () => {
      try {
        const response = await fetch('/api/fhir/connection/test');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errorMessage = (data as ServerStatus)?.error || (data as any)?.message || 'Unable to connect to server';
          return {
            connected: false,
            error: errorMessage
          };
        }
        return {
          connected: Boolean((data as ServerStatus).connected),
          version: (data as ServerStatus).version,
          error: (data as ServerStatus).error
        };
      } catch (error: any) {
        return {
          connected: false,
          error: error?.message || 'Unable to connect to server'
        };
      }
    },
    refetchInterval: 30000,
    // Don't keep previous data to ensure UI updates immediately when server status changes
    keepPreviousData: false,
    staleTime: 0,
    // Only fetch server status when there's an active server
    enabled: !!activeServer,
    retry: false
  });

  const refreshServerData = useCallback(() => {
    console.log('Refreshing server data...');
    globalRefreshTrigger++;
    setRefreshTrigger(globalRefreshTrigger);
    
    // Only refetch server-related queries, not server-dependent queries
    queryClient.refetchQueries({ 
      predicate: (query) => 
        query.queryKey[0] === "/api/fhir/servers"
    });
    
    // Invalidate server-dependent queries so they can be re-enabled/disabled based on new server state
    queryClient.invalidateQueries({
      predicate: (query) => 
        query.queryKey[0] === "/api/fhir/connection/test" ||
        query.queryKey[0] === "/api/fhir/resource-counts" ||
        query.queryKey[0] === "/api/fhir/resources" ||
        query.queryKey[0] === "/api/fhir/resource-types" ||
        query.queryKey[0] === "/api/dashboard/stats" ||
        query.queryKey[0] === "/api/validation/bulk/summary"
    });
  }, [queryClient]);

  // Invalidate cache when activeServer changes to ensure immediate UI updates
  useEffect(() => {
    if (servers) {
      const hasActiveServer = servers.some(server => server.isActive);
      if (!hasActiveServer) {
        // Clear all cached data when no server is active
        queryClient.invalidateQueries({
          predicate: (query) => 
            query.queryKey[0] === "/api/fhir/resource-counts" ||
            query.queryKey[0] === "/api/dashboard/stats" ||
            query.queryKey[0] === "/api/validation/bulk/summary"
        });
      }
    }
  }, [servers, queryClient]);

  return {
    servers,
    serverStatus,
    activeServer,
    isLoading,
    error,
    refreshServerData
  };
}
