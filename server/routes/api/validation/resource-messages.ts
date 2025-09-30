import { Router, Request, Response } from 'express';
import { ValidationGroupsRepository } from '../../../repositories/validation-groups-repository';
import { z } from 'zod';

const router = Router();

/**
 * Query parameters validation schema
 */
const ResourceMessagesQuerySchema = z.object({
  serverId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
});

/**
 * GET /api/validation/resources/:resourceType/:id/messages
 * Get all validation messages for a specific resource
 * 
 * Path Parameters:
 * - resourceType: FHIR resource type (e.g., "Patient", "Observation")
 * - id: FHIR resource ID
 * 
 * Query Parameters:
 * - serverId (optional): Server ID (defaults to active server)
 */
router.get('/:resourceType/:id/messages', async (req: Request, res: Response) => {
  try {
    const { resourceType, id } = req.params;
    
    if (!resourceType || !id) {
      return res.status(400).json({
        success: false,
        error: 'Resource type and ID are required',
      });
    }
    
    // Validate query parameters
    const queryValidation = ResourceMessagesQuerySchema.safeParse(req.query);
    
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.errors,
      });
    }
    
    const params = queryValidation.data;
    
    // Get server ID
    const serverId = params.serverId || 1; // Temporary: default to server 1
    
    // Get resource messages
    const result = await ValidationGroupsRepository.getResourceMessages(serverId, resourceType, id);
    
    // If no aspects found, resource doesn't exist or hasn't been validated
    if (!result.aspects || result.aspects.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found or not yet validated',
        resourceType,
        fhirId: id,
        serverId,
      });
    }
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting resource messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve resource messages',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
