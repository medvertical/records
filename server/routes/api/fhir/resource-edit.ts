import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { validationQueue } from '../../../services/validation/queue/validation-queue-simple';
import { securityMiddleware } from '../../../middleware/security-validation';
import { rateLimiters } from '../../../middleware/security-config';
import { db } from '../../../db';
import { editAuditTrail } from '@shared/schema';
import logger from '../../../utils/logger';

const router = Router();

// Apply strict rate limiting for write operations
router.use(rateLimiters.strictWrite);

/**
 * Resource edit request validation schema
 */
const EditResourceSchema = z.object({
  resourceType: z.string().min(1, 'Resource type is required'),
  id: z.string().min(1, 'Resource ID is required'),
  resource: z.record(z.any()).refine(
    (data) => data.resourceType && data.id,
    { message: 'Resource must have resourceType and id fields' }
  ),
});

/**
 * Compute SHA-256 hash of resource content for audit trail
 */
function computeResourceHash(resource: any): string {
  const normalized = JSON.stringify(resource, Object.keys(resource).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Validate FHIR resource structure (basic validation)
 */
function validateFhirResource(resource: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!resource.resourceType) {
    errors.push('Missing required field: resourceType');
  }
  
  if (!resource.id) {
    errors.push('Missing required field: id');
  }
  
  // Check for basic FHIR structure requirements
  if (resource.meta && typeof resource.meta !== 'object') {
    errors.push('meta must be an object');
  }
  
  if (resource.text && typeof resource.text !== 'object') {
    errors.push('text must be an object');
  }
  
  // Size check (max 5MB)
  const resourceSize = JSON.stringify(resource).length;
  if (resourceSize > 5 * 1024 * 1024) {
    errors.push('Resource size exceeds 5MB limit');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * PUT /api/fhir/resources/:resourceType/:id
 * Update a FHIR resource with optimistic concurrency control
 * 
 * Headers:
 * - If-Match: <versionId|ETag> (optional but recommended for conflict detection)
 * 
 * Body: Complete FHIR resource JSON
 * 
 * Returns:
 * - 200 OK: Resource updated successfully
 * - 400 Bad Request: Invalid resource structure
 * - 409 Conflict: Version mismatch (If-Match failed)
 * - 422 Unprocessable Entity: Validation failed
 * - 500 Internal Server Error: Server error
 */
router.put(
  '/:resourceType/:id',
  securityMiddleware.editEndpointLimiter,
  securityMiddleware.validateFhirResource,
  async (req: Request, res: Response) => {
  try {
    const { resourceType, id } = req.params;
    const resource = req.body;
    const ifMatch = req.headers['if-match'] as string | undefined;
    
    // Validate input
    const validation = EditResourceSchema.safeParse({
      resourceType,
      id,
      resource,
    });
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }
    
    // Validate FHIR resource structure
    const fhirValidation = validateFhirResource(resource);
    if (!fhirValidation.valid) {
      return res.status(422).json({
        success: false,
        error: 'FHIR validation failed',
        details: fhirValidation.errors,
      });
    }
    
    // Ensure resource type and ID match the URL
    if (resource.resourceType !== resourceType) {
      return res.status(400).json({
        success: false,
        error: 'Resource type mismatch',
        message: `Expected ${resourceType}, got ${resource.resourceType}`,
      });
    }
    
    if (resource.id !== id) {
      return res.status(400).json({
        success: false,
        error: 'Resource ID mismatch',
        message: `Expected ${id}, got ${resource.id}`,
      });
    }
    
    // Get active server ID
    // TODO: Implement getActiveServerId() helper
    const serverId = 1; // Temporary default
    
    // Get FHIR client
    // TODO: Get from app context
    const fhirClient = (req as any).fhirClient;
    
    if (!fhirClient) {
      return res.status(503).json({
        success: false,
        error: 'FHIR client not available',
      });
    }
    
    // Fetch current resource from FHIR server
    let currentResource: any;
    try {
      currentResource = await fhirClient.read(resourceType, id);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          resourceType,
          id,
        });
      }
      throw error;
    }
    
    // Check If-Match if provided (optimistic concurrency control)
    if (ifMatch) {
      const currentVersionId = currentResource.meta?.versionId;
      const currentETag = currentVersionId ? `W/"${currentVersionId}"` : undefined;
      
      if (currentETag && ifMatch !== currentETag && ifMatch !== currentVersionId) {
        return res.status(409).json({
          success: false,
          error: 'Version conflict',
          message: 'Resource has been modified by another user',
          currentVersionId,
          requestedVersionId: ifMatch,
        });
      }
    }
    
    // Compute before/after hashes for audit trail
    const beforeHash = computeResourceHash(currentResource);
    const afterHash = computeResourceHash(resource);
    
    // Update resource on FHIR server
    let updatedResource: any;
    try {
      updatedResource = await fhirClient.update(resourceType, id, resource);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update resource on FHIR server',
        message: error.message || 'Unknown error',
      });
    }
    
    // Create and persist audit record
    try {
      await db.insert(editAuditTrail).values({
        serverId,
        resourceType,
        fhirId: id,
        beforeHash,
        afterHash,
        editedAt: new Date(),
        editedBy: 'system', // TODO: Get from auth context when authentication is implemented
        operation: 'single_edit',
        result: 'success',
        versionBefore: currentResource.meta?.versionId,
        versionAfter: updatedResource.meta?.versionId,
      });
      
      logger.info(`[Audit] Recorded successful edit: ${resourceType}/${id}`);
    } catch (auditError) {
      // Log audit error but don't fail the request
      logger.error('[Audit] Failed to record audit trail:', auditError);
    }
    
    // Enqueue revalidation (higher priority than batch)
    validationQueue.enqueue({
      serverId,
      resourceType,
      fhirId: id,
      priority: 'high',
    });
    const queuedRevalidation = true;
    
    res.json({
      success: true,
      resourceType,
      id,
      versionId: updatedResource.meta?.versionId,
      beforeHash,
      afterHash,
      changed: beforeHash !== afterHash,
      queuedRevalidation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error updating resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resource',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
