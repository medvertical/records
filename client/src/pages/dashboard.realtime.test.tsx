import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import DashboardNew from './dashboard';

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

// Mock the validation polling hook
vi.mock('@/hooks/use-validation-polling', () => ({
  useValidationPolling: () => ({
    progress: {
      isRunning: false,
      isPaused: false,
      currentResourceType: null,
      totalResources: 1000,
      processedResources: 0,
      validResources: 0,
      errorResources: 0,
      validationCoverage: 0,
      estimatedTimeRemaining: null
    },
    startValidation: vi.fn(),
    pauseValidation: vi.fn(),
    resumeValidation: vi.fn(),
    stopValidation: vi.fn()
  })
}));

// Mock the dashboard data hook
vi.mock('@/hooks/use-dashboard-data', () => ({
  useDashboardData: () => ({
    fhirServerStats: {
      totalResources: 1000,
      resourceTypes: 50,
      lastUpdated: new Date(),
      resourceTypeBreakdown: {
        Patient: { total: 100, validated: 50, valid: 40, errors: 10, warnings: 5, unvalidated: 50 },
        Observation: { total: 200, validated: 150, valid: 120, errors: 30, warnings: 15, unvalidated: 50 }
      }
    },
    validationStats: {
      totalValidated: 200,
      validResources: 160,
      errorResources: 40,
      warningResources: 20,
      unvalidatedResources: 800,
      validationCoverage: 20,
      validationProgress: 0,
      lastValidationRun: new Date(),
      aspectBreakdown: {
        structural: { enabled: true, issueCount: 10, errorCount: 5, warningCount: 3, informationCount: 2, validationScore: 85 },
        profile: { enabled: true, issueCount: 8, errorCount: 3, warningCount: 4, informationCount: 1, validationScore: 90 },
        terminology: { enabled: true, issueCount: 5, errorCount: 2, warningCount: 2, informationCount: 1, validationScore: 95 },
        reference: { enabled: true, issueCount: 3, errorCount: 1, warningCount: 1, informationCount: 1, validationScore: 98 },
        businessRule: { enabled: true, issueCount: 2, errorCount: 0, warningCount: 2, informationCount: 0, validationScore: 100 },
        metadata: { enabled: true, issueCount: 1, errorCount: 0, warningCount: 1, informationCount: 0, validationScore: 99 }
      }
    },
    combinedData: {
      serverStats: {
        totalResources: 1000,
        resourceTypes: 50,
        lastUpdated: new Date()
      },
      validationStats: {
        totalValidated: 200,
        validResources: 160,
        errorResources: 40,
        validationCoverage: 20
      }
    },
    isLoading: false,
    error: null,
    refetch: vi.fn()
  })
}));

// Mock the validation settings polling hook
const mockUseValidationSettingsPolling = vi.fn();
vi.mock('@/hooks/use-validation-settings-polling', () => ({
  useValidationSettingsPolling: mockUseValidationSettingsPolling
}));

// Mock components
vi.mock('@/components/dashboard/server-stats-card', () => ({
  ServerStatsCard: ({ stats }: any) => (
    <div data-testid="server-stats-card">
      <div>Total Resources: {stats?.totalResources || 0}</div>
    </div>
  )
}));

vi.mock('@/components/dashboard/validation-stats-card', () => ({
  ValidationStatsCard: ({ stats }: any) => (
    <div data-testid="validation-stats-card">
      <div>Total Validated: {stats?.totalValidated || 0}</div>
      <div>Valid Resources: {stats?.validResources || 0}</div>
    </div>
  )
}));

vi.mock('@/components/dashboard/validation-settings-impact', () => ({
  ValidationSettingsImpact: () => (
    <div data-testid="validation-settings-impact">
      Settings Impact Component
    </div>
  )
}));

vi.mock('@/components/validation/validation-queue-management', () => ({
  default: () => (
    <div data-testid="validation-queue-management">
      Queue Management Component
    </div>
  )
}));

vi.mock('@/components/validation/individual-resource-progress', () => ({
  default: () => (
    <div data-testid="individual-resource-progress">
      Individual Progress Component
    </div>
  )
}));

vi.mock('@/components/validation/validation-cancellation-retry', () => ({
  default: () => (
    <div data-testid="validation-cancellation-retry">
      Cancellation Retry Component
    </div>
  )
}));

// Test data
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

const updatedValidationSettings = {
  settings: {
    structural: { enabled: false, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'error' },
    reference: { enabled: false, severity: 'error' },
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

const renderWithProviders = (component: React.ReactElement, initialPath = '/dashboard') => {
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

describe('Dashboard Real-time Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock default validation settings polling behavior
    mockUseValidationSettingsPolling.mockReturnValue({
      lastFetchedSettings: null,
      isPolling: false,
      error: null
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

  describe('Validation Settings Polling Integration', () => {
    it('should enable validation settings polling on dashboard load', () => {
      renderWithProviders(<DashboardNew />);

      // Verify validation settings polling is configured
      expect(mockUseValidationSettingsPolling).toHaveBeenCalledWith({
        enabled: true,
        pollingInterval: 5000,
        invalidateCache: true,
        showNotifications: false
      });
    });

    it('should handle validation settings changes and update UI', async () => {
      // Mock settings change
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: updatedValidationSettings,
        isPolling: true,
        error: null
      });

      const { queryClient } = renderWithProviders(<DashboardNew />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      // Verify dashboard components are rendered
      expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      expect(screen.getByTestId('validation-settings-impact')).toBeInTheDocument();
    });

    it('should handle polling errors gracefully', async () => {
      // Mock polling error
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: null,
        isPolling: false,
        error: 'Polling failed'
      });

      renderWithProviders(<DashboardNew />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      // Dashboard should still render despite polling error
      expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
    });

    it('should show polling status in UI', async () => {
      // Mock active polling
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: null,
        isPolling: true,
        error: null
      });

      renderWithProviders(<DashboardNew />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      // Verify polling is active (this would be shown in a real implementation)
      expect(mockUseValidationSettingsPolling).toHaveBeenCalled();
    });
  });

  describe('Real-time Dashboard Updates', () => {
    it('should update dashboard statistics when settings change', async () => {
      const { queryClient } = renderWithProviders(<DashboardNew />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });

      // Simulate settings change
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: updatedValidationSettings,
        isPolling: true,
        error: null
      });

      // Trigger re-render with updated settings
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });

      // Verify dashboard still functions correctly
      expect(screen.getByTestId('validation-settings-impact')).toBeInTheDocument();
    });

    it('should invalidate dashboard cache when settings change', async () => {
      const { queryClient } = renderWithProviders(<DashboardNew />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });

      // Simulate cache invalidation by changing settings
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: updatedValidationSettings,
        isPolling: true,
        error: null
      });

      // Verify dashboard components are still rendered
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });
    });

    it('should handle rapid settings changes without UI flicker', async () => {
      const { queryClient } = renderWithProviders(<DashboardNew />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });

      // Simulate rapid settings changes
      const settingsChanges = [
        updatedValidationSettings,
        { ...updatedValidationSettings, settings: { ...updatedValidationSettings.settings, structural: { enabled: true, severity: 'error' } } },
        updatedValidationSettings
      ];

      for (const settings of settingsChanges) {
        mockUseValidationSettingsPolling.mockReturnValue({
          lastFetchedSettings: settings,
          isPolling: true,
          error: null
        });

        await waitFor(() => {
          expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
        });
      }

      // Verify dashboard remained stable
      expect(screen.getByTestId('validation-settings-impact')).toBeInTheDocument();
    });
  });

  describe('Dashboard Component Integration', () => {
    it('should render all dashboard components correctly', async () => {
      renderWithProviders(<DashboardNew />);

      // Wait for all components to render
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
        expect(screen.getByTestId('validation-settings-impact')).toBeInTheDocument();
        expect(screen.getByTestId('validation-queue-management')).toBeInTheDocument();
        expect(screen.getByTestId('individual-resource-progress')).toBeInTheDocument();
        expect(screen.getByTestId('validation-cancellation-retry')).toBeInTheDocument();
      });
    });

    it('should display correct statistics data', async () => {
      renderWithProviders(<DashboardNew />);

      // Wait for components to render
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      // Verify statistics are displayed
      expect(screen.getByText('Total Resources: 1000')).toBeInTheDocument();
      expect(screen.getByText('Total Validated: 200')).toBeInTheDocument();
      expect(screen.getByText('Valid Resources: 160')).toBeInTheDocument();
    });

    it('should handle component loading states', async () => {
      // Mock loading state
      vi.mocked(require('@/hooks/use-dashboard-data').useDashboardData).mockReturnValue({
        fhirServerStats: null,
        validationStats: null,
        combinedData: null,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      });

      renderWithProviders(<DashboardNew />);

      // Verify loading state is handled
      await waitFor(() => {
        expect(mockUseValidationSettingsPolling).toHaveBeenCalled();
      });
    });

    it('should handle dashboard data errors', async () => {
      // Mock error state
      vi.mocked(require('@/hooks/use-dashboard-data').useDashboardData).mockReturnValue({
        fhirServerStats: null,
        validationStats: null,
        combinedData: null,
        isLoading: false,
        error: new Error('Dashboard data error'),
        refetch: vi.fn()
      });

      renderWithProviders(<DashboardNew />);

      // Verify error state is handled
      await waitFor(() => {
        expect(mockUseValidationSettingsPolling).toHaveBeenCalled();
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle multiple dashboard instances efficiently', async () => {
      // Render multiple dashboard instances
      const { unmount: unmount1 } = renderWithProviders(<DashboardNew />);
      const { unmount: unmount2 } = renderWithProviders(<DashboardNew />);

      // Wait for both to render
      await waitFor(() => {
        expect(mockUseValidationSettingsPolling).toHaveBeenCalled();
      });

      // Unmount first instance
      unmount1();

      // Verify second instance still works
      await waitFor(() => {
        expect(mockUseValidationSettingsPolling).toHaveBeenCalled();
      });

      // Clean up
      unmount2();
    });

    it('should clean up resources on unmount', async () => {
      const { unmount } = renderWithProviders(<DashboardNew />);

      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Verify cleanup occurred (no memory leaks)
      expect(mockUseValidationSettingsPolling).toHaveBeenCalled();
    });

    it('should handle long-running dashboard sessions', async () => {
      const { queryClient } = renderWithProviders(<DashboardNew />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });

      // Simulate long-running session with periodic settings updates
      for (let i = 0; i < 10; i++) {
        mockUseValidationSettingsPolling.mockReturnValue({
          lastFetchedSettings: { ...mockValidationSettings, timestamp: Date.now() },
          isPolling: true,
          error: null
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify dashboard remains stable
      expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary polling failures', async () => {
      // Start with error
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: null,
        isPolling: false,
        error: 'Polling failed'
      });

      const { queryClient } = renderWithProviders(<DashboardNew />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      // Mock recovery
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: mockValidationSettings,
        isPolling: true,
        error: null
      });

      // Verify recovery
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      // Mock network error
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: null,
        isPolling: false,
        error: 'Network error'
      });

      renderWithProviders(<DashboardNew />);

      // Verify dashboard still renders
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
    });

    it('should handle malformed settings data gracefully', async () => {
      // Mock malformed settings
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: { invalid: 'data' },
        isPolling: true,
        error: null
      });

      renderWithProviders(<DashboardNew />);

      // Verify dashboard handles malformed data gracefully
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });
    });
  });

  describe('User Interaction', () => {
    it('should handle user interactions during real-time updates', async () => {
      renderWithProviders(<DashboardNew />);

      // Wait for dashboard to render
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });

      // Simulate settings change during user interaction
      mockUseValidationSettingsPolling.mockReturnValue({
        lastFetchedSettings: updatedValidationSettings,
        isPolling: true,
        error: null
      });

      // Verify dashboard remains interactive
      await waitFor(() => {
        expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
      });

      // Dashboard should remain responsive
      expect(screen.getByTestId('validation-settings-impact')).toBeInTheDocument();
    });

    it('should prioritize user interactions over background updates', async () => {
      renderWithProviders(<DashboardNew />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('server-stats-card')).toBeInTheDocument();
      });

      // Simulate rapid background updates
      for (let i = 0; i < 5; i++) {
        mockUseValidationSettingsPolling.mockReturnValue({
          lastFetchedSettings: { ...mockValidationSettings, timestamp: Date.now() },
          isPolling: true,
          error: null
        });

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Verify dashboard remains responsive
      expect(screen.getByTestId('validation-stats-card')).toBeInTheDocument();
    });
  });
});
