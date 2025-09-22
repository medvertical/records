import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ChevronRight
} from 'lucide-react';
import { ValidationAspects } from '@/shared/types/dashboard-new';

/**
 * ValidationAspectsPanel Component - Single responsibility: Validation configuration interface
 * Follows global rules: Under 300 lines, single responsibility, uses existing UI components
 */
interface ValidationAspectsPanelProps {
  aspects?: ValidationAspects;
  loading?: boolean;
  error?: string | null;
  onAspectToggle?: (aspectId: string, enabled: boolean) => void;
  onConfigure?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export const ValidationAspectsPanel: React.FC<ValidationAspectsPanelProps> = ({
  aspects,
  loading = false,
  error = null,
  onAspectToggle,
  onConfigure,
  onRefresh,
  className = '',
}) => {
  // Default aspects if none provided
  const defaultAspects: ValidationAspects = {
    structural: { enabled: true, status: 'success' },
    profile: { enabled: true, status: 'success' },
    terminology: { enabled: true, status: 'warning' },
    reference: { enabled: true, status: 'success' },
    businessRules: { enabled: false, status: 'error' },
    metadata: { enabled: true, status: 'success' },
  };

  const currentAspects = aspects || defaultAspects;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Enabled';
      case 'warning':
        return 'Warning Mode';
      case 'error':
        return 'Disabled';
      default:
        return 'Unknown';
    }
  };

  const getAspectDescription = (aspectId: string) => {
    const descriptions: Record<string, string> = {
      structural: 'JSON schema validation',
      profile: 'Conformance validation',
      terminology: 'Code system validation',
      reference: 'Resource reference checking',
      businessRules: 'Custom rule validation',
      metadata: 'Version & timestamp validation',
    };
    return descriptions[aspectId] || 'Validation aspect';
  };

  const handleAspectToggle = (aspectId: string, enabled: boolean) => {
    onAspectToggle?.(aspectId, enabled);
  };

  if (error) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Settings className="h-5 w-5" />
            Validation Aspects
          </CardTitle>
          <CardDescription>Error loading validation aspects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={onRefresh} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Validation Aspects</CardTitle>
          </div>
          <Button
            onClick={onConfigure}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Configure validation aspects and rules
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {Object.entries(currentAspects).map(([aspectId, aspect]) => (
          <div key={aspectId} className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(aspect.status)}`} />
                {getStatusIcon(aspect.status)}
              </div>
              <div>
                <div className="font-medium capitalize">
                  {aspectId.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {getAspectDescription(aspectId)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant={aspect.enabled ? 'default' : 'secondary'}>
                {getStatusText(aspect.status)}
              </Badge>
              <Switch
                checked={aspect.enabled}
                onCheckedChange={(enabled) => handleAspectToggle(aspectId, enabled)}
                disabled={loading}
              />
            </div>
          </div>
        ))}

        {/* Configure Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={onConfigure}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configure Aspects
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ValidationAspectsPanel;
