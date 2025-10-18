import { useQuery } from '@tanstack/react-query';

export interface ResourceVersion {
  versionId: string;
  lastModified: string;
}

export interface VersionHistoryData {
  total: number;
  currentVersion?: string;
  versions: ResourceVersion[];
  error?: string;
}

export interface ResourceIdentifier {
  resourceType: string;
  id: string;
}

/**
 * Fetch version history for multiple resources (bulk)
 * Used in resource list views
 */
export function useResourceVersionsBulk(
  resources: ResourceIdentifier[],
  options?: { enabled?: boolean }
) {
  return useQuery<Record<string, VersionHistoryData>>({
    queryKey: ['resource-versions-bulk', resources],
    queryFn: async () => {
      if (resources.length === 0) {
        return {};
      }

      const response = await fetch(
        `/api/fhir/resources/version-history?resources=${encodeURIComponent(
          JSON.stringify(resources)
        )}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch version history');
      }

      return response.json();
    },
    enabled: options?.enabled !== false && resources.length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });
}

/**
 * Fetch version history for a single resource
 * Used in resource detail views
 */
export function useResourceVersions(
  resourceType: string | undefined,
  id: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<VersionHistoryData>({
    queryKey: ['resource-versions', resourceType, id],
    queryFn: async () => {
      if (!resourceType || !id) {
        throw new Error('Resource type and ID are required');
      }

      const response = await fetch(
        `/api/fhir/resources/version-history?resources=${encodeURIComponent(
          JSON.stringify([{ resourceType, id }])
        )}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch version history');
      }

      const data = await response.json();
      const key = `${resourceType}/${id}`;
      return data[key] || { total: 1, versions: [] };
    },
    enabled: options?.enabled !== false && !!resourceType && !!id,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

