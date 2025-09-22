import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Settings,
  ChevronRight,
  X
} from 'lucide-react';
import { Alert } from '@/shared/types/dashboard-new';

interface ModernAlertCardProps {
  alerts?: Alert[];
  isLoading?: boolean;
  error?: string | null;
  onViewAll?: () => void;
  onDismiss?: (alertId: string) => void;
  onConfigure?: () => void;
  className?: string;
}

export const ModernAlertCard: React.FC<ModernAlertCardProps> = ({
  alerts = [],
  isLoading = false,
  error = null,
  onViewAll,
  onDismiss,
  onConfigure,
  className,
}) => {
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning');
  const infoAlerts = alerts.filter(alert => alert.severity === 'info');

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <span>Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
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
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <span>Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load alerts
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalAlerts = alerts.length;
  const hasAlerts = totalAlerts > 0;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <span>Alerts</span>
            {totalAlerts > 0 && (
              <Badge variant="outline" className="ml-2">
                {totalAlerts}
              </Badge>
            )}
          </CardTitle>
          {onConfigure && (
            <Button variant="ghost" size="sm" onClick={onConfigure}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!hasAlerts ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <Info className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              All systems operational
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Critical Alerts */}
            {criticalAlerts.length > 0 && (
              <div className={`p-3 rounded-lg border ${getSeverityColor('critical')}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getSeverityIcon('critical')}
                    <span className="font-medium text-sm">Critical</span>
                    <Badge className={getSeverityBadgeColor('critical')}>
                      {criticalAlerts.length}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  {criticalAlerts.slice(0, 2).map((alert, index) => (
                    <div key={alert.id || index} className="flex items-start justify-between">
                      <span className="text-sm">{alert.message}</span>
                      {onDismiss && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDismiss(alert.id || `critical-${index}`)}
                          className="h-6 w-6 p-0 ml-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {criticalAlerts.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{criticalAlerts.length - 2} more critical alerts
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Warning Alerts */}
            {warningAlerts.length > 0 && (
              <div className={`p-3 rounded-lg border ${getSeverityColor('warning')}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getSeverityIcon('warning')}
                    <span className="font-medium text-sm">Warnings</span>
                    <Badge className={getSeverityBadgeColor('warning')}>
                      {warningAlerts.length}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  {warningAlerts.slice(0, 2).map((alert, index) => (
                    <div key={alert.id || index} className="flex items-start justify-between">
                      <span className="text-sm">{alert.message}</span>
                      {onDismiss && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDismiss(alert.id || `warning-${index}`)}
                          className="h-6 w-6 p-0 ml-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {warningAlerts.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{warningAlerts.length - 2} more warnings
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Info Alerts */}
            {infoAlerts.length > 0 && (
              <div className={`p-3 rounded-lg border ${getSeverityColor('info')}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getSeverityIcon('info')}
                    <span className="font-medium text-sm">Info</span>
                    <Badge className={getSeverityBadgeColor('info')}>
                      {infoAlerts.length}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  {infoAlerts.slice(0, 1).map((alert, index) => (
                    <div key={alert.id || index} className="flex items-start justify-between">
                      <span className="text-sm">{alert.message}</span>
                      {onDismiss && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDismiss(alert.id || `info-${index}`)}
                          className="h-6 w-6 p-0 ml-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasAlerts && onViewAll && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewAll}
            className="w-full justify-between"
          >
            <span>View All Alerts</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
