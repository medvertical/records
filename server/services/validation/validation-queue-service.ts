/**
 * Validation Queue Service - Background Processing Queue Management
 * 
 * This service manages a queue of validation tasks for background processing,
 * providing priority-based processing, retry mechanisms, and progress tracking.
 */

import { EventEmitter } from 'events';
import { getValidationPipeline, type ValidationRequest, type ValidationResult } from './validation-pipeline';
import { getValidationSettingsService } from './validation-settings-service';
import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationQueueItem {
  id: string;
  priority: ValidationPriority;
  type: ValidationQueueItemType;
  request: ValidationRequest;
  context: ValidationQueueContext;
  status: ValidationQueueItemStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
  result?: ValidationResult;
}

export interface ValidationQueueContext {
  requestedBy: string;
  requestId: string;
  batchId?: string;
  metadata?: Record<string, any>;
}

export enum ValidationPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

export enum ValidationQueueItemType {
  SINGLE_RESOURCE = 'single_resource',
  BATCH_RESOURCES = 'batch_resources',
  FULL_SERVER = 'full_server',
  PAGE_VALIDATION = 'page_validation'
}

export enum ValidationQueueItemStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

export interface ValidationQueueConfig {
  maxConcurrentValidations: number;
  maxQueueSize: number;
  retryAttempts: number;
  retryDelayMs: number;
  processingIntervalMs: number;
  enablePriorityProcessing: boolean;
  enableRetryMechanism: boolean;
}

export interface ValidationQueueStats {
  totalItems: number;
  queuedItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  cancelledItems: number;
  averageProcessingTimeMs: number;
  queueSizeByPriority: Record<ValidationPriority, number>;
  itemsByType: Record<ValidationQueueItemType, number>;
}

// ============================================================================
// Validation Queue Service
// ============================================================================

export class ValidationQueueService extends EventEmitter {
  private static instance: ValidationQueueService;
  private queue: ValidationQueueItem[] = [];
  private processingItems: Map<string, ValidationQueueItem> = new Map();
  private config: ValidationQueueConfig;
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private settingsService = getValidationSettingsService();

  private constructor(config?: Partial<ValidationQueueConfig>) {
    super();
    
    this.config = {
      maxConcurrentValidations: 8,
      maxQueueSize: 10000,
      retryAttempts: 3,
      retryDelayMs: 5000,
      processingIntervalMs: 1000,
      enablePriorityProcessing: true,
      enableRetryMechanism: true,
      ...config
    };

    this.setupEventHandlers();
  }

  public static getInstance(config?: Partial<ValidationQueueConfig>): ValidationQueueService {
    if (!ValidationQueueService.instance) {
      ValidationQueueService.instance = new ValidationQueueService(config);
    }
    return ValidationQueueService.instance;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Add validation request to queue
   */
  public async queueValidation(
    request: ValidationRequest,
    context: ValidationQueueContext,
    priority: ValidationPriority = ValidationPriority.NORMAL,
    type: ValidationQueueItemType = ValidationQueueItemType.SINGLE_RESOURCE,
    maxAttempts?: number
  ): Promise<string> {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue is full. Maximum size: ${this.config.maxQueueSize}`);
    }

    const item: ValidationQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      priority,
      type,
      request,
      context,
      status: ValidationQueueItemStatus.QUEUED,
      attempts: 0,
      maxAttempts: maxAttempts || this.config.retryAttempts,
      createdAt: new Date(),
      scheduledAt: new Date()
    };

    this.queue.push(item);
    
    console.log(`[ValidationQueue] Queued validation item: ${item.id} (priority: ${priority}, type: ${type})`);
    
    this.emit('itemQueued', { item });
    this.emit('queueStatsChanged', this.getStats());
    
    return item.id;
  }

  /**
   * Add batch of validation requests to queue
   */
  public async queueBatchValidation(
    requests: ValidationRequest[],
    context: ValidationQueueContext,
    priority: ValidationPriority = ValidationPriority.NORMAL,
    maxAttempts?: number
  ): Promise<string[]> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const itemIds: string[] = [];

    for (const request of requests) {
      const contextWithBatch: ValidationQueueContext = {
        ...context,
        batchId
      };

      const itemId = await this.queueValidation(
        request,
        contextWithBatch,
        priority,
        ValidationQueueItemType.BATCH_RESOURCES,
        maxAttempts
      );
      
      itemIds.push(itemId);
    }

    console.log(`[ValidationQueue] Queued batch validation: ${batchId} with ${requests.length} items`);
    
    return itemIds;
  }

  /**
   * Cancel validation item
   */
  public cancelValidation(itemId: string): boolean {
    const item = this.queue.find(item => item.id === itemId);
    if (item && item.status === ValidationQueueItemStatus.QUEUED) {
      item.status = ValidationQueueItemStatus.CANCELLED;
      console.log(`[ValidationQueue] Cancelled validation item: ${itemId}`);
      
      this.emit('itemCancelled', { item });
      this.emit('queueStatsChanged', this.getStats());
      
      return true;
    }

    // Check if it's currently processing
    const processingItem = this.processingItems.get(itemId);
    if (processingItem) {
      processingItem.status = ValidationQueueItemStatus.CANCELLED;
      console.log(`[ValidationQueue] Marked processing item for cancellation: ${itemId}`);
      
      this.emit('itemCancelled', { item: processingItem });
      
      return true;
    }

    return false;
  }

  /**
   * Cancel all validation items in a batch
   */
  public cancelBatch(batchId: string): number {
    const items = this.queue.filter(item => item.context.batchId === batchId);
    let cancelledCount = 0;

    for (const item of items) {
      if (this.cancelValidation(item.id)) {
        cancelledCount++;
      }
    }

    console.log(`[ValidationQueue] Cancelled batch: ${batchId} (${cancelledCount} items)`);
    return cancelledCount;
  }

  /**
   * Get queue statistics
   */
  public getStats(): ValidationQueueStats {
    const totalItems = this.queue.length + this.processingItems.size;
    const queuedItems = this.queue.filter(item => item.status === ValidationQueueItemStatus.QUEUED).length;
    const processingItems = this.processingItems.size;
    const completedItems = this.queue.filter(item => item.status === ValidationQueueItemStatus.COMPLETED).length;
    const failedItems = this.queue.filter(item => item.status === ValidationQueueItemStatus.FAILED).length;
    const cancelledItems = this.queue.filter(item => item.status === ValidationQueueItemStatus.CANCELLED).length;

    // Calculate queue size by priority
    const queueSizeByPriority: Record<ValidationPriority, number> = {
      [ValidationPriority.LOW]: 0,
      [ValidationPriority.NORMAL]: 0,
      [ValidationPriority.HIGH]: 0,
      [ValidationPriority.URGENT]: 0
    };

    for (const item of this.queue) {
      if (item.status === ValidationQueueItemStatus.QUEUED) {
        queueSizeByPriority[item.priority]++;
      }
    }

    // Calculate items by type
    const itemsByType: Record<ValidationQueueItemType, number> = {
      [ValidationQueueItemType.SINGLE_RESOURCE]: 0,
      [ValidationQueueItemType.BATCH_RESOURCES]: 0,
      [ValidationQueueItemType.FULL_SERVER]: 0,
      [ValidationQueueItemType.PAGE_VALIDATION]: 0
    };

    for (const item of [...this.queue, ...this.processingItems.values()]) {
      itemsByType[item.type]++;
    }

    // Calculate average processing time
    const completedItemsWithTime = this.queue.filter(item => 
      item.status === ValidationQueueItemStatus.COMPLETED && 
      item.startedAt && 
      item.completedAt
    );
    
    const averageProcessingTimeMs = completedItemsWithTime.length > 0
      ? completedItemsWithTime.reduce((sum, item) => 
          sum + (item.completedAt!.getTime() - item.startedAt!.getTime()), 0
        ) / completedItemsWithTime.length
      : 0;

    return {
      totalItems,
      queuedItems,
      processingItems,
      completedItems,
      failedItems,
      cancelledItems,
      averageProcessingTimeMs,
      queueSizeByPriority,
      itemsByType
    };
  }

  /**
   * Get queue items by status
   */
  public getQueueItems(status?: ValidationQueueItemStatus): ValidationQueueItem[] {
    if (status) {
      return this.queue.filter(item => item.status === status);
    }
    return [...this.queue];
  }

  /**
   * Get processing items
   */
  public getProcessingItems(): ValidationQueueItem[] {
    return [...this.processingItems.values()];
  }

  /**
   * Clear completed and failed items from queue
   */
  public clearCompletedItems(): number {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => 
      item.status !== ValidationQueueItemStatus.COMPLETED && 
      item.status !== ValidationQueueItemStatus.FAILED
    );
    
    const clearedCount = initialLength - this.queue.length;
    if (clearedCount > 0) {
      console.log(`[ValidationQueue] Cleared ${clearedCount} completed/failed items from queue`);
      this.emit('queueStatsChanged', this.getStats());
    }
    
    return clearedCount;
  }

  /**
   * Start queue processing
   */
  public startProcessing(): void {
    if (this.isProcessing) {
      console.log('[ValidationQueue] Queue processing is already running');
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.processingIntervalMs);

    console.log('[ValidationQueue] Started queue processing');
    this.emit('processingStarted');
  }

  /**
   * Stop queue processing
   */
  public stopProcessing(): void {
    if (!this.isProcessing) {
      console.log('[ValidationQueue] Queue processing is not running');
      return;
    }

    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    console.log('[ValidationQueue] Stopped queue processing');
    this.emit('processingStopped');
  }

  /**
   * Update queue configuration
   */
  public updateConfig(newConfig: Partial<ValidationQueueConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[ValidationQueue] Updated configuration:', newConfig);
    this.emit('configUpdated', { config: this.config });
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async processQueue(): Promise<void> {
    if (this.processingItems.size >= this.config.maxConcurrentValidations) {
      return; // Already at max concurrency
    }

    const availableSlots = this.config.maxConcurrentValidations - this.processingItems.size;
    const itemsToProcess = this.getNextItemsToProcess(availableSlots);

    for (const item of itemsToProcess) {
      this.processItem(item);
    }
  }

  private getNextItemsToProcess(count: number): ValidationQueueItem[] {
    const queuedItems = this.queue.filter(item => item.status === ValidationQueueItemStatus.QUEUED);
    
    if (this.config.enablePriorityProcessing) {
      // Sort by priority (highest first), then by creation time (oldest first)
      queuedItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    } else {
      // Sort by creation time (oldest first)
      queuedItems.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return queuedItems.slice(0, count);
  }

  private async processItem(item: ValidationQueueItem): Promise<void> {
    item.status = ValidationQueueItemStatus.PROCESSING;
    item.attempts++;
    item.startedAt = new Date();

    // Move from queue to processing
    this.queue = this.queue.filter(queueItem => queueItem.id !== item.id);
    this.processingItems.set(item.id, item);

    console.log(`[ValidationQueue] Processing item: ${item.id} (attempt ${item.attempts}/${item.maxAttempts})`);

    this.emit('itemProcessingStarted', { item });
    this.emit('queueStatsChanged', this.getStats());

    try {
      const pipeline = getValidationPipeline();
      const result = await pipeline.executePipeline({
        resources: [item.request],
        context: item.context
      });

      if (result.results.length > 0) {
        item.result = result.results[0];
        item.status = ValidationQueueItemStatus.COMPLETED;
        item.completedAt = new Date();

        console.log(`[ValidationQueue] Completed item: ${item.id}`);
        
        this.emit('itemCompleted', { item, result: item.result });
      } else {
        throw new Error('No validation results returned');
      }

    } catch (error) {
      item.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      if (item.attempts < item.maxAttempts && this.config.enableRetryMechanism) {
        item.status = ValidationQueueItemStatus.RETRYING;
        
        // Schedule retry
        setTimeout(() => {
          item.status = ValidationQueueItemStatus.QUEUED;
          this.queue.push(item);
          this.processingItems.delete(item.id);
          
          console.log(`[ValidationQueue] Retrying item: ${item.id} (attempt ${item.attempts + 1}/${item.maxAttempts})`);
          
          this.emit('itemRetrying', { item, error: item.lastError });
          this.emit('queueStatsChanged', this.getStats());
        }, this.config.retryDelayMs);
        
      } else {
        item.status = ValidationQueueItemStatus.FAILED;
        item.completedAt = new Date();
        
        console.log(`[ValidationQueue] Failed item: ${item.id} (${item.attempts} attempts)`);
        
        this.emit('itemFailed', { item, error: item.lastError });
      }
    }

    // Remove from processing
    this.processingItems.delete(item.id);
    this.emit('queueStatsChanged', this.getStats());
  }

  private setupEventHandlers(): void {
    // Handle settings changes
    this.settingsService.on('settingsChanged', (event) => {
      console.log('[ValidationQueue] Validation settings changed, clearing cache');
      // Could implement cache invalidation or queue reprioritization here
    });
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const getValidationQueueService = (config?: Partial<ValidationQueueConfig>): ValidationQueueService => {
  return ValidationQueueService.getInstance(config);
};
