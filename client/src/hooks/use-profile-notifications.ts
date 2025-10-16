/**
 * useProfileNotifications Hook
 * 
 * React hook for managing profile download notifications.
 * Provides easy access to notification data and actions.
 * 
 * Task 4.12: UI notification when profiles are auto-downloaded
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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

interface UseProfileNotificationsOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  
  /** Polling interval in ms (0 to disable) */
  pollingInterval?: number;
  
  /** Show toast for new notifications */
  showToasts?: boolean;
  
  /** Only fetch unread notifications */
  unreadOnly?: boolean;
}

interface UseProfileNotificationsReturn {
  /** All notifications */
  notifications: ProfileNotification[];
  
  /** Unread count */
  unreadCount: number;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error state */
  error: string | null;
  
  /** Fetch notifications */
  fetchNotifications: () => Promise<void>;
  
  /** Mark notification as read */
  markAsRead: (id: string) => Promise<void>;
  
  /** Mark all as read */
  markAllAsRead: () => Promise<void>;
  
  /** Clear all notifications */
  clearAll: () => Promise<void>;
  
  /** Get unread notifications */
  getUnread: () => ProfileNotification[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useProfileNotifications(
  options: UseProfileNotificationsOptions = {}
): UseProfileNotificationsReturn {
  const {
    autoFetch = true,
    pollingInterval = 10000,
    showToasts = true,
    unreadOnly = false,
  } = options;

  const [notifications, setNotifications] = useState<ProfileNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const url = `/api/profiles/notifications${unreadOnly ? '?unreadOnly=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);

        // Show toast for new notifications
        if (showToasts && data.notifications.length > 0) {
          const latest = data.notifications[0];
          if (latest.id !== lastNotificationId && !latest.read) {
            setLastNotificationId(latest.id);
            
            toast({
              title: latest.title,
              description: latest.message,
              variant: latest.severity === 'error' ? 'destructive' : 'default',
              duration: 5000,
            });
          }
        }
      } else {
        setError(data.message || 'Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Failed to fetch profile notifications:', err);
      setError('Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [unreadOnly, showToasts, lastNotificationId, toast]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/profiles/notifications/${id}/read`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [fetchNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/profiles/notifications/read-all', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [fetchNotifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      const response = await fetch('/api/profiles/notifications/clear', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  }, []);

  // Get unread notifications
  const getUnread = useCallback(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchNotifications();
    }
  }, [autoFetch, fetchNotifications]);

  // Setup polling
  useEffect(() => {
    if (pollingInterval > 0) {
      const interval = setInterval(() => {
        fetchNotifications();
      }, pollingInterval);

      return () => clearInterval(interval);
    }
  }, [pollingInterval, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    getUnread,
  };
}


