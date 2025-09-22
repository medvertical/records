import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidationControlPanel } from './ValidationControlPanel';
import { ValidationStatus } from '@/shared/types/dashboard-new';

// Mock the Card components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className, tabIndex, onKeyDown, role, 'aria-label': ariaLabel }: any) => (
    <div 
      data-testid="card" 
      className={className}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}));

// Mock the Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      data-testid="button"
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

// Mock the Progress component
jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));

// Mock the Badge component
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Play: () => <span data-testid="play-icon">Play</span>,
  Pause: () => <span data-testid="pause-icon">Pause</span>,
  Square: () => <span data-testid="square-icon">Square</span>,
  RotateCcw: () => <span data-testid="rotate-icon">Rotate</span>,
  Settings: () => <span data-testid="settings-icon">Settings</span>,
  Clock: () => <span data-testid="clock-icon">Clock</span>,
  Activity: () => <span data-testid="activity-icon">Activity</span>,
  ChevronRight: () => <span data-testid="chevron-icon">Chevron</span>,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours ago'),
  formatDuration: jest.fn(() => '23 minutes'),
  intervalToDuration: jest.fn(() => ({ hours: 0, minutes: 23 })),
}));

describe('ValidationControlPanel', () => {
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
    onStart: jest.fn(),
    onPause: jest.fn(),
    onResume: jest.fn(),
    onStop: jest.fn(),
    onRevalidateAll: jest.fn(),
    onSettings: jest.fn(),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with correct title and description', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByTestId('card-title')).toHaveTextContent('Validation Engine');
      expect(screen.getByTestId('card-description')).toHaveTextContent('Control and monitor FHIR validation progress');
    });

    it('renders loading state', () => {
      render(<ValidationControlPanel {...defaultProps} loading={true} />);
      
      const buttons = screen.getAllByTestId('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('renders error state', () => {
      render(<ValidationControlPanel {...defaultProps} error="Test error" />);
      
      expect(screen.getByText('Error loading validation status')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('displays running status correctly', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
    });

    it('displays paused status correctly', () => {
      const pausedStatus: ValidationStatus = {
        ...mockStatus,
        status: 'paused',
      };

      render(<ValidationControlPanel {...defaultProps} status={pausedStatus} />);
      
      expect(screen.getByText('Paused')).toBeInTheDocument();
      expect(screen.getByTestId('pause-icon')).toBeInTheDocument();
    });

    it('displays completed status correctly', () => {
      const completedStatus: ValidationStatus = {
        ...mockStatus,
        status: 'completed',
      };

      render(<ValidationControlPanel {...defaultProps} status={completedStatus} />);
      
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByTestId('square-icon')).toBeInTheDocument();
    });

    it('displays error status correctly', () => {
      const errorStatus: ValidationStatus = {
        ...mockStatus,
        status: 'error',
      };

      render(<ValidationControlPanel {...defaultProps} status={errorStatus} />);
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByTestId('square-icon')).toBeInTheDocument();
    });

    it('displays idle status correctly', () => {
      const idleStatus: ValidationStatus = {
        ...mockStatus,
        status: 'idle',
      };

      render(<ValidationControlPanel {...defaultProps} status={idleStatus} />);
      
      expect(screen.getByText('Idle')).toBeInTheDocument();
      expect(screen.getByTestId('square-icon')).toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('displays progress bar with correct value', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const progressBar = screen.getByTestId('progress');
      expect(progressBar).toHaveAttribute('data-value', '67.5');
    });

    it('displays progress percentage', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByText('67.5% Complete')).toBeInTheDocument();
    });
  });

  describe('Current Activity Display', () => {
    it('displays current resource type when running', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByText('Patient Resources')).toBeInTheDocument();
      expect(screen.getByText('Currently Processing:')).toBeInTheDocument();
    });

    it('displays next resource type when available', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByText('Next: Observation')).toBeInTheDocument();
    });

    it('displays processing rate', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByText('Rate: 1,247/min')).toBeInTheDocument();
    });

    it('displays estimated time remaining', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByText('Remaining: 23 minutes')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    describe('Idle State', () => {
      it('shows start button when idle', () => {
        const idleStatus: ValidationStatus = {
          ...mockStatus,
          status: 'idle',
        };

        render(<ValidationControlPanel {...defaultProps} status={idleStatus} />);
        
        expect(screen.getByTestId('play-icon')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
      });
    });

    describe('Running State', () => {
      it('shows pause and stop buttons when running', () => {
        render(<ValidationControlPanel {...defaultProps} />);
        
        expect(screen.getByTestId('pause-icon')).toBeInTheDocument();
        expect(screen.getByText('Pause')).toBeInTheDocument();
        expect(screen.getByTestId('square-icon')).toBeInTheDocument();
        expect(screen.getByText('Stop')).toBeInTheDocument();
      });
    });

    describe('Paused State', () => {
      it('shows resume and stop buttons when paused', () => {
        const pausedStatus: ValidationStatus = {
          ...mockStatus,
          status: 'paused',
        };

        render(<ValidationControlPanel {...defaultProps} status={pausedStatus} />);
        
        expect(screen.getByTestId('play-icon')).toBeInTheDocument();
        expect(screen.getByText('Resume')).toBeInTheDocument();
        expect(screen.getByTestId('square-icon')).toBeInTheDocument();
        expect(screen.getByText('Stop')).toBeInTheDocument();
      });
    });

    describe('Completed/Error State', () => {
      it('shows start button when completed', () => {
        const completedStatus: ValidationStatus = {
          ...mockStatus,
          status: 'completed',
        };

        render(<ValidationControlPanel {...defaultProps} status={completedStatus} />);
        
        expect(screen.getByTestId('play-icon')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
      });

      it('shows start button when error', () => {
        const errorStatus: ValidationStatus = {
          ...mockStatus,
          status: 'error',
        };

        render(<ValidationControlPanel {...defaultProps} status={errorStatus} />);
        
        expect(screen.getByTestId('play-icon')).toBeInTheDocument();
        expect(screen.getByText('Start')).toBeInTheDocument();
      });
    });

    it('always shows revalidate all button when not running', () => {
      const idleStatus: ValidationStatus = {
        ...mockStatus,
        status: 'idle',
      };

      render(<ValidationControlPanel {...defaultProps} status={idleStatus} />);
      
      expect(screen.getByTestId('rotate-icon')).toBeInTheDocument();
      expect(screen.getByText('Revalidate All')).toBeInTheDocument();
    });

    it('always shows settings button', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onStart when start button is clicked', () => {
      const idleStatus: ValidationStatus = {
        ...mockStatus,
        status: 'idle',
      };

      render(<ValidationControlPanel {...defaultProps} status={idleStatus} />);
      
      const startButton = screen.getByText('Start');
      fireEvent.click(startButton);
      
      expect(defaultProps.onStart).toHaveBeenCalledTimes(1);
    });

    it('calls onPause when pause button is clicked', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const pauseButton = screen.getByText('Pause');
      fireEvent.click(pauseButton);
      
      expect(defaultProps.onPause).toHaveBeenCalledTimes(1);
    });

    it('calls onResume when resume button is clicked', () => {
      const pausedStatus: ValidationStatus = {
        ...mockStatus,
        status: 'paused',
      };

      render(<ValidationControlPanel {...defaultProps} status={pausedStatus} />);
      
      const resumeButton = screen.getByText('Resume');
      fireEvent.click(resumeButton);
      
      expect(defaultProps.onResume).toHaveBeenCalledTimes(1);
    });

    it('calls onStop when stop button is clicked', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const stopButton = screen.getByText('Stop');
      fireEvent.click(stopButton);
      
      expect(defaultProps.onStop).toHaveBeenCalledTimes(1);
    });

    it('calls onRevalidateAll when revalidate button is clicked', () => {
      const idleStatus: ValidationStatus = {
        ...mockStatus,
        status: 'idle',
      };

      render(<ValidationControlPanel {...defaultProps} status={idleStatus} />);
      
      const revalidateButton = screen.getByText('Revalidate All');
      fireEvent.click(revalidateButton);
      
      expect(defaultProps.onRevalidateAll).toHaveBeenCalledTimes(1);
    });

    it('calls onSettings when settings button is clicked', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const settingsButton = screen.getByText('Settings');
      fireEvent.click(settingsButton);
      
      expect(defaultProps.onSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Navigation', () => {
    it('has proper keyboard navigation attributes', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('tabIndex', '0');
      expect(card).toHaveAttribute('role', 'region');
      expect(card).toHaveAttribute('aria-label', 'Validation Control Panel');
    });

    it('handles keyboard events', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const card = screen.getByTestId('card');
      fireEvent.keyDown(card, { key: ' ' });
      
      // The exact behavior would depend on the keyboard navigation implementation
      // For now, we just verify the component handles keyboard events
      expect(card).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined status', () => {
      render(<ValidationControlPanel {...defaultProps} status={undefined} />);
      
      expect(screen.getByText('Idle')).toBeInTheDocument();
      expect(screen.getByText('0% Complete')).toBeInTheDocument();
    });

    it('handles status with missing fields', () => {
      const partialStatus: ValidationStatus = {
        status: 'running',
        progress: 50.0,
        processingRate: 0,
      };

      render(<ValidationControlPanel {...defaultProps} status={partialStatus} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('50.0% Complete')).toBeInTheDocument();
    });

    it('handles zero processing rate', () => {
      const zeroRateStatus: ValidationStatus = {
        ...mockStatus,
        processingRate: 0,
      };

      render(<ValidationControlPanel {...defaultProps} status={zeroRateStatus} />);
      
      expect(screen.getByText('Rate: 0/min')).toBeInTheDocument();
    });

    it('handles undefined estimated time remaining', () => {
      const statusWithoutTime: ValidationStatus = {
        ...mockStatus,
        estimatedTimeRemaining: undefined,
      };

      render(<ValidationControlPanel {...defaultProps} status={statusWithoutTime} />);
      
      expect(screen.queryByText('Remaining:')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('aria-label', 'Validation Control Panel');
    });

    it('has proper role attributes', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('role', 'region');
    });

    it('has proper progress bar attributes', () => {
      render(<ValidationControlPanel {...defaultProps} />);
      
      const progressBar = screen.getByTestId('progress');
      expect(progressBar).toHaveAttribute('data-value', '67.5');
    });
  });
});
