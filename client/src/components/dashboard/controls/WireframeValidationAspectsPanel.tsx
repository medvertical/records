import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Settings,
  ChevronRight
} from 'lucide-react';

interface ValidationAspect {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  issueCount?: number;
}

interface WireframeValidationAspectsPanelProps {
  aspects?: ValidationAspect[];
  onAspectToggle?: (aspectId: string, enabled: boolean) => void;
  onConfigure?: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Wireframe Validation Aspects Panel - Based on dashboard wireframes specification
 * Shows validation aspects with toggle switches and status indicators
 */
export const WireframeValidationAspectsPanel: React.FC<WireframeValidationAspectsPanelProps> = ({
  aspects = [],
  onAspectToggle,
  onConfigure,
  isLoading = false,
  error = null,
  className,
}) => {
  const getStatusIcon = (aspect: ValidationAspect) => {
    if (!aspect.enabled) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    
    switch (aspect.severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const getStatusText = (aspect: ValidationAspect) => {
    if (!aspect.enabled) {
      return 'Disabled';
    }
    
    switch (aspect.severity) {
      case 'error':
        return 'Error Mode';
      case 'warning':
        return 'Warning Mode';
      case 'info':
        return 'Enabled';
      default:
        return 'Enabled';
    }
  };

  const getStatusColor = (aspect: ValidationAspect) => {
    if (!aspect.enabled) {
      return 'bg-gray-100 text-gray-600';
    }
    
    switch (aspect.severity) {
      case 'error':
        return 'bg-red-100 text-red-600';
      case 'warning':
        return 'bg-yellow-100 text-yellow-600';
      case 'info':
        return 'bg-green-100 text-green-600';
      default:
        return 'bg-green-100 text-green-600';
    }
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <span className="text-lg font-semibold">🔍 VALIDATION ASPECTS</span>
            </div>
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">🔍 VALIDATION ASPECTS</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load validation aspects
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledAspects = aspects.filter(aspect => aspect.enabled).length;
  const totalAspects = aspects.length;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">🔍 VALIDATION ASPECTS</span>
          </CardTitle>
          {onConfigure && (
            <Button variant="ghost" size="sm" onClick={onConfigure} className="p-1">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="text-sm text-gray-600 mb-4">
          {enabledAspects} of {totalAspects} aspects enabled
        </div>

        {aspects.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-sm text-muted-foreground">
              No validation aspects configured
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {aspects.map((aspect) => (
              <div key={aspect.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(aspect)}
                    <span className="text-sm font-medium text-gray-900">
                      {aspect.name}
                    </span>
                  </div>
                  <Badge className={getStatusColor(aspect)}>
                    {getStatusText(aspect)}
                  </Badge>
                </div>
                
                <div className="text-xs text-gray-500 ml-6">
                  └─ {aspect.description}
                </div>
                
                {aspect.issueCount !== undefined && aspect.issueCount > 0 && (
                  <div className="text-xs text-red-600 ml-6">
                    {aspect.issueCount} issues found
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {onConfigure && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onConfigure}
            className="w-full justify-between text-xs mt-4"
          >
            <span>Configure Aspects</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
