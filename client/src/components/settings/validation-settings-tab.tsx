/**
 * Validation Settings Tab
 * 
 * Modular validation settings interface following Cursor Rules (max 250-300 lines)
 * Uses section components for better maintainability and code quality
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  Loader2,
  Save,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import type { 
  ValidationSettings,
  FHIRVersion,
  TerminologyServer
} from '@shared/validation-settings';
import { TerminologyServerList } from './servers';
import { DEFAULT_TERMINOLOGY_SERVERS } from '@shared/validation-settings';

// Section Components
import { ValidationModeSection } from './sections/ValidationModeSection';
import { ProfileSourcesSection } from './sections/ProfileSourcesSection';
import { ResourceTypesSection } from './sections/ResourceTypesSection';
import { ValidationAspectsSection } from './sections/ValidationAspectsSection';
import { PerformanceSection } from './sections/PerformanceSection';

// ============================================================================
// Component
// ============================================================================

export function ValidationSettingsTab() {
  const { toast } = useToast();
  const { activeServer } = useActiveServer();
  
  // State
  const [settings, setSettings] = useState<ValidationSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<ValidationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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
      setOriginalSettings(JSON.parse(JSON.stringify(data))); // Deep copy
      
      // Extract FHIR version from settings or default to R4
      if (data.resourceTypes?.fhirVersion) {
        setFhirVersion(data.resourceTypes.fhirVersion);
        setOriginalFhirVersion(data.resourceTypes.fhirVersion);
      }
      
      // Mark initial load complete
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load validation settings',
        variant: 'destructive'
      });
      setIsInitialLoad(false);
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
      
      // Update original settings after successful save
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
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
      setOriginalSettings(JSON.parse(JSON.stringify(data))); // Update original after reset
      
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

  const updateAspect = (aspectKey: keyof ValidationSettings['aspects'], field: 'enabled' | 'severity' | 'engine', value: any) => {
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

  const updateResourceTypes = (field: string, value: any) => {
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

  // Handler functions for section components
  const handleModeChange = (mode: 'online' | 'offline') => {
    setPendingMode(mode);
    setShowModeConfirmDialog(true);
  };

  const handleTerminologyUrlUpdate = (field: 'remote' | 'local', value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      terminologyFallback: {
        ...settings.terminologyFallback,
        [field]: value
      }
    });
  };

  const handleOfflineConfigUpdate = (field: 'ontoserverUrl' | 'profileCachePath', value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      offlineConfig: {
        ...settings.offlineConfig,
        [field]: value
      }
    });
  };

  const handleProfileSourcesUpdate = (value: 'local' | 'simplifier' | 'both') => {
    if (!settings) return;
    setSettings({ ...settings, profileSources: value });
  };

  const handleFhirVersionChange = (version: FHIRVersion) => {
    if (version !== originalFhirVersion) {
      setShowMigrationWarning(true);
    }
    setFhirVersion(version);
    updateResourceTypes('fhirVersion', version);
  };

  const handleFilteringToggle = (enabled: boolean) => {
    updateResourceTypes('enabled', enabled);
  };

  const handleResourceTypesUpdate = (types: string[]) => {
    updateResourceTypes('includedTypes', types);
  };

  const handleMigrationWarningClose = () => {
    setShowMigrationWarning(false);
  };

  const handleRevertVersion = () => {
    setFhirVersion(originalFhirVersion);
    updateResourceTypes('fhirVersion', originalFhirVersion);
    setShowMigrationWarning(false);
  };

  const handlePerformanceUpdate = (field: keyof ValidationSettings['performance'], value: number) => {
    updatePerformance(field, value);
  };

  const handleSettingsUpdate = (updates: Partial<ValidationSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
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

      {/* Sections */}
      <ValidationModeSection
        settings={settings}
        onModeChange={handleModeChange}
        onTerminologyUrlUpdate={handleTerminologyUrlUpdate}
        onOfflineConfigUpdate={handleOfflineConfigUpdate}
      />

      <ProfileSourcesSection
        settings={settings}
        onUpdate={handleProfileSourcesUpdate}
      />

      <ResourceTypesSection
        settings={settings}
        fhirVersion={fhirVersion}
        availableResourceTypes={availableResourceTypes}
        resourceTypesSource={resourceTypesSource}
        serverVersion={serverVersion}
        showMigrationWarning={showMigrationWarning}
        originalFhirVersion={originalFhirVersion}
        onFhirVersionChange={handleFhirVersionChange}
        onFilteringToggle={handleFilteringToggle}
        onResourceTypesUpdate={handleResourceTypesUpdate}
        onMigrationWarningClose={handleMigrationWarningClose}
        onRevertVersion={handleRevertVersion}
      />

      <ValidationAspectsSection
        settings={settings}
        onUpdate={updateAspect}
      />

      <PerformanceSection
        settings={settings}
        onPerformanceUpdate={handlePerformanceUpdate}
        onSettingsUpdate={handleSettingsUpdate}
      />

      {/* Terminology Servers */}
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
    </div>
  );
}
