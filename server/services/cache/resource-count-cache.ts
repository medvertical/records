import type { FhirClient } from '../fhir/fhir-client';

export interface CachedResourceCounts {
  counts: Record<string, number>;
  totalResources: number;
  totalTypes: number;
  lastUpdated: Date;
  isStale: boolean;
}

export class ResourceCountCache {
  private cache: Map<number, CachedResourceCounts> = new Map();
  private refreshInProgress: Map<number, Promise<void>> = new Map();
  private readonly STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached resource counts for a server
   */
  async get(serverId: number): Promise<CachedResourceCounts | null> {
    const cached = this.cache.get(serverId);
    if (!cached) {
      return null;
    }

    // Update isStale flag based on current time
    const age = Date.now() - cached.lastUpdated.getTime();
    cached.isStale = age > this.STALE_THRESHOLD_MS;

    return cached;
  }

  /**
   * Set cached resource counts for a server
   */
  async set(serverId: number, data: Omit<CachedResourceCounts, 'isStale' | 'lastUpdated'>): Promise<void> {
    this.cache.set(serverId, {
      ...data,
      lastUpdated: new Date(),
      isStale: false,
    });
  }

  /**
   * Check if cache is stale for a server
   */
  isStale(serverId: number): boolean {
    const cached = this.cache.get(serverId);
    if (!cached) {
      return true;
    }

    const age = Date.now() - cached.lastUpdated.getTime();
    return age > this.STALE_THRESHOLD_MS;
  }

  /**
   * Refresh cache in background for a server
   * Prevents duplicate concurrent refreshes
   */
  async refresh(serverId: number, fhirClient: FhirClient, resourceTypes?: string[]): Promise<void> {
    // Check if refresh is already in progress
    const existing = this.refreshInProgress.get(serverId);
    if (existing) {
      console.log(`[ResourceCountCache] Refresh already in progress for server ${serverId}, waiting...`);
      return existing;
    }

    // Start refresh
    const refreshPromise = this._doRefresh(serverId, fhirClient, resourceTypes);
    this.refreshInProgress.set(serverId, refreshPromise);

    try {
      await refreshPromise;
    } finally {
      this.refreshInProgress.delete(serverId);
    }
  }

  /**
   * Internal refresh implementation
   */
  private async _doRefresh(serverId: number, fhirClient: FhirClient, resourceTypes?: string[]): Promise<void> {
    const startTime = Date.now();
    console.log(`[ResourceCountCache] 🔄 Starting background refresh for server ${serverId}...`);

    try {
      // Fetch counts sequentially to avoid overloading the FHIR server
      const counts = await fhirClient.getResourceCountsSequential(resourceTypes, 5000);
      
      const totalResources = Object.values(counts).reduce((sum, count) => sum + count, 0);
      const totalTypes = Object.keys(counts).length;

      await this.set(serverId, {
        counts,
        totalResources,
        totalTypes,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[ResourceCountCache] ✅ Refresh complete for server ${serverId} in ${duration}s (${totalTypes} types, ${totalResources} resources)`);
    } catch (error) {
      console.error(`[ResourceCountCache] ❌ Refresh failed for server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific server
   */
  clear(serverId: number): void {
    this.cache.delete(serverId);
    console.log(`[ResourceCountCache] Cleared cache for server ${serverId}`);
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.cache.clear();
    console.log(`[ResourceCountCache] Cleared all caches`);
  }
}

// Singleton instance
export const resourceCountCache = new ResourceCountCache();

