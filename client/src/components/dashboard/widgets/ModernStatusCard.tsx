import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Clock, 
  Zap,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { ValidationStatus } from '@/shared/types/dashboard-new';

interface ModernStatusCardProps {
  status?: ValidationStatus;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export const ModernStatusCard: React.FC<ModernStatusCardProps> = ({
  status,
  isLoading = false,
  error = null,
  className,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayCircle className="h-5 w-5 text-green-600" />;
      case 'paused':
        return <PauseCircle className="h-5 w-5 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'idle':
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'paused':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'idle':
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
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

  const formatProcessingRate = (rate: number) => {
    if (rate >= 1000) {
      return `${(rate / 1000).toFixed(1)}K/min`;
    }
    return `${Math.round(rate)}/min`;
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <span>Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-6 bg-muted rounded animate-pulse" />
            <div className="h-2 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <span>Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load status
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <span>Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No status available
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentStatus = status.status || 'idle';
  const progress = status.progress || 0;
  const processingRate = status.processingRate || 0;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <span>Validation Engine</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          {getStatusIcon(currentStatus)}
          <Badge variant={getStatusBadgeVariant(currentStatus)} className="capitalize">
            {currentStatus}
          </Badge>
        </div>

        {/* Progress Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Progress
            </span>
            <span className="text-sm font-bold text-foreground">
              {progress.toFixed(1)}%
            </span>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          {status.totalResources && status.processedResources && (
            <div className="text-xs text-muted-foreground">
              {status.processedResources.toLocaleString()} / {status.totalResources.toLocaleString()} Resources
            </div>
          )}
        </div>

        {/* Processing Rate */}
        {processingRate > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Processing Rate
              </span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {formatProcessingRate(processingRate)}
            </span>
          </div>
        )}

        {/* Current Activity */}
        {currentStatus === 'running' && status.currentResourceType && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center space-x-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Currently Processing</span>
            </div>
            <div className="text-sm text-foreground">
              {status.currentResourceType === 'Unknown' ? 'FHIR Resources' : `${status.currentResourceType} Resources`}
            </div>
            {status.nextResourceType && status.nextResourceType !== 'Unknown' && (
              <div className="text-xs text-muted-foreground mt-1">
                Next: {status.nextResourceType}
              </div>
            )}
          </div>
        )}

        {/* Time Estimates */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {status.estimatedTimeRemaining && (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">ETA</div>
                <div className="font-medium">{formatTime(status.estimatedTimeRemaining)}</div>
              </div>
            </div>
          )}
          
          {status.validResources !== undefined && status.errorResources !== undefined && (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Results</div>
                <div className="font-medium">
                  {status.validResources} valid, {status.errorResources} errors
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
