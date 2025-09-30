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
  Info
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ValidationSettings {
  aspects: {
    structural: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
    profile: { enabled: boolean; severity: 'warning' | 'information' };
    terminology: { enabled: boolean; severity: 'warning' | 'information' };
    reference: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
    businessRule: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
    metadata: { enabled: boolean; severity: 'error' | 'warning' | 'information' };
  };
  strictMode: boolean;
  maxConcurrentValidations: number;
  timeoutMs: number;
  memoryLimitMB: number;
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
    strictMode: false,
    maxConcurrentValidations: 8,
    timeoutMs: 30000,
    memoryLimitMB: 512
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

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
      const response = await fetch('/api/validation-settings');
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

  const updateValidationAspect = (aspect: keyof ValidationSettings['aspects'], field: string, value: any) => {
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

  const updateGeneralSetting = (field: keyof ValidationSettings, value: any) => {
    setValidationSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveValidationSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/validation-settings', {
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
      const response = await fetch('/api/validation/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationSettings),
      });

      if (response.ok) {
        const result = await response.json();
        setPreviewData(result);
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

  const resetToDefaults = () => {
    setValidationSettings({
      aspects: {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'warning' },
        terminology: { enabled: true, severity: 'warning' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'error' },
        metadata: { enabled: true, severity: 'error' }
      },
      strictMode: false,
      maxConcurrentValidations: 8,
      timeoutMs: 30000,
      memoryLimitMB: 512
    });
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
    const aspectSettings = validationSettings.aspects[aspect] as any;
    
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
              onCheckedChange={(checked) => updateValidationAspect(aspect, 'enabled', checked)}
            />
          </div>
          
          {aspectSettings.enabled && (
            <div className="space-y-2">
              <Label htmlFor={`${aspect}-severity`}>Severity Level</Label>
              <Select
                value={aspectSettings.severity}
                onValueChange={(value) => updateValidationAspect(aspect, 'severity', value)}
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
      {/* Real-time Preview Card */}
      {previewData && (
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
                <span className="text-sm">Passed: {previewData.passed || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Failed: {previewData.failed || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Warnings: {previewData.warnings || 0}</span>
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

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="strict-mode">Strict Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable strict validation mode for enhanced compliance checking
              </p>
            </div>
            <Switch
              id="strict-mode"
              checked={validationSettings.strictMode}
              onCheckedChange={(checked) => updateGeneralSetting('strictMode', checked)}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-concurrent">Max Concurrent Validations</Label>
              <Select
                value={validationSettings.maxConcurrentValidations.toString()}
                onValueChange={(value) => updateGeneralSetting('maxConcurrentValidations', parseInt(value))}
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
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Select
                value={validationSettings.timeoutMs.toString()}
                onValueChange={(value) => updateGeneralSetting('timeoutMs', parseInt(value))}
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
              <Label htmlFor="memory-limit">Memory Limit (MB)</Label>
              <Select
                value={validationSettings.memoryLimitMB.toString()}
                onValueChange={(value) => updateGeneralSetting('memoryLimitMB', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="256">256 MB</SelectItem>
                  <SelectItem value="512">512 MB</SelectItem>
                  <SelectItem value="1024">1 GB</SelectItem>
                  <SelectItem value="2048">2 GB</SelectItem>
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
