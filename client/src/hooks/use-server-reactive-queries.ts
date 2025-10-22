import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerData } from './use-server-data';

/**
 * Hook to ensure React Query cache is invalidated when the active server changes
 * 
 * This implements the per-server cache namespacing strategy:
 * - All query keys should include serverId
 * - When server changes, invalidate all queries with the old serverId
 * - Queries will automatically refetch when components use them (respects staleTime and enabled flags)
 */
export function useServerReactiveQueries() {
  const queryClient = useQueryClient();
  const { activeServer } = useServerData();
  const previousServerIdRef = useRef<number | undefined>();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const currentServerId = activeServer?.id;
    const previousServerId = previousServerIdRef.current;

    // Initialize on first run when we have a server
    if (!isInitializedRef.current && currentServerId !== undefined) {
      isInitializedRef.current = true;
      previousServerIdRef.current = currentServerId;
      console.log(`[ServerReactiveQueries] Initialized with server ID: ${currentServerId}`);
      return;
    }

    // If server changed, invalidate queries (they'll refetch naturally when components need them)
    if (isInitializedRef.current && currentServerId !== undefined && previousServerId !== undefined && currentServerId !== previousServerId) {
      console.log(`[ServerReactiveQueries] Active server changed from ${previousServerId} to ${currentServerId}`);
      
      // Invalidate resource counts when server changes
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/resource-counts'] });
      queryClient.invalidateQueries({ queryKey: ['quickAccessCounts'] });
      
      // Then invalidate all validation-related queries with predicate
      // These queries should all have serverId in their queryKey
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          const keyString = JSON.stringify(queryKey);
          // Check if query key includes validation endpoints or the old server ID
          const shouldInvalidate = (
            queryKey.includes('/api/validation/issues/groups') ||
            queryKey.includes('/api/validation/resources') ||
            queryKey.includes('/api/fhir/resources') ||
            queryKey.includes('/api/fhir/resource-counts') ||
            queryKey.includes(previousServerId)
          );
          if (shouldInvalidate) {
            console.log(`[ServerReactiveQueries] Invalidating query: ${keyString}`);
          }
          return shouldInvalidate;
        },
        refetchType: 'active', // Only refetch queries that are currently mounted
      });

      console.log('[ServerReactiveQueries] Cache invalidated for new server - queries will refetch naturally');
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
