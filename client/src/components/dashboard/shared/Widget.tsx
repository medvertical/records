import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WidgetProps, WidgetState } from '@/shared/types/dashboard-new';

interface WidgetComponentProps extends WidgetProps {
  state?: WidgetState;
  onRefresh?: () => void;
  showRefresh?: boolean;
}

/**
 * Base Widget Component - Single responsibility: Provide consistent widget styling and behavior
 * Follows global rules: Under 300 lines, uses existing UI components, single responsibility
 */
export const Widget: React.FC<WidgetComponentProps> = ({
  id,
  title,
  subtitle,
  loading = false,
  error = null,
  className,
  children,
  actions,
  state,
  onRefresh,
  showRefresh = false,
}) => {
  const widgetState = state || {
    loading,
    error: error ? error : null,
    lastUpdated: null,
    isStale: false,
  };

  const handleRefresh = () => {
    if (onRefresh && !widgetState.loading) {
      onRefresh();
    }
  };

  return (
    <Card 
      className={cn(
        "h-full transition-all duration-200 hover:shadow-md",
        widgetState.error && "border-destructive/50",
        widgetState.isStale && "border-warning/50",
        className
      )}
      data-testid={`widget-${id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col space-y-1">
          <CardTitle className="text-lg font-semibold">
            {title}
          </CardTitle>
          {subtitle && (
            <CardDescription className="text-sm">
              {subtitle}
            </CardDescription>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Status indicators */}
          {widgetState.loading && (
            <Badge variant="outline" className="animate-pulse">
              Loading...
            </Badge>
          )}
          
          {widgetState.error && (
            <Badge variant="destructive">
              Error
            </Badge>
          )}
          
          {widgetState.isStale && !widgetState.error && (
            <Badge variant="secondary">
              Stale
            </Badge>
          )}
          
          {/* Actions */}
          {actions && (
            <div className="flex items-center space-x-1">
              {actions}
            </div>
          )}
          
          {/* Refresh button */}
          {showRefresh && onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={widgetState.loading}
              className={cn(
                "rounded-md p-1 text-muted-foreground hover:text-foreground",
                "transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                widgetState.loading && "cursor-not-allowed opacity-50"
              )}
              aria-label="Refresh widget data"
            >
              <svg
                className={cn(
                  "h-4 w-4",
                  widgetState.loading && "animate-spin"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {widgetState.error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-destructive">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              {widgetState.error}
            </p>
            {onRefresh && (
              <button
                onClick={handleRefresh}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        ) : widgetState.loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                Loading...
              </span>
            </div>
          </div>
        ) : (
          children
        )}
        
        {/* Last updated timestamp */}
        {widgetState.lastUpdated && !widgetState.loading && (
          <div className="text-xs text-muted-foreground">
            Last updated: {widgetState.lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Widget Header Component - For consistent header styling across widgets
 */
export interface WidgetHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center space-x-1">
          {actions}
        </div>
      )}
    </div>
  );
};

/**
 * Widget Content Wrapper - For consistent content styling
 */
export interface WidgetContentProps {
  children: React.ReactNode;
  className?: string;
}

export const WidgetContent: React.FC<WidgetContentProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  );
};

/**
 * Widget Footer - For consistent footer styling
 */
export interface WidgetFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const WidgetFooter: React.FC<WidgetFooterProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn("flex items-center justify-between pt-2", className)}>
      {children}
    </div>
  );
};

export default Widget;
