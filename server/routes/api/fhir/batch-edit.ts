import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { validationQueue } from '../../../services/validation/queue/validation-queue-simple';

const router = Router();

/**
 * JSON Patch operation schema (RFC 6902)
 */
const PatchOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace', 'copy', 'move', 'test']),
  path: z.string().min(1, 'Path is required'),
  value: z.any().optional(),
  from: z.string().optional(),
});

/**
 * Batch edit request schema
 */
const BatchEditRequestSchema = z.object({
  resourceType: z.string().min(1, 'Resource type is required'),
  filter: z.object({
    ids: z.array(z.string()).optional(),
    searchParams: z.record(z.string()).optional(),
  }).optional(),
  operations: z.array(PatchOperationSchema).min(1, 'At least one operation is required'),
  maxBatchSize: z.number().int().positive().max(5000).optional().default(100),
});

/**
 * Compute SHA-256 hash of resource content
 */
function computeResourceHash(resource: any): string {
  const normalized = JSON.stringify(resource, Object.keys(resource).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Apply JSON Patch operations to a resource
 * Simplified implementation - use jsonpatch library for production
 */
function applyPatchOperations(resource: any, operations: any[]): { resource: any; errors: string[] } {
  const errors: string[] = [];
  let workingResource = JSON.parse(JSON.stringify(resource)); // Deep clone
  
  for (const op of operations) {
    try {
      const pathParts = op.path.split('/').filter((p: string) => p !== '');
      
      switch (op.op) {
        case 'replace': {
          if (pathParts.length === 0) {
            errors.push('Cannot replace root object');
            continue;
          }
          
          let current = workingResource;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!(part in current)) {
              errors.push(`Path not found: ${op.path}`);
              break;
            }
            current = current[part];
          }
          
          const lastPart = pathParts[pathParts.length - 1];
          if (!(lastPart in current)) {
            errors.push(`Path not found: ${op.path}`);
          } else {
            current[lastPart] = op.value;
          }
          break;
        }
        
        case 'add': {
          if (pathParts.length === 0) {
            errors.push('Cannot add to root');
            continue;
          }
          
          let current = workingResource;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!(part in current)) {
              current[part] = {};
            }
            current = current[part];
          }
          
          const lastPart = pathParts[pathParts.length - 1];
          current[lastPart] = op.value;
          break;
        }
        
        case 'remove': {
          if (pathParts.length === 0) {
            errors.push('Cannot remove root');
            continue;
          }
          
          let current = workingResource;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!(part in current)) {
              errors.push(`Path not found: ${op.path}`);
              break;
            }
            current = current[part];
          }
          
          const lastPart = pathParts[pathParts.length - 1];
          if (!(lastPart in current)) {
            errors.push(`Path not found: ${op.path}`);
          } else {
            delete current[lastPart];
          }
          break;
        }
        
        default:
          errors.push(`Unsupported operation: ${op.op}`);
      }
    } catch (error) {
      errors.push(`Failed to apply operation ${op.op} at ${op.path}: ${error}`);
    }
  }
  
  return { resource: workingResource, errors };
}

/**
 * POST /api/fhir/resources/batch-edit
 * Apply JSON Patch operations to multiple resources
 * 
 * Body:
 * {
 *   resourceType: string,
 *   filter: { ids?: string[], searchParams?: Record<string, string> },
 *   operations: Array<{ op: 'add'|'remove'|'replace', path: string, value?: any }>,
 *   maxBatchSize?: number (default: 100, max: 5000)
 * }
 * 
 * Returns:
 * {
 *   success: true,
 *   matched: number,
 *   modified: number,
 *   failed: number,
 *   results: Array<{ id, success, error?, beforeHash, afterHash, changed }>
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = BatchEditRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }
    
    const { resourceType, filter, operations, maxBatchSize } = validation.data;
    
    // Get active server ID
    const serverId = 1; // TODO: Implement getActiveServerId()
    
    // Get FHIR client
    const fhirClient = (req as any).fhirClient;
    
    if (!fhirClient) {
      return res.status(503).json({
        success: false,
        error: 'FHIR client not available',
      });
    }
    
    // Fetch resources to edit
    let resourcesToEdit: any[] = [];
    
    if (filter?.ids && filter.ids.length > 0) {
      // Fetch by IDs
      for (const id of filter.ids.slice(0, maxBatchSize)) {
        try {
          const resource = await fhirClient.read(resourceType, id);
          resourcesToEdit.push(resource);
        } catch (error: any) {
          console.warn(`Failed to fetch ${resourceType}/${id}:`, error.message);
        }
      }
    } else if (filter?.searchParams) {
      // Fetch by search parameters
      try {
        const searchResult = await fhirClient.search(resourceType, filter.searchParams);
        const entries = searchResult.entry || [];
        resourcesToEdit = entries
          .map((e: any) => e.resource)
          .filter((r: any) => r && r.resourceType === resourceType)
          .slice(0, maxBatchSize);
      } catch (error: any) {
        return res.status(500).json({
          success: false,
          error: 'Failed to search for resources',
          message: error.message || 'Unknown error',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'No filter provided',
        message: 'Either ids or searchParams must be specified',
      });
    }
    
    const matched = resourcesToEdit.length;
    
    if (matched === 0) {
      return res.json({
        success: true,
        matched: 0,
        modified: 0,
        failed: 0,
        results: [],
        message: 'No resources matched the filter',
      });
    }
    
    // Apply operations to each resource (atomic per resource)
    const results: any[] = [];
    let modified = 0;
    let failed = 0;
    
    for (const originalResource of resourcesToEdit) {
      const id = originalResource.id;
      const beforeHash = computeResourceHash(originalResource);
      
      try {
        // Apply patch operations
        const { resource: patchedResource, errors: patchErrors } = applyPatchOperations(
          originalResource,
          operations
        );
        
        if (patchErrors.length > 0) {
          results.push({
            id,
            success: false,
            error: 'Patch operation failed',
            details: patchErrors,
            beforeHash,
          });
          failed++;
          continue;
        }
        
        const afterHash = computeResourceHash(patchedResource);
        const changed = beforeHash !== afterHash;
        
        if (!changed) {
          // No changes, skip update
          results.push({
            id,
            success: true,
            changed: false,
            beforeHash,
            afterHash,
            message: 'No changes detected',
          });
          continue;
        }
        
        // Update resource on FHIR server
        try {
          const updatedResource = await fhirClient.update(resourceType, id, patchedResource);
          
          results.push({
            id,
            success: true,
            changed: true,
            beforeHash,
            afterHash,
            versionId: updatedResource.meta?.versionId,
          });
          
          modified++;
          
          // Enqueue revalidation (higher priority)
          validationQueue.enqueue({
            serverId,
            resourceType,
            fhirId: id,
            priority: 'high',
          });
        } catch (updateError: any) {
          results.push({
            id,
            success: false,
            error: 'Failed to update resource on FHIR server',
            message: updateError.message || 'Unknown error',
            beforeHash,
          });
          failed++;
        }
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: 'Processing error',
          message: error.message || 'Unknown error',
          beforeHash,
        });
        failed++;
      }
    }
    
    // TODO: Create audit records for all changes
    console.log(`Batch edit audit: matched=${matched}, modified=${modified}, failed=${failed}`);
    
    res.json({
      success: true,
      matched,
      modified,
      failed,
      results,
      queuedRevalidation: modified, // Count of resources queued for revalidation
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in batch edit:', error);
    res.status(500).json({
      success: false,
      error: 'Batch edit failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
