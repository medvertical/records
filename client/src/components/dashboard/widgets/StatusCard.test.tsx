import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusCard } from './StatusCard';
import { ValidationStatus } from '@/shared/types/dashboard-new';

// Mock the Widget component
jest.mock('../shared/Widget', () => ({
  Widget: ({ children, title, subtitle, loading, error, onRefresh }: any) => (
    <div data-testid="widget" data-title={title} data-subtitle={subtitle} data-loading={loading} data-error={error}>
      <button onClick={onRefresh} data-testid="refresh-button">Refresh</button>
      {children}
    </div>
  ),
  WidgetHeader: ({ children }: any) => <div data-testid="widget-header">{children}</div>,
  WidgetContent: ({ children }: any) => <div data-testid="widget-content">{children}</div>,
}));

// Mock the Badge component
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

// Mock the Progress component
jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));

describe('StatusCard', () => {
  const mockStatus: ValidationStatus = {
    status: 'running',
    progress: 67.5,
    currentResourceType: 'Patient',
    nextResourceType: 'Observation',
    processingRate: 1247,
    estimatedTimeRemaining: 1380, // 23 minutes in seconds
  };

  const defaultProps = {
    status: mockStatus,
    loading: false,
    error: null,
    onRefresh: jest.fn(),
    lastUpdated: new Date('2023-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with correct title and subtitle', () => {
      render(<StatusCard {...defaultProps} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-title', 'Validation Status');
      expect(screen.getByTestId('widget')).toHaveAttribute('data-subtitle', 'Real-time validation engine status');
    });

    it('renders loading state', () => {
      render(<StatusCard {...defaultProps} loading={true} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-loading', 'true');
    });

    it('renders error state', () => {
      render(<StatusCard {...defaultProps} error="Test error" />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-error', 'Test error');
    });
  });

  describe('Status Display', () => {
    it('displays running status correctly', () => {
      render(<StatusCard {...defaultProps} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('67.5%')).toBeInTheDocument();
    });

    it('displays paused status correctly', () => {
      const pausedStatus: ValidationStatus = {
        ...mockStatus,
        status: 'paused',
        progress: 45.0,
      };

      render(<StatusCard {...defaultProps} status={pausedStatus} />);
      
      expect(screen.getByText('Paused')).toBeInTheDocument();
      expect(screen.getByText('45.0%')).toBeInTheDocument();
    });

    it('displays completed status correctly', () => {
      const completedStatus: ValidationStatus = {
        ...mockStatus,
        status: 'completed',
        progress: 100.0,
      };

      render(<StatusCard {...defaultProps} status={completedStatus} />);
      
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('displays error status correctly', () => {
      const errorStatus: ValidationStatus = {
        ...mockStatus,
        status: 'error',
        progress: 30.0,
      };

      render(<StatusCard {...defaultProps} status={errorStatus} />);
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('30.0%')).toBeInTheDocument();
    });

    it('displays idle status correctly', () => {
      const idleStatus: ValidationStatus = {
        ...mockStatus,
        status: 'idle',
        progress: 0.0,
      };

      render(<StatusCard {...defaultProps} status={idleStatus} />);
      
      expect(screen.getByText('Idle')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('displays progress bar with correct value', () => {
      render(<StatusCard {...defaultProps} />);
      
      const progressBar = screen.getByTestId('progress');
      expect(progressBar).toHaveAttribute('data-value', '67.5');
    });

    it('displays progress percentage', () => {
      render(<StatusCard {...defaultProps} />);
      
      expect(screen.getByText('67.5%')).toBeInTheDocument();
    });
  });

  describe('Current Activity Display', () => {
    it('displays current resource type when running', () => {
      render(<StatusCard {...defaultProps} />);
      
      expect(screen.getByText('Patient')).toBeInTheDocument();
      expect(screen.getByText('Currently Processing:')).toBeInTheDocument();
    });

    it('displays next resource type when available', () => {
      render(<StatusCard {...defaultProps} />);
      
      expect(screen.getByText('Observation')).toBeInTheDocument();
      expect(screen.getByText('Next:')).toBeInTheDocument();
    });

    it('displays processing rate', () => {
      render(<StatusCard {...defaultProps} />);
      
      expect(screen.getByText('1,247/min')).toBeInTheDocument();
      expect(screen.getByText('Rate:')).toBeInTheDocument();
    });

    it('does not display activity when idle', () => {
      const idleStatus: ValidationStatus = {
        ...mockStatus,
        status: 'idle',
      };

      render(<StatusCard {...defaultProps} status={idleStatus} />);
      
      expect(screen.queryByText('Currently Processing:')).not.toBeInTheDocument();
    });
  });

  describe('Time Information', () => {
    it('displays estimated time remaining when available', () => {
      render(<StatusCard {...defaultProps} />);
      
      expect(screen.getByText(/23 min/)).toBeInTheDocument();
      expect(screen.getByText('Remaining:')).toBeInTheDocument();
    });

    it('does not display time remaining when not available', () => {
      const statusWithoutTime: ValidationStatus = {
        ...mockStatus,
        estimatedTimeRemaining: undefined,
      };

      render(<StatusCard {...defaultProps} status={statusWithoutTime} />);
      
      expect(screen.queryByText('Remaining:')).not.toBeInTheDocument();
    });
  });

  describe('Status Badge Variants', () => {
    it('displays running status with correct variant', () => {
      render(<StatusCard {...defaultProps} />);
      
      const runningBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'default'
      );
      expect(runningBadge).toBeInTheDocument();
      expect(runningBadge).toHaveTextContent('Running');
    });

    it('displays paused status with correct variant', () => {
      const pausedStatus: ValidationStatus = {
        ...mockStatus,
        status: 'paused',
      };

      render(<StatusCard {...defaultProps} status={pausedStatus} />);
      
      const pausedBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'secondary'
      );
      expect(pausedBadge).toBeInTheDocument();
      expect(pausedBadge).toHaveTextContent('Paused');
    });

    it('displays error status with correct variant', () => {
      const errorStatus: ValidationStatus = {
        ...mockStatus,
        status: 'error',
      };

      render(<StatusCard {...defaultProps} status={errorStatus} />);
      
      const errorBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'destructive'
      );
      expect(errorBadge).toBeInTheDocument();
      expect(errorBadge).toHaveTextContent('Error');
    });
  });

  describe('Interactions', () => {
    it('calls onRefresh when refresh button is clicked', () => {
      const mockOnRefresh = jest.fn();
      render(<StatusCard {...defaultProps} onRefresh={mockOnRefresh} />);
      
      const refreshButton = screen.getByTestId('refresh-button');
      refreshButton.click();
      
      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined status', () => {
      render(<StatusCard {...defaultProps} status={undefined} />);
      
      expect(screen.getByTestId('widget')).toBeInTheDocument();
      expect(screen.getByText('No status available')).toBeInTheDocument();
    });

    it('handles status with missing fields', () => {
      const partialStatus: ValidationStatus = {
        status: 'running',
        progress: 50.0,
        processingRate: 0,
      };

      render(<StatusCard {...defaultProps} status={partialStatus} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('handles zero processing rate', () => {
      const zeroRateStatus: ValidationStatus = {
        ...mockStatus,
        processingRate: 0,
      };

      render(<StatusCard {...defaultProps} status={zeroRateStatus} />);
      
      expect(screen.getByText('0/min')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<StatusCard {...defaultProps} />);
      
      const widget = screen.getByTestId('widget');
      expect(widget).toHaveAttribute('aria-label', 'Validation Status');
    });

    it('has proper role attributes', () => {
      render(<StatusCard {...defaultProps} />);
      
      const widget = screen.getByTestId('widget');
      expect(widget).toHaveAttribute('role', 'region');
    });

    it('has proper progress bar attributes', () => {
      render(<StatusCard {...defaultProps} />);
      
      const progressBar = screen.getByTestId('progress');
      expect(progressBar).toHaveAttribute('data-value', '67.5');
    });
  });
});
