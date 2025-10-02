import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Database, 
  FileText, 
  BookOpen, 
  Link, 
  Briefcase, 
  Cog,
  Layers,
  Filter,
  Save,
  X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ValidationSettings } from '@shared/validation-settings-simplified';

interface ValidationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const validationAspects = [
  {
    key: 'structural',
    name: 'Structural Validation',
    description: 'Validates FHIR structure and syntax',
    icon: Database,
    color: 'text-blue-600'
  },
  {
    key: 'profile',
    name: 'Profile Validation',
    description: 'Validates against FHIR profiles',
    icon: FileText,
    color: 'text-green-600'
  },
  {
    key: 'terminology',
    name: 'Terminology Validation',
    description: 'Validates terminology bindings',
    icon: BookOpen,
    color: 'text-purple-600'
  },
  {
    key: 'reference',
    name: 'Reference Validation',
    description: 'Validates resource references',
    icon: Link,
    color: 'text-orange-600'
  },
  {
    key: 'businessRule',
    name: 'Business Rule Validation',
    description: 'Validates business logic rules',
    icon: Briefcase,
    color: 'text-red-600'
  },
  {
    key: 'metadata',
    name: 'Metadata Validation',
    description: 'Validates resource metadata',
    icon: Cog,
    color: 'text-gray-600'
  }
];

export const ValidationSettingsModal: React.FC<ValidationSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [localSettings, setLocalSettings] = useState<ValidationSettings | null>(null);
  const [batchSize, setBatchSize] = useState(200);
  const [adaptiveSizing, setAdaptiveSizing] = useState(false);
  const [pauseBetweenBatches, setPauseBetweenBatches] = useState(false);
  const [resourceFilterEnabled, setResourceFilterEnabled] = useState(false);

  const queryClient = useQueryClient();

  // Fetch current validation settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['validation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch validation settings: ${response.statusText}`);
      }
      const data = await response.json();
      // API returns settings directly, not wrapped in a 'settings' property
      if (!data || typeof data !== 'object') {
        console.warn('[ValidationSettingsModal] Invalid validation settings data received:', data);
        return {};
      }
      return data;
    },
    enabled: isOpen
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
      queryClient.invalidateQueries({ queryKey: ['validation-progress'] });
    }
  });

  // Initialize local settings when data loads
  useEffect(() => {
    if (settingsData) {
      setLocalSettings(settingsData);
      setBatchSize(settingsData.performance?.batchSize || 200);
      setAdaptiveSizing(false); // Not available in canonical settings
      setPauseBetweenBatches(false); // Not available in canonical settings
      setResourceFilterEnabled(settingsData.resourceTypes?.enabled || false);
    }
  }, [settingsData]);

  const handleAspectToggle = (aspectKey: string) => {
    if (!localSettings) return;
    
    setLocalSettings({
      ...localSettings,
      aspects: {
        ...localSettings.aspects,
        [aspectKey]: {
          ...localSettings.aspects[aspectKey as keyof ValidationSettings['aspects']],
          enabled: !localSettings.aspects[aspectKey as keyof ValidationSettings['aspects']].enabled
        }
      }
    });
  };

  const handleSave = async () => {
    if (!localSettings || !settingsData) return;

    // Send the complete settings object with all fields
    // Only modify the specific fields we want to change
    // Force activation and ensure we don't inherit inactive state
    const updatedSettings = {
      ...settingsData, // Start with the complete current settings
      ...localSettings, // Apply our local changes to validation aspects
      id: undefined, // Force creation of new settings record
      isActive: true, // Force activation of updated settings
      version: (settingsData.version || 0) + 1, // Increment version
      updatedAt: new Date(), // Set current timestamp
      performance: {
        ...settingsData.performance,
        batchSize: batchSize,
      },
      resourceTypes: {
        ...settingsData.resourceTypes,
        enabled: resourceFilterEnabled
      }
    };

    try {
      await updateSettingsMutation.mutateAsync(updatedSettings);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const enabledAspects = localSettings ? 
    Object.values(localSettings.aspects).filter((aspect: any) => aspect?.enabled === true).length : 0;

  if (isLoading || !localSettings) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Validation Settings
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Validation Settings
            <Badge variant="secondary" className="ml-2">
              {enabledAspects}/{validationAspects.length} enabled
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Validation Aspects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-blue-600" />
                Validation Aspects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationAspects.map((aspect) => {
                const IconComponent = aspect.icon;
                const aspectSettings = localSettings.aspects[aspect.key as keyof ValidationSettings['aspects']];
                const isEnabled = aspectSettings?.enabled || false;

                return (
                  <div key={aspect.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconComponent className={`h-5 w-5 ${aspect.color}`} />
                      <div>
                        <div className="font-medium">{aspect.name}</div>
                        <div className="text-sm text-gray-600">{aspect.description}</div>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleAspectToggle(aspect.key)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Batch Processing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-green-600" />
                Batch Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch Size (50 - 1000)</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min="50"
                  max="1000"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                />
                <p className="text-sm text-gray-600">Number of resources to process in each batch</p>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Adaptive sizing</div>
                  <div className="text-sm text-gray-600">Automatically adjust batch size based on performance</div>
                </div>
                <Switch
                  checked={adaptiveSizing}
                  onCheckedChange={setAdaptiveSizing}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Pause between batches</div>
                  <div className="text-sm text-gray-600">Add delay between batch processing</div>
                </div>
                <Switch
                  checked={pauseBetweenBatches}
                  onCheckedChange={setPauseBetweenBatches}
                />
              </div>
            </CardContent>
          </Card>

          {/* Resource Type Filtering */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5 text-purple-600" />
                Resource Type Filtering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Enable resource filtering</div>
                  <div className="text-sm text-gray-600">Limit validation to specific resource types</div>
                </div>
                <Switch
                  checked={resourceFilterEnabled}
                  onCheckedChange={setResourceFilterEnabled}
                />
              </div>
              {resourceFilterEnabled && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    Selected resource types: Patient, Observation, Encounter, Condition, Procedure, Medication, DiagnosticReport
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateSettingsMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
