import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import ResourceList from '../resources/resource-list';
import ResourceDetail from '../resources/resource-detail';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the useQuery hook
const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: mockUseQuery
  };
});

// Mock the validation settings hook
vi.mock('@/hooks/use-validation-settings', () => ({
  useValidationSettings: () => ({
    settings: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'error' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'info' }
    },
    isLoading: false,
    error: null
  })
}));

describe('Validation Result Caching', () => {
  let queryClient: QueryClient;

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

  const mockResources = [
    {
      id: 1,
      _dbId: 1,
      resourceType: 'Patient',
      resourceId: 'patient-1',
      data: { id: 'patient-1', resourceType: 'Patient' },
      lastUpdated: new Date('2024-01-15T09:00:00Z'),
      _validationSummary: {
        isValid: false,
        hasErrors: true,
        hasWarnings: true,
        errorCount: 2,
        warningCount: 1,
        informationCount: 0,
        validationScore: 75,
        lastValidated: new Date('2024-01-15T10:00:00Z'),
        issues: [
          { aspect: 'structural', severity: 'error', message: 'Structural error' },
          { aspect: 'profile', severity: 'error', message: 'Profile error' },
          { aspect: 'reference', severity: 'warning', message: 'Reference warning' }
        ]
      }
    },
    {
      id: 2,
      _dbId: 2,
      resourceType: 'Observation',
      resourceId: 'observation-1',
      data: { id: 'observation-1', resourceType: 'Observation' },
      lastUpdated: new Date('2024-01-15T09:00:00Z'),
      _validationSummary: {
        isValid: true,
        hasErrors: false,
        hasWarnings: false,
        errorCount: 0,
        warningCount: 0,
        informationCount: 0,
        validationScore: 100,
        lastValidated: new Date('2024-01-15T10:00:00Z'),
        issues: []
      }
    },
    {
      id: 3,
      _dbId: 3,
      resourceType: 'Patient',
      resourceId: 'patient-2',
      data: { id: 'patient-2', resourceType: 'Patient' },
      lastUpdated: new Date('2024-01-15T09:00:00Z'),
      _validationSummary: null // Not validated
    }
  ];

  const mockValidationResult = {
    id: 1,
    resourceId: 1,
    settingsHash: 'hash123',
    resourceHash: 'resourceHash123',
    validationEngineVersion: '1.0.0',
    isValid: false,
    hasErrors: true,
    hasWarnings: true,
    errorCount: 2,
    warningCount: 1,
    informationCount: 0,
    validationScore: 75,
    lastValidated: new Date('2024-01-15T10:00:00Z'),
    validatedAt: new Date('2024-01-15T10:00:00Z'),
    performanceMetrics: {
      totalDurationMs: 150,
      aspectBreakdown: {
        structural: { durationMs: 50, issueCount: 1 },
        profile: { durationMs: 40, issueCount: 1 },
        terminology: { durationMs: 30, issueCount: 0 },
        reference: { durationMs: 20, issueCount: 1 },
        businessRule: { durationMs: 10, issueCount: 0 },
        metadata: { durationMs: 0, issueCount: 0 }
      }
    },
    aspectBreakdown: {
      structural: { enabled: true, issueCount: 1, errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 90, passed: false },
      profile: { enabled: true, issueCount: 1, errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 85, passed: false },
      terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      reference: { enabled: true, issueCount: 1, errorCount: 0, warningCount: 1, informationCount: 0, validationScore: 95, passed: false },
      businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
    },
    issues: [
      { aspect: 'structural', severity: 'error', message: 'Structural validation error' },
      { aspect: 'profile', severity: 'error', message: 'Profile validation error' },
      { aspect: 'reference', severity: 'warning', message: 'Reference validation warning' }
    ],
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z')
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          cacheTime: 0,
        },
      },
    });

    // Mock successful API responses
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockValidationSettings)
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement, initialPath = '/resources') => {
    const { hook, history } = memoryLocation({ path: initialPath });
    
    return render(
      <QueryClientProvider client={queryClient}>
        <Router hook={hook}>
          {component}
        </Router>
      </QueryClientProvider>
    );
  };

  describe('Resource List Validation Caching', () => {
    it('should display cached validation results correctly', async () => {
      mockUseQuery.mockReturnValue({
        data: {
          resources: mockResources,
          total: 3,
          page: 1,
          limit: 10
        },
        isLoading: false,
        error: null
      });

      renderWithProviders(<ResourceList />);

      // Wait for resources to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
        expect(screen.getByText('observation-1')).toBeInTheDocument();
        expect(screen.getByText('patient-2')).toBeInTheDocument();
      });

      // Verify validation status is displayed correctly
      expect(screen.getByText('75%')).toBeInTheDocument(); // Patient 1 validation score
      expect(screen.getByText('100%')).toBeInTheDocument(); // Observation validation score
      
      // Verify validation badges
      const validationBadges = screen.getAllByText(/error|warning|valid|not validated/i);
      expect(validationBadges.length).toBeGreaterThan(0);
    });

    it('should handle missing validation results gracefully', async () => {
      const resourcesWithoutValidation = mockResources.map(resource => ({
        ...resource,
        _validationSummary: null
      }));

      mockUseQuery.mockReturnValue({
        data: {
          resources: resourcesWithoutValidation,
          total: 3,
          page: 1,
          limit: 10
        },
        isLoading: false,
        error: null
      });

      renderWithProviders(<ResourceList />);

      // Wait for resources to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify "Not Validated" status is displayed
      expect(screen.getAllByText(/not validated/i).length).toBeGreaterThan(0);
    });

    it('should filter validation results based on settings', async () => {
      // Mock settings with some aspects disabled
      const filteredSettings = {
        settings: {
          structural: { enabled: false, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      mockUseQuery
        .mockReturnValueOnce({
          data: {
            resources: mockResources,
            total: 3,
            page: 1,
            limit: 10
          },
          isLoading: false,
          error: null
        })
        .mockReturnValueOnce({
          data: filteredSettings,
          isLoading: false,
          error: null
        });

      renderWithProviders(<ResourceList />);

      // Wait for resources to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify filtered validation results are displayed
      // Patient 1 should now show better validation score since structural errors are filtered out
      expect(screen.getByText(/85%|90%|95%/)).toBeInTheDocument();
    });

    it('should update validation display when settings change', async () => {
      const initialSettings = mockValidationSettings;
      const updatedSettings = {
        settings: {
          structural: { enabled: false, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      mockUseQuery
        .mockReturnValueOnce({
          data: {
            resources: mockResources,
            total: 3,
            page: 1,
            limit: 10
          },
          isLoading: false,
          error: null
        })
        .mockReturnValueOnce({
          data: initialSettings,
          isLoading: false,
          error: null
        });

      const { rerender } = renderWithProviders(<ResourceList />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Update settings
      mockUseQuery
        .mockReturnValueOnce({
          data: {
            resources: mockResources,
            total: 3,
            page: 1,
            limit: 10
          },
          isLoading: false,
          error: null
        })
        .mockReturnValueOnce({
          data: updatedSettings,
          isLoading: false,
          error: null
        });

      rerender(<ResourceList />);

      // Wait for updated render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify validation display updated
      expect(screen.getByText(/85%|90%|95%/)).toBeInTheDocument();
    });
  });

  describe('Resource Detail Validation Caching', () => {
    it('should display cached validation results in detail view', async () => {
      mockUseQuery.mockReturnValue({
        data: {
          resource: mockResources[0],
          validationResults: [mockValidationResult]
        },
        isLoading: false,
        error: null
      });

      renderWithProviders(<ResourceDetail />, '/resources/1');

      // Wait for resource detail to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify validation details are displayed
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
      expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    });

    it('should display validation aspect breakdown', async () => {
      mockUseQuery.mockReturnValue({
        data: {
          resource: mockResources[0],
          validationResults: [mockValidationResult]
        },
        isLoading: false,
        error: null
      });

      renderWithProviders(<ResourceDetail />, '/resources/1');

      // Wait for resource detail to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify aspect breakdown is displayed
      expect(screen.getByText(/structural/i)).toBeInTheDocument();
      expect(screen.getByText(/profile/i)).toBeInTheDocument();
      expect(screen.getByText(/reference/i)).toBeInTheDocument();
      expect(screen.getByText(/terminology/i)).toBeInTheDocument();
      expect(screen.getByText(/business rule/i)).toBeInTheDocument();
      expect(screen.getByText(/metadata/i)).toBeInTheDocument();
    });

    it('should filter validation details based on settings', async () => {
      const filteredSettings = {
        settings: {
          structural: { enabled: false, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      mockUseQuery
        .mockReturnValueOnce({
          data: {
            resource: mockResources[0],
            validationResults: [mockValidationResult]
          },
          isLoading: false,
          error: null
        })
        .mockReturnValueOnce({
          data: filteredSettings,
          isLoading: false,
          error: null
        });

      renderWithProviders(<ResourceDetail />, '/resources/1');

      // Wait for resource detail to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify filtered validation details
      // Should show reduced error count since structural errors are filtered out
      expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    });

    it('should handle missing validation results in detail view', async () => {
      const resourceWithoutValidation = {
        ...mockResources[0],
        _validationSummary: null
      };

      mockUseQuery.mockReturnValue({
        data: {
          resource: resourceWithoutValidation,
          validationResults: []
        },
        isLoading: false,
        error: null
      });

      renderWithProviders(<ResourceDetail />, '/resources/1');

      // Wait for resource detail to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify "Not Validated" status is displayed
      expect(screen.getByText(/not validated/i)).toBeInTheDocument();
    });
  });

  describe('Validation Cache Invalidation', () => {
    it('should invalidate cache when validation settings change', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      mockUseQuery.mockReturnValue({
        data: mockValidationSettings,
        isLoading: false,
        error: null
      });

      renderWithProviders(<ResourceList />);

      // Simulate settings change
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify cache invalidation was triggered
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['validation-settings']
      });
    });

    it('should handle cache invalidation errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
        .mockRejectedValue(new Error('Cache invalidation failed'));

      mockUseQuery.mockReturnValue({
        data: mockValidationSettings,
        isLoading: false,
        error: null
      });

      renderWithProviders(<ResourceList />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Verify error was handled gracefully
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate cache')
      );

      consoleErrorSpy.mockRestore();
      invalidateQueriesSpy.mockRestore();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large validation result datasets efficiently', async () => {
      const largeResources = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        _dbId: i + 1,
        resourceType: 'Patient',
        resourceId: `patient-${i}`,
        data: { id: `patient-${i}`, resourceType: 'Patient' },
        lastUpdated: new Date('2024-01-15T09:00:00Z'),
        _validationSummary: {
          isValid: i % 2 === 0,
          hasErrors: i % 2 !== 0,
          hasWarnings: i % 3 === 0,
          errorCount: i % 2 !== 0 ? 1 : 0,
          warningCount: i % 3 === 0 ? 1 : 0,
          informationCount: 0,
          validationScore: i % 2 === 0 ? 100 : 75,
          lastValidated: new Date('2024-01-15T10:00:00Z'),
          issues: i % 2 !== 0 ? [{ aspect: 'structural', severity: 'error', message: 'Test error' }] : []
        }
      }));

      mockUseQuery.mockReturnValue({
        data: {
          resources: largeResources,
          total: 100,
          page: 1,
          limit: 100
        },
        isLoading: false,
        error: null
      });

      const startTime = Date.now();

      renderWithProviders(<ResourceList />);

      // Wait for all resources to render
      await waitFor(() => {
        expect(screen.getByText('patient-0')).toBeInTheDocument();
        expect(screen.getByText('patient-99')).toBeInTheDocument();
      });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Verify all resources rendered
      expect(screen.getAllByText(/patient-/)).toHaveLength(100);
      
      // Verify performance is acceptable (adjust threshold as needed)
      expect(renderTime).toBeLessThan(5000); // 5 seconds
    });

    it('should clean up validation cache on component unmount', async () => {
      const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');

      mockUseQuery.mockReturnValue({
        data: {
          resources: mockResources,
          total: 3,
          page: 1,
          limit: 10
        },
        isLoading: false,
        error: null
      });

      const { unmount } = renderWithProviders(<ResourceList />);

      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Verify cache cleanup occurred
      expect(removeQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['validation-settings']
      });

      removeQueriesSpy.mockRestore();
    });

    it('should handle rapid validation settings changes efficiently', async () => {
      const settingsChanges = [
        mockValidationSettings,
        {
          settings: {
            structural: { enabled: false, severity: 'error' },
            profile: { enabled: true, severity: 'error' },
            terminology: { enabled: true, severity: 'warning' },
            reference: { enabled: true, severity: 'error' },
            businessRule: { enabled: true, severity: 'warning' },
            metadata: { enabled: true, severity: 'info' }
          }
        },
        mockValidationSettings
      ];

      mockUseQuery
        .mockReturnValueOnce({
          data: {
            resources: mockResources,
            total: 3,
            page: 1,
            limit: 10
          },
          isLoading: false,
          error: null
        })
        .mockReturnValueOnce({
          data: settingsChanges[0],
          isLoading: false,
          error: null
        });

      const { rerender } = renderWithProviders(<ResourceList />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('patient-1')).toBeInTheDocument();
      });

      // Apply rapid settings changes
      for (let i = 1; i < settingsChanges.length; i++) {
        mockUseQuery
          .mockReturnValueOnce({
            data: {
              resources: mockResources,
              total: 3,
              page: 1,
              limit: 10
            },
            isLoading: false,
            error: null
          })
          .mockReturnValueOnce({
            data: settingsChanges[i],
            isLoading: false,
            error: null
          });

        rerender(<ResourceList />);

        await waitFor(() => {
          expect(screen.getByText('patient-1')).toBeInTheDocument();
        });
      }

      // Verify component remained stable through rapid changes
      expect(screen.getByText('patient-1')).toBeInTheDocument();
    });
  });
});
