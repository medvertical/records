import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  XCircle,
  X,
  Settings,
  Save,
  RotateCcw,
  AlertCircle,
  Clock,
  MoreHorizontal
} from 'lucide-react';
import { 
  SettingsChangeNotification,
  SettingsNotificationAction 
} from '@/lib/validation-settings-notifications';
import { cn } from '@/lib/utils';

interface ValidationSettingsNotificationsProps {
  notifications: SettingsChangeNotification[];
  onDismiss?: (notificationId: string) => void;
  onDismissAll?: () => void;
  onAction?: (notificationId: string, actionId: string) => void;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
  maxDisplay?: number;
}

export const ValidationSettingsNotifications: React.FC<ValidationSettingsNotificationsProps> = ({
  notifications,
  onDismiss,
  onDismissAll,
  onAction,
  className,
  showDetails = true,
  compact = false,
  maxDisplay = 5,
}) => {
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());

  const toggleNotificationExpansion = (notificationId: string) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const getNotificationIcon = (notification: SettingsChangeNotification) => {
    switch (notification.type) {
      case 'settings_changed': return <Settings className="h-4 w-4" />;
      case 'settings_saved': return <Save className="h-4 w-4" />;
      case 'settings_loaded': return <CheckCircle className="h-4 w-4" />;
      case 'settings_reset': return <RotateCcw className="h-4 w-4" />;
      case 'settings_error': return <AlertCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityIcon = (notification: SettingsChangeNotification) => {
    switch (notification.severity) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (notification: SettingsChangeNotification) => {
    switch (notification.severity) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getNotificationStatistics = () => {
    const stats = {
      total: notifications.length,
      success: notifications.filter(n => n.severity === 'success').length,
      warning: notifications.filter(n => n.severity === 'warning').length,
      error: notifications.filter(n => n.severity === 'error').length,
      info: notifications.filter(n => n.severity === 'info').length,
      persistent: notifications.filter(n => n.persistent).length,
    };

    return stats;
  };

  const stats = getNotificationStatistics();
  const displayNotifications = notifications.slice(0, maxDisplay);
  const hasMoreNotifications = notifications.length > maxDisplay;

  if (notifications.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-gray-500">
            <Bell className="h-6 w-6 mr-2" />
            <span>No notifications</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.total}
              </Badge>
              {stats.error > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.error}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onDismissAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissAll}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Dismiss All
              </Button>
            )}
          </div>

          {/* Recent notifications */}
          {displayNotifications.map((notification, index) => (
            <div key={notification.id} className="flex items-center gap-2 text-sm">
              {getSeverityIcon(notification)}
              <span className="flex-1">{notification.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(notification.timestamp)}
              </span>
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(notification.id)}
                  className="text-xs"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          
          {hasMoreNotifications && (
            <div className="text-xs text-muted-foreground">
              +{notifications.length - maxDisplay} more notifications
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Settings Notifications
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {stats.total} total
            </Badge>
            {stats.success > 0 && (
              <Badge variant="default" className="text-sm bg-green-100 text-green-800">
                {stats.success} success
              </Badge>
            )}
            {stats.warning > 0 && (
              <Badge variant="secondary" className="text-sm">
                {stats.warning} warning
              </Badge>
            )}
            {stats.error > 0 && (
              <Badge variant="destructive" className="text-sm">
                {stats.error} error
              </Badge>
            )}
            {stats.info > 0 && (
              <Badge variant="outline" className="text-sm">
                {stats.info} info
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notification statistics */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total:</span>
              <span className="ml-2 font-medium">{stats.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Persistent:</span>
              <span className="ml-2 font-medium text-yellow-600">{stats.persistent}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Success:</span>
              <span className="ml-2 font-medium text-green-600">{stats.success}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Errors:</span>
              <span className="ml-2 font-medium text-red-600">{stats.error}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onDismissAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissAll}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Dismiss All
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="space-y-3">
          {displayNotifications.map((notification, index) => {
            const isExpanded = expandedNotifications.has(notification.id);
            const severityColor = getSeverityColor(notification);
            
            return (
              <div
                key={notification.id}
                className={cn(
                  'p-3 rounded border text-sm',
                  severityColor
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getNotificationIcon(notification)}
                    {getSeverityIcon(notification)}
                    <span className="font-medium">{notification.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {notification.type.replace('settings_', '')}
                    </Badge>
                    {notification.persistent && (
                      <Badge variant="secondary" className="text-xs">
                        Persistent
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(notification.timestamp)}
                    </span>
                    {showDetails && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleNotificationExpansion(notification.id)}
                        className="text-xs"
                      >
                        {isExpanded ? 'Hide' : 'Show'} Details
                      </Button>
                    )}
                    {onDismiss && !notification.persistent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismiss(notification.id)}
                        className="text-xs"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-sm mb-2">
                  {notification.message}
                </p>

                {notification.description && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {notification.description}
                  </p>
                )}

                {isExpanded && showDetails && (
                  <div className="space-y-2 text-xs">
                    {notification.changeDetails && (
                      <div>
                        <span className="font-medium">Change Details:</span>
                        <div className="ml-2 mt-1 p-2 bg-gray-100 rounded">
                          {notification.changeDetails.field && (
                            <div>
                              <span className="font-medium">Field:</span>
                              <span className="ml-2">{notification.changeDetails.field}</span>
                            </div>
                          )}
                          {notification.changeDetails.changeType && (
                            <div>
                              <span className="font-medium">Type:</span>
                              <span className="ml-2">{notification.changeDetails.changeType}</span>
                            </div>
                          )}
                          {notification.changeDetails.oldValue !== undefined && (
                            <div>
                              <span className="font-medium">Old Value:</span>
                              <span className="ml-2">{JSON.stringify(notification.changeDetails.oldValue)}</span>
                            </div>
                          )}
                          {notification.changeDetails.newValue !== undefined && (
                            <div>
                              <span className="font-medium">New Value:</span>
                              <span className="ml-2">{JSON.stringify(notification.changeDetails.newValue)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {notification.actions && notification.actions.length > 0 && (
                      <div>
                        <span className="font-medium">Actions:</span>
                        <div className="ml-2 mt-1 flex gap-2 flex-wrap">
                          {notification.actions.map((action) => (
                            <Button
                              key={action.id}
                              variant={action.variant || 'outline'}
                              size="sm"
                              onClick={() => onAction?.(notification.id, action.id)}
                              className="text-xs"
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasMoreNotifications && (
          <div className="text-center text-sm text-muted-foreground">
            +{notifications.length - maxDisplay} more notifications
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationSettingsNotifications;

