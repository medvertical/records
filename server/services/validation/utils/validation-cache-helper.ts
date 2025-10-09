/**
 * Validation Cache Helper
 * 
 * Extracted from ConsolidatedValidationService to handle cache operations
 * and resource hashing. Follows Single Responsibility Principle.
 * 
 * Responsibilities:
 * - Generate resource content hashes
 * - Check if resource needs revalidation
 * - Determine cache validity based on timestamps
 * - Compare resource hashes for changes
 * 
 * File size: Target <150 lines (utility service)
 */

import { createHash } from 'crypto';
import type {
  ValidationResult as StoredValidationResult,
} from '@shared/schema';

// ============================================================================
// Validation Cache Helper
// ============================================================================

export class ValidationCacheHelper {
  /**
   * Create SHA-256 hash of resource content
   * Used to detect if resource has changed since last validation
   */
  createResourceHash(resource: any): string {
    // Sort keys to ensure consistent hashing
    const content = JSON.stringify(resource, Object.keys(resource).sort());
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if resource should be revalidated based on hash and timestamps
   * 
   * @param resource - The FHIR resource to check
   * @param storedResults - Previously stored validation results
   * @param forceRevalidation - If true, always revalidate
   * @returns true if resource needs revalidation
   */
  shouldRevalidateResource(
    resource: any,
    storedResults: StoredValidationResult[],
    forceRevalidation: boolean = false
  ): boolean {
    // Always revalidate if forced
    if (forceRevalidation) {
      return true;
    }

    // No stored results = needs validation
    if (!storedResults || storedResults.length === 0) {
      return true;
    }

    // Get most recent validation result
    const latestResult = this.getLatestResult(storedResults);
    if (!latestResult) {
      return true;
    }

    // Check if resource hash has changed
    const currentHash = this.createResourceHash(resource);
    const storedHash = latestResult.resourceHash;

    if (!storedHash || currentHash !== storedHash) {
      return true; // Resource content has changed
    }

    // Check resource meta.lastUpdated vs validation timestamp
    if (resource.meta?.lastUpdated) {
      const resourceUpdated = new Date(resource.meta.lastUpdated);
      const validatedAt = latestResult.validatedAt 
        ? new Date(latestResult.validatedAt) 
        : null;

      if (validatedAt && resourceUpdated > validatedAt) {
        return true; // Resource updated after last validation
      }
    }

    // Resource hasn't changed, no need to revalidate
    return false;
  }

  /**
   * Get the most recent validation result by validatedAt timestamp
   */
  getLatestResult(results: StoredValidationResult[]): StoredValidationResult | undefined {
    if (!results || results.length === 0) {
      return undefined;
    }

    return results.reduce((latest, current) => {
      const latestTime = latest.validatedAt ? new Date(latest.validatedAt).getTime() : 0;
      const currentTime = current.validatedAt ? new Date(current.validatedAt).getTime() : 0;
      return currentTime > latestTime ? current : latest;
    });
  }

  /**
   * Check if validation result is stale based on age
   * 
   * @param result - The validation result to check
   * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   * @returns true if result is stale
   */
  isResultStale(result: StoredValidationResult, maxAgeMs: number = 3600000): boolean {
    if (!result.validatedAt) {
      return true; // No timestamp = stale
    }

    const validatedTime = new Date(result.validatedAt).getTime();
    const now = Date.now();
    return (now - validatedTime) > maxAgeMs;
  }

  /**
   * Compare two resources to detect changes
   * 
   * @returns Object with change detection details
   */
  compareResources(
    oldResource: any,
    newResource: any
  ): {
    hasChanged: boolean;
    oldHash: string;
    newHash: string;
    changedFields?: string[];
  } {
    const oldHash = this.createResourceHash(oldResource);
    const newHash = this.createResourceHash(newResource);
    const hasChanged = oldHash !== newHash;

    const result: any = {
      hasChanged,
      oldHash,
      newHash,
    };

    // If changed, identify which fields changed (optional, can be expensive)
    if (hasChanged) {
      result.changedFields = this.detectChangedFields(oldResource, newResource);
    }

    return result;
  }

  /**
   * Detect which top-level fields have changed between resources
   * (Shallow comparison only for performance)
   */
  private detectChangedFields(oldResource: any, newResource: any): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([
      ...Object.keys(oldResource || {}),
      ...Object.keys(newResource || {}),
    ]);

    for (const key of allKeys) {
      const oldValue = JSON.stringify(oldResource[key]);
      const newValue = JSON.stringify(newResource[key]);
      
      if (oldValue !== newValue) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  /**
   * Generate cache key for a resource
   */
  generateCacheKey(resourceType: string, resourceId: string | null): string {
    return `validation:${resourceType}:${resourceId || 'unknown'}`;
  }

  /**
   * Check if resource has validation metadata
   */
  hasValidationMetadata(resource: any): boolean {
    return !!(
      resource?.meta?.lastUpdated ||
      resource?.meta?.versionId
    );
  }
}

// Singleton instance
let cacheHelperInstance: ValidationCacheHelper | null = null;

/**
 * Get singleton instance of ValidationCacheHelper
 */
export function getValidationCacheHelper(): ValidationCacheHelper {
  if (!cacheHelperInstance) {
    cacheHelperInstance = new ValidationCacheHelper();
  }
  return cacheHelperInstance;
}

