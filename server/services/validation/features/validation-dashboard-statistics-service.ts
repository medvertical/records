/**
 * Validation Dashboard Statistics Service
 * 
 * This service provides real-time dashboard statistics that update when validation
 * settings change, enabling immediate updates to dashboard views.
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings';
import { getValidationResultFilteringService } from './validation-result-filtering-service';
import { getValidationScoreCalculationService } from './validation-score-calculation-service';
import { getValidationRealtimeNotificationService } from './validation-realtime-notification-service';
import { FeatureFlags } from '../../../config/feature-flags.js';
import type { ValidationSettings } from '@shared/validation-settings';

export interface DashboardStatistics {
  overview: {
    totalResources: number;
    validResources: number;
    invalidResources: number;
    validationRate: number;
    averageScore: number;
    lastUpdated: Date;
  };
  aspectBreakdown: {
    [aspect: string]: {
      total: number;
      valid: number;
      invalid: number;
      errorCount: number;
      warningCount: number;
      informationCount: number;
      averageScore: number;
      enabled: boolean;
    };
  };
  scoreDistribution: {
    excellent: number; // 90-100
    good: number;      // 70-89
    fair: number;      // 50-69
    poor: number;      // 0-49
  };
  trends: {
    validationRate: number;
    scoreTrend: number;
    errorTrend: number;
    warningTrend: number;
  };
  recentActivity: {
    timestamp: Date;
    type: string;
    description: string;
    impact: number;
  }[];
}

export interface DashboardUpdateEvent {
  type: 'statisticsUpdated' | 'aspectChanged' | 'scoreRecalculated' | 'filterUpdated';
  timestamp: Date;
  data: any;
  affectedViews: string[];
}

export class ValidationDashboardStatisticsService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private filteringService: ReturnType<typeof getValidationResultFilteringService>;
  private scoreService: ReturnType<typeof getValidationScoreCalculationService>;
  private notificationService: ReturnType<typeof getValidationRealtimeNotificationService>;
  private currentStatistics: DashboardStatistics | null = null;
  private isInitialized = false;
  private updateHistory: DashboardUpdateEvent[] = [];
  private maxHistorySize = 50;

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
    this.filteringService = getValidationResultFilteringService();
    this.scoreService = getValidationScoreCalculationService();
    this.notificationService = getValidationRealtimeNotificationService();
    this.setupServiceListeners();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize all dependent services
      await Promise.all([
        this.settingsService.initialize(),
        this.filteringService.initialize(),
        this.scoreService.initialize(),
        this.notificationService.initialize()
      ]);

      // Load initial statistics
      await this.loadDashboardStatistics();
      this.isInitialized = true;
      console.log('[ValidationDashboardStatistics] Service initialized');
    } catch (error) {
      console.error('[ValidationDashboardStatistics] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up listeners for service changes
   */
  private setupServiceListeners(): void {
    // Listen to notification service for settings changes
    this.notificationService.on('settingsChanged', (notification) => {
      console.log('[ValidationDashboardStatistics] Settings changed, updating statistics');
      this.handleSettingsChange(notification).catch(error => {
        console.error('[ValidationDashboardStatistics] Failed to handle settings change:', error);
      });
    });

    this.notificationService.on('aspectToggled', (notification) => {
      console.log('[ValidationDashboardStatistics] Aspect toggled, updating statistics');
      this.handleAspectToggle(notification).catch(error => {
        console.error('[ValidationDashboardStatistics] Failed to handle aspect toggle:', error);
      });
    });

    this.notificationService.on('scoreUpdated', (notification) => {
      console.log('[ValidationDashboardStatistics] Score updated, updating statistics');
      this.handleScoreUpdate(notification).catch(error => {
        console.error('[ValidationDashboardStatistics] Failed to handle score update:', error);
      });
    });

    this.notificationService.on('filterUpdated', (notification) => {
      console.log('[ValidationDashboardStatistics] Filter updated, updating statistics');
      this.handleFilterUpdate(notification).catch(error => {
        console.error('[ValidationDashboardStatistics] Failed to handle filter update:', error);
      });
    });
  }

  /**
   * Load dashboard statistics
   */
  private async loadDashboardStatistics(): Promise<void> {
    try {
      if (!FeatureFlags.DEMO_MOCKS) {
        // Production: implement real database query
        // For now, return empty statistics
        this.currentStatistics = {
          overview: {
            totalResources: 0,
            validResources: 0,
            invalidResources: 0,
            validationRate: 0,
            averageScore: 0
          },
          aspects: {},
          trends: [],
          recommendations: []
        };
        return;
      }
      
      // Demo mode: create mock data
      const mockStatistics = await this.generateMockStatistics();
      this.currentStatistics = mockStatistics;
      
      console.log('[ValidationDashboardStatistics] Dashboard statistics loaded');
    } catch (error) {
      console.error('[ValidationDashboardStatistics] Failed to load dashboard statistics:', error);
      throw error;
    }
  }

  /**
   * Generate mock statistics for testing
   */
  private async generateMockStatistics(): Promise<DashboardStatistics> {
    const currentSettings = this.settingsService.getCurrentSettings();
    const enabledAspects = this.notificationService.getEnabledAspects();

    // Generate mock data based on current settings
    const totalResources = 1000;
    const validResources = Math.floor(totalResources * 0.75);
    const invalidResources = totalResources - validResources;
    const validationRate = (validResources / totalResources) * 100;
    const averageScore = 85;

    // Generate aspect breakdown
    const aspectBreakdown: any = {};
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];

    allAspects.forEach(aspect => {
      const isEnabled = enabledAspects.includes(aspect);
      const aspectTotal = isEnabled ? totalResources : 0;
      const aspectValid = isEnabled ? Math.floor(aspectTotal * 0.8) : 0;
      const aspectInvalid = aspectTotal - aspectValid;

      aspectBreakdown[aspect] = {
        total: aspectTotal,
        valid: aspectValid,
        invalid: aspectInvalid,
        errorCount: isEnabled ? Math.floor(aspectInvalid * 0.6) : 0,
        warningCount: isEnabled ? Math.floor(aspectInvalid * 0.4) : 0,
        informationCount: isEnabled ? Math.floor(aspectTotal * 0.1) : 0,
        averageScore: isEnabled ? Math.floor(85 + Math.random() * 15) : 0,
        enabled: isEnabled
      };
    });

    // Generate score distribution
    const scoreDistribution = {
      excellent: Math.floor(totalResources * 0.3),
      good: Math.floor(totalResources * 0.4),
      fair: Math.floor(totalResources * 0.2),
      poor: Math.floor(totalResources * 0.1)
    };

    // Generate trends (mock data)
    const trends = {
      validationRate: 2.5, // 2.5% improvement
      scoreTrend: 1.2, // 1.2 point improvement
      errorTrend: -5.0, // 5% reduction in errors
      warningTrend: -2.0 // 2% reduction in warnings
    };

    // Generate recent activity
    const recentActivity = [
      {
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        type: 'validation_completed',
        description: 'Bulk validation completed for 150 resources',
        impact: 150
      },
      {
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        type: 'settings_changed',
        description: 'Profile validation aspect enabled',
        impact: 1000
      },
      {
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        type: 'validation_started',
        description: 'Bulk validation started for 200 resources',
        impact: 200
      }
    ];

    return {
      overview: {
        totalResources,
        validResources,
        invalidResources,
        validationRate,
        averageScore,
        lastUpdated: new Date()
      },
      aspectBreakdown,
      scoreDistribution,
      trends,
      recentActivity
    };
  }

  /**
   * Handle settings change
   */
  private async handleSettingsChange(notification: any): Promise<void> {
    try {
      // Reload statistics with new settings
      await this.loadDashboardStatistics();

      // Emit update event
      this.emitUpdateEvent({
        type: 'statisticsUpdated',
        timestamp: new Date(),
        data: {
          reason: 'settingsChanged',
          changedAspects: notification.data.changedAspects,
          statistics: this.currentStatistics
        },
        affectedViews: ['dashboard']
      });

    } catch (error) {
      console.error('[ValidationDashboardStatistics] Error handling settings change:', error);
    }
  }

  /**
   * Handle aspect toggle
   */
  private async handleAspectToggle(notification: any): Promise<void> {
    try {
      // Update statistics for the toggled aspect
      if (this.currentStatistics) {
        const aspect = notification.data.aspect;
        const enabled = notification.data.enabled;

        // Update aspect breakdown
        if (this.currentStatistics.aspectBreakdown[aspect]) {
          this.currentStatistics.aspectBreakdown[aspect].enabled = enabled;
          
          if (enabled) {
            // Recalculate aspect statistics
            const totalResources = this.currentStatistics.overview.totalResources;
            this.currentStatistics.aspectBreakdown[aspect].total = totalResources;
            this.currentStatistics.aspectBreakdown[aspect].valid = Math.floor(totalResources * 0.8);
            this.currentStatistics.aspectBreakdown[aspect].invalid = totalResources - this.currentStatistics.aspectBreakdown[aspect].valid;
            this.currentStatistics.aspectBreakdown[aspect].errorCount = Math.floor(this.currentStatistics.aspectBreakdown[aspect].invalid * 0.6);
            this.currentStatistics.aspectBreakdown[aspect].warningCount = Math.floor(this.currentStatistics.aspectBreakdown[aspect].invalid * 0.4);
            this.currentStatistics.aspectBreakdown[aspect].informationCount = Math.floor(totalResources * 0.1);
            this.currentStatistics.aspectBreakdown[aspect].averageScore = Math.floor(85 + Math.random() * 15);
          } else {
            // Clear aspect statistics
            this.currentStatistics.aspectBreakdown[aspect].total = 0;
            this.currentStatistics.aspectBreakdown[aspect].valid = 0;
            this.currentStatistics.aspectBreakdown[aspect].invalid = 0;
            this.currentStatistics.aspectBreakdown[aspect].errorCount = 0;
            this.currentStatistics.aspectBreakdown[aspect].warningCount = 0;
            this.currentStatistics.aspectBreakdown[aspect].informationCount = 0;
            this.currentStatistics.aspectBreakdown[aspect].averageScore = 0;
          }
        }

        // Update overview statistics
        this.recalculateOverviewStatistics();

        // Update last updated timestamp
        this.currentStatistics.overview.lastUpdated = new Date();
      }

      // Emit update event
      this.emitUpdateEvent({
        type: 'aspectChanged',
        timestamp: new Date(),
        data: {
          aspect: notification.data.aspect,
          enabled: notification.data.enabled,
          statistics: this.currentStatistics
        },
        affectedViews: ['dashboard']
      });

    } catch (error) {
      console.error('[ValidationDashboardStatistics] Error handling aspect toggle:', error);
    }
  }

  /**
   * Handle score update
   */
  private async handleScoreUpdate(notification: any): Promise<void> {
    try {
      // Recalculate scores
      if (this.currentStatistics) {
        this.recalculateScoreStatistics();
        this.currentStatistics.overview.lastUpdated = new Date();
      }

      // Emit update event
      this.emitUpdateEvent({
        type: 'scoreRecalculated',
        timestamp: new Date(),
        data: {
          reason: notification.data.reason,
          statistics: this.currentStatistics
        },
        affectedViews: ['dashboard']
      });

    } catch (error) {
      console.error('[ValidationDashboardStatistics] Error handling score update:', error);
    }
  }

  /**
   * Handle filter update
   */
  private async handleFilterUpdate(notification: any): Promise<void> {
    try {
      // Update statistics based on new filter
      if (this.currentStatistics) {
        this.recalculateFilteredStatistics();
        this.currentStatistics.overview.lastUpdated = new Date();
      }

      // Emit update event
      this.emitUpdateEvent({
        type: 'filterUpdated',
        timestamp: new Date(),
        data: {
          reason: notification.data.reason,
          statistics: this.currentStatistics
        },
        affectedViews: ['dashboard']
      });

    } catch (error) {
      console.error('[ValidationDashboardStatistics] Error handling filter update:', error);
    }
  }

  /**
   * Recalculate overview statistics
   */
  private recalculateOverviewStatistics(): void {
    if (!this.currentStatistics) return;

    const enabledAspects = this.notificationService.getEnabledAspects();
    let totalValid = 0;
    let totalInvalid = 0;
    let totalScore = 0;
    let aspectCount = 0;

    enabledAspects.forEach(aspect => {
      const aspectData = this.currentStatistics!.aspectBreakdown[aspect];
      if (aspectData && aspectData.enabled) {
        totalValid += aspectData.valid;
        totalInvalid += aspectData.invalid;
        totalScore += aspectData.averageScore;
        aspectCount++;
      }
    });

    this.currentStatistics.overview.validResources = totalValid;
    this.currentStatistics.overview.invalidResources = totalInvalid;
    this.currentStatistics.overview.validationRate = totalValid > 0 ? (totalValid / (totalValid + totalInvalid)) * 100 : 0;
    this.currentStatistics.overview.averageScore = aspectCount > 0 ? Math.round(totalScore / aspectCount) : 0;
  }

  /**
   * Recalculate score statistics
   */
  private recalculateScoreStatistics(): void {
    if (!this.currentStatistics) return;

    // Recalculate score distribution based on current scores
    const totalResources = this.currentStatistics.overview.totalResources;
    const averageScore = this.currentStatistics.overview.averageScore;

    // Adjust distribution based on average score
    this.currentStatistics.scoreDistribution = {
      excellent: Math.floor(totalResources * (averageScore >= 90 ? 0.4 : 0.3)),
      good: Math.floor(totalResources * (averageScore >= 70 ? 0.4 : 0.3)),
      fair: Math.floor(totalResources * (averageScore >= 50 ? 0.2 : 0.3)),
      poor: Math.floor(totalResources * (averageScore < 50 ? 0.3 : 0.1))
    };
  }

  /**
   * Recalculate filtered statistics
   */
  private recalculateFilteredStatistics(): void {
    if (!this.currentStatistics) return;

    // Recalculate statistics based on current filter
    this.recalculateOverviewStatistics();
    this.recalculateScoreStatistics();
  }

  /**
   * Emit update event
   */
  private emitUpdateEvent(event: DashboardUpdateEvent): void {
    // Add to history
    this.updateHistory.push(event);
    if (this.updateHistory.length > this.maxHistorySize) {
      this.updateHistory.shift();
    }

    // Emit to listeners
    this.emit('dashboardUpdate', event);
    this.emit(event.type, event);

    console.log(`[ValidationDashboardStatistics] Emitted ${event.type} event:`, {
      affectedViews: event.affectedViews,
      timestamp: event.timestamp
    });
  }

  /**
   * Get current dashboard statistics
   */
  getCurrentStatistics(): DashboardStatistics | null {
    return this.currentStatistics;
  }

  /**
   * Get update history
   */
  getUpdateHistory(limit?: number): DashboardUpdateEvent[] {
    if (limit) {
      return this.updateHistory.slice(-limit);
    }
    return [...this.updateHistory];
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribeToUpdates(callback: (event: DashboardUpdateEvent) => void): () => void {
    this.on('dashboardUpdate', callback);
    return () => {
      this.off('dashboardUpdate', callback);
    };
  }

  /**
   * Subscribe to specific update types
   */
  subscribeToUpdateType(type: DashboardUpdateEvent['type'], callback: (event: DashboardUpdateEvent) => void): () => void {
    this.on(type, callback);
    return () => {
      this.off(type, callback);
    };
  }

  /**
   * Force refresh statistics
   */
  async refreshStatistics(): Promise<DashboardStatistics> {
    await this.loadDashboardStatistics();
    
    this.emitUpdateEvent({
      type: 'statisticsUpdated',
      timestamp: new Date(),
      data: {
        reason: 'manualRefresh',
        statistics: this.currentStatistics
      },
      affectedViews: ['dashboard']
    });

    return this.currentStatistics!;
  }
}

// Singleton instance
let validationDashboardStatisticsServiceInstance: ValidationDashboardStatisticsService | null = null;

export function getValidationDashboardStatisticsService(): ValidationDashboardStatisticsService {
  if (!validationDashboardStatisticsServiceInstance) {
    validationDashboardStatisticsServiceInstance = new ValidationDashboardStatisticsService();
  }
  return validationDashboardStatisticsServiceInstance;
}
