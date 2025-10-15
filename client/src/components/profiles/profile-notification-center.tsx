/**
 * Profile Notification Center
 * 
 * Displays notifications for profile downloads, German profile detection,
 * and package resolution events. Integrates with the backend ProfileNotificationService.
 * 
 * Features:
 * - Real-time notification polling
 * - Toast notifications for new events
 * - Notification list with filtering
 * - Mark as read/unread functionality
 * - Action buttons for profile viewing
 * 
 * Task 4.12: UI notification when profiles are auto-downloaded
 */

import React, { useEffect, useState } from 'react';
import { Bell, Download, Globe, Package, CheckCircle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ProfileNotificationType = 
  | 'profile-downloaded'
  | 'profile-cached'
  | 'profile-resolved'
  | 'german-profile-detected'
  | 'package-downloaded'
  | 'dependency-resolved'
  | 'resolution-failed';

type ProfileNotificationSeverity = 'info' | 'success' | 'warning' | 'error';

interface ProfileNotification {
  id: string;
  type: ProfileNotificationType;
  severity: ProfileNotificationSeverity;
  title: string;
  message: string;
  canonicalUrl?: string;
  version?: string;
  packageId?: string;
  metadata?: any;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    url: string;
  };
}

interface ProfileNotificationCenterProps {
  /** Whether to show as dropdown or inline list */
  variant?: 'dropdown' | 'inline';
  
  /** Maximum notifications to display */
  maxDisplay?: number;
  
  /** Polling interval in ms */
  pollingInterval?: number;
  
  /** Show toast for new notifications */
  showToasts?: boolean;
}

// ============================================================================
// Profile Notification Center Component
// ============================================================================

export function ProfileNotificationCenter({
  variant = 'dropdown',
  maxDisplay = 10,
  pollingInterval = 5000,
  showToasts = true,
}: ProfileNotificationCenterProps) {
  const [notifications, setNotifications] = useState<ProfileNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
  const { toast } = useToast();

  // Poll for notifications
  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval]);

  // Show toast for new notifications
  useEffect(() => {
    if (!showToasts || notifications.length === 0) return;

    const latestNotification = notifications[0];
    
    // Only show toast if this is a new notification
    if (latestNotification.id !== lastNotificationId) {
      setLastNotificationId(latestNotification.id);
      
      // Show toast notification
      toast({
        title: latestNotification.title,
        description: latestNotification.message,
        variant: latestNotification.severity === 'error' ? 'destructive' : 'default',
        duration: 5000,
      });
    }
  }, [notifications, lastNotificationId, toast, showToasts]);

  // Fetch notifications from API
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/profiles/notifications');
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch profile notifications:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/profiles/notifications/${id}/read`, { method: 'POST' });
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch('/api/profiles/notifications/read-all', { method: 'POST' });
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    try {
      await fetch('/api/profiles/notifications/clear', { method: 'POST' });
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type: ProfileNotificationType) => {
    switch (type) {
      case 'profile-downloaded':
        return <Download className="h-4 w-4" />;
      case 'german-profile-detected':
        return <Globe className="h-4 w-4" />;
      case 'package-downloaded':
        return <Package className="h-4 w-4" />;
      case 'resolution-failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Get color for severity
  const getSeverityColor = (severity: ProfileNotificationSeverity) => {
    switch (severity) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  // Render notification item
  const renderNotification = (notification: ProfileNotification) => (
    <div
      key={notification.id}
      className={cn(
        'p-3 border rounded-md transition-colors cursor-pointer',
        notification.read ? 'opacity-60' : 'opacity-100',
        getSeverityColor(notification.severity)
      )}
      onClick={() => !notification.read && markAsRead(notification.id)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between">
            <h4 className="text-sm font-semibold">{notification.title}</h4>
            {!notification.read && (
              <Badge variant="default" className="ml-2 h-5">New</Badge>
            )}
          </div>
          <p className="text-sm">{notification.message}</p>
          {notification.canonicalUrl && (
            <p className="text-xs opacity-75 truncate" title={notification.canonicalUrl}>
              {notification.canonicalUrl}
              {notification.version && ` (v${notification.version})`}
            </p>
          )}
          <p className="text-xs opacity-60">
            {new Date(notification.timestamp).toLocaleTimeString()}
          </p>
          {notification.action && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = notification.action!.url;
              }}
            >
              {notification.action.label} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>

        {isOpen && (
          <Card className="absolute right-0 top-12 w-96 shadow-lg z-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Profile Notifications
                </CardTitle>
                {notifications.length > 0 && (
                  <div className="flex gap-1">
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-xs">
                        Mark all read
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              <CardDescription>
                {notifications.length === 0 
                  ? 'No notifications'
                  : `${notifications.length} notification${notifications.length > 1 ? 's' : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {notifications.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No profile notifications</p>
                      <p className="text-xs mt-1">You'll be notified when profiles are downloaded</p>
                    </div>
                  ) : (
                    notifications.slice(0, maxDisplay).map(renderNotification)
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Inline variant
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Profile Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount} unread</Badge>
            )}
          </CardTitle>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  Mark all read
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Automatic profile resolution and download notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No notifications</p>
                <p className="text-xs mt-1">Profiles will be downloaded automatically during validation</p>
              </div>
            ) : (
              notifications.map(renderNotification)
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Notification Bell Icon for Header
// ============================================================================

export function ProfileNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/profiles/notifications/unread-count');
      const data = await response.json();
      
      if (data.success) {
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  if (unreadCount === 0) {
    return null;
  }

  return (
    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
      {unreadCount}
    </Badge>
  );
}

