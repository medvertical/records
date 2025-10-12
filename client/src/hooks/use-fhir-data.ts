import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fhirClient, ResourceSearchParams } from "@/lib/fhir-client";
import { useToast } from "@/hooks/use-toast";
import { ResourceStats, ValidationResult, FhirResourceWithValidation } from "@shared/schema";

// Query keys for consistent cache management
export const QUERY_KEYS = {
  connection: '/api/fhir/connection/test',
  resourceTypes: '/api/fhir/resource-types',
  resourceCounts: '/api/fhir/resource-counts',
  resources: '/api/fhir/resources',
  dashboardStats: '/api/dashboard/stats',
  dashboardCards: '/api/dashboard/cards',
  validationProfiles: '/api/validation/profiles',
  recentErrors: '/api/validation/errors/recent',
  servers: '/api/servers',
} as const;

// Connection status hook
export function useConnectionStatus() {
  return useQuery({
    queryKey: [QUERY_KEYS.connection],
    queryFn: () => fhirClient.testConnection(),
    refetchInterval: false, // Disable automatic polling - only check on manual refresh
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    keepPreviousData: true, // Prevent flashing during refetch
  });
}

// Resource types hook
export function useResourceTypes() {
  return useQuery({
    queryKey: [QUERY_KEYS.resourceTypes],
    queryFn: () => fhirClient.getResourceTypes(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true, // Prevent flashing during refetch
  });
}

// Resource counts hook
export function useResourceCounts() {
  return useQuery({
    queryKey: [QUERY_KEYS.resourceCounts],
    queryFn: () => fhirClient.getResourceCounts(),
    staleTime: 10 * 60 * 1000, // 10 minutes - cache for much longer
    refetchInterval: false, // Disable automatic refetching
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
    keepPreviousData: true, // Prevent flashing during refetch
  });
}

// Resources search hook
export function useResources(params: ResourceSearchParams = {}) {
  return useQuery({
    queryKey: [QUERY_KEYS.resources, params],
    queryFn: () => fhirClient.searchResources(params),
    enabled: true,
    staleTime: 1 * 60 * 1000, // 1 minute
    keepPreviousData: true, // Prevent flashing during refetch
  });
}

// Single resource hook
export function useResource(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.resources, id],
    queryFn: () => fhirClient.getResource(id!),
    enabled: !!id,
    keepPreviousData: true, // Prevent flashing during refetch
  });
}

// Dashboard statistics hook
export function useDashboardStats() {
  return useQuery<ResourceStats>({
    queryKey: [QUERY_KEYS.dashboardStats],
    queryFn: () => fhirClient.getDashboardStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Dashboard cards hook
export function useDashboardCards() {
  return useQuery({
    queryKey: [QUERY_KEYS.dashboardCards],
    queryFn: () => fhirClient.getDashboardCards(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Validation profiles hook
export function useValidationProfiles(resourceType?: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.validationProfiles, { resourceType }],
    queryFn: () => fhirClient.getValidationProfiles(resourceType),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Recent validation errors hook
export function useRecentValidationErrors(limit = 10) {
  return useQuery<ValidationResult[]>({
    queryKey: [QUERY_KEYS.recentErrors, { limit }],
    queryFn: () => fhirClient.getRecentValidationErrors(limit),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// FHIR server packages hook
export function useFhirServerPackages() {
  return useQuery({
    queryKey: ['/api/fhir/packages'],
    queryFn: () => fetch('/api/fhir/packages').then(res => res.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// FHIR servers hook
export function useFhirServers() {
  return useQuery({
    queryKey: [QUERY_KEYS.servers],
    queryFn: () => fhirClient.getFhirServers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Resource validation mutation
export function useValidateResource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ 
      resource, 
      profileUrl, 
      config 
    }: { 
      resource: any; 
      profileUrl?: string; 
      config?: any 
    }) => {
      return fhirClient.validateResource(resource, profileUrl, config);
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.recentErrors] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dashboardStats] });
      
      toast({
        title: "Validation Complete",
        description: data.isValid 
          ? "Resource validation passed successfully"
          : `Validation failed with ${data.errors.length} error(s)`,
        variant: data.isValid ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate resource",
        variant: "destructive",
      });
    },
  });
}

// Create FHIR server mutation
export function useCreateFhirServer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (server: { name: string; url: string; isActive?: boolean }) => {
      return fhirClient.createFhirServer(server);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.servers] });
      toast({
        title: "Server Added",
        description: "FHIR server has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Server",
        description: error.message || "Could not add FHIR server",
        variant: "destructive",
      });
    },
  });
}

// Activate FHIR server mutation
export function useActivateFhirServer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: number) => {
      return fhirClient.activateFhirServer(id);
    },
    onSuccess: () => {
      // Invalidate all server-dependent queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.servers] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.connection] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.resources] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.resourceTypes] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.resourceCounts] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dashboardStats] });
      
      toast({
        title: "Server Activated",
        description: "FHIR server has been activated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Activate Server",
        description: error.message || "Could not activate FHIR server",
        variant: "destructive",
      });
    },
  });
}

// Custom hook for resource search with debouncing
export function useResourceSearch() {
  const queryClient = useQueryClient();

  const searchResources = (params: ResourceSearchParams) => {
    return queryClient.fetchQuery({
      queryKey: [QUERY_KEYS.resources, params],
      queryFn: () => fhirClient.searchResources(params),
      staleTime: 30 * 1000, // 30 seconds
    });
  };

  const prefetchResource = (id: string) => {
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEYS.resources, id],
      queryFn: () => fhirClient.getResource(id),
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  return {
    searchResources,
    prefetchResource,
  };
}

// Utility hook for cache management
export function useFhirCache() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    return queryClient.invalidateQueries();
  };

  const invalidateResources = () => {
    return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.resources] });
  };

  const invalidateDashboard = () => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dashboardStats] }),
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dashboardCards] }),
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.recentErrors] }),
    ]);
  };

  const clearCache = () => {
    queryClient.clear();
  };

  const prefetchCommonData = () => {
    return Promise.all([
      queryClient.prefetchQuery({
        queryKey: [QUERY_KEYS.resourceTypes],
        queryFn: () => fhirClient.getResourceTypes(),
      }),
      queryClient.prefetchQuery({
        queryKey: [QUERY_KEYS.resourceCounts],
        queryFn: () => fhirClient.getResourceCounts(),
      }),
    ]);
  };

  return {
    invalidateAll,
    invalidateResources,
    invalidateDashboard,
    clearCache,
    prefetchCommonData,
  };
}

// Error boundary hook for FHIR operations
export function useFhirErrorHandler() {
  const { toast } = useToast();

  const handleError = (error: any, context?: string) => {
    console.error(`FHIR Error${context ? ` in ${context}` : ''}:`, error);
    
    const message = error.message || 'An unexpected error occurred';
    const title = context ? `${context} Failed` : 'FHIR Operation Failed';
    
    toast({
      title,
      description: message,
      variant: "destructive",
    });
  };

  return { handleError };
}

// Note: Validation settings functions have been moved to use-validation-settings.ts
// to avoid conflicts and provide a unified settings management interface.
