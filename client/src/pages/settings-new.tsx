import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface ValidationSettings {
  structural: boolean;
  profile: boolean;
  terminology: boolean;
  reference: boolean;
  businessRule: boolean;
  metadata: boolean;
  strictMode: boolean;
  maxConcurrentValidations: number;
  timeoutMs: number;
  memoryLimitMB: number;
}

interface ServerSettings {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  authType: 'none' | 'basic' | 'bearer';
  username?: string;
  password?: string;
  token?: string;
}

interface DashboardSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  showResourceStats: boolean;
  showValidationProgress: boolean;
  showErrorSummary: boolean;
  showPerformanceMetrics: boolean;
  cardLayout: 'grid' | 'list';
  theme: 'light' | 'dark' | 'system';
}

interface SystemSettings {
  cacheDuration: number;
  maxCacheSize: number;
  enableMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableBackup: boolean;
  backupInterval: number;
}

// ============================================================================
// Main Settings Component
// ============================================================================

export default function SettingsNew() {
  const { toast } = useToast();
  
  // State for all settings
  const [validationSettings, setValidationSettings] = useState<ValidationSettings>({
    structural: true,
    profile: true,
    terminology: true,
    reference: true,
    businessRule: true,
    metadata: true,
    strictMode: false,
    maxConcurrentValidations: 8,
    timeoutMs: 30000,
    memoryLimitMB: 512
  });

  const [servers, setServers] = useState<ServerSettings[]>([]);

  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    autoRefresh: true,
    refreshInterval: 30,
    showResourceStats: true,
    showValidationProgress: true,
    showErrorSummary: true,
    showPerformanceMetrics: true,
    cardLayout: 'grid',
    theme: 'system'
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    cacheDuration: 300,
    maxCacheSize: 1000,
    enableMetrics: true,
    logLevel: 'info',
    enableBackup: false,
    backupInterval: 24
  });

  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load validation settings
      try {
        const validationResponse = await fetch('/api/validation/settings');
        if (validationResponse.ok) {
          const validationData = await validationResponse.json();
          if (validationData.settings) {
            setValidationSettings(validationData.settings);
          }
        } else {
          console.warn('Failed to load validation settings, using defaults');
        }
      } catch (error) {
        console.warn('Error loading validation settings, using defaults:', error);
      }

      // Load server settings
      try {
        const serversResponse = await fetch('/api/fhir/servers');
        if (serversResponse.ok) {
          const serversData = await serversResponse.json();
          console.log('[Settings] Loaded servers from API:', serversData);
          if (Array.isArray(serversData)) {
            // Transform the server data to match our interface
            const transformedServers = serversData.map((server: any) => ({
              id: server.id.toString(),
              name: server.name || 'Unnamed Server',
              url: server.url || '',
              isActive: server.isActive || false,
              authType: server.authConfig?.type || 'none',
              username: server.authConfig?.username || '',
              password: server.authConfig?.password || '',
              token: server.authConfig?.token || ''
            }));
            console.log('[Settings] Transformed servers:', transformedServers);
            setServers(transformedServers);
          }
        } else {
          console.error('[Settings] Failed to load servers:', serversResponse.status, serversResponse.statusText);
        }
      } catch (error) {
        console.error('[Settings] Error loading servers:', error);
      }

      // Load dashboard and system settings from localStorage for now
      const savedDashboard = localStorage.getItem('dashboard-settings');
      if (savedDashboard) {
        setDashboardSettings(JSON.parse(savedDashboard));
      }

      const savedSystem = localStorage.getItem('system-settings');
      if (savedSystem) {
        setSystemSettings(JSON.parse(savedSystem));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings. Using defaults.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      // Save validation settings
      try {
        const validationResponse = await fetch('/api/validation/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationSettings)
        });

        if (!validationResponse.ok) {
          console.warn('Failed to save validation settings, continuing with other settings');
        }
      } catch (error) {
        console.warn('Error saving validation settings:', error);
      }

      // Save server settings (update each server individually, excluding isActive)
      for (const server of servers) {
        const serverResponse = await fetch(`/api/fhir/servers/${server.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: server.name,
            url: server.url,
            // Note: isActive is handled separately through activate/deactivate endpoints
            authConfig: server.authType !== 'none' ? {
              type: server.authType,
              username: server.username,
              password: server.password,
              token: server.token
            } : null
          })
        });

        if (!serverResponse.ok) {
          throw new Error(`Failed to save server ${server.name}`);
        }
      }

      // Save dashboard and system settings to localStorage
      localStorage.setItem('dashboard-settings', JSON.stringify(dashboardSettings));
      localStorage.setItem('system-settings', JSON.stringify(systemSettings));

      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "All settings have been saved successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    loadSettings();
    setHasChanges(false);
    toast({
      title: "Settings Reset",
      description: "Settings have been reset to their last saved state.",
      variant: "default",
    });
  };

  const updateValidationSettings = (updates: Partial<ValidationSettings>) => {
    setValidationSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateDashboardSettings = (updates: Partial<DashboardSettings>) => {
    setDashboardSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateSystemSettings = (updates: Partial<SystemSettings>) => {
    setSystemSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const addServer = async () => {
    try {
      const response = await fetch('/api/fhir/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Server',
          url: '',
          isActive: false,
          authConfig: null
        })
      });

      if (response.ok) {
        const newServerData = await response.json();
        const newServer: ServerSettings = {
          id: newServerData.id.toString(),
          name: newServerData.name || 'New Server',
          url: newServerData.url || '',
          isActive: newServerData.isActive || false,
          authType: newServerData.authConfig?.type || 'none',
          username: newServerData.authConfig?.username || '',
          password: newServerData.authConfig?.password || '',
          token: newServerData.authConfig?.token || ''
        };
        setServers(prev => [...prev, newServer]);
        setHasChanges(true);
      } else {
        throw new Error('Failed to create new server');
      }
    } catch (error) {
      console.error('Failed to add server:', error);
      toast({
        title: "Error",
        description: "Failed to add new server. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateServer = async (id: string, updates: Partial<ServerSettings>) => {
    // Handle server activation/deactivation separately
    if (updates.isActive !== undefined) {
      try {
        if (updates.isActive) {
          // Radio button behavior: activate this server and deactivate all others
          const otherServers = servers.filter(server => server.id !== id && server.isActive);
          
          // Deactivate all other active servers first
          for (const server of otherServers) {
            const deactivateResponse = await fetch(`/api/fhir/servers/${server.id}/deactivate`, {
              method: 'POST'
            });
            if (!deactivateResponse.ok) {
              console.warn(`Failed to deactivate server ${server.name}`);
            }
          }
          
          // Then activate the selected server
          const activateResponse = await fetch(`/api/fhir/servers/${id}/activate`, {
            method: 'POST'
          });

          if (activateResponse.ok) {
            // Update local state: deactivate all others, activate the selected one (radio button behavior)
            setServers(prev => prev.map(server => ({
              ...server,
              isActive: server.id === id
            })));
            setHasChanges(true);
            toast({
              title: "Server Activated",
              description: `Server has been activated successfully.`,
              variant: "default",
            });
          } else {
            throw new Error('Failed to activate server');
          }
        } else {
          // Deactivating a server (just turn off this one)
          const deactivateResponse = await fetch(`/api/fhir/servers/${id}/deactivate`, {
            method: 'POST'
          });

          if (deactivateResponse.ok) {
            setServers(prev => prev.map(server => 
              server.id === id ? { ...server, isActive: false } : server
            ));
            setHasChanges(true);
            toast({
              title: "Server Deactivated",
              description: `Server has been deactivated successfully.`,
              variant: "default",
            });
          } else {
            throw new Error('Failed to deactivate server');
          }
        }
      } catch (error) {
        console.error('Failed to update server status:', error);
        toast({
          title: "Error",
          description: `Failed to ${updates.isActive ? 'activate' : 'deactivate'} server. Please try again.`,
          variant: "destructive",
        });
      }
    } else {
      // For other updates, just update the local state
      setServers(prev => prev.map(server => 
        server.id === id ? { ...server, ...updates } : server
      ));
      setHasChanges(true);
    }
  };

  const removeServer = async (id: string) => {
    try {
      const response = await fetch(`/api/fhir/servers/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setServers(prev => prev.filter(server => server.id !== id));
        setHasChanges(true);
        toast({
          title: "Server Removed",
          description: "Server has been successfully removed.",
          variant: "default",
        });
      } else {
        throw new Error('Failed to remove server');
      }
    } catch (error) {
      console.error('Failed to remove server:', error);
      toast({
        title: "Error",
        description: "Failed to remove server. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper function to get active server count
  const getActiveServerCount = () => {
    return servers.filter(server => server.isActive).length;
  };

  const testServerConnection = async (server: ServerSettings) => {
    try {
      const response = await fetch(`/api/fhir/connection/test-custom?url=${encodeURIComponent(server.url)}`);

      if (response.ok) {
        const result = await response.json();
        if (result.connected) {
          toast({
            title: "Connection Successful",
            description: `Successfully connected to ${server.name}`,
            variant: "default",
          });
        } else {
          throw new Error(result.error || 'Connection failed');
        }
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${server.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure validation engine, servers, dashboard, and system preferences
        </p>
      </div>

      {/* Save/Reset Actions */}
      <div className="mb-6 flex gap-2">
        <Button 
          onClick={saveSettings} 
          disabled={loading || !hasChanges}
          className="min-w-24"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button 
          variant="outline" 
          onClick={resetSettings}
          disabled={loading || !hasChanges}
        >
          Reset
        </Button>
        {hasChanges && (
          <Badge variant="secondary" className="ml-2">
            Unsaved Changes
          </Badge>
        )}
      </div>

      <Tabs defaultValue="validation" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Validation Settings Tab */}
        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation Engine Settings</CardTitle>
              <CardDescription>
                Configure the 6-aspect validation system for comprehensive FHIR compliance checking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Validation Aspects */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Validation Aspects</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="structural"
                      checked={validationSettings.structural}
                      onCheckedChange={(checked) => updateValidationSettings({ structural: checked })}
                    />
                    <Label htmlFor="structural">Structural Validation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="profile"
                      checked={validationSettings.profile}
                      onCheckedChange={(checked) => updateValidationSettings({ profile: checked })}
                    />
                    <Label htmlFor="profile">Profile Validation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="terminology"
                      checked={validationSettings.terminology}
                      onCheckedChange={(checked) => updateValidationSettings({ terminology: checked })}
                    />
                    <Label htmlFor="terminology">Terminology Validation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="reference"
                      checked={validationSettings.reference}
                      onCheckedChange={(checked) => updateValidationSettings({ reference: checked })}
                    />
                    <Label htmlFor="reference">Reference Validation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="businessRule"
                      checked={validationSettings.businessRule}
                      onCheckedChange={(checked) => updateValidationSettings({ businessRule: checked })}
                    />
                    <Label htmlFor="businessRule">Business Rule Validation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="metadata"
                      checked={validationSettings.metadata}
                      onCheckedChange={(checked) => updateValidationSettings({ metadata: checked })}
                    />
                    <Label htmlFor="metadata">Metadata Validation</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Validation Options */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Validation Options</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="strictMode"
                      checked={validationSettings.strictMode}
                      onCheckedChange={(checked) => updateValidationSettings({ strictMode: checked })}
                    />
                    <Label htmlFor="strictMode">Strict Mode (Enhanced Validation Rigor)</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Performance Settings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="maxConcurrent">Max Concurrent Validations</Label>
                    <Input
                      id="maxConcurrent"
                      type="number"
                      value={validationSettings.maxConcurrentValidations}
                      onChange={(e) => updateValidationSettings({ 
                        maxConcurrentValidations: parseInt(e.target.value) || 8 
                      })}
                      min="1"
                      max="32"
                    />
                  </div>
                  <div>
                    <Label htmlFor="timeout">Timeout (ms)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={validationSettings.timeoutMs}
                      onChange={(e) => updateValidationSettings({ 
                        timeoutMs: parseInt(e.target.value) || 30000 
                      })}
                      min="1000"
                      max="300000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
                    <Input
                      id="memoryLimit"
                      type="number"
                      value={validationSettings.memoryLimitMB}
                      onChange={(e) => updateValidationSettings({ 
                        memoryLimitMB: parseInt(e.target.value) || 512 
                      })}
                      min="128"
                      max="2048"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>FHIR Server Management</CardTitle>
              <CardDescription>
                Manage connections to FHIR servers for validation and resource access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Configured Servers</h3>
                  <p className="text-sm text-muted-foreground">Select one server to activate (others will be deactivated automatically)</p>
                </div>
                <Button onClick={addServer} size="sm">
                  Add Server
                </Button>
              </div>

              {getActiveServerCount() > 1 && (
                <Alert>
                  <AlertDescription>
                    Warning: Multiple servers are active. The switches should behave like radio buttons - 
                    selecting one should automatically deselect all others.
                  </AlertDescription>
                </Alert>
              )}

              {servers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No servers configured yet.</p>
                  <p className="text-sm">Click "Add Server" to get started.</p>
                </div>
              ) : (
                servers.map((server, index) => (
                <Card key={server.id} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={server.isActive}
                          onCheckedChange={(checked) => updateServer(server.id, { isActive: checked })}
                        />
                        <Label className="font-medium">{server.name}</Label>
                        {server.isActive && <Badge variant="default">Active</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testServerConnection(server)}
                        >
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeServer(server.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`name-${server.id}`}>Server Name</Label>
                        <Input
                          id={`name-${server.id}`}
                          value={server.name}
                          onChange={(e) => updateServer(server.id, { name: e.target.value })}
                          placeholder="Enter server name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`url-${server.id}`}>Server URL</Label>
                        <Input
                          id={`url-${server.id}`}
                          value={server.url}
                          onChange={(e) => updateServer(server.id, { url: e.target.value })}
                          placeholder="https://example.com/fhir"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`auth-${server.id}`}>Authentication Type</Label>
                      <Select
                        value={server.authType}
                        onValueChange={(value: 'none' | 'basic' | 'bearer') => 
                          updateServer(server.id, { authType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {server.authType === 'basic' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`username-${server.id}`}>Username</Label>
                          <Input
                            id={`username-${server.id}`}
                            type="text"
                            value={server.username || ''}
                            onChange={(e) => updateServer(server.id, { username: e.target.value })}
                            placeholder="Enter username"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`password-${server.id}`}>Password</Label>
                          <Input
                            id={`password-${server.id}`}
                            type="password"
                            value={server.password || ''}
                            onChange={(e) => updateServer(server.id, { password: e.target.value })}
                            placeholder="Enter password"
                          />
                        </div>
                      </div>
                    )}

                    {server.authType === 'bearer' && (
                      <div>
                        <Label htmlFor={`token-${server.id}`}>Bearer Token</Label>
                        <Input
                          id={`token-${server.id}`}
                          type="password"
                          value={server.token || ''}
                          onChange={(e) => updateServer(server.id, { token: e.target.value })}
                          placeholder="Enter bearer token"
                        />
                      </div>
                    )}
                  </div>
                </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Customization</CardTitle>
              <CardDescription>
                Customize dashboard appearance, layout, and data display preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-refresh Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Auto-refresh Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoRefresh"
                      checked={dashboardSettings.autoRefresh}
                      onCheckedChange={(checked) => updateDashboardSettings({ autoRefresh: checked })}
                    />
                    <Label htmlFor="autoRefresh">Enable Auto-refresh</Label>
                  </div>
                  {dashboardSettings.autoRefresh && (
                    <div>
                      <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                      <Input
                        id="refreshInterval"
                        type="number"
                        value={dashboardSettings.refreshInterval}
                        onChange={(e) => updateDashboardSettings({ 
                          refreshInterval: parseInt(e.target.value) || 30 
                        })}
                        min="5"
                        max="300"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Card Visibility */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Card Visibility</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showResourceStats"
                      checked={dashboardSettings.showResourceStats}
                      onCheckedChange={(checked) => updateDashboardSettings({ showResourceStats: checked })}
                    />
                    <Label htmlFor="showResourceStats">Resource Statistics</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showValidationProgress"
                      checked={dashboardSettings.showValidationProgress}
                      onCheckedChange={(checked) => updateDashboardSettings({ showValidationProgress: checked })}
                    />
                    <Label htmlFor="showValidationProgress">Validation Progress</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showErrorSummary"
                      checked={dashboardSettings.showErrorSummary}
                      onCheckedChange={(checked) => updateDashboardSettings({ showErrorSummary: checked })}
                    />
                    <Label htmlFor="showErrorSummary">Error Summary</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showPerformanceMetrics"
                      checked={dashboardSettings.showPerformanceMetrics}
                      onCheckedChange={(checked) => updateDashboardSettings({ showPerformanceMetrics: checked })}
                    />
                    <Label htmlFor="showPerformanceMetrics">Performance Metrics</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Layout Preferences */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Layout Preferences</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cardLayout">Card Layout</Label>
                    <Select
                      value={dashboardSettings.cardLayout}
                      onValueChange={(value: 'grid' | 'list') => 
                        updateDashboardSettings({ cardLayout: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid Layout</SelectItem>
                        <SelectItem value="list">List Layout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={dashboardSettings.theme}
                      onValueChange={(value: 'light' | 'dark' | 'system') => 
                        updateDashboardSettings({ theme: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Configure system performance, caching, and operational settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Performance Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Performance Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cacheDuration">Cache Duration (seconds)</Label>
                    <Input
                      id="cacheDuration"
                      type="number"
                      value={systemSettings.cacheDuration}
                      onChange={(e) => updateSystemSettings({ 
                        cacheDuration: parseInt(e.target.value) || 300 
                      })}
                      min="60"
                      max="3600"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxCacheSize">Max Cache Size (MB)</Label>
                    <Input
                      id="maxCacheSize"
                      type="number"
                      value={systemSettings.maxCacheSize}
                      onChange={(e) => updateSystemSettings({ 
                        maxCacheSize: parseInt(e.target.value) || 1000 
                      })}
                      min="100"
                      max="10000"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Monitoring Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Monitoring Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableMetrics"
                      checked={systemSettings.enableMetrics}
                      onCheckedChange={(checked) => updateSystemSettings({ enableMetrics: checked })}
                    />
                    <Label htmlFor="enableMetrics">Enable Performance Metrics</Label>
                  </div>
                  <div>
                    <Label htmlFor="logLevel">Log Level</Label>
                    <Select
                      value={systemSettings.logLevel}
                      onValueChange={(value: 'error' | 'warn' | 'info' | 'debug') => 
                        updateSystemSettings({ logLevel: value })
                      }
                    >
                      <SelectTrigger>
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
                </div>
              </div>

              <Separator />

              {/* Backup Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Backup Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableBackup"
                      checked={systemSettings.enableBackup}
                      onCheckedChange={(checked) => updateSystemSettings({ enableBackup: checked })}
                    />
                    <Label htmlFor="enableBackup">Enable Automatic Backup</Label>
                  </div>
                  {systemSettings.enableBackup && (
                    <div>
                      <Label htmlFor="backupInterval">Backup Interval (hours)</Label>
                      <Input
                        id="backupInterval"
                        type="number"
                        value={systemSettings.backupInterval}
                        onChange={(e) => updateSystemSettings({ 
                          backupInterval: parseInt(e.target.value) || 24 
                        })}
                        min="1"
                        max="168"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* System Actions */}
              <div>
                <h3 className="text-lg font-semibold mb-4">System Actions</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Clear Cache
                  </Button>
                  <Button variant="outline" size="sm">
                    Export Data
                  </Button>
                  <Button variant="outline" size="sm">
                    System Health Check
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
