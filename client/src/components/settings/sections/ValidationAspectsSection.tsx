import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { AspectCard } from '../shared/AspectCard';
import { getAspectDescription, getAvailableEngines, formatAspectName } from '../helpers/validation-helpers';
import type { ValidationSettings } from '@shared/validation-settings';

interface ValidationAspectsSectionProps {
  settings: ValidationSettings;
  onUpdate: (aspectKey: keyof ValidationSettings['aspects'], field: 'enabled' | 'severity' | 'engine', value: any) => void;
}

export function ValidationAspectsSection({ settings, onUpdate }: ValidationAspectsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Validation Aspects
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(settings.aspects).map(([aspectKey, aspect]) => (
            <AspectCard
              key={aspectKey}
              title={formatAspectName(aspectKey)}
              description={getAspectDescription(aspectKey)}
              enabled={aspect.enabled}
              severity={aspect.severity}
              engine={aspect.engine || ''}
              availableEngines={getAvailableEngines(aspectKey)}
              onToggle={(enabled) => onUpdate(aspectKey as keyof ValidationSettings['aspects'], 'enabled', enabled)}
              onSeverityChange={(severity) => onUpdate(aspectKey as keyof ValidationSettings['aspects'], 'severity', severity)}
              onEngineChange={(engine) => onUpdate(aspectKey as keyof ValidationSettings['aspects'], 'engine', engine)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

