import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  Info
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DashboardSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  showResourceStats: boolean;
  showValidationProgress: boolean;
  showErrorSummary: boolean;
  showPerformanceMetrics: boolean;
  autoValidateEnabled: boolean;
  polling: {
    enabled: boolean;
    fastIntervalMs: number;
    slowIntervalMs: number;
    verySlowIntervalMs: number;
    maxRetries: number;
    backoffMultiplier: number;
    jitterEnabled: boolean;
    pauseOnHidden: boolean;
  };
}

interface DashboardSettingsTabProps {
  onSettingsChange?: (settings: DashboardSettings) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DashboardSettingsTab({ onSettingsChange }: DashboardSettingsTabProps) {
  const { toast } = useToast();
  
  // State management
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    autoRefresh: true,
    refreshInterval: 30,
    showResourceStats: true,
    showValidationProgress: true,
    showErrorSummary: true,
    showPerformanceMetrics: false,
    autoValidateEnabled: false,
    polling: {
      enabled: true,
      fastIntervalMs: 5000,
      slowIntervalMs: 30000,
      verySlowIntervalMs: 60000,
      maxRetries: 3,
      backoffMultiplier: 2,
      jitterEnabled: true,
      pauseOnHidden: true
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadDashboardSettings();
  }, []);

  // Notify parent of changes
  useEffect(() => {
    onSettingsChange?.(dashboardSettings);
  }, [dashboardSettings, onSettingsChange]);

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadDashboardSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dashboard-settings');
      if (response.ok) {
        const data = await response.json();
        setDashboardSettings(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard settings:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // Settings Updates
  // ========================================================================

  const updateSetting = (field: keyof DashboardSettings, value: any) => {
    setDashboardSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveDashboardSettings = async () => {
    setIsSaving(true);
    try {
      console.log('[DashboardSettings] Saving settings:', {
        settings: dashboardSettings,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch('/api/dashboard-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dashboardSettings),
      });

      console.log('[DashboardSettings] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[DashboardSettings] Save successful:', result);
        toast({
          title: "Success",
          description: "Dashboard settings saved successfully",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DashboardSettings] Save failed:', errorData);
        throw new Error(errorData.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('[DashboardSettings] Error saving settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save dashboard settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setDashboardSettings({
      autoRefresh: true,
      refreshInterval: 30,
      showResourceStats: true,
      showValidationProgress: true,
      showErrorSummary: true,
      showPerformanceMetrics: false,
      autoValidateEnabled: false,
      polling: {
        enabled: true,
        fastIntervalMs: 5000,
        slowIntervalMs: 30000,
        verySlowIntervalMs: 60000,
        maxRetries: 3,
        backoffMultiplier: 2,
        jitterEnabled: true,
        pauseOnHidden: true
      }
    });
  };

  // ========================================================================
  // Render Helpers
  // ========================================================================

  const renderToggleSetting = (
    field: keyof DashboardSettings,
    label: string,
    description: string,
    icon: React.ReactNode
  ) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <div className="space-y-1">
          <Label htmlFor={field}>{label}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={field}
        checked={dashboardSettings[field] as boolean}
        onCheckedChange={(checked) => updateSetting(field, checked)}
      />
    </div>
  );

  // ========================================================================
  // Render
  // ========================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure dashboard display, refresh settings, and components visibility
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={isSaving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset Defaults
          </Button>
          <Button
            onClick={saveDashboardSettings}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Auto-Refresh Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Auto-Refresh Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderToggleSetting(
            'autoRefresh',
            'Enable Auto-Refresh',
            'Automatically refresh dashboard data at regular intervals',
            <Clock className="h-5 w-5" />
          )}

          {dashboardSettings.autoRefresh && (
            <div className="space-y-2">
              <Label htmlFor="refresh-interval">Refresh Interval (seconds)</Label>
              <Select
                value={dashboardSettings.refreshInterval.toString()}
                onValueChange={(value) => updateSetting('refreshInterval', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dashboard Components */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Dashboard Components
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderToggleSetting(
            'showResourceStats',
            'Show Resource Statistics',
            'Display resource count and breakdown statistics',
            <BarChart3 className="h-5 w-5" />
          )}

          {renderToggleSetting(
            'showValidationProgress',
            'Show Validation Progress',
            'Display validation progress and completion status',
            <TrendingUp className="h-5 w-5" />
          )}

          {renderToggleSetting(
            'showErrorSummary',
            'Show Error Summary',
            'Display validation errors and warnings summary',
            <AlertTriangle className="h-5 w-5" />
          )}

          {renderToggleSetting(
            'showPerformanceMetrics',
            'Show Performance Metrics',
            'Display system performance and timing metrics',
            <Activity className="h-5 w-5" />
          )}
        </CardContent>
      </Card>

      {/* Validation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Validation Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderToggleSetting(
            'autoValidateEnabled',
            'Enable Auto-Validation',
            'Automatically validate resources when they are loaded',
            <CheckCircle className="h-5 w-5" />
          )}
        </CardContent>
      </Card>

      {/* Polling Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Polling Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Polling */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5" />
              <div className="space-y-1">
                <Label htmlFor="polling-enabled">Enable Polling</Label>
                <p className="text-sm text-muted-foreground">Enable automatic polling for validation progress updates</p>
              </div>
            </div>
            <Switch
              id="polling-enabled"
              checked={dashboardSettings.polling.enabled}
              onCheckedChange={(checked) => setDashboardSettings({ 
                ...dashboardSettings, 
                polling: { ...dashboardSettings.polling, enabled: checked } 
              })}
            />
          </div>

          <Separator />

          {/* Polling Intervals */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h4 className="text-sm font-semibold">Polling Intervals</h4>
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
                  value={dashboardSettings.polling.fastIntervalMs}
                  onChange={(e) => setDashboardSettings({ 
                    ...dashboardSettings, 
                    polling: { ...dashboardSettings.polling, fastIntervalMs: parseInt(e.target.value) } 
                  })}
                  min="1000"
                  max="10000"
                  step="1000"
                  disabled={!dashboardSettings.polling.enabled}
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
                  value={dashboardSettings.polling.slowIntervalMs}
                  onChange={(e) => setDashboardSettings({ 
                    ...dashboardSettings, 
                    polling: { ...dashboardSettings.polling, slowIntervalMs: parseInt(e.target.value) } 
                  })}
                  min="10000"
                  max="60000"
                  step="5000"
                  disabled={!dashboardSettings.polling.enabled}
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
                  value={dashboardSettings.polling.verySlowIntervalMs}
                  onChange={(e) => setDashboardSettings({ 
                    ...dashboardSettings, 
                    polling: { ...dashboardSettings.polling, verySlowIntervalMs: parseInt(e.target.value) } 
                  })}
                  min="30000"
                  max="300000"
                  step="10000"
                  disabled={!dashboardSettings.polling.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Used when validation is complete (default: 60s)
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Advanced Options */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h4 className="text-sm font-semibold">Advanced Options</h4>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="jitter-enabled">Enable Jitter</Label>
                <p className="text-sm text-muted-foreground">Add random variance to polling intervals to prevent server load spikes</p>
              </div>
              <Switch
                id="jitter-enabled"
                checked={dashboardSettings.polling.jitterEnabled}
                onCheckedChange={(checked) => setDashboardSettings({ 
                  ...dashboardSettings, 
                  polling: { ...dashboardSettings.polling, jitterEnabled: checked } 
                })}
                disabled={!dashboardSettings.polling.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="pause-on-hidden">Pause When Hidden</Label>
                <p className="text-sm text-muted-foreground">Automatically pause polling when the browser tab is hidden</p>
              </div>
              <Switch
                id="pause-on-hidden"
                checked={dashboardSettings.polling.pauseOnHidden}
                onCheckedChange={(checked) => setDashboardSettings({ 
                  ...dashboardSettings, 
                  polling: { ...dashboardSettings.polling, pauseOnHidden: checked } 
                })}
                disabled={!dashboardSettings.polling.enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
