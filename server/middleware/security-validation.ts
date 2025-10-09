import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';

/**
 * Security & Validation Middleware
 * 
 * Provides:
 * - Input validation for FHIR resources
 * - Request size limits
 * - Type validation
 * - Rate limiting guards
 * - Reference scope enforcement
 */

// ============================================================================
// Constants
// ============================================================================

const MAX_RESOURCE_SIZE = 1024 * 1024; // 1MB per resource
const MAX_BATCH_SIZE = 100; // Max resources in batch operations
const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024; // 10MB total request

// ============================================================================
// FHIR Resource Validation
// ============================================================================

/**
 * Basic FHIR resource schema
 */
const fhirResourceSchema = z.object({
  resourceType: z.string().min(1),
  id: z.string().optional(),
  meta: z.object({
    versionId: z.string().optional(),
    lastUpdated: z.string().optional(),
  }).optional(),
}).passthrough(); // Allow additional FHIR fields

/**
 * Validate FHIR resource payload
 */
export function validateFhirResource(req: Request, res: Response, next: NextFunction) {
  try {
    // Check content type
    if (!req.is('application/json') && !req.is('application/fhir+json')) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json or application/fhir+json',
      });
    }

    // Check body size
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > MAX_RESOURCE_SIZE) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Resource size (${bodySize} bytes) exceeds maximum allowed size (${MAX_RESOURCE_SIZE} bytes)`,
        maxSize: MAX_RESOURCE_SIZE,
      });
    }

    // Validate FHIR structure
    const result = fhirResourceSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: 'Validation Failed',
        message: 'Invalid FHIR resource structure',
        details: result.error.errors,
      });
    }

    // Validate resourceType matches URL parameter if present
    if (req.params.resourceType && req.body.resourceType !== req.params.resourceType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Resource type mismatch: URL specifies '${req.params.resourceType}' but resource contains '${req.body.resourceType}'`,
      });
    }

    next();
  } catch (error) {
    logger.error('[Security] FHIR validation error:', error);
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Failed to parse request body',
    });
  }
}

// ============================================================================
// Batch Operation Validation
// ============================================================================

/**
 * Validate batch edit operations
 */
export function validateBatchOperations(req: Request, res: Response, next: NextFunction) {
  try {
    const { operations } = req.body;

    // Check operations array exists
    if (!Array.isArray(operations)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must contain an "operations" array',
      });
    }

    // Check batch size
    if (operations.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Operations array cannot be empty',
      });
    }

    if (operations.length > MAX_BATCH_SIZE) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Batch size (${operations.length}) exceeds maximum allowed (${MAX_BATCH_SIZE})`,
        maxBatchSize: MAX_BATCH_SIZE,
      });
    }

    // Check total request size
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > MAX_REQUEST_BODY_SIZE) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request size (${bodySize} bytes) exceeds maximum allowed (${MAX_REQUEST_BODY_SIZE} bytes)`,
        maxSize: MAX_REQUEST_BODY_SIZE,
      });
    }

    // Validate each operation structure
    const operationSchema = z.object({
      resourceType: z.string(),
      resourceId: z.string(),
      operations: z.array(z.object({
        op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
        path: z.string(),
        value: z.any().optional(),
      })),
    });

    for (let i = 0; i < operations.length; i++) {
      const result = operationSchema.safeParse(operations[i]);
      if (!result.success) {
        return res.status(422).json({
          error: 'Validation Failed',
          message: `Invalid operation at index ${i}`,
          details: result.error.errors,
        });
      }
    }

    next();
  } catch (error) {
    logger.error('[Security] Batch validation error:', error);
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Failed to validate batch operations',
    });
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter
 * Production should use Redis or similar
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, maxRequests, keyGenerator = (req) => req.ip || 'unknown' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [k, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
          rateLimitStore.delete(k);
        }
      }
    }

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    // Increment counter
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    next();
  };
}

// Preconfigured rate limiters
export const heavyEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
});

export const editEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 edits per minute
});

export const batchEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 batch operations per minute
});

// ============================================================================
// Reference Scope Validation
// ============================================================================

/**
 * Validate that resource references are within the same server scope
 */
export function validateReferenceScope(serverId: number, allowCrossServer: boolean = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (allowCrossServer) {
      return next(); // Skip validation if cross-server references are allowed
    }

    try {
      const resource = req.body;

      // Extract all references from the resource
      const references = extractReferences(resource);

      // Validate each reference is within the same server
      for (const reference of references) {
        // TODO: Implement server scope validation
        // This would check if the referenced resource belongs to the same server
        // For MVP, we'll just log a warning
        if (reference.includes('/')) {
          logger.warn(`[Security] Cross-server reference detected: ${reference} (not enforced yet)`);
        }
      }

      next();
    } catch (error) {
      logger.error('[Security] Reference scope validation error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate reference scope',
      });
    }
  };
}

/**
 * Extract all reference values from a FHIR resource
 */
function extractReferences(obj: any, references: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') {
    return references;
  }

  if (obj.reference && typeof obj.reference === 'string') {
    references.push(obj.reference);
  }

  for (const key in obj) {
    if (Array.isArray(obj[key])) {
      obj[key].forEach((item: any) => extractReferences(item, references));
    } else if (typeof obj[key] === 'object') {
      extractReferences(obj[key], references);
    }
  }

  return references;
}

// ============================================================================
// Query Parameter Validation
// ============================================================================

/**
 * Validate pagination parameters
 */
export function validatePagination(req: Request, res: Response, next: NextFunction) {
  const { page, pageSize, limit, offset } = req.query;

  if (page !== undefined) {
    const pageNum = parseInt(page as string);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid page number. Must be a positive integer.',
      });
    }
  }

  if (pageSize !== undefined) {
    const pageSizeNum = parseInt(pageSize as string);
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 1000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid page size. Must be between 1 and 1000.',
      });
    }
  }

  if (limit !== undefined) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid limit. Must be between 1 and 1000.',
      });
    }
  }

  if (offset !== undefined) {
    const offsetNum = parseInt(offset as string);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid offset. Must be a non-negative integer.',
      });
    }
  }

  next();
}

// ============================================================================
// Exports
// ============================================================================

export const securityMiddleware = {
  validateFhirResource,
  validateBatchOperations,
  validateReferenceScope,
  validatePagination,
  heavyEndpointLimiter,
  editEndpointLimiter,
  batchEndpointLimiter,
};
