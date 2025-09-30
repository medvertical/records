/**
 * Simple Validation Queue Service
 * MVP implementation for enqueueing resources for revalidation
 * 
 * This is a placeholder for Task 5.0 (Queue orchestration)
 * Will be replaced with full queue implementation later
 */

export interface ValidationQueueItem {
  serverId: number;
  resourceType: string;
  fhirId: string;
  priority: 'high' | 'normal'; // edit/batch-edit = high, batch = normal
  enqueuedAt: Date;
}

class SimpleValidationQueue {
  private queue: ValidationQueueItem[] = [];
  private processing = false;
  
  /**
   * Enqueue a resource for revalidation
   */
  enqueue(item: Omit<ValidationQueueItem, 'enqueuedAt'>): void {
    const queueItem: ValidationQueueItem = {
      ...item,
      enqueuedAt: new Date(),
    };
    
    // Insert with priority (high priority first)
    if (item.priority === 'high') {
      // Find first normal priority item and insert before it
      const normalIndex = this.queue.findIndex(q => q.priority === 'normal');
      if (normalIndex >= 0) {
        this.queue.splice(normalIndex, 0, queueItem);
      } else {
        this.queue.push(queueItem);
      }
    } else {
      this.queue.push(queueItem);
    }
    
    console.log(`Enqueued ${item.resourceType}/${item.fhirId} for revalidation (priority: ${item.priority})`);
  }
  
  /**
   * Enqueue multiple resources
   */
  enqueueBatch(items: Omit<ValidationQueueItem, 'enqueuedAt'>[]): void {
    items.forEach(item => this.enqueue(item));
  }
  
  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      highPriorityCount: this.queue.filter(q => q.priority === 'high').length,
      normalPriorityCount: this.queue.filter(q => q.priority === 'normal').length,
    };
  }
  
  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    console.log('Validation queue cleared');
  }
}

// Singleton instance
export const validationQueue = new SimpleValidationQueue();
