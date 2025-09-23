import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
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
  Monitor,
  Smartphone,
  Palette,
  Clock,
  TrendingUp,
  Activity
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
  cardLayout: 'grid' | 'list';
  theme: 'light' | 'dark' | 'system';
  autoValidateEnabled: boolean;
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
    cardLayout: 'grid',
    theme: 'system',
    autoValidateEnabled: false
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
      const response = await fetch('/api/dashboard-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dashboardSettings),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Dashboard settings saved successfully",
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save dashboard settings:', error);
      toast({
        title: "Error",
        description: "Failed to save dashboard settings",
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
      cardLayout: 'grid',
      theme: 'system',
      autoValidateEnabled: false
    });
  };

  // ========================================================================
  // Render Helpers
  // ========================================================================

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light': return <Monitor className="h-4 w-4" />;
      case 'dark': return <Monitor className="h-4 w-4" />;
      case 'system': return <Smartphone className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getLayoutIcon = (layout: string) => {
    switch (layout) {
      case 'grid': return <BarChart3 className="h-4 w-4" />;
      case 'list': return <Activity className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

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
      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Display Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={dashboardSettings.theme}
                onValueChange={(value) => updateSetting('theme', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      {getThemeIcon('light')}
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      {getThemeIcon('dark')}
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      {getThemeIcon('system')}
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-layout">Card Layout</Label>
              <Select
                value={dashboardSettings.cardLayout}
                onValueChange={(value) => updateSetting('cardLayout', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">
                    <div className="flex items-center gap-2">
                      {getLayoutIcon('grid')}
                      Grid Layout
                    </div>
                  </SelectItem>
                  <SelectItem value="list">
                    <div className="flex items-center gap-2">
                      {getLayoutIcon('list')}
                      List Layout
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={resetToDefaults}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <Button onClick={saveDashboardSettings} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
  );
}
