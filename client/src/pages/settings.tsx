import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  Settings, 
  Server, 
  Database, 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Globe,
  Power,
  PowerOff,
  Edit,
  Trash2,
  Plus,
  Save,
  RefreshCw,
  TestTube,
  Shield
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ValidationSettings {
  structural: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  profile: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  terminology: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  reference: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  businessRule: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  metadata: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
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
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  dataRetentionDays: number;
  maxLogFileSize: number;
  enableAutoUpdates: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  
  // State management
  const [validationSettings, setValidationSettings] = useState<ValidationSettings>({
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'information' },
    strictMode: false,
    maxConcurrentValidations: 8,
    timeoutMs: 30000,
    memoryLimitMB: 512,
  });

  const [servers, setServers] = useState<ServerSettings[]>([]);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    autoRefresh: true,
    refreshInterval: 30,
    showResourceStats: true,
    showValidationProgress: true,
    showErrorSummary: true,
    showPerformanceMetrics: false,
    cardLayout: 'grid',
    theme: 'system',
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    logLevel: 'info',
    enableAnalytics: true,
    enableCrashReporting: true,
    dataRetentionDays: 30,
    maxLogFileSize: 100,
    enableAutoUpdates: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('validation');

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Load validation settings
      try {
        const response = await fetch('/api/validation/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings) {
            setValidationSettings(data.settings);
          }
        }
      } catch (error) {
        console.warn('Failed to load validation settings, using defaults');
      }

      // Load servers
      try {
        const response = await fetch('/api/fhir/servers');
        if (response.ok) {
          const data = await response.json();
          setServers(data.map((server: any) => ({
            id: server.id.toString(),
            name: server.name,
            url: server.url,
            isActive: server.isActive,
            authType: server.authConfig?.type || 'none',
            username: server.authConfig?.username || '',
            password: server.authConfig?.password || '',
            token: server.authConfig?.token || '',
          })));
        }
      } catch (error) {
        console.warn('Failed to load servers, using defaults');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      // Save validation settings
      try {
        const response = await fetch('/api/validation/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationSettings),
        });
        if (!response.ok) {
          console.warn('Failed to save validation settings, continuing with other settings');
        }
      } catch (error) {
        console.warn('Failed to save validation settings, continuing with other settings');
      }

      // Save server settings
      for (const server of servers) {
        try {
          const response = await fetch(`/api/fhir/servers/${server.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: server.name,
              url: server.url,
              authConfig: server.authType === 'none' ? null : {
                type: server.authType,
                username: server.username,
                password: server.password,
                token: server.token,
              },
            }),
          });
          if (!response.ok) {
            console.warn(`Failed to save server ${server.name}`);
          }
        } catch (error) {
          console.warn(`Failed to save server ${server.name}`);
        }
      }

      toast({
        title: "Settings Saved",
        description: "Your settings have been saved successfully.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateValidationSettings = (updates: Partial<ValidationSettings>) => {
    setValidationSettings(prev => ({ ...prev, ...updates }));
  };

  const updateServer = async (id: string, updates: Partial<ServerSettings>) => {
    const server = servers.find(s => s.id === id);
    if (!server) return;

    // Handle radio button behavior for server activation
    if (updates.isActive === true) {
      // Deactivate all other servers first
      for (const otherServer of servers) {
        if (otherServer.id !== id && otherServer.isActive) {
          try {
            await fetch(`/api/fhir/servers/${otherServer.id}/deactivate`, { method: 'POST' });
          } catch (error) {
            console.warn(`Failed to deactivate server ${otherServer.name}`);
          }
        }
      }
      
      // Activate the selected server
      try {
        await fetch(`/api/fhir/servers/${id}/activate`, { method: 'POST' });
        toast({
          title: "Server Activated",
          description: `Other servers were deactivated automatically.`,
        });
      } catch (error) {
        console.warn(`Failed to activate server ${server.name}`);
        return;
      }
    } else if (updates.isActive === false) {
      // Deactivate the server
      try {
        await fetch(`/api/fhir/servers/${id}/deactivate`, { method: 'POST' });
      } catch (error) {
        console.warn(`Failed to deactivate server ${server.name}`);
        return;
      }
    }

    // Update local state
    setServers(prev => prev.map(s => 
      s.id === id 
        ? { ...s, ...updates }
        : updates.isActive === true 
          ? { ...s, isActive: false } // Deactivate others when one is activated
          : s
    ));
  };

  const addServer = async () => {
    const newServer: ServerSettings = {
      id: Date.now().toString(),
      name: 'New Server',
      url: 'https://example.com/fhir',
      isActive: false,
      authType: 'none',
    };

    try {
      const response = await fetch('/api/fhir/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newServer.url,
          authConfig: null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setServers(prev => [...prev, { ...newServer, id: data.id.toString() }]);
        toast({
          title: "Server Added",
          description: "New server has been added successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add server.",
        variant: "destructive",
      });
    }
  };

  const removeServer = async (id: string) => {
    try {
      const response = await fetch(`/api/fhir/servers/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setServers(prev => prev.filter(s => s.id !== id));
        toast({
          title: "Server Removed",
          description: "Server has been removed successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove server.",
        variant: "destructive",
      });
    }
  };

  const testServerConnection = async (server: ServerSettings) => {
    try {
      const response = await fetch(`/api/fhir/connection/test-custom?url=${encodeURIComponent(server.url)}`);
      const data = await response.json();
      
      if (data.connected) {
        toast({
          title: "Connection Successful",
          description: `Successfully connected to ${server.name}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect to server",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to test server connection",
        variant: "destructive",
      });
    }
  };

  const getActiveServerCount = () => {
    return servers.filter(s => s.isActive).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Settings className="h-8 w-8" />
                Settings
              </h1>
              <p className="text-muted-foreground mt-2">
                Configure your FHIR Records Management Platform
              </p>
            </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadSettings} disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={saveSettings} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="validation" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Validation
            </TabsTrigger>
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Servers
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Validation Tab */}
          <TabsContent value="validation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Validation Engine Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Validation Aspects</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="structural">Structural Validation</Label>
                        <Switch
                          id="structural"
                          checked={validationSettings.structural.enabled}
                          onCheckedChange={(checked) => updateValidationSettings({ 
                            structural: { ...validationSettings.structural, enabled: checked }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="profile">Profile Validation</Label>
                        <Switch
                          id="profile"
                          checked={validationSettings.profile.enabled}
                          onCheckedChange={(checked) => updateValidationSettings({ 
                            profile: { ...validationSettings.profile, enabled: checked }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="terminology">Terminology Validation</Label>
                        <Switch
                          id="terminology"
                          checked={validationSettings.terminology.enabled}
                          onCheckedChange={(checked) => updateValidationSettings({ 
                            terminology: { ...validationSettings.terminology, enabled: checked }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="reference">Reference Validation</Label>
                        <Switch
                          id="reference"
                          checked={validationSettings.reference.enabled}
                          onCheckedChange={(checked) => updateValidationSettings({ 
                            reference: { ...validationSettings.reference, enabled: checked }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="businessRule">Business Rule Validation</Label>
                        <Switch
                          id="businessRule"
                          checked={validationSettings.businessRule.enabled}
                          onCheckedChange={(checked) => updateValidationSettings({ 
                            businessRule: { ...validationSettings.businessRule, enabled: checked }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="metadata">Metadata Validation</Label>
                        <Switch
                          id="metadata"
                          checked={validationSettings.metadata.enabled}
                          onCheckedChange={(checked) => updateValidationSettings({ 
                            metadata: { ...validationSettings.metadata, enabled: checked }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Performance Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="strictMode">Strict Mode</Label>
                        <Switch
                          id="strictMode"
                          checked={validationSettings.strictMode}
                          onCheckedChange={(checked) => updateValidationSettings({ strictMode: checked })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxConcurrent">Max Concurrent Validations</Label>
                        <Input
                          id="maxConcurrent"
                          type="number"
                          value={validationSettings.maxConcurrentValidations}
                          onChange={(e) => updateValidationSettings({ maxConcurrentValidations: parseInt(e.target.value) || 8 })}
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
                          onChange={(e) => updateValidationSettings({ timeoutMs: parseInt(e.target.value) || 30000 })}
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
                          onChange={(e) => updateValidationSettings({ memoryLimitMB: parseInt(e.target.value) || 512 })}
                          min="128"
                          max="4096"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Servers Tab - Using sidebar modal design */}
          <TabsContent value="servers" className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Manage FHIR Servers</h3>
                <Button 
                  onClick={addServer} 
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Server
                </Button>
              </div>
              
              <div className="space-y-3">
                {servers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Server className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No FHIR servers configured</p>
                    <p className="text-sm">Add your first server to get started</p>
                  </div>
                ) : (
                  servers.map((server) => (
                    <Card key={server.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${server.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <div>
                              <h4 className="font-medium flex items-center gap-2">
                                {server.name}
                              </h4>
                              <p className="text-sm text-gray-600">{server.url}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {server.isActive && (
                              <Badge variant="default">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testServerConnection(server)}
                            >
                              <TestTube className="h-3 w-3 mr-1" />
                              Test
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => updateServer(server.id, { isActive: !server.isActive })}
                              className="flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            {server.isActive ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => updateServer(server.id, { isActive: false })}
                                className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                              >
                                <PowerOff className="h-3 w-3" />
                                Disconnect
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => updateServer(server.id, { isActive: true })}
                                className="flex items-center gap-1 text-green-600 hover:text-green-700"
                              >
                                <Power className="h-3 w-3" />
                                Connect
                              </Button>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => removeServer(server.id)}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Display Options</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="autoRefresh">Auto Refresh</Label>
                        <Switch
                          id="autoRefresh"
                          checked={dashboardSettings.autoRefresh}
                          onCheckedChange={(checked) => setDashboardSettings(prev => ({ ...prev, autoRefresh: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showResourceStats">Show Resource Stats</Label>
                        <Switch
                          id="showResourceStats"
                          checked={dashboardSettings.showResourceStats}
                          onCheckedChange={(checked) => setDashboardSettings(prev => ({ ...prev, showResourceStats: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showValidationProgress">Show Validation Progress</Label>
                        <Switch
                          id="showValidationProgress"
                          checked={dashboardSettings.showValidationProgress}
                          onCheckedChange={(checked) => setDashboardSettings(prev => ({ ...prev, showValidationProgress: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Layout & Theme</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="cardLayout">Card Layout</Label>
                        <Select
                          value={dashboardSettings.cardLayout}
                          onValueChange={(value: 'grid' | 'list') => 
                            setDashboardSettings(prev => ({ ...prev, cardLayout: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grid">Grid</SelectItem>
                            <SelectItem value="list">List</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="theme">Theme</Label>
                        <Select
                          value={dashboardSettings.theme}
                          onValueChange={(value: 'light' | 'dark' | 'system') => 
                            setDashboardSettings(prev => ({ ...prev, theme: value }))
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Logging & Analytics</h3>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="logLevel">Log Level</Label>
                        <Select
                          value={systemSettings.logLevel}
                          onValueChange={(value: 'debug' | 'info' | 'warn' | 'error') => 
                            setSystemSettings(prev => ({ ...prev, logLevel: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debug">Debug</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warn">Warning</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enableAnalytics">Enable Analytics</Label>
                        <Switch
                          id="enableAnalytics"
                          checked={systemSettings.enableAnalytics}
                          onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, enableAnalytics: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enableCrashReporting">Enable Crash Reporting</Label>
                        <Switch
                          id="enableCrashReporting"
                          checked={systemSettings.enableCrashReporting}
                          onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, enableCrashReporting: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Data & Updates</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="dataRetention">Data Retention (days)</Label>
                        <Input
                          id="dataRetention"
                          type="number"
                          value={systemSettings.dataRetentionDays}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, dataRetentionDays: parseInt(e.target.value) || 30 }))}
                          min="1"
                          max="365"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxLogFileSize">Max Log File Size (MB)</Label>
                        <Input
                          id="maxLogFileSize"
                          type="number"
                          value={systemSettings.maxLogFileSize}
                          onChange={(e) => setSystemSettings(prev => ({ ...prev, maxLogFileSize: parseInt(e.target.value) || 100 }))}
                          min="10"
                          max="1000"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enableAutoUpdates">Enable Auto Updates</Label>
                        <Switch
                          id="enableAutoUpdates"
                          checked={systemSettings.enableAutoUpdates}
                          onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, enableAutoUpdates: checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
