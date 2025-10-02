/**
 * Simplified Validation Settings Tab
 * 
 * This component provides a minimal, clean interface for validation settings
 * without versioning, audit trails, or complex history management.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  TestTube,
  Shield,
  Eye,
  TrendingUp,
  TrendingDown,
  Info,
  Server,
  Database
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ValidationAspectConfig {
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
}

interface ServerConfig {
  url: string;
  timeout: number;
  retries: number;
}

interface ValidationSettings {
  aspects: {
    structural: ValidationAspectConfig;
    profile: ValidationAspectConfig;
    terminology: ValidationAspectConfig;
    reference: ValidationAspectConfig;
    businessRule: ValidationAspectConfig;
    metadata: ValidationAspectConfig;
  };
  server: ServerConfig;
  performance: {
    maxConcurrent: number;
    batchSize: number;
  };
  records: {
    validateExternalReferences: boolean;
    strictReferenceTypeChecking: boolean;
    strictMode: boolean;
    validateReferenceIntegrity: boolean;
    allowBrokenReferences: boolean;
    maxReferenceDepth: number;
  };
  snapshotHash?: string;
  snapshotTime?: string;
}

interface ValidationSettingsTabProps {
  onSettingsChange?: (settings: ValidationSettings) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationSettingsTab({ onSettingsChange }: ValidationSettingsTabProps) {
  const { toast } = useToast();
  
  // Use the active server hook for proper server management
  const {
    activeServer,
    servers,
    isLoading: serverLoading,
    switchServer,
    isSwitching
  } = useActiveServer({
    enablePolling: true,
    showLoading: false,
    showNotifications: false
  });
  
  // State management
  const [validationSettings, setValidationSettings] = useState<ValidationSettings>({
    aspects: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'error' },
      metadata: { enabled: true, severity: 'error' }
    },
    server: {
      url: 'https://hapi.fhir.org/baseR4',
      timeout: 30000,
      retries: 3
    },
    performance: {
      maxConcurrent: 8,
      batchSize: 100
    },
    records: {
      validateExternalReferences: true,
      strictReferenceTypeChecking: true,
      strictMode: false,
      validateReferenceIntegrity: true,
      allowBrokenReferences: false,
      maxReferenceDepth: 3
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // Load settings on mount and when active server changes
  useEffect(() => {
    loadValidationSettings();
  }, []);

  // Reload settings when active server changes to get server-specific settings
  useEffect(() => {
    if (activeServer) {
      loadValidationSettings();
    }
  }, [activeServer]);

  // Notify parent of changes
  useEffect(() => {
    onSettingsChange?.(validationSettings);
  }, [validationSettings, onSettingsChange]);

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadValidationSettings = async () => {
    setIsLoading(true);
    try {
      // Include serverId in the request to get server-specific settings
      const serverId = activeServer?.id;
      const url = serverId 
        ? `/api/validation/settings/snapshot?serverId=${serverId}`
        : '/api/validation/settings/snapshot';
        
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setValidationSettings(data);
      }
    } catch (error) {
      console.error('Failed to load validation settings:', error);
      toast({
        title: "Error",
        description: "Failed to load validation settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const activateServer = async (serverId: string) => {
    try {
      await switchServer(serverId);
      
      // Trigger app-wide rebind by dispatching a custom event
      window.dispatchEvent(new CustomEvent('serverActivated', { 
        detail: { serverId, timestamp: Date.now() } 
      }));
      
      toast({
        title: "Success",
        description: "Server activated successfully. App-wide rebind triggered.",
      });
    } catch (error) {
      console.error('Failed to activate server:', error);
      toast({
        title: "Error",
        description: "Failed to activate server",
        variant: "destructive",
      });
    }
  };

  // ========================================================================
  // Settings Updates
  // ========================================================================

  const updateAspectSetting = (aspect: keyof ValidationSettings['aspects'], field: keyof ValidationAspectConfig, value: any) => {
    setValidationSettings(prev => ({
      ...prev,
      aspects: {
        ...prev.aspects,
        [aspect]: {
          ...prev.aspects[aspect],
          [field]: value
        }
      }
    }));
  };

  const updateServerSetting = (field: keyof ServerConfig, value: any) => {
    setValidationSettings(prev => ({
      ...prev,
      server: {
        ...prev.server,
        [field]: value
      }
    }));
  };

  const updatePerformanceSetting = (field: keyof ValidationSettings['performance'], value: any) => {
    setValidationSettings(prev => ({
      ...prev,
      performance: {
        ...prev.performance,
        [field]: value
      }
    }));
  };

  const updateRecordsSetting = (field: keyof ValidationSettings['records'], value: any) => {
    setValidationSettings(prev => ({
      ...prev,
      records: {
        ...prev.records,
        [field]: value
      }
    }));
  };

  const saveValidationSettings = async () => {
    setIsSaving(true);
    try {
      // First, validate the settings
      const validationResponse = await fetch('/api/validation/settings/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationSettings),
      });

      if (!validationResponse.ok) {
        throw new Error('Settings validation failed');
      }

      const validationResult = await validationResponse.json();
      if (!validationResult.isValid) {
        toast({
          title: "Validation Failed",
          description: `Settings validation failed: ${validationResult.errors.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      // If validation passed, save the settings
      const serverId = activeServer?.id;
      const url = serverId 
        ? `/api/validation/settings?serverId=${serverId}`
        : '/api/validation/settings';
        
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: validationSettings,
          serverId: serverId,
          validate: true
        }),
      });

      if (response.ok) {
        // Emit settingsChanged event for immediate UI recalculation
        window.dispatchEvent(new CustomEvent('settingsChanged', { 
          detail: { 
            settings: validationSettings, 
            timestamp: Date.now(),
            validationResult 
          } 
        }));

        // Reload settings to get updated snapshot info
        await loadValidationSettings();

        toast({
          title: "Success",
          description: "Validation settings saved and applied successfully",
        });
        
        // Add success indicator for E2E tests
        const successElement = document.createElement('div');
        successElement.setAttribute('data-testid', 'settings-saved-success');
        successElement.setAttribute('data-testid', 'settings-saved-message');
        successElement.textContent = 'Settings saved successfully';
        document.body.appendChild(successElement);
        
        // Remove after 3 seconds
        setTimeout(() => {
          document.body.removeChild(successElement);
        }, 3000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save validation settings:', error);
      toast({
        title: "Error",
        description: "Failed to save validation settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testValidationSettings = async () => {
    try {
      const response = await fetch('/api/validation/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: validationSettings,
          testResource: {
            resourceType: 'Patient',
            id: 'test-patient',
            name: [{ given: ['John'], family: 'Doe' }]
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTestResults(result);
        toast({
          title: "Test Complete",
          description: "Validation settings tested successfully",
        });
      } else {
        throw new Error('Test failed');
      }
    } catch (error) {
      console.error('Failed to test validation settings:', error);
      toast({
        title: "Test Failed",
        description: "Failed to test validation settings",
        variant: "destructive",
      });
    }
  };

  const resetToDefaults = async () => {
    try {
      const response = await fetch('/api/validation/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setValidationSettings(data);
        toast({
          title: "Success",
          description: "Settings reset to defaults",
        });
      } else {
        throw new Error('Failed to reset settings');
      }
    } catch (error) {
      console.error('Failed to reset validation settings:', error);
      toast({
        title: "Error",
        description: "Failed to reset validation settings",
        variant: "destructive",
      });
    }
  };

  // ========================================================================
  // Render Helpers
  // ========================================================================

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      error: 'destructive' as const,
      warning: 'secondary' as const,
      info: 'outline' as const
    };
    
    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'outline'}>
        {severity}
      </Badge>
    );
  };

  const renderValidationAspect = (
    aspect: keyof ValidationSettings['aspects'],
    title: string,
    description: string,
    icon: React.ReactNode
  ) => {
    const aspectSettings = validationSettings.aspects[aspect];
    
    return (
      <Card key={aspect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor={`${aspect}-enabled`}>Enable {title}</Label>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch
              id={`${aspect}-enabled`}
              checked={aspectSettings.enabled}
              onCheckedChange={(checked) => updateAspectSetting(aspect, 'enabled', checked)}
              data-testid={`${aspect}-validation-toggle`}
            />
          </div>
          
          {aspectSettings.enabled && (
            <div className="space-y-2">
              <Label htmlFor={`${aspect}-severity`}>Severity Level</Label>
              <Select
                value={aspectSettings.severity}
                onValueChange={(value) => updateAspectSetting(aspect, 'severity', value)}
                data-testid={`${aspect}-severity-select`}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon('error')}
                      Error
                    </div>
                  </SelectItem>
                  <SelectItem value="warning">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon('warning')}
                      Warning
                    </div>
                  </SelectItem>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon('info')}
                      Information
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ========================================================================
  // Render
  // ========================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading validation settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Results */}
      {testResults && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <TestTube className="h-5 w-5" />
              Validation Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Valid: {testResults.isValid ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Errors: {testResults.issues?.filter((i: any) => i.severity === 'error').length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Warnings: {testResults.issues?.filter((i: any) => i.severity === 'warning').length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Snapshot Info */}
      {validationSettings.snapshotHash && (
        <Card className="border-gray-200 bg-gray-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Database className="h-5 w-5" />
              Settings Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Snapshot Hash</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {validationSettings.snapshotHash}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Last Updated</Label>
                <div className="text-sm text-muted-foreground">
                  {validationSettings.snapshotTime ? new Date(validationSettings.snapshotTime).toLocaleString() : 'Unknown'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Server Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Active Server Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeServer ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-green-200 bg-green-50 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-900">Active Server</span>
                  </div>
                  <div className="text-sm text-green-700">
                    <div className="font-medium">{activeServer.name}</div>
                    <div className="text-xs font-mono">{activeServer.url}</div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  Active
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label>Switch to Different Server</Label>
                <div className="space-y-2">
                  {servers
                    .filter(server => !server.isActive)
                    .map(server => (
                      <div key={server.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">{server.name}</div>
                          <div className="text-sm text-muted-foreground font-mono">{server.url}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => activateServer(server.id)}
                          disabled={isSwitching}
                        >
                          {isSwitching ? 'Activating...' : 'Activate'}
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-muted-foreground">No active server configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please configure and activate a FHIR server to enable validation
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Aspects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Validation Aspects</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testValidationSettings}
              disabled={isSaving}
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={isSaving}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Defaults
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderValidationAspect(
            'structural',
            'Structural Validation',
            'Validates FHIR resource structure and required fields',
            <Shield className="h-5 w-5" />
          )}
          
          {renderValidationAspect(
            'profile',
            'Profile Validation',
            'Validates against FHIR profiles and constraints',
            <Settings className="h-5 w-5" />
          )}
          
          {renderValidationAspect(
            'terminology',
            'Terminology Validation',
            'Validates code systems and value sets',
            <Eye className="h-5 w-5" />
          )}
          
          {renderValidationAspect(
            'reference',
            'Reference Validation',
            'Validates resource references and integrity',
            <TrendingUp className="h-5 w-5" />
          )}
          
          {renderValidationAspect(
            'businessRule',
            'Business Rule Validation',
            'Validates custom business rules and constraints',
            <TrendingDown className="h-5 w-5" />
          )}
          
          {renderValidationAspect(
            'metadata',
            'Metadata Validation',
            'Validates resource metadata and timestamps',
            <Info className="h-5 w-5" />
          )}
        </div>
      </div>

      {/* Server Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-url">FHIR Server URL</Label>
            <input
              id="server-url"
              type="url"
              value={validationSettings.server.url}
              onChange={(e) => updateServerSetting('url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://hapi.fhir.org/baseR4"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Select
                value={validationSettings.server.timeout.toString()}
                onValueChange={(value) => updateServerSetting('timeout', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5000">5 seconds</SelectItem>
                  <SelectItem value="15000">15 seconds</SelectItem>
                  <SelectItem value="30000">30 seconds</SelectItem>
                  <SelectItem value="60000">1 minute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retries">Retry Attempts</Label>
              <Select
                value={validationSettings.server.retries.toString()}
                onValueChange={(value) => updateServerSetting('retries', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Performance Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-concurrent">Max Concurrent Validations</Label>
              <Select
                value={validationSettings.performance.maxConcurrent.toString()}
                onValueChange={(value) => updatePerformanceSetting('maxConcurrent', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <Select
                value={validationSettings.performance.batchSize.toString()}
                onValueChange={(value) => updatePerformanceSetting('batchSize', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records-Specific Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Records-Specific Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="validate-external-refs">Validate External References</Label>
                <p className="text-sm text-muted-foreground">
                  Check references to resources outside the current server
                </p>
              </div>
              <Switch
                id="validate-external-refs"
                checked={validationSettings.records.validateExternalReferences}
                onCheckedChange={(checked) => updateRecordsSetting('validateExternalReferences', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="strict-reference-type">Strict Reference Type Checking</Label>
                <p className="text-sm text-muted-foreground">
                  Enforce strict type checking for resource references
                </p>
              </div>
              <Switch
                id="strict-reference-type"
                checked={validationSettings.records.strictReferenceTypeChecking}
                onCheckedChange={(checked) => updateRecordsSetting('strictReferenceTypeChecking', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="strict-mode">Strict Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable strict validation mode with all rules enforced
                </p>
              </div>
              <Switch
                id="strict-mode"
                checked={validationSettings.records.strictMode}
                onCheckedChange={(checked) => updateRecordsSetting('strictMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="validate-reference-integrity">Validate Reference Integrity</Label>
                <p className="text-sm text-muted-foreground">
                  Check if referenced resources actually exist
                </p>
              </div>
              <Switch
                id="validate-reference-integrity"
                checked={validationSettings.records.validateReferenceIntegrity}
                onCheckedChange={(checked) => updateRecordsSetting('validateReferenceIntegrity', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="allow-broken-refs">Allow Broken References</Label>
                <p className="text-sm text-muted-foreground">
                  Allow broken references in validation results
                </p>
              </div>
              <Switch
                id="allow-broken-refs"
                checked={validationSettings.records.allowBrokenReferences}
                onCheckedChange={(checked) => updateRecordsSetting('allowBrokenReferences', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-reference-depth">Maximum Reference Depth</Label>
              <Select
                value={validationSettings.records.maxReferenceDepth.toString()}
                onValueChange={(value) => updateRecordsSetting('maxReferenceDepth', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 level</SelectItem>
                  <SelectItem value="2">2 levels</SelectItem>
                  <SelectItem value="3">3 levels</SelectItem>
                  <SelectItem value="5">5 levels</SelectItem>
                  <SelectItem value="10">10 levels</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Maximum depth for reference traversal during validation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveValidationSettings} 
          disabled={isSaving}
          data-testid="save-validation-settings"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
  );
}
