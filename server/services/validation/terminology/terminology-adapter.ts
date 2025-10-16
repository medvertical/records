/**
 * Terminology Adapter Service
 * 
 * This service provides a unified interface for terminology validation
 * with support for online/offline modes and fallback chains.
 * 
 * Online Mode: Uses tx.fhir.org (FHIR terminology server)
 * Offline Mode: Uses local Ontoserver → cached ValueSets → tx.fhir.org fallback
 */

import { logger } from '../../../utils/logger.js';
import type { ValidationSettings } from '@shared/validation-settings';
import { getTerminologyServerManager, type CodeValidationResult as ServerCodeValidationResult } from './terminology-server-manager';
import { getCoreCodeValidator } from './core-code-validator';

// ============================================================================
// Types
// ============================================================================

export interface ValueSet {
  resourceType: 'ValueSet';
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  expansion?: {
    identifier?: string;
    timestamp?: string;
    total?: number;
    contains?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
}

export interface CodeSystemLookupResult {
  resourceType: 'Parameters';
  parameter?: Array<{
    name: string;
    valueString?: string;
    valueBoolean?: boolean;
    valueCoding?: any;
  }>;
}

export interface TerminologyValidationResult {
  valid: boolean;
  message?: string;
  display?: string;
  system?: string;
  code?: string;
  source?: 'ontoserver' | 'cache' | 'tx.fhir.org';
}

// ============================================================================
// Terminology Adapter
// ============================================================================

// Task 3.12: Fallback metrics interface
export interface FallbackMetrics {
  total: number;
  bySource: {
    ontoserver: number;
    cache: number;
    'tx.fhir.org': number;
  };
  successRate: {
    ontoserver: number; // 0-1
    cache: number;
    'tx.fhir.org': number;
  };
  lastReset: string;
}

export class TerminologyAdapter {
  private cache: Map<string, ValueSet> = new Map();
  private cacheExpiryMs: number = 60 * 60 * 1000; // 1 hour default
  private cacheTimestamps: Map<string, number> = new Map();
  private currentMode: 'online' | 'offline' = 'online';
  private coreValidator = getCoreCodeValidator();

  // Task 3.5/3.6: Mode-specific TTL configuration
  private readonly ONLINE_TTL_MS = 60 * 60 * 1000; // 1 hour for online
  private readonly OFFLINE_TTL_MS = Infinity; // Indefinite for offline

  // Task 3.12: Fallback metrics tracking
  private metrics = {
    total: 0,
    ontoserver: { success: 0, failure: 0 },
    cache: { success: 0, failure: 0 },
    txFhir: { success: 0, failure: 0 },
    lastReset: new Date().toISOString()
  };

  // Track the source of the last resolution
  private lastResolvedSource: 'ontoserver' | 'cache' | 'tx.fhir.org' = 'tx.fhir.org';

  constructor() {
    logger.info('[TerminologyAdapter] Initialized with mode-specific caching and metrics tracking');
  }

  /**
   * Resolve and expand a ValueSet
   * @param valueSetUrl - URL of the ValueSet to expand
   * @param settings - Validation settings including mode configuration
   * @returns Expanded ValueSet
   */
  async resolveValueSet(
    valueSetUrl: string,
    settings: ValidationSettings
  ): Promise<ValueSet> {
    const mode = settings.mode || 'online';
    
    // Task 3.5: Update cache expiry based on mode
    this.updateModeConfiguration(mode);
    
    logger.debug(`[TerminologyAdapter] Resolving ValueSet: ${valueSetUrl} (mode: ${mode}, TTL: ${this.getCacheTTLDescription()})`);

    if (mode === 'online') {
      return this.resolveOnline(valueSetUrl, settings);
    } else {
      return this.resolveOffline(valueSetUrl, settings);
    }
  }

  /**
   * Validate a code against a CodeSystem/ValueSet
   * Now uses TerminologyServerManager for multi-server fallback
   * @param code - Code to validate
   * @param system - Code system
   * @param valueSetUrl - ValueSet URL to validate against (optional)
   * @param settings - Validation settings
   * @returns Validation result
   */
  async validateCode(
    code: string,
    system: string,
    valueSetUrl: string,
    settings: ValidationSettings
  ): Promise<TerminologyValidationResult> {
    try {
      // Check if this is a core FHIR code system first
      const coreResult = this.coreValidator.validateCode(system, code);
      
      if (coreResult.isCoreSystem) {
        console.log(
          `[TerminologyAdapter] Core code validation: ${code} in system: ${system} = ${coreResult.valid}`
        );
        
        return {
          valid: coreResult.valid,
          display: coreResult.display,
          message: coreResult.message,
          code,
          system,
          source: 'cache', // Use 'cache' to indicate no server call needed
        };
      }
      
      // Use TerminologyServerManager if available (fixed URL encoding)
      if (settings.terminologyServers && settings.terminologyServers.length > 0) {
        console.log(`[TerminologyAdapter] Using TerminologyServerManager for ${system}/${code}`);
        return this.validateCodeWithServerManager(code, system, settings);
      }
      
      console.log(`[TerminologyAdapter] Using legacy fallback for ${system}/${code} (terminologyServers: ${settings.terminologyServers?.length || 0})`);
      console.log(`[TerminologyAdapter] Resolving ValueSet: ${valueSetUrl}`);
      // Legacy fallback: resolve ValueSet manually
      const valueSet = await this.resolveValueSet(valueSetUrl, settings);
      console.log(`[TerminologyAdapter] ValueSet resolved, expansion contains ${valueSet.expansion?.contains?.length || 0} codes`);
      
      if (!valueSet.expansion?.contains) {
        console.error(`[TerminologyAdapter] ERROR: ValueSet expansion is empty or missing!`);
        console.error(`[TerminologyAdapter] ValueSet:`, JSON.stringify(valueSet, null, 2));
        return {
          valid: false,
          message: 'ValueSet expansion is empty or unavailable',
          code,
          system
        };
      }
      
      console.log(`[TerminologyAdapter] First few codes in expansion:`, valueSet.expansion.contains.slice(0, 5).map(c => ({code: c.code, system: c.system})));

      // Check if code exists in expansion
      // For simple code fields, system might be empty, so check if code matches
      console.log(`[TerminologyAdapter] Looking for code "${code}" with system "${system}" in expansion`);
      console.log(`[TerminologyAdapter] Available codes:`, valueSet.expansion.contains.map(c => ({code: c.code, system: c.system})));
      
      const found = valueSet.expansion.contains.find(
        c => c.code === code && (system === '' || c.system === system)
      );
      
      console.log(`[TerminologyAdapter] Code found:`, found ? 'YES' : 'NO');
      if (!found) {
        console.log(`[TerminologyAdapter] No match found. Checking individual codes:`);
        valueSet.expansion.contains.forEach(c => {
          const codeMatch = c.code === code;
          const systemMatch = system === '' || c.system === system;
          console.log(`  Code "${c.code}" (${codeMatch ? 'MATCH' : 'NO'}) + System "${c.system}" (${systemMatch ? 'MATCH' : 'NO'}) = ${codeMatch && systemMatch ? 'FOUND' : 'NO'}`);
        });
      }

      if (found) {
        return {
          valid: true,
          display: found.display,
          code,
          system,
          source: this.lastResolvedSource // Task 3.12: Track actual source
        };
      }

      return {
        valid: false,
        message: `Code ${code} not found in ValueSet ${valueSetUrl}`,
        code,
        system
      };
    } catch (error: any) {
      logger.error('[TerminologyAdapter] Code validation failed:', error);
      return {
        valid: false,
        message: `Validation error: ${error.message}`,
        code,
        system
      };
    }
  }

  /**
   * Resolve ValueSet in online mode (direct to tx.fhir.org)
   */
  private async resolveOnline(
    valueSetUrl: string,
    settings: ValidationSettings
  ): Promise<ValueSet> {
    const remoteUrl = settings.terminologyFallback?.remote || 'https://tx.fhir.org/r4';
    
    try {
      logger.debug(`[TerminologyAdapter] Fetching from tx.fhir.org: ${valueSetUrl}`);
      
      const response = await fetch(
        `${remoteUrl}/ValueSet/$expand?url=${encodeURIComponent(valueSetUrl)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/fhir+json',
          },
          signal: AbortSignal.timeout(30000)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to expand ValueSet: ${response.status} ${response.statusText}`);
      }

      const valueSet: ValueSet = await response.json();
      
      // Task 3.12: Track metrics - tx.fhir.org success
      this.trackSuccess('tx.fhir.org');
      this.lastResolvedSource = 'tx.fhir.org';
      
      // Cache the result
      this.cacheValueSet(valueSetUrl, valueSet);
      
      return valueSet;
    } catch (error: any) {
      logger.warn(`[TerminologyAdapter] Online resolve failed: ${error.message}`);
      
      // Task 3.12: Track metrics - tx.fhir.org failure
      this.trackFailure('tx.fhir.org');
      
      // Try cache as fallback
      const cached = this.getCachedValueSet(valueSetUrl);
      if (cached) {
        logger.info('[TerminologyAdapter] Returning cached ValueSet');
        // Task 3.12: Track metrics - cache success (fallback)
        this.trackSuccess('cache');
        this.lastResolvedSource = 'cache';
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Resolve ValueSet in offline mode with fallback chain
   * Priority: Ontoserver → Cache → tx.fhir.org
   */
  private async resolveOffline(
    valueSetUrl: string,
    settings: ValidationSettings
  ): Promise<ValueSet> {
    // 1. Try Ontoserver first
    if (settings.offlineConfig?.ontoserverUrl) {
      try {
        const valueSet = await this.resolveFromOntoserver(
          valueSetUrl,
          settings.offlineConfig.ontoserverUrl
        );
        logger.info('[TerminologyAdapter] Resolved from Ontoserver');
        this.cacheValueSet(valueSetUrl, valueSet);
        
        // Task 3.12: Track metrics - ontoserver success
        this.trackSuccess('ontoserver');
        this.lastResolvedSource = 'ontoserver';
        
        return valueSet;
      } catch (ontoError: any) {
        logger.warn(`[TerminologyAdapter] Ontoserver failed: ${ontoError.message}`);
        
        // Task 3.12: Track metrics - ontoserver failure
        this.trackFailure('ontoserver');
      }
    }

    // 2. Try cache
    const cached = this.getCachedValueSet(valueSetUrl);
    if (cached) {
      logger.info('[TerminologyAdapter] Returning cached ValueSet');
      
      // Task 3.12: Track metrics - cache success
      this.trackSuccess('cache');
      this.lastResolvedSource = 'cache';
      
      return cached;
    }

    // 3. Fallback to tx.fhir.org (last resort)
    logger.info('[TerminologyAdapter] Falling back to tx.fhir.org');
    try {
      const remoteUrl = settings.terminologyFallback?.remote || 'https://tx.fhir.org/r4';
      
      const response = await fetch(
        `${remoteUrl}/ValueSet/$expand?url=${encodeURIComponent(valueSetUrl)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/fhir+json',
          },
          signal: AbortSignal.timeout(30000)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to expand ValueSet: ${response.status}`);
      }

      const valueSet: ValueSet = await response.json();
      this.cacheValueSet(valueSetUrl, valueSet);
      
      // Task 3.12: Track metrics - tx.fhir.org success (fallback)
      this.trackSuccess('tx.fhir.org');
      this.lastResolvedSource = 'tx.fhir.org';
      
      return valueSet;
    } catch (txError: any) {
      logger.error(`[TerminologyAdapter] All fallback methods failed: ${txError.message}`);
      
      // Task 3.12: Track metrics - tx.fhir.org failure
      this.trackFailure('tx.fhir.org');
      
      throw new Error(`Failed to resolve ValueSet ${valueSetUrl}: No sources available`);
    }
  }

  /**
   * Resolve ValueSet from local Ontoserver
   */
  private async resolveFromOntoserver(
    valueSetUrl: string,
    ontoserverUrl: string
  ): Promise<ValueSet> {
    const expandUrl = `${ontoserverUrl}/ValueSet/$expand`;
    
    logger.debug(`[TerminologyAdapter] Querying Ontoserver: ${expandUrl}`);
    
    const response = await fetch(
      `${expandUrl}?url=${encodeURIComponent(valueSetUrl)}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
        },
        signal: AbortSignal.timeout(10000) // Shorter timeout for local server
      }
    );

    if (!response.ok) {
      throw new Error(`Ontoserver returned ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Cache a ValueSet
   */
  private cacheValueSet(url: string, valueSet: ValueSet): void {
    this.cache.set(url, valueSet);
    this.cacheTimestamps.set(url, Date.now());
    logger.debug(`[TerminologyAdapter] Cached ValueSet: ${url}`);
  }

  /**
   * Get cached ValueSet (if not expired)
   */
  private getCachedValueSet(url: string): ValueSet | null {
    const cached = this.cache.get(url);
    const timestamp = this.cacheTimestamps.get(url);

    if (!cached || !timestamp) {
      return null;
    }

    // Task 3.5/3.6: Check expiry based on current mode
    // Offline mode: Indefinite cache (never expires)
    // Online mode: 1 hour TTL
    if (this.cacheExpiryMs !== Infinity && Date.now() - timestamp > this.cacheExpiryMs) {
      logger.debug(`[TerminologyAdapter] Cache expired for: ${url} (TTL: ${this.cacheExpiryMs}ms)`);
      this.cache.delete(url);
      this.cacheTimestamps.delete(url);
      return null;
    }

    logger.debug(`[TerminologyAdapter] Cache hit for: ${url} (age: ${Math.floor((Date.now() - timestamp) / 1000)}s)`);
    return cached;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    logger.info('[TerminologyAdapter] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Set cache expiry time
   */
  setCacheExpiry(ms: number): void {
    this.cacheExpiryMs = ms;
    logger.info(`[TerminologyAdapter] Cache expiry set to ${ms}ms`);
  }

  /**
   * Task 3.5: Update mode configuration and cache expiry
   */
  private updateModeConfiguration(mode: 'online' | 'offline'): void {
    if (this.currentMode === mode) {
      return; // No change needed
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;

    // Update TTL based on mode
    if (mode === 'offline') {
      this.cacheExpiryMs = this.OFFLINE_TTL_MS;
      logger.info('[TerminologyAdapter] Switched to OFFLINE mode: Cache TTL set to indefinite');
    } else {
      this.cacheExpiryMs = this.ONLINE_TTL_MS;
      logger.info('[TerminologyAdapter] Switched to ONLINE mode: Cache TTL set to 1 hour');
    }

    // Task 3.5: Invalidate cache on mode switch (optional, can be configured)
    // For now, we keep the cache to avoid unnecessary fetches
    logger.info(`[TerminologyAdapter] Mode changed: ${previousMode} → ${mode}`);
  }

  /**
   * Get current cache TTL description
   */
  private getCacheTTLDescription(): string {
    if (this.cacheExpiryMs === Infinity) {
      return 'indefinite';
    }
    const hours = Math.floor(this.cacheExpiryMs / (60 * 60 * 1000));
    const minutes = Math.floor((this.cacheExpiryMs % (60 * 60 * 1000)) / (60 * 1000));
    return hours > 0 ? `${hours}h` : `${minutes}m`;
  }

  /**
   * Task 3.5: Invalidate cache on mode switch (optional method)
   */
  invalidateCacheOnModeSwitch(): void {
    logger.info('[TerminologyAdapter] Invalidating cache due to mode switch');
    this.clearCache();
  }

  /**
   * Get current mode
   */
  getCurrentMode(): 'online' | 'offline' {
    return this.currentMode;
  }

  /**
   * Task 3.12: Track successful terminology lookup
   */
  private trackSuccess(source: 'ontoserver' | 'cache' | 'tx.fhir.org'): void {
    this.metrics.total++;
    
    if (source === 'ontoserver') {
      this.metrics.ontoserver.success++;
    } else if (source === 'cache') {
      this.metrics.cache.success++;
    } else {
      this.metrics.txFhir.success++;
    }
    
    logger.debug(`[TerminologyAdapter] Metrics: ${source} success (total: ${this.metrics.total})`);
  }

  /**
   * Task 3.12: Track failed terminology lookup
   */
  private trackFailure(source: 'ontoserver' | 'cache' | 'tx.fhir.org'): void {
    if (source === 'ontoserver') {
      this.metrics.ontoserver.failure++;
    } else if (source === 'cache') {
      this.metrics.cache.failure++;
    } else {
      this.metrics.txFhir.failure++;
    }
    
    logger.debug(`[TerminologyAdapter] Metrics: ${source} failure`);
  }

  /**
   * Validate code using TerminologyServerManager (multi-server fallback)
   * @param code - Code to validate
   * @param system - Code system
   * @param settings - Validation settings with terminologyServers
   * @returns Validation result
   */
  private async validateCodeWithServerManager(
    code: string,
    system: string,
    settings: ValidationSettings
  ): Promise<TerminologyValidationResult> {
    try {
      console.log(`[TerminologyAdapter] validateCodeWithServerManager called for ${system}/${code}`);
      console.log(`[TerminologyAdapter] Settings terminologyServers:`, settings.terminologyServers?.length || 0);
      
      // Get or create server manager with current settings
      const serverManager = getTerminologyServerManager(settings.terminologyServers);
      
      // Detect FHIR version (use R5 for better compatibility)
      const fhirVersion = 'R5'; // Use R5 for better terminology server compatibility
      console.log(`[TerminologyAdapter] Using FHIR version: ${fhirVersion} for ${system}/${code}`);
      
      console.log(`[TerminologyAdapter] Calling serverManager.validateCode for ${system}/${code} with FHIR version ${fhirVersion}`);
      
      // Validate using server manager (handles fallback automatically)
      const valueSetUrl = fhirVersion === 'R5' ? 'http://hl7.org/fhir/ValueSet/administrative-gender' : 'http://hl7.org/fhir/ValueSet/administrative-gender';
      console.log(`[TerminologyAdapter] Using ValueSet URL: ${valueSetUrl}`);
      
      const result: ServerCodeValidationResult = await serverManager.validateCode(
        system,
        code,
        fhirVersion,
        valueSetUrl
      );
      
      logger.debug(
        `[TerminologyAdapter] Code validation via ${result.serverUsed}: ` +
        `${system}/${code} = ${result.valid} (${result.responseTime}ms, cached: ${result.cached})`
      );
      
      return {
        valid: result.valid,
        display: result.display,
        code,
        system,
        source: result.cached ? 'cache' : 'tx.fhir.org' // Simplified source
      };
      
    } catch (error) {
      logger.error('[TerminologyAdapter] Server manager validation failed:', error);
      
      // Return invalid with error message
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Terminology validation failed',
        code,
        system
      };
    }
  }

  /**
   * Task 3.12: Get fallback metrics
   */
  getFallbackMetrics(): FallbackMetrics {
    const ontoTotal = this.metrics.ontoserver.success + this.metrics.ontoserver.failure;
    const cacheTotal = this.metrics.cache.success + this.metrics.cache.failure;
    const txTotal = this.metrics.txFhir.success + this.metrics.txFhir.failure;

    return {
      total: this.metrics.total,
      bySource: {
        ontoserver: this.metrics.ontoserver.success,
        cache: this.metrics.cache.success,
        'tx.fhir.org': this.metrics.txFhir.success
      },
      successRate: {
        ontoserver: ontoTotal > 0 ? this.metrics.ontoserver.success / ontoTotal : 0,
        cache: cacheTotal > 0 ? this.metrics.cache.success / cacheTotal : 1, // Cache hits are always success
        'tx.fhir.org': txTotal > 0 ? this.metrics.txFhir.success / txTotal : 0
      },
      lastReset: this.metrics.lastReset
    };
  }

  /**
   * Task 3.12: Reset fallback metrics
   */
  resetMetrics(): void {
    this.metrics = {
      total: 0,
      ontoserver: { success: 0, failure: 0 },
      cache: { success: 0, failure: 0 },
      txFhir: { success: 0, failure: 0 },
      lastReset: new Date().toISOString()
    };
    logger.info('[TerminologyAdapter] Metrics reset');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let terminologyAdapterInstance: TerminologyAdapter | null = null;

/**
 * Get or create the singleton Terminology Adapter instance
 */
export function getTerminologyAdapter(): TerminologyAdapter {
  if (!terminologyAdapterInstance) {
    terminologyAdapterInstance = new TerminologyAdapter();
  }
  return terminologyAdapterInstance;
}

export default getTerminologyAdapter;

