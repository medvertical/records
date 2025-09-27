/**
 * Unit tests for useResourceFiltering Hook Logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useResourceFiltering } from './useResourceFiltering';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock setTimeout and clearTimeout
const mockSetTimeout = vi.fn();
const mockClearTimeout = vi.fn();
global.setTimeout = mockSetTimeout;
global.clearTimeout = mockClearTimeout;

describe('useResourceFiltering Hook Logic', () => {
  const mockFilteredResourcesResponse = {
    success: true,
    data: {
      resources: [
        {
          id: 'patient-1',
          resourceType: 'Patient',
          _validation: {
            isValid: false,
            errorCount: 2,
            warningCount: 1,
            validationScore: 60,
            lastValidated: new Date('2024-01-01T10:00:00Z')
          }
        }
      ],
      totalCount: 1,
      returnedCount: 1,
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false
      },
      filterSummary: {
        resourceTypes: ['Patient'],
        validationStatus: {
          hasErrors: 1,
          hasWarnings: 1,
          hasInformation: 0,
          isValid: 0
        },
        totalMatching: 1
      },
      appliedFilters: {}
    }
  };

  const mockStatisticsResponse = {
    success: true,
    data: {
      availableResourceTypes: ['Patient', 'Observation', 'Condition'],
      validationStatistics: {
        totalResources: 100,
        withValidationData: 80,
        withoutValidationData: 20,
        hasErrors: 30,
        hasWarnings: 50,
        hasInformation: 10,
        isValid: 40
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFilteredResourcesResponse)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default filter options', () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      expect(result.current.filterOptions).toEqual({
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
      });
    });

    it('should initialize with custom filter options', () => {
      const initialFilters = {
        resourceTypes: ['Patient'],
        search: 'test',
        pagination: { limit: 25, offset: 0 }
      };
      
      const { result } = renderHook(() => useResourceFiltering({ initialFilters }));
      
      expect(result.current.filterOptions).toEqual({
        resourceTypes: ['Patient'],
        validationStatus: {},
        search: 'test',
        pagination: {
          limit: 25,
          offset: 0
        },
        sorting: {
          field: 'lastValidated',
          direction: 'desc'
        }
      });
    });

    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      expect(result.current.resources).toEqual([]);
      expect(result.current.statistics).toBeNull();
      expect(result.current.totalCount).toBe(0);
      expect(result.current.returnedCount).toBe(0);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.filterSummary).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isExpanded).toBe(true);
    });
  });

  describe('Data Loading', () => {
    it('should load resources on mount when autoLoad is true', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFilteredResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatisticsResponse)
        });

      const { result } = renderHook(() => useResourceFiltering({ autoLoad: true }));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.resources).toHaveLength(1);
      expect(result.current.totalCount).toBe(1);
      expect(result.current.statistics).toEqual(mockStatisticsResponse.data);
    });

    it('should not load resources on mount when autoLoad is false', () => {
      const { result } = renderHook(() => useResourceFiltering({ autoLoad: false }));
      
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.resources).toEqual([]);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useResourceFiltering({ autoLoad: true }));
      
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
      
      expect(result.current.resources).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: 'Invalid filter parameters'
        })
      });
      
      const { result } = renderHook(() => useResourceFiltering({ autoLoad: true }));
      
      await waitFor(() => {
        expect(result.current.error).toBe('Invalid filter parameters');
      });
    });
  });

  describe('Filter Management', () => {
    it('should update filter options and trigger debounced load', async () => {
      const { result } = renderHook(() => useResourceFiltering({ debounceMs: 100 }));
      
      const newOptions = {
        resourceTypes: ['Patient'],
        validationStatus: {},
        search: '',
        pagination: { limit: 50, offset: 0 },
        sorting: { field: 'lastValidated' as const, direction: 'desc' as const }
      };
      
      act(() => {
        result.current.setFilterOptions(newOptions);
      });
      
      expect(result.current.filterOptions).toEqual(newOptions);
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
    });

    it('should update filter options with partial updates', async () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      act(() => {
        result.current.updateFilterOptions({
          resourceTypes: ['Patient', 'Observation']
        });
      });
      
      expect(result.current.filterOptions.resourceTypes).toEqual(['Patient', 'Observation']);
    });

    it('should clear filters to default state', async () => {
      const { result } = renderHook(() => useResourceFiltering({
        initialFilters: {
          resourceTypes: ['Patient'],
          search: 'test'
        }
      }));
      
      act(() => {
        result.current.clearFilters();
      });
      
      expect(result.current.filterOptions).toEqual({
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
      });
    });
  });

  describe('Pagination', () => {
    it('should load more resources when loadMore is called', async () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      // Set up initial state with hasMore = true
      act(() => {
        result.current.setFilterOptions({
          resourceTypes: [],
          validationStatus: {},
          search: '',
          pagination: { limit: 50, offset: 0 },
          sorting: { field: 'lastValidated', direction: 'desc' }
        });
      });
      
      // Mock the response for loadMore
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockFilteredResourcesResponse,
          data: {
            ...mockFilteredResourcesResponse.data,
            pagination: { limit: 50, offset: 50, hasMore: false }
          }
        })
      });
      
      act(() => {
        result.current.loadMore();
      });
      
      await waitFor(() => {
        expect(result.current.filterOptions.pagination.offset).toBe(50);
      });
    });

    it('should not load more when hasMore is false', async () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      // Set hasMore to false
      act(() => {
        result.current.setFilterOptions({
          resourceTypes: [],
          validationStatus: {},
          search: '',
          pagination: { limit: 50, offset: 0 },
          sorting: { field: 'lastValidated', direction: 'desc' }
        });
      });
      
      const initialCallCount = mockFetch.mock.calls.length;
      
      act(() => {
        result.current.loadMore();
      });
      
      // Should not make additional fetch calls
      expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh resources and statistics', async () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFilteredResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatisticsResponse)
        });
      
      act(() => {
        result.current.refresh();
      });
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('UI State Management', () => {
    it('should toggle expanded state', () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      expect(result.current.isExpanded).toBe(true);
      
      act(() => {
        result.current.toggleExpanded();
      });
      
      expect(result.current.isExpanded).toBe(false);
      
      act(() => {
        result.current.toggleExpanded();
      });
      
      expect(result.current.isExpanded).toBe(true);
    });
  });

  describe('Debouncing', () => {
    it('should debounce filter changes', () => {
      const { result } = renderHook(() => useResourceFiltering({ debounceMs: 100 }));
      
      act(() => {
        result.current.setFilterOptions({
          resourceTypes: ['Patient'],
          validationStatus: {},
          search: '',
          pagination: { limit: 50, offset: 0 },
          sorting: { field: 'lastValidated', direction: 'desc' }
        });
      });
      
      act(() => {
        result.current.setFilterOptions({
          resourceTypes: ['Patient', 'Observation'],
          validationStatus: {},
          search: '',
          pagination: { limit: 50, offset: 0 },
          sorting: { field: 'lastValidated', direction: 'desc' }
        });
      });
      
      // Should only set one timeout (the second one should clear the first)
      expect(mockSetTimeout).toHaveBeenCalledTimes(2);
      expect(mockClearTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL Parameter Building', () => {
    it('should build correct URL parameters for API calls', async () => {
      const { result } = renderHook(() => useResourceFiltering());
      
      const complexOptions = {
        resourceTypes: ['Patient', 'Observation'],
        validationStatus: {
          hasErrors: true,
          hasWarnings: false,
          isValid: true
        },
        search: 'test search',
        pagination: { limit: 25, offset: 50 },
        sorting: { field: 'validationScore' as const, direction: 'asc' as const }
      };
      
      act(() => {
        result.current.setFilterOptions(complexOptions);
      });
      
      // Wait for the debounced call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      
      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];
      
      expect(url).toContain('resourceTypes=Patient%2CObservation');
      expect(url).toContain('hasErrors=true');
      expect(url).toContain('hasWarnings=false');
      expect(url).toContain('isValid=true');
      expect(url).toContain('search=test%20search');
      expect(url).toContain('limit=25');
      expect(url).toContain('offset=50');
      expect(url).toContain('sortBy=validationScore');
      expect(url).toContain('sortDirection=asc');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useResourceFiltering({ autoLoad: true }));
      
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.resources).toEqual([]);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request'
      });
      
      const { result } = renderHook(() => useResourceFiltering({ autoLoad: true }));
      
      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch filtered resources: Bad Request');
      });
    });

    it('should clear error on successful refresh', async () => {
      // First, set an error
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useResourceFiltering({ autoLoad: true }));
      
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
      
      // Then, make a successful call
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFilteredResourcesResponse)
      });
      
      act(() => {
        result.current.refresh();
      });
      
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });
});
