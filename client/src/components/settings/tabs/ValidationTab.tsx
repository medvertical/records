/**
 * ValidationTab Component
 * 
 * Centralizes all FHIR validation configuration:
 * 1. Validation Engine - Global engine selector (auto/server/local/schema/hybrid)
 * 2. Terminology Mode - Online vs Offline code validation
 * 3. Profile Sources - Where to load StructureDefinitions (local/simplifier/both)
 * 4. Validation Aspects - 6 aspects with per-aspect engine & severity
 * 5. Performance - Concurrency and batch size settings
 * 6. Resource Filtering - Limit validation to specific resource types
 * 7. Advanced Settings - Timeout, memory, caching
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, CheckCircle, XCircle, Info, Globe, HardDrive, Database, Server, AlertTriangle, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActiveServer } from '@/hooks/use-active-server';
import { SettingSection, SectionTitle, TabHeader } from '../shared';
import type { ValidationSettings, FHIRVersion } from '@shared/validation-settings';

interface ValidationTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function ValidationTab({ onDirtyChange }: ValidationTabProps) {
  const { toast } = useToast();
  const { activeServer } = useActiveServer();
  const [settings, setSettings] = useState<ValidationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [fhirVersion, setFhirVersion] = useState<FHIRVersion>('R4');
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [resourceTypesSource, setResourceTypesSource] = useState<'server' | 'static' | 'filtered' | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [activeServer]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (fhirVersion) {
      loadResourceTypes(fhirVersion);
    }
  }, [fhirVersion]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const serverId = activeServer?.id;
      const response = await fetch(`/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`);
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSettings(data);
      
      // Extract FHIR version from settings if available
      if ((data.resourceTypes as any)?.fhirVersion) {
        setFhirVersion((data.resourceTypes as any).fhirVersion);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load validation settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadResourceTypes = async (fhirVersion: FHIRVersion) => {
    try {
      const serverId = activeServer?.id;
      const response = await fetch(`/api/validation/resource-types?fhirVersion=${fhirVersion}${serverId ? `&serverId=${serverId}` : ''}`);
      
      if (response.ok) {
        const data = await response.json();
        setAvailableResourceTypes(data.resourceTypes || []);
        setResourceTypesSource(data.source || 'static');
        setServerVersion(data.serverVersion || null);
      } else {
        setAvailableResourceTypes([]);
        setResourceTypesSource('static');
      }
    } catch (error) {
      console.error('Error loading resource types:', error);
      setAvailableResourceTypes([]);
      setResourceTypesSource('static');
    }
  };

  const updateAspect = (
    aspectKey: keyof ValidationSettings['aspects'],
    field: 'enabled' | 'severity' | 'engine',
    value: any
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      aspects: {
        ...settings.aspects,
        [aspectKey]: {
          ...settings.aspects[aspectKey],
          [field]: value
        }
      }
    });
    setIsDirty(true);
  };

  const updatePerformance = (field: 'maxConcurrent' | 'batchSize', value: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      performance: {
        ...settings.performance,
        [field]: value
      }
    });
    setIsDirty(true);
  };

  const updateMode = (mode: 'online' | 'offline') => {
    if (!settings) return;
    setSettings({ ...settings, mode });
    setIsDirty(true);
  };

  const updateProfileSources = (sources: 'local' | 'simplifier' | 'both') => {
    if (!settings) return;
    setSettings({ ...settings, profileSources: sources });
    setIsDirty(true);
  };

  const updateResourceTypes = (field: string, value: any) => {
    if (!settings) return;
    
    // Handle fhirVersion separately since it's not in the type definition
    if (field === 'fhirVersion') {
      setFhirVersion(value);
      setIsDirty(true);
      return;
    }
    
    setSettings({
      ...settings,
      resourceTypes: {
        ...settings.resourceTypes,
        [field]: value
      }
    });
    setIsDirty(true);
  };

  const toggleResourceType = (type: string) => {
    if (!settings) return;
    const included = settings.resourceTypes.includedTypes || [];
    const newIncluded = included.includes(type)
      ? included.filter(t => t !== type)
      : [...included, type];
    updateResourceTypes('includedTypes', newIncluded);
  };

  const updateAdvanced = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [field]: value
    });
    setIsDirty(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load validation settings</AlertDescription>
      </Alert>
    );
  }

  const aspectConfig = [
    {
      key: 'structural' as const,
      label: 'Structural Validation',
      description: 'Validates FHIR JSON structure and required fields',
      engines: ['schema', 'hapi', 'server'],
      defaultEngine: 'schema'
    },
    {
      key: 'profile' as const,
      label: 'Profile Validation',
      description: 'Validates against FHIR profiles and implementation guides',
      engines: ['hapi', 'server', 'auto'],
      defaultEngine: 'hapi'
    },
    {
      key: 'terminology' as const,
      label: 'Terminology Validation',
      description: 'Validates codes against terminology servers',
      engines: ['server', 'ontoserver', 'cached'],
      defaultEngine: 'server'
    },
    {
      key: 'reference' as const,
      label: 'Reference Validation',
      description: 'Validates resource references exist and are correct type',
      engines: ['internal', 'server'],
      defaultEngine: 'internal'
    },
    {
      key: 'businessRule' as const,
      label: 'Business Rules',
      description: 'Applies custom FHIRPath business rules',
      engines: ['fhirpath', 'custom'],
      defaultEngine: 'fhirpath'
    },
    {
      key: 'metadata' as const,
      label: 'Metadata Validation',
      description: 'Validates resource metadata fields',
      engines: ['schema', 'hapi'],
      defaultEngine: 'schema'
    }
  ];

  const currentMode = settings.mode || 'online';
  const currentProfileSources = settings.profileSources || 'both';
  const currentEngine = (settings as any).engine || 'auto';

  return (
    <div className="space-y-6">
      <TabHeader 
        title="Validation Settings"
        subtitle="Configure FHIR validation behavior, engines, performance, and resource filtering"
      />
      
      <div className="space-y-3">
        {/* 1. Validation Engine */}
        <div className="space-y-2 pb-3 border-b">
          <SectionTitle 
            title="Validation Engine" 
            helpText="Choose how Records performs data validation. Hybrid mode runs lightweight schema checks first, then deep validation on failures. Auto selects the best engine based on context."
          />
        <RadioGroup value={currentEngine} onValueChange={(v) => updateAdvanced('engine', v)} className="space-y-2">
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auto" className="font-medium cursor-pointer text-sm">
                Auto (Recommended)
              </Label>
              <p className="text-xs text-muted-foreground">Automatically selects best engine</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="server" id="server" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="server" className="font-medium cursor-pointer text-sm">
                Server ($validate)
              </Label>
              <p className="text-xs text-muted-foreground">Uses FHIR server's $validate operation</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="local" id="local-engine" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="local-engine" className="font-medium cursor-pointer text-sm">
                Local (HAPI Validator)
              </Label>
              <p className="text-xs text-muted-foreground">Java-based local validation</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="schema" id="schema" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="schema" className="font-medium cursor-pointer text-sm">
                Schema (Structural only)
              </Label>
              <p className="text-xs text-muted-foreground">Fast schema validation only</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="hybrid" id="hybrid" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="hybrid" className="font-medium cursor-pointer text-sm">
                Hybrid (Fast + Deep)
              </Label>
              <p className="text-xs text-muted-foreground">Schema first, then full validation on errors</p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* 2 & 3. Mode & Profile Sources - Combined in one row */}
      <div className="grid grid-cols-2 gap-4 pb-3 border-b">
        <div className="space-y-2">
          <SectionTitle 
            title="Terminology Mode" 
            helpText="Online mode uses remote terminology servers (tx.fhir.org) for code validation. Offline mode uses cached ValueSets and local Ontoserver for validation without internet connectivity."
          />
          <div className="flex items-center gap-3">
            <Switch
              checked={currentMode === 'online'}
              onCheckedChange={(checked) => updateMode(checked ? 'online' : 'offline')}
            />
            <div className="flex items-center gap-2">
              {currentMode === 'online' ? (
                <>
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Online (FHIR Server)</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Offline (Cached)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <SectionTitle 
            title="Profile Sources" 
            helpText="Select where Records loads FHIR profiles and implementation guides from. Local uses cached profiles, Simplifier fetches from simplifier.net, Both (recommended) uses both sources."
          />
          <Select value={currentProfileSources} onValueChange={updateProfileSources}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Both (Recommended)</SelectItem>
              <SelectItem value="local">Local Cache</SelectItem>
              <SelectItem value="simplifier">Simplifier.net</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4. Validation Aspects - Per-Aspect Validation Method */}
      <div className="space-y-3 pb-3 border-b">
        <SectionTitle 
          title="Validation Aspects" 
          helpText="Configure individual validation scopes. Each aspect checks different parts of FHIR resources: structural (schema), profile (conformance), terminology (codes), references (links), business rules (custom logic), and metadata (resource info)."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aspectConfig.map((aspect) => {
            const aspectSettings = settings.aspects[aspect.key];
            const isEnabled = aspectSettings?.enabled ?? true;
            const currentEngine = aspectSettings?.engine ?? aspect.defaultEngine;
            const currentSeverity = aspectSettings?.severity ?? 'error';

            return (
              <Card key={aspect.key} className="p-4">
                <div className="space-y-3">
                  {/* Toggle at top */}
                  <div className="flex items-center justify-between">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => updateAspect(aspect.key, 'enabled', checked)}
                    />
                    {isEnabled ? (
                      <Badge variant="default" className="h-5 text-xs">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-xs">Disabled</Badge>
                    )}
                  </div>
                  
                  {/* Title with description */}
                  <div>
                    <h4 className="text-sm font-semibold">{aspect.label}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{aspect.description}</p>
                  </div>
                  
                  {/* Severity dropdown */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Severity</Label>
                    <Select
                      value={currentSeverity}
                      onValueChange={(value) => updateAspect(aspect.key, 'severity', value as any)}
                      disabled={!isEnabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error" className="text-xs">Error</SelectItem>
                        <SelectItem value="warning" className="text-xs">Warning</SelectItem>
                        <SelectItem value="info" className="text-xs">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Engine selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Engine</Label>
                    <Select
                      value={currentEngine}
                      onValueChange={(value) => updateAspect(aspect.key, 'engine', value)}
                      disabled={!isEnabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aspect.engines.map((engine) => (
                          <SelectItem key={engine} value={engine} className="text-xs">
                            {engine.charAt(0).toUpperCase() + engine.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 5. Performance & Concurrency */}
      <div className="space-y-3 pb-3 border-b">
        <SectionTitle 
          title="Performance & Concurrency" 
          helpText="Tune validation throughput. Max Concurrent controls how many resources validate in parallel. Batch Size sets how many resources are grouped together. Higher values = faster but more memory usage."
        />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Max Concurrent Validations</Label>
              <span className="text-sm font-semibold text-primary">{settings.performance.maxConcurrent}</span>
            </div>
            <Slider
              min={1}
              max={16}
              step={1}
              value={[settings.performance.maxConcurrent]}
              onValueChange={(value) => updatePerformance('maxConcurrent', value[0])}
            />
            <p className="text-xs text-muted-foreground">Recommended: 4-8</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Batch Size</Label>
              <span className="text-sm font-semibold text-primary">{settings.performance.batchSize}</span>
            </div>
            <Slider
              min={10}
              max={100}
              step={10}
              value={[settings.performance.batchSize]}
              onValueChange={(value) => updatePerformance('batchSize', value[0])}
            />
            <p className="text-xs text-muted-foreground">Recommended: 25-50</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <Label className="text-sm font-medium">Enable Result Caching</Label>
              <p className="text-xs text-muted-foreground">Cache validation results for improved performance</p>
            </div>
            <Switch
              checked={(settings as any).cacheEnabled ?? true}
              onCheckedChange={(checked) => updateAdvanced('cacheEnabled', checked)}
            />
          </div>
        </div>
      </div>

      {/* 6. Resource Type Filtering */}
      <div className="space-y-3 pb-3 border-b">
        <SectionTitle 
          title="Resource Filtering" 
          helpText="Restrict which FHIR resource types are validated. Enable filtering, then click badges to select/deselect types. Only selected types will be validated. Improves performance when working with specific resource subsets."
        />
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="fhir-version" className="text-sm font-medium">FHIR</Label>
              <Select
                value={fhirVersion}
                onValueChange={(value: FHIRVersion) => updateResourceTypes('fhirVersion', value)}
              >
                <SelectTrigger className="w-24 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R4">R4</SelectItem>
                  <SelectItem value="R5">R5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="resource-filtering" className="text-sm font-medium">Filter Types</Label>
              <Switch
                id="resource-filtering"
                checked={settings.resourceTypes.enabled}
                onCheckedChange={(checked) => updateResourceTypes('enabled', checked)}
              />
            </div>

            {settings.resourceTypes.enabled && settings.resourceTypes.includedTypes && settings.resourceTypes.includedTypes.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {settings.resourceTypes.includedTypes.length} selected
              </Badge>
            )}
          </div>

          {settings.resourceTypes.enabled && (
            availableResourceTypes.length === 0 ? (
              <Alert className="py-2">
                <AlertTriangle className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  No resource types available for FHIR {fhirVersion}.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="border rounded-lg p-2 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {availableResourceTypes.map((type) => (
                    <Badge
                      key={type}
                      variant={settings.resourceTypes.includedTypes?.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer hover:opacity-80 transition-opacity text-xs h-6"
                      onClick={() => toggleResourceType(type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 7. Advanced Settings */}
      <Accordion type="single" collapsible className="pb-3">
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Advanced Settings</span>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Timeouts and memory settings for local validation engine. Adjust these if validation fails or runs slowly.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeout" className="text-sm font-medium">Validation Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={1000}
                  max={60000}
                  step={1000}
                  className="h-9"
                  value={(settings as any).timeout || 30000}
                  onChange={(e) => updateAdvanced('timeout', parseInt(e.target.value) || 30000)}
                />
                <p className="text-xs text-muted-foreground">Default: 30000ms (30 seconds)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memoryLimit" className="text-sm font-medium">Memory Limit (MB)</Label>
                <Input
                  id="memoryLimit"
                  type="number"
                  min={128}
                  max={2048}
                  step={128}
                  className="h-9"
                  value={(settings as any).memoryLimit || 512}
                  onChange={(e) => updateAdvanced('memoryLimit', parseInt(e.target.value) || 512)}
                />
                <p className="text-xs text-muted-foreground">Default: 512MB</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {isDirty && (
        <Alert className="py-2">
          <Info className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Unsaved changes - click Save to apply
          </AlertDescription>
        </Alert>
      )}
      </div>
    </div>
  );
}
