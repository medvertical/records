/**
 * Validation Settings Real-time Indicator
 * 
 * A component that shows the current real-time update status for validation settings
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useValidationSettingsRealTime } from '@/hooks/use-validation-settings-realtime';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Settings
} from 'lucide-react';

interface ValidationSettingsRealTimeIndicatorProps {
  /** Whether to show the mode switcher */
  showModeSwitcher?: boolean;
  
  /** Whether to show detailed status */
  showDetailedStatus?: boolean;
  
  /** Custom className */
  className?: string;
}

export function ValidationSettingsRealTimeIndicator({
  showModeSwitcher = false,
  showDetailedStatus = false,
  className = ''
}: ValidationSettingsRealTimeIndicatorProps) {
  const {
    currentMode,
    isActive,
    lastUpdate,
    lastChange,
    hasError,
    error,
    sseState,
    pollingState,
    refresh,
    switchMode,
    resetError,
    effectiveMode
  } = useValidationSettingsRealTime({
    mode: 'auto',
    showNotifications: false, // Don't show toast notifications in this component
    invalidateCache: true
  });

  const getStatusIcon = () => {
    if (hasError) {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    }
    
    if (isActive) {
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    }
    
    return <WifiOff className="h-3 w-3 text-gray-400" />;
  };

  const getStatusText = () => {
    if (hasError) {
      return 'Error';
    }
    
    if (isActive) {
      return currentMode === 'sse' ? 'SSE Connected' : 'Polling Active';
    }
    
    return 'Inactive';
  };

  const getStatusColor = () => {
    if (hasError) {
      return 'bg-red-50 text-red-600 border-red-200';
    }
    
    if (isActive) {
      return 'bg-green-50 text-green-600 border-green-200';
    }
    
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${getStatusColor()} hover:${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="ml-1">{getStatusText()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Real-time Settings Updates</p>
            <p className="text-sm">Mode: {effectiveMode.toUpperCase()}</p>
            {lastUpdate && (
              <p className="text-xs text-gray-500">
                Last update: {formatTimeAgo(lastUpdate)}
              </p>
            )}
            {lastChange && (
              <p className="text-xs text-gray-500">
                Last change: {formatTimeAgo(lastChange)}
              </p>
            )}
            {hasError && error && (
              <p className="text-xs text-red-500">
                Error: {error}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Detailed Status (if enabled) */}
      {showDetailedStatus && (
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          {currentMode === 'sse' && (
            <div className="flex items-center space-x-1">
              <Wifi className="h-3 w-3" />
              <span>{sseState.isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          )}
          {currentMode === 'polling' && (
            <div className="flex items-center space-x-1">
              <RefreshCw className="h-3 w-3" />
              <span>{pollingState.isPolling ? 'Active' : 'Inactive'}</span>
            </div>
          )}
        </div>
      )}

      {/* Mode Switcher (if enabled) */}
      {showModeSwitcher && (
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => switchMode(currentMode === 'sse' ? 'polling' : 'sse')}
            className="h-6 px-2 text-xs"
          >
            <Settings className="h-3 w-3 mr-1" />
            Switch to {currentMode === 'sse' ? 'Polling' : 'SSE'}
          </Button>
        </div>
      )}

      {/* Manual Refresh Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh settings</p>
        </TooltipContent>
      </Tooltip>

      {/* Error Reset Button (if there's an error) */}
      {hasError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetError}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              <AlertCircle className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reset error</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
