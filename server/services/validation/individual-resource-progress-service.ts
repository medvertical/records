/**
 * Individual Resource Progress Service
 * 
 * This service tracks validation progress for individual resources,
 * providing detailed progress information, timing, and status updates.
 */

import { EventEmitter } from 'events';
import { storage } from '../../storage';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface IndividualResourceProgress {
  resourceId: string;
  resourceType: string;
  resourceUrl?: string;
  status: ResourceValidationStatus;
  progress: number; // 0-100 percentage
  currentAspect?: ValidationAspect;
  completedAspects: ValidationAspect[];
  failedAspects: ValidationAspect[];
  startTime: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  lastError?: string;
  retryAttempts: number;
  maxRetryAttempts: number;
  context: {
    requestedBy: string;
    requestId: string;
    batchId?: string;
    validationSettingsId?: string;
  };
  performance: {
    totalTimeMs: number;
    aspectTimes: Record<ValidationAspect, number>;
    averageTimePerAspect: number;
  };
  metadata: {
    resourceSize?: number;
    complexity?: 'low' | 'medium' | 'high';
    profileCount?: number;
    terminologyServer?: string;
  };
}

export interface ResourceProgressUpdate {
  resourceId: string;
  status: ResourceValidationStatus;
  progress: number;
  currentAspect?: ValidationAspect;
  completedAspects?: ValidationAspect[];
  failedAspects?: ValidationAspect[];
  errorCount?: number;
  warningCount?: number;
  infoCount?: number;
  lastError?: string;
  retryAttempts?: number;
  performance?: Partial<IndividualResourceProgress['performance']>;
  metadata?: Partial<IndividualResourceProgress['metadata']>;
}

export enum ResourceValidationStatus {
  PENDING = 'pending',
  INITIALIZING = 'initializing',
  VALIDATING = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

export enum ValidationAspect {
  STRUCTURAL = 'structural',
  PROFILE = 'profile',
  TERMINOLOGY = 'terminology',
  REFERENCE = 'reference',
  BUSINESS_RULE = 'businessRule',
  METADATA = 'metadata'
}

export interface ResourceProgressStats {
  totalResources: number;
  pendingResources: number;
  validatingResources: number;
  completedResources: number;
  failedResources: number;
  cancelledResources: number;
  retryingResources: number;
  averageProgress: number;
  averageProcessingTimeMs: number;
  resourcesByStatus: Record<ResourceValidationStatus, number>;
  resourcesByAspect: Record<ValidationAspect, number>;
  errorsByResource: Record<string, string[]>;
  performanceMetrics: {
    fastestResource: { resourceId: string; timeMs: number };
    slowestResource: { resourceId: string; timeMs: number };
    averageTimeByAspect: Record<ValidationAspect, number>;
  };
}

// ============================================================================
// Individual Resource Progress Service
// ============================================================================

export class IndividualResourceProgressService extends EventEmitter {
  private static instance: IndividualResourceProgressService;
  private activeProgress: Map<string, IndividualResourceProgress> = new Map();
  private completedProgress: Map<string, IndividualResourceProgress> = new Map();
  private maxCompletedHistory = 1000; // Keep last 1000 completed resources

  private constructor() {
    super();
    this.setupCleanupInterval();
  }

  public static getInstance(): IndividualResourceProgressService {
    if (!IndividualResourceProgressService.instance) {
      IndividualResourceProgressService.instance = new IndividualResourceProgressService();
    }
    return IndividualResourceProgressService.instance;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Start tracking progress for a resource
   */
  public startResourceProgress(
    resourceId: string,
    resourceType: string,
    context: IndividualResourceProgress['context'],
    resourceUrl?: string,
    metadata?: Partial<IndividualResourceProgress['metadata']>
  ): IndividualResourceProgress {
    const progress: IndividualResourceProgress = {
      resourceId,
      resourceType,
      resourceUrl,
      status: ResourceValidationStatus.INITIALIZING,
      progress: 0,
      completedAspects: [],
      failedAspects: [],
      startTime: new Date(),
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      retryAttempts: 0,
      maxRetryAttempts: 3,
      context,
      performance: {
        totalTimeMs: 0,
        aspectTimes: {
          [ValidationAspect.STRUCTURAL]: 0,
          [ValidationAspect.PROFILE]: 0,
          [ValidationAspect.TERMINOLOGY]: 0,
          [ValidationAspect.REFERENCE]: 0,
          [ValidationAspect.BUSINESS_RULE]: 0,
          [ValidationAspect.METADATA]: 0
        },
        averageTimePerAspect: 0
      },
      metadata: {
        complexity: 'medium',
        ...metadata
      }
    };

    this.activeProgress.set(resourceId, progress);
    
    console.log(`[IndividualResourceProgress] Started tracking resource: ${resourceId}`);
    this.emit('resourceProgressStarted', { progress });
    this.emit('progressStatsChanged', this.getProgressStats());
    
    return progress;
  }

  /**
   * Update progress for a resource
   */
  public updateResourceProgress(update: ResourceProgressUpdate): IndividualResourceProgress | null {
    const progress = this.activeProgress.get(update.resourceId);
    if (!progress) {
      console.warn(`[IndividualResourceProgress] Resource not found: ${update.resourceId}`);
      return null;
    }

    // Update progress fields
    if (update.status !== undefined) progress.status = update.status;
    if (update.progress !== undefined) progress.progress = update.progress;
    if (update.currentAspect !== undefined) progress.currentAspect = update.currentAspect;
    if (update.completedAspects) progress.completedAspects = update.completedAspects;
    if (update.failedAspects) progress.failedAspects = update.failedAspects;
    if (update.errorCount !== undefined) progress.errorCount = update.errorCount;
    if (update.warningCount !== undefined) progress.warningCount = update.warningCount;
    if (update.infoCount !== undefined) progress.infoCount = update.infoCount;
    if (update.lastError !== undefined) progress.lastError = update.lastError;
    if (update.retryAttempts !== undefined) progress.retryAttempts = update.retryAttempts;

    // Update performance metrics
    if (update.performance) {
      progress.performance = { ...progress.performance, ...update.performance };
    }

    // Update metadata
    if (update.metadata) {
      progress.metadata = { ...progress.metadata, ...update.metadata };
    }

    // Calculate estimated time remaining
    if (progress.status === ResourceValidationStatus.VALIDATING && progress.progress > 0) {
      const elapsedTime = Date.now() - progress.startTime.getTime();
      const estimatedTotalTime = (elapsedTime / progress.progress) * 100;
      progress.estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
    }

    console.log(`[IndividualResourceProgress] Updated resource: ${update.resourceId} (${progress.status}, ${progress.progress}%)`);
    
    this.emit('resourceProgressUpdated', { progress, update });
    this.emit('progressStatsChanged', this.getProgressStats());
    
    return progress;
  }

  /**
   * Complete progress tracking for a resource
   */
  public completeResourceProgress(
    resourceId: string,
    finalStatus: ResourceValidationStatus.COMPLETED | ResourceValidationStatus.FAILED | ResourceValidationStatus.CANCELLED,
    finalResults?: {
      errorCount: number;
      warningCount: number;
      infoCount: number;
      lastError?: string;
      performance: IndividualResourceProgress['performance'];
    }
  ): IndividualResourceProgress | null {
    const progress = this.activeProgress.get(resourceId);
    if (!progress) {
      console.warn(`[IndividualResourceProgress] Resource not found for completion: ${resourceId}`);
      return null;
    }

    // Update final status and results
    progress.status = finalStatus;
    progress.endTime = new Date();
    progress.progress = 100;

    if (finalResults) {
      progress.errorCount = finalResults.errorCount;
      progress.warningCount = finalResults.warningCount;
      progress.infoCount = finalResults.infoCount;
      progress.lastError = finalResults.lastError;
      progress.performance = finalResults.performance;
    }

    // Calculate final performance metrics
    progress.performance.totalTimeMs = progress.endTime.getTime() - progress.startTime.getTime();
    
    // Calculate average time per aspect
    const completedAspectCount = progress.completedAspects.length + progress.failedAspects.length;
    if (completedAspectCount > 0) {
      progress.performance.averageTimePerAspect = progress.performance.totalTimeMs / completedAspectCount;
    }

    // Move to completed progress
    this.activeProgress.delete(resourceId);
    this.completedProgress.set(resourceId, progress);

    // Cleanup old completed progress if needed
    if (this.completedProgress.size > this.maxCompletedHistory) {
      const oldestKey = this.completedProgress.keys().next().value;
      this.completedProgress.delete(oldestKey);
    }

    console.log(`[IndividualResourceProgress] Completed resource: ${resourceId} (${finalStatus}, ${progress.performance.totalTimeMs}ms)`);
    
    this.emit('resourceProgressCompleted', { progress });
    this.emit('progressStatsChanged', this.getProgressStats());
    
    return progress;
  }

  /**
   * Cancel progress tracking for a resource
   */
  public cancelResourceProgress(resourceId: string): boolean {
    const progress = this.activeProgress.get(resourceId);
    if (!progress) {
      return false;
    }

    this.completeResourceProgress(resourceId, ResourceValidationStatus.CANCELLED);
    
    console.log(`[IndividualResourceProgress] Cancelled resource: ${resourceId}`);
    return true;
  }

  /**
   * Get progress for a specific resource
   */
  public getResourceProgress(resourceId: string): IndividualResourceProgress | null {
    return this.activeProgress.get(resourceId) || this.completedProgress.get(resourceId) || null;
  }

  /**
   * Get all active progress
   */
  public getActiveProgress(): IndividualResourceProgress[] {
    return Array.from(this.activeProgress.values());
  }

  /**
   * Get all completed progress
   */
  public getCompletedProgress(limit?: number): IndividualResourceProgress[] {
    const completed = Array.from(this.completedProgress.values());
    return limit ? completed.slice(-limit) : completed;
  }

  /**
   * Get progress statistics
   */
  public getProgressStats(): ResourceProgressStats {
    const activeProgress = this.getActiveProgress();
    const completedProgress = this.getCompletedProgress();
    const allProgress = [...activeProgress, ...completedProgress];

    const totalResources = allProgress.length;
    const pendingResources = activeProgress.filter(p => p.status === ResourceValidationStatus.PENDING).length;
    const validatingResources = activeProgress.filter(p => p.status === ResourceValidationStatus.VALIDATING).length;
    const completedResources = completedProgress.filter(p => p.status === ResourceValidationStatus.COMPLETED).length;
    const failedResources = completedProgress.filter(p => p.status === ResourceValidationStatus.FAILED).length;
    const cancelledResources = completedProgress.filter(p => p.status === ResourceValidationStatus.CANCELLED).length;
    const retryingResources = activeProgress.filter(p => p.status === ResourceValidationStatus.RETRYING).length;

    // Calculate average progress
    const averageProgress = activeProgress.length > 0 
      ? activeProgress.reduce((sum, p) => sum + p.progress, 0) / activeProgress.length 
      : 0;

    // Calculate average processing time
    const completedWithTime = completedProgress.filter(p => p.endTime);
    const averageProcessingTimeMs = completedWithTime.length > 0
      ? completedWithTime.reduce((sum, p) => sum + p.performance.totalTimeMs, 0) / completedWithTime.length
      : 0;

    // Resources by status
    const resourcesByStatus: Record<ResourceValidationStatus, number> = {
      [ResourceValidationStatus.PENDING]: pendingResources,
      [ResourceValidationStatus.INITIALIZING]: activeProgress.filter(p => p.status === ResourceValidationStatus.INITIALIZING).length,
      [ResourceValidationStatus.VALIDATING]: validatingResources,
      [ResourceValidationStatus.COMPLETED]: completedResources,
      [ResourceValidationStatus.FAILED]: failedResources,
      [ResourceValidationStatus.CANCELLED]: cancelledResources,
      [ResourceValidationStatus.RETRYING]: retryingResources
    };

    // Resources by aspect
    const resourcesByAspect: Record<ValidationAspect, number> = {
      [ValidationAspect.STRUCTURAL]: activeProgress.filter(p => p.currentAspect === ValidationAspect.STRUCTURAL || p.completedAspects.includes(ValidationAspect.STRUCTURAL)).length,
      [ValidationAspect.PROFILE]: activeProgress.filter(p => p.currentAspect === ValidationAspect.PROFILE || p.completedAspects.includes(ValidationAspect.PROFILE)).length,
      [ValidationAspect.TERMINOLOGY]: activeProgress.filter(p => p.currentAspect === ValidationAspect.TERMINOLOGY || p.completedAspects.includes(ValidationAspect.TERMINOLOGY)).length,
      [ValidationAspect.REFERENCE]: activeProgress.filter(p => p.currentAspect === ValidationAspect.REFERENCE || p.completedAspects.includes(ValidationAspect.REFERENCE)).length,
      [ValidationAspect.BUSINESS_RULE]: activeProgress.filter(p => p.currentAspect === ValidationAspect.BUSINESS_RULE || p.completedAspects.includes(ValidationAspect.BUSINESS_RULE)).length,
      [ValidationAspect.METADATA]: activeProgress.filter(p => p.currentAspect === ValidationAspect.METADATA || p.completedAspects.includes(ValidationAspect.METADATA)).length
    };

    // Errors by resource
    const errorsByResource: Record<string, string[]> = {};
    allProgress.forEach(progress => {
      if (progress.lastError) {
        errorsByResource[progress.resourceId] = [progress.lastError];
      }
    });

    // Performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(allProgress);

    return {
      totalResources,
      pendingResources,
      validatingResources,
      completedResources,
      failedResources,
      cancelledResources,
      retryingResources,
      averageProgress,
      averageProcessingTimeMs,
      resourcesByStatus,
      resourcesByAspect,
      errorsByResource,
      performanceMetrics
    };
  }

  /**
   * Clear all progress data
   */
  public clearAllProgress(): void {
    this.activeProgress.clear();
    this.completedProgress.clear();
    
    console.log('[IndividualResourceProgress] Cleared all progress data');
    this.emit('progressCleared');
    this.emit('progressStatsChanged', this.getProgressStats());
  }

  /**
   * Clear completed progress older than specified time
   */
  public clearOldProgress(olderThanMs: number): number {
    const cutoffTime = Date.now() - olderThanMs;
    let clearedCount = 0;

    for (const [resourceId, progress] of this.completedProgress.entries()) {
      if (progress.endTime && progress.endTime.getTime() < cutoffTime) {
        this.completedProgress.delete(resourceId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      console.log(`[IndividualResourceProgress] Cleared ${clearedCount} old progress entries`);
      this.emit('progressStatsChanged', this.getProgressStats());
    }

    return clearedCount;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private calculatePerformanceMetrics(allProgress: IndividualResourceProgress[]): ResourceProgressStats['performanceMetrics'] {
    const completedWithTime = allProgress.filter(p => p.endTime && p.status === ResourceValidationStatus.COMPLETED);
    
    if (completedWithTime.length === 0) {
      return {
        fastestResource: { resourceId: '', timeMs: 0 },
        slowestResource: { resourceId: '', timeMs: 0 },
        averageTimeByAspect: {
          [ValidationAspect.STRUCTURAL]: 0,
          [ValidationAspect.PROFILE]: 0,
          [ValidationAspect.TERMINOLOGY]: 0,
          [ValidationAspect.REFERENCE]: 0,
          [ValidationAspect.BUSINESS_RULE]: 0,
          [ValidationAspect.METADATA]: 0
        }
      };
    }

    // Find fastest and slowest resources
    const fastest = completedWithTime.reduce((prev, current) => 
      prev.performance.totalTimeMs < current.performance.totalTimeMs ? prev : current
    );
    
    const slowest = completedWithTime.reduce((prev, current) => 
      prev.performance.totalTimeMs > current.performance.totalTimeMs ? prev : current
    );

    // Calculate average time by aspect
    const averageTimeByAspect: Record<ValidationAspect, number> = {
      [ValidationAspect.STRUCTURAL]: 0,
      [ValidationAspect.PROFILE]: 0,
      [ValidationAspect.TERMINOLOGY]: 0,
      [ValidationAspect.REFERENCE]: 0,
      [ValidationAspect.BUSINESS_RULE]: 0,
      [ValidationAspect.METADATA]: 0
    };

    Object.values(ValidationAspect).forEach(aspect => {
      const aspectTimes = completedWithTime
        .map(p => p.performance.aspectTimes[aspect])
        .filter(time => time > 0);
      
      if (aspectTimes.length > 0) {
        averageTimeByAspect[aspect] = aspectTimes.reduce((sum, time) => sum + time, 0) / aspectTimes.length;
      }
    });

    return {
      fastestResource: { resourceId: fastest.resourceId, timeMs: fastest.performance.totalTimeMs },
      slowestResource: { resourceId: slowest.resourceId, timeMs: slowest.performance.totalTimeMs },
      averageTimeByAspect
    };
  }

  private setupCleanupInterval(): void {
    // Clean up old progress every hour
    setInterval(() => {
      this.clearOldProgress(24 * 60 * 60 * 1000); // 24 hours
    }, 60 * 60 * 1000); // 1 hour
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const getIndividualResourceProgressService = (): IndividualResourceProgressService => {
  return IndividualResourceProgressService.getInstance();
};
