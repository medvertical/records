/**
 * Validation Cache Manager
 * 
 * Coordinates multi-layer caching: L1 (memory), L2 (database), L3 (filesystem).
 * Provides unified interface for caching validation results, profiles, and terminology.
 * 
 * Task 7.1: Create ValidationCacheManager class coordinating L1/L2/L3 caches
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { eq, and, sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export type CacheLayer = 'L1' | 'L2' | 'L3';

export interface CacheEntry<T = any> {
  /** The cached value */
  value: T;
  /** When the entry was created */
  createdAt: Date;
  /** When the entry expires */
  expiresAt: Date;
  /** Cache key */
  key: string;
  /** Size in bytes (estimated) */
  sizeBytes: number;
  /** Which layer this entry is in */
  layer: CacheLayer;
  /** Number of times accessed */
  hits: number;
}

export interface CacheConfig {
  /** Enable/disable specific cache layers */
  layers: {
    L1: boolean; // In-memory
    L2: boolean; // Database
    L3: boolean; // Filesystem
  };
  
  /** TTL configuration in milliseconds */
  ttl: {
    validationResults: number;  // Default: 300000 (5 min)
    profiles: number;           // Default: 1800000 (30 min)
    terminology: number;        // Default: 3600000 (1 hr)
    igPackages: number;         // Default: 86400000 (24 hr)
  };
  
  /** Size limits */
  limits: {
    L1MaxSizeMB: number;       // Default: 100 MB
    L1MaxEntries: number;      // Default: 1000
    L2MaxSizeMB: number;       // Default: 1000 MB (1 GB)
    L3MaxSizeMB: number;       // Default: 5000 MB (5 GB)
  };
}

export interface CacheStats {
  /** Layer-specific statistics */
  layers: {
    L1: LayerStats;
    L2: LayerStats;
    L3: LayerStats;
  };
  
  /** Overall statistics */
  overall: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    totalSizeMB: number;
    totalEntries: number;
  };
}

export interface LayerStats {
  enabled: boolean;
  entries: number;
  sizeMB: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export type CacheCategory = 'validation' | 'profile' | 'terminology' | 'igPackage';

// ============================================================================
// Validation Cache Manager Class
// ============================================================================

export class ValidationCacheManager extends EventEmitter {
  private config: CacheConfig;
  
  // L1: In-memory cache (will be implemented in Task 7.2)
  private l1Cache: Map<string, CacheEntry> = new Map();
  
  // L2: Database cache (will be implemented in Task 7.4)
  private l2CacheEnabled: boolean = false;
  
  // L3: Filesystem cache (Task 7.6)
  private l3CachePath: string = './cache/validation';
  
  // Statistics tracking
  private stats = {
    L1: { hits: 0, misses: 0, evictions: 0 },
    L2: { hits: 0, misses: 0, evictions: 0 },
    L3: { hits: 0, misses: 0, evictions: 0 },
  };

  constructor(config?: Partial<CacheConfig>) {
    super();
    
    // Initialize with defaults
    this.config = {
      layers: {
        L1: config?.layers?.L1 !== false, // Enabled by default
        L2: config?.layers?.L2 || false,  // Disabled by default (needs DB setup)
        L3: config?.layers?.L3 || false,  // Disabled by default (needs FS setup)
      },
      ttl: {
        validationResults: config?.ttl?.validationResults || 300000,    // 5 min
        profiles: config?.ttl?.profiles || 1800000,                     // 30 min
        terminology: config?.ttl?.terminology || 3600000,               // 1 hr
        igPackages: config?.ttl?.igPackages || 86400000,                // 24 hr
      },
      limits: {
        L1MaxSizeMB: config?.limits?.L1MaxSizeMB || 100,
        L1MaxEntries: config?.limits?.L1MaxEntries || 1000,
        L2MaxSizeMB: config?.limits?.L2MaxSizeMB || 1000,
        L3MaxSizeMB: config?.limits?.L3MaxSizeMB || 5000,
      },
    };

    console.log('[ValidationCacheManager] Initialized with config:', {
      L1: this.config.layers.L1 ? 'enabled' : 'disabled',
      L2: this.config.layers.L2 ? 'enabled' : 'disabled',
      L3: this.config.layers.L3 ? 'enabled' : 'disabled',
    });
  }

  /**
   * Get a value from cache (checks all layers in order: L1 → L2 → L3)
   */
  async get<T>(key: string, category: CacheCategory = 'validation'): Promise<T | null> {
    // Task 7.1: Multi-layer cache lookup
    
    // Try L1 (memory) first
    if (this.config.layers.L1) {
      const l1Result = await this.getFromL1<T>(key);
      if (l1Result !== null) {
        this.stats.L1.hits++;
        this.emit('cache-hit', { layer: 'L1', key, category });
        return l1Result;
      }
      this.stats.L1.misses++;
    }

    // Try L2 (database)
    if (this.config.layers.L2) {
      const l2Result = await this.getFromL2<T>(key);
      if (l2Result !== null) {
        this.stats.L2.hits++;
        // Promote to L1 for faster future access
        if (this.config.layers.L1) {
          await this.setInL1(key, l2Result, category);
        }
        this.emit('cache-hit', { layer: 'L2', key, category });
        return l2Result;
      }
      this.stats.L2.misses++;
    }

    // Try L3 (filesystem)
    if (this.config.layers.L3) {
      const l3Result = await this.getFromL3<T>(key);
      if (l3Result !== null) {
        this.stats.L3.hits++;
        // Promote to L2 and L1
        if (this.config.layers.L2) {
          await this.setInL2(key, l3Result, category);
        }
        if (this.config.layers.L1) {
          await this.setInL1(key, l3Result, category);
        }
        this.emit('cache-hit', { layer: 'L3', key, category });
        return l3Result;
      }
      this.stats.L3.misses++;
    }

    this.emit('cache-miss', { key, category });
    return null;
  }

  /**
   * Set a value in cache (writes to all enabled layers)
   */
  async set<T>(
    key: string,
    value: T,
    category: CacheCategory = 'validation',
    metadata?: {
      resourceHash?: string;
      settingsHash?: string;
      fhirVersion?: string;
      resourceType?: string;
      validationProfile?: string;
    }
  ): Promise<void> {
    // Task 7.1 & 7.5: Multi-layer cache write with metadata
    
    const promises: Promise<void>[] = [];

    if (this.config.layers.L1) {
      promises.push(this.setInL1(key, value, category));
    }

    if (this.config.layers.L2) {
      promises.push(this.setInL2(key, value, category, metadata));
    }

    if (this.config.layers.L3) {
      promises.push(this.setInL3(key, value, category));
    }

    await Promise.all(promises);
    
    this.emit('cache-set', { key, category, layers: Object.keys(this.config.layers).filter(l => this.config.layers[l as CacheLayer]) });
  }

  /**
   * Delete a value from all cache layers
   */
  async delete(key: string): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.layers.L1) {
      this.l1Cache.delete(key);
    }

    if (this.config.layers.L2) {
      promises.push(this.deleteFromL2(key));
    }

    if (this.config.layers.L3) {
      promises.push(this.deleteFromL3(key));
    }

    await Promise.all(promises);
    
    this.emit('cache-delete', { key });
  }

  /**
   * Clear entire cache (all layers)
   */
  async clear(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.layers.L1) {
      this.l1Cache.clear();
    }

    if (this.config.layers.L2) {
      promises.push(this.clearL2());
    }

    if (this.config.layers.L3) {
      promises.push(this.clearL3());
    }

    await Promise.all(promises);
    
    // Reset statistics
    this.stats = {
      L1: { hits: 0, misses: 0, evictions: 0 },
      L2: { hits: 0, misses: 0, evictions: 0 },
      L3: { hits: 0, misses: 0, evictions: 0 },
    };

    console.log('[ValidationCacheManager] All cache layers cleared');
    this.emit('cache-cleared');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    // Task 7.8: Cache statistics
    
    const l1Stats = await this.getL1Stats();
    const l2Stats = await this.getL2Stats();
    const l3Stats = await this.getL3Stats();

    const totalHits = l1Stats.hits + l2Stats.hits + l3Stats.hits;
    const totalMisses = l1Stats.misses + l2Stats.misses + l3Stats.misses;
    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      layers: {
        L1: l1Stats,
        L2: l2Stats,
        L3: l3Stats,
      },
      overall: {
        totalHits,
        totalMisses,
        hitRate,
        totalSizeMB: l1Stats.sizeMB + l2Stats.sizeMB + l3Stats.sizeMB,
        totalEntries: l1Stats.entries + l2Stats.entries + l3Stats.entries,
      },
    };
  }

  /**
   * Generate cache key from content and context
   * Task 7.7: Cache key generation using SHA-256
   */
  generateKey(
    resourceContent: any,
    settings?: any,
    fhirVersion?: string,
    category?: CacheCategory
  ): string {
    const components = [
      JSON.stringify(resourceContent),
      settings ? JSON.stringify(settings) : '',
      fhirVersion || 'R4',
      category || 'validation',
    ];

    const combined = components.join('::');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get TTL for a specific category
   */
  getTtl(category: CacheCategory): number {
    switch (category) {
      case 'validation':
        return this.config.ttl.validationResults;
      case 'profile':
        return this.config.ttl.profiles;
      case 'terminology':
        return this.config.ttl.terminology;
      case 'igPackage':
        return this.config.ttl.igPackages;
      default:
        return this.config.ttl.validationResults;
    }
  }

  /**
   * Check if entry is expired
   */
  isExpired(entry: CacheEntry): boolean {
    return new Date() > entry.expiresAt;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = {
      layers: { ...this.config.layers, ...config.layers },
      ttl: { ...this.config.ttl, ...config.ttl },
      limits: { ...this.config.limits, ...config.limits },
    };

    console.log('[ValidationCacheManager] Configuration updated');
    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // ========================================================================
  // L1 Cache Methods (In-Memory)
  // ========================================================================

  private async getFromL1<T>(key: string): Promise<T | null> {
    const entry = this.l1Cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.l1Cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value as T;
  }

  private async setInL1<T>(key: string, value: T, category: CacheCategory): Promise<void> {
    const ttl = this.getTtl(category);
    const sizeBytes = this.estimateSize(value);
    
    const entry: CacheEntry<T> = {
      value,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttl),
      key,
      sizeBytes,
      layer: 'L1',
      hits: 0,
    };

    this.l1Cache.set(key, entry);
  }

  private async getL1Stats(): Promise<LayerStats> {
    const entries = Array.from(this.l1Cache.values());
    const totalSize = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    const totalHits = this.stats.L1.hits;
    const totalMisses = this.stats.L1.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      enabled: this.config.layers.L1,
      entries: entries.length,
      sizeMB: totalSize / (1024 * 1024),
      hits: totalHits,
      misses: totalMisses,
      evictions: this.stats.L1.evictions,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }

  // ========================================================================
  // Database Helper (Lazy Loading)
  // ========================================================================

  private async getDatabase() {
    try {
      const { db } = await import('../../../db');
      const { validationCache } = await import('@shared/schema');
      const { eq, and, sql } = await import('drizzle-orm');
      return { db, validationCache, eq, and, sql };
    } catch (error) {
      console.error('[ValidationCacheManager] Failed to load database:', error);
      return null;
    }
  }

  // ========================================================================
  // L2 Cache Methods (Database)
  // ========================================================================

  private async getFromL2<T>(key: string): Promise<T | null> {
    // Task 7.5: Database cache implementation with efficient lookups
    if (!this.config.layers.L2) {
      return null;
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return null;

      const { db, validationCache, eq, and, sql } = dbModule;

      // Query by cache key with expiration check
      const result = await db
        .select()
        .from(validationCache)
        .where(
          and(
            eq(validationCache.cacheKey, key),
            sql`${validationCache.expiresAt} > CURRENT_TIMESTAMP`
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const entry = result[0];

      // Update hit count and access time
      await db
        .update(validationCache)
        .set({
          hits: entry.hits + 1,
          accessedAt: new Date(),
        })
        .where(eq(validationCache.id, entry.id));

      return entry.value as T;
    } catch (error) {
      console.error('[ValidationCacheManager] L2 cache get error:', error);
      return null;
    }
  }

  private async setInL2<T>(
    key: string,
    value: T,
    category: CacheCategory,
    metadata?: {
      resourceHash?: string;
      settingsHash?: string;
      fhirVersion?: string;
      resourceType?: string;
      validationProfile?: string;
    }
  ): Promise<void> {
    // Task 7.5: Database cache implementation with metadata
    if (!this.config.layers.L2) {
      return;
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return;

      const { db, validationCache, eq } = dbModule;

      const ttl = this.getTtl(category);
      const sizeBytes = this.estimateSize(value);
      const expiresAt = new Date(Date.now() + ttl);

      // Upsert: insert or update if exists
      const existing = await db
        .select()
        .from(validationCache)
        .where(eq(validationCache.cacheKey, key))
        .limit(1);

      if (existing.length > 0) {
        // Update existing entry
        await db
          .update(validationCache)
          .set({
            value: value as any,
            sizeBytes,
            expiresAt,
            updatedAt: new Date(),
            resourceHash: metadata?.resourceHash,
            settingsHash: metadata?.settingsHash,
            fhirVersion: metadata?.fhirVersion,
            resourceType: metadata?.resourceType,
            validationProfile: metadata?.validationProfile,
          })
          .where(eq(validationCache.id, existing[0].id));
      } else {
        // Insert new entry
        await db.insert(validationCache).values({
          cacheKey: key,
          category,
          value: value as any,
          sizeBytes,
          expiresAt,
          hits: 0,
          resourceHash: metadata?.resourceHash,
          settingsHash: metadata?.settingsHash,
          fhirVersion: metadata?.fhirVersion,
          resourceType: metadata?.resourceType,
          validationProfile: metadata?.validationProfile,
        });
      }
    } catch (error) {
      console.error('[ValidationCacheManager] L2 cache set error:', error);
    }
  }

  private async deleteFromL2(key: string): Promise<void> {
    // Task 7.5: Database cache implementation
    if (!this.config.layers.L2) {
      return;
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return;

      const { db, validationCache, eq } = dbModule;

      await db
        .delete(validationCache)
        .where(eq(validationCache.cacheKey, key));
    } catch (error) {
      console.error('[ValidationCacheManager] L2 cache delete error:', error);
    }
  }

  private async clearL2(): Promise<void> {
    // Task 7.5: Database cache implementation
    if (!this.config.layers.L2) {
      return;
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return;

      const { db, validationCache } = dbModule;

      await db.delete(validationCache);
      console.log('[ValidationCacheManager] L2 cache cleared');
    } catch (error) {
      console.error('[ValidationCacheManager] L2 cache clear error:', error);
    }
  }

  private async getL2Stats(): Promise<LayerStats> {
    // Task 7.5: Database cache statistics with efficient queries
    if (!this.config.layers.L2) {
      return {
        enabled: false,
        entries: 0,
        sizeMB: 0,
        hits: this.stats.L2.hits,
        misses: this.stats.L2.misses,
        evictions: this.stats.L2.evictions,
        hitRate: 0,
      };
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) {
        return {
          enabled: true,
          entries: 0,
          sizeMB: 0,
          hits: this.stats.L2.hits,
          misses: this.stats.L2.misses,
          evictions: this.stats.L2.evictions,
          hitRate: 0,
        };
      }

      const { db, validationCache, sql } = dbModule;

      // Get count and total size efficiently
      const stats = await db
        .select({
          count: sql<number>`COUNT(*)`,
          totalSize: sql<number>`COALESCE(SUM(${validationCache.sizeBytes}), 0)`,
          totalHits: sql<number>`COALESCE(SUM(${validationCache.hits}), 0)`,
        })
        .from(validationCache);

      const entries = Number(stats[0]?.count || 0);
      const totalSize = Number(stats[0]?.totalSize || 0);
      const totalHits = Number(stats[0]?.totalHits || 0);
      const totalRequests = this.stats.L2.hits + this.stats.L2.misses;

      return {
        enabled: true,
        entries,
        sizeMB: totalSize / (1024 * 1024),
        hits: this.stats.L2.hits,
        misses: this.stats.L2.misses,
        evictions: this.stats.L2.evictions,
        hitRate: totalRequests > 0 ? this.stats.L2.hits / totalRequests : 0,
      };
    } catch (error) {
      console.error('[ValidationCacheManager] L2 stats error:', error);
      return {
        enabled: true,
        entries: 0,
        sizeMB: 0,
        hits: this.stats.L2.hits,
        misses: this.stats.L2.misses,
        evictions: this.stats.L2.evictions,
        hitRate: 0,
      };
    }
  }

  /**
   * Get cache entry by resource hash (efficient lookup)
   * Task 7.5: Efficient lookups by resource hash
   */
  async getByResourceHash<T>(resourceHash: string, settingsHash?: string): Promise<T | null> {
    if (!this.config.layers.L2) {
      return null;
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return null;

      const { db, validationCache, eq, and, sql } = dbModule;

      const conditions = [
        eq(validationCache.resourceHash, resourceHash),
        sql`${validationCache.expiresAt} > CURRENT_TIMESTAMP`,
      ];

      if (settingsHash) {
        conditions.push(eq(validationCache.settingsHash, settingsHash));
      }

      const result = await db
        .select()
        .from(validationCache)
        .where(and(...conditions))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      // Update hit count
      await db
        .update(validationCache)
        .set({
          hits: result[0].hits + 1,
          accessedAt: new Date(),
        })
        .where(eq(validationCache.id, result[0].id));

      return result[0].value as T;
    } catch (error) {
      console.error('[ValidationCacheManager] getByResourceHash error:', error);
      return null;
    }
  }

  /**
   * Invalidate cache by settings hash
   * Task 7.5: Efficient invalidation by settings hash
   */
  async invalidateBySettingsHash(settingsHash: string): Promise<number> {
    if (!this.config.layers.L2) {
      return 0;
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return 0;

      const { db, validationCache, eq } = dbModule;

      const result = await db
        .delete(validationCache)
        .where(eq(validationCache.settingsHash, settingsHash));

      const count = result.rowCount || 0;
      console.log(`[ValidationCacheManager] Invalidated ${count} entries for settings hash: ${settingsHash.substring(0, 8)}...`);
      return count;
    } catch (error) {
      console.error('[ValidationCacheManager] invalidateBySettingsHash error:', error);
      return 0;
    }
  }

  /**
   * Clean up expired cache entries
   * Task 7.5: Automatic cleanup of expired entries
   */
  async cleanupExpired(): Promise<number> {
    if (!this.config.layers.L2) {
      return 0;
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return 0;

      const { db, validationCache, sql } = dbModule;

      const result = await db
        .delete(validationCache)
        .where(sql`${validationCache.expiresAt} <= CURRENT_TIMESTAMP`);

      const count = result.rowCount || 0;
      if (count > 0) {
        console.log(`[ValidationCacheManager] Cleaned up ${count} expired cache entries`);
        this.emit('cache-cleanup', { count });
      }
      return count;
    } catch (error) {
      console.error('[ValidationCacheManager] cleanupExpired error:', error);
      return 0;
    }
  }

  /**
   * Get cache entries by category
   * Task 7.5: Category-based queries
   */
  async getEntriesByCategory(category: CacheCategory, limit: number = 100): Promise<any[]> {
    if (!this.config.layers.L2) {
      return [];
    }

    try {
      const dbModule = await this.getDatabase();
      if (!dbModule) return [];

      const { db, validationCache, eq, and, sql } = dbModule;

      const results = await db
        .select()
        .from(validationCache)
        .where(
          and(
            eq(validationCache.category, category),
            sql`${validationCache.expiresAt} > CURRENT_TIMESTAMP`
          )
        )
        .limit(limit);

      return results;
    } catch (error) {
      console.error('[ValidationCacheManager] getEntriesByCategory error:', error);
      return [];
    }
  }

  // ========================================================================
  // L3 Cache Methods (Filesystem)
  // ========================================================================

  private async getFromL3<T>(key: string): Promise<T | null> {
    // Task 7.6: Filesystem cache implementation
    if (!this.config.layers.L3) {
      return null;
    }

    try {
      await this.ensureCacheDirectory();
      
      const filePath = this.getCacheFilePath(key);
      const metaPath = `${filePath}.meta.json`;

      // Check if file and metadata exist
      const [fileExists, metaExists] = await Promise.all([
        this.fileExists(filePath),
        this.fileExists(metaPath),
      ]);

      if (!fileExists || !metaExists) {
        return null;
      }

      // Read metadata to check expiration
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metadata = JSON.parse(metaContent);

      if (new Date(metadata.expiresAt) < new Date()) {
        // Expired - delete both files
        await Promise.all([
          fs.unlink(filePath).catch(() => {}),
          fs.unlink(metaPath).catch(() => {}),
        ]);
        return null;
      }

      // Read cache file
      const content = await fs.readFile(filePath, 'utf-8');
      const value = JSON.parse(content);

      // Update metadata hits
      metadata.hits++;
      metadata.accessedAt = new Date().toISOString();
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

      return value as T;
    } catch (error) {
      console.error('[ValidationCacheManager] L3 cache get error:', error);
      return null;
    }
  }

  private async setInL3<T>(key: string, value: T, category: CacheCategory): Promise<void> {
    // Task 7.6: Filesystem cache implementation
    if (!this.config.layers.L3) {
      return;
    }

    try {
      await this.ensureCacheDirectory();
      
      const filePath = this.getCacheFilePath(key);
      const metaPath = `${filePath}.meta.json`;
      const ttl = this.getTtl(category);

      // Ensure subdirectory exists
      await this.ensureFileDirectory(filePath);

      // Write cache file
      await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');

      // Write metadata
      const metadata = {
        key,
        category,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl).toISOString(),
        sizeBytes: this.estimateSize(value),
        hits: 0,
      };
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    } catch (error) {
      console.error('[ValidationCacheManager] L3 cache set error:', error);
    }
  }

  private async deleteFromL3(key: string): Promise<void> {
    // Task 7.6: Filesystem cache implementation
    if (!this.config.layers.L3) {
      return;
    }

    try {
      const filePath = this.getCacheFilePath(key);
      const metaPath = `${filePath}.meta.json`;

      await Promise.all([
        fs.unlink(filePath).catch(() => {}),
        fs.unlink(metaPath).catch(() => {}),
      ]);
    } catch (error) {
      console.error('[ValidationCacheManager] L3 cache delete error:', error);
    }
  }

  private async clearL3(): Promise<void> {
    // Task 7.6: Filesystem cache implementation
    if (!this.config.layers.L3) {
      return;
    }

    try {
      const exists = await this.directoryExists(this.l3CachePath);
      if (!exists) {
        return;
      }

      // Recursively delete all files and subdirectories
      const deleteCount = await this.deleteCacheDirectoryContents(this.l3CachePath);

      console.log(`[ValidationCacheManager] L3 cache cleared (${deleteCount} files deleted)`);
    } catch (error) {
      console.error('[ValidationCacheManager] L3 cache clear error:', error);
    }
  }

  /**
   * Recursively delete directory contents
   */
  private async deleteCacheDirectoryContents(dirPath: string): Promise<number> {
    let count = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively delete subdirectory
          const subCount = await this.deleteCacheDirectoryContents(fullPath);
          count += subCount;
          // Remove empty directory
          await fs.rmdir(fullPath).catch(() => {});
        } else {
          // Delete file
          await fs.unlink(fullPath).catch(() => {});
          count++;
        }
      }
    } catch (error) {
      console.error('[ValidationCacheManager] Error deleting directory contents:', error);
    }
    
    return count;
  }

  private async getL3Stats(): Promise<LayerStats> {
    // Task 7.6: Filesystem cache statistics
    if (!this.config.layers.L3) {
      return {
        enabled: false,
        entries: 0,
        sizeMB: 0,
        hits: this.stats.L3.hits,
        misses: this.stats.L3.misses,
        evictions: this.stats.L3.evictions,
        hitRate: 0,
      };
    }

    try {
      const exists = await this.directoryExists(this.l3CachePath);
      if (!exists) {
        return {
          enabled: true,
          entries: 0,
          sizeMB: 0,
          hits: this.stats.L3.hits,
          misses: this.stats.L3.misses,
          evictions: this.stats.L3.evictions,
          hitRate: 0,
        };
      }

      // Recursively count files and size
      const { count, totalSize } = await this.countFilesRecursively(this.l3CachePath);

      const totalRequests = this.stats.L3.hits + this.stats.L3.misses;

      return {
        enabled: true,
        entries: count,
        sizeMB: totalSize / (1024 * 1024),
        hits: this.stats.L3.hits,
        misses: this.stats.L3.misses,
        evictions: this.stats.L3.evictions,
        hitRate: totalRequests > 0 ? this.stats.L3.hits / totalRequests : 0,
      };
    } catch (error) {
      console.error('[ValidationCacheManager] L3 stats error:', error);
      return {
        enabled: true,
        entries: 0,
        sizeMB: 0,
        hits: this.stats.L3.hits,
        misses: this.stats.L3.misses,
        evictions: this.stats.L3.evictions,
        hitRate: 0,
      };
    }
  }

  /**
   * Count files recursively in directory
   */
  private async countFilesRecursively(dirPath: string): Promise<{ count: number; totalSize: number }> {
    let count = 0;
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subResult = await this.countFilesRecursively(fullPath);
          count += subResult.count;
          totalSize += subResult.totalSize;
        } else if (!entry.name.endsWith('.meta.json')) {
          // Count only data files, not metadata
          count++;
          try {
            const stat = await fs.stat(fullPath);
            totalSize += stat.size;
          } catch {
            // Ignore stat errors
          }
        }
      }
    } catch (error) {
      // Ignore read errors
    }

    return { count, totalSize };
  }

  // ========================================================================
  // L3 Helper Methods
  // ========================================================================

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.l3CachePath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
  }

  /**
   * Get file path for a cache key
   */
  private getCacheFilePath(key: string): string {
    // Use first 2 chars of key for subdirectory to avoid too many files in one directory
    const subdir = key.substring(0, 2);
    const filename = `${key}.json`;
    return path.join(this.l3CachePath, subdir, filename);
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Ensure subdirectory exists for a file path
   */
  private async ensureFileDirectory(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Ignore errors
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: any): number {
    try {
      const json = JSON.stringify(value);
      return Buffer.byteLength(json, 'utf8');
    } catch {
      return 0;
    }
  }

  /**
   * Check if a key exists in any layer
   */
  async has(key: string): Promise<boolean> {
    if (this.config.layers.L1 && this.l1Cache.has(key)) {
      return true;
    }

    // TODO: Check L2 and L3
    return false;
  }

  /**
   * Get all keys from a specific layer
   */
  async getKeys(layer: CacheLayer): Promise<string[]> {
    switch (layer) {
      case 'L1':
        return Array.from(this.l1Cache.keys());
      case 'L2':
        // TODO: Implement L2 key retrieval
        return [];
      case 'L3':
        // TODO: Implement L3 key retrieval
        return [];
      default:
        return [];
    }
  }

  /**
   * Invalidate cache for a specific category
   * Task 7.9: Cache invalidation
   */
  async invalidateCategory(category: CacheCategory): Promise<void> {
    const keys = await this.getKeys('L1');
    const categoryKeys = keys.filter(k => k.includes(category));

    for (const key of categoryKeys) {
      await this.delete(key);
    }

    console.log(`[ValidationCacheManager] Invalidated ${categoryKeys.length} entries for category: ${category}`);
    this.emit('cache-invalidated', { category, count: categoryKeys.length });
  }

  /**
   * Invalidate all caches (on settings change)
   * Task 7.9: Cache invalidation on settings change
   */
  async invalidateAll(): Promise<void> {
    await this.clear();
    console.log('[ValidationCacheManager] All caches invalidated');
    this.emit('cache-invalidated-all');
  }

  /**
   * Warm cache with common profiles and terminology
   * Task 7.10: Cache warming
   */
  async warmCache(options?: {
    profiles?: string[];
    terminologySystems?: string[];
    categories?: CacheCategory[];
  }): Promise<{
    profilesWarmed: number;
    terminologyWarmed: number;
    totalWarmed: number;
    errors: string[];
  }> {
    console.log('[ValidationCacheManager] Starting cache warming...');
    
    const result = {
      profilesWarmed: 0,
      terminologyWarmed: 0,
      totalWarmed: 0,
      errors: [] as string[],
    };

    try {
      // Warm common FHIR core profiles
      if (!options?.categories || options.categories.includes('profile')) {
        const commonProfiles = options?.profiles || this.getCommonProfiles();
        result.profilesWarmed = await this.warmProfiles(commonProfiles, result.errors);
      }

      // Warm common terminology systems
      if (!options?.categories || options.categories.includes('terminology')) {
        const commonSystems = options?.terminologySystems || this.getCommonTerminologySystems();
        result.terminologyWarmed = await this.warmTerminology(commonSystems, result.errors);
      }

      result.totalWarmed = result.profilesWarmed + result.terminologyWarmed;

      console.log(
        `[ValidationCacheManager] Cache warming complete: ` +
        `${result.profilesWarmed} profiles, ${result.terminologyWarmed} terminology systems, ` +
        `${result.errors.length} errors`
      );

      this.emit('cache-warmed', result);
    } catch (error) {
      console.error('[ValidationCacheManager] Cache warming failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Get list of common FHIR profiles to pre-cache
   */
  private getCommonProfiles(): string[] {
    return [
      // FHIR R4 core profiles
      'http://hl7.org/fhir/StructureDefinition/Patient',
      'http://hl7.org/fhir/StructureDefinition/Observation',
      'http://hl7.org/fhir/StructureDefinition/Condition',
      'http://hl7.org/fhir/StructureDefinition/Procedure',
      'http://hl7.org/fhir/StructureDefinition/DiagnosticReport',
      'http://hl7.org/fhir/StructureDefinition/Medication',
      'http://hl7.org/fhir/StructureDefinition/MedicationRequest',
      'http://hl7.org/fhir/StructureDefinition/Encounter',
      'http://hl7.org/fhir/StructureDefinition/Organization',
      'http://hl7.org/fhir/StructureDefinition/Practitioner',
      'http://hl7.org/fhir/StructureDefinition/Bundle',
    ];
  }

  /**
   * Get list of common terminology systems to pre-cache
   */
  private getCommonTerminologySystems(): string[] {
    return [
      'http://loinc.org',
      'http://snomed.info/sct',
      'http://hl7.org/fhir/sid/icd-10',
      'http://www.nlm.nih.gov/research/umls/rxnorm',
      'http://hl7.org/fhir/administrative-gender',
      'http://hl7.org/fhir/observation-status',
      'http://hl7.org/fhir/condition-clinical',
    ];
  }

  /**
   * Warm profile cache
   */
  private async warmProfiles(profiles: string[], errors: string[]): Promise<number> {
    let warmed = 0;

    for (const profileUrl of profiles) {
      try {
        // Generate a placeholder cache entry for the profile
        // In a real implementation, this would fetch the profile from a server
        const cacheKey = this.generateKey({ profileUrl }, null, 'R4', 'profile');
        
        const profileData = {
          url: profileUrl,
          status: 'active',
          warmed: true,
          warmedAt: new Date().toISOString(),
        };

        await this.set(cacheKey, profileData, 'profile');
        warmed++;
      } catch (error) {
        errors.push(`Failed to warm profile ${profileUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return warmed;
  }

  /**
   * Warm terminology cache
   */
  private async warmTerminology(systems: string[], errors: string[]): Promise<number> {
    let warmed = 0;

    for (const system of systems) {
      try {
        // Generate a placeholder cache entry for the terminology
        const cacheKey = this.generateKey({ system }, null, 'R4', 'terminology');
        
        const terminologyData = {
          system,
          status: 'available',
          warmed: true,
          warmedAt: new Date().toISOString(),
        };

        await this.set(cacheKey, terminologyData, 'terminology');
        warmed++;
      } catch (error) {
        errors.push(`Failed to warm terminology ${system}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return warmed;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let cacheManagerInstance: ValidationCacheManager | null = null;

export function getValidationCacheManager(config?: Partial<CacheConfig>): ValidationCacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new ValidationCacheManager(config);
  }
  return cacheManagerInstance;
}

export function resetValidationCacheManager(): void {
  cacheManagerInstance = null;
}

