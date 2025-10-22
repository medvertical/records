import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of resource content for audit trail
 * Normalizes the resource by sorting keys before hashing for consistency
 */
export function computeResourceHash(resource: any): string {
  const normalized = JSON.stringify(resource, Object.keys(resource).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

