/**
 * Request Queue Service
 * 
 * Implements a queue with configurable concurrency to prevent overwhelming
 * the FHIR server with too many parallel requests.
 * 
 * Features:
 * - Configurable max concurrent requests
 * - Request deduplication
 * - Priority support
 * - Queue statistics
 */

interface QueuedRequest<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  priority: number;
  addedAt: number;
}

interface QueueConfig {
  maxConcurrent: number;
  deduplicateWindow: number;
  timeout: number;
}

interface QueueStats {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  deduplicated: number;
}

export class RequestQueue {
  private config: QueueConfig;
  private queue: QueuedRequest<any>[] = [];
  private activeRequests: Map<string, Promise<any>> = new Map();
  private recentRequests: Map<string, { result: any; timestamp: number }> = new Map();
  private stats: QueueStats = {
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deduplicated: 0,
  };

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 8,
      deduplicateWindow: config.deduplicateWindow || 5000,
      timeout: config.timeout || 30000,
    };

    // Clean up old deduplication entries periodically
    setInterval(() => this.cleanupRecentRequests(), 10000);
  }

  /**
   * Enqueue a request with optional deduplication
   */
  async enqueue<T>(
    requestId: string,
    fn: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    // Check if request is already active
    if (this.activeRequests.has(requestId)) {
      this.stats.deduplicated++;
      console.log(`[RequestQueue] Deduplicating active request: ${requestId}`);
      return this.activeRequests.get(requestId)!;
    }

    // Check recent completed requests (deduplication window)
    const recent = this.recentRequests.get(requestId);
    if (recent && Date.now() - recent.timestamp < this.config.deduplicateWindow) {
      this.stats.deduplicated++;
      console.log(`[RequestQueue] Returning cached result for: ${requestId}`);
      return recent.result;
    }

    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        fn,
        resolve,
        reject,
        priority,
        addedAt: Date.now(),
      };

      this.queue.push(queuedRequest);
      this.stats.pending = this.queue.length;
      
      console.log(`[RequestQueue] Queued: ${requestId} (priority: ${priority}, queue size: ${this.queue.length}, active: ${this.activeRequests.size})`);

      // Process queue
      this.processQueue();
    });
  }

  /**
   * Process pending requests up to max concurrency
   */
  private async processQueue() {
    while (
      this.queue.length > 0 &&
      this.activeRequests.size < this.config.maxConcurrent
    ) {
      // Sort by priority (higher first), then by addedAt (FIFO)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.addedAt - b.addedAt;
      });

      const request = this.queue.shift()!;
      this.stats.pending = this.queue.length;
      this.stats.active = this.activeRequests.size + 1;

      this.executeRequest(request);
    }
  }

  /**
   * Execute a single request
   */
  private async executeRequest<T>(request: QueuedRequest<T>) {
    const { id, fn, resolve, reject } = request;

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, rej) => {
      setTimeout(() => {
        rej(new Error(`Request timeout: ${id}`));
      }, this.config.timeout);
    });

    // Execute with timeout
    const requestPromise = fn();
    this.activeRequests.set(id, requestPromise);

    try {
      const result = await Promise.race([requestPromise, timeoutPromise]);
      
      // Cache result for deduplication
      this.recentRequests.set(id, {
        result,
        timestamp: Date.now(),
      });

      this.stats.completed++;
      resolve(result);
      console.log(`[RequestQueue] Completed: ${id} (queue: ${this.queue.length}, active: ${this.activeRequests.size - 1})`);
    } catch (error) {
      this.stats.failed++;
      console.error(`[RequestQueue] Failed: ${id}`, error instanceof Error ? error.message : error);
      reject(error);
    } finally {
      this.activeRequests.delete(id);
      this.stats.active = this.activeRequests.size;
      
      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Clean up old deduplication entries
   */
  private cleanupRecentRequests() {
    const now = Date.now();
    const cutoff = now - this.config.deduplicateWindow * 2;

    for (const [key, value] of this.recentRequests.entries()) {
      if (value.timestamp < cutoff) {
        this.recentRequests.delete(key);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Clear the queue (useful for testing)
   */
  clear() {
    this.queue = [];
    this.activeRequests.clear();
    this.recentRequests.clear();
    this.stats = {
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      deduplicated: 0,
    };
  }
}

// Global singleton instance
let globalQueue: RequestQueue | null = null;

export function getRequestQueue(): RequestQueue {
  if (!globalQueue) {
    globalQueue = new RequestQueue({
      maxConcurrent: 8,
      deduplicateWindow: 5000,
      timeout: 30000,
    });
  }
  return globalQueue;
}

