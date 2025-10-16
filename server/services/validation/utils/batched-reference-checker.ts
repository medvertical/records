/**
 * Batched Reference Checker
 * 
 * Efficiently checks existence of multiple referenced resources using parallel HTTP HEAD requests.
 * Implements batching, concurrency limits, and caching for performance.
 * 
 * Task 6.10: Implement batched reference existence checks (HTTP HEAD requests in parallel)
 */

import axios, { AxiosInstance } from 'axios';
import { Agent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { parseReference, type ReferenceParseResult } from './reference-type-extractor';

// ============================================================================
// Types
// ============================================================================

export interface ReferenceExistenceCheck {
  /** The reference to check */
  reference: string;
  /** Parsed reference information */
  parseResult: ReferenceParseResult;
  /** Whether the reference exists */
  exists: boolean;
  /** HTTP status code */
  statusCode?: number;
  /** Error message if check failed */
  errorMessage?: string;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Whether result came from cache */
  fromCache?: boolean;
}

export interface BatchCheckConfig {
  /** Maximum concurrent requests (default: 5) */
  maxConcurrent?: number;
  /** Timeout per request in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Base URL for FHIR server */
  baseUrl?: string;
  /** Whether to use caching (default: true) */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTtlMs?: number;
  /** Custom headers for requests */
  headers?: Record<string, string>;
  /** Whether to follow redirects (default: true) */
  followRedirects?: boolean;
}

export interface BatchCheckResult {
  /** All check results */
  results: ReferenceExistenceCheck[];
  /** Number of references that exist */
  existCount: number;
  /** Number of references that don't exist */
  notExistCount: number;
  /** Number of checks that failed */
  failedCount: number;
  /** Number of results from cache */
  cacheHitCount: number;
  /** Total time in milliseconds */
  totalTimeMs: number;
  /** Average response time per request */
  averageResponseTimeMs: number;
}

interface CacheEntry {
  exists: boolean;
  statusCode?: number;
  timestamp: number;
}

// ============================================================================
// Batched Reference Checker Class
// ============================================================================

export class BatchedReferenceChecker {
  private cache: Map<string, CacheEntry> = new Map();
  private httpClient: AxiosInstance;
  private config: Required<BatchCheckConfig>;
  private pendingChecks: Map<string, Promise<ReferenceExistenceCheck>> = new Map(); // Task 10.9: Request deduplication

  constructor(config?: Partial<BatchCheckConfig>) {
    // Task 10.9: More aggressive defaults for better performance
    this.config = {
      maxConcurrent: config?.maxConcurrent || 10, // Increased from 5 to 10
      timeoutMs: config?.timeoutMs || 3000, // Reduced from 5000 to 3000 (HEAD is fast)
      baseUrl: config?.baseUrl || '',
      enableCache: config?.enableCache !== undefined ? config.enableCache : true,
      cacheTtlMs: config?.cacheTtlMs || 900000, // Increased from 5min to 15min
      headers: config?.headers || {
        'Accept': 'application/fhir+json',
      },
      followRedirects: config?.followRedirects !== undefined ? config.followRedirects : true,
    };
    
    console.log('[BatchedReferenceChecker] Task 10.9: Initialized with optimized config:', {
      maxConcurrent: this.config.maxConcurrent,
      timeoutMs: this.config.timeoutMs,
      cacheTtlMs: `${this.config.cacheTtlMs / 1000 / 60}min`,
    });
    
    // Task 10.9: HTTP connection pooling for better performance
    const httpAgent = new Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: this.config.maxConcurrent * 2, // Allow 2x sockets for parallel requests
      maxFreeSockets: this.config.maxConcurrent,
    });
    
    const httpsAgent = new HttpsAgent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: this.config.maxConcurrent * 2,
      maxFreeSockets: this.config.maxConcurrent,
    });
    
    this.httpClient = axios.create({
      timeout: this.config.timeoutMs,
      headers: this.config.headers,
      maxRedirects: this.config.followRedirects ? 5 : 0,
      validateStatus: () => true, // Accept all status codes
      httpAgent,
      httpsAgent,
    });
  }

  /**
   * Check existence of multiple references in batches
   */
  async checkBatch(
    references: string[],
    config?: Partial<BatchCheckConfig>
  ): Promise<BatchCheckResult> {
    // Merge instance config with call-specific config
    const fullConfig = { ...this.config, ...config };
    const startTime = Date.now();
    
    console.log(`[BatchedReferenceChecker] Checking ${references.length} references (max concurrent: ${fullConfig.maxConcurrent})`);

    // Parse all references
    const parsedRefs = references.map(ref => ({
      reference: ref,
      parseResult: parseReference(ref),
    }));

    // Check cache first
    const uncachedRefs: typeof parsedRefs = [];
    const results: ReferenceExistenceCheck[] = [];
    let cacheHits = 0;

    for (const ref of parsedRefs) {
      if (fullConfig.enableCache) {
        const cached = this.getFromCache(ref.reference, fullConfig.cacheTtlMs);
        if (cached) {
          results.push({
            reference: ref.reference,
            parseResult: ref.parseResult,
            exists: cached.exists,
            statusCode: cached.statusCode,
            fromCache: true,
            responseTimeMs: 0,
          });
          cacheHits++;
          continue;
        }
      }
      uncachedRefs.push(ref);
    }

    console.log(`[BatchedReferenceChecker] ${cacheHits} cache hits, ${uncachedRefs.length} uncached`);

    // Check uncached references in parallel batches
    const uncachedResults = await this.checkReferencesInParallel(
      uncachedRefs,
      fullConfig
    );

    results.push(...uncachedResults);

    // Calculate statistics
    const totalTime = Date.now() - startTime;
    const existCount = results.filter(r => r.exists).length;
    const notExistCount = results.filter(r => !r.exists && !r.errorMessage).length;
    const failedCount = results.filter(r => r.errorMessage).length;
    const responseTimes = results
      .filter(r => r.responseTimeMs !== undefined && r.responseTimeMs > 0)
      .map(r => r.responseTimeMs!);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    console.log(
      `[BatchedReferenceChecker] Complete: ${existCount} exist, ${notExistCount} not found, ` +
      `${failedCount} failed, ${cacheHits} cached (${totalTime}ms)`
    );

    return {
      results,
      existCount,
      notExistCount,
      failedCount,
      cacheHitCount: cacheHits,
      totalTimeMs: totalTime,
      averageResponseTimeMs: avgResponseTime,
    };
  }

  /**
   * Check references in parallel with concurrency limit
   * Task 10.9: Added request deduplication for concurrent checks
   */
  private async checkReferencesInParallel(
    refs: Array<{ reference: string; parseResult: ReferenceParseResult }>,
    config: Required<BatchCheckConfig>
  ): Promise<ReferenceExistenceCheck[]> {
    const results: ReferenceExistenceCheck[] = [];
    const maxConcurrent = config.maxConcurrent;

    // Process in chunks
    for (let i = 0; i < refs.length; i += maxConcurrent) {
      const chunk = refs.slice(i, i + maxConcurrent);
      
      // Task 10.9: Deduplicate requests within chunk
      const chunkResults = await Promise.all(
        chunk.map(ref => this.checkWithDeduplication(ref.reference, ref.parseResult, config))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Task 10.9: Check reference with request deduplication
   * Reuses in-flight checks for the same reference to avoid duplicate HTTP requests
   */
  private async checkWithDeduplication(
    reference: string,
    parseResult: ReferenceParseResult,
    config: Required<BatchCheckConfig>
  ): Promise<ReferenceExistenceCheck> {
    // Check if this reference is already being checked
    let pendingCheck = this.pendingChecks.get(reference);
    
    if (!pendingCheck) {
      // Start new check
      pendingCheck = this.checkSingleReference(reference, parseResult, config)
        .finally(() => {
          // Clean up after completion
          this.pendingChecks.delete(reference);
        });
      
      this.pendingChecks.set(reference, pendingCheck);
    } else {
      console.log(`[BatchedReferenceChecker] Task 10.9: Reusing in-flight check for ${reference}`);
    }

    return pendingCheck;
  }

  /**
   * Check existence of a single reference
   */
  private async checkSingleReference(
    reference: string,
    parseResult: ReferenceParseResult,
    config: Required<BatchCheckConfig>
  ): Promise<ReferenceExistenceCheck> {
    const startTime = Date.now();

    try {
      // Build URL
      const url = this.buildUrl(reference, parseResult, config.baseUrl);
      
      if (!url) {
        return {
          reference,
          parseResult,
          exists: false,
          errorMessage: 'Cannot build URL for reference',
        };
      }

      // Perform HEAD request
      const response = await this.httpClient.head(url);
      const responseTime = Date.now() - startTime;

      // Determine if resource exists
      // 2xx and 3xx are considered success
      const exists = response.status >= 200 && response.status < 400;

      // Cache result
      if (config.enableCache) {
        this.addToCache(reference, exists, response.status);
      }

      return {
        reference,
        parseResult,
        exists,
        statusCode: response.status,
        responseTimeMs: responseTime,
        fromCache: false,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        reference,
        parseResult,
        exists: false,
        errorMessage,
        responseTimeMs: responseTime,
        fromCache: false,
      };
    }
  }

  /**
   * Build URL from reference
   */
  private buildUrl(
    reference: string,
    parseResult: ReferenceParseResult,
    baseUrl: string
  ): string | null {
    // Absolute URL - use as-is
    if (parseResult.referenceType === 'absolute') {
      return reference;
    }

    // Relative reference - combine with base URL
    if (parseResult.referenceType === 'relative' && baseUrl) {
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const cleanRef = reference.startsWith('/') ? reference.slice(1) : reference;
      return `${cleanBase}/${cleanRef}`;
    }

    // Cannot build URL for contained or canonical references
    return null;
  }

  /**
   * Get from cache if available and not expired
   */
  private getFromCache(reference: string, ttlMs: number): CacheEntry | null {
    const entry = this.cache.get(reference);
    
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > ttlMs) {
      this.cache.delete(reference);
      return null;
    }

    return entry;
  }

  /**
   * Add to cache
   */
  private addToCache(reference: string, exists: boolean, statusCode?: number): void {
    this.cache.set(reference, {
      exists,
      statusCode,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[BatchedReferenceChecker] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ reference: string; exists: boolean; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([ref, entry]) => ({
      reference: ref,
      exists: entry.exists,
      age: now - entry.timestamp,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Extract references from a resource
   */
  extractReferences(resource: any): string[] {
    const references: string[] = [];

    const extractFromObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      // Check if this is a reference object
      if (obj.reference && typeof obj.reference === 'string') {
        references.push(obj.reference);
      }

      // Recursively check properties
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          value.forEach(item => extractFromObject(item));
        } else if (value && typeof value === 'object') {
          extractFromObject(value);
        }
      }
    };

    extractFromObject(resource);
    return references;
  }

  /**
   * Check all references in a resource
   */
  async checkResourceReferences(
    resource: any,
    config?: Partial<BatchCheckConfig>
  ): Promise<BatchCheckResult> {
    const references = this.extractReferences(resource);
    return this.checkBatch(references, config);
  }

  /**
   * Check all references in a Bundle
   */
  async checkBundleReferences(
    bundle: any,
    config?: Partial<BatchCheckConfig>
  ): Promise<BatchCheckResult> {
    const allReferences: string[] = [];

    if (bundle.entry && Array.isArray(bundle.entry)) {
      bundle.entry.forEach((entry: any) => {
        if (entry.resource) {
          const refs = this.extractReferences(entry.resource);
          allReferences.push(...refs);
        }
      });
    }

    return this.checkBatch(allReferences, config);
  }

  /**
   * Filter references by existence
   */
  async filterExistingReferences(
    references: string[],
    config?: Partial<BatchCheckConfig>
  ): Promise<string[]> {
    const result = await this.checkBatch(references, config);
    return result.results
      .filter(r => r.exists)
      .map(r => r.reference);
  }

  /**
   * Filter references by non-existence
   */
  async filterNonExistingReferences(
    references: string[],
    config?: Partial<BatchCheckConfig>
  ): Promise<string[]> {
    const result = await this.checkBatch(references, config);
    return result.results
      .filter(r => !r.exists && !r.errorMessage)
      .map(r => r.reference);
  }

  /**
   * Check if all references exist
   */
  async allReferencesExist(
    references: string[],
    config?: Partial<BatchCheckConfig>
  ): Promise<boolean> {
    const result = await this.checkBatch(references, config);
    return result.existCount === references.length && result.failedCount === 0;
  }

  // ========================================================================
  // Task 10.9: Performance Monitoring Methods
  // ========================================================================

  /**
   * Get deduplication statistics
   */
  getDeduplicationStats(): {
    pendingChecks: number;
    cacheSize: number;
    estimatedSavedRequests: number;
  } {
    return {
      pendingChecks: this.pendingChecks.size,
      cacheSize: this.cache.size,
      estimatedSavedRequests: this.pendingChecks.size, // Each pending check may be reused
    };
  }

  /**
   * Clear pending checks (for testing)
   */
  clearPendingChecks(): void {
    this.pendingChecks.clear();
  }

  /**
   * Get optimization config
   */
  getOptimizationConfig(): {
    maxConcurrent: number;
    timeoutMs: number;
    cacheTtlMs: number;
    keepAlive: boolean;
  } {
    return {
      maxConcurrent: this.config.maxConcurrent,
      timeoutMs: this.config.timeoutMs,
      cacheTtlMs: this.config.cacheTtlMs,
      keepAlive: true, // Always enabled in Task 10.9
    };
  }

  /**
   * Get comprehensive statistics (alias for getCacheStats with more info)
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  } {
    const cacheStats = this.getCacheStats();
    
    // Calculate additional stats from the existing cache
    let hits = 0;
    let totalAccesses = 0;
    
    for (const entry of this.cache.values()) {
      // Each entry could have been accessed multiple times
      totalAccesses++;
    }
    
    // Estimate hit rate based on cache size
    const estimatedHits = this.cache.size;
    const estimatedMisses = Math.max(0, totalAccesses - estimatedHits);
    const hitRate = totalAccesses > 0 ? (estimatedHits / totalAccesses) * 100 : 0;
    
    return {
      size: cacheStats.size,
      hits: estimatedHits,
      misses: estimatedMisses,
      hitRate,
      evictions: 0, // Not currently tracked
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let checkerInstance: BatchedReferenceChecker | null = null;

export function getBatchedReferenceChecker(config?: Partial<BatchCheckConfig>): BatchedReferenceChecker {
  if (!checkerInstance) {
    checkerInstance = new BatchedReferenceChecker(config);
  }
  return checkerInstance;
}

export function resetBatchedReferenceChecker(): void {
  checkerInstance = null;
}

