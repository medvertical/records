import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { SettingSection, SectionTitle } from './shared';
import { deepEqual } from '@/lib/deep-compare';

// ============================================================================
// Types
// ============================================================================

interface SystemSettings {
  theme: 'light' | 'dark' | 'system';
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    maxFileSize: number;
  };
  privacy: {
    telemetry: boolean;
    crashReporting: boolean;
  };
  dataRetentionDays: number;
  features: {
    sse: boolean;
    autoUpdate: boolean;
  };
}

interface SystemSettingsTabProps {
  onSettingsChange?: (settings: SystemSettings) => void;
  saveCounter?: number;  // Trigger save when this changes
  onSaveComplete?: () => void;  // Notify parent of save completion
  onSaveError?: (error: string) => void;  // Notify parent of save error
  reloadTrigger?: number;  // Trigger reload when this changes
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: SystemSettings = {
  theme: 'system',
  logging: {
    level: 'info',
    maxFileSize: 100,
  },
  privacy: {
    telemetry: false,
    crashReporting: true,
  },
  dataRetentionDays: 30,
  features: {
    sse: true,
    autoUpdate: true,
  },
};

// ============================================================================
// Component
// ============================================================================

export function SystemSettingsTab({ onSettingsChange, saveCounter, onSaveComplete, onSaveError, reloadTrigger }: SystemSettingsTabProps) {
  const { toast } = useToast();
  
  // State management
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load settings only when reloadTrigger changes (skip initial mount to avoid duplicate load)
  useEffect(() => {
    if (reloadTrigger && reloadTrigger > 0) {
      console.log('[SystemSettings] Reload triggered, reloadTrigger:', reloadTrigger);
      loadSettings();
    }
  }, [reloadTrigger]);

  // Apply theme to document root (but not during initial load)
  useEffect(() => {
    // Don't apply theme until settings are actually loaded from API
    if (isLoading || isInitialLoad) {
      console.log('[SystemSettings] Skipping theme application during load');
      return;
    }
    
    console.log('[SystemSettings] Applying theme:', settings.theme);
    const root = document.documentElement;
    
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (settings.theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      // System theme - check system preference
      root.classList.remove('dark', 'light');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      }
    }
  }, [settings.theme, isLoading, isInitialLoad]);

  // Notify parent of changes (but not during initial load)
  useEffect(() => {
    if (isInitialLoad) {
      console.log('[SystemSettings] Skipping change notification during initial load');
      return;
    }
    
    // Only notify if settings actually changed from original
    const hasRealChanges = !deepEqual(settings, originalSettings);
    console.log('[SystemSettings] Settings changed, has real changes:', hasRealChanges);
    
    if (hasRealChanges) {
      onSettingsChange?.(settings);
    }
  }, [settings, originalSettings, onSettingsChange, isInitialLoad]);

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      console.log('[SystemSettings] Loading settings from API...');
      const response = await fetch('/api/system-settings');
      if (response.ok) {
        const data = await response.json();
        console.log('[SystemSettings] Received data from API:', data);
        // Merge with defaults to ensure all properties exist
        const mergedSettings: SystemSettings = {
          theme: data.theme ?? DEFAULT_SETTINGS.theme,
          logging: {
            level: data.logging?.level ?? DEFAULT_SETTINGS.logging.level,
            maxFileSize: data.logging?.maxFileSize ?? DEFAULT_SETTINGS.logging.maxFileSize,
          },
          privacy: {
            telemetry: data.privacy?.telemetry ?? DEFAULT_SETTINGS.privacy.telemetry,
            crashReporting: data.privacy?.crashReporting ?? DEFAULT_SETTINGS.privacy.crashReporting,
          },
          dataRetentionDays: data.dataRetentionDays ?? DEFAULT_SETTINGS.dataRetentionDays,
          features: {
            sse: data.features?.sse ?? DEFAULT_SETTINGS.features.sse,
            autoUpdate: data.features?.autoUpdate ?? DEFAULT_SETTINGS.features.autoUpdate,
          },
        };
        console.log('[SystemSettings] Merged settings:', mergedSettings);
        setSettings(mergedSettings);
        setOriginalSettings(JSON.parse(JSON.stringify(mergedSettings))); // Deep copy
        setIsInitialLoad(false);
        console.log('[SystemSettings] Initial load complete');
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
  // Settings Save
  // ========================================================================

  const saveSettings = async () => {
    try {
      console.log('[SystemSettings] Saving settings:', settings);
      const response = await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const savedData = await response.json();
      console.log('[SystemSettings] Save response from API:', savedData);

      onSaveComplete?.();
    } catch (error) {
      console.error('Failed to save system settings:', error);
      onSaveError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Trigger save when saveCounter changes (but not during load)
  useEffect(() => {
    if (saveCounter && saveCounter > 0 && !isLoading) {
      console.log('[SystemSettings] Save triggered by saveCounter:', saveCounter);
      saveSettings();
    }
  }, [saveCounter, isLoading]);

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* User Preferences */}
      <div className="space-y-6">
        <SectionTitle 
          title="User Preferences" 
          helpText="Customize application appearance, logging, and privacy settings to match your preferences."
        />

      {/* Section 1: Display Settings */}
      <SettingSection
        title="Display Settings"
        description="Customize Records appearance."
      >
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <div className="flex items-center gap-2">
            <Select
              value={settings.theme}
              onValueChange={(v) => update('theme', v)}
            >
              <SelectTrigger id="theme" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <span>Dark</span>
                    <Badge variant="secondary" className="text-xs">Experimental</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="system">System Default</SelectItem>
              </SelectContent>
            </Select>
            {settings.theme === 'dark' && (
              <Badge variant="secondary" className="text-xs">Experimental</Badge>
            )}
          </div>
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
      </SettingSection>

      </div>

      {/* System Controls */}
      <div className="space-y-6">
        <SectionTitle 
          title="System Controls" 
          helpText="Manage data retention, cache, system features, and advanced developer options."
        />

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
      </SettingSection>

      </div>

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
