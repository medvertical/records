/**
 * Validation Settings Dashboard Demo
 * 
 * A demonstration component showing how dashboard statistics update
 * when validation aspects are enabled/disabled
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  RefreshCw, 
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Save,
  RotateCcw
} from 'lucide-react';
import ValidationSettingsAuditTrail from './validation-settings-audit-trail';

interface ValidationStats {
  totalValidated: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  validationCoverage: number;
  validationProgress: number;
  lastValidationRun: string | null;
}

interface ValidationSettings {
  structural: { enabled: boolean; severity: string };
  profile: { enabled: boolean; severity: string };
  terminology: { enabled: boolean; severity: string };
  reference: { enabled: boolean; severity: string };
  businessRule: { enabled: boolean; severity: string };
  metadata: { enabled: boolean; severity: string };
}

export function ValidationSettingsDashboardDemo() {
  const [settings, setSettings] = useState<ValidationSettings>({
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'information' }
  });

  // State for confirmation dialog
  const [pendingSettings, setPendingSettings] = useState<ValidationSettings | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // State for rollback functionality
  const [previousSettings, setPreviousSettings] = useState<ValidationSettings | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);

  // Fetch current validation settings
  const { data: currentSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['validation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      const data = await response.json();
      return data.settings;
    }
  });

  // Fetch dashboard statistics
  const { data: dashboardData, refetch: refetchDashboard, isLoading } = useQuery({
    queryKey: ['/api/dashboard/combined'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/combined');
      const data = await response.json();
      return data;
    },
    refetchInterval: 5000 // Refresh every 5 seconds to show real-time updates
  });

  // Update local settings when current settings change
  useEffect(() => {
    if (currentSettings) {
      setSettings({
        structural: currentSettings.structural || { enabled: true, severity: 'error' },
        profile: currentSettings.profile || { enabled: true, severity: 'warning' },
        terminology: currentSettings.terminology || { enabled: true, severity: 'warning' },
        reference: currentSettings.reference || { enabled: true, severity: 'error' },
        businessRule: currentSettings.businessRule || { enabled: true, severity: 'warning' },
        metadata: currentSettings.metadata || { enabled: true, severity: 'information' }
      });
    }
  }, [currentSettings]);

  const updateSettings = async (newSettings: ValidationSettings) => {
    setIsUpdating(true);
    try {
      // Store previous settings for rollback functionality
      setPreviousSettings(settings);
      
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        setSettings(newSettings);
        // Refetch both settings and dashboard data
        await Promise.all([refetchSettings(), refetchDashboard()]);
        setShowConfirmDialog(false);
        setPendingSettings(null);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmSettingsUpdate = () => {
    if (pendingSettings) {
      updateSettings(pendingSettings);
    }
  };

  const cancelSettingsUpdate = () => {
    setShowConfirmDialog(false);
    setPendingSettings(null);
  };

  const rollbackToPreviousSettings = async () => {
    if (previousSettings) {
      setIsUpdating(true);
      try {
        const response = await fetch('/api/validation/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(previousSettings)
        });

        if (response.ok) {
          setSettings(previousSettings);
          // Refetch both settings and dashboard data
          await Promise.all([refetchSettings(), refetchDashboard()]);
          setShowRollbackDialog(false);
          setPreviousSettings(null); // Clear previous settings after successful rollback
        }
      } catch (error) {
        console.error('Failed to rollback settings:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const cancelRollback = () => {
    setShowRollbackDialog(false);
  };

  const toggleAspect = (aspect: keyof ValidationSettings) => {
    const newSettings = {
      ...settings,
      [aspect]: {
        ...settings[aspect],
        enabled: !settings[aspect].enabled
      }
    };
    
    // Show confirmation dialog for settings changes
    setPendingSettings(newSettings);
    setShowConfirmDialog(true);
  };

  const validationStats: ValidationStats = dashboardData?.validation || {
    totalValidated: 0,
    validResources: 0,
    errorResources: 0,
    warningResources: 0,
    validationCoverage: 0,
    validationProgress: 0,
    lastValidationRun: null
  };

  const enabledAspects = Object.values(settings).filter(s => s.enabled).length;
  const totalAspects = Object.keys(settings).length;

  return (
    <div className="space-y-6">
      {/* Settings Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Validation Settings</span>
          </CardTitle>
          <CardDescription>
            Toggle validation aspects to see how dashboard statistics update in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(settings).map(([aspect, config]) => (
              <div key={aspect} className="flex items-center space-x-3">
                <Switch
                  id={aspect}
                  checked={config.enabled}
                  onCheckedChange={() => toggleAspect(aspect as keyof ValidationSettings)}
                />
                <Label htmlFor={aspect} className="capitalize">
                  {aspect.replace(/([A-Z])/g, ' $1').trim()}
                </Label>
                <Badge variant="outline" className="text-xs">
                  {config.severity}
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Enabled aspects:</span>
              <Badge variant={enabledAspects === totalAspects ? "default" : "secondary"}>
                {enabledAspects}/{totalAspects}
              </Badge>
            </div>
            
            {/* Rollback Button */}
            {previousSettings && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRollbackDialog(true)}
                disabled={isUpdating}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Rollback</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Confirm Validation Settings Change</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to update the validation settings? This will affect how validation results are displayed across the application.
            </DialogDescription>
          </DialogHeader>
          
          {pendingSettings && (
            <div className="space-y-4">
              <div className="text-sm font-medium">Changes to be applied:</div>
              <div className="space-y-2">
                {Object.entries(pendingSettings).map(([aspect, config]) => {
                  const currentConfig = settings[aspect as keyof ValidationSettings];
                  const isChanging = config.enabled !== currentConfig.enabled;
                  
                  if (!isChanging) return null;
                  
                  return (
                    <div key={aspect} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                      <span className="capitalize font-medium">
                        {aspect.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={currentConfig.enabled ? "destructive" : "secondary"}>
                          {currentConfig.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <span className="text-gray-400">→</span>
                        <Badge variant={config.enabled ? "default" : "secondary"}>
                          {config.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="text-sm text-gray-600">
                <strong>Impact:</strong> This will immediately update validation result filtering across the dashboard and resource views. 
                No re-validation is required as the system uses UI filtering.
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelSettingsUpdate}
              disabled={isUpdating}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={confirmSettingsUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Confirm Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <RotateCcw className="h-5 w-5" />
              <span>Rollback Validation Settings</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to rollback to the previous validation settings? This will revert all changes made since the last update.
            </DialogDescription>
          </DialogHeader>
          
          {previousSettings && (
            <div className="space-y-4">
              <div className="text-sm font-medium">Current settings will be reverted to:</div>
              <div className="space-y-2">
                {Object.entries(previousSettings).map(([aspect, config]) => {
                  const currentConfig = settings[aspect as keyof ValidationSettings];
                  const isDifferent = config.enabled !== currentConfig.enabled;
                  
                  return (
                    <div key={aspect} className={`flex items-center justify-between p-2 rounded-md ${
                      isDifferent ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                    }`}>
                      <span className="capitalize font-medium">
                        {aspect.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={currentConfig.enabled ? "destructive" : "secondary"}>
                          {currentConfig.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <span className="text-gray-400">→</span>
                        <Badge variant={config.enabled ? "default" : "secondary"}>
                          {config.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="text-sm text-gray-600">
                <strong>Impact:</strong> This will immediately revert validation result filtering to the previous configuration. 
                Dashboard statistics and resource views will update accordingly.
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelRollback}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={rollbackToPreviousSettings}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Rolling back...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Rollback Settings
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dashboard Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Dashboard Statistics</span>
            {isLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
          </CardTitle>
          <CardDescription>
            Real-time validation statistics that update when settings change
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Validated */}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {validationStats.totalValidated.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Validated</div>
            </div>

            {/* Valid Resources */}
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {validationStats.validResources.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Valid Resources</div>
            </div>

            {/* Error Resources */}
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {validationStats.errorResources.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Error Resources</div>
            </div>

            {/* Warning Resources */}
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {validationStats.warningResources.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Warning Resources</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            {/* Validation Coverage */}
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {validationStats.validationCoverage.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Validation Coverage</div>
            </div>

            {/* Validation Progress */}
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {validationStats.validationProgress.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Validation Progress</div>
            </div>
          </div>

          {/* Last Validation Run */}
          {validationStats.lastValidationRun && (
            <div className="mt-4 text-center">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>
                  Last validation: {new Date(validationStats.lastValidationRun).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <ValidationSettingsAuditTrail />

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Toggle validation aspects on/off using the switches above</li>
            <li>A confirmation dialog will appear showing the changes to be applied</li>
            <li>Review the changes and click "Confirm Changes" to apply them</li>
            <li>Watch the dashboard statistics update automatically after confirmation</li>
            <li>Notice how error/warning counts change based on enabled aspects</li>
            <li>After making changes, a "Rollback" button will appear to revert to previous settings</li>
            <li>Click "Rollback" to see a confirmation dialog showing what will be reverted</li>
            <li>Check the Audit Trail section below to see a complete history of all settings changes</li>
            <li>Use the "Show Statistics" button in the audit trail to see change statistics</li>
            <li>Each audit trail entry shows who made the change, when, and what changed</li>
            <li>Check the browser console for cache invalidation logs</li>
            <li>Statistics refresh every 5 seconds to show real-time updates</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
