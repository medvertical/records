import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';
import { useValidationPolling, type ResourceProgress, type PollingResponse } from '@/hooks/useValidationPolling';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ValidationProgressTrackerProps {
  resourceIds: string[];
  onComplete?: (results: ResourceProgress[]) => void;
  onError?: (error: Error) => void;
  autoStart?: boolean;
  showDetails?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationProgressTracker({
  resourceIds,
  onComplete,
  onError,
  autoStart = false,
  showDetails = true,
  className = ''
}: ValidationProgressTrackerProps) {
  
  const [isStarted, setIsStarted] = useState(false);
  
  const {
    session,
    isPolling,
    isActive,
    progress,
    summary,
    updates,
    metadata,
    error,
    startPolling,
    stopPolling,
    refresh,
    lastPollTime,
    pollCount
  } = useValidationPolling({
    autoStart,
    onProgressUpdate: (response: PollingResponse) => {
      console.log('[ValidationProgressTracker] Progress update:', response);
    },
    onSessionEnd: (session) => {
      console.log('[ValidationProgressTracker] Session ended:', session);
      setIsStarted(false);
      if (onComplete) {
        onComplete(progress);
      }
    },
    onError: (error: Error) => {
      console.error('[ValidationProgressTracker] Error:', error);
      setIsStarted(false);
      if (onError) {
        onError(error);
      }
    }
  });

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !isStarted && resourceIds.length > 0) {
      handleStart();
    }
  }, [autoStart, isStarted, resourceIds]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleStart = async () => {
    if (resourceIds.length === 0) {
      console.warn('[ValidationProgressTracker] No resource IDs provided');
      return;
    }

    try {
      setIsStarted(true);
      await startPolling(resourceIds);
    } catch (error) {
      console.error('[ValidationProgressTracker] Failed to start polling:', error);
      setIsStarted(false);
    }
  };

  const handleStop = async () => {
    try {
      await stopPolling();
      setIsStarted(false);
    } catch (error) {
      console.error('[ValidationProgressTracker] Failed to stop polling:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await refresh();
    } catch (error) {
      console.error('[ValidationProgressTracker] Failed to refresh:', error);
    }
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getStatusIcon = (status: ResourceProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'validating':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
      case 'initializing':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-400" />;
      case 'retrying':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ResourceProgress['status']) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      validating: 'secondary',
      pending: 'outline',
      initializing: 'outline',
      cancelled: 'outline',
      retrying: 'secondary'
    } as const;

    const colors = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      validating: 'bg-blue-100 text-blue-800',
      pending: 'bg-gray-100 text-gray-800',
      initializing: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-gray-100 text-gray-800',
      retrying: 'bg-yellow-100 text-yellow-800'
    };

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const formatEstimatedTime = (ms?: number) => {
    if (!ms) return 'Unknown';
    return formatTime(ms);
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Validation Progress
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {!isStarted ? (
                <Button onClick={handleStart} disabled={resourceIds.length === 0}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Validation
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleRefresh} disabled={!isPolling}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" onClick={handleStop}>
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="ml-2"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Session Info */}
          {session && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Session ID:</span>
                <p className="text-gray-900 font-mono text-xs">{session.sessionId}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Resources:</span>
                <p className="text-gray-900">{session.resourceIds.length}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Poll Interval:</span>
                <p className="text-gray-900">{session.pollInterval}ms</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Poll Count:</span>
                <p className="text-gray-900">{pollCount}</p>
              </div>
            </div>
          )}

          {/* Overall Progress */}
          {summary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Overall Progress</span>
                <span className="text-sm text-gray-600">
                  {summary.completedResources + summary.failedResources} / {summary.totalResources} completed
                </span>
              </div>
              <Progress value={summary.averageProgress} className="h-2" />
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{summary.averageProgress.toFixed(1)}% complete</span>
                {metadata?.estimatedTimeRemaining && (
                  <span>~{formatEstimatedTime(metadata.estimatedTimeRemaining)} remaining</span>
                )}
              </div>
            </div>
          )}

          {/* Status Summary */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.activeResources}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.completedResources}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.failedResources}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{summary.totalResources}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          )}

          {/* Updates */}
          {updates && (updates.newResources.length > 0 || updates.completedResources.length > 0 || updates.failedResources.length > 0) && (
            <div className="space-y-2">
              <span className="font-medium text-gray-600">Recent Updates:</span>
              <div className="flex flex-wrap gap-2">
                {updates.newResources.map(resourceId => (
                  <Badge key={resourceId} variant="outline" className="text-blue-600">
                    New: {resourceId}
                  </Badge>
                ))}
                {updates.completedResources.map(resourceId => (
                  <Badge key={resourceId} variant="default" className="bg-green-100 text-green-800">
                    Completed: {resourceId}
                  </Badge>
                ))}
                {updates.failedResources.map(resourceId => (
                  <Badge key={resourceId} variant="destructive">
                    Failed: {resourceId}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Last Poll Time */}
          {lastPollTime && (
            <div className="text-sm text-gray-500">
              Last updated: {lastPollTime.toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Resource Progress */}
      {showDetails && progress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Individual Resource Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {progress.map((resource) => (
                <div key={resource.resourceId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(resource.status)}
                      <span className="font-medium">{resource.resourceId}</span>
                      <Badge variant="outline" className="text-xs">
                        {resource.resourceType}
                      </Badge>
                    </div>
                    {getStatusBadge(resource.status)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm text-gray-900">{resource.progress}%</span>
                    </div>
                    <Progress value={resource.progress} className="h-1" />
                    
                    {resource.currentAspect && (
                      <div className="text-sm text-gray-600">
                        Current aspect: <span className="font-medium">{resource.currentAspect}</span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Errors:</span>
                        <span className="ml-1 font-medium text-red-600">{resource.errorCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Warnings:</span>
                        <span className="ml-1 font-medium text-yellow-600">{resource.warningCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Info:</span>
                        <span className="ml-1 font-medium text-blue-600">{resource.infoCount}</span>
                      </div>
                    </div>
                    
                    {resource.estimatedTimeRemaining && (
                      <div className="text-sm text-gray-600">
                        Estimated time remaining: {formatEstimatedTime(resource.estimatedTimeRemaining)}
                      </div>
                    )}
                    
                    {resource.lastError && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        <span className="font-medium">Error:</span> {resource.lastError}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
