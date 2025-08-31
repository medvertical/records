/**
 * Clean Settings Page - Rock Solid Settings Interface
 * 
 * This is a clean, simplified settings page that uses the new rock-solid
 * validation settings system.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RockSolidSettings } from '@/components/settings/rock-solid-settings';
import { 
  Settings, 
  Server, 
  BarChart3, 
  Shield,
  RefreshCw,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useValidationSettings } from '@/hooks/use-validation-settings';
import { useFhirServers } from '@/hooks/use-fhir-data';
import ServerConnectionModal from '@/components/settings/server-connection-modal';

// ============================================================================
// Main Settings Page Component
// ============================================================================

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('validation');
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  
  // Use the new validation settings hook
  const {
    settings,
    loading: settingsLoading,
    saving: settingsSaving,
    error: settingsError,
    updateSettings,
    saveSettings,
    resetSettings,
    validateSettings,
    validationResult,
    isValidating,
    presets,
    applyPreset,
    hasChanges,
    lastSaved
  } = useValidationSettings({
    enableRealTimeSync: true,
    enableCaching: true,
    autoSave: false,
    validateOnChange: true
  });

  // Debug hasChanges state
  console.log('[SettingsPage] hasChanges:', hasChanges);

  // FHIR servers data
  const { data: fhirServers, isLoading: serversLoading, refetch: refetchServers } = useFhirServers();

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleSettingsChange = (newSettings: any) => {
    console.log('[SettingsPage] Settings change received:', newSettings);
    updateSettings({
      settings: newSettings,
      createNewVersion: false,
      updatedBy: 'user'
    });
  };

  const handleSaveSettings = async () => {
    await saveSettings();
  };

  const handleResetSettings = async () => {
    await resetSettings();
  };

  const handleTestSettings = async (testSettings: any) => {
    return await validateSettings(testSettings);
  };

  const handlePresetApply = async (presetId: string) => {
    await applyPreset(presetId);
  };

  const handleServerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here you would typically call an API to save the server
    console.log('Server data submitted');
    
    setShowServerModal(false);
    setEditingServer(null);
    
    toast({
      title: "Server Added",
      description: "The FHIR server has been added successfully.",
    });
  };

  const handleServerEdit = (server: any) => {
    setEditingServer(server);
    setShowServerModal(true);
  };

  const handleServerDelete = (serverId: number) => {
    // Here you would typically call an API to delete the server
    console.log('Delete server:', serverId);
    
    toast({
      title: "Server Deleted",
      description: "The FHIR server has been deleted successfully.",
    });
  };

  // ========================================================================
  // Loading State
  // ========================================================================

  if (settingsLoading || serversLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // Error State
  // ========================================================================

  if (settingsError) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">Settings Error</h3>
              <p className="text-muted-foreground mb-4">{settingsError}</p>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========================================================================
  // Main Render
  // ========================================================================

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your FHIR validation and server settings
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
          {lastSaved && (
            <Badge variant="outline" className="text-green-600 border-green-200">
              Last saved: {lastSaved.toLocaleTimeString()}
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => {
              refetchServers();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="validation" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Validation</span>
          </TabsTrigger>
          <TabsTrigger value="servers" className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span>FHIR Servers</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>System</span>
          </TabsTrigger>
        </TabsList>

        {/* Validation Settings Tab */}
        <TabsContent value="validation" className="space-y-6">
          <RockSolidSettings
            initialSettings={settings || undefined}
            loading={settingsLoading}
            saving={settingsSaving}
            hasChanges={hasChanges}
            onSettingsChange={handleSettingsChange}
            onSave={handleSaveSettings}
            onReset={handleResetSettings}
            onTest={handleTestSettings}
            presets={presets || []}
            showAdvanced={true}
            enableRealTimeValidation={true}
          />
        </TabsContent>

        {/* FHIR Servers Tab */}
        <TabsContent value="servers" className="space-y-6">
          <FhirServersCard 
            servers={fhirServers || []}
            onAddServer={() => setShowServerModal(true)}
            onEditServer={handleServerEdit}
            onDeleteServer={handleServerDelete}
          />
        </TabsContent>

        {/* Dashboard Settings Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardSettingsCard />
        </TabsContent>

        {/* System Settings Tab */}
        <TabsContent value="system" className="space-y-6">
          <SystemSettingsCard />
        </TabsContent>
      </Tabs>

      {/* Server Connection Modal */}
      <ServerConnectionModal
        open={showServerModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowServerModal(false);
            setEditingServer(null);
          }
        }}
      />
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function FhirServersCard({ 
  servers, 
  onAddServer, 
  onEditServer, 
  onDeleteServer 
}: {
  servers: any[];
  onAddServer: () => void;
  onEditServer: (server: any) => void;
  onDeleteServer: (serverId: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Server className="h-5 w-5" />
          <span>FHIR Servers</span>
        </CardTitle>
        <CardDescription>
          Manage your FHIR server connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {servers && servers.length > 0 ? (
            servers.map((server) => (
              <div key={server.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium">{server.name}</h4>
                    {server.isActive && <Badge variant="default">Active</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{server.url}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={() => onEditServer(server)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDeleteServer(server.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No FHIR Servers</h3>
              <p className="text-muted-foreground mb-4">
                Add your first FHIR server to start validating resources
              </p>
            </div>
          )}
          
          <Button onClick={onAddServer} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add FHIR Server
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Dashboard Settings</span>
        </CardTitle>
        <CardDescription>
          Configure your dashboard preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Dashboard Settings</h3>
          <p className="text-muted-foreground">
            Dashboard configuration options will be available here
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>System Settings</span>
        </CardTitle>
        <CardDescription>
          Configure system-wide settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">System Settings</h3>
          <p className="text-muted-foreground">
            System configuration options will be available here
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
