/**
 * Connectivity Monitor Provider
 * 
 * Provides global connectivity monitoring with automatic toast notifications.
 * Wraps the app to enable connectivity status tracking throughout the application.
 * 
 * Task 5.11: React provider for connectivity monitoring
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useConnectivityStatus } from '@/hooks/use-connectivity-status';
import type { ConnectivityStatus } from '@/hooks/use-connectivity-status';

// ============================================================================
// Context
// ============================================================================

interface ConnectivityContextValue {
  status: ConnectivityStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setManualMode: (mode: 'online' | 'degraded' | 'offline' | null) => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface ConnectivityMonitorProviderProps {
  children: React.ReactNode;
  /** Whether to enable automatic notifications (default: true) */
  enableNotifications?: boolean;
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** Whether to enable polling (default: true) */
  enablePolling?: boolean;
}

export function ConnectivityMonitorProvider({
  children,
  enableNotifications = true,
  pollingInterval = 30000,
  enablePolling = true,
}: ConnectivityMonitorProviderProps) {
  const connectivityStatus = useConnectivityStatus({
    pollingInterval,
    showNotifications: enableNotifications,
    enablePolling,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  // Mark as initialized after first fetch
  useEffect(() => {
    if (connectivityStatus.status && !isInitialized) {
      setIsInitialized(true);
      console.log('[ConnectivityMonitor] Initialized with mode:', connectivityStatus.status.mode);
    }
  }, [connectivityStatus.status, isInitialized]);

  return (
    <ConnectivityContext.Provider value={connectivityStatus}>
      {children}
    </ConnectivityContext.Provider>
  );
}

// ============================================================================
// Hook to use connectivity context
// ============================================================================

export function useConnectivityContext(): ConnectivityContextValue {
  const context = useContext(ConnectivityContext);
  
  if (!context) {
    throw new Error(
      'useConnectivityContext must be used within ConnectivityMonitorProvider'
    );
  }
  
  return context;
}

// ============================================================================
// Optional: Hook that doesn't require provider (for standalone usage)
// ============================================================================

export function useConnectivityMonitor() {
  try {
    return useConnectivityContext();
  } catch {
    // If not within provider, return a standalone instance
    // This allows the hook to work even without the provider
    return useConnectivityStatus({
      pollingInterval: 30000,
      showNotifications: false,
      enablePolling: true,
    });
  }
}


