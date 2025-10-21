/**
 * Active Server Hook
 * 
 * This hook provides access to the currently active FHIR server
 * with server switching, cache invalidation, and real-time updates.
 */

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

// ============================================================================
// Types
// ============================================================================

export interface ServerConfig {
  /** Unique identifier for the server */
  id: string;
  
  /** Display name for the server */
  name: string;
  
  /** FHIR server base URL */
  url: string;
  
  /** Whether this server is currently active */
  isActive: boolean;
  
  /** Authentication configuration */
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'oauth2';
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  };
  
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  
  /** Maximum number of concurrent requests */
  maxConcurrentRequests?: number;
  
  /** Server capabilities */
  capabilities?: {
    supportedVersions: string[];
    supportedResourceTypes: string[];
    supportedOperations: string[];
  };
  
  /** Server status */
  status?: {
    isOnline: boolean;
    lastChecked: Date;
    responseTime: number;
    error?: string;
  };
  
  /** Metadata */
  createdAt: Date;
  updatedAt: Date;
}

export interface ActiveServerOptions {
  /** Whether to enable automatic polling for server status */
  enablePolling?: boolean;
  
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  
  /** Whether to show loading states */
  showLoading?: boolean;
  
  /** Whether to show toast notifications */
  showNotifications?: boolean;
  
  /** Whether to auto-switch to first available server */
  autoSwitch?: boolean;
}

export interface ActiveServerState {
  /** Currently active server */
  activeServer: ServerConfig | null;
  
  /** All available servers */
  servers: ServerConfig[];
  
  /** Whether data is loading */
  isLoading: boolean;
  
  /** Error message if any */
  error: string | null;
  
  /** Last successful fetch timestamp */
  lastUpdated: Date | null;
  
  /** Whether polling is active */
  isPolling: boolean;
  
  /** Whether server switching is in progress */
  isSwitching: boolean;
}

export interface ActiveServerActions {
  /** Manually refresh server data */
  refresh: () => void;
  
  /** Start polling for updates */
  startPolling: () => void;
  
  /** Stop polling for updates */
  stopPolling: () => void;
  
  /** Clear error state */
  clearError: () => void;
  
  /** Switch to a different server */
  switchServer: (serverId: string) => Promise<void>;
  
  /** Add a new server */
  addServer: (server: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  
  /** Update an existing server */
  updateServer: (serverId: string, updates: Partial<ServerConfig>) => Promise<void>;
  
  /** Remove a server */
  removeServer: (serverId: string) => Promise<void>;
  
  /** Test server connection */
  testServer: (serverId: string) => Promise<boolean>;
  
  /** Get server status */
  getServerStatus: (serverId: string) => Promise<ServerConfig['status']>;
}

// ============================================================================
// Context for Active Server
// ============================================================================

interface ActiveServerContextType {
  activeServer: ServerConfig | null;
  switchServer: (serverId: string) => Promise<void>;
  isSwitching: boolean;
}

const ActiveServerContext = createContext<ActiveServerContextType | null>(null);

export function useActiveServerContext() {
  const context = useContext(ActiveServerContext);
  if (!context) {
    throw new Error('useActiveServerContext must be used within an ActiveServerProvider');
  }
  return context;
}

// ============================================================================
// Active Server Hook
// ============================================================================

export function useActiveServer(
  options: ActiveServerOptions = {}
): ActiveServerState & ActiveServerActions {
  const {
    enablePolling = true,
    pollingInterval = 30000,
    showLoading = true,
    showNotifications = true,
    autoSwitch = true
  } = options;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(enablePolling);
  const [isSwitching, setIsSwitching] = useState(false);

  // Query key for React Query
  const queryKey = ['active-server'];

  // Fetch active server and all servers
  const {
    data: serverData,
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const response = await fetch('/api/servers');
        if (!response.ok) {
          // Provide fallback data structure on error
          console.warn(`[useActiveServer] Failed to fetch servers: ${response.status} ${response.statusText}`);
          return { servers: [], activeServer: null };
        }
        const data = await response.json();
        // Ensure the response has the expected structure
        if (!data || typeof data !== 'object') {
          console.warn('[useActiveServer] Invalid response format, using fallback');
          return { servers: [], activeServer: null };
        }
        return data;
      } catch (err) {
        console.error('[useActiveServer] Error fetching servers:', err);
        // Return fallback data instead of throwing
        return { servers: [], activeServer: null };
      }
    },
    enabled: true,
    refetchInterval: isPolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });

  // Manual refresh function
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    queryClient.setQueryData(queryKey, (oldData: any) => oldData);
  }, [queryClient, queryKey]);

  // Switch to a different server
  const switchServer = useCallback(async (serverId: string) => {
    setIsSwitching(true);
    try {
      const response = await fetch(`/api/servers/${serverId}/activate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to switch server');
      }

      // Invalidate all server-related caches
      queryClient.invalidateQueries({ queryKey: ['active-server'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      
      // Invalidate all validation-related caches since they're server-specific
      queryClient.invalidateQueries({ queryKey: ['validation'] });
      queryClient.invalidateQueries({ queryKey: ['fhir-resources'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/resource-counts'] });
      // Don't invalidate quickAccessCounts - it has its own server change detection with force refresh
      
      if (showNotifications) {
        toast({
          title: "Server Switched",
          description: `Switched to ${serverData?.servers?.find((s: ServerConfig) => s.id === serverId)?.name || 'server'}`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch server';
      if (showNotifications) {
        toast({
          title: "Switch Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      setIsSwitching(false);
    }
  }, [queryClient, showNotifications, toast, serverData]);

  // Add a new server
  const addServer = useCallback(async (server: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(server),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add server');
      }

      // Invalidate server cache
      queryClient.invalidateQueries({ queryKey: ['active-server'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      
      if (showNotifications) {
        toast({
          title: "Server Added",
          description: `Server "${server.name}" has been added successfully`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add server';
      if (showNotifications) {
        toast({
          title: "Add Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

  // Update an existing server
  const updateServer = useCallback(async (serverId: string, updates: Partial<ServerConfig>) => {
    try {
      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update server');
      }

      // Invalidate server cache
      queryClient.invalidateQueries({ queryKey: ['active-server'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      
      if (showNotifications) {
        toast({
          title: "Server Updated",
          description: `Server has been updated successfully`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update server';
      if (showNotifications) {
        toast({
          title: "Update Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

  // Remove a server
  const removeServer = useCallback(async (serverId: string) => {
    try {
      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove server');
      }

      // Invalidate server cache
      queryClient.invalidateQueries({ queryKey: ['active-server'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      
      if (showNotifications) {
        toast({
          title: "Server Removed",
          description: `Server has been removed successfully`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove server';
      if (showNotifications) {
        toast({
          title: "Remove Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [queryClient, showNotifications, toast]);

  // Test server connection
  const testServer = useCallback(async (serverId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/servers/${serverId}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      return false;
    }
  }, []);

  // Get server status
  const getServerStatus = useCallback(async (serverId: string): Promise<ServerConfig['status']> => {
    try {
      const response = await fetch(`/api/servers/${serverId}/status`);
      if (!response.ok) {
        throw new Error(`Failed to get server status: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      return {
        isOnline: false,
        lastChecked: new Date(),
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  // Auto-start polling if enabled
  useEffect(() => {
    if (enablePolling) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [enablePolling, startPolling, stopPolling]);

  // Auto-switch to first available server if no active server
  useEffect(() => {
    if (autoSwitch && serverData && !serverData.activeServer && serverData.servers?.length > 0) {
      const firstServer = serverData.servers[0];
      if (firstServer) {
        switchServer(firstServer.id).catch(console.error);
      }
    }
  }, [autoSwitch, serverData, switchServer]);

  return {
    // State
    activeServer: serverData?.activeServer || null,
    servers: serverData?.servers || [],
    isLoading: showLoading ? isLoading : false,
    error: error?.message || null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isPolling,
    isSwitching,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearError,
    switchServer,
    addServer,
    updateServer,
    removeServer,
    testServer,
    getServerStatus,
  };
}

// ============================================================================
// Provider Component (moved to separate file to avoid JSX in .ts file)
// ============================================================================

// Note: ActiveServerProvider component should be in a separate .tsx file
// to avoid JSX syntax in TypeScript files

export default useActiveServer;
