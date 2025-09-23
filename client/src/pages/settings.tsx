import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Server, 
  BarChart3, 
  Database
} from 'lucide-react';

// Import tab components
import { ValidationSettingsTab } from '@/components/settings/validation-settings-tab';
import { ServerManagementTab } from '@/components/settings/server-management-tab';
import { DashboardSettingsTab } from '@/components/settings/dashboard-settings-tab';
import { SystemSettingsTab } from '@/components/settings/system-settings-tab';

// ============================================================================
// Types
// ============================================================================

interface ValidationSettings {
  structural: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  profile: { enabled: boolean; severity: 'warning' | 'information' };
  terminology: { enabled: boolean; severity: 'warning' | 'information' };
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
  autoValidateEnabled: boolean;
}

interface SystemSettings {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  enableSSE: boolean;
  dataRetentionDays: number;
  maxLogFileSize: number;
  enableAutoUpdates: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function SettingsPage() {
  // State for each settings category
  const [validationSettings, setValidationSettings] = useState<ValidationSettings | null>(null);
  const [servers, setServers] = useState<ServerSettings[]>([]);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleValidationSettingsChange = (settings: ValidationSettings) => {
    setValidationSettings(settings);
  };

  const handleServersChange = (servers: ServerSettings[]) => {
    setServers(servers);
  };

  const handleDashboardSettingsChange = (settings: DashboardSettings) => {
    setDashboardSettings(settings);
  };

  const handleSystemSettingsChange = (settings: SystemSettings) => {
    setSystemSettings(settings);
  };

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure validation settings, manage servers, and customize your dashboard experience.
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="validation" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="validation" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
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
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Validation Settings Tab */}
          <TabsContent value="validation" className="space-y-6">
            <ValidationSettingsTab onSettingsChange={handleValidationSettingsChange} />
          </TabsContent>

          {/* Server Management Tab */}
          <TabsContent value="servers" className="space-y-6">
            <ServerManagementTab onServersChange={handleServersChange} />
          </TabsContent>

          {/* Dashboard Settings Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardSettingsTab onSettingsChange={handleDashboardSettingsChange} />
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="system" className="space-y-6">
            <SystemSettingsTab onSettingsChange={handleSystemSettingsChange} />
          </TabsContent>
        </Tabs>

        {/* Settings Summary Card */}
        {(validationSettings || servers.length > 0 || dashboardSettings || systemSettings) && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Settings Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {validationSettings && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Validation Settings</h4>
                    <p className="text-sm text-muted-foreground">
                      {Object.values(validationSettings).filter(v => typeof v === 'object' && v.enabled).length} aspects enabled
                    </p>
                  </div>
                )}
                
                {servers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">FHIR Servers</h4>
                    <p className="text-sm text-muted-foreground">
                      {servers.length} server{servers.length !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                )}
                
                {dashboardSettings && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Dashboard</h4>
                    <p className="text-sm text-muted-foreground">
                      {dashboardSettings.theme} theme, {dashboardSettings.cardLayout} layout
                    </p>
                  </div>
                )}
                
                {systemSettings && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">System</h4>
                    <p className="text-sm text-muted-foreground">
                      {systemSettings.logLevel} logging, {systemSettings.dataRetentionDays} days retention
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
