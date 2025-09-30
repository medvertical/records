import { Router, Request, Response } from 'express';
import { ValidationGroupsRepository } from '../../../repositories/validation-groups-repository';
import { z } from 'zod';

const router = Router();

/**
 * Query parameters validation schema for groups endpoint
 */
const GroupsQuerySchema = z.object({
  serverId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  aspect: z.enum(['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata']).optional(),
  severity: z.enum(['error', 'warning', 'information']).optional(),
  code: z.string().optional(),
  path: z.string().optional(),
  resourceType: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  size: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('25'),
  sort: z.enum(['count:desc', 'count:asc', 'severity:desc', 'severity:asc']).default('count:desc'),
});

/**
 * GET /api/validation/issues/groups
 * Get validation message groups with filtering and pagination
 * 
 * Query Parameters:
 * - serverId (optional): Filter by server ID (defaults to active server)
 * - aspect (optional): Filter by validation aspect
 * - severity (optional): Filter by severity level
 * - code (optional): Filter by error code
 * - path (optional): Filter by canonical path (partial match)
 * - resourceType (optional): Filter by resource type
 * - page (default: 1): Page number
 * - size (default: 25, max: 100): Page size
 * - sort (default: count:desc): Sort order
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const queryValidation = GroupsQuerySchema.safeParse(req.query);
    
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.errors,
      });
    }
    
    const params = queryValidation.data;
    
    // Get server ID (use from query or default to active server)
    // TODO: Implement getActiveServerId() helper
    const serverId = params.serverId || 1; // Temporary: default to server 1
    
    // Build filters
    const filters = {
      serverId,
      aspect: params.aspect,
      severity: params.severity,
      code: params.code,
      path: params.path,
      resourceType: params.resourceType,
    };
    
    // Query options
    const options = {
      page: params.page,
      size: params.size,
      sort: params.sort,
    };
    
    // Get groups
    const result = await ValidationGroupsRepository.getValidationGroups(filters, options);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / params.size);
    const hasNext = params.page < totalPages;
    const hasPrevious = params.page > 1;
    
    res.json({
      success: true,
      data: result.groups,
      pagination: {
        page: params.page,
        size: params.size,
        total: result.total,
        totalPages,
        hasNext,
        hasPrevious,
      },
      filters: {
        serverId,
        aspect: params.aspect || null,
        severity: params.severity || null,
        code: params.code || null,
        path: params.path || null,
        resourceType: params.resourceType || null,
      },
      sort: params.sort,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting validation groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validation groups',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Query parameters validation schema for group members endpoint
 */
const GroupMembersQuerySchema = z.object({
  serverId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  resourceType: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  size: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('25'),
  sort: z.enum(['validatedAt:desc', 'validatedAt:asc']).default('validatedAt:desc'),
});

/**
 * GET /api/validation/issues/groups/:signature/resources
 * Get resources that have a specific validation message (by signature)
 * 
 * Path Parameters:
 * - signature: Message signature (SHA-256 hash)
 * 
 * Query Parameters:
 * - serverId (optional): Server ID (defaults to active server)
 * - resourceType (optional): Filter by resource type
 * - page (default: 1): Page number
 * - size (default: 25, max: 100): Page size
 * - sort (default: validatedAt:desc): Sort order
 */
router.get('/:signature/resources', async (req: Request, res: Response) => {
  try {
    const { signature } = req.params;
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Signature parameter is required',
      });
    }
    
    // Validate query parameters
    const queryValidation = GroupMembersQuerySchema.safeParse(req.query);
    
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
    
    // Get group members
    const result = await ValidationGroupsRepository.getGroupMembers(serverId, signature, {
      resourceType: params.resourceType,
      page: params.page,
      size: params.size,
      sort: params.sort,
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / params.size);
    const hasNext = params.page < totalPages;
    const hasPrevious = params.page > 1;
    
    res.json({
      success: true,
      data: result.members,
      pagination: {
        page: params.page,
        size: params.size,
        total: result.total,
        totalPages,
        hasNext,
        hasPrevious,
      },
      filters: {
        serverId,
        signature,
        resourceType: params.resourceType || null,
      },
      sort: params.sort,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting group members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve group members',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
