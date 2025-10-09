/**
 * Validation Settings Routes
 * 
 * This module provides essential CRUD operations for validation settings
 * with FHIR version support and resource type filtering.
 */

import type { Express } from "express";
import { getValidationSettingsService } from "../../../services/validation/settings/validation-settings-service";
import { asyncHandler, InputValidator, ApiResponse, ValidationError, ServiceError } from "../../../utils/error-handler";
import logger from "../../../utils/logger";
import type { 
  ValidationSettings, 
  ValidationSettingsUpdate,
  FHIRVersion
} from "@shared/validation-settings";

export function setupValidationSettingsRoutes(app: Express) {
  // Get Current Validation Settings
  app.get("/api/validation/settings", asyncHandler(async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      
      // Validate serverId if provided
      let serverId: number | undefined;
      if (req.query.serverId) {
        const serverIdStr = req.query.serverId as string;
        InputValidator.validateNumber(serverIdStr, 'serverId', 1);
        serverId = parseInt(serverIdStr);
      }
      
      const settings = await settingsService.getCurrentSettings(serverId);
      ApiResponse.success(res, settings, 'Settings retrieved successfully');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        ApiResponse.validationError(res, error.message, error.details);
      } else {
        ApiResponse.serviceError(res, 'Failed to retrieve settings', error.message);
      }
    }
  }));

  // Get Available Resource Types for FHIR Version
  app.get("/api/validation/resource-types/:version", asyncHandler(async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      
      // Validate FHIR version parameter
      const version = req.params.version as FHIRVersion;
      InputValidator.validateEnum(version, 'version', ['R4', 'R5']);
      
      const resourceTypes = await settingsService.getAvailableResourceTypes(version);
      ApiResponse.success(res, {
        version,
        resourceTypes,
        count: resourceTypes.length
      }, 'Resource types retrieved successfully');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        ApiResponse.validationError(res, error.message, error.details);
      } else {
        ApiResponse.serviceError(res, 'Failed to retrieve resource types', error.message);
      }
    }
  }));

  // Get All Available Resource Types (without version parameter)
  app.get("/api/validation/resource-types", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const version = req.query.version as FHIRVersion || 'R4';
      
      if (!['R4', 'R5'].includes(version)) {
        return res.status(400).json({
          error: 'Invalid FHIR version',
          message: 'Version must be R4 or R5',
          code: 'INVALID_FHIR_VERSION'
        });
      }
      
      const resourceTypes = await settingsService.getAvailableResourceTypes(version);
      res.json({ 
        version, 
        resourceTypes,
        count: resourceTypes.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Update Validation Settings (Partial Updates Supported)
  app.put("/api/validation/settings", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ 
          error: 'Invalid request body',
          message: 'Request body must be a valid object',
          code: 'INVALID_BODY'
        });
      }
      
      const update: ValidationSettingsUpdate & { serverId?: number; validate?: boolean; fhirVersion?: FHIRVersion } = req.body;
      const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : update.serverId;
      
      // Validate serverId if provided
      if (serverId && (isNaN(serverId) || serverId <= 0)) {
        return res.status(400).json({
          error: 'Invalid server ID',
          message: 'Server ID must be a positive integer',
          code: 'INVALID_SERVER_ID'
        });
      }
      
      // Validate update object structure - allow partial updates
      const hasValidFields = update.aspects || update.performance || update.resourceTypes;
      if (!hasValidFields) {
        return res.status(400).json({
          error: 'Invalid update payload',
          message: 'Update must contain at least one of: aspects, performance, resourceTypes',
          code: 'INVALID_UPDATE_PAYLOAD'
        });
      }
      
      // Perform partial update with validation
      const result = await settingsService.updateSettings({ 
        ...update, 
        serverId, 
        validate: update.validate !== false // Default to true, allow override
      });
      
      // AFTER settings update, invalidate all results for this server
      // This ensures deterministic revalidation with new settings
      const { validationEnginePerAspect } = await import('../../../services/validation/engine/validation-engine-per-aspect');
      
      let invalidatedCount = 0;
      if (serverId) {
        const invalidationResult = await validationEnginePerAspect.invalidateAllResults(serverId);
        invalidatedCount = invalidationResult.deleted;
        logger.info(`[Settings] Invalidated ${invalidatedCount} validation results for server ${serverId}`);
      }
      
      // Note: Background revalidation would be started here
      // For MVP, we rely on automatic revalidation when resources are browsed
      // Future: Enqueue background batch revalidation job
      
      res.json({
        ...result,
        invalidated: true,
        invalidatedCount,
        revalidationStarted: false, // MVP: Manual/on-demand revalidation
        message: `Settings updated successfully. ${invalidatedCount} validation results invalidated. Resources will be revalidated when browsed.`
      });
    } catch (error: any) {
      logger.error('[ValidationSettings] Update error:', error);
      
      // Handle validation errors specifically
      if (error.message && error.message.includes('Validation failed:')) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Handle other errors
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Validate Settings
  app.post("/api/validation/settings/validate", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ 
          error: 'Invalid request body',
          message: 'Request body must be a valid object',
          code: 'INVALID_BODY'
        });
      }
      
      const { settings, fhirVersion } = req.body;
      
      // Validate settings object
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          error: 'Invalid settings object',
          message: 'Settings must be a valid object',
          code: 'INVALID_SETTINGS'
        });
      }
      
      const validation = await settingsService.validateSettings(settings, fhirVersion);
      res.json(validation);
    } catch (error: any) {
      logger.error('[ValidationSettings] Validation error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Reset Settings to Default
  app.post("/api/validation/settings/reset", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { serverId, fhirVersion } = req.body;
      const result = await settingsService.resetToDefaults(serverId, fhirVersion);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Migrate Settings for FHIR Version
  app.post("/api/validation/settings/migrate", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { serverUrl, serverId } = req.body;
      
      if (!serverUrl) {
        return res.status(400).json({
          error: 'Missing server URL',
          message: 'Server URL is required for migration',
          code: 'MISSING_SERVER_URL'
        });
      }
      
      const result = await settingsService.autoMigrateSettingsForServer(serverUrl, serverId);
      res.json(result);
    } catch (error: any) {
      logger.error('[ValidationSettings] Migration error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Check Migration Needed
  app.post("/api/validation/settings/migration-check", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { serverUrl, serverId } = req.body;
      
      if (!serverUrl) {
        return res.status(400).json({
          error: 'Missing server URL',
          message: 'Server URL is required for migration check',
          code: 'MISSING_SERVER_URL'
        });
      }
      
      const result = await settingsService.checkMigrationNeeded(serverUrl, serverId);
      res.json(result);
    } catch (error: any) {
      logger.error('[ValidationSettings] Migration check error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Preview Migration
  app.post("/api/validation/settings/migration-preview", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { serverUrl, serverId } = req.body;
      
      if (!serverUrl) {
        return res.status(400).json({
          error: 'Missing server URL',
          message: 'Server URL is required for migration preview',
          code: 'MISSING_SERVER_URL'
        });
      }
      
      const result = await settingsService.previewMigration(serverUrl, serverId);
      res.json(result);
    } catch (error: any) {
      logger.error('[ValidationSettings] Migration preview error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Validate Resource Types for FHIR Version
  app.post("/api/validation/resource-types/validate", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { resourceTypes, fhirVersion } = req.body;
      
      if (!resourceTypes || !Array.isArray(resourceTypes)) {
        return res.status(400).json({
          error: 'Invalid resource types',
          message: 'Resource types must be an array',
          code: 'INVALID_RESOURCE_TYPES'
        });
      }
      
      if (!fhirVersion || !['R4', 'R5'].includes(fhirVersion)) {
        return res.status(400).json({
          error: 'Invalid FHIR version',
          message: 'FHIR version must be R4 or R5',
          code: 'INVALID_FHIR_VERSION'
        });
      }
      
      const validation = await settingsService.validateResourceTypes(resourceTypes, fhirVersion);
      res.json({
        ...validation,
        fhirVersion,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[ValidationSettings] Resource type validation error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Get FHIR Version Detection
  app.post("/api/validation/detect-fhir-version", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const { serverUrl } = req.body;
      
      if (!serverUrl) {
        return res.status(400).json({
          error: 'Missing server URL',
          message: 'Server URL is required for FHIR version detection',
          code: 'MISSING_SERVER_URL'
        });
      }
      
      const version = await settingsService.detectFhirVersion(serverUrl);
      res.json({
        version,
        serverUrl,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[ValidationSettings] FHIR version detection error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    }
  });
}
