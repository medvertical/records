import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Widget, WidgetHeader, WidgetContent } from '../shared/Widget';
import { Alert as AlertType, AlertSummary } from '@/shared/types/dashboard-new';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  ChevronRight,
  RefreshCw,
  X
} from 'lucide-react';

/**
 * AlertCard Component - Single responsibility: Display and manage dashboard alerts
 * Follows global rules: Single responsibility, under 300 lines, uses existing UI components
 */
interface AlertCardProps {
  alerts?: AlertType[];
  summary?: AlertSummary;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onDismissAlert?: (alertId: string) => void;
  onAlertAction?: (alertId: string, actionId: string) => void;
  className?: string;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  alerts = [],
  summary,
  loading = false,
  error,
  onRefresh,
  onDismissAlert,
  onAlertAction,
  className,
}) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Get alert icon based on type
  const getAlertIcon = (type: AlertType['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Get alert variant based on type
  const getAlertVariant = (type: AlertType['type']) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get alert styling based on type
  const getAlertStyling = (type: AlertType['type']) => {
    switch (type) {
      case 'critical':
        return 'alert-critical';
      case 'warning':
        return 'alert-warning';
      case 'info':
        return 'alert-info';
      default:
        return '';
    }
  };

  // Toggle alert expansion
  const toggleAlertExpansion = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  // Filter alerts based on showAll state
  const displayedAlerts = showAll ? alerts : alerts.slice(0, 3);

  // Generate summary if not provided
  const alertSummary: AlertSummary = summary || {
    critical: alerts.filter(a => a.type === 'critical').length,
    warnings: alerts.filter(a => a.type === 'warning').length,
    info: alerts.filter(a => a.type === 'info').length,
    total: alerts.length,
  };

  const hasAlerts = alertSummary.total > 0;

  return (
    <Widget
      id="alerts"
      title="Alerts"
      subtitle={hasAlerts ? `${alertSummary.total} active alerts` : 'No active alerts'}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      className={className}
      actions={
        hasAlerts && (
          <Badge 
            variant={alertSummary.critical > 0 ? "destructive" : "default"}
            className="animate-pulse"
          >
            {alertSummary.critical > 0 ? 'Critical' : 'Active'}
          </Badge>
        )
      }
    >
      <WidgetContent>
        {!hasAlerts ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              All systems operational
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Alert Summary */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="space-y-1">
                <div className="text-lg font-bold text-fhir-error">
                  {alertSummary.critical}
                </div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-fhir-warning">
                  {alertSummary.warnings}
                </div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-fhir-blue">
                  {alertSummary.info}
                </div>
                <div className="text-xs text-muted-foreground">Info</div>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold">
                  {alertSummary.total}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>

            {/* Individual Alerts */}
            <div className="space-y-2">
              {displayedAlerts.map((alert) => {
                const isExpanded = expandedAlerts.has(alert.id);
                const Icon = getAlertIcon(alert.type);
                
                return (
                  <Alert
                    key={alert.id}
                    variant={getAlertVariant(alert.type)}
                    className={cn(getAlertStyling(alert.type), 'cursor-pointer')}
                    onClick={() => toggleAlertExpansion(alert.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2 flex-1">
                        {Icon}
                        <div className="flex-1 min-w-0">
                          <AlertTitle className="text-sm font-medium">
                            {alert.title}
                          </AlertTitle>
                          <AlertDescription className="text-xs">
                            {alert.message}
                          </AlertDescription>
                          
                          {/* Alert Actions */}
                          {isExpanded && alert.actions && alert.actions.length > 0 && (
                            <div className="mt-2 space-x-2">
                              {alert.actions.map((action) => (
                                <Button
                                  key={action.id}
                                  variant={action.type === 'primary' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAlertAction?.(alert.id, action.id);
                                  }}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAlertExpansion(alert.id);
                          }}
                          className="p-1 h-auto"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                        
                        {onDismissAlert && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismissAlert(alert.id);
                            }}
                            className="p-1 h-auto text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Alert Timestamp */}
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.timestamp.toLocaleString()}
                    </div>
                  </Alert>
                );
              })}
            </div>

            {/* Show More/Less Button */}
            {alerts.length > 3 && (
              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs"
                >
                  {showAll ? 'Show Less' : `Show All ${alerts.length} Alerts`}
                </Button>
              </div>
            )}
          </div>
        )}
      </WidgetContent>
    </Widget>
  );
};

/**
 * Alert Summary Component - Standalone alert summary display
 */
interface AlertSummaryProps {
  summary: AlertSummary;
  className?: string;
}

export const AlertSummary: React.FC<AlertSummaryProps> = ({
  summary,
  className,
}) => {
  return (
    <div className={cn('flex items-center space-x-4', className)}>
      {summary.critical > 0 && (
        <div className="flex items-center space-x-1">
          <AlertTriangle className="h-4 w-4 text-fhir-error" />
          <span className="text-sm font-medium text-fhir-error">
            {summary.critical}
          </span>
        </div>
      )}
      {summary.warnings > 0 && (
        <div className="flex items-center space-x-1">
          <AlertCircle className="h-4 w-4 text-fhir-warning" />
          <span className="text-sm font-medium text-fhir-warning">
            {summary.warnings}
          </span>
        </div>
      )}
      {summary.info > 0 && (
        <div className="flex items-center space-x-1">
          <Info className="h-4 w-4 text-fhir-blue" />
          <span className="text-sm font-medium text-fhir-blue">
            {summary.info}
          </span>
        </div>
      )}
    </div>
  );
};

export default AlertCard;
