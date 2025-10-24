import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Database, HardDrive, Server, AlertTriangle } from 'lucide-react';
import type { ValidationSettings, FHIRVersion } from '@shared/validation-settings';

interface ResourceTypesSectionProps {
  settings: ValidationSettings;
  fhirVersion: FHIRVersion;
  availableResourceTypes: string[];
  resourceTypesSource: 'server' | 'static' | 'filtered' | null;
  serverVersion: string | null;
  showMigrationWarning: boolean;
  originalFhirVersion: FHIRVersion;
  onFhirVersionChange: (version: FHIRVersion) => void;
  onFilteringToggle: (enabled: boolean) => void;
  onResourceTypesUpdate: (types: string[]) => void;
  onMigrationWarningClose: () => void;
  onRevertVersion: () => void;
}

export function ResourceTypesSection({
  settings,
  fhirVersion,
  availableResourceTypes,
  resourceTypesSource,
  serverVersion,
  showMigrationWarning,
  originalFhirVersion,
  onFhirVersionChange,
  onFilteringToggle,
  onResourceTypesUpdate,
  onMigrationWarningClose,
  onRevertVersion
}: ResourceTypesSectionProps) {
  const handleResourceTypeToggle = (type: string) => {
    const included = settings.resourceTypes.includedTypes || [];
    const newIncluded = included.includes(type)
      ? included.filter(t => t !== type)
      : [...included, type];
    onResourceTypesUpdate(newIncluded);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Resource Type Filtering
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fhir-version">FHIR Version</Label>
            <Select
              value={fhirVersion}
              onValueChange={onFhirVersionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select FHIR version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="R4">R4</SelectItem>
                <SelectItem value="R5">R5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="resource-filtering">Resource Type Filtering</Label>
            <Select
              value={settings.resourceTypes.enabled ? 'enabled' : 'disabled'}
              onValueChange={(value) => onFilteringToggle(value === 'enabled')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select filtering mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">Disabled (Validate All)</SelectItem>
                <SelectItem value="enabled">Enabled (Filter Types)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {showMigrationWarning && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  <strong>FHIR Version Change Detected:</strong> You've changed from FHIR {originalFhirVersion} to FHIR {fhirVersion}.
                </p>
                <p>
                  This may affect your resource type filtering. Resource types that don't exist in FHIR {fhirVersion} will be automatically removed.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRevertVersion}
                  >
                    Revert to {originalFhirVersion}
                  </Button>
                  <Button
                    size="sm"
                    onClick={onMigrationWarningClose}
                  >
                    Continue with {fhirVersion}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {settings.resourceTypes.enabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Available Resource Types ({availableResourceTypes.length})</Label>
                {resourceTypesSource && (
                  <Badge 
                    variant={resourceTypesSource === 'filtered' ? 'default' : 'secondary'}
                    className="flex items-center gap-1 text-xs"
                  >
                    {resourceTypesSource === 'filtered' && <Database className="h-3 w-3" />}
                    {resourceTypesSource === 'static' && <HardDrive className="h-3 w-3" />}
                    {resourceTypesSource === 'filtered' ? 'From Server' : 'Static List'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {serverVersion && (
                  <Badge variant="outline" className="flex items-center gap-1 text-xs">
                    <Server className="h-3 w-3" />
                    Server: {serverVersion}
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  FHIR {fhirVersion}
                </Badge>
              </div>
            </div>
            
            {availableResourceTypes.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No resource types available for FHIR {fhirVersion}. Please check your FHIR server connection.
                </AlertDescription>
              </Alert>
            )}
            
            {availableResourceTypes.length > 0 && (
              <>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                  <div className="flex flex-wrap gap-1">
                    {availableResourceTypes.map((type) => (
                      <Badge
                        key={type}
                        variant={settings.resourceTypes.includedTypes?.includes(type) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => handleResourceTypeToggle(type)}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {settings.resourceTypes.includedTypes && settings.resourceTypes.includedTypes.length === 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No resource types selected. All resources will be validated.
                    </AlertDescription>
                  </Alert>
                )}
                
                <p className="text-sm text-muted-foreground">
                  Click resource types to include/exclude them from validation
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

