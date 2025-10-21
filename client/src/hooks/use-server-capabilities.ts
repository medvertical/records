/**
 * Hook for accessing detected server capabilities
 * 
 * Returns capabilities for the currently active FHIR server,
 * including which search modifiers it supports.
 */

import { useQuery } from '@tanstack/react-query';
import { useActiveServer } from './use-active-server';

export interface SearchModifierCapabilities {
  missing: boolean;      // :missing=true/false (FHIR R4 standard)
  exists: boolean;       // :exists=true/false (Fire.ly extension)
  contains: boolean;     // :contains (string search)
  exact: boolean;        // :exact (exact match)
  not: boolean;          // :not (negation - rare)
}

export interface ServerCapabilities {
  serverId: number;
  serverUrl: string;
  searchModifiers: SearchModifierCapabilities;
  detectedAt: string;
  fhirVersion?: string;
}

/**
 * Fetch capabilities for a specific server
 */
async function fetchServerCapabilities(serverId: number): Promise<ServerCapabilities> {
  const response = await fetch(`/api/servers/${serverId}/capabilities`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch server capabilities: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Hook to get capabilities for the active server
 */
export function useServerCapabilities() {
  const { activeServer } = useActiveServer();

  const query = useQuery({
    queryKey: ['serverCapabilities', activeServer?.id],
    queryFn: () => {
      if (!activeServer?.id) {
        throw new Error('No active server');
      }
      return fetchServerCapabilities(activeServer.id);
    },
    enabled: !!activeServer?.id,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - capabilities rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    retry: 2,
  });

  return {
    capabilities: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to refresh server capabilities (force re-detection)
 */
export function useRefreshServerCapabilities() {
  const { activeServer } = useActiveServer();

  const refreshCapabilities = async () => {
    if (!activeServer?.id) {
      throw new Error('No active server');
    }

    const response = await fetch(`/api/servers/${activeServer.id}/capabilities/refresh`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh capabilities: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  };

  return { refreshCapabilities };
}

/**
 * Helper to check if a specific modifier is supported
 */
export function useSupportsModifier(modifier: keyof SearchModifierCapabilities): boolean {
  const { capabilities } = useServerCapabilities();
  return capabilities?.searchModifiers?.[modifier] ?? false;
}

/**
 * Helper to get all supported modifiers
 */
export function useSupportedModifiers(): (keyof SearchModifierCapabilities)[] {
  const { capabilities } = useServerCapabilities();
  
  if (!capabilities) {
    return [];
  }

  const modifiers = Object.entries(capabilities.searchModifiers)
    .filter(([_, supported]) => supported)
    .map(([modifier]) => modifier as keyof SearchModifierCapabilities);

  return modifiers;
}

