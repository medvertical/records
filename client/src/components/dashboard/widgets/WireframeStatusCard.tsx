import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Zap } from 'lucide-react';

interface WireframeStatusCardProps {
  status?: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress?: number;
  currentResourceType?: string;
  processingRate?: number;
  estimatedTimeRemaining?: number;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Wireframe Status Card Component - Based on dashboard wireframes specification
 * Shows validation engine status with progress and current activity
 */
export const WireframeStatusCard: React.FC<WireframeStatusCardProps> = ({
  status = 'idle',
  progress = 0,
  currentResourceType = 'Unknown',
  processingRate = 0,
  estimatedTimeRemaining,
  isLoading = false,
  error = null,
  className,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-600 bg-green-100';
      case 'paused':
        return 'text-yellow-600 bg-yellow-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-green-600" />;
      case 'paused':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'completed':
        return <Zap className="h-4 w-4 text-blue-600" />;
      case 'error':
        return <Activity className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-green-600" />
            <span className="text-lg font-semibold">STATUS</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
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
            <Zap className="h-5 w-5 text-green-600" />
            <span className="text-lg font-semibold">STATUS</span>
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

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5 text-green-600" />
          <span className="text-lg font-semibold">⚡ STATUS</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Validation Status */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {getStatusIcon(status)}
            <Badge className={getStatusColor(status)}>
              {getStatusText(status)}
            </Badge>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="text-sm text-gray-600">Progress: {progress.toFixed(1)}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Activity */}
        {status === 'running' && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Currently Processing:</div>
            <div className="text-sm font-medium text-gray-800">
{currentResourceType === 'Unknown' ? 'FHIR Resources' : `${currentResourceType} Resources`}
            </div>
          </div>
        )}

        {/* Processing Rate */}
        {processingRate > 0 && (
          <div className="space-y-1">
            <div className="text-sm text-gray-600">Rate: {processingRate.toLocaleString()}/min</div>
          </div>
        )}

        {/* ETA */}
        {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
          <div className="space-y-1">
            <div className="text-sm text-gray-600">ETA: {estimatedTimeRemaining} min</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
