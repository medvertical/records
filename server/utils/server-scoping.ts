/**
 * Server Scoping Utilities
 * 
 * Provides consistent server scoping across the validation system to ensure
 * data isolation between different FHIR servers.
 */

import { storage } from '../storage';

/**
 * Get the active server ID, throwing an error if no active server is configured
 */
export async function getActiveServerId(): Promise<number> {
  const activeServer = await storage.getActiveFhirServer();
  
  if (!activeServer) {
    throw new Error('No active FHIR server configured. Please configure a FHIR server in the settings.');
  }
  
  return activeServer.id;
}

/**
 * Get the active server ID with a fallback value
 */
export async function getActiveServerIdWithFallback(fallbackId: number = 1): Promise<number> {
  try {
    return await getActiveServerId();
  } catch (error) {
    console.warn('[ServerScoping] No active server found, using fallback ID:', fallbackId);
    return fallbackId;
  }
}

/**
 * Get the active server object
 */
export async function getActiveServer() {
  const activeServer = await storage.getActiveFhirServer();
  
  if (!activeServer) {
    throw new Error('No active FHIR server configured. Please configure a FHIR server in the settings.');
  }
  
  return activeServer;
}

/**
 * Validate that a server ID matches the active server
 */
export async function validateServerScope(serverId: number): Promise<boolean> {
  try {
    const activeServerId = await getActiveServerId();
    return serverId === activeServerId;
  } catch (error) {
    return false;
  }
}

/**
 * Get server-scoped query parameters for React Query
 */
export async function getServerScopedQueryKey(baseKey: string[]): Promise<string[]> {
  try {
    const activeServerId = await getActiveServerId();
    return [...baseKey, `server:${activeServerId}`];
  } catch (error) {
    // Fallback to base key if no active server
    return baseKey;
  }
}

/**
 * Get server-scoped storage key for localStorage
 */
export async function getServerScopedStorageKey(baseKey: string): Promise<string> {
  try {
    const activeServerId = await getActiveServerId();
    return `${baseKey}-server-${activeServerId}`;
  } catch (error) {
    // Fallback to base key if no active server
    return baseKey;
  }
}

/**
 * Middleware to ensure server scoping in API requests
 */
export function requireActiveServer() {
  return async (req: any, res: any, next: any) => {
    try {
      const activeServer = await getActiveServer();
      req.activeServer = activeServer;
      req.activeServerId = activeServer.id;
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Server Configuration Error',
        message: 'No active server is configured or the server configuration is invalid',
        code: 'SERVER_CONFIG_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Extract server ID from request with validation
 */
export async function extractServerIdFromRequest(req: any): Promise<number> {
  // Try to get from query parameter first
  if (req.query.serverId) {
    const serverId = parseInt(req.query.serverId as string);
    if (isNaN(serverId)) {
      throw new Error('Invalid serverId parameter');
    }
    
    // Validate that the requested server ID matches the active server
    const isValid = await validateServerScope(serverId);
    if (!isValid) {
      throw new Error('Requested server ID does not match the active server');
    }
    
    return serverId;
  }
  
  // Fall back to active server ID
  return await getActiveServerId();
}

/**
 * Server scoping context for validation operations
 */
export interface ServerScopingContext {
  serverId: number;
  serverUrl: string;
  serverName: string;
}

/**
 * Get server scoping context for the active server
 */
export async function getServerScopingContext(): Promise<ServerScopingContext> {
  const activeServer = await getActiveServer();
  
  return {
    serverId: activeServer.id,
    serverUrl: activeServer.url,
    serverName: activeServer.name,
  };
}

