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
    
    const result = await ValidationGroupsRepository.getResourceMessages(serverId, resourceType, id);
    
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching resource messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource messages',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;

