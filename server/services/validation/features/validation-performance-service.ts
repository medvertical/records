/**
 * Validation Performance Service
 * 
 * This service provides performance optimizations for handling large datasets (800K+ resources),
 * including intelligent caching, database indexing, pagination, and memory management.
 */

import { EventEmitter } from 'events';
import { storage } from '../../../storage';
import { cacheManager, CACHE_TAGS } from '../../../utils/cache-manager.js';
import { logger } from '../../../utils/logger.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PerformanceConfig {
  maxConcurrentRequests: number;
  batchSize: number;
  cacheTTL: number;
  memoryThreshold: number;
  paginationLimit: number;
  indexOptimization: boolean;
  queryTimeout: number;
}

export interface PerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queueLength: number;
  errorRate: number;
  throughput: number;
}

export interface QueryPerformance {
  queryId: string;
  startTime: number;
  endTime: number;
  duration: number;
  resultCount: number;
  cacheHit: boolean;
  memoryUsed: number;
  error?: string;
}

export interface BatchOperation {
  id: string;
  type: 'validation' | 'query' | 'index' | 'cache';
  startTime: number;
  totalItems: number;
  processedItems: number;
  completedItems: number;
  failedItems: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  estimatedCompletion?: number;
  error?: string;
}

export interface IndexOptimization {
  tableName: string;
  indexName: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  status: 'pending' | 'creating' | 'created' | 'failed';
  size: number;
  usage: number;
  lastUsed: Date;
}

// ============================================================================
// Validation Performance Service
// ============================================================================

export class ValidationPerformanceService extends EventEmitter {
  private static instance: ValidationPerformanceService;
  private config: PerformanceConfig;
  private activeBatches: Map<string, BatchOperation> = new Map();
  private queryMetrics: Map<string, QueryPerformance> = new Map();
  private performanceHistory: QueryPerformance[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;

  private constructor() {
    super();
    this.config = this.getDefaultConfig();
    this.setupPerformanceMonitoring();
  }

  public static getInstance(): ValidationPerformanceService {
    if (!ValidationPerformanceService.instance) {
      ValidationPerformanceService.instance = new ValidationPerformanceService();
    }
    return ValidationPerformanceService.instance;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Get current performance configuration
   */
  public getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update performance configuration
   */
  public updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Performance configuration updated', { 
      service: 'validation-performance-service', 
      operation: 'updateConfig',
      config: this.config 
    });
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.getCpuUsage();
    const activeConnections = this.getActiveConnections();
    const queueLength = this.getQueueLength();
    
    // Calculate cache hit rate
    const cacheHitRate = this.calculateCacheHitRate();
    
    // Calculate average response time
    const averageResponseTime = this.calculateAverageResponseTime();
    
    // Calculate error rate
    const errorRate = this.calculateErrorRate();
    
    // Calculate throughput
    const throughput = this.calculateThroughput();

    return {
      totalRequests: this.performanceHistory.length,
      averageResponseTime,
      cacheHitRate,
      memoryUsage,
      cpuUsage,
      activeConnections,
      queueLength,
      errorRate,
      throughput
    };
  }

  /**
   * Optimize database indexes for better performance
   */
  public async optimizeIndexes(): Promise<IndexOptimization[]> {
    const startTime = Date.now();
    logger.info('Starting database index optimization', { 
      service: 'validation-performance-service', 
      operation: 'optimizeIndexes' 
    });

    try {
      const indexes = await this.getRecommendedIndexes();
      const optimizationResults: IndexOptimization[] = [];

      for (const index of indexes) {
        try {
          const result = await this.createIndex(index);
          optimizationResults.push(result);
        } catch (error) {
          logger.error('Failed to create index', { 
            service: 'validation-performance-service', 
            operation: 'optimizeIndexes',
            index: index.indexName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          optimizationResults.push({
            ...index,
            status: 'failed',
            size: 0,
            usage: 0,
            lastUsed: new Date()
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Database index optimization completed', { 
        service: 'validation-performance-service', 
        operation: 'optimizeIndexes',
        duration,
        indexesCreated: optimizationResults.filter(r => r.status === 'created').length,
        indexesFailed: optimizationResults.filter(r => r.status === 'failed').length
      });

      return optimizationResults;
    } catch (error) {
      logger.error('Database index optimization failed', { 
        service: 'validation-performance-service', 
        operation: 'optimizeIndexes',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a batch operation for processing large datasets
   */
  public createBatchOperation(
    type: BatchOperation['type'],
    totalItems: number,
    operationId?: string
  ): BatchOperation {
    const id = operationId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batch: BatchOperation = {
      id,
      type,
      startTime: Date.now(),
      totalItems,
      processedItems: 0,
      completedItems: 0,
      failedItems: 0,
      status: 'pending',
      progress: 0
    };

    this.activeBatches.set(id, batch);
    this.emit('batchCreated', batch);
    
    logger.info('Batch operation created', { 
      service: 'validation-performance-service', 
      operation: 'createBatchOperation',
      batchId: id,
      type,
      totalItems
    });

    return batch;
  }

  /**
   * Update batch operation progress
   */
  public updateBatchProgress(
    batchId: string,
    processedItems: number,
    completedItems: number,
    failedItems: number
  ): void {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      logger.warn('Batch operation not found', { 
        service: 'validation-performance-service', 
        operation: 'updateBatchProgress',
        batchId
      });
      return;
    }

    batch.processedItems = processedItems;
    batch.completedItems = completedItems;
    batch.failedItems = failedItems;
    batch.progress = (processedItems / batch.totalItems) * 100;

    // Estimate completion time
    if (processedItems > 0) {
      const elapsedTime = Date.now() - batch.startTime;
      const rate = processedItems / elapsedTime;
      const remainingItems = batch.totalItems - processedItems;
      batch.estimatedCompletion = Date.now() + (remainingItems / rate);
    }

    this.emit('batchProgress', batch);
    
    // Mark as completed if all items are processed
    if (processedItems >= batch.totalItems) {
      batch.status = 'completed';
      this.emit('batchCompleted', batch);
      logger.info('Batch operation completed', { 
        service: 'validation-performance-service', 
        operation: 'updateBatchProgress',
        batchId,
        totalItems: batch.totalItems,
        completedItems: batch.completedItems,
        failedItems: batch.failedItems
      });
    }
  }

  /**
   * Get batch operation status
   */
  public getBatchStatus(batchId: string): BatchOperation | null {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Get all active batch operations
   */
  public getActiveBatches(): BatchOperation[] {
    return Array.from(this.activeBatches.values());
  }

  /**
   * Cancel a batch operation
   */
  public cancelBatch(batchId: string): boolean {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return false;
    }

    batch.status = 'cancelled';
    this.emit('batchCancelled', batch);
    
    logger.info('Batch operation cancelled', { 
      service: 'validation-performance-service', 
      operation: 'cancelBatch',
      batchId
    });

    return true;
  }

  /**
   * Execute a query with performance monitoring
   */
  public async executeQuery<T>(
    queryId: string,
    queryFn: () => Promise<T>,
    useCache: boolean = true
  ): Promise<T> {
    const startTime = Date.now();
    const queryPerformance: QueryPerformance = {
      queryId,
      startTime,
      endTime: 0,
      duration: 0,
      resultCount: 0,
      cacheHit: false,
      memoryUsed: 0
    };

    try {
      // Check cache first if enabled
      if (useCache) {
        const cacheKey = `query_${queryId}`;
        const cached = cacheManager.get<T>(cacheKey);
        if (cached) {
          queryPerformance.cacheHit = true;
          queryPerformance.endTime = Date.now();
          queryPerformance.duration = queryPerformance.endTime - queryPerformance.startTime;
          queryPerformance.memoryUsed = this.getMemoryUsage();
          
          this.recordQueryPerformance(queryPerformance);
          return cached;
        }
      }

      // Execute the query
      const result = await queryFn();
      
      // Cache the result if enabled
      if (useCache && result) {
        const cacheKey = `query_${queryId}`;
        cacheManager.set(cacheKey, result, {
          ttl: this.config.cacheTTL,
          tags: [CACHE_TAGS.PERFORMANCE, CACHE_TAGS.QUERY]
        });
      }

      // Record performance metrics
      queryPerformance.endTime = Date.now();
      queryPerformance.duration = queryPerformance.endTime - queryPerformance.startTime;
      queryPerformance.memoryUsed = this.getMemoryUsage();
      queryPerformance.resultCount = Array.isArray(result) ? result.length : 1;

      this.recordQueryPerformance(queryPerformance);
      
      logger.debug('Query executed successfully', { 
        service: 'validation-performance-service', 
        operation: 'executeQuery',
        queryId,
        duration: queryPerformance.duration,
        resultCount: queryPerformance.resultCount,
        cacheHit: queryPerformance.cacheHit
      });

      return result;
    } catch (error) {
      queryPerformance.endTime = Date.now();
      queryPerformance.duration = queryPerformance.endTime - queryPerformance.startTime;
      queryPerformance.error = error instanceof Error ? error.message : 'Unknown error';
      queryPerformance.memoryUsed = this.getMemoryUsage();

      this.recordQueryPerformance(queryPerformance);
      
      logger.error('Query execution failed', { 
        service: 'validation-performance-service', 
        operation: 'executeQuery',
        queryId,
        duration: queryPerformance.duration,
        error: queryPerformance.error
      });

      throw error;
    }
  }

  /**
   * Optimize memory usage
   */
  public optimizeMemory(): void {
    const memoryUsage = this.getMemoryUsage();
    
    if (memoryUsage > this.config.memoryThreshold) {
      logger.warn('Memory usage exceeds threshold, performing optimization', { 
        service: 'validation-performance-service', 
        operation: 'optimizeMemory',
        memoryUsage,
        threshold: this.config.memoryThreshold
      });

      // Clear old query metrics
      this.performanceHistory = this.performanceHistory.slice(-this.MAX_HISTORY_SIZE / 2);
      
      // Clear old batch operations
      const now = Date.now();
      for (const [id, batch] of this.activeBatches.entries()) {
        if (batch.status === 'completed' && (now - batch.startTime) > 3600000) { // 1 hour
          this.activeBatches.delete(id);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      logger.info('Memory optimization completed', { 
        service: 'validation-performance-service', 
        operation: 'optimizeMemory',
        newMemoryUsage: this.getMemoryUsage()
      });
    }
  }

  /**
   * Get query performance history
   */
  public getQueryPerformanceHistory(limit: number = 100): QueryPerformance[] {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * Clear performance history
   */
  public clearPerformanceHistory(): void {
    this.performanceHistory = [];
    this.queryMetrics.clear();
    this.activeBatches.clear();
    logger.info('Performance history cleared', { 
      service: 'validation-performance-service', 
      operation: 'clearPerformanceHistory'
    });
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private getDefaultConfig(): PerformanceConfig {
    return {
      maxConcurrentRequests: 8,
      batchSize: 1000,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      memoryThreshold: 512 * 1024 * 1024, // 512 MB
      paginationLimit: 1000,
      indexOptimization: true,
      queryTimeout: 30000 // 30 seconds
    };
  }

  private setupPerformanceMonitoring(): void {
    // Monitor memory usage every 30 seconds
    setInterval(() => {
      this.optimizeMemory();
    }, 30000);

    // Clean up old performance data every 5 minutes
    setInterval(() => {
      this.cleanupPerformanceData();
    }, 5 * 60 * 1000);
  }

  private cleanupPerformanceData(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Remove old performance history
    this.performanceHistory = this.performanceHistory.filter(
      entry => (now - entry.startTime) < maxAge
    );

    // Remove old batch operations
    for (const [id, batch] of this.activeBatches.entries()) {
      if (batch.status === 'completed' && (now - batch.startTime) > maxAge) {
        this.activeBatches.delete(id);
      }
    }

    logger.debug('Performance data cleanup completed', { 
      service: 'validation-performance-service', 
      operation: 'cleanupPerformanceData',
      historyEntries: this.performanceHistory.length,
      activeBatches: this.activeBatches.size
    });
  }

  private recordQueryPerformance(performance: QueryPerformance): void {
    this.queryMetrics.set(performance.queryId, performance);
    this.performanceHistory.push(performance);

    // Keep history size manageable
    if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
      this.performanceHistory = this.performanceHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  private getMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }

  private getCpuUsage(): number {
    // TODO: Implement actual CPU usage calculation
    return 25; // Mock value
  }

  private getActiveConnections(): number {
    return this.activeBatches.size;
  }

  private getQueueLength(): number {
    return Array.from(this.activeBatches.values()).filter(
      batch => batch.status === 'pending' || batch.status === 'running'
    ).length;
  }

  private calculateCacheHitRate(): number {
    if (this.performanceHistory.length === 0) return 0;
    
    const cacheHits = this.performanceHistory.filter(entry => entry.cacheHit).length;
    return (cacheHits / this.performanceHistory.length) * 100;
  }

  private calculateAverageResponseTime(): number {
    if (this.performanceHistory.length === 0) return 0;
    
    const totalDuration = this.performanceHistory.reduce(
      (sum, entry) => sum + entry.duration, 0
    );
    return totalDuration / this.performanceHistory.length;
  }

  private calculateErrorRate(): number {
    if (this.performanceHistory.length === 0) return 0;
    
    const errors = this.performanceHistory.filter(entry => entry.error).length;
    return (errors / this.performanceHistory.length) * 100;
  }

  private calculateThroughput(): number {
    if (this.performanceHistory.length === 0) return 0;
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentQueries = this.performanceHistory.filter(
      entry => entry.startTime > oneMinuteAgo
    );
    
    return recentQueries.length;
  }

  private async getRecommendedIndexes(): Promise<Omit<IndexOptimization, 'status' | 'size' | 'usage' | 'lastUsed'>[]> {
    // Return recommended indexes for validation tables
    return [
      {
        tableName: 'validation_results',
        indexName: 'idx_validation_results_resource_id',
        columns: ['resource_id'],
        type: 'btree'
      },
      {
        tableName: 'validation_results',
        indexName: 'idx_validation_results_resource_type',
        columns: ['resource_type'],
        type: 'btree'
      },
      {
        tableName: 'validation_results',
        indexName: 'idx_validation_results_created_at',
        columns: ['created_at'],
        type: 'btree'
      },
      {
        tableName: 'validation_results',
        indexName: 'idx_validation_results_is_valid',
        columns: ['is_valid'],
        type: 'btree'
      },
      {
        tableName: 'validation_aspects',
        indexName: 'idx_validation_aspects_result_id',
        columns: ['result_id'],
        type: 'btree'
      },
      {
        tableName: 'validation_aspects',
        indexName: 'idx_validation_aspects_aspect_type',
        columns: ['aspect_type'],
        type: 'btree'
      }
    ];
  }

  private async createIndex(index: Omit<IndexOptimization, 'status' | 'size' | 'usage' | 'lastUsed'>): Promise<IndexOptimization> {
    // TODO: Implement actual index creation
    // This would use the database connection to create indexes
    
    logger.info('Creating database index', { 
      service: 'validation-performance-service', 
      operation: 'createIndex',
      tableName: index.tableName,
      indexName: index.indexName,
      columns: index.columns,
      type: index.type
    });

    // Mock index creation
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      ...index,
      status: 'created',
      size: Math.floor(Math.random() * 1000000), // Mock size
      usage: Math.floor(Math.random() * 100), // Mock usage percentage
      lastUsed: new Date()
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const getValidationPerformanceService = (): ValidationPerformanceService => {
  return ValidationPerformanceService.getInstance();
};
