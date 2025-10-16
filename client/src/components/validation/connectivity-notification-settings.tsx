/**
 * Connectivity Notification Settings Component
 * 
 * Allows users to configure how connectivity change notifications are displayed.
 * Settings are persisted to localStorage.
 * 
 * Task 5.11: UI for notification settings
 */

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import {
  getConnectivityNotificationManager,
  saveNotificationConfig,
  type NotificationConfig,
} from '@/lib/connectivity-notifications';
import { toast } from 'sonner';

// ============================================================================
// Main Component
// ============================================================================

export function ConnectivityNotificationSettings() {
  const notificationManager = getConnectivityNotificationManager();
  const [config, setConfig] = useState<NotificationConfig>(
    notificationManager.getConfig()
  );

  // Load config from manager on mount
  useEffect(() => {
    setConfig(notificationManager.getConfig());
  }, [notificationManager]);

  // Update a config value
  const updateConfig = (updates: Partial<NotificationConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    notificationManager.updateConfig(newConfig);
    saveNotificationConfig(newConfig);

    toast.success('Notification settings updated', {
      duration: 2000,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {config.enabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-400" />
          )}
          Connectivity Notifications
        </CardTitle>
        <CardDescription>
          Configure how you're notified about network connectivity changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Notifications */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled">Enable Notifications</Label>
            <p className="text-sm text-gray-500">
              Show toast notifications when connectivity mode changes
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>

        {/* Settings only shown when enabled */}
        {config.enabled && (
          <>
            {/* Minimum Severity */}
            <div className="space-y-2">
              <Label htmlFor="min-severity">Minimum Severity</Label>
              <Select
                value={config.minSeverity || 'degraded'}
                onValueChange={(value: 'online' | 'degraded' | 'offline') =>
                  updateConfig({ minSeverity: value })
                }
              >
                <SelectTrigger id="min-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">All changes (Online → ...)</SelectItem>
                  <SelectItem value="degraded">Degraded and worse</SelectItem>
                  <SelectItem value="offline">Only offline</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                Only show notifications for mode changes at or above this severity
              </p>
            </div>

            {/* Show Improvements */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-improvements">Show Improvements</Label>
                <p className="text-sm text-gray-500">
                  Notify when connectivity improves (e.g., Offline → Online)
                </p>
              </div>
              <Switch
                id="show-improvements"
                checked={config.showImprovements ?? true}
                onCheckedChange={(showImprovements) =>
                  updateConfig({ showImprovements })
                }
              />
            </div>

            {/* Notification Duration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="duration">Notification Duration</Label>
                <span className="text-sm text-gray-500">
                  {config.duration === 0
                    ? 'Manual dismiss'
                    : `${(config.duration || 5000) / 1000}s`}
                </span>
              </div>
              <Slider
                id="duration"
                min={0}
                max={15000}
                step={1000}
                value={[config.duration || 5000]}
                onValueChange={([duration]) => updateConfig({ duration })}
              />
              <p className="text-sm text-gray-500">
                How long notifications remain visible (0 = until manually dismissed)
              </p>
            </div>

            {/* Play Sound */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex items-center gap-2">
                {config.playSound ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4 text-gray-400" />
                )}
                <div>
                  <Label htmlFor="play-sound">Play Sound</Label>
                  <p className="text-sm text-gray-500">
                    Play an audio alert for connectivity changes
                  </p>
                </div>
              </div>
              <Switch
                id="play-sound"
                checked={config.playSound ?? false}
                onCheckedChange={(playSound) => updateConfig({ playSound })}
              />
            </div>
          </>
        )}

        {/* Test Notification */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.info('Test Notification', {
                description: 'This is how connectivity notifications will appear',
                duration: config.duration || 5000,
              });
            }}
            disabled={!config.enabled}
            className="w-full"
          >
            Test Notification
          </Button>
        </div>

        {/* History */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <Label>Notification History</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                notificationManager.clearHistory();
                toast.success('History cleared');
              }}
            >
              Clear
            </Button>
          </div>
          <NotificationHistory />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Notification History Component
// ============================================================================

function NotificationHistory() {
  const notificationManager = getConnectivityNotificationManager();
  const [history, setHistory] = useState(notificationManager.getHistory());

  useEffect(() => {
    // Refresh history every 5 seconds
    const interval = setInterval(() => {
      setHistory(notificationManager.getHistory());
    }, 5000);

    return () => clearInterval(interval);
  }, [notificationManager]);

  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No connectivity changes recorded yet
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {history.slice(0, 5).map((event, index) => (
        <div
          key={index}
          className="flex items-center justify-between text-sm p-2 rounded bg-gray-50 border"
        >
          <div>
            <span className="font-medium">{event.oldMode}</span>
            <span className="mx-1">→</span>
            <span className="font-medium">{event.newMode}</span>
            {!event.isAutomatic && (
              <span className="ml-2 text-xs text-gray-500">(manual)</span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}


