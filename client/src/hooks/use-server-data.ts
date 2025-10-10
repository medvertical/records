import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useMemo } from 'react';

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
    refetchInterval: false, // Disable automatic polling
    refetchOnWindowFocus: false,
    // Keep previous data visible during refetches to prevent UI flickering
    placeholderData: (previousData) => previousData,
    // Consider data fresh for 2 minutes to reduce unnecessary refetches
    staleTime: 120000
  });

  const activeServer = useMemo(() => servers?.find(server => server.isActive), [servers]);
  
  // Connection test query - Auto-connect when there's an active server
  const { data: serverStatus, isLoading: isConnectionLoading } = useQuery<ServerStatus | undefined>({
    queryKey: ["/api/fhir/connection/test", refreshTrigger, activeServer?.id],
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
    refetchInterval: false, // Disable automatic polling
    refetchOnWindowFocus: false, // Don't refetch on window focus
    // Keep previous data visible during refetches
    placeholderData: (previousData) => previousData,
    staleTime: 10 * 60 * 1000, // 10 minutes - only refresh manually
    // Auto-connect when there's an active server
    enabled: !!activeServer,
    retry: 1 // Allow one retry for failed connections
  });

  const refreshServerData = useCallback(() => {
    console.log('Refreshing server data...');
    globalRefreshTrigger++;
    setRefreshTrigger(globalRefreshTrigger);
    
    // Refetch both server list and connection test queries
    queryClient.refetchQueries({ 
      predicate: (query) => 
        query.queryKey[0] === "/api/fhir/servers" ||
        query.queryKey[0] === "/api/fhir/connection/test"
    });
    
    // Only invalidate queries that need to be re-enabled/disabled based on server state
    // Don't invalidate resource-counts as they are cached for 10 minutes
    queryClient.invalidateQueries({
      predicate: (query) => 
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
        // Clear cached data when no server is active (but keep resource-counts cached)
        queryClient.invalidateQueries({
          predicate: (query) => 
            query.queryKey[0] === "/api/dashboard/stats" ||
            query.queryKey[0] === "/api/validation/bulk/summary"
        });
      } else {
        // When there is an active server, ensure connection test is fresh
        queryClient.invalidateQueries({
          predicate: (query) => 
            query.queryKey[0] === "/api/fhir/connection/test"
        });
      }
    }
  }, [servers, queryClient]);

  // Additional effect to ensure server status is refreshed when activeServer changes
  useEffect(() => {
    if (activeServer) {
      // Force refresh of connection test when active server changes
      queryClient.refetchQueries({
        predicate: (query) => 
          query.queryKey[0] === "/api/fhir/connection/test"
      });
    }
  }, [activeServer?.id, queryClient]);

  return {
    servers,
    serverStatus,
    activeServer,
    isLoading,
    isConnectionLoading,
    error,
    refreshServerData
  };
}
