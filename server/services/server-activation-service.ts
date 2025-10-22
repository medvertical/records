/**
 * Server Activation Service
 * 
 * This service manages server activation events and provides
 * app-wide rebinding when the active server changes.
 */

import { EventEmitter } from 'events';
import { FhirClient } from '../services/fhir/fhir-client';
import { storage } from '../storage';
import { getFhirCache } from '../services/fhir/fhir-cache';

// Global server activation emitter
let serverActivationEmitter: EventEmitter;

export class ServerActivationService {
  private static instance: ServerActivationService;
  private fhirClient: FhirClient | null = null;

  private constructor() {
    serverActivationEmitter = new EventEmitter();
    
    // Make emitter available globally
    (global as any).serverActivationEmitter = serverActivationEmitter;
    
    // Listen for server activation events
    serverActivationEmitter.on('serverActivated', this.handleServerActivation.bind(this));
  }

  public static getInstance(): ServerActivationService {
    if (!ServerActivationService.instance) {
      ServerActivationService.instance = new ServerActivationService();
    }
    return ServerActivationService.instance;
  }

  public setFhirClient(fhirClient: FhirClient) {
    this.fhirClient = fhirClient;
  }

  public getFhirClient(): FhirClient | null {
    return this.fhirClient;
  }

  private async handleServerActivation(event: { serverId: string; server: any; timestamp: string }) {
    console.log(`[ServerActivationService] Handling server activation for server ${event.serverId}`);
    
    try {
      // Update the FHIR client with the new server URL
      if (this.fhirClient && event.server.url) {
        console.log(`[ServerActivationService] Updating FHIR client to use server: ${event.server.url}`);
        
        // Clear cache for the previous server to prevent stale data
        const oldServerId = (this.fhirClient as any).serverId;
        if (oldServerId !== undefined) {
          console.log(`[ServerActivationService] Invalidating cache for previous server ${oldServerId}`);
          const cache = getFhirCache();
          cache.invalidateServer(oldServerId);
        }
        
        // Create new FHIR client with the new server URL and serverId
        const newServerId = parseInt(event.serverId);
        const newFhirClient = new FhirClient(event.server.url, undefined, newServerId);
        
        // Test the connection to ensure it's valid
        const connectionResult = await newFhirClient.testConnection();
        
        if (connectionResult.connected) {
          // Update the global FHIR client
          this.fhirClient = newFhirClient;
          global.fhirClient = newFhirClient;

          // Update global dashboard service if it exists
          if (global.dashboardService) {
            global.dashboardService.updateFhirClient(newFhirClient);
          }
          
          console.log(`[ServerActivationService] Successfully updated FHIR client for server ${event.serverId}`);
          
          // Detect server capabilities in the background (non-blocking)
          this.detectCapabilitiesInBackground(parseInt(event.serverId), newFhirClient, event.server.url);
          
          // Emit client updated event for other services
          serverActivationEmitter.emit('fhirClientUpdated', {
            serverId: event.serverId,
            server: event.server,
            timestamp: new Date().toISOString()
          });
        } else {
          console.error(`[ServerActivationService] Failed to connect to new server ${event.server.url}: ${connectionResult.error}`);
        }
      }
    } catch (error) {
      console.error(`[ServerActivationService] Error handling server activation:`, error);
    }
  }

  private async detectCapabilitiesInBackground(serverId: number, fhirClient: FhirClient, serverUrl?: string) {
    try {
      console.log(`[ServerActivationService] Detecting capabilities for server ${serverId} in background`);
      const { ServerCapabilitiesCache } = await import('./fhir/server-capabilities-cache.js');
      
      // This will use cached capabilities if available (< 24 hours old)
      // or detect and cache them if not
      await ServerCapabilitiesCache.getCapabilities(serverId, fhirClient, serverUrl);
      
      console.log(`[ServerActivationService] Capabilities detection complete for server ${serverId}`);
    } catch (error) {
      console.error(`[ServerActivationService] Error detecting capabilities for server ${serverId}:`, error);
      // Don't throw - this is a background task
    }
  }

  public getEmitter(): EventEmitter {
    return serverActivationEmitter;
  }

  // Method to manually trigger FHIR client update (for testing)
  public async updateFhirClientForServer(serverId: string): Promise<boolean> {
    try {
      const servers = await storage.getFhirServers();
      const server = servers.find(s => s.id === parseInt(serverId));
      if (!server) {
        console.error(`[ServerActivationService] Server ${serverId} not found`);
        return false;
      }

      await this.handleServerActivation({
        serverId,
        server,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error(`[ServerActivationService] Error updating FHIR client for server ${serverId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const serverActivationService = ServerActivationService.getInstance();
