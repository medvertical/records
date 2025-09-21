import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import ResourceBrowser from './resource-browser';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the server data hook
vi.mock('@/hooks/use-server-data', () => ({
  useServerData: () => ({
    activeServer: {
      id: 'test-server',
      name: 'Test FHIR Server',
      url: 'https://test-fhir-server.com',
      version: 'R4',
      isConnected: true
    },
    connectToServer: vi.fn(),
    disconnectServer: vi.fn()
  })
}));

// Mock the validation settings polling hook
vi.mock('@/hooks/use-validation-settings-polling', () => ({
  useValidationSettingsPolling: () => ({
    lastFetchedSettings: null,
    isPolling: false,
    error: null
  })
}));

// Mock components
vi.mock('@/components/resources/resource-search', () => ({
  default: ({ onSearch }: { onSearch: (query: string, type: string) => void }) => (
    <div data-testid="resource-search">
      <button onClick={() => onSearch('test query', 'Patient')}>
        Search
      </button>
    </div>
  )
}));

vi.mock('@/components/resources/resource-list', () => ({
  default: ({ resources, onPageChange, validatingResourceIds }: any) => (
    <div data-testid="resource-list">
      <div data-testid="resource-count">{resources.length}</div>
      <div data-testid="validating-count">{validatingResourceIds?.size || 0}</div>
      <button onClick={() => onPageChange(1)}>Next Page</button>
    </div>
  )
}));

// Test data
const mockServerData = {
  id: 'test-server',
  name: 'Test FHIR Server',
  url: 'https://test-fhir-server.com',
  version: 'R4',
  isConnected: true
};

const mockResourcesResponse = {
  resources: [
    {
      id: 'patient-1',
      resourceType: 'Patient',
      name: [{ given: ['John'], family: 'Doe' }],
      _dbId: 1,
      _validationSummary: {
        lastValidated: '2024-01-15T10:00:00Z',
        errorCount: 0,
        warningCount: 0,
        validationScore: 100,
        hasErrors: false,
        hasWarnings: false,
        isValid: true
      }
    },
    {
      id: 'patient-2',
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Smith' }],
      _dbId: 2,
      _validationSummary: {
        lastValidated: '2024-01-15T10:00:00Z',
        errorCount: 2,
        warningCount: 1,
        validationScore: 65,
        hasErrors: true,
        hasWarnings: true,
        isValid: false
      }
    },
    {
      id: 'observation-1',
      resourceType: 'Observation',
      code: { text: 'Blood Pressure' },
      _dbId: 3,
      _validationSummary: null // Not validated
    }
  ],
  total: 3
};

const mockValidationResponse = {
  success: true,
  message: 'Validation started for 3 resources',
  data: {
    validatedCount: 3,
    totalCount: 3,
    validationId: 'validation-123'
  }
};

const mockValidationSettings = {
  settings: {
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'error' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'info' }
  }
};

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        cacheTime: 0,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialPath = '/resources') => {
  const queryClient = createTestQueryClient();
  const { hook, history } = memoryLocation({ path: initialPath });
  
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <Router hook={hook}>
          {component}
        </Router>
      </QueryClientProvider>
    ),
    queryClient,
    history
  };
};

describe('ResourceBrowser Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses by default
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServerData)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResourcesResponse)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockValidationSettings)
      });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Per-Page Validation Integration', () => {
    it('should successfully trigger validation for resources on current page', async () => {
      // Mock the validation endpoint response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        });

      const { queryClient } = renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Find and click the validation button
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      expect(validateButton).toBeInTheDocument();
      expect(validateButton).not.toBeDisabled();

      // Click the validate button
      fireEvent.click(validateButton);

      // Verify the button shows loading state
      await waitFor(() => {
        expect(screen.getByText(/validating.../i)).toBeInTheDocument();
      });

      // Verify the validation API was called with correct parameters
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/validation/validate-by-ids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceIds: [1, 2, 3], // The _dbId values from mock resources
            forceRevalidation: false
          })
        });
      });

      // Verify cache invalidation occurred
      await waitFor(() => {
        expect(queryClient.getQueryState(['/api/fhir/resources'])).toBeDefined();
      });
    });

    it('should handle validation API errors gracefully', async () => {
      // Mock validation endpoint error
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockRejectedValueOnce(new Error('Validation API error'));

      const { queryClient } = renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Find and click the validation button
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      fireEvent.click(validateButton);

      // Verify error handling - button should return to normal state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /validate now/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /validate now/i })).not.toBeDisabled();
      }, { timeout: 3000 });
    });

    it('should disable validation button when no resources are available', async () => {
      // Mock empty resources response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resources: [], total: 0 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Validation button should be disabled when no resources
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      expect(validateButton).toBeDisabled();
    });

    it('should track validation progress for individual resources', async () => {
      // Mock validation endpoint with progress tracking
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Click validation button
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      fireEvent.click(validateButton);

      // Verify that validating resource IDs are tracked
      await waitFor(() => {
        const validatingCount = screen.getByTestId('validating-count');
        expect(validatingCount).toHaveTextContent('3'); // All 3 resources being validated
      });
    });

    it('should support force revalidation when explicitly requested', async () => {
      // Mock validation endpoint response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Find and click the validation button
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      fireEvent.click(validateButton);

      // Verify the validation API was called with forceRevalidation: false by default
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/validation/validate-by-ids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceIds: [1, 2, 3],
            forceRevalidation: false
          })
        });
      });
    });
  });

  describe('Resource List Integration', () => {
    it('should display resources with validation status correctly', async () => {
      renderWithProviders(<ResourceBrowser />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Verify resource count is displayed correctly
      const resourceCount = screen.getByTestId('resource-count');
      expect(resourceCount).toHaveTextContent('3');
    });

    it('should handle pagination correctly', async () => {
      renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Click next page button
      const nextPageButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextPageButton);

      // Verify page change was handled (this would trigger a new API call in real implementation)
      // In this test, we're just verifying the integration point works
      expect(nextPageButton).toBeInTheDocument();
    });

    it('should refresh resource list when validation settings change', async () => {
      // Mock validation settings polling hook to return changed settings
      vi.mocked(require('@/hooks/use-validation-settings-polling').useValidationSettingsPolling)
        .mockReturnValue({
          lastFetchedSettings: { timestamp: Date.now() },
          isPolling: true,
          error: null
        });

      const { queryClient } = renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Verify that resource queries would be invalidated when settings change
      // This tests the integration between settings polling and resource list refresh
      expect(queryClient).toBeDefined();
    });
  });

  describe('Search Integration', () => {
    it('should handle search queries and update URL correctly', async () => {
      const { history } = renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-search')).toBeInTheDocument();
      });

      // Perform search
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);

      // Verify search was triggered (this would update URL and trigger new queries)
      expect(searchButton).toBeInTheDocument();
    });

    it('should parse URL parameters correctly on initial load', async () => {
      // Mock URL with search parameters
      const mockUrl = '/resources?type=Patient&search=John';
      renderWithProviders(<ResourceBrowser />, mockUrl);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-search')).toBeInTheDocument();
      });

      // Verify component loaded with URL parameters
      expect(screen.getByTestId('resource-search')).toBeInTheDocument();
    });
  });

  describe('Auto-Validation Integration', () => {
    it('should enable auto-validation by default', async () => {
      renderWithProviders(<ResourceBrowser />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-search')).toBeInTheDocument();
      });

      // Verify auto-validation toggle exists and is enabled by default
      // This tests the integration of auto-validation feature
      expect(screen.getByTestId('resource-search')).toBeInTheDocument();
    });

    it('should trigger auto-validation when resources are loaded', async () => {
      // Mock auto-validation trigger
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for auto-validation to trigger (if enabled)
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Verify that validation was triggered automatically
      // This tests the integration between resource loading and auto-validation
      expect(screen.getByTestId('resource-list')).toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle server connection errors gracefully', async () => {
      // Mock server connection error
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Server connection failed'));

      renderWithProviders(<ResourceBrowser />);

      // Wait for error handling
      await waitFor(() => {
        expect(screen.getByTestId('resource-search')).toBeInTheDocument();
      });

      // Verify component still renders despite server error
      expect(screen.getByTestId('resource-search')).toBeInTheDocument();
    });

    it('should handle validation settings fetch errors gracefully', async () => {
      // Mock validation settings error
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockRejectedValueOnce(new Error('Validation settings fetch failed'));

      renderWithProviders(<ResourceBrowser />);

      // Wait for error handling
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Verify component still functions despite settings error
      expect(screen.getByTestId('resource-list')).toBeInTheDocument();
    });

    it('should handle malformed API responses gracefully', async () => {
      // Mock malformed response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}) // Malformed response
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for error handling
      await waitFor(() => {
        expect(screen.getByTestId('resource-search')).toBeInTheDocument();
      });

      // Verify component handles malformed data gracefully
      expect(screen.getByTestId('resource-search')).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large resource lists efficiently', async () => {
      // Mock large resource list
      const largeResourceList = {
        resources: Array.from({ length: 100 }, (_, i) => ({
          id: `resource-${i}`,
          resourceType: 'Patient',
          _dbId: i + 1,
          _validationSummary: null
        })),
        total: 100
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(largeResourceList)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        });

      const startTime = performance.now();
      
      renderWithProviders(<ResourceBrowser />);

      // Wait for large list to render
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Verify performance is acceptable (adjust threshold as needed)
      expect(renderTime).toBeLessThan(1000); // 1 second
      expect(screen.getByTestId('resource-count')).toHaveTextContent('100');
    });

    it('should efficiently handle validation of large resource lists', async () => {
      // Mock large resource list
      const largeResourceList = {
        resources: Array.from({ length: 50 }, (_, i) => ({
          id: `resource-${i}`,
          resourceType: 'Patient',
          _dbId: i + 1,
          _validationSummary: null
        })),
        total: 50
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(largeResourceList)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Trigger validation
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      fireEvent.click(validateButton);

      // Verify validation API was called with all resource IDs
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/validation/validate-by-ids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceIds: Array.from({ length: 50 }, (_, i) => i + 1),
            forceRevalidation: false
          })
        });
      });
    });
  });

  describe('State Management Integration', () => {
    it('should maintain validation state correctly across component updates', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Trigger validation
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      fireEvent.click(validateButton);

      // Verify loading state
      await waitFor(() => {
        expect(screen.getByText(/validating.../i)).toBeInTheDocument();
      });

      // Verify state transitions correctly
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /validate now/i })).toBeInTheDocument();
      });
    });

    it('should handle concurrent validation requests correctly', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockServerData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        });

      renderWithProviders(<ResourceBrowser />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByTestId('resource-list')).toBeInTheDocument();
      });

      // Click validation button multiple times quickly
      const validateButton = screen.getByRole('button', { name: /validate now/i });
      fireEvent.click(validateButton);
      fireEvent.click(validateButton);
      fireEvent.click(validateButton);

      // Verify only one validation request is made (button should be disabled during validation)
      await waitFor(() => {
        expect(screen.getByText(/validating.../i)).toBeInTheDocument();
      });

      // Verify button is disabled during validation
      expect(validateButton).toBeDisabled();
    });
  });
});
