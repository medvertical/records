import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  BarChart3,
  Activity,
  Clock
} from 'lucide-react';

interface WireframeValidationControlPanelProps {
  status?: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress?: number;
  totalResources?: number;
  processedResources?: number;
  currentResourceType?: string;
  nextResourceType?: string;
  processingRate?: number;
  estimatedTimeRemaining?: number;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onSettings?: () => void;
  onViewDetails?: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Wireframe Validation Control Panel - Based on dashboard wireframes specification
 * Full-width control panel with detailed progress and validation controls
 */
export const WireframeValidationControlPanel: React.FC<WireframeValidationControlPanelProps> = ({
  status = 'idle',
  progress = 0,
  totalResources = 0,
  processedResources = 0,
  currentResourceType = 'Unknown',
  nextResourceType,
  processingRate = 0,
  estimatedTimeRemaining,
  onStart,
  onPause,
  onResume,
  onStop,
  onSettings,
  onViewDetails,
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <span className="text-lg font-semibold">VALIDATION ENGINE</span>
            </div>
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
            <Activity className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">VALIDATION ENGINE</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load validation status
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">VALIDATION ENGINE</span>
          </CardTitle>
          {onSettings && (
            <Button variant="ghost" size="sm" onClick={onSettings} className="p-1">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status and Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${status === 'running' ? 'bg-green-600 animate-pulse' : status === 'paused' ? 'bg-yellow-600' : status === 'error' ? 'bg-red-600' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium">Status:</span>
              <Badge className={getStatusColor(status)}>
                {getStatusText(status)}
              </Badge>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center space-x-2">
            {status === 'idle' && onStart && (
              <Button size="sm" onClick={onStart} className="flex items-center space-x-1">
                <Play className="h-4 w-4" />
                <span>Start</span>
              </Button>
            )}
            {status === 'running' && onPause && (
              <Button size="sm" variant="outline" onClick={onPause} className="flex items-center space-x-1">
                <Pause className="h-4 w-4" />
                <span>Pause</span>
              </Button>
            )}
            {status === 'paused' && onResume && (
              <Button size="sm" onClick={onResume} className="flex items-center space-x-1">
                <Play className="h-4 w-4" />
                <span>Resume</span>
              </Button>
            )}
            {(status === 'running' || status === 'paused') && onStop && (
              <Button size="sm" variant="destructive" onClick={onStop} className="flex items-center space-x-1">
                <Square className="h-4 w-4" />
                <span>Stop</span>
              </Button>
            )}
            {onViewDetails && (
              <Button size="sm" variant="outline" onClick={onViewDetails} className="flex items-center space-x-1">
                <BarChart3 className="h-4 w-4" />
                <span>View Details</span>
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress: {progress.toFixed(1)}% Complete</span>
            <span>{formatNumber(processedResources)} / {formatNumber(totalResources)} Resources</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Activity */}
        {status === 'running' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Currently Processing:</div>
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <span>{currentResourceType === 'Unknown' ? 'FHIR Resources' : `${currentResourceType} Resources`}</span>
              {nextResourceType && nextResourceType !== 'Unknown' && (
                <>
                  <span>•</span>
                  <span>Next: {nextResourceType}</span>
                </>
              )}
              {processingRate > 0 && (
                <>
                  <span>•</span>
                  <span>Rate: {formatNumber(processingRate)}/min</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Time Information */}
        {(estimatedTimeRemaining && estimatedTimeRemaining > 0) && (
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>ETA: {estimatedTimeRemaining} min</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
