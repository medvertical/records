import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Widget, WidgetHeader, WidgetContent } from '../shared/Widget';
import { ValidationStatus } from '@/shared/types/dashboard-new';
import { 
  Play, 
  Pause, 
  Square, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Database,
  Activity
} from 'lucide-react';

/**
 * StatusCard Component - Single responsibility: Display validation engine status
 * Follows global rules: Separate from progress details, under 200 lines, uses existing UI components
 */
interface StatusCardProps {
  status?: ValidationStatus;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  lastUpdated?: Date;
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  status,
  loading = false,
  error,
  onRefresh,
  lastUpdated,
  className,
}) => {
  // Get status icon based on current status
  const getStatusIcon = (status: ValidationStatus['status']) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'idle':
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  // Get status color based on current status
  const getStatusColor = (status: ValidationStatus['status']) => {
    switch (status) {
      case 'running':
        return 'text-fhir-success';
      case 'paused':
        return 'text-fhir-warning';
      case 'completed':
        return 'text-fhir-success';
      case 'error':
        return 'text-fhir-error';
      case 'idle':
      default:
        return 'text-muted-foreground';
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: ValidationStatus['status']) => {
    switch (status) {
      case 'running':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      case 'idle':
      default:
        return 'outline';
    }
  };

  // Format time duration
  const formatDuration = (minutes?: number): string => {
    if (!minutes) return 'Unknown';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Format processing rate
  const formatRate = (rate: number): string => {
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/min`;
    return `${Math.round(rate)}/min`;
  };

  // Get status subtitle
  const getStatusSubtitle = (status: ValidationStatus['status']) => {
    switch (status) {
      case 'running':
        return 'Validation in progress';
      case 'paused':
        return 'Validation paused';
      case 'completed':
        return 'Validation completed';
      case 'error':
        return 'Validation error';
      case 'idle':
      default:
        return 'Ready to validate';
    }
  };

  return (
    <Widget
      id="status"
      title="Validation Status"
      subtitle={status ? getStatusSubtitle(status.status) : 'No status available'}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      className={className}
      actions={
        status && (
          <Badge 
            variant={getStatusBadgeVariant(status.status)}
            className={cn(
              'animate-pulse',
              status.status === 'running' && 'bg-fhir-success/10 text-fhir-success border-fhir-success/20'
            )}
          >
            {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
          </Badge>
        )
      }
    >
      <WidgetContent>
        {!status ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              No validation status available
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Indicator */}
            <div className="flex items-center justify-center space-x-3">
              <div className={cn('p-3 rounded-full bg-muted', getStatusColor(status.status))}>
                {getStatusIcon(status.status)}
              </div>
              <div className="text-center">
                <div className={cn('text-lg font-semibold', getStatusColor(status.status))}>
                  {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {getStatusSubtitle(status.status)}
                </div>
              </div>
            </div>

            {/* Progress Bar (only show if running) */}
            {status.status === 'running' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{status.progress.toFixed(1)}%</span>
                </div>
                <Progress value={status.progress} className="h-2" />
              </div>
            )}

            {/* Current Activity */}
            {status.currentResourceType && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Currently Processing</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {status.currentResourceType}
                  {status.nextResourceType && (
                    <span> • Next: {status.nextResourceType}</span>
                  )}
                </div>
              </div>
            )}

            {/* Processing Rate */}
            {status.processingRate > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Processing Rate</span>
                </div>
                <span className="text-sm font-medium text-fhir-success">
                  {formatRate(status.processingRate)}
                </span>
              </div>
            )}

            {/* Time Estimates */}
            {status.estimatedTimeRemaining && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">ETA</span>
                </div>
                <span className="text-sm font-medium">
                  {formatDuration(status.estimatedTimeRemaining)}
                </span>
              </div>
            )}

            {/* Status Summary */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className={cn(
                  "text-lg font-bold",
                  getStatusColor(status.status)
                )}>
                  {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Engine Status
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-fhir-blue">
                  {formatRate(status.processingRate)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Processing Rate
                </div>
              </div>
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground pt-2 border-t">
                <Clock className="h-3 w-3" />
                <span>Updated {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}
      </WidgetContent>
    </Widget>
  );
};

/**
 * Compact Status Component - Simplified version for smaller spaces
 */
interface CompactStatusProps {
  status?: ValidationStatus;
  loading?: boolean;
  className?: string;
}

export const CompactStatus: React.FC<CompactStatusProps> = ({
  status,
  loading = false,
  className,
}) => {
  const getStatusColor = (status: ValidationStatus['status']) => {
    switch (status) {
      case 'running':
        return 'text-fhir-success';
      case 'paused':
        return 'text-fhir-warning';
      case 'completed':
        return 'text-fhir-success';
      case 'error':
        return 'text-fhir-error';
      case 'idle':
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading || !status) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-4 bg-muted rounded animate-pulse"></div>
        <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Status:</span>
        <span className={cn('text-sm font-medium', getStatusColor(status.status))}>
          {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
        </span>
      </div>
      {status.currentResourceType && (
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Processing:</span>
          <span className="text-sm font-medium">{status.currentResourceType}</span>
        </div>
      )}
      {status.processingRate > 0 && (
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Rate:</span>
          <span className="text-sm font-medium">{Math.round(status.processingRate)}/min</span>
        </div>
      )}
    </div>
  );
};

export default StatusCard;
