import type { FhirClient } from '../fhir/fhir-client';

export interface CachedResourceCounts {
  counts: Record<string, number>;
  totalResources: number;
  totalTypes: number;
  lastUpdated: Date;
  isStale: boolean;
  isPartial: boolean;  // True if only priority types are loaded
  loadedTypes: string[];  // Types that have been loaded
  pendingTypes: string[];  // Types still pending (for background fetch)
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
   * Set partial cache (priority types only)
   */
  async setPartial(serverId: number, counts: Record<string, number>, loadedTypes: string[], pendingTypes: string[]): Promise<void> {
    const totalResources = Object.values(counts).reduce((sum, count) => sum + count, 0);
    this.cache.set(serverId, {
      counts,
      totalResources,
      totalTypes: Object.keys(counts).length,
      lastUpdated: new Date(),
      isStale: false,
      isPartial: true,
      loadedTypes,
      pendingTypes,
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
   * Refresh cache with priority-based fetching
   * Phase 1: Fetch priority types (from settings) - fast, blocks startup
   * Phase 2: Fetch remaining types - background, doesn't block
   */
  async refresh(serverId: number, fhirClient: FhirClient, priorityTypes?: string[]): Promise<void> {
    // Check if refresh is already in progress
    const existing = this.refreshInProgress.get(serverId);
    if (existing) {
      console.log(`[ResourceCountCache] Refresh already in progress for server ${serverId}, waiting...`);
      return existing;
    }

    // Start refresh
    const refreshPromise = this._doRefreshWithPriority(serverId, fhirClient, priorityTypes);
    this.refreshInProgress.set(serverId, refreshPromise);

    try {
      await refreshPromise;
    } finally {
      this.refreshInProgress.delete(serverId);
    }
  }

  /**
   * Priority-based refresh implementation
   */
  private async _doRefreshWithPriority(serverId: number, fhirClient: FhirClient, priorityTypes?: string[]): Promise<void> {
    const startTime = Date.now();
    console.log(`[ResourceCountCache] 🔄 Starting priority-based refresh for server ${serverId}...`);

    try {
      // Get all available resource types from server
      const allTypes = await fhirClient.getAllResourceTypes();
      
      // Determine priority types (use provided or get from validation settings)
      let typesToFetchFirst: string[] = [];
      if (priorityTypes && priorityTypes.length > 0) {
        typesToFetchFirst = priorityTypes.filter(t => allTypes.includes(t));
        console.log(`[ResourceCountCache] Using ${typesToFetchFirst.length} provided priority types`);
      } else {
        // Get priority types from validation settings
        typesToFetchFirst = await this._getPriorityTypesFromSettings();
        typesToFetchFirst = typesToFetchFirst.filter(t => allTypes.includes(t));
        console.log(`[ResourceCountCache] Using ${typesToFetchFirst.length} priority types from settings`);
      }
      
      // Fallback to common types if no priority types available
      if (typesToFetchFirst.length === 0) {
        typesToFetchFirst = ['Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 'Organization']
          .filter(t => allTypes.includes(t));
        console.log(`[ResourceCountCache] Using ${typesToFetchFirst.length} default priority types`);
      }
      
      // Phase 1: Fetch priority types in parallel (fast)
      console.log(`[ResourceCountCache] Phase 1: Fetching ${typesToFetchFirst.length} priority types...`);
      const priorityPromises = typesToFetchFirst.map(type => 
        fhirClient.getResourceCount(type).catch(err => {
          console.warn(`[ResourceCountCache] Failed to get count for priority type ${type}:`, err);
          return 0;
        })
      );
      
      const priorityCounts = await Promise.all(priorityPromises);
      const priorityCountsMap: Record<string, number> = {};
      typesToFetchFirst.forEach((type, idx) => {
        if (priorityCounts[idx] > 0) {
          priorityCountsMap[type] = priorityCounts[idx];
        }
      });
      
      // Determine remaining types for background fetch
      const remainingTypes = allTypes.filter(t => !typesToFetchFirst.includes(t));
      
      // Set partial cache immediately
      await this.setPartial(serverId, priorityCountsMap, typesToFetchFirst, remainingTypes);
      
      const phase1Duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[ResourceCountCache] ✅ Phase 1 complete in ${phase1Duration}s (${typesToFetchFirst.length} types, ${Object.values(priorityCountsMap).reduce((a, b) => a + b, 0)} resources)`);
      
      // Phase 2: Fetch remaining types in background (don't await)
      if (remainingTypes.length > 0) {
        console.log(`[ResourceCountCache] Phase 2: Fetching ${remainingTypes.length} remaining types in background...`);
        this._fetchRemainingTypes(serverId, fhirClient, priorityCountsMap, remainingTypes).catch(err => {
          console.error(`[ResourceCountCache] Phase 2 background fetch failed:`, err);
        });
      }
      
    } catch (error) {
      console.error(`[ResourceCountCache] ❌ Refresh failed for server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch remaining types in background and update cache
   */
  private async _fetchRemainingTypes(
    serverId: number,
    fhirClient: FhirClient,
    existingCounts: Record<string, number>,
    remainingTypes: string[]
  ): Promise<void> {
    const startTime = Date.now();
    const batchSize = 10;
    const allCounts = { ...existingCounts };
    
    for (let i = 0; i < remainingTypes.length; i += batchSize) {
      const batch = remainingTypes.slice(i, i + batchSize);
      
      const batchPromises = batch.map(type =>
        fhirClient.getResourceCount(type).catch(err => {
          console.warn(`[ResourceCountCache] Failed to get count for ${type}:`, err);
          return 0;
        })
      );
      
      const batchCounts = await Promise.all(batchPromises);
      batch.forEach((type, idx) => {
        if (batchCounts[idx] > 0) {
          allCounts[type] = batchCounts[idx];
        }
      });
      
      // Small delay between batches
      if (i + batchSize < remainingTypes.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Update cache with complete data
    const totalResources = Object.values(allCounts).reduce((sum, count) => sum + count, 0);
    await this.set(serverId, {
      counts: allCounts,
      totalResources,
      totalTypes: Object.keys(allCounts).length,
      isPartial: false,
      loadedTypes: Object.keys(allCounts),
      pendingTypes: [],
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ResourceCountCache] ✅ Phase 2 complete in ${duration}s (${Object.keys(allCounts).length} types total, ${totalResources} resources)`);
  }

  /**
   * Get priority resource types from validation settings
   */
  private async _getPriorityTypesFromSettings(): Promise<string[]> {
    try {
      const { ValidationSettingsService } = await import('../validation/settings/validation-settings-service');
      const settingsService = new ValidationSettingsService();
      await settingsService.initialize();
      const settings = await settingsService.getCurrentSettings();
      
      // If resource type filtering is enabled, return those types
      if (settings?.resourceTypes?.enabled === true) {
        const includedTypes = settings.resourceTypes.includedTypes || [];
        if (includedTypes.length > 0) {
          return includedTypes;
        }
      }
    } catch (error) {
      console.warn('[ResourceCountCache] Failed to get priority types from settings:', error);
    }
    
    return [];
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

