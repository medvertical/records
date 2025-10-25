import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerData } from '@/hooks/use-server-data';
import { useValidationMessagesForResources } from '@/hooks/use-validation-messages';
import { useResourceVersionTracker, type ResourceVersionInfo } from '@/hooks/use-resource-version-tracker';
import { useToast } from '@/hooks/use-toast';
import type { ValidationFilters } from '@/components/resources/resource-search';

interface ResourcesResponse {
  resources: any[];
  total: number;
  availableResourceTypes?: string[];
}

export interface ResourceDataFetchingState {
  // Data
  resourceTypes: string[] | undefined;
  resourcesData: ResourcesResponse | undefined;
  enrichedResources: any[];
  validationSummaries: any;
  validationMessagesData: any[] | undefined;
  resourcesToFetch: any[];
  
  // Loading states
  isLoading: boolean;
  isLoadingResourceTypes: boolean;
  isLoadingValidation: boolean;
  isLoadingMessages: boolean;
  
  // Errors
  error: any;
  validationMessagesError: boolean;
  
  // Callbacks
  handleVersionChange: (changedResources: ResourceVersionInfo[]) => Promise<void>;
  resetVersionTracker: () => void;
}

/**
 * Hook for fetching and managing resource data, validation summaries, and messages
 * Handles resource queries, validation data, version tracking, and auto-revalidation
 */
export function useResourceDataFetching(
  resourceType: string,
  searchQuery: string,
  page: number,
  pageSize: number,
  sort: string,
  location: string,
  validationFilters: ValidationFilters,
  validationSettingsData: any
): ResourceDataFetchingState {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeServer: stableActiveServer } = useServerData();
  
  // Fetch resource types
  const { data: resourceTypes, isLoading: isLoadingResourceTypes } = useQuery<string[]>({
    queryKey: ["/api/fhir/resource-types"],
    enabled: !!stableActiveServer,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch('/api/fhir/resource-types');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.resourceTypes || data;
    }
  });
  
  // Determine API endpoint
  const hasValidationFilters = validationFilters?.aspects?.length > 0 || 
                                validationFilters?.severities?.length > 0 || 
                                validationFilters?.hasIssuesOnly ||
                                (validationFilters?.issueFilter && Object.keys(validationFilters.issueFilter).length > 0);
  const hasTextSearch = searchQuery && searchQuery.trim().length > 0;
  const apiEndpoint = (hasValidationFilters || hasTextSearch) ? "/api/fhir/resources/filtered" : "/api/fhir/resources";
  
  // Get polling settings
  const pollingInterval = validationSettingsData?.listViewPollingInterval || 30000;
  const isPollingEnabled = validationSettingsData?.autoRevalidateOnVersionChange !== false;
  
  // Fetch resources
  const { data: resourcesData, isLoading, error } = useQuery<ResourcesResponse>({
    queryKey: ['resources', { endpoint: apiEndpoint, resourceType, search: searchQuery, page, pageSize, sort, location, filters: validationFilters }],
    enabled: !!stableActiveServer,
    staleTime: apiEndpoint.includes('/filtered') ? 0 : 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: isPollingEnabled ? pollingInterval : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnMount: apiEndpoint.includes('/filtered') ? true : false,
    placeholderData: undefined,
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, any];
      const url = params.endpoint;
      const searchParams = new URLSearchParams();
      const isFilteredEndpoint = url.includes('/filtered');
      
      if (isFilteredEndpoint) {
        if (params?.resourceType && params.resourceType !== '' && params.resourceType !== 'all') {
          searchParams.set('resourceTypes', params.resourceType);
        }
        if (params?.search) searchParams.set('search', params.search);
        if (params?.sort) searchParams.set('_sort', params.sort);
        searchParams.set('serverId', '1');
        
        const limit = params?.pageSize || 20;
        const offset = (params?.page || 0) * limit;
        searchParams.set('limit', limit.toString());
        searchParams.set('offset', offset.toString());
        
        if (params?.filters) {
          if (params.filters.aspects?.length > 0) {
            const backendAspects = params.filters.aspects.map((a: string) => 
              a === 'businessRule' ? 'business-rule' : a
            );
            searchParams.set('validationAspects', backendAspects.join(','));
            searchParams.set('hasIssuesInAspects', 'true');
          }
          if (params.filters.severities?.length > 0) {
            searchParams.set('severities', params.filters.severities.join(','));
            if (!params.filters.aspects || params.filters.aspects.length === 0) {
              searchParams.set('hasIssuesInAspects', 'true');
            }
          }
          if (params.filters.hasIssuesOnly && (!params.filters.aspects || params.filters.aspects.length === 0) && (!params.filters.severities || params.filters.severities.length === 0)) {
            searchParams.set('hasIssuesInAspects', 'true');
          }
          if (params.filters.fhirSearchParams && Object.keys(params.filters.fhirSearchParams).length > 0) {
            searchParams.set('fhirParams', JSON.stringify(params.filters.fhirSearchParams));
          }
        }
      } else {
        if (params?.resourceType && params.resourceType !== 'all') {
          searchParams.set('resourceType', params.resourceType);
        }
        if (params?.search) searchParams.set('search', params.search);
        if (params?.sort) searchParams.set('_sort', params.sort);
        
        if (params?.filters?.fhirSearchParams && Object.keys(params.filters.fhirSearchParams).length > 0) {
          Object.entries(params.filters.fhirSearchParams).forEach(([key, config]: [string, any]) => {
            if (config.value) {
              const paramKey = config.operator ? `${key}:${config.operator}` : key;
              const value = Array.isArray(config.value) ? config.value.join(',') : config.value;
              searchParams.set(paramKey, value);
            }
          });
        }
        
        const limit = params?.pageSize || 20;
        const offset = (params?.page || 0) * limit;
        searchParams.set('limit', limit.toString());
        searchParams.set('offset', offset.toString());
      }
      
      const fullUrl = `${url}?${searchParams}`;
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.warning) {
        toast({
          title: "Search Limitation",
          description: data.warning.message,
          variant: "destructive",
          duration: 8000,
        });
      }
      
      if (isFilteredEndpoint) {
        return {
          resources: data.data?.resources || [],
          total: data.data?.totalCount || 0,
          availableResourceTypes: data.data?.filterSummary?.availableResourceTypes || []
        };
      }
      
      return data;
    }
  });
  
  // Memoize resources to fetch
  const resourcesToFetch = useMemo(() => 
    resourcesData?.resources?.map(r => ({
      resourceType: r.resourceType,
      resourceId: r.resourceId
    })) || [],
    [resourcesData?.resources]
  );
  
  // Fetch validation summaries
  const { data: validationSummaries, isLoading: isLoadingValidation } = useQuery({
    queryKey: ['validation-summaries-bulk', resourcesToFetch],
    enabled: resourcesToFetch.length > 0 && !!stableActiveServer,
    staleTime: 30000,
    queryFn: async () => {
      const response = await fetch('/api/validation/summaries/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resources: resourcesToFetch.map(r => ({ 
            resourceType: r.resourceType, 
            id: r.resourceId 
          })),
          serverId: stableActiveServer?.id || 1
        })
      });
      
      if (!response.ok) {
        console.warn('[ResourceBrowser] Failed to fetch validation summaries');
        return {};
      }
      
      const result = await response.json();
      return result.success ? result.data : {};
    }
  });
  
  // Merge validation summaries into resources
  const enrichedResources = useMemo(() => {
    if (!resourcesData?.resources) return [];
    
    return resourcesData.resources.map(resource => {
      const resourceKey = `${resource.resourceType}/${resource.id}`;
      const validationSummary = validationSummaries?.[resourceKey];
      
      return {
        ...resource,
        _validationSummary: validationSummary || resource._validationSummary || null
      };
    });
  }, [resourcesData?.resources, validationSummaries]);
  
  // Fetch validation messages
  const { 
    data: validationMessagesData, 
    isLoading: isLoadingMessages, 
    isError: validationMessagesError 
  } = useValidationMessagesForResources(
    resourcesToFetch,
    { enabled: resourcesToFetch.length > 0 }
  );
  
  // Handle version changes
  const handleVersionChange = useCallback(async (changedResources: ResourceVersionInfo[]) => {
    if (changedResources.length === 0) return;
    
    console.log(`[ResourceBrowser] Detected ${changedResources.length} resource(s) with version changes`);
    
    try {
      const enqueuePromises = changedResources.map(async (resourceInfo) => {
        const response = await fetch('/api/validation/queue/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverId: stableActiveServer?.id || 1,
            resourceType: resourceInfo.resourceType,
            resourceId: resourceInfo.resourceId,
            priority: 'high',
          }),
        });
        
        return response.ok ? resourceInfo : null;
      });
      
      const results = await Promise.all(enqueuePromises);
      const successCount = results.filter(r => r !== null).length;
      
      if (successCount > 0) {
        toast({
          title: 'Auto-Revalidation',
          description: `${successCount} resource${successCount > 1 ? 's' : ''} queued for validation`,
          duration: 3000,
        });
        
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['validation-messages'] });
          queryClient.refetchQueries({ queryKey: ['resources'], type: 'active' });
        }, 2000);
      }
    } catch (error) {
      console.error('[ResourceBrowser] Error during auto-revalidation:', error);
    }
  }, [stableActiveServer, toast, queryClient]);
  
  // Initialize version tracker
  const { reset: resetVersionTracker } = useResourceVersionTracker(
    resourcesData?.resources || [],
    isPollingEnabled && !isLoading,
    handleVersionChange
  );
  
  // Reset version tracker when page/filters change
  useEffect(() => {
    resetVersionTracker();
  }, [page, resourceType, searchQuery, JSON.stringify(validationFilters), resetVersionTracker]);
  
  return {
    resourceTypes,
    resourcesData,
    enrichedResources,
    validationSummaries,
    validationMessagesData,
    resourcesToFetch,
    isLoading,
    isLoadingResourceTypes,
    isLoadingValidation,
    isLoadingMessages,
    error,
    validationMessagesError,
    handleVersionChange,
    resetVersionTracker,
  };
}

