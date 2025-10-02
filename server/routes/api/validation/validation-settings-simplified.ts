/**
 * Simplified Validation Settings Routes
 * 
 * This module provides basic CRUD operations for validation settings
 * without versioning, audit trails, or complex history management.
 */

import type { Express } from "express";
import { getValidationSettingsService } from "../../../services/validation/settings/validation-settings-service-simplified";
import type { 
  ValidationSettings, 
  ValidationSettingsUpdate,
  ValidationSettingsPreset
} from "@shared/validation-settings-simplified";

export function setupValidationSettingsRoutes(app: Express) {
  // Get Current Validation Settings
  app.get("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
      const settings = await settingsService.getCurrentSettings(serverId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Current Validation Settings with Snapshot Info
  app.get("/api/validation/settings/snapshot", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
      const settings = await settingsService.getCurrentSettingsWithSnapshot(serverId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update Validation Settings
  app.put("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const update: ValidationSettingsUpdate & { serverId?: number } = req.body;
      const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : update.serverId;
      const result = await settingsService.updateSettings({ ...update, serverId });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validate Settings
  app.post("/api/validation/settings/validate", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { settings } = req.body;
      const validation = await settingsService.validateSettings(settings);
      res.json(validation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reset Settings to Default
  app.post("/api/validation/settings/reset", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const result = await settingsService.resetToDefault();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Built-in Presets
  app.get("/api/validation/settings/presets", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const presets = await settingsService.getBuiltInPresets();
      res.json(presets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Apply Preset
  app.post("/api/validation/settings/presets/apply", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { presetId } = req.body;
      const result = await settingsService.applyPreset(presetId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test Settings with Sample Resource
  app.post("/api/validation/settings/test", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { settings, testResource } = req.body;
      const result = await settingsService.testSettings(settings, testResource);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Settings Statistics
  app.get("/api/validation/settings/statistics", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const stats = await settingsService.getSettingsStatistics();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Health Check
  app.get("/api/validation/settings/health", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const health = await settingsService.getHealthStatus();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
