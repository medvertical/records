import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ValidationControlPanel } from './ValidationControlPanel';
import { useValidationPolling } from '@/hooks/use-validation-polling';
import { useValidationSettingsIntegration } from '@/lib/validation-settings-integration';
// Change detection is now handled by the settings hook
import { useToast } from '@/hooks/use-toast';
import { usePerformanceMonitoring } from '@/hooks/use-performance-monitoring';

// Mock all the hooks and utilities
vi.mock('@/hooks/use-validation-polling');
vi.mock('@/lib/validation-settings-integration');
// Change detection is now handled by the settings hook
vi.mock('@/hooks/use-toast');
vi.mock('@/hooks/use-performance-monitoring');
vi.mock('@/lib/confirmation-dialog-utils');
vi.mock('@/lib/network-error-handler');
vi.mock('@/lib/advanced-retry-mechanisms');
vi.mock('@/lib/graceful-degradation');
vi.mock('@/lib/user-friendly-error-messages');
vi.mock('@/lib/error-logging-monitoring');
vi.mock('@/lib/timeout-handling');
vi.mock('@/lib/error-recovery-mechanisms');
vi.mock('@/lib/validation-error-utils');
vi.mock('@/lib/responsive-design-utils');
vi.mock('@/lib/accessibility-utils');
vi.mock('@/lib/loading-states-utils');
// ValidationSettingsModal removed - using simplified settings tab instead
vi.mock('./ValidationProgressDisplay', () => ({
  ValidationProgressDisplay: ({ progress }: { progress: any }) => (
    <div data-testid="validation-progress-display">
      {progress ? `Progress: ${progress.processedResources}/${progress.totalResources}` : 'No progress'}
    </div>
  ),
}));
vi.mock('./ValidationStatusBadge', () => ({
  ValidationStatusBadge: ({ status }: { status: string }) => (
    <div data-testid="validation-status-badge">{status}</div>
  ),
}));
vi.mock('./ValidationErrorWarningDisplay', () => ({
  ValidationErrorWarningDisplay: ({ errors, warnings }: { errors: any[]; warnings: any[] }) => (
    <div data-testid="validation-error-warning-display">
      Errors: {errors.length}, Warnings: {warnings.length}
    </div>
  ),
}));
vi.mock('./ErrorRecoveryDisplay', () => ({
  default: ({ failures }: { failures: any[] }) => (
    <div data-testid="error-recovery-display">
      Failures: {failures.length}
    </div>
  ),
}));
vi.mock('./ValidationAspectsPanel', () => ({
  default: () => <div data-testid="validation-aspects-panel">Validation Aspects Panel</div>,
}));
vi.mock('../performance/PerformanceMonitoringDashboard', () => ({
  default: () => <div data-testid="performance-monitoring-dashboard">Performance Monitoring</div>,
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('ValidationControlPanel', () => {
  const mockUseValidationPolling = vi.mocked(useValidationPolling);
  const mockUseValidationSettingsIntegration = vi.mocked(useValidationSettingsIntegration);
  const mockUseValidationSettingsChangeDetection = vi.mocked(useValidationSettingsChangeDetection);
  const mockUseToast = vi.mocked(useToast);
  const mockUsePerformanceMonitoring = vi.mocked(usePerformanceMonitoring);

  const defaultMockPolling = {
    progress: null,
    validationStatus: 'idle',
    isConnected: true,
    connectionState: 'connected',
    lastError: null,
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    resetProgress: vi.fn(),
    reconnect: vi.fn(),
    syncWithApi: vi.fn(),
    restoreFromPersistence: vi.fn(),
  };

  const defaultMockSettings = {
    settings: {
      aspects: {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: false, severity: 'warning' },
      },
    },
    loading: false,
    error: null,
    aspects: [
      { id: 'structural', name: 'Structural', enabled: true, severity: 'error' },
      { id: 'profile', name: 'Profile', enabled: false, severity: 'warning' },
    ],
    enabledAspects: [{ id: 'structural', name: 'Structural', enabled: true, severity: 'error' }],
    getValidationPayload: vi.fn(() => ({
      resourceTypes: ['Patient'],
      validationAspects: { structural: true },
      config: {},
    })),
  };

  const defaultMockChangeDetection = {
    hasChanges: false,
    isDirty: false,
    changeCount: 0,
    lastChangeTime: null,
  };

  const defaultMockToast = {
    toast: vi.fn(),
  };

  const defaultMockPerformanceMonitoring = {
    recordOperation: vi.fn(),
    startOperation: vi.fn(),
    executeWithMonitoring: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseValidationPolling.mockReturnValue(defaultMockPolling);
    mockUseValidationSettingsIntegration.mockReturnValue(defaultMockSettings);
    mockUseValidationSettingsChangeDetection.mockReturnValue(defaultMockChangeDetection);
    mockUseToast.mockReturnValue(defaultMockToast);
    mockUsePerformanceMonitoring.mockReturnValue(defaultMockPerformanceMonitoring);

    // Mock all the utility hooks to return basic implementations
    vi.mocked(require('@/lib/confirmation-dialog-utils').useConfirmationDialog).mockReturnValue({
      showConfirmation: vi.fn(),
    });
    vi.mocked(require('@/lib/network-error-handler').useNetworkErrorHandler).mockReturnValue({
      handleNetworkError: vi.fn(),
      executeWithRetry: vi.fn(),
    });
    vi.mocked(require('@/lib/advanced-retry-mechanisms').useAdvancedRetry).mockReturnValue({
      executeWithRetry: vi.fn(),
      getStats: vi.fn(() => ({
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        averageDelay: 0,
        circuitBreakerState: 'closed',
      })),
    });
    vi.mocked(require('@/lib/graceful-degradation').useGracefulDegradation).mockReturnValue({
      executeWithDegradation: vi.fn(),
      getServiceStatus: vi.fn(),
      getAllServiceStatuses: vi.fn(() => []),
      areServicesAvailable: vi.fn(() => true),
      isOffline: vi.fn(() => false),
      getFallbackData: vi.fn(),
      storeFallbackData: vi.fn(),
      getCacheStats: vi.fn(() => ({ valid: 0, expired: 0 })),
    });
    vi.mocked(require('@/lib/user-friendly-error-messages').useUserFriendlyErrors).mockReturnValue({
      createAndDisplayError: vi.fn(),
      getErrors: vi.fn(() => []),
      dismissError: vi.fn(),
    });
    vi.mocked(require('@/lib/error-logging-monitoring').useErrorLogging).mockReturnValue({
      logError: vi.fn(),
      logWarning: vi.fn(),
      logInfo: vi.fn(),
      recordPerformance: vi.fn(),
      getAnalytics: vi.fn(() => null),
    });
    vi.mocked(require('@/lib/timeout-handling').useTimeoutHandling).mockReturnValue({
      startOperation: vi.fn(),
      completeOperation: vi.fn(),
      cancelOperation: vi.fn(),
      getOperationStatus: vi.fn(),
      getActiveOperations: vi.fn(() => []),
      executeWithTimeout: vi.fn(),
      fetchWithTimeout: vi.fn(),
    });
    vi.mocked(require('@/lib/error-recovery-mechanisms').useErrorRecovery).mockReturnValue({
      createCheckpoint: vi.fn(),
      getLatestCheckpoint: vi.fn(),
      recordPartialFailure: vi.fn(),
      attemptAutomaticRecovery: vi.fn(),
      executeRecoveryOption: vi.fn(),
      getRecoveryStats: vi.fn(() => null),
    });
    vi.mocked(require('@/lib/validation-error-utils').convertApiErrorsToValidationErrors).mockReturnValue([]);
    vi.mocked(require('@/lib/validation-error-utils').convertApiWarningsToValidationWarnings).mockReturnValue([]);
    vi.mocked(require('@/lib/responsive-design-utils').getResponsiveClassNames).mockImplementation((...args) => args[0]);
    vi.mocked(require('@/lib/accessibility-utils').accessibility).mockReturnValue({
      region: vi.fn(() => ({})),
      button: vi.fn(() => ({})),
      statusIndicator: vi.fn(() => ({})),
      errorMessage: vi.fn(() => ({})),
      dialog: vi.fn(() => ({})),
    });
    vi.mocked(require('@/lib/accessibility-utils').keyboardNavigation).mockReturnValue({
      handleEscape: vi.fn(() => vi.fn()),
      handleEnter: vi.fn(() => vi.fn()),
    });
    vi.mocked(require('@/lib/accessibility-utils').screenReader).mockReturnValue({
      srOnly: vi.fn(() => null),
    });
    vi.mocked(require('@/lib/loading-states-utils').LoadingSpinner).mockReturnValue(<div data-testid="loading-spinner">Loading...</div>);
    vi.mocked(require('@/lib/loading-states-utils').ComponentLoadingStates).mockReturnValue({
      ValidationControlPanel: <div data-testid="component-loading-state">Loading component...</div>,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the validation control panel with correct title', () => {
      render(<ValidationControlPanel />);
      
      expect(screen.getByText('Validation Control Panel')).toBeInTheDocument();
    });

    it('shows loading state during initialization', async () => {
      render(<ValidationControlPanel />);
      
      // The component shows loading state for 1 second during initialization
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Initializing...')).toBeInTheDocument();
      
      // Wait for initialization to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('renders validation status badge', () => {
      render(<ValidationControlPanel />);
      
      expect(screen.getByTestId('validation-status-badge')).toBeInTheDocument();
    });

    it('renders validation aspects panel', () => {
      render(<ValidationControlPanel />);
      
      expect(screen.getByTestId('validation-aspects-panel')).toBeInTheDocument();
    });

    it('renders performance monitoring dashboard', () => {
      render(<ValidationControlPanel />);
      
      expect(screen.getByTestId('performance-monitoring-dashboard')).toBeInTheDocument();
    });
  });

  describe('Control Buttons', () => {
    it('shows start and restore buttons when status is idle', async () => {
      render(<ValidationControlPanel />);
      
      // Wait for initialization to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Start Validation')).toBeInTheDocument();
      expect(screen.getByText('Restore State')).toBeInTheDocument();
    });

    it('shows pause and stop buttons when status is running', async () => {
      mockUseValidationPolling.mockReturnValue({
        ...defaultMockPolling,
        validationStatus: 'running',
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });

    it('shows resume and stop buttons when status is paused', async () => {
      mockUseValidationPolling.mockReturnValue({
        ...defaultMockPolling,
        validationStatus: 'paused',
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Resume')).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });

    it('always shows settings, clear data, and refresh buttons', async () => {
      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Clear Data')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('shows progress display when validation is running', async () => {
      const mockProgress = {
        totalResources: 100,
        processedResources: 50,
        validResources: 45,
        errorResources: 5,
        currentResourceType: 'Patient',
        processingRate: '10',
        estimatedTimeRemaining: '5s',
        startTime: new Date(),
        status: 'running' as const,
      };

      mockUseValidationPolling.mockReturnValue({
        ...defaultMockPolling,
        validationStatus: 'running',
        progress: mockProgress,
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('validation-progress-display')).toBeInTheDocument();
    });

    it('does not show progress display when status is idle', async () => {
      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('validation-progress-display')).not.toBeInTheDocument();
    });
  });

  describe('Error and Warning Display', () => {
    it('shows error and warning display when there are errors or warnings', async () => {
      const mockErrors = [
        {
          id: '1',
          type: 'validation',
          severity: 'high' as const,
          message: 'Test error',
          timestamp: new Date(),
        },
      ];

      const mockWarnings = [
        {
          id: '1',
          type: 'validation',
          severity: 'medium' as const,
          message: 'Test warning',
          timestamp: new Date(),
        },
      ];

      // Mock the component to have errors and warnings
      const { ValidationErrorWarningDisplay } = require('./ValidationErrorWarningDisplay');
      vi.mocked(ValidationErrorWarningDisplay).mockImplementation(({ errors, warnings }: { errors: any[]; warnings: any[] }) => (
        <div data-testid="validation-error-warning-display">
          Errors: {errors.length}, Warnings: {warnings.length}
        </div>
      ));

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // The component should show the error/warning display
      expect(screen.getByTestId('validation-error-warning-display')).toBeInTheDocument();
    });
  });

  describe('Settings Modal', () => {
    it('opens settings modal when settings button is clicked', async () => {
      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      const settingsButton = screen.getByText('Settings');
      fireEvent.click(settingsButton);

      expect(screen.getByTestId('validation-settings-modal')).toBeInTheDocument();
    });

    it('closes settings modal when close button is clicked', async () => {
      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Open modal
      const settingsButton = screen.getByText('Settings');
      fireEvent.click(settingsButton);
      
      expect(screen.getByTestId('validation-settings-modal')).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByText('Close Modal');
      fireEvent.click(closeButton);

      // Modal should be hidden (display: none)
      const modal = screen.getByTestId('validation-settings-modal');
      expect(modal).toHaveStyle({ display: 'none' });
    });
  });

  describe('Network Status Indicators', () => {
    it('shows online status when connected', async () => {
      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Should show online indicator
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('shows offline status when disconnected', async () => {
      mockUseValidationPolling.mockReturnValue({
        ...defaultMockPolling,
        isConnected: false,
        connectionState: 'disconnected',
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Connection Error Handling', () => {
    it('shows connection error when lastError is present', async () => {
      mockUseValidationPolling.mockReturnValue({
        ...defaultMockPolling,
        isConnected: false,
        lastError: 'Connection failed',
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('shows retry button when connection error is present', async () => {
      mockUseValidationPolling.mockReturnValue({
        ...defaultMockPolling,
        isConnected: false,
        lastError: 'Connection failed',
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Settings Changes Indicator', () => {
    it('shows settings changes indicator when there are changes', async () => {
      mockUseValidationSettingsChangeDetection.mockReturnValue({
        ...defaultMockChangeDetection,
        hasChanges: true,
        changeCount: 2,
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('2 changes')).toBeInTheDocument();
    });

    it('does not show settings changes indicator when there are no changes', async () => {
      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(screen.queryByText(/changes/)).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive class names correctly', () => {
      const { getResponsiveClassNames } = require('@/lib/responsive-design-utils');
      
      render(<ValidationControlPanel />);
      
      // Verify that getResponsiveClassNames is called
      expect(getResponsiveClassNames).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('applies accessibility attributes correctly', () => {
      const { accessibility } = require('@/lib/accessibility-utils');
      
      render(<ValidationControlPanel />);
      
      // Verify that accessibility utilities are called
      expect(accessibility.region).toHaveBeenCalled();
      expect(accessibility.button).toHaveBeenCalled();
      expect(accessibility.statusIndicator).toHaveBeenCalled();
    });

    it('handles keyboard navigation', () => {
      const { keyboardNavigation } = require('@/lib/accessibility-utils');
      
      render(<ValidationControlPanel />);
      
      // Verify that keyboard navigation utilities are called
      expect(keyboardNavigation.handleEscape).toHaveBeenCalled();
      expect(keyboardNavigation.handleEnter).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Display', () => {
    it('shows error recovery display when there are partial failures', async () => {
      // Mock partial failures
      const mockPartialFailures = [
        {
          id: '1',
          failureType: 'network',
          severity: 'medium',
          affectedItems: ['item1', 'item2'],
          completedItems: ['item1'],
          failedItems: ['item2'],
          error: new Error('Network error'),
          timestamp: new Date(),
          operationId: 'op1',
          context: { component: 'TestComponent' },
          recoveryOptions: [],
        },
      ];

      // Mock the error recovery hook to return failures
      vi.mocked(require('@/lib/error-recovery-mechanisms').useErrorRecovery).mockReturnValue({
        createCheckpoint: vi.fn(),
        getLatestCheckpoint: vi.fn(),
        recordPartialFailure: vi.fn(() => mockPartialFailures[0]),
        attemptAutomaticRecovery: vi.fn(),
        executeRecoveryOption: vi.fn(),
        getRecoveryStats: vi.fn(() => null),
      });

      render(<ValidationControlPanel />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // The component should show error recovery display when there are failures
      expect(screen.getByTestId('error-recovery-display')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('integrates with all required hooks and utilities', () => {
      render(<ValidationControlPanel />);
      
      // Verify all hooks are called
      expect(mockUseValidationPolling).toHaveBeenCalled();
      expect(mockUseValidationSettingsIntegration).toHaveBeenCalled();
      expect(mockUseValidationSettingsChangeDetection).toHaveBeenCalled();
      expect(mockUseToast).toHaveBeenCalled();
      expect(mockUsePerformanceMonitoring).toHaveBeenCalled();
    });

    it('handles missing or undefined props gracefully', () => {
      expect(() => {
        render(<ValidationControlPanel className={undefined} />);
      }).not.toThrow();
    });
  });
});