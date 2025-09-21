/**
 * Validation Settings Polling Demo
 * 
 * A demonstration component showing how the polling system works
 * for real-time validation settings updates
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useValidationSettingsPolling } from '@/hooks/use-validation-settings-polling';
import { 
  RefreshCw, 
  Play, 
  Pause, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Settings
} from 'lucide-react';

export function ValidationSettingsPollingDemo() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(5000);
  
  const polling = useValidationSettingsPolling({
    pollingInterval,
    enabled: isEnabled,
    showNotifications: true,
    invalidateCache: true
  });

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

  const getStatusColor = () => {
    if (polling.hasError) {
      return 'bg-red-50 text-red-600 border-red-200';
    }
    
    if (polling.isPolling) {
      return 'bg-green-50 text-green-600 border-green-200';
    }
    
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const getStatusIcon = () => {
    if (polling.hasError) {
      return <AlertCircle className="h-3 w-3" />;
    }
    
    if (polling.isPolling) {
      return <CheckCircle className="h-3 w-3" />;
    }
    
    return <Clock className="h-3 w-3" />;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Validation Settings Polling Demo</span>
        </CardTitle>
        <CardDescription>
          Demonstration of real-time validation settings updates using polling
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Polling Status</h3>
            <Badge className={`${getStatusColor()} hover:${getStatusColor()}`}>
              {getStatusIcon()}
              <span className="ml-1">
                {polling.hasError ? 'Error' : polling.isPolling ? 'Active' : 'Inactive'}
              </span>
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Last Poll:</span>
              <span className="ml-2 font-mono">{formatTimeAgo(polling.lastPoll)}</span>
            </div>
            <div>
              <span className="text-gray-500">Last Change:</span>
              <span className="ml-2 font-mono">{formatTimeAgo(polling.lastChange)}</span>
            </div>
            <div>
              <span className="text-gray-500">Failed Polls:</span>
              <span className="ml-2 font-mono">{polling.failedPolls}</span>
            </div>
            <div>
              <span className="text-gray-500">Interval:</span>
              <span className="ml-2 font-mono">{pollingInterval}ms</span>
            </div>
          </div>
          
          {polling.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">Error: {polling.error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="enable-polling"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
            <Label htmlFor="enable-polling">Enable Polling</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="polling-interval">Polling Interval (ms):</Label>
            <input
              id="polling-interval"
              type="number"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              min="1000"
              max="60000"
              step="1000"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={polling.manualPoll}
            disabled={!isEnabled}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Manual Poll
          </Button>
          
          <Button
            onClick={polling.startPolling}
            disabled={!isEnabled || polling.isPolling}
            variant="outline"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Polling
          </Button>
          
          <Button
            onClick={polling.stopPolling}
            disabled={!polling.isPolling}
            variant="outline"
            size="sm"
          >
            <Pause className="h-4 w-4 mr-2" />
            Stop Polling
          </Button>
          
          {polling.hasError && (
            <Button
              onClick={polling.resetError}
              variant="outline"
              size="sm"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Reset Error
            </Button>
          )}
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-2">How to Test:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Enable polling and set a short interval (e.g., 2000ms)</li>
            <li>Open another browser tab/window and go to the settings page</li>
            <li>Change validation settings in the other tab</li>
            <li>Watch this demo update automatically when settings change</li>
            <li>Check the browser console for polling logs</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
