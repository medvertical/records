import { useState, useEffect, useCallback } from 'react';
import type { ResourceFilterOptions, ResourceFilterStatistics } from '@/components/resources/resource-filter-controls';

// ============================================================================
// Types
// ============================================================================

export interface FilteredResourceResult {
  resources: any[];
  totalCount: number;
  returnedCount: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filterSummary: {
    resourceTypes: string[];
    validationStatus: {
      hasErrors: number;
      hasWarnings: number;
      hasInformation: number;
      isValid: number;
    };
    totalMatching: number;
  };
  appliedFilters: ResourceFilterOptions;
}

export interface UseResourceFilteringOptions {
  initialFilters?: Partial<ResourceFilterOptions>;
  autoLoad?: boolean;
  debounceMs?: number;
}

export interface UseResourceFilteringReturn {
  // Data
  resources: any[];
  statistics: ResourceFilterStatistics | null;
  totalCount: number;
  returnedCount: number;
  hasMore: boolean;
  filterSummary: FilteredResourceResult['filterSummary'] | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  filterOptions: ResourceFilterOptions;
  
  // Actions
  setFilterOptions: (options: ResourceFilterOptions) => void;
  updateFilterOptions: (updates: Partial<ResourceFilterOptions>) => void;
  clearFilters: () => void;
  refresh: () => void;
  loadMore: () => void;
  
  // UI State
  isExpanded: boolean;
  toggleExpanded: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useResourceFiltering(options: UseResourceFilteringOptions = {}): UseResourceFilteringReturn {
  const {
    initialFilters = {},
    autoLoad = true,
    debounceMs = 300
  } = options;

  // State
  const [resources, setResources] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<ResourceFilterStatistics | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [returnedCount, setReturnedCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterSummary, setFilterSummary] = useState<FilteredResourceResult['filterSummary'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Default filter options
  const defaultFilterOptions: ResourceFilterOptions = {
    resourceTypes: [],
    validationStatus: {},
    search: '',
    pagination: {
      limit: 50,
      offset: 0
    },
    sorting: {
      field: 'lastValidated',
      direction: 'desc'
    }
  };

  const [filterOptions, setFilterOptionsState] = useState<ResourceFilterOptions>({
    ...defaultFilterOptions,
    ...initialFilters
  });

  // Debounced filter update
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // ============================================================================
  // API Functions
  // ============================================================================

  const fetchFilteredResources = useCallback(async (options: ResourceFilterOptions): Promise<FilteredResourceResult> => {
    const params = new URLSearchParams();
    
    // Add resource types
    if (options.resourceTypes.length > 0) {
      params.append('resourceTypes', options.resourceTypes.join(','));
    }
    
    // Add validation status filters
    if (options.validationStatus.hasErrors !== undefined) {
      params.append('hasErrors', options.validationStatus.hasErrors.toString());
    }
    if (options.validationStatus.hasWarnings !== undefined) {
      params.append('hasWarnings', options.validationStatus.hasWarnings.toString());
    }
    if (options.validationStatus.hasInformation !== undefined) {
      params.append('hasInformation', options.validationStatus.hasInformation.toString());
    }
    if (options.validationStatus.isValid !== undefined) {
      params.append('isValid', options.validationStatus.isValid.toString());
    }
    
    // Add search
    if (options.search) {
      params.append('search', options.search);
    }
    
    // Add pagination
    params.append('limit', options.pagination.limit.toString());
    params.append('offset', options.pagination.offset.toString());
    
    // Add sorting
    params.append('sortBy', options.sorting.field);
    params.append('sortDirection', options.sorting.direction);

    const response = await fetch(`/api/fhir/resources/filtered?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch filtered resources: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch filtered resources');
    }
    
    return result.data;
  }, []);

  const fetchStatistics = useCallback(async (): Promise<ResourceFilterStatistics> => {
    const response = await fetch('/api/fhir/resources/filtered/statistics');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch statistics');
    }
    
    return result.data;
  }, []);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadResources = useCallback(async (options: ResourceFilterOptions, append = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await fetchFilteredResources(options);
      
      if (append) {
        setResources(prev => [...prev, ...result.resources]);
      } else {
        setResources(result.resources);
      }
      
      setTotalCount(result.totalCount);
      setReturnedCount(result.returnedCount);
      setHasMore(result.pagination.hasMore);
      setFilterSummary(result.filterSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
      console.error('Error loading resources:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFilteredResources]);

  const loadStatistics = useCallback(async () => {
    try {
      const stats = await fetchStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  }, [fetchStatistics]);

  // ============================================================================
  // Actions
  // ============================================================================

  const setFilterOptions = useCallback((options: ResourceFilterOptions) => {
    setFilterOptionsState(options);
    
    // Clear debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Set new debounce timer
    const timer = setTimeout(() => {
      loadResources(options);
    }, debounceMs);
    
    setDebounceTimer(timer);
  }, [debounceTimer, debounceMs, loadResources]);

  const updateFilterOptions = useCallback((updates: Partial<ResourceFilterOptions>) => {
    const newOptions = { ...filterOptions, ...updates };
    setFilterOptions(newOptions);
  }, [filterOptions, setFilterOptions]);

  const clearFilters = useCallback(() => {
    const clearedOptions = { ...defaultFilterOptions };
    setFilterOptions(clearedOptions);
  }, [setFilterOptions]);

  const refresh = useCallback(() => {
    loadResources(filterOptions);
    loadStatistics();
  }, [filterOptions, loadResources, loadStatistics]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      const newOptions = {
        ...filterOptions,
        pagination: {
          ...filterOptions.pagination,
          offset: filterOptions.pagination.offset + filterOptions.pagination.limit
        }
      };
      loadResources(newOptions, true);
    }
  }, [hasMore, isLoading, filterOptions, loadResources]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial load
  useEffect(() => {
    if (autoLoad) {
      loadResources(filterOptions);
      loadStatistics();
    }
  }, [autoLoad, loadResources, loadStatistics]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Data
    resources,
    statistics,
    totalCount,
    returnedCount,
    hasMore,
    filterSummary,
    
    // State
    isLoading,
    error,
    filterOptions,
    
    // Actions
    setFilterOptions,
    updateFilterOptions,
    clearFilters,
    refresh,
    loadMore,
    
    // UI State
    isExpanded,
    toggleExpanded
  };
}
