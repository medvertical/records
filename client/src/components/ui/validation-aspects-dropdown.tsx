import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  CheckSquare, 
  Square, 
  ChevronDown,
  Settings,
  Zap,
  Database,
  BookOpen,
  Link,
  Briefcase,
  FileText,
  Layers,
  Filter,
  Check,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ValidationSettings } from "@/../../shared/validation-settings-simplified";

interface ValidationAspectsDropdownProps {
  className?: string;
}

// Common FHIR resource types for filtering
const commonResourceTypes = [
  'Patient',
  'Observation', 
  'Encounter',
  'Condition',
  'Procedure',
  'Medication',
  'MedicationRequest',
  'DiagnosticReport',
  'AllergyIntolerance',
  'Immunization',
  'CarePlan',
  'Goal',
  'DocumentReference',
  'Media',
  'Specimen',
  'Device',
  'Organization',
  'Practitioner',
  'PractitionerRole',
  'Location',
  'Appointment',
  'AppointmentResponse',
  'Schedule',
  'Slot',
  'Composition',
  'List',
  'Bundle',
  'Task',
  'Communication',
  'CommunicationRequest',
  'Questionnaire',
  'QuestionnaireResponse',
  'ServiceRequest',
  'SupplyRequest',
  'VisionPrescription',
  'NutritionOrder',
  'RiskAssessment',
  'AdverseEvent',
  'DetectedIssue',
  'ClinicalImpression',
  'FamilyMemberHistory',
  'EpisodeOfCare'
];

const validationAspects = [
  {
    key: 'structural' as keyof Pick<ValidationSettings, 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'>,
    label: 'Structural Validation',
    icon: Database,
    description: 'Validates FHIR structure and syntax'
  },
  {
    key: 'profile' as keyof Pick<ValidationSettings, 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'>,
    label: 'Profile Validation', 
    icon: FileText,
    description: 'Validates against FHIR profiles'
  },
  {
    key: 'terminology' as keyof Pick<ValidationSettings, 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'>,
    label: 'Terminology Validation',
    icon: BookOpen,
    description: 'Validates terminology bindings'
  },
  {
    key: 'reference' as keyof Pick<ValidationSettings, 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'>,
    label: 'Reference Validation',
    icon: Link,
    description: 'Validates resource references'
  },
  {
    key: 'businessRule' as keyof Pick<ValidationSettings, 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'>,
    label: 'Business Rule Validation',
    icon: Briefcase,
    description: 'Validates business logic rules'
  },
  {
    key: 'metadata' as keyof Pick<ValidationSettings, 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'>,
    label: 'Metadata Validation',
    icon: Settings,
    description: 'Validates resource metadata'
  }
];

export function ValidationAspectsDropdown({ className }: ValidationAspectsDropdownProps) {
  const [validationSettings, setValidationSettings] = useState<ValidationSettings>({
    version: 1,
    isActive: true,
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'information' },
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
    batchProcessingSettings: {
      defaultBatchSize: 200,
      minBatchSize: 50,
      maxBatchSize: 1000,
      useAdaptiveBatchSizing: false,
      targetBatchProcessingTimeMs: 30000,
      pauseBetweenBatches: false,
      pauseDurationMs: 1000,
      retryFailedBatches: true,
      maxRetryAttempts: 1,
      retryDelayMs: 2000
    },
    maxConcurrentValidations: 8,
    useParallelValidation: true,
    customRules: [],
    validateExternalReferences: false,
    validateNonExistentReferences: true,
    validateReferenceTypes: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load validation settings on mount
  useEffect(() => {
    loadValidationSettings();
  }, []);

  const loadValidationSettings = async () => {
    try {
      const response = await fetch('/api/validation/settings');
      if (response.ok) {
        const data = await response.json();
        // API returns settings directly, not wrapped in a 'settings' property
        setValidationSettings(data);
      } else {
        // Handle GET request errors
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load validation settings:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        // Show user-friendly error for GET failures
        toast({
          title: "Settings Load Error",
          description: "Failed to load validation settings. Some features may not work correctly.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Failed to load validation settings:', error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const updateValidationSettings = async (updates: Partial<ValidationSettings>) => {
    setIsLoading(true);
    try {
      const updatedSettings = { ...validationSettings, ...updates };
      
      // API expects ValidationSettingsUpdate format with 'settings' property
      const updatePayload = {
        settings: updatedSettings,
        validate: true,
        createNewVersion: false
      };
      
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (response.ok) {
        setValidationSettings(updatedSettings);
        toast({
          title: "Validation Settings Updated",
          description: "Validation aspects have been updated successfully.",
        });
      } else {
        // Parse error response for better error handling
        const errorData = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || 'Unknown Error',
          message: errorData.message || 'Failed to update validation settings',
          code: errorData.code || 'UNKNOWN_ERROR',
          details: errorData.details || []
        }));
      }
    } catch (error) {
      console.error('Failed to update validation settings:', error);
      
      let errorMessage = "Failed to update validation settings. Please try again.";
      let errorTitle = "Update Failed";
      
      try {
        const errorInfo = JSON.parse(error.message);
        
        // Handle specific error types
        switch (errorInfo.code) {
          case 'VALIDATION_ERROR':
            errorTitle = "Validation Error";
            errorMessage = `Settings validation failed: ${errorInfo.message}`;
            if (errorInfo.details && errorInfo.details.length > 0) {
              errorMessage += `\n\nIssues found:\n• ${errorInfo.details.join('\n• ')}`;
            }
            break;
          case 'SETTINGS_NOT_FOUND':
            errorTitle = "Settings Not Found";
            errorMessage = "The validation settings could not be found. Please refresh the page and try again.";
            break;
          case 'DATABASE_ERROR':
            errorTitle = "Database Error";
            errorMessage = "Unable to save settings due to database issues. Please try again in a moment.";
            break;
          case 'INVALID_REQUEST_BODY':
          case 'MISSING_SETTINGS':
          case 'INVALID_SETTINGS_CONTENT':
            errorTitle = "Invalid Request";
            errorMessage = "The request was invalid. Please refresh the page and try again.";
            break;
          case 'INTERNAL_ERROR':
            errorTitle = "Server Error";
            errorMessage = "An unexpected server error occurred. Please try again later.";
            break;
          default:
            errorMessage = errorInfo.message || errorMessage;
            break;
        }
      } catch (parseError) {
        // If we can't parse the error, use the original error message
        errorMessage = error.message || errorMessage;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 8000, // Show error for longer
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAspectToggle = (aspectKey: keyof Pick<ValidationSettings, 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata'>, enabled: boolean) => {
    if (typeof validationSettings[aspectKey] === 'object' && validationSettings[aspectKey] !== null) {
      const aspect = validationSettings[aspectKey] as { enabled: boolean; severity: string };
      updateValidationSettings({
        [aspectKey]: { ...aspect, enabled }
      });
    }
  };

  const handleBatchSizeChange = (value: string) => {
    const batchSize = parseInt(value, 10);
    const batchSettings = validationSettings.batchProcessingSettings;
    if (!isNaN(batchSize) && batchSettings && batchSize >= (batchSettings.minBatchSize || 50) && batchSize <= (batchSettings.maxBatchSize || 1000)) {
      updateValidationSettings({
        batchProcessingSettings: {
          ...batchSettings,
          defaultBatchSize: batchSize
        }
      });
    }
  };

  const handleResourceTypeToggle = (resourceType: string, checked: boolean) => {
    const filterSettings = validationSettings.resourceTypeFilterSettings;
    if (filterSettings) {
      const currentTypes = filterSettings.resourceTypes || [];
      const updatedTypes = checked 
        ? [...currentTypes, resourceType]
        : currentTypes.filter(type => type !== resourceType);
      
      updateValidationSettings({
        resourceTypeFilterSettings: {
          ...filterSettings,
          resourceTypes: updatedTypes
        }
      });
    }
  };

  const handleSelectAllResourceTypes = () => {
    const filterSettings = validationSettings.resourceTypeFilterSettings;
    if (filterSettings) {
      updateValidationSettings({
        resourceTypeFilterSettings: {
          ...filterSettings,
          resourceTypes: [...commonResourceTypes]
        }
      });
    }
  };

  const handleDeselectAllResourceTypes = () => {
    const filterSettings = validationSettings.resourceTypeFilterSettings;
    if (filterSettings) {
      updateValidationSettings({
        resourceTypeFilterSettings: {
          ...filterSettings,
          resourceTypes: []
        }
      });
    }
  };

  const enabledCount = validationAspects.filter(aspect => {
    const setting = validationSettings[aspect.key];
    return typeof setting === 'object' && setting !== null && (setting as any).enabled;
  }).length;

  const totalCount = validationAspects.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`flex items-center space-x-2 ${className}`}
          disabled={isLoading}
        >
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Validation</span>
          <Badge variant={enabledCount === totalCount ? "default" : "secondary"} className="ml-1">
            {enabledCount}/{totalCount}
          </Badge>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center space-x-2">
          <Zap className="h-4 w-4" />
          <span>Validation Aspects</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-3">
          {validationAspects.map((aspect) => {
            const Icon = aspect.icon;
            const setting = validationSettings[aspect.key];
            const isEnabled = typeof setting === 'object' && setting !== null && (setting as any).enabled;
            
            return (
              <div key={aspect.key} className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-3 flex-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label 
                      htmlFor={aspect.key}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {aspect.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {aspect.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={aspect.key}
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleAspectToggle(aspect.key, checked)}
                  disabled={isLoading}
                />
              </div>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        
        {/* Batch Processing Configuration */}
        {validationSettings.batchProcessingSettings && (
        <div className="p-2">
          <div className="flex items-center space-x-2 mb-3">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Batch Processing</Label>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="batchSize" className="text-xs text-muted-foreground">
                Batch Size ({validationSettings.batchProcessingSettings?.minBatchSize || 50} - {validationSettings.batchProcessingSettings?.maxBatchSize || 1000})
              </Label>
              <Input
                id="batchSize"
                type="number"
                min={validationSettings.batchProcessingSettings?.minBatchSize || 50}
                max={validationSettings.batchProcessingSettings?.maxBatchSize || 1000}
                value={validationSettings.batchProcessingSettings?.defaultBatchSize || 200}
                onChange={(e) => handleBatchSizeChange(e.target.value)}
                className="h-8"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Number of resources to process in each batch
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="adaptiveBatchSizing"
                  checked={validationSettings.batchProcessingSettings?.useAdaptiveBatchSizing || false}
                  onCheckedChange={(checked) => updateValidationSettings({
                    batchProcessingSettings: {
                      ...validationSettings.batchProcessingSettings,
                      useAdaptiveBatchSizing: checked
                    }
                  })}
                  disabled={isLoading}
                />
                <Label htmlFor="adaptiveBatchSizing" className="text-xs">
                  Adaptive sizing
                </Label>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="pauseBetweenBatches"
                  checked={validationSettings.batchProcessingSettings?.pauseBetweenBatches || false}
                  onCheckedChange={(checked) => updateValidationSettings({
                    batchProcessingSettings: {
                      ...validationSettings.batchProcessingSettings,
                      pauseBetweenBatches: checked
                    }
                  })}
                  disabled={isLoading}
                />
                <Label htmlFor="pauseBetweenBatches" className="text-xs">
                  Pause between batches
                </Label>
              </div>
            </div>
          </div>
        </div>
        )}
        
        {/* Resource Type Filtering Configuration */}
        {validationSettings.resourceTypeFilterSettings && (
        <div className="p-2">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Resource Type Filtering</Label>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="resourceTypeFiltering"
                  checked={validationSettings.resourceTypeFilterSettings?.enabled || false}
                  onCheckedChange={(checked) => updateValidationSettings({
                    resourceTypeFilterSettings: {
                      ...validationSettings.resourceTypeFilterSettings,
                      enabled: checked
                    }
                  })}
                  disabled={isLoading}
                />
                <Label htmlFor="resourceTypeFiltering" className="text-xs">
                  Enable filtering
                </Label>
              </div>
            </div>
            
            {validationSettings.resourceTypeFilterSettings?.enabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Filter Mode</Label>
                  <div className="flex space-x-2">
                    <Button
                      variant={validationSettings.resourceTypeFilterSettings?.mode === 'include' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateValidationSettings({
                        resourceTypeFilterSettings: {
                          ...validationSettings.resourceTypeFilterSettings,
                          mode: 'include'
                        }
                      })}
                      disabled={isLoading}
                      className="text-xs h-7"
                    >
                      Include
                    </Button>
                    <Button
                      variant={validationSettings.resourceTypeFilterSettings?.mode === 'exclude' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateValidationSettings({
                        resourceTypeFilterSettings: {
                          ...validationSettings.resourceTypeFilterSettings,
                          mode: 'exclude'
                        }
                      })}
                      disabled={isLoading}
                      className="text-xs h-7"
                    >
                      Exclude
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {validationSettings.resourceTypeFilterSettings?.mode === 'include' 
                      ? 'Only validate the selected resource types'
                      : 'Skip validation for the selected resource types'
                    }
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Resource Types</Label>
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectAllResourceTypes()}
                        disabled={isLoading}
                        className="text-xs h-6 px-2"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeselectAllResourceTypes()}
                        disabled={isLoading}
                        className="text-xs h-6 px-2"
                      >
                        <X className="h-3 w-3 mr-1" />
                        None
                      </Button>
                    </div>
                  </div>
                  
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                    {commonResourceTypes.map((resourceType) => (
                      <div key={resourceType} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`resource-${resourceType}`}
                          checked={validationSettings.resourceTypeFilterSettings?.resourceTypes?.includes(resourceType) || false}
                          onChange={(e) => handleResourceTypeToggle(resourceType, e.target.checked)}
                          disabled={isLoading}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`resource-${resourceType}`} className="text-xs flex-1">
                          {resourceType}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {validationSettings.resourceTypeFilterSettings?.resourceTypes?.length || 0} types selected
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="validateUnknownTypes"
                        checked={validationSettings.resourceTypeFilterSettings?.validateUnknownTypes || false}
                        onCheckedChange={(checked) => updateValidationSettings({
                          resourceTypeFilterSettings: {
                            ...validationSettings.resourceTypeFilterSettings,
                            validateUnknownTypes: checked
                          }
                        })}
                        disabled={isLoading}
                      />
                      <Label htmlFor="validateUnknownTypes" className="text-xs">
                        Validate unknown types
                      </Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="validateCustomTypes"
                        checked={validationSettings.resourceTypeFilterSettings?.validateCustomTypes || false}
                        onCheckedChange={(checked) => updateValidationSettings({
                          resourceTypeFilterSettings: {
                            ...validationSettings.resourceTypeFilterSettings,
                            validateCustomTypes: checked
                          }
                        })}
                        disabled={isLoading}
                      />
                      <Label htmlFor="validateCustomTypes" className="text-xs">
                        Validate custom types
                      </Label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        )}
        
        <DropdownMenuSeparator />
        <div className="p-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{enabledCount} of {totalCount} aspects enabled</span>
            <Badge variant={enabledCount === totalCount ? "default" : "secondary"}>
              {enabledCount === totalCount ? "All Active" : "Partial"}
            </Badge>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
