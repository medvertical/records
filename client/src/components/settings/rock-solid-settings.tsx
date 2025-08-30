/**
 * Rock Solid Settings UI - Modern, Type-Safe Settings Interface
 * 
 * This component provides a comprehensive, user-friendly interface for managing
 * validation settings using the new rock-solid schema.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  Shield, 
  Database, 
  Server, 
  Clock, 
  Zap,
  CheckCircle,
  AlertTriangle,
  Info,
  Save,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Plus,
  X,
  Eye,
  EyeOff,
  TestTube,
  History,
  Copy
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type {
  ValidationSettings,
  ValidationAspect,
  ValidationSeverity,
  ValidationSettingsPreset,
  ValidationSettingsValidationResult
} from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface RockSolidSettingsProps {
  /** Initial settings */
  initialSettings?: ValidationSettings;
  
  /** Whether settings are loading */
  loading?: boolean;
  
  /** Whether settings are saving */
  saving?: boolean;
  
  /** Callback when settings change */
  onSettingsChange?: (settings: ValidationSettings) => void;
  
  /** Callback when settings are saved */
  onSave?: (settings: ValidationSettings) => Promise<void>;
  
  /** Callback when settings are reset */
  onReset?: () => Promise<void>;
  
  /** Callback when settings are tested */
  onTest?: (settings: ValidationSettings) => Promise<ValidationSettingsValidationResult>;
  
  /** Available presets */
  presets?: ValidationSettingsPreset[];
  
  /** Whether to show advanced options */
  showAdvanced?: boolean;
  
  /** Whether to enable real-time validation */
  enableRealTimeValidation?: boolean;
}

interface SettingsState {
  settings: ValidationSettings;
  validationResult?: ValidationSettingsValidationResult;
  hasChanges: boolean;
  isTesting: boolean;
  testResult?: any;
}

// ============================================================================
// Rock Solid Settings Component
// ============================================================================

export function RockSolidSettings({
  initialSettings,
  loading = false,
  saving = false,
  onSettingsChange,
  onSave,
  onReset,
  onTest,
  presets = [],
  showAdvanced = false,
  enableRealTimeValidation = true
}: RockSolidSettingsProps) {
  const { toast } = useToast();
  
  const [state, setState] = useState<SettingsState>({
    settings: initialSettings || getDefaultSettings(),
    validationResult: undefined,
    hasChanges: false,
    isTesting: false,
    testResult: undefined
  });

  const [activeTab, setActiveTab] = useState('aspects');
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // ========================================================================
  // Effects
  // ========================================================================

  useEffect(() => {
    if (initialSettings) {
      setState(prev => ({
        ...prev,
        settings: initialSettings,
        hasChanges: false
      }));
    }
  }, [initialSettings]);

  useEffect(() => {
    if (enableRealTimeValidation && state.settings) {
      validateSettings(state.settings);
    }
  }, [state.settings, enableRealTimeValidation]);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleSettingChange = useCallback((path: string, value: any) => {
    setState(prev => {
      const newSettings = updateNestedProperty(prev.settings, path, value);
      // Call onSettingsChange with the new settings
      onSettingsChange?.(newSettings);
      return {
        ...prev,
        settings: newSettings,
        hasChanges: true
      };
    });
  }, [onSettingsChange]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    
    try {
      await onSave(state.settings);
      setState(prev => ({
        ...prev,
        hasChanges: false
      }));
      toast({
        title: "Settings Saved",
        description: "Your validation settings have been saved successfully.",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive"
      });
    }
  }, [onSave, state.settings, toast]);

  const handleReset = useCallback(async () => {
    if (!onReset) return;
    
    try {
      await onReset();
      setState(prev => ({
        ...prev,
        hasChanges: false,
        validationResult: undefined
      }));
      toast({
        title: "Settings Reset",
        description: "Settings have been reset to defaults.",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Failed to reset settings",
        variant: "destructive"
      });
    }
  }, [onReset, toast]);

  const handleTest = useCallback(async () => {
    if (!onTest) return;
    
    setState(prev => ({ ...prev, isTesting: true }));
    
    try {
      const result = await onTest(state.settings);
      setState(prev => ({
        ...prev,
        testResult: result,
        isTesting: false
      }));
      toast({
        title: "Test Completed",
        description: result.isValid ? "Settings test passed successfully." : "Settings test found issues.",
        variant: result.isValid ? "default" : "destructive"
      });
    } catch (error) {
      setState(prev => ({ ...prev, isTesting: false }));
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to test settings",
        variant: "destructive"
      });
    }
  }, [onTest, state.settings, toast]);

  const handlePresetApply = useCallback((preset: ValidationSettingsPreset) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...preset.settings
      },
      hasChanges: true
    }));
    toast({
      title: "Preset Applied",
      description: `Applied preset: ${preset.name}`,
      variant: "default"
    });
  }, [toast]);

  // ========================================================================
  // Validation
  // ========================================================================

  const validateSettings = useCallback(async (settings: ValidationSettings) => {
    // This would call the validation service
    // For now, we'll do basic validation
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (settings.terminology?.enabled && settings.terminologyServers?.length === 0) {
      warnings.push('Terminology validation is enabled but no servers are configured');
    }
    
    if (settings.profile?.enabled && settings.profileResolutionServers?.length === 0) {
      warnings.push('Profile validation is enabled but no servers are configured');
    }
    
    const validationResult: ValidationSettingsValidationResult = {
      isValid: errors.length === 0,
      errors: errors.map(error => ({
        code: 'VALIDATION_ERROR',
        message: error,
        path: '',
        suggestion: 'Please check your settings'
      })),
      warnings: warnings.map(warning => ({
        code: 'VALIDATION_WARNING',
        message: warning,
        path: '',
        suggestion: 'Consider configuring the required servers'
      })),
      suggestions: []
    };
    
    setState(prev => ({
      ...prev,
      validationResult
    }));
  }, []);

  // ========================================================================
  // Render Methods
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Validation Settings</h1>
          <p className="text-muted-foreground">
            Configure validation aspects, servers, and performance settings
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {state.hasChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
          {state.validationResult && (
            <Badge 
              variant={state.validationResult.isValid ? "default" : "destructive"}
              className="cursor-pointer"
              onClick={() => setShowValidationDetails(!showValidationDetails)}
            >
              {state.validationResult.isValid ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Valid</>
              ) : (
                <><AlertTriangle className="h-3 w-3 mr-1" /> Issues</>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Validation Details */}
      {showValidationDetails && state.validationResult && (
        <ValidationDetailsCard validationResult={state.validationResult} />
      )}

      {/* Presets */}
      {presets.length > 0 && (
        <PresetsCard presets={presets} onPresetApply={handlePresetApply} />
      )}

      {/* Main Settings */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="aspects">Validation Aspects</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
        </TabsList>

        <TabsContent value="aspects" className="space-y-4">
          <ValidationAspectsCard 
            settings={state.settings}
            onSettingChange={handleSettingChange}
          />
        </TabsContent>

        <TabsContent value="servers" className="space-y-4">
          <ServersConfigurationCard 
            settings={state.settings}
            onSettingChange={handleSettingChange}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceSettingsCard 
            settings={state.settings}
            onSettingChange={handleSettingChange}
          />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <AdvancedSettingsCard 
            settings={state.settings}
            onSettingChange={handleSettingChange}
            showAdvanced={showAdvanced}
          />
        </TabsContent>

        <TabsContent value="presets" className="space-y-4">
          <PresetsManagementCard 
            presets={presets}
            onPresetApply={handlePresetApply}
          />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={state.isTesting || loading}
              >
                {state.isTesting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Settings
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={loading || saving}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleSave}
                disabled={!state.hasChanges || loading || saving}
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function ValidationDetailsCard({ validationResult }: { validationResult: ValidationSettingsValidationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>Validation Results</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {validationResult.errors.length > 0 && (
          <div>
            <h4 className="font-medium text-red-600 mb-2">Errors</h4>
            <div className="space-y-2">
              {validationResult.errors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{error.code}:</strong> {error.message}
                    {error.suggestion && (
                      <div className="mt-1 text-sm text-red-200">
                        Suggestion: {error.suggestion}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
        
        {validationResult.warnings.length > 0 && (
          <div>
            <h4 className="font-medium text-yellow-600 mb-2">Warnings</h4>
            <div className="space-y-2">
              {validationResult.warnings.map((warning, index) => (
                <Alert key={index} variant="default" className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>{warning.code}:</strong> {warning.message}
                    {warning.suggestion && (
                      <div className="mt-1 text-sm text-yellow-700">
                        Suggestion: {warning.suggestion}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
        
        {validationResult.suggestions.length > 0 && (
          <div>
            <h4 className="font-medium text-blue-600 mb-2">Suggestions</h4>
            <div className="space-y-2">
              {validationResult.suggestions.map((suggestion, index) => (
                <Alert key={index} variant="default" className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>{suggestion.code}:</strong> {suggestion.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PresetsCard({ 
  presets, 
  onPresetApply 
}: { 
  presets: ValidationSettingsPreset[];
  onPresetApply: (preset: ValidationSettingsPreset) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Quick Presets</span>
        </CardTitle>
        <CardDescription>
          Apply predefined settings configurations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <Card key={preset.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{preset.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {preset.isBuiltIn ? 'Built-in' : 'Custom'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {preset.description}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {preset.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => onPresetApply(preset)}
                  className="w-full"
                >
                  Apply Preset
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ValidationAspectsCard({ 
  settings, 
  onSettingChange 
}: { 
  settings: ValidationSettings;
  onSettingChange: (path: string, value: any) => void;
}) {
  const aspects: Array<{
    key: ValidationAspect;
    name: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'structural',
      name: 'Structural Validation',
      description: 'Validates basic FHIR structure and required fields',
      icon: <Database className="h-4 w-4" />
    },
    {
      key: 'profile',
      name: 'Profile Validation',
      description: 'Validates against FHIR profiles and structure definitions',
      icon: <Shield className="h-4 w-4" />
    },
    {
      key: 'terminology',
      name: 'Terminology Validation',
      description: 'Validates terminology bindings and value sets',
      icon: <Server className="h-4 w-4" />
    },
    {
      key: 'reference',
      name: 'Reference Validation',
      description: 'Validates resource references and their existence',
      icon: <Database className="h-4 w-4" />
    },
    {
      key: 'businessRule',
      name: 'Business Rule Validation',
      description: 'Validates custom business rules and constraints',
      icon: <Settings className="h-4 w-4" />
    },
    {
      key: 'metadata',
      name: 'Metadata Validation',
      description: 'Validates metadata fields and timestamps',
      icon: <Info className="h-4 w-4" />
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validation Aspects</CardTitle>
        <CardDescription>
          Configure the six core validation aspects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {aspects.map((aspect) => (
          <div key={aspect.key} className="space-y-4">
            <div className="flex items-center space-x-3">
              {aspect.icon}
              <div className="flex-1">
                <h4 className="font-medium">{aspect.name}</h4>
                <p className="text-sm text-muted-foreground">{aspect.description}</p>
              </div>
              <Switch
                checked={settings[aspect.key]?.enabled ?? false}
                onCheckedChange={(enabled) => 
                  onSettingChange(`${aspect.key}.enabled`, enabled)
                }
              />
            </div>
            
            {settings[aspect.key]?.enabled && (
              <div className="ml-7 space-y-3">
                <div className="flex items-center space-x-4">
                  <Label htmlFor={`${aspect.key}-severity`}>Severity</Label>
                  <Select
                    value={settings[aspect.key]?.severity || 'warning'}
                    onValueChange={(severity: ValidationSeverity) =>
                      onSettingChange(`${aspect.key}.severity`, severity)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="information">Information</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Label htmlFor={`${aspect.key}-timeout`}>Timeout (ms)</Label>
                  <Input
                    id={`${aspect.key}-timeout`}
                    type="number"
                    value={settings[aspect.key]?.timeoutMs || 30000}
                    onChange={(e) =>
                      onSettingChange(`${aspect.key}.timeoutMs`, parseInt(e.target.value))
                    }
                    className="w-32"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`${aspect.key}-failFast`}
                    checked={settings[aspect.key]?.failFast || false}
                    onCheckedChange={(failFast) =>
                      onSettingChange(`${aspect.key}.failFast`, failFast)
                    }
                  />
                  <Label htmlFor={`${aspect.key}-failFast`}>Fail Fast</Label>
                </div>
              </div>
            )}
            
            {aspect.key !== 'metadata' && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ServersConfigurationCard({ 
  settings, 
  onSettingChange 
}: { 
  settings: ValidationSettings;
  onSettingChange: (path: string, value: any) => void;
}) {
  const [terminologyModalOpen, setTerminologyModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const handleAddTerminologyServer = (serverData: any) => {
    const newServer = {
      id: `terminology-${Date.now()}`,
      name: serverData.name,
      url: serverData.url,
      enabled: true,
      priority: (settings.terminologyServers?.length || 0) + 1,
      timeoutMs: serverData.timeoutMs || 60000,
      useForValidation: serverData.useForValidation ?? true,
      useForExpansion: serverData.useForExpansion ?? true
    };
    
    const newServers = [...(settings.terminologyServers || []), newServer];
    onSettingChange('terminologyServers', newServers);
    setTerminologyModalOpen(false);
  };

  const handleAddProfileServer = (serverData: any) => {
    const newServer = {
      id: `profile-${Date.now()}`,
      name: serverData.name,
      url: serverData.url,
      enabled: true,
      priority: (settings.profileResolutionServers?.length || 0) + 1,
      timeoutMs: serverData.timeoutMs || 60000,
      useForProfileResolution: serverData.useForProfileResolution ?? true,
      useForStructureDefinitionResolution: serverData.useForStructureDefinitionResolution ?? true
    };
    
    const newServers = [...(settings.profileResolutionServers || []), newServer];
    onSettingChange('profileResolutionServers', newServers);
    setProfileModalOpen(false);
  };

  const handleRemoveTerminologyServer = (serverId: string) => {
    const newServers = settings.terminologyServers?.filter(s => s.id !== serverId) || [];
    onSettingChange('terminologyServers', newServers);
  };

  const handleRemoveProfileServer = (serverId: string) => {
    const newServers = settings.profileResolutionServers?.filter(s => s.id !== serverId) || [];
    onSettingChange('profileResolutionServers', newServers);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Terminology Servers</span>
          </CardTitle>
          <CardDescription>
            Configure terminology servers for value set validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.terminologyServers?.map((server, index) => (
              <div key={server.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium">{server.name}</h4>
                    <Badge variant="outline">Priority {server.priority}</Badge>
                    {server.enabled && <Badge variant="default">Enabled</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{server.url}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={(enabled) => {
                      const newServers = [...settings.terminologyServers];
                      newServers[index] = { ...server, enabled };
                      onSettingChange('terminologyServers', newServers);
                    }}
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleRemoveTerminologyServer(server.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <AddTerminologyServerModal 
              open={terminologyModalOpen}
              onOpenChange={setTerminologyModalOpen}
              onAdd={handleAddTerminologyServer}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Profile Resolution Servers</span>
          </CardTitle>
          <CardDescription>
            Configure servers for profile and structure definition resolution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.profileResolutionServers?.map((server, index) => (
              <div key={server.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium">{server.name}</h4>
                    <Badge variant="outline">Priority {server.priority}</Badge>
                    {server.enabled && <Badge variant="default">Enabled</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{server.url}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={(enabled) => {
                      const newServers = [...settings.profileResolutionServers];
                      newServers[index] = { ...server, enabled };
                      onSettingChange('profileResolutionServers', newServers);
                    }}
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleRemoveProfileServer(server.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <AddProfileServerModal 
              open={profileModalOpen}
              onOpenChange={setProfileModalOpen}
              onAdd={handleAddProfileServer}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceSettingsCard({ 
  settings, 
  onSettingChange 
}: { 
  settings: ValidationSettings;
  onSettingChange: (path: string, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Performance Settings</span>
          </CardTitle>
          <CardDescription>
            Configure validation performance and concurrency
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxConcurrent">Max Concurrent Validations</Label>
              <Input
                id="maxConcurrent"
                type="number"
                value={settings.maxConcurrentValidations}
                onChange={(e) => onSettingChange('maxConcurrentValidations', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTimeout">Default Timeout (ms)</Label>
              <Input
                id="defaultTimeout"
                type="number"
                value={settings.timeoutSettings?.defaultTimeoutMs || 30000}
                onChange={(e) => onSettingChange('timeoutSettings.defaultTimeoutMs', parseInt(e.target.value))}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="parallelValidation"
              checked={settings.useParallelValidation}
              onCheckedChange={(enabled) => onSettingChange('useParallelValidation', enabled)}
            />
            <Label htmlFor="parallelValidation">Enable Parallel Validation</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Cache Settings</span>
          </CardTitle>
          <CardDescription>
            Configure caching for improved performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="cacheEnabled"
              checked={settings.cacheSettings?.enabled ?? false}
              onCheckedChange={(enabled) => onSettingChange('cacheSettings.enabled', enabled)}
            />
            <Label htmlFor="cacheEnabled">Enable Caching</Label>
          </div>
          
          {settings.cacheSettings?.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cacheTtl">Cache TTL (ms)</Label>
                <Input
                  id="cacheTtl"
                  type="number"
                  value={settings.cacheSettings?.ttlMs || 300000}
                  onChange={(e) => onSettingChange('cacheSettings.ttlMs', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cacheSize">Max Cache Size (MB)</Label>
                <Input
                  id="cacheSize"
                  type="number"
                  value={settings.cacheSettings?.maxSizeMB || 100}
                  onChange={(e) => onSettingChange('cacheSettings.maxSizeMB', parseInt(e.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdvancedSettingsCard({ 
  settings, 
  onSettingChange,
  showAdvanced 
}: { 
  settings: ValidationSettings;
  onSettingChange: (path: string, value: any) => void;
  showAdvanced: boolean;
}) {
  if (!showAdvanced) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Advanced settings are hidden. Enable them in the configuration.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>
            Configure global validation behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="strictMode"
              checked={settings.strictMode}
              onCheckedChange={(enabled) => onSettingChange('strictMode', enabled)}
            />
            <Label htmlFor="strictMode">Strict Mode</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="includeDebugInfo"
              checked={settings.includeDebugInfo}
              onCheckedChange={(enabled) => onSettingChange('includeDebugInfo', enabled)}
            />
            <Label htmlFor="includeDebugInfo">Include Debug Info</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="validateAgainstBaseSpec"
              checked={settings.validateAgainstBaseSpec}
              onCheckedChange={(enabled) => onSettingChange('validateAgainstBaseSpec', enabled)}
            />
            <Label htmlFor="validateAgainstBaseSpec">Validate Against Base FHIR Spec</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference Validation</CardTitle>
          <CardDescription>
            Configure reference validation behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="validateExternalReferences"
              checked={settings.validateExternalReferences}
              onCheckedChange={(enabled) => onSettingChange('validateExternalReferences', enabled)}
            />
            <Label htmlFor="validateExternalReferences">Validate External References</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="validateNonExistentReferences"
              checked={settings.validateNonExistentReferences}
              onCheckedChange={(enabled) => onSettingChange('validateNonExistentReferences', enabled)}
            />
            <Label htmlFor="validateNonExistentReferences">Validate Non-Existent References</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="validateReferenceTypes"
              checked={settings.validateReferenceTypes}
              onCheckedChange={(enabled) => onSettingChange('validateReferenceTypes', enabled)}
            />
            <Label htmlFor="validateReferenceTypes">Validate Reference Types</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PresetsManagementCard({ 
  presets, 
  onPresetApply 
}: { 
  presets: ValidationSettingsPreset[];
  onPresetApply: (preset: ValidationSettingsPreset) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Presets Management</span>
        </CardTitle>
        <CardDescription>
          Manage and apply validation settings presets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="font-medium">{preset.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {preset.isBuiltIn ? 'Built-in' : 'Custom'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{preset.description}</p>
                <div className="flex flex-wrap gap-1">
                  {preset.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline">
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button size="sm" onClick={() => onPresetApply(preset)}>
                  Apply
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Modal Components
// ============================================================================

function AddTerminologyServerModal({ 
  open, 
  onOpenChange, 
  onAdd 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (serverData: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    timeoutMs: 60000,
    useForValidation: true,
    useForExpansion: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.url) {
      onAdd(formData);
      setFormData({
        name: '',
        url: '',
        timeoutMs: 60000,
        useForValidation: true,
        useForExpansion: true
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Terminology Server
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Terminology Server</DialogTitle>
          <DialogDescription>
            Configure a new terminology server for value set validation and expansion.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., HL7 FHIR Terminology Server"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Server URL</Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://tx.fhir.org/r4"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={formData.timeoutMs}
              onChange={(e) => setFormData(prev => ({ ...prev, timeoutMs: parseInt(e.target.value) }))}
              min="1000"
              max="300000"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="useForValidation"
                checked={formData.useForValidation}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, useForValidation: checked }))}
              />
              <Label htmlFor="useForValidation">Use for Validation</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="useForExpansion"
                checked={formData.useForExpansion}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, useForExpansion: checked }))}
              />
              <Label htmlFor="useForExpansion">Use for Expansion</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Server</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddProfileServerModal({ 
  open, 
  onOpenChange, 
  onAdd 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (serverData: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    timeoutMs: 60000,
    useForProfileResolution: true,
    useForStructureDefinitionResolution: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.url) {
      onAdd(formData);
      setFormData({
        name: '',
        url: '',
        timeoutMs: 60000,
        useForProfileResolution: true,
        useForStructureDefinitionResolution: true
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Profile Server
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Profile Resolution Server</DialogTitle>
          <DialogDescription>
            Configure a new server for profile and structure definition resolution.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Simplifier.net"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Server URL</Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://packages.simplifier.net"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={formData.timeoutMs}
              onChange={(e) => setFormData(prev => ({ ...prev, timeoutMs: parseInt(e.target.value) }))}
              min="1000"
              max="300000"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="useForProfileResolution"
                checked={formData.useForProfileResolution}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, useForProfileResolution: checked }))}
              />
              <Label htmlFor="useForProfileResolution">Use for Profile Resolution</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="useForStructureDefinitionResolution"
                checked={formData.useForStructureDefinitionResolution}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, useForStructureDefinitionResolution: checked }))}
              />
              <Label htmlFor="useForStructureDefinitionResolution">Use for Structure Definition Resolution</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Server</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function getDefaultSettings(): ValidationSettings {
  return {
    version: 1,
    isActive: true,
    structural: {
      enabled: true,
      severity: 'error',
      timeoutMs: 30000,
      failFast: false
    },
    profile: {
      enabled: true,
      severity: 'warning',
      timeoutMs: 45000,
      failFast: false
    },
    terminology: {
      enabled: true,
      severity: 'warning',
      timeoutMs: 60000,
      failFast: false
    },
    reference: {
      enabled: true,
      severity: 'error',
      timeoutMs: 30000,
      failFast: false
    },
    businessRule: {
      enabled: true,
      severity: 'warning',
      timeoutMs: 30000,
      failFast: false
    },
    metadata: {
      enabled: true,
      severity: 'information',
      timeoutMs: 15000,
      failFast: false
    },
    strictMode: false,
    defaultSeverity: 'warning',
    includeDebugInfo: false,
    validateAgainstBaseSpec: true,
    fhirVersion: 'R4',
    terminologyServers: [],
    profileResolutionServers: [],
    cacheSettings: {
      enabled: true,
      ttlMs: 300000,
      maxSizeMB: 100,
      cacheValidationResults: true,
      cacheTerminologyExpansions: true,
      cacheProfileResolutions: true
    },
    timeoutSettings: {
      defaultTimeoutMs: 30000,
      structuralValidationTimeoutMs: 30000,
      profileValidationTimeoutMs: 45000,
      terminologyValidationTimeoutMs: 60000,
      referenceValidationTimeoutMs: 30000,
      businessRuleValidationTimeoutMs: 30000,
      metadataValidationTimeoutMs: 15000
    },
    maxConcurrentValidations: 10,
    useParallelValidation: true,
    customRules: [],
    validateExternalReferences: false,
    validateNonExistentReferences: true,
    validateReferenceTypes: true
  };
}

function updateNestedProperty(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const result = { ...obj };
  let current = result;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
}
