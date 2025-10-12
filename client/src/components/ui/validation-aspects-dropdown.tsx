/**
 * Validation Aspects Dropdown - MVP Version
 * 
 * Quick access dropdown for validation settings in the app header
 * Shows only essential features: 6 validation aspects and performance settings
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  CheckSquare, 
  Square, 
  ChevronDown,
  Settings,
  Zap,
  Database,
  BookOpen,
  Link,
  Briefcase,
  FileText,
  Save,
  RefreshCw,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { 
  ValidationSettings, 
  ValidationSettingsUpdate 
} from "@shared/validation-settings";

// ============================================================================
// Types
// ============================================================================

interface ValidationAspectsDropdownProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationAspectsDropdown({ className }: ValidationAspectsDropdownProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ValidationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/validation/settings');
      
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load validation settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      toast({
        title: 'Success',
        description: 'Validation settings saved successfully'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save validation settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/validation/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }
      
      const data = await response.json();
      setSettings(data);
      
      toast({
        title: 'Success',
        description: 'Settings reset to defaults'
      });
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateAspect = (aspectKey: keyof ValidationSettings['aspects'], field: 'enabled' | 'severity', value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      aspects: {
        ...settings.aspects,
        [aspectKey]: {
          ...settings.aspects[aspectKey],
          [field]: value
        }
      }
    });
  };

  const updatePerformance = (field: keyof ValidationSettings['performance'], value: number) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      performance: {
        ...settings.performance,
        [field]: value
      }
    });
  };

  const getAspectIcon = (aspectKey: string) => {
    const icons: Record<string, any> = {
      structural: Database,
      profile: BookOpen,
      terminology: FileText,
      reference: Link,
      businessRule: Briefcase,
      metadata: Settings
    };
    
    const Icon = icons[aspectKey] || Settings;
    return <Icon className="h-4 w-4" />;
  };

  const getAspectLabel = (aspectKey: string) => {
    return aspectKey.replace(/([A-Z])/g, ' $1').trim();
  };

  const enabledAspectsCount = settings && settings.aspects && typeof settings.aspects === 'object' 
    ? Object.values(settings.aspects).filter(aspect => aspect.enabled).length 
    : 0;

  if (loading) {
    return (
      <Button variant="outline" disabled className={className}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <Settings className="h-4 w-4 mr-2" />
          Validation Settings
          <Badge variant="secondary" className="ml-2">
            {enabledAspectsCount}/6
          </Badge>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Validation Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {settings && (
          <div className="p-2 space-y-4">
            {/* Validation Aspects */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Validation Aspects</Label>
              <div className="space-y-2">
                {Object.entries(settings.aspects).map(([aspectKey, aspect]) => (
                  <div key={aspectKey} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getAspectIcon(aspectKey)}
                      <Label className="text-sm capitalize">
                        {getAspectLabel(aspectKey)}
                      </Label>
                    </div>
                    <Switch
                      checked={aspect.enabled}
                      onCheckedChange={(checked) => updateAspect(aspectKey as keyof ValidationSettings['aspects'], 'enabled', checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            {/* Performance Settings */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Max Concurrent</Label>
                  <Badge variant="outline">
                    {settings.performance.maxConcurrent}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Batch Size</Label>
                  <Badge variant="outline">
                    {settings.performance.batchSize}
                  </Badge>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={resetToDefaults}
                disabled={saving}
                className="flex-1"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={saveSettings}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}