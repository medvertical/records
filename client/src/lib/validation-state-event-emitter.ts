// ============================================================================
// Validation State Event Emitter - Real-time state change notifications
// ============================================================================

import { ValidationProgress } from '../hooks/use-validation-polling';

export type ValidationStateEventType = 
  | 'validation-started'
  | 'validation-paused'
  | 'validation-resumed'
  | 'validation-stopped'
  | 'validation-completed'
  | 'validation-error'
  | 'progress-updated'
  | 'status-changed'
  | 'connection-state-changed'
  | 'server-changed';

export interface ValidationStateEvent {
  type: ValidationStateEventType;
  timestamp: Date;
  data: {
    previousState?: string;
    currentState: string;
    progress?: ValidationProgress | null;
    error?: string;
    serverId?: number;
    serverName?: string;
    serverUrl?: string;
    connectionState?: 'disconnected' | 'connecting' | 'connected' | 'error';
    metadata?: Record<string, any>;
  };
}

export type ValidationStateEventListener = (event: ValidationStateEvent) => void;

export class ValidationStateEventEmitter {
  private listeners: Map<ValidationStateEventType, Set<ValidationStateEventListener>> = new Map();
  private allListeners: Set<ValidationStateEventListener> = new Set();
  private eventHistory: ValidationStateEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to specific event types
   */
  on(eventType: ValidationStateEventType, listener: ValidationStateEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(listener: ValidationStateEventListener): () => void {
    this.allListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.allListeners.delete(listener);
    };
  }

  /**
   * Emit an event to all relevant listeners
   */
  emit(eventType: ValidationStateEventType, data: ValidationStateEvent['data']): void {
    const event: ValidationStateEvent = {
      type: eventType,
      timestamp: new Date(),
      data
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify specific listeners
    const specificListeners = this.listeners.get(eventType);
    if (specificListeners) {
      specificListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[ValidationStateEventEmitter] Error in listener for ${eventType}:`, error);
        }
      });
    }

    // Notify all listeners
    this.allListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[ValidationStateEventEmitter] Error in all-events listener:`, error);
      }
    });

    // Log event for debugging
    console.log(`[ValidationStateEventEmitter] Emitted ${eventType}:`, {
      timestamp: event.timestamp.toISOString(),
      currentState: data.currentState,
      previousState: data.previousState
    });
  }

  /**
   * Get recent event history
   */
  getEventHistory(limit?: number): ValidationStateEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType(eventType: ValidationStateEventType, limit?: number): ValidationStateEvent[] {
    const events = this.eventHistory.filter(event => event.type === eventType);
    if (limit) {
      return events.slice(-limit);
    }
    return events;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get listener counts for debugging
   */
  getListenerCounts(): Record<ValidationStateEventType, number> {
    const counts: Record<string, number> = {};
    
    for (const [eventType, listeners] of this.listeners.entries()) {
      counts[eventType] = listeners.size;
    }
    
    return counts as Record<ValidationStateEventType, number>;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }

  /**
   * Check if there are any listeners for a specific event type
   */
  hasListeners(eventType: ValidationStateEventType): boolean {
    return this.listeners.has(eventType) && this.listeners.get(eventType)!.size > 0;
  }

  /**
   * Get total listener count
   */
  getTotalListenerCount(): number {
    let total = this.allListeners.size;
    for (const listeners of this.listeners.values()) {
      total += listeners.size;
    }
    return total;
  }
}

// Global singleton instance
let globalEventEmitter: ValidationStateEventEmitter | null = null;

/**
 * Get the global validation state event emitter instance
 */
export function getValidationStateEventEmitter(): ValidationStateEventEmitter {
  if (!globalEventEmitter) {
    globalEventEmitter = new ValidationStateEventEmitter();
  }
  return globalEventEmitter;
}

/**
 * Create a new validation state event emitter instance
 */
export function createValidationStateEventEmitter(): ValidationStateEventEmitter {
  return new ValidationStateEventEmitter();
}

/**
 * Helper functions for common event emissions
 */
export const ValidationStateEventHelpers = {
  /**
   * Emit validation started event
   */
  emitValidationStarted(progress: ValidationProgress | null, serverId?: number): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('validation-started', {
      previousState: 'idle',
      currentState: 'running',
      progress,
      serverId,
      metadata: { action: 'start' }
    });
  },

  /**
   * Emit validation paused event
   */
  emitValidationPaused(progress: ValidationProgress | null): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('validation-paused', {
      previousState: 'running',
      currentState: 'paused',
      progress,
      metadata: { action: 'pause' }
    });
  },

  /**
   * Emit validation resumed event
   */
  emitValidationResumed(progress: ValidationProgress | null): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('validation-resumed', {
      previousState: 'paused',
      currentState: 'running',
      progress,
      metadata: { action: 'resume' }
    });
  },

  /**
   * Emit validation stopped event
   */
  emitValidationStopped(progress: ValidationProgress | null): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('validation-stopped', {
      previousState: 'running',
      currentState: 'idle',
      progress,
      metadata: { action: 'stop' }
    });
  },

  /**
   * Emit validation completed event
   */
  emitValidationCompleted(progress: ValidationProgress | null): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('validation-completed', {
      previousState: 'running',
      currentState: 'completed',
      progress,
      metadata: { action: 'complete' }
    });
  },

  /**
   * Emit validation error event
   */
  emitValidationError(error: string, progress: ValidationProgress | null): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('validation-error', {
      previousState: 'running',
      currentState: 'error',
      progress,
      error,
      metadata: { action: 'error' }
    });
  },

  /**
   * Emit progress updated event
   */
  emitProgressUpdated(progress: ValidationProgress | null, previousProgress?: ValidationProgress | null): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('progress-updated', {
      currentState: progress?.status || 'idle',
      progress,
      metadata: { 
        action: 'progress-update',
        previousProgress: previousProgress ? {
          processedResources: previousProgress.processedResources,
          totalResources: previousProgress.totalResources,
          status: previousProgress.status
        } : null
      }
    });
  },

  /**
   * Emit status changed event
   */
  emitStatusChanged(previousStatus: string, currentStatus: string, progress: ValidationProgress | null): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('status-changed', {
      previousState: previousStatus,
      currentState: currentStatus,
      progress,
      metadata: { action: 'status-change' }
    });
  },

  /**
   * Emit connection state changed event
   */
  emitConnectionStateChanged(connectionState: 'disconnected' | 'connecting' | 'connected' | 'error', error?: string): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('connection-state-changed', {
      currentState: connectionState,
      connectionState,
      error,
      metadata: { action: 'connection-change' }
    });
  },

  /**
   * Emit server changed event
   */
  emitServerChanged(serverId: number, serverName: string, serverUrl: string): void {
    const emitter = getValidationStateEventEmitter();
    emitter.emit('server-changed', {
      currentState: 'server-changed',
      serverId,
      serverName,
      serverUrl,
      metadata: { action: 'server-change' }
    });
  }
};

