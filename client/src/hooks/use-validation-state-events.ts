// ============================================================================
// Validation State Events Hook - Real-time event-driven updates
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ValidationStateEventEmitter, 
  ValidationStateEvent, 
  ValidationStateEventType,
  getValidationStateEventEmitter,
  ValidationStateEventHelpers
} from '../lib/validation-state-event-emitter';
import { ValidationProgress } from './use-validation-polling';

export interface ValidationStateEventHookState {
  lastEvent: ValidationStateEvent | null;
  eventHistory: ValidationStateEvent[];
  isListening: boolean;
  listenerCount: number;
}

export interface ValidationStateEventHookActions {
  startListening: () => void;
  stopListening: () => void;
  clearHistory: () => void;
  emitValidationStarted: (progress: ValidationProgress | null, serverId?: number) => void;
  emitValidationPaused: (progress: ValidationProgress | null) => void;
  emitValidationResumed: (progress: ValidationProgress | null) => void;
  emitValidationStopped: (progress: ValidationProgress | null) => void;
  emitValidationCompleted: (progress: ValidationProgress | null) => void;
  emitValidationError: (error: string, progress: ValidationProgress | null) => void;
  emitProgressUpdated: (progress: ValidationProgress | null, previousProgress?: ValidationProgress | null) => void;
  emitStatusChanged: (previousStatus: string, currentStatus: string, progress: ValidationProgress | null) => void;
  emitConnectionStateChanged: (connectionState: 'disconnected' | 'connecting' | 'connected' | 'error', error?: string) => void;
  emitServerChanged: (serverId: number, serverName: string, serverUrl: string) => void;
}

export interface UseValidationStateEventsOptions {
  enabled?: boolean;
  eventTypes?: ValidationStateEventType[];
  maxHistorySize?: number;
  autoStart?: boolean;
}

export function useValidationStateEvents(
  options: UseValidationStateEventsOptions = {}
): ValidationStateEventHookState & ValidationStateEventHookActions {
  const {
    enabled = true,
    eventTypes = ['validation-started', 'validation-paused', 'validation-resumed', 'validation-stopped', 'validation-completed', 'validation-error', 'progress-updated', 'status-changed'],
    maxHistorySize = 50,
    autoStart = true
  } = options;

  const [lastEvent, setLastEvent] = useState<ValidationStateEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<ValidationStateEvent[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);

  const emitterRef = useRef<ValidationStateEventEmitter | null>(null);
  const unsubscribeFunctionsRef = useRef<(() => void)[]>([]);
  const previousProgressRef = useRef<ValidationProgress | null>(null);

  // Event handler that processes incoming events
  const handleEvent = useCallback((event: ValidationStateEvent) => {
    if (!enabled) return;

    setLastEvent(event);
    setEventHistory(prev => {
      const newHistory = [...prev, event];
      if (newHistory.length > maxHistorySize) {
        return newHistory.slice(-maxHistorySize);
      }
      return newHistory;
    });

    // Log significant events
    if (['validation-started', 'validation-paused', 'validation-resumed', 'validation-stopped', 'validation-completed', 'validation-error'].includes(event.type)) {
      console.log(`[ValidationStateEvents] ${event.type}:`, {
        timestamp: event.timestamp.toISOString(),
        previousState: event.data.previousState,
        currentState: event.data.currentState,
        progress: event.data.progress ? {
          status: event.data.progress.status,
          processedResources: event.data.progress.processedResources,
          totalResources: event.data.progress.totalResources
        } : null
      });
    }
  }, [enabled, maxHistorySize]);

  // Start listening to events
  const startListening = useCallback(() => {
    if (isListening || !enabled) return;

    const emitter = getValidationStateEventEmitter();
    emitterRef.current = emitter;

    // Subscribe to specific event types
    const unsubscribeFunctions: (() => void)[] = [];
    
    for (const eventType of eventTypes) {
      const unsubscribe = emitter.on(eventType, handleEvent);
      unsubscribeFunctions.push(unsubscribe);
    }

    unsubscribeFunctionsRef.current = unsubscribeFunctions;
    setIsListening(true);
    setListenerCount(emitter.getTotalListenerCount());

    console.log(`[ValidationStateEvents] Started listening to ${eventTypes.length} event types:`, eventTypes);
  }, [enabled, eventTypes, handleEvent, isListening]);

  // Stop listening to events
  const stopListening = useCallback(() => {
    if (!isListening) return;

    // Unsubscribe from all events
    unsubscribeFunctionsRef.current.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('[ValidationStateEvents] Error unsubscribing from event:', error);
      }
    });

    unsubscribeFunctionsRef.current = [];
    setIsListening(false);
    setListenerCount(0);

    console.log('[ValidationStateEvents] Stopped listening to events');
  }, [isListening]);

  // Clear event history
  const clearHistory = useCallback(() => {
    setEventHistory([]);
    setLastEvent(null);
    
    if (emitterRef.current) {
      emitterRef.current.clearHistory();
    }
  }, []);

  // Event emission helpers
  const emitValidationStarted = useCallback((progress: ValidationProgress | null, serverId?: number) => {
    ValidationStateEventHelpers.emitValidationStarted(progress, serverId);
  }, []);

  const emitValidationPaused = useCallback((progress: ValidationProgress | null) => {
    ValidationStateEventHelpers.emitValidationPaused(progress);
  }, []);

  const emitValidationResumed = useCallback((progress: ValidationProgress | null) => {
    ValidationStateEventHelpers.emitValidationResumed(progress);
  }, []);

  const emitValidationStopped = useCallback((progress: ValidationProgress | null) => {
    ValidationStateEventHelpers.emitValidationStopped(progress);
  }, []);

  const emitValidationCompleted = useCallback((progress: ValidationProgress | null) => {
    ValidationStateEventHelpers.emitValidationCompleted(progress);
  }, []);

  const emitValidationError = useCallback((error: string, progress: ValidationProgress | null) => {
    ValidationStateEventHelpers.emitValidationError(error, progress);
  }, []);

  const emitProgressUpdated = useCallback((progress: ValidationProgress | null, previousProgress?: ValidationProgress | null) => {
    ValidationStateEventHelpers.emitProgressUpdated(progress, previousProgress);
  }, []);

  const emitStatusChanged = useCallback((previousStatus: string, currentStatus: string, progress: ValidationProgress | null) => {
    ValidationStateEventHelpers.emitStatusChanged(previousStatus, currentStatus, progress);
  }, []);

  const emitConnectionStateChanged = useCallback((connectionState: 'disconnected' | 'connecting' | 'connected' | 'error', error?: string) => {
    ValidationStateEventHelpers.emitConnectionStateChanged(connectionState, error);
  }, []);

  const emitServerChanged = useCallback((serverId: number, serverName: string, serverUrl: string) => {
    ValidationStateEventHelpers.emitServerChanged(serverId, serverName, serverUrl);
  }, []);

  // Auto-start listening when enabled
  useEffect(() => {
    if (autoStart && enabled && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }

    return () => {
      if (isListening) {
        stopListening();
      }
    };
  }, [autoStart, enabled, isListening, startListening, stopListening]);

  // Update listener count periodically
  useEffect(() => {
    if (!isListening || !emitterRef.current) return;

    const updateListenerCount = () => {
      if (emitterRef.current) {
        setListenerCount(emitterRef.current.getTotalListenerCount());
      }
    };

    const interval = setInterval(updateListenerCount, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    // State
    lastEvent,
    eventHistory,
    isListening,
    listenerCount,
    
    // Actions
    startListening,
    stopListening,
    clearHistory,
    emitValidationStarted,
    emitValidationPaused,
    emitValidationResumed,
    emitValidationStopped,
    emitValidationCompleted,
    emitValidationError,
    emitProgressUpdated,
    emitStatusChanged,
    emitConnectionStateChanged,
    emitServerChanged
  };
}

/**
 * Hook for listening to specific validation state events
 */
export function useValidationStateEvent(
  eventType: ValidationStateEventType,
  callback: (event: ValidationStateEvent) => void,
  enabled: boolean = true
): void {
  const emitter = getValidationStateEventEmitter();

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = emitter.on(eventType, callback);
    return unsubscribe;
  }, [eventType, callback, enabled, emitter]);
}

/**
 * Hook for listening to all validation state events
 */
export function useAllValidationStateEvents(
  callback: (event: ValidationStateEvent) => void,
  enabled: boolean = true
): void {
  const emitter = getValidationStateEventEmitter();

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = emitter.onAll(callback);
    return unsubscribe;
  }, [callback, enabled, emitter]);
}

