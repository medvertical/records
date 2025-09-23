/**
 * Validation Settings Cache Service
 * 
 * Handles caching, cache metrics, and cache management for validation settings.
 * Provides LRU cache functionality with TTL support.
 */

import { EventEmitter } from 'events';
import type { ValidationSettings } from '@shared/validation-settings';

export interface SettingsCacheEntry {
  /** Cached settings */
  settings: ValidationSettings;
  
  /** Cache timestamp */
  cachedAt: Date;
  
  /** Cache TTL */
  ttlMs: number;
  
  /** Whether the cache entry is valid */
  isValid: boolean;
  
  /** Last access timestamp for LRU */
  lastAccessed: Date;
  
  /** Access count for metrics */
  accessCount: number;
}

export interface CacheMetrics {
  /** Number of cache hits */
  hits: number;
  
  /** Number of cache misses */
  misses: number;
  
  /** Cache hit ratio (0-1) */
  hitRatio: number;
  
  /** Average access time in milliseconds */
  averageAccessTime: number;
  
  /** Total cache size in bytes (estimated) */
  sizeBytes: number;
  
  /** Number of evictions */
  evictions: number;
  
  /** Cache efficiency score (0-100) */
  efficiencyScore: number;
}

export interface SettingsCacheConfig {
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  
  /** Maximum number of cache entries */
  maxCacheSize: number;
  
  /** Whether to enable cache metrics */
  enableMetrics: boolean;
  
  /** Cache cleanup interval in milliseconds */
  cleanupIntervalMs: number;
}

export class ValidationSettingsCacheService extends EventEmitter {
  private config: SettingsCacheConfig;
  private cache: Map<string, SettingsCacheEntry> = new Map();
  private cacheMetrics: CacheMetrics;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SettingsCacheConfig> = {}) {
    super();
    
    this.config = {
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 100,
      enableMetrics: true,
      cleanupIntervalMs: 60 * 1000, // 1 minute
      ...config
    };
    
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      averageAccessTime: 0,
      sizeBytes: 0,
      evictions: 0,
      efficiencyScore: 0
    };
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    this.startCacheCleanupTimer();
    this.emit('initialized');
  }

  /**
   * Shutdown the cache service
   */
  async shutdown(): Promise<void> {
    this.stopCacheCleanupTimer();
    this.cache.clear();
    this.emit('shutdown');
  }

  // ========================================================================
  // Cache Operations
  // ========================================================================

  /**
   * Get cached settings by ID
   */
  getCachedSettings(settingsId: string): ValidationSettings | null {
    const startTime = Date.now();
    
    const entry = this.cache.get(settingsId);
    
    if (!entry) {
      this.recordCacheMiss();
      return null;
    }

    // Check if entry is expired
    if (this.isEntryExpired(entry)) {
      this.cache.delete(settingsId);
      this.recordCacheMiss();
      return null;
    }

    // Update access information
    entry.lastAccessed = new Date();
    entry.accessCount++;
    
    this.recordCacheHit(Date.now() - startTime);
    
    return entry.settings;
  }

  /**
   * Cache settings
   */
  cacheSettings(settingsId: string, settings: ValidationSettings, ttlMs?: number): void {
    const now = new Date();
    const entry: SettingsCacheEntry = {
      settings,
      cachedAt: now,
      ttlMs: ttlMs || this.config.cacheTtlMs,
      isValid: true,
      lastAccessed: now,
      accessCount: 0
    };

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(settingsId, entry);
    this.updateCacheMetrics();
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(settingsId: string): void {
    const entry = this.cache.get(settingsId);
    if (entry) {
      entry.isValid = false;
      this.cache.delete(settingsId);
      this.updateCacheMetrics();
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
    this.updateCacheMetrics();
  }

  /**
   * Warm cache with frequently accessed settings
   */
  async warmCache(settingsMap: Map<string, ValidationSettings>): Promise<void> {
    for (const [settingsId, settings] of settingsMap) {
      this.cacheSettings(settingsId, settings);
    }
    
    this.emit('cacheWarmed', { entries: settingsMap.size });
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop cache cleanup timer
   */
  private stopCacheCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [settingsId, entry] of this.cache.entries()) {
      if (this.isEntryExpired(entry)) {
        this.cache.delete(settingsId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.updateCacheMetrics();
      this.emit('cacheCleaned', { cleanedCount });
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestEntry: { key: string; entry: SettingsCacheEntry } | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.entry.lastAccessed) {
        oldestEntry = { key, entry };
      }
    }
    
    if (oldestEntry) {
      this.cache.delete(oldestEntry.key);
      this.cacheMetrics.evictions++;
      this.emit('cacheEvicted', { settingsId: oldestEntry.key });
    }
  }

  // ========================================================================
  // Cache Metrics
  // ========================================================================

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    return { ...this.cacheMetrics };
  }

  /**
   * Record cache hit
   */
  private recordCacheHit(accessTime: number): void {
    this.cacheMetrics.hits++;
    this.updateHitRatio();
    this.updateAverageAccessTime(accessTime);
    this.updateEfficiencyScore();
  }

  /**
   * Record cache miss
   */
  private recordCacheMiss(): void {
    this.cacheMetrics.misses++;
    this.updateHitRatio();
    this.updateEfficiencyScore();
  }

  /**
   * Update hit ratio
   */
  private updateHitRatio(): void {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    this.cacheMetrics.hitRatio = total > 0 ? this.cacheMetrics.hits / total : 0;
  }

  /**
   * Update average access time
   */
  private updateAverageAccessTime(accessTime: number): void {
    const totalAccesses = this.cacheMetrics.hits + this.cacheMetrics.misses;
    if (totalAccesses > 0) {
      this.cacheMetrics.averageAccessTime = 
        (this.cacheMetrics.averageAccessTime * (totalAccesses - 1) + accessTime) / totalAccesses;
    }
  }

  /**
   * Update cache efficiency score
   */
  private updateEfficiencyScore(): void {
    // Simple efficiency score based on hit ratio and access time
    const hitRatioScore = this.cacheMetrics.hitRatio * 70; // 70% weight for hit ratio
    const accessTimeScore = Math.max(0, 30 - (this.cacheMetrics.averageAccessTime / 10)); // 30% weight for access time
    
    this.cacheMetrics.efficiencyScore = Math.min(100, hitRatioScore + accessTimeScore);
  }

  /**
   * Update cache size metrics
   */
  private updateCacheMetrics(): void {
    // Estimate cache size in bytes
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.settings).length * 2; // Rough estimate
    }
    this.cacheMetrics.sizeBytes = totalSize;
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Check if cache entry is expired
   */
  private isEntryExpired(entry: SettingsCacheEntry): boolean {
    const now = new Date();
    const age = now.getTime() - entry.cachedAt.getTime();
    return age > entry.ttlMs || !entry.isValid;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRatio: number;
    efficiencyScore: number;
    evictions: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRatio: this.cacheMetrics.hitRatio,
      efficiencyScore: this.cacheMetrics.efficiencyScore,
      evictions: this.cacheMetrics.evictions
    };
  }
}
