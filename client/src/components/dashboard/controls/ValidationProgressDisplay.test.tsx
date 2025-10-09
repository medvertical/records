import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ValidationProgressDisplay } from './ValidationProgressDisplay';

// Mock the ProgressBar component
vi.mock('./ProgressBar', () => ({
  ValidationProgressBar: ({ processed, total, animated, showDetails }: { 
    processed: number; 
    total: number; 
    animated: boolean; 
    showDetails: boolean; 
  }) => (
    <div data-testid="validation-progress-bar">
      Progress: {processed}/{total} (Animated: {animated.toString()}, Details: {showDetails.toString()})
    </div>
  ),
}));

// Mock the ValidationStatusBadge component
vi.mock('./ValidationStatusBadge', () => ({
  ValidationStatusBadge: ({ status, size, animated, showIcon, showText }: { 
    status: string; 
    size: string; 
    animated: boolean; 
    showIcon: boolean; 
    showText: boolean; 
  }) => (
    <div data-testid="validation-status-badge">
      Status: {status} (Size: {size}, Animated: {animated.toString()}, Icon: {showIcon.toString()}, Text: {showText.toString()})
    </div>
  ),
}));

describe('ValidationProgressDisplay', () => {
  const mockProgress = {
    totalResources: 100,
    processedResources: 50,
    validResources: 45,
    errorResources: 5,
    currentResourceType: 'Patient',
    processingRate: '10',
    estimatedTimeRemaining: '5s',
    startTime: new Date('2024-01-01T10:00:00Z'),
    status: 'running' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the validation progress display with correct title', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText('Validation Progress')).toBeInTheDocument();
    });

    it('renders validation status badge', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByTestId('validation-status-badge')).toBeInTheDocument();
    });

    it('renders validation progress bar', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByTestId('validation-progress-bar')).toBeInTheDocument();
    });

    it('shows "No validation in progress" when progress is null', () => {
      render(<ValidationProgressDisplay progress={null} />);
      
      expect(screen.getByText('No validation in progress')).toBeInTheDocument();
    });
  });

  describe('Progress Calculations', () => {
    it('calculates progress percentage correctly', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      // Progress should be 50% (50/100)
      expect(screen.getByText('Progress: 50/100')).toBeInTheDocument();
    });

    it('handles zero total resources', () => {
      const zeroProgress = {
        ...mockProgress,
        totalResources: 0,
        processedResources: 0,
      };

      render(<ValidationProgressDisplay progress={zeroProgress} />);
      
      expect(screen.getByText('Progress: 0/0')).toBeInTheDocument();
    });

    it('calculates success rate correctly', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={true} />);
      
      // Success rate should be 90% (45/50)
      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('calculates error rate correctly', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={true} />);
      
      // Error rate should be 10% (5/50)
      expect(screen.getByText('10%')).toBeInTheDocument();
    });
  });

  describe('Status Mapping', () => {
    it('maps running status correctly', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText(/Status: running/)).toBeInTheDocument();
    });

    it('maps paused status correctly', () => {
      const pausedProgress = { ...mockProgress, status: 'paused' as const };
      render(<ValidationProgressDisplay progress={pausedProgress} />);
      
      expect(screen.getByText(/Status: paused/)).toBeInTheDocument();
    });

    it('maps completed status correctly', () => {
      const completedProgress = { ...mockProgress, status: 'completed' as const };
      render(<ValidationProgressDisplay progress={completedProgress} />);
      
      expect(screen.getByText(/Status: completed/)).toBeInTheDocument();
    });

    it('maps error status correctly', () => {
      const errorProgress = { ...mockProgress, status: 'error' as const };
      render(<ValidationProgressDisplay progress={errorProgress} />);
      
      expect(screen.getByText(/Status: error/)).toBeInTheDocument();
    });

    it('maps stopped status correctly', () => {
      const stoppedProgress = { ...mockProgress, status: 'stopped' as const };
      render(<ValidationProgressDisplay progress={stoppedProgress} />);
      
      expect(screen.getByText(/Status: stopped/)).toBeInTheDocument();
    });

    it('maps idle status correctly', () => {
      const idleProgress = { ...mockProgress, status: 'idle' as const };
      render(<ValidationProgressDisplay progress={idleProgress} />);
      
      expect(screen.getByText(/Status: idle/)).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('renders in compact mode when compact prop is true', () => {
      render(<ValidationProgressDisplay progress={mockProgress} compact={true} />);
      
      expect(screen.getByText('Validation Progress')).toBeInTheDocument();
      expect(screen.getByText(/Status: running/)).toBeInTheDocument();
    });

    it('shows progress percentage in compact mode', () => {
      render(<ValidationProgressDisplay progress={mockProgress} compact={true} />);
      
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows processed/total resources in compact mode', () => {
      render(<ValidationProgressDisplay progress={mockProgress} compact={true} />);
      
      expect(screen.getByText('50 / 100')).toBeInTheDocument();
    });
  });

  describe('Detailed Metrics', () => {
    it('shows detailed metrics when showDetails is true', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={true} />);
      
      expect(screen.getByText('Valid Resources')).toBeInTheDocument();
      expect(screen.getByText('Error Resources')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('Error Rate')).toBeInTheDocument();
    });

    it('hides detailed metrics when showDetails is false', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={false} />);
      
      expect(screen.queryByText('Valid Resources')).not.toBeInTheDocument();
      expect(screen.queryByText('Error Resources')).not.toBeInTheDocument();
      expect(screen.queryByText('Success Rate')).not.toBeInTheDocument();
      expect(screen.queryByText('Error Rate')).not.toBeInTheDocument();
    });

    it('shows valid resources count', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={true} />);
      
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('shows error resources count', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={true} />);
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Current Activity', () => {
    it('shows current resource type when available', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText('Currently processing:')).toBeInTheDocument();
      expect(screen.getByText('Patient')).toBeInTheDocument();
    });

    it('does not show current activity when resource type is not available', () => {
      const progressWithoutResourceType = {
        ...mockProgress,
        currentResourceType: undefined,
      };

      render(<ValidationProgressDisplay progress={progressWithoutResourceType} />);
      
      expect(screen.queryByText('Currently processing:')).not.toBeInTheDocument();
    });
  });

  describe('Performance Metrics', () => {
    it('shows processing rate when available', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText('Processing Rate')).toBeInTheDocument();
      expect(screen.getByText('10 resources/sec')).toBeInTheDocument();
    });

    it('shows estimated time remaining when available', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText('Estimated Time Remaining')).toBeInTheDocument();
      expect(screen.getByText('5s')).toBeInTheDocument();
    });

    it('shows start time when available', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText('Started')).toBeInTheDocument();
      expect(screen.getByText('10:00:00 AM')).toBeInTheDocument();
    });

    it('does not show processing rate when not available', () => {
      const progressWithoutRate = {
        ...mockProgress,
        processingRate: undefined,
      };

      render(<ValidationProgressDisplay progress={progressWithoutRate} />);
      
      expect(screen.queryByText('Processing Rate')).not.toBeInTheDocument();
    });

    it('does not show estimated time when not available', () => {
      const progressWithoutETA = {
        ...mockProgress,
        estimatedTimeRemaining: undefined,
      };

      render(<ValidationProgressDisplay progress={progressWithoutETA} />);
      
      expect(screen.queryByText('Estimated Time Remaining')).not.toBeInTheDocument();
    });

    it('does not show start time when not available', () => {
      const progressWithoutStartTime = {
        ...mockProgress,
        startTime: undefined,
      };

      render(<ValidationProgressDisplay progress={progressWithoutStartTime} />);
      
      expect(screen.queryByText('Started')).not.toBeInTheDocument();
    });
  });

  describe('Progress Breakdown', () => {
    it('shows progress breakdown when showDetails is true and there are processed resources', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={true} />);
      
      expect(screen.getByText('Progress Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });

    it('hides progress breakdown when showDetails is false', () => {
      render(<ValidationProgressDisplay progress={mockProgress} showDetails={false} />);
      
      expect(screen.queryByText('Progress Breakdown')).not.toBeInTheDocument();
    });

    it('hides progress breakdown when there are no processed resources', () => {
      const progressWithoutProcessed = {
        ...mockProgress,
        processedResources: 0,
      };

      render(<ValidationProgressDisplay progress={progressWithoutProcessed} showDetails={true} />);
      
      expect(screen.queryByText('Progress Breakdown')).not.toBeInTheDocument();
    });
  });

  describe('Progress Bar Configuration', () => {
    it('passes correct props to ValidationProgressBar', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText(/Progress: 50\/100/)).toBeInTheDocument();
      expect(screen.getByText(/Animated: true/)).toBeInTheDocument();
      expect(screen.getByText(/Details: true/)).toBeInTheDocument();
    });

    it('passes animated=false when status is not running', () => {
      const pausedProgress = { ...mockProgress, status: 'paused' as const };
      render(<ValidationProgressDisplay progress={pausedProgress} />);
      
      expect(screen.getByText(/Animated: false/)).toBeInTheDocument();
    });
  });

  describe('Status Badge Configuration', () => {
    it('passes correct props to ValidationStatusBadge', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText(/Status: running/)).toBeInTheDocument();
      expect(screen.getByText(/Size: md/)).toBeInTheDocument();
      expect(screen.getByText(/Animated: true/)).toBeInTheDocument();
      expect(screen.getByText(/Icon: true/)).toBeInTheDocument();
      expect(screen.getByText(/Text: true/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles progress with zero processed resources', () => {
      const zeroProcessedProgress = {
        ...mockProgress,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
      };

      render(<ValidationProgressDisplay progress={zeroProcessedProgress} showDetails={true} />);
      
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument(); // Both success and error rates should be 0%
    });

    it('handles progress with all resources processed', () => {
      const completedProgress = {
        ...mockProgress,
        processedResources: 100,
        totalResources: 100,
        validResources: 95,
        errorResources: 5,
        status: 'completed' as const,
      };

      render(<ValidationProgressDisplay progress={completedProgress} showDetails={true} />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument(); // Success rate
      expect(screen.getByText('5%')).toBeInTheDocument(); // Error rate
    });

    it('handles progress with more processed than total resources', () => {
      const invalidProgress = {
        ...mockProgress,
        processedResources: 150,
        totalResources: 100,
      };

      render(<ValidationProgressDisplay progress={invalidProgress} />);
      
      // Should still render without crashing
      expect(screen.getByText('Validation Progress')).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('handles missing className prop', () => {
      expect(() => {
        render(<ValidationProgressDisplay progress={mockProgress} className={undefined} />);
      }).not.toThrow();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ValidationProgressDisplay progress={mockProgress} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('uses default showDetails value when not provided', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      // Should show details by default
      expect(screen.getByText('Valid Resources')).toBeInTheDocument();
    });

    it('uses default compact value when not provided', () => {
      render(<ValidationProgressDisplay progress={mockProgress} />);
      
      // Should not be in compact mode by default
      expect(screen.getByText('Validation Progress')).toBeInTheDocument();
    });
  });

  describe('Number Formatting', () => {
    it('formats large numbers with commas', () => {
      const largeProgress = {
        ...mockProgress,
        totalResources: 1000000,
        processedResources: 500000,
        validResources: 450000,
        errorResources: 50000,
      };

      render(<ValidationProgressDisplay progress={largeProgress} showDetails={true} />);
      
      expect(screen.getByText('450,000')).toBeInTheDocument();
      expect(screen.getByText('50,000')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('formats start time correctly', () => {
      const specificTime = new Date('2024-01-01T14:30:45Z');
      const progressWithTime = {
        ...mockProgress,
        startTime: specificTime,
      };

      render(<ValidationProgressDisplay progress={progressWithTime} />);
      
      // Should show formatted time
      expect(screen.getByText(/2:30:45 PM/)).toBeInTheDocument();
    });
  });
});