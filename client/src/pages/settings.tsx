import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import ServerConnectionModal from '@/components/settings/server-connection-modal';
import { 
  Settings, 
  Database, 
  Shield, 
  Bell, 
  Palette, 
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  Server,
  GripVertical,
  Plus,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useValidationSettings, useUpdateValidationSettings } from '@/hooks/use-fhir-data';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Terminology Server Component
function SortableTerminologyServer({ server, index, localSettings, handleSettingChange }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: server.priority.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      className={`p-4 border-l-4 ${isDragging ? 'opacity-50' : ''}`}
      style={{
        borderLeftColor: server.enabled ? '#3b82f6' : '#d1d5db',
        ...style
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <Badge variant={server.enabled ? "default" : "secondary"} className="text-xs">
            Priority {server.priority}
          </Badge>
          <h5 className="font-medium text-sm">{server.name}</h5>
          <Badge variant="outline" className="text-xs">
            {server.type}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={server.enabled}
            onCheckedChange={(checked) => {
              const newServers = [...(settings.terminologyServers || [])];
              newServers[index] = { ...server, enabled: checked };
              handleSettingChange('terminologyServers', newServers);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newServers = (settings.terminologyServers || []).filter((_, i) => i !== index);
              // Re-adjust priorities
              const reorderedServers = newServers.map((server, i) => ({
                ...server,
                priority: i + 1
              }));
              handleSettingChange('terminologyServers', reorderedServers);
            }}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mb-3">{server.description}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <Label className="text-xs font-medium">URL</Label>
          <Input
            value={server.url}
            onChange={(e) => {
              const newServers = [...(settings.terminologyServers || [])];
              newServers[index] = { ...server, url: e.target.value };
              handleSettingChange('terminologyServers', newServers);
            }}
            className="text-xs h-8"
            disabled={!server.enabled}
          />
        </div>
        
        <div>
          <Label className="text-xs font-medium">Priority</Label>
          <Input
            type="number"
            min="1"
            max="10"
            value={server.priority}
            onChange={(e) => {
              const newServers = [...(settings.terminologyServers || [])];
              newServers[index] = { ...server, priority: parseInt(e.target.value) || 1 };
              // Re-sort servers by priority
              newServers.sort((a, b) => a.priority - b.priority);
              handleSettingChange('terminologyServers', newServers);
            }}
            className="text-xs h-8"
            disabled={!server.enabled}
          />
        </div>
        
        <div>
          <Label className="text-xs font-medium">Name</Label>
          <Input
            value={server.name}
            onChange={(e) => {
              const newServers = [...(settings.terminologyServers || [])];
              newServers[index] = { ...server, name: e.target.value };
              handleSettingChange('terminologyServers', newServers);
            }}
            className="text-xs h-8"
            disabled={!server.enabled}
          />
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {server.capabilities?.map((capability, capIndex) => (
          <Badge key={capIndex} variant="outline" className="text-xs">
            {capability}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

// Sortable Profile Resolution Server Component
function SortableProfileServer({ server, index, localSettings, handleSettingChange }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: server.priority.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      className={`p-4 border-l-4 ${isDragging ? 'opacity-50' : ''}`}
      style={{
        borderLeftColor: server.enabled ? '#10b981' : '#d1d5db',
        ...style
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <Badge variant={server.enabled ? "default" : "secondary"} className="text-xs">
            Priority {server.priority}
          </Badge>
          <h5 className="font-medium text-sm">{server.name}</h5>
          <Badge variant="outline" className="text-xs">
            {server.type}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={server.enabled}
            onCheckedChange={(checked) => {
              console.log(`[ProfileServer] Toggling ${server.name} from ${server.enabled} to ${checked}`);
              const newServers = [...(settings.profileResolutionServers || [])];
              newServers[index] = { ...server, enabled: checked };
              console.log(`[ProfileServer] Updated servers:`, newServers);
              handleSettingChange('profileResolutionServers', newServers);
              
              toast({
                title: `${server.name} ${checked ? 'Enabled' : 'Disabled'}`,
                description: `Profile resolution server has been ${checked ? 'activated' : 'deactivated'}.`,
              });
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newServers = (settings.profileResolutionServers || []).filter((_, i) => i !== index);
              // Re-adjust priorities
              const reorderedServers = newServers.map((server, i) => ({
                ...server,
                priority: i + 1
              }));
              handleSettingChange('profileResolutionServers', reorderedServers);
            }}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mb-3">{server.description}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <Label className="text-xs font-medium">URL</Label>
          <Input
            value={server.url}
            onChange={(e) => {
              const newServers = [...(settings.profileResolutionServers || [])];
              newServers[index] = { ...server, url: e.target.value };
              handleSettingChange('profileResolutionServers', newServers);
            }}
            className="text-xs h-8"
            disabled={!server.enabled}
          />
        </div>
        
        <div>
          <Label className="text-xs font-medium">Priority</Label>
          <Input
            type="number"
            min="1"
            max="10"
            value={server.priority}
            onChange={(e) => {
              const newServers = [...(settings.profileResolutionServers || [])];
              newServers[index] = { ...server, priority: parseInt(e.target.value) || 1 };
              // Re-sort servers by priority
              newServers.sort((a, b) => a.priority - b.priority);
              handleSettingChange('profileResolutionServers', newServers);
            }}
            className="text-xs h-8"
            disabled={!server.enabled}
          />
        </div>
        
        <div>
          <Label className="text-xs font-medium">Name</Label>
          <Input
            value={server.name}
            onChange={(e) => {
              const newServers = [...(settings.profileResolutionServers || [])];
              newServers[index] = { ...server, name: e.target.value };
              handleSettingChange('profileResolutionServers', newServers);
            }}
            className="text-xs h-8"
            disabled={!server.enabled}
          />
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {server.capabilities?.map((capability, capIndex) => (
          <Badge key={capIndex} variant="outline" className="text-xs">
            {capability}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [notifications, setNotifications] = useState({
    validationErrors: true,
    connectionIssues: true,
    resourceUpdates: false,
    systemAlerts: true
  });

  const [fhirSettings, setFhirSettings] = useState({
    defaultPageSize: 50,
    maxRetries: 3,
    requestTimeout: 30,
    cacheEnabled: true,
    cacheDuration: 300
  });

  // Drag and Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create a completely new settings management approach
  const ValidationSettingsContent = () => {
    const { data: serverSettings, isLoading } = useValidationSettings();
    const updateSettings = useUpdateValidationSettings();
    const { toast } = useToast();
    
    // Use a ref to store the actual settings - this prevents React re-renders from affecting our data
    const settingsRef = React.useRef<any>(null);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    
    // Initialize settings once from server
    React.useEffect(() => {
      if (serverSettings && !settingsRef.current) {
        console.log('[Settings] Initializing settings from server');
        settingsRef.current = { ...serverSettings };
        forceUpdate(); // Trigger a render with the new settings
      }
    }, [serverSettings]);
    
    // Get current settings from ref with a clean getter
    const getSettings = () => settingsRef.current || {
      // Enhanced Validation Engine - 6 Aspects
      enableStructuralValidation: true,
      enableProfileValidation: true,
      enableTerminologyValidation: true,
      enableReferenceValidation: true,
      enableBusinessRuleValidation: true,
      enableMetadataValidation: true,
      
      // Legacy settings
      fetchFromSimplifier: true,
      fetchFromFhirServer: true,
      autoDetectProfiles: true,
      strictMode: false,
      maxProfiles: 3,
      cacheDuration: 3600,
      
      // Advanced settings
      validationProfiles: [
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'
      ],
      terminologyServers: [
        {
          priority: 1,
          enabled: true,
          url: 'https://r4.ontoserver.csiro.au/fhir',
          type: 'ontoserver',
          name: 'CSIRO OntoServer',
          description: 'Primary terminology server with SNOMED CT, LOINC, extensions',
          capabilities: ['SNOMED CT', 'LOINC', 'ICD-10', 'Extensions', 'ValueSets']
        },
        {
          priority: 2,
          enabled: true,
          url: 'https://tx.fhir.org/r4',
          type: 'fhir-terminology',
          name: 'HL7 FHIR Terminology Server',
          description: 'Official HL7 terminology server for FHIR standards',
          capabilities: ['US Core', 'FHIR Base', 'HL7 Standards', 'ValueSets']
        },
        {
          priority: 3,
          enabled: false,
          url: 'https://snowstorm.ihtsdotools.org/fhir',
          type: 'snowstorm',
          name: 'SNOMED International',
          description: 'Official SNOMED CT terminology server',
          capabilities: ['SNOMED CT', 'ECL', 'Concept Maps']
        }
      ],
      terminologyServer: {
        enabled: true,
        url: 'https://r4.ontoserver.csiro.au/fhir',
        type: 'ontoserver',
        description: 'CSIRO OntoServer (Public)'
      },
      
      // Profile Resolution Servers
      profileResolutionServers: [
        {
          priority: 1,
          enabled: true,
          url: 'https://packages.simplifier.net',
          type: 'simplifier',
          name: 'Simplifier.net',
          description: 'Firely Simplifier - Community profile registry with thousands of FHIR profiles',
          capabilities: ['FHIR Profiles', 'Implementation Guides', 'Extensions', 'US Core', 'IPS', 'Custom Profiles']
        },
        {
          priority: 2,
          enabled: true,
          url: 'https://build.fhir.org',
          type: 'fhir-ci',
          name: 'FHIR CI Build',
          description: 'Official FHIR continuous integration server with latest profiles',
          capabilities: ['Official FHIR Profiles', 'Core Profiles', 'Development Versions']
        },
        {
          priority: 3,
          enabled: true,
          url: 'https://registry.fhir.org',
          type: 'fhir-registry',
          name: 'FHIR Package Registry',
          description: 'Official FHIR package registry for stable profile versions',
          capabilities: ['Stable Profiles', 'Published IGs', 'Official Packages']
        }
      ],
      
      // Performance settings
      batchSize: 20,
      maxRetries: 3,
      timeout: 30000,
      
      // Quality thresholds
      minValidationScore: 70,
      errorSeverityThreshold: 'warning'
    };
    
    // Use a memoized version for rendering
    const settings = getSettings();
    
    // Completely new save mechanism - direct and simple
    const handleSettingChange = (key: string, value: any) => {
      if (!settingsRef.current) return;
      
      console.log('[Settings] Updating:', key, value);
      
      // Update the ref directly
      settingsRef.current = { ...settingsRef.current, [key]: value };
      
      // Force React to re-render with new settings
      forceUpdate();
      
      // Save to server - fire and forget approach
      updateSettings.mutate(settingsRef.current, {
        onError: (error) => {
          console.error('[Settings] Save failed:', error);
          toast({
            title: 'Save Failed',
            description: 'Failed to save settings. Please try again.',
            variant: 'destructive'
          });
        }
      });
    };

    const handleNestedSettingChange = (parent: string, key: string, value: any) => {
      if (!settingsRef.current) return;
      
      settingsRef.current = { 
        ...settingsRef.current, 
        [parent]: { 
          ...settingsRef.current[parent], 
          [key]: value 
        } 
      };
      
      forceUpdate();
      
      updateSettings.mutate(settingsRef.current, {
        onError: (error) => {
          console.error('[Settings] Save failed:', error);
          toast({
            title: 'Save Failed',
            description: 'Failed to save settings. Please try again.',
            variant: 'destructive'
          });
        }
      });
    };

    // Handle drag end for terminology servers
    const handleDragEnd = (event: DragEndEvent) => {
      if (!settingsRef.current) return;
      
      const { active, over } = event;

      if (active.id !== over?.id) {
        const servers = settingsRef.current.terminologyServers || [];
        const oldIndex = servers.findIndex(server => server.priority.toString() === active.id);
        const newIndex = servers.findIndex(server => server.priority.toString() === over?.id);

        const newServers = arrayMove(servers, oldIndex, newIndex);
        
        // Update priorities based on new positions
        const updatedServers = newServers.map((server, index) => ({
          ...server,
          priority: index + 1
        }));

        settingsRef.current = { ...settingsRef.current, terminologyServers: updatedServers };
        forceUpdate();
        
        updateSettings.mutate(settingsRef.current, {
          onError: (error) => {
            console.error('[Settings] Drag reorder save failed:', error);
            toast({
              title: 'Save Failed',
              description: 'Failed to save server order. Please try again.',
              variant: 'destructive'
            });
          }
        });

        toast({
          title: 'Terminology Servers Reordered',
          description: 'Priority order has been updated successfully.',
        });
      }
    };

    // Handle drag end for profile resolution servers
    const handleProfileDragEnd = (event: DragEndEvent) => {
      if (!settingsRef.current) return;
      
      const { active, over } = event;

      if (active.id !== over?.id) {
        const servers = settingsRef.current.profileResolutionServers || [];
        const oldIndex = servers.findIndex(server => server.priority.toString() === active.id);
        const newIndex = servers.findIndex(server => server.priority.toString() === over?.id);

        const newServers = arrayMove(servers, oldIndex, newIndex);
        
        // Update priorities based on new positions
        const updatedServers = newServers.map((server, index) => ({
          ...server,
          priority: index + 1
        }));

        settingsRef.current = { ...settingsRef.current, profileResolutionServers: updatedServers };
        forceUpdate();
        
        updateSettings.mutate(settingsRef.current, {
          onError: (error) => {
            console.error('[Settings] Drag reorder save failed:', error);
            toast({
              title: 'Save Failed',
              description: 'Failed to save server order. Please try again.',
              variant: 'destructive'
            });
          }
        });

        toast({
          title: 'Profile Resolution Servers Reordered',
          description: 'Priority order has been updated successfully.',
        });
      }
    };

    if (isLoading || !settingsRef.current) {
      return <div className="text-center py-8">Loading Enhanced Validation Engine settings...</div>;
    }

    return (
      <div className="space-y-6">
        {/* Enhanced Validation Engine - 6 Aspects */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            Enhanced Validation Engine
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comprehensive FHIR validation with 6 validation aspects for complete resource quality assurance
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Structural Validation */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Structural Validation</h4>
                <Switch
                  checked={settings.enableStructuralValidation}
                  onCheckedChange={(checked) => handleSettingChange('enableStructuralValidation', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Validates FHIR syntax, cardinality rules, and data types
              </p>
              <div className="mt-2">
                <Badge variant={settings.enableStructuralValidation ? "default" : "secondary"} className="text-xs">
                  {settings.enableStructuralValidation ? "Active" : "Disabled"}
                </Badge>
              </div>
            </Card>

            {/* 2. Profile Validation */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Profile Validation</h4>
                <Switch
                  checked={settings.enableProfileValidation}
                  onCheckedChange={(checked) => handleSettingChange('enableProfileValidation', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Validates against FHIR profiles (US Core, IPS, custom profiles)
              </p>
              <div className="mt-2">
                <Badge variant={settings.enableProfileValidation ? "default" : "secondary"} className="text-xs">
                  {settings.enableProfileValidation ? "Active" : "Disabled"}
                </Badge>
              </div>
            </Card>

            {/* 3. Terminology Validation */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Terminology Validation</h4>
                <Switch
                  checked={settings.enableTerminologyValidation}
                  onCheckedChange={(checked) => handleSettingChange('enableTerminologyValidation', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Validates codes against ValueSets (SNOMED CT, LOINC, ICD-10)
              </p>
              <div className="mt-2">
                <Badge variant={settings.enableTerminologyValidation ? "default" : "secondary"} className="text-xs">
                  {settings.enableTerminologyValidation ? "Active" : "Disabled"}
                </Badge>
              </div>
            </Card>

            {/* 4. Reference Validation */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Reference Validation</h4>
                <Switch
                  checked={settings.enableReferenceValidation}
                  onCheckedChange={(checked) => handleSettingChange('enableReferenceValidation', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Validates resource references and circular dependency checks
              </p>
              <div className="mt-2">
                <Badge variant={settings.enableReferenceValidation ? "default" : "secondary"} className="text-xs">
                  {settings.enableReferenceValidation ? "Active" : "Disabled"}
                </Badge>
              </div>
            </Card>

            {/* 5. Business Rule Validation */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Business Rule Validation</h4>
                <Switch
                  checked={settings.enableBusinessRuleValidation}
                  onCheckedChange={(checked) => handleSettingChange('enableBusinessRuleValidation', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cross-field logic validation (birthDate &lt; deathDate, etc.)
              </p>
              <div className="mt-2">
                <Badge variant={settings.enableBusinessRuleValidation ? "default" : "secondary"} className="text-xs">
                  {settings.enableBusinessRuleValidation ? "Active" : "Disabled"}
                </Badge>
              </div>
            </Card>

            {/* 6. Metadata Validation */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Metadata Validation</h4>
                <Switch
                  checked={settings.enableMetadataValidation}
                  onCheckedChange={(checked) => handleSettingChange('enableMetadataValidation', checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Validates FHIR version, security labels, and meta elements
              </p>
              <div className="mt-2">
                <Badge variant={settings.enableMetadataValidation ? "default" : "secondary"} className="text-xs">
                  {settings.enableMetadataValidation ? "Active" : "Disabled"}
                </Badge>
              </div>
            </Card>
          </div>
        </div>

        {/* Legacy and Performance Settings */}
        <Card className="p-6">
          <h4 className="text-lg font-medium mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Validation Configuration
          </h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Strict Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable enhanced error checking with stricter validation rules
                  </p>
                </div>
                <Switch
                  checked={settings.strictMode}
                  onCheckedChange={(checked) => handleSettingChange('strictMode', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Auto-Detect Profiles</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect appropriate validation profiles for resources
                  </p>
                </div>
                <Switch
                  checked={settings.autoDetectProfiles}
                  onCheckedChange={(checked) => handleSettingChange('autoDetectProfiles', checked)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minValidationScore" className="text-sm font-medium">
                  Minimum Validation Score (%)
                </Label>
                <Input
                  id="minValidationScore"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.minValidationScore}
                  onChange={(e) => handleSettingChange('minValidationScore', parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  Resources below this score are marked as requiring attention
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchSize" className="text-sm font-medium">
                  Batch Size
                </Label>
                <Input
                  id="batchSize"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.batchSize}
                  onChange={(e) => handleSettingChange('batchSize', parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  Number of resources to validate in each batch (affects performance)
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Priority-Ordered Terminology Servers */}
        <Card className="p-6">
          <h4 className="text-lg font-medium mb-4 flex items-center">
            <Server className="h-5 w-5 mr-2" />
            Priority-Ordered Terminology Servers
          </h4>
          <p className="text-sm text-muted-foreground mb-6">
            Multiple terminology servers with fallback priority. The Enhanced Validation Engine tries servers in order until one responds successfully.
          </p>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={settings.terminologyServers?.map(server => server.priority.toString()) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {settings.terminologyServers?.map((server, index) => (
                  <SortableTerminologyServer
                    key={server.priority}
                    server={server}
                    index={index}
                    localSettings={localSettings}
                    handleSettingChange={handleSettingChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add New Server */}
          <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <Button
              variant="outline"
              onClick={() => {
                const newServer = {
                  priority: (settings.terminologyServers?.length || 0) + 1,
                  enabled: true,
                  url: '',
                  type: 'custom',
                  name: 'New Terminology Server',
                  description: 'Custom terminology server',
                  capabilities: ['Custom']
                };
                const newServers = [...(settings.terminologyServers || []), newServer];
                handleSettingChange('terminologyServers', newServers);
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Terminology Server
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>CSIRO OntoServer:</strong> Best for SNOMED CT, LOINC, and international extensions. Free public access.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>HL7 Terminology Server:</strong> Official FHIR terminology standards, US Core profiles, and HL7 vocabularies.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>SNOMED International:</strong> Official SNOMED CT server with full ECL support and concept maps.
              </AlertDescription>
            </Alert>
          </div>
        </Card>

        {/* Profile Resolution Servers */}
        <Card className="p-6">
          <h4 className="text-lg font-medium mb-4 flex items-center">
            <Server className="h-5 w-5 mr-2 text-emerald-600" />
            Profile Resolution Servers
          </h4>
          <p className="text-sm text-muted-foreground mb-6">
            Servers for resolving FHIR profiles and structure definitions. Validation engine tries servers in priority order to find the best matching profiles for resources.
          </p>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleProfileDragEnd}
          >
            <SortableContext
              items={settings.profileResolutionServers?.map(server => server.priority.toString()) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {settings.profileResolutionServers?.map((server, index) => (
                  <SortableProfileServer
                    key={server.priority}
                    server={server}
                    index={index}
                    localSettings={localSettings}
                    handleSettingChange={handleSettingChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add New Profile Server */}
          <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <Button
              variant="outline"
              onClick={() => {
                const newServer = {
                  priority: (settings.profileResolutionServers?.length || 0) + 1,
                  enabled: true,
                  url: '',
                  type: 'custom',
                  name: 'New Profile Server',
                  description: 'Custom profile resolution server',
                  capabilities: ['Custom Profiles']
                };
                const newServers = [...(settings.profileResolutionServers || []), newServer];
                handleSettingChange('profileResolutionServers', newServers);
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Profile Resolution Server
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Simplifier.net:</strong> Community-driven FHIR profile registry with thousands of implementation guides and profiles from organizations worldwide.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>FHIR CI Build:</strong> Official FHIR continuous integration server with the latest development versions of profiles and implementation guides.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>FHIR Package Registry:</strong> Official package registry containing stable, published versions of FHIR profiles and implementation guides.
              </AlertDescription>
            </Alert>
          </div>
        </Card>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Enhanced Validation Engine settings are applied immediately when changed. All 6 validation aspects work together to ensure comprehensive FHIR resource quality.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    toast({
      title: 'Notifications Updated',
      description: `${key} notifications ${value ? 'enabled' : 'disabled'}`,
    });
  };

  const handleFhirSettingChange = (key: string, value: any) => {
    setFhirSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setFhirSettings({
      defaultPageSize: 50,
      maxRetries: 3,
      requestTimeout: 30,
      cacheEnabled: true,
      cacheDuration: 300
    });
    setNotifications({
      validationErrors: true,
      connectionIssues: true,
      resourceUpdates: false,
      systemAlerts: true
    });
    toast({
      title: 'Settings Reset',
      description: 'All settings have been reset to their default values.',
    });
  };

  const exportSettings = () => {
    const settings = {
      fhirSettings,
      notifications,
      isDarkMode,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'records-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Settings Exported',
      description: 'Settings have been exported to records-settings.json',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Records application preferences and behavior
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="fhir">FHIR Server</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Basic application settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Auto-refresh Dashboard
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh dashboard data every 30 seconds
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Remember Last Page
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Return to your last visited page when reopening the application
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium">
                  Language
                </Label>
                <Input
                  id="language"
                  value="English (US)"
                  disabled
                  className="w-48"
                />
                <p className="text-sm text-muted-foreground">
                  Additional languages will be available in future versions
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fhir" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>FHIR Server Connection</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsServerModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Server className="h-4 w-4" />
                  Change Server
                </Button>
              </CardTitle>
              <CardDescription>
                Current FHIR server connection and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">Connected to HAPI FHIR R4</p>
                    <p className="text-sm text-muted-foreground">https://server.fire.ly</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FHIR Server Settings</CardTitle>
              <CardDescription>
                Configure how the application interacts with FHIR servers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="page-size" className="text-sm font-medium">
                    Default Page Size
                  </Label>
                  <Input
                    id="page-size"
                    type="number"
                    min="10"
                    max="1000"
                    value={fhirSettings.defaultPageSize}
                    onChange={(e) => handleFhirSettingChange('defaultPageSize', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-retries" className="text-sm font-medium">
                    Max Retries
                  </Label>
                  <Input
                    id="max-retries"
                    type="number"
                    min="0"
                    max="10"
                    value={fhirSettings.maxRetries}
                    onChange={(e) => handleFhirSettingChange('maxRetries', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout" className="text-sm font-medium">
                    Request Timeout (seconds)
                  </Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="5"
                    max="120"
                    value={fhirSettings.requestTimeout}
                    onChange={(e) => handleFhirSettingChange('requestTimeout', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache-duration" className="text-sm font-medium">
                    Cache Duration (seconds)
                  </Label>
                  <Input
                    id="cache-duration"
                    type="number"
                    min="0"
                    max="3600"
                    value={fhirSettings.cacheDuration}
                    onChange={(e) => handleFhirSettingChange('cacheDuration', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Enable Caching
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Cache FHIR responses to improve performance
                  </p>
                </div>
                <Switch
                  checked={fhirSettings.cacheEnabled}
                  onCheckedChange={(checked) => handleFhirSettingChange('cacheEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation Settings</CardTitle>
              <CardDescription>
                Configure how FHIR resources are validated against profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ValidationSettingsContent />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Control when and how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Validation Errors
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when resources fail validation
                  </p>
                </div>
                <Switch
                  checked={notifications.validationErrors}
                  onCheckedChange={(checked) => handleNotificationChange('validationErrors', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Connection Issues
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when FHIR server connections fail
                  </p>
                </div>
                <Switch
                  checked={notifications.connectionIssues}
                  onCheckedChange={(checked) => handleNotificationChange('connectionIssues', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Resource Updates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when resources are updated
                  </p>
                </div>
                <Switch
                  checked={notifications.resourceUpdates}
                  onCheckedChange={(checked) => handleNotificationChange('resourceUpdates', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    System Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about system maintenance and updates
                  </p>
                </div>
                <Switch
                  checked={notifications.systemAlerts}
                  onCheckedChange={(checked) => handleNotificationChange('systemAlerts', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Dark Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Switch to dark theme for better viewing in low light
                  </p>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={setIsDarkMode}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Theme Color
                </Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="bg-blue-500 w-8 h-8 p-0"></Button>
                  <Button variant="outline" size="sm" className="bg-green-500 w-8 h-8 p-0"></Button>
                  <Button variant="outline" size="sm" className="bg-purple-500 w-8 h-8 p-0"></Button>
                  <Button variant="outline" size="sm" className="bg-orange-500 w-8 h-8 p-0"></Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred accent color
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size" className="text-sm font-medium">
                  Font Size
                </Label>
                <Input
                  id="font-size"
                  value="Default"
                  disabled
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  Font size options will be available in future versions
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Advanced configuration options and data management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Debug Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable detailed logging for troubleshooting
                  </p>
                </div>
                <Switch />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Data Management</h4>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportSettings}>
                    <Download className="w-4 h-4 mr-1" />
                    Export Settings
                  </Button>
                  
                  <Button variant="outline">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Clear Cache
                  </Button>
                  
                  <Button variant="destructive" onClick={resetToDefaults}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Reset to Defaults
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Advanced settings can affect application performance. Only modify these settings if you understand their impact.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ServerConnectionModal 
        open={isServerModalOpen} 
        onOpenChange={setIsServerModalOpen} 
      />
    </div>
  );
}