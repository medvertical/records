/**
 * Server Capabilities API Routes
 * 
 * Endpoints for managing and retrieving server capabilities
 */

import type { Express } from "express";
import { ServerCapabilitiesCache } from "../../services/fhir/server-capabilities-cache.js";
import { serverActivationService } from "../../services/server-activation-service.js";
import { storage } from "../../storage.js";
import { logger } from "../../utils/logger.js";

export function setupServerCapabilitiesRoutes(app: Express) {
  /**
   * GET /api/servers/:id/capabilities
   * Get detected capabilities for a specific server
   */
  app.get("/api/servers/:id/capabilities", async (req, res) => {
    console.log('[CapabilitiesAPI] ROUTE HIT - /api/servers/:id/capabilities', req.params);
    try {
      const serverId = parseInt(req.params.id);
      
      if (isNaN(serverId)) {
        return res.status(400).json({ error: "Invalid server ID" });
      }

      // Get the FHIR client for this server
      const fhirClient = serverActivationService.getFhirClient();
      if (!fhirClient) {
        return res.status(503).json({ error: "FHIR client not available" });
      }

      // Get server info to pass URL
      const servers = await storage.getFhirServers();
      console.log(`[CapabilitiesAPI] Looking for server ${serverId} (type: ${typeof serverId})`);
      console.log(`[CapabilitiesAPI] Available servers:`, servers.map(s => ({ id: s.id, type: typeof s.id })));
      const server = servers.find(s => s.id === serverId || s.id === serverId.toString() || s.id == serverId);
      
      if (!server) {
        logger.warn(`[CapabilitiesAPI] Server ${serverId} not found in:`, servers.map(s => s.id));
        return res.status(404).json({ message: "Server not found" });
      }
      
      // Get capabilities (from cache or detect)
      const capabilities = await ServerCapabilitiesCache.getCapabilities(serverId, fhirClient, server.url);

      res.json({
        success: true,
        data: capabilities,
      });
    } catch (error: any) {
      logger.error('[CapabilitiesAPI] Error getting capabilities:', error);
      res.status(500).json({
        error: "Failed to get server capabilities",
        message: error.message,
      });
    }
  });

  /**
   * POST /api/servers/:id/capabilities/refresh
   * Force refresh capabilities for a server
   */
  app.post("/api/servers/:id/capabilities/refresh", async (req, res) => {
    try {
      const serverId = parseInt(req.params.id);
      
      if (isNaN(serverId)) {
        return res.status(400).json({ error: "Invalid server ID" });
      }

      // Get the FHIR client for this server
      const fhirClient = serverActivationService.getFhirClient();
      if (!fhirClient) {
        return res.status(503).json({ error: "FHIR client not available" });
      }

      logger.info(`[CapabilitiesAPI] Refreshing capabilities for server ${serverId}`);

      // Get server info to pass URL
      const servers = await storage.getFhirServers();
      const server = servers.find(s => s.id === serverId || s.id === serverId.toString());
      
      // Force refresh
      const capabilities = await ServerCapabilitiesCache.refreshCapabilities(serverId, fhirClient, server?.url);

      res.json({
        success: true,
        data: capabilities,
        message: "Capabilities refreshed successfully",
      });
    } catch (error: any) {
      logger.error('[CapabilitiesAPI] Error refreshing capabilities:', error);
      res.status(500).json({
        error: "Failed to refresh server capabilities",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/servers/capabilities/cache-stats
   * Get cache statistics (for debugging)
   */
  app.get("/api/servers/capabilities/cache-stats", async (req, res) => {
    try {
      const stats = ServerCapabilitiesCache.getCacheStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('[CapabilitiesAPI] Error getting cache stats:', error);
      res.status(500).json({
        error: "Failed to get cache statistics",
        message: error.message,
      });
    }
  });
}

