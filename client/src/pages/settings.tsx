import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Server, 
  BarChart3, 
  Database,
  Activity,
  Code2
} from 'lucide-react';

// Import tab components
import { ValidationSettingsTab } from '@/components/settings/validation-settings-tab';
import { ServerManagementTab } from '@/components/settings/server-management-tab';
import { DashboardSettingsTab } from '@/components/settings/dashboard-settings-tab';
import { SystemSettingsTab } from '@/components/settings/system-settings-tab';
import { PollingSettingsTab } from '@/components/settings/polling-settings-tab';
import { BusinessRulesTab } from '@/components/settings/business-rules-tab';

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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="validation" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Validation
            </TabsTrigger>
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Servers
            </TabsTrigger>
            <TabsTrigger value="business-rules" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="polling" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Polling
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

          {/* Business Rules Tab */}
          <TabsContent value="business-rules" className="space-y-6">
            <BusinessRulesTab />
          </TabsContent>

          {/* Polling Settings Tab */}
          <TabsContent value="polling" className="space-y-6">
            <PollingSettingsTab />
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
      </div>
    </div>
  );
}
