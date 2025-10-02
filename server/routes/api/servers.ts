/**
 * Server Management Routes
 * 
 * This module provides CRUD operations for FHIR server management
 * including server configuration, testing, and activation.
 */

import type { Express } from "express";
import { getServerRepository } from "../../repositories/server-repository";

export function setupServerRoutes(app: Express) {
  // Get all servers
  app.get("/api/servers", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const servers = await serverRepo.getAllServers();
      const activeServer = await serverRepo.getActiveServer();
      
      res.json({
        servers,
        activeServer
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get specific server
  app.get("/api/servers/:id", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const server = await serverRepo.getServerById(req.params.id);
      
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new server
  app.post("/api/servers", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverData = req.body;
      
      // Validate required fields
      if (!serverData.name || !serverData.url) {
        return res.status(400).json({ 
          message: "Server name and URL are required" 
        });
      }
      
      const server = await serverRepo.createServer(serverData);
      res.status(201).json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update server
  app.put("/api/servers/:id", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverId = req.params.id;
      const updates = req.body;
      
      const server = await serverRepo.updateServer(serverId, updates);
      
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete server
  app.delete("/api/servers/:id", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverId = req.params.id;
      
      const deleted = await serverRepo.deleteServer(serverId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Activate server
  app.post("/api/servers/:id/activate", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverId = req.params.id;
      
      const server = await serverRepo.activateServer(serverId);
      
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      // Emit server activation event for app-wide rebind
      // This could be used by other services to update their configurations
      console.log(`[ServerActivation] Server ${serverId} activated, triggering app-wide rebind`);
      
      // Emit server activation event for app-wide rebind
      // This notifies validation services, FHIR clients, etc. to rebind to the new server
      if (global.serverActivationEmitter) {
        global.serverActivationEmitter.emit('serverActivated', {
          serverId,
          server,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        ...server,
        message: "Server activated successfully. App-wide rebind triggered."
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test server connection
  app.post("/api/servers/:id/test", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverId = req.params.id;
      
      const result = await serverRepo.testServerConnection(serverId);
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test server connection (with server data)
  app.post("/api/servers/test", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverData = req.body;
      
      const result = await serverRepo.testServerConnectionWithData(serverData);
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get server status
  app.get("/api/servers/:id/status", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverId = req.params.id;
      
      const status = await serverRepo.getServerStatus(serverId);
      
      if (!status) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get server capabilities
  app.get("/api/servers/:id/capabilities", async (req, res) => {
    try {
      const serverRepo = getServerRepository();
      const serverId = req.params.id;
      
      const capabilities = await serverRepo.getServerCapabilities(serverId);
      
      if (!capabilities) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      res.json(capabilities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}

