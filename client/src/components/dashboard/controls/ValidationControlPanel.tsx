import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Settings,
  Clock,
  Activity,
  ChevronRight
} from 'lucide-react';
import { ValidationStatus } from '@/shared/types/dashboard-new';
import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';
import { getTouchButtonClasses, getMobileButtonSize, getMobileTextSize } from '@/lib/touch-utils';
import { dashboardNavigation, ariaUtils } from '@/lib/keyboard-navigation';

/**
 * ValidationControlPanel Component - Single responsibility: Main validation engine control interface
 * Follows global rules: Under 400 lines, single responsibility, uses existing UI components
 */
interface ValidationControlPanelProps {
  status?: ValidationStatus;
  loading?: boolean;
  error?: string | null;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onRevalidateAll?: () => void;
  onSettings?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export const ValidationControlPanel: React.FC<ValidationControlPanelProps> = ({
  status,
  loading = false,
  error = null,
  onStart,
  onPause,
  onResume,
  onStop,
  onRevalidateAll,
  onSettings,
  onRefresh,
  className = '',
}) => {
  // Get status information with defaults
  const currentStatus = status?.status || 'idle';
  const progress = status?.progress || 0;
  const currentResourceType = status?.currentResourceType || 'Unknown';
  const nextResourceType = status?.nextResourceType || 'Unknown';
  const processingRate = status?.processingRate || 0;
  const estimatedTimeRemaining = status?.estimatedTimeRemaining;

  // Calculate time information
  const getStatusIcon = () => {
    switch (currentStatus) {
      case 'running':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <Square className="h-4 w-4 text-blue-500" />;
      case 'error':
        return <Square className="h-4 w-4 text-red-500" />;
      default:
        return <Square className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'running':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (currentStatus) {
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

  const formatTimeRemaining = () => {
    if (!estimatedTimeRemaining) return 'Unknown';
    
    const duration = intervalToDuration({ start: 0, end: estimatedTimeRemaining * 1000 });
    return formatDuration(duration, { format: ['hours', 'minutes'] });
  };

  const formatProcessingRate = () => {
    if (processingRate === 0) return '0/min';
    return `${processingRate.toLocaleString()}/min`;
  };

  // Determine which buttons to show based on status
  const getActionButtons = () => {
    const buttons = [];

    switch (currentStatus) {
      case 'idle':
        buttons.push(
          <Button
            key="start"
            onClick={onStart}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start
          </Button>
        );
        break;

      case 'running':
        buttons.push(
          <Button
            key="pause"
            onClick={onPause}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>,
          <Button
            key="stop"
            onClick={onStop}
            disabled={loading}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        );
        break;

      case 'paused':
        buttons.push(
          <Button
            key="resume"
            onClick={onResume}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Resume
          </Button>,
          <Button
            key="stop"
            onClick={onStop}
            disabled={loading}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        );
        break;

      case 'completed':
      case 'error':
        buttons.push(
          <Button
            key="start"
            onClick={onStart}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start
          </Button>
        );
        break;
    }

    // Always show revalidate button when not running
    if (currentStatus !== 'running') {
      buttons.push(
        <Button
          key="revalidate"
          onClick={onRevalidateAll}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Revalidate All
        </Button>
      );
    }

    // Always show settings button
    buttons.push(
      <Button
        key="settings"
        onClick={onSettings}
        disabled={loading}
        variant="ghost"
        size="sm"
        className="flex items-center gap-2"
      >
        <Settings className="h-4 w-4" />
        Settings
      </Button>
    );

    return buttons;
  };

  if (error) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Settings className="h-5 w-5" />
            Validation Engine
          </CardTitle>
          <CardDescription>Error loading validation status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={onRefresh} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={className}
      tabIndex={0}
      onKeyDown={(e) => dashboardNavigation.validationControls(e as any)}
      role="region"
      aria-label="Validation Control Panel"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Validation Engine</CardTitle>
          </div>
          <Button
            onClick={onSettings}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Control and monitor FHIR validation progress
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <Badge variant={currentStatus === 'running' ? 'default' : 'secondary'}>
                {getStatusIcon()}
                <span className="ml-1">{getStatusText()}</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span className="font-medium">{progress.toFixed(1)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Current Activity Section */}
        {currentStatus === 'running' && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Currently Processing:</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>🗃️ {currentResourceType} Resources</span>
              {nextResourceType && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span>Next: {nextResourceType}</span>
                </>
              )}
              <span className="ml-auto">Rate: {formatProcessingRate()}</span>
            </div>
          </div>
        )}

        {/* Time Information */}
        {estimatedTimeRemaining && currentStatus === 'running' && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Remaining: {formatTimeRemaining()}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {getActionButtons()}
        </div>
      </CardContent>
    </Card>
  );
};

export default ValidationControlPanel;
