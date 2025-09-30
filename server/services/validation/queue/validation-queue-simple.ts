import { validationEnginePerAspect, type ValidationSettingsSnapshot } from '../engine/validation-engine-per-aspect';

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
    
    // Start processing if not already processing
    if (!this.processing) {
      this.startProcessing().catch(err => {
        console.error('Queue processing error:', err);
      });
    }
  }
  
  /**
   * Enqueue multiple resources
   */
  enqueueBatch(items: Omit<ValidationQueueItem, 'enqueuedAt'>[]): void {
    items.forEach(item => this.enqueue(item));
  }
  
  /**
   * Start processing queue (simple implementation)
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;
      
      try {
        console.log(`Processing validation for ${item.resourceType}/${item.fhirId}`);
        
        // TODO: Fetch resource from FHIR server
        // TODO: Get current settings
        // For now, use mock settings
        const mockSettings: ValidationSettingsSnapshot = {
          aspects: {
            structural: { enabled: true },
            profile: { enabled: true },
            terminology: { enabled: true },
            reference: { enabled: true },
            businessRule: { enabled: true },
            metadata: { enabled: true },
          },
        };
        
        // TODO: Fetch actual resource
        const mockResource = {
          resourceType: item.resourceType,
          id: item.fhirId,
        };
        
        // Validate resource
        await validationEnginePerAspect.validateResource(
          item.serverId,
          item.resourceType,
          item.fhirId,
          mockResource,
          mockSettings
        );
        
        console.log(`Completed validation for ${item.resourceType}/${item.fhirId}`);
      } catch (error) {
        console.error(`Failed to process ${item.resourceType}/${item.fhirId}:`, error);
      }
    }
    
    this.processing = false;
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
