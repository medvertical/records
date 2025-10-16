/**
 * React Hook for Connectivity Status
 * 
 * Fetches and monitors validation engine connectivity status.
 * Provides real-time updates on network mode and feature availability.
 * 
 * Task 5.10: Hook for connectivity status monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  getConnectivityNotificationManager,
  type ModeChangeEvent 
} from '@/lib/connectivity-notifications';

// ============================================================================
// Types
// ============================================================================

export interface ConnectivityStatus {
  mode: 'online' | 'degraded' | 'offline';
  isOnline: boolean;
  detectedMode: 'online' | 'degraded' | 'offline';
  manualOverride: boolean;
  warnings: string[];
  availableFeatures: string[];
  unavailableFeatures: string[];
  serverHealth?: {
    totalServers: number;
    healthyServers: number;
    degradedServers: number;
    unhealthyServers: number;
    averageResponseTime: number;
  };
}

export interface UseConnectivityStatusOptions {
  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  pollingInterval?: number;
  /** Whether to show toast notifications on mode changes */
  showNotifications?: boolean;
  /** Whether to enable automatic polling */
  enablePolling?: boolean;
}

export interface UseConnectivityStatusReturn {
  status: ConnectivityStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setManualMode: (mode: 'online' | 'degraded' | 'offline' | null) => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useConnectivityStatus(
  options: UseConnectivityStatusOptions = {}
): UseConnectivityStatusReturn {
  const {
    pollingInterval = 30000,
    showNotifications = false,
    enablePolling = true,
  } = options;

  const [status, setStatus] = useState<ConnectivityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousMode, setPreviousMode] = useState<string | null>(null);
  const notificationManager = getConnectivityNotificationManager();

  // Fetch connectivity status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/connectivity/status');

      if (!response.ok) {
        throw new Error(`Failed to fetch connectivity status: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Detect mode change and trigger notifications
      if (previousMode && previousMode !== data.mode) {
        const modeChangeEvent: ModeChangeEvent = {
          oldMode: previousMode as 'online' | 'degraded' | 'offline',
          newMode: data.mode,
          timestamp: new Date().toISOString(),
          affectedFeatures: data.unavailableFeatures,
          isAutomatic: !data.manualOverride, // Only show notifications for automatic changes
        };

        if (showNotifications) {
          notificationManager.handleModeChange(modeChangeEvent);
        }
      }

      setPreviousMode(data.mode);
      setStatus(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useConnectivityStatus] Error fetching status:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [previousMode, showNotifications, notificationManager]);

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
  }, [fetchStatus]);

  // Set manual mode override
  const setManualMode = useCallback(async (mode: 'online' | 'degraded' | 'offline' | null) => {
    try {
      const response = await fetch('/api/validation/connectivity/mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        throw new Error(`Failed to set manual mode: ${response.statusText}`);
      }

      // Refresh status after setting mode
      await fetchStatus();

      if (mode === null) {
        toast.success('Manual override cleared', {
          description: 'Using automatic connectivity detection',
        });
      } else {
        toast.success(`Manual mode set to ${mode}`, {
          description: 'Connectivity detection overridden',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useConnectivityStatus] Error setting manual mode:', errorMessage);
      toast.error('Failed to set manual mode', {
        description: errorMessage,
      });
      throw err;
    }
  }, [fetchStatus]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling
  useEffect(() => {
    if (!enablePolling) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [enablePolling, pollingInterval, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh,
    setManualMode,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getModeDescription(mode: string): string {
  switch (mode) {
    case 'online':
      return 'All validation features available';
    case 'degraded':
      return 'Some validation features may be limited';
    case 'offline':
      return 'Using cached data only';
    default:
      return '';
  }
}

// ============================================================================
// Server Health Hook
// ============================================================================

export interface ServerHealthStatus {
  mode: 'online' | 'degraded' | 'offline';
  detectedMode: 'online' | 'degraded' | 'offline';
  manualOverride: boolean;
  totalServers: number;
  healthyServers: number;
  degradedServers: number;
  unhealthyServers: number;
  averageResponseTime: number;
  servers: Array<{
    name: string;
    type: 'terminology' | 'simplifier' | 'fhir-registry';
    status: 'healthy' | 'degraded' | 'unhealthy' | 'circuit-open';
    reachable: boolean;
    responseTime: number;
    consecutiveFailures: number;
    lastChecked: string;
  }>;
}

export function useServerHealth(pollingInterval: number = 60000) {
  const [health, setHealth] = useState<ServerHealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/connectivity/health');

      if (!response.ok) {
        throw new Error(`Failed to fetch server health: ${response.statusText}`);
      }

      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useServerHealth] Error fetching health:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();

    const interval = setInterval(() => {
      fetchHealth();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval, fetchHealth]);

  return {
    health,
    isLoading,
    error,
    refresh: fetchHealth,
  };
}

