import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, HardDrive, Globe, Zap } from 'lucide-react';
import type { ValidationSettings } from '@shared/validation-settings';

interface ProfileSourcesSectionProps {
  settings: ValidationSettings;
  onUpdate: (value: 'local' | 'simplifier' | 'both') => void;
}

export function ProfileSourcesSection({ settings, onUpdate }: ProfileSourcesSectionProps) {
  const profileSources = settings.profileSources || 'both';
  
  const getDescription = () => {
    switch (profileSources) {
      case 'local':
        return 'Use only locally cached profile packages. Fast but requires manual installation.';
      case 'simplifier':
        return 'Fetch profiles directly from Simplifier.net. Always up-to-date but requires internet.';
      default:
        return 'Try local cache first, then fetch from Simplifier.net if not found. Best of both worlds.';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Profile Sources
        </CardTitle>
        <CardDescription>
          Configure where to load profile packages from
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-sources">Source Priority</Label>
          <Select
            value={profileSources}
            onValueChange={onUpdate}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select profile sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  <span>Local Cache Only</span>
                </div>
              </SelectItem>
              <SelectItem value="simplifier">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Simplifier.net Only</span>
                </div>
              </SelectItem>
              <SelectItem value="both">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span>Both (Local → Simplifier)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {getDescription()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

