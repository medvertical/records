/**
 * Validation Settings Tab - MVP Version
 * 
 * This component provides a minimal interface for validation settings
 * with only essential features: 6 validation aspects, performance settings, and resource type filtering.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useActiveServer } from '@/hooks/use-active-server';
import { 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Save,
  RefreshCw,
  Server,
  Database,
  Zap,
  Users,
  Globe,
  HardDrive
} from 'lucide-react';
import type { 
  ValidationSettings, 
  ValidationSettingsUpdate,
  FHIRVersion 
} from '@shared/validation-settings';

// ============================================================================
// Component
// ============================================================================

export function ValidationSettingsTab() {
  const { toast } = useToast();
  const { activeServer } = useActiveServer();
  
  // State
  const [settings, setSettings] = useState<ValidationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fhirVersion, setFhirVersion] = useState<FHIRVersion>('R4');
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [showMigrationWarning, setShowMigrationWarning] = useState(false);
  const [originalFhirVersion, setOriginalFhirVersion] = useState<FHIRVersion>('R4');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [activeServer]);

  // Load available resource types when FHIR version changes
  useEffect(() => {
    if (fhirVersion) {
      loadResourceTypes(fhirVersion);
    }
  }, [fhirVersion]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const serverId = activeServer?.id;
      const response = await fetch(`/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`);
      
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      
      const data = await response.json();
      setSettings(data);
      
      // Extract FHIR version from settings or default to R4
      if (data.resourceTypes?.fhirVersion) {
        setFhirVersion(data.resourceTypes.fhirVersion);
        setOriginalFhirVersion(data.resourceTypes.fhirVersion);
      }
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

  const loadResourceTypes = async (version: FHIRVersion) => {
    try {
      const response = await fetch(`/api/validation/resource-types/${version}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableResourceTypes(data.resourceTypes || []);
      }
    } catch (error) {
      console.error('Error loading resource types:', error);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      const serverId = activeServer?.id;
      const response = await fetch(`/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`, {
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
      const serverId = activeServer?.id;
      const response = await fetch('/api/validation/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          serverId,
          fhirVersion 
        })
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

  const updateResourceTypes = (field: keyof ValidationSettings['resourceTypes'], value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      resourceTypes: {
        ...settings.resourceTypes,
        [field]: value
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading validation settings...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load validation settings. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Validation Settings</h2>
          <p className="text-muted-foreground">
            Configure validation aspects, performance, and resource type filtering
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={saving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset Defaults
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Validation Mode (Online/Offline) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {settings.mode === 'online' ? (
              <Globe className="h-5 w-5 text-blue-500" />
            ) : (
              <HardDrive className="h-5 w-5 text-gray-500" />
            )}
            Validation Mode
          </CardTitle>
          <CardDescription>
            Switch between online (remote terminology servers) and offline (local Ontoserver) validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Current Mode</Label>
              <p className="text-sm text-muted-foreground">
                {settings.mode === 'online' 
                  ? 'Using remote terminology servers (tx.fhir.org)' 
                  : 'Using local Ontoserver with fallback'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={settings.mode === 'online' ? 'default' : 'secondary'} className="px-3 py-1">
                {settings.mode === 'online' ? (
                  <>
                    <Globe className="h-3 w-3 mr-1" />
                    Online
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3 w-3 mr-1" />
                    Offline
                  </>
                )}
              </Badge>
              <Switch
                checked={settings.mode === 'online'}
                onCheckedChange={(checked) => {
                  setSettings({
                    ...settings,
                    mode: checked ? 'online' : 'offline'
                  });
                }}
              />
            </div>
          </div>

          {/* Terminology Fallback Configuration */}
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-semibold">Terminology Server URLs</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="remote-url" className="text-sm">
                  Remote Server (tx.fhir.org)
                </Label>
                <Input
                  id="remote-url"
                  value={settings.terminologyFallback?.remote || 'https://tx.fhir.org/r4'}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      terminologyFallback: {
                        ...settings.terminologyFallback,
                        remote: e.target.value
                      }
                    });
                  }}
                  placeholder="https://tx.fhir.org/r4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="local-url" className="text-sm">
                  Local Server (Ontoserver)
                </Label>
                <Input
                  id="local-url"
                  value={settings.terminologyFallback?.local || 'http://localhost:8081/fhir'}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      terminologyFallback: {
                        ...settings.terminologyFallback,
                        local: e.target.value
                      }
                    });
                  }}
                  placeholder="http://localhost:8081/fhir"
                />
              </div>
            </div>
          </div>

          {/* Offline Mode Configuration */}
          {settings.mode === 'offline' && (
            <div className="space-y-3 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Offline Mode Configuration
                </Label>
              </div>
              
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  Offline mode requires a local Ontoserver installation. Validation will fall back to cached ValueSets and finally tx.fhir.org if local server is unavailable.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ontoserver-url" className="text-sm">
                    Ontoserver URL
                  </Label>
                  <Input
                    id="ontoserver-url"
                    value={settings.offlineConfig?.ontoserverUrl || 'http://localhost:8081/fhir'}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        offlineConfig: {
                          ...settings.offlineConfig,
                          ontoserverUrl: e.target.value
                        }
                      });
                    }}
                    placeholder="http://localhost:8081/fhir"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL of your local Ontoserver FHIR endpoint
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-cache" className="text-sm">
                    Profile Cache Path
                  </Label>
                  <Input
                    id="profile-cache"
                    value={settings.offlineConfig?.profileCachePath || '/opt/fhir/igs/'}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        offlineConfig: {
                          ...settings.offlineConfig,
                          profileCachePath: e.target.value
                        }
                      });
                    }}
                    placeholder="/opt/fhir/igs/"
                  />
                  <p className="text-xs text-muted-foreground">
                    Local path where FHIR Implementation Guide packages are stored
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FHIR Version & Resource Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Resource Type Filtering
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fhir-version">FHIR Version</Label>
              <Select
                value={fhirVersion}
                onValueChange={(value: FHIRVersion) => {
                  if (value !== originalFhirVersion) {
                    setShowMigrationWarning(true);
                  }
                  setFhirVersion(value);
                  updateResourceTypes('fhirVersion', value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select FHIR version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R4">R4</SelectItem>
                  <SelectItem value="R5">R5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="resource-filtering">Resource Type Filtering</Label>
              <Select
                value={settings.resourceTypes.enabled ? 'enabled' : 'disabled'}
                onValueChange={(value) => updateResourceTypes('enabled', value === 'enabled')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select filtering mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Disabled (Validate All)</SelectItem>
                  <SelectItem value="enabled">Enabled (Filter Types)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showMigrationWarning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>
                    <strong>FHIR Version Change Detected:</strong> You've changed from FHIR {originalFhirVersion} to FHIR {fhirVersion}.
                  </p>
                  <p>
                    This may affect your resource type filtering. Resource types that don't exist in FHIR {fhirVersion} will be automatically removed.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFhirVersion(originalFhirVersion);
                        updateResourceTypes('fhirVersion', originalFhirVersion);
                        setShowMigrationWarning(false);
                      }}
                    >
                      Revert to {originalFhirVersion}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowMigrationWarning(false)}
                    >
                      Continue with {fhirVersion}
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {settings.resourceTypes.enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Available Resource Types ({availableResourceTypes.length})</Label>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  FHIR {fhirVersion}
                </Badge>
              </div>
              
              {availableResourceTypes.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No resource types available for FHIR {fhirVersion}. Please check your FHIR server connection.
                  </AlertDescription>
                </Alert>
              )}
              
              {availableResourceTypes.length > 0 && (
                <>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                    <div className="flex flex-wrap gap-1">
                      {availableResourceTypes.map((type) => (
                        <Badge
                          key={type}
                          variant={settings.resourceTypes.includedTypes?.includes(type) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const included = settings.resourceTypes.includedTypes || [];
                            const newIncluded = included.includes(type)
                              ? included.filter(t => t !== type)
                              : [...included, type];
                            updateResourceTypes('includedTypes', newIncluded);
                          }}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {settings.resourceTypes.includedTypes && settings.resourceTypes.includedTypes.length === 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No resource types selected. All resources will be validated.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <p className="text-sm text-muted-foreground">
                    Click resource types to include/exclude them from validation
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Aspects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Validation Aspects
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(settings.aspects).map(([aspectKey, aspect]) => (
            <div key={aspectKey} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Switch
                  checked={aspect.enabled}
                  onCheckedChange={(checked) => updateAspect(aspectKey as keyof ValidationSettings['aspects'], 'enabled', checked)}
                />
                <div>
                  <Label className="font-medium capitalize">
                    {aspectKey.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {getAspectDescription(aspectKey)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={aspect.enabled ? 'default' : 'secondary'}>
                  {aspect.enabled ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {aspect.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                {aspect.enabled && (
                  <Select
                    value={aspect.severity}
                    onValueChange={(value: 'error' | 'warning' | 'info') => 
                      updateAspect(aspectKey as keyof ValidationSettings['aspects'], 'severity', value)
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-concurrent">Max Concurrent Validations</Label>
              <Select
                value={settings.performance.maxConcurrent.toString()}
                onValueChange={(value) => updatePerformance('maxConcurrent', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Number of resources to validate simultaneously
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <Select
                value={settings.performance.batchSize.toString()}
                onValueChange={(value) => updatePerformance('batchSize', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Number of resources to process in each batch
              </p>
            </div>
          </div>

          {/* Auto-Revalidation Option */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Auto-Revalidation</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically revalidate resources after editing
                </p>
              </div>
              <Switch
                checked={settings.autoRevalidateAfterEdit || false}
                onCheckedChange={(checked) => {
                  setSettings({
                    ...settings,
                    autoRevalidateAfterEdit: checked
                  });
                }}
              />
            </div>
            {settings.autoRevalidateAfterEdit && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 text-xs">
                  When enabled, resources will be automatically validated after any edit operation. 
                  This ensures validation results are always up-to-date but may increase server load.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAspectDescription(aspectKey: string): string {
  const descriptions: Record<string, string> = {
    structural: 'Validates FHIR resource structure and required fields',
    profile: 'Validates against FHIR profiles and extensions',
    terminology: 'Validates terminology bindings and code systems',
    reference: 'Validates resource references and relationships',
    businessRule: 'Validates business rules and constraints',
    metadata: 'Validates metadata and administrative information'
  };
  
  return descriptions[aspectKey] || 'Validation aspect';
}