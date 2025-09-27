/**
 * Unit tests for ResourceFilterControls Component Logic
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourceFilterControls, type ResourceFilterOptions } from './resource-filter-controls';

// Mock the UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  )
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children, className }: any) => <div className={className}>{children}</div>,
  SelectValue: () => <span>Select Value</span>
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, id }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      id={id}
    />
  )
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={`badge ${variant} ${className}`}>{children}</span>
  )
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open, onOpenChange }: any) => (
    <div data-open={open} data-on-open-change={onOpenChange}>
      {children}
    </div>
  ),
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, asChild }: any) => (
    asChild ? children : <button>{children}</button>
  )
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Filter: () => <span data-testid="filter-icon">Filter</span>,
  Search: () => <span data-testid="search-icon">Search</span>,
  X: () => <span data-testid="x-icon">X</span>,
  ChevronDown: () => <span data-testid="chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="chevron-up">ChevronUp</span>,
  RefreshCw: () => <span data-testid="refresh-icon">RefreshCw</span>,
  Database: () => <span data-testid="database-icon">Database</span>,
  AlertTriangle: () => <span data-testid="alert-triangle">AlertTriangle</span>,
  Info: () => <span data-testid="info-icon">Info</span>,
  CheckCircle: () => <span data-testid="check-circle">CheckCircle</span>,
  SortAsc: () => <span data-testid="sort-asc">SortAsc</span>,
  SortDesc: () => <span data-testid="sort-desc">SortDesc</span>
}));

describe('ResourceFilterControls Component Logic', () => {
  const mockFilterOptions: ResourceFilterOptions = {
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

  const mockStatistics = {
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
  };

  const defaultProps = {
    filterOptions: mockFilterOptions,
    onFilterChange: vi.fn(),
    onClearFilters: vi.fn(),
    onRefresh: vi.fn(),
    statistics: mockStatistics,
    totalCount: 100,
    returnedCount: 50,
    hasMore: true,
    isLoading: false,
    isExpanded: true,
    onToggleExpanded: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render filter controls with default state', () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      expect(screen.getByText('Resource Filters')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search by resource ID, type, or content...')).toBeInTheDocument();
      expect(screen.getByText('Patient')).toBeInTheDocument();
      expect(screen.getByText('Observation')).toBeInTheDocument();
      expect(screen.getByText('Condition')).toBeInTheDocument();
    });

    it('should show active filters badge when filters are applied', () => {
      const propsWithFilters = {
        ...defaultProps,
        filterOptions: {
          ...mockFilterOptions,
          resourceTypes: ['Patient'],
          validationStatus: { hasErrors: true }
        }
      };
      
      render(<ResourceFilterControls {...propsWithFilters} />);
      
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(<ResourceFilterControls {...defaultProps} isLoading={true} />);
      
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should handle search input changes', async () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by resource ID, type, or content...');
      fireEvent.change(searchInput, { target: { value: 'test search' } });
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'test search',
            pagination: { limit: 50, offset: 0 }
          })
        );
      });
    });

    it('should clear search when X button is clicked', async () => {
      const propsWithSearch = {
        ...defaultProps,
        filterOptions: {
          ...mockFilterOptions,
          search: 'test search'
        }
      };
      
      render(<ResourceFilterControls {...propsWithSearch} />);
      
      const clearButton = screen.getByTestId('x-icon').closest('button');
      fireEvent.click(clearButton!);
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            search: ''
          })
        );
      });
    });
  });

  describe('Resource Type Filtering', () => {
    it('should handle resource type checkbox changes', async () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const patientCheckbox = screen.getByLabelText('Patient');
      fireEvent.click(patientCheckbox);
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceTypes: ['Patient']
          })
        );
      });
    });

    it('should handle multiple resource type selections', async () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const patientCheckbox = screen.getByLabelText('Patient');
      const observationCheckbox = screen.getByLabelText('Observation');
      
      fireEvent.click(patientCheckbox);
      fireEvent.click(observationCheckbox);
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceTypes: ['Patient', 'Observation']
          })
        );
      });
    });
  });

  describe('Validation Status Filtering', () => {
    it('should handle validation status checkbox changes', async () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const errorsCheckbox = screen.getByLabelText(/Errors \(30\)/);
      fireEvent.click(errorsCheckbox);
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            validationStatus: { hasErrors: true }
          })
        );
      });
    });

    it('should display validation status counts', () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      expect(screen.getByText('Errors (30)')).toBeInTheDocument();
      expect(screen.getByText('Warnings (50)')).toBeInTheDocument();
      expect(screen.getByText('Information (10)')).toBeInTheDocument();
      expect(screen.getByText('Valid (40)')).toBeInTheDocument();
    });
  });

  describe('Sorting Functionality', () => {
    it('should handle sorting button clicks', async () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const resourceTypeSortButton = screen.getByText('Resource Type');
      fireEvent.click(resourceTypeSortButton);
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            sorting: { field: 'resourceType', direction: 'asc' }
          })
        );
      });
    });

    it('should toggle sort direction when same field is clicked', async () => {
      const propsWithSorting = {
        ...defaultProps,
        filterOptions: {
          ...mockFilterOptions,
          sorting: { field: 'resourceType', direction: 'asc' }
        }
      };
      
      render(<ResourceFilterControls {...propsWithSorting} />);
      
      const resourceTypeSortButton = screen.getByText('Resource Type');
      fireEvent.click(resourceTypeSortButton);
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            sorting: { field: 'resourceType', direction: 'desc' }
          })
        );
      });
    });
  });

  describe('Pagination', () => {
    it('should handle pagination limit changes', async () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const limitSelect = screen.getByDisplayValue('50');
      fireEvent.change(limitSelect, { target: { value: '100' } });
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            pagination: { limit: 100, offset: 0 }
          })
        );
      });
    });

    it('should handle previous/next pagination', async () => {
      const propsWithOffset = {
        ...defaultProps,
        filterOptions: {
          ...mockFilterOptions,
          pagination: { limit: 50, offset: 50 }
        }
      };
      
      render(<ResourceFilterControls {...propsWithOffset} />);
      
      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);
      
      await waitFor(() => {
        expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({
            pagination: { limit: 50, offset: 0 }
          })
        );
      });
    });

    it('should disable previous button when at first page', () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('should disable next button when no more pages', () => {
      const propsNoMore = {
        ...defaultProps,
        hasMore: false
      };
      
      render(<ResourceFilterControls {...propsNoMore} />);
      
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Clear Filters', () => {
    it('should show clear filters button when filters are active', () => {
      const propsWithFilters = {
        ...defaultProps,
        filterOptions: {
          ...mockFilterOptions,
          resourceTypes: ['Patient']
        }
      };
      
      render(<ResourceFilterControls {...propsWithFilters} />);
      
      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });

    it('should call onClearFilters when clear button is clicked', () => {
      const propsWithFilters = {
        ...defaultProps,
        filterOptions: {
          ...mockFilterOptions,
          resourceTypes: ['Patient']
        }
      };
      
      render(<ResourceFilterControls {...propsWithFilters} />);
      
      const clearButton = screen.getByText('Clear All Filters');
      fireEvent.click(clearButton);
      
      expect(defaultProps.onClearFilters).toHaveBeenCalled();
    });
  });

  describe('Refresh Functionality', () => {
    it('should call onRefresh when refresh button is clicked', () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const refreshButton = screen.getByTestId('refresh-icon').closest('button');
      fireEvent.click(refreshButton!);
      
      expect(defaultProps.onRefresh).toHaveBeenCalled();
    });

    it('should show loading spinner when refreshing', () => {
      render(<ResourceFilterControls {...defaultProps} isLoading={true} />);
      
      const refreshButton = screen.getByTestId('refresh-icon').closest('button');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Collapsible Functionality', () => {
    it('should show chevron up when expanded', () => {
      render(<ResourceFilterControls {...defaultProps} isExpanded={true} />);
      
      expect(screen.getByTestId('chevron-up')).toBeInTheDocument();
    });

    it('should show chevron down when collapsed', () => {
      render(<ResourceFilterControls {...defaultProps} isExpanded={false} />);
      
      expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
    });

    it('should call onToggleExpanded when toggle button is clicked', () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      const toggleButton = screen.getByTestId('chevron-up').closest('button');
      fireEvent.click(toggleButton!);
      
      expect(defaultProps.onToggleExpanded).toHaveBeenCalledWith(false);
    });
  });

  describe('Results Summary', () => {
    it('should display correct results count', () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      expect(screen.getByText('Showing 50 of 100 resources')).toBeInTheDocument();
    });

    it('should display total resources count', () => {
      render(<ResourceFilterControls {...defaultProps} />);
      
      expect(screen.getByText('100 total resources')).toBeInTheDocument();
    });

    it('should show filters active badge when filters are applied', () => {
      const propsWithFilters = {
        ...defaultProps,
        filterOptions: {
          ...mockFilterOptions,
          resourceTypes: ['Patient']
        }
      };
      
      render(<ResourceFilterControls {...propsWithFilters} />);
      
      expect(screen.getByText('Filters Active')).toBeInTheDocument();
    });
  });
});
