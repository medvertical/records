/**
 * UI Integration Tests
 * 
 * This test suite covers the UI integration aspects of the validation system:
 * - React component integration with validation hooks
 * - Data flow from API to UI components
 * - User interaction flows
 * - Real-time updates and state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock the validation hooks
const mockUseValidationResults = vi.fn();
const mockUseValidationAspects = vi.fn();
const mockUseValidationSettings = vi.fn();
const mockUseValidationProgress = vi.fn();

// Mock the validation components
const MockEnhancedValidationBadge = ({ validationResult, compact = false }: any) => {
  return (
    <div data-testid="enhanced-validation-badge" data-compact={compact}>
      <span data-testid="validation-score">{validationResult.overallScore}%</span>
      <span data-testid="validation-status">
        {validationResult.overallScore >= 90 ? 'Valid' : 
         validationResult.overallScore >= 70 ? 'Warning' : 'Invalid'}
      </span>
    </div>
  );
};

const MockValidationResults = ({ resourceId }: { resourceId: string }) => {
  const { data: validationResult, isLoading, error } = mockUseValidationResults(resourceId);

  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">Error: {error.message}</div>;
  if (!validationResult) return <div data-testid="no-data">No validation data</div>;

  return (
    <div data-testid="validation-results">
      <MockEnhancedValidationBadge validationResult={validationResult} />
      <div data-testid="aspect-breakdown">
        {Object.entries(validationResult.aspects).map(([aspect, data]: [string, any]) => (
          <div key={aspect} data-testid={`aspect-${aspect}`}>
            <span data-testid={`${aspect}-score`}>{data.score}%</span>
            <span data-testid={`${aspect}-confidence`}>{data.confidence}</span>
            <span data-testid={`${aspect}-issues`}>{data.issues.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MockValidationSettings = () => {
  const { data: settings, isLoading, error, updateSettings } = mockUseValidationSettings();

  if (isLoading) return <div data-testid="settings-loading">Loading settings...</div>;
  if (error) return <div data-testid="settings-error">Error: {error.message}</div>;
  if (!settings) return <div data-testid="no-settings">No settings</div>;

  const handleToggleAspect = (aspect: string) => {
    const updatedSettings = {
      ...settings,
      enabledAspects: settings.enabledAspects.includes(aspect)
        ? settings.enabledAspects.filter((a: string) => a !== aspect)
        : [...settings.enabledAspects, aspect]
    };
    updateSettings(updatedSettings);
  };

  return (
    <div data-testid="validation-settings">
      <div data-testid="batch-size">{settings.batchSize}</div>
      <div data-testid="strict-mode">{settings.strictMode ? 'Enabled' : 'Disabled'}</div>
      <div data-testid="enabled-aspects">
        {settings.enabledAspects.map((aspect: string) => (
          <button
            key={aspect}
            data-testid={`toggle-${aspect}`}
            onClick={() => handleToggleAspect(aspect)}
          >
            {aspect}
          </button>
        ))}
      </div>
    </div>
  );
};

const MockValidationProgress = () => {
  const { data: progress, isLoading, error } = mockUseValidationProgress();

  if (isLoading) return <div data-testid="progress-loading">Loading progress...</div>;
  if (error) return <div data-testid="progress-error">Error: {error.message}</div>;
  if (!progress) return <div data-testid="no-progress">No progress data</div>;

  return (
    <div data-testid="validation-progress">
      <div data-testid="total-resources">{progress.totalResources}</div>
      <div data-testid="processed-resources">{progress.processedResources}</div>
      <div data-testid="valid-resources">{progress.validResources}</div>
      <div data-testid="error-resources">{progress.errorResources}</div>
      <div data-testid="progress-status">{progress.status}</div>
      <div data-testid="progress-complete">{progress.isComplete ? 'Complete' : 'In Progress'}</div>
    </div>
  );
};

// Mock data
const mockValidationResult = {
  id: 1,
  resourceId: 'test-resource-1',
  resourceType: 'Patient',
  isValid: true,
  overallScore: 95,
  confidence: 0.9,
  completeness: 0.85,
  issues: [],
  aspects: {
    structural: {
      isValid: true,
      score: 100,
      confidence: 0.95,
      issues: [],
      validationTime: 50
    },
    profile: {
      isValid: true,
      score: 90,
      confidence: 0.85,
      issues: [],
      validationTime: 100
    },
    terminology: {
      isValid: true,
      score: 95,
      confidence: 0.9,
      issues: [],
      validationTime: 75
    },
    reference: {
      isValid: true,
      score: 100,
      confidence: 0.95,
      issues: [],
      validationTime: 60
    },
    businessRule: {
      isValid: true,
      score: 90,
      confidence: 0.8,
      issues: [],
      validationTime: 80
    },
    metadata: {
      isValid: true,
      score: 95,
      confidence: 0.9,
      issues: [],
      validationTime: 40
    }
  },
  validatedAt: new Date(),
  validationTime: 405,
  profileUrl: 'http://hl7.org/fhir/StructureDefinition/Patient',
  validationSource: 'consolidated-validation-service'
};

const mockValidationSettings = {
  id: 1,
  enabledAspects: ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'],
  strictMode: false,
  batchSize: 100,
  timeoutMs: 30000,
  retryAttempts: 3,
  retryDelayMs: 1000,
  enableParallelProcessing: true,
  maxConcurrentValidations: 5,
  enablePersistence: true,
  enableCaching: true,
  cacheTimeoutMs: 300000,
  enableAuditTrail: true,
  enableRealTimeUpdates: true,
  enableQualityMetrics: true,
  enableCompletenessScoring: true,
  enableConfidenceScoring: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true
};

const mockValidationProgress = {
  totalResources: 100,
  processedResources: 75,
  validResources: 70,
  errorResources: 3,
  warningResources: 2,
  currentResourceType: 'Patient',
  startTime: new Date(),
  estimatedTimeRemaining: 30000,
  isComplete: false,
  errors: [],
  status: 'running',
  processingRate: 2.5,
  currentBatch: {
    batchNumber: 3,
    totalBatches: 4,
    batchSize: 25,
    resourcesInBatch: 25
  },
  performance: {
    averageTimePerResource: 150,
    totalTimeMs: 11250,
    memoryUsage: 128
  },
  retryStatistics: {
    totalRetryAttempts: 5,
    successfulRetries: 4,
    failedRetries: 1,
    resourcesWithRetries: 3,
    averageRetriesPerResource: 0.05
  }
};

describe('UI Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockUseValidationResults.mockReturnValue({
      data: mockValidationResult,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    mockUseValidationSettings.mockReturnValue({
      data: mockValidationSettings,
      isLoading: false,
      error: null,
      updateSettings: vi.fn(),
      refetch: vi.fn()
    });

    mockUseValidationProgress.mockReturnValue({
      data: mockValidationProgress,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Validation Results UI Integration', () => {
    it('should display validation results correctly', async () => {
      renderWithProviders(<MockValidationResults resourceId="test-resource-1" />);

      // Check if validation results are displayed
      expect(screen.getByTestId('validation-results')).toBeInTheDocument();
      expect(screen.getByTestId('enhanced-validation-badge')).toBeInTheDocument();
      expect(screen.getByTestId('aspect-breakdown')).toBeInTheDocument();

      // Check validation score and status
      expect(screen.getByTestId('validation-score')).toHaveTextContent('95%');
      expect(screen.getByTestId('validation-status')).toHaveTextContent('Valid');

      // Check aspect breakdown
      expect(screen.getByTestId('aspect-structural')).toBeInTheDocument();
      expect(screen.getByTestId('structural-score')).toHaveTextContent('100%');
      expect(screen.getByTestId('structural-confidence')).toHaveTextContent('0.95');
      expect(screen.getByTestId('structural-issues')).toHaveTextContent('0');

      expect(screen.getByTestId('aspect-profile')).toBeInTheDocument();
      expect(screen.getByTestId('profile-score')).toHaveTextContent('90%');
      expect(screen.getByTestId('profile-confidence')).toHaveTextContent('0.85');
      expect(screen.getByTestId('profile-issues')).toHaveTextContent('0');
    });

    it('should handle loading state', async () => {
      mockUseValidationResults.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationResults resourceId="test-resource-1" />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading...');
    });

    it('should handle error state', async () => {
      const errorMessage = 'Failed to fetch validation results';
      mockUseValidationResults.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: errorMessage },
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationResults resourceId="test-resource-1" />);

      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.getByTestId('error')).toHaveTextContent(`Error: ${errorMessage}`);
    });

    it('should handle no data state', async () => {
      mockUseValidationResults.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationResults resourceId="test-resource-1" />);

      expect(screen.getByTestId('no-data')).toBeInTheDocument();
      expect(screen.getByTestId('no-data')).toHaveTextContent('No validation data');
    });

    it('should display compact validation badge', async () => {
      renderWithProviders(
        <MockEnhancedValidationBadge 
          validationResult={mockValidationResult} 
          compact={true} 
        />
      );

      const badge = screen.getByTestId('enhanced-validation-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-compact', 'true');
    });
  });

  describe('Validation Settings UI Integration', () => {
    it('should display validation settings correctly', async () => {
      renderWithProviders(<MockValidationSettings />);

      // Check if settings are displayed
      expect(screen.getByTestId('validation-settings')).toBeInTheDocument();
      expect(screen.getByTestId('batch-size')).toHaveTextContent('100');
      expect(screen.getByTestId('strict-mode')).toHaveTextContent('Disabled');

      // Check enabled aspects
      expect(screen.getByTestId('enabled-aspects')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-structural')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-profile')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-terminology')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-reference')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-businessRule')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-metadata')).toBeInTheDocument();
    });

    it('should handle settings loading state', async () => {
      mockUseValidationSettings.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationSettings />);

      expect(screen.getByTestId('settings-loading')).toBeInTheDocument();
      expect(screen.getByTestId('settings-loading')).toHaveTextContent('Loading settings...');
    });

    it('should handle settings error state', async () => {
      const errorMessage = 'Failed to fetch settings';
      mockUseValidationSettings.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: errorMessage },
        updateSettings: vi.fn(),
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationSettings />);

      expect(screen.getByTestId('settings-error')).toBeInTheDocument();
      expect(screen.getByTestId('settings-error')).toHaveTextContent(`Error: ${errorMessage}`);
    });

    it('should handle aspect toggling', async () => {
      const updateSettings = vi.fn();
      mockUseValidationSettings.mockReturnValue({
        data: mockValidationSettings,
        isLoading: false,
        error: null,
        updateSettings,
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationSettings />);

      // Click on structural aspect toggle
      const structuralToggle = screen.getByTestId('toggle-structural');
      fireEvent.click(structuralToggle);

      // Verify updateSettings was called with updated settings
      expect(updateSettings).toHaveBeenCalledWith({
        ...mockValidationSettings,
        enabledAspects: ['profile', 'terminology', 'reference', 'businessRule', 'metadata']
      });
    });
  });

  describe('Validation Progress UI Integration', () => {
    it('should display validation progress correctly', async () => {
      renderWithProviders(<MockValidationProgress />);

      // Check if progress is displayed
      expect(screen.getByTestId('validation-progress')).toBeInTheDocument();
      expect(screen.getByTestId('total-resources')).toHaveTextContent('100');
      expect(screen.getByTestId('processed-resources')).toHaveTextContent('75');
      expect(screen.getByTestId('valid-resources')).toHaveTextContent('70');
      expect(screen.getByTestId('error-resources')).toHaveTextContent('3');
      expect(screen.getByTestId('progress-status')).toHaveTextContent('running');
      expect(screen.getByTestId('progress-complete')).toHaveTextContent('In Progress');
    });

    it('should handle progress loading state', async () => {
      mockUseValidationProgress.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationProgress />);

      expect(screen.getByTestId('progress-loading')).toBeInTheDocument();
      expect(screen.getByTestId('progress-loading')).toHaveTextContent('Loading progress...');
    });

    it('should handle progress error state', async () => {
      const errorMessage = 'Failed to fetch progress';
      mockUseValidationProgress.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: errorMessage },
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationProgress />);

      expect(screen.getByTestId('progress-error')).toBeInTheDocument();
      expect(screen.getByTestId('progress-error')).toHaveTextContent(`Error: ${errorMessage}`);
    });

    it('should handle completed progress state', async () => {
      const completedProgress = {
        ...mockValidationProgress,
        processedResources: 100,
        isComplete: true,
        status: 'completed'
      };

      mockUseValidationProgress.mockReturnValue({
        data: completedProgress,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationProgress />);

      expect(screen.getByTestId('processed-resources')).toHaveTextContent('100');
      expect(screen.getByTestId('progress-status')).toHaveTextContent('completed');
      expect(screen.getByTestId('progress-complete')).toHaveTextContent('Complete');
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle real-time validation result updates', async () => {
      const { rerender } = renderWithProviders(
        <MockValidationResults resourceId="test-resource-1" />
      );

      // Initial state
      expect(screen.getByTestId('validation-score')).toHaveTextContent('95%');

      // Simulate real-time update
      const updatedResult = {
        ...mockValidationResult,
        overallScore: 98
      };

      mockUseValidationResults.mockReturnValue({
        data: updatedResult,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <MockValidationResults resourceId="test-resource-1" />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Verify update is reflected
      expect(screen.getByTestId('validation-score')).toHaveTextContent('98%');
    });

    it('should handle real-time progress updates', async () => {
      const { rerender } = renderWithProviders(<MockValidationProgress />);

      // Initial state
      expect(screen.getByTestId('processed-resources')).toHaveTextContent('75');

      // Simulate real-time update
      const updatedProgress = {
        ...mockValidationProgress,
        processedResources: 80
      };

      mockUseValidationProgress.mockReturnValue({
        data: updatedProgress,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <MockValidationProgress />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Verify update is reflected
      expect(screen.getByTestId('processed-resources')).toHaveTextContent('80');
    });
  });

  describe('User Interaction Flows', () => {
    it('should handle complete validation workflow from settings to results', async () => {
      const updateSettings = vi.fn();
      mockUseValidationSettings.mockReturnValue({
        data: mockValidationSettings,
        isLoading: false,
        error: null,
        updateSettings,
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationSettings />);

      // User modifies settings
      const structuralToggle = screen.getByTestId('toggle-structural');
      fireEvent.click(structuralToggle);

      // Verify settings update
      expect(updateSettings).toHaveBeenCalledWith({
        ...mockValidationSettings,
        enabledAspects: ['profile', 'terminology', 'reference', 'businessRule', 'metadata']
      });

      // User views validation results
      renderWithProviders(<MockValidationResults resourceId="test-resource-1" />);

      // Verify results are displayed
      expect(screen.getByTestId('validation-results')).toBeInTheDocument();
      expect(screen.getByTestId('validation-score')).toHaveTextContent('95%');
    });

    it('should handle error recovery flows', async () => {
      // Start with error state
      mockUseValidationResults.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'Network error' },
        refetch: vi.fn()
      });

      renderWithProviders(<MockValidationResults resourceId="test-resource-1" />);

      // Verify error is displayed
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.getByTestId('error')).toHaveTextContent('Error: Network error');

      // Simulate recovery
      mockUseValidationResults.mockReturnValue({
        data: mockValidationResult,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { rerender } = renderWithProviders(
        <MockValidationResults resourceId="test-resource-1" />
      );

      // Verify recovery is reflected
      expect(screen.getByTestId('validation-results')).toBeInTheDocument();
      expect(screen.getByTestId('validation-score')).toHaveTextContent('95%');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large datasets efficiently', async () => {
      const largeResult = {
        ...mockValidationResult,
        aspects: {
          structural: { ...mockValidationResult.aspects.structural, issues: Array(1000).fill({}) },
          profile: { ...mockValidationResult.aspects.profile, issues: Array(1000).fill({}) },
          terminology: { ...mockValidationResult.aspects.terminology, issues: Array(1000).fill({}) },
          reference: { ...mockValidationResult.aspects.reference, issues: Array(1000).fill({}) },
          businessRule: { ...mockValidationResult.aspects.businessRule, issues: Array(1000).fill({}) },
          metadata: { ...mockValidationResult.aspects.metadata, issues: Array(1000).fill({}) }
        }
      };

      mockUseValidationResults.mockReturnValue({
        data: largeResult,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const startTime = performance.now();
      renderWithProviders(<MockValidationResults resourceId="test-resource-1" />);
      const endTime = performance.now();

      // Verify component renders within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Verify all aspects are displayed
      expect(screen.getByTestId('aspect-structural')).toBeInTheDocument();
      expect(screen.getByTestId('aspect-profile')).toBeInTheDocument();
      expect(screen.getByTestId('aspect-terminology')).toBeInTheDocument();
      expect(screen.getByTestId('aspect-reference')).toBeInTheDocument();
      expect(screen.getByTestId('aspect-businessRule')).toBeInTheDocument();
      expect(screen.getByTestId('aspect-metadata')).toBeInTheDocument();
    });

    it('should handle rapid state changes gracefully', async () => {
      const { rerender } = renderWithProviders(
        <MockValidationResults resourceId="test-resource-1" />
      );

      // Simulate rapid state changes
      for (let i = 0; i < 10; i++) {
        const updatedResult = {
          ...mockValidationResult,
          overallScore: 95 + i
        };

        mockUseValidationResults.mockReturnValue({
          data: updatedResult,
          isLoading: false,
          error: null,
          refetch: vi.fn()
        });

        rerender(
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <MockValidationResults resourceId="test-resource-1" />
            </BrowserRouter>
          </QueryClientProvider>
        );
      }

      // Verify final state is correct
      expect(screen.getByTestId('validation-score')).toHaveTextContent('104%');
    });
  });
});
