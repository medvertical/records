import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Zap, CheckCircle, XCircle, AlertTriangle, Activity } from 'lucide-react';
import { ValidationProgressBar } from './ProgressBar';
import { ValidationStatusBadge, ValidationStatus } from './ValidationStatusBadge';
import { cn } from '@/lib/utils';

interface ValidationProgressDisplayProps {
  progress: {
    totalResources: number;
    processedResources: number;
    validResources: number;
    errorResources: number;
    currentResourceType?: string;
    processingRate?: string;
    estimatedTimeRemaining?: string;
    startTime?: Date;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  } | null;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * ValidationProgressDisplay Component - Comprehensive progress display for validation operations
 */
export const ValidationProgressDisplay: React.FC<ValidationProgressDisplayProps> = ({
  progress,
  className,
  showDetails = true,
  compact = false,
}) => {
  if (!progress) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            No validation in progress
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    totalResources,
    processedResources,
    validResources,
    errorResources,
    currentResourceType,
    processingRate,
    estimatedTimeRemaining,
    startTime,
    status,
  } = progress;

  const progressPercentage = totalResources > 0 ? Math.round((processedResources / totalResources) * 100) : 0;
  const successRate = processedResources > 0 ? Math.round((validResources / processedResources) * 100) : 0;
  const errorRate = processedResources > 0 ? Math.round((errorResources / processedResources) * 100) : 0;

  // Map validation status to ValidationStatus type
  const mapToValidationStatus = (status: string): ValidationStatus => {
    switch (status) {
      case 'running': return 'running';
      case 'paused': return 'paused';
      case 'completed': return 'completed';
      case 'error': return 'error';
      case 'stopped': return 'stopped';
      case 'idle': return 'idle';
      default: return 'idle';
    }
  };

  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Validation Progress</span>
          <ValidationStatusBadge
            status={mapToValidationStatus(status)}
            size="sm"
            animated={true}
            showIcon={true}
            showText={true}
          />
        </div>
        
        <Progress value={progressPercentage} className="h-2" />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{processedResources.toLocaleString()} / {totalResources.toLocaleString()}</span>
          <span>{progressPercentage}%</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Validation Progress</span>
          <ValidationStatusBadge
            status={mapToValidationStatus(status)}
            size="md"
            animated={true}
            showIcon={true}
            showText={true}
          />
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Progress Bar */}
        <ValidationProgressBar
          processed={processedResources}
          total={totalResources}
          animated={status === 'running'}
          showDetails={true}
        />

        {/* Detailed Metrics */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valid Resources</span>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="font-medium text-green-600">{validResources.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Error Resources</span>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span className="font-medium text-red-600">{errorResources.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-medium">{successRate}%</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Error Rate</span>
                <span className="font-medium">{errorRate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Current Activity */}
        {currentResourceType && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Currently processing:</span>
              <span className="font-medium">{currentResourceType}</span>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 gap-3">
          {processingRate && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">Processing Rate</span>
              </div>
              <span className="font-medium">{processingRate} resources/sec</span>
            </div>
          )}
          
          {estimatedTimeRemaining && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Estimated Time Remaining</span>
              </div>
              <span className="font-medium">{estimatedTimeRemaining}</span>
            </div>
          )}
          
          {startTime && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-muted-foreground">Started</span>
              </div>
              <span className="font-medium">{startTime.toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Progress Breakdown */}
        {showDetails && processedResources > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Progress Breakdown</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Valid</span>
                <span>{validResources} ({successRate}%)</span>
              </div>
              <Progress value={successRate} className="h-1" />
              
              <div className="flex justify-between text-xs">
                <span>Errors</span>
                <span>{errorResources} ({errorRate}%)</span>
              </div>
              <Progress value={errorRate} className="h-1" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationProgressDisplay;
