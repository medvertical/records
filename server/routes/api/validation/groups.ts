import { Router, Request, Response } from 'express';
import * as ValidationGroupsRepository from '../../../repositories/validation-groups-repository';
import logger from '../../../utils/logger';

const router = Router();

/**
 * GET /api/validation/issues/groups
 * Get validation issue groups by message signature
 * 
 * Query Parameters:
 * - serverId: number - Server ID (default: 1)
 * - aspect: string - Filter by validation aspect (optional)
 * - severity: string - Filter by severity (optional)
 * - code: string - Filter by error code (optional)
 * - path: string - Filter by canonical path (partial match, optional)
 * - resourceType: string - Filter by resource type (optional)
 * - page: number - Page number (default: 1)
 * - size: number - Page size (default: 25)
 * - sort: string - Sort order: 'count:desc' | 'count:asc' | 'severity:desc' | 'severity:asc' (default: 'count:desc')
 */
router.get('/issues/groups', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.query.serverId as string) || 1;
    
    const filters: any = {
      serverId,
    };
    
    // Add optional filters
    if (req.query.aspect) {
      filters.aspect = req.query.aspect as string;
    }
    if (req.query.severity) {
      filters.severity = req.query.severity as string;
    }
    if (req.query.code) {
      filters.code = req.query.code as string;
    }
    if (req.query.path) {
      filters.path = req.query.path as string;
    }
    if (req.query.resourceType) {
      filters.resourceType = req.query.resourceType as string;
    }
    
    const options = {
      page: parseInt(req.query.page as string) || 1,
      size: parseInt(req.query.size as string) || 25,
      sort: (req.query.sort as string) || 'count:desc',
    };
    
    const result = await ValidationGroupsRepository.getValidationGroups(filters, options);
    
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching validation groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation groups',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/validation/issues/groups/:signature/resources
 * Get resources affected by a specific validation issue (by signature)
 * 
 * Path Parameters:
 * - signature: string - Message signature hash
 * 
 * Query Parameters:
 * - serverId: number - Server ID (default: 1)
 * - resourceType: string - Filter by resource type (optional)
 * - page: number - Page number (default: 1)
 * - size: number - Page size (default: 25)
 * - sort: string - Sort order: 'validatedAt:desc' | 'validatedAt:asc' (default: 'validatedAt:desc')
 */
router.get('/issues/groups/:signature/resources', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.query.serverId as string) || 1;
    const { signature } = req.params;
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature parameter',
      });
    }
    
    const options: any = {
      page: parseInt(req.query.page as string) || 1,
      size: parseInt(req.query.size as string) || 25,
      sort: (req.query.sort as string) || 'validatedAt:desc',
    };
    
    if (req.query.resourceType) {
      options.resourceType = req.query.resourceType as string;
    }
    
    const result = await ValidationGroupsRepository.getGroupMembers(serverId, signature, options);
    
    res.json(result);
  } catch (error: any) {
    logger.error('Error fetching group members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch group members',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;

