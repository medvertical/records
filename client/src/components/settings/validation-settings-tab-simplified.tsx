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
  severity: 'error' | 'warning' | 'information';
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
}

interface ValidationSettingsTabProps {
  onSettingsChange?: (settings: ValidationSettings) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationSettingsTab({ onSettingsChange }: ValidationSettingsTabProps) {
  const { toast } = useToast();
  
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
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // Load settings on mount
  useEffect(() => {
    loadValidationSettings();
  }, []);

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
      const response = await fetch('/api/validation/settings');
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

  const saveValidationSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationSettings),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Validation settings saved successfully",
        });
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
      case 'information': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      error: 'destructive' as const,
      warning: 'secondary' as const,
      information: 'outline' as const
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
            />
          </div>
          
          {aspectSettings.enabled && (
            <div className="space-y-2">
              <Label htmlFor={`${aspect}-severity`}>Severity Level</Label>
              <Select
                value={aspectSettings.severity}
                onValueChange={(value) => updateAspectSetting(aspect, 'severity', value)}
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
                  <SelectItem value="information">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon('information')}
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveValidationSettings} disabled={isSaving}>
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
