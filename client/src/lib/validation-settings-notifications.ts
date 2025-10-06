/**
 * Validation Settings Change Notifications and Cache Invalidation
 * 
 * Provides comprehensive notifications for validation settings changes
 * and intelligent cache invalidation strategies.
 */

import React from 'react';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// Browser-compatible EventEmitter implementation
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach(listener => listener(...args));
    return true;
  }

  off(event: string, listener: Function): this {
    if (!this.events[event]) {
      return this;
    }
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

export interface SettingsChangeNotification {
  id: string;
  type: 'settings_changed' | 'settings_saved' | 'settings_loaded' | 'settings_reset' | 'settings_error';
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  description?: string;
  timestamp: Date;
  settings?: ValidationSettings;
  changeDetails?: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    changeType?: 'added' | 'removed' | 'modified' | 'reordered';
  };
  actions?: SettingsNotificationAction[];
  persistent?: boolean;
  autoDismiss?: boolean;
  dismissAfter?: number;
}

export interface SettingsNotificationAction {
  id: string;
  label: string;
  action: () => void | Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  icon?: string;
}

export interface CacheInvalidationStrategy {
  /** Whether to invalidate all caches */
  invalidateAll: boolean;
  
  /** Specific cache keys to invalidate */
  specificKeys: string[];
  
  /** Cache patterns to invalidate */
  patterns: string[];
  
  /** Whether to refetch data after invalidation */
  refetch: boolean;
  
  /** Delay before refetching in milliseconds */
  refetchDelay: number;
  
  /** Whether to show loading states during refetch */
  showLoading: boolean;
}

export interface SettingsNotificationsConfig {
  /** Whether to enable notifications */
  enableNotifications: boolean;
  
  /** Whether to enable toast notifications */
  enableToastNotifications: boolean;
  
  /** Whether to enable console logging */
  enableConsoleLogging: boolean;
  
  /** Whether to enable cache invalidation */
  enableCacheInvalidation: boolean;
  
  /** Default notification duration in milliseconds */
  defaultDuration: number;
  
  /** Maximum number of notifications to keep */
  maxNotifications: number;
  
  /** Whether to enable persistent notifications */
  enablePersistentNotifications: boolean;
  
  /** Whether to enable auto-dismiss */
  enableAutoDismiss: boolean;
  
  /** Auto-dismiss delay in milliseconds */
  autoDismissDelay: number;
}

export class ValidationSettingsNotifications extends EventEmitter {
  private config: SettingsNotificationsConfig;
  private notifications: SettingsChangeNotification[] = [];
  private queryClient: any = null;
  private toast: any = null;

  constructor(config: Partial<SettingsNotificationsConfig> = {}) {
    super();
    
    this.config = {
      enableNotifications: true,
      enableToastNotifications: true,
      enableConsoleLogging: true,
      enableCacheInvalidation: true,
      defaultDuration: 5000,
      maxNotifications: 50,
      enablePersistentNotifications: false,
      enableAutoDismiss: true,
      autoDismissDelay: 5000,
      ...config
    };
  }

  /**
   * Initialize the notifications system
   */
  initialize(queryClient: any, toast: any): void {
    this.queryClient = queryClient;
    this.toast = toast;
    this.emit('initialized');
  }

  /**
   * Notify about settings changes
   */
  notifySettingsChanged(
    settings: ValidationSettings,
    changeDetails?: {
      field?: string;
      oldValue?: any;
      newValue?: any;
      changeType?: 'added' | 'removed' | 'modified' | 'reordered';
    }
  ): void {
    if (!this.config.enableNotifications) {
      return;
    }

    const notification: SettingsChangeNotification = {
      id: this.generateNotificationId(),
      type: 'settings_changed',
      severity: 'info',
      title: 'Settings Changed',
      message: changeDetails?.field 
        ? `Setting "${changeDetails.field}" has been modified`
        : 'Validation settings have been updated',
      description: this.getChangeDescription(changeDetails),
      timestamp: new Date(),
      settings,
      changeDetails,
      actions: this.getChangeActions(settings, changeDetails),
      persistent: false,
      autoDismiss: this.config.enableAutoDismiss,
      dismissAfter: this.config.autoDismissDelay
    };

    this.addNotification(notification);
    this.emit('settingsChanged', notification);
  }

  /**
   * Notify about settings being saved
   */
  notifySettingsSaved(settings: ValidationSettings): void {
    if (!this.config.enableNotifications) {
      return;
    }

    const notification: SettingsChangeNotification = {
      id: this.generateNotificationId(),
      type: 'settings_saved',
      severity: 'success',
      title: 'Settings Saved',
      message: 'Validation settings have been saved successfully',
      description: 'Your validation settings have been persisted and are now active',
      timestamp: new Date(),
      settings,
      actions: this.getSaveActions(settings),
      persistent: false,
      autoDismiss: this.config.enableAutoDismiss,
      dismissAfter: this.config.autoDismissDelay
    };

    this.addNotification(notification);
    this.emit('settingsSaved', notification);
  }

  /**
   * Notify about settings being loaded
   */
  notifySettingsLoaded(settings: ValidationSettings): void {
    if (!this.config.enableNotifications) {
      return;
    }

    const notification: SettingsChangeNotification = {
      id: this.generateNotificationId(),
      type: 'settings_loaded',
      severity: 'info',
      title: 'Settings Loaded',
      message: 'Validation settings have been loaded',
      description: 'Your validation settings have been restored from storage',
      timestamp: new Date(),
      settings,
      persistent: false,
      autoDismiss: this.config.enableAutoDismiss,
      dismissAfter: this.config.autoDismissDelay
    };

    this.addNotification(notification);
    this.emit('settingsLoaded', notification);
  }

  /**
   * Notify about settings being reset
   */
  notifySettingsReset(settings: ValidationSettings): void {
    if (!this.config.enableNotifications) {
      return;
    }

    const notification: SettingsChangeNotification = {
      id: this.generateNotificationId(),
      type: 'settings_reset',
      severity: 'warning',
      title: 'Settings Reset',
      message: 'Validation settings have been reset to defaults',
      description: 'All validation settings have been restored to their default values',
      timestamp: new Date(),
      settings,
      actions: this.getResetActions(settings),
      persistent: false,
      autoDismiss: this.config.enableAutoDismiss,
      dismissAfter: this.config.autoDismissDelay
    };

    this.addNotification(notification);
    this.emit('settingsReset', notification);
  }

  /**
   * Notify about settings errors
   */
  notifySettingsError(
    error: Error,
    operation: string,
    settings?: ValidationSettings
  ): void {
    if (!this.config.enableNotifications) {
      return;
    }

    const notification: SettingsChangeNotification = {
      id: this.generateNotificationId(),
      type: 'settings_error',
      severity: 'error',
      title: 'Settings Error',
      message: `Error during ${operation}: ${error.message}`,
      description: this.getErrorDescription(error, operation),
      timestamp: new Date(),
      settings,
      actions: this.getErrorActions(error, operation),
      persistent: true,
      autoDismiss: false
    };

    this.addNotification(notification);
    this.emit('settingsError', notification);
  }

  /**
   * Invalidate caches based on settings changes
   */
  invalidateCaches(
    strategy: Partial<CacheInvalidationStrategy> = {},
    settings?: ValidationSettings
  ): void {
    if (!this.config.enableCacheInvalidation || !this.queryClient) {
      return;
    }

    const fullStrategy: CacheInvalidationStrategy = {
      invalidateAll: false,
      specificKeys: [],
      patterns: [],
      refetch: true,
      refetchDelay: 100,
      showLoading: true,
      ...strategy
    };

    try {
      if (fullStrategy.invalidateAll) {
        // Invalidate all caches
        this.queryClient.invalidateQueries();
        this.emit('cacheInvalidated', { type: 'all' });
      } else {
        // Invalidate specific keys and patterns
        if (fullStrategy.specificKeys.length > 0) {
          fullStrategy.specificKeys.forEach(key => {
            this.queryClient.invalidateQueries({ queryKey: [key] });
          });
        }

        if (fullStrategy.patterns.length > 0) {
          fullStrategy.patterns.forEach(pattern => {
            this.queryClient.invalidateQueries({ 
              queryKey: [pattern],
              exact: false 
            });
          });
        }

        this.emit('cacheInvalidated', { 
          type: 'selective',
          keys: fullStrategy.specificKeys,
          patterns: fullStrategy.patterns
        });
      }

      // Refetch data if requested
      if (fullStrategy.refetch) {
        setTimeout(() => {
          this.refetchData(fullStrategy, settings);
        }, fullStrategy.refetchDelay);
      }

      if (this.config.enableConsoleLogging) {
        console.log('[ValidationSettingsNotifications] Cache invalidated:', fullStrategy);
      }
    } catch (error) {
      console.error('[ValidationSettingsNotifications] Cache invalidation failed:', error);
      this.emit('cacheInvalidationError', error);
    }
  }

  /**
   * Get cache invalidation strategy for settings changes
   */
  getCacheInvalidationStrategy(
    changeType: 'settings_changed' | 'settings_saved' | 'settings_loaded' | 'settings_reset' | 'settings_error',
    changeDetails?: any
  ): CacheInvalidationStrategy {
    switch (changeType) {
      case 'settings_changed':
        return {
          invalidateAll: false,
          specificKeys: ['validation-settings', 'validation-progress'],
          patterns: ['validation-*'],
          refetch: true,
          refetchDelay: 100,
          showLoading: false
        };

      case 'settings_saved':
        return {
          invalidateAll: false,
          specificKeys: ['validation-settings', 'validation-progress', 'dashboard-stats'],
          patterns: ['validation-*', 'dashboard-*'],
          refetch: true,
          refetchDelay: 200,
          showLoading: true
        };

      case 'settings_loaded':
        return {
          invalidateAll: false,
          specificKeys: ['validation-settings'],
          patterns: [],
          refetch: false,
          refetchDelay: 0,
          showLoading: false
        };

      case 'settings_reset':
        return {
          invalidateAll: true,
          specificKeys: [],
          patterns: [],
          refetch: true,
          refetchDelay: 300,
          showLoading: true
        };

      case 'settings_error':
        return {
          invalidateAll: false,
          specificKeys: [],
          patterns: [],
          refetch: false,
          refetchDelay: 0,
          showLoading: false
        };

      default:
        return {
          invalidateAll: false,
          specificKeys: [],
          patterns: [],
          refetch: false,
          refetchDelay: 0,
          showLoading: false
        };
    }
  }

  /**
   * Get all notifications
   */
  getNotifications(): SettingsChangeNotification[] {
    return [...this.notifications];
  }

  /**
   * Get recent notifications
   */
  getRecentNotifications(limit: number = 10): SettingsChangeNotification[] {
    return this.notifications.slice(-limit);
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this.notifications = [];
    this.emit('notificationsCleared');
  }

  /**
   * Dismiss a specific notification
   */
  dismissNotification(notificationId: string): void {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      const notification = this.notifications[index];
      this.notifications.splice(index, 1);
      this.emit('notificationDismissed', notification);
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStatistics(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: number;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const recent = this.notifications.filter(
      n => Date.now() - n.timestamp.getTime() < 60000 // Last minute
    ).length;

    this.notifications.forEach(notification => {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      bySeverity[notification.severity] = (bySeverity[notification.severity] || 0) + 1;
    });

    return {
      total: this.notifications.length,
      byType,
      bySeverity,
      recent
    };
  }

  // Private methods

  private addNotification(notification: SettingsChangeNotification): void {
    this.notifications.push(notification);

    // Keep only the most recent notifications
    if (this.notifications.length > this.config.maxNotifications) {
      this.notifications = this.notifications.slice(-this.config.maxNotifications);
    }

    // Show toast notification if enabled
    if (this.config.enableToastNotifications && this.toast) {
      this.showToastNotification(notification);
    }

    // Auto-dismiss if enabled
    if (notification.autoDismiss && notification.dismissAfter) {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, notification.dismissAfter);
    }

    if (this.config.enableConsoleLogging) {
      console.log('[ValidationSettingsNotifications] Notification added:', notification);
    }
  }

  private showToastNotification(notification: SettingsChangeNotification): void {
    if (!this.toast) {
      return;
    }

    this.toast({
      title: notification.title,
      description: notification.message,
      variant: notification.severity === 'error' ? 'destructive' : 
               notification.severity === 'warning' ? 'default' :
               notification.severity === 'success' ? 'default' : 'default',
      duration: notification.dismissAfter || this.config.defaultDuration,
    });
  }

  private refetchData(
    strategy: CacheInvalidationStrategy,
    settings?: ValidationSettings
  ): void {
    if (!this.queryClient) {
      return;
    }

    try {
      if (strategy.invalidateAll) {
        this.queryClient.refetchQueries();
      } else {
        if (strategy.specificKeys.length > 0) {
          strategy.specificKeys.forEach(key => {
            this.queryClient.refetchQueries({ queryKey: [key] });
          });
        }

        if (strategy.patterns.length > 0) {
          strategy.patterns.forEach(pattern => {
            this.queryClient.refetchQueries({ 
              queryKey: [pattern],
              exact: false 
            });
          });
        }
      }

      this.emit('dataRefetched', { strategy, settings });
    } catch (error) {
      console.error('[ValidationSettingsNotifications] Data refetch failed:', error);
      this.emit('dataRefetchError', error);
    }
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getChangeDescription(changeDetails?: any): string {
    if (!changeDetails) {
      return 'Validation settings have been updated';
    }

    const { field, changeType, oldValue, newValue } = changeDetails;
    
    switch (changeType) {
      case 'added':
        return `New setting "${field}" has been added with value: ${newValue}`;
      case 'removed':
        return `Setting "${field}" has been removed (was: ${oldValue})`;
      case 'modified':
        return `Setting "${field}" has been changed from "${oldValue}" to "${newValue}"`;
      case 'reordered':
        return `Setting "${field}" has been reordered`;
      default:
        return `Setting "${field}" has been updated`;
    }
  }

  private getChangeActions(settings: ValidationSettings, changeDetails?: any): SettingsNotificationAction[] {
    return [
      {
        id: 'save',
        label: 'Save Changes',
        action: () => {
          this.emit('saveRequested', { settings, changeDetails });
        },
        variant: 'default'
      },
      {
        id: 'revert',
        label: 'Revert',
        action: () => {
          this.emit('revertRequested', { settings, changeDetails });
        },
        variant: 'outline'
      }
    ];
  }

  private getSaveActions(settings: ValidationSettings): SettingsNotificationAction[] {
    return [
      {
        id: 'view',
        label: 'View Settings',
        action: () => {
          this.emit('viewSettingsRequested', { settings });
        },
        variant: 'outline'
      }
    ];
  }

  private getResetActions(settings: ValidationSettings): SettingsNotificationAction[] {
    return [
      {
        id: 'customize',
        label: 'Customize',
        action: () => {
          this.emit('customizeSettingsRequested', { settings });
        },
        variant: 'default'
      }
    ];
  }

  private getErrorActions(error: Error, operation: string): SettingsNotificationAction[] {
    return [
      {
        id: 'retry',
        label: 'Retry',
        action: () => {
          this.emit('retryRequested', { error, operation });
        },
        variant: 'default'
      },
      {
        id: 'report',
        label: 'Report Issue',
        action: () => {
          this.emit('reportIssueRequested', { error, operation });
        },
        variant: 'outline'
      }
    ];
  }

  private getErrorDescription(error: Error, operation: string): string {
    return `An error occurred while ${operation}. ${error.message}`;
  }
}

/**
 * Global validation settings notifications instance
 */
let globalNotifications: ValidationSettingsNotifications | null = null;

/**
 * Get the global validation settings notifications instance
 */
export function getValidationSettingsNotifications(): ValidationSettingsNotifications {
  if (!globalNotifications) {
    globalNotifications = new ValidationSettingsNotifications();
  }
  return globalNotifications;
}

/**
 * Hook for using validation settings notifications
 */
export function useValidationSettingsNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const notifications = getValidationSettingsNotifications();

  // Initialize notifications system
  React.useEffect(() => {
    notifications.initialize(queryClient, toast);
  }, [queryClient, toast, notifications]);

  return {
    notifications,
    notifySettingsChanged: notifications.notifySettingsChanged.bind(notifications),
    notifySettingsSaved: notifications.notifySettingsSaved.bind(notifications),
    notifySettingsLoaded: notifications.notifySettingsLoaded.bind(notifications),
    notifySettingsReset: notifications.notifySettingsReset.bind(notifications),
    notifySettingsError: notifications.notifySettingsError.bind(notifications),
    invalidateCaches: notifications.invalidateCaches.bind(notifications),
    getCacheInvalidationStrategy: notifications.getCacheInvalidationStrategy.bind(notifications),
    getNotifications: notifications.getNotifications.bind(notifications),
    getRecentNotifications: notifications.getRecentNotifications.bind(notifications),
    clearNotifications: notifications.clearNotifications.bind(notifications),
    dismissNotification: notifications.dismissNotification.bind(notifications),
    getNotificationStatistics: notifications.getNotificationStatistics.bind(notifications),
  };
}
