import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useActiveServerId } from './use-server-reactive-queries';

// Types
export interface QuickAccessPreferences {
  quickAccessItems: string[];
}

export interface ResourceTypesResponse {
  resourceTypes: string[];
}

// API functions
const fetchQuickAccessItems = async (): Promise<QuickAccessPreferences> => {
  const response = await fetch('/api/user-preferences/quick-access');
  if (!response.ok) {
    throw new Error('Failed to fetch quick access items');
  }
  return response.json();
};

const updateQuickAccessItems = async (items: string[]): Promise<QuickAccessPreferences> => {
  const response = await fetch('/api/user-preferences/quick-access', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quickAccessItems: items }),
  });
  if (!response.ok) {
    throw new Error('Failed to update quick access items');
  }
  return response.json();
};

const resetQuickAccessItems = async (): Promise<QuickAccessPreferences> => {
  const response = await fetch('/api/user-preferences/quick-access/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to reset quick access items');
  }
  return response.json();
};

const fetchResourceTypes = async (): Promise<ResourceTypesResponse> => {
  const response = await fetch('/api/fhir/resource-types');
  if (!response.ok) {
    throw new Error('Failed to fetch resource types');
  }
  return response.json();
};

// React Query hooks
export function useQuickAccessItems() {
  return useQuery({
    queryKey: ['quickAccessItems'],
    queryFn: fetchQuickAccessItems,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

export function useUpdateQuickAccess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: updateQuickAccessItems,
    onMutate: async (newItems) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['quickAccessItems'] });

      // Snapshot the previous value
      const previousItems = queryClient.getQueryData<QuickAccessPreferences>(['quickAccessItems']);

      // Optimistically update to the new value
      queryClient.setQueryData<QuickAccessPreferences>(['quickAccessItems'], {
        quickAccessItems: newItems,
      });

      // Return a context object with the snapshotted value
      return { previousItems };
    },
    onError: (err, newItems, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousItems) {
        queryClient.setQueryData(['quickAccessItems'], context.previousItems);
      }
      toast({
        title: 'Error',
        description: 'Failed to update quick access items',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Quick access items updated',
      });
      // Invalidate resource counts to ensure they update with new quick access items
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/resource-counts'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'quickAccessCounts' });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['quickAccessItems'] });
    },
  });
}

export function useResetQuickAccess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: resetQuickAccessItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickAccessItems'] });
      toast({
        title: 'Success',
        description: 'Quick access items reset to defaults',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to reset quick access items',
        variant: 'destructive',
      });
    },
  });
}

export function useResourceTypes() {
  return useQuery({
    queryKey: ['resourceTypes'],
    queryFn: fetchResourceTypes,
    staleTime: 10 * 60 * 1000, // 10 minutes - resource types don't change often
    retry: 2,
  });
}

export function useQuickAccessCounts() {
  const { data: quickAccessData } = useQuickAccessItems();
  const quickAccessItems = quickAccessData?.quickAccessItems || [];
  const serverId = useActiveServerId();
  
  return useQuery({
    queryKey: ['quickAccessCounts', serverId, quickAccessItems],
    queryFn: async () => {
      if (quickAccessItems.length === 0) {
        return { counts: {} };
      }
      
      const types = quickAccessItems.join(',');
      const response = await fetch(`/api/fhir/resource-counts?types=${types}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch resource counts');
      }
      
      const data = await response.json();
      
      // Convert to simple object format
      const counts: Record<string, number> = {};
      data.resourceTypes.forEach((item: { resourceType: string; count: number }) => {
        counts[item.resourceType] = item.count;
      });
      
      return { counts };
    },
    enabled: quickAccessItems.length > 0 && serverId != null,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// Helper functions
export function addQuickAccessItem(currentItems: string[], newItem: string): string[] {
  if (currentItems.includes(newItem)) {
    return currentItems;
  }
  return [...currentItems, newItem];
}

export function removeQuickAccessItem(currentItems: string[], itemToRemove: string): string[] {
  return currentItems.filter(item => item !== itemToRemove);
}

export function reorderQuickAccessItems(items: string[], startIndex: number, endIndex: number): string[] {
  const result = Array.from(items);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export function getDefaultQuickAccessItems(): string[] {
  return ['Patient', 'Observation', 'Encounter', 'Condition'];
}
