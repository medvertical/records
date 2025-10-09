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

export class TerminologyAdapter {
  private cache: Map<string, ValueSet> = new Map();
  private cacheExpiryMs: number = 60 * 60 * 1000; // 1 hour
  private cacheTimestamps: Map<string, number> = new Map();

  constructor() {
    logger.info('[TerminologyAdapter] Initialized');
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
    
    logger.debug(`[TerminologyAdapter] Resolving ValueSet: ${valueSetUrl} (mode: ${mode})`);

    if (mode === 'online') {
      return this.resolveOnline(valueSetUrl, settings);
    } else {
      return this.resolveOffline(valueSetUrl, settings);
    }
  }

  /**
   * Validate a code against a ValueSet
   * @param code - Code to validate
   * @param system - Code system
   * @param valueSetUrl - ValueSet URL to validate against
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
      const valueSet = await this.resolveValueSet(valueSetUrl, settings);
      
      if (!valueSet.expansion?.contains) {
        return {
          valid: false,
          message: 'ValueSet expansion is empty or unavailable',
          code,
          system
        };
      }

      // Check if code exists in expansion
      const found = valueSet.expansion.contains.find(
        c => c.code === code && c.system === system
      );

      if (found) {
        return {
          valid: true,
          display: found.display,
          code,
          system,
          source: 'tx.fhir.org' // We'd track the actual source
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
      
      // Cache the result
      this.cacheValueSet(valueSetUrl, valueSet);
      
      return valueSet;
    } catch (error: any) {
      logger.warn(`[TerminologyAdapter] Online resolve failed: ${error.message}`);
      
      // Try cache as fallback
      const cached = this.getCachedValueSet(valueSetUrl);
      if (cached) {
        logger.info('[TerminologyAdapter] Returning cached ValueSet');
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
        return valueSet;
      } catch (ontoError: any) {
        logger.warn(`[TerminologyAdapter] Ontoserver failed: ${ontoError.message}`);
      }
    }

    // 2. Try cache
    const cached = this.getCachedValueSet(valueSetUrl);
    if (cached) {
      logger.info('[TerminologyAdapter] Returning cached ValueSet');
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
      
      return valueSet;
    } catch (txError: any) {
      logger.error(`[TerminologyAdapter] All fallback methods failed: ${txError.message}`);
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

    // Check expiry
    if (Date.now() - timestamp > this.cacheExpiryMs) {
      logger.debug(`[TerminologyAdapter] Cache expired for: ${url}`);
      this.cache.delete(url);
      this.cacheTimestamps.delete(url);
      return null;
    }

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

