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
   * Delete cache for a server (force refresh)
   */
  async delete(serverId: number): Promise<void> {
    console.log(`[ResourceCountCache] 🗑️  Deleting cache for server ${serverId}`);
    this.cache.delete(serverId);
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
   * Check if a refresh is currently in progress for a server
   */
  async isRefreshInProgress(serverId: number): Promise<boolean> {
    return this.refreshInProgress.has(serverId);
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
    console.log(`[ResourceCountCache] Received priorityTypes:`, priorityTypes);

    try {
      // Get all available resource types from server
      const allTypes = await fhirClient.getAllResourceTypes();
      
      // Determine priority types (merge provided with settings)
      let typesToFetchFirst: string[] = [];
      const settingsPriorityTypes = await this._getPriorityTypesFromSettings();
      
      if (priorityTypes && priorityTypes.length > 0) {
        // Put requested types FIRST, then add settings types (avoid duplicates)
        // This ensures Quick Access items load before validation settings types
        const requestedSet = new Set(priorityTypes);
        const additionalFromSettings = settingsPriorityTypes.filter(t => !requestedSet.has(t));
        typesToFetchFirst = [...priorityTypes, ...additionalFromSettings].filter(t => allTypes.includes(t));
        console.log(`[ResourceCountCache] Using ${typesToFetchFirst.length} merged priority types (${priorityTypes.length} requested FIRST, then ${additionalFromSettings.length} from settings)`);
        console.log(`[ResourceCountCache] First 10 types to fetch:`, typesToFetchFirst.slice(0, 10));
      } else {
        typesToFetchFirst = settingsPriorityTypes.filter(t => allTypes.includes(t));
        console.log(`[ResourceCountCache] Using ${typesToFetchFirst.length} priority types from settings`);
      }
      
      // Fallback to common types if no priority types available
      if (typesToFetchFirst.length === 0) {
        typesToFetchFirst = ['Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 'Organization']
          .filter(t => allTypes.includes(t));
        console.log(`[ResourceCountCache] Using ${typesToFetchFirst.length} default priority types`);
      }
      
      // Phase 1: Fetch priority types SEQUENTIALLY to avoid rate limiting (especially on HAPI)
      console.log(`[ResourceCountCache] Phase 1: Fetching ${typesToFetchFirst.length} priority types sequentially...`);
      const priorityCountsMap: Record<string, number> = {};
      
      for (let i = 0; i < typesToFetchFirst.length; i++) {
        const type = typesToFetchFirst[i];
        
        try {
          const count = await fhirClient.getResourceCount(type);
          if (count !== null) {
            priorityCountsMap[type] = count;
            console.log(`[ResourceCountCache] ✅ ${type}: ${count} (${i + 1}/${typesToFetchFirst.length})`);
            
            // Update cache incrementally after EACH successful fetch
            // This allows polling requests to get partial results immediately
            const loadedSoFar = Object.keys(priorityCountsMap);
            const remainingSoFar = typesToFetchFirst.slice(i + 1).concat(
              allTypes.filter(t => !typesToFetchFirst.includes(t) && !priorityCountsMap.hasOwnProperty(t))
            );
            await this.setPartial(serverId, priorityCountsMap, loadedSoFar, remainingSoFar);
          } else {
            console.warn(`[ResourceCountCache] ⚠️  ${type}: fetch returned null (${i + 1}/${typesToFetchFirst.length})`);
          }
        } catch (err: any) {
          console.warn(`[ResourceCountCache] ❌ ${type}: fetch failed (${i + 1}/${typesToFetchFirst.length}):`, err.message || err);
        }
        
        // Delay between requests to avoid rate limiting
        // Longer delay for servers with aggressive rate limits
        if (i < typesToFetchFirst.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between each request
        }
      }
      
      // Determine which priority types were successfully loaded
      const loadedTypes = Object.keys(priorityCountsMap);
      
      // Determine which priority types failed to load (need to retry in phase 2)
      const failedPriorityTypes = typesToFetchFirst.filter(t => !priorityCountsMap.hasOwnProperty(t));
      
      // Determine remaining types for background fetch (including failed priority types)
      const remainingTypes = allTypes.filter(t => !priorityCountsMap.hasOwnProperty(t));
      
      console.log(`[ResourceCountCache] ✅ Phase 1: ${loadedTypes.length} loaded, ${failedPriorityTypes.length} failed (will retry)`);
      
      // Set partial cache immediately
      await this.setPartial(serverId, priorityCountsMap, loadedTypes, remainingTypes);
      
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
    const allCounts = { ...existingCounts };
    
    console.log(`[ResourceCountCache] Phase 2: Fetching ${remainingTypes.length} remaining types sequentially...`);
    
    for (let i = 0; i < remainingTypes.length; i++) {
      const type = remainingTypes[i];
      
      try {
        const count = await fhirClient.getResourceCount(type);
        if (count !== null) {
          allCounts[type] = count;
          
          // Update cache incrementally after EACH successful fetch in Phase 2
          const remainingSoFar = remainingTypes.slice(i + 1);
          await this.setPartial(serverId, allCounts, Object.keys(allCounts), remainingSoFar);
        }
      } catch (err: any) {
        console.warn(`[ResourceCountCache] Phase 2: Failed to get count for ${type}:`, err.message || err);
      }
      
      // Longer delay between requests in Phase 2 to avoid rate limiting
      if (i < remainingTypes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
      }
    }
    
    // Determine which types still failed to load
    const allAttemptedTypes = [...Object.keys(existingCounts), ...remainingTypes];
    const stillPendingTypes = allAttemptedTypes.filter(t => !allCounts.hasOwnProperty(t));
    
    // Update cache (mark as partial if any types still failed)
    const totalResources = Object.values(allCounts).reduce((sum, count) => sum + count, 0);
    const isStillPartial = stillPendingTypes.length > 0;
    
    await this.set(serverId, {
      counts: allCounts,
      totalResources,
      totalTypes: Object.keys(allCounts).length,
      isPartial: isStillPartial,
      loadedTypes: Object.keys(allCounts),
      pendingTypes: stillPendingTypes,
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successCount = Object.keys(allCounts).length - Object.keys(existingCounts).length;
    console.log(`[ResourceCountCache] ✅ Phase 2 complete in ${duration}s (${successCount} new types loaded, ${Object.keys(allCounts).length} total, ${totalResources} resources)`);
    
    if (isStillPartial) {
      console.log(`[ResourceCountCache] ⚠️ ${stillPendingTypes.length} types still pending (failed due to rate limiting): ${stillPendingTypes.slice(0, 5).join(', ')}${stillPendingTypes.length > 5 ? '...' : ''}`);
    }
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

