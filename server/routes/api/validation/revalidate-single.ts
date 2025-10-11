/**
 * Single Resource Revalidation Endpoint
 * 
 * Provides API endpoint for revalidating a single FHIR resource
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * POST /api/validation/resources/:resourceType/:id/revalidate
 * Trigger revalidation for a single resource
 * 
 * Params:
 * - resourceType: FHIR resource type (e.g., "Patient", "Observation")
 * - id: FHIR resource ID
 * 
 * Query:
 * - serverId: Server ID (default: 1)
 * 
 * Returns:
 * {
 *   success: boolean,
 *   resourceType: string,
 *   resourceId: string,
 *   validationResult?: object,   // Validation result if sync
 *   jobId?: string,              // Job ID if async
 *   message: string
 * }
 */
router.post('/resources/:resourceType/:id/revalidate', async (req: Request, res: Response) => {
  try {
    const { resourceType, id } = req.params;
    const serverId = parseInt(req.query.serverId as string) || 1;
    
    logger.info(`[Single Revalidate] Revalidating ${resourceType}/${id} on server ${serverId}`);
    
    // Fetch resource from database
    const { db } = await import('../../../db');
    const { fhirResources } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    // Query for the resource - don't filter by serverId since many resources have null serverId
    const resources = await db
      .select()
      .from(fhirResources)
      .where(
        and(
          eq(fhirResources.resourceType, resourceType),
          eq(fhirResources.resourceId, id)
        )
      )
      .limit(1);
    
    if (resources.length === 0) {
      logger.warn(`[Single Revalidate] Resource not found: ${resourceType}/${id}`);
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
        message: `Resource ${resourceType}/${id} not found on server ${serverId}`,
      });
    }
    
    const resource = resources[0];
    logger.info(`[Single Revalidate] Found resource with DB ID: ${resource.id}`);
    
    // Use ConsolidatedValidationService (same as list view revalidation)
    const { getConsolidatedValidationService } = await import('../../../services/validation');
    const { getValidationSettingsService } = await import('../../../services/validation/settings/validation-settings-service');
    
    const validationService = getConsolidatedValidationService();
    const settingsService = getValidationSettingsService();
    
    if (!validationService) {
      logger.error('[Single Revalidate] Validation service not available');
      return res.status(503).json({
        success: false,
        error: 'Validation service not available',
      });
    }
    
    // Get current settings and fix businessRules -> businessRule mapping
    const currentSettings = await settingsService.getCurrentSettings();
    logger.info('[Single Revalidate] Current settings:', JSON.stringify(currentSettings, null, 2));
    
    const settingsOverride = currentSettings ? {
      ...currentSettings,
      aspects: {
        ...currentSettings.aspects,
        // Map businessRules (plural) to businessRule (singular) for backward compatibility
        businessRule: (currentSettings.aspects as any)?.businessRules || (currentSettings.aspects as any)?.businessRule
      }
    } : undefined;
    
    logger.info('[Single Revalidate] Settings override:', JSON.stringify(settingsOverride, null, 2));
    
    // Trigger validation using ConsolidatedValidationService (same as list view)
    try {
      logger.info(`[Single Revalidate] Calling ConsolidatedValidationService.validateResource...`);
      logger.info(`[Single Revalidate] ServerId: ${serverId}`);
      logger.info(`[Single Revalidate] Resource type: ${resource.resourceType}`);
      logger.info(`[Single Revalidate] Resource id: ${resource.resourceId}`);
      logger.info(`[Single Revalidate] Resource FHIR id: ${(resource.data as any).id}`);
      
      const validationResult = await validationService.validateResource(
        resource.data,
        false, // skipUnchanged
        true,  // forceRevalidation
        0,     // retryAttempt
        {      // options
          validationSettingsOverride: settingsOverride
        }
      );
      
      logger.info(`[Single Revalidate] Validation completed successfully for ${resourceType}/${id}`);
      logger.info(`[Single Revalidate] ValidationResult:`, JSON.stringify({
        wasRevalidated: validationResult.wasRevalidated,
        isValid: validationResult.detailedResult.isValid,
        issuesCount: validationResult.detailedResult.issues.length,
        aspectsCount: validationResult.detailedResult.aspects?.length || 0,
        aspects: validationResult.detailedResult.aspects?.map(a => ({
          aspect: a.aspect,
          isValid: a.isValid,
          issuesCount: a.issues?.length || 0
        }))
      }, null, 2));
      
      res.json({
        success: true,
        resourceType,
        resourceId: id,
        message: `Resource ${resourceType}/${id} revalidated successfully`,
        validationResult: validationResult.detailedResult,
      });
      
    } catch (validationError) {
      logger.error(`[Single Revalidate] Validation failed for ${resourceType}/${id}:`, validationError);
      logger.error(`[Single Revalidate] Error details:`, {
        message: validationError instanceof Error ? validationError.message : String(validationError),
        stack: validationError instanceof Error ? validationError.stack : undefined,
      });
      
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        message: validationError instanceof Error ? validationError.message : 'Unknown validation error',
        resourceType,
        resourceId: id,
      });
    }
    
  } catch (error) {
    logger.error('[Single Revalidate] Error processing revalidation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

