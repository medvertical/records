import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { SettingSection, SectionTitle } from './shared';

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
    pauseOnHidden?: boolean;
  };
}

interface DashboardSettingsTabProps {
  onSettingsChange?: (settings: DashboardSettings) => void;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: DashboardSettings = {
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
    pauseOnHidden: true,
  },
};

// ============================================================================
// Component
// ============================================================================

export function DashboardSettingsTab({ onSettingsChange }: DashboardSettingsTabProps) {
  const { toast } = useToast();

  // State management
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Notify parent of changes
  useEffect(() => {
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/dashboard-settings');
      if (response.ok) {
        const data = await response.json();
        // Merge with defaults to ensure all properties exist
        const mergedSettings: DashboardSettings = {
          autoRefresh: data.autoRefresh ?? DEFAULT_SETTINGS.autoRefresh,
          refreshInterval: data.refreshInterval ?? DEFAULT_SETTINGS.refreshInterval,
          showResourceStats: data.showResourceStats ?? DEFAULT_SETTINGS.showResourceStats,
          showValidationProgress: data.showValidationProgress ?? DEFAULT_SETTINGS.showValidationProgress,
          showErrorSummary: data.showErrorSummary ?? DEFAULT_SETTINGS.showErrorSummary,
          showPerformanceMetrics: data.showPerformanceMetrics ?? DEFAULT_SETTINGS.showPerformanceMetrics,
          autoValidateEnabled: data.autoValidateEnabled ?? DEFAULT_SETTINGS.autoValidateEnabled,
          polling: {
            enabled: data.polling?.enabled ?? DEFAULT_SETTINGS.polling.enabled,
            fastIntervalMs: data.polling?.fastIntervalMs ?? DEFAULT_SETTINGS.polling.fastIntervalMs,
            slowIntervalMs: data.polling?.slowIntervalMs ?? DEFAULT_SETTINGS.polling.slowIntervalMs,
            pauseOnHidden: data.polling?.pauseOnHidden ?? DEFAULT_SETTINGS.polling.pauseOnHidden,
          },
        };
        setSettings(mergedSettings);
      }
    } catch (error) {
      console.error('Failed to load dashboard settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // Settings Updates
  // ========================================================================

  const updateSetting = (field: keyof DashboardSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updatePolling = (field: keyof DashboardSettings['polling'], value: any) => {
    setSettings((prev) => ({
      ...prev,
      polling: { ...prev.polling, [field]: value },
    }));
  };

  // ========================================================================
  // Render
  // ========================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Display & Refresh Settings */}
      <div className="space-y-6">
        <SectionTitle 
          title="Display & Refresh" 
          helpText="Configure how the dashboard displays data and when it refreshes. Control widget visibility, auto-refresh intervals, and validation triggers."
        />

        {/* Auto-Refresh */}
        <SettingSection
          title="Auto Refresh"
          description="Automatically refresh dashboard data at a defined interval."
        >
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-refresh">Enable Auto-Refresh</Label>
          <Switch
            id="auto-refresh"
            checked={settings.autoRefresh}
            onCheckedChange={(checked) => updateSetting('autoRefresh', checked)}
          />
        </div>

        {settings.autoRefresh && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Refresh Interval</Label>
              <span className="text-sm text-muted-foreground">
                {settings.refreshInterval}s
              </span>
            </div>
            <Slider
              min={5}
              max={300}
              step={5}
              value={[settings.refreshInterval]}
              onValueChange={([v]) => updateSetting('refreshInterval', v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5s</span>
              <span>300s</span>
            </div>
          </div>
        )}
      </SettingSection>

      {/* Dashboard Components */}
      <SettingSection
        title="Dashboard Components"
        description="Choose which dashboard widgets are visible."
      >
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-resource-stats"
              checked={settings.showResourceStats}
              onCheckedChange={(checked) => updateSetting('showResourceStats', !!checked)}
            />
            <Label htmlFor="show-resource-stats" className="cursor-pointer">
              Show Resource Statistics
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-validation-progress"
              checked={settings.showValidationProgress}
              onCheckedChange={(checked) => updateSetting('showValidationProgress', !!checked)}
            />
            <Label htmlFor="show-validation-progress" className="cursor-pointer">
              Show Validation Progress
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-error-summary"
              checked={settings.showErrorSummary}
              onCheckedChange={(checked) => updateSetting('showErrorSummary', !!checked)}
            />
            <Label htmlFor="show-error-summary" className="cursor-pointer">
              Show Error Summary
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-performance-metrics"
              checked={settings.showPerformanceMetrics}
              onCheckedChange={(checked) => updateSetting('showPerformanceMetrics', !!checked)}
            />
            <Label htmlFor="show-performance-metrics" className="cursor-pointer">
              Show Performance Metrics
            </Label>
          </div>
        </div>
      </SettingSection>

      {/* Validation Behavior */}
      <SettingSection
        title="Validation Behavior"
        description="Control when automatic validation occurs on dashboard load or data change."
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="auto-validate">Auto-Validate on Load</Label>
            <p className="text-xs text-muted-foreground">
              {settings.autoValidateEnabled
                ? 'Records will automatically validate when new data arrives.'
                : 'Manual validation only.'}
            </p>
          </div>
          <Switch
            id="auto-validate"
            checked={settings.autoValidateEnabled}
            onCheckedChange={(checked) => updateSetting('autoValidateEnabled', checked)}
          />
        </div>
      </SettingSection>
      </div>

      {/* Real-time Updates */}
      <div className="space-y-6">
        <SectionTitle 
          title="Real-time Updates" 
          helpText="Configure polling behavior for live data updates. Set different intervals for active and idle states, and control background polling behavior."
        />

        {/* Polling Configuration */}
        <SettingSection
          title="Polling Configuration"
          description="Define how often Records polls for new data and how it behaves during idle or background states."
        >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="polling-enabled">Enable Polling</Label>
            <Switch
              id="polling-enabled"
              checked={settings.polling.enabled}
              onCheckedChange={(checked) => updatePolling('enabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fast-interval">Fast Interval (ms)</Label>
              <Input
                id="fast-interval"
                type="number"
                value={settings.polling.fastIntervalMs}
                onChange={(e) => updatePolling('fastIntervalMs', parseInt(e.target.value) || 1000)}
                disabled={!settings.polling.enabled}
                min={1000}
                step={1000}
              />
              <p className="text-xs text-muted-foreground">Active validation</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slow-interval">Slow Interval (ms)</Label>
              <Input
                id="slow-interval"
                type="number"
                value={settings.polling.slowIntervalMs}
                onChange={(e) => updatePolling('slowIntervalMs', parseInt(e.target.value) || 5000)}
                disabled={!settings.polling.enabled}
                min={5000}
                step={1000}
              />
              <p className="text-xs text-muted-foreground">Idle state</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="pause-on-hidden">Pause when hidden</Label>
            <Switch
              id="pause-on-hidden"
              checked={settings.polling.pauseOnHidden ?? true}
              onCheckedChange={(checked) => updatePolling('pauseOnHidden', checked)}
              disabled={!settings.polling.enabled}
            />
          </div>
        </div>
      </SettingSection>
      </div>
    </div>
  );
}
