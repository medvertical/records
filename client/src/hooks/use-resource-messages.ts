/**
 * Resource Messages Hook
 * 
 * This hook provides access to validation messages for specific resources
 * with filtering, pagination, and real-time updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

// ============================================================================
// Types
// ============================================================================

export interface ValidationMessage {
  /** Unique identifier for the message */
  id: string;
  
  /** Message severity level */
  severity: 'error' | 'warning' | 'information';
  
  /** Validation aspect that generated this message */
  aspect: 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';
  
  /** Error/warning code */
  code: string;
  
  /** Canonical path to the element in the resource */
  canonicalPath: string;
  
  /** Human-readable message text */
  text: string;
  
  /** Message signature for grouping */
  signature: string;
  
  /** Signature version */
  signatureVersion: string;
  
  /** Timestamp when message was created */
  createdAt: Date;
  
  /** Additional context data */
  context?: Record<string, any>;
}

export interface ResourceMessagesOptions {
  /** Whether to enable automatic polling */
  enablePolling?: boolean;
  
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  
  /** Whether to show loading states */
  showLoading?: boolean;
  
  /** Filter by severity levels */
  severityFilter?: ('error' | 'warning' | 'information')[];
  
  /** Filter by validation aspects */
  aspectFilter?: ('structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata')[];
  
  /** Filter by message codes */
  codeFilter?: string[];
  
  /** Filter by canonical path patterns */
  pathFilter?: string[];
  
  /** Whether to include only messages with issues */
  hasIssuesOnly?: boolean;
  
  /** Page size for pagination */
  pageSize?: number;
  
  /** Current page number */
  page?: number;
  
  /** Sort order */
  sortBy?: 'severity' | 'aspect' | 'code' | 'path' | 'createdAt';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

export interface ResourceMessagesState {
  /** Current messages data */
  messages: ValidationMessage[];
  
  /** Total number of messages */
  totalCount: number;
  
  /** Current page number */
  currentPage: number;
  
  /** Total number of pages */
  totalPages: number;
  
  /** Whether data is loading */
  isLoading: boolean;
  
  /** Error message if any */
  error: string | null;
  
  /** Last successful fetch timestamp */
  lastUpdated: Date | null;
  
  /** Whether polling is active */
  isPolling: boolean;
}

export interface ResourceMessagesActions {
  /** Manually refresh messages data */
  refresh: () => void;
  
  /** Start polling for updates */
  startPolling: () => void;
  
  /** Stop polling for updates */
  stopPolling: () => void;
  
  /** Clear error state */
  clearError: () => void;
  
  /** Update filters */
  updateFilters: (filters: Partial<ResourceMessagesOptions>) => void;
  
  /** Go to specific page */
  goToPage: (page: number) => void;
  
  /** Go to next page */
  nextPage: () => void;
  
  /** Go to previous page */
  previousPage: () => void;
}

// ============================================================================
// Resource Messages Hook
// ============================================================================

export function useResourceMessages(
  resourceType: string,
  resourceId: string,
  options: ResourceMessagesOptions = {}
): ResourceMessagesState & ResourceMessagesActions {
  const {
    enablePolling = false,
    pollingInterval = 30000,
    showLoading = true,
    severityFilter = [],
    aspectFilter = [],
    codeFilter = [],
    pathFilter = [],
    hasIssuesOnly = false,
    pageSize = 50,
    page = 1,
    sortBy = 'severity',
    sortOrder = 'desc'
  } = options;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(enablePolling);
  const [currentPage, setCurrentPage] = useState(page);

  // Query key for React Query
  const queryKey = [
    'resource-messages',
    resourceType,
    resourceId,
    severityFilter,
    aspectFilter,
    codeFilter,
    pathFilter,
    hasIssuesOnly,
    pageSize,
    currentPage,
    sortBy,
    sortOrder
  ];

  // Fetch resource messages
  const {
    data: messagesData,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        ...(severityFilter.length > 0 && { severity: severityFilter.join(',') }),
        ...(aspectFilter.length > 0 && { aspect: aspectFilter.join(',') }),
        ...(codeFilter.length > 0 && { code: codeFilter.join(',') }),
        ...(pathFilter.length > 0 && { path: pathFilter.join(',') }),
        ...(hasIssuesOnly && { hasIssues: 'true' }),
      });

      const response = await fetch(`/api/validation/resources/${resourceType}/${resourceId}/messages?${params}`);
      if (!response.ok) {
        if (response.status === 404) {
          return { messages: [], totalCount: 0, totalPages: 0 };
        }
        throw new Error(`Failed to fetch resource messages: ${response.statusText}`);
      }
      return await response.json();
    },
    enabled: !!resourceType && !!resourceId,
    refetchInterval: isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  // Manual refresh function
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    queryClient.setQueryData(queryKey, (oldData: any) => oldData);
  }, [queryClient, queryKey]);

  // Update filters
  const updateFilters = useCallback((filters: Partial<ResourceMessagesOptions>) => {
    // This would typically update the options and trigger a new query
    // For now, we'll just invalidate the cache to force a refetch
    queryClient.invalidateQueries({ queryKey: ['resource-messages', resourceType, resourceId] });
  }, [queryClient, resourceType, resourceId]);

  // Go to specific page
  const goToPage = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  // Go to next page
  const nextPage = useCallback(() => {
    if (messagesData && currentPage < messagesData.totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [messagesData, currentPage]);

  // Go to previous page
  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (enablePolling) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [enablePolling, startPolling, stopPolling]);

  // Update current page when page prop changes
  useEffect(() => {
    setCurrentPage(page);
  }, [page]);

  return {
    // State
    messages: messagesData?.messages || [],
    totalCount: messagesData?.totalCount || 0,
    currentPage,
    totalPages: messagesData?.totalPages || 0,
    isLoading: showLoading ? isLoading : false,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
    updateFilters,
    goToPage,
    nextPage,
    previousPage,
  };
}

/**
 * Hook for accessing validation messages for multiple resources
 */
export function useResourceMessagesBatch(
  resourceIds: Array<{ type: string; id: string }>,
  options: ResourceMessagesOptions = {}
) {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const {
    enablePolling = false,
    pollingInterval = 30000,
    showLoading = true,
    severityFilter = [],
    aspectFilter = [],
    codeFilter = [],
    pathFilter = [],
    hasIssuesOnly = false,
    pageSize = 50,
    page = 1,
    sortBy = 'severity',
    sortOrder = 'desc'
  } = options;

  // Query key for batch results
  const queryKey = [
    'resource-messages-batch',
    resourceIds.map(r => `${r.type}:${r.id}`).sort().join(','),
    severityFilter,
    aspectFilter,
    codeFilter,
    pathFilter,
    hasIssuesOnly,
    pageSize,
    page,
    sortBy,
    sortOrder
  ];

  // Fetch batch resource messages
  const {
    data: messagesData,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (resourceIds.length === 0) return {};

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        ...(severityFilter.length > 0 && { severity: severityFilter.join(',') }),
        ...(aspectFilter.length > 0 && { aspect: aspectFilter.join(',') }),
        ...(codeFilter.length > 0 && { code: codeFilter.join(',') }),
        ...(pathFilter.length > 0 && { path: pathFilter.join(',') }),
        ...(hasIssuesOnly && { hasIssues: 'true' }),
      });

      const response = await fetch(`/api/validation/resources/batch/messages?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch batch resource messages: ${response.statusText}`);
      }

      return await response.json();
    },
    enabled: resourceIds.length > 0,
    refetchInterval: enablePolling && isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    gcTime: 300000,
  });

  // Manual refresh function
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    queryClient.setQueryData(queryKey, (oldData: any) => oldData);
  }, [queryClient, queryKey]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (enablePolling) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [enablePolling, startPolling, stopPolling]);

  return {
    // State
    messages: messagesData || {},
    isLoading: showLoading ? isLoading : false,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
  };
}

export default useResourceMessages;

