import { useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ValidationFilters } from '@/components/resources/resource-search';
import type { ResourceBrowserState } from './use-resource-browser-state';

export interface UrlSyncHandlers {
  handleSearch: (
    query: string,
    type: string,
    fhirParams?: Record<string, { value: string | string[]; operator?: string }>,
    sortParam?: string
  ) => void;
  handlePageChange: (newPage: number) => void;
  handlePageSizeChange: (newPageSize: number) => void;
}

/**
 * Hook for synchronizing URL parameters with component state
 * Handles URL parsing, state updates, and search functionality
 */
export function useUrlSync(
  state: ResourceBrowserState,
  location: string
): UrlSyncHandlers {
  const queryClient = useQueryClient();
  
  const {
    resourceType,
    searchQuery,
    page,
    pageSize,
    sort,
    validationFilters,
    setResourceType,
    setSearchQuery,
    setPage,
    setPageSize,
    setSort,
    setValidationFilters,
    setHasValidatedCurrentPage,
  } = state;
  
  // Handle search with URL update and query invalidation
  const handleSearch = useCallback((
    query: string,
    type: string,
    fhirParams?: Record<string, { value: string | string[]; operator?: string }>,
    sortParam?: string
  ) => {
    // Determine the final sort value to use
    const finalSort = sortParam !== undefined ? sortParam : sort;
    
    // Use flushSync to force synchronous state updates before invalidating query
    flushSync(() => {
      setSearchQuery(query);
      setResourceType(type);
      setPage(0);
      
      // Update sort state if provided
      if (sortParam !== undefined) {
        setSort(sortParam);
      }
    });
    
    // Update URL to reflect the search parameters
    const searchParams = new URLSearchParams();
    if (type && type !== "all") {
      searchParams.set('resourceType', type);
    }
    if (query) {
      searchParams.set('search', query);
    }
    
    // Add pagination parameters to URL
    searchParams.set('page', '1'); // Reset to page 1 when searching
    searchParams.set('pageSize', pageSize.toString());
    
    // Add sort parameter to URL
    if (finalSort) {
      searchParams.set('sort', finalSort);
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
    
    // Force query invalidation - state is now guaranteed to be updated due to flushSync
    queryClient.invalidateQueries({ queryKey: ['resources'] });
    
    // Reset scroll position to top when search/filter/sort changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageSize, sort, queryClient, setSearchQuery, setResourceType, setPage, setSort]);
  
  // Handle page change with URL update
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    
    // Update URL with new page (convert to 1-based for URL)
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('page', (newPage + 1).toString());
    urlParams.set('pageSize', pageSize.toString());
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [setPage, pageSize]);
  
  // Handle page size change with URL update
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(0); // Reset to first page when changing page size
    
    // Update URL with new page size and reset to page 1
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('page', '1');
    urlParams.set('pageSize', newPageSize.toString());
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
    
    setHasValidatedCurrentPage(false); // Reset validation status when changing page size
  }, [setPageSize, setPage, setHasValidatedCurrentPage]);
  
  // Parse URL parameters and update state when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    // Support 'resourceType' (new), 'type' (legacy lowercase), and 'Type' (legacy uppercase) for backwards compatibility
    const typeParam = urlParams.get('resourceType') || urlParams.get('type') || urlParams.get('Type');
    const searchParam = urlParams.get('search');
    const aspectsParam = urlParams.get('aspects');
    const severitiesParam = urlParams.get('severities');
    const hasIssuesParam = urlParams.get('hasIssues');
    const pageParam = parseInt(urlParams.get('page') || '1');
    const pageSizeParam = parseInt(urlParams.get('pageSize') || '20');
    const sortParam = urlParams.get('sort') || '';
    
    // Parse FHIR search parameters from URL
    const fhirSearchParams: Record<string, { value: string | string[]; operator?: string }> = {};
    urlParams.forEach((value, key) => {
      // Skip known UI params and FHIR system params
      const excludedParams = [
        'resourceType', 'type', 'Type', 'search', 'aspects', 'severities', 'hasIssues', 'page', 'pageSize', 'sort',
        '_count', '_skip', '_sort', '_total', '_summary', '_elements', '_include', '_revinclude'
      ];
      if (!excludedParams.includes(key) && !excludedParams.includes(key.split(':')[0])) {
        // Parse operator if present (e.g., "birthdate:gt")
        const [paramName, operator] = key.split(':');
        fhirSearchParams[paramName] = { value, operator };
      }
    });
    
    // Only update state if values actually changed to prevent infinite loops
    const normalizedTypeParam = typeParam || "all";
    const normalizedSearchParam = searchParam || "";
    const normalizedSortParam = sortParam;
    const normalizedPageIndex = Math.max(0, pageParam - 1);
    const normalizedPageSize = Math.max(1, pageSizeParam);
    
    // Check if this is a content change (not just pagination)
    const isContentChange = 
      normalizedTypeParam !== resourceType ||
      normalizedSearchParam !== searchQuery ||
      normalizedSortParam !== sort ||
      aspectsParam !== validationFilters.aspects.join(',') ||
      severitiesParam !== validationFilters.severities.join(',');
    
    // Only update state if something actually changed
    if (normalizedTypeParam !== resourceType) setResourceType(normalizedTypeParam);
    if (normalizedSearchParam !== searchQuery) setSearchQuery(normalizedSearchParam);
    if (normalizedPageIndex !== page) setPage(normalizedPageIndex);
    if (normalizedPageSize !== pageSize) setPageSize(normalizedPageSize);
    if (normalizedSortParam !== sort) setSort(normalizedSortParam);
    
    // Always update validation filters (they're objects so simple comparison won't work)
    setValidationFilters({
      aspects: aspectsParam ? aspectsParam.split(',') : [],
      severities: severitiesParam ? severitiesParam.split(',') : [],
      hasIssuesOnly: hasIssuesParam === 'true',
      issueFilter: undefined, // Clear issue filter when URL changes
      fhirSearchParams: Object.keys(fhirSearchParams).length > 0 ? fhirSearchParams : undefined,
    });
    
    // Ensure URL always has page and pageSize parameters for clarity
    if (!urlParams.has('page') || !urlParams.has('pageSize')) {
      const newParams = new URLSearchParams(window.location.search);
      if (!newParams.has('page')) newParams.set('page', pageParam.toString());
      if (!newParams.has('pageSize')) newParams.set('pageSize', pageSizeParam.toString());
      window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
    }
    
    // Scroll to top only when content changes (not pagination)
    if (isContentChange) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]); // Keep location as only dependency, state updates are conditional
  
  // Also listen for popstate events to handle programmatic URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const typeParam = urlParams.get('resourceType') || urlParams.get('type') || urlParams.get('Type');
      const searchParam = urlParams.get('search');
      const pageParam = parseInt(urlParams.get('page') || '1');
      const pageSizeParam = parseInt(urlParams.get('pageSize') || '20');
      const sortParam = urlParams.get('sort') || '';

      // Parse FHIR params
      const fhirParams: Record<string, { value: string | string[]; operator?: string }> = {};
      const excludedParams = [
        'resourceType', 'type', 'Type', 'search', 'aspects', 'severities', 'hasIssues', 'page', 'pageSize', 'sort',
        '_count', '_skip', '_sort', '_total', '_summary', '_elements', '_include', '_revinclude'
      ];
      urlParams.forEach((value, key) => {
        if (!excludedParams.includes(key) && !excludedParams.includes(key.split(':')[0])) {
          const [paramName, operator] = key.split(':');
          fhirParams[paramName] = { value, operator };
        }
      });

      setResourceType(typeParam || "all");
      setSearchQuery(searchParam || "");
      setPage(Math.max(0, pageParam - 1));
      setPageSize(Math.max(1, pageSizeParam));
      setSort(sortParam);
      setValidationFilters(prev => ({
        ...prev,
        fhirSearchParams: Object.keys(fhirParams).length > 0 ? fhirParams : undefined,
      }));
    };
    
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []); // No dependencies to avoid re-adding listeners
  
  return {
    handleSearch,
    handlePageChange,
    handlePageSizeChange,
  };
}

