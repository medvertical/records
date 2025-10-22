/**
 * FHIR-Specific Caching Layer
 * 
 * Provides caching with appropriate TTLs for FHIR operations.
 * Supports per-server cache namespacing and stale-while-revalidate pattern.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  serverId: number;
}

interface CacheConfig {
  ttl: number;
  staleWhileRevalidate: boolean;
}

const DEFAULT_TTLS = {
  RESOURCE_COUNTS: 5 * 60 * 1000, // 5 minutes
  SEARCH_PARAMETERS: 30 * 60 * 1000, // 30 minutes
  RESOURCE_TYPES: 30 * 60 * 1000, // 30 minutes
  CAPABILITY_STATEMENT: 60 * 60 * 1000, // 1 hour
};

export class FhirCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private revalidationPromises: Map<string, Promise<any>> = new Map();

  /**
   * Generate a cache key with server namespace
   */
  private getCacheKey(serverId: number, key: string): string {
    return `server:${serverId}:${key}`;
  }

  /**
   * Get cached value if valid
   */
  get<T>(serverId: number, key: string, ttl: number = DEFAULT_TTLS.RESOURCE_COUNTS): T | null {
    const cacheKey = this.getCacheKey(serverId, key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;

    if (age > ttl) {
      // Expired
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Get cached value or execute function with stale-while-revalidate
   */
  async getOrFetch<T>(
    serverId: number,
    key: string,
    fetchFn: () => Promise<T>,
    config: Partial<CacheConfig> = {}
  ): Promise<T> {
    const ttl = config.ttl || DEFAULT_TTLS.RESOURCE_COUNTS;
    const staleWhileRevalidate = config.staleWhileRevalidate !== false;
    const cacheKey = this.getCacheKey(serverId, key);
    
    const cached = this.get<T>(serverId, key, ttl);
    
    if (cached) {
      const age = Date.now() - (this.cache.get(cacheKey)?.timestamp || 0);
      
      // If stale (more than 50% of TTL) and stale-while-revalidate is enabled, refresh in background
      if (staleWhileRevalidate && age > ttl * 0.5) {
        if (!this.revalidationPromises.has(cacheKey)) {
          console.log(`[FhirCache] Revalidating stale cache for: ${key}`);
          const revalidationPromise = fetchFn()
            .then(data => {
              this.set(serverId, key, data);
              this.revalidationPromises.delete(cacheKey);
              return data;
            })
            .catch(error => {
              console.error(`[FhirCache] Revalidation failed for ${key}:`, error);
              this.revalidationPromises.delete(cacheKey);
              return cached; // Keep using stale data on error
            });
          
          this.revalidationPromises.set(cacheKey, revalidationPromise);
        }
      }
      
      return cached;
    }

    // Not cached, fetch fresh data
    try {
      const data = await fetchFn();
      this.set(serverId, key, data);
      return data;
    } catch (error) {
      console.error(`[FhirCache] Failed to fetch ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set cached value
   */
  set<T>(serverId: number, key: string, data: T): void {
    const cacheKey = this.getCacheKey(serverId, key);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      serverId,
    });
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(serverId: number, key: string): void {
    const cacheKey = this.getCacheKey(serverId, key);
    this.cache.delete(cacheKey);
    this.revalidationPromises.delete(cacheKey);
  }

  /**
   * Invalidate all cache for a server
   */
  invalidateServer(serverId: number): void {
    const prefix = `server:${serverId}:`;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.revalidationPromises.delete(key);
    });

    console.log(`[FhirCache] Invalidated ${keysToDelete.length} cache entries for server ${serverId}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.revalidationPromises.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let stale = 0;

    for (const entry of this.cache.values()) {
      const age = now - entry.timestamp;
      if (age > DEFAULT_TTLS.RESOURCE_COUNTS) {
        stale++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      stale,
      revalidating: this.revalidationPromises.size,
    };
  }
}

// Global singleton instance
let globalCache: FhirCache | null = null;

export function getFhirCache(): FhirCache {
  if (!globalCache) {
    globalCache = new FhirCache();
  }
  return globalCache;
}

export { DEFAULT_TTLS };

