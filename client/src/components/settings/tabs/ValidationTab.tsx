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

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, CheckCircle, XCircle, Info, Globe, HardDrive, Database, Server, AlertTriangle, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActiveServer } from '@/hooks/use-active-server';
import { cn } from '@/lib/utils';
import { SettingSection, SectionTitle, TabHeader, AspectCard } from '../shared';
import type { ValidationSettings, FHIRVersion } from '@shared/validation-settings';
import { DEFAULT_VALIDATION_SETTINGS_R4 } from '@shared/validation-settings';

interface ValidationTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  hideHeader?: boolean;
  saveCounter?: number;
  onSaveComplete?: () => void;
  onSaveError?: (error: string) => void;
  reloadTrigger?: number;  // Trigger reload when this changes
}

export function ValidationTab({ onDirtyChange, onLoadingChange, hideHeader = false, saveCounter = 0, onSaveComplete, onSaveError, reloadTrigger }: ValidationTabProps) {
  const { toast } = useToast();
  const { activeServer } = useActiveServer();
  const [settings, setSettings] = useState<ValidationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [fhirVersion, setFhirVersion] = useState<FHIRVersion>('R4');
  const [previousFhirVersion, setPreviousFhirVersion] = useState<FHIRVersion | null>(null);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [resourceTypesSource, setResourceTypesSource] = useState<'server' | 'static' | 'filtered' | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  // Track which reloadTrigger value we've already loaded for
  const loadedTriggerValueRef = useRef<number>(0);
  // Track which saveCounter value we've already saved for
  const savedCounterValueRef = useRef<number>(0);

  // Load settings only when reloadTrigger changes to a new value (skip initial mount)
  useEffect(() => {
    if (reloadTrigger && reloadTrigger > 0 && reloadTrigger !== loadedTriggerValueRef.current) {
      console.log('[ValidationTab] Loading settings, reloadTrigger:', reloadTrigger);
      loadedTriggerValueRef.current = reloadTrigger; // Mark this value as loaded BEFORE async call
      loadSettings();
    }
  }, [reloadTrigger]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Only load resource types if FHIR version actually changed (prevents duplicate loads)
  useEffect(() => {
    if (fhirVersion && fhirVersion !== previousFhirVersion) {
      console.log('[ValidationTab] FHIR version changed, loading resource types:', previousFhirVersion, '→', fhirVersion);
      loadResourceTypes(fhirVersion);
      setPreviousFhirVersion(fhirVersion);
    }
  }, [fhirVersion, previousFhirVersion]);

  // Trigger save when saveCounter changes to a new value (but not during load or duplicates)
  useEffect(() => {
    if (saveCounter && saveCounter > 0 && !loading && saveCounter !== savedCounterValueRef.current) {
      console.log('[ValidationTab] Save triggered by saveCounter:', saveCounter);
      savedCounterValueRef.current = saveCounter; // Mark this value as saved BEFORE async call
      saveSettings();
    }
  }, [saveCounter, loading]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('[ValidationTab] Fetching validation settings...');
      const serverId = activeServer?.id;
      const response = await fetch(`/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`);
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      console.log('[ValidationTab] Settings loaded successfully');
      
      // Calculate global engine from aspect engines (for UI display)
      const aspectEngines = Object.values(data.aspects || {}).map((a: any) => a?.engine).filter(Boolean);
      const uniqueEngines = [...new Set(aspectEngines)];
      const calculatedEngine = uniqueEngines.length === 1 ? uniqueEngines[0] : 'auto';
      
      console.log('[ValidationTab] Calculated global engine:', calculatedEngine, 'from aspect engines:', aspectEngines);
      
      setSettings({
        ...data,
        engine: calculatedEngine // Set top-level engine for UI (derived from aspects)
      });
      
      // Extract FHIR version from settings if available
      if ((data.resourceTypes as any)?.fhirVersion) {
        const newVersion = (data.resourceTypes as any).fhirVersion;
        console.log('[ValidationTab] Extracted FHIR version from settings:', newVersion);
        setFhirVersion(newVersion);
      }
    } catch (error) {
      console.error('[ValidationTab] Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load validation settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) {
      console.log('[ValidationTab] No settings to save');
      onSaveComplete?.();
      return;
    }
    
    try {
      console.log('[ValidationTab] 💾 Saving validation settings...');
      console.log('[ValidationTab] Current settings state:', JSON.stringify(settings, null, 2));
      const serverId = activeServer?.id;
      
      // Transform full settings to update format expected by API
      // NOTE: Top-level "engine" field is NOT part of ValidationSettingsUpdate interface
      // and will be ignored by backend. Only aspect-specific engines are persisted.
      const updatePayload = {
        aspects: settings.aspects,
        performance: settings.performance,
        resourceTypes: settings.resourceTypes,
        mode: settings.mode,
        useFhirValidateOperation: settings.useFhirValidateOperation,
        terminologyServers: settings.terminologyServers,
        circuitBreaker: settings.circuitBreaker,
        terminologyFallback: settings.terminologyFallback,
        offlineConfig: settings.offlineConfig,
        profileSources: settings.profileSources,
        autoRevalidateAfterEdit: settings.autoRevalidateAfterEdit,
        autoRevalidateOnVersionChange: settings.autoRevalidateOnVersionChange,
        listViewPollingInterval: settings.listViewPollingInterval,
        // REMOVED: engine (not supported by ValidationSettingsUpdate)
      };
      
      console.log('[ValidationTab] 📤 Save payload:', JSON.stringify(updatePayload, null, 2));
      
      const response = await fetch(`/api/validation/settings${serverId ? `?serverId=${serverId}` : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      console.log('[ValidationTab] 📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ValidationTab] ❌ Save failed:', errorData);
        throw new Error(errorData.message || 'Failed to save validation settings');
      }

      const savedData = await response.json();
      console.log('[ValidationTab] 📥 Save response data:', savedData);
      console.log('[ValidationTab] ✅ Validation settings saved successfully');
      
      setIsDirty(false);
      onSaveComplete?.();
    } catch (error) {
      console.error('[ValidationTab] ❌ Error saving validation settings:', error);
      onSaveError?.(error instanceof Error ? error.message : 'Validation save failed');
    }
  };

  const loadResourceTypes = async (fhirVersion: FHIRVersion) => {
    try {
      console.log('[ValidationTab] Fetching resource types for FHIR version:', fhirVersion);
      const serverId = activeServer?.id;
      const response = await fetch(`/api/validation/resource-types?fhirVersion=${fhirVersion}${serverId ? `&serverId=${serverId}` : ''}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[ValidationTab] Resource types loaded:', data.resourceTypes?.length || 0, 'types');
        setAvailableResourceTypes(data.resourceTypes || []);
        setResourceTypesSource(data.source || 'static');
        setServerVersion(data.serverVersion || null);
      } else {
        console.warn('[ValidationTab] Resource types request failed, using static fallback');
        setAvailableResourceTypes([]);
        setResourceTypesSource('static');
      }
    } catch (error) {
      console.error('[ValidationTab] Error loading resource types:', error);
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
    
    // Special handling for global engine selection
    if (field === 'engine') {
      console.log('[ValidationTab] Global engine changed to:', value);
      
      // Update all aspect engines to match the global selection
      const updatedAspects = { ...settings.aspects };
      Object.keys(updatedAspects).forEach(aspectKey => {
        if (updatedAspects[aspectKey as keyof typeof updatedAspects]) {
          updatedAspects[aspectKey as keyof typeof updatedAspects] = {
            ...updatedAspects[aspectKey as keyof typeof updatedAspects],
            engine: value
          };
        }
      });
      
      console.log('[ValidationTab] Updated all aspect engines to:', value);
      setSettings({
        ...settings,
        aspects: updatedAspects,
        engine: value // Keep top-level for UI display (not persisted to backend)
      } as ValidationSettings);
    } else {
      setSettings({
        ...settings,
        [field]: value
      } as ValidationSettings);
    }
    
    setIsDirty(true);
  };

  const handleResetAspects = () => {
    if (!settings) return;
    const defaults = DEFAULT_VALIDATION_SETTINGS_R4.aspects;
    setSettings({
      ...settings,
      aspects: JSON.parse(JSON.stringify(defaults)) // Deep copy
    });
    setIsDirty(true);
    toast({
      title: 'Aspects Reset',
      description: 'All validation aspects restored to default configuration'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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
  const isServerEngine = currentEngine === 'server';

  return (
    <div className={hideHeader ? "space-y-8" : "space-y-6"}>
      {!hideHeader && (
        <TabHeader 
          title="Validation Settings"
          subtitle="Configure FHIR validation behavior, engines, performance, and resource filtering"
        />
      )}
      
      <div className="space-y-8">
        {/* 1. Validation Engine */}
        <div className="space-y-3">
          <SectionTitle 
            title="Validation Engine" 
            helpText="Choose how Records performs data validation. Hybrid mode runs lightweight schema checks first, then deep validation on failures. Auto selects the best engine based on context."
          />
        <RadioGroup value={currentEngine} onValueChange={(v) => updateAdvanced('engine', v)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Label htmlFor="auto" className={cn("flex items-start space-x-2 rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer relative group", currentEngine === 'auto' ? "border-2 border-primary" : "border")}>
            <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Auto (Recommended)</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Intelligently switches between validation engines based on resource type, profile availability, and server capabilities. Best for general use.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Automatically selects best engine</p>
            </div>
          </Label>
          <Label htmlFor="server" className={cn("flex items-start space-x-2 rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer relative group", currentEngine === 'server' ? "border-2 border-primary" : "border")}>
            <RadioGroupItem value="server" id="server" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Server ($validate)</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Delegates validation to the FHIR server using the $validate operation. Ensures consistency with server-side validation rules but requires network connectivity.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Uses FHIR server's $validate operation</p>
            </div>
          </Label>
          <Label htmlFor="local-engine" className={cn("flex items-start space-x-2 rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer relative group", currentEngine === 'local' ? "border-2 border-primary" : "border")}>
            <RadioGroupItem value="local" id="local-engine" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Local (HAPI Validator)</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Uses the official HAPI FHIR Validator library for comprehensive validation including profiles, terminology, and business rules. Most thorough option but slower.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Java-based local validation</p>
            </div>
          </Label>
          <Label htmlFor="schema" className={cn("flex items-start space-x-2 rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer relative group", currentEngine === 'schema' ? "border-2 border-primary" : "border")}>
            <RadioGroupItem value="schema" id="schema" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Schema (Structural only)</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Fast JSON schema validation checking only structural correctness and required fields. Does not validate profiles, terminology, or business rules.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Fast schema validation only</p>
            </div>
          </Label>
          <Label htmlFor="hybrid" className={cn("flex items-start space-x-2 rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer relative group", currentEngine === 'hybrid' ? "border-2 border-primary" : "border")}>
            <RadioGroupItem value="hybrid" id="hybrid" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Hybrid (Fast + Deep)</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Two-stage validation: fast schema check first, then full HAPI validation only on resources with errors. Balances speed and thoroughness.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Schema first, then full validation on errors</p>
            </div>
          </Label>
        </RadioGroup>
      </div>

      {/* 2 & 3. Mode & Profile Sources - Combined in one row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
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

        <div className="space-y-3">
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
      <div className="space-y-3">
        <SectionTitle 
          title="Validation Aspects" 
          helpText="Configure individual validation scopes. Each aspect checks different parts of FHIR resources: structural (schema), profile (conformance), terminology (codes), references (links), business rules (custom logic), and metadata (resource info)."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-fr">
          {aspectConfig.map((aspect) => {
            const aspectSettings = settings.aspects[aspect.key];
            const isEnabled = aspectSettings?.enabled ?? true;
            const currentEngine = aspectSettings?.engine ?? aspect.defaultEngine;
            const currentSeverity = aspectSettings?.severity ?? 'error';

            return (
              <AspectCard
                key={aspect.key}
                title={aspect.label}
                description={aspect.description}
                enabled={isEnabled}
                severity={currentSeverity}
                engine={currentEngine}
                availableEngines={aspect.engines}
                onToggle={(checked) => updateAspect(aspect.key, 'enabled', checked)}
                onSeverityChange={(value) => updateAspect(aspect.key, 'severity', value)}
                onEngineChange={(value) => updateAspect(aspect.key, 'engine', value)}
              />
            );
          })}
        </div>
        
        {/* Reset Defaults Button */}
        <div className="flex justify-end mt-4">
          <Button variant="outline" size="sm" onClick={handleResetAspects}>
            Reset Aspect Defaults
          </Button>
        </div>
      </div>

      {/* 5. Performance & Concurrency */}
      <div className="space-y-3">
        <SectionTitle 
          title="Performance & Concurrency" 
          helpText="Tune validation throughput. Max Concurrent controls how many resources validate in parallel. Batch Size sets how many resources are grouped together. Higher values = faster but more memory usage."
        />
        
        {isServerEngine && (
          <Alert className="mb-3">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Performance settings are not applicable when using server-side validation.
              The FHIR server controls concurrency and batching.
            </AlertDescription>
          </Alert>
        )}
        
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
              disabled={isServerEngine}
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
              disabled={isServerEngine}
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
              disabled={isServerEngine}
            />
          </div>
        </div>
      </div>

      {/* 6. Resource Type Filtering */}
      <div className="space-y-3">
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
      <Accordion type="single" collapsible>
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
      </div>
    </div>
  );
}
