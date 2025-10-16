/**
 * Connectivity Management Page
 * 
 * Comprehensive page for managing all connectivity aspects:
 * - Current status and dashboard
 * - Manual mode override
 * - Notification settings
 * - Server health monitoring
 * 
 * Task 5.12: Integrated connectivity management
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Activity,
  Settings,
  Bell,
  BarChart3,
  Wifi,
  AlertCircle,
  Info,
} from 'lucide-react';
import { ConnectivityDashboard } from '@/components/validation/connectivity-dashboard';
import { ConnectivityStatusIndicator } from '@/components/validation/connectivity-status-indicator';
import { ConnectivityNotificationSettings } from '@/components/validation/connectivity-notification-settings';
import { useConnectivityStatus } from '@/hooks/use-connectivity-status';
import { toast } from 'sonner';

// ============================================================================
// Main Page Component
// ============================================================================

export default function ConnectivityPage() {
  const { status, isLoading, error, setManualMode } = useConnectivityStatus({
    showNotifications: false, // Handled by global provider
  });

  const [isSettingMode, setIsSettingMode] = useState(false);

  const handleModeChange = async (mode: 'online' | 'degraded' | 'offline' | 'auto') => {
    setIsSettingMode(true);
    try {
      const modeValue = mode === 'auto' ? null : mode;
      await setManualMode(modeValue as any);
      
      if (mode === 'auto') {
        toast.success('Switched to automatic mode detection');
      } else {
        toast.success(`Manual mode set to ${mode}`);
      }
    } catch (error) {
      toast.error('Failed to change connectivity mode');
    } finally {
      setIsSettingMode(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-pulse text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Loading connectivity information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-600 mb-2">
                Failed to Load Connectivity Status
              </h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Connectivity Management
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage validation engine connectivity
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectivityStatusIndicator variant="full" showDetails={false} />
        </div>
      </div>

      {/* Current Status Overview */}
      <StatusOverviewCard
        status={status}
        onModeChange={handleModeChange}
        isSettingMode={isSettingMode}
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <ConnectivityDashboard />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <ConnectivitySettings 
            status={status}
            onModeChange={handleModeChange}
            isSettingMode={isSettingMode}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <ConnectivityNotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Status Overview Card
// ============================================================================

interface StatusOverviewCardProps {
  status: any;
  onModeChange: (mode: 'online' | 'degraded' | 'offline' | 'auto') => Promise<void>;
  isSettingMode: boolean;
}

function StatusOverviewCard({ status, onModeChange, isSettingMode }: StatusOverviewCardProps) {
  if (!status) return null;

  const modeConfig = {
    online: { icon: Wifi, color: 'text-green-600', bg: 'bg-green-50', label: 'Online' },
    degraded: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Degraded' },
    offline: { icon: Wifi, color: 'text-red-600', bg: 'bg-red-50', label: 'Offline' },
  };

  const currentMode = modeConfig[status.mode as keyof typeof modeConfig];
  const ModeIcon = currentMode?.icon || Info;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${currentMode?.bg}`}>
              <ModeIcon className={`h-5 w-5 ${currentMode?.color}`} />
            </div>
            <div>
              <CardTitle>Current Status: {currentMode?.label || 'Unknown'}</CardTitle>
              <CardDescription>
                {status.manualOverride 
                  ? `Manual override active (auto-detected: ${status.detectedMode})`
                  : 'Using automatic mode detection'
                }
              </CardDescription>
            </div>
          </div>
          <Badge variant={status.isOnline ? 'default' : 'secondary'}>
            {status.availableFeatures?.length || 0} features available
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700 mb-2">Override Mode</p>
            <Select
              value={status.manualOverride ? status.mode : 'auto'}
              onValueChange={onModeChange}
              disabled={isSettingMode}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🔄 Automatic Detection</SelectItem>
                <SelectItem value="online">🟢 Force Online</SelectItem>
                <SelectItem value="degraded">🟡 Force Degraded</SelectItem>
                <SelectItem value="offline">🔴 Force Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {status.warnings && status.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex-1">
              <h4 className="text-sm font-medium text-yellow-900 mb-1">
                Current Limitations
              </h4>
              <ul className="text-xs text-yellow-800 space-y-1">
                {status.warnings.slice(0, 2).map((warning: string, index: number) => (
                  <li key={index}>• {warning}</li>
                ))}
                {status.warnings.length > 2 && (
                  <li className="text-yellow-700">
                    ... and {status.warnings.length - 2} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Connectivity Settings
// ============================================================================

interface ConnectivitySettingsProps {
  status: any;
  onModeChange: (mode: 'online' | 'degraded' | 'offline' | 'auto') => Promise<void>;
  isSettingMode: boolean;
}

function ConnectivitySettings({ status, onModeChange, isSettingMode }: ConnectivitySettingsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mode Override</CardTitle>
          <CardDescription>
            Control how the validation engine handles connectivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Current Mode</h4>
              <Badge variant="outline" className="text-base py-1">
                {status?.mode || 'Unknown'}
              </Badge>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Manual Override</h4>
              <Select
                value={status?.manualOverride ? status.mode : 'auto'}
                onValueChange={onModeChange}
                disabled={isSettingMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic Detection</SelectItem>
                  <SelectItem value="online">Force Online Mode</SelectItem>
                  <SelectItem value="degraded">Force Degraded Mode</SelectItem>
                  <SelectItem value="offline">Force Offline Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Mode Descriptions</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <div><strong>Online:</strong> All validation features available</div>
              <div><strong>Degraded:</strong> Some features limited, cached data used when possible</div>
              <div><strong>Offline:</strong> Only cached data available, no external server calls</div>
              <div><strong>Automatic:</strong> System detects best mode based on server health</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Availability</CardTitle>
          <CardDescription>
            Current validation features based on connectivity mode
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {status?.availableFeatures?.map((feature: string) => (
              <div key={feature} className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-green-900 capitalize">
                  {feature.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            ))}
            
            {status?.unavailableFeatures?.map((feature: string) => (
              <div key={feature} className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-200">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                <span className="text-sm text-gray-500 capitalize">
                  {feature.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

