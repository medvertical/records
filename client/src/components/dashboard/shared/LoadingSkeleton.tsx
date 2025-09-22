import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LoadingSkeletonProps } from '@/shared/types/dashboard-new';

/**
 * LoadingSkeleton Component - Single responsibility: Provide loading states for dashboard widgets
 * Follows global rules: Under 200 lines, uses existing skeleton patterns, single responsibility
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = 'card',
  width,
  height,
  className,
  animated = true,
}) => {
  const baseClasses = cn(
    animated && "animate-pulse",
    className
  );

  const style = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  switch (type) {
    case 'card':
      return (
        <div className={cn("space-y-4", baseClasses)} style={style}>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      );

    case 'text':
      return (
        <div className={cn("space-y-2", baseClasses)} style={style}>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      );

    case 'circle':
      return (
        <Skeleton 
          className={cn("rounded-full", baseClasses)} 
          style={style}
        />
      );

    case 'rect':
      return (
        <Skeleton 
          className={baseClasses} 
          style={style}
        />
      );

    default:
      return (
        <Skeleton 
          className={baseClasses} 
          style={style}
        />
      );
  }
};

/**
 * Dashboard-specific skeleton components
 */

/**
 * Widget Skeleton - For loading entire widgets
 */
export const WidgetSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        
        {/* Content skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        
        {/* Footer skeleton */}
        <div className="flex justify-between pt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
};

/**
 * Chart Skeleton - For loading chart components
 */
export const ChartSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Chart header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      
      {/* Chart area */}
      <div className="space-y-2">
        <div className="flex items-end space-x-1 h-32">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton 
              key={i}
              className="flex-1"
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
        
        {/* Chart labels */}
        <div className="flex justify-between text-xs">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  );
};

/**
 * Progress Bar Skeleton - For loading progress indicators
 */
export const ProgressSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-8" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
};

/**
 * List Skeleton - For loading list items
 */
export const ListSkeleton: React.FC<{ 
  items?: number;
  className?: string;
}> = ({ items = 3, className }) => {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  );
};

/**
 * Grid Skeleton - For loading grid layouts
 */
export const GridSkeleton: React.FC<{ 
  columns?: number;
  rows?: number;
  className?: string;
}> = ({ columns = 2, rows = 2, className }) => {
  return (
    <div className={cn("grid gap-4", className)} 
         style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns * rows }).map((_, i) => (
        <WidgetSkeleton key={i} />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
