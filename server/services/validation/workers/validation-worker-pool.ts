/**
 * Validation Worker Pool Manager
 * 
 * Task 9.2: Worker pool with configurable size and task distribution
 * 
 * Features:
 * - Dynamic worker pool sizing (based on CPU cores)
 * - Task queue with priority scheduling
 * - Worker health monitoring and restart
 * - Graceful shutdown
 * - Back-pressure control
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import type { WorkerMessage, WorkerResponse, ValidateMessage } from './validation-worker';

// ============================================================================
// Types
// ============================================================================

export interface WorkerPoolOptions {
  maxWorkers?: number; // Default: CPU cores - 1
  maxQueueDepth?: number; // Task 9.13: Back-pressure limit
  taskTimeout?: number; // Timeout per task (ms)
}

export interface ValidationTask {
  id: string;
  priority: 'high' | 'normal' | 'low'; // Task 9.7: Priority scheduling
  resource: any;
  resourceType: string;
  settings: any;
  fhirVersion?: 'R4' | 'R5' | 'R6';
  callback: (error: Error | null, result?: any) => void;
  timestamp: number;
}

interface WorkerInfo {
  worker: Worker;
  id: number;
  busy: boolean;
  currentTaskId?: string;
  tasksProcessed: number;
  errors: number;
  avgDuration: number;
  lastActivity: number;
}

// ============================================================================
// ValidationWorkerPool Class
// ============================================================================

export class ValidationWorkerPool extends EventEmitter {
  private workers: WorkerInfo[] = [];
  private taskQueue: ValidationTask[] = [];
  private activeTasks = new Map<string, ValidationTask>();
  private options: Required<WorkerPoolOptions>;
  private isShuttingDown = false;
  private workerIdCounter = 0;

  constructor(options: WorkerPoolOptions = {}) {
    super();

    const cpuCount = os.cpus().length;

    this.options = {
      maxWorkers: options.maxWorkers || Math.max(1, cpuCount - 1),
      maxQueueDepth: options.maxQueueDepth || 1000,
      taskTimeout: options.taskTimeout || 30000 // 30s default
    };

    console.log(`[WorkerPool] Initializing pool with ${this.options.maxWorkers} worker(s)`);
  }

  // ==========================================================================
  // Task 9.6: Task Distribution
  // ==========================================================================

  /**
   * Add task to queue with priority
   */
  async addTask(task: ValidationTask): Promise<void> {
    // Task 9.13: Check back-pressure
    if (this.taskQueue.length >= this.options.maxQueueDepth) {
      throw new Error(`Task queue is full (max: ${this.options.maxQueueDepth})`);
    }

    // Task 9.7: Priority insertion
    const insertIndex = this.findInsertIndex(task.priority);
    this.taskQueue.splice(insertIndex, 0, task);

    this.emit('taskQueued', {
      taskId: task.id,
      queueDepth: this.taskQueue.length,
      priority: task.priority
    });

    // Try to process immediately
    this.processNextTask();
  }

  /**
   * Task 9.7: Find insertion index for priority scheduling
   */
  private findInsertIndex(priority: 'high' | 'normal' | 'low'): number {
    const priorityValue = { high: 3, normal: 2, low: 1 };
    const taskPriority = priorityValue[priority];

    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedPriority = priorityValue[this.taskQueue[i].priority];
      if (taskPriority > queuedPriority) {
        return i;
      }
    }

    return this.taskQueue.length;
  }

  /**
   * Process next task from queue
   */
  private async processNextTask(): Promise<void> {
    if (this.isShuttingDown || this.taskQueue.length === 0) {
      return;
    }

    // Find available worker
    const worker = this.findAvailableWorker();
    if (!worker) {
      // Start new worker if under limit
      if (this.workers.length < this.options.maxWorkers) {
        await this.startWorker();
        return this.processNextTask();
      }
      return; // All workers busy
    }

    // Get next task
    const task = this.taskQueue.shift();
    if (!task) return;

    // Assign task to worker
    this.assignTaskToWorker(task, worker);
  }

  /**
   * Assign task to specific worker
   */
  private assignTaskToWorker(task: ValidationTask, workerInfo: WorkerInfo): void {
    workerInfo.busy = true;
    workerInfo.currentTaskId = task.id;
    workerInfo.lastActivity = Date.now();

    this.activeTasks.set(task.id, task);

    // Send task to worker
    const message: ValidateMessage = {
      type: 'validate',
      id: task.id,
      resource: task.resource,
      resourceType: task.resourceType,
      settings: task.settings,
      fhirVersion: task.fhirVersion
    };

    workerInfo.worker.postMessage(message);

    // Set timeout
    const timeout = setTimeout(() => {
      this.handleTaskTimeout(task.id, workerInfo);
    }, this.options.taskTimeout);

    // Store timeout reference
    (task as any).timeoutHandle = timeout;

    this.emit('taskStarted', {
      taskId: task.id,
      workerId: workerInfo.id,
      queueDepth: this.taskQueue.length
    });
  }

  // ==========================================================================
  // Worker Management
  // ==========================================================================

  /**
   * Start new worker
   */
  private async startWorker(): Promise<void> {
    const workerId = this.workerIdCounter++;
    const workerPath = path.join(__dirname, 'validation-worker.js');

    try {
      const worker = new Worker(workerPath, {
        workerData: { workerId }
      });

      const workerInfo: WorkerInfo = {
        worker,
        id: workerId,
        busy: false,
        tasksProcessed: 0,
        errors: 0,
        avgDuration: 0,
        lastActivity: Date.now()
      };

      // Set up event handlers
      worker.on('message', (response: WorkerResponse) => {
        this.handleWorkerMessage(response, workerInfo);
      });

      worker.on('error', (error) => {
        this.handleWorkerError(error, workerInfo);
      });

      worker.on('exit', (code) => {
        this.handleWorkerExit(code, workerInfo);
      });

      this.workers.push(workerInfo);

      console.log(`[WorkerPool] Worker ${workerId} started`);

      this.emit('workerStarted', { workerId });

    } catch (error: any) {
      console.error(`[WorkerPool] Failed to start worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Find available worker
   */
  private findAvailableWorker(): WorkerInfo | null {
    return this.workers.find(w => !w.busy && !this.isShuttingDown) || null;
  }

  // ==========================================================================
  // Task 9.8: Worker Health Monitoring
  // ==========================================================================

  /**
   * Handle worker message
   */
  private handleWorkerMessage(response: WorkerResponse, workerInfo: WorkerInfo): void {
    workerInfo.lastActivity = Date.now();

    switch (response.type) {
      case 'ready':
        console.log(`[WorkerPool] Worker ${workerInfo.id} is ready`);
        break;

      case 'progress':
        this.emit('taskProgress', {
          taskId: response.id,
          progress: response.progress
        });
        break;

      case 'result':
        this.handleTaskResult(response, workerInfo);
        break;

      case 'error':
        this.handleTaskError(response, workerInfo);
        break;
    }
  }

  /**
   * Handle task result
   */
  private handleTaskResult(response: WorkerResponse, workerInfo: WorkerInfo): void {
    const task = this.activeTasks.get(response.id);
    if (!task) return;

    // Clear timeout
    if ((task as any).timeoutHandle) {
      clearTimeout((task as any).timeoutHandle);
    }

    // Update worker stats
    workerInfo.busy = false;
    workerInfo.currentTaskId = undefined;
    workerInfo.tasksProcessed++;

    if (response.data?.duration) {
      workerInfo.avgDuration = 
        (workerInfo.avgDuration * (workerInfo.tasksProcessed - 1) + response.data.duration) / 
        workerInfo.tasksProcessed;
    }

    // Call task callback
    task.callback(null, response.data);

    this.activeTasks.delete(response.id);

    this.emit('taskCompleted', {
      taskId: response.id,
      workerId: workerInfo.id,
      duration: response.data?.duration
    });

    // Process next task
    this.processNextTask();
  }

  /**
   * Handle task error
   */
  private handleTaskError(response: WorkerResponse, workerInfo: WorkerInfo): void {
    const task = this.activeTasks.get(response.id);
    if (!task) return;

    // Clear timeout
    if ((task as any).timeoutHandle) {
      clearTimeout((task as any).timeoutHandle);
    }

    // Update worker stats
    workerInfo.busy = false;
    workerInfo.currentTaskId = undefined;
    workerInfo.errors++;

    // Call task callback with error
    task.callback(new Error(response.error || 'Validation failed'));

    this.activeTasks.delete(response.id);

    this.emit('taskFailed', {
      taskId: response.id,
      workerId: workerInfo.id,
      error: response.error
    });

    // Process next task
    this.processNextTask();
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string, workerInfo: WorkerInfo): void {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    console.error(`[WorkerPool] Task ${taskId} timed out after ${this.options.taskTimeout}ms`);

    // Task 9.8: Restart crashed/hung worker
    this.restartWorker(workerInfo);

    // Call task callback with timeout error
    task.callback(new Error(`Task timed out after ${this.options.taskTimeout}ms`));

    this.activeTasks.delete(taskId);

    this.emit('taskTimeout', {
      taskId,
      workerId: workerInfo.id
    });
  }

  /**
   * Task 9.8: Restart worker
   */
  private async restartWorker(workerInfo: WorkerInfo): Promise<void> {
    console.log(`[WorkerPool] Restarting worker ${workerInfo.id}...`);

    // Terminate old worker
    await workerInfo.worker.terminate();

    // Remove from pool
    const index = this.workers.indexOf(workerInfo);
    if (index > -1) {
      this.workers.splice(index, 1);
    }

    // Start new worker
    try {
      await this.startWorker();
    } catch (error) {
      console.error('[WorkerPool] Failed to restart worker:', error);
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(error: Error, workerInfo: WorkerInfo): void {
    console.error(`[WorkerPool] Worker ${workerInfo.id} error:`, error);
    this.restartWorker(workerInfo);
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(code: number, workerInfo: WorkerInfo): void {
    console.log(`[WorkerPool] Worker ${workerInfo.id} exited with code ${code}`);

    // Remove from pool
    const index = this.workers.indexOf(workerInfo);
    if (index > -1) {
      this.workers.splice(index, 1);
    }

    // Restart if not shutting down
    if (!this.isShuttingDown && code !== 0) {
      this.startWorker();
    }
  }

  // ==========================================================================
  // Task 9.9: Graceful Shutdown
  // ==========================================================================

  /**
   * Shutdown worker pool gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;

    console.log('[WorkerPool] Shutting down worker pool...');

    // Wait for active tasks to complete (with timeout)
    const shutdownTimeout = 30000; // 30s
    const startTime = Date.now();

    while (this.activeTasks.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(
      this.workers.map(w => w.worker.terminate())
    );

    this.workers = [];
    this.taskQueue = [];
    this.activeTasks.clear();

    console.log('[WorkerPool] Worker pool shut down successfully');

    this.emit('shutdown');
  }

  // ==========================================================================
  // Task 9.12: Worker Metrics
  // ==========================================================================

  /**
   * Get worker pool metrics
   */
  getMetrics() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      idleWorkers: this.workers.filter(w => !w.busy).length,
      queueDepth: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      workers: this.workers.map(w => ({
        id: w.id,
        busy: w.busy,
        tasksProcessed: w.tasksProcessed,
        errors: w.errors,
        avgDuration: Math.round(w.avgDuration),
        currentTaskId: w.currentTaskId
      }))
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let workerPool: ValidationWorkerPool | null = null;

export function getWorkerPool(options?: WorkerPoolOptions): ValidationWorkerPool {
  if (!workerPool) {
    workerPool = new ValidationWorkerPool(options);
  }
  return workerPool;
}

export default ValidationWorkerPool;

