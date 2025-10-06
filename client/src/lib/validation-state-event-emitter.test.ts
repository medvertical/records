// ============================================================================
// Validation State Event Emitter Tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ValidationStateEventEmitter, 
  ValidationStateEventType,
  ValidationStateEventHelpers,
  getValidationStateEventEmitter,
  createValidationStateEventEmitter
} from './validation-state-event-emitter';
import { ValidationProgress } from '../hooks/use-validation-polling';

describe('ValidationStateEventEmitter', () => {
  let emitter: ValidationStateEventEmitter;
  let mockListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitter = new ValidationStateEventEmitter();
    mockListener = vi.fn();
  });

  describe('Event Subscription', () => {
    it('should subscribe to specific event types', () => {
      const unsubscribe = emitter.on('validation-started', mockListener);
      
      expect(emitter.hasListeners('validation-started')).toBe(true);
      expect(emitter.getListenerCounts()['validation-started']).toBe(1);
      
      unsubscribe();
      expect(emitter.hasListeners('validation-started')).toBe(false);
    });

    it('should subscribe to all events', () => {
      const unsubscribe = emitter.onAll(mockListener);
      
      expect(emitter.getTotalListenerCount()).toBe(1);
      
      unsubscribe();
      expect(emitter.getTotalListenerCount()).toBe(0);
    });

    it('should handle multiple listeners for the same event type', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      const unsubscribe1 = emitter.on('validation-started', listener1);
      const unsubscribe2 = emitter.on('validation-started', listener2);
      
      expect(emitter.getListenerCounts()['validation-started']).toBe(2);
      
      unsubscribe1();
      expect(emitter.getListenerCounts()['validation-started']).toBe(1);
      
      unsubscribe2();
      expect(emitter.getListenerCounts()['validation-started']).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit events to specific listeners', () => {
      emitter.on('validation-started', mockListener);
      
      emitter.emit('validation-started', {
        currentState: 'running',
        previousState: 'idle',
        progress: null
      });
      
      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'validation-started',
          data: expect.objectContaining({
            currentState: 'running',
            previousState: 'idle'
          })
        })
      );
    });

    it('should emit events to all listeners', () => {
      const allListener = vi.fn();
      emitter.onAll(allListener);
      
      emitter.emit('validation-started', {
        currentState: 'running',
        previousState: 'idle',
        progress: null
      });
      
      expect(allListener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();
      
      emitter.on('validation-started', errorListener);
      emitter.on('validation-started', normalListener);
      
      // Should not throw
      expect(() => {
        emitter.emit('validation-started', {
          currentState: 'running',
          previousState: 'idle',
          progress: null
        });
      }).not.toThrow();
      
      expect(normalListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event History', () => {
    it('should maintain event history', () => {
      emitter.emit('validation-started', {
        currentState: 'running',
        previousState: 'idle',
        progress: null
      });
      
      emitter.emit('validation-paused', {
        currentState: 'paused',
        previousState: 'running',
        progress: null
      });
      
      const history = emitter.getEventHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('validation-started');
      expect(history[1].type).toBe('validation-paused');
    });

    it('should limit event history size', () => {
      // Emit more events than maxHistorySize (default 100)
      for (let i = 0; i < 150; i++) {
        emitter.emit('validation-started', {
          currentState: 'running',
          previousState: 'idle',
          progress: null
        });
      }
      
      const history = emitter.getEventHistory();
      expect(history).toHaveLength(100);
    });

    it('should filter events by type', () => {
      emitter.emit('validation-started', {
        currentState: 'running',
        previousState: 'idle',
        progress: null
      });
      
      emitter.emit('validation-paused', {
        currentState: 'paused',
        previousState: 'running',
        progress: null
      });
      
      emitter.emit('validation-started', {
        currentState: 'running',
        previousState: 'paused',
        progress: null
      });
      
      const startedEvents = emitter.getEventsByType('validation-started');
      expect(startedEvents).toHaveLength(2);
      
      const pausedEvents = emitter.getEventsByType('validation-paused');
      expect(pausedEvents).toHaveLength(1);
    });
  });

  describe('Cleanup', () => {
    it('should remove all listeners', () => {
      emitter.on('validation-started', mockListener);
      emitter.on('validation-paused', mockListener);
      emitter.onAll(mockListener);
      
      expect(emitter.getTotalListenerCount()).toBe(3);
      
      emitter.removeAllListeners();
      expect(emitter.getTotalListenerCount()).toBe(0);
    });

    it('should clear event history', () => {
      emitter.emit('validation-started', {
        currentState: 'running',
        previousState: 'idle',
        progress: null
      });
      
      expect(emitter.getEventHistory()).toHaveLength(1);
      
      emitter.clearHistory();
      expect(emitter.getEventHistory()).toHaveLength(0);
    });
  });
});

describe('Global Event Emitter', () => {
  it('should return the same singleton instance', () => {
    const emitter1 = getValidationStateEventEmitter();
    const emitter2 = getValidationStateEventEmitter();
    
    expect(emitter1).toBe(emitter2);
  });

  it('should create new instances with factory function', () => {
    const emitter1 = createValidationStateEventEmitter();
    const emitter2 = createValidationStateEventEmitter();
    
    expect(emitter1).not.toBe(emitter2);
  });
});

describe('ValidationStateEventHelpers', () => {
  let mockProgress: ValidationProgress;

  beforeEach(() => {
    mockProgress = {
      totalResources: 100,
      processedResources: 50,
      validResources: 40,
      errorResources: 10,
      status: 'running',
      startTime: new Date(),
      currentResourceType: 'Patient',
      estimatedTimeRemaining: 30,
      processingRate: 5
    };
  });

  it('should emit validation started event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('validation-started', listener);
    
    ValidationStateEventHelpers.emitValidationStarted(mockProgress, 1);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'validation-started',
        data: expect.objectContaining({
          previousState: 'idle',
          currentState: 'running',
          progress: mockProgress,
          serverId: 1
        })
      })
    );
  });

  it('should emit validation paused event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('validation-paused', listener);
    
    ValidationStateEventHelpers.emitValidationPaused(mockProgress);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'validation-paused',
        data: expect.objectContaining({
          previousState: 'running',
          currentState: 'paused',
          progress: mockProgress
        })
      })
    );
  });

  it('should emit validation resumed event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('validation-resumed', listener);
    
    ValidationStateEventHelpers.emitValidationResumed(mockProgress);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'validation-resumed',
        data: expect.objectContaining({
          previousState: 'paused',
          currentState: 'running',
          progress: mockProgress
        })
      })
    );
  });

  it('should emit validation stopped event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('validation-stopped', listener);
    
    ValidationStateEventHelpers.emitValidationStopped(mockProgress);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'validation-stopped',
        data: expect.objectContaining({
          previousState: 'running',
          currentState: 'idle',
          progress: mockProgress
        })
      })
    );
  });

  it('should emit validation completed event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('validation-completed', listener);
    
    ValidationStateEventHelpers.emitValidationCompleted(mockProgress);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'validation-completed',
        data: expect.objectContaining({
          previousState: 'running',
          currentState: 'completed',
          progress: mockProgress
        })
      })
    );
  });

  it('should emit validation error event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('validation-error', listener);
    
    ValidationStateEventHelpers.emitValidationError('Test error', mockProgress);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'validation-error',
        data: expect.objectContaining({
          previousState: 'running',
          currentState: 'error',
          progress: mockProgress,
          error: 'Test error'
        })
      })
    );
  });

  it('should emit progress updated event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('progress-updated', listener);
    
    const previousProgress = { ...mockProgress, processedResources: 25 };
    ValidationStateEventHelpers.emitProgressUpdated(mockProgress, previousProgress);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'progress-updated',
        data: expect.objectContaining({
          currentState: 'running',
          progress: mockProgress,
          metadata: expect.objectContaining({
            previousProgress: expect.objectContaining({
              processedResources: 25,
              totalResources: 100,
              status: 'running'
            })
          })
        })
      })
    );
  });

  it('should emit status changed event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('status-changed', listener);
    
    ValidationStateEventHelpers.emitStatusChanged('idle', 'running', mockProgress);
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'status-changed',
        data: expect.objectContaining({
          previousState: 'idle',
          currentState: 'running',
          progress: mockProgress
        })
      })
    );
  });

  it('should emit connection state changed event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('connection-state-changed', listener);
    
    ValidationStateEventHelpers.emitConnectionStateChanged('connected', 'Connection established');
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connection-state-changed',
        data: expect.objectContaining({
          currentState: 'connected',
          connectionState: 'connected',
          error: 'Connection established'
        })
      })
    );
  });

  it('should emit server changed event', () => {
    const listener = vi.fn();
    const emitter = getValidationStateEventEmitter();
    emitter.on('server-changed', listener);
    
    ValidationStateEventHelpers.emitServerChanged(1, 'Test Server', 'https://test.server.com');
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'server-changed',
        data: expect.objectContaining({
          currentState: 'server-changed',
          serverId: 1,
          serverName: 'Test Server',
          serverUrl: 'https://test.server.com'
        })
      })
    );
  });
});

