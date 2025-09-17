import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

interface FhirServer {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
  hasAuth?: boolean;
  authType?: string;
  createdAt: string;
}

// Global refresh trigger for server data
let globalRefreshTrigger = 0;

export function useServerData() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const queryClient = useQueryClient();

  const { data: servers, isLoading, error } = useQuery<FhirServer[]>({
    queryKey: ["/api/fhir/servers", refreshTrigger],
    refetchInterval: 60000, // Refresh every minute
    // Keep previous data during refetch to prevent flashing
    keepPreviousData: true,
    // Ensure data is always considered fresh to prevent stale data issues
    staleTime: 0,
    onSuccess: (data) => {
      console.log('Server data fetched:', data);
    },
    onError: (error) => {
      console.error('Server data fetch error:', error);
    }
  });

  const { data: serverStatus } = useQuery({
    queryKey: ["/api/fhir/connection/test", refreshTrigger],
    queryFn: async () => {
      const response = await fetch('/api/fhir/connection/test');
      if (!response.ok) {
        throw new Error('Failed to fetch server status');
      }
      return response.json();
    },
    refetchInterval: 30000,
    // Keep previous data during refetch to prevent flashing
    keepPreviousData: true,
    staleTime: 0,
  });

  const refreshServerData = useCallback(() => {
    console.log('Refreshing server data...');
    globalRefreshTrigger++;
    setRefreshTrigger(globalRefreshTrigger);
    
    // Use refetchQueries instead of invalidateQueries to prevent data flashing
    // This keeps the existing data visible while fetching new data in the background
    queryClient.refetchQueries({ 
      predicate: (query) => 
        query.queryKey[0] === "/api/fhir/servers" || 
        query.queryKey[0] === "/api/fhir/connection/test" ||
        query.queryKey[0] === "/api/fhir/resource-counts" ||
        query.queryKey[0] === "/api/fhir/resources" ||
        query.queryKey[0] === "/api/fhir/resource-types" ||
        query.queryKey[0] === "/api/dashboard/stats" ||
        query.queryKey[0] === "/api/validation/bulk/summary"
    });
  }, [queryClient]);

  const activeServer = servers?.find(server => server.isActive);

  return {
    servers,
    serverStatus,
    activeServer,
    isLoading,
    error,
    refreshServerData
  };
}
