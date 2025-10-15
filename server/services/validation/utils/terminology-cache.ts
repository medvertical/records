/**
 * Terminology Cache for Ontoserver Lookups
 * 
 * Implements intelligent caching for Ontoserver terminology lookups
 * to improve performance and reduce external service calls.
 */

import { createHash } from 'crypto';
import { PerformanceMeasurer } from './performance-measurer';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entries: number;
  averageAccessTime: number;
  topKeys: Array<{ key: string; accessCount: number }>;
}

export interface TerminologyCacheConfig {
  maxSize: number; // Maximum number of entries
  maxMemoryMB: number; // Maximum memory usage in MB
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  enableStatistics: boolean;
}

export class TerminologyCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private statistics = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0
  };
  private config: TerminologyCacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<TerminologyCacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      maxMemoryMB: 100,
      defaultTTL: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableStatistics: true,
      ...config
    };

    this.startCleanupTimer();
  }

  /**
   * Generate cache key for terminology lookup
   */
  private generateCacheKey(operation: string, params: Record<string, any>): string {
    const keyData = {
      operation,
      ...params
    };
    
    const hash = createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);
    
    return `${operation}-${hash}`;
  }

  /**
   * Get value from cache
   */
  async get(operation: string, params: Record<string, any>): Promise<T | null> {
    const cacheKey = this.generateCacheKey(operation, params);
    const operationId = `cache-get-${Date.now()}`;
    
    PerformanceMeasurer.startCachingTiming(operationId, cacheKey, 'get');
    
    try {
      const entry = this.cache.get(cacheKey);
      
      if (!entry) {
        this.statistics.misses++;
        PerformanceMeasurer.endCachingTiming(operationId, false);
        return null;
      }

      // Check if entry has expired
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(cacheKey);
        this.statistics.misses++;
        PerformanceMeasurer.endCachingTiming(operationId, false);
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = now;
      this.statistics.hits++;
      
      PerformanceMeasurer.endCachingTiming(operationId, true, entry.size, entry.ttl);
      
      if (this.config.enableStatistics) {
        this.statistics.accessCount++;
      }

      return entry.value;
    } catch (error) {
      PerformanceMeasurer.endCachingTiming(operationId, false);
      throw error;
    }
  }

  /**
   * Simple get for code validation (unified cache key format)
   * Format: system|code -> result
   */
  async getCodeValidation(system: string, code: string): Promise<T | null> {
    return this.get('validate-code', { system, code });
  }

  /**
   * Simple set for code validation (unified cache key format)
   */
  async setCodeValidation(system: string, code: string, result: T, ttl?: number): Promise<void> {
    return this.set('validate-code', { system, code }, result, ttl);
  }

  /**
   * Set value in cache
   */
  async set(
    operation: string, 
    params: Record<string, any>, 
    value: T, 
    ttl?: number
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(operation, params);
    const operationId = `cache-set-${Date.now()}`;
    
    PerformanceMeasurer.startCachingTiming(operationId, cacheKey, 'set');
    
    try {
      const size = this.calculateSize(value);
      const now = Date.now();
      
      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        ttl: ttl || this.config.defaultTTL,
        accessCount: 0,
        lastAccessed: now,
        size
      };

      // Check if we need to evict entries
      await this.evictIfNeeded(size);
      
      this.cache.set(cacheKey, entry);
      
      PerformanceMeasurer.endCachingTiming(operationId, true, size, entry.ttl);
      
      if (this.config.enableStatistics) {
        this.statistics.accessCount++;
      }
    } catch (error) {
      PerformanceMeasurer.endCachingTiming(operationId, false);
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(operation: string, params: Record<string, any>): Promise<boolean> {
    const cacheKey = this.generateCacheKey(operation, params);
    const operationId = `cache-delete-${Date.now()}`;
    
    PerformanceMeasurer.startCachingTiming(operationId, cacheKey, 'delete');
    
    try {
      const deleted = this.cache.delete(cacheKey);
      PerformanceMeasurer.endCachingTiming(operationId, deleted);
      return deleted;
    } catch (error) {
      PerformanceMeasurer.endCachingTiming(operationId, false);
      throw error;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const operationId = `cache-clear-${Date.now()}`;
    
    PerformanceMeasurer.startCachingTiming(operationId, 'all', 'clear');
    
    try {
      this.cache.clear();
      this.resetStatistics();
      PerformanceMeasurer.endCachingTiming(operationId, true);
    } catch (error) {
      PerformanceMeasurer.endCachingTiming(operationId, false);
      throw error;
    }
  }

  /**
   * Calculate size of a value in bytes (rough estimate)
   */
  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate for UTF-16
    } catch {
      return 1024; // Default size if serialization fails
    }
  }

  /**
   * Check if we need to evict entries and do so if necessary
   */
  private async evictIfNeeded(newEntrySize: number): Promise<void> {
    const currentSize = this.getCurrentCacheSize();
    const currentEntries = this.cache.size;
    
    // Check size limits
    if (currentEntries >= this.config.maxSize) {
      await this.evictLRU(1);
    }
    
    // Check memory limits (convert MB to bytes)
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    if (currentSize + newEntrySize > maxMemoryBytes) {
      await this.evictByMemoryUsage(newEntrySize);
    }
  }

  /**
   * Get current cache size in bytes
   */
  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(count: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    entries.sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
    
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Evict entries to free up memory
   */
  private async evictByMemoryUsage(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    entries.sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
    
    let freedSpace = 0;
    let evictedCount = 0;
    
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break;
      
      this.cache.delete(key);
      freedSpace += entry.size;
      evictedCount++;
    }
    
    console.log(`[TerminologyCache] Evicted ${evictedCount} entries, freed ${freedSpace} bytes`);
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[TerminologyCache] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    const totalAccesses = this.statistics.hits + this.statistics.misses;
    const hitRate = totalAccesses > 0 ? (this.statistics.hits / totalAccesses) * 100 : 0;
    const averageAccessTime = this.statistics.accessCount > 0 
      ? this.statistics.totalAccessTime / this.statistics.accessCount 
      : 0;

    // Get top accessed keys
    const entries = Array.from(this.cache.entries());
    const topKeys = entries
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      hits: this.statistics.hits,
      misses: this.statistics.misses,
      hitRate,
      totalSize: this.getCurrentCacheSize(),
      entries: this.cache.size,
      averageAccessTime,
      topKeys
    };
  }

  /**
   * Reset statistics
   */
  private resetStatistics(): void {
    this.statistics = {
      hits: 0,
      misses: 0,
      totalAccessTime: 0,
      accessCount: 0
    };
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
    this.resetStatistics();
  }

  /**
   * Get cache size information
   */
  getSizeInfo(): {
    entries: number;
    totalSizeBytes: number;
    totalSizeMB: number;
    maxSize: number;
    maxMemoryMB: number;
    usagePercentage: number;
  } {
    const totalSizeBytes = this.getCurrentCacheSize();
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    const usagePercentage = (this.cache.size / this.config.maxSize) * 100;

    return {
      entries: this.cache.size,
      totalSizeBytes,
      totalSizeMB,
      maxSize: this.config.maxSize,
      maxMemoryMB: this.config.maxMemoryMB,
      usagePercentage
    };
  }
}

// Global terminology cache instance
export const terminologyCache = new TerminologyCache({
  maxSize: 5000,
  maxMemoryMB: 200,
  defaultTTL: 600000, // 10 minutes
  cleanupInterval: 300000, // 5 minutes
  enableStatistics: true
});

// Specialized cache for different terminology operations
export const codeSystemCache = new TerminologyCache({
  maxSize: 1000,
  maxMemoryMB: 50,
  defaultTTL: 1800000, // 30 minutes (code systems change rarely)
  cleanupInterval: 600000, // 10 minutes
  enableStatistics: true
});

export const valueSetCache = new TerminologyCache({
  maxSize: 2000,
  maxMemoryMB: 100,
  defaultTTL: 900000, // 15 minutes (value sets change occasionally)
  cleanupInterval: 600000, // 10 minutes
  enableStatistics: true
});

export const conceptMapCache = new TerminologyCache({
  maxSize: 500,
  maxMemoryMB: 25,
  defaultTTL: 3600000, // 60 minutes (concept maps change rarely)
  cleanupInterval: 900000, // 15 minutes
  enableStatistics: true
});
