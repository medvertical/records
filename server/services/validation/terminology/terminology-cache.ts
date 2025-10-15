/**
 * Terminology Validation Cache
 * 
 * Intelligent caching system for terminology validation results with SHA-256 keys,
 * TTL management, and LRU eviction. Optimized for both online and offline modes.
 * 
 * Cache Strategy:
 * - Online mode: 1-hour TTL (terminology servers are reliable)
 * - Offline mode: Persistent cache (no expiration)
 * - LRU eviction when cache limit reached
 * 
 * Responsibilities: Caching ONLY
 * - Does not perform validation (handled by DirectTerminologyClient)
 * - Does not manage server routing (handled by TerminologyServerRouter)
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 */

import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry {
  /** Cache key (SHA-256 hash) */
  key: string;
  
  /** Cached validation result */
  result: {
    valid: boolean;
    display?: string;
    message?: string;
    code?: string;
  };
  
  /** Timestamp when cached */
  cachedAt: number;
  
  /** TTL in milliseconds */
  ttl: number;
  
  /** Number of cache hits */
  hits: number;
  
  /** Last access timestamp */
  lastAccessedAt: number;
}

export interface CacheKey {
  /** Code system URL */
  system: string;
  
  /** Code value */
  code: string;
  
  /** ValueSet URL (optional) */
  valueSet?: string;
  
  /** FHIR version */
  fhirVersion: 'R4' | 'R5' | 'R6';
}

export interface CacheStats {
  /** Total entries in cache */
  size: number;
  
  /** Total cache hits */
  hits: number;
  
  /** Total cache misses */
  misses: number;
  
  /** Hit rate percentage */
  hitRate: number;
  
  /** Total evictions */
  evictions: number;
  
  /** Memory usage estimate (bytes) */
  memoryUsage: number;
}

export interface CacheConfig {
  /** Maximum number of entries */
  maxSize: number;
  
  /** Default TTL in milliseconds (online mode) */
  defaultTtl: number;
  
  /** Offline mode TTL (set to Infinity for persistent) */
  offlineTtl: number;
  
  /** Enable automatic cleanup of expired entries */
  autoCleanup: boolean;
  
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
}

// ============================================================================
// Terminology Cache
// ============================================================================

export class TerminologyCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: config?.maxSize ?? 10000,
      defaultTtl: config?.defaultTtl ?? 3600000, // 1 hour
      offlineTtl: config?.offlineTtl ?? Infinity, // Persistent
      autoCleanup: config?.autoCleanup ?? true,
      cleanupInterval: config?.cleanupInterval ?? 300000, // 5 minutes
    };
    
    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Get cached validation result
   * 
   * @param key - Cache key parameters
   * @returns Cached result if found and not expired, null otherwise
   */
  get(key: CacheKey): CacheEntry['result'] | null {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey);
      this.misses++;
      return null;
    }
    
    // Update access statistics
    entry.hits++;
    entry.lastAccessedAt = Date.now();
    this.hits++;
    
    return entry.result;
  }

  /**
   * Store validation result in cache
   * 
   * @param key - Cache key parameters
   * @param result - Validation result to cache
   * @param isOfflineMode - Whether in offline mode (affects TTL)
   */
  set(
    key: CacheKey,
    result: CacheEntry['result'],
    isOfflineMode: boolean = false
  ): void {
    const cacheKey = this.generateKey(key);
    const ttl = isOfflineMode ? this.config.offlineTtl : this.config.defaultTtl;
    
    // Check if cache is full
    if (this.cache.size >= this.config.maxSize && !this.cache.has(cacheKey)) {
      this.evictLRU();
    }
    
    const entry: CacheEntry = {
      key: cacheKey,
      result,
      cachedAt: Date.now(),
      ttl,
      hits: 0,
      lastAccessedAt: Date.now(),
    };
    
    this.cache.set(cacheKey, entry);
  }

  /**
   * Check if a result is cached (without retrieving it)
   * 
   * @param key - Cache key parameters
   * @returns true if cached and not expired
   */
  has(key: CacheKey): boolean {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return false;
    }
    
    return !this.isExpired(entry);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    console.log('[TerminologyCache] Cache cleared');
  }

  /**
   * Remove expired entries
   * 
   * @returns Number of entries removed
   */
  cleanup(): number {
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`[TerminologyCache] Cleaned up ${removed} expired entries`);
    }
    
    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    
    // Estimate memory usage (rough approximation)
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      memoryUsage += JSON.stringify(entry).length * 2; // *2 for UTF-16 encoding
    }
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      evictions: this.evictions,
      memoryUsage,
    };
  }

  /**
   * Stop automatic cleanup (for shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Generate SHA-256 cache key from parameters
   * Format: system|code|valueSet|version
   */
  private generateKey(key: CacheKey): string {
    const parts = [
      key.system,
      key.code,
      key.valueSet || '',
      key.fhirVersion,
    ];
    
    const keyString = parts.join('|');
    
    return createHash('sha256')
      .update(keyString)
      .digest('hex');
  }

  /**
   * Check if cache entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    // Infinite TTL never expires
    if (entry.ttl === Infinity) {
      return false;
    }
    
    const age = Date.now() - entry.cachedAt;
    return age > entry.ttl;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime: number = Infinity;
    
    // Find least recently accessed entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
      this.evictions++;
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
    
    // Don't block event loop
    this.cleanupTimer.unref();
  }
}

// ============================================================================
// Batch Cache Operations
// ============================================================================

export class TerminologyCacheBatch {
  private cache: TerminologyCache;
  private operations: Array<{
    key: CacheKey;
    result: CacheEntry['result'];
    isOfflineMode: boolean;
  }> = [];

  constructor(cache: TerminologyCache) {
    this.cache = cache;
  }

  /**
   * Add a set operation to the batch
   */
  addSet(key: CacheKey, result: CacheEntry['result'], isOfflineMode: boolean = false): void {
    this.operations.push({ key, result, isOfflineMode });
  }

  /**
   * Execute all batched operations
   */
  execute(): void {
    for (const op of this.operations) {
      this.cache.set(op.key, op.result, op.isOfflineMode);
    }
    this.operations = [];
  }

  /**
   * Get number of pending operations
   */
  size(): number {
    return this.operations.length;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let cacheInstance: TerminologyCache | null = null;

/**
 * Get or create singleton TerminologyCache instance
 */
export function getTerminologyCache(config?: Partial<CacheConfig>): TerminologyCache {
  if (!cacheInstance) {
    cacheInstance = new TerminologyCache(config);
  }
  return cacheInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetTerminologyCache(): void {
  if (cacheInstance) {
    cacheInstance.destroy();
    cacheInstance = null;
  }
}

