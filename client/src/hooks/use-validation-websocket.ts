import { useEffect, useState, useRef, useCallback } from 'react';

export interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  currentResourceType?: string;
  nextResourceType?: string;
  startTime: string;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: 'not_running' | 'running' | 'paused' | 'completed' | 'error';
}

export interface WebSocketMessage {
  type: 'status' | 'validation_progress' | 'validation-progress' | 'validation_started' | 'validation-started' 
    | 'validation_complete' | 'validation-completed' | 'validation_error' | 'validation-error' 
    | 'validation_stopped' | 'validation-stopped' | 'validation-paused' | 'validation-resumed';
  data: any;
}

export function useValidationWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [apiState, setApiState] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    lastSync: Date | null;
  }>({
    isRunning: false,
    isPaused: false,
    lastSync: null
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasReceivedMessage = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // API state synchronization
  const syncWithApi = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/bulk/progress');
      if (response.ok) {
        const data = await response.json();
        setApiState({
          isRunning: data.status === 'running',
          isPaused: data.status === 'paused',
          lastSync: new Date()
        });
        
        // Update local state if API state differs
        if (data.status === 'running' && validationStatus !== 'running') {
          setValidationStatus('running');
        } else if (data.status === 'paused' && validationStatus !== 'running') {
          // Keep status as 'running' when paused - paused is just a temporary state
          setValidationStatus('running');
        } else if (data.status === 'completed' && validationStatus !== 'completed') {
          setValidationStatus('completed');
        }
        
        // Update progress with the full data object (not just data.progress)
        if (data.totalResources !== undefined) {
          setProgress({
            totalResources: data.totalResources,
            processedResources: data.processedResources,
            validResources: data.validResources,
            errorResources: data.errorResources,
            startTime: data.startTime,
            isComplete: data.isComplete,
            errors: data.errors || []
          });
        }
      }
    } catch (error) {
      console.warn('[ValidationWebSocket] Failed to sync with API:', error);
    }
  }, [validationStatus]);

  const startApiSync = useCallback(() => {
    // Sync immediately
    syncWithApi();
    
    // Then sync every 5 seconds
    syncIntervalRef.current = setInterval(syncWithApi, 5000);
  }, [syncWithApi]);

  const stopApiSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  const connect = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:3000';
      const wsUrl = `${protocol}//${host}/ws/validation`;

      console.log('[ValidationWebSocket] Attempting to connect to:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected for validation updates');
        setIsConnected(true);
        setLastError(null);
        setRetryCount(0); // Reset retry count on successful connection
        // Start API synchronization
        startApiSync();
        // Don't reset status on connection - let server messages determine state
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'status':
              console.log('WebSocket status:', message.data);
              break;
              
            case 'validation-started':
            case 'validation_started':
              console.log('Validation started:', message.data);
              setValidationStatus('running');
              setLastError(null);
              hasReceivedMessage.current = true;
              break;
              
            case 'validation-progress':
            case 'validation_progress':
              setProgress(message.data);
              setValidationStatus('running');
              hasReceivedMessage.current = true;
              break;
              
            case 'validation-completed':
            case 'validation_complete':
              console.log('Validation completed:', message.data);
              setProgress(message.data.progress || message.data);
              setValidationStatus('completed');
              hasReceivedMessage.current = true;
              break;
              
            case 'validation-error':
            case 'validation_error':
              console.log('Validation error:', message.data);
              setLastError(message.data.error);
              setValidationStatus('error');
              hasReceivedMessage.current = true;
              break;
              
            case 'validation-paused':
              console.log('Validation paused:', message.data);
              setValidationStatus('idle');
              hasReceivedMessage.current = true;
              break;
              
            case 'validation-resumed':
              console.log('Validation resumed:', message.data);
              setValidationStatus('running');
              hasReceivedMessage.current = true;
              break;
              
            case 'validation-stopped':
            case 'validation_stopped':
              console.log('Validation stopped and reset');
              setProgress(null);
              setValidationStatus('idle');
              setLastError(null);
              hasReceivedMessage.current = true;
              break;
              
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        if (!event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connect();
          }, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setLastError('WebSocket connection error');
        
        // Retry connection if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log(`[ValidationWebSocket] Retrying connection (${retryCount + 1}/${maxRetries})...`);
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            connect();
          }, 2000 * (retryCount + 1)); // Exponential backoff
        } else {
          console.error('[ValidationWebSocket] Max retries exceeded, giving up');
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounting');
      wsRef.current = null;
    }
    
    // Stop API synchronization
    stopApiSync();
    
    setIsConnected(false);
  };

  useEffect(() => {
    // Add a small delay to ensure server is ready
    const connectTimer = setTimeout(() => {
      connect();
    }, 1000);
    
    return () => {
      clearTimeout(connectTimer);
      disconnect();
    };
  }, []);

  const resetProgress = () => {
    setProgress(null);
    setValidationStatus('idle');
    setLastError(null);
  };

  return {
    isConnected,
    progress,
    validationStatus,
    lastError,
    apiState,
    resetProgress,
    reconnect: connect,
    syncWithApi
  };
}