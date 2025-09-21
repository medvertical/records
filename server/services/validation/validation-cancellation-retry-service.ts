/**
 * Validation Cancellation and Retry Service
 * 
 * This service provides comprehensive cancellation and retry mechanisms
 * for validation operations, including bulk validation, queue items,
 * and individual resources.
 */

import { EventEmitter } from 'events';
import { getValidationQueueService } from './validation-queue-service';
import { getIndividualResourceProgressService } from './individual-resource-progress-service';
import { getValidationPipeline } from './validation-pipeline';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CancellationRequest {
  id: string;
  type: CancellationType;
  targetId: string;
  reason?: string;
  requestedBy: string;
  requestedAt: Date;
  status: CancellationStatus;
  completedAt?: Date;
  error?: string;
}

export interface RetryRequest {
  id: string;
  type: RetryType;
  targetId: string;
  reason?: string;
  requestedBy: string;
  requestedAt: Date;
  originalAttempts: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  status: RetryStatus;
  attempts: number;
  nextRetryAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface RetryPolicy {
  maxRetryAttempts: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  backoffMultiplier: number;
  maxRetryDelayMs: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

export enum CancellationType {
  BULK_VALIDATION = 'bulk_validation',
  QUEUE_ITEM = 'queue_item',
  QUEUE_BATCH = 'queue_batch',
  INDIVIDUAL_RESOURCE = 'individual_resource',
  PIPELINE = 'pipeline',
  ALL_OPERATIONS = 'all_operations'
}

export enum RetryType {
  BULK_VALIDATION = 'bulk_validation',
  QUEUE_ITEM = 'queue_item',
  INDIVIDUAL_RESOURCE = 'individual_resource',
  PIPELINE = 'pipeline'
}

export enum CancellationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum RetryStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXHAUSTED = 'exhausted'
}

export interface CancellationRetryStats {
  totalCancellations: number;
  totalRetries: number;
  pendingCancellations: number;
  pendingRetries: number;
  successfulCancellations: number;
  successfulRetries: number;
  failedCancellations: number;
  failedRetries: number;
  cancellationsByType: Record<CancellationType, number>;
  retriesByType: Record<RetryType, number>;
  averageCancellationTimeMs: number;
  averageRetryTimeMs: number;
}

// ============================================================================
// Validation Cancellation and Retry Service
// ============================================================================

export class ValidationCancellationRetryService extends EventEmitter {
  private static instance: ValidationCancellationRetryService;
  private cancellationRequests: Map<string, CancellationRequest> = new Map();
  private retryRequests: Map<string, RetryRequest> = new Map();
  private retryPolicies: Map<RetryType, RetryPolicy> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private globalValidationState: any;

  private constructor() {
    super();
    this.initializeRetryPolicies();
    this.setupCleanupInterval();
  }

  public static getInstance(): ValidationCancellationRetryService {
    if (!ValidationCancellationRetryService.instance) {
      ValidationCancellationRetryService.instance = new ValidationCancellationRetryService();
    }
    return ValidationCancellationRetryService.instance;
  }

  // ========================================================================
  // Public API - Cancellation
  // ========================================================================

  /**
   * Cancel a validation operation
   */
  public async cancelOperation(
    type: CancellationType,
    targetId: string,
    reason: string,
    requestedBy: string
  ): Promise<CancellationRequest> {
    const request: CancellationRequest = {
      id: `cancel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      targetId,
      reason,
      requestedBy,
      requestedAt: new Date(),
      status: CancellationStatus.PENDING
    };

    this.cancellationRequests.set(request.id, request);
    
    console.log(`[CancellationRetry] Cancellation requested: ${request.id} (${type}: ${targetId})`);
    
    this.emit('cancellationRequested', { request });
    
    // Process cancellation immediately
    await this.processCancellation(request);
    
    return request;
  }

  /**
   * Cancel all operations of a specific type
   */
  public async cancelAllOperations(
    type: CancellationType,
    reason: string,
    requestedBy: string
  ): Promise<CancellationRequest[]> {
    const requests: CancellationRequest[] = [];
    
    // Get all active operations of the specified type
    const activeOperations = await this.getActiveOperations(type);
    
    for (const operation of activeOperations) {
      const request = await this.cancelOperation(type, operation.id, reason, requestedBy);
      requests.push(request);
    }
    
    console.log(`[CancellationRetry] Cancelled all ${type} operations: ${requests.length} operations`);
    return requests;
  }

  /**
   * Emergency stop - cancel all operations
   */
  public async emergencyStop(reason: string, requestedBy: string): Promise<CancellationRequest[]> {
    console.log(`[CancellationRetry] Emergency stop requested: ${reason}`);
    
    const allRequests: CancellationRequest[] = [];
    
    // Cancel all types of operations
    const types = Object.values(CancellationType);
    for (const type of types) {
      if (type !== CancellationType.ALL_OPERATIONS) {
        const requests = await this.cancelAllOperations(type, reason, requestedBy);
        allRequests.push(...requests);
      }
    }
    
    // Also set global validation state to stop
    if (this.globalValidationState) {
      this.globalValidationState.shouldStop = true;
      this.globalValidationState.isRunning = false;
      this.globalValidationState.isPaused = false;
    }
    
    console.log(`[CancellationRetry] Emergency stop completed: ${allRequests.length} operations cancelled`);
    this.emit('emergencyStopCompleted', { reason, requestedBy, cancelledCount: allRequests.length });
    
    return allRequests;
  }

  // ========================================================================
  // Public API - Retry
  // ========================================================================

  /**
   * Retry a failed validation operation
   */
  public async retryOperation(
    type: RetryType,
    targetId: string,
    reason: string,
    requestedBy: string,
    customPolicy?: Partial<RetryPolicy>
  ): Promise<RetryRequest> {
    const policy = this.getRetryPolicy(type, customPolicy);
    
    const request: RetryRequest = {
      id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      targetId,
      reason,
      requestedBy,
      requestedAt: new Date(),
      originalAttempts: await this.getOriginalAttemptCount(type, targetId),
      maxRetryAttempts: policy.maxRetryAttempts,
      retryDelayMs: policy.retryDelayMs,
      status: RetryStatus.PENDING,
      attempts: 0
    };

    this.retryRequests.set(request.id, request);
    
    console.log(`[CancellationRetry] Retry requested: ${request.id} (${type}: ${targetId})`);
    
    this.emit('retryRequested', { request });
    
    // Schedule retry
    this.scheduleRetry(request, policy);
    
    return request;
  }

  /**
   * Retry all failed operations of a specific type
   */
  public async retryAllFailedOperations(
    type: RetryType,
    reason: string,
    requestedBy: string,
    customPolicy?: Partial<RetryPolicy>
  ): Promise<RetryRequest[]> {
    const requests: RetryRequest[] = [];
    
    // Get all failed operations of the specified type
    const failedOperations = await this.getFailedOperations(type);
    
    for (const operation of failedOperations) {
      const request = await this.retryOperation(type, operation.id, reason, requestedBy, customPolicy);
      requests.push(request);
    }
    
    console.log(`[CancellationRetry] Retrying all failed ${type} operations: ${requests.length} operations`);
    return requests;
  }

  /**
   * Cancel a retry operation
   */
  public cancelRetry(retryId: string): boolean {
    const request = this.retryRequests.get(retryId);
    if (!request || request.status === RetryStatus.COMPLETED) {
      return false;
    }

    // Clear any scheduled timer
    const timer = this.retryTimers.get(retryId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(retryId);
    }

    request.status = RetryStatus.FAILED;
    request.completedAt = new Date();
    request.error = 'Retry cancelled by user';

    console.log(`[CancellationRetry] Retry cancelled: ${retryId}`);
    
    this.emit('retryCancelled', { request });
    return true;
  }

  // ========================================================================
  // Public API - Statistics and Monitoring
  // ========================================================================

  /**
   * Get cancellation and retry statistics
   */
  public getStats(): CancellationRetryStats {
    const cancellations = Array.from(this.cancellationRequests.values());
    const retries = Array.from(this.retryRequests.values());

    const totalCancellations = cancellations.length;
    const totalRetries = retries.length;
    const pendingCancellations = cancellations.filter(c => c.status === CancellationStatus.PENDING || c.status === CancellationStatus.IN_PROGRESS).length;
    const pendingRetries = retries.filter(r => r.status === RetryStatus.PENDING || r.status === RetryStatus.SCHEDULED || r.status === RetryStatus.IN_PROGRESS).length;
    const successfulCancellations = cancellations.filter(c => c.status === CancellationStatus.COMPLETED).length;
    const successfulRetries = retries.filter(r => r.status === RetryStatus.COMPLETED).length;
    const failedCancellations = cancellations.filter(c => c.status === CancellationStatus.FAILED).length;
    const failedRetries = retries.filter(r => r.status === RetryStatus.FAILED || r.status === RetryStatus.EXHAUSTED).length;

    // Cancellations by type
    const cancellationsByType: Record<CancellationType, number> = {} as Record<CancellationType, number>;
    Object.values(CancellationType).forEach(type => {
      cancellationsByType[type] = cancellations.filter(c => c.type === type).length;
    });

    // Retries by type
    const retriesByType: Record<RetryType, number> = {} as Record<RetryType, number>;
    Object.values(RetryType).forEach(type => {
      retriesByType[type] = retries.filter(r => r.type === type).length;
    });

    // Calculate average times
    const completedCancellations = cancellations.filter(c => c.status === CancellationStatus.COMPLETED && c.completedAt);
    const averageCancellationTimeMs = completedCancellations.length > 0
      ? completedCancellations.reduce((sum, c) => sum + (c.completedAt!.getTime() - c.requestedAt.getTime()), 0) / completedCancellations.length
      : 0;

    const completedRetries = retries.filter(r => r.status === RetryStatus.COMPLETED && r.completedAt);
    const averageRetryTimeMs = completedRetries.length > 0
      ? completedRetries.reduce((sum, r) => sum + (r.completedAt!.getTime() - r.requestedAt.getTime()), 0) / completedRetries.length
      : 0;

    return {
      totalCancellations,
      totalRetries,
      pendingCancellations,
      pendingRetries,
      successfulCancellations,
      successfulRetries,
      failedCancellations,
      failedRetries,
      cancellationsByType,
      retriesByType,
      averageCancellationTimeMs,
      averageRetryTimeMs
    };
  }

  /**
   * Get active cancellation requests
   */
  public getActiveCancellations(): CancellationRequest[] {
    return Array.from(this.cancellationRequests.values()).filter(
      c => c.status === CancellationStatus.PENDING || c.status === CancellationStatus.IN_PROGRESS
    );
  }

  /**
   * Get active retry requests
   */
  public getActiveRetries(): RetryRequest[] {
    return Array.from(this.retryRequests.values()).filter(
      r => r.status === RetryStatus.PENDING || r.status === RetryStatus.SCHEDULED || r.status === RetryStatus.IN_PROGRESS
    );
  }

  /**
   * Clear old completed requests
   */
  public clearOldRequests(olderThanHours: number = 24): number {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let clearedCount = 0;

    // Clear old cancellations
    for (const [id, request] of this.cancellationRequests.entries()) {
      if (request.completedAt && request.completedAt.getTime() < cutoffTime) {
        this.cancellationRequests.delete(id);
        clearedCount++;
      }
    }

    // Clear old retries
    for (const [id, request] of this.retryRequests.entries()) {
      if (request.completedAt && request.completedAt.getTime() < cutoffTime) {
        this.retryRequests.delete(id);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      console.log(`[CancellationRetry] Cleared ${clearedCount} old requests`);
    }

    return clearedCount;
  }

  // ========================================================================
  // Public API - Configuration
  // ========================================================================

  /**
   * Set global validation state reference
   */
  public setGlobalValidationState(state: any): void {
    this.globalValidationState = state;
  }

  /**
   * Update retry policy for a specific type
   */
  public updateRetryPolicy(type: RetryType, policy: Partial<RetryPolicy>): void {
    const currentPolicy = this.retryPolicies.get(type) || this.getDefaultRetryPolicy();
    const updatedPolicy = { ...currentPolicy, ...policy };
    this.retryPolicies.set(type, updatedPolicy);
    
    console.log(`[CancellationRetry] Updated retry policy for ${type}:`, updatedPolicy);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async processCancellation(request: CancellationRequest): Promise<void> {
    request.status = CancellationStatus.IN_PROGRESS;
    
    try {
      switch (request.type) {
        case CancellationType.BULK_VALIDATION:
          await this.cancelBulkValidation(request.targetId);
          break;
          
        case CancellationType.QUEUE_ITEM:
          await this.cancelQueueItem(request.targetId);
          break;
          
        case CancellationType.QUEUE_BATCH:
          await this.cancelQueueBatch(request.targetId);
          break;
          
        case CancellationType.INDIVIDUAL_RESOURCE:
          await this.cancelIndividualResource(request.targetId);
          break;
          
        case CancellationType.PIPELINE:
          await this.cancelPipeline(request.targetId);
          break;
          
        default:
          throw new Error(`Unsupported cancellation type: ${request.type}`);
      }

      request.status = CancellationStatus.COMPLETED;
      request.completedAt = new Date();
      
      console.log(`[CancellationRetry] Cancellation completed: ${request.id}`);
      this.emit('cancellationCompleted', { request });
      
    } catch (error) {
      request.status = CancellationStatus.FAILED;
      request.completedAt = new Date();
      request.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[CancellationRetry] Cancellation failed: ${request.id}`, error);
      this.emit('cancellationFailed', { request, error });
    }
  }

  private async cancelBulkValidation(targetId: string): Promise<void> {
    // Set global validation state to stop
    if (this.globalValidationState) {
      this.globalValidationState.shouldStop = true;
      this.globalValidationState.isRunning = false;
      this.globalValidationState.isPaused = false;
    }
    console.log(`[CancellationRetry] Bulk validation cancellation requested`);
  }

  private async cancelQueueItem(itemId: string): Promise<void> {
    const queueService = getValidationQueueService();
    const success = queueService.cancelValidation(itemId);
    if (!success) {
      throw new Error(`Failed to cancel queue item: ${itemId}`);
    }
    console.log(`[CancellationRetry] Queue item cancelled: ${itemId}`);
  }

  private async cancelQueueBatch(batchId: string): Promise<void> {
    const queueService = getValidationQueueService();
    const cancelledCount = queueService.cancelBatch(batchId);
    console.log(`[CancellationRetry] Queue batch cancelled: ${batchId} (${cancelledCount} items)`);
  }

  private async cancelIndividualResource(resourceId: string): Promise<void> {
    const progressService = getIndividualResourceProgressService();
    const success = progressService.cancelResourceProgress(resourceId);
    if (!success) {
      throw new Error(`Failed to cancel individual resource: ${resourceId}`);
    }
    console.log(`[CancellationRetry] Individual resource cancelled: ${resourceId}`);
  }

  private async cancelPipeline(requestId: string): Promise<void> {
    const pipeline = getValidationPipeline();
    await pipeline.cancelPipeline(requestId);
    console.log(`[CancellationRetry] Pipeline cancelled: ${requestId}`);
  }

  private scheduleRetry(request: RetryRequest, policy: RetryPolicy): void {
    request.status = RetryStatus.SCHEDULED;
    request.nextRetryAt = new Date(Date.now() + request.retryDelayMs);
    
    const timer = setTimeout(async () => {
      await this.executeRetry(request, policy);
    }, request.retryDelayMs);
    
    this.retryTimers.set(request.id, timer);
    
    console.log(`[CancellationRetry] Retry scheduled: ${request.id} (delay: ${request.retryDelayMs}ms)`);
    this.emit('retryScheduled', { request });
  }

  private async executeRetry(request: RetryRequest, policy: RetryPolicy): Promise<void> {
    request.status = RetryStatus.IN_PROGRESS;
    request.attempts++;
    
    this.retryTimers.delete(request.id);
    
    try {
      console.log(`[CancellationRetry] Executing retry: ${request.id} (attempt ${request.attempts}/${request.maxRetryAttempts})`);
      
      // Execute the retry based on type
      switch (request.type) {
        case RetryType.BULK_VALIDATION:
          await this.retryBulkValidation(request.targetId);
          break;
          
        case RetryType.QUEUE_ITEM:
          await this.retryQueueItem(request.targetId);
          break;
          
        case RetryType.INDIVIDUAL_RESOURCE:
          await this.retryIndividualResource(request.targetId);
          break;
          
        case RetryType.PIPELINE:
          await this.retryPipeline(request.targetId);
          break;
          
        default:
          throw new Error(`Unsupported retry type: ${request.type}`);
      }

      request.status = RetryStatus.COMPLETED;
      request.completedAt = new Date();
      
      console.log(`[CancellationRetry] Retry completed: ${request.id}`);
      this.emit('retryCompleted', { request });
      
    } catch (error) {
      console.error(`[CancellationRetry] Retry failed: ${request.id} (attempt ${request.attempts})`, error);
      
      // Check if we should retry again
      if (request.attempts < request.maxRetryAttempts) {
        // Calculate next retry delay with exponential backoff
        const nextDelay = this.calculateNextRetryDelay(request.retryDelayMs, policy, request.attempts);
        request.retryDelayMs = nextDelay;
        
        console.log(`[CancellationRetry] Scheduling next retry: ${request.id} (delay: ${nextDelay}ms)`);
        this.scheduleRetry(request, policy);
      } else {
        request.status = RetryStatus.EXHAUSTED;
        request.completedAt = new Date();
        request.error = error instanceof Error ? error.message : 'Unknown error';
        
        console.log(`[CancellationRetry] Retry exhausted: ${request.id} (${request.attempts} attempts)`);
        this.emit('retryExhausted', { request, error });
      }
    }
  }

  private calculateNextRetryDelay(currentDelay: number, policy: RetryPolicy, attempt: number): number {
    if (!policy.exponentialBackoff) {
      return Math.min(currentDelay, policy.maxRetryDelayMs);
    }
    
    const newDelay = currentDelay * policy.backoffMultiplier;
    return Math.min(newDelay, policy.maxRetryDelayMs);
  }

  private async retryBulkValidation(targetId: string): Promise<void> {
    // Implementation would restart bulk validation
    console.log(`[CancellationRetry] Retrying bulk validation: ${targetId}`);
    throw new Error('Bulk validation retry not implemented yet');
  }

  private async retryQueueItem(targetId: string): Promise<void> {
    // Implementation would requeue the item
    console.log(`[CancellationRetry] Retrying queue item: ${targetId}`);
    throw new Error('Queue item retry not implemented yet');
  }

  private async retryIndividualResource(targetId: string): Promise<void> {
    // Implementation would restart individual resource validation
    console.log(`[CancellationRetry] Retrying individual resource: ${targetId}`);
    throw new Error('Individual resource retry not implemented yet');
  }

  private async retryPipeline(requestId: string): Promise<void> {
    // Implementation would restart pipeline
    console.log(`[CancellationRetry] Retrying pipeline: ${requestId}`);
    throw new Error('Pipeline retry not implemented yet');
  }

  private async getActiveOperations(type: CancellationType): Promise<{ id: string; type: string }[]> {
    // Implementation would query active operations based on type
    return [];
  }

  private async getFailedOperations(type: RetryType): Promise<{ id: string; type: string }[]> {
    // Implementation would query failed operations based on type
    return [];
  }

  private async getOriginalAttemptCount(type: RetryType, targetId: string): Promise<number> {
    // Implementation would get original attempt count
    return 0;
  }

  private getRetryPolicy(type: RetryType, customPolicy?: Partial<RetryPolicy>): RetryPolicy {
    const defaultPolicy = this.retryPolicies.get(type) || this.getDefaultRetryPolicy();
    return { ...defaultPolicy, ...customPolicy };
  }

  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      maxRetryAttempts: 3,
      retryDelayMs: 5000,
      exponentialBackoff: true,
      backoffMultiplier: 2,
      maxRetryDelayMs: 60000,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR'],
      nonRetryableErrors: ['VALIDATION_ERROR', 'AUTHENTICATION_ERROR', 'PERMISSION_ERROR']
    };
  }

  private initializeRetryPolicies(): void {
    // Set default policies for each retry type
    Object.values(RetryType).forEach(type => {
      this.retryPolicies.set(type, this.getDefaultRetryPolicy());
    });
    
    console.log('[CancellationRetry] Initialized default retry policies');
  }

  private setupCleanupInterval(): void {
    // Clean up old requests every hour
    setInterval(() => {
      this.clearOldRequests(24); // 24 hours
    }, 60 * 60 * 1000); // 1 hour
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const getValidationCancellationRetryService = (): ValidationCancellationRetryService => {
  return ValidationCancellationRetryService.getInstance();
};
