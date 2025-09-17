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

export interface SSEMessage {
  type: 'connected' | 'status' | 'validation_progress' | 'validation-progress' | 'validation_started' | 'validation-started' 
    | 'validation_complete' | 'validation-completed' | 'validation_error' | 'validation-error' 
    | 'validation_stopped' | 'validation-stopped' | 'validation-paused' | 'validation-resumed' | 'server-switched'
    | 'settings-changed' | 'settings-activated' | 'cache-invalidated' | 'cache-warmed' | 'heartbeat';
  data: any;
}

export function useValidationSSE(hasActiveServer: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  // Numeric progress for UI/tests, and full progress object for rich views
  const [progress, setProgress] = useState<number>(0);
  const [progressData, setProgressData] = useState<ValidationProgress | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentServer, setCurrentServer] = useState<{
    id: number | null;
    name: string | null;
    url: string | null;
  }>({
    id: null,
    name: null,
    url: null
  });
  const [apiState, setApiState] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    lastSync: Date | null;
  }>({
    isRunning: false,
    isPaused: false,
    lastSync: null
  });
  const [settingsState, setSettingsState] = useState<{
    lastChanged: Date | null;
    lastActivated: Date | null;
    cacheInvalidated: Date | null;
    cacheWarmed: Date | null;
  }>({
    lastChanged: null,
    lastActivated: null,
    cacheInvalidated: null,
    cacheWarmed: null
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasReceivedMessage = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // API state synchronization
  const syncWithApi = useCallback(async () => {
    if (!hasActiveServer) return; // Don't make API calls when no server is active
    
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
          setProgressData({
            totalResources: data.totalResources,
            processedResources: data.processedResources,
            validResources: data.validResources,
            errorResources: data.errorResources,
            startTime: data.startTime,
            isComplete: data.isComplete,
            errors: data.errors || [],
            status: data.status || 'running'
          });
          if (typeof data.progress === 'number') {
            setProgress(data.progress);
          } else if (typeof data.processedResources === 'number' && typeof data.totalResources === 'number' && data.totalResources > 0) {
            setProgress(Math.round((data.processedResources / data.totalResources) * 100));
          }
        }
      }
    } catch (error) {
      console.warn('[ValidationSSE] Failed to sync with API:', error);
    }
  }, [validationStatus, hasActiveServer]);

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

  // SSE connection function
  const connectSSE = () => {
    try {
      const sseUrl = '/api/validation/stream';
      console.log('[ValidationSSE] Attempting to connect to:', sseUrl);
      
      eventSourceRef.current = new EventSource(sseUrl);

      const es = eventSourceRef.current as any;

      const handleOpen = () => {
        console.log('[ValidationSSE] Connected to validation stream');
        setIsConnected(true);
        setLastError(null);
        setRetryCount(0);
      };

      const handleMessage = (event: MessageEvent) => {
        try {
          const message: SSEMessage = JSON.parse((event as any).data);
          handleSSEMessage(message);
        } catch (error) {
          console.error('[ValidationSSE] Error parsing message:', error);
        }
      };

      const handleError = (error: any) => {
        console.error('[ValidationSSE] Connection error:', error);
        setIsConnected(false);
        setLastError('SSE connection error');
        
        if (retryCount < maxRetries) {
          console.log(`[ValidationSSE] Retrying connection (${retryCount + 1}/${maxRetries})...`);
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            connectSSE();
          }, 2000 * (retryCount + 1));
        } else {
          console.error('[ValidationSSE] Max retries exceeded, falling back to API polling');
          startApiSync();
        }
      };

      // Prefer addEventListener if available for test compatibility
      if (typeof es.addEventListener === 'function') {
        es.addEventListener('open', handleOpen);
        es.addEventListener('message', handleMessage);
        es.addEventListener('error', handleError);
      }
      // Also set property handlers for robustness
      eventSourceRef.current.onopen = handleOpen as any;
      eventSourceRef.current.onmessage = handleMessage as any;
      eventSourceRef.current.onerror = handleError as any;
      
    } catch (error) {
      console.error('[ValidationSSE] Failed to create SSE connection:', error);
      setIsConnected(false);
      startApiSync(); // Fallback to API polling
    }
  };

  // Handle SSE messages
  const handleSSEMessage = (message: SSEMessage) => {
    switch (message.type) {
      case 'connected':
        console.log('[ValidationSSE] Connected:', message.data);
        break;
        
      case 'validation-started':
      case 'validation_started':
        console.log('[ValidationSSE] Validation started:', message.data);
        setValidationStatus('running');
        setLastError(null);
        hasReceivedMessage.current = true;
        break;
        
      case 'validation-progress':
      case 'validation_progress':
        setProgressData(message.data);
        if (typeof message.data?.progress === 'number') {
          setProgress(message.data.progress);
        } else if (typeof message.data?.processedResources === 'number' && typeof message.data?.totalResources === 'number' && message.data.totalResources > 0) {
          setProgress(Math.round((message.data.processedResources / message.data.totalResources) * 100));
        }
        setValidationStatus('running');
        hasReceivedMessage.current = true;
        break;
        
      case 'validation-completed':
      case 'validation_complete':
        console.log('[ValidationSSE] Validation completed:', message.data);
        const completedPayload = message.data.progress || message.data;
        setProgressData(completedPayload);
        if (typeof completedPayload?.progress === 'number') {
          setProgress(completedPayload.progress);
        } else if (typeof completedPayload?.processedResources === 'number' && typeof completedPayload?.totalResources === 'number' && completedPayload.totalResources > 0) {
          setProgress(Math.round((completedPayload.processedResources / completedPayload.totalResources) * 100));
        }
        setValidationStatus('completed');
        hasReceivedMessage.current = true;
        break;
        
      case 'validation-error':
      case 'validation_error':
        console.log('[ValidationSSE] Validation error:', message.data);
        setLastError(message.data.error);
        setValidationStatus('error');
        hasReceivedMessage.current = true;
        break;
        
      case 'validation-paused':
        console.log('[ValidationSSE] Validation paused:', message.data);
        setValidationStatus('paused');
        if (typeof message.data?.progress === 'number') setProgress(message.data.progress);
        hasReceivedMessage.current = true;
        break;
        
      case 'validation-resumed':
        console.log('[ValidationSSE] Validation resumed:', message.data);
        setValidationStatus('running');
        hasReceivedMessage.current = true;
        break;
        
      case 'validation-stopped':
      case 'validation_stopped':
        console.log('[ValidationSSE] Validation stopped and reset');
        setProgressData(null);
        if (typeof message.data?.progress === 'number') setProgress(message.data.progress);
        else setProgress(0);
        setValidationStatus('idle');
        setLastError(null);
        hasReceivedMessage.current = true;
        break;
        
      case 'server-switched':
        console.log('[ValidationSSE] Server switched:', message.data);
        setCurrentServer({
          id: message.data.serverId,
          name: message.data.serverName,
          url: message.data.serverUrl
        });
        
        // Reset validation state when server changes
        // This ensures we don't show stale validation data from the previous server
        setProgress(null);
        setValidationStatus('idle');
        setLastError(null);
        
        // Reconnect SSE to ensure we get updates for the new server
        console.log('[ValidationSSE] Reconnecting SSE for new server...');
        setTimeout(() => {
          reconnect();
        }, 1000);
        break;
        
      case 'settings-changed':
        console.log('[ValidationSSE] Settings changed:', message.data);
        setSettingsState(prev => ({
          ...prev,
          lastChanged: new Date()
        }));
        // Emit custom event for settings components to listen to
        window.dispatchEvent(new CustomEvent('settingsChanged', {
          detail: message.data
        }));
        break;
        
      case 'settings-activated':
        console.log('[ValidationSSE] Settings activated:', message.data);
        setSettingsState(prev => ({
          ...prev,
          lastActivated: new Date()
        }));
        // Emit custom event for settings components to listen to
        window.dispatchEvent(new CustomEvent('settingsActivated', {
          detail: message.data
        }));
        break;
        
      case 'cache-invalidated':
        console.log('[ValidationSSE] Cache invalidated:', message.data);
        setSettingsState(prev => ({
          ...prev,
          cacheInvalidated: new Date()
        }));
        // Emit custom event for cache management
        window.dispatchEvent(new CustomEvent('cacheInvalidated', {
          detail: message.data
        }));
        break;
        
      case 'cache-warmed':
        console.log('[ValidationSSE] Cache warmed:', message.data);
        setSettingsState(prev => ({
          ...prev,
          cacheWarmed: new Date()
        }));
        // Emit custom event for cache management
        window.dispatchEvent(new CustomEvent('cacheWarmed', {
          detail: message.data
        }));
        break;
        
      case 'heartbeat':
        // Heartbeat received - connection is alive
        // No action needed, just keep connection alive
        break;
        
      default:
        console.log('[ValidationSSE] Unknown message type:', message.type);
    }
  };

  const connect = () => {
    // Use SSE for real-time updates
    console.log('[ValidationSSE] Using SSE for real-time updates');
    connectSSE();
    return;

    // SSE-only implementation
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
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
    setProgressData(null);
    setProgress(0);
    setValidationStatus('idle');
    setLastError(null);
  };

  const reconnect = () => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  };

  // Backward compatibility helpers for tests
  const setStatus = (status: 'idle' | 'running' | 'paused' | 'completed' | 'error') => {
    setValidationStatus(status);
  };

  return {
    isConnected,
    progress,
    progressData,
    validationStatus,
    // Back-compat aliases expected by some tests/components
    status: validationStatus,
    isValidating: validationStatus === 'running',
    error: lastError,
    lastError,
    currentServer,
    apiState,
    settingsState,
    resetProgress,
    reconnect,
    syncWithApi,
    // Compatibility methods expected by tests
    connect,
    disconnect,
    setProgress,
    setStatus
  };
}