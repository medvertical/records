import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, Info } from 'lucide-react';
import type { ValidationSettings } from '@shared/validation-settings';

interface PerformanceSectionProps {
  settings: ValidationSettings;
  onPerformanceUpdate: (field: keyof ValidationSettings['performance'], value: number) => void;
  onSettingsUpdate: (updates: Partial<ValidationSettings>) => void;
}

export function PerformanceSection({ settings, onPerformanceUpdate, onSettingsUpdate }: PerformanceSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Performance Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="max-concurrent">Max Concurrent Validations</Label>
            <Select
              value={(settings.performance?.maxConcurrent || 4).toString()}
              onValueChange={(value) => onPerformanceUpdate('maxConcurrent', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select concurrent validations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="16">16</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Number of resources to validate simultaneously
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="batch-size">Batch Size</Label>
            <Select
              value={(settings.performance?.batchSize || 50).toString()}
              onValueChange={(value) => onPerformanceUpdate('batchSize', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select batch size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Number of resources to process in each batch
            </p>
          </div>
        </div>

        {/* Auto-Revalidation Option */}
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Auto-Revalidation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically revalidate resources after editing
              </p>
            </div>
            <Switch
              checked={settings.autoRevalidateAfterEdit || false}
              onCheckedChange={(checked) => onSettingsUpdate({ autoRevalidateAfterEdit: checked })}
            />
          </div>
          {settings.autoRevalidateAfterEdit && (
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                When enabled, resources will be automatically validated after any edit operation. 
                This ensures validation results are always up-to-date but may increase server load.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Best Practice Recommendations */}
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Best Practice Recommendations</Label>
              <p className="text-sm text-muted-foreground">
                Show FHIR best practice recommendations (e.g., narrative text, domain-6 constraints)
              </p>
            </div>
            <Switch
              checked={settings.enableBestPracticeChecks ?? true}
              onCheckedChange={(checked) => onSettingsUpdate({ enableBestPracticeChecks: checked })}
            />
          </div>
          {settings.enableBestPracticeChecks && (
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                When enabled, the validator will check for FHIR best practices like narrative text presence, 
                proper metadata, and other recommendations from the FHIR specification. These appear as warnings or info messages.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* $validate Operation Toggle */}
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Use $validate Operation</Label>
              <p className="text-sm text-muted-foreground">
                Use FHIR server's native $validate operation if available
              </p>
            </div>
            <Switch
              checked={settings.useFhirValidateOperation || false}
              onCheckedChange={(checked) => onSettingsUpdate({ useFhirValidateOperation: checked })}
            />
          </div>
          {settings.useFhirValidateOperation && (
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-200 text-xs">
                When enabled, validation will use the FHIR server's $validate operation when supported. 
                Falls back to local HAPI validator if not available.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

