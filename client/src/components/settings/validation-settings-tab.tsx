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
  HardDrive,
  Info
} from 'lucide-react';
import type { 
  ValidationSettings, 
  ValidationSettingsUpdate,
  FHIRVersion,
  TerminologyServer
} from '@shared/validation-settings';
import { TerminologyServerList } from './servers';
import { DEFAULT_TERMINOLOGY_SERVERS } from '@shared/validation-settings';

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
  const [resourceTypesSource, setResourceTypesSource] = useState<'server' | 'static' | 'filtered' | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [showMigrationWarning, setShowMigrationWarning] = useState(false);
  const [originalFhirVersion, setOriginalFhirVersion] = useState<FHIRVersion>('R4');
  const [showModeConfirmDialog, setShowModeConfirmDialog] = useState(false);
  const [pendingMode, setPendingMode] = useState<'online' | 'offline' | null>(null);

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
        // Handle ApiResponse.success() wrapper format
        const resourceTypes = data.success && data.data 
          ? data.data.resourceTypes 
          : data.resourceTypes;
        
        setAvailableResourceTypes(resourceTypes || []);
        
        // Store server integration info
        if (data.data?.source) {
          setResourceTypesSource(data.data.source);
          setServerVersion(data.data.serverVersion || null);
          
          console.log(`[Resource Types] Source: ${data.data.source}, Server Version: ${data.data.serverVersion || 'N/A'}`);
          if (data.data.source === 'filtered') {
            console.log(`[Resource Types] Filtered ${data.data.totalServerTypes} server types to ${data.data.filteredCount} for FHIR ${version}`);
          }
        } else if (data.source) {
          // Handle non-wrapped response format
          setResourceTypesSource(data.source);
          setServerVersion(data.serverVersion || null);
        }
      } else {
        console.error('Failed to load resource types:', response.statusText);
        toast({
          title: 'Error',
          description: 'Failed to load available resource types',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error loading resource types:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to server for resource types',
        variant: 'destructive'
      });
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      const serverId = activeServer?.id;
      const url = `/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`;
      
      console.log('[ValidationSettings] Saving settings:', {
        url,
        serverId,
        settings,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      console.log('[ValidationSettings] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ValidationSettings] Save failed:', errorData);
        throw new Error(errorData.message || 'Failed to save settings');
      }
      
      // Check if response has content before parsing
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      console.log('[ValidationSettings] Response details:', {
        contentType,
        contentLength,
        hasContent: contentLength && parseInt(contentLength) > 0
      });
      
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[ValidationSettings] Response is not JSON:', contentType);
        const text = await response.text();
        console.log('[ValidationSettings] Response text:', text);
        // Still show success since status is 200
        toast({
          title: 'Success',
          description: 'Validation settings saved successfully'
        });
        return;
      }
      
      // Check if response body is empty
      if (!contentLength || parseInt(contentLength) === 0) {
        console.warn('[ValidationSettings] Response body is empty (Content-Length: 0)');
        toast({
          title: 'Success',
          description: 'Validation settings saved successfully'
        });
        return;
      }
      
      const result = await response.json().catch((err) => {
        console.error('[ValidationSettings] Failed to parse JSON:', err);
        // Still show success since status is 200
        return null;
      });
      console.log('[ValidationSettings] Save successful:', result);
      
      toast({
        title: 'Success',
        description: 'Validation settings saved successfully'
      });
    } catch (error) {
      console.error('[ValidationSettings] Error saving settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save validation settings',
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

  const confirmModeChange = () => {
    if (pendingMode && settings) {
      setSettings({
        ...settings,
        mode: pendingMode
      });
      toast({
        title: 'Mode Changed',
        description: `Validation mode switched to ${pendingMode}`
      });
    }
    setShowModeConfirmDialog(false);
    setPendingMode(null);
  };

  const cancelModeChange = () => {
    setShowModeConfirmDialog(false);
    setPendingMode(null);
  };

  return (
    <div className="space-y-6">
      {/* Mode Change Confirmation Dialog */}
      <AlertDialog open={showModeConfirmDialog} onOpenChange={setShowModeConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm Mode Change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                {pendingMode === 'online' ? (
                  <>
                    <p className="text-sm">You are switching to <strong>Online Mode</strong>.</p>
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                      <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Online Mode will:</div>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                        <li>Use remote terminology servers (tx.fhir.org)</li>
                        <li>Require active internet connection</li>
                        <li>Provide access to latest CodeSystems and ValueSets</li>
                        <li>May have slightly higher latency</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm">You are switching to <strong>Offline Mode</strong>.</p>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                      <div className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">Offline Mode will:</div>
                      <ul className="text-sm text-green-800 dark:text-green-200 space-y-1 ml-4 list-disc">
                        <li>Use local Ontoserver instance</li>
                        <li>Work without internet connection</li>
                        <li>Provide faster terminology validation</li>
                        <li>Fallback to cached ValueSets if Ontoserver unavailable</li>
                      </ul>
                    </div>
                  </>
                )}
                <Alert className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Active validations will use the new mode after the switch. Results may vary between modes.
                  </AlertDescription>
                </Alert>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelModeChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmModeChange}>
              Confirm Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Validation Settings</h2>
          <p className="text-muted-foreground mt-1">
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
              <HardDrive className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            )}
            Validation Mode
          </CardTitle>
          <CardDescription>
            Switch between online (remote terminology servers) and offline (local Ontoserver) validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Current Mode</Label>
              <p className="text-sm text-muted-foreground">
                {settings.mode === 'online' 
                  ? 'Using remote terminology servers (tx.fhir.org)' 
                  : 'Using local Ontoserver with fallback'}
              </p>
            </div>
            
            {/* Tab-like Toggle */}
            <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  if (settings.mode !== 'online') {
                    setPendingMode('online');
                    setShowModeConfirmDialog(true);
                  }
                }}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all
                  ${settings.mode === 'online' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Globe className="h-4 w-4" />
                Online
              </button>
              <button
                type="button"
                onClick={() => {
                  if (settings.mode !== 'offline') {
                    setPendingMode('offline');
                    setShowModeConfirmDialog(true);
                  }
                }}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all
                  ${settings.mode === 'offline' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }
                `}
              >
                <HardDrive className="h-4 w-4" />
                Offline
              </button>
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
              
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-200">
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

      {/* Task 4.13: Profile Sources Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Profile Sources
          </CardTitle>
          <CardDescription>
            Configure where to load profile packages from
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-sources">Source Priority</Label>
            <Select
              value={settings.profileSources || 'both'}
              onValueChange={(value: 'local' | 'simplifier' | 'both') => {
                setSettings({
                  ...settings,
                  profileSources: value
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select profile sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span>Local Cache Only</span>
                  </div>
                </SelectItem>
                <SelectItem value="simplifier">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span>Simplifier.net Only</span>
                  </div>
                </SelectItem>
                <SelectItem value="both">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Both (Local → Simplifier)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {settings.profileSources === 'local' && 
                'Use only locally cached profile packages. Fast but requires manual installation.'}
              {settings.profileSources === 'simplifier' && 
                'Fetch profiles directly from Simplifier.net. Always up-to-date but requires internet.'}
              {(!settings.profileSources || settings.profileSources === 'both') && 
                'Try local cache first, then fetch from Simplifier.net if not found. Best of both worlds.'}
            </p>
          </div>
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
                <div className="flex items-center gap-2">
                  <Label>Available Resource Types ({availableResourceTypes.length})</Label>
                  {resourceTypesSource && (
                    <Badge 
                      variant={resourceTypesSource === 'filtered' ? 'default' : 'secondary'}
                      className="flex items-center gap-1 text-xs"
                    >
                      {resourceTypesSource === 'filtered' && <Database className="h-3 w-3" />}
                      {resourceTypesSource === 'static' && <HardDrive className="h-3 w-3" />}
                      {resourceTypesSource === 'filtered' ? 'From Server' : 'Static List'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {serverVersion && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Server className="h-3 w-3" />
                      Server: {serverVersion}
                    </Badge>
                  )}
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    FHIR {fhirVersion}
                  </Badge>
                </div>
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
                <Badge 
                  variant={aspect.enabled ? 'default' : 'secondary'}
                  className={aspect.enabled ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                >
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
                    onValueChange={(value: 'inherit' | 'error' | 'warning' | 'info') => 
                      updateAspect(aspectKey as keyof ValidationSettings['aspects'], 'severity', value)
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-gray-500" />
                          <span>Inherit</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="error">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span>Error</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="warning">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span>Warning</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-500" />
                          <span>Info</span>
                        </div>
                      </SelectItem>
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
                value={(settings.performance?.maxConcurrent || 4).toString()}
                onValueChange={(value) => updatePerformance('maxConcurrent', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select concurrent validations" />
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
                value={(settings.performance?.batchSize || 50).toString()}
                onValueChange={(value) => updatePerformance('batchSize', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select batch size" />
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
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                  When enabled, resources will be automatically validated after any edit operation. 
                  This ensures validation results are always up-to-date but may increase server load.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Best Practice Recommendations */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Best Practice Recommendations</Label>
                <p className="text-sm text-muted-foreground">
                  Show FHIR best practice recommendations (e.g., narrative text, domain-6 constraints)
                </p>
              </div>
              <Switch
                checked={settings.enableBestPracticeChecks ?? true}
                onCheckedChange={(checked) => {
                  setSettings({
                    ...settings,
                    enableBestPracticeChecks: checked
                  });
                }}
              />
            </div>
            {settings.enableBestPracticeChecks && (
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                  When enabled, the validator will check for FHIR best practices like narrative text presence, 
                  proper metadata, and other recommendations from the FHIR specification. These appear as warnings or info messages.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* $validate Operation Toggle */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Use $validate Operation</Label>
                <p className="text-sm text-muted-foreground">
                  Use FHIR server's native $validate operation if available
                </p>
              </div>
              <Switch
                checked={settings.useFhirValidateOperation || false}
                onCheckedChange={(checked) => {
                  setSettings({
                    ...settings,
                    useFhirValidateOperation: checked
                  });
                }}
              />
            </div>
            {settings.useFhirValidateOperation && (
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                  When enabled, validation will use the FHIR server's $validate operation when supported. 
                  Falls back to local HAPI validator if not available.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Terminology Servers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Terminology Servers
          </CardTitle>
          <CardDescription>
            Configure multiple terminology servers with automatic fallback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TerminologyServerList
            servers={settings.terminologyServers || DEFAULT_TERMINOLOGY_SERVERS}
            onChange={(servers: TerminologyServer[]) => {
              setSettings({
                ...settings,
                terminologyServers: servers
              });
            }}
            onSave={saveSettings}
          />
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