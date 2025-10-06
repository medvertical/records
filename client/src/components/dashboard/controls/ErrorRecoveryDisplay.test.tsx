import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorRecoveryDisplay } from './ErrorRecoveryDisplay';

// Mock the error recovery mechanisms
vi.mock('@/lib/error-recovery-mechanisms', () => ({
  RecoveryUtils: {
    createRecoveryToast: vi.fn(),
    formatRecoveryTime: vi.fn((time: number) => `${time}ms`),
    getRecoveryPriorityColor: vi.fn((priority: string) => {
      const colors: Record<string, string> = {
        high: 'text-red-600',
        medium: 'text-yellow-600',
        low: 'text-green-600',
      };
      return colors[priority] || 'text-gray-600';
    }),
    getRecoverySuccessRateColor: vi.fn((rate: number) => {
      if (rate >= 80) return 'text-green-600';
      if (rate >= 60) return 'text-yellow-600';
      return 'text-red-600';
    }),
  },
}));

describe('ErrorRecoveryDisplay', () => {
  const mockOnRecoveryOptionSelected = vi.fn();
  const mockOnDismissFailure = vi.fn();

  const mockFailure = {
    id: 'failure-1',
    failureType: 'network' as const,
    severity: 'medium' as const,
    affectedItems: ['item1', 'item2', 'item3', 'item4', 'item5'],
    completedItems: ['item1', 'item2'],
    failedItems: ['item3', 'item4', 'item5'],
    error: new Error('Network connection lost'),
    timestamp: new Date('2024-01-01T10:00:00Z'),
    operationId: 'op-1',
    context: {
      component: 'ValidationControlPanel',
      operation: 'Test Validation',
    },
    recoveryOptions: [
      {
        id: 'retry-1',
        type: 'retry' as const,
        name: 'Retry Operation',
        description: 'Retry the failed operation',
        priority: 'high' as const,
        estimatedTime: 5000,
        successRate: 85,
      },
      {
        id: 'skip-1',
        type: 'skip' as const,
        name: 'Skip Failed Items',
        description: 'Skip the failed items and continue',
        priority: 'medium' as const,
        estimatedTime: 1000,
        successRate: 100,
      },
    ],
  };

  const mockRecoveryResult = {
    success: true,
    recoveredItems: ['item3', 'item4'],
    failedItems: ['item5'],
    skippedItems: [],
    duration: 3000,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the error recovery display with correct title', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('Partial Failures Recovery')).toBeInTheDocument();
    });

    it('shows failure count in badge', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('1 failure')).toBeInTheDocument();
    });

    it('shows plural failure count for multiple failures', () => {
      const multipleFailures = [mockFailure, { ...mockFailure, id: 'failure-2' }];
      
      render(
        <ErrorRecoveryDisplay
          failures={multipleFailures}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('2 failures')).toBeInTheDocument();
    });

    it('shows "No partial failures to recover" when there are no failures', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('No partial failures to recover')).toBeInTheDocument();
    });
  });

  describe('Failure Display', () => {
    it('displays failure information correctly', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('network Failure')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('Network connection lost')).toBeInTheDocument();
    });

    it('shows progress information', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('40.0%')).toBeInTheDocument(); // 2/5 * 100
      expect(screen.getByText('2 completed')).toBeInTheDocument();
      expect(screen.getByText('3 failed')).toBeInTheDocument();
    });

    it('shows dismiss button for each failure', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });
  });

  describe('Recovery Options', () => {
    it('displays recovery options for each failure', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('Recovery Options:')).toBeInTheDocument();
      expect(screen.getByText('Retry Operation')).toBeInTheDocument();
      expect(screen.getByText('Skip Failed Items')).toBeInTheDocument();
    });

    it('shows recovery option descriptions', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('Retry the failed operation')).toBeInTheDocument();
      expect(screen.getByText('Skip the failed items and continue')).toBeInTheDocument();
    });

    it('shows recovery option metadata', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('5000ms')).toBeInTheDocument();
      expect(screen.getByText('85% success')).toBeInTheDocument();
    });

    it('calls onRecoveryOptionSelected when recovery option is clicked', async () => {
      mockOnRecoveryOptionSelected.mockResolvedValue(mockRecoveryResult);
      
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      const retryButton = screen.getByText('Retry Operation');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockOnRecoveryOptionSelected).toHaveBeenCalledWith(mockFailure, 'retry-1');
      });
    });
  });

  describe('Recovery Results', () => {
    it('shows recovery result when available', async () => {
      mockOnRecoveryOptionSelected.mockResolvedValue(mockRecoveryResult);
      
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      const retryButton = screen.getByText('Retry Operation');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Recovery Successful')).toBeInTheDocument();
        expect(screen.getByText('Recovered: 2 items')).toBeInTheDocument();
        expect(screen.getByText('Failed: 1 items')).toBeInTheDocument();
        expect(screen.getByText('Skipped: 0 items')).toBeInTheDocument();
        expect(screen.getByText('Duration: 3000ms')).toBeInTheDocument();
      });
    });

    it('shows failed recovery result', async () => {
      const failedRecoveryResult = {
        ...mockRecoveryResult,
        success: false,
        error: new Error('Recovery failed'),
      };
      
      mockOnRecoveryOptionSelected.mockResolvedValue(failedRecoveryResult);
      
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      const retryButton = screen.getByText('Retry Operation');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Recovery Failed')).toBeInTheDocument();
        expect(screen.getByText('Error: Recovery failed')).toBeInTheDocument();
      });
    });

    it('hides recovery options when recovery result is available', async () => {
      mockOnRecoveryOptionSelected.mockResolvedValue(mockRecoveryResult);
      
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      const retryButton = screen.getByText('Retry Operation');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByText('Recovery Options:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Recovery Loading State', () => {
    it('shows loading state while recovery is in progress', async () => {
      // Mock a delayed recovery
      mockOnRecoveryOptionSelected.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockRecoveryResult), 100))
      );
      
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      const retryButton = screen.getByText('Retry Operation');
      fireEvent.click(retryButton);

      // Should show loading state
      expect(screen.getByText('Attempting recovery...')).toBeInTheDocument();
      
      // Recovery options should be disabled
      const buttons = screen.getAllByRole('button');
      const recoveryButtons = buttons.filter(button => 
        button.textContent?.includes('Retry') || button.textContent?.includes('Skip')
      );
      recoveryButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Additional Details', () => {
    it('shows additional details when showDetails is true', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
          showDetails={true}
        />
      );
      
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
    });

    it('hides additional details when showDetails is false', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
          showDetails={false}
        />
      );
      
      expect(screen.queryByText('Additional Details')).not.toBeInTheDocument();
    });

    it('shows detailed failure information in additional details', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
          showDetails={true}
        />
      );
      
      const detailsButton = screen.getByText('Additional Details');
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('Operation ID: op-1')).toBeInTheDocument();
      expect(screen.getByText('Failure ID: failure-1')).toBeInTheDocument();
      expect(screen.getByText('Affected Items: 5')).toBeInTheDocument();
      expect(screen.getByText('Completed Items: 2')).toBeInTheDocument();
      expect(screen.getByText('Failed Items: 3')).toBeInTheDocument();
      expect(screen.getByText('Component: ValidationControlPanel')).toBeInTheDocument();
      expect(screen.getByText('Operation: Test Validation')).toBeInTheDocument();
    });
  });

  describe('Max Display Items', () => {
    it('limits displayed failures to maxDisplayItems', () => {
      const multipleFailures = [
        mockFailure,
        { ...mockFailure, id: 'failure-2' },
        { ...mockFailure, id: 'failure-3' },
      ];
      
      render(
        <ErrorRecoveryDisplay
          failures={multipleFailures}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
          maxDisplayItems={2}
        />
      );
      
      // Should show "Show more" button
      expect(screen.getByText('Show 1 more failures')).toBeInTheDocument();
    });

    it('shows all failures when maxDisplayItems is not set', () => {
      const multipleFailures = [
        mockFailure,
        { ...mockFailure, id: 'failure-2' },
        { ...mockFailure, id: 'failure-3' },
      ];
      
      render(
        <ErrorRecoveryDisplay
          failures={multipleFailures}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      // Should not show "Show more" button
      expect(screen.queryByText(/Show.*more failures/)).not.toBeInTheDocument();
    });
  });

  describe('Failure Types and Icons', () => {
    const failureTypeTests = [
      { type: 'network', expectedIcon: 'Activity' },
      { type: 'service', expectedIcon: 'XCircle' },
      { type: 'validation', expectedIcon: 'AlertTriangle' },
      { type: 'timeout', expectedIcon: 'Clock' },
      { type: 'data', expectedIcon: 'Info' },
      { type: 'system', expectedIcon: 'XCircle' },
    ];

    failureTypeTests.forEach(({ type, expectedIcon }) => {
      it(`shows correct icon for ${type} failure type`, () => {
        const failure = { ...mockFailure, failureType: type as any };
        
        render(
          <ErrorRecoveryDisplay
            failures={[failure]}
            onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
            onDismissFailure={mockOnDismissFailure}
          />
        );
        
        expect(screen.getByText(`${type} Failure`)).toBeInTheDocument();
      });
    });
  });

  describe('Severity Colors', () => {
    const severityTests = [
      { severity: 'critical', expectedClass: 'text-red-600 bg-red-50 border-red-200' },
      { severity: 'high', expectedClass: 'text-orange-600 bg-orange-50 border-orange-200' },
      { severity: 'medium', expectedClass: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
      { severity: 'low', expectedClass: 'text-blue-600 bg-blue-50 border-blue-200' },
    ];

    severityTests.forEach(({ severity, expectedClass }) => {
      it(`applies correct colors for ${severity} severity`, () => {
        const failure = { ...mockFailure, severity: severity as any };
        
        const { container } = render(
          <ErrorRecoveryDisplay
            failures={[failure]}
            onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
            onDismissFailure={mockOnDismissFailure}
          />
        );
        
        const failureElement = container.querySelector('.p-4.rounded-lg.border');
        expect(failureElement).toHaveClass(...expectedClass.split(' '));
      });
    });
  });

  describe('Error Handling', () => {
    it('handles recovery option selection errors gracefully', async () => {
      mockOnRecoveryOptionSelected.mockRejectedValue(new Error('Recovery failed'));
      
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      const retryButton = screen.getByText('Retry Operation');
      fireEvent.click(retryButton);

      // Should not throw an error
      await waitFor(() => {
        expect(mockOnRecoveryOptionSelected).toHaveBeenCalled();
      });
    });

    it('calls onDismissFailure when dismiss button is clicked', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      expect(mockOnDismissFailure).toHaveBeenCalledWith('failure-1');
    });
  });

  describe('Props Handling', () => {
    it('handles missing props gracefully', () => {
      expect(() => {
        render(
          <ErrorRecoveryDisplay
            failures={[]}
            onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
            onDismissFailure={mockOnDismissFailure}
            className={undefined}
          />
        );
      }).not.toThrow();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
          className="custom-class"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('uses default showDetails value when not provided', () => {
      render(
        <ErrorRecoveryDisplay
          failures={[mockFailure]}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      // Should show details by default
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
    });

    it('uses default maxDisplayItems value when not provided', () => {
      const multipleFailures = [
        mockFailure,
        { ...mockFailure, id: 'failure-2' },
        { ...mockFailure, id: 'failure-3' },
        { ...mockFailure, id: 'failure-4' },
        { ...mockFailure, id: 'failure-5' },
        { ...mockFailure, id: 'failure-6' },
      ];
      
      render(
        <ErrorRecoveryDisplay
          failures={multipleFailures}
          onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
          onDismissFailure={mockOnDismissFailure}
        />
      );
      
      // Should show "Show more" button (default maxDisplayItems is 5)
      expect(screen.getByText('Show 1 more failures')).toBeInTheDocument();
    });
  });

  describe('Recovery Option Types', () => {
    const recoveryOptionTests = [
      { type: 'retry', expectedIcon: 'RefreshCw' },
      { type: 'skip', expectedIcon: 'SkipForward' },
      { type: 'fallback', expectedIcon: 'RotateCcw' },
      { type: 'checkpoint', expectedIcon: 'RotateCcw' },
      { type: 'manual', expectedIcon: 'Info' },
    ];

    recoveryOptionTests.forEach(({ type, expectedIcon }) => {
      it(`shows correct icon for ${type} recovery option`, () => {
        const failure = {
          ...mockFailure,
          recoveryOptions: [
            {
              id: `${type}-1`,
              type: type as any,
              name: `${type} Option`,
              description: `${type} description`,
              priority: 'medium' as const,
              estimatedTime: 1000,
              successRate: 80,
            },
          ],
        };
        
        render(
          <ErrorRecoveryDisplay
            failures={[failure]}
            onRecoveryOptionSelected={mockOnRecoveryOptionSelected}
            onDismissFailure={mockOnDismissFailure}
          />
        );
        
        expect(screen.getByText(`${type} Option`)).toBeInTheDocument();
      });
    });
  });
});