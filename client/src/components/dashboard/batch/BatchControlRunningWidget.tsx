import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pause, Play, StopCircle, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useDashboardBatchState } from '@/hooks/use-dashboard-batch-state';
import { formatDuration, intervalToDuration } from 'date-fns';

export function BatchControlRunningWidget() {
  const { progress, pauseBatch, resumeBatch, stopBatch, isPausing, isResuming, isStopping } = useDashboardBatchState();
  const [showLog, setShowLog] = useState(false);

  if (!progress) return null;

  const percentage = progress.totalResources > 0
    ? Math.round((progress.processedResources / progress.totalResources) * 100)
    : 0;

  const estimatedRemaining = progress.estimatedTimeRemaining
    ? formatDuration(intervalToDuration({ start: 0, end: progress.estimatedTimeRemaining }), {
        format: ['hours', 'minutes', 'seconds'],
      })
    : 'Calculating...';

  const resourcesPerMinute = progress.processingRate || 0;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">Batch Validation in Progress</h2>
              <Badge variant={progress.isPaused ? 'secondary' : 'default'} className="text-sm">
                {progress.isPaused ? 'Paused' : 'Running'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Job ID: {progress.jobId}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {progress.processedResources.toLocaleString()} / {progress.totalResources.toLocaleString()} resources
            </span>
            {progress.currentResourceType && (
              <span className="text-xs">
                Current: {progress.currentResourceType}
              </span>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Valid</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {(progress.processedResources - progress.errors).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {progress.errors.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-xs text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {progress.warnings.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground">Processing Rate</p>
            <p className="text-lg font-semibold">
              {resourcesPerMinute.toFixed(1)} resources/min
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimated Time Remaining</p>
            <p className="text-lg font-semibold">{estimatedRemaining}</p>
          </div>
        </div>

        {/* Resource Type Progress */}
        {progress.resourceTypeProgress && Object.keys(progress.resourceTypeProgress).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Progress by Resource Type</h3>
            <div className="space-y-2">
              {Object.entries(progress.resourceTypeProgress).map(([type, stats]) => {
                const typePercentage = stats.total > 0
                  ? Math.round((stats.processed / stats.total) * 100)
                  : 0;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{type}</span>
                      <span className="text-muted-foreground">
                        {stats.processed}/{stats.total}
                      </span>
                    </div>
                    <Progress value={typePercentage} className="h-2" />
                    {(stats.errors > 0 || stats.warnings > 0) && (
                      <div className="flex gap-3 text-xs">
                        {stats.errors > 0 && (
                          <span className="text-red-600">{stats.errors} errors</span>
                        )}
                        {stats.warnings > 0 && (
                          <span className="text-yellow-600">{stats.warnings} warnings</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3">
          {progress.isPaused ? (
            <Button
              onClick={resumeBatch}
              disabled={isResuming}
              className="flex-1"
              variant="default"
            >
              <Play className="mr-2 h-4 w-4" />
              {isResuming ? 'Resuming...' : 'Resume'}
            </Button>
          ) : (
            <Button
              onClick={pauseBatch}
              disabled={isPausing}
              className="flex-1"
              variant="secondary"
            >
              <Pause className="mr-2 h-4 w-4" />
              {isPausing ? 'Pausing...' : 'Pause'}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={isStopping}
                className="flex-1"
                variant="destructive"
              >
                <StopCircle className="mr-2 h-4 w-4" />
                {isStopping ? 'Stopping...' : 'Stop'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop Batch Validation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will stop the current batch validation process. Progress will be saved, but you'll need to start a new batch to continue validating resources.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={stopBatch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Stop Validation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Live Log (Collapsible) */}
        <div className="space-y-2 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLog(!showLog)}
            className="w-full justify-between"
          >
            <span>Live Activity Log</span>
            {showLog ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {showLog && (
            <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-1 text-xs font-mono">
              <div className="text-muted-foreground">
                Processing {progress.currentResourceType || 'resources'}...
              </div>
              <div className="text-muted-foreground">
                {progress.processedResources} of {progress.totalResources} resources validated
              </div>
              <div className="text-muted-foreground">
                Running at {resourcesPerMinute.toFixed(1)} resources/minute
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

