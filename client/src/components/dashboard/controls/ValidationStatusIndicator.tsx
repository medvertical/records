import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ValidationStatusBadge, ValidationStatus, ValidationStatusIndicator as StatusIndicator } from './ValidationStatusBadge';
import { Progress } from '@/components/ui/progress';
import { Clock, Zap, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValidationStatusIndicatorProps {
  status: ValidationStatus;
  progress?: number;
  totalResources?: number;
  processedResources?: number;
  validResources?: number;
  errorResources?: number;
  processingRate?: string;
  estimatedTimeRemaining?: string;
  currentResourceType?: string;
  showProgress?: boolean;
  showMetrics?: boolean;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'card' | 'inline' | 'compact';
  className?: string;
}

/**
 * ValidationStatusIndicator Component - Comprehensive status display with metrics
 */
export const ValidationStatusIndicator: React.FC<ValidationStatusIndicatorProps> = ({
  status,
  progress = 0,
  totalResources = 0,
  processedResources = 0,
  validResources = 0,
  errorResources = 0,
  processingRate,
  estimatedTimeRemaining,
  currentResourceType,
  showProgress = true,
  showMetrics = true,
  showDetails = true,
  size = 'md',
  variant = 'card',
  className,
}) => {
  const progressPercentage = totalResources > 0 ? Math.round((processedResources / totalResources) * 100) : 0;
  const successRate = processedResources > 0 ? Math.round((validResources / processedResources) * 100) : 0;
  const errorRate = processedResources > 0 ? Math.round((errorResources / processedResources) * 100) : 0;

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <ValidationStatusBadge
          status={status}
          size={size}
          animated={true}
          showIcon={true}
          showText={true}
        />
        {showProgress && progressPercentage > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{progressPercentage}%</span>
          </div>
        )}
      </div>
    );
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <ValidationStatusBadge
          status={status}
          size={size}
          animated={true}
          showIcon={true}
          showText={true}
        />
        
        {showProgress && progressPercentage > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={progressPercentage} className="w-20 h-2" />
            <span className="text-sm text-gray-600">{progressPercentage}%</span>
          </div>
        )}
        
        {showMetrics && processedResources > 0 && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>{validResources}</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>{errorResources}</span>
            </div>
          </div>
        )}
        
        {processingRate && (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Zap className="h-3 w-3" />
            <span>{processingRate}</span>
          </div>
        )}
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <ValidationStatusBadge
              status={status}
              size={size}
              animated={true}
              showIcon={true}
              showText={true}
            />
            
            {showProgress && progressPercentage > 0 && (
              <span className="text-sm font-medium text-gray-600">
                {progressPercentage}% Complete
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {showProgress && progressPercentage > 0 && (
            <Progress value={progressPercentage} className="h-2" />
          )}

          {/* Metrics Grid */}
          {showMetrics && processedResources > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Processed</span>
                <span className="font-medium">{processedResources.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <span className="font-medium">{totalResources.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Valid</span>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="font-medium text-green-600">{validResources.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Errors</span>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span className="font-medium text-red-600">{errorResources.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Success/Error Rates */}
          {showMetrics && processedResources > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Success Rate</span>
                <span>{successRate}%</span>
              </div>
              <Progress value={successRate} className="h-1" />
              
              <div className="flex justify-between text-xs">
                <span>Error Rate</span>
                <span>{errorRate}%</span>
              </div>
              <Progress value={errorRate} className="h-1" />
            </div>
          )}

          {/* Current Activity */}
          {showDetails && currentResourceType && (
            <div className="p-2 bg-blue-50 rounded-md">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-blue-500" />
                <span className="text-gray-600">Currently processing:</span>
                <span className="font-medium">{currentResourceType}</span>
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {showDetails && (processingRate || estimatedTimeRemaining) && (
            <div className="space-y-2">
              {processingRate && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-gray-600">Processing Rate</span>
                  </div>
                  <span className="font-medium">{processingRate}</span>
                </div>
              )}
              
              {estimatedTimeRemaining && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-gray-600">ETA</span>
                  </div>
                  <span className="font-medium">{estimatedTimeRemaining}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * SimpleValidationStatus Component - Minimal status display
 */
interface SimpleValidationStatusProps {
  status: ValidationStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SimpleValidationStatus: React.FC<SimpleValidationStatusProps> = ({
  status,
  size = 'md',
  className,
}) => {
  return (
    <ValidationStatusBadge
      status={status}
      size={size}
      animated={true}
      showIcon={true}
      showText={true}
      className={className}
    />
  );
};

export default ValidationStatusIndicator;

