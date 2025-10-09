/**
 * useValidationMode Hook
 * 
 * Task 3.8/3.11: React hook for validation mode state and management
 * 
 * Provides:
 * - Current validation mode (online/offline)
 * - Mode switching functionality
 * - System health status
 * - Real-time mode change updates
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export type ValidationMode = 'online' | 'offline';

export interface ValidationModeState {
  mode: ValidationMode;
  txFhirOrgHealthy: boolean;
  ontoserverHealthy: boolean;
  isLoading: boolean;
  lastUpdated?: Date;
}

export interface ModeChangeResult {
  success: boolean;
  previousMode: ValidationMode;
  message: string;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchValidationMode(): Promise<ValidationModeState> {
  const response = await fetch('/api/validation/mode');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch validation mode: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    mode: data.mode || 'online',
    txFhirOrgHealthy: data.txFhirOrgHealthy ?? true,
    ontoserverHealthy: data.ontoserverHealthy ?? false,
    isLoading: false,
    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : undefined
  };
}

async function switchValidationMode(
  newMode: ValidationMode,
  options?: { force?: boolean; reason?: string }
): Promise<ModeChangeResult> {
  const response = await fetch('/api/validation/mode', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ mode: newMode, ...options })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to switch mode: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// Hook
// ============================================================================

export function useValidationMode() {
  const queryClient = useQueryClient();
  const [pollingInterval, setPollingInterval] = useState<number>(30000); // 30 seconds default

  // Fetch current mode
  const {
    data: modeState,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['validationMode'],
    queryFn: fetchValidationMode,
    refetchInterval: pollingInterval,
    refetchOnWindowFocus: true,
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: 3
  });

  // Mode switching mutation
  const switchModeMutation = useMutation({
    mutationFn: ({ mode, options }: { 
      mode: ValidationMode; 
      options?: { force?: boolean; reason?: string } 
    }) => switchValidationMode(mode, options),
    onSuccess: (result) => {
      // Invalidate and refetch mode state
      queryClient.invalidateQueries({ queryKey: ['validationMode'] });
      
      // Show success notification
      console.log('[useValidationMode] Mode switched:', result);
    },
    onError: (error: Error) => {
      console.error('[useValidationMode] Mode switch failed:', error);
    }
  });

  // Switch to online mode
  const switchToOnline = useCallback(async (options?: { force?: boolean; reason?: string }) => {
    return switchModeMutation.mutateAsync({ mode: 'online', options });
  }, [switchModeMutation]);

  // Switch to offline mode
  const switchToOffline = useCallback(async (options?: { force?: boolean; reason?: string }) => {
    return switchModeMutation.mutateAsync({ mode: 'offline', options });
  }, [switchModeMutation]);

  // Toggle mode
  const toggleMode = useCallback(async (options?: { force?: boolean; reason?: string }) => {
    const currentMode = modeState?.mode || 'online';
    const newMode = currentMode === 'online' ? 'offline' : 'online';
    return switchModeMutation.mutateAsync({ mode: newMode, options });
  }, [modeState?.mode, switchModeMutation]);

  // Manual refresh
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Listen to server-sent events for real-time mode changes
  useEffect(() => {
    // Check if EventSource is available
    if (typeof EventSource === 'undefined') {
      console.warn('[useValidationMode] EventSource not available, using polling only');
      return;
    }

    // Attempt to connect to SSE endpoint (if available)
    // This is optional and will fallback to polling
    try {
      const eventSource = new EventSource('/api/validation/mode/events');

      eventSource.addEventListener('modeChanged', ((event: MessageEvent) => {
        console.log('[useValidationMode] Mode changed via SSE:', event.data);
        queryClient.invalidateQueries({ queryKey: ['validationMode'] });
      }) as EventListener);

      eventSource.onerror = (error) => {
        console.debug('[useValidationMode] SSE connection error (fallback to polling):', error);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    } catch (error) {
      console.debug('[useValidationMode] SSE not available, using polling only');
    }
  }, [queryClient]);

  // Adjust polling interval based on health status
  useEffect(() => {
    if (modeState) {
      // More frequent polling if there are health issues
      if (!modeState.txFhirOrgHealthy || !modeState.ontoserverHealthy) {
        setPollingInterval(15000); // 15 seconds if unhealthy
      } else {
        setPollingInterval(60000); // 1 minute if healthy
      }
    }
  }, [modeState?.txFhirOrgHealthy, modeState?.ontoserverHealthy]);

  return {
    // State
    mode: modeState?.mode || 'online',
    txFhirOrgHealthy: modeState?.txFhirOrgHealthy ?? true,
    ontoserverHealthy: modeState?.ontoserverHealthy ?? false,
    isLoading: isLoading || switchModeMutation.isPending,
    error: error || switchModeMutation.error,
    lastUpdated: modeState?.lastUpdated,
    
    // Actions
    switchToOnline,
    switchToOffline,
    toggleMode,
    refresh,
    
    // Computed
    isOnline: modeState?.mode === 'online',
    isOffline: modeState?.mode === 'offline',
    canSwitchToOnline: modeState?.txFhirOrgHealthy ?? true,
    canSwitchToOffline: modeState?.ontoserverHealthy ?? false,
    hasHealthIssues: !(modeState?.txFhirOrgHealthy && modeState?.ontoserverHealthy)
  };
}

export default useValidationMode;

