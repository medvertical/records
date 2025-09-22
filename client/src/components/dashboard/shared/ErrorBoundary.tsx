import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundaryProps, ErrorBoundaryState } from '@/shared/types/dashboard-new';
import { getErrorBoundaryFallback } from '@/lib/error-handling';

/**
 * Dashboard Error Boundary - Single responsibility: Handle dashboard widget errors
 * Follows global rules: Focused on dashboard errors only, single responsibility
 */
export class DashboardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error!} 
            resetError={this.resetError}
          />
        );
      }

      // Default fallback UI
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center space-x-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span>Dashboard Widget Error</span>
            </CardTitle>
            <CardDescription>
              {this.state.error ? 
                getErrorBoundaryFallback(this.state.error, this.props.context || 'dashboard widget').message :
                'Something went wrong with this dashboard widget. Please try refreshing or contact support if the problem persists.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error details - only show in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="rounded-md bg-muted p-3">
                <h4 className="font-semibold text-sm mb-2">Error Details:</h4>
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium">
                      Component Stack
                    </summary>
                    <pre className="text-xs text-muted-foreground mt-1 overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex space-x-2">
              <Button 
                onClick={this.resetError}
                variant="outline"
                size="sm"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                variant="default"
                size="sm"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Simple Error Fallback Component
 */
interface SimpleErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const SimpleErrorFallback: React.FC<SimpleErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 text-destructive">
        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h3 className="font-semibold mb-2">Widget Error</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This widget encountered an error and couldn't load properly.
      </p>
      <Button onClick={resetError} size="sm">
        Try Again
      </Button>
    </div>
  );
};

/**
 * Compact Error Fallback Component - For smaller widgets
 */
export const CompactErrorFallback: React.FC<SimpleErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <div className="flex items-center justify-center p-4 text-center">
      <div className="space-y-2">
        <div className="text-destructive">
          <svg className="h-6 w-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <p className="text-xs text-muted-foreground">Widget Error</p>
        <Button onClick={resetError} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    </div>
  );
};

/**
 * HOC for wrapping components with error boundary
 */
export function withDashboardErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<SimpleErrorFallbackProps>
) {
  const WrappedComponent = (props: P) => (
    <DashboardErrorBoundary fallback={fallback}>
      <Component {...props} />
    </DashboardErrorBoundary>
  );

  WrappedComponent.displayName = `withDashboardErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default DashboardErrorBoundary;
