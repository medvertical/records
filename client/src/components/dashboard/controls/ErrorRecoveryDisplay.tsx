import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  SkipForward, 
  RotateCcw,
  Clock,
  Activity,
  Info
} from 'lucide-react';
import { 
  PartialFailure, 
  RecoveryOption, 
  RecoveryResult,
  RecoveryUtils 
} from '@/lib/error-recovery-mechanisms';
import { cn } from '@/lib/utils';

interface ErrorRecoveryDisplayProps {
  failures: PartialFailure[];
  onRecoveryOptionSelected: (failure: PartialFailure, optionId: string) => Promise<RecoveryResult>;
  onDismissFailure: (failureId: string) => void;
  className?: string;
  showDetails?: boolean;
  maxDisplayItems?: number;
}

export const ErrorRecoveryDisplay: React.FC<ErrorRecoveryDisplayProps> = ({
  failures,
  onRecoveryOptionSelected,
  onDismissFailure,
  className,
  showDetails = true,
  maxDisplayItems = 5,
}) => {
  const [recoveringFailures, setRecoveringFailures] = useState<Set<string>>(new Set());
  const [recoveryResults, setRecoveryResults] = useState<Map<string, RecoveryResult>>(new Map());

  const handleRecoveryOption = async (failure: PartialFailure, optionId: string) => {
    setRecoveringFailures(prev => new Set(prev).add(failure.id));
    
    try {
      const result = await onRecoveryOptionSelected(failure, optionId);
      setRecoveryResults(prev => new Map(prev).set(failure.id, result));
      
      // Show toast notification
      RecoveryUtils.createRecoveryToast(failure, result);
    } catch (error) {
      console.error('[ErrorRecoveryDisplay] Recovery failed:', error);
    } finally {
      setRecoveringFailures(prev => {
        const newSet = new Set(prev);
        newSet.delete(failure.id);
        return newSet;
      });
    }
  };

  const getFailureIcon = (failureType: PartialFailure['failureType']) => {
    switch (failureType) {
      case 'network': return <Activity className="h-4 w-4" />;
      case 'service': return <XCircle className="h-4 w-4" />;
      case 'validation': return <AlertTriangle className="h-4 w-4" />;
      case 'timeout': return <Clock className="h-4 w-4" />;
      case 'data': return <Info className="h-4 w-4" />;
      case 'system': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getFailureColor = (severity: PartialFailure['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRecoveryOptionIcon = (type: RecoveryOption['type']) => {
    switch (type) {
      case 'retry': return <RefreshCw className="h-4 w-4" />;
      case 'skip': return <SkipForward className="h-4 w-4" />;
      case 'fallback': return <RotateCcw className="h-4 w-4" />;
      case 'checkpoint': return <RotateCcw className="h-4 w-4" />;
      case 'manual': return <Info className="h-4 w-4" />;
      default: return <RefreshCw className="h-4 w-4" />;
    }
  };

  if (failures.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mr-2" />
            <span>No partial failures to recover</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayFailures = failures.slice(0, maxDisplayItems);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Partial Failures Recovery
          </span>
          <Badge variant="outline" className="text-sm">
            {failures.length} failure{failures.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayFailures.map((failure) => {
          const isRecovering = recoveringFailures.has(failure.id);
          const recoveryResult = recoveryResults.get(failure.id);
          const progressPercentage = (failure.completedItems.length / failure.affectedItems.length) * 100;

          return (
            <div
              key={failure.id}
              className={cn(
                'p-4 rounded-lg border',
                getFailureColor(failure.severity)
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getFailureIcon(failure.failureType)}
                  <div>
                    <h4 className="font-medium capitalize">
                      {failure.failureType} Failure
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {failure.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={failure.severity === 'critical' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {failure.severity}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismissFailure(failure.id)}
                    className="text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>

              {/* Progress Information */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{progressPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{failure.completedItems.length} completed</span>
                  <span>{failure.failedItems.length} failed</span>
                </div>
              </div>

              {/* Error Message */}
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  {failure.error.message}
                </p>
              </div>

              {/* Recovery Result */}
              {recoveryResult && (
                <div className={cn(
                  'mb-3 p-3 rounded-md',
                  recoveryResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {recoveryResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={cn(
                      'font-medium text-sm',
                      recoveryResult.success ? 'text-green-800' : 'text-red-800'
                    )}>
                      {recoveryResult.success ? 'Recovery Successful' : 'Recovery Failed'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Recovered: {recoveryResult.recoveredItems.length} items</div>
                    <div>Failed: {recoveryResult.failedItems.length} items</div>
                    <div>Skipped: {recoveryResult.skippedItems.length} items</div>
                    <div>Duration: {RecoveryUtils.formatRecoveryTime(recoveryResult.duration)}</div>
                    {recoveryResult.error && (
                      <div className="text-red-600">
                        Error: {recoveryResult.error.message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recovery Options */}
              {!recoveryResult && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Recovery Options:</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {failure.recoveryOptions.map((option) => (
                      <Button
                        key={option.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecoveryOption(failure, option.id)}
                        disabled={isRecovering}
                        className="justify-start text-left h-auto p-3"
                      >
                        <div className="flex items-center gap-2 w-full">
                          {getRecoveryOptionIcon(option.type)}
                          <div className="flex-1">
                            <div className="font-medium text-xs">{option.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {option.description}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                'text-xs',
                                RecoveryUtils.getRecoveryPriorityColor(option.priority)
                              )}>
                                {option.priority}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {RecoveryUtils.formatRecoveryTime(option.estimatedTime)}
                              </span>
                              <span className={cn(
                                'text-xs',
                                RecoveryUtils.getRecoverySuccessRateColor(option.successRate)
                              )}>
                                {option.successRate}% success
                              </span>
                            </div>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recovery Status */}
              {isRecovering && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                  <span className="text-sm text-blue-800">
                    Attempting recovery...
                  </span>
                </div>
              )}

              {/* Additional Details */}
              {showDetails && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">
                      Additional Details
                    </summary>
                    <div className="mt-2 space-y-1">
                      <div>Operation ID: {failure.operationId}</div>
                      <div>Failure ID: {failure.id}</div>
                      <div>Affected Items: {failure.affectedItems.length}</div>
                      <div>Completed Items: {failure.completedItems.length}</div>
                      <div>Failed Items: {failure.failedItems.length}</div>
                      {failure.context.component && (
                        <div>Component: {failure.context.component}</div>
                      )}
                      {failure.context.operation && (
                        <div>Operation: {failure.context.operation}</div>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          );
        })}

        {/* Show More Button */}
        {failures.length > maxDisplayItems && (
          <div className="text-center pt-4 border-t border-gray-200">
            <Button variant="ghost" size="sm">
              Show {failures.length - maxDisplayItems} more failures
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ErrorRecoveryDisplay;

