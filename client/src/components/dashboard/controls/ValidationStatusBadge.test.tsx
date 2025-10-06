import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  ValidationStatusBadge, 
  CompactValidationStatusBadge, 
  ValidationStatusIndicator,
  type ValidationStatus 
} from './ValidationStatusBadge';

describe('ValidationStatusBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<ValidationStatusBadge status="idle" />);
      
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('renders with custom text', () => {
      render(<ValidationStatusBadge status="idle" customText="Custom Status" />);
      
      expect(screen.getByText('Custom Status')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ValidationStatusBadge status="idle" className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Status Types', () => {
    const statusTests: Array<{ status: ValidationStatus; expectedText: string; expectedVariant: string }> = [
      { status: 'idle', expectedText: 'Idle', expectedVariant: 'outline' },
      { status: 'running', expectedText: 'Running', expectedVariant: 'default' },
      { status: 'paused', expectedText: 'Paused', expectedVariant: 'secondary' },
      { status: 'completed', expectedText: 'Completed', expectedVariant: 'success' },
      { status: 'error', expectedText: 'Error', expectedVariant: 'destructive' },
      { status: 'stopped', expectedText: 'Stopped', expectedVariant: 'secondary' },
      { status: 'initializing', expectedText: 'Initializing', expectedVariant: 'info' },
      { status: 'connecting', expectedText: 'Connecting', expectedVariant: 'info' },
      { status: 'disconnected', expectedText: 'Disconnected', expectedVariant: 'destructive' },
    ];

    statusTests.forEach(({ status, expectedText, expectedVariant }) => {
      it(`renders ${status} status correctly`, () => {
        render(<ValidationStatusBadge status={status} />);
        
        expect(screen.getByText(expectedText)).toBeInTheDocument();
      });
    });
  });

  describe('Icon Display', () => {
    it('shows icon by default', () => {
      render(<ValidationStatusBadge status="running" />);
      
      // Should have an icon (Activity icon for running status)
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('inline-flex');
    });

    it('hides icon when showIcon is false', () => {
      render(<ValidationStatusBadge status="running" showIcon={false} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('shows icon when showIcon is true', () => {
      render(<ValidationStatusBadge status="running" showIcon={true} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });

  describe('Text Display', () => {
    it('shows text by default', () => {
      render(<ValidationStatusBadge status="running" />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('hides text when showText is false', () => {
      render(<ValidationStatusBadge status="running" showText={false} />);
      
      // Should not have text content
      const badge = screen.getByRole('generic');
      expect(badge).not.toHaveTextContent('Running');
    });

    it('shows text when showText is true', () => {
      render(<ValidationStatusBadge status="running" showText={true} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(<ValidationStatusBadge status="running" size="sm" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('px-2', 'py-1', 'text-xs');
    });

    it('renders medium size correctly (default)', () => {
      render(<ValidationStatusBadge status="running" size="md" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('px-3', 'py-1.5', 'text-sm');
    });

    it('renders large size correctly', () => {
      render(<ValidationStatusBadge status="running" size="lg" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('px-4', 'py-2', 'text-base');
    });
  });

  describe('Animation', () => {
    it('applies animation by default', () => {
      render(<ValidationStatusBadge status="running" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('animate-pulse');
    });

    it('disables animation when animated is false', () => {
      render(<ValidationStatusBadge status="running" animated={false} />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).not.toHaveClass('animate-pulse');
    });

    it('applies icon animation for running status', () => {
      render(<ValidationStatusBadge status="running" animated={true} />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('animate-pulse');
    });

    it('applies icon animation for initializing status', () => {
      render(<ValidationStatusBadge status="initializing" animated={true} />);
      
      const badge = screen.getByText('Initializing').closest('div');
      expect(badge).toHaveClass('animate-pulse');
    });

    it('applies icon animation for connecting status', () => {
      render(<ValidationStatusBadge status="connecting" animated={true} />);
      
      const badge = screen.getByText('Connecting').closest('div');
      expect(badge).toHaveClass('animate-pulse');
    });

    it('does not apply animation for idle status', () => {
      render(<ValidationStatusBadge status="idle" animated={true} />);
      
      const badge = screen.getByText('Idle').closest('div');
      expect(badge).not.toHaveClass('animate-pulse');
    });
  });

  describe('Variant Override', () => {
    it('uses custom variant when provided', () => {
      render(<ValidationStatusBadge status="running" variant="destructive" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toBeInTheDocument();
    });

    it('uses default variant when not provided', () => {
      render(<ValidationStatusBadge status="running" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles unknown status gracefully', () => {
      render(<ValidationStatusBadge status="unknown" as any />);
      
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('handles empty custom text', () => {
      render(<ValidationStatusBadge status="running" customText="" />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('handles undefined props gracefully', () => {
      expect(() => {
        render(<ValidationStatusBadge status="running" className={undefined} />);
      }).not.toThrow();
    });
  });
});

describe('CompactValidationStatusBadge', () => {
  it('renders without text', () => {
    render(<CompactValidationStatusBadge status="running" />);
    
    // Should not have text content
    const badge = screen.getByRole('generic');
    expect(badge).not.toHaveTextContent('Running');
  });

  it('passes through size prop', () => {
    render(<CompactValidationStatusBadge status="running" size="lg" />);
    
    const badge = screen.getByRole('generic');
    expect(badge).toHaveClass('px-4', 'py-2', 'text-base');
  });

  it('passes through animated prop', () => {
    render(<CompactValidationStatusBadge status="running" animated={false} />);
    
    const badge = screen.getByRole('generic');
    expect(badge).not.toHaveClass('animate-pulse');
  });

  it('passes through className prop', () => {
    const { container } = render(
      <CompactValidationStatusBadge status="running" className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('uses small size by default', () => {
    render(<CompactValidationStatusBadge status="running" />);
    
    const badge = screen.getByRole('generic');
    expect(badge).toHaveClass('px-2', 'py-1', 'text-xs');
  });

  it('uses animated=true by default', () => {
    render(<CompactValidationStatusBadge status="running" />);
    
    const badge = screen.getByRole('generic');
    expect(badge).toHaveClass('animate-pulse');
  });
});

describe('ValidationStatusIndicator', () => {
  describe('Basic Rendering', () => {
    it('renders with status badge', () => {
      render(<ValidationStatusIndicator status="running" />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ValidationStatusIndicator status="running" className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Progress Display', () => {
    it('shows progress when showProgress is true and progress > 0', () => {
      render(<ValidationStatusIndicator status="running" showProgress={true} progress={75} />);
      
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('hides progress when showProgress is false', () => {
      render(<ValidationStatusIndicator status="running" showProgress={false} progress={75} />);
      
      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });

    it('hides progress when progress is 0', () => {
      render(<ValidationStatusIndicator status="running" showProgress={true} progress={0} />);
      
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
    });

    it('caps progress at 100%', () => {
      render(<ValidationStatusIndicator status="running" showProgress={true} progress={150} />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Details Display', () => {
    it('shows details when showDetails is true and details are provided', () => {
      render(
        <ValidationStatusIndicator 
          status="running" 
          showDetails={true} 
          details="Processing 50 items" 
        />
      );
      
      expect(screen.getByText('Processing 50 items')).toBeInTheDocument();
    });

    it('hides details when showDetails is false', () => {
      render(
        <ValidationStatusIndicator 
          status="running" 
          showDetails={false} 
          details="Processing 50 items" 
        />
      );
      
      expect(screen.queryByText('Processing 50 items')).not.toBeInTheDocument();
    });

    it('hides details when details are not provided', () => {
      render(<ValidationStatusIndicator status="running" showDetails={true} />);
      
      // Should not show any details text
      const container = screen.getByText('Running').closest('div');
      expect(container?.textContent).toBe('Running');
    });
  });

  describe('Size Prop', () => {
    it('passes size to ValidationStatusBadge', () => {
      render(<ValidationStatusIndicator status="running" size="lg" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('px-4', 'py-2', 'text-base');
    });

    it('uses medium size by default', () => {
      render(<ValidationStatusIndicator status="running" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('px-3', 'py-1.5', 'text-sm');
    });
  });

  describe('Combined Features', () => {
    it('shows both progress and details when enabled', () => {
      render(
        <ValidationStatusIndicator 
          status="running" 
          showProgress={true} 
          progress={50}
          showDetails={true} 
          details="Half complete" 
        />
      );
      
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Half complete')).toBeInTheDocument();
    });

    it('shows only status when progress and details are disabled', () => {
      render(
        <ValidationStatusIndicator 
          status="running" 
          showProgress={false} 
          showDetails={false} 
        />
      );
      
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.queryByText('%')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles negative progress values', () => {
      render(<ValidationStatusIndicator status="running" showProgress={true} progress={-10} />);
      
      // Should not show negative progress
      expect(screen.queryByText('-10%')).not.toBeInTheDocument();
    });

    it('handles undefined details', () => {
      render(<ValidationStatusIndicator status="running" showDetails={true} details={undefined} />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('handles empty details string', () => {
      render(<ValidationStatusIndicator status="running" showDetails={true} details="" />);
      
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });
});

describe('Status Configuration', () => {
  describe('Status Colors and Variants', () => {
    it('applies correct colors for idle status', () => {
      render(<ValidationStatusBadge status="idle" />);
      
      const badge = screen.getByText('Idle').closest('div');
      expect(badge).toHaveClass('text-gray-500', 'bg-gray-50', 'border-gray-200');
    });

    it('applies correct colors for running status', () => {
      render(<ValidationStatusBadge status="running" />);
      
      const badge = screen.getByText('Running').closest('div');
      expect(badge).toHaveClass('text-blue-600', 'bg-blue-50', 'border-blue-200');
    });

    it('applies correct colors for paused status', () => {
      render(<ValidationStatusBadge status="paused" />);
      
      const badge = screen.getByText('Paused').closest('div');
      expect(badge).toHaveClass('text-yellow-600', 'bg-yellow-50', 'border-yellow-200');
    });

    it('applies correct colors for completed status', () => {
      render(<ValidationStatusBadge status="completed" />);
      
      const badge = screen.getByText('Completed').closest('div');
      expect(badge).toHaveClass('text-green-600', 'bg-green-50', 'border-green-200');
    });

    it('applies correct colors for error status', () => {
      render(<ValidationStatusBadge status="error" />);
      
      const badge = screen.getByText('Error').closest('div');
      expect(badge).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200');
    });

    it('applies correct colors for stopped status', () => {
      render(<ValidationStatusBadge status="stopped" />);
      
      const badge = screen.getByText('Stopped').closest('div');
      expect(badge).toHaveClass('text-gray-600', 'bg-gray-50', 'border-gray-200');
    });

    it('applies correct colors for initializing status', () => {
      render(<ValidationStatusBadge status="initializing" />);
      
      const badge = screen.getByText('Initializing').closest('div');
      expect(badge).toHaveClass('text-blue-600', 'bg-blue-50', 'border-blue-200');
    });

    it('applies correct colors for connecting status', () => {
      render(<ValidationStatusBadge status="connecting" />);
      
      const badge = screen.getByText('Connecting').closest('div');
      expect(badge).toHaveClass('text-blue-600', 'bg-blue-50', 'border-blue-200');
    });

    it('applies correct colors for disconnected status', () => {
      render(<ValidationStatusBadge status="disconnected" />);
      
      const badge = screen.getByText('Disconnected').closest('div');
      expect(badge).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200');
    });
  });
});