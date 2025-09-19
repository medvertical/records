// ============================================================================
// Validation Controls Hook - Centralized State Management
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ValidationProgress } from '@shared/types/dashboard';
import {
  ValidationControlsState,
  ValidationControlsActions,
  ValidationControlsConfig,
  ValidationControlsHook,
  ValidationConfiguration,
  ValidationRunHistory,
  ValidationMetrics,
  ValidationStatus,
  ValidationAction,
  StartValidationOptions,
  ValidationSSEMessage,
  ValidationProgressMessage,
  ValidationCompletedMessage,
  ValidationErrorMessage,
  ValidationError
} from '@shared/types/validation';
import { useValidationPolling } from './use-validation-polling';

// Types are now imported from @shared/types/validation

const DEFAULT_CONFIG: Required<ValidationControlsConfig> = {
  defaultBatchSize: 100,
  minBatchSize: 10,
  maxBatchSize: 1000,
  enablePersistence: true,
  retryAttempts: 3,
  retryDelay: 1000,
  autoRetry: true,
  strictMode: false,
  enableMetrics: true,
  maxHistoryEntries: 50,
  performanceMonitoring: true
};

const DEFAULT_VALIDATION_CONFIG: ValidationConfiguration = {
  batchSize: 100,
  minBatchSize: 10,
  maxBatchSize: 1000,
  enablePersistence: true,
  retryAttempts: 3,
  retryDelay: 1000,
  autoRetry: true,
  strictMode: false,
  validationAspects: {
    structural: true,
    profile: true,
    terminology: true,
    reference: true,
    businessRule: true,
    metadata: true
  },
  performance: {
    maxConcurrentValidations: 8,
    timeoutMs: 30000,
    memoryLimitMB: 512
  }
};

export function useValidationControls(config: ValidationControlsConfig = {}): ValidationControlsHook {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Integrate with polling hook for MVP
  const {
    isConnected: pollingConnected,
    progress: pollingProgress,
    validationStatus: pollingStatus,
    lastError: pollingError,
    currentServer: pollingCurrentServer,
    resetProgress: pollingResetProgress,
    reconnect: pollingReconnect,
    syncWithApi: pollingSyncWithApi
  } = useValidationPolling({
    enabled: true,
    pollInterval: 2000, // Poll every 2 seconds
    hasActiveServer: true
  });
  
  // State management
  const [state, setState] = useState<ValidationControlsState>(() => {
    // Initialize from localStorage if persistence is enabled
    if (finalConfig.enablePersistence) {
      try {
        const saved = localStorage.getItem('validation-controls-state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            isRunning: false, // Never restore running state
            isPaused: false,  // Never restore paused state
            isStopping: false,
            error: null,
            lastAction: null,
            configuration: { ...DEFAULT_VALIDATION_CONFIG, ...parsed.configuration }
          };
        }
      } catch (error) {
        console.warn('[ValidationControls] Failed to restore state from localStorage:', error);
      }
    }
    
    return {
      isRunning: false,
      isPaused: false,
      isStopping: false,
      progress: null,
      error: null,
      lastAction: null,
      batchSize: finalConfig.defaultBatchSize,
      configuration: { ...DEFAULT_VALIDATION_CONFIG, batchSize: finalConfig.defaultBatchSize },
      history: [],
      metrics: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageDuration: 0,
        averageThroughput: 0,
        bestThroughput: 0,
        worstThroughput: 0,
        averageSuccessRate: 0,
        totalResourcesProcessed: 0,
        totalValidResources: 0,
        totalErrorResources: 0
      }
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync polling state with validation controls state
  useEffect(() => {
    if (pollingProgress) {
      setState(prev => ({
        ...prev,
        progress: pollingProgress,
        error: null
      }));
    }
  }, [pollingProgress]);

  useEffect(() => {
    if (pollingError) {
      setState(prev => ({
        ...prev,
        error: pollingError
      }));
    }
  }, [pollingError]);

  useEffect(() => {
    // Map polling status to validation controls state
    switch (pollingStatus) {
      case 'running':
        setState(prev => ({
          ...prev,
          isRunning: true,
          isPaused: false,
          isStopping: false
        }));
        break;
      case 'paused':
        setState(prev => ({
          ...prev,
          isRunning: false,
          isPaused: true,
          isStopping: false
        }));
        break;
      case 'completed':
        setState(prev => ({
          ...prev,
          isRunning: false,
          isPaused: false,
          isStopping: false
        }));
        break;
      case 'error':
        setState(prev => ({
          ...prev,
          isRunning: false,
          isPaused: false,
          isStopping: false
        }));
        break;
      case 'idle':
        setState(prev => ({
          ...prev,
          isRunning: false,
          isPaused: false,
          isStopping: false
        }));
        break;
    }
  }, [pollingStatus]);

  // Persist state to localStorage
  useEffect(() => {
    if (finalConfig.enablePersistence) {
      try {
        const stateToSave = {
          ...state,
          isRunning: false, // Don't persist running state
          isPaused: false,  // Don't persist paused state
          isStopping: false,
          error: null,
          lastAction: null
        };
        localStorage.setItem('validation-controls-state', JSON.stringify(stateToSave));
      } catch (error) {
        console.warn('[ValidationControls] Failed to save state to localStorage:', error);
      }
    }
  }, [state.batchSize, finalConfig.enablePersistence]);

  // Note: SSE connection handled by useValidationSSE hook
  // Real-time updates are managed through SSE events

  // API call helper with enhanced retry logic
  const apiCall = useCallback(async (
    endpoint: string, 
    method: 'POST' | 'PUT' | 'DELETE' = 'POST',
    body?: any,
    retryCount: number = 0
  ): Promise<Response> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const response = await fetch(`/api/validation/${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        // Retry on server errors (5xx) or specific client errors (429, 408)
        if ((response.status >= 500 || response.status === 429 || response.status === 408) 
            && retryCount < finalConfig.retryAttempts) {
          console.warn(`[ValidationControls] API call failed (${response.status}), retrying... (${retryCount + 1}/${finalConfig.retryAttempts})`);
          
          // Exponential backoff
          const delay = finalConfig.retryDelay * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return apiCall(endpoint, method, body, retryCount + 1);
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Reset retry count on success
      retryCountRef.current = 0;
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      
      // Retry on network errors
      if (retryCount < finalConfig.retryAttempts && 
          (error instanceof TypeError || error.message.includes('fetch'))) {
        console.warn(`[ValidationControls] Network error, retrying... (${retryCount + 1}/${finalConfig.retryAttempts})`);
        
        const delay = finalConfig.retryDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return apiCall(endpoint, method, body, retryCount + 1);
      }
      
      throw error;
    }
  }, [finalConfig.retryAttempts, finalConfig.retryDelay]);

  // Validation control actions
  const startValidation = useCallback(async (options: StartValidationOptions = {}) => {
    if (state.isRunning || state.isPaused) {
      throw new Error('Validation is already running or paused');
    }

    setIsLoading(true);
    setState(prev => ({ ...prev, error: null, lastAction: 'start' }));

    try {
      const actualBatchSize = options.batchSize || state.batchSize;
      
      // Validate batch size
      if (actualBatchSize < finalConfig.minBatchSize || actualBatchSize > finalConfig.maxBatchSize) {
        throw new Error(`Batch size must be between ${finalConfig.minBatchSize} and ${finalConfig.maxBatchSize}`);
      }

      // Prepare start options
      const startOptions = {
        batchSize: actualBatchSize,
        forceRevalidation: options.forceRevalidation || false,
        skipUnchanged: options.skipUnchanged !== false, // Default to true
        resourceTypes: options.resourceTypes,
        customConfiguration: options.customConfiguration
      };

      await apiCall('bulk/start', 'POST', startOptions);
      
      setState(prev => ({
        ...prev,
        isRunning: true,
        isPaused: false,
        isStopping: false,
        batchSize: actualBatchSize,
        progress: null,
        error: null,
        configuration: options.customConfiguration ? 
          { ...prev.configuration, ...options.customConfiguration } : 
          prev.configuration
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start validation';
      
      // Log the error
      if (error instanceof Error) {
        logError(error, 'startValidation', { options, retryCount: retryCountRef.current });
      }
      
      // Attempt error recovery if auto-retry is enabled
      if (finalConfig.autoRetry && retryCountRef.current < finalConfig.retryAttempts) {
        retryCountRef.current++;
        console.warn(`[ValidationControls] Start validation failed, attempting recovery... (${retryCountRef.current}/${finalConfig.retryAttempts})`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay * retryCountRef.current));
        
        // Retry the operation
        try {
          await startValidation(options);
          return; // Success, exit early
        } catch (retryError) {
          // If retry also fails, continue with error handling
          if (retryError instanceof Error) {
            logError(retryError, 'startValidation-retry', { options, retryCount: retryCountRef.current });
          }
        }
      }
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: errorMessage,
        lastAction: null
      }));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state.isRunning, state.isPaused, state.batchSize, finalConfig.minBatchSize, finalConfig.maxBatchSize, apiCall]);

  const pauseValidation = useCallback(async () => {
    if (!state.isRunning || state.isPaused) {
      throw new Error('Validation is not running');
    }

    setIsLoading(true);
    setState(prev => ({ ...prev, error: null, lastAction: 'pause' }));

    try {
      await apiCall('bulk/pause', 'POST');
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        isPaused: true,
        isStopping: false
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pause validation';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        lastAction: null
      }));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state.isRunning, state.isPaused, apiCall]);

  const resumeValidation = useCallback(async () => {
    if (!state.isPaused) {
      throw new Error('Validation is not paused');
    }

    setIsLoading(true);
    setState(prev => ({ ...prev, error: null, lastAction: 'resume' }));

    try {
      await apiCall('bulk/resume', 'POST');
      
      setState(prev => ({
        ...prev,
        isRunning: true,
        isPaused: false,
        isStopping: false
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resume validation';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        lastAction: null
      }));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state.isPaused, apiCall]);

  const stopValidation = useCallback(async () => {
    if (!state.isRunning && !state.isPaused) {
      throw new Error('Validation is not running');
    }

    setIsLoading(true);
    setState(prev => ({ ...prev, error: null, lastAction: 'stop', isStopping: true }));

    try {
      await apiCall('bulk/stop', 'POST');
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        isStopping: false,
        progress: null
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop validation';
      setState(prev => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        isStopping: false,
        error: errorMessage,
        lastAction: null
      }));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [state.isRunning, state.isPaused, apiCall]);

  const updateBatchSize = useCallback((batchSize: number) => {
    if (batchSize < finalConfig.minBatchSize || batchSize > finalConfig.maxBatchSize) {
      throw new Error(`Batch size must be between ${finalConfig.minBatchSize} and ${finalConfig.maxBatchSize}`);
    }
    
    setState(prev => ({ 
      ...prev, 
      batchSize,
      configuration: { ...prev.configuration, batchSize }
    }));
  }, [finalConfig.minBatchSize, finalConfig.maxBatchSize]);

  const updateConfiguration = useCallback((config: Partial<ValidationConfiguration>) => {
    setState(prev => ({
      ...prev,
      configuration: { ...prev.configuration, ...config }
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Error logging and debugging
  const logError = useCallback((error: Error, context: string, additionalData?: any) => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      state: {
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        isStopping: state.isStopping,
        lastAction: state.lastAction,
        batchSize: state.batchSize
      },
      ...additionalData
    };
    
    console.error(`[ValidationControls] Error in ${context}:`, errorInfo);
    
    // In production, you might want to send this to an error tracking service
    // Example: errorTrackingService.captureException(error, { extra: errorInfo });
  }, [state.isRunning, state.isPaused, state.isStopping, state.lastAction, state.batchSize]);

  // State reconciliation logic with conflict resolution
  const reconcileState = useCallback(() => {
    // For polling-based validation, we rely on the polling hook to provide accurate state
    // No complex reconciliation needed since polling provides the source of truth
    console.log('[ValidationControls] State reconciliation - polling provides source of truth');
  }, []);

  // Conflict resolution for specific scenarios
  const resolveConflict = useCallback((conflictType: 'running' | 'paused' | 'stopped', apiState: boolean) => {
    console.log(`[ValidationControls] Resolving ${conflictType} conflict, API state: ${apiState}`);
    
    switch (conflictType) {
      case 'running':
        if (apiState && !state.isRunning) {
          // API says running but local says not running - start local tracking
          setState(prev => ({ ...prev, isRunning: true, isPaused: false, isStopping: false }));
        } else if (!apiState && state.isRunning) {
          // API says not running but local says running - stop local tracking
          setState(prev => ({ ...prev, isRunning: false, isPaused: false, isStopping: false }));
        }
        break;
        
      case 'paused':
        if (apiState && !state.isPaused) {
          // API says paused but local says not paused - pause local tracking
          setState(prev => ({ ...prev, isPaused: true, isRunning: false, isStopping: false }));
        } else if (!apiState && state.isPaused) {
          // API says not paused but local says paused - resume local tracking
          setState(prev => ({ ...prev, isPaused: false, isRunning: true, isStopping: false }));
        }
        break;
        
      case 'stopped':
        if (!apiState && (state.isRunning || state.isPaused)) {
          // API says stopped but local says running/paused - stop local tracking
          setState(prev => ({ 
            ...prev, 
            isRunning: false, 
            isPaused: false, 
            isStopping: false,
            progress: null 
          }));
        }
        break;
    }
  }, [state.isRunning, state.isPaused]);

  // State validation and consistency checks
  const validateState = useCallback(() => {
    const issues: string[] = [];
    
    // Check for impossible state combinations
    if (state.isRunning && state.isPaused) {
      issues.push('Cannot be both running and paused simultaneously');
    }
    
    if (state.isStopping && !state.isRunning && !state.isPaused) {
      issues.push('Cannot be stopping when not running or paused');
    }
    
    if (state.progress && state.progress.processedResources > state.progress.totalResources) {
      issues.push('Processed resources cannot exceed total resources');
    }
    
    if (state.progress && state.progress.validResources + state.progress.errorResources > state.progress.processedResources) {
      issues.push('Valid + error resources cannot exceed processed resources');
    }
    
    if (state.batchSize < finalConfig.minBatchSize || state.batchSize > finalConfig.maxBatchSize) {
      issues.push(`Batch size ${state.batchSize} is outside valid range [${finalConfig.minBatchSize}, ${finalConfig.maxBatchSize}]`);
    }
    
    if (issues.length > 0) {
      console.error('[ValidationControls] State validation failed:', issues);
      return false;
    }
    
    return true;
  }, [state, finalConfig.minBatchSize, finalConfig.maxBatchSize]);

  // Auto-reconcile when polling state changes
  useEffect(() => {
    // For polling-based validation, reconciliation happens automatically through state updates
    reconcileState();
  }, [pollingStatus, reconcileState]);

  // Validate state on changes
  useEffect(() => {
    validateState();
  }, [validateState]);

  const resetState = useCallback(() => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      isRunning: false,
      isPaused: false,
      isStopping: false,
      progress: null,
      error: null,
      lastAction: null,
      batchSize: finalConfig.defaultBatchSize,
      configuration: { ...DEFAULT_VALIDATION_CONFIG, batchSize: finalConfig.defaultBatchSize },
      history: [],
      metrics: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageDuration: 0,
        averageThroughput: 0,
        bestThroughput: 0,
        worstThroughput: 0,
        averageSuccessRate: 0,
        totalResourcesProcessed: 0,
        totalValidResources: 0,
        totalErrorResources: 0
      }
    });
  }, [finalConfig.defaultBatchSize]);

  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, history: [] }));
  }, []);

  const exportResults = useCallback(async (format: 'json' | 'csv' | 'pdf') => {
    // Implementation for exporting validation results
    // This would typically call an API endpoint to generate the export
    console.log(`Exporting validation results in ${format} format`);
    // TODO: Implement actual export functionality
  }, []);

  const getHistory = useCallback(() => {
    return state.history;
  }, [state.history]);

  const getMetrics = useCallback(() => {
    return state.metrics;
  }, [state.metrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const actions: ValidationControlsActions = {
    startValidation,
    pauseValidation,
    resumeValidation,
    stopValidation,
    updateBatchSize,
    updateConfiguration,
    clearError,
    resetState,
    clearHistory,
    exportResults,
    getHistory,
    getMetrics
  };

  // Calculate derived state values
  const isConnected = pollingConnected;
  const canStart = !state.isRunning && !state.isPaused && !state.isStopping && pollingConnected;
  const canPause = state.isRunning && !state.isPaused && !state.isStopping;
  const canResume = state.isPaused && !state.isRunning && !state.isStopping;
  const canStop = (state.isRunning || state.isPaused) && !state.isStopping;
  
  const progressPercentage = state.progress ? 
    (state.progress.processedResources / state.progress.totalResources) * 100 : 0;
  
  const estimatedTimeRemaining = state.progress?.estimatedTimeRemaining || null;
  
  const currentThroughput = state.progress?.processingRate || 0;
  
  const successRate = state.progress && state.progress.processedResources > 0 ?
    (state.progress.validResources / state.progress.processedResources) * 100 : 0;

  return {
    state,
    actions,
    isLoading,
    isConnected,
    canStart,
    canPause,
    canResume,
    canStop,
    progressPercentage,
    estimatedTimeRemaining,
    currentThroughput,
    successRate
  };
}
