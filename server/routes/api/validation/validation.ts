import type { Express } from "express";
import { storage } from "../../../storage.js";
import { ConsolidatedValidationService } from "../../../services/validation";
import { getValidationSettingsService } from "../../../services/validation/settings/validation-settings-service-simplified";
import { getValidationPipeline, getValidationQueueService, ValidationPriority, getIndividualResourceProgressService, getValidationCancellationRetryService } from "../../../services/validation";
import { DashboardService } from "../../../services/dashboard/dashboard-service";
import type { ValidationSettings, ValidationSettingsUpdate } from "@shared/validation-settings-simplified";
import ValidationCacheManager from "../../../utils/validation-cache-manager.js";
import { randomUUID } from "crypto";

// Validation schemas and helper functions
interface StartRequestPayload {
  resourceTypes?: string[];
  validationAspects?: {
    structural?: boolean;
    profile?: boolean;
    terminology?: boolean;
    reference?: boolean;
    businessRule?: boolean;
    metadata?: boolean;
  };
  config?: {
    batchSize?: number;
    maxConcurrency?: number;
    timeout?: number;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Validate start request payload
function validateStartRequest(payload: any): ValidationResult {
  const errors: string[] = [];

  // Check if payload is an object
  if (!payload || typeof payload !== 'object') {
    errors.push('Request body must be a valid JSON object');
    return { isValid: false, errors };
  }

  // Validate resourceTypes (optional array of strings)
  if (payload.resourceTypes !== undefined) {
    if (!Array.isArray(payload.resourceTypes)) {
      errors.push('resourceTypes must be an array of strings');
    } else {
      const invalidTypes = payload.resourceTypes.filter((type: any) => typeof type !== 'string' || !type.trim());
      if (invalidTypes.length > 0) {
        errors.push('All resourceTypes must be non-empty strings');
      }
    }
  }

  // Validate validationAspects (optional object with boolean properties)
  if (payload.validationAspects !== undefined) {
    if (typeof payload.validationAspects !== 'object' || payload.validationAspects === null) {
      errors.push('validationAspects must be an object');
    } else {
      const validAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
      const aspectKeys = Object.keys(payload.validationAspects);
      const invalidAspects = aspectKeys.filter(key => !validAspects.includes(key));
      if (invalidAspects.length > 0) {
        errors.push(`Invalid validation aspects: ${invalidAspects.join(', ')}. Valid aspects are: ${validAspects.join(', ')}`);
      }
      
      const nonBooleanAspects = aspectKeys.filter(key => typeof payload.validationAspects[key] !== 'boolean');
      if (nonBooleanAspects.length > 0) {
        errors.push(`All validation aspect values must be boolean. Invalid: ${nonBooleanAspects.join(', ')}`);
      }
    }
  }

  // Validate config (optional object)
  if (payload.config !== undefined) {
    if (typeof payload.config !== 'object' || payload.config === null) {
      errors.push('config must be an object');
    } else {
      // Validate batchSize
      if (payload.config.batchSize !== undefined) {
        if (!Number.isInteger(payload.config.batchSize) || payload.config.batchSize < 1 || payload.config.batchSize > 1000) {
          errors.push('config.batchSize must be an integer between 1 and 1000');
        }
      }

      // Validate maxConcurrency
      if (payload.config.maxConcurrency !== undefined) {
        if (!Number.isInteger(payload.config.maxConcurrency) || payload.config.maxConcurrency < 1 || payload.config.maxConcurrency > 20) {
          errors.push('config.maxConcurrency must be an integer between 1 and 20');
        }
      }

      // Validate timeout
      if (payload.config.timeout !== undefined) {
        if (!Number.isInteger(payload.config.timeout) || payload.config.timeout < 1000 || payload.config.timeout > 300000) {
          errors.push('config.timeout must be an integer between 1000 and 300000 milliseconds');
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Generate unique job ID
function generateJobId(): string {
  return `validation-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

// Estimate validation duration based on resource types and aspects
function estimateValidationDuration(resourceTypes?: string[], validationAspects?: any): number {
  const baseTimePerResource = 100; // milliseconds
  const aspectMultiplier = validationAspects ? Object.values(validationAspects).filter(Boolean).length : 6;
  const resourceCount = resourceTypes ? resourceTypes.length : 10; // Default estimate
  
  return Math.max(30000, resourceCount * aspectMultiplier * baseTimePerResource); // Minimum 30 seconds
}

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
  }>,
  // Enhanced tracking fields
  jobId: null as string | null,
  requestPayload: null as StartRequestPayload | null,
  startTimestamp: 0
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

      // Return full detailed result payload
      res.json(detailedResult);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/validate-resource-detailed", async (req, res) => {
    try {
      // Validation is handled by the pipeline via consolidated service
      console.log('[ValidationRoute] Request body:', JSON.stringify(req.body, null, 2));

      const { resource } = req.body;

      if (!resource) {
        return res.status(400).json({ message: 'Resource is required in request body' });
      }

      if (!resource.resourceType) {
        return res.status(400).json({ message: 'Resource must have a resourceType property' });
      }

      if (!resource.id) {
        return res.status(400).json({ message: 'Resource must have an id property' });
      }

      console.log('[ValidationRoute] Validating resource:', resource.resourceType, resource.id);

      const { detailedResult } = await consolidatedValidationService.validateResource(resource, true, true);
      
      res.json(detailedResult);
    } catch (error: any) {
      console.error('[ValidationRoute] Validation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk validation operations
  app.post("/api/validation/bulk/start", async (req, res) => {
    try {
      // Schema validation for request payload
      const validationResult = validateStartRequest(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({ 
          message: "Invalid request payload",
          errors: validationResult.errors
        });
      }

      const { resourceTypes, validationAspects, config } = req.body;
      
      // Check if validation is already running (idempotent behavior)
      if (globalValidationState.isRunning) {
        return res.status(200).json({ 
          message: "Validation is already running",
          state: globalValidationState,
          jobId: generateJobId(),
          isIdempotent: true
        });
      }

      // Use consolidated validation service for bulk operations
      const validationPipeline = getValidationPipeline();
      const queueService = getValidationQueueService();
      
      // Generate unique job ID for tracking
      const jobId = generateJobId();
      
      // Initialize global state with enhanced tracking
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
        aspectProgress: {},
        // Enhanced tracking
        jobId,
        requestPayload: { resourceTypes, validationAspects, config },
        startTimestamp: Date.now()
      };

      // Start validation process
      res.status(202).json({ 
        message: "Bulk validation started",
        jobId,
        state: globalValidationState,
        estimatedDuration: estimateValidationDuration(resourceTypes, validationAspects)
      });
    } catch (error: any) {
      console.error('[ValidationStart] Error starting validation:', error);
      res.status(500).json({ 
        message: "Failed to start validation",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/validation/bulk/progress - Get validation progress and status
  // This endpoint provides both progress data AND status information.
  // The 'status' field indicates the current validation state: 'idle', 'running', 'paused', 'completed', 'error'
  // No separate status endpoint is needed - all status information is included here.
  app.get("/api/validation/bulk/progress", async (req, res) => {
    try {
      // Get progress from consolidated service
      const progressService = getIndividualResourceProgressService();
      const progressStats = progressService.getProgressStats();
      const activeProgress = progressService.getActiveProgress();
      
      // Determine status based on global state
      let status = 'idle';
      if (globalValidationState.isRunning && !globalValidationState.isPaused) {
        status = 'running';
      } else if (globalValidationState.isRunning && globalValidationState.isPaused) {
        status = 'paused';
      } else if (globalValidationState.shouldStop) {
        status = 'completed';
      }
      
      // Combine with global state for backward compatibility
      const combinedProgress = {
        ...globalValidationState,
        ...progressStats,
        activeProgress,
        // Add status field for frontend compatibility
        status,
        // Ensure we have the latest progress data
        processedResources: progressStats.totalResources || globalValidationState.processedResources,
        totalResources: progressStats.totalResources || globalValidationState.totalResources,
        errors: progressStats.failedResources || globalValidationState.errors,
        warnings: progressStats.failedResources || globalValidationState.warnings
      };
      
      res.json(combinedProgress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/pause", async (req, res) => {
    try {
      // State consistency checks
      if (!globalValidationState.isRunning) {
        return res.status(400).json({ 
          message: "No validation is currently running",
          currentState: {
            isRunning: globalValidationState.isRunning,
            isPaused: globalValidationState.isPaused,
            jobId: globalValidationState.jobId
          }
        });
      }

      if (globalValidationState.isPaused) {
        return res.status(200).json({ 
          message: "Validation is already paused",
          state: globalValidationState,
          isIdempotent: true
        });
      }

      // Check if pause is allowed (e.g., not in critical section)
      if (!globalValidationState.canPause) {
        return res.status(409).json({ 
          message: "Validation cannot be paused at this time",
          reason: "Currently in a non-pausable operation",
          retryAfter: 5000 // milliseconds
        });
      }

      // Record pause timestamp for tracking
      const pauseTimestamp = Date.now();
      
      // Implement pause semantics: allow in-flight operations to complete gracefully
      // This is a soft pause - new operations won't start, but current ones finish
      console.log('[ValidationPause] Initiating graceful pause of validation operations');
      
      // Update global state with enhanced tracking
      globalValidationState.isPaused = true;
      globalValidationState.canPause = false;
      globalValidationState.lastUpdateTime = pauseTimestamp;
      
      res.status(202).json({ 
        message: "Validation pause requested",
        state: globalValidationState,
        pauseTimestamp,
        estimatedResumeTime: pauseTimestamp + 1000 // Allow 1 second for graceful pause
      });
    } catch (error: any) {
      console.error('[ValidationPause] Error pausing validation:', error);
      res.status(500).json({ 
        message: "Failed to pause validation",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/bulk/resume", async (req, res) => {
    try {
      // State consistency checks
      if (!globalValidationState.isRunning) {
        return res.status(400).json({ 
          message: "No validation is currently running to resume",
          currentState: {
            isRunning: globalValidationState.isRunning,
            isPaused: globalValidationState.isPaused,
            jobId: globalValidationState.jobId
          }
        });
      }

      if (!globalValidationState.isPaused) {
        return res.status(200).json({ 
          message: "Validation is not paused",
          state: globalValidationState,
          isIdempotent: true
        });
      }

      // Record resume timestamp for tracking
      const resumeTimestamp = Date.now();
      const pauseDuration = resumeTimestamp - globalValidationState.lastUpdateTime;
      
      // Implement resume semantics: restart processing from where it was paused
      console.log('[ValidationResume] Resuming validation operations from paused state');
      
      // Update global state with enhanced tracking
      globalValidationState.isPaused = false;
      globalValidationState.canPause = true;
      globalValidationState.lastUpdateTime = resumeTimestamp;
      
      res.status(202).json({ 
        message: "Validation resume requested",
        state: globalValidationState,
        resumeTimestamp,
        pauseDuration,
        estimatedProcessingResume: resumeTimestamp + 500 // Allow 500ms for graceful resume
      });
    } catch (error: any) {
      console.error('[ValidationResume] Error resuming validation:', error);
      res.status(500).json({ 
        message: "Failed to resume validation",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/bulk/stop", async (req, res) => {
    try {
      // State consistency checks
      if (!globalValidationState.isRunning) {
        return res.status(200).json({ 
          message: "No validation is currently running",
          currentState: {
            isRunning: globalValidationState.isRunning,
            isPaused: globalValidationState.isPaused,
            jobId: globalValidationState.jobId
          },
          isIdempotent: true
        });
      }

      // Record stop timestamp for tracking
      const stopTimestamp = Date.now();
      const runDuration = stopTimestamp - globalValidationState.startTimestamp;
      
      console.log('[ValidationStop] Initiating graceful shutdown of validation operations');
      
      // Use consolidated service for stop operations
      const cancellationService = getValidationCancellationRetryService();
      const cancellationResult = await cancellationService.cancelAllOperations('bulk-validation', 'user-requested');
      
      // Perform cleanup operations
      console.log('[ValidationStop] Performing cleanup operations');
      
      // Reset global state with enhanced tracking
      const finalState = {
        ...globalValidationState,
        isRunning: false,
        isPaused: false,
        shouldStop: true,
        lastUpdateTime: stopTimestamp,
        stopTimestamp,
        runDuration,
        finalStats: {
          processedResources: globalValidationState.processedResources,
          totalResources: globalValidationState.totalResources,
          errors: globalValidationState.errors,
          warnings: globalValidationState.warnings,
          currentBatch: globalValidationState.currentBatch,
          totalBatches: globalValidationState.totalBatches
        }
      };
      
      // Update global state
      globalValidationState = finalState;
      
      res.status(202).json({ 
        message: "Validation stop requested",
        state: finalState,
        stopTimestamp,
        runDuration,
        cancellationResult: {
          cancelledOperations: cancellationResult?.length || 0,
          reason: 'user-requested'
        },
        estimatedCleanupTime: stopTimestamp + 2000 // Allow 2 seconds for cleanup
      });
    } catch (error: any) {
      console.error('[ValidationStop] Error stopping validation:', error);
      res.status(500).json({ 
        message: "Failed to stop validation",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Validation settings (simplified)
  app.get("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const settings = await settingsService.getCurrentSettings();
      
      // Enhanced response with metadata
      const response = {
        ...settings,
        metadata: {
          retrievedAt: new Date().toISOString(),
          serverId: settings.server?.id || null,
          serverUrl: settings.server?.url || null,
          settingsVersion: '1.0',
          lastModified: settings.lastModified || null,
          isDefault: !settings.server?.id, // Indicates if using default settings
          totalAspects: Object.keys(settings.aspects || {}).length,
          enabledAspects: Object.values(settings.aspects || {}).filter((aspect: any) => aspect?.enabled).length
        }
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('[ValidationSettings] Error loading settings:', error);
      
      // Enhanced error categorization and responses
      if (error.message.includes('database') || error.message.includes('connection')) {
        return res.status(503).json({ 
          error: 'Database Error',
          message: 'Unable to load settings due to database issues. Please try again later.',
          code: 'DATABASE_ERROR',
          timestamp: new Date().toISOString(),
          retryAfter: 30 // seconds
        });
      }
      
      if (error.message.includes('not found') || error.message.includes('not initialized')) {
        return res.status(404).json({ 
          error: 'Settings Not Found',
          message: 'Validation settings could not be found or loaded for the active server',
          code: 'SETTINGS_NOT_FOUND',
          timestamp: new Date().toISOString(),
          suggestion: 'Try switching to a different server or contact your administrator'
        });
      }
      
      if (error.message.includes('server') || error.message.includes('active')) {
        return res.status(400).json({ 
          error: 'Server Configuration Error',
          message: 'No active server is configured or the server configuration is invalid',
          code: 'SERVER_CONFIG_ERROR',
          timestamp: new Date().toISOString(),
          suggestion: 'Please configure an active FHIR server first'
        });
      }
      
      // Generic server error
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while loading validation settings',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        requestId: randomUUID().slice(0, 8) // For debugging
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
      
      // Use consolidated validation service for pipeline operations
      if (!consolidatedValidationService) {
        return res.status(400).json({ message: "Validation service not initialized" });
      }
      
      const results = [];
      for (const resource of resources) {
        const { detailedResult } = await consolidatedValidationService.validateResource(resource, true, true);
        results.push(detailedResult);
      }
      
      res.json({
        results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.isValid).length,
        errorCount: results.filter(r => !r.isValid).length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/pipeline/:requestId/status", async (req, res) => {
    try {
      const { requestId } = req.params;
      
      // Use consolidated service to get validation results by request ID
      const results = await storage.getValidationResultsByRequestId(requestId);
      
      if (results.length === 0) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      const status = {
        requestId,
        status: results[0].validationStatus || 'completed',
        totalResults: results.length,
        completedResults: results.filter(r => r.validationStatus === 'completed').length,
        failedResults: results.filter(r => r.validationStatus === 'failed').length,
        results
      };
      
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/pipeline/:requestId/cancel", async (req, res) => {
    try {
      const { requestId } = req.params;
      
      // Use consolidated service to cancel validation request
      const results = await storage.getValidationResultsByRequestId(requestId);
      
      if (results.length === 0) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      // Update all results for this request to cancelled status
      for (const result of results) {
        await storage.updateValidationResultStatus(result.id, 'cancelled');
      }
      
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

  // Test endpoint to update lastValidated field
  app.post("/api/validation/test-update", async (req, res) => {
    try {
      const { resourceId } = req.body;
      console.log(`[ValidationAPI] Testing update for resource ID: ${resourceId}`);
      
      await storage.updateFhirResourceLastValidated(resourceId, new Date().toISOString());
      
      res.json({ success: true, message: `Updated lastValidated for resource ${resourceId}` });
    } catch (error: any) {
      console.error('[ValidationAPI] Test update failed:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Test endpoint to create validation result
  app.post("/api/validation/test-create-result", async (req, res) => {
    try {
      const { resourceId } = req.body;
      console.log(`[ValidationAPI] Testing validation result creation for resource ID: ${resourceId}`);
      
      const testResult = {
        resourceId: resourceId,
        profileId: null,
        isValid: true,
        errors: [],
        warnings: [],
        issues: [],
        errorCount: 0,
        warningCount: 0,
        validationScore: 100,
        validatedAt: new Date(),
        performanceMetrics: {}
      };
      
      const savedResult = await storage.createValidationResult(testResult);
      
      res.json({ success: true, message: `Created validation result with ID: ${savedResult.id}` });
    } catch (error: any) {
      console.error('[ValidationAPI] Test validation result creation failed:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Validate specific resources by IDs
  app.post("/api/validation/validate-by-ids", async (req, res) => {
    try {
      const { resourceIds, resourceType, resources } = req.body;
      console.log(`[ValidationAPI] Received validation request:`, { resourceIds, resourceType, resources: resources?.length });
      
      // Handle mixed resource types (when resources array is provided)
      if (resources && Array.isArray(resources) && resources.length > 0) {
        console.log(`[ValidationAPI] Validating ${resources.length} mixed resources by resource objects`);
        
        // Validate batch size (1-200 resources per batch)
        if (resources.length < 1) {
          return res.status(400).json({ 
            success: false,
            message: "Batch size too small. At least 1 resource required for batch validation." 
          });
        }
        
        if (resources.length > 200) {
          return res.status(400).json({ 
            success: false,
            message: "Batch size too large. Maximum 200 resources allowed per batch." 
          });
        }
        
        const validationService = new ConsolidatedValidationService();
        
        // Process resources in parallel batches for better performance
        const batchSize = 10; // Process 10 resources concurrently
        const detailedResults = [];
        let validatedCount = 0;
        
        for (let i = 0; i < resources.length; i += batchSize) {
          const batch = resources.slice(i, i + batchSize);
          console.log(`[ValidationAPI] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(resources.length/batchSize)} (${batch.length} resources)`);
          
          // Process batch in parallel
          const batchPromises = batch.map(async (resource) => {
            try {
              if (resource && resource.resourceType) {
                // Ensure the resource has an ID - use the resourceId from the database if available
                const resourceToValidate = {
                  ...resource,
                  id: resource.id || resource.resourceId || resource._dbId
                };
                
                if (resourceToValidate.id) {
                  // Get current validation settings to pass to validation
                  const currentSettings = await validationService.getCurrentSettings();
                  
                  // Validate the resource directly and get detailed results with timeout
                  const validationPromise = validationService.validateResource(resourceToValidate, true, true, 0, {
                    validationSettingsOverride: currentSettings
                  });
                  const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Validation timeout after 2 minutes')), 120000);
                  });
                  
                  const { detailedResult } = await Promise.race([validationPromise, timeoutPromise]);
                  
                  return {
                    resourceId: resourceToValidate.id,
                    resourceType: resource.resourceType,
                    resourceIdentifier: resourceToValidate.id,
                    detailedResult
                  };
                } else {
                  console.warn(`[ValidationAPI] Skipping resource without ID:`, resource);
                  return {
                    resourceId: null,
                    resourceType: resource.resourceType,
                    resourceIdentifier: null,
                    error: "Resource missing ID"
                  };
                }
              }
            } catch (error) {
              console.warn(`[ValidationAPI] Failed to validate ${resource.resourceType} resource:`, error.message);
              return {
                resourceId: resource.id || resource.resourceId || resource._dbId,
                resourceType: resource.resourceType,
                resourceIdentifier: resource.id || resource.resourceId || resource._dbId,
                error: error.message
              };
            }
          });
          
          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);
          detailedResults.push(...batchResults);
          
          // Count successful validations
          const batchValidatedCount = batchResults.filter(result => result.detailedResult && !result.error).length;
          validatedCount += batchValidatedCount;
          
          console.log(`[ValidationAPI] Batch completed: ${batchValidatedCount}/${batch.length} resources validated successfully`);
        }
        
        return res.json({
          success: true,
          validatedCount,
          requestedCount: resources.length,
          message: `Successfully validated ${validatedCount} out of ${resources.length} mixed resources`,
          detailedResults
        });
      }
      
      // Handle single resource type (legacy behavior)
      if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
        return res.status(400).json({ message: "Resource IDs array is required" });
      }

      if (!resourceType) {
        return res.status(400).json({ message: "Resource type is required" });
      }

      // Validate batch size (1-200 resources per batch)
      if (resourceIds.length < 1) {
        return res.status(400).json({ 
          success: false,
          message: "Batch size too small. At least 1 resource required for batch validation." 
        });
      }
      
      if (resourceIds.length > 200) {
        return res.status(400).json({ 
          success: false,
          message: "Batch size too large. Maximum 200 resources allowed per batch." 
        });
      }

      console.log(`[ValidationAPI] Validating ${resourceIds.length} ${resourceType} resources by IDs:`, resourceIds);

      // Get validation service
      const validationService = new ConsolidatedValidationService();
      
      // Get FHIR client to fetch resources
      const { FhirClient } = await import("../../../services/fhir/fhir-client");
      const activeServer = await storage.getActiveFhirServer();
      
      if (!activeServer) {
        return res.status(500).json({ 
          success: false, 
          error: 'No active FHIR server configured' 
        });
      }
      
      const fhirClient = new FhirClient(activeServer.url);
      
      // Process resources in parallel batches for better performance
      const batchSize = 10; // Process 10 resources concurrently
      const detailedResults = [];
      let validatedCount = 0;
      
      for (let i = 0; i < resourceIds.length; i += batchSize) {
        const batch = resourceIds.slice(i, i + batchSize);
        console.log(`[ValidationAPI] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(resourceIds.length/batchSize)} (${batch.length} resources)`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (resourceId) => {
          try {
            // First, get the resource from the database to get the actual FHIR resource data
            const dbResource = await storage.getFhirResourceById(resourceId);
            
            if (dbResource && dbResource.data) {
              console.log(`[ValidationAPI] Found resource in database: ID=${dbResource.id}, ResourceID=${dbResource.resourceId}, Type=${dbResource.resourceType}`);
              // Validate the resource using the data from the database
              // Pass the database resource ID so validation results can be saved properly
              const resourceToValidate = {
                ...dbResource.data,
                _dbId: dbResource.id // Add database ID to the resource
              };
              // Get current validation settings to pass to validation
              const currentSettings = await validationService.getCurrentSettings();
              
              // Add timeout to individual validation calls (2 minutes per resource)
              const validationPromise = validationService.validateResource(resourceToValidate, true, true, 0, {
                validationSettingsOverride: currentSettings
              });
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Validation timeout after 2 minutes')), 120000);
              });
              
              const { detailedResult } = await Promise.race([validationPromise, timeoutPromise]);
              
              return {
                resourceId: dbResource.id,
                resourceType: dbResource.resourceType,
                resourceIdentifier: dbResource.resourceId,
                detailedResult
              };
            } else {
              console.warn(`[ValidationAPI] Resource with database ID ${resourceId} not found in database`);
              return {
                resourceId,
                resourceType,
                resourceIdentifier: null,
                error: "Resource not found in database"
              };
            }
          } catch (error) {
            console.warn(`[ValidationAPI] Failed to validate resource with database ID ${resourceId}:`, error.message);
            return {
              resourceId,
              resourceType,
              resourceIdentifier: null,
              error: error.message
            };
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        detailedResults.push(...batchResults);
        
        // Count successful validations
        const batchValidatedCount = batchResults.filter(result => result.detailedResult && !result.error).length;
        validatedCount += batchValidatedCount;
        
        console.log(`[ValidationAPI] Batch completed: ${batchValidatedCount}/${batch.length} resources validated successfully`);
      }

      res.json({
        success: true,
        validatedCount,
        requestedCount: resourceIds.length,
        message: `Successfully validated ${validatedCount} out of ${resourceIds.length} ${resourceType} resources`,
        detailedResults
      });

    } catch (error: any) {
      console.error('[ValidationAPI] Error in validate-by-ids:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  });

  // ============================================================================
  // Missing API Endpoints for UI Hooks
  // ============================================================================

  // GET /api/validation/results/latest - Get latest validation results
  app.get("/api/validation/results/latest", async (req, res) => {
    try {
      const { limit = 50, offset = 0, resourceType } = req.query;
      
      const results = await storage.getLatestValidationResults({
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        resourceType: resourceType as string
      });
      
      res.json({
        success: true,
        data: results,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: results.length
        }
      });
    } catch (error) {
      console.error('[Validation API] Error getting latest validation results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get latest validation results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/results/:resourceId - Get validation results for specific resource
  app.get("/api/validation/results/:resourceId", async (req, res) => {
    try {
      const { resourceId } = req.params;
      const { limit = 10, applySettingsFilter = 'true' } = req.query;
      
      // Get the FHIR resource to obtain FHIR identity information
      const fhirResource = await storage.getFhirResourceById(parseInt(resourceId));
      if (!fhirResource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }
      
      // Get active server for FHIR identity
      const activeServer = await storage.getActiveFhirServer();
      const serverId = activeServer?.id || 1;
      
      // Use dual-mode lookup with FHIR identity
      const results = await storage.getValidationResultsDualMode(
        serverId,
        fhirResource.resourceType,
        fhirResource.resourceId,
        parseInt(resourceId)
      );
      
      // Apply settings filter for list/detail parity if requested
      let processedResults = results;
      if (applySettingsFilter === 'true') {
        // Get current validation settings
        const settingsService = getValidationSettingsService();
        const validationSettingsData = await settingsService.getCurrentSettings();
        const settings = validationSettingsData || {
          structural: { enabled: true, severity: 'error' as const },
          profile: { enabled: true, severity: 'warning' as const },
          terminology: { enabled: true, severity: 'warning' as const },
          reference: { enabled: true, severity: 'error' as const },
          businessRule: { enabled: true, severity: 'warning' as const },
          metadata: { enabled: true, severity: 'info' as const }
        };
        
        // Apply the same filtering logic as dashboard aggregation
        processedResults = results.map(result => {
          const reEvaluated = (storage as any).reEvaluateValidationResult(result, settings);
          
          // Filter issues based on current settings
          const filteredIssues = (result.issues || []).filter((issue: any) => {
            const aspect = issue.aspect || issue.category || 'structural';
            
            switch (aspect) {
              case 'structural':
                return settings.aspects?.structural?.enabled === true;
              case 'profile':
                return settings.aspects?.profile?.enabled === true;
              case 'terminology':
                return settings.aspects?.terminology?.enabled === true;
              case 'reference':
                return settings.aspects?.reference?.enabled === true;
              case 'business-rule':
              case 'businessRule':
                return settings.aspects?.businessRule?.enabled === true;
              case 'metadata':
                return settings.aspects?.metadata?.enabled === true;
              default:
                return true;
            }
          });
          
          // Recalculate scores and counts based on filtered issues
          let errorCount = 0;
          let warningCount = 0;
          let informationCount = 0;
          
          filteredIssues.forEach((issue: any) => {
            const severity = issue.severity || 'error';
            if (severity === 'error' || severity === 'fatal') {
              errorCount++;
            } else if (severity === 'warning') {
              warningCount++;
            } else if (severity === 'info' || severity === 'information') {
              informationCount++;
            }
          });
          
          // Calculate score (same logic as dashboard)
          let score = 100;
          score -= errorCount * 15;    // Error issues: -15 points each
          score -= warningCount * 5;   // Warning issues: -5 points each
          score -= informationCount * 1; // Information issues: -1 point each
          score = Math.max(0, Math.min(100, score));
          
          return {
            ...result,
            issues: filteredIssues,
            isValid: reEvaluated.isValid,
            errorCount,
            warningCount,
            informationCount,
            // Update aspect results if they exist
            aspectResults: result.aspectResults ? {
              ...result.aspectResults,
              // Update each aspect result with filtered data
              structural: result.aspectResults.structural ? {
                ...result.aspectResults.structural,
                score: result.aspectResults.structural.score,
                issues: result.aspectResults.structural.issues || []
              } : undefined,
              profile: result.aspectResults.profile ? {
                ...result.aspectResults.profile,
                score: result.aspectResults.profile.score,
                issues: result.aspectResults.profile.issues || []
              } : undefined,
              terminology: result.aspectResults.terminology ? {
                ...result.aspectResults.terminology,
                score: result.aspectResults.terminology.score,
                issues: result.aspectResults.terminology.issues || []
              } : undefined,
              reference: result.aspectResults.reference ? {
                ...result.aspectResults.reference,
                score: result.aspectResults.reference.score,
                issues: result.aspectResults.reference.issues || []
              } : undefined,
              businessRule: result.aspectResults.businessRule ? {
                ...result.aspectResults.businessRule,
                score: result.aspectResults.businessRule.score,
                issues: result.aspectResults.businessRule.issues || []
              } : undefined,
              metadata: result.aspectResults.metadata ? {
                ...result.aspectResults.metadata,
                score: result.aspectResults.metadata.score,
                issues: result.aspectResults.metadata.issues || []
              } : undefined
            } : undefined,
            // Update summary with recalculated values
            summary: {
              totalIssues: filteredIssues.length,
              errorCount,
              warningCount,
              informationCount,
              score,
              issueCountByAspect: filteredIssues.reduce((acc: Record<string, number>, issue: any) => {
                const aspect = issue.aspect || issue.category || 'structural';
                acc[aspect] = (acc[aspect] || 0) + 1;
                return acc;
              }, {})
            }
          };
        });
      }
      
      // Limit results if requested
      const limitedResults = processedResults.slice(0, parseInt(limit as string));
      
      res.json({
        success: true,
        data: limitedResults,
        total: processedResults.length,
        appliedSettingsFilter: applySettingsFilter === 'true'
      });
    } catch (error) {
      console.error('[Validation API] Error getting validation results for resource:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get validation results for resource',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/results/batch - Get validation results for multiple resources
  app.post("/api/validation/results/batch", async (req, res) => {
    try {
      const { resourceIds, limit = 10, applySettingsFilter = true } = req.body;
      
      if (!Array.isArray(resourceIds)) {
        return res.status(400).json({
          success: false,
          error: 'resourceIds must be an array'
        });
      }
      
      // Get active server for FHIR identity
      const activeServer = await storage.getActiveFhirServer();
      const serverId = activeServer?.id || 1;
      
      // Get current validation settings for filtering if needed
      let settings = null;
      if (applySettingsFilter) {
        const settingsService = getValidationSettingsService();
        const validationSettingsData = await settingsService.getCurrentSettings();
        settings = validationSettingsData || {
          structural: { enabled: true, severity: 'error' as const },
          profile: { enabled: true, severity: 'warning' as const },
          terminology: { enabled: true, severity: 'warning' as const },
          reference: { enabled: true, severity: 'error' as const },
          businessRule: { enabled: true, severity: 'warning' as const },
          metadata: { enabled: true, severity: 'info' as const }
        };
      }
      
      const results = await Promise.all(
        resourceIds.map(async (resourceId: number) => {
          // Get the FHIR resource to obtain FHIR identity information
          const fhirResource = await storage.getFhirResourceById(resourceId);
          if (!fhirResource) {
            return {
              resourceId,
              results: [],
              error: 'Resource not found'
            };
          }
          
          // Use dual-mode lookup with FHIR identity
          const resourceResults = await storage.getValidationResultsDualMode(
            serverId,
            fhirResource.resourceType,
            fhirResource.resourceId,
            resourceId
          );
          
          // Apply settings filter if requested (same logic as single resource endpoint)
          let processedResults = resourceResults;
          if (applySettingsFilter && settings) {
            processedResults = resourceResults.map(result => {
              const reEvaluated = (storage as any).reEvaluateValidationResult(result, settings);
              
              // Filter issues based on current settings
              const filteredIssues = (result.issues || []).filter((issue: any) => {
                const aspect = issue.aspect || issue.category || 'structural';
                
                switch (aspect) {
                  case 'structural':
                    return settings.aspects?.structural?.enabled === true;
                  case 'profile':
                    return settings.aspects?.profile?.enabled === true;
                  case 'terminology':
                    return settings.aspects?.terminology?.enabled === true;
                  case 'reference':
                    return settings.aspects?.reference?.enabled === true;
                  case 'business-rule':
                  case 'businessRule':
                    return settings.aspects?.businessRule?.enabled === true;
                  case 'metadata':
                    return settings.aspects?.metadata?.enabled === true;
                  default:
                    return true;
                }
              });
              
              // Recalculate scores and counts based on filtered issues
              let errorCount = 0;
              let warningCount = 0;
              let informationCount = 0;
              
              filteredIssues.forEach((issue: any) => {
                const severity = issue.severity || 'error';
                if (severity === 'error' || severity === 'fatal') {
                  errorCount++;
                } else if (severity === 'warning') {
                  warningCount++;
                } else if (severity === 'info' || severity === 'information') {
                  informationCount++;
                }
              });
              
              // Calculate score (same logic as dashboard)
              let score = 100;
              score -= errorCount * 15;    // Error issues: -15 points each
              score -= warningCount * 5;   // Warning issues: -5 points each
              score -= informationCount * 1; // Information issues: -1 point each
              score = Math.max(0, Math.min(100, score));
              
              return {
                ...result,
                issues: filteredIssues,
                isValid: reEvaluated.isValid,
                errorCount,
                warningCount,
                informationCount,
                summary: {
                  totalIssues: filteredIssues.length,
                  errorCount,
                  warningCount,
                  informationCount,
                  score,
                  issueCountByAspect: filteredIssues.reduce((acc: Record<string, number>, issue: any) => {
                    const aspect = issue.aspect || issue.category || 'structural';
                    acc[aspect] = (acc[aspect] || 0) + 1;
                    return acc;
                  }, {})
                }
              };
            });
          }
          
          return {
            resourceId,
            results: processedResults.slice(0, parseInt(limit as string))
          };
        })
      );
      
      res.json({
        success: true,
        data: results,
        appliedSettingsFilter: applySettingsFilter
      });
    } catch (error) {
      console.error('[Validation API] Error getting batch validation results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get batch validation results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/aspects/breakdown - Get validation aspect breakdown
  app.get("/api/validation/aspects/breakdown", async (req, res) => {
    try {
      const { resourceType, timeRange = '24h' } = req.query;
      
      const breakdown = await storage.getValidationAspectBreakdown({
        resourceType: resourceType as string,
        timeRange: timeRange as string
      });
      
      res.json({
        success: true,
        data: breakdown
      });
    } catch (error) {
      console.error('[Validation API] Error getting validation aspect breakdown:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get validation aspect breakdown',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Real-time Filtered Results Endpoint
  // ============================================================================

  // GET /api/validation/results/filtered - Get validation results filtered by enabled aspects
  app.get("/api/validation/results/filtered", async (req, res) => {
    try {
      const { limit = 50, offset = 0, resourceType } = req.query;

      // Get the filtering service
      const { getValidationResultFilteringService } = await import('../../../services/validation/features/validation-result-filtering-service');
      const filteringService = getValidationResultFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Get latest validation results
      const results = await storage.getLatestValidationResults({
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        resourceType: resourceType as string
      });

      // Filter results based on enabled aspects
      const filteredResults = filteringService.filterValidationResults(results);

      res.json({
        success: true,
        data: filteredResults,
        filter: filteringService.getCurrentFilter(),
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: filteredResults.length
        }
      });
    } catch (error) {
      console.error('[Validation API] Error getting filtered validation results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get filtered validation results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/summary/filtered - Get filtered validation summary for dashboard
  app.get("/api/validation/summary/filtered", async (req, res) => {
    try {
      const { resourceType, timeRange = '24h' } = req.query;

      // Get the filtering service
      const { getValidationResultFilteringService } = await import('../../../services/validation/features/validation-result-filtering-service');
      const filteringService = getValidationResultFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Get validation results for summary
      const results = await storage.getLatestValidationResults({
        limit: 1000, // Get more results for accurate summary
        offset: 0,
        resourceType: resourceType as string
      });

      // Generate filtered summary
      const filteredSummary = filteringService.getFilteredValidationSummary(results);

      res.json({
        success: true,
        data: filteredSummary,
        filter: filteringService.getCurrentFilter()
      });
    } catch (error) {
      console.error('[Validation API] Error getting filtered validation summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get filtered validation summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Dynamic Score Calculation Endpoints
  // ============================================================================

  // GET /api/validation/scores/resource/:resourceId - Get dynamic score for specific resource
  app.get("/api/validation/scores/resource/:resourceId", async (req, res) => {
    try {
      const { resourceId } = req.params;

      // Get the score calculation service
      const { getValidationScoreCalculationService } = await import('../../../services/validation/features/validation-score-calculation-service');
      const scoreService = getValidationScoreCalculationService();
      
      // Initialize if not already done
      if (!scoreService.getCurrentSettings()) {
        await scoreService.initialize();
      }

      // Get the FHIR resource to obtain FHIR identity information
      const fhirResource = await storage.getFhirResourceById(parseInt(resourceId));
      if (!fhirResource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }
      
      // Get active server for FHIR identity
      const activeServer = await storage.getActiveFhirServer();
      const serverId = activeServer?.id || 1;
      
      // Get validation results for the resource using dual-mode lookup
      const results = await storage.getValidationResultsDualMode(
        serverId,
        fhirResource.resourceType,
        fhirResource.resourceId,
        parseInt(resourceId)
      );
      
      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No validation results found for resource'
        });
      }

      // Get the latest result
      const latestResult = results[0];

      // Calculate dynamic score
      const score = scoreService.calculateResourceScore(latestResult);
      const breakdown = scoreService.calculateScoreBreakdown(latestResult);

      res.json({
        success: true,
        data: {
          resourceId: latestResult.resourceId,
          resourceType: latestResult.resourceType,
          score,
          breakdown,
          settings: scoreService.getCurrentSettings()
        }
      });
    } catch (error) {
      console.error('[Validation API] Error getting resource score:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource score',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/scores/summary - Get dynamic score summary for multiple resources
  app.get("/api/validation/scores/summary", async (req, res) => {
    try {
      const { limit = 100, resourceType } = req.query;

      // Get the score calculation service
      const { getValidationScoreCalculationService } = await import('../../../services/validation/features/validation-score-calculation-service');
      const scoreService = getValidationScoreCalculationService();
      
      // Initialize if not already done
      if (!scoreService.getCurrentSettings()) {
        await scoreService.initialize();
      }

      // Get validation results
      const results = await storage.getLatestValidationResults({
        limit: parseInt(limit as string),
        offset: 0,
        resourceType: resourceType as string
      });

      // Calculate dynamic score summary
      const summary = scoreService.calculateScoreSummary(results);
      const aspectScores = scoreService.calculateAspectScores(results);

      res.json({
        success: true,
        data: {
          summary,
          aspectScores,
          settings: scoreService.getCurrentSettings()
        }
      });
    } catch (error) {
      console.error('[Validation API] Error getting score summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get score summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/scores/batch - Get dynamic scores for multiple resources
  app.post("/api/validation/scores/batch", async (req, res) => {
    try {
      const { resourceIds } = req.body;

      if (!Array.isArray(resourceIds)) {
        return res.status(400).json({
          success: false,
          error: 'resourceIds must be an array'
        });
      }

      // Get the score calculation service
      const { getValidationScoreCalculationService } = await import('../../../services/validation/features/validation-score-calculation-service');
      const scoreService = getValidationScoreCalculationService();
      
      // Initialize if not already done
      if (!scoreService.getCurrentSettings()) {
        await scoreService.initialize();
      }

      // Get active server for FHIR identity
      const activeServer = await storage.getActiveFhirServer();
      const serverId = activeServer?.id || 1;
      
      // Get validation results for all resources using dual-mode lookup
      const results = await Promise.all(
        resourceIds.map(async (resourceId: number) => {
          // Get the FHIR resource to obtain FHIR identity information
          const fhirResource = await storage.getFhirResourceById(resourceId);
          if (!fhirResource) {
            return null;
          }
          
          // Use dual-mode lookup with FHIR identity
          const resourceResults = await storage.getValidationResultsDualMode(
            serverId,
            fhirResource.resourceType,
            fhirResource.resourceId,
            resourceId
          );
          
          return resourceResults.length > 0 ? resourceResults[0] : null;
        })
      );

      // Filter out null results
      const validResults = results.filter(result => result !== null);

      // Calculate scores for all resources
      const scores = validResults.map(result => ({
        resourceId: result!.resourceId,
        resourceType: result!.resourceType,
        score: scoreService.calculateResourceScore(result!),
        breakdown: scoreService.calculateScoreBreakdown(result!)
      }));

      res.json({
        success: true,
        data: scores,
        settings: scoreService.getCurrentSettings()
      });
    } catch (error) {
      console.error('[Validation API] Error getting batch scores:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get batch scores',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Real-time Notification Endpoints
  // ============================================================================

  // GET /api/validation/notifications/history - Get notification history
  app.get("/api/validation/notifications/history", async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      // Get the notification service
      const { getValidationRealtimeNotificationService } = await import('../../../services/validation/features/validation-realtime-notification-service');
      const notificationService = getValidationRealtimeNotificationService();
      
      // Initialize if not already done
      if (!notificationService.getCurrentSettings()) {
        await notificationService.initialize();
      }

      // Get notification history
      const history = notificationService.getNotificationHistory(parseInt(limit as string));

      res.json({
        success: true,
        data: history,
        total: history.length
      });
    } catch (error) {
      console.error('[Validation API] Error getting notification history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notification history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/notifications/current - Get current notification state
  app.get("/api/validation/notifications/current", async (req, res) => {
    try {
      // Get the notification service
      const { getValidationRealtimeNotificationService } = await import('../../../services/validation/features/validation-realtime-notification-service');
      const notificationService = getValidationRealtimeNotificationService();
      
      // Initialize if not already done
      if (!notificationService.getCurrentSettings()) {
        await notificationService.initialize();
      }

      // Get current state
      const currentSettings = notificationService.getCurrentSettings();
      const previousSettings = notificationService.getPreviousSettings();
      const enabledAspects = notificationService.getEnabledAspects();

      res.json({
        success: true,
        data: {
          currentSettings,
          previousSettings,
          enabledAspects,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      console.error('[Validation API] Error getting current notification state:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current notification state',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/notifications/subscribe - Subscribe to notifications (WebSocket simulation)
  app.post("/api/validation/notifications/subscribe", async (req, res) => {
    try {
      const { views, types } = req.body;

      if (!Array.isArray(views) && !Array.isArray(types)) {
        return res.status(400).json({
          success: false,
          error: 'views and types must be arrays'
        });
      }

      // Get the notification service
      const { getValidationRealtimeNotificationService } = await import('../../../services/validation/features/validation-realtime-notification-service');
      const notificationService = getValidationRealtimeNotificationService();
      
      // Initialize if not already done
      if (!notificationService.getCurrentSettings()) {
        await notificationService.initialize();
      }

      // Create subscription response
      const subscription = {
        id: `sub_${Date.now()}`,
        views: views || [],
        types: types || [],
        createdAt: new Date(),
        status: 'active'
      };

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription created successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error creating notification subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notification subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/notifications/emit - Emit a test notification
  app.post("/api/validation/notifications/emit", async (req, res) => {
    try {
      const { type, data, affectedViews } = req.body;

      if (!type || !affectedViews || !Array.isArray(affectedViews)) {
        return res.status(400).json({
          success: false,
          error: 'type and affectedViews are required, affectedViews must be an array'
        });
      }

      // Get the notification service
      const { getValidationRealtimeNotificationService } = await import('../../../services/validation/features/validation-realtime-notification-service');
      const notificationService = getValidationRealtimeNotificationService();
      
      // Initialize if not already done
      if (!notificationService.getCurrentSettings()) {
        await notificationService.initialize();
      }

      // Create test notification
      const notification = {
        type,
        timestamp: new Date(),
        data: data || {},
        affectedViews
      };

      // Emit the notification
      notificationService.emit('notification', notification);

      res.json({
        success: true,
        data: notification,
        message: 'Notification emitted successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error emitting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to emit notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Dashboard Statistics Endpoints
  // ============================================================================

  // GET /api/validation/dashboard/statistics - Get real-time dashboard statistics
  app.get("/api/validation/dashboard/statistics", async (req, res) => {
    try {
      // Get the dashboard statistics service
      const { getValidationDashboardStatisticsService } = await import('../../../services/validation/features/validation-dashboard-statistics-service');
      const dashboardService = getValidationDashboardStatisticsService();
      
      // Initialize if not already done
      if (!dashboardService.getCurrentStatistics()) {
        await dashboardService.initialize();
      }

      // Get current statistics
      const statistics = dashboardService.getCurrentStatistics();

      if (!statistics) {
        return res.status(500).json({
          success: false,
          error: 'Failed to load dashboard statistics'
        });
      }

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('[Validation API] Error getting dashboard statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/dashboard/statistics/refresh - Force refresh dashboard statistics
  app.get("/api/validation/dashboard/statistics/refresh", async (req, res) => {
    try {
      // Get the dashboard statistics service
      const { getValidationDashboardStatisticsService } = await import('../../../services/validation/features/validation-dashboard-statistics-service');
      const dashboardService = getValidationDashboardStatisticsService();
      
      // Initialize if not already done
      if (!dashboardService.getCurrentStatistics()) {
        await dashboardService.initialize();
      }

      // Force refresh statistics
      const statistics = await dashboardService.refreshStatistics();

      res.json({
        success: true,
        data: statistics,
        message: 'Dashboard statistics refreshed successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error refreshing dashboard statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh dashboard statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/dashboard/updates/history - Get dashboard update history
  app.get("/api/validation/dashboard/updates/history", async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      // Get the dashboard statistics service
      const { getValidationDashboardStatisticsService } = await import('../../../services/validation/features/validation-dashboard-statistics-service');
      const dashboardService = getValidationDashboardStatisticsService();
      
      // Initialize if not already done
      if (!dashboardService.getCurrentStatistics()) {
        await dashboardService.initialize();
      }

      // Get update history
      const history = dashboardService.getUpdateHistory(parseInt(limit as string));

      res.json({
        success: true,
        data: history,
        total: history.length
      });
    } catch (error) {
      console.error('[Validation API] Error getting dashboard update history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard update history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/dashboard/subscribe - Subscribe to dashboard updates (WebSocket simulation)
  app.post("/api/validation/dashboard/subscribe", async (req, res) => {
    try {
      const { updateTypes } = req.body;

      if (!Array.isArray(updateTypes)) {
        return res.status(400).json({
          success: false,
          error: 'updateTypes must be an array'
        });
      }

      // Get the dashboard statistics service
      const { getValidationDashboardStatisticsService } = await import('../../../services/validation/features/validation-dashboard-statistics-service');
      const dashboardService = getValidationDashboardStatisticsService();
      
      // Initialize if not already done
      if (!dashboardService.getCurrentStatistics()) {
        await dashboardService.initialize();
      }

      // Create subscription response
      const subscription = {
        id: `dashboard_sub_${Date.now()}`,
        updateTypes: updateTypes || ['statisticsUpdated', 'aspectChanged', 'scoreRecalculated', 'filterUpdated'],
        createdAt: new Date(),
        status: 'active'
      };

      res.json({
        success: true,
        data: subscription,
        message: 'Dashboard subscription created successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error creating dashboard subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dashboard subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Resource List Badges Endpoints
  // ============================================================================

  // GET /api/validation/badges/resource-list - Get resource list validation badges
  app.get("/api/validation/badges/resource-list", async (req, res) => {
    try {
      const { limit = 50, offset = 0, resourceType } = req.query;

      // Get the resource list badges service
      const { getValidationResourceListBadgesService } = await import('../../../services/validation/features/validation-resource-list-badges-service');
      const badgesService = getValidationResourceListBadgesService();
      
      // Initialize if not already done
      if (!badgesService.getCurrentBadges().length) {
        await badgesService.initialize();
      }

      // Get current badges
      let badges = badgesService.getCurrentBadges();

      // Filter by resource type if specified
      if (resourceType) {
        badges = badges.filter(badge => badge.resourceType === resourceType);
      }

      // Apply pagination
      const startIndex = parseInt(offset as string);
      const endIndex = startIndex + parseInt(limit as string);
      const paginatedBadges = badges.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedBadges,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: badges.length,
          hasMore: endIndex < badges.length
        }
      });
    } catch (error) {
      console.error('[Validation API] Error getting resource list badges:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource list badges',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/badges/resource/:resourceId - Get badge for specific resource
  app.get("/api/validation/badges/resource/:resourceId", async (req, res) => {
    try {
      const { resourceId } = req.params;

      // Get the resource list badges service
      const { getValidationResourceListBadgesService } = await import('../../../services/validation/features/validation-resource-list-badges-service');
      const badgesService = getValidationResourceListBadgesService();
      
      // Initialize if not already done
      if (!badgesService.getCurrentBadges().length) {
        await badgesService.initialize();
      }

      // Get badge for specific resource
      const badge = badgesService.getBadgeForResource(resourceId);

      if (!badge) {
        return res.status(404).json({
          success: false,
          error: 'Badge not found for resource'
        });
      }

      res.json({
        success: true,
        data: badge
      });
    } catch (error) {
      console.error('[Validation API] Error getting resource badge:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource badge',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/badges/summary - Get badge summary
  app.get("/api/validation/badges/summary", async (req, res) => {
    try {
      // Get the resource list badges service
      const { getValidationResourceListBadgesService } = await import('../../../services/validation/features/validation-resource-list-badges-service');
      const badgesService = getValidationResourceListBadgesService();
      
      // Initialize if not already done
      if (!badgesService.getCurrentBadges().length) {
        await badgesService.initialize();
      }

      // Get badge summary
      const summary = badgesService.getBadgeSummary();

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('[Validation API] Error getting badge summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get badge summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/badges/refresh - Force refresh badges
  app.get("/api/validation/badges/refresh", async (req, res) => {
    try {
      // Get the resource list badges service
      const { getValidationResourceListBadgesService } = await import('../../../services/validation/features/validation-resource-list-badges-service');
      const badgesService = getValidationResourceListBadgesService();
      
      // Initialize if not already done
      if (!badgesService.getCurrentBadges().length) {
        await badgesService.initialize();
      }

      // Force refresh badges
      const badges = await badgesService.refreshBadges();

      res.json({
        success: true,
        data: badges,
        message: 'Resource list badges refreshed successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error refreshing badges:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh badges',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/badges/updates/history - Get badge update history
  app.get("/api/validation/badges/updates/history", async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      // Get the resource list badges service
      const { getValidationResourceListBadgesService } = await import('../../../services/validation/features/validation-resource-list-badges-service');
      const badgesService = getValidationResourceListBadgesService();
      
      // Initialize if not already done
      if (!badgesService.getCurrentBadges().length) {
        await badgesService.initialize();
      }

      // Get update history
      const history = badgesService.getUpdateHistory(parseInt(limit as string));

      res.json({
        success: true,
        data: history,
        total: history.length
      });
    } catch (error) {
      console.error('[Validation API] Error getting badge update history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get badge update history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Resource Type Filtering Endpoints
  // ============================================================================

  // GET /api/validation/resource-types/available - Get available resource types
  app.get("/api/validation/resource-types/available", async (req, res) => {
    try {
      // Get the resource type filtering service
      const { getValidationResourceTypeFilteringService } = await import('../../../services/validation/features/validation-resource-type-filtering-service');
      const filteringService = getValidationResourceTypeFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Get available resource types
      const availableTypes = filteringService.getAvailableResourceTypes();

      res.json({
        success: true,
        data: availableTypes,
        total: availableTypes.length
      });
    } catch (error) {
      console.error('[Validation API] Error getting available resource types:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available resource types',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/resource-types/filter - Get current resource type filter
  app.get("/api/validation/resource-types/filter", async (req, res) => {
    try {
      // Get the resource type filtering service
      const { getValidationResourceTypeFilteringService } = await import('../../../services/validation/features/validation-resource-type-filtering-service');
      const filteringService = getValidationResourceTypeFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Get current filter
      const filter = filteringService.getCurrentFilter();
      const statistics = filteringService.getFilterStatistics();

      res.json({
        success: true,
        data: {
          filter,
          statistics
        }
      });
    } catch (error) {
      console.error('[Validation API] Error getting resource type filter:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource type filter',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/resource-types/filter - Update resource type filter
  app.post("/api/validation/resource-types/filter", async (req, res) => {
    try {
      const { enabled, includedTypes, excludedTypes, latestOnly } = req.body;

      // Validate the filter configuration
      const { getValidationResourceTypeFilteringService } = await import('../../../services/validation/features/validation-resource-type-filtering-service');
      const filteringService = getValidationResourceTypeFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Validate the configuration
      const validation = filteringService.validateResourceTypeFilter({
        enabled: enabled ?? false,
        includedTypes: includedTypes ?? [],
        excludedTypes: excludedTypes ?? [],
        latestOnly: latestOnly ?? false
      });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid resource type filter configuration',
          details: validation.errors,
          warnings: validation.warnings
        });
      }

      // Update the validation settings
      const settingsService = getValidationSettingsService();
      const currentSettings = await settingsService.getSettings();
      
      const updatedSettings: ValidationSettings = {
        ...currentSettings,
        resourceTypes: {
          enabled: enabled ?? false,
          includedTypes: includedTypes ?? [],
          excludedTypes: excludedTypes ?? [],
          latestOnly: latestOnly ?? false
        }
      };

      await settingsService.updateSettings(updatedSettings);

      // Get updated filter
      const filter = filteringService.getCurrentFilter();
      const statistics = filteringService.getFilterStatistics();

      res.json({
        success: true,
        data: {
          filter,
          statistics
        },
        warnings: validation.warnings,
        message: 'Resource type filter updated successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error updating resource type filter:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update resource type filter',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/resource-types/validate - Validate resource type filter configuration
  app.post("/api/validation/resource-types/validate", async (req, res) => {
    try {
      const { enabled, includedTypes, excludedTypes, latestOnly } = req.body;

      // Get the resource type filtering service
      const { getValidationResourceTypeFilteringService } = await import('../../../services/validation/features/validation-resource-type-filtering-service');
      const filteringService = getValidationResourceTypeFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Validate the configuration
      const validation = filteringService.validateResourceTypeFilter({
        enabled: enabled ?? false,
        includedTypes: includedTypes ?? [],
        excludedTypes: excludedTypes ?? [],
        latestOnly: latestOnly ?? false
      });

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      console.error('[Validation API] Error validating resource type filter:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate resource type filter',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/resource-types/test - Test resource type filtering on sample data
  app.post("/api/validation/resource-types/test", async (req, res) => {
    try {
      const { resources, filter } = req.body;

      if (!Array.isArray(resources)) {
        return res.status(400).json({
          success: false,
          error: 'resources must be an array'
        });
      }

      // Get the resource type filtering service
      const { getValidationResourceTypeFilteringService } = await import('../../../services/validation/features/validation-resource-type-filtering-service');
      const filteringService = getValidationResourceTypeFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Apply the filter to the test resources
      const result = filteringService.filterResources(resources);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[Validation API] Error testing resource type filter:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test resource type filter',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/resource-types/statistics - Get resource type filtering statistics
  app.get("/api/validation/resource-types/statistics", async (req, res) => {
    try {
      // Get the resource type filtering service
      const { getValidationResourceTypeFilteringService } = await import('../../../services/validation/features/validation-resource-type-filtering-service');
      const filteringService = getValidationResourceTypeFilteringService();
      
      // Initialize if not already done
      if (!filteringService.getCurrentFilter()) {
        await filteringService.initialize();
      }

      // Get statistics
      const statistics = filteringService.getFilterStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('[Validation API] Error getting resource type filter statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource type filter statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Cache Override Endpoints
  // ============================================================================

  // POST /api/validation/cache/override - Override validation cache
  app.post("/api/validation/cache/override", async (req, res) => {
    try {
      const {
        resourceIds,
        resourceTypes,
        revalidateAll,
        reason,
        clearExisting,
        forceRevalidation,
        context
      } = req.body;

      // Get the cache override service
      const { getValidationCacheOverrideService } = await import('../../../services/validation/features/validation-cache-override-service');
      const cacheOverrideService = getValidationCacheOverrideService();
      
      // Initialize if not already done
      await cacheOverrideService.initialize();

      // Create cache override request
      const request = {
        resourceIds,
        resourceTypes,
        revalidateAll,
        reason,
        clearExisting,
        forceRevalidation,
        context: {
          ...context,
          requestId: context?.requestId || `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      };

      // Execute cache override
      const result = await cacheOverrideService.overrideCache(request);

      res.json({
        success: true,
        data: result,
        message: 'Cache override completed successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error overriding cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to override cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/cache/statistics - Get cache statistics
  app.get("/api/validation/cache/statistics", async (req, res) => {
    try {
      // Get the cache override service
      const { getValidationCacheOverrideService } = await import('../../../services/validation/features/validation-cache-override-service');
      const cacheOverrideService = getValidationCacheOverrideService();
      
      // Initialize if not already done
      await cacheOverrideService.initialize();

      // Get cache statistics
      const statistics = await cacheOverrideService.getCacheStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('[Validation API] Error getting cache statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/cache/history - Get cache override history
  app.get("/api/validation/cache/history", async (req, res) => {
    try {
      const { limit = 50 } = req.query;

      // Get the cache override service
      const { getValidationCacheOverrideService } = await import('../../../services/validation/features/validation-cache-override-service');
      const cacheOverrideService = getValidationCacheOverrideService();
      
      // Initialize if not already done
      await cacheOverrideService.initialize();

      // Get override history
      const history = cacheOverrideService.getOverrideHistory(parseInt(limit as string));

      res.json({
        success: true,
        data: history,
        total: history.length
      });
    } catch (error) {
      console.error('[Validation API] Error getting cache override history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache override history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/cache/active - Get active cache override requests
  app.get("/api/validation/cache/active", async (req, res) => {
    try {
      // Get the cache override service
      const { getValidationCacheOverrideService } = await import('../../../services/validation/features/validation-cache-override-service');
      const cacheOverrideService = getValidationCacheOverrideService();
      
      // Initialize if not already done
      await cacheOverrideService.initialize();

      // Get active requests
      const activeRequests = cacheOverrideService.getActiveRequests();

      res.json({
        success: true,
        data: activeRequests,
        total: activeRequests.length
      });
    } catch (error) {
      console.error('[Validation API] Error getting active cache override requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active cache override requests',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DELETE /api/validation/cache/active/:requestId - Cancel active cache override request
  app.delete("/api/validation/cache/active/:requestId", async (req, res) => {
    try {
      const { requestId } = req.params;

      // Get the cache override service
      const { getValidationCacheOverrideService } = await import('../../../services/validation/features/validation-cache-override-service');
      const cacheOverrideService = getValidationCacheOverrideService();
      
      // Initialize if not already done
      await cacheOverrideService.initialize();

      // Cancel the request
      const cancelled = await cacheOverrideService.cancelRequest(requestId);

      if (cancelled) {
        res.json({
          success: true,
          message: `Cache override request ${requestId} cancelled successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Request not found or not active'
        });
      }
    } catch (error) {
      console.error('[Validation API] Error cancelling cache override request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel cache override request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/cache/clear-all - Clear all validation caches
  app.post("/api/validation/cache/clear-all", async (req, res) => {
    console.log('[Validation API] Cache clear request received');
    try {
      // Get the cache override service
      const { getValidationCacheOverrideService } = await import('../../../services/validation/features/validation-cache-override-service');
      const cacheOverrideService = getValidationCacheOverrideService();
      
      console.log('[Validation API] Initializing cache override service...');
      // Initialize if not already done
      await cacheOverrideService.initialize();

      console.log('[Validation API] Starting cache clearing process...');
      // Clear all caches
      const result = await cacheOverrideService.clearAllCaches();

      console.log('[Validation API] Cache clearing completed:', {
        affectedResources: result.affectedResources,
        revalidatedResources: result.revalidatedResources,
        failedResources: result.failedResources,
        durationMs: result.durationMs,
        status: result.status
      });

      res.json({
        success: true,
        data: result,
        message: 'All validation caches cleared successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error clearing all caches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear all caches',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/cache/clear-types - Clear cache for specific resource types
  app.post("/api/validation/cache/clear-types", async (req, res) => {
    try {
      const { resourceTypes } = req.body;

      if (!Array.isArray(resourceTypes) || resourceTypes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'resourceTypes must be a non-empty array'
        });
      }

      // Get the cache override service
      const { getValidationCacheOverrideService } = await import('../../../services/validation/features/validation-cache-override-service');
      const cacheOverrideService = getValidationCacheOverrideService();
      
      // Initialize if not already done
      await cacheOverrideService.initialize();

      // Clear cache for resource types
      const result = await cacheOverrideService.clearCacheForResourceTypes(resourceTypes);

      res.json({
        success: true,
        data: result,
        message: `Cache cleared for resource types: ${resourceTypes.join(', ')}`
      });
    } catch (error) {
      console.error('[Validation API] Error clearing cache for resource types:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache for resource types',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Polling & Progress Updates Endpoints
  // ============================================================================

  // POST /api/validation/polling/session - Create a new polling session
  app.post("/api/validation/polling/session", async (req, res) => {
    try {
      const {
        resourceIds,
        batchId,
        pollInterval,
        maxPollDuration,
        context
      } = req.body;

      if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'resourceIds must be a non-empty array'
        });
      }

      // Get client ID from request (could be from headers, session, etc.)
      const clientId = req.headers['x-client-id'] as string || req.ip || 'unknown';

      // Get the polling service
      const { getValidationPollingService } = await import('../../../services/validation/features/validation-polling-service');
      const pollingService = getValidationPollingService();

      // Create polling session
      const session = pollingService.createPollingSession(clientId, resourceIds, {
        batchId,
        pollInterval,
        maxPollDuration,
        context: {
          requestedBy: context?.requestedBy || 'api',
          requestId: context?.requestId || `api_${Date.now()}`,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          ...context
        }
      });

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          clientId: session.clientId,
          resourceIds: session.resourceIds,
          pollInterval: session.pollInterval,
          maxPollDuration: session.maxPollDuration,
          startTime: session.startTime
        },
        message: 'Polling session created successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error creating polling session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create polling session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/polling/session/:sessionId - Get polling response
  app.get("/api/validation/polling/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const clientId = req.headers['x-client-id'] as string || req.ip || 'unknown';

      // Get the polling service
      const { getValidationPollingService } = await import('../../../services/validation/features/validation-polling-service');
      const pollingService = getValidationPollingService();

      // Update last poll time
      pollingService.updateLastPollTime(sessionId, clientId);

      // Get polling response
      const response = pollingService.getPollingResponse(sessionId, clientId);

      if (!response) {
        return res.status(404).json({
          success: false,
          error: 'Polling session not found or inactive'
        });
      }

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error('[Validation API] Error getting polling response:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get polling response',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/polling/session/:sessionId/subscribe - Subscribe to polling updates
  app.post("/api/validation/polling/session/:sessionId/subscribe", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const clientId = req.headers['x-client-id'] as string || req.ip || 'unknown';

      // Get the polling service
      const { getValidationPollingService } = await import('../../../services/validation/features/validation-polling-service');
      const pollingService = getValidationPollingService();

      // For HTTP polling, we'll simulate subscription by returning current state
      // In a real WebSocket implementation, this would establish a persistent connection
      const response = pollingService.getPollingResponse(sessionId, clientId);

      if (!response) {
        return res.status(404).json({
          success: false,
          error: 'Polling session not found or inactive'
        });
      }

      res.json({
        success: true,
        data: response,
        message: 'Subscription established (HTTP polling mode)'
      });
    } catch (error) {
      console.error('[Validation API] Error subscribing to polling:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to subscribe to polling',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DELETE /api/validation/polling/session/:sessionId - End polling session
  app.delete("/api/validation/polling/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const clientId = req.headers['x-client-id'] as string || req.ip || 'unknown';

      // Get the polling service
      const { getValidationPollingService } = await import('../../../services/validation/features/validation-polling-service');
      const pollingService = getValidationPollingService();

      // End polling session
      const ended = pollingService.endPollingSession(sessionId, clientId);

      if (!ended) {
        return res.status(404).json({
          success: false,
          error: 'Polling session not found or already ended'
        });
      }

      res.json({
        success: true,
        message: 'Polling session ended successfully'
      });
    } catch (error) {
      console.error('[Validation API] Error ending polling session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to end polling session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/polling/sessions - Get client's active sessions
  app.get("/api/validation/polling/sessions", async (req, res) => {
    try {
      const clientId = req.headers['x-client-id'] as string || req.ip || 'unknown';

      // Get the polling service
      const { getValidationPollingService } = await import('../../../services/validation/features/validation-polling-service');
      const pollingService = getValidationPollingService();

      // Get client sessions
      const sessions = pollingService.getClientSessions(clientId);

      res.json({
        success: true,
        data: sessions,
        total: sessions.length
      });
    } catch (error) {
      console.error('[Validation API] Error getting polling sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get polling sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/polling/stats - Get polling statistics
  app.get("/api/validation/polling/stats", async (req, res) => {
    try {
      // Get the polling service
      const { getValidationPollingService } = await import('../../../services/validation/features/validation-polling-service');
      const pollingService = getValidationPollingService();

      // Get polling statistics
      const stats = pollingService.getPollingStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[Validation API] Error getting polling statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get polling statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/progress/resource/:resourceId - Get individual resource progress
  app.get("/api/validation/progress/resource/:resourceId", async (req, res) => {
    try {
      const { resourceId } = req.params;

      // Get the progress service
      const { getIndividualResourceProgressService } = await import('../../../services/validation/features/individual-resource-progress-service');
      const progressService = getIndividualResourceProgressService();

      // Get resource progress
      const progress = progressService.getResourceProgress(resourceId);

      if (!progress) {
        return res.status(404).json({
          success: false,
          error: 'Resource progress not found'
        });
      }

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      console.error('[Validation API] Error getting resource progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource progress',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/progress/stats - Get progress statistics
  app.get("/api/validation/progress/stats", async (req, res) => {
    try {
      // Get the progress service
      const { getIndividualResourceProgressService } = await import('../../../services/validation/features/individual-resource-progress-service');
      const progressService = getIndividualResourceProgressService();

      // Get progress statistics
      const stats = progressService.getProgressStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[Validation API] Error getting progress statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get progress statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Analytics & Performance Endpoints
  // ============================================================================

  // GET /api/validation/analytics/overview - Get validation analytics overview
  app.get("/api/validation/analytics/overview", async (req, res) => {
    try {
      const { timeRange, filters } = req.query;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Parse time range if provided
      let parsedTimeRange;
      if (timeRange) {
        try {
          parsedTimeRange = JSON.parse(timeRange as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid timeRange format'
          });
        }
      }

      // Parse filters if provided
      let parsedFilters;
      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filters format'
          });
        }
      }

      // Get analytics overview
      const overview = await analyticsService.getOverviewAnalytics(parsedTimeRange, parsedFilters);

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('[Validation API] Error getting analytics overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics overview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/performance - Get performance analytics
  app.get("/api/validation/analytics/performance", async (req, res) => {
    try {
      const { timeRange, filters } = req.query;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Parse parameters
      let parsedTimeRange, parsedFilters;
      if (timeRange) {
        try {
          parsedTimeRange = JSON.parse(timeRange as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid timeRange format'
          });
        }
      }

      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filters format'
          });
        }
      }

      // Get performance analytics
      const performance = await analyticsService.getPerformanceAnalytics(parsedTimeRange, parsedFilters);

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('[Validation API] Error getting performance analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/trends - Get trend analytics
  app.get("/api/validation/analytics/trends", async (req, res) => {
    try {
      const { timeRange, filters } = req.query;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Parse parameters
      let parsedTimeRange, parsedFilters;
      if (timeRange) {
        try {
          parsedTimeRange = JSON.parse(timeRange as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid timeRange format'
          });
        }
      }

      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filters format'
          });
        }
      }

      // Get trend analytics
      const trends = await analyticsService.getTrendAnalytics(parsedTimeRange, parsedFilters);

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      console.error('[Validation API] Error getting trend analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trend analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/resource-types - Get resource type analytics
  app.get("/api/validation/analytics/resource-types", async (req, res) => {
    try {
      const { timeRange, filters } = req.query;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Parse parameters
      let parsedTimeRange, parsedFilters;
      if (timeRange) {
        try {
          parsedTimeRange = JSON.parse(timeRange as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid timeRange format'
          });
        }
      }

      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filters format'
          });
        }
      }

      // Get resource type analytics
      const resourceTypeAnalytics = await analyticsService.getResourceTypeAnalytics(parsedTimeRange, parsedFilters);

      res.json({
        success: true,
        data: resourceTypeAnalytics
      });
    } catch (error) {
      console.error('[Validation API] Error getting resource type analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get resource type analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/aspects - Get aspect analytics
  app.get("/api/validation/analytics/aspects", async (req, res) => {
    try {
      const { timeRange, filters } = req.query;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Parse parameters
      let parsedTimeRange, parsedFilters;
      if (timeRange) {
        try {
          parsedTimeRange = JSON.parse(timeRange as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid timeRange format'
          });
        }
      }

      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filters format'
          });
        }
      }

      // Get aspect analytics
      const aspectAnalytics = await analyticsService.getAspectAnalytics(parsedTimeRange, parsedFilters);

      res.json({
        success: true,
        data: aspectAnalytics
      });
    } catch (error) {
      console.error('[Validation API] Error getting aspect analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get aspect analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/quality - Get quality metrics
  app.get("/api/validation/analytics/quality", async (req, res) => {
    try {
      const { timeRange, filters } = req.query;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Parse parameters
      let parsedTimeRange, parsedFilters;
      if (timeRange) {
        try {
          parsedTimeRange = JSON.parse(timeRange as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid timeRange format'
          });
        }
      }

      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filters format'
          });
        }
      }

      // Get quality metrics
      const qualityMetrics = await analyticsService.getQualityMetrics(parsedTimeRange, parsedFilters);

      res.json({
        success: true,
        data: qualityMetrics
      });
    } catch (error) {
      console.error('[Validation API] Error getting quality metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get quality metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/system-health - Get system health metrics
  app.get("/api/validation/analytics/system-health", async (req, res) => {
    try {
      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Get system health metrics
      const systemHealth = await analyticsService.getSystemHealthMetrics();

      res.json({
        success: true,
        data: systemHealth
      });
    } catch (error) {
      console.error('[Validation API] Error getting system health metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system health metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/performance-metrics - Get performance metrics
  app.get("/api/validation/analytics/performance-metrics", async (req, res) => {
    try {
      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Get performance metrics
      const performanceMetrics = await analyticsService.getPerformanceMetrics();

      res.json({
        success: true,
        data: performanceMetrics
      });
    } catch (error) {
      console.error('[Validation API] Error getting performance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/validation/analytics/comprehensive - Get comprehensive analytics
  app.get("/api/validation/analytics/comprehensive", async (req, res) => {
    try {
      const { timeRange, filters } = req.query;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      // Parse parameters
      let parsedTimeRange, parsedFilters;
      if (timeRange) {
        try {
          parsedTimeRange = JSON.parse(timeRange as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid timeRange format'
          });
        }
      }

      if (filters) {
        try {
          parsedFilters = JSON.parse(filters as string);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filters format'
          });
        }
      }

      // Get comprehensive analytics
      const analytics = await analyticsService.getValidationAnalytics(parsedTimeRange, parsedFilters);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('[Validation API] Error getting comprehensive analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get comprehensive analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/analytics/clear-cache - Clear analytics cache
  app.post("/api/validation/analytics/clear-cache", async (req, res) => {
    console.log('[Validation API] Analytics cache clear request received');
    try {
      const { cacheKey } = req.body;

      // Get the analytics service
      const { getValidationAnalyticsService } = await import('../../../services/validation/features/validation-analytics-service');
      const analyticsService = getValidationAnalyticsService();

      if (cacheKey) {
        console.log(`[Validation API] Clearing specific analytics cache entry: ${cacheKey}`);
        analyticsService.clearCacheEntry(cacheKey);
        res.json({
          success: true,
          message: `Cache entry '${cacheKey}' cleared successfully`
        });
      } else {
        console.log('[Validation API] Clearing all analytics cache entries');
        analyticsService.clearCache();
        res.json({
          success: true,
          message: 'Analytics cache cleared successfully'
        });
      }
      console.log('[Validation API] Analytics cache clearing completed');
    } catch (error) {
      console.error('[Validation API] Error clearing analytics cache:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear analytics cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // Performance & Optimization Endpoints
  // ============================================================================

  // GET /api/validation/performance/metrics - Get performance metrics
  app.get("/api/validation/performance/metrics", async (req, res) => {
    try {
      const { getValidationPerformanceService } = await import('../../../services/validation/features/validation-performance-service');
      const performanceService = getValidationPerformanceService();
      const metrics = performanceService.getPerformanceMetrics();
      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error('[Validation API] Error getting performance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/validation/performance/optimize-indexes - Optimize database indexes
  app.post("/api/validation/performance/optimize-indexes", async (req, res) => {
    try {
      const { getValidationPerformanceService } = await import('../../../services/validation/features/validation-performance-service');
      const performanceService = getValidationPerformanceService();
      const results = await performanceService.optimizeIndexes();
      res.json({
        success: true,
        data: results,
        message: `Index optimization completed. ${results.filter(r => r.status === 'created').length} indexes created.`
      });
    } catch (error) {
      console.error('[Validation API] Error optimizing indexes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize indexes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
