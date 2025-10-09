import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Clock,
  Zap,
  Save,
  RefreshCw,
  Info,
  Activity
} from 'lucide-react';

interface PollingSettings {
  enabled: boolean;
  fastIntervalMs: number;
  slowIntervalMs: number;
  verySlowIntervalMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  pauseOnHidden: boolean;
}

const DEFAULT_SETTINGS: PollingSettings = {
  enabled: true,
  fastIntervalMs: 5000,
  slowIntervalMs: 30000,
  verySlowIntervalMs: 60000,
  maxRetries: 3,
  backoffMultiplier: 2,
  jitterEnabled: true,
  pauseOnHidden: true,
};

export function PollingSettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PollingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Try to load from localStorage first (client-side only)
      const stored = localStorage.getItem('pollingSettings');
      if (stored) {
        setSettings(JSON.parse(stored));
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Error loading polling settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load polling settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      // Validate settings
      if (settings.fastIntervalMs < 1000) {
        throw new Error('Fast interval must be at least 1 second');
      }
      if (settings.slowIntervalMs < settings.fastIntervalMs) {
        throw new Error('Slow interval must be greater than fast interval');
      }
      if (settings.verySlowIntervalMs < settings.slowIntervalMs) {
        throw new Error('Very slow interval must be greater than slow interval');
      }
      if (settings.maxRetries < 0 || settings.maxRetries > 10) {
        throw new Error('Max retries must be between 0 and 10');
      }
      if (settings.backoffMultiplier < 1 || settings.backoffMultiplier > 5) {
        throw new Error('Backoff multiplier must be between 1 and 5');
      }

      // Save to localStorage
      localStorage.setItem('pollingSettings', JSON.stringify(settings));
      
      toast({
        title: 'Settings Saved',
        description: 'Polling settings updated successfully. Reload the page for changes to take effect.',
      });
    } catch (error: any) {
      console.error('Error saving polling settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save polling settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast({
      title: 'Settings Reset',
      description: 'Polling settings reset to defaults',
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading Settings...</CardTitle>
            <CardDescription>Please wait while polling settings are being loaded.</CardDescription>
          </CardHeader>
          <CardContent>
            <RefreshCw className="h-8 w-8 animate-spin text-fhir-blue" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> Polling Settings
              </CardTitle>
              <CardDescription>
                Configure adaptive polling intervals and behavior for validation progress updates
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                disabled={saving}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Defaults
              </Button>
              <Button
                onClick={handleSaveSettings}
                size="sm"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Polling */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="polling-enabled" className="text-sm font-semibold">
                  Enable Polling
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable automatic polling for validation progress updates
                </p>
              </div>
              <Switch
                id="polling-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>
          </div>

          <Separator />

          {/* Polling Intervals */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-lg font-semibold">Polling Intervals</h3>
            </div>
            
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                Adaptive polling automatically adjusts intervals based on activity level. 
                Fast intervals are used during active validation, slow intervals when idle.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fast-interval" className="text-sm">
                  Fast Interval (ms)
                  <Badge variant="secondary" className="ml-2 text-xs">Active</Badge>
                </Label>
                <Input
                  id="fast-interval"
                  type="number"
                  value={settings.fastIntervalMs}
                  onChange={(e) => setSettings({ ...settings, fastIntervalMs: parseInt(e.target.value) })}
                  min="1000"
                  max="10000"
                  step="1000"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Used during active validation (default: 5s)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slow-interval" className="text-sm">
                  Slow Interval (ms)
                  <Badge variant="secondary" className="ml-2 text-xs">Idle</Badge>
                </Label>
                <Input
                  id="slow-interval"
                  type="number"
                  value={settings.slowIntervalMs}
                  onChange={(e) => setSettings({ ...settings, slowIntervalMs: parseInt(e.target.value) })}
                  min="10000"
                  max="60000"
                  step="5000"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Used when validation is idle (default: 30s)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="very-slow-interval" className="text-sm">
                  Very Slow Interval (ms)
                  <Badge variant="secondary" className="ml-2 text-xs">Complete</Badge>
                </Label>
                <Input
                  id="very-slow-interval"
                  type="number"
                  value={settings.verySlowIntervalMs}
                  onChange={(e) => setSettings({ ...settings, verySlowIntervalMs: parseInt(e.target.value) })}
                  min="30000"
                  max="300000"
                  step="10000"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Used when validation is complete (default: 60s)
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Error Handling */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-lg font-semibold">Error Handling</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-retries" className="text-sm">
                  Max Retries
                </Label>
                <Input
                  id="max-retries"
                  type="number"
                  value={settings.maxRetries}
                  onChange={(e) => setSettings({ ...settings, maxRetries: parseInt(e.target.value) })}
                  min="0"
                  max="10"
                  step="1"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Number of retry attempts on polling error (default: 3)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backoff-multiplier" className="text-sm">
                  Backoff Multiplier
                </Label>
                <Input
                  id="backoff-multiplier"
                  type="number"
                  value={settings.backoffMultiplier}
                  onChange={(e) => setSettings({ ...settings, backoffMultiplier: parseFloat(e.target.value) })}
                  min="1"
                  max="5"
                  step="0.5"
                  disabled={!settings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Exponential backoff multiplier for retries (default: 2)
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Advanced Options */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-lg font-semibold">Advanced Options</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="jitter-enabled" className="text-sm font-semibold">
                    Enable Jitter
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Add random variation to polling intervals to prevent thundering herd
                  </p>
                </div>
                <Switch
                  id="jitter-enabled"
                  checked={settings.jitterEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, jitterEnabled: checked })}
                  disabled={!settings.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pause-on-hidden" className="text-sm font-semibold">
                    Pause When Hidden
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Pause polling when browser tab is hidden (Page Visibility API)
                  </p>
                </div>
                <Switch
                  id="pause-on-hidden"
                  checked={settings.pauseOnHidden}
                  onCheckedChange={(checked) => setSettings({ ...settings, pauseOnHidden: checked })}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

