/**
 * Validation Cache Override Service
 * 
 * This service provides comprehensive cache override capabilities for validation results.
 * It allows users to force revalidation of resources, clear validation caches,
 * and manage cache invalidation strategies.
 */

import { EventEmitter } from 'events';
import { storage } from '../../../storage';
import { getValidationSettingsService } from '../settings';
import type { ValidationSettings } from '@shared/validation-settings-simplified';

export interface CacheOverrideRequest {
  /** Resource IDs to revalidate */
  resourceIds?: string[];
  /** Resource types to revalidate */
  resourceTypes?: string[];
  /** Whether to revalidate all resources */
  revalidateAll?: boolean;
  /** Reason for cache override */
  reason?: string;
  /** Whether to clear existing validation results before revalidation */
  clearExisting?: boolean;
  /** Whether to force revalidation even if resource hasn't changed */
  forceRevalidation?: boolean;
  /** Request context */
  context?: {
    requestedBy?: string;
    requestId?: string;
    metadata?: Record<string, any>;
  };
}

export interface CacheOverrideResult {
  /** Request ID for tracking */
  requestId: string;
  /** Number of resources affected */
  affectedResources: number;
  /** Number of resources successfully revalidated */
  revalidatedResources: number;
  /** Number of resources that failed revalidation */
  failedResources: number;
  /** Number of cached results cleared */
  clearedResults: number;
  /** Start time of the operation */
  startTime: Date;
  /** End time of the operation */
  endTime: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Status of the operation */
  status: 'completed' | 'partial' | 'failed';
  /** Error messages if any */
  errors: string[];
  /** Warning messages if any */
  warnings: string[];
}

export interface CacheOverrideHistory {
  /** Request ID */
  requestId: string;
  /** Timestamp of the request */
  timestamp: Date;
  /** Request details */
  request: CacheOverrideRequest;
  /** Result details */
  result: CacheOverrideResult;
  /** Whether the request is still in progress */
  inProgress: boolean;
}

export interface CacheStatistics {
  /** Total number of cached validation results */
  totalCachedResults: number;
  /** Number of cached results by resource type */
  cachedByResourceType: { [resourceType: string]: number };
  /** Number of cached results by validation date */
  cachedByDate: { [date: string]: number };
  /** Average cache age in days */
  averageCacheAge: number;
  /** Oldest cached result date */
  oldestCacheDate: Date | null;
  /** Newest cached result date */
  newestCacheDate: Date | null;
  /** Cache hit rate percentage */
  cacheHitRate: number;
}

class ValidationCacheOverrideService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private overrideHistory: CacheOverrideHistory[] = [];
  private activeRequests: Map<string, Promise<CacheOverrideResult>> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  /**
   * Override cache for specific resources or resource types
   */
  async overrideCache(request: CacheOverrideRequest): Promise<CacheOverrideResult> {
    const requestId = request.context?.requestId || `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if there's already an active request with the same ID
    if (this.activeRequests.has(requestId)) {
      throw new Error(`Cache override request ${requestId} is already in progress`);
    }

    const startTime = new Date();
    const result: CacheOverrideResult = {
      requestId,
      affectedResources: 0,
      revalidatedResources: 0,
      failedResources: 0,
      clearedResults: 0,
      startTime,
      endTime: startTime,
      durationMs: 0,
      status: 'completed',
      errors: [],
      warnings: []
    };

    // Add to active requests
    const overridePromise = this.executeCacheOverride(request, result);
    this.activeRequests.set(requestId, overridePromise);

    try {
      const finalResult = await overridePromise;
      
      // Add to history
      this.overrideHistory.push({
        requestId,
        timestamp: startTime,
        request,
        result: finalResult,
        inProgress: false
      });

      // Emit event
      this.emit('cacheOverrideCompleted', finalResult);
      
      return finalResult;
    } catch (error) {
      result.status = 'failed';
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - result.startTime.getTime();
      
      // Add to history even if failed
      this.overrideHistory.push({
        requestId,
        timestamp: startTime,
        request,
        result,
        inProgress: false
      });

      this.emit('cacheOverrideFailed', result);
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  private async executeCacheOverride(
    request: CacheOverrideRequest,
    result: CacheOverrideResult
  ): Promise<CacheOverrideResult> {
    try {
      // Get resources to revalidate
      const resourcesToRevalidate = await this.getResourcesToRevalidate(request);
      result.affectedResources = resourcesToRevalidate.length;

      if (resourcesToRevalidate.length === 0) {
        result.warnings.push('No resources found matching the criteria');
        result.endTime = new Date();
        result.durationMs = result.endTime.getTime() - result.startTime.getTime();
        return result;
      }

      // Clear existing validation results if requested
      if (request.clearExisting) {
        const clearedCount = await this.clearValidationResults(resourcesToRevalidate);
        result.clearedResults = clearedCount;
      }

      // Revalidate resources
      const revalidationResults = await this.revalidateResources(
        resourcesToRevalidate,
        request.forceRevalidation || false
      );

      result.revalidatedResources = revalidationResults.successful;
      result.failedResources = revalidationResults.failed;
      result.errors.push(...revalidationResults.errors);
      result.warnings.push(...revalidationResults.warnings);

      // Determine final status
      if (result.failedResources === 0) {
        result.status = 'completed';
      } else if (result.revalidatedResources > 0) {
        result.status = 'partial';
      } else {
        result.status = 'failed';
      }

      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - result.startTime.getTime();

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.status = 'failed';
      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - result.startTime.getTime();
      return result;
    }
  }

  private async getResourcesToRevalidate(request: CacheOverrideRequest): Promise<any[]> {
    if (request.revalidateAll) {
      // Get all resources (we'll filter for those with validation results later)
      return await storage.getFhirResources();
    }

    if (request.resourceIds && request.resourceIds.length > 0) {
      // Get specific resources by ID
      const resources = [];
      for (const resourceId of request.resourceIds) {
        const resource = await storage.getFhirResourceByTypeAndId('*', resourceId);
        if (resource) {
          resources.push(resource);
        }
      }
      return resources;
    }

    if (request.resourceTypes && request.resourceTypes.length > 0) {
      // Get resources by type
      const resources = [];
      for (const resourceType of request.resourceTypes) {
        const typeResources = await storage.getFhirResourcesByType(resourceType);
        resources.push(...typeResources);
      }
      return resources;
    }

    return [];
  }

  private async clearValidationResults(resources: any[]): Promise<number> {
    let clearedCount = 0;
    
    for (const resource of resources) {
      if (resource.id) {
        try {
          await storage.clearValidationResultsForResource(resource.id);
          clearedCount++;
        } catch (error) {
          console.error(`Failed to clear validation results for resource ${resource.id}:`, error);
        }
      }
    }
    
    return clearedCount;
  }

  private async revalidateResources(
    resources: any[],
    forceRevalidation: boolean
  ): Promise<{
    successful: number;
    failed: number;
    errors: string[];
    warnings: string[];
  }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Import the consolidated validation service
    const { ConsolidatedValidationService } = await import('../core/consolidated-validation-service');
    const validationService = new ConsolidatedValidationService();

    for (const resource of resources) {
      try {
        await validationService.validateResource(resource, false, forceRevalidation);
        successful++;
      } catch (error) {
        failed++;
        errors.push(`Failed to revalidate resource ${resource.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { successful, failed, errors, warnings };
  }

  /**
   * Get cache override history
   */
  getOverrideHistory(limit: number = 50): CacheOverrideHistory[] {
    return this.overrideHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active cache override requests
   */
  getActiveRequests(): string[] {
    return Array.from(this.activeRequests.keys());
  }

  /**
   * Cancel an active cache override request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    if (this.activeRequests.has(requestId)) {
      // Note: In a real implementation, you'd need to implement proper cancellation
      // For now, we'll just remove it from the active requests
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(): Promise<CacheStatistics> {
    try {
      const allResources = await storage.getFhirResources();
      // Get validation results for each resource using dual-mode lookup
      const validationResults = [];
      for (const resource of allResources) {
        const results = await storage.getValidationResultsDualMode(
          resource.serverId,
          resource.resourceType,
          resource.resourceId,
          resource.id
        );
        validationResults.push(...results);
      }
      
      const cachedByResourceType: { [resourceType: string]: number } = {};
      const cachedByDate: { [date: string]: number } = {};
      let totalAge = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      for (const result of validationResults) {
        // Count by resource type
        const resourceType = allResources.find(r => r.id === result.resourceId)?.resourceType || 'Unknown';
        cachedByResourceType[resourceType] = (cachedByResourceType[resourceType] || 0) + 1;

        // Count by date
        const date = new Date(result.validatedAt).toISOString().split('T')[0];
        cachedByDate[date] = (cachedByDate[date] || 0) + 1;

        // Calculate age
        const age = Date.now() - new Date(result.validatedAt).getTime();
        totalAge += age;

        // Track oldest and newest
        const resultDate = new Date(result.validatedAt);
        if (!oldestDate || resultDate < oldestDate) {
          oldestDate = resultDate;
        }
        if (!newestDate || resultDate > newestDate) {
          newestDate = resultDate;
        }
      }

      const averageCacheAge = validationResults.length > 0 ? totalAge / validationResults.length / (1000 * 60 * 60 * 24) : 0;

      return {
        totalCachedResults: validationResults.length,
        cachedByResourceType,
        cachedByDate,
        averageCacheAge: Math.round(averageCacheAge * 100) / 100,
        oldestCacheDate: oldestDate,
        newestCacheDate: newestDate,
        cacheHitRate: 0 // Would need to track cache hits/misses to calculate this
      };
    } catch (error) {
      console.error('Failed to get cache statistics:', error);
      throw error;
    }
  }

  /**
   * Clear all validation caches
   */
  async clearAllCaches(): Promise<CacheOverrideResult> {
    return await this.overrideCache({
      revalidateAll: true,
      clearExisting: true,
      forceRevalidation: true,
      reason: 'Clear all validation caches',
      context: {
        requestedBy: 'system',
        requestId: `clear_all_${Date.now()}`
      }
    });
  }

  /**
   * Clear cache for specific resource types
   */
  async clearCacheForResourceTypes(resourceTypes: string[]): Promise<CacheOverrideResult> {
    return await this.overrideCache({
      resourceTypes,
      clearExisting: true,
      forceRevalidation: true,
      reason: `Clear cache for resource types: ${resourceTypes.join(', ')}`,
      context: {
        requestedBy: 'system',
        requestId: `clear_types_${Date.now()}`
      }
    });
  }
}

let cacheOverrideServiceInstance: ValidationCacheOverrideService;

export function getValidationCacheOverrideService(): ValidationCacheOverrideService {
  if (!cacheOverrideServiceInstance) {
    cacheOverrideServiceInstance = new ValidationCacheOverrideService();
  }
  return cacheOverrideServiceInstance;
}

export function resetValidationCacheOverrideService(): void {
  if (cacheOverrideServiceInstance) {
    cacheOverrideServiceInstance.removeAllListeners();
    cacheOverrideServiceInstance = null as any;
  }
}
