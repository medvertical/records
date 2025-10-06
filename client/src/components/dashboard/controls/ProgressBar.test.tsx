import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar, CompactProgressBar, ValidationProgressBar } from './ProgressBar';

// Mock the Progress component
jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className, ...props }: any) => (
    <div
      data-testid="progress"
      className={className}
      data-value={value}
      {...props}
    />
  ),
}));

describe('ProgressBar', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<ProgressBar value={50} />);
      
      expect(screen.getByTestId('progress')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('renders with custom max value', () => {
      render(<ProgressBar value={25} max={50} />);
      
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<ProgressBar value={50} className="custom-class" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('custom-class');
    });

    it('renders with label when showLabel is true', () => {
      render(<ProgressBar value={50} showLabel={true} label="Test Progress" />);
      
      expect(screen.getByText('Test Progress')).toBeInTheDocument();
    });

    it('does not render label when showLabel is false', () => {
      render(<ProgressBar value={50} showLabel={false} label="Test Progress" />);
      
      expect(screen.queryByText('Test Progress')).not.toBeInTheDocument();
    });

    it('renders percentage when showPercentage is true', () => {
      render(<ProgressBar value={50} showPercentage={true} />);
      
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('does not render percentage when showPercentage is false', () => {
      render(<ProgressBar value={50} showPercentage={false} />);
      
      expect(screen.queryByText('50.0%')).not.toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(<ProgressBar value={50} size="sm" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('h-1');
    });

    it('renders medium size correctly', () => {
      render(<ProgressBar value={50} size="md" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('h-2');
    });

    it('renders large size correctly', () => {
      render(<ProgressBar value={50} size="lg" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('h-3');
    });
  });

  describe('Color Variants', () => {
    it('renders default color correctly', () => {
      render(<ProgressBar value={50} color="default" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).not.toHaveClass('[&>div]:bg-green-500', '[&>div]:bg-yellow-500', '[&>div]:bg-red-500');
    });

    it('renders success color correctly', () => {
      render(<ProgressBar value={50} color="success" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('[&>div]:bg-green-500');
    });

    it('renders warning color correctly', () => {
      render(<ProgressBar value={50} color="warning" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('[&>div]:bg-yellow-500');
    });

    it('renders error color correctly', () => {
      render(<ProgressBar value={50} color="error" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('[&>div]:bg-red-500');
    });
  });

  describe('Animation', () => {
    it('applies animation classes when animated is true', () => {
      render(<ProgressBar value={50} animated={true} />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('transition-all', 'duration-300', 'ease-in-out');
    });

    it('does not apply animation classes when animated is false', () => {
      render(<ProgressBar value={50} animated={false} />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).not.toHaveClass('transition-all', 'duration-300', 'ease-in-out');
    });

    it('shows animated overlay when value is between 0 and 100', () => {
      render(<ProgressBar value={50} animated={true} />);
      
      const overlay = screen.getByTestId('progress').querySelector('.animate-pulse');
      expect(overlay).toBeInTheDocument();
    });

    it('does not show animated overlay when value is 0', () => {
      render(<ProgressBar value={0} animated={true} />);
      
      const overlay = screen.getByTestId('progress').querySelector('.animate-pulse');
      expect(overlay).not.toBeInTheDocument();
    });

    it('does not show animated overlay when value is 100', () => {
      render(<ProgressBar value={100} animated={true} />);
      
      const overlay = screen.getByTestId('progress').querySelector('.animate-pulse');
      expect(overlay).not.toBeInTheDocument();
    });
  });

  describe('Value Calculations', () => {
    it('calculates percentage correctly', () => {
      render(<ProgressBar value={25} max={100} />);
      
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('handles zero values correctly', () => {
      render(<ProgressBar value={0} max={100} />);
      
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles maximum values correctly', () => {
      render(<ProgressBar value={100} max={100} />);
      
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('clamps values above maximum', () => {
      render(<ProgressBar value={150} max={100} />);
      
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('clamps values below zero', () => {
      render(<ProgressBar value={-10} max={100} />);
      
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<ProgressBar value={50} label="Test Progress" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveAttribute('aria-label', 'Test Progress');
      expect(progress).toHaveAttribute('aria-valuenow', '50');
      expect(progress).toHaveAttribute('aria-valuemin', '0');
      expect(progress).toHaveAttribute('aria-valuemax', '100');
      expect(progress).toHaveAttribute('role', 'progressbar');
    });

    it('shows value and max in details when showLabel is true', () => {
      render(<ProgressBar value={50} max={100} showLabel={true} />);
      
      expect(screen.getByText('50 / 100')).toBeInTheDocument();
    });
  });
});

describe('CompactProgressBar', () => {
  it('renders with compact props', () => {
    render(<CompactProgressBar value={50} />);
    
    expect(screen.getByTestId('progress')).toBeInTheDocument();
    expect(screen.queryByText('50.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Progress')).not.toBeInTheDocument();
  });

  it('renders with custom className', () => {
    render(<CompactProgressBar value={50} className="custom-class" />);
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveClass('custom-class');
  });

  it('renders with custom max value', () => {
    render(<CompactProgressBar value={25} max={50} />);
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveAttribute('data-value', '50');
  });

  it('renders with animation disabled', () => {
    render(<CompactProgressBar value={50} animated={false} />);
    
    const progress = screen.getByTestId('progress');
    expect(progress).not.toHaveClass('transition-all', 'duration-300', 'ease-in-out');
  });
});

describe('ValidationProgressBar', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<ValidationProgressBar processed={50} total={100} />);
      
      expect(screen.getByText('Validation Progress')).toBeInTheDocument();
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<ValidationProgressBar processed={50} total={100} className="custom-class" />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('custom-class');
    });

    it('renders details when showDetails is true', () => {
      render(<ValidationProgressBar processed={50} total={100} showDetails={true} />);
      
      expect(screen.getByText('50 processed')).toBeInTheDocument();
      expect(screen.getByText('100 total')).toBeInTheDocument();
    });

    it('does not render details when showDetails is false', () => {
      render(<ValidationProgressBar processed={50} total={100} showDetails={false} />);
      
      expect(screen.queryByText('50 processed')).not.toBeInTheDocument();
      expect(screen.queryByText('100 total')).not.toBeInTheDocument();
    });
  });

  describe('Value Calculations', () => {
    it('calculates percentage correctly', () => {
      render(<ValidationProgressBar processed={25} total={100} />);
      
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('handles zero total correctly', () => {
      render(<ValidationProgressBar processed={50} total={0} />);
      
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles zero processed correctly', () => {
      render(<ValidationProgressBar processed={0} total={100} />);
      
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles processed greater than total correctly', () => {
      render(<ValidationProgressBar processed={150} total={100} />);
      
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('applies animation when animated is true', () => {
      render(<ValidationProgressBar processed={50} total={100} animated={true} />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveClass('transition-all', 'duration-300', 'ease-in-out');
    });

    it('does not apply animation when animated is false', () => {
      render(<ValidationProgressBar processed={50} total={100} animated={false} />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).not.toHaveClass('transition-all', 'duration-300', 'ease-in-out');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<ValidationProgressBar processed={50} total={100} />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveAttribute('aria-label', 'Validation Progress');
      expect(progress).toHaveAttribute('aria-valuenow', '50');
      expect(progress).toHaveAttribute('aria-valuemin', '0');
      expect(progress).toHaveAttribute('aria-valuemax', '100');
      expect(progress).toHaveAttribute('role', 'progressbar');
    });
  });
});

