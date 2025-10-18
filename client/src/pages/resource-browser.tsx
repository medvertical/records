import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useServerData } from "@/hooks/use-server-data";
import { useValidationSettingsPolling } from "@/hooks/use-validation-settings-polling";
import ResourceSearch, { type ValidationFilters } from "@/components/resources/resource-search";
import ResourceList from "@/components/resources/resource-list";
import { ValidationOverview, type ValidationSummary } from "@/components/resources/validation-overview";
import { ValidationMessagesCard } from "@/components/validation/validation-messages-card";
import { BatchEditDialog } from "@/components/resources/BatchEditDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getFilteredValidationSummary } from '@/lib/validation-filtering-utils';
import { useValidationActivity } from "@/contexts/validation-activity-context";
import { CheckSquare, Edit2, X } from "lucide-react";

// Simple client-side cache to track validated resources
const validatedResourcesCache = new Set<string>();

// Cache clearing event system
let cacheClearedListeners: (() => void)[] = [];

// Make cache accessible globally for other components
if (typeof window !== 'undefined') {
  (window as any).validatedResourcesCache = validatedResourcesCache;
  (window as any).onCacheCleared = (callback: () => void) => {
    cacheClearedListeners.push(callback);
  };
  (window as any).triggerCacheCleared = () => {
    validatedResourcesCache.clear();
    cacheClearedListeners.forEach(listener => listener());
  };
}

interface ResourcesResponse {
  resources: any[];
  total: number;
  availableResourceTypes?: string[];
}

interface ValidationUpdateMessage {
  type: 'resource_validation_updated';
  resourceId: number;
  fhirResourceId: string;
  resourceType: string;
  validationSummary: {
    hasErrors: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
    isValid: boolean;
    lastValidated: Date;
  };
}

export default function ResourceBrowser() {
  const [location] = useLocation();
  const [resourceType, setResourceType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [isValidating, setIsValidating] = useState(false);
  const [validatingResourceIds, setValidatingResourceIds] = useState<Set<number>>(new Set());
  const [validationProgress, setValidationProgress] = useState<Map<number, any>>(new Map());
  const [hasValidatedCurrentPage, setHasValidatedCurrentPage] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [validationFilters, setValidationFilters] = useState<ValidationFilters>({
    aspects: [],
    severities: [],
    hasIssuesOnly: false,
  });
  
  // Batch editing state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Activity context for reporting individual resource validations
  const { addResourceValidation, updateResourceValidation, removeResourceValidation, clearAllActivity } = useValidationActivity();
  
  // Keep a ref to validating resource IDs for cleanup on unmount
  const validatingIdsRef = useRef<Set<number>>(validatingResourceIds);
  validatingIdsRef.current = validatingResourceIds;
  
  // Cleanup: Remove all individual validations when component unmounts
  useEffect(() => {
    return () => {
      // Clear all validations from activity context when unmounting
      if (validatingIdsRef.current.size > 0) {
        validatingIdsRef.current.forEach(id => {
          removeResourceValidation(id);
        });
      }
    };
  }, [removeResourceValidation]); // Only on unmount

  // Use validation settings polling to detect changes and refresh resource list
  const { lastChange, isPolling, error: pollingError } = useValidationSettingsPolling({
    pollingInterval: 60000, // Poll every 60 seconds (reduced frequency)
    enabled: true,
    showNotifications: false, // Don't show toast notifications in resource browser
    invalidateCache: true, // Invalidate cache when settings change
  });

  // Fetch current validation settings for filtering
  const { data: validationSettingsData } = useQuery({
    queryKey: ['/api/validation/settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      if (!response.ok) throw new Error('Failed to fetch validation settings');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: false,
  });

  // Get current validation settings for filtering
  const currentSettings = validationSettingsData;

  // State for validation message navigation
  const [isMessagesVisible, setIsMessagesVisible] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [aggregatedMessages, setAggregatedMessages] = useState<any[]>([]);
  const [currentSeverity, setCurrentSeverity] = useState<'error' | 'warning' | 'information'>('error');
  const [currentSeverityIndex, setCurrentSeverityIndex] = useState({ error: 0, warning: 0, information: 0 });

  // Listen for validation settings changes
  // Note: Settings changes only affect UI filtering, not data fetching
  useEffect(() => {
    if (lastChange) {
      // Reset validation flag when settings change to allow re-validation with new settings
      setHasValidatedCurrentPage(false);
      // Clear validation cache to force revalidation with new settings
      validatedResourcesCache.clear();
      // No need to refetch - settings only affect UI filtering, not the data itself
    }
  }, [lastChange, queryClient]);



  // Define handleSearch function before using it in useEffect
  const handleSearch = useCallback((query: string, type: string, fhirParams?: Record<string, { value: string | string[]; operator?: string }>) => {
    setSearchQuery(query);
    setResourceType(type);
    setPage(0);
    
    // Update URL to reflect the search parameters
    const searchParams = new URLSearchParams();
    if (type && type !== "all") {
      searchParams.set('type', type);
    }
    if (query) {
      searchParams.set('search', query);
    }
    
    // Add FHIR search params to URL
    if (fhirParams) {
      Object.entries(fhirParams).forEach(([key, config]) => {
        if (config.value) {
          const paramKey = config.operator ? `${key}:${config.operator}` : key;
          const value = Array.isArray(config.value) ? config.value.join(',') : config.value;
          searchParams.set(paramKey, value);
        }
      });
    }
    
    const newUrl = searchParams.toString() ? `/resources?${searchParams.toString()}` : '/resources';
    window.history.pushState({}, '', newUrl);
    
    // Trigger a custom event to notify the sidebar of URL changes
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  // Selection mode handlers
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      // Clear selection when exiting selection mode
      setSelectedResources(new Set());
    }
  }, [selectionMode]);

  const handleSelectionChange = useCallback((resourceKey: string, selected: boolean) => {
    setSelectedResources(prev => {
      const updated = new Set(prev);
      if (selected) {
        updated.add(resourceKey);
      } else {
        updated.delete(resourceKey);
      }
      return updated;
    });
  }, []);

  const handleBatchEdit = useCallback(() => {
    if (selectedResources.size === 0) {
      toast({
        title: 'No Resources Selected',
        description: 'Please select at least one resource to edit.',
        variant: 'destructive',
      });
      return;
    }
    setBatchEditDialogOpen(true);
  }, [selectedResources.size, toast]);

  const handleBatchEditComplete = useCallback(() => {
    setBatchEditDialogOpen(false);
    setSelectedResources(new Set());
    setSelectionMode(false);
    // Refetch resource list to see updated resources
    queryClient.invalidateQueries({
      queryKey: ['resources'],
    });
  }, [queryClient]);

  // Parse URL parameters and update state when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    const searchParam = urlParams.get('search');
    const aspectsParam = urlParams.get('aspects');
    const severitiesParam = urlParams.get('severities');
    const hasIssuesParam = urlParams.get('hasIssues');
    
    // Parse FHIR search parameters from URL
    const fhirSearchParams: Record<string, { value: string | string[]; operator?: string }> = {};
    urlParams.forEach((value, key) => {
      // Skip known params like 'type', 'search', 'aspects', 'severities', 'hasIssues', 'page', 'limit'
      if (!['type', 'search', 'aspects', 'severities', 'hasIssues', 'page', 'limit'].includes(key)) {
        // Parse operator if present (e.g., "birthdate:gt")
        const [paramName, operator] = key.split(':');
        fhirSearchParams[paramName] = { value, operator };
      }
    });
    
    // Update state directly - this will trigger the query to re-run
    setResourceType(typeParam || "");
    setSearchQuery(searchParam || "");
    setValidationFilters({
      aspects: aspectsParam ? aspectsParam.split(',') : [],
      severities: severitiesParam ? severitiesParam.split(',') : [],
      hasIssuesOnly: hasIssuesParam === 'true',
      issueFilter: undefined, // Clear issue filter when URL changes
      fhirSearchParams: Object.keys(fhirSearchParams).length > 0 ? fhirSearchParams : undefined,
    });
    setPage(0); // Reset to first page when navigating
  }, [location]);

  // Also listen for popstate events to handle programmatic URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const typeParam = urlParams.get('type');
      const searchParam = urlParams.get('search');

      // Parse FHIR params
      const fhirParams: Record<string, { value: string | string[]; operator?: string }> = {};
      urlParams.forEach((value, key) => {
        if (!['type','search','aspects','severities','hasIssues','page','limit'].includes(key)) {
          const [paramName, operator] = key.split(':');
          fhirParams[paramName] = { value, operator };
        }
      });

      setResourceType(typeParam || "");
      setSearchQuery(searchParam || "");
      setValidationFilters(prev => ({
        ...prev,
        fhirSearchParams: Object.keys(fhirParams).length > 0 ? fhirParams : undefined,
      }));
      setPage(0);
    };
    
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []); // No dependencies to avoid re-adding listeners

  // Removed excessive URL monitoring that was causing flickering



  // Listen for validation settings changes to invalidate resource cache
  useEffect(() => {
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'settings_changed' && data.data?.type === 'validation_settings_updated') {
          // No need to refetch - settings only affect UI filtering, not the data itself
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    // Add event listener for SSE messages
    const sse = (window as any).validationSSE;
    if (sse) {
      sse.addEventListener('message', handleSSEMessage);
      return () => sse.removeEventListener('message', handleSSEMessage);
    }
  }, [queryClient]);

  // SSE connection for real-time validation updates
  useEffect(() => {
    // SSE connection is handled by useValidationSSE hook
    // Real-time validation updates are managed through SSE events
    return;
  }, []);

  // Get active server using the proper hook
  const { activeServer: stableActiveServer } = useServerData();

  // Debug logging for component state - reduced frequency
  useEffect(() => {
  }, [stableActiveServer?.id, resourceType, searchQuery, page, location]); // Only log when meaningful changes occur

  const { data: resourceTypes, isLoading: isLoadingResourceTypes } = useQuery<string[]>({
    queryKey: ["/api/fhir/resource-types"],
    // Only fetch resource types when there's an active server
    enabled: !!stableActiveServer,
    staleTime: 5 * 60 * 1000, // 5 minutes - resource types don't change often
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
    queryFn: async () => {
      
      const startTime = Date.now();
      
      try {
        const response = await fetch('/api/fhir/resource-types');
        const fetchTime = Date.now() - startTime;
        
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const totalTime = Date.now() - startTime;
        
        
        return data.resourceTypes || data;
      } catch (error) {
        const totalTime = Date.now() - startTime;
        throw error;
      }
    }
  });

  // Check if validation filters are active
  const hasValidationFilters = validationFilters.aspects.length > 0 || 
                                validationFilters.severities.length > 0 || 
                                validationFilters.hasIssuesOnly ||
                                (validationFilters.issueFilter && Object.keys(validationFilters.issueFilter).length > 0) ||
                                (validationFilters.fhirSearchParams && Object.keys(validationFilters.fhirSearchParams || {}).length > 0);
  
  // Also check URL directly for FHIR search parameters as a fallback
  const urlParams = new URLSearchParams(window.location.search);
  const hasFhirParamsInUrl = Array.from(urlParams.keys()).some(key => 
    !['type', 'search', 'aspects', 'severities', 'hasIssues', 'page', 'limit'].includes(key)
  );
  
  // Check if there's a text search query
  const hasTextSearch = searchQuery && searchQuery.trim().length > 0;
  
  // Use filtered endpoint when validation filters are active OR when FHIR params are in URL OR when there's a text search
  const apiEndpoint = (hasValidationFilters || hasFhirParamsInUrl || hasTextSearch) ? "/api/fhir/resources/filtered" : "/api/fhir/resources";
  

  const { data: resourcesData, isLoading, error} = useQuery<ResourcesResponse>({
    queryKey: ['resources', { endpoint: apiEndpoint, resourceType, search: searchQuery, page, pageSize, location, filters: validationFilters }],
    // Only fetch resources when there's an active server (resourceType can be empty for "all types")
    enabled: !!stableActiveServer,
    staleTime: apiEndpoint.includes('/filtered') ? 0 : 2 * 60 * 1000, // Fresh data for searches, cache for browsing
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache longer
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: apiEndpoint.includes('/filtered') ? true : false, // Refetch for searches
    placeholderData: undefined, // Disable placeholder to prevent stale data display
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, { endpoint: string; resourceType?: string; search?: string; page: number; pageSize: number; location: string; filters: ValidationFilters }];
      const url = params.endpoint;
      
      const searchParams = new URLSearchParams();
      
      const isFilteredEndpoint = url.includes('/filtered');
      
      if (isFilteredEndpoint) {
        // /filtered endpoint parameters
        // Only set resourceTypes if a specific type is selected (not "all")
        if (params?.resourceType && params.resourceType !== '' && params.resourceType !== 'all') {
          searchParams.set('resourceTypes', params.resourceType);
        }
        if (params?.search) searchParams.set('search', params.search);
        
        // Add serverId
        searchParams.set('serverId', '1'); // TODO: Get from context
        
        // Convert page to limit/offset for /filtered endpoint
        const limit = params?.pageSize || 20;
        const offset = (params?.page || 0) * limit;
        searchParams.set('limit', limit.toString());
        searchParams.set('offset', offset.toString());
        
        // Add filter parameters
        if (params?.filters) {
          if (params.filters.aspects.length > 0) {
            // Map frontend aspect IDs to backend IDs (businessRule → business-rule)
            const backendAspects = params.filters.aspects.map(a => 
              a === 'businessRule' ? 'business-rule' : a
            );
            searchParams.set('validationAspects', backendAspects.join(','));
            // When aspects are selected, we want to show only resources with issues in those aspects
            searchParams.set('hasIssuesInAspects', 'true');
          }
          if (params.filters.severities.length > 0) {
            searchParams.set('severities', params.filters.severities.join(','));
            // When severities are selected without aspects, also filter by hasIssues
            if (params.filters.aspects.length === 0) {
              searchParams.set('hasIssuesInAspects', 'true');
            }
          }
          // The hasIssuesOnly checkbox is now redundant when filters are active
          // but we keep it for explicit "show only problematic resources" without specific aspect/severity selection
          if (params.filters.hasIssuesOnly && params.filters.aspects.length === 0 && params.filters.severities.length === 0) {
            searchParams.set('hasIssuesInAspects', 'true');
          }
          
          // Add FHIR search parameters
          if (params.filters.fhirSearchParams && Object.keys(params.filters.fhirSearchParams).length > 0) {
            searchParams.set('fhirParams', JSON.stringify(params.filters.fhirSearchParams));
          }
        }
      } else {
        // Standard /resources endpoint parameters
        if (params?.resourceType) searchParams.set('resourceType', params.resourceType);
        if (params?.search) searchParams.set('search', params.search);
        
        // Add FHIR search parameters directly to query string for standard endpoint
        if (params?.filters?.fhirSearchParams && Object.keys(params.filters.fhirSearchParams).length > 0) {
          Object.entries(params.filters.fhirSearchParams).forEach(([key, config]) => {
            if (config.value) {
              const paramKey = config.operator ? `${key}:${config.operator}` : key;
              const value = Array.isArray(config.value) ? config.value.join(',') : config.value;
              searchParams.set(paramKey, value);
            }
          });
        }
        
        // Convert page to limit/offset for standard endpoint
        const limit = params?.pageSize || 20;
        const offset = (params?.page || 0) * limit;
        searchParams.set('limit', limit.toString());
        searchParams.set('offset', offset.toString());
      }
      
      const fullUrl = `${url}?${searchParams}`;
      
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(fullUrl);
        const fetchTime = Date.now() - startTime;
        
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const totalTime = Date.now() - startTime;
        
        // Check for warning messages (like unsupported search parameters)
        if (data.warning) {
          toast({
            title: "Search Limitation",
            description: data.warning.message,
            variant: "destructive",
            duration: 8000, // Show longer for important info
          });
        }
        
        // Transform /filtered endpoint response to match expected format
        if (isFilteredEndpoint) {
          const transformed = {
            resources: data.data?.resources || [],
            total: data.data?.totalCount || 0,
            availableResourceTypes: data.data?.filterSummary?.availableResourceTypes || []
          };
          return transformed;
        }
        
        // Return standard endpoint response as is
        return data;
      } catch (error) {
        const totalTime = Date.now() - startTime;
        throw error;
      }
    }
  });

  // Fetch validation messages for all resources on current page
  const { data: validationMessagesData, isLoading: isLoadingMessages, error: validationMessagesError } = useQuery({
    queryKey: ['validation-messages', resourcesData?.resources?.map(r => `${r.resourceType}/${r.resourceId}`)],
    enabled: !!resourcesData?.resources && resourcesData.resources.length > 0 && !!stableActiveServer,
    queryFn: async () => {
      if (!resourcesData?.resources) return [];
      
      // Fetch messages for all resources on current page in parallel
      const messagePromises = resourcesData.resources.map(async (resource) => {
        try {
          const response = await fetch(
            `/api/validation/resources/${resource.resourceType}/${resource.resourceId}/messages?serverId=${stableActiveServer?.id || 1}`
          );
          if (!response.ok) {
            return null;
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
          
          return {
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            messages: flatMessages,
            aspects: data.aspects || []
          };
        } catch (error) {
          return null;
        }
      });
      
      const results = await Promise.all(messagePromises);
      const filteredResults = results.filter(result => result !== null);
      
      
      return filteredResults;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: false,
  });

  // Debug validation messages query state
  useEffect(() => {
  }, [resourcesData?.resources, stableActiveServer, isLoadingMessages, validationMessagesData, validationMessagesError]);

  // Aggregate all messages from all resources for navigation
  const allMessages = useMemo(() => {
    if (!validationMessagesData) return [];
    
    const messages: any[] = [];
    validationMessagesData.forEach(resourceData => {
      if (resourceData.messages) {
        messages.push(...resourceData.messages);
      }
    });
    
    // Sort by severity: errors first, then warnings, then information
    return messages.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, information: 2 };
      const aOrder = severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
      const bOrder = severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
      return aOrder - bOrder;
    });
  }, [validationMessagesData]);

  // Group messages by aspect for the ValidationMessagesCard, filtered by current severity
  const messagesByAspect = useMemo(() => {
    if (!validationMessagesData) return [];
    
    const aspectMap = new Map<string, any[]>();
    
    validationMessagesData.forEach(resourceData => {
      if (resourceData.aspects) {
        resourceData.aspects.forEach((aspect: any) => {
          if (aspect.messages && aspect.messages.length > 0) {
            const aspectKey = aspect.aspect;
            if (!aspectMap.has(aspectKey)) {
              aspectMap.set(aspectKey, []);
            }
            
            // Add resource context to each message and filter by current severity
            aspect.messages.forEach((message: any) => {
              // Only include messages that match the current severity
              if (message.severity.toLowerCase() === currentSeverity.toLowerCase()) {
                aspectMap.get(aspectKey)!.push({
                  ...message,
                  resourceType: resourceData.resourceType,
                  resourceId: resourceData.resourceId
                });
              }
            });
          }
        });
      }
    });
    
    // Convert map to array and sort aspects
    const aspectOrder = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    return aspectOrder
      .filter(aspect => aspectMap.has(aspect) && aspectMap.get(aspect)!.length > 0)
      .map(aspect => ({
        aspect,
        messages: aspectMap.get(aspect)!.sort((a, b) => {
          const severityOrder = { error: 0, warning: 1, information: 2 };
          const aOrder = severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
          const bOrder = severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
          return aOrder - bOrder;
        })
      }));
  }, [validationMessagesData, currentSeverity]);

  // Update aggregated messages when allMessages changes
  useEffect(() => {
    setAggregatedMessages(allMessages);
    // Reset current index if it's out of bounds
    if (currentMessageIndex >= allMessages.length) {
      setCurrentMessageIndex(Math.max(0, allMessages.length - 1));
    }
  }, [allMessages, currentMessageIndex]);

  // Clear message navigation when all filters are turned off
  useEffect(() => {
    const hasActiveFilters = 
      validationFilters.severities.length > 0 || 
      validationFilters.aspects.length > 0 || 
      validationFilters.hasIssuesOnly ||
      (validationFilters.issueFilter && Object.keys(validationFilters.issueFilter).length > 0);
    
    if (!hasActiveFilters) {
      // Clear message navigation state when no filters are active
      setCurrentMessageIndex(0);
      setCurrentSeverityIndex({ error: 0, warning: 0, information: 0 });
      setIsMessagesVisible(false);
    }
  }, [validationFilters]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Reset message navigation when page changes
    setIsMessagesVisible(false);
    setCurrentMessageIndex(0);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(0); // Reset to first page when changing page size
    setHasValidatedCurrentPage(false); // Reset validation status when changing page size
  };

  // Navigation handlers for validation messages
  const handleMessageIndexChange = (index: number) => {
    setCurrentMessageIndex(index);
  };

  const handleToggleMessages = () => {
    setIsMessagesVisible(!isMessagesVisible);
  };

  // Severity navigation handlers
  const handleSeverityChange = (severity: 'error' | 'warning' | 'information') => {
    setCurrentSeverity(severity);
    // Update the global message index to match the current severity message
    const messagesOfSeverity = allMessages.filter(msg => msg.severity.toLowerCase() === severity);
    const severityIndex = currentSeverityIndex[severity];
    const globalIndex = allMessages.findIndex(msg => msg === messagesOfSeverity[severityIndex]);
    if (globalIndex !== -1) {
      setCurrentMessageIndex(globalIndex);
    }
    // Show the messages panel when switching severity
    if (!isMessagesVisible) {
      setIsMessagesVisible(true);
    }
  };

  const handleSeverityIndexChange = (severity: 'error' | 'warning' | 'information', index: number) => {
    setCurrentSeverityIndex(prev => ({ ...prev, [severity]: index }));
    // Update the global message index
    const messagesOfSeverity = allMessages.filter(msg => msg.severity.toLowerCase() === severity);
    const globalIndex = allMessages.findIndex(msg => msg === messagesOfSeverity[index]);
    if (globalIndex !== -1) {
      setCurrentMessageIndex(globalIndex);
    }
  };

  // Get the resource that contains the current message
  const currentMessage = allMessages[currentMessageIndex];
  const currentMessageResource = currentMessage ? 
    resourcesData?.resources?.find(r => 
      r.resourceType === currentMessage.resourceType && 
      r.resourceId === currentMessage.resourceId
    ) : null;

  // Debug: Log highlighting info when it changes
  useEffect(() => {
    if (currentMessage && isMessagesVisible) {
      console.log('[ResourceBrowser] Highlighting resource:', {
        resourceType: currentMessage.resourceType,
        resourceId: currentMessage.resourceId,
        highlightedId: `${currentMessage.resourceType}/${currentMessage.resourceId}`,
        isMessagesVisible,
        currentMessageIndex,
        totalMessages: allMessages.length
      });
    }
  }, [currentMessage, isMessagesVisible, currentMessageIndex, allMessages.length]);

  // Function to simulate validation progress updates
  const simulateValidationProgress = useCallback((resourceIds: number[], resources: any[]) => {
    const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const totalAspects = aspects.length;
    
    // Initialize progress for all resources
    const initialProgress = new Map<number, any>();
    resourceIds.forEach(id => {
      const resource = resources.find(r => (r._dbId || r.id) === id);
      const progressData = {
        resourceId: id,
        fhirId: resource?.resourceId || resource?.id || String(id),
        resourceType: resource?.resourceType || 'Unknown',
        progress: 0,
        currentAspect: 'Starting validation...',
        completedAspects: [],
        totalAspects: totalAspects
      };
      initialProgress.set(id, progressData);
      
      // Report to activity context
      addResourceValidation(id, progressData);
    });
    setValidationProgress(initialProgress);

    // Simulate progress updates with more realistic timing
    let currentAspectIndex = 0;
    const updateInterval = setInterval(() => {
      let allComplete = true;
      const updatesToApply: Array<{id: number, data: any}> = [];

      setValidationProgress(prev => {
        const updated = new Map(prev);

        resourceIds.forEach(id => {
          const current = updated.get(id);
          if (current && currentAspectIndex < totalAspects) {
            // More gradual progress increase with better distribution
            const baseProgress = (currentAspectIndex / totalAspects) * 100;
            const aspectProgress = (1 / totalAspects) * 100;
            // Don't cap at 95% - let it go to 99% and stay there until completion
            const progress = Math.min(baseProgress + (aspectProgress * 0.4), 99);
            
            const completedAspects = aspects.slice(0, currentAspectIndex);
            
            const updatedData = {
              ...current,
              progress: Math.min(progress, 99), // Don't show 100% until actually complete
              currentAspect: currentAspectIndex < totalAspects ? `Validating ${aspects[currentAspectIndex]}...` : 'Completing...',
              completedAspects: completedAspects
            };
            
            updated.set(id, updatedData);
            updatesToApply.push({id, data: updatedData});

            if (currentAspectIndex < totalAspects) {
              allComplete = false;
            }
          }
        });

        if (allComplete) {
          clearInterval(updateInterval);
        }

        return updated;
      });

      // Update activity context outside of state setter
      updatesToApply.forEach(({id, data}) => {
        updateResourceValidation(id, {
          progress: data.progress,
          currentAspect: data.currentAspect,
          completedAspects: data.completedAspects
        });
      });

      currentAspectIndex++;
    }, 600); // Faster updates to prevent hanging

    // Safety timeout: force cleanup after 30 seconds to prevent indefinite hanging
    const safetyTimeout = setTimeout(() => {
      clearInterval(updateInterval);
      // Remove all resources from activity context
      resourceIds.forEach(id => {
        removeResourceValidation(id);
      });
      setValidationProgress(new Map());
    }, 30000); // 30 second timeout

    // Return cleanup function
    return () => {
      clearInterval(updateInterval);
      clearTimeout(safetyTimeout);
    };
  }, [addResourceValidation, updateResourceValidation, removeResourceValidation]);

  // Function to validate resources on the current page
  const validateCurrentPage = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) {
      return;
    }

    setIsValidating(true);
    
    // Track which resources are being validated
    const resourceIds = resourcesData.resources.map((resource: any) => resource._dbId || resource.id);
    setValidatingResourceIds(new Set(resourceIds));
    
    // Start progress simulation
    const progressCleanup = simulateValidationProgress(resourceIds, resourcesData.resources);
    
    try {

      // Batch validation requests using settings batch size
      const batchSize = currentSettings?.performance?.batchSize || 50;
      const allResults = [];
      const totalBatches = Math.ceil(resourcesData.resources.length / batchSize);
      
      for (let i = 0; i < resourcesData.resources.length; i += batchSize) {
        const batch = resourcesData.resources.slice(i, i + batchSize);
        const batchNumber = Math.floor(i/batchSize) + 1;
        
        console.log(`[Validation] Processing batch ${batchNumber}/${totalBatches} with ${batch.length} resources`);
        
        // Update progress to show current batch being processed
        setValidationProgress(prev => {
          const updated = new Map(prev);
          resourceIds.forEach(id => {
            const current = updated.get(id);
            if (current) {
              const batchProgress = (batchNumber / totalBatches) * 100;
              updated.set(id, {
                ...current,
                progress: Math.min(batchProgress, 99),
                currentAspect: `Processing batch ${batchNumber}/${totalBatches}...`
              });
            }
          });
          return updated;
        });
        
        // Create a timeout promise for the fetch request
        const fetchWithTimeout = (url: string, options: any, timeoutMs: number = 120000): Promise<Response> => {
          return Promise.race([
            fetch(url, options),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);
        };

        try {
          const response = await fetchWithTimeout('/api/validation/validate-by-ids', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // Send only the minimal required data to reduce payload size
              resources: batch.map((resource: any) => ({
                _dbId: resource._dbId || resource.id,
                resourceType: resource.resourceType,
                resourceId: resource.resourceId || resource.id
              }))
            })
          }, 120000); // 2 minute timeout per batch

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Validation] Batch ${batchNumber} failed: ${response.status} ${response.statusText}`, errorText);
            // Continue with other batches even if one fails
            continue;
          }

          const batchResult = await response.json();
          allResults.push(...(batchResult.detailedResults || []));
          console.log(`[Validation] Batch ${batchNumber} completed successfully`);
        } catch (error) {
          console.error(`[Validation] Batch ${batchNumber} error:`, error);
          // Continue with other batches even if one fails
          continue;
        }

        // Add a small delay between batches to reduce server load
        if (i + batchSize < resourcesData.resources.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Combine all batch results
      const result = {
        success: true,
        validatedCount: allResults.length,
        requestedCount: resourcesData.resources.length,
        message: `Successfully validated ${allResults.length} out of ${resourcesData.resources.length} resources`,
        detailedResults: allResults
      };
      

      // Mark resources as validated in cache
      if (result.validatedCount > 0) {
        resourcesData.resources.forEach((resource: any) => {
          const cacheKey = `${resource.resourceType}/${resource.id}`;
          validatedResourcesCache.add(cacheKey);
        });
      }

      // Clear the progress simulation and show completion
      if (progressCleanup) {
        progressCleanup();
      }
      
      // Show completion state briefly before clearing
      setValidationProgress(prev => {
        const completed = new Map(prev);
        resourceIds.forEach(id => {
          const current = completed.get(id);
          if (current) {
            completed.set(id, {
              ...current,
              progress: 100,
              currentAspect: 'Validation complete'
            });
          }
        });
        return completed;
      });

      // Update activity context with completion (outside of state setter)
      resourceIds.forEach(id => {
        updateResourceValidation(id, {
          progress: 100,
          currentAspect: 'Validation complete'
        });
      });

      // Clear progress after showing completion
      setTimeout(() => {
        setValidationProgress(new Map());
        // Remove from activity context
        resourceIds.forEach(id => removeResourceValidation(id));
      }, 1500);

      // No need to refetch - validation results are already in the server response
      // and will be reflected on the next natural data update

    } catch (error) {
      // Clear progress on error
      if (progressCleanup) {
        progressCleanup();
      }
      setValidationProgress(new Map());
      // Remove from activity context on error - make sure to clear immediately
      resourceIds.forEach(id => {
        removeResourceValidation(id);
      });
      // You could add a toast notification here for user feedback
    } finally {
      setIsValidating(false);
      setValidatingResourceIds(new Set()); // Clear validating state
    }
  }, [resourcesData, resourceType, page, queryClient, simulateValidationProgress, updateResourceValidation, removeResourceValidation]);

  // Function to check if resources need validation and validate them automatically
  const validateUnvalidatedResources = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) {
      return;
    }

    // Don't start validation if already validating
    if (isValidating || validatingResourceIds.size > 0) {
      return;
    }

    // Check if any resources need validation (only based on database results)
    const unvalidatedResources = resourcesData.resources.filter((resource: any) => {
      const validationSummary = resource._validationSummary;
      
      // Only consider a resource validated if it has actual validation data from the database
      const hasValidationData = validationSummary?.lastValidated;
      
      if (hasValidationData) {
        // Check if validation is recent enough (within last 5 minutes)
        const lastValidated = new Date(validationSummary.lastValidated);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const isRecent = lastValidated > fiveMinutesAgo;
        
        if (isRecent) {
          return false;
        } else {
          return true;
        }
      }
      
      return !hasValidationData;
    });

    if (unvalidatedResources.length === 0) {
      // Show a brief notification that all resources are validated
      // This helps users understand why no validation is happening
      return;
    }


    // Track which resources are being validated
    const resourceIds = unvalidatedResources.map((resource: any) => resource._dbId || resource.id);
    setValidatingResourceIds(new Set(resourceIds));

    // Start progress simulation for background validation
    const progressCleanup = simulateValidationProgress(resourceIds, unvalidatedResources);

    // Use the new validate-by-ids endpoint with batching for background validation
    try {
      // Batch background validation requests using settings batch size
      const batchSize = currentSettings?.performance?.batchSize || 50;
      const allResults = [];
      
      for (let i = 0; i < unvalidatedResources.length; i += batchSize) {
        const batch = unvalidatedResources.slice(i, i + batchSize);
        const batchNumber = Math.floor(i/batchSize) + 1;
        
        console.log(`[Background Validation] Processing batch ${batchNumber} with ${batch.length} resources`);
        
        try {
          const response = await fetch('/api/validation/validate-by-ids', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // Send only the minimal required data to reduce payload size
              resources: batch.map((resource: any) => ({
                _dbId: resource._dbId || resource.id,
                resourceType: resource.resourceType,
                resourceId: resource.resourceId || resource.id
              }))
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Background Validation] Batch ${batchNumber} failed: ${response.status} ${response.statusText}`, errorText);
            // Continue with other batches even if one fails
            continue;
          }

          const batchResult = await response.json();
          allResults.push(...(batchResult.detailedResults || []));
          console.log(`[Background Validation] Batch ${batchNumber} completed successfully`);
        } catch (error) {
          console.error(`[Background Validation] Batch ${batchNumber} error:`, error);
          // Continue with other batches even if one fails
          continue;
        }

        // Add a small delay between batches to reduce server load
        if (i + batchSize < unvalidatedResources.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Combine all batch results
      const result = {
        success: true,
        validatedCount: allResults.length,
        requestedCount: unvalidatedResources.length,
        message: `Successfully validated ${allResults.length} out of ${unvalidatedResources.length} resources`,
        detailedResults: allResults
      };
      

      // Only add resources to cache if validation was actually successful
      if (result.validatedCount > 0) {
        // Mark resources as validated in cache
        unvalidatedResources.forEach((resource: any) => {
          const cacheKey = `${resource.resourceType}/${resource.id}`;
          validatedResourcesCache.add(cacheKey);
        });
      }

      // Clear the progress simulation and show completion
      if (progressCleanup) {
        progressCleanup();
      }
      
      // Show completion state briefly before clearing
      setValidationProgress(prev => {
        const completed = new Map(prev);
        resourceIds.forEach(id => {
          const current = completed.get(id);
          if (current) {
            const completedData = {
              ...current,
              progress: 100,
              currentAspect: 'Validation complete'
            };
            completed.set(id, completedData);
          }
        });
        return completed;
      });

      // Update activity context with completion (outside of state setter)
      resourceIds.forEach(id => {
        updateResourceValidation(id, {
          progress: 100,
          currentAspect: 'Validation complete'
        });
      });

      // Refetch immediately - validation is already complete and stored in DB
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      
      // Clear progress after showing completion briefly
      setTimeout(() => {
        setValidationProgress(new Map());
        // Remove from activity context
        resourceIds.forEach(id => removeResourceValidation(id));
        
        // One more refetch to catch any async DB writes
        queryClient.invalidateQueries({ queryKey: ['resources'] });
      }, 500);

      // Mark this page as validated only after successful validation
      setHasValidatedCurrentPage(true);

    } catch (error) {
      if (progressCleanup) {
        progressCleanup();
      }
      setValidationProgress(new Map());
      // Remove from activity context on error
      resourceIds.forEach(id => removeResourceValidation(id));
      // Don't show error to user for background validation
    } finally {
      setValidatingResourceIds(new Set()); // Clear validating state
    }
  }, [resourcesData, queryClient, simulateValidationProgress, removeResourceValidation, updateResourceValidation]);

  // Reset validation flag when page or resource type changes
  useEffect(() => {
    setHasValidatedCurrentPage(false);
  }, [resourceType, page]);

  // Listen for cache clearing events
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).onCacheCleared) {
      (window as any).onCacheCleared(() => {
        setCacheCleared(true);
        setHasValidatedCurrentPage(false);
        // Force revalidation of current page resources
        if (resourcesData?.resources && resourcesData.resources.length > 0) {
          setTimeout(() => {
            validateCurrentPage();
          }, 100);
        }
      });
    }
  }, [resourcesData?.resources]);

  // Auto-validate resources when they're loaded
  useEffect(() => {
    if (resourcesData?.resources && resourcesData.resources.length > 0 && !hasValidatedCurrentPage && !isValidating) {
      // Validate unvalidated resources with a short delay to allow UI to render
      const timer = setTimeout(() => {
        validateUnvalidatedResources();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [resourcesData?.resources?.length, resourceType, page, hasValidatedCurrentPage, isValidating, validateUnvalidatedResources]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: ValidationFilters) => {
    setValidationFilters(newFilters);
    setPage(0);
    
    // Update URL with new filters
    const urlParams = new URLSearchParams(window.location.search);
    if (resourceType && resourceType !== "all") {
      urlParams.set('type', resourceType);
    }
    if (searchQuery) {
      urlParams.set('search', searchQuery);
    }
    if (newFilters.aspects.length > 0) {
      urlParams.set('aspects', newFilters.aspects.join(','));
    } else {
      urlParams.delete('aspects');
    }
    if (newFilters.severities.length > 0) {
      urlParams.set('severities', newFilters.severities.join(','));
    } else {
      urlParams.delete('severities');
    }
    // Handle issue-based filters
    if (newFilters.issueFilter) {
      if (newFilters.issueFilter.issueIds && newFilters.issueFilter.issueIds.length > 0) {
        urlParams.set('issueIds', newFilters.issueFilter.issueIds.join(','));
      } else {
        urlParams.delete('issueIds');
      }
      if (newFilters.issueFilter.severity) {
        urlParams.set('issueSeverity', newFilters.issueFilter.severity);
      } else {
        urlParams.delete('issueSeverity');
      }
      if (newFilters.issueFilter.category) {
        urlParams.set('issueCategory', newFilters.issueFilter.category);
      } else {
        urlParams.delete('issueCategory');
      }
      if (newFilters.issueFilter.messageContains) {
        urlParams.set('issueMessageContains', newFilters.issueFilter.messageContains);
      } else {
        urlParams.delete('issueMessageContains');
      }
      if (newFilters.issueFilter.pathContains) {
        urlParams.set('issuePathContains', newFilters.issueFilter.pathContains);
      } else {
        urlParams.delete('issuePathContains');
      }
    } else {
      // Clear all issue filter params if no issue filter
      urlParams.delete('issueIds');
      urlParams.delete('issueSeverity');
      urlParams.delete('issueCategory');
      urlParams.delete('issueMessageContains');
      urlParams.delete('issuePathContains');
    }
    if (newFilters.hasIssuesOnly) {
      urlParams.set('hasIssues', 'true');
    } else {
      urlParams.delete('hasIssues');
    }
    
    // Handle FHIR search parameters
    if (newFilters.fhirSearchParams && Object.keys(newFilters.fhirSearchParams).length > 0) {
      Object.entries(newFilters.fhirSearchParams).forEach(([key, config]) => {
        if (config.value) {
          const paramKey = config.operator ? `${key}:${config.operator}` : key;
          const value = Array.isArray(config.value) ? config.value.join(',') : config.value;
          urlParams.set(paramKey, value);
        }
      });
    } else {
      // Remove all FHIR search parameters if none are set
      const keysToRemove: string[] = [];
      urlParams.forEach((value, key) => {
        if (!['type', 'search', 'aspects', 'severities', 'hasIssues', 'page', 'limit'].includes(key)) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(key => urlParams.delete(key));
    }
    
    const newUrl = urlParams.toString() ? `/resources?${urlParams.toString()}` : '/resources';
    window.history.pushState({}, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [resourceType, searchQuery]);

  // Handle filtering by specific issue
  const handleFilterByIssue = useCallback((issue: any) => {
    const newFilters: ValidationFilters = {
      ...validationFilters,
      issueFilter: {
        issueIds: issue.id ? [issue.id] : undefined,
        severity: issue.severity,
        category: issue.category,
        messageContains: issue.message,
        pathContains: issue.path
      }
    };
    handleFilterChange(newFilters);
  }, [validationFilters, handleFilterChange]);

  // Handle filtering by severity
  const handleFilterBySeverity = useCallback((severity: 'error' | 'warning' | 'information') => {
    // Toggle behavior: if already selected, remove it; otherwise add it
    const currentSeverities = validationFilters.severities || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter(s => s !== severity)
      : [severity]; // Replace with single severity for exclusive selection
    
    const newFilters: ValidationFilters = {
      ...validationFilters,
      severities: newSeverities,
      hasIssuesOnly: newSeverities.length > 0, // Show only resources with issues when a severity is selected
      // Clear issueFilter as we're using severities array instead
      issueFilter: undefined
    };
    handleFilterChange(newFilters);
  }, [validationFilters, handleFilterChange]);

  // Clear validation filters when messages panel is hidden (preserve FHIR params)
  useEffect(() => {
    const hasValidationFilters = (
      validationFilters.severities.length > 0 ||
      validationFilters.aspects.length > 0 ||
      validationFilters.hasIssuesOnly ||
      (validationFilters.issueFilter && Object.keys(validationFilters.issueFilter).length > 0)
    );
    if (!isMessagesVisible && hasValidationFilters) {
      // Only clear issueFilter, keep severities and aspects for persistent filtering
      handleFilterChange({
        ...validationFilters,
        aspects: [],
        // severities: [], // KEEP severities for persistent filtering
        hasIssuesOnly: validationFilters.severities.length > 0, // Keep hasIssuesOnly if severities are active
        issueFilter: undefined
        // fhirSearchParams preserved via spread
      });
    }
  }, [isMessagesVisible, validationFilters, handleFilterChange]);

  // Handle revalidation of current page
  const handleRevalidate = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) {
      toast({
        title: "No resources to revalidate",
        description: "The current page has no resources.",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    
    // Track which resources are being validated
    const resourceIds = resourcesData.resources.map((r: any) => r._dbId || r.id);
    setValidatingResourceIds(new Set(resourceIds));

    // Start progress simulation for activity widget
    const progressCleanup = simulateValidationProgress(resourceIds, resourcesData.resources);
    
    try {
      // Use the same synchronous validate-by-ids approach as background validation
      const batchSize = currentSettings?.performance?.batchSize || 50;
      const allResults = [];
      
      for (let i = 0; i < resourcesData.resources.length; i += batchSize) {
        const batch = resourcesData.resources.slice(i, i + batchSize);
        const batchNumber = Math.floor(i/batchSize) + 1;
        
        console.log(`[Manual Revalidation] Processing batch ${batchNumber} with ${batch.length} resources`);
        
        try {
          const response = await fetch('/api/validation/validate-by-ids', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              resources: batch.map((resource: any) => ({
                _dbId: resource._dbId || resource.id,
                resourceType: resource.resourceType,
                resourceId: resource.resourceId || resource.id
              }))
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Manual Revalidation] Batch ${batchNumber} failed:`, errorText);
            continue;
          }

          const batchResult = await response.json();
          allResults.push(...(batchResult.detailedResults || []));
          console.log(`[Manual Revalidation] Batch ${batchNumber} completed successfully`);
        } catch (error) {
          console.error(`[Manual Revalidation] Batch ${batchNumber} error:`, error);
          continue;
        }

        // Small delay between batches to reduce server load
        if (i + batchSize < resourcesData.resources.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update activity context with completion
      resourceIds.forEach(id => {
        updateResourceValidation(id, {
          progress: 100,
          currentAspect: 'Validation complete'
        });
      });

      // Validation complete - refetch immediately to show results
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      
      toast({
        title: "Revalidation complete",
        description: `Successfully revalidated ${allResults.length} resources.`,
      });

      // Clear progress after showing completion briefly
      setTimeout(() => {
        if (progressCleanup) {
          progressCleanup();
        }
        setValidationProgress(new Map());
        resourceIds.forEach(id => removeResourceValidation(id));
        setIsValidating(false);
        setValidatingResourceIds(new Set());
      }, 500);

    } catch (error) {
      // Clean up progress on error
      if (progressCleanup) {
        progressCleanup();
      }
      resourceIds.forEach(id => removeResourceValidation(id));
      
      toast({
        title: "Revalidation failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
      setIsValidating(false);
      setValidatingResourceIds(new Set());
    }
  }, [resourcesData, currentSettings, queryClient, toast, simulateValidationProgress, updateResourceValidation, removeResourceValidation]);

  // Calculate validation summary for current page (with stats for filters)
  const validationSummaryWithStats = useMemo(() => {
    if (!resourcesData?.resources) {
      return {
        totalResources: 0,
        validatedCount: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        aspectStats: {},
        severityStats: {},
      };
    }

    // Count all resources on the current page (backend now loads exactly 20 per page)
    const totalResources = resourcesData.resources.length;
    const validatedResources = resourcesData.resources.filter((r: any) => r._validationSummary?.lastValidated);
    
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    // Initialize aspect stats with the aspect IDs expected by the frontend component
    const aspectStats: { [key: string]: { valid: number; invalid: number; warnings: number; total: number } } = {
      structural: { valid: 0, invalid: 0, warnings: 0, total: 0 },
      profile: { valid: 0, invalid: 0, warnings: 0, total: 0 },
      terminology: { valid: 0, invalid: 0, warnings: 0, total: 0 },
      reference: { valid: 0, invalid: 0, warnings: 0, total: 0 },
      businessRule: { valid: 0, invalid: 0, warnings: 0, total: 0 },
      metadata: { valid: 0, invalid: 0, warnings: 0, total: 0 },
    };

    // Initialize severity stats
    const severityStats: { [key: string]: { count: number; resourceCount: number } } = {
      error: { count: 0, resourceCount: 0 },
      warning: { count: 0, resourceCount: 0 },
      information: { count: 0, resourceCount: 0 },
    };

    validatedResources.forEach((r: any) => {
      if (r._validationSummary) {
        // Apply filtering to only count issues from enabled aspects
        const filteredSummary = getFilteredValidationSummary(r._validationSummary, currentSettings);
        
        const resourceErrors = filteredSummary.errorCount || 0;
        const resourceWarnings = filteredSummary.warningCount || 0;
        const resourceInfo = filteredSummary.informationCount || 0;

        errorCount += resourceErrors;
        warningCount += resourceWarnings;
        infoCount += resourceInfo;

        // Count resources with each severity
        if (resourceErrors > 0) {
          severityStats.error.count += resourceErrors;
          severityStats.error.resourceCount += 1;
        }
        if (resourceWarnings > 0) {
          severityStats.warning.count += resourceWarnings;
          severityStats.warning.resourceCount += 1;
        }
        if (resourceInfo > 0) {
          severityStats.information.count += resourceInfo;
          severityStats.information.resourceCount += 1;
        }

        // Process aspect breakdown for this resource (use filtered data)
        if (filteredSummary.aspectBreakdown && typeof filteredSummary.aspectBreakdown === 'object') {
          // Map backend aspect keys to frontend keys
          const aspectMapping: { [key: string]: string } = {
            'structural': 'structural',
            'profile': 'profile',
            'terminology': 'terminology',
            'reference': 'reference',
            'business-rule': 'businessRule',
            'businessRule': 'businessRule',
            'metadata': 'metadata',
          };

          Object.keys(filteredSummary.aspectBreakdown).forEach((backendAspect: string) => {
            const frontendAspect = aspectMapping[backendAspect] || backendAspect;
            const aspectData = filteredSummary.aspectBreakdown?.[backendAspect];
            
            if (aspectData && typeof aspectData === 'object' && aspectStats[frontendAspect]) {
              const hasErrors = (Number(aspectData.errorCount) || 0) > 0;
              const hasWarnings = (Number(aspectData.warningCount) || 0) > 0;
              
              aspectStats[frontendAspect].total += 1;
              
              if (hasErrors) {
                aspectStats[frontendAspect].invalid += 1;
              } else if (hasWarnings) {
                aspectStats[frontendAspect].warnings += 1;
              } else {
                aspectStats[frontendAspect].valid += 1;
              }
            }
          });
        }
      }
    });

    return {
      totalResources,
      validatedCount: validatedResources.length,
      errorCount,
      warningCount,
      infoCount,
      aspectStats,
      severityStats,
    };
  }, [resourcesData, currentSettings]);

  // Create simplified validation summary for overview (without stats)
  const validationSummary: ValidationSummary = useMemo(() => ({
    totalResources: validationSummaryWithStats.totalResources,
    validatedCount: validationSummaryWithStats.validatedCount,
    errorCount: validationSummaryWithStats.errorCount,
    warningCount: validationSummaryWithStats.warningCount,
    infoCount: validationSummaryWithStats.infoCount,
  }), [validationSummaryWithStats]);

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Full width blocks above - always stretch full width */}
      <div className="space-y-6">
        {/* Resource Search with integrated filters */}
        <ResourceSearch 
          resourceTypes={resourceTypes || []}
          onSearch={handleSearch}
          defaultResourceType={resourceType}
          defaultQuery={searchQuery}
          filters={validationFilters}
          onFilterChange={handleFilterChange}
          validationSummary={validationSummaryWithStats}
          activeServer={stableActiveServer ? {
            name: stableActiveServer.name,
            url: stableActiveServer.url
          } : undefined}
        />

        {/* Validation Overview and Selection Action Bar */}
        <div className="flex items-center justify-between">
          {/* Left side - Validation Overview */}
          {resourcesData?.resources && resourcesData.resources.length > 0 ? (
            <ValidationOverview
              validationSummary={validationSummary}
              onRevalidate={handleRevalidate}
              isRevalidating={isValidating}
              messages={allMessages}
              currentMessageIndex={currentMessageIndex}
              onMessageIndexChange={handleMessageIndexChange}
              onToggleMessages={handleToggleMessages}
              isMessagesVisible={isMessagesVisible}
              currentSeverity={currentSeverity}
              onSeverityChange={handleSeverityChange}
              currentSeverityIndex={currentSeverityIndex}
              onSeverityIndexChange={handleSeverityIndexChange}
              onFilterByIssue={handleFilterByIssue}
              onFilterBySeverity={handleFilterBySeverity}
            />
          ) : (
            <div></div>
          )}

          {/* Right side - Selection Action Bar */}
          <div className="flex items-center gap-3">
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={toggleSelectionMode}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              {selectionMode ? "Exit Selection" : "Select"}
            </Button>
            
            {selectionMode && selectedResources.size > 0 && (
              <>
                <Badge variant="secondary" className="text-sm">
                  {selectedResources.size} selected
                </Badge>
                <Button
                  size="sm"
                  onClick={handleBatchEdit}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Batch Edit
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid layout for ResourceList and ValidationMessagesCard */}
      <div className={isMessagesVisible ? "grid gap-6 mt-6" : "mt-6"} style={isMessagesVisible ? { gridTemplateColumns: '2fr 1fr' } : {}}>
        {/* Left side - Resource List */}
        <div>
        
        {/* Only show skeleton on initial load, not during refetch */}
        {isLoading && !resourcesData ? (
          <div className="space-y-4">
            {Array.from({ length: pageSize }, (_, i) => i + 1).map(i => (
              <div key={i} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {/* Resource type icon skeleton */}
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    
                    {/* Resource details skeleton */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-16" /> {/* Resource type */}
                        <Skeleton className="h-4 w-20" /> {/* Resource ID */}
                      </div>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-48" /> {/* Resource name/description */}
                        <Skeleton className="h-3 w-32" /> {/* Last updated */}
                      </div>
                    </div>
                  </div>
                  
                  {/* Validation status skeleton */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" /> {/* Validation badge */}
                      <Skeleton className="h-8 w-8 rounded-full" /> {/* Progress circle */}
                    </div>
                    <Skeleton className="h-4 w-4" /> {/* Chevron */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ResourceList 
            resources={resourcesData?.resources || []}
            total={resourcesData?.total || 0}
            page={page}
            onPageChange={handlePageChange}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            validatingResourceIds={validatingResourceIds}
            validationProgress={validationProgress}
            availableResourceTypes={resourcesData?.availableResourceTypes}
            isLoading={isLoading}
            noResourceTypeMessage={undefined} // Don't show "Select a Resource Type" for filtered queries
            selectionMode={selectionMode}
            selectedIds={selectedResources}
            onSelectionChange={handleSelectionChange}
            highlightedResourceId={
              currentMessage && isMessagesVisible
                ? `${currentMessage.resourceType}/${currentMessage.resourceId}` 
                : undefined
            }
          />
        )}
        </div>

        {/* Right side - Validation Messages Card */}
        {isMessagesVisible && (
          <div className="sticky top-20 self-start">
            <ValidationMessagesCard
              aspects={messagesByAspect}
              highlightSignature={allMessages[currentMessageIndex]?.signature}
              title="Validation Messages"
              description={`${allMessages.filter(msg => msg.severity.toLowerCase() === currentSeverity).length} ${currentSeverity} messages from ${resourcesData?.resources?.length || 0} resources`}
              isLoading={isLoadingMessages}
              severityFilter={[currentSeverity]}
            />
          </div>
        )}
      </div>

      {/* Batch Edit Dialog - outside grid layout */}
      <BatchEditDialog
        open={batchEditDialogOpen}
        onOpenChange={setBatchEditDialogOpen}
        selectedResources={Array.from(selectedResources).map(key => {
          const [resourceType, id] = key.split('/');
          return { resourceType, id };
        })}
        onComplete={handleBatchEditComplete}
      />
    </div>
  );
}
