import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerData } from './use-server-data';

/**
 * Hook to ensure React Query cache is invalidated and refetched when the active server changes
 * 
 * This implements the per-server cache namespacing strategy:
 * - All query keys should include serverId
 * - When server changes, invalidate all queries with the old serverId
 * - Automatically refetch queries with the new serverId
 */
export function useServerReactiveQueries() {
  const queryClient = useQueryClient();
  const { activeServer } = useServerData();
  const previousServerIdRef = useRef<number | undefined>(activeServer?.id);

  useEffect(() => {
    const currentServerId = activeServer?.id;
    const previousServerId = previousServerIdRef.current;

    // If server changed, invalidate and refetch
    if (currentServerId !== undefined && previousServerId !== undefined && currentServerId !== previousServerId) {
      console.log(`[ServerReactiveQueries] Active server changed from ${previousServerId} to ${currentServerId}`);
      
      // Invalidate all validation-related queries
      // These queries should all have serverId in their queryKey
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          // Check if query key includes validation endpoints or the old server ID
          return (
            queryKey.includes('/api/validation/issues/groups') ||
            queryKey.includes('/api/validation/resources') ||
            queryKey.includes('/api/fhir/resources') ||
            queryKey.includes(previousServerId)
          );
        },
      });

      // Immediately refetch queries for the new server
      queryClient.refetchQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            queryKey.includes('/api/validation/issues/groups') ||
            queryKey.includes('/api/validation/resources') ||
            queryKey.includes('/api/fhir/resources')
          );
        },
      });

      console.log('[ServerReactiveQueries] Cache invalidated and queries refetched for new server');
    }

    // Update ref for next comparison
    previousServerIdRef.current = currentServerId;
  }, [activeServer?.id, queryClient]);

  return {
    serverId: activeServer?.id,
    serverName: activeServer?.name,
    serverUrl: activeServer?.url,
  };
}

/**
 * Hook to get the current active server ID for use in query keys
 * Ensures all queries are properly namespaced by server
 */
export function useActiveServerId(): number | undefined {
  const { activeServer } = useServerData();
  return activeServer?.id;
}

/**
 * Hook to create a server-namespaced query key
 * Example: useServerQueryKey('/api/validation/issues/groups', filters)
 * Returns: ['/api/validation/issues/groups', serverId, ...filters]
 */
export function useServerQueryKey(baseKey: string, ...additionalKeys: any[]): any[] {
  const serverId = useActiveServerId();
  return [baseKey, serverId, ...additionalKeys];
}
