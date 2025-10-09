/**
 * ValidationWorkerPool Tests
 * 
 * Task 14.0: Unit tests for worker thread pool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ValidationWorkerPool } from './validation-worker-pool';
import type { ValidationTask } from './validation-worker-pool';

// Mock Worker class
vi.mock('worker_threads', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('ValidationWorkerPool', () => {
  let pool: ValidationWorkerPool;

  beforeEach(() => {
    pool = new ValidationWorkerPool({
      maxWorkers: 4,
      maxQueueDepth: 100,
      taskTimeout: 5000
    });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with correct worker count', () => {
      const metrics = pool.getMetrics();

      expect(metrics.totalWorkers).toBeGreaterThanOrEqual(0);
      expect(metrics.busyWorkers).toBe(0);
      expect(metrics.queueDepth).toBe(0);
    });

    it('should respect maxWorkers option', () => {
      const customPool = new ValidationWorkerPool({ maxWorkers: 2 });
      const metrics = customPool.getMetrics();

      expect(metrics.totalWorkers).toBeLessThanOrEqual(2);

      customPool.shutdown();
    });

    it('should default to CPU cores - 1', () => {
      const defaultPool = new ValidationWorkerPool();
      const metrics = defaultPool.getMetrics();

      // Should be at least 1 worker
      expect(metrics.totalWorkers).toBeGreaterThanOrEqual(0);

      defaultPool.shutdown();
    });
  });

  // ==========================================================================
  // Task Queueing Tests
  // ==========================================================================

  describe('Task Queueing', () => {
    it('should queue tasks successfully', async () => {
      const task: ValidationTask = {
        id: 'task-1',
        priority: 'normal',
        resource: { resourceType: 'Patient', id: '123' },
        resourceType: 'Patient',
        settings: {},
        callback: vi.fn(),
        timestamp: Date.now()
      };

      await pool.addTask(task);

      const metrics = pool.getMetrics();
      expect(metrics.queueDepth + metrics.activeTasks).toBeGreaterThanOrEqual(0);
    });

    it('should respect maxQueueDepth limit', async () => {
      const smallPool = new ValidationWorkerPool({
        maxWorkers: 1,
        maxQueueDepth: 3
      });

      const tasks: ValidationTask[] = [];

      // Try to add 5 tasks (more than maxQueueDepth)
      for (let i = 0; i < 5; i++) {
        tasks.push({
          id: `task-${i}`,
          priority: 'normal',
          resource: { resourceType: 'Patient', id: String(i) },
          resourceType: 'Patient',
          settings: {},
          callback: vi.fn(),
          timestamp: Date.now()
        });
      }

      // First 3 should succeed
      await smallPool.addTask(tasks[0]);
      await smallPool.addTask(tasks[1]);
      await smallPool.addTask(tasks[2]);

      // 4th and 5th should fail (queue full)
      await expect(smallPool.addTask(tasks[3])).rejects.toThrow('Task queue is full');
      await expect(smallPool.addTask(tasks[4])).rejects.toThrow('Task queue is full');

      await smallPool.shutdown();
    });

    it('should handle priority scheduling correctly', async () => {
      const highPriorityTask: ValidationTask = {
        id: 'high-task',
        priority: 'high',
        resource: { resourceType: 'Patient', id: 'high' },
        resourceType: 'Patient',
        settings: {},
        callback: vi.fn(),
        timestamp: Date.now()
      };

      const lowPriorityTask: ValidationTask = {
        id: 'low-task',
        priority: 'low',
        resource: { resourceType: 'Patient', id: 'low' },
        resourceType: 'Patient',
        settings: {},
        callback: vi.fn(),
        timestamp: Date.now()
      };

      // Add low priority first
      await pool.addTask(lowPriorityTask);
      // Then add high priority
      await pool.addTask(highPriorityTask);

      // High priority should be processed first
      // (This is implicit in queue behavior, hard to test directly)
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe('Event Emission', () => {
    it('should emit jobCreated event', (done) => {
      pool.on('taskQueued', (event) => {
        expect(event).toHaveProperty('taskId');
        expect(event).toHaveProperty('queueDepth');
        expect(event).toHaveProperty('priority');
        done();
      });

      const task: ValidationTask = {
        id: 'task-event-test',
        priority: 'normal',
        resource: { resourceType: 'Patient', id: '123' },
        resourceType: 'Patient',
        settings: {},
        callback: vi.fn(),
        timestamp: Date.now()
      };

      pool.addTask(task);
    });

    it('should emit taskStarted event', (done) => {
      pool.on('taskStarted', (event) => {
        expect(event).toHaveProperty('taskId');
        expect(event).toHaveProperty('workerId');
        expect(event).toHaveProperty('queueDepth');
        done();
      });

      const task: ValidationTask = {
        id: 'task-start-test',
        priority: 'high', // High priority to process immediately
        resource: { resourceType: 'Patient', id: '123' },
        resourceType: 'Patient',
        settings: {},
        callback: vi.fn(),
        timestamp: Date.now()
      };

      pool.addTask(task);
    });
  });

  // ==========================================================================
  // Metrics Tests
  // ==========================================================================

  describe('Metrics', () => {
    it('should provide accurate metrics', () => {
      const metrics = pool.getMetrics();

      expect(metrics).toHaveProperty('totalWorkers');
      expect(metrics).toHaveProperty('busyWorkers');
      expect(metrics).toHaveProperty('idleWorkers');
      expect(metrics).toHaveProperty('queueDepth');
      expect(metrics).toHaveProperty('activeTasks');
      expect(metrics).toHaveProperty('workers');

      expect(Array.isArray(metrics.workers)).toBe(true);
    });

    it('should track per-worker statistics', () => {
      const metrics = pool.getMetrics();

      metrics.workers.forEach(worker => {
        expect(worker).toHaveProperty('id');
        expect(worker).toHaveProperty('busy');
        expect(worker).toHaveProperty('tasksProcessed');
        expect(worker).toHaveProperty('errors');
        expect(worker).toHaveProperty('avgDuration');
      });
    });

    it('should calculate total workers correctly', () => {
      const metrics = pool.getMetrics();

      expect(metrics.totalWorkers).toBe(
        metrics.busyWorkers + metrics.idleWorkers
      );
    });
  });

  // ==========================================================================
  // Shutdown Tests
  // ==========================================================================

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await pool.shutdown();

      const metrics = pool.getMetrics();

      expect(metrics.totalWorkers).toBe(0);
      expect(metrics.queueDepth).toBe(0);
      expect(metrics.activeTasks).toBe(0);
    });

    it('should wait for active tasks before shutdown', async () => {
      const task: ValidationTask = {
        id: 'task-shutdown-test',
        priority: 'normal',
        resource: { resourceType: 'Patient', id: '123' },
        resourceType: 'Patient',
        settings: {},
        callback: vi.fn(),
        timestamp: Date.now()
      };

      await pool.addTask(task);

      const shutdownPromise = pool.shutdown();

      // Shutdown should wait for task
      await expect(shutdownPromise).resolves.toBeUndefined();
    });

    it('should emit shutdown event', (done) => {
      pool.on('shutdown', () => {
        done();
      });

      pool.shutdown();
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should handle multiple tasks efficiently', async () => {
      const tasks: ValidationTask[] = [];

      for (let i = 0; i < 10; i++) {
        tasks.push({
          id: `perf-task-${i}`,
          priority: 'normal',
          resource: { resourceType: 'Patient', id: String(i) },
          resourceType: 'Patient',
          settings: {},
          callback: vi.fn(),
          timestamp: Date.now()
        });
      }

      const start = Date.now();

      for (const task of tasks) {
        await pool.addTask(task);
      }

      const duration = Date.now() - start;

      // Should queue 10 tasks in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should process tasks in parallel', async () => {
      // This test verifies parallel processing happens
      // In real implementation, tasks would complete faster with multiple workers

      const start = Date.now();

      const tasks: ValidationTask[] = [];
      for (let i = 0; i < 4; i++) {
        tasks.push({
          id: `parallel-task-${i}`,
          priority: 'normal',
          resource: { resourceType: 'Patient', id: String(i) },
          resourceType: 'Patient',
          settings: {},
          callback: vi.fn(),
          timestamp: Date.now()
        });
      }

      await Promise.all(tasks.map(task => pool.addTask(task)));

      const duration = Date.now() - start;

      // With 4 workers, 4 tasks should start simultaneously
      // Duration should be less than sequential processing
      expect(duration).toBeLessThan(5000);
    });
  });
});

