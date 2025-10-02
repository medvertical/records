/**
 * Validation Resource List Badges Service
 * 
 * This service provides real-time updates to resource list validation badges
 * when validation settings change, enabling immediate updates to resource list views.
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings';
import { getValidationResultFilteringService } from './validation-result-filtering-service';
import { getValidationScoreCalculationService } from './validation-score-calculation-service';
import { getValidationRealtimeNotificationService } from './validation-realtime-notification-service';
import { FeatureFlags } from '../../../config/feature-flags.js';
import type { ValidationSettings } from '@shared/validation-settings-simplified';

export interface ResourceValidationBadge {
  resourceId: string;
  resourceType: string;
  isValid: boolean;
  score: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  enabledAspects: string[];
  disabledAspects: string[];
  lastValidated: Date;
  badgeColor: 'green' | 'yellow' | 'red' | 'gray';
  badgeText: string;
  tooltip: string;
}

export interface ResourceListBadgeUpdate {
  type: 'badgeUpdated' | 'badgesRefreshed' | 'aspectChanged' | 'scoreRecalculated';
  timestamp: Date;
  data: {
    resourceIds?: string[];
    changedAspects?: string[];
    reason: string;
    badges?: ResourceValidationBadge[];
  };
  affectedViews: string[];
}

export interface ResourceListBadgeSummary {
  totalResources: number;
  validResources: number;
  invalidResources: number;
  averageScore: number;
  badgeDistribution: {
    green: number;
    yellow: number;
    red: number;
    gray: number;
  };
  aspectBreakdown: {
    [aspect: string]: {
      enabled: boolean;
      affectedResources: number;
      averageScore: number;
    };
  };
}

export class ValidationResourceListBadgesService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private filteringService: ReturnType<typeof getValidationResultFilteringService>;
  private scoreService: ReturnType<typeof getValidationScoreCalculationService>;
  private notificationService: ReturnType<typeof getValidationRealtimeNotificationService>;
  private currentBadges: Map<string, ResourceValidationBadge> = new Map();
  private isInitialized = false;
  private updateHistory: ResourceListBadgeUpdate[] = [];
  private maxHistorySize = 100;

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

      // Load initial badges
      await this.loadResourceListBadges();
      this.isInitialized = true;
      console.log('[ValidationResourceListBadges] Service initialized');
    } catch (error) {
      console.error('[ValidationResourceListBadges] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up listeners for service changes
   */
  private setupServiceListeners(): void {
    // Listen to notification service for settings changes
    this.notificationService.on('settingsChanged', (notification) => {
      console.log('[ValidationResourceListBadges] Settings changed, updating badges');
      this.handleSettingsChange(notification).catch(error => {
        console.error('[ValidationResourceListBadges] Failed to handle settings change:', error);
      });
    });

    this.notificationService.on('aspectToggled', (notification) => {
      console.log('[ValidationResourceListBadges] Aspect toggled, updating badges');
      this.handleAspectToggle(notification).catch(error => {
        console.error('[ValidationResourceListBadges] Failed to handle aspect toggle:', error);
      });
    });

    this.notificationService.on('scoreUpdated', (notification) => {
      console.log('[ValidationResourceListBadges] Score updated, updating badges');
      this.handleScoreUpdate(notification).catch(error => {
        console.error('[ValidationResourceListBadges] Failed to handle score update:', error);
      });
    });

    this.notificationService.on('filterUpdated', (notification) => {
      console.log('[ValidationResourceListBadges] Filter updated, updating badges');
      this.handleFilterUpdate(notification).catch(error => {
        console.error('[ValidationResourceListBadges] Failed to handle filter update:', error);
      });
    });
  }

  /**
   * Load resource list badges
   */
  private async loadResourceListBadges(): Promise<void> {
    try {
      if (!FeatureFlags.DEMO_MOCKS) {
        // Production: implement real database query
        // For now, return empty badges
        this.currentBadges.clear();
        return;
      }
      
      // Demo mode: create mock data
      const mockBadges = await this.generateMockBadges();
      
      // Clear current badges and add new ones
      this.currentBadges.clear();
      mockBadges.forEach(badge => {
        this.currentBadges.set(badge.resourceId, badge);
      });
      
      console.log('[ValidationResourceListBadges] Resource list badges loaded');
    } catch (error) {
      console.error('[ValidationResourceListBadges] Failed to load resource list badges:', error);
      throw error;
    }
  }

  /**
   * Generate mock badges for testing
   */
  private async generateMockBadges(): Promise<ResourceValidationBadge[]> {
    const currentSettings = this.settingsService.getCurrentSettings();
    const enabledAspects = this.notificationService.getEnabledAspects();
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const disabledAspects = allAspects.filter(aspect => !enabledAspects.includes(aspect));

    // Generate mock badges for 50 resources
    const badges: ResourceValidationBadge[] = [];
    const resourceTypes = ['Patient', 'Observation', 'DiagnosticReport', 'Medication', 'Encounter'];

    for (let i = 1; i <= 50; i++) {
      const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      const resourceId = `${resourceType.toLowerCase()}-${i}`;
      
      // Generate random validation data
      const isValid = Math.random() > 0.3; // 70% valid
      const score = Math.floor(Math.random() * 100);
      const errorCount = isValid ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 10) + 1;
      const warningCount = Math.floor(Math.random() * 5);
      const informationCount = Math.floor(Math.random() * 3);

      // Determine badge color and text
      const { badgeColor, badgeText, tooltip } = this.calculateBadgeProperties(
        isValid, score, errorCount, warningCount, informationCount, enabledAspects, disabledAspects
      );

      badges.push({
        resourceId,
        resourceType,
        isValid,
        score,
        errorCount,
        warningCount,
        informationCount,
        enabledAspects: [...enabledAspects],
        disabledAspects: [...disabledAspects],
        lastValidated: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Random time in last 24 hours
        badgeColor,
        badgeText,
        tooltip
      });
    }

    return badges;
  }

  /**
   * Calculate badge properties based on validation data
   */
  private calculateBadgeProperties(
    isValid: boolean,
    score: number,
    errorCount: number,
    warningCount: number,
    informationCount: number,
    enabledAspects: string[],
    disabledAspects: string[]
  ): { badgeColor: 'green' | 'yellow' | 'red' | 'gray'; badgeText: string; tooltip: string } {
    let badgeColor: 'green' | 'yellow' | 'red' | 'gray';
    let badgeText: string;
    let tooltip: string;

    if (enabledAspects.length === 0) {
      // No aspects enabled
      badgeColor = 'gray';
      badgeText = 'N/A';
      tooltip = 'No validation aspects enabled';
    } else if (errorCount > 0) {
      // Has errors
      badgeColor = 'red';
      badgeText = `${errorCount}E`;
      tooltip = `${errorCount} error(s), ${warningCount} warning(s), ${informationCount} info(s)`;
    } else if (warningCount > 0) {
      // Has warnings but no errors
      badgeColor = 'yellow';
      badgeText = `${warningCount}W`;
      tooltip = `${warningCount} warning(s), ${informationCount} info(s)`;
    } else if (score >= 90) {
      // High score
      badgeColor = 'green';
      badgeText = `${score}%`;
      tooltip = `Score: ${score}%, ${informationCount} info(s)`;
    } else if (score >= 70) {
      // Medium score
      badgeColor = 'yellow';
      badgeText = `${score}%`;
      tooltip = `Score: ${score}%, ${informationCount} info(s)`;
    } else {
      // Low score
      badgeColor = 'red';
      badgeText = `${score}%`;
      tooltip = `Score: ${score}%, ${informationCount} info(s)`;
    }

    // Add aspect information to tooltip
    if (enabledAspects.length > 0) {
      tooltip += `\nEnabled aspects: ${enabledAspects.join(', ')}`;
    }
    if (disabledAspects.length > 0) {
      tooltip += `\nDisabled aspects: ${disabledAspects.join(', ')}`;
    }

    return { badgeColor, badgeText, tooltip };
  }

  /**
   * Handle settings change
   */
  private async handleSettingsChange(notification: any): Promise<void> {
    try {
      // Reload badges with new settings
      await this.loadResourceListBadges();

      // Emit update event
      this.emitBadgeUpdate({
        type: 'badgesRefreshed',
        timestamp: new Date(),
        data: {
          reason: 'settingsChanged',
          changedAspects: notification.data.changedAspects,
          badges: Array.from(this.currentBadges.values())
        },
        affectedViews: ['resourceList']
      });

    } catch (error) {
      console.error('[ValidationResourceListBadges] Error handling settings change:', error);
    }
  }

  /**
   * Handle aspect toggle
   */
  private async handleAspectToggle(notification: any): Promise<void> {
    try {
      const aspect = notification.data.aspect;
      const enabled = notification.data.enabled;

      // Update all badges for the toggled aspect
      const updatedBadges: ResourceValidationBadge[] = [];
      
      for (const [resourceId, badge] of this.currentBadges.entries()) {
        // Update enabled/disabled aspects
        if (enabled) {
          if (!badge.enabledAspects.includes(aspect)) {
            badge.enabledAspects.push(aspect);
          }
          badge.disabledAspects = badge.disabledAspects.filter(a => a !== aspect);
        } else {
          badge.enabledAspects = badge.enabledAspects.filter(a => a !== aspect);
          if (!badge.disabledAspects.includes(aspect)) {
            badge.disabledAspects.push(aspect);
          }
        }

        // Recalculate badge properties
        const { badgeColor, badgeText, tooltip } = this.calculateBadgeProperties(
          badge.isValid,
          badge.score,
          badge.errorCount,
          badge.warningCount,
          badge.informationCount,
          badge.enabledAspects,
          badge.disabledAspects
        );

        badge.badgeColor = badgeColor;
        badge.badgeText = badgeText;
        badge.tooltip = tooltip;

        updatedBadges.push(badge);
      }

      // Emit update event
      this.emitBadgeUpdate({
        type: 'aspectChanged',
        timestamp: new Date(),
        data: {
          aspect,
          enabled,
          reason: 'aspectToggled',
          badges: updatedBadges
        },
        affectedViews: ['resourceList']
      });

    } catch (error) {
      console.error('[ValidationResourceListBadges] Error handling aspect toggle:', error);
    }
  }

  /**
   * Handle score update
   */
  private async handleScoreUpdate(notification: any): Promise<void> {
    try {
      // Recalculate scores for all badges
      const updatedBadges: ResourceValidationBadge[] = [];
      
      for (const [resourceId, badge] of this.currentBadges.entries()) {
        // Recalculate score based on enabled aspects
        const newScore = this.recalculateScore(badge);
        badge.score = newScore;

        // Recalculate badge properties
        const { badgeColor, badgeText, tooltip } = this.calculateBadgeProperties(
          badge.isValid,
          badge.score,
          badge.errorCount,
          badge.warningCount,
          badge.informationCount,
          badge.enabledAspects,
          badge.disabledAspects
        );

        badge.badgeColor = badgeColor;
        badge.badgeText = badgeText;
        badge.tooltip = tooltip;

        updatedBadges.push(badge);
      }

      // Emit update event
      this.emitBadgeUpdate({
        type: 'scoreRecalculated',
        timestamp: new Date(),
        data: {
          reason: notification.data.reason,
          badges: updatedBadges
        },
        affectedViews: ['resourceList']
      });

    } catch (error) {
      console.error('[ValidationResourceListBadges] Error handling score update:', error);
    }
  }

  /**
   * Handle filter update
   */
  private async handleFilterUpdate(notification: any): Promise<void> {
    try {
      // Update badges based on new filter
      const updatedBadges: ResourceValidationBadge[] = [];
      
      for (const [resourceId, badge] of this.currentBadges.entries()) {
        // Recalculate badge properties based on new filter
        const { badgeColor, badgeText, tooltip } = this.calculateBadgeProperties(
          badge.isValid,
          badge.score,
          badge.errorCount,
          badge.warningCount,
          badge.informationCount,
          badge.enabledAspects,
          badge.disabledAspects
        );

        badge.badgeColor = badgeColor;
        badge.badgeText = badgeText;
        badge.tooltip = tooltip;

        updatedBadges.push(badge);
      }

      // Emit update event
      this.emitBadgeUpdate({
        type: 'badgesRefreshed',
        timestamp: new Date(),
        data: {
          reason: notification.data.reason,
          badges: updatedBadges
        },
        affectedViews: ['resourceList']
      });

    } catch (error) {
      console.error('[ValidationResourceListBadges] Error handling filter update:', error);
    }
  }

  /**
   * Recalculate score based on enabled aspects
   */
  private recalculateScore(badge: ResourceValidationBadge): number {
    if (badge.enabledAspects.length === 0) {
      return 0;
    }

    // Simple score calculation based on enabled aspects
    // In a real implementation, this would use the score calculation service
    const baseScore = badge.isValid ? 100 : 0;
    const aspectPenalty = badge.errorCount * 10 + badge.warningCount * 5;
    const enabledAspectBonus = badge.enabledAspects.length * 5;

    return Math.max(0, Math.min(100, baseScore - aspectPenalty + enabledAspectBonus));
  }

  /**
   * Emit badge update event
   */
  private emitBadgeUpdate(event: ResourceListBadgeUpdate): void {
    // Add to history
    this.updateHistory.push(event);
    if (this.updateHistory.length > this.maxHistorySize) {
      this.updateHistory.shift();
    }

    // Emit to listeners
    this.emit('badgeUpdate', event);
    this.emit(event.type, event);

    console.log(`[ValidationResourceListBadges] Emitted ${event.type} event:`, {
      affectedViews: event.affectedViews,
      timestamp: event.timestamp
    });
  }

  /**
   * Get current badges
   */
  getCurrentBadges(): ResourceValidationBadge[] {
    return Array.from(this.currentBadges.values());
  }

  /**
   * Get badge for specific resource
   */
  getBadgeForResource(resourceId: string): ResourceValidationBadge | null {
    return this.currentBadges.get(resourceId) || null;
  }

  /**
   * Get badge summary
   */
  getBadgeSummary(): ResourceListBadgeSummary {
    const badges = this.getCurrentBadges();
    const totalResources = badges.length;
    const validResources = badges.filter(b => b.isValid).length;
    const invalidResources = totalResources - validResources;
    const averageScore = totalResources > 0 
      ? Math.round(badges.reduce((sum, b) => sum + b.score, 0) / totalResources)
      : 0;

    // Calculate badge distribution
    const badgeDistribution = {
      green: badges.filter(b => b.badgeColor === 'green').length,
      yellow: badges.filter(b => b.badgeColor === 'yellow').length,
      red: badges.filter(b => b.badgeColor === 'red').length,
      gray: badges.filter(b => b.badgeColor === 'gray').length
    };

    // Calculate aspect breakdown
    const aspectBreakdown: any = {};
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    
    allAspects.forEach(aspect => {
      const aspectBadges = badges.filter(b => b.enabledAspects.includes(aspect));
      aspectBreakdown[aspect] = {
        enabled: aspectBadges.length > 0,
        affectedResources: aspectBadges.length,
        averageScore: aspectBadges.length > 0 
          ? Math.round(aspectBadges.reduce((sum, b) => sum + b.score, 0) / aspectBadges.length)
          : 0
      };
    });

    return {
      totalResources,
      validResources,
      invalidResources,
      averageScore,
      badgeDistribution,
      aspectBreakdown
    };
  }

  /**
   * Get update history
   */
  getUpdateHistory(limit?: number): ResourceListBadgeUpdate[] {
    if (limit) {
      return this.updateHistory.slice(-limit);
    }
    return [...this.updateHistory];
  }

  /**
   * Subscribe to badge updates
   */
  subscribeToUpdates(callback: (event: ResourceListBadgeUpdate) => void): () => void {
    this.on('badgeUpdate', callback);
    return () => {
      this.off('badgeUpdate', callback);
    };
  }

  /**
   * Subscribe to specific update types
   */
  subscribeToUpdateType(type: ResourceListBadgeUpdate['type'], callback: (event: ResourceListBadgeUpdate) => void): () => void {
    this.on(type, callback);
    return () => {
      this.off(type, callback);
    };
  }

  /**
   * Force refresh badges
   */
  async refreshBadges(): Promise<ResourceValidationBadge[]> {
    await this.loadResourceListBadges();
    
    this.emitBadgeUpdate({
      type: 'badgesRefreshed',
      timestamp: new Date(),
      data: {
        reason: 'manualRefresh',
        badges: Array.from(this.currentBadges.values())
      },
      affectedViews: ['resourceList']
    });

    return Array.from(this.currentBadges.values());
  }
}

// Singleton instance
let validationResourceListBadgesServiceInstance: ValidationResourceListBadgesService | null = null;

export function getValidationResourceListBadgesService(): ValidationResourceListBadgesService {
  if (!validationResourceListBadgesServiceInstance) {
    validationResourceListBadgesServiceInstance = new ValidationResourceListBadgesService();
  }
  return validationResourceListBadgesServiceInstance;
}
