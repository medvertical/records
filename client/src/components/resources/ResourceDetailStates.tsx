import { AlertCircle, FileQuestion, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'wouter';

// ============================================================================
// Loading States
// ============================================================================

export function ResourceDetailLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto" role="status" aria-label="Loading resource detail">
      {/* Header skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              <Skeleton className="h-8 w-8" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-2 mb-6">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ValidationMessagesLoadingSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading validation messages">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Error States
// ============================================================================

export interface ResourceDetailErrorProps {
  error: Error | string;
  resourceType?: string;
  resourceId?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ResourceDetailError({
  error,
  resourceType,
  resourceId,
  onRetry,
  onBack,
}: ResourceDetailErrorProps) {
  const errorMessage = error instanceof Error ? error.message : error;
  const isNotFound = errorMessage.toLowerCase().includes('not found') || 
                     errorMessage.includes('404');

  return (
    <div className="p-6 h-full overflow-y-auto" role="alert" aria-live="assertive">
      <Card className="max-w-2xl mx-auto mt-12">
        <CardContent className="pt-6">
          <div className="text-center">
            {isNotFound ? (
              <FileQuestion className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            ) : (
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            )}
            
            <h3 className="text-xl font-semibold mb-2 text-gray-900">
              {isNotFound ? 'Resource Not Found' : 'Failed to Load Resource'}
            </h3>
            
            {resourceType && resourceId && (
              <p className="text-sm text-gray-500 mb-3 font-mono">
                {resourceType}/{resourceId}
              </p>
            )}
            
            <Alert variant={isNotFound ? 'default' : 'destructive'} className="mb-6 text-left">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Details</AlertTitle>
              <AlertDescription className="mt-2">
                {errorMessage}
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-center gap-3">
              {onBack && (
                <Link href="/resources">
                  <Button variant="outline" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Resources
                  </Button>
                </Link>
              )}
              {onRetry && !isNotFound && (
                <Button onClick={onRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export interface ValidationErrorProps {
  error: Error | string;
  aspect?: string;
  onRetry?: () => void;
}

export function ValidationError({ error, aspect, onRetry }: ValidationErrorProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {aspect ? `${aspect} Validation Failed` : 'Validation Failed'}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p>{errorMessage}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Validation
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Empty States
// ============================================================================

export interface EmptyValidationMessagesProps {
  aspect?: string;
  isDisabled?: boolean;
}

export function EmptyValidationMessages({ 
  aspect,
  isDisabled = false,
}: EmptyValidationMessagesProps) {
  if (isDisabled) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed" role="status">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-2 font-medium">
          {aspect ? `${aspect} validation is currently disabled` : 'Validation is disabled'}
        </p>
        <p className="text-sm text-gray-400">
          Enable it in settings to view validation messages
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12" role="status">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-gray-600 font-medium mb-1">
        {aspect ? `No ${aspect.toLowerCase()} issues found` : 'No validation issues found'}
      </p>
      <p className="text-sm text-gray-500">
        This resource passes all validation checks
      </p>
    </div>
  );
}

export function NoResourceSelected() {
  return (
    <div className="p-6 h-full flex items-center justify-center" role="status">
      <div className="text-center max-w-md">
        <FileQuestion className="h-20 w-20 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          No Resource Selected
        </h3>
        <p className="text-gray-500 mb-6">
          Select a resource from the browser to view its details and validation results
        </p>
        <Link href="/resources">
          <Button variant="default">
            Browse Resources
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Indicator (for inline use)
// ============================================================================

export function ValidationLoadingIndicator({ aspect }: { aspect?: string }) {
  return (
    <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">
          {aspect ? `Loading ${aspect} validation...` : 'Loading validation results...'}
        </span>
      </div>
    </div>
  );
}
