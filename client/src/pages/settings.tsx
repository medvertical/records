import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import ServerConnectionModal from '@/components/settings/server-connection-modal';
import { 
  Settings, 
  Database, 
  Shield, 
  Bell, 
  Palette, 
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  Server
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useValidationSettings, useUpdateValidationSettings } from '@/hooks/use-fhir-data';

export default function SettingsPage() {
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [notifications, setNotifications] = useState({
    validationErrors: true,
    connectionIssues: true,
    resourceUpdates: false,
    systemAlerts: true
  });

  const [fhirSettings, setFhirSettings] = useState({
    defaultPageSize: 50,
    maxRetries: 3,
    requestTimeout: 30,
    cacheEnabled: true,
    cacheDuration: 300
  });

  const ValidationSettingsContent = () => {
    const { data: settings, isLoading } = useValidationSettings();
    const updateSettings = useUpdateValidationSettings();
    const [localSettings, setLocalSettings] = useState(settings || {
      fetchFromSimplifier: true,
      fetchFromFhirServer: true,
      autoDetectProfiles: true,
      strictMode: false,
      maxProfiles: 3,
      cacheDuration: 3600,
      terminologyServer: {
        enabled: true,
        url: 'https://r4.ontoserver.csiro.au/fhir',
        type: 'ontoserver',
        description: 'CSIRO OntoServer (Public)'
      }
    });

    const handleSettingChange = (key: string, value: any) => {
      const newSettings = { ...localSettings, [key]: value };
      setLocalSettings(newSettings);
      updateSettings.mutate(newSettings);
    };

    if (isLoading) {
      return <div className="text-center py-8">Loading validation settings...</div>;
    }

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="fetch-simplifier" className="text-sm font-medium">
                Fetch Profiles from Simplifier.net
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically download validation profiles from Simplifier.net when needed
              </p>
            </div>
            <Switch
              id="fetch-simplifier"
              checked={(localSettings as any).fetchFromSimplifier !== false}
              onCheckedChange={(checked) => handleSettingChange('fetchFromSimplifier', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="fetch-fhir-server" className="text-sm font-medium">
                Fetch Profiles from FHIR Server
              </Label>
              <p className="text-sm text-muted-foreground">
                Try to fetch validation profiles from the connected FHIR server
              </p>
            </div>
            <Switch
              id="fetch-fhir-server"
              checked={(localSettings as any).fetchFromFhirServer !== false}
              onCheckedChange={(checked) => handleSettingChange('fetchFromFhirServer', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-detect-profiles" className="text-sm font-medium">
                Auto-detect Resource Profiles
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect and validate against profiles specified in resources
              </p>
            </div>
            <Switch
              id="auto-detect-profiles"
              checked={(localSettings as any).autoDetectProfiles !== false}
              onCheckedChange={(checked) => handleSettingChange('autoDetectProfiles', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="strict-mode" className="text-sm font-medium">
                Strict Validation Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable stricter validation rules and error reporting
              </p>
            </div>
            <Switch
              id="strict-mode"
              checked={(localSettings as any).strictMode === true}
              onCheckedChange={(checked) => handleSettingChange('strictMode', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-profiles" className="text-sm font-medium">
              Maximum Profiles per Validation
            </Label>
            <Input
              id="max-profiles"
              type="number"
              min="1"
              max="10"
              value={(localSettings as any).maxProfiles || 3}
              onChange={(e) => handleSettingChange('maxProfiles', parseInt(e.target.value))}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Limit the number of profiles to validate against for performance
            </p>
          </div>
        </div>

        {/* Terminology Server Configuration */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900">Terminology Server</h3>
          <p className="text-sm text-gray-600">
            Configure connection to a FHIR terminology server to resolve extension references and perform terminology validation.
          </p>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="terminology-enabled" className="text-sm font-medium">
                Enable Terminology Server
              </Label>
              <p className="text-sm text-muted-foreground">
                Connect to external terminology server for extension resolution
              </p>
            </div>
            <Switch
              id="terminology-enabled"
              checked={(localSettings as any).terminologyServer?.enabled !== false}
              onCheckedChange={(checked) => 
                handleSettingChange('terminologyServer', {
                  ...(localSettings as any).terminologyServer,
                  enabled: checked
                })
              }
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="terminology-url" className="text-sm font-medium">
                Terminology Server URL
              </Label>
              <Input
                id="terminology-url"
                value={(localSettings as any).terminologyServer?.url || 'https://tx.fhir.org/r4'}
                onChange={(e) => 
                  handleSettingChange('terminologyServer', {
                    ...(localSettings as any).terminologyServer,
                    url: e.target.value
                  })
                }
                placeholder="https://tx.fhir.org/r4"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                HL7 FHIR Terminology Server hosts US Core profiles and international FHIR standards
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="terminology-type" className="text-sm font-medium">
                  Server Type
                </Label>
                <Input
                  id="terminology-type"
                  value={(localSettings as any).terminologyServer?.type || 'ontoserver'}
                  onChange={(e) => 
                    handleSettingChange('terminologyServer', {
                      ...(localSettings as any).terminologyServer,
                      type: e.target.value
                    })
                  }
                  placeholder="ontoserver"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="terminology-description" className="text-sm font-medium">
                  Description
                </Label>
                <Input
                  id="terminology-description"
                  value={(localSettings as any).terminologyServer?.description || 'CSIRO OntoServer (Public)'}
                  onChange={(e) => 
                    handleSettingChange('terminologyServer', {
                      ...(localSettings as any).terminologyServer,
                      description: e.target.value
                    })
                  }
                  placeholder="CSIRO OntoServer (Public)"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The CSIRO OntoServer provides free access to FHIR terminology services including common extensions like birthPlace. 
              This helps resolve "Unable to resolve reference to extension" errors during validation.
            </AlertDescription>
          </Alert>
        </div>

        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Validation settings are applied immediately when changed. Profile fetching from external sources 
            may take longer depending on network conditions.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    toast({
      title: 'Notifications Updated',
      description: `${key} notifications ${value ? 'enabled' : 'disabled'}`,
    });
  };

  const handleFhirSettingChange = (key: string, value: any) => {
    setFhirSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setFhirSettings({
      defaultPageSize: 50,
      maxRetries: 3,
      requestTimeout: 30,
      cacheEnabled: true,
      cacheDuration: 300
    });
    setNotifications({
      validationErrors: true,
      connectionIssues: true,
      resourceUpdates: false,
      systemAlerts: true
    });
    toast({
      title: 'Settings Reset',
      description: 'All settings have been reset to their default values.',
    });
  };

  const exportSettings = () => {
    const settings = {
      fhirSettings,
      notifications,
      isDarkMode,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'records-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Settings Exported',
      description: 'Settings have been exported to records-settings.json',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Records application preferences and behavior
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="fhir">FHIR Server</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Basic application settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Auto-refresh Dashboard
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh dashboard data every 30 seconds
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Remember Last Page
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Return to your last visited page when reopening the application
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium">
                  Language
                </Label>
                <Input
                  id="language"
                  value="English (US)"
                  disabled
                  className="w-48"
                />
                <p className="text-sm text-muted-foreground">
                  Additional languages will be available in future versions
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fhir" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>FHIR Server Connection</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsServerModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Server className="h-4 w-4" />
                  Change Server
                </Button>
              </CardTitle>
              <CardDescription>
                Current FHIR server connection and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">Connected to HAPI FHIR R4</p>
                    <p className="text-sm text-muted-foreground">https://server.fire.ly</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FHIR Server Settings</CardTitle>
              <CardDescription>
                Configure how the application interacts with FHIR servers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="page-size" className="text-sm font-medium">
                    Default Page Size
                  </Label>
                  <Input
                    id="page-size"
                    type="number"
                    min="10"
                    max="1000"
                    value={fhirSettings.defaultPageSize}
                    onChange={(e) => handleFhirSettingChange('defaultPageSize', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-retries" className="text-sm font-medium">
                    Max Retries
                  </Label>
                  <Input
                    id="max-retries"
                    type="number"
                    min="0"
                    max="10"
                    value={fhirSettings.maxRetries}
                    onChange={(e) => handleFhirSettingChange('maxRetries', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout" className="text-sm font-medium">
                    Request Timeout (seconds)
                  </Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="5"
                    max="120"
                    value={fhirSettings.requestTimeout}
                    onChange={(e) => handleFhirSettingChange('requestTimeout', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache-duration" className="text-sm font-medium">
                    Cache Duration (seconds)
                  </Label>
                  <Input
                    id="cache-duration"
                    type="number"
                    min="0"
                    max="3600"
                    value={fhirSettings.cacheDuration}
                    onChange={(e) => handleFhirSettingChange('cacheDuration', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Enable Caching
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Cache FHIR responses to improve performance
                  </p>
                </div>
                <Switch
                  checked={fhirSettings.cacheEnabled}
                  onCheckedChange={(checked) => handleFhirSettingChange('cacheEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation Settings</CardTitle>
              <CardDescription>
                Configure how FHIR resources are validated against profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ValidationSettingsContent />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Control when and how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Validation Errors
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when resources fail validation
                  </p>
                </div>
                <Switch
                  checked={notifications.validationErrors}
                  onCheckedChange={(checked) => handleNotificationChange('validationErrors', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Connection Issues
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when FHIR server connections fail
                  </p>
                </div>
                <Switch
                  checked={notifications.connectionIssues}
                  onCheckedChange={(checked) => handleNotificationChange('connectionIssues', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Resource Updates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when resources are updated
                  </p>
                </div>
                <Switch
                  checked={notifications.resourceUpdates}
                  onCheckedChange={(checked) => handleNotificationChange('resourceUpdates', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    System Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about system maintenance and updates
                  </p>
                </div>
                <Switch
                  checked={notifications.systemAlerts}
                  onCheckedChange={(checked) => handleNotificationChange('systemAlerts', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Dark Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Switch to dark theme for better viewing in low light
                  </p>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={setIsDarkMode}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Theme Color
                </Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="bg-blue-500 w-8 h-8 p-0"></Button>
                  <Button variant="outline" size="sm" className="bg-green-500 w-8 h-8 p-0"></Button>
                  <Button variant="outline" size="sm" className="bg-purple-500 w-8 h-8 p-0"></Button>
                  <Button variant="outline" size="sm" className="bg-orange-500 w-8 h-8 p-0"></Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred accent color
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size" className="text-sm font-medium">
                  Font Size
                </Label>
                <Input
                  id="font-size"
                  value="Default"
                  disabled
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  Font size options will be available in future versions
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Advanced configuration options and data management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Debug Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable detailed logging for troubleshooting
                  </p>
                </div>
                <Switch />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Data Management</h4>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportSettings}>
                    <Download className="w-4 h-4 mr-1" />
                    Export Settings
                  </Button>
                  
                  <Button variant="outline">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Clear Cache
                  </Button>
                  
                  <Button variant="destructive" onClick={resetToDefaults}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Reset to Defaults
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Advanced settings can affect application performance. Only modify these settings if you understand their impact.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ServerConnectionModal 
        open={isServerModalOpen} 
        onOpenChange={setIsServerModalOpen} 
      />
    </div>
  );
}