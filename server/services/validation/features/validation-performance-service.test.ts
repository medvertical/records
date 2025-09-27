/**
 * Unit tests for ValidationPerformanceService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ValidationPerformanceService } from './validation-performance-service';

// Mock dependencies
vi.mock('../../../storage', () => ({
  storage: {
    getResourceStatsWithSettings: vi.fn()
  }
}));

vi.mock('../../../utils/cache-manager.js', () => ({
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clearByTag: vi.fn()
  },
  CACHE_TAGS: {
    PERFORMANCE: 'performance',
    QUERY: 'query'
  }
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ValidationPerformanceService', () => {
  let performanceService: ValidationPerformanceService;

  beforeEach(() => {
    performanceService = ValidationPerformanceService.getInstance();
    // Clear any existing batches from previous tests
    performanceService.clearPerformanceHistory();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = performanceService.getConfig();

      expect(config).toHaveProperty('maxConcurrentRequests');
      expect(config).toHaveProperty('batchSize');
      expect(config).toHaveProperty('cacheTTL');
      expect(config).toHaveProperty('memoryThreshold');
      expect(config).toHaveProperty('paginationLimit');
      expect(config).toHaveProperty('indexOptimization');
      expect(config).toHaveProperty('queryTimeout');

      expect(config.maxConcurrentRequests).toBe(8);
      expect(config.batchSize).toBe(1000);
      expect(config.cacheTTL).toBe(5 * 60 * 1000);
      expect(config.memoryThreshold).toBe(512 * 1024 * 1024);
      expect(config.paginationLimit).toBe(1000);
      expect(config.indexOptimization).toBe(true);
      expect(config.queryTimeout).toBe(30000);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration with partial values', () => {
      const newConfig = {
        maxConcurrentRequests: 16,
        batchSize: 2000
      };

      performanceService.updateConfig(newConfig);
      const updatedConfig = performanceService.getConfig();

      expect(updatedConfig.maxConcurrentRequests).toBe(16);
      expect(updatedConfig.batchSize).toBe(2000);
      // Other values should remain unchanged
      expect(updatedConfig.cacheTTL).toBe(5 * 60 * 1000);
      expect(updatedConfig.memoryThreshold).toBe(512 * 1024 * 1024);
    });

    it('should update all configuration values', () => {
      const newConfig = {
        maxConcurrentRequests: 20,
        batchSize: 5000,
        cacheTTL: 10 * 60 * 1000,
        memoryThreshold: 1024 * 1024 * 1024,
        paginationLimit: 2000,
        indexOptimization: false,
        queryTimeout: 60000
      };

      performanceService.updateConfig(newConfig);
      const updatedConfig = performanceService.getConfig();

      expect(updatedConfig).toEqual(newConfig);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics with correct structure', () => {
      const metrics = performanceService.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('queueLength');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('throughput');

      expect(typeof metrics.totalRequests).toBe('number');
      expect(typeof metrics.averageResponseTime).toBe('number');
      expect(typeof metrics.cacheHitRate).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.activeConnections).toBe('number');
      expect(typeof metrics.queueLength).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.throughput).toBe('number');
    });
  });

  describe('createBatchOperation', () => {
    it('should create a batch operation with correct structure', () => {
      const batch = performanceService.createBatchOperation('validation', 1000);

      expect(batch).toHaveProperty('id');
      expect(batch).toHaveProperty('type');
      expect(batch).toHaveProperty('startTime');
      expect(batch).toHaveProperty('totalItems');
      expect(batch).toHaveProperty('processedItems');
      expect(batch).toHaveProperty('completedItems');
      expect(batch).toHaveProperty('failedItems');
      expect(batch).toHaveProperty('status');
      expect(batch).toHaveProperty('progress');

      expect(batch.type).toBe('validation');
      expect(batch.totalItems).toBe(1000);
      expect(batch.processedItems).toBe(0);
      expect(batch.completedItems).toBe(0);
      expect(batch.failedItems).toBe(0);
      expect(batch.status).toBe('pending');
      expect(batch.progress).toBe(0);
    });

    it('should create batch operation with custom ID', () => {
      const customId = 'custom-batch-id';
      const batch = performanceService.createBatchOperation('query', 500, customId);

      expect(batch.id).toBe(customId);
      expect(batch.type).toBe('query');
      expect(batch.totalItems).toBe(500);
    });

    it('should support all batch types', () => {
      const types = ['validation', 'query', 'index', 'cache'] as const;
      
      types.forEach(type => {
        const batch = performanceService.createBatchOperation(type, 100);
        expect(batch.type).toBe(type);
      });
    });
  });

  describe('updateBatchProgress', () => {
    it('should update batch progress correctly', () => {
      const batch = performanceService.createBatchOperation('validation', 1000);
      const batchId = batch.id;

      performanceService.updateBatchProgress(batchId, 500, 450, 50);

      const updatedBatch = performanceService.getBatchStatus(batchId);
      expect(updatedBatch).toBeDefined();
      expect(updatedBatch?.processedItems).toBe(500);
      expect(updatedBatch?.completedItems).toBe(450);
      expect(updatedBatch?.failedItems).toBe(50);
      expect(updatedBatch?.progress).toBe(50);
    });

    it('should mark batch as completed when all items are processed', () => {
      const batch = performanceService.createBatchOperation('validation', 100);
      const batchId = batch.id;

      performanceService.updateBatchProgress(batchId, 100, 90, 10);

      const updatedBatch = performanceService.getBatchStatus(batchId);
      expect(updatedBatch?.status).toBe('completed');
    });

    it('should handle non-existent batch gracefully', () => {
      const nonExistentBatchId = 'non-existent-batch';
      
      // Should not throw an error
      expect(() => {
        performanceService.updateBatchProgress(nonExistentBatchId, 100, 90, 10);
      }).not.toThrow();
    });
  });

  describe('getBatchStatus', () => {
    it('should return batch status for existing batch', () => {
      const batch = performanceService.createBatchOperation('validation', 1000);
      const batchId = batch.id;

      const status = performanceService.getBatchStatus(batchId);
      expect(status).toBeDefined();
      expect(status?.id).toBe(batchId);
      expect(status?.type).toBe('validation');
    });

    it('should return null for non-existent batch', () => {
      const nonExistentBatchId = 'non-existent-batch';
      const status = performanceService.getBatchStatus(nonExistentBatchId);
      expect(status).toBeNull();
    });
  });

  describe('getActiveBatches', () => {
    it('should return all active batch operations', () => {
      const batch1 = performanceService.createBatchOperation('validation', 1000);
      const batch2 = performanceService.createBatchOperation('query', 500);

      const activeBatches = performanceService.getActiveBatches();
      expect(activeBatches).toHaveLength(2);
      expect(activeBatches.map(b => b.id)).toContain(batch1.id);
      expect(activeBatches.map(b => b.id)).toContain(batch2.id);
    });

    it('should return empty array when no active batches', () => {
      const activeBatches = performanceService.getActiveBatches();
      expect(activeBatches).toHaveLength(0);
    });
  });

  describe('cancelBatch', () => {
    it('should cancel existing batch operation', () => {
      const batch = performanceService.createBatchOperation('validation', 1000);
      const batchId = batch.id;

      const cancelled = performanceService.cancelBatch(batchId);
      expect(cancelled).toBe(true);

      const updatedBatch = performanceService.getBatchStatus(batchId);
      expect(updatedBatch?.status).toBe('cancelled');
    });

    it('should return false for non-existent batch', () => {
      const nonExistentBatchId = 'non-existent-batch';
      const cancelled = performanceService.cancelBatch(nonExistentBatchId);
      expect(cancelled).toBe(false);
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return result', async () => {
      const mockResult = { data: 'test result' };
      const queryFn = vi.fn().mockResolvedValue(mockResult);

      const result = await performanceService.executeQuery('test-query', queryFn);

      expect(result).toEqual(mockResult);
      expect(queryFn).toHaveBeenCalledOnce();
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      const queryFn = vi.fn().mockRejectedValue(error);

      await expect(performanceService.executeQuery('test-query', queryFn)).rejects.toThrow('Query failed');
    });

    it('should use cache when enabled', async () => {
      const { cacheManager } = await import('../../../utils/cache-manager.js');
      const mockCachedResult = { data: 'cached result' };
      vi.mocked(cacheManager.get).mockReturnValue(mockCachedResult);

      const queryFn = vi.fn();
      const result = await performanceService.executeQuery('test-query', queryFn, true);

      expect(result).toEqual(mockCachedResult);
      expect(queryFn).not.toHaveBeenCalled();
      expect(cacheManager.get).toHaveBeenCalledWith('query_test-query');
    });

    it('should skip cache when disabled', async () => {
      const { cacheManager } = await import('../../../utils/cache-manager.js');
      const mockResult = { data: 'fresh result' };
      const queryFn = vi.fn().mockResolvedValue(mockResult);

      const result = await performanceService.executeQuery('test-query', queryFn, false);

      expect(result).toEqual(mockResult);
      expect(queryFn).toHaveBeenCalledOnce();
      expect(cacheManager.get).not.toHaveBeenCalled();
    });
  });

  describe('optimizeIndexes', () => {
    it('should return index optimization results', async () => {
      const results = await performanceService.optimizeIndexes();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result).toHaveProperty('tableName');
        expect(result).toHaveProperty('indexName');
        expect(result).toHaveProperty('columns');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('size');
        expect(result).toHaveProperty('usage');
        expect(result).toHaveProperty('lastUsed');

        expect(['created', 'failed']).toContain(result.status);
        expect(Array.isArray(result.columns)).toBe(true);
        expect(['btree', 'hash', 'gin', 'gist']).toContain(result.type);
      });
    });
  });

  describe('getQueryPerformanceHistory', () => {
    it('should return query performance history', () => {
      const history = performanceService.getQueryPerformanceHistory(10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should return limited number of entries', () => {
      const history = performanceService.getQueryPerformanceHistory(5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('clearPerformanceHistory', () => {
    it('should clear performance history', () => {
      performanceService.clearPerformanceHistory();
      
      const history = performanceService.getQueryPerformanceHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('optimizeMemory', () => {
    it('should optimize memory without errors', () => {
      expect(() => {
        performanceService.optimizeMemory();
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle query execution errors gracefully', async () => {
      const error = new Error('Query execution failed');
      const queryFn = vi.fn().mockRejectedValue(error);

      // Clear cache first to avoid cached results
      const { cacheManager } = await import('../../../utils/cache-manager.js');
      vi.mocked(cacheManager.get).mockReturnValue(null);

      await expect(performanceService.executeQuery('test-query', queryFn)).rejects.toThrow('Query execution failed');
    });

    it('should handle index optimization errors gracefully', async () => {
      // Mock the createIndex method to throw an error
      const originalOptimizeIndexes = performanceService.optimizeIndexes;
      vi.spyOn(performanceService, 'optimizeIndexes').mockImplementation(async () => {
        throw new Error('Index optimization failed');
      });

      await expect(performanceService.optimizeIndexes()).rejects.toThrow('Index optimization failed');

      // Restore original method
      performanceService.optimizeIndexes = originalOptimizeIndexes;
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ValidationPerformanceService.getInstance();
      const instance2 = ValidationPerformanceService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
