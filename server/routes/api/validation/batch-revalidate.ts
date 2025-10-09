/**
 * Batch Revalidation Endpoint
 * 
 * Provides API endpoints for batch revalidation of resources
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../../utils/logger';

const router = Router();

// Request validation schema
const BatchRevalidateRequestSchema = z.object({
  resourceIds: z.array(z.number()).min(1).max(1000),
  serverId: z.number().int().positive().default(1),
  forceRevalidation: z.boolean().optional().default(true),
});

/**
 * POST /api/validation/batch-revalidate
 * Trigger batch revalidation for a list of resources
 * 
 * Body:
 * {
 *   resourceIds: number[],      // Array of FHIR resource database IDs
 *   serverId: number,            // Server ID (default: 1)
 *   forceRevalidation: boolean   // Force revalidation even if cached (default: true)
 * }
 * 
 * Returns:
 * {
 *   success: boolean,
 *   batchId: string,             // Batch job ID for tracking
 *   queuedCount: number,         // Number of resources queued
 *   message: string
 * }
 */
router.post('/batch-revalidate', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validation = BatchRevalidateRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      logger.warn('[Batch Revalidate] Invalid request:', validation.error.errors);
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }
    
    const { resourceIds, serverId, forceRevalidation } = validation.data;
    
    logger.info(`[Batch Revalidate] Queueing ${resourceIds.length} resources for revalidation`);
    
    // Fetch resources from database
    const { db } = await import('../../../db');
    const { fhirResources } = await import('@shared/schema');
    const { eq, inArray } = await import('drizzle-orm');
    
    const resources = await db
      .select()
      .from(fhirResources)
      .where(
        inArray(fhirResources.id, resourceIds)
      );
    
    if (resources.length === 0) {
      logger.warn('[Batch Revalidate] No resources found for provided IDs');
      return res.status(404).json({
        success: false,
        error: 'No resources found',
        message: 'None of the provided resource IDs exist',
      });
    }
    
    logger.info(`[Batch Revalidate] Found ${resources.length} resources to revalidate`);
    
    // Invalidate existing validation results if force revalidation
    if (forceRevalidation) {
      const { validationEnginePerAspect } = await import('../../../services/validation/engine/validation-engine-per-aspect');
      
      for (const resource of resources) {
        await validationEnginePerAspect.invalidateResourceResults(
          serverId,
          resource.resourceType,
          resource.resourceId
        );
      }
      
      logger.info(`[Batch Revalidate] Invalidated validation results for ${resources.length} resources`);
    }
    
    // Queue resources for validation
    const { ValidationQueueService, ValidationPriority } = await import('../../../services/validation/performance/validation-queue-service');
    const queueService = ValidationQueueService.getInstance();
    
    const validationRequests = resources.map(resource => ({
      resource: resource.data,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      profileUrl: undefined,
    }));
    
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedIds = await queueService.queueBatchValidation(
      validationRequests,
      {
        requestId: batchId,
        requestedBy: 'batch-revalidate-api',
        timestamp: new Date(),
      },
      ValidationPriority.HIGH
    );
    
    logger.info(`[Batch Revalidate] Queued ${queuedIds.length} resources with batch ID: ${batchId}`);
    
    res.json({
      success: true,
      batchId,
      queuedCount: queuedIds.length,
      message: `Successfully queued ${queuedIds.length} resources for revalidation`,
    });
    
  } catch (error) {
    logger.error('[Batch Revalidate] Error processing batch revalidation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

