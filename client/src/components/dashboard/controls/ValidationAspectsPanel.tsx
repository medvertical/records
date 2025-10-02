import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Settings } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ValidationAspectsPanelProps {
  className?: string;
}

/**
 * Validation Aspects Panel - Displays and manages validation aspect settings
 */
export const ValidationAspectsPanel: React.FC<ValidationAspectsPanelProps> = ({
  className,
}) => {
  const queryClient = useQueryClient();

  // Fetch validation settings to get the current aspects
  const { data: settingsData, isLoading, error } = useQuery({
    queryKey: ['validation-settings'],
    queryFn: async () => {
      const response = await fetch('/api/validation/settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch validation settings: ${response.statusText}`);
      }
      const data = await response.json();
      // API returns settings directly, not wrapped in a 'settings' property
      // Ensure we always return a valid object to prevent TanStack Query undefined error
      if (!data || typeof data !== 'object') {
        console.warn('[ValidationAspectsPanel] Invalid validation settings data received:', data);
        return {};
      }
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds (reduced frequency)
    staleTime: 15000, // Consider data stale after 15 seconds
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000) // Exponential backoff
  });

  // Listen for settings changes to trigger immediate UI updates
  useEffect(() => {
    const handleSettingsChanged = (event: CustomEvent) => {
      console.log('[ValidationAspectsPanel] Settings changed, invalidating cache');
      queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
    };

    window.addEventListener('settingsChanged', handleSettingsChanged as EventListener);

    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChanged as EventListener);
    };
  }, [queryClient]);

  // Transform settings data to aspects format
  const aspects = settingsData ? [
    {
      id: 'structural',
      name: 'Structural',
      enabled: settingsData.structural?.enabled ?? true,
      severity: settingsData.structural?.severity ?? 'error',
      description: 'Validates JSON structure and FHIR resource format'
    },
    {
      id: 'profile',
      name: 'Profile',
      enabled: settingsData.profile?.enabled ?? true,
      severity: settingsData.profile?.severity ?? 'warning',
      description: 'Validates against FHIR profiles and constraints'
    },
    {
      id: 'terminology',
      name: 'Terminology',
      enabled: settingsData.terminology?.enabled ?? true,
      severity: settingsData.terminology?.severity ?? 'warning',
      description: 'Validates codes against terminology servers'
    },
    {
      id: 'reference',
      name: 'Reference',
      enabled: settingsData.reference?.enabled ?? true,
      severity: settingsData.reference?.severity ?? 'error',
      description: 'Validates resource references and integrity'
    },
    {
      id: 'businessRule',
      name: 'Business Rules',
      enabled: settingsData.businessRule?.enabled ?? true,
      severity: settingsData.businessRule?.severity ?? 'warning',
      description: 'Validates custom business rules and constraints'
    },
    {
      id: 'metadata',
      name: 'Metadata',
      enabled: settingsData.metadata?.enabled ?? true,
      severity: settingsData.metadata?.severity ?? 'info',
      description: 'Validates metadata and version information'
    }
  ] : [];

  const handleAspectToggle = async (aspectId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [aspectId]: { enabled }
        }),
      });
      
      if (response.ok) {
        // The query will automatically refetch due to the refetchInterval
        console.log(`Aspect ${aspectId} ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Failed to update aspect setting:', error);
    }
  };

  const handleSeverityChange = async (aspectId: string, severity: string) => {
    try {
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [aspectId]: { severity }
        }),
      });
      
      if (response.ok) {
        // The query will automatically refetch due to the refetchInterval
        console.log(`Aspect ${aspectId} severity changed to ${severity}`);
      }
    } catch (error) {
      console.error('Failed to update aspect severity:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Validation Aspects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading aspects...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Validation Aspects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load validation aspects</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Validation Aspects
          </div>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {aspects.map((aspect) => (
          <div key={aspect.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{aspect.name}</span>
                <Badge variant={getSeverityColor(aspect.severity)}>
                  {aspect.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{aspect.description}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select
                value={aspect.severity}
                onValueChange={(value) => handleSeverityChange(aspect.id, value)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              
              <Switch
                checked={aspect.enabled}
                onCheckedChange={(checked) => handleAspectToggle(aspect.id, checked)}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
