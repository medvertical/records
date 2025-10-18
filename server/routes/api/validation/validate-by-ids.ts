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
    
    const validationService = getConsolidatedValidationService();
    const settingsService = getValidationSettingsService();
    
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
    
    const detailedResults = [];
    let validatedCount = 0;
    
    for (const resource of dbResources) {
      try {
        // Validate resource using consolidated validation service with settings override
        await validationService.validateResource(
          resource.data,
          false, // skipUnchanged
          true,  // forceRevalidation
          0,     // retryAttempt
          {      // options
            validationSettingsOverride: settingsOverride
          }
        );
        
        validatedCount++;
        detailedResults.push({
          resourceId: resource.resourceId,
          resourceType: resource.resourceType,
          dbId: resource.id,
          success: true,
        });
        
        logger.debug(`[Validate By IDs] Successfully validated ${resource.resourceType}/${resource.resourceId}`);
      } catch (error) {
        logger.error(`[Validate By IDs] Validation failed for resource ${resource.resourceType}/${resource.resourceId}:`, error);
        detailedResults.push({
          resourceId: resource.resourceId,
          resourceType: resource.resourceType,
          dbId: resource.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

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

