import { Router, Request, Response } from 'express';
import * as ValidationGroupsRepository from '../../../repositories/validation-groups-repository';
import logger from '../../../utils/logger';

const router = Router();

/**
 * GET /api/validation/resources/:resourceType/:id/messages
 * Get all validation messages for a specific resource
 * 
 * Path Parameters:
 * - resourceType: string - FHIR resource type (e.g., 'Patient', 'Observation')
 * - id: string - FHIR resource ID
 * 
 * Query Parameters:
 * - serverId: number - Server ID (default: 1)
 * 
 * Response:
 * {
 *   resourceType: string,
 *   fhirId: string,
 *   aspects: [{
 *     aspect: string,
 *     messages: [{
 *       severity: string,
 *       code: string,
 *       canonicalPath: string,
 *       text: string,
 *       signature: string,
 *       timestamp: string
 *     }]
 *   }]
 * }
 */
router.get('/resources/:resourceType/:id/messages', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.query.serverId as string) || 1;
    const { resourceType, id } = req.params;
    
    if (!resourceType || !id) {
      return res.status(400).json({
        success: false,
        error: 'Missing resourceType or id parameter',
      });
    }
    
    logger.info(`[ResourceMessages] Fetching messages for ${resourceType}/${id} (serverId: ${serverId})`);
    
    const result = await ValidationGroupsRepository.getResourceMessages(serverId, resourceType, id);
    
    // If no validation data found, return empty result instead of error
    if (!result || !result.aspects || result.aspects.length === 0) {
      logger.info(`[ResourceMessages] No validation data found for ${resourceType}/${id} (serverId: ${serverId})`);
      return res.json({
        serverId,
        resourceType,
        fhirId: id,
        aspects: [],
      });
    }
    
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching resource messages:', error);
    // Return empty result instead of error to avoid UI crashes
    res.json({
      serverId: parseInt(req.query.serverId as string) || 1,
      resourceType: req.params.resourceType,
      fhirId: req.params.id,
      aspects: [],
    });
  }
});

export default router;

