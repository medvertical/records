/**
 * Validation Polling Service
 * 
 * This service provides polling-based progress updates for validation operations,
 * allowing clients to track long-running validation processes in real-time.
 * Implements the MVP polling strategy as required by the PRD.
 */

import { EventEmitter } from 'events';
import { getIndividualResourceProgressService, type IndividualResourceProgress, type ResourceProgressStats } from './individual-resource-progress-service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PollingSession {
  sessionId: string;
  clientId: string;
  resourceIds: string[];
  batchId?: string;
  startTime: Date;
  lastPollTime: Date;
  isActive: boolean;
  pollInterval: number; // milliseconds
  maxPollDuration: number; // milliseconds
  context: {
    requestedBy: string;
    requestId: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface PollingResponse {
  sessionId: string;
  timestamp: Date;
  isActive: boolean;
  progress: {
    individual: IndividualResourceProgress[];
    summary: ResourceProgressStats;
  };
  updates: {
    newResources: string[];
    completedResources: string[];
    failedResources: string[];
    updatedResources: string[];
  };
  metadata: {
    totalResources: number;
    activeResources: number;
    completedResources: number;
    failedResources: number;
    averageProgress: number;
    estimatedTimeRemaining?: number;
  };
}

export interface PollingSubscription {
  sessionId: string;
  clientId: string;
  callback: (response: PollingResponse) => void;
  lastPollTime: Date;
  isActive: boolean;
}

export interface PollingConfiguration {
  defaultPollInterval: number; // milliseconds
  maxPollDuration: number; // milliseconds
  maxConcurrentSessions: number;
  cleanupInterval: number; // milliseconds
  maxSessionHistory: number;
}

// ============================================================================
// Validation Polling Service
// ============================================================================

export class ValidationPollingService extends EventEmitter {
  private static instance: ValidationPollingService;
  private sessions: Map<string, PollingSession> = new Map();
  private subscriptions: Map<string, PollingSubscription> = new Map();
  private sessionHistory: PollingSession[] = [];
  private progressService: ReturnType<typeof getIndividualResourceProgressService>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private lastProgressSnapshot: Map<string, IndividualResourceProgress> = new Map();

  private config: PollingConfiguration = {
    defaultPollInterval: 2000, // 2 seconds
    maxPollDuration: 30 * 60 * 1000, // 30 minutes
    maxConcurrentSessions: 100,
    cleanupInterval: 60 * 1000, // 1 minute
    maxSessionHistory: 1000
  };

  private constructor() {
    super();
    this.progressService = getIndividualResourceProgressService();
    this.setupEventListeners();
    this.startCleanupInterval();
  }

  public static getInstance(): ValidationPollingService {
    if (!ValidationPollingService.instance) {
      ValidationPollingService.instance = new ValidationPollingService();
    }
    return ValidationPollingService.instance;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Create a new polling session
   */
  public createPollingSession(
    clientId: string,
    resourceIds: string[],
    options: {
      batchId?: string;
      pollInterval?: number;
      maxPollDuration?: number;
      context?: Partial<PollingSession['context']>;
    } = {}
  ): PollingSession {
    // Check session limits
    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      throw new Error('Maximum number of concurrent polling sessions reached');
    }

    const sessionId = this.generateSessionId();
    const now = new Date();

    const session: PollingSession = {
      sessionId,
      clientId,
      resourceIds,
      batchId: options.batchId,
      startTime: now,
      lastPollTime: now,
      isActive: true,
      pollInterval: options.pollInterval || this.config.defaultPollInterval,
      maxPollDuration: options.maxPollDuration || this.config.maxPollDuration,
      context: {
        requestedBy: 'unknown',
        requestId: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...options.context
      }
    };

    this.sessions.set(sessionId, session);
    this.addToSessionHistory(session);

    // Initialize progress snapshot for this session
    resourceIds.forEach(resourceId => {
      const progress = this.progressService.getResourceProgress(resourceId);
      if (progress) {
        this.lastProgressSnapshot.set(`${sessionId}_${resourceId}`, { ...progress });
      }
    });

    console.log(`[ValidationPolling] Created polling session: ${sessionId} for ${resourceIds.length} resources`);
    this.emit('sessionCreated', { session });

    return session;
  }

  /**
   * Subscribe to polling updates for a session
   */
  public subscribeToPolling(
    sessionId: string,
    clientId: string,
    callback: (response: PollingResponse) => void
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    if (session.clientId !== clientId) {
      return false;
    }

    const subscription: PollingSubscription = {
      sessionId,
      clientId,
      callback,
      lastPollTime: new Date(),
      isActive: true
    };

    this.subscriptions.set(sessionId, subscription);

    console.log(`[ValidationPolling] Client ${clientId} subscribed to session: ${sessionId}`);
    this.emit('subscriptionCreated', { subscription });

    return true;
  }

  /**
   * Unsubscribe from polling updates
   */
  public unsubscribeFromPolling(sessionId: string, clientId: string): boolean {
    const subscription = this.subscriptions.get(sessionId);
    if (!subscription || subscription.clientId !== clientId) {
      return false;
    }

    this.subscriptions.delete(sessionId);

    console.log(`[ValidationPolling] Client ${clientId} unsubscribed from session: ${sessionId}`);
    this.emit('subscriptionRemoved', { sessionId, clientId });

    return true;
  }

  /**
   * Get current polling response for a session
   */
  public getPollingResponse(sessionId: string, clientId: string): PollingResponse | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive || session.clientId !== clientId) {
      return null;
    }

    return this.generatePollingResponse(session);
  }

  /**
   * Update session last poll time
   */
  public updateLastPollTime(sessionId: string, clientId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive || session.clientId !== clientId) {
      return false;
    }

    session.lastPollTime = new Date();
    return true;
  }

  /**
   * End a polling session
   */
  public endPollingSession(sessionId: string, clientId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.clientId !== clientId) {
      return false;
    }

    session.isActive = false;
    this.sessions.delete(sessionId);
    this.subscriptions.delete(sessionId);

    // Clean up progress snapshots
    session.resourceIds.forEach(resourceId => {
      this.lastProgressSnapshot.delete(`${sessionId}_${resourceId}`);
    });

    console.log(`[ValidationPolling] Ended polling session: ${sessionId}`);
    this.emit('sessionEnded', { session });

    return true;
  }

  /**
   * Get all active sessions for a client
   */
  public getClientSessions(clientId: string): PollingSession[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.clientId === clientId && session.isActive
    );
  }

  /**
   * Get polling statistics
   */
  public getPollingStats(): {
    activeSessions: number;
    totalSubscriptions: number;
    sessionsByClient: Record<string, number>;
    averageSessionDuration: number;
    totalSessionsCreated: number;
  } {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);
    const sessionsByClient: Record<string, number> = {};
    
    activeSessions.forEach(session => {
      sessionsByClient[session.clientId] = (sessionsByClient[session.clientId] || 0) + 1;
    });

    const completedSessions = this.sessionHistory.filter(s => !s.isActive);
    const averageSessionDuration = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => {
          const duration = s.lastPollTime.getTime() - s.startTime.getTime();
          return sum + duration;
        }, 0) / completedSessions.length
      : 0;

    return {
      activeSessions: activeSessions.length,
      totalSubscriptions: this.subscriptions.size,
      sessionsByClient,
      averageSessionDuration,
      totalSessionsCreated: this.sessionHistory.length
    };
  }

  /**
   * Update polling configuration
   */
  public updateConfiguration(newConfig: Partial<PollingConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[ValidationPolling] Configuration updated:', this.config);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private setupEventListeners(): void {
    // Listen to progress service events
    this.progressService.on('resourceProgressUpdated', (data) => {
      this.handleProgressUpdate(data.progress);
    });

    this.progressService.on('resourceProgressCompleted', (data) => {
      this.handleProgressCompletion(data.progress);
    });

    this.progressService.on('progressStatsChanged', () => {
      this.notifyAllSubscriptions();
    });
  }

  private handleProgressUpdate(progress: IndividualResourceProgress): void {
    // Update progress snapshots for all relevant sessions
    this.sessions.forEach(session => {
      if (session.isActive && session.resourceIds.includes(progress.resourceId)) {
        this.lastProgressSnapshot.set(`${session.sessionId}_${progress.resourceId}`, { ...progress });
      }
    });

    // Notify subscriptions
    this.notifyAllSubscriptions();
  }

  private handleProgressCompletion(progress: IndividualResourceProgress): void {
    // Update progress snapshots
    this.sessions.forEach(session => {
      if (session.isActive && session.resourceIds.includes(progress.resourceId)) {
        this.lastProgressSnapshot.set(`${session.sessionId}_${progress.resourceId}`, { ...progress });
      }
    });

    // Check if session should be ended (all resources completed)
    this.sessions.forEach(session => {
      if (session.isActive && session.resourceIds.includes(progress.resourceId)) {
        const allCompleted = session.resourceIds.every(resourceId => {
          const resourceProgress = this.progressService.getResourceProgress(resourceId);
          return resourceProgress && (
            resourceProgress.status === 'completed' ||
            resourceProgress.status === 'failed' ||
            resourceProgress.status === 'cancelled'
          );
        });

        if (allCompleted) {
          // Auto-end session after a short delay
          setTimeout(() => {
            this.endPollingSession(session.sessionId, session.clientId);
          }, 5000); // 5 second delay
        }
      }
    });

    // Notify subscriptions
    this.notifyAllSubscriptions();
  }

  private notifyAllSubscriptions(): void {
    this.subscriptions.forEach(subscription => {
      if (!subscription.isActive) return;

      const session = this.sessions.get(subscription.sessionId);
      if (!session || !session.isActive) {
        subscription.isActive = false;
        return;
      }

      try {
        const response = this.generatePollingResponse(session);
        subscription.callback(response);
        subscription.lastPollTime = new Date();
      } catch (error) {
        console.error(`[ValidationPolling] Error notifying subscription ${subscription.sessionId}:`, error);
        subscription.isActive = false;
      }
    });
  }

  private generatePollingResponse(session: PollingSession): PollingResponse {
    const now = new Date();
    const individualProgress: IndividualResourceProgress[] = [];
    const updates = {
      newResources: [] as string[],
      completedResources: [] as string[],
      failedResources: [] as string[],
      updatedResources: [] as string[]
    };

    // Get current progress for all resources in session
    session.resourceIds.forEach(resourceId => {
      const currentProgress = this.progressService.getResourceProgress(resourceId);
      if (currentProgress) {
        individualProgress.push(currentProgress);

        // Check for updates
        const snapshotKey = `${session.sessionId}_${resourceId}`;
        const lastSnapshot = this.lastProgressSnapshot.get(snapshotKey);
        
        if (!lastSnapshot) {
          updates.newResources.push(resourceId);
        } else if (currentProgress.status !== lastSnapshot.status) {
          if (currentProgress.status === 'completed') {
            updates.completedResources.push(resourceId);
          } else if (currentProgress.status === 'failed') {
            updates.failedResources.push(resourceId);
          }
          updates.updatedResources.push(resourceId);
        } else if (
          currentProgress.progress !== lastSnapshot.progress ||
          currentProgress.currentAspect !== lastSnapshot.currentAspect ||
          currentProgress.errorCount !== lastSnapshot.errorCount ||
          currentProgress.warningCount !== lastSnapshot.warningCount
        ) {
          updates.updatedResources.push(resourceId);
        }
      }
    });

    // Get summary statistics
    const summary = this.progressService.getProgressStats();

    // Calculate metadata
    const activeResources = individualProgress.filter(p => 
      p.status === 'pending' || p.status === 'initializing' || p.status === 'validating' || p.status === 'retrying'
    ).length;
    
    const completedResources = individualProgress.filter(p => p.status === 'completed').length;
    const failedResources = individualProgress.filter(p => p.status === 'failed').length;
    
    const averageProgress = individualProgress.length > 0
      ? individualProgress.reduce((sum, p) => sum + p.progress, 0) / individualProgress.length
      : 0;

    // Estimate time remaining
    const estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(session, individualProgress);

    return {
      sessionId: session.sessionId,
      timestamp: now,
      isActive: session.isActive,
      progress: {
        individual: individualProgress,
        summary
      },
      updates,
      metadata: {
        totalResources: session.resourceIds.length,
        activeResources,
        completedResources,
        failedResources,
        averageProgress,
        estimatedTimeRemaining
      }
    };
  }

  private calculateEstimatedTimeRemaining(
    session: PollingSession,
    individualProgress: IndividualResourceProgress[]
  ): number | undefined {
    const activeProgress = individualProgress.filter(p => 
      p.status === 'validating' && p.progress > 0
    );

    if (activeProgress.length === 0) return undefined;

    const now = Date.now();
    const totalEstimatedTime = activeProgress.reduce((sum, progress) => {
      const elapsedTime = now - progress.startTime.getTime();
      const estimatedTotalTime = (elapsedTime / progress.progress) * 100;
      return sum + Math.max(0, estimatedTotalTime - elapsedTime);
    }, 0);

    return totalEstimatedTime / activeProgress.length;
  }

  private generateSessionId(): string {
    return `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToSessionHistory(session: PollingSession): void {
    this.sessionHistory.push(session);
    
    // Keep only recent history
    if (this.sessionHistory.length > this.config.maxSessionHistory) {
      this.sessionHistory = this.sessionHistory.slice(-this.config.maxSessionHistory);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupInterval);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      const sessionDuration = now - session.startTime.getTime();
      const timeSinceLastPoll = now - session.lastPollTime.getTime();

      // End session if it's exceeded max duration or hasn't been polled recently
      if (sessionDuration > session.maxPollDuration || timeSinceLastPoll > session.pollInterval * 3) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach(sessionId => {
      const session = this.sessions.get(sessionId);
      if (session) {
        this.endPollingSession(sessionId, session.clientId);
        console.log(`[ValidationPolling] Cleaned up expired session: ${sessionId}`);
      }
    });

    // Clean up inactive subscriptions
    this.subscriptions.forEach((subscription, sessionId) => {
      if (!subscription.isActive || !this.sessions.has(sessionId)) {
        this.subscriptions.delete(sessionId);
      }
    });
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const getValidationPollingService = (): ValidationPollingService => {
  return ValidationPollingService.getInstance();
};
