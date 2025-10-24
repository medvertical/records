import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerData } from './use-server-data';

/**
 * Hook for fetching validation messages for a single resource
 * 
 * @param resourceType - FHIR resource type (e.g., 'Patient')
 * @param resourceId - FHIR resource ID
 * @param options - Query options
 * @returns Query result with validation messages
 */
export function useValidationMessages(
  resourceType: string,
  resourceId: string,
  options?: { enabled?: boolean }
) {
  const { activeServer } = useServerData();
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['validation-messages', resourceType, resourceId, activeServer?.id],
    queryFn: async () => {
      if (!resourceType || !resourceId) return null;
      
      const response = await fetch(
        `/api/validation/resources/${resourceType}/${resourceId}/messages?serverId=${activeServer?.id || 1}`
      );
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch validation messages: ${response.statusText}`);
      }
      
      return response.json();
    },
    // Check cache first for instant display when navigating from list view
    initialData: () => {
      return queryClient.getQueryData(['validation-messages', resourceType, resourceId, activeServer?.id]);
    },
    enabled: options?.enabled ?? (!!resourceType && !!resourceId && !!activeServer),
    staleTime: 30000, // 30 seconds
    refetchInterval: false,
  });
}

/**
 * Hook for fetching validation messages for multiple resources in parallel
 * Uses a single batch query with Promise.all for optimal performance
 * Automatically populates individual cache entries for detail view access
 * 
 * @param resources - Array of resources to fetch messages for
 * @param options - Query options
 * @returns Combined query result with all validation messages
 */
export function useValidationMessagesForResources(
  resources: Array<{ resourceType: string; resourceId: string }>,
  options?: { enabled?: boolean }
) {
  const { activeServer } = useServerData();
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['validation-messages-batch', resources.map(r => `${r.resourceType}/${r.resourceId}`).sort(), activeServer?.id],
    queryFn: async () => {
      // Fetch all resources in parallel using Promise.all (fast!)
      const messagePromises = resources.map(async (resource) => {
        try {
          const response = await fetch(
            `/api/validation/resources/${resource.resourceType}/${resource.resourceId}/messages?serverId=${activeServer?.id || 1}`
          );
          
          if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Failed to fetch validation messages: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Flatten messages and add resource context
          const flatMessages: any[] = [];
          if (data.aspects) {
            data.aspects.forEach((aspect: any) => {
              if (aspect.messages) {
                aspect.messages.forEach((message: any) => {
                  flatMessages.push({
                    ...message,
                    resourceType: resource.resourceType,
                    resourceId: resource.resourceId,
                    aspect: aspect.aspect
                  });
                });
              }
            });
          }
          
          const result = {
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            messages: flatMessages,
            aspects: data.aspects || []
          };
          
          // Populate individual cache for detail view (crucial for instant display!)
          // Store the full response structure that components expect
          queryClient.setQueryData(
            ['validation-messages', resource.resourceType, resource.resourceId, activeServer?.id],
            {
              serverId: activeServer?.id,
              resourceType: resource.resourceType,
              fhirId: resource.resourceId,
              aspects: data.aspects || []
            }
          );
          
          return result;
        } catch (error) {
          console.error(`Failed to fetch messages for ${resource.resourceType}/${resource.resourceId}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(messagePromises);
      return results.filter((r): r is NonNullable<typeof r> => r !== null);
    },
    enabled: options?.enabled ?? (resources.length > 0 && !!activeServer),
    staleTime: 30000,
    refetchInterval: false,
  });
}

