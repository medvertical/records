import React from 'react';
import { render, screen } from '@testing-library/react';
import { OverviewCard } from './OverviewCard';
import { OverviewMetrics } from '@/shared/types/dashboard-new';

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

describe('OverviewCard', () => {
  const mockMetrics: OverviewMetrics = {
    totalResources: 1000,
    validatedResources: 750,
    successRate: 85.5,
    validationCoverage: 75.0,
  };

  const defaultProps = {
    metrics: mockMetrics,
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
      render(<OverviewCard {...defaultProps} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-title', 'Overview');
      expect(screen.getByTestId('widget')).toHaveAttribute('data-subtitle', 'FHIR server and validation metrics');
    });

    it('renders loading state', () => {
      render(<OverviewCard {...defaultProps} loading={true} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-loading', 'true');
    });

    it('renders error state', () => {
      render(<OverviewCard {...defaultProps} error="Test error" />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-error', 'Test error');
    });
  });

  describe('Metrics Display', () => {
    it('displays total resources correctly', () => {
      render(<OverviewCard {...defaultProps} />);
      
      expect(screen.getByText('1,000')).toBeInTheDocument();
      expect(screen.getByText('Total Resources')).toBeInTheDocument();
    });

    it('displays validated resources correctly', () => {
      render(<OverviewCard {...defaultProps} />);
      
      expect(screen.getByText('750')).toBeInTheDocument();
      expect(screen.getByText('Validated Resources')).toBeInTheDocument();
    });

    it('displays success rate correctly', () => {
      render(<OverviewCard {...defaultProps} />);
      
      expect(screen.getByText('85.5%')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
    });

    it('displays validation coverage correctly', () => {
      render(<OverviewCard {...defaultProps} />);
      
      expect(screen.getByText('75.0%')).toBeInTheDocument();
      expect(screen.getByText('Validation Coverage')).toBeInTheDocument();
    });
  });

  describe('Success Rate Badge', () => {
    it('displays success rate with correct variant for good rate', () => {
      render(<OverviewCard {...defaultProps} />);
      
      const successBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'default'
      );
      expect(successBadge).toBeInTheDocument();
      expect(successBadge).toHaveTextContent('85.5%');
    });

    it('displays success rate with warning variant for poor rate', () => {
      const poorMetrics: OverviewMetrics = {
        ...mockMetrics,
        successRate: 45.0,
      };

      render(<OverviewCard {...defaultProps} metrics={poorMetrics} />);
      
      const warningBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'destructive'
      );
      expect(warningBadge).toBeInTheDocument();
      expect(warningBadge).toHaveTextContent('45.0%');
    });

    it('displays success rate with default variant for average rate', () => {
      const averageMetrics: OverviewMetrics = {
        ...mockMetrics,
        successRate: 70.0,
      };

      render(<OverviewCard {...defaultProps} metrics={averageMetrics} />);
      
      const defaultBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'secondary'
      );
      expect(defaultBadge).toBeInTheDocument();
      expect(defaultBadge).toHaveTextContent('70.0%');
    });
  });

  describe('Progress Indicators', () => {
    it('displays validation progress bar', () => {
      render(<OverviewCard {...defaultProps} />);
      
      // Check that progress indicators are present
      // The exact implementation would depend on the ProgressBar component
      expect(screen.getByText('750 / 1,000')).toBeInTheDocument();
    });

    it('displays coverage progress bar', () => {
      render(<OverviewCard {...defaultProps} />);
      
      // Check that coverage progress is displayed
      expect(screen.getByText('75.0%')).toBeInTheDocument();
    });
  });

  describe('Last Updated Display', () => {
    it('displays last updated timestamp', () => {
      render(<OverviewCard {...defaultProps} />);
      
      // The exact format will depend on the date-fns implementation
      // We just check that some time-related text is present
      expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    });

    it('handles undefined lastUpdated', () => {
      render(<OverviewCard {...defaultProps} lastUpdated={undefined} />);
      
      // Should still render without crashing
      expect(screen.getByTestId('widget')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onRefresh when refresh button is clicked', () => {
      const mockOnRefresh = jest.fn();
      render(<OverviewCard {...defaultProps} onRefresh={mockOnRefresh} />);
      
      const refreshButton = screen.getByTestId('refresh-button');
      refreshButton.click();
      
      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined metrics', () => {
      render(<OverviewCard {...defaultProps} metrics={undefined} />);
      
      expect(screen.getByTestId('widget')).toBeInTheDocument();
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('handles zero values', () => {
      const zeroMetrics: OverviewMetrics = {
        totalResources: 0,
        validatedResources: 0,
        successRate: 0,
        validationCoverage: 0,
      };

      render(<OverviewCard {...defaultProps} metrics={zeroMetrics} />);
      
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles very large numbers', () => {
      const largeMetrics: OverviewMetrics = {
        totalResources: 1000000,
        validatedResources: 750000,
        successRate: 75.0,
        validationCoverage: 75.0,
      };

      render(<OverviewCard {...defaultProps} metrics={largeMetrics} />);
      
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
      expect(screen.getByText('750,000')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<OverviewCard {...defaultProps} />);
      
      const widget = screen.getByTestId('widget');
      expect(widget).toHaveAttribute('aria-label', 'Overview');
    });

    it('has proper role attributes', () => {
      render(<OverviewCard {...defaultProps} />);
      
      const widget = screen.getByTestId('widget');
      expect(widget).toHaveAttribute('role', 'region');
    });
  });
});
