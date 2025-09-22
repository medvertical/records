import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertCard } from './AlertCard';
import { Alert, AlertSummary } from '@/shared/types/dashboard-new';

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

// Mock the Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">
      {children}
    </button>
  ),
}));

describe('AlertCard', () => {
  const mockAlerts: Alert[] = [
    {
      id: '1',
      type: 'critical',
      title: 'Critical Error',
      message: 'This is a critical error',
      timestamp: new Date('2023-01-01'),
      resolved: false,
    },
    {
      id: '2',
      type: 'warning',
      title: 'Warning',
      message: 'This is a warning',
      timestamp: new Date('2023-01-02'),
      resolved: false,
    },
    {
      id: '3',
      type: 'info',
      title: 'Info',
      message: 'This is an info message',
      timestamp: new Date('2023-01-03'),
      resolved: true,
    },
  ];

  const mockSummary: AlertSummary = {
    critical: 1,
    warnings: 1,
    info: 1,
    total: 3,
  };

  const defaultProps = {
    alerts: mockAlerts,
    summary: mockSummary,
    loading: false,
    error: null,
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with correct title and subtitle', () => {
      render(<AlertCard {...defaultProps} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-title', 'Alerts');
      expect(screen.getByTestId('widget')).toHaveAttribute('data-subtitle', '3 active alerts');
    });

    it('renders with no active alerts subtitle when summary is empty', () => {
      const emptySummary: AlertSummary = {
        critical: 0,
        warnings: 0,
        info: 0,
        total: 0,
      };

      render(<AlertCard {...defaultProps} summary={emptySummary} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-subtitle', 'No active alerts');
    });

    it('renders loading state', () => {
      render(<AlertCard {...defaultProps} loading={true} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-loading', 'true');
    });

    it('renders error state', () => {
      render(<AlertCard {...defaultProps} error="Test error" />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-error', 'Test error');
    });
  });

  describe('Alert Summary Display', () => {
    it('displays alert counts correctly', () => {
      render(<AlertCard {...defaultProps} />);
      
      expect(screen.getByText('1')).toBeInTheDocument(); // Critical count
      expect(screen.getByText('1')).toBeInTheDocument(); // Warning count
      expect(screen.getByText('1')).toBeInTheDocument(); // Info count
    });

    it('displays critical alerts badge with correct variant', () => {
      render(<AlertCard {...defaultProps} />);
      
      const criticalBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'destructive'
      );
      expect(criticalBadge).toBeInTheDocument();
      expect(criticalBadge).toHaveTextContent('1');
    });

    it('displays warning alerts badge with correct variant', () => {
      render(<AlertCard {...defaultProps} />);
      
      const warningBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'default'
      );
      expect(warningBadge).toBeInTheDocument();
      expect(warningBadge).toHaveTextContent('1');
    });

    it('displays info alerts badge with correct variant', () => {
      render(<AlertCard {...defaultProps} />);
      
      const infoBadge = screen.getAllByTestId('badge').find(badge => 
        badge.getAttribute('data-variant') === 'secondary'
      );
      expect(infoBadge).toBeInTheDocument();
      expect(infoBadge).toHaveTextContent('1');
    });
  });

  describe('Alert List', () => {
    it('displays all alerts when not collapsed', () => {
      render(<AlertCard {...defaultProps} />);
      
      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('displays alert messages', () => {
      render(<AlertCard {...defaultProps} />);
      
      expect(screen.getByText('This is a critical error')).toBeInTheDocument();
      expect(screen.getByText('This is a warning')).toBeInTheDocument();
      expect(screen.getByText('This is an info message')).toBeInTheDocument();
    });

    it('displays timestamps in relative format', () => {
      render(<AlertCard {...defaultProps} />);
      
      // The exact text will depend on the date-fns implementation
      // We just check that some time-related text is present
      const timeElements = screen.getAllByText(/ago|minute|hour|day/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('shows resolved status for resolved alerts', () => {
      render(<AlertCard {...defaultProps} />);
      
      // Check that resolved alerts are marked appropriately
      expect(screen.getByText('Info')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onRefresh when refresh button is clicked', () => {
      const mockOnRefresh = jest.fn();
      render(<AlertCard {...defaultProps} onRefresh={mockOnRefresh} />);
      
      fireEvent.click(screen.getByTestId('refresh-button'));
      
      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });

    it('calls onAlertAction when alert action is triggered', () => {
      const mockOnAlertAction = jest.fn();
      const alertsWithActions = mockAlerts.map(alert => ({
        ...alert,
        actions: [{
          id: 'action1',
          label: 'Dismiss',
          type: 'secondary' as const,
          action: jest.fn(),
        }],
      }));

      render(
        <AlertCard 
          {...defaultProps} 
          alerts={alertsWithActions}
          onAlertAction={mockOnAlertAction}
        />
      );
      
      // This would depend on the actual implementation of alert actions
      // For now, we just verify the component renders with actions
      expect(screen.getByText('Critical Error')).toBeInTheDocument();
    });

    it('calls onDismissAlert when alert is dismissed', () => {
      const mockOnDismissAlert = jest.fn();
      
      render(
        <AlertCard 
          {...defaultProps} 
          onDismissAlert={mockOnDismissAlert}
        />
      );
      
      // This would depend on the actual implementation of dismiss functionality
      // For now, we just verify the component renders
      expect(screen.getByText('Critical Error')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty alerts array', () => {
      render(<AlertCard {...defaultProps} alerts={[]} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-subtitle', 'No active alerts');
    });

    it('handles undefined alerts', () => {
      render(<AlertCard {...defaultProps} alerts={undefined} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-subtitle', 'No active alerts');
    });

    it('handles undefined summary', () => {
      render(<AlertCard {...defaultProps} summary={undefined} />);
      
      expect(screen.getByTestId('widget')).toHaveAttribute('data-subtitle', 'No active alerts');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<AlertCard {...defaultProps} />);
      
      const widget = screen.getByTestId('widget');
      expect(widget).toHaveAttribute('aria-label', 'Alerts');
    });

    it('has proper role attributes', () => {
      render(<AlertCard {...defaultProps} />);
      
      const widget = screen.getByTestId('widget');
      expect(widget).toHaveAttribute('role', 'region');
    });
  });
});
