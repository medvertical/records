import React, { useState } from 'react';
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

interface WireframeAlertCardProps {
  alerts?: Alert[];
  isLoading?: boolean;
  error?: string | null;
  onViewAll?: () => void;
  onDismiss?: (alertId: string) => void;
  onConfigure?: () => void;
  className?: string;
}

/**
 * Wireframe Alert Card Component - Based on dashboard wireframes specification
 * Matches the exact layout and styling from the wireframe documentation
 */
export const WireframeAlertCard: React.FC<WireframeAlertCardProps> = ({
  alerts = [],
  isLoading = false,
  error = null,
  onViewAll,
  onDismiss,
  onConfigure,
  className,
}) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const criticalAlerts = alerts.filter(alert => alert.type === 'critical');
  const warningAlerts = alerts.filter(alert => alert.type === 'warning');
  const infoAlerts = alerts.filter(alert => alert.type === 'info');

  const toggleExpanded = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-lg font-semibold">ALERTS</span>
            </div>
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
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
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-lg font-semibold">ALERTS</span>
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
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-lg font-semibold">ALERTS</span>
          </CardTitle>
          {onConfigure && (
            <Button variant="ghost" size="sm" onClick={onConfigure} className="p-1">
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
          <div className="space-y-4">
            {/* Critical Alerts Section */}
            {criticalAlerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className="text-sm font-medium text-red-600">
                    Critical ({criticalAlerts.length})
                  </span>
                </div>
                <div className="space-y-1 ml-5">
                  {criticalAlerts.slice(0, 3).map((alert, index) => (
                    <div key={alert.id || index} className="text-sm text-gray-700">
                      • {alert.message}
                    </div>
                  ))}
                  {criticalAlerts.length > 3 && (
                    <div className="text-sm text-gray-500">
                      • ... and {criticalAlerts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warning Alerts Section */}
            {warningAlerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                  <span className="text-sm font-medium text-yellow-600">
                    Warnings ({warningAlerts.length})
                  </span>
                </div>
                <div className="space-y-1 ml-5">
                  {warningAlerts.slice(0, 2).map((alert, index) => (
                    <div key={alert.id || index} className="text-sm text-gray-700">
                      • {alert.message}
                    </div>
                  ))}
                  {warningAlerts.length > 2 && (
                    <div className="text-sm text-gray-500">
                      • ... and {warningAlerts.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info Alerts Section */}
            {infoAlerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <span className="text-sm font-medium text-blue-600">
                    Info ({infoAlerts.length})
                  </span>
                </div>
                <div className="space-y-1 ml-5">
                  {infoAlerts.slice(0, 1).map((alert, index) => (
                    <div key={alert.id || index} className="text-sm text-gray-700">
                      • {alert.message}
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
            className="w-full justify-between text-xs"
          >
            <span>View All Alerts</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
