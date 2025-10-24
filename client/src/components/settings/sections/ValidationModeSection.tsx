import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, HardDrive, AlertTriangle } from 'lucide-react';
import type { ValidationSettings } from '@shared/validation-settings';

interface ValidationModeSectionProps {
  settings: ValidationSettings;
  onModeChange: (mode: 'online' | 'offline') => void;
  onTerminologyUrlUpdate: (field: 'remote' | 'local', value: string) => void;
  onOfflineConfigUpdate: (field: 'ontoserverUrl' | 'profileCachePath', value: string) => void;
}

export function ValidationModeSection({ 
  settings, 
  onModeChange,
  onTerminologyUrlUpdate,
  onOfflineConfigUpdate
}: ValidationModeSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {settings.mode === 'online' ? (
            <Globe className="h-5 w-5 text-blue-500" />
          ) : (
            <HardDrive className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
          Validation Mode
        </CardTitle>
        <CardDescription>
          Switch between online (remote terminology servers) and offline (local Ontoserver) validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Current Mode</Label>
            <p className="text-sm text-muted-foreground">
              {settings.mode === 'online' 
                ? 'Using remote terminology servers (tx.fhir.org)' 
                : 'Using local Ontoserver with fallback'}
            </p>
          </div>
          
          {/* Tab-like Toggle */}
          <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-1">
            <button
              type="button"
              onClick={() => settings.mode !== 'online' && onModeChange('online')}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all
                ${settings.mode === 'online' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800'
                }
              `}
            >
              <Globe className="h-4 w-4" />
              Online
            </button>
            <button
              type="button"
              onClick={() => settings.mode !== 'offline' && onModeChange('offline')}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all
                ${settings.mode === 'offline' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800'
                }
              `}
            >
              <HardDrive className="h-4 w-4" />
              Offline
            </button>
          </div>
        </div>

        {/* Terminology Fallback Configuration */}
        <div className="space-y-3 pt-2">
          <Label className="text-sm font-semibold">Terminology Server URLs</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="remote-url" className="text-sm">
                Remote Server (tx.fhir.org)
              </Label>
              <Input
                id="remote-url"
                value={settings.terminologyFallback?.remote || 'https://tx.fhir.org/r4'}
                onChange={(e) => onTerminologyUrlUpdate('remote', e.target.value)}
                placeholder="https://tx.fhir.org/r4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-url" className="text-sm">
                Local Server (Ontoserver)
              </Label>
              <Input
                id="local-url"
                value={settings.terminologyFallback?.local || 'http://localhost:8081/fhir'}
                onChange={(e) => onTerminologyUrlUpdate('local', e.target.value)}
                placeholder="http://localhost:8081/fhir"
              />
            </div>
          </div>
        </div>

        {/* Offline Mode Configuration */}
        {settings.mode === 'offline' && (
          <div className="space-y-3 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Offline Mode Configuration
              </Label>
            </div>
            
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-200">
                Offline mode requires a local Ontoserver installation. Validation will fall back to cached ValueSets and finally tx.fhir.org if local server is unavailable.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ontoserver-url" className="text-sm">
                  Ontoserver URL
                </Label>
                <Input
                  id="ontoserver-url"
                  value={settings.offlineConfig?.ontoserverUrl || 'http://localhost:8081/fhir'}
                  onChange={(e) => onOfflineConfigUpdate('ontoserverUrl', e.target.value)}
                  placeholder="http://localhost:8081/fhir"
                />
                <p className="text-xs text-muted-foreground">
                  URL of your local Ontoserver FHIR endpoint
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-cache" className="text-sm">
                  Profile Cache Path
                </Label>
                <Input
                  id="profile-cache"
                  value={settings.offlineConfig?.profileCachePath || '/opt/fhir/igs/'}
                  onChange={(e) => onOfflineConfigUpdate('profileCachePath', e.target.value)}
                  placeholder="/opt/fhir/igs/"
                />
                <p className="text-xs text-muted-foreground">
                  Local path where FHIR Implementation Guide packages are stored
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

