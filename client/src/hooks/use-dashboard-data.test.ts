// ============================================================================
// Dashboard Data Hook Tests
// ============================================================================

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardData } from './use-dashboard-data';
import { FhirServerStats, ValidationStats } from '@shared/types/dashboard';

// Mock fetch
global.fetch = jest.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useDashboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch dashboard data successfully', async () => {
    const mockFhirServerStats: FhirServerStats = {
      totalResources: 1000,
      resourceCounts: { 'Patient': 500, 'Observation': 500 },
      serverInfo: {
        version: 'R4',
        connected: true,
        lastChecked: new Date(),
        error: undefined
      },
      resourceBreakdown: [
        { type: 'Patient', count: 500, percentage: 50 },
        { type: 'Observation', count: 500, percentage: 50 }
      ]
    };

    const mockValidationStats: ValidationStats = {
      totalValidated: 100,
      validResources: 80,
      errorResources: 15,
      warningResources: 5,
      unvalidatedResources: 900,
      validationCoverage: 80,
      validationProgress: 10,
      lastValidationRun: new Date(),
      resourceTypeBreakdown: {}
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFhirServerStats)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockValidationStats)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          fhirServer: mockFhirServerStats,
          validation: mockValidationStats,
          lastUpdated: new Date(),
          dataFreshness: {
            fhirServer: new Date(),
            validation: new Date()
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          totalResources: 1000,
          validResources: 80,
          errorResources: 15,
          warningResources: 5,
          unvalidatedResources: 900,
          validationCoverage: 80,
          validationProgress: 10,
          activeProfiles: 1,
          resourceBreakdown: []
        })
      });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.fhirServerStats).toEqual(mockFhirServerStats);
    expect(result.current.validationStats).toEqual(mockValidationStats);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.fhirServerStats).toBeUndefined();
    expect(result.current.validationStats).toBeUndefined();
  });

  it('should provide refetch functions', async () => {
    const mockStats = {
      totalResources: 1000,
      resourceCounts: {},
      serverInfo: {
        version: 'R4',
        connected: true,
        lastChecked: new Date()
      },
      resourceBreakdown: []
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats)
    });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
    expect(typeof result.current.refetchFhirServer).toBe('function');
    expect(typeof result.current.refetchValidation).toBe('function');
  });

  it('should track data freshness', async () => {
    const mockStats = {
      totalResources: 1000,
      resourceCounts: {},
      serverInfo: {
        version: 'R4',
        connected: true,
        lastChecked: new Date()
      },
      resourceBreakdown: []
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats)
    });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(typeof result.current.isStale).toBe('boolean');
  });
});
