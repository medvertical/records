/**
 * Validation Real-time Notification Service
 * 
 * This service provides real-time notifications to UI components when validation
 * settings change, enabling immediate updates across all views (dashboard, resource list, resource details).
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings';
import type { ValidationSettings } from '@shared/validation-settings';

export interface ValidationNotification {
  type: 'settingsChanged' | 'aspectToggled' | 'scoreUpdated' | 'filterUpdated';
  timestamp: Date;
  data: any;
  affectedViews: string[];
}

export interface AspectToggleNotification {
  aspect: string;
  enabled: boolean;
  previousEnabled: boolean;
  affectedResources: number;
  scoreImpact: {
    before: number;
    after: number;
    delta: number;
  };
}

export interface SettingsChangeNotification {
  changedAspects: string[];
  newSettings: ValidationSettings;
  previousSettings: ValidationSettings;
  impact: {
    totalResources: number;
    affectedResources: number;
    scoreChange: number;
  };
}

export interface ViewUpdateNotification {
  view: string;
  updateType: 'full' | 'incremental' | 'score_only';
  data: any;
  priority: 'high' | 'medium' | 'low';
}

export class ValidationRealtimeNotificationService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private currentSettings: ValidationSettings | null = null;
  private previousSettings: ValidationSettings | null = null;
  private isInitialized = false;
  private notificationHistory: ValidationNotification[] = [];
  private maxHistorySize = 100;

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
    this.setupSettingsListeners();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load initial settings
      await this.loadCurrentSettings();
      this.isInitialized = true;
      console.log('[ValidationRealtimeNotification] Service initialized');
    } catch (error) {
      console.error('[ValidationRealtimeNotification] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up listeners for settings changes
   */
  private setupSettingsListeners(): void {
    this.settingsService.on('settingsChanged', (event) => {
      console.log('[ValidationRealtimeNotification] Settings changed, processing notification');
      this.handleSettingsChange(event).catch(error => {
        console.error('[ValidationRealtimeNotification] Failed to handle settings change:', error);
      });
    });

    this.settingsService.on('settingsReset', (event) => {
      console.log('[ValidationRealtimeNotification] Settings reset, processing notification');
      this.handleSettingsReset(event).catch(error => {
        console.error('[ValidationRealtimeNotification] Failed to handle settings reset:', error);
      });
    });
  }

  /**
   * Load current settings
   */
  private async loadCurrentSettings(): Promise<void> {
    try {
      this.previousSettings = this.currentSettings;
      this.currentSettings = await this.settingsService.getSettings();
    } catch (error) {
      console.error('[ValidationRealtimeNotification] Failed to load settings:', error);
      this.currentSettings = null;
    }
  }

  /**
   * Handle settings change event
   */
  private async handleSettingsChange(event: any): Promise<void> {
    try {
      await this.loadCurrentSettings();

      if (!this.currentSettings || !this.previousSettings) {
        return;
      }

      // Determine which aspects changed
      const changedAspects = this.getChangedAspects(this.previousSettings, this.currentSettings);

      if (changedAspects.length === 0) {
        return; // No actual changes
      }

      // Create settings change notification
      const settingsNotification: SettingsChangeNotification = {
        changedAspects,
        newSettings: this.currentSettings,
        previousSettings: this.previousSettings,
        impact: {
          totalResources: 0, // Will be calculated by UI
          affectedResources: 0, // Will be calculated by UI
          scoreChange: 0 // Will be calculated by UI
        }
      };

      // Create aspect toggle notifications for each changed aspect
      const aspectNotifications: AspectToggleNotification[] = changedAspects.map(aspect => {
        const previousEnabled = this.isAspectEnabled(this.previousSettings!, aspect);
        const currentEnabled = this.isAspectEnabled(this.currentSettings!, aspect);

        return {
          aspect,
          enabled: currentEnabled,
          previousEnabled,
          affectedResources: 0, // Will be calculated by UI
          scoreImpact: {
            before: 0, // Will be calculated by UI
            after: 0, // Will be calculated by UI
            delta: 0 // Will be calculated by UI
          }
        };
      });

      // Emit notifications
      this.emitNotification({
        type: 'settingsChanged',
        timestamp: new Date(),
        data: settingsNotification,
        affectedViews: ['dashboard', 'resourceList', 'resourceDetails', 'settings']
      });

      // Emit individual aspect toggle notifications
      aspectNotifications.forEach(notification => {
        this.emitNotification({
          type: 'aspectToggled',
          timestamp: new Date(),
          data: notification,
          affectedViews: ['dashboard', 'resourceList', 'resourceDetails']
        });
      });

      // Emit score update notification
      this.emitNotification({
        type: 'scoreUpdated',
        timestamp: new Date(),
        data: {
          reason: 'settingsChanged',
          changedAspects,
          requiresRecalculation: true
        },
        affectedViews: ['dashboard', 'resourceList', 'resourceDetails']
      });

      // Emit filter update notification
      this.emitNotification({
        type: 'filterUpdated',
        timestamp: new Date(),
        data: {
          reason: 'settingsChanged',
          changedAspects,
          newFilter: this.createFilterFromSettings(this.currentSettings)
        },
        affectedViews: ['resourceList', 'resourceDetails']
      });

    } catch (error) {
      console.error('[ValidationRealtimeNotification] Error handling settings change:', error);
    }
  }

  /**
   * Handle settings reset event
   */
  private async handleSettingsReset(event: any): Promise<void> {
    try {
      await this.loadCurrentSettings();

      // Emit reset notification
      this.emitNotification({
        type: 'settingsChanged',
        timestamp: new Date(),
        data: {
          type: 'reset',
          newSettings: this.currentSettings,
          previousSettings: this.previousSettings
        },
        affectedViews: ['dashboard', 'resourceList', 'resourceDetails', 'settings']
      });

      // Emit score update notification
      this.emitNotification({
        type: 'scoreUpdated',
        timestamp: new Date(),
        data: {
          reason: 'settingsReset',
          requiresRecalculation: true
        },
        affectedViews: ['dashboard', 'resourceList', 'resourceDetails']
      });

      // Emit filter update notification
      this.emitNotification({
        type: 'filterUpdated',
        timestamp: new Date(),
        data: {
          reason: 'settingsReset',
          newFilter: this.createFilterFromSettings(this.currentSettings)
        },
        affectedViews: ['resourceList', 'resourceDetails']
      });

    } catch (error) {
      console.error('[ValidationRealtimeNotification] Error handling settings reset:', error);
    }
  }

  /**
   * Get changed aspects between two settings objects
   */
  private getChangedAspects(previous: ValidationSettings, current: ValidationSettings): string[] {
    const changedAspects: string[] = [];
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];

    allAspects.forEach(aspect => {
      const previousEnabled = this.isAspectEnabled(previous, aspect);
      const currentEnabled = this.isAspectEnabled(current, aspect);

      if (previousEnabled !== currentEnabled) {
        changedAspects.push(aspect);
      }
    });

    return changedAspects;
  }

  /**
   * Check if an aspect is enabled in settings
   */
  private isAspectEnabled(settings: ValidationSettings, aspect: string): boolean {
    const aspectConfig = (settings as any)[aspect];
    return aspectConfig && typeof aspectConfig === 'object' && aspectConfig.enabled === true;
  }

  /**
   * Create filter object from settings
   */
  private createFilterFromSettings(settings: ValidationSettings | null): any {
    if (!settings) {
      return { enabledAspects: ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'] };
    }

    const enabledAspects: string[] = [];
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];

    allAspects.forEach(aspect => {
      if (this.isAspectEnabled(settings, aspect)) {
        enabledAspects.push(aspect);
      }
    });

    return { enabledAspects };
  }

  /**
   * Emit a notification and add to history
   */
  private emitNotification(notification: ValidationNotification): void {
    // Add to history
    this.notificationHistory.push(notification);
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.shift();
    }

    // Emit to listeners
    this.emit('notification', notification);

    // Emit specific event types
    this.emit(notification.type, notification);

    console.log(`[ValidationRealtimeNotification] Emitted ${notification.type} notification:`, {
      affectedViews: notification.affectedViews,
      timestamp: notification.timestamp
    });
  }

  /**
   * Subscribe to notifications for a specific view
   */
  subscribeToView(view: string, callback: (notification: ValidationNotification) => void): () => void {
    const handler = (notification: ValidationNotification) => {
      if (notification.affectedViews.includes(view)) {
        callback(notification);
      }
    };

    this.on('notification', handler);

    // Return unsubscribe function
    return () => {
      this.off('notification', handler);
    };
  }

  /**
   * Subscribe to specific notification types
   */
  subscribeToType(type: ValidationNotification['type'], callback: (notification: ValidationNotification) => void): () => void {
    this.on(type, callback);

    // Return unsubscribe function
    return () => {
      this.off(type, callback);
    };
  }

  /**
   * Get notification history
   */
  getNotificationHistory(limit?: number): ValidationNotification[] {
    if (limit) {
      return this.notificationHistory.slice(-limit);
    }
    return [...this.notificationHistory];
  }

  /**
   * Get current settings
   */
  getCurrentSettings(): ValidationSettings | null {
    return this.currentSettings;
  }

  /**
   * Get previous settings
   */
  getPreviousSettings(): ValidationSettings | null {
    return this.previousSettings;
  }

  /**
   * Check if an aspect is currently enabled
   */
  isAspectEnabled(aspect: string): boolean {
    if (!this.currentSettings) {
      return true; // Default to enabled if no settings
    }
    return this.isAspectEnabled(this.currentSettings, aspect);
  }

  /**
   * Get enabled aspects
   */
  getEnabledAspects(): string[] {
    if (!this.currentSettings) {
      return ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    }

    const enabledAspects: string[] = [];
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];

    allAspects.forEach(aspect => {
      if (this.isAspectEnabled(this.currentSettings!, aspect)) {
        enabledAspects.push(aspect);
      }
    });

    return enabledAspects;
  }

  /**
   * Create a view update notification
   */
  createViewUpdateNotification(
    view: string,
    updateType: 'full' | 'incremental' | 'score_only',
    data: any,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): ViewUpdateNotification {
    return {
      view,
      updateType,
      data,
      priority
    };
  }

  /**
   * Emit a view update notification
   */
  emitViewUpdate(notification: ViewUpdateNotification): void {
    this.emit('viewUpdate', notification);
    console.log(`[ValidationRealtimeNotification] Emitted view update for ${notification.view}:`, {
      updateType: notification.updateType,
      priority: notification.priority
    });
  }
}

// Singleton instance
let validationRealtimeNotificationServiceInstance: ValidationRealtimeNotificationService | null = null;

export function getValidationRealtimeNotificationService(): ValidationRealtimeNotificationService {
  if (!validationRealtimeNotificationServiceInstance) {
    validationRealtimeNotificationServiceInstance = new ValidationRealtimeNotificationService();
  }
  return validationRealtimeNotificationServiceInstance;
}
