import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * ProgressBar Component - Single responsibility: Animated progress indicators with smooth transitions
 * Follows global rules: Under 200 lines, single responsibility, uses existing UI components
 */
interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  color?: 'default' | 'success' | 'warning' | 'error';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  className,
  showPercentage = true,
  showLabel = false,
  label,
  size = 'md',
  animated = true,
  color = 'default',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-1';
      case 'lg':
        return 'h-3';
      default:
        return 'h-2';
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'success':
        return '[&>div]:bg-green-500';
      case 'warning':
        return '[&>div]:bg-yellow-500';
      case 'error':
        return '[&>div]:bg-red-500';
      default:
        return '';
    }
  };

  const getAnimationClasses = () => {
    if (!animated) return '';
    return 'transition-all duration-300 ease-in-out';
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label and Percentage */}
      {(showLabel || showPercentage) && (
        <div className="flex justify-between items-center text-sm">
          {showLabel && (
            <span className="font-medium text-foreground">
              {label || 'Progress'}
            </span>
          )}
          {showPercentage && (
            <span className="text-muted-foreground">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className={cn('relative', getAnimationClasses())}>
        <Progress
          value={percentage}
          className={cn(
            getSizeClasses(),
            getColorClasses(),
            getAnimationClasses()
          )}
          aria-label={label || 'Progress'}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={max}
          role="progressbar"
        />
        
        {/* Animated indicator for running state */}
        {animated && percentage > 0 && percentage < 100 && (
          <div className="absolute top-0 left-0 h-full w-full overflow-hidden rounded-full">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        )}
      </div>

      {/* Value display */}
      {showLabel && (
        <div className="text-xs text-muted-foreground">
          {value.toLocaleString()} / {max.toLocaleString()}
        </div>
      )}
    </div>
  );
};

/**
 * CompactProgressBar Component - Single responsibility: Compact progress display for mobile
 */
interface CompactProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  animated?: boolean;
}

export const CompactProgressBar: React.FC<CompactProgressBarProps> = ({
  value,
  max = 100,
  className,
  animated = true,
}) => {
  return (
    <ProgressBar
      value={value}
      max={max}
      className={className}
      showPercentage={false}
      showLabel={false}
      size="sm"
      animated={animated}
    />
  );
};

/**
 * ValidationProgressBar Component - Single responsibility: Specialized progress bar for validation
 */
interface ValidationProgressBarProps {
  processed: number;
  total: number;
  className?: string;
  showDetails?: boolean;
  animated?: boolean;
}

export const ValidationProgressBar: React.FC<ValidationProgressBarProps> = ({
  processed,
  total,
  className,
  showDetails = true,
  animated = true,
}) => {
  const percentage = total > 0 ? (processed / total) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <ProgressBar
        value={processed}
        max={total}
        showPercentage={true}
        showLabel={showDetails}
        label="Validation Progress"
        size="md"
        animated={animated}
        color="default"
      />
      
      {showDetails && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{processed.toLocaleString()} processed</span>
          <span>{total.toLocaleString()} total</span>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
