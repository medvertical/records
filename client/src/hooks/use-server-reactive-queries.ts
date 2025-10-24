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

    // If server changed, invalidate queries with debouncing (they'll refetch naturally when components need them)
    if (isInitializedRef.current && currentServerId !== undefined && previousServerId !== undefined && currentServerId !== previousServerId) {
      console.log(`[ServerReactiveQueries] Active server changed from ${previousServerId} to ${currentServerId}`);
      
      // Batch invalidate all queries at once to prevent cascading refetches
      // Use a single invalidation call with a broad predicate
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          // Check if query key includes server-specific or FHIR endpoints
          const shouldInvalidate = (
            queryKey.includes('/api/validation/issues/groups') ||
            queryKey.includes('/api/validation/resources') ||
            queryKey.includes('validation-messages') ||
            queryKey.includes('/api/fhir/resources') ||
            queryKey.includes('/api/fhir/resource-counts') ||
            queryKey.includes('quickAccessCounts') ||
            queryKey.includes(previousServerId)
          );
          return shouldInvalidate;
        },
        refetchType: 'none', // Don't refetch immediately - let staleTime and component mounting handle it
      });

      console.log('[ServerReactiveQueries] Cache invalidated for new server - queries will refetch when needed');
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
