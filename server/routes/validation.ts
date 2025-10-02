import type { Express } from "express";
import { storage } from "../storage.js";
import { ConsolidatedValidationService } from "../services/validation";
import { getValidationSettingsService } from "../services/validation/settings/validation-settings-service-simplified";
import { getValidationPipeline, getValidationQueueService, ValidationPriority, getIndividualResourceProgressService, getValidationCancellationRetryService } from "../services/validation";
import { DashboardService } from "../services/dashboard/dashboard-service";
import type { ValidationSettings, ValidationSettingsUpdate } from "@shared/validation-settings.js";
import { BUILT_IN_PRESETS } from "@shared/validation-settings.js";
import ValidationCacheManager from "../utils/validation-cache-manager.js";

// Global validation state tracking
let globalValidationState = {
  isRunning: false,
  isPaused: false,
  startTime: null as Date | null,
  canPause: false,
  shouldStop: false,
  resumeData: null as any | null,
  currentResourceType: null as string | null,
  nextResourceType: null as string | null,
  activeValidationAspects: null as {
    structural: boolean;
    profile: boolean;
    terminology: boolean;
    reference: boolean;
    businessRule: boolean;
    metadata: boolean;
  } | null,
  lastBroadcastTime: null as number | null,
  // Real-time progress counters
  processedResources: 0,
  totalResources: 0,
  currentBatch: 0,
  totalBatches: 0,
  errors: 0,
  warnings: 0,
  // Performance metrics
  startTimeMs: 0,
  lastUpdateTime: 0,
  averageProcessingTime: 0,
  estimatedTimeRemaining: 0,
  // Resource type progress
  resourceTypeProgress: {} as Record<string, {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
    startTime: number;
  }>,
  // Validation aspects progress
  aspectProgress: {} as Record<string, {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
    startTime: number;
  }>
};

export function setupValidationRoutes(app: Express, consolidatedValidationService: ConsolidatedValidationService | null, dashboardService: DashboardService | null) {
  // Individual resource validation
  app.post("/api/validation/validate-resource", async (req, res) => {
    try {
      if (!consolidatedValidationService) {
        return res.status(400).json({ message: "Validation service not initialized" });
      }

      const { resource } = req.body;
      const { detailedResult } = await consolidatedValidationService.validateResource(resource, true, true);

      const errors = detailedResult.issues.filter(issue => issue.severity === 'error' || issue.severity === 'fatal');
      const warnings = detailedResult.issues.filter(issue => issue.severity === 'warning');

      res.json({
        isValid: detailedResult.isValid,
        errors,
        warnings,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/validate-resource-detailed", async (req, res) => {
    try {
      // Validation is handled by the pipeline via consolidated service

      const { resource } = req.body;
      
      // Create enhanced config with profiles from installed packages
      const { detailedResult } = await consolidatedValidationService.validateResource(resource, true, true);
      
      res.json(detailedResult);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk validation operations
  app.post("/api/validation/bulk/start", async (req, res) => {
    try {
      if (globalValidationState.isRunning) {
        return res.status(400).json({ message: "Validation is already running" });
      }

      const { resourceTypes, validationAspects, config } = req.body;
      
      // Initialize global state
      globalValidationState = {
        isRunning: true,
        isPaused: false,
        startTime: new Date(),
        canPause: true,
        shouldStop: false,
        resumeData: null,
        currentResourceType: null,
        nextResourceType: null,
        activeValidationAspects: validationAspects,
        lastBroadcastTime: null,
        processedResources: 0,
        totalResources: 0,
        currentBatch: 0,
        totalBatches: 0,
        errors: 0,
        warnings: 0,
        startTimeMs: Date.now(),
        lastUpdateTime: Date.now(),
        averageProcessingTime: 0,
        estimatedTimeRemaining: 0,
        resourceTypeProgress: {},
        aspectProgress: {}
      };

      // Start validation process (simplified for this example)
      res.json({ 
        message: "Bulk validation started",
        state: globalValidationState
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/bulk/progress", async (req, res) => {
    try {
      res.json(globalValidationState);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/pause", async (req, res) => {
    try {
      if (!globalValidationState.isRunning) {
        return res.status(400).json({ message: "No validation is currently running" });
      }

      globalValidationState.isPaused = true;
      globalValidationState.canPause = false;
      
      res.json({ 
        message: "Validation paused",
        state: globalValidationState
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/resume", async (req, res) => {
    try {
      if (!globalValidationState.isPaused) {
        return res.status(400).json({ message: "No validation is currently paused" });
      }

      globalValidationState.isPaused = false;
      globalValidationState.canPause = true;
      
      res.json({ 
        message: "Validation resumed",
        state: globalValidationState
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/stop", async (req, res) => {
    try {
      globalValidationState.isRunning = false;
      globalValidationState.isPaused = false;
      globalValidationState.shouldStop = true;
      
      res.json({ 
        message: "Validation stopped",
        state: globalValidationState
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation settings
  app.get("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const settings = await settingsService.getCurrentSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Validation settings load error:', error);
      
      // Categorize errors and provide appropriate responses
      if (error.message.includes('database') || error.message.includes('connection')) {
        return res.status(503).json({ 
          error: 'Database Error',
          message: 'Unable to load settings due to database issues. Please try again later.',
          code: 'DATABASE_ERROR'
        });
      }
      
      if (error.message.includes('not found') || error.message.includes('not initialized')) {
        return res.status(404).json({ 
          error: 'Settings Not Found',
          message: 'Validation settings could not be found or loaded',
          code: 'SETTINGS_NOT_FOUND'
        });
      }
      
      // Generic server error
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while loading settings',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  app.put("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const update: ValidationSettingsUpdate = req.body;
      
      // Validate request body
      if (!update || typeof update !== 'object') {
        return res.status(400).json({ 
          error: 'Invalid request body',
          message: 'Request body must be a valid ValidationSettingsUpdate object',
          code: 'INVALID_REQUEST_BODY'
        });
      }

      if (!update.settings || typeof update.settings !== 'object') {
        return res.status(400).json({ 
          error: 'Missing settings',
          message: 'Settings object is required in the request body',
          code: 'MISSING_SETTINGS'
        });
      }

      // Validate that settings contains at least one valid validation setting
      const validSettingKeys = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata', 'server', 'performance'];
      const hasValidSettings = validSettingKeys.some(key => key in update.settings);
      
      if (!hasValidSettings && Object.keys(update.settings).length > 0) {
        return res.status(400).json({ 
          error: 'Invalid settings content',
          message: 'Settings object must contain valid validation settings (structural, profile, terminology, reference, businessRule, metadata, server, or performance)',
          code: 'INVALID_SETTINGS_CONTENT',
          validKeys: validSettingKeys
        });
      }

      const result = await settingsService.updateSettings(update);
      res.json(result);
    } catch (error: any) {
      console.error('Validation settings update error:', error);
      
      // Categorize errors and provide appropriate responses
      if (error.message.includes('Validation failed')) {
        return res.status(400).json({ 
          error: 'Validation Error',
          message: error.message,
          code: 'VALIDATION_ERROR',
          details: error.validationErrors || []
        });
      }
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          error: 'Settings Not Found',
          message: 'The requested settings could not be found',
          code: 'SETTINGS_NOT_FOUND'
        });
      }
      
      if (error.message.includes('database') || error.message.includes('connection')) {
        return res.status(503).json({ 
          error: 'Database Error',
          message: 'Unable to save settings due to database issues. Please try again later.',
          code: 'DATABASE_ERROR'
        });
      }
      
      // Generic server error
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while updating settings',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Validation profiles
  app.get("/api/validation/profiles", async (req, res) => {
    try {
      const profiles = await storage.getValidationProfiles();
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/profiles", async (req, res) => {
    try {
      const { url, name, version } = req.body;
      const profile = await storage.createValidationProfile({ url, name, version });
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation errors
  app.get("/api/validation/errors/recent", async (req, res) => {
    try {
      const errors = await storage.getRecentValidationErrors();
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation test settings
  app.post("/api/validation/test-settings", async (req, res) => {
    try {
      const { testResource } = req.body;
      const { detailedResult } = await consolidatedValidationService.validateResource(testResource, true, true);
      res.json(detailedResult);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation cleanup
  app.post("/api/validation/cleanup", async (req, res) => {
    try {
      const { olderThanDays = 30 } = req.body;
      const result = await storage.cleanupOldValidationResults(olderThanDays);
      res.json({ 
        message: `Cleaned up ${result.deletedCount} old validation results`,
        deletedCount: result.deletedCount
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/cleanup/statistics", async (req, res) => {
    try {
      const stats = await storage.getValidationCleanupStatistics();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation pipeline
  app.post("/api/validation/pipeline", async (req, res) => {
    try {
      const { resources, config } = req.body;
      const pipeline = getValidationPipeline();
      const result = await pipeline.processResources(resources, config);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/pipeline/:requestId/status", async (req, res) => {
    try {
      const { requestId } = req.params;
      const pipeline = getValidationPipeline();
      const status = await pipeline.getRequestStatus(requestId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/pipeline/:requestId/cancel", async (req, res) => {
    try {
      const { requestId } = req.params;
      const pipeline = getValidationPipeline();
      await pipeline.cancelRequest(requestId);
      res.json({ message: "Request cancelled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation backups
  app.get("/api/validation/backups", async (req, res) => {
    try {
      const backups = await storage.getValidationBackups();
      res.json(backups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/backups", async (req, res) => {
    try {
      const { name, description } = req.body;
      const backup = await storage.createValidationBackup(name, description);
      res.json(backup);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/backups/:backupId", async (req, res) => {
    try {
      const { backupId } = req.params;
      const backup = await storage.getValidationBackup(backupId);
      res.json(backup);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/validation/backups/:backupId", async (req, res) => {
    try {
      const { backupId } = req.params;
      await storage.deleteValidationBackup(backupId);
      res.json({ message: "Backup deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/backups/:backupId/verify", async (req, res) => {
    try {
      const { backupId } = req.params;
      const verification = await storage.verifyValidationBackup(backupId);
      res.json(verification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/backups/:backupId/restore", async (req, res) => {
    try {
      const { backupId } = req.params;
      const result = await storage.restoreValidationBackup(backupId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/backups/cleanup", async (req, res) => {
    try {
      const { olderThanDays = 90 } = req.body;
      const result = await storage.cleanupOldValidationBackups(olderThanDays);
      res.json({ 
        message: `Cleaned up ${result.deletedCount} old backups`,
        deletedCount: result.deletedCount
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Validation streaming (for real-time updates)
  app.get("/api/validation/stream", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendUpdate = () => {
      res.write(`data: ${JSON.stringify(globalValidationState)}\n\n`);
    };

    // Send initial state
    sendUpdate();

    // Send updates every 2 seconds
    const interval = setInterval(sendUpdate, 2000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  app.get("/api/validation/stream-disabled", (req, res) => {
    res.json({ 
      message: "Real-time streaming is disabled in MVP version. Use polling instead.",
      pollingEndpoint: "/api/validation/bulk/progress"
    });
  });
}
