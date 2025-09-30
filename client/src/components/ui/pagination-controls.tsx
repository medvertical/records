import { useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// Types
// ============================================================================

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface PaginationControlsProps {
  state: PaginationState;
  onChange: (state: PaginationState) => void;
  pageSizeOptions?: number[];
  syncWithUrl?: boolean;
  urlParamPrefix?: string; // For per-server namespacing (e.g., "server1_")
  disabled?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTotalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function getStartIndex(page: number, pageSize: number): number {
  return (page - 1) * pageSize + 1;
}

function getEndIndex(page: number, pageSize: number, total: number): number {
  return Math.min(page * pageSize, total);
}

// ============================================================================
// Main Component
// ============================================================================

export function PaginationControls({
  state,
  onChange,
  pageSizeOptions = [10, 25, 50, 100],
  syncWithUrl = false,
  urlParamPrefix = '',
  disabled = false,
}: PaginationControlsProps) {
  const [location, setLocation] = useLocation();
  const totalPages = getTotalPages(state.total, state.pageSize);
  const startIndex = getStartIndex(state.page, state.pageSize);
  const endIndex = getEndIndex(state.page, state.pageSize, state.total);

  // Sync with URL on mount and when URL changes
  useEffect(() => {
    if (!syncWithUrl) return;

    const params = new URLSearchParams(window.location.search);
    const urlPage = parseInt(params.get(`${urlParamPrefix}page`) || '1');
    const urlPageSize = parseInt(params.get(`${urlParamPrefix}pageSize`) || state.pageSize.toString());

    if (urlPage !== state.page || urlPageSize !== state.pageSize) {
      onChange({
        ...state,
        page: Math.max(1, urlPage),
        pageSize: Math.max(1, urlPageSize),
      });
    }
  }, [location]); // Only re-run when location changes

  // Update URL when pagination changes
  const updateUrl = useCallback((newState: PaginationState) => {
    if (!syncWithUrl) return;

    const params = new URLSearchParams(window.location.search);
    params.set(`${urlParamPrefix}page`, newState.page.toString());
    params.set(`${urlParamPrefix}pageSize`, newState.pageSize.toString());

    const newSearch = params.toString();
    const newPath = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
    
    // Use replaceState to avoid adding to browser history for every pagination change
    window.history.replaceState({}, '', newPath);
  }, [syncWithUrl, urlParamPrefix]);

  const handlePageChange = useCallback((newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages));
    const newState = { ...state, page: clampedPage };
    onChange(newState);
    updateUrl(newState);
  }, [state, totalPages, onChange, updateUrl]);

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    const size = parseInt(newPageSize);
    // When changing page size, reset to page 1
    const newState = { ...state, pageSize: size, page: 1 };
    onChange(newState);
    updateUrl(newState);
  }, [state, onChange, updateUrl]);

  const canGoPrevious = state.page > 1;
  const canGoNext = state.page < totalPages;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
      {/* Left side - Page size selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Rows per page:</span>
        <Select
          value={state.pageSize.toString()}
          onValueChange={handlePageSizeChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Center - Page info */}
      <div className="flex items-center gap-6">
        <span className="text-sm text-gray-700">
          {state.total === 0 ? (
            'No results'
          ) : (
            <>
              Showing {startIndex.toLocaleString()} to {endIndex.toLocaleString()} of{' '}
              {state.total.toLocaleString()} results
            </>
          )}
        </span>

        <span className="text-sm text-gray-600">
          Page {state.page} of {totalPages}
        </span>
      </div>

      {/* Right side - Navigation buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(1)}
          disabled={!canGoPrevious || disabled}
          className="h-8 w-8 p-0"
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(state.page - 1)}
          disabled={!canGoPrevious || disabled}
          className="h-8 w-8 p-0"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(state.page + 1)}
          disabled={!canGoNext || disabled}
          className="h-8 w-8 p-0"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(totalPages)}
          disabled={!canGoNext || disabled}
          className="h-8 w-8 p-0"
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
