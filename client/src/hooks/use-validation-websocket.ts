import { useEffect, useState, useRef } from 'react';

export interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  currentResourceType?: string;
  startTime: string;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: 'not_running' | 'running' | 'completed';
}

export interface WebSocketMessage {
  type: 'status' | 'validation_progress' | 'validation_started' | 'validation_complete' | 'validation_error' | 'validation_stopped';
  data: any;
}

export function useValidationWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/validation`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected for validation updates');
        setIsConnected(true);
        setLastError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'status':
              console.log('WebSocket status:', message.data);
              break;
              
            case 'validation_started':
              console.log('Validation started:', message.data);
              setValidationStatus('running');
              setLastError(null);
              break;
              
            case 'validation_progress':
              console.log('Validation progress:', message.data);
              setProgress(message.data);
              setValidationStatus('running');
              break;
              
            case 'validation_complete':
              console.log('Validation completed:', message.data);
              setProgress(message.data);
              setValidationStatus('completed');
              break;
              
            case 'validation_error':
              console.log('Validation error:', message.data);
              setLastError(message.data.error);
              setValidationStatus('error');
              break;
              
            case 'validation_stopped':
              console.log('Validation stopped and reset');
              setProgress(null);
              setValidationStatus('idle');
              setLastError(null);
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
    
    setIsConnected(false);
  };

  useEffect(() => {
    connect();
    
    return () => {
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
    resetProgress,
    reconnect: connect
  };
}