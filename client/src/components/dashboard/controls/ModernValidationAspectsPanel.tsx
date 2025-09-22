import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Settings, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Info,
  Shield,
  FileText,
  BookOpen,
  Link,
  Gavel,
  Database
} from 'lucide-react';
import { ValidationAspectsData } from '@/shared/types/dashboard-new';

interface ModernValidationAspectsPanelProps {
  aspects?: ValidationAspectsData;
  isLoading?: boolean;
  error?: string | null;
  onToggle?: (aspectId: string, enabled: boolean) => void;
  onConfigure?: () => void;
  className?: string;
}

export const ModernValidationAspectsPanel: React.FC<ModernValidationAspectsPanelProps> = ({
  aspects,
  isLoading = false,
  error = null,
  onToggle,
  onConfigure,
  className,
}) => {
  const getAspectIcon = (aspectId: string) => {
    switch (aspectId.toLowerCase()) {
      case 'structural':
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case 'profile':
        return <Shield className="h-4 w-4 text-muted-foreground" />;
      case 'terminology':
        return <BookOpen className="h-4 w-4 text-muted-foreground" />;
      case 'reference':
        return <Link className="h-4 w-4 text-muted-foreground" />;
      case 'business rules':
        return <Gavel className="h-4 w-4 text-muted-foreground" />;
      case 'metadata':
        return <Database className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Settings className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAspectStatusIcon = (status: string) => {
    switch (status) {
      case 'enabled':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'disabled':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getAspectStatusBadge = (status: string) => {
    switch (status) {
      case 'enabled':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'disabled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getEnabledCount = () => {
    if (!aspects?.aspects) return 0;
    return aspects.aspects.filter(aspect => aspect.enabled).length;
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span>Validation Aspects</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
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
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span>Validation Aspects</span>
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

  if (!aspects || !aspects.aspects || aspects.aspects.length === 0) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span>Validation Aspects</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No validation aspects available
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledCount = getEnabledCount();
  const totalCount = aspects.aspects.length;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span>Validation Aspects</span>
            <Badge variant="outline">
              {enabledCount}/{totalCount}
            </Badge>
          </CardTitle>
          {onConfigure && (
            <Button variant="ghost" size="sm" onClick={onConfigure}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Active Aspects</span>
            <Badge variant={enabledCount === totalCount ? 'default' : 'secondary'}>
              {enabledCount} of {totalCount}
            </Badge>
          </div>
          {aspects.lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date(aspects.lastUpdated).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Aspect List */}
        <div className="space-y-3">
          {aspects.aspects.map((aspect) => (
            <div key={aspect.id} className="p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getAspectIcon(aspect.id)}
                  <span className="font-medium text-sm">{aspect.name}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {getAspectStatusIcon(aspect.status)}
                  <Badge className={`text-xs ${getAspectStatusBadge(aspect.status)}`}>
                    {aspect.status}
                  </Badge>
                </div>
              </div>

              {aspect.description && (
                <p className="text-xs text-muted-foreground mb-3">
                  {aspect.description}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={aspect.enabled}
                    onCheckedChange={(enabled) => onToggle?.(aspect.id, enabled)}
                    disabled={aspect.status === 'disabled'}
                  />
                  <span className="text-sm">
                    {aspect.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {aspect.errorCount !== undefined && aspect.errorCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {aspect.errorCount} errors
                  </Badge>
                )}
              </div>

              {/* Configuration Options */}
              {aspect.options && aspect.options.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1">Configuration:</div>
                  <div className="flex flex-wrap gap-1">
                    {aspect.options.map((option, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {option}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Configure Button */}
        {onConfigure && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onConfigure}
            className="w-full"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure Aspects
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
