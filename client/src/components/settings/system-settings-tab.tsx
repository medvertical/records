import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { SettingSection } from './shared';

// ============================================================================
// Types
// ============================================================================

interface SystemSettings {
  theme: 'light' | 'dark' | 'system';
  layout: 'grid' | 'list';
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    maxFileSize: number;
  };
  privacy: {
    telemetry: boolean;
    crashReporting: boolean;
    errorStackTrace?: boolean;
  };
  dataRetentionDays: number;
  features: {
    sse: boolean;
    autoUpdate: boolean;
    experimental?: boolean;
  };
  advanced: {
    debugMode: boolean;
    performanceTracing?: boolean;
  };
}

interface SystemSettingsTabProps {
  onSettingsChange?: (settings: SystemSettings) => void;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: SystemSettings = {
  theme: 'system',
  layout: 'grid',
  logging: {
    level: 'info',
    maxFileSize: 100,
  },
  privacy: {
    telemetry: false,
    crashReporting: true,
    errorStackTrace: false,
  },
  dataRetentionDays: 30,
  features: {
    sse: true,
    autoUpdate: true,
    experimental: false,
  },
  advanced: {
    debugMode: false,
    performanceTracing: false,
  },
};

// ============================================================================
// Component
// ============================================================================

export function SystemSettingsTab({ onSettingsChange }: SystemSettingsTabProps) {
  const { toast } = useToast();
  
  // State management
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
      const response = await fetch('/api/system-settings');
      if (response.ok) {
        const data = await response.json();
        // Merge with defaults to ensure all properties exist
        const mergedSettings: SystemSettings = {
          theme: data.theme ?? DEFAULT_SETTINGS.theme,
          layout: data.layout ?? DEFAULT_SETTINGS.layout,
          logging: {
            level: data.logging?.level ?? DEFAULT_SETTINGS.logging.level,
            maxFileSize: data.logging?.maxFileSize ?? DEFAULT_SETTINGS.logging.maxFileSize,
          },
          privacy: {
            telemetry: data.privacy?.telemetry ?? DEFAULT_SETTINGS.privacy.telemetry,
            crashReporting: data.privacy?.crashReporting ?? DEFAULT_SETTINGS.privacy.crashReporting,
            errorStackTrace: data.privacy?.errorStackTrace ?? DEFAULT_SETTINGS.privacy.errorStackTrace,
          },
          dataRetentionDays: data.dataRetentionDays ?? DEFAULT_SETTINGS.dataRetentionDays,
          features: {
            sse: data.features?.sse ?? DEFAULT_SETTINGS.features.sse,
            autoUpdate: data.features?.autoUpdate ?? DEFAULT_SETTINGS.features.autoUpdate,
            experimental: data.features?.experimental ?? DEFAULT_SETTINGS.features.experimental,
          },
          advanced: {
            debugMode: data.advanced?.debugMode ?? DEFAULT_SETTINGS.advanced.debugMode,
            performanceTracing: data.advanced?.performanceTracing ?? DEFAULT_SETTINGS.advanced.performanceTracing,
          },
        };
        setSettings(mergedSettings);
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load system settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // Settings Updates
  // ========================================================================

  // Helper to update nested settings using dot notation (e.g., "logging.level")
  const update = (path: string, value: any) => {
    setSettings((prev) => {
      const keys = path.split('.');
      if (keys.length === 1) {
        return { ...prev, [keys[0]]: value };
      }
      
      // Handle nested updates
      const [parent, child] = keys;
      return {
        ...prev,
        [parent]: {
          ...(prev[parent as keyof SystemSettings] as any),
          [child]: value,
        },
      };
    });
  };

  // ========================================================================
  // Data Management
  // ========================================================================

  const exportSettings = () => {
    setIsExporting(true);
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Success',
        description: 'Settings exported successfully',
      });
    } catch (error) {
      console.error('Failed to export settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to export settings',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const clearCache = () => {
    try {
      // Clear localStorage
      const keysToKeep = ['theme', 'system-settings'];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      sessionStorage.clear();

      // Clear IndexedDB (if using it)
      if (window.indexedDB) {
        window.indexedDB.databases?.().then((dbs) => {
          dbs.forEach((db) => {
            if (db.name && db.name.includes('cache')) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }

      setShowClearCacheDialog(false);
      toast({
        title: 'Success',
        description: 'Local cache cleared successfully',
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear cache',
        variant: 'destructive',
      });
    }
  };

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
      {/* User Preferences Divider */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">User Preferences</h3>
        <Separator />
      </div>

      {/* Section 1: Display Settings */}
      <SettingSection
        title="Display Settings"
        description="Customize Records appearance and layout preferences."
      >
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select
            value={settings.theme}
            onValueChange={(v) => update('theme', v)}
          >
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System Default</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-layout">Card Layout</Label>
          <Select
            value={settings.layout}
            onValueChange={(v) => update('layout', v)}
          >
            <SelectTrigger id="card-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Grid</SelectItem>
              <SelectItem value="list">List</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SettingSection>

      {/* Section 2: Logging & Debugging */}
      <SettingSection
        title="Logging & Debugging"
        description="Control the level of detail written to application logs."
      >
        <div className="space-y-2">
          <Label htmlFor="log-level">Log Level</Label>
          <Select
            value={settings.logging.level}
            onValueChange={(v) => update('logging.level', v)}
          >
            <SelectTrigger id="log-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-log-size">Max Log File Size (MB)</Label>
          <Input
            id="max-log-size"
            type="number"
            value={settings.logging.maxFileSize}
            onChange={(e) => update('logging.maxFileSize', parseInt(e.target.value) || 100)}
            min="1"
            max="1000"
          />
        </div>
      </SettingSection>

      {/* Section 3: Privacy & Analytics */}
      <SettingSection
        title="Privacy & Analytics"
        description="Manage telemetry and crash-reporting options."
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="telemetry">Enable usage analytics</Label>
          <Switch
            id="telemetry"
            checked={settings.privacy.telemetry}
            onCheckedChange={(checked) => update('privacy.telemetry', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="crash-reporting">Enable crash reporting</Label>
          <Switch
            id="crash-reporting"
            checked={settings.privacy.crashReporting}
            onCheckedChange={(checked) => update('privacy.crashReporting', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="error-stack">Include error stack traces in bug reports</Label>
          <Switch
            id="error-stack"
            checked={settings.privacy.errorStackTrace ?? false}
            onCheckedChange={(checked) => update('privacy.errorStackTrace', checked)}
          />
        </div>
      </SettingSection>

      {/* System Controls Divider */}
      <div className="space-y-1 pt-4">
        <h3 className="text-lg font-semibold text-foreground">System Controls</h3>
        <Separator />
      </div>

      {/* Section 4: Data Management */}
      <SettingSection
        title="Data Management"
        description="Control local data retention and cache handling."
      >
        <div className="space-y-2">
          <Label htmlFor="data-retention">Data Retention (days)</Label>
          <Input
            id="data-retention"
            type="number"
            value={settings.dataRetentionDays}
            onChange={(e) => update('dataRetentionDays', parseInt(e.target.value) || 30)}
            min="1"
            max="365"
          />
        </div>

        <div className="flex gap-3 mt-3">
          <Button 
            variant="outline" 
            onClick={exportSettings}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Export Settings
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowClearCacheDialog(true)}
          >
            Clear Local Cache
          </Button>
        </div>
      </SettingSection>

      {/* Section 5: System Features */}
      <SettingSection
        title="System Features"
        description="Toggle optional platform capabilities."
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="sse">Enable Server-Sent Events (live updates)</Label>
          <Switch
            id="sse"
            checked={settings.features.sse}
            onCheckedChange={(checked) => update('features.sse', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="auto-update">Enable Auto-Updates</Label>
          <Switch
            id="auto-update"
            checked={settings.features.autoUpdate}
            onCheckedChange={(checked) => update('features.autoUpdate', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="experimental">Enable Experimental Features</Label>
          <Switch
            id="experimental"
            checked={settings.features.experimental ?? false}
            onCheckedChange={(checked) => update('features.experimental', checked)}
          />
        </div>
      </SettingSection>

      {/* Section 6: Advanced Options */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced Options</AccordionTrigger>
          <AccordionContent>
            <SettingSection
              title="Advanced Options"
              description="Developer-only configuration. Changes here may affect system stability."
              className="border-0 pb-0 mb-0"
            >
              <div className="flex items-center justify-between">
                <Label htmlFor="debug-mode">Enable Debug Mode</Label>
                <Switch
                  id="debug-mode"
                  checked={settings.advanced.debugMode}
                  onCheckedChange={(checked) => update('advanced.debugMode', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="performance-tracing">Enable Performance Tracing</Label>
                <Switch
                  id="performance-tracing"
                  checked={settings.advanced.performanceTracing ?? false}
                  onCheckedChange={(checked) => update('advanced.performanceTracing', checked)}
                />
              </div>
            </SettingSection>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Clear Cache Confirmation Dialog */}
      <AlertDialog open={showClearCacheDialog} onOpenChange={setShowClearCacheDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Clear Local Cache
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all cached data from your browser including validation results, 
              temporary files, and session data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearCache}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
