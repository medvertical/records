import { db } from "../../../db";
import { validationProgressState } from "../../../../shared/schema";
import { eq, and, lt, desc } from "drizzle-orm";

export interface ValidationProgressState {
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date | null;
  canPause: boolean;
  shouldStop: boolean;
  resumeData: any | null;
  currentResourceType: string | null;
  nextResourceType: string | null;
  activeValidationAspects: {
    structural: boolean;
    profile: boolean;
    terminology: boolean;
    reference: boolean;
    businessRule: boolean;
    metadata: boolean;
  } | null;
  lastBroadcastTime: number | null;
  processedResources: number;
  totalResources: number;
  currentBatch: number;
  totalBatches: number;
  errors: number;
  warnings: number;
  errorDetails: {
    total: number;
    byType: Record<string, number>;
    byResourceType: Record<string, number>;
    byAspect: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: Array<{
      timestamp: number;
      resourceId: string;
      resourceType: string;
      aspect: string;
      errorType: string;
      severity: string;
      message: string;
    }>;
  };
  warningDetails: {
    total: number;
    byType: Record<string, number>;
    byResourceType: Record<string, number>;
    byAspect: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: Array<{
      timestamp: number;
      resourceId: string;
      resourceType: string;
      aspect: string;
      warningType: string;
      severity: string;
      message: string;
    }>;
  };
  startTimeMs: number;
  lastUpdateTime: number;
  averageProcessingTime: number;
  estimatedTimeRemaining: number;
  resourceTypeProgress: Record<string, {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
    startTime: number;
  }>;
  aspectProgress: Record<string, {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
    startTime: number;
  }>;
  jobId: string | null;
  requestPayload: any | null;
  startTimestamp: number;
  stopTimestamp: number;
  runDuration: number;
  finalStats: any | null;
}

export class ValidationProgressPersistenceService {
  private static instance: ValidationProgressPersistenceService;

  public static getInstance(): ValidationProgressPersistenceService {
    if (!ValidationProgressPersistenceService.instance) {
      ValidationProgressPersistenceService.instance = new ValidationProgressPersistenceService();
    }
    return ValidationProgressPersistenceService.instance;
  }

  /**
   * Save validation progress state to database
   */
  async saveProgressState(
    jobId: string,
    serverId: number,
    state: ValidationProgressState
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      await db
        .insert(validationProgressState)
        .values({
          jobId,
          serverId,
          stateData: state as any,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: validationProgressState.jobId,
          set: {
            stateData: state as any,
            updatedAt: new Date(),
            expiresAt,
          },
        });

      console.log(`[ValidationProgressPersistence] Saved progress state for job ${jobId}`);
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error saving progress state:`, error);
      throw error;
    }
  }

  /**
   * Load validation progress state from database
   */
  async loadProgressState(jobId: string): Promise<ValidationProgressState | null> {
    try {
      const result = await db
        .select()
        .from(validationProgressState)
        .where(
          and(
            eq(validationProgressState.jobId, jobId),
            lt(new Date(), validationProgressState.expiresAt) // Only get non-expired states
          )
        )
        .limit(1);

      if (result.length === 0) {
        console.log(`[ValidationProgressPersistence] No valid progress state found for job ${jobId}`);
        return null;
      }

      const state = result[0].stateData as ValidationProgressState;
      console.log(`[ValidationProgressPersistence] Loaded progress state for job ${jobId}`);
      return state;
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error loading progress state:`, error);
      throw error;
    }
  }

  /**
   * Load the most recent active validation state for a server
   */
  async loadActiveProgressState(serverId: number): Promise<ValidationProgressState | null> {
    try {
      const result = await db
        .select()
        .from(validationProgressState)
        .where(
          and(
            eq(validationProgressState.serverId, serverId),
            lt(new Date(), validationProgressState.expiresAt) // Only get non-expired states
          )
        )
        .orderBy(desc(validationProgressState.updatedAt)) // Get most recent first
        .limit(1);

      if (result.length === 0) {
        console.log(`[ValidationProgressPersistence] No active progress state found for server ${serverId}`);
        return null;
      }

      const state = result[0].stateData as ValidationProgressState;
      
      // Only return if the state indicates an active validation
      if (!state.isRunning && !state.isPaused) {
        console.log(`[ValidationProgressPersistence] Found inactive state for server ${serverId}, ignoring`);
        return null;
      }

      console.log(`[ValidationProgressPersistence] Loaded active progress state for server ${serverId}`);
      return state;
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error loading active progress state:`, error);
      throw error;
    }
  }

  /**
   * Delete validation progress state
   */
  async deleteProgressState(jobId: string): Promise<void> {
    try {
      await db
        .delete(validationProgressState)
        .where(eq(validationProgressState.jobId, jobId));

      console.log(`[ValidationProgressPersistence] Deleted progress state for job ${jobId}`);
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error deleting progress state:`, error);
      throw error;
    }
  }

  /**
   * Clean up expired validation progress states
   */
  async cleanupExpiredStates(): Promise<number> {
    try {
      const result = await db
        .delete(validationProgressState)
        .where(lt(validationProgressState.expiresAt, new Date()));

      const deletedCount = result.rowCount || 0;
      console.log(`[ValidationProgressPersistence] Cleaned up ${deletedCount} expired progress states`);
      return deletedCount;
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error cleaning up expired states:`, error);
      throw error;
    }
  }

  /**
   * Get all active validation states for monitoring
   */
  async getAllActiveStates(): Promise<Array<{ jobId: string; serverId: number; state: ValidationProgressState }>> {
    try {
      const result = await db
        .select()
        .from(validationProgressState)
        .where(lt(new Date(), validationProgressState.expiresAt))
        .orderBy(validationProgressState.updatedAt);

      return result.map(row => ({
        jobId: row.jobId,
        serverId: row.serverId,
        state: row.stateData as ValidationProgressState,
      }));
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error getting all active states:`, error);
      throw error;
    }
  }

  /**
   * Get recent validation progress states for history
   */
  async getRecentProgressStates(limit: number = 10, serverId?: number): Promise<Array<{id: number; stateData: ValidationProgressState; createdAt: Date | null}>> {
    try {
      let query = db
        .select()
        .from(validationProgressState);

      // Filter by serverId if provided
      if (serverId !== undefined) {
        query = query.where(eq(validationProgressState.serverId, serverId)) as any;
      }

      const result = await query
        .orderBy(desc(validationProgressState.createdAt))
        .limit(limit);

      return result.map(row => ({
        id: row.id,
        stateData: row.stateData as ValidationProgressState,
        createdAt: row.createdAt
      }));
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error getting recent progress states:`, error);
      return [];
    }
  }

  /**
   * Validate and sanitize progress state
   */
  validateProgressState(state: any): ValidationProgressState | null {
    try {
      // Basic validation
      if (!state || typeof state !== 'object') {
        return null;
      }

      // Ensure required fields exist with defaults
      const validatedState: ValidationProgressState = {
        isRunning: Boolean(state.isRunning),
        isPaused: Boolean(state.isPaused),
        startTime: state.startTime ? new Date(state.startTime) : null,
        canPause: Boolean(state.canPause),
        shouldStop: Boolean(state.shouldStop),
        resumeData: state.resumeData || null,
        currentResourceType: state.currentResourceType || null,
        nextResourceType: state.nextResourceType || null,
        activeValidationAspects: state.activeValidationAspects || null,
        lastBroadcastTime: state.lastBroadcastTime || null,
        processedResources: Number(state.processedResources) || 0,
        totalResources: Number(state.totalResources) || 0,
        currentBatch: Number(state.currentBatch) || 0,
        totalBatches: Number(state.totalBatches) || 0,
        errors: Number(state.errors) || 0,
        warnings: Number(state.warnings) || 0,
        errorDetails: state.errorDetails || {
          total: 0,
          byType: {},
          byResourceType: {},
          byAspect: {},
          bySeverity: {},
          recent: []
        },
        warningDetails: state.warningDetails || {
          total: 0,
          byType: {},
          byResourceType: {},
          byAspect: {},
          bySeverity: {},
          recent: []
        },
        startTimeMs: Number(state.startTimeMs) || 0,
        lastUpdateTime: Number(state.lastUpdateTime) || 0,
        averageProcessingTime: Number(state.averageProcessingTime) || 0,
        estimatedTimeRemaining: Number(state.estimatedTimeRemaining) || 0,
        resourceTypeProgress: state.resourceTypeProgress || {},
        aspectProgress: state.aspectProgress || {},
        jobId: state.jobId || null,
        requestPayload: state.requestPayload || null,
        startTimestamp: Number(state.startTimestamp) || 0,
        stopTimestamp: Number(state.stopTimestamp) || 0,
        runDuration: Number(state.runDuration) || 0,
        finalStats: state.finalStats || null,
      };

      return validatedState;
    } catch (error) {
      console.error(`[ValidationProgressPersistence] Error validating progress state:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const getValidationProgressPersistenceService = () => ValidationProgressPersistenceService.getInstance();

