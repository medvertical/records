import { useState } from 'react';
import type { ValidationFilters } from '@/components/resources/resource-search';

export interface PaginationState {
  page: number;
  pageSize: number;
  sort: string;
}

export interface ResourceBrowserState {
  // Core navigation
  resourceType: string;
  searchQuery: string;
  page: number;
  pageSize: number;
  sort: string;
  
  // Validation state
  isValidating: boolean;
  validatingResourceIds: Set<number>;
  validationProgress: Map<number, any>;
  hasValidatedCurrentPage: boolean;
  cacheCleared: boolean;
  
  // Filters
  validationFilters: ValidationFilters;
  
  // Setters
  setResourceType: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
  setSort: (value: string) => void;
  setIsValidating: (value: boolean) => void;
  setValidatingResourceIds: (value: Set<number>) => void;
  setValidationProgress: (value: Map<number, any> | ((prev: Map<number, any>) => Map<number, any>)) => void;
  setHasValidatedCurrentPage: (value: boolean) => void;
  setCacheCleared: (value: boolean) => void;
  setValidationFilters: (value: ValidationFilters | ((prev: ValidationFilters) => ValidationFilters)) => void;
}

/**
 * Get initial pagination values from URL parameters
 */
function getInitialPaginationFromUrl(): PaginationState {
  const urlParams = new URLSearchParams(window.location.search);
  const pageParam = parseInt(urlParams.get('page') || '1'); // 1-based in URL
  const pageSizeParam = parseInt(urlParams.get('pageSize') || '20');
  const sortParam = urlParams.get('sort') || '';
  
  return {
    page: Math.max(0, pageParam - 1), // Convert to 0-based for internal use
    pageSize: Math.max(1, pageSizeParam),
    sort: sortParam
  };
}

/**
 * Core state management for resource browser
 * Handles pagination, filtering, validation state, and search
 */
export function useResourceBrowserState(): ResourceBrowserState {
  const initialPagination = getInitialPaginationFromUrl();
  
  // Core navigation state
  const [resourceType, setResourceType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(initialPagination.page);
  const [pageSize, setPageSize] = useState(initialPagination.pageSize);
  const [sort, setSort] = useState<string>(initialPagination.sort);
  
  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validatingResourceIds, setValidatingResourceIds] = useState<Set<number>>(new Set());
  const [validationProgress, setValidationProgress] = useState<Map<number, any>>(new Map());
  const [hasValidatedCurrentPage, setHasValidatedCurrentPage] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  
  // Filter state
  const [validationFilters, setValidationFilters] = useState<ValidationFilters>({
    aspects: [],
    severities: [],
    hasIssuesOnly: false,
  });
  
  return {
    // State values
    resourceType,
    searchQuery,
    page,
    pageSize,
    sort,
    isValidating,
    validatingResourceIds,
    validationProgress,
    hasValidatedCurrentPage,
    cacheCleared,
    validationFilters,
    
    // Setters
    setResourceType,
    setSearchQuery,
    setPage,
    setPageSize,
    setSort,
    setIsValidating,
    setValidatingResourceIds,
    setValidationProgress,
    setHasValidatedCurrentPage,
    setCacheCleared,
    setValidationFilters,
  };
}

