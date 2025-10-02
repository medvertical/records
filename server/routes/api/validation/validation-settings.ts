import type { Express } from "express";
import { getValidationSettingsService } from "../../../services/validation/settings/validation-settings-service-simplified";
import type { ValidationSettings, ValidationSettingsUpdate } from "@shared/validation-settings.js";
import { BUILT_IN_PRESETS } from "@shared/validation-settings.js";

export function setupValidationSettingsRoutes(app: Express) {
  // Get Current Validation Settings
  app.get("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const settings = await settingsService.getCurrentSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update Validation Settings
  app.put("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const update: ValidationSettingsUpdate = req.body;
      const result = await settingsService.updateSettings(update);
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

  // Get Settings History
  app.get("/api/validation/settings/history", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { limit = 50, offset = 0 } = req.query;
      const history = await settingsService.getSettingsHistory(
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reset Settings
  app.post("/api/validation/settings/reset", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { resetToDefault = false } = req.body;
      const result = await settingsService.resetSettings(resetToDefault);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Built-in Presets
  app.get("/api/validation/settings/presets", async (req, res) => {
    try {
      res.json(BUILT_IN_PRESETS);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notify Settings Change
  app.post("/api/validation/settings/notify-change", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { changeType, details } = req.body;
      await settingsService.notifySettingsChange(changeType, details);
      res.json({ message: "Change notification sent" });
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

  // Rollback Settings
  app.post("/api/validation/settings/rollback", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { versionId } = req.body;
      const result = await settingsService.rollbackSettings(versionId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test Settings
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

  // Get Audit Trail
  app.get("/api/validation/settings/audit-trail", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { limit = 100, offset = 0, startDate, endDate } = req.query;
      const auditTrail = await settingsService.getAuditTrail(
        parseInt(limit as string),
        parseInt(offset as string),
        startDate as string,
        endDate as string
      );
      res.json(auditTrail);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Audit Trail Statistics
  app.get("/api/validation/settings/audit-trail/statistics", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const stats = await settingsService.getAuditTrailStatistics();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
