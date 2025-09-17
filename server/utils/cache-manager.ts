// ============================================================================
// Advanced Cache Manager for Database and API Optimization
// ============================================================================

import { logger } from './logger.js';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: Date;
  ttl: number;
  hits: number;
  lastAccessed: Date;
  tags: string[];
  size: number; // Estimated size in bytes
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in MB
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  maxEntries: number; // Maximum number of cache entries
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  entriesByTag: Record<string, number>;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    cleanups: 0
  };
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB default
      defaultTTL: 5 * 60 * 1000, // 5 minutes default
      cleanupInterval: 60 * 1000, // 1 minute cleanup interval
      maxEntries: 1000, // 1000 entries max
      ...config
    };

    this.startCleanupTimer();
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = new Date();
    this.stats.hits++;

    logger.debug('Cache hit', { service: 'cache-manager', operation: 'get', key, hits: entry.hits });
    return entry.data;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, options: {
    ttl?: number;
    tags?: string[];
    size?: number;
  } = {}): void {
    const ttl = options.ttl || this.config.defaultTTL;
    const tags = options.tags || [];
    const size = options.size || this.estimateSize(data);

    // Check if we need to evict entries
    this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl,
      hits: 0,
      lastAccessed: new Date(),
      tags,
      size
    };

    this.cache.set(key, entry);
    logger.debug('Cache set', { service: 'cache-manager', operation: 'set', key, ttl, size, tags });
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache delete', { service: 'cache-manager', operation: 'delete', key });
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { service: 'cache-manager', operation: 'clear', entriesCleared: count });
  }

  /**
   * Clear cache entries by tag
   */
  clearByTag(tag: string): number {
    let cleared = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    logger.info('Cache cleared by tag', { service: 'cache-manager', operation: 'clearByTag', tag, entriesCleared: cleared });
    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    const entriesByTag: Record<string, number> = {};
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        entriesByTag[tag] = (entriesByTag[tag] || 0) + 1;
      });
    });

    const timestamps = entries.map(e => e.timestamp);
    const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null;
    const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null;

    return {
      totalEntries: this.cache.size,
      totalSize,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate,
      oldestEntry,
      newestEntry,
      entriesByTag
    };
  }

  /**
   * Get detailed cache information
   */
  getCacheInfo(): Record<string, any> {
    const info: Record<string, any> = {};
    
    for (const [key, entry] of this.cache.entries()) {
      const age = Date.now() - entry.timestamp.getTime();
      const timeToExpire = entry.ttl - age;
      
      info[key] = {
        age,
        ttl: entry.ttl,
        timeToExpire,
        hits: entry.hits,
        lastAccessed: entry.lastAccessed,
        tags: entry.tags,
        size: entry.size,
        stale: timeToExpire <= 0
      };
    }
    
    return info;
  }

  /**
   * Force cleanup of expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    this.stats.cleanups++;
    if (cleaned > 0) {
      logger.debug('Cache cleanup', { service: 'cache-manager', operation: 'cleanup', entriesCleaned: cleaned });
    }
    
    return cleaned;
  }

  /**
   * Ensure cache capacity by evicting entries if necessary
   */
  private ensureCapacity(newEntrySize: number): void {
    const currentSize = this.getCurrentSize();
    const maxSizeBytes = this.config.maxSize;
    
    // If adding this entry would exceed size limit, evict entries
    if (currentSize + newEntrySize > maxSizeBytes) {
      this.evictEntries(newEntrySize);
    }
    
    // If we have too many entries, evict least recently used
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }
  }

  /**
   * Get current cache size in bytes
   */
  private getCurrentSize(): number {
    return Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
  }

  /**
   * Evict entries to make room for new entry
   */
  private evictEntries(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => {
        // Sort by last accessed time (oldest first)
        return a.lastAccessed.getTime() - b.lastAccessed.getTime();
      });

    let freedSpace = 0;
    let evicted = 0;

    for (const [key, entry] of entries) {
      this.cache.delete(key);
      freedSpace += entry.size;
      evicted++;
      
      if (freedSpace >= requiredSpace) {
        break;
      }
    }

    this.stats.evictions += evicted;
    if (evicted > 0) {
      logger.debug('Cache eviction', { service: 'cache-manager', operation: 'evictEntries', entriesEvicted: evicted, spaceFreed: freedSpace });
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => {
        // Sort by last accessed time (oldest first)
        return a.lastAccessed.getTime() - b.lastAccessed.getTime();
      });

    // Evict 10% of entries or at least 1
    const toEvict = Math.max(1, Math.floor(this.cache.size * 0.1));
    
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
    }

    this.stats.evictions += toEvict;
    logger.debug('Cache LRU eviction', { service: 'cache-manager', operation: 'evictLRU', entriesEvicted: toEvict });
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default 1KB if serialization fails
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Export singleton instance
export const cacheManager = new CacheManager({
  maxSize: 50 * 1024 * 1024, // 50MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 2 * 60 * 1000, // 2 minutes
  maxEntries: 500
});

// Cache tags for better organization
export const CACHE_TAGS = {
  FHIR_SERVER: 'fhir-server',
  VALIDATION: 'validation',
  DASHBOARD: 'dashboard',
  RESOURCE_COUNTS: 'resource-counts',
  VALIDATION_RESULTS: 'validation-results',
  FHIR_RESOURCES: 'fhir-resources',
  VALIDATION_PROFILES: 'validation-profiles',
  DASHBOARD_CARDS: 'dashboard-cards',
  VALIDATION_SETTINGS: 'validation-settings'
} as const;

