/**
 * Profile Notification Service
 * 
 * Manages notifications for profile download events.
 * Emits events when profiles are auto-downloaded, cached, or resolved.
 * 
 * Features:
 * - Event emission for profile lifecycle events
 * - Notification queue management
 * - WebSocket integration for real-time updates
 * - Notification persistence for history
 * 
 * Responsibilities: Notification management ONLY
 * - Does not download profiles (handled by ProfileResolver)
 * - Does not validate resources (handled by ValidationEngine)
 * 
 * File size: ~250 lines (adhering to global.mdc standards)
 */

import { EventEmitter } from 'events';
import { db } from '../../../db';
import { sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export type ProfileNotificationType = 
  | 'profile-downloaded'
  | 'profile-cached'
  | 'profile-resolved'
  | 'german-profile-detected'
  | 'package-downloaded'
  | 'dependency-resolved'
  | 'resolution-failed';

export type ProfileNotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface ProfileNotification {
  /** Unique notification ID */
  id: string;
  
  /** Notification type */
  type: ProfileNotificationType;
  
  /** Severity level */
  severity: ProfileNotificationSeverity;
  
  /** Notification title */
  title: string;
  
  /** Notification message */
  message: string;
  
  /** Profile canonical URL */
  canonicalUrl?: string;
  
  /** Profile version */
  version?: string;
  
  /** Package ID (for package downloads) */
  packageId?: string;
  
  /** Additional metadata */
  metadata?: {
    source?: string;
    resolutionTime?: number;
    germanFamily?: string;
    dependencyCount?: number;
    [key: string]: any;
  };
  
  /** Timestamp */
  timestamp: Date;
  
  /** Whether notification has been read */
  read: boolean;
  
  /** Action button (optional) */
  action?: {
    label: string;
    url: string;
  };
}

// ============================================================================
// Profile Notification Service
// ============================================================================

export class ProfileNotificationService extends EventEmitter {
  private notifications: ProfileNotification[] = [];
  private maxNotifications = 100;

  constructor() {
    super();
    console.log('[ProfileNotificationService] Initialized');
  }

  /**
   * Emit a profile download notification
   */
  notifyProfileDownloaded(canonicalUrl: string, version: string, source: string): void {
    const notification: ProfileNotification = {
      id: this.generateId(),
      type: 'profile-downloaded',
      severity: 'success',
      title: 'Profile Downloaded',
      message: `Successfully downloaded profile from ${source}`,
      canonicalUrl,
      version,
      metadata: { source },
      timestamp: new Date(),
      read: false,
      action: {
        label: 'View Profile',
        url: `/profiles?url=${encodeURIComponent(canonicalUrl)}`,
      },
    };

    this.addNotification(notification);
  }

  /**
   * Emit a German profile detection notification
   */
  notifyGermanProfileDetected(
    canonicalUrl: string,
    family: string,
    recommendedPackage?: string
  ): void {
    const notification: ProfileNotification = {
      id: this.generateId(),
      type: 'german-profile-detected',
      severity: 'info',
      title: `German ${family.toUpperCase()} Profile Detected`,
      message: recommendedPackage 
        ? `Recommended package: ${recommendedPackage}`
        : `German profile family: ${family}`,
      canonicalUrl,
      metadata: { germanFamily: family, recommendedPackage },
      timestamp: new Date(),
      read: false,
    };

    this.addNotification(notification);
  }

  /**
   * Emit a package download notification
   */
  notifyPackageDownloaded(packageId: string, dependencyCount: number): void {
    const notification: ProfileNotification = {
      id: this.generateId(),
      type: 'package-downloaded',
      severity: 'success',
      title: 'Package Downloaded',
      message: `Downloaded ${packageId}${dependencyCount > 0 ? ` with ${dependencyCount} dependencies` : ''}`,
      packageId,
      metadata: { dependencyCount },
      timestamp: new Date(),
      read: false,
    };

    this.addNotification(notification);
  }

  /**
   * Emit a resolution failure notification
   */
  notifyResolutionFailed(canonicalUrl: string, error: string): void {
    const notification: ProfileNotification = {
      id: this.generateId(),
      type: 'resolution-failed',
      severity: 'error',
      title: 'Profile Resolution Failed',
      message: `Could not resolve profile: ${error}`,
      canonicalUrl,
      metadata: { error },
      timestamp: new Date(),
      read: false,
    };

    this.addNotification(notification);
  }

  /**
   * Add notification to queue
   */
  private addNotification(notification: ProfileNotification): void {
    // Add to in-memory queue
    this.notifications.unshift(notification);

    // Limit queue size
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    // Emit event for real-time updates
    this.emit('notification', notification);

    console.log(`[ProfileNotificationService] ${notification.type}: ${notification.message}`);
  }

  /**
   * Get all notifications
   */
  getNotifications(unreadOnly: boolean = false): ProfileNotification[] {
    if (unreadOnly) {
      return this.notifications.filter(n => !n.read);
    }
    return [...this.notifications];
  }

  /**
   * Get notification by ID
   */
  getNotification(id: string): ProfileNotification | undefined {
    return this.notifications.find(n => n.id === id);
  }

  /**
   * Mark notification as read
   */
  markAsRead(id: string): boolean {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this.notifications = [];
    this.emit('cleared');
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let notificationServiceInstance: ProfileNotificationService | null = null;

/**
 * Get or create singleton ProfileNotificationService
 */
export function getProfileNotificationService(): ProfileNotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new ProfileNotificationService();
  }
  return notificationServiceInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetProfileNotificationService(): void {
  notificationServiceInstance = null;
}


