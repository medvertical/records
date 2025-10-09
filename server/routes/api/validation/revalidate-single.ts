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
    
    const resources = await db
      .select()
      .from(fhirResources)
      .where(
        and(
          eq(fhirResources.serverId, serverId),
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
    
    // Invalidate existing validation results
    const { validationEnginePerAspect } = await import('../../../services/validation/engine/validation-engine-per-aspect');
    
    const invalidationResult = await validationEnginePerAspect.invalidateResourceResults(
      serverId,
      resourceType,
      id
    );
    
    logger.info(`[Single Revalidate] Invalidated ${invalidationResult.deleted} validation results`);
    
    // Trigger immediate validation
    try {
      const validationResult = await validationEnginePerAspect.validateResource(
        serverId,
        resourceType,
        id,
        resource.data
      );
      
      logger.info(`[Single Revalidate] Validation completed successfully for ${resourceType}/${id}`);
      
      res.json({
        success: true,
        resourceType,
        resourceId: id,
        validationResult: {
          isValid: validationResult.isValid,
          aspects: validationResult.aspects.map(a => ({
            aspect: a.aspect,
            isValid: a.isValid,
            messageCount: a.messageCount,
          })),
          timestamp: validationResult.timestamp,
        },
        message: `Resource ${resourceType}/${id} revalidated successfully`,
      });
      
    } catch (validationError) {
      logger.error(`[Single Revalidate] Validation failed for ${resourceType}/${id}:`, validationError);
      
      // If immediate validation fails, queue it for background processing
      const { ValidationQueueService, ValidationPriority } = await import('../../../services/validation/performance/validation-queue-service');
      const queueService = ValidationQueueService.getInstance();
      
      const jobId = await queueService.queueValidation(
        {
          resource: resource.data,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          profileUrl: undefined,
        },
        {
          requestId: `single_revalidate_${Date.now()}`,
          requestedBy: 'single-revalidate-api',
          timestamp: new Date(),
        },
        ValidationPriority.HIGH
      );
      
      logger.info(`[Single Revalidate] Queued for background validation with job ID: ${jobId}`);
      
      res.json({
        success: true,
        resourceType,
        resourceId: id,
        jobId,
        message: `Resource ${resourceType}/${id} queued for validation`,
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

