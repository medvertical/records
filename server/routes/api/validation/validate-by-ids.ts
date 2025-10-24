/**
 * Validate By IDs Endpoint
 * 
 * Provides API endpoint for validating resources by their database IDs
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../../utils/logger';

const router = Router();

// Request validation schema
const ValidateByIdsRequestSchema = z.object({
  resources: z.array(z.object({
    _dbId: z.union([z.number(), z.string()]),
    // Other fields are optional as we only need the _dbId
  }).passthrough()).min(1).max(100),
});

/**
 * POST /api/validation/validate-by-ids
 * Validate resources by their database IDs
 * 
 * Body:
 * {
 *   resources: Array<{ _dbId: number | string, ...otherFields }>
 * }
 * 
 * Returns:
 * {
 *   success: boolean,
 *   validatedCount: number,
 *   requestedCount: number,
 *   message: string,
 *   detailedResults: Array<ValidationResult>
 * }
 */
router.post('/validate-by-ids', async (req: Request, res: Response) => {
  try {
    // 1. Validate request
    const validation = ValidateByIdsRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      logger.warn('[Validate By IDs] Invalid request:', validation.error.errors);
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }
    
    const { resources } = validation.data;
    const dbIds = resources.map(r => typeof r._dbId === 'string' ? parseInt(r._dbId, 10) : r._dbId);
    
    logger.info(`[Validate By IDs] Validating ${dbIds.length} resources by database IDs`);
    
    // 2. Load resources from database
    const { db } = await import('../../../db');
    const { fhirResources } = await import('@shared/schema');
    const { inArray } = await import('drizzle-orm');
    
    const dbResources = await db
      .select()
      .from(fhirResources)
      .where(inArray(fhirResources.id, dbIds));
    
    if (dbResources.length === 0) {
      logger.warn('[Validate By IDs] No resources found for provided IDs');
      return res.status(404).json({
        success: false,
        error: 'No resources found',
        message: 'None of the provided resource IDs exist in the database',
      });
    }
    
    logger.info(`[Validate By IDs] Found ${dbResources.length} resources to validate`);
    
    // 3. Perform validation using ConsolidatedValidationService
    const { getConsolidatedValidationService } = await import('../../../services/validation');
    const { getValidationSettingsService } = await import('../../../services/validation/settings/validation-settings-service');
    const { getIndividualResourceProgressService, ResourceValidationStatus } = await import('../../../services/validation/features/individual-resource-progress-service');
    
    const validationService = getConsolidatedValidationService();
    const settingsService = getValidationSettingsService();
    const progressService = getIndividualResourceProgressService();
    
    if (!validationService) {
      logger.error('[Validate By IDs] Validation service not available');
      return res.status(503).json({
        success: false,
        error: 'Validation service not available',
      });
    }
    
    // Get current settings and fix businessRules -> businessRule mapping
    const currentSettings = await settingsService.getCurrentSettings();
    logger.info('[Validate By IDs] Current settings:', JSON.stringify(currentSettings, null, 2));
    
    const settingsOverride = currentSettings ? {
      ...currentSettings,
      aspects: {
        ...currentSettings.aspects
      }
    } : undefined;
    
    logger.info('[Validate By IDs] Settings override:', JSON.stringify(settingsOverride, null, 2));
    
    // Clean up any stale progress entries older than 1 hour
    progressService.clearOldProgress(60 * 60 * 1000); // 1 hour
    
    // Additionally, cancel any stuck active progress entries (started but not updated in 5 minutes)
    const activeProgress = progressService.getActiveProgress();
    const now = Date.now();
    const stuckThreshold = 5 * 60 * 1000; // 5 minutes
    
    activeProgress.forEach((progress) => {
      const timeSinceStart = now - progress.startTime.getTime();
      if (timeSinceStart > stuckThreshold) {
        logger.warn(`[Validate By IDs] Cancelling stuck progress for ${progress.resourceId} (${timeSinceStart}ms old)`);
        progressService.cancelResourceProgress(progress.resourceId);
      }
    });
    
    const detailedResults = [];
    let validatedCount = 0;
    
    // Performance tracking
    const batchStartTime = Date.now();
    const concurrencyLimit = 5; // Validate 5 resources in parallel
    
    logger.info(`[Validate By IDs] Starting parallel validation with concurrency limit: ${concurrencyLimit}`);
    
    // Get FHIR client for fetching resources
    const { FhirClient } = await import('../../../services/fhir/fhir-client');
    const { storage } = await import('../../../storage');
    
    const activeServer = await storage.getActiveFhirServer();
    if (!activeServer) {
      logger.error('[Validate By IDs] No active FHIR server found');
      return res.status(503).json({
        success: false,
        error: 'No active FHIR server configured',
      });
    }
    
    const fhirClient = new FhirClient(activeServer.url, undefined, activeServer.id);
    
    // Validate resource function with progress tracking
    const validateResource = async (resource: typeof dbResources[0]) => {
      const resourceIdentifier = `${resource.resourceType}/${resource.resourceId}`;
      const startTime = Date.now();
      
      try {
        // Start progress tracking
        progressService.startResourceProgress(
          resourceIdentifier,
          resource.resourceType,
          {
            requestedBy: 'batch-validation',
            requestId: `validate-by-ids-${Date.now()}`,
          }
        );
        
        logger.debug(`[Validate By IDs] Starting validation for ${resourceIdentifier}`);
        
        // Fetch resource from FHIR server (we no longer store resource data in DB)
        const fhirResource = await fhirClient.getResource(resource.resourceType, resource.resourceId);
        
        if (!fhirResource) {
          throw new Error(`Resource ${resourceIdentifier} not found on FHIR server`);
        }
        
        // Validate resource using consolidated validation service with settings override
        const result = await validationService.validateResource(
          fhirResource,
          false, // skipUnchanged
          true,  // forceRevalidation
          0,     // retryAttempt
          {      // options
            validationSettingsOverride: settingsOverride
          }
        );
        
        const duration = Date.now() - startTime;
        
        // Complete progress tracking with success
        progressService.completeResourceProgress(
          resourceIdentifier,
          ResourceValidationStatus.COMPLETED,
          {
            errorCount: result.detailedResult?.summary?.errorCount || 0,
            warningCount: result.detailedResult?.summary?.warningCount || 0,
            infoCount: result.detailedResult?.summary?.informationCount || 0,
            performance: {
              totalTimeMs: result.detailedResult?.performance?.totalDurationMs || duration,
              aspectTimes: result.detailedResult?.performance?.durationByAspect || {},
              averageTimePerAspect: 0
            }
          }
        );
        
        // Log detailed performance breakdown
        const aspectTimes = result.detailedResult?.performance?.durationByAspect || {};
        const aspectBreakdown = Object.entries(aspectTimes)
          .map(([aspect, time]) => `${aspect}:${time}ms`)
          .join(', ');
        
        logger.info(`[Validate By IDs] ✓ Validated ${resourceIdentifier} in ${duration}ms [${aspectBreakdown}]`);
        
        return {
          resourceId: resource.resourceId,
          resourceType: resource.resourceType,
          dbId: resource.id,
          success: true,
          duration,
          aspectTimes,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Complete progress tracking with failure
        progressService.completeResourceProgress(
          resourceIdentifier,
          ResourceValidationStatus.FAILED,
          {
            errorCount: 1,
            warningCount: 0,
            infoCount: 0,
            lastError: error instanceof Error ? error.message : 'Unknown error',
            performance: {
              totalTimeMs: duration,
              aspectTimes: {},
              averageTimePerAspect: 0
            }
          }
        );
        
        logger.error(`[Validate By IDs] ✗ Validation failed for ${resourceIdentifier} after ${duration}ms:`, error);
        
        return {
          resourceId: resource.resourceId,
          resourceType: resource.resourceType,
          dbId: resource.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        };
      }
    };
    
    // Process resources in parallel with concurrency limit
    const processInChunks = async (items: typeof dbResources, limit: number) => {
      const results = [];
      for (let i = 0; i < items.length; i += limit) {
        const chunk = items.slice(i, i + limit);
        logger.info(`[Validate By IDs] Processing chunk ${Math.floor(i / limit) + 1}/${Math.ceil(items.length / limit)} (${chunk.length} resources)`);
        
        const chunkStartTime = Date.now();
        const chunkResults = await Promise.all(chunk.map(validateResource));
        const chunkDuration = Date.now() - chunkStartTime;
        
        results.push(...chunkResults);
        
        logger.info(`[Validate By IDs] Chunk completed in ${chunkDuration}ms (avg: ${Math.round(chunkDuration / chunk.length)}ms per resource)`);
      }
      return results;
    };
    
    const results = await processInChunks(dbResources, concurrencyLimit);
    detailedResults.push(...results);
    validatedCount = results.filter(r => r.success).length;
    
    const totalDuration = Date.now() - batchStartTime;
    const avgDuration = Math.round(totalDuration / dbResources.length);
    
    logger.info(`[Validate By IDs] Batch completed: ${validatedCount}/${dbResources.length} successful in ${totalDuration}ms (avg: ${avgDuration}ms per resource)`);


    // 4. Return response
    logger.info(`[Validate By IDs] Completed: ${validatedCount}/${resources.length} resources validated successfully`);
    
    res.json({
      success: true,
      validatedCount,
      requestedCount: resources.length,
      message: `Successfully validated ${validatedCount} out of ${resources.length} resources`,
      detailedResults,
    });
    
  } catch (error) {
    logger.error('[Validate By IDs] Error processing validation request:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

