// ============================================================================
// Validation Notification Service
// ============================================================================

import { storage } from '../../storage';

export interface ValidationNotification {
  id: string;
  type: 'validation_completed' | 'validation_failed' | 'validation_error' | 'quality_alert' | 'performance_alert' | 'schedule_reminder';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  recipient: string;
  recipientType: 'user' | 'email' | 'webhook' | 'system';
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  data?: any;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: ValidationNotification['type'];
  subject: string;
  message: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  email: string;
  preferences: {
    validation_completed: boolean;
    validation_failed: boolean;
    validation_error: boolean;
    quality_alert: boolean;
    performance_alert: boolean;
    schedule_reminder: boolean;
  };
  channels: {
    email: boolean;
    in_app: boolean;
    webhook: boolean;
    sms: boolean;
  };
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'sms' | 'push';
  configuration: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationHistory {
  id: string;
  notificationId: string;
  channel: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  response?: any;
  timestamp: Date;
}

export class ValidationNotificationService {
  private static instance: ValidationNotificationService;
  private templates: Map<string, NotificationTemplate> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private channels: Map<string, NotificationChannel> = new Map();
  private notificationQueue: ValidationNotification[] = [];
  private isProcessing = false;

  private constructor() {
    this.initializeDefaultTemplates();
    this.initializeDefaultChannels();
    this.startNotificationProcessor();
  }

  static getInstance(): ValidationNotificationService {
    if (!ValidationNotificationService.instance) {
      ValidationNotificationService.instance = new ValidationNotificationService();
    }
    return ValidationNotificationService.instance;
  }

  /**
   * Send validation completed notification
   */
  async sendValidationCompletedNotification(
    recipient: string,
    validationData: {
      totalResources: number;
      validResources: number;
      errorResources: number;
      duration: number;
      validationRunId: string;
    }
  ): Promise<ValidationNotification> {
    const notification = await this.createNotification({
      type: 'validation_completed',
      title: 'Validation Completed',
      message: `Validation completed successfully. Processed ${validationData.totalResources} resources with ${validationData.validResources} valid and ${validationData.errorResources} errors.`,
      severity: 'info',
      recipient,
      recipientType: 'user',
      data: validationData
    });

    await this.queueNotification(notification);
    return notification;
  }

  /**
   * Send validation failed notification
   */
  async sendValidationFailedNotification(
    recipient: string,
    errorData: {
      error: string;
      validationRunId: string;
      timestamp: Date;
    }
  ): Promise<ValidationNotification> {
    const notification = await this.createNotification({
      type: 'validation_failed',
      title: 'Validation Failed',
      message: `Validation failed with error: ${errorData.error}`,
      severity: 'error',
      recipient,
      recipientType: 'user',
      data: errorData
    });

    await this.queueNotification(notification);
    return notification;
  }

  /**
   * Send quality alert notification
   */
  async sendQualityAlertNotification(
    recipient: string,
    qualityData: {
      resourceType: string;
      qualityScore: number;
      threshold: number;
      issues: string[];
    }
  ): Promise<ValidationNotification> {
    const notification = await this.createNotification({
      type: 'quality_alert',
      title: 'Quality Alert',
      message: `Quality score for ${qualityData.resourceType} is ${qualityData.qualityScore}%, below threshold of ${qualityData.threshold}%`,
      severity: 'warning',
      recipient,
      recipientType: 'user',
      data: qualityData
    });

    await this.queueNotification(notification);
    return notification;
  }

  /**
   * Send performance alert notification
   */
  async sendPerformanceAlertNotification(
    recipient: string,
    performanceData: {
      metric: string;
      value: number;
      threshold: number;
      trend: 'improving' | 'stable' | 'declining';
    }
  ): Promise<ValidationNotification> {
    const notification = await this.createNotification({
      type: 'performance_alert',
      title: 'Performance Alert',
      message: `Performance metric ${performanceData.metric} is ${performanceData.value}, ${performanceData.trend} trend detected`,
      severity: 'warning',
      recipient,
      recipientType: 'user',
      data: performanceData
    });

    await this.queueNotification(notification);
    return notification;
  }

  /**
   * Send schedule reminder notification
   */
  async sendScheduleReminderNotification(
    recipient: string,
    scheduleData: {
      scheduleName: string;
      nextRun: Date;
      description?: string;
    }
  ): Promise<ValidationNotification> {
    const notification = await this.createNotification({
      type: 'schedule_reminder',
      title: 'Schedule Reminder',
      message: `Validation schedule "${scheduleData.scheduleName}" is scheduled to run at ${scheduleData.nextRun.toISOString()}`,
      severity: 'info',
      recipient,
      recipientType: 'user',
      data: scheduleData,
      scheduledAt: scheduleData.nextRun
    });

    await this.queueNotification(notification);
    return notification;
  }

  /**
   * Create notification
   */
  private async createNotification(data: {
    type: ValidationNotification['type'];
    title: string;
    message: string;
    severity: ValidationNotification['severity'];
    recipient: string;
    recipientType: ValidationNotification['recipientType'];
    data?: any;
    scheduledAt?: Date;
  }): Promise<ValidationNotification> {
    const notification: ValidationNotification = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type,
      title: data.title,
      message: data.message,
      severity: data.severity,
      recipient: data.recipient,
      recipientType: data.recipientType,
      status: 'pending',
      data: data.data,
      scheduledAt: data.scheduledAt,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store notification
    await this.storeNotification(notification);

    return notification;
  }

  /**
   * Queue notification for processing
   */
  private async queueNotification(notification: ValidationNotification): Promise<void> {
    // Check if user wants to receive this type of notification
    const preferences = await this.getNotificationPreferences(notification.recipient);
    if (!preferences || !preferences.preferences[notification.type]) {
      console.log(`[ValidationNotification] User ${notification.recipient} has disabled ${notification.type} notifications`);
      return;
    }

    // Check quiet hours
    if (this.isInQuietHours(preferences)) {
      console.log(`[ValidationNotification] Notification queued for after quiet hours`);
      // Schedule for after quiet hours
      notification.scheduledAt = this.getNextAvailableTime(preferences);
    }

    this.notificationQueue.push(notification);
    console.log(`[ValidationNotification] Queued notification: ${notification.id}`);
  }

  /**
   * Start notification processor
   */
  private startNotificationProcessor(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;

    // Process notifications every 30 seconds
    setInterval(() => {
      this.processNotificationQueue();
    }, 30000);

    console.log('[ValidationNotification] Notification processor started');
  }

  /**
   * Process notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    const now = new Date();
    const readyNotifications = this.notificationQueue.filter(notification => 
      !notification.scheduledAt || notification.scheduledAt <= now
    );

    for (const notification of readyNotifications) {
      try {
        await this.sendNotification(notification);
        
        // Remove from queue
        const index = this.notificationQueue.indexOf(notification);
        if (index > -1) {
          this.notificationQueue.splice(index, 1);
        }
      } catch (error) {
        console.error(`[ValidationNotification] Failed to send notification ${notification.id}:`, error);
        notification.status = 'failed';
        await this.updateNotification(notification);
      }
    }
  }

  /**
   * Send notification through appropriate channels
   */
  private async sendNotification(notification: ValidationNotification): Promise<void> {
    const preferences = await this.getNotificationPreferences(notification.recipient);
    if (!preferences) {
      throw new Error('Notification preferences not found');
    }

    const channels = this.getActiveChannels(preferences);
    
    for (const channel of channels) {
      try {
        await this.sendThroughChannel(notification, channel);
        
        // Record delivery
        await this.recordNotificationHistory(notification.id, channel.id, 'delivered');
      } catch (error) {
        console.error(`[ValidationNotification] Failed to send through channel ${channel.id}:`, error);
        await this.recordNotificationHistory(notification.id, channel.id, 'failed', error);
      }
    }

    notification.status = 'sent';
    notification.sentAt = new Date();
    await this.updateNotification(notification);
  }

  /**
   * Send notification through specific channel
   */
  private async sendThroughChannel(notification: ValidationNotification, channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(notification, channel);
        break;
      
      case 'webhook':
        await this.sendWebhookNotification(notification, channel);
        break;
      
      case 'sms':
        await this.sendSMSNotification(notification, channel);
        break;
      
      case 'push':
        await this.sendPushNotification(notification, channel);
        break;
      
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: ValidationNotification, channel: NotificationChannel): Promise<void> {
    const template = this.getTemplate(notification.type);
    const preferences = await this.getNotificationPreferences(notification.recipient);
    
    if (!template || !preferences) {
      throw new Error('Template or preferences not found');
    }

    const subject = this.processTemplate(template.subject, notification.data);
    const message = this.processTemplate(template.message, notification.data);

    // In real implementation, use an email service like SendGrid, AWS SES, etc.
    console.log(`[ValidationNotification] Sending email to ${preferences.email}: ${subject}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: ValidationNotification, channel: NotificationChannel): Promise<void> {
    const webhookUrl = channel.configuration.url;
    const payload = {
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        data: notification.data,
        timestamp: notification.createdAt.toISOString()
      }
    };

    // In real implementation, make HTTP request to webhook URL
    console.log(`[ValidationNotification] Sending webhook to ${webhookUrl}:`, payload);
    
    // Simulate webhook call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(notification: ValidationNotification, channel: NotificationChannel): Promise<void> {
    const phoneNumber = channel.configuration.phoneNumber;
    const message = `${notification.title}: ${notification.message}`;

    // In real implementation, use an SMS service like Twilio, AWS SNS, etc.
    console.log(`[ValidationNotification] Sending SMS to ${phoneNumber}: ${message}`);
    
    // Simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: ValidationNotification, channel: NotificationChannel): Promise<void> {
    const deviceToken = channel.configuration.deviceToken;
    const payload = {
      title: notification.title,
      body: notification.message,
      data: notification.data
    };

    // In real implementation, use a push notification service like FCM, APNS, etc.
    console.log(`[ValidationNotification] Sending push notification to ${deviceToken}:`, payload);
    
    // Simulate push notification
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Get notification preferences
   */
  private async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    // Check cache first
    if (this.preferences.has(userId)) {
      return this.preferences.get(userId)!;
    }

    // Load from database
    try {
      const preferences = await storage.getNotificationPreferences(userId);
      if (preferences) {
        this.preferences.set(userId, preferences);
        return preferences;
      }
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
    }

    return null;
  }

  /**
   * Get active channels for user
   */
  private getActiveChannels(preferences: NotificationPreferences): NotificationChannel[] {
    const activeChannels: NotificationChannel[] = [];

    for (const [channelId, channel] of this.channels) {
      if (channel.isActive && preferences.channels[channel.type]) {
        activeChannels.push(channel);
      }
    }

    return activeChannels;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: preferences.quietHours.timezone 
    });

    const startTime = preferences.quietHours.start;
    const endTime = preferences.quietHours.end;

    // Handle overnight quiet hours (e.g., 22:00 to 06:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  /**
   * Get next available time after quiet hours
   */
  private getNextAvailableTime(preferences: NotificationPreferences): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Set to end of quiet hours tomorrow
    const [hours, minutes] = preferences.quietHours.end.split(':');
    tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    return tomorrow;
  }

  /**
   * Get notification template
   */
  private getTemplate(type: ValidationNotification['type']): NotificationTemplate | null {
    for (const template of this.templates.values()) {
      if (template.type === type && template.isActive) {
        return template;
      }
    }
    return null;
  }

  /**
   * Process template with data
   */
  private processTemplate(template: string, data: any): string {
    let processed = template;
    
    for (const [key, value] of Object.entries(data || {})) {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return processed;
  }

  /**
   * Record notification history
   */
  private async recordNotificationHistory(
    notificationId: string,
    channelId: string,
    status: NotificationHistory['status'],
    response?: any
  ): Promise<void> {
    const history: NotificationHistory = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notificationId,
      channel: channelId,
      status,
      response,
      timestamp: new Date()
    };

    try {
      await storage.saveNotificationHistory(history);
    } catch (error) {
      console.error('Failed to save notification history:', error);
    }
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'validation_completed_template',
        name: 'Validation Completed',
        type: 'validation_completed',
        subject: 'Validation Completed - {{totalResources}} Resources Processed',
        message: 'Validation has completed successfully.\n\nTotal Resources: {{totalResources}}\nValid Resources: {{validResources}}\nError Resources: {{errorResources}}\nDuration: {{duration}}ms\n\nValidation Run ID: {{validationRunId}}',
        variables: ['totalResources', 'validResources', 'errorResources', 'duration', 'validationRunId'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'validation_failed_template',
        name: 'Validation Failed',
        type: 'validation_failed',
        subject: 'Validation Failed - {{error}}',
        message: 'Validation has failed with the following error:\n\n{{error}}\n\nValidation Run ID: {{validationRunId}}\nTimestamp: {{timestamp}}',
        variables: ['error', 'validationRunId', 'timestamp'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'quality_alert_template',
        name: 'Quality Alert',
        type: 'quality_alert',
        subject: 'Quality Alert - {{resourceType}} Score: {{qualityScore}}%',
        message: 'Quality alert triggered for {{resourceType}}.\n\nQuality Score: {{qualityScore}}%\nThreshold: {{threshold}}%\n\nIssues:\n{{issues}}',
        variables: ['resourceType', 'qualityScore', 'threshold', 'issues'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'performance_alert_template',
        name: 'Performance Alert',
        type: 'performance_alert',
        subject: 'Performance Alert - {{metric}}: {{value}}',
        message: 'Performance alert triggered.\n\nMetric: {{metric}}\nValue: {{value}}\nThreshold: {{threshold}}\nTrend: {{trend}}',
        variables: ['metric', 'value', 'threshold', 'trend'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'schedule_reminder_template',
        name: 'Schedule Reminder',
        type: 'schedule_reminder',
        subject: 'Schedule Reminder - {{scheduleName}}',
        message: 'Validation schedule reminder.\n\nSchedule: {{scheduleName}}\nNext Run: {{nextRun}}\n\n{{description}}',
        variables: ['scheduleName', 'nextRun', 'description'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Initialize default channels
   */
  private initializeDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'email_channel',
        name: 'Email Channel',
        type: 'email',
        configuration: {
          smtp: {
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          }
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'webhook_channel',
        name: 'Webhook Channel',
        type: 'webhook',
        configuration: {
          url: process.env.WEBHOOK_URL,
          timeout: 5000,
          retries: 3
        },
        isActive: !!process.env.WEBHOOK_URL,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const channel of defaultChannels) {
      this.channels.set(channel.id, channel);
    }
  }

  /**
   * Store notification
   */
  private async storeNotification(notification: ValidationNotification): Promise<void> {
    try {
      await storage.saveValidationNotification(notification);
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  /**
   * Update notification
   */
  private async updateNotification(notification: ValidationNotification): Promise<void> {
    notification.updatedAt = new Date();
    try {
      await storage.updateValidationNotification(notification);
    } catch (error) {
      console.error('Failed to update notification:', error);
    }
  }

  /**
   * Get notification by ID
   */
  async getNotification(notificationId: string): Promise<ValidationNotification | null> {
    try {
      return await storage.getValidationNotification(notificationId);
    } catch (error) {
      console.error('Failed to get notification:', error);
      return null;
    }
  }

  /**
   * Get notifications for user
   */
  async getNotificationsForUser(userId: string, limit: number = 50): Promise<ValidationNotification[]> {
    try {
      return await storage.getValidationNotificationsForUser(userId, limit);
    } catch (error) {
      console.error('Failed to get notifications for user:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const notification = await this.getNotification(notificationId);
      if (notification) {
        notification.status = 'read';
        notification.readAt = new Date();
        await this.updateNotification(notification);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStatistics(): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    try {
      return await storage.getValidationNotificationStatistics();
    } catch (error) {
      console.error('Failed to get notification statistics:', error);
      return {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        byType: {},
        bySeverity: {}
      };
    }
  }
}
