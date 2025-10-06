import React from 'react';
import { cn } from './utils';

/**
 * Loading states and skeleton screen utilities for validation control panel components
 */

export interface LoadingStateProps {
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'skeleton' | 'spinner' | 'pulse';
}

/**
 * Skeleton screen components
 */
export const SkeletonComponents = {
  /**
   * Basic skeleton rectangle
   */
  Rectangle: ({ 
    width = 'w-full', 
    height = 'h-4', 
    className 
  }: { 
    width?: string; 
    height?: string; 
    className?: string; 
  }) => (
    <div 
      className={cn(
        'animate-pulse bg-gray-200 rounded',
        width,
        height,
        className
      )}
      aria-hidden="true"
    />
  ),

  /**
   * Skeleton circle
   */
  Circle: ({ 
    size = 'w-8 h-8', 
    className 
  }: { 
    size?: string; 
    className?: string; 
  }) => (
    <div 
      className={cn(
        'animate-pulse bg-gray-200 rounded-full',
        size,
        className
      )}
      aria-hidden="true"
    />
  ),

  /**
   * Skeleton button
   */
  Button: ({ 
    width = 'w-24', 
    height = 'h-10', 
    className 
  }: { 
    width?: string; 
    height?: string; 
    className?: string; 
  }) => (
    <div 
      className={cn(
        'animate-pulse bg-gray-200 rounded-md',
        width,
        height,
        className
      )}
      aria-hidden="true"
    />
  ),

  /**
   * Skeleton card
   */
  Card: ({ 
    className 
  }: { 
    className?: string; 
  }) => (
    <div 
      className={cn(
        'animate-pulse bg-gray-200 rounded-lg p-4 space-y-3',
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gray-300 rounded-full" />
        <div className="w-32 h-4 bg-gray-300 rounded" />
      </div>
      <div className="space-y-2">
        <div className="w-full h-3 bg-gray-300 rounded" />
        <div className="w-3/4 h-3 bg-gray-300 rounded" />
      </div>
    </div>
  ),

  /**
   * Skeleton progress bar
   */
  ProgressBar: ({ 
    className 
  }: { 
    className?: string; 
  }) => (
    <div 
      className={cn(
        'animate-pulse bg-gray-200 rounded-full h-2',
        className
      )}
      aria-hidden="true"
    >
      <div className="w-1/3 h-full bg-gray-300 rounded-full" />
    </div>
  ),

  /**
   * Skeleton list item
   */
  ListItem: ({ 
    className 
  }: { 
    className?: string; 
  }) => (
    <div 
      className={cn(
        'animate-pulse flex items-center space-x-3 p-3',
        className
      )}
      aria-hidden="true"
    >
      <div className="w-6 h-6 bg-gray-200 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="w-3/4 h-3 bg-gray-200 rounded" />
        <div className="w-1/2 h-2 bg-gray-200 rounded" />
      </div>
    </div>
  ),

  /**
   * Skeleton table row
   */
  TableRow: ({ 
    columns = 3, 
    className 
  }: { 
    columns?: number; 
    className?: string; 
  }) => (
    <div 
      className={cn(
        'animate-pulse flex space-x-4 p-3',
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: columns }).map((_, index) => (
        <div key={index} className="flex-1 h-3 bg-gray-200 rounded" />
      ))}
    </div>
  ),
};

/**
 * Loading spinner component
 */
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}> = ({ 
  size = 'md', 
  className, 
  text 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className={cn(
          'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
          sizeClasses[size]
        )}
        aria-hidden="true"
      />
      {text && (
        <span className="text-sm text-gray-600" aria-live="polite">
          {text}
        </span>
      )}
    </div>
  );
};

/**
 * Loading overlay component
 */
export const LoadingOverlay: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
}> = ({ 
  isLoading, 
  children, 
  loadingText = 'Loading...', 
  className 
}) => {
  if (!isLoading) return <>{children}</>;

  return (
    <div className={cn('relative', className)}>
      {children}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-sm text-gray-600" aria-live="polite">
            {loadingText}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Loading state wrapper component
 */
export const LoadingState: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  loadingText?: string;
  className?: string;
}> = ({ 
  isLoading, 
  children, 
  skeleton, 
  loadingText = 'Loading...', 
  className 
}) => {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {skeleton || (
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" text={loadingText} />
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Pulse animation component
 */
export const PulseAnimation: React.FC<{
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}> = ({ 
  children, 
  isActive = true, 
  className 
}) => {
  return (
    <div 
      className={cn(
        isActive && 'animate-pulse',
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * Shimmer effect component
 */
export const ShimmerEffect: React.FC<{
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}> = ({ 
  children, 
  isActive = true, 
  className 
}) => {
  return (
    <div 
      className={cn(
        'relative overflow-hidden',
        className
      )}
    >
      {children}
      {isActive && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
    </div>
  );
};

/**
 * Loading states for specific components
 */
export const ComponentLoadingStates = {
  /**
   * Validation control panel loading state
   */
  ValidationControlPanel: ({ className }: { className?: string }) => (
    <div className={cn('space-y-4', className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <SkeletonComponents.Rectangle width="w-48" height="h-6" />
        <div className="flex items-center gap-2">
          <SkeletonComponents.Circle size="w-4 h-4" />
          <SkeletonComponents.Rectangle width="w-20" height="h-6" />
        </div>
      </div>
      
      {/* Progress skeleton */}
      <div className="space-y-2">
        <SkeletonComponents.ProgressBar />
        <div className="flex justify-between text-sm">
          <SkeletonComponents.Rectangle width="w-24" height="h-3" />
          <SkeletonComponents.Rectangle width="w-16" height="h-3" />
        </div>
      </div>
      
      {/* Buttons skeleton */}
      <div className="flex gap-2">
        <SkeletonComponents.Button width="w-32" />
        <SkeletonComponents.Button width="w-24" />
        <SkeletonComponents.Button width="w-20" />
      </div>
    </div>
  ),

  /**
   * Error/warning display loading state
   */
  ErrorWarningDisplay: ({ className }: { className?: string }) => (
    <div className={cn('space-y-4', className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <SkeletonComponents.Rectangle width="w-32" height="h-5" />
        <SkeletonComponents.Rectangle width="w-16" height="h-5" />
      </div>
      
      {/* List items skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonComponents.ListItem key={index} />
        ))}
      </div>
    </div>
  ),

  /**
   * Progress display loading state
   */
  ProgressDisplay: ({ className }: { className?: string }) => (
    <div className={cn('space-y-4', className)}>
      {/* Progress bar skeleton */}
      <SkeletonComponents.ProgressBar />
      
      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex justify-between">
            <SkeletonComponents.Rectangle width="w-16" height="h-3" />
            <SkeletonComponents.Rectangle width="w-12" height="h-3" />
          </div>
        ))}
      </div>
    </div>
  ),

  /**
   * Status badge loading state
   */
  StatusBadge: ({ className }: { className?: string }) => (
    <div className={cn('flex items-center gap-2', className)}>
      <SkeletonComponents.Circle size="w-4 h-4" />
      <SkeletonComponents.Rectangle width="w-16" height="h-5" />
    </div>
  ),
};

/**
 * Hook for managing loading states
 */
export const useLoadingState = (initialState: boolean = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [loadingText, setLoadingText] = React.useState<string>('Loading...');

  const startLoading = (text?: string) => {
    setLoadingText(text || 'Loading...');
    setIsLoading(true);
  };

  const stopLoading = () => {
    setIsLoading(false);
  };

  const setLoading = (loading: boolean, text?: string) => {
    setLoadingText(text || 'Loading...');
    setIsLoading(loading);
  };

  return {
    isLoading,
    loadingText,
    startLoading,
    stopLoading,
    setLoading,
  };
};

/**
 * Loading state context for global loading management
 */
export const LoadingStateContext = React.createContext<{
  isLoading: boolean;
  loadingText: string;
  setLoading: (loading: boolean, text?: string) => void;
}>({
  isLoading: false,
  loadingText: 'Loading...',
  setLoading: () => {},
});

export const LoadingStateProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { isLoading, loadingText, setLoading } = useLoadingState();

  return (
    <LoadingStateContext.Provider value={{ isLoading, loadingText, setLoading }}>
      {children}
    </LoadingStateContext.Provider>
  );
};

export const useLoadingStateContext = () => {
  const context = React.useContext(LoadingStateContext);
  if (!context) {
    throw new Error('useLoadingStateContext must be used within a LoadingStateProvider');
  }
  return context;
};

