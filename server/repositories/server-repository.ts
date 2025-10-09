/**
 * Server Repository
 * 
 * This module provides data access operations for FHIR server management
 * including server configuration, testing, and activation.
 */

import { db } from "../db";
import { fhirServers } from "@shared/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  fhirVersion?: string; // FHIR version (R4, R5, R6)
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'oauth2';
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  };
  timeoutMs?: number;
  maxConcurrentRequests?: number;
  capabilities?: {
    supportedVersions: string[];
    supportedResourceTypes: string[];
    supportedOperations: string[];
  };
  status?: {
    isOnline: boolean;
    lastChecked: Date;
    responseTime: number;
    error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerTestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  capabilities?: any;
}

export interface ServerStatus {
  isOnline: boolean;
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

// ============================================================================
// Server Repository
// ============================================================================

class ServerRepository {
  private static instance: ServerRepository;

  public static getInstance(): ServerRepository {
    if (!ServerRepository.instance) {
      ServerRepository.instance = new ServerRepository();
    }
    return ServerRepository.instance;
  }

  /**
   * Get all servers
   */
  async getAllServers(): Promise<ServerConfig[]> {
    try {
      const result = await db.select().from(fhirServers);
      return result.map(this.mapDbToServer);
    } catch (error) {
      console.error('Failed to get all servers:', error);
      throw new Error('Failed to retrieve servers');
    }
  }

  /**
   * Get server by ID
   */
  async getServerById(id: string): Promise<ServerConfig | null> {
    try {
      const result = await db.select().from(fhirServers).where(eq(fhirServers.id, id)).limit(1);
      return result.length > 0 ? this.mapDbToServer(result[0]) : null;
    } catch (error) {
      console.error('Failed to get server by ID:', error);
      throw new Error('Failed to retrieve server');
    }
  }

  /**
   * Get active server
   */
  async getActiveServer(): Promise<ServerConfig | null> {
    try {
      const result = await db.select().from(fhirServers).where(eq(fhirServers.isActive, true)).limit(1);
      return result.length > 0 ? this.mapDbToServer(result[0]) : null;
    } catch (error) {
      console.error('Failed to get active server:', error);
      throw new Error('Failed to retrieve active server');
    }
  }

  /**
   * Create new server
   */
  async createServer(serverData: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServerConfig> {
    try {
      const now = new Date();
      const serverId = crypto.randomUUID();
      
      const newServer = {
        name: serverData.name,
        url: serverData.url,
        isActive: serverData.isActive || false,
        authConfig: serverData.auth ? serverData.auth : null,
        createdAt: now
      };

      await db.insert(fhirServers).values(newServer);
      
      return this.mapDbToServer(newServer);
    } catch (error) {
      console.error('Failed to create server:', error);
      throw new Error('Failed to create server');
    }
  }

  /**
   * Update server
   */
  async updateServer(id: string, updates: Partial<ServerConfig>): Promise<ServerConfig | null> {
    try {
      const updateData: any = {};

      // Only update fields that exist in the schema
      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }
      if (updates.url !== undefined) {
        updateData.url = updates.url;
      }
      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive;
      }
      if (updates.auth !== undefined) {
        updateData.authConfig = updates.auth;
      }

      const result = await db.update(fhirServers)
        .set(updateData)
        .where(eq(fhirServers.id, id))
        .returning();

      return result.length > 0 ? this.mapDbToServer(result[0]) : null;
    } catch (error) {
      console.error('Failed to update server:', error);
      throw new Error('Failed to update server');
    }
  }

  /**
   * Delete server
   */
  async deleteServer(id: string): Promise<boolean> {
    try {
      const result = await db.delete(fhirServers).where(eq(fhirServers.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Failed to delete server:', error);
      throw new Error('Failed to delete server');
    }
  }

  /**
   * Activate server (deactivate all others)
   */
  async activateServer(id: string): Promise<ServerConfig | null> {
    try {
      // First, deactivate all servers
      await db.update(fhirServers).set({ isActive: false });
      
      // Then activate the specified server
      const result = await db.update(fhirServers)
        .set({ isActive: true })
        .where(eq(fhirServers.id, id))
        .returning();

      return result.length > 0 ? this.mapDbToServer(result[0]) : null;
    } catch (error) {
      console.error('Failed to activate server:', error);
      throw new Error('Failed to activate server');
    }
  }

  /**
   * Test server connection
   */
  async testServerConnection(id: string): Promise<ServerTestResult> {
    try {
      const server = await this.getServerById(id);
      if (!server) {
        return { success: false, responseTime: 0, error: 'Server not found' };
      }

      return await this.testServerConnectionWithData(server);
    } catch (error) {
      console.error('Failed to test server connection:', error);
      return { 
        success: false, 
        responseTime: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Test server connection with server data
   */
  async testServerConnectionWithData(serverData: ServerConfig): Promise<ServerTestResult> {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      const response = await fetch(`${serverData.url}/metadata`, {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
          'Content-Type': 'application/fhir+json',
        },
        signal: AbortSignal.timeout(serverData.timeoutMs || 30000)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const capabilities = await response.json();

      // Extract and normalize FHIR version
      const fhirVersion = this.normalizeFhirVersion(capabilities.fhirVersion);
      
      // Update server with detected FHIR version
      if (serverData.id && fhirVersion) {
        await db.update(fhirServers)
          .set({ fhirVersion })
          .where(eq(fhirServers.id, serverData.id));
        
        console.log(`[ServerRepository] Detected FHIR version ${fhirVersion} for server ${serverData.name}`);
      }

      // Update server status
      await this.updateServerStatus(serverData.id, {
        isOnline: true,
        lastChecked: new Date(),
        responseTime,
        error: undefined
      });

      return {
        success: true,
        responseTime,
        capabilities
      };
    } catch (error) {
      const responseTime = Date.now() - Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update server status with error
      if (serverData.id) {
        await this.updateServerStatus(serverData.id, {
          isOnline: false,
          lastChecked: new Date(),
          responseTime: 0,
          error: errorMessage
        });
      }

      return {
        success: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Normalizes FHIR version string to standard Rx format
   * @param version - Raw FHIR version (e.g., "4.0.1", "5.0.0", "6.0.0-ballot1")
   * @returns Normalized version (R4, R5, R6) or null
   */
  private normalizeFhirVersion(version: string | undefined): string | null {
    if (!version) return null;

    // Extract major version number
    const majorVersion = version.split('.')[0];

    switch (majorVersion) {
      case '4':
        return 'R4';
      case '5':
        return 'R5';
      case '6':
        return 'R6';
      default:
        // Check if version string already contains R4/R5/R6
        if (version.toUpperCase().includes('R4')) return 'R4';
        if (version.toUpperCase().includes('R5')) return 'R5';
        if (version.toUpperCase().includes('R6')) return 'R6';
        
        // Return null for unknown versions
        console.warn(`[ServerRepository] Unknown FHIR version ${version}`);
        return null;
    }
  }

  /**
   * Get server status
   */
  async getServerStatus(id: string): Promise<ServerStatus | null> {
    try {
      const server = await this.getServerById(id);
      return server?.status || null;
    } catch (error) {
      console.error('Failed to get server status:', error);
      throw new Error('Failed to retrieve server status');
    }
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities(id: string): Promise<any> {
    try {
      const server = await this.getServerById(id);
      return server?.capabilities || null;
    } catch (error) {
      console.error('Failed to get server capabilities:', error);
      throw new Error('Failed to retrieve server capabilities');
    }
  }

  /**
   * Update server status
   * Note: Status is not stored in the current schema, so this is a no-op
   */
  private async updateServerStatus(id: string, status: ServerStatus): Promise<void> {
    // Status is not stored in the current schema
    // This method is kept for compatibility but doesn't persist status
    console.log(`Server ${id} status:`, status);
  }

  /**
   * Map database record to ServerConfig
   */
  private mapDbToServer(dbRecord: any): ServerConfig {
    return {
      id: dbRecord.id.toString(),
      name: dbRecord.name,
      url: dbRecord.url,
      isActive: dbRecord.isActive,
      auth: dbRecord.authConfig || undefined,
      fhirVersion: dbRecord.fhirVersion || undefined,
      timeoutMs: 30000, // Default value
      maxConcurrentRequests: 10, // Default value
      capabilities: undefined, // Not stored in current schema
      status: undefined, // Not stored in current schema
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.createdAt // Use createdAt as updatedAt since updatedAt doesn't exist
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export function getServerRepository(): ServerRepository {
  return ServerRepository.getInstance();
}

export default ServerRepository;
