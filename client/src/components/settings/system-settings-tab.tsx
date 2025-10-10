import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Save,
  RefreshCw,
  Database,
  BarChart3,
  Shield,
  Download,
  Upload,
  Trash2,
  Info,
  Activity,
  Bell,
  Globe,
  HardDrive
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SystemSettings {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  enableSSE: boolean;
  dataRetentionDays: number;
  maxLogFileSize: number;
  enableAutoUpdates: boolean;
}

interface SystemSettingsTabProps {
  onSettingsChange?: (settings: SystemSettings) => void;
}

// ============================================================================
// Component
// ============================================================================

export function SystemSettingsTab({ onSettingsChange }: SystemSettingsTabProps) {
  const { toast } = useToast();
  
  // State management
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    logLevel: 'info',
    enableAnalytics: false,
    enableCrashReporting: true,
    enableSSE: true,
    dataRetentionDays: 30,
    maxLogFileSize: 100,
    enableAutoUpdates: true
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSystemSettings();
  }, []);

  // Notify parent of changes
  useEffect(() => {
    onSettingsChange?.(systemSettings);
  }, [systemSettings, onSettingsChange]);

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadSystemSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/system-settings');
      if (response.ok) {
        const data = await response.json();
        setSystemSettings(data);
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
      toast({
        title: "Error",
        description: "Failed to load system settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // Settings Updates
  // ========================================================================

  const updateSetting = (field: keyof SystemSettings, value: any) => {
    setSystemSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveSystemSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(systemSettings),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "System settings saved successfully",
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save system settings:', error);
      toast({
        title: "Error",
        description: "Failed to save system settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSystemSettings({
      logLevel: 'info',
      enableAnalytics: false,
      enableCrashReporting: true,
      enableSSE: true,
      dataRetentionDays: 30,
      maxLogFileSize: 100,
      enableAutoUpdates: true
    });
  };

  // ========================================================================
  // Data Management
  // ========================================================================

  const exportSettings = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/system-settings/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'system-settings.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Success",
          description: "Settings exported successfully",
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Failed to export settings:', error);
      toast({
        title: "Error",
        description: "Failed to export settings",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const importSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text);
      
      setSystemSettings(importedSettings);
      
      toast({
        title: "Success",
        description: "Settings imported successfully",
      });
    } catch (error) {
      console.error('Failed to import settings:', error);
      toast({
        title: "Error",
        description: "Failed to import settings",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const clearData = async () => {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/system/clear-data', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "All data cleared successfully",
        });
      } else {
        throw new Error('Clear data failed');
      }
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast({
        title: "Error",
        description: "Failed to clear data",
        variant: "destructive",
      });
    }
  };

  // ========================================================================
  // Render Helpers
  // ========================================================================

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'debug': return <Info className="h-4 w-4 text-blue-500" />;
      case 'info': return <Info className="h-4 w-4 text-green-500" />;
      case 'warn': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogLevelBadge = (level: string) => {
    const variants = {
      debug: 'outline' as const,
      info: 'default' as const,
      warn: 'secondary' as const,
      error: 'destructive' as const
    };
    
    return (
      <Badge variant={variants[level as keyof typeof variants] || 'outline'}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const renderToggleSetting = (
    field: keyof SystemSettings,
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
        checked={systemSettings[field] as boolean}
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
        <span className="ml-2">Loading system settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logging Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Logging Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="log-level">Log Level</Label>
            <Select
              value={systemSettings.logLevel}
              onValueChange={(value) => updateSetting('logLevel', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debug">
                  <div className="flex items-center gap-2">
                    {getLogLevelIcon('debug')}
                    Debug
                  </div>
                </SelectItem>
                <SelectItem value="info">
                  <div className="flex items-center gap-2">
                    {getLogLevelIcon('info')}
                    Info
                  </div>
                </SelectItem>
                <SelectItem value="warn">
                  <div className="flex items-center gap-2">
                    {getLogLevelIcon('warn')}
                    Warning
                  </div>
                </SelectItem>
                <SelectItem value="error">
                  <div className="flex items-center gap-2">
                    {getLogLevelIcon('error')}
                    Error
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              Current level: {getLogLevelBadge(systemSettings.logLevel)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-log-size">Max Log File Size (MB)</Label>
            <Input
              id="max-log-size"
              type="number"
              value={systemSettings.maxLogFileSize}
              onChange={(e) => updateSetting('maxLogFileSize', parseInt(e.target.value))}
              min="1"
              max="1000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderToggleSetting(
            'enableAnalytics',
            'Enable Analytics',
            'Collect anonymous usage statistics to help improve the application',
            <BarChart3 className="h-5 w-5" />
          )}

          {renderToggleSetting(
            'enableCrashReporting',
            'Enable Crash Reporting',
            'Automatically report crashes and errors to help improve stability',
            <AlertTriangle className="h-5 w-5" />
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="data-retention">Data Retention (days)</Label>
            <Input
              id="data-retention"
              type="number"
              value={systemSettings.dataRetentionDays}
              onChange={(e) => updateSetting('dataRetentionDays', parseInt(e.target.value))}
              min="1"
              max="365"
            />
            <p className="text-sm text-muted-foreground">
              How long to keep validation results and logs
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Data Operations</h4>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportSettings}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export Settings
              </Button>
              
              <Button
                variant="outline"
                onClick={() => document.getElementById('import-settings')?.click()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Import Settings
              </Button>
              
              <input
                id="import-settings"
                type="file"
                accept=".json"
                onChange={importSettings}
                className="hidden"
              />
            </div>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> The clear data operation will permanently delete all validation results, logs, and cached data. This action cannot be undone.
              </AlertDescription>
            </Alert>
            
            <Button
              variant="destructive"
              onClick={clearData}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderToggleSetting(
            'enableSSE',
            'Enable Server-Sent Events',
            'Enable real-time updates using Server-Sent Events',
            <Globe className="h-5 w-5" />
          )}

          {renderToggleSetting(
            'enableAutoUpdates',
            'Enable Auto-Updates',
            'Automatically check for and install application updates',
            <Download className="h-5 w-5" />
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={resetToDefaults}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <Button onClick={saveSystemSettings} disabled={isSaving}>
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
