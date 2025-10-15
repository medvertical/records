/**
 * Terminology Cache Warmer
 * 
 * Pre-populates terminology cache with common codes and ValueSets to improve
 * first-request performance. Runs on server startup and periodically in background.
 * 
 * Common ValueSets to warm:
 * - administrative-gender (Patient.gender)
 * - observation-status (Observation.status)
 * - condition-clinical/verification (Condition status)
 * - encounter-status (Encounter.status)
 * - medication-status codes
 * 
 * Responsibilities: Cache pre-population ONLY
 * - Does not perform validation logic (handled by DirectTerminologyClient)
 * - Does not manage cache (handled by TerminologyCache)
 * 
 * File size: ~250 lines (adhering to global.mdc standards)
 */

import { getDirectTerminologyClient, type ValidateCodeParams } from './direct-terminology-client';
import { getTerminologyCache, type CacheKey } from './terminology-cache';
import { getTerminologyServerRouter } from './terminology-server-router';
import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Common Codes for Cache Warming
// ============================================================================

interface CommonCode {
  system: string;
  code: string;
  display: string;
  valueSet: string;
}

const COMMON_CODES: CommonCode[] = [
  // Administrative Gender (Patient.gender)
  { system: 'http://hl7.org/fhir/administrative-gender', code: 'male', display: 'Male', valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender' },
  { system: 'http://hl7.org/fhir/administrative-gender', code: 'female', display: 'Female', valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender' },
  { system: 'http://hl7.org/fhir/administrative-gender', code: 'other', display: 'Other', valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender' },
  { system: 'http://hl7.org/fhir/administrative-gender', code: 'unknown', display: 'Unknown', valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender' },
  
  // Observation Status
  { system: 'http://hl7.org/fhir/observation-status', code: 'registered', display: 'Registered', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  { system: 'http://hl7.org/fhir/observation-status', code: 'preliminary', display: 'Preliminary', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  { system: 'http://hl7.org/fhir/observation-status', code: 'final', display: 'Final', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  { system: 'http://hl7.org/fhir/observation-status', code: 'amended', display: 'Amended', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  { system: 'http://hl7.org/fhir/observation-status', code: 'corrected', display: 'Corrected', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  { system: 'http://hl7.org/fhir/observation-status', code: 'cancelled', display: 'Cancelled', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  { system: 'http://hl7.org/fhir/observation-status', code: 'entered-in-error', display: 'Entered in Error', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  { system: 'http://hl7.org/fhir/observation-status', code: 'unknown', display: 'Unknown', valueSet: 'http://hl7.org/fhir/ValueSet/observation-status' },
  
  // Condition Clinical Status
  { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active', valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'recurrence', display: 'Recurrence', valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'relapse', display: 'Relapse', valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'inactive', display: 'Inactive', valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'remission', display: 'Remission', valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'resolved', display: 'Resolved', valueSet: 'http://hl7.org/fhir/ValueSet/condition-clinical' },
  
  // Condition Verification Status
  { system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed', display: 'Unconfirmed', valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'provisional', display: 'Provisional', valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'differential', display: 'Differential', valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed', valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'refuted', display: 'Refuted', valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status' },
  { system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'entered-in-error', display: 'Entered in Error', valueSet: 'http://hl7.org/fhir/ValueSet/condition-ver-status' },
  
  // Encounter Status
  { system: 'http://hl7.org/fhir/encounter-status', code: 'planned', display: 'Planned', valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status' },
  { system: 'http://hl7.org/fhir/encounter-status', code: 'arrived', display: 'Arrived', valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status' },
  { system: 'http://hl7.org/fhir/encounter-status', code: 'triaged', display: 'Triaged', valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status' },
  { system: 'http://hl7.org/fhir/encounter-status', code: 'in-progress', display: 'In Progress', valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status' },
  { system: 'http://hl7.org/fhir/encounter-status', code: 'finished', display: 'Finished', valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status' },
  { system: 'http://hl7.org/fhir/encounter-status', code: 'cancelled', display: 'Cancelled', valueSet: 'http://hl7.org/fhir/ValueSet/encounter-status' },
];

// ============================================================================
// Cache Warmer
// ============================================================================

export class TerminologyCacheWarmer {
  private client = getDirectTerminologyClient();
  private cache = getTerminologyCache();
  private router = getTerminologyServerRouter();
  private isWarming: boolean = false;

  /**
   * Warm cache with common codes for all FHIR versions
   * 
   * @param settings - Validation settings
   * @returns Statistics about cache warming operation
   */
  async warmCache(settings?: ValidationSettings): Promise<WarmingStats> {
    if (this.isWarming) {
      console.warn('[CacheWarmer] Cache warming already in progress');
      return this.createEmptyStats();
    }

    this.isWarming = true;
    const startTime = Date.now();
    
    try {
      console.log(`[CacheWarmer] Starting cache warming for ${COMMON_CODES.length} common codes`);

      const stats: WarmingStats = {
        totalCodes: COMMON_CODES.length,
        successCount: 0,
        failureCount: 0,
        cacheHits: 0,
        byVersion: new Map(),
        totalTime: 0,
      };

      // Warm cache for each supported FHIR version
      const versions: Array<'R4' | 'R5' | 'R6'> = ['R4', 'R5', 'R6'];
      
      for (const version of versions) {
        const versionStats = await this.warmCacheForVersion(version, settings);
        stats.successCount += versionStats.successCount;
        stats.failureCount += versionStats.failureCount;
        stats.cacheHits += versionStats.cacheHits;
        stats.byVersion.set(version, versionStats);
      }

      stats.totalTime = Date.now() - startTime;
      
      console.log(
        `[CacheWarmer] Cache warming complete: ${stats.successCount} success, ` +
        `${stats.cacheHits} cache hits, ${stats.failureCount} failures ` +
        `(${stats.totalTime}ms)`
      );

      return stats;

    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm cache for a specific FHIR version
   */
  private async warmCacheForVersion(
    fhirVersion: 'R4' | 'R5' | 'R6',
    settings?: ValidationSettings
  ): Promise<VersionWarmingStats> {
    const isOfflineMode = settings?.mode === 'offline';
    
    console.log(
      `[CacheWarmer] Warming cache for ${fhirVersion} ` +
      `(${isOfflineMode ? 'offline' : 'online'})`
    );

    const stats: VersionWarmingStats = {
      version: fhirVersion,
      successCount: 0,
      failureCount: 0,
      cacheHits: 0,
      time: 0,
    };

    const startTime = Date.now();

    // Get server for this version
    const serverSelection = this.router.getServerForVersion(fhirVersion, settings);

    // Validate each common code
    for (const commonCode of COMMON_CODES) {
      try {
        // Check cache first
        const cacheKey: CacheKey = {
          system: commonCode.system,
          code: commonCode.code,
          valueSet: commonCode.valueSet,
          fhirVersion,
        };

        if (this.cache.has(cacheKey)) {
          stats.cacheHits++;
          continue;
        }

        // Validate and cache
        const params: ValidateCodeParams = {
          system: commonCode.system,
          code: commonCode.code,
          display: commonCode.display,
          valueSet: commonCode.valueSet,
          fhirVersion,
        };

        const result = await this.client.validateCode(params, serverSelection.url);
        
        // Cache the result
        this.cache.set(cacheKey, result, isOfflineMode);
        
        stats.successCount++;

      } catch (error) {
        stats.failureCount++;
        console.warn(
          `[CacheWarmer] Failed to warm code ${commonCode.code} ` +
          `for ${fhirVersion}:`,
          error
        );
      }
    }

    stats.time = Date.now() - startTime;
    
    console.log(
      `[CacheWarmer] ${fhirVersion} warming complete: ` +
      `${stats.successCount} success, ${stats.cacheHits} hits, ` +
      `${stats.failureCount} failures (${stats.time}ms)`
    );

    return stats;
  }

  /**
   * Check if cache warming is in progress
   */
  isWarmingInProgress(): boolean {
    return this.isWarming;
  }

  /**
   * Get list of codes that will be warmed
   */
  getCommonCodes(): CommonCode[] {
    return [...COMMON_CODES];
  }

  private createEmptyStats(): WarmingStats {
    return {
      totalCodes: 0,
      successCount: 0,
      failureCount: 0,
      cacheHits: 0,
      byVersion: new Map(),
      totalTime: 0,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

export interface WarmingStats {
  totalCodes: number;
  successCount: number;
  failureCount: number;
  cacheHits: number;
  byVersion: Map<'R4' | 'R5' | 'R6', VersionWarmingStats>;
  totalTime: number;
}

export interface VersionWarmingStats {
  version: 'R4' | 'R5' | 'R6';
  successCount: number;
  failureCount: number;
  cacheHits: number;
  time: number;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let warmerInstance: TerminologyCacheWarmer | null = null;

/**
 * Get or create singleton TerminologyCacheWarmer instance
 */
export function getCacheWarmer(): TerminologyCacheWarmer {
  if (!warmerInstance) {
    warmerInstance = new TerminologyCacheWarmer();
  }
  return warmerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCacheWarmer(): void {
  warmerInstance = null;
}

/**
 * Start cache warming on server startup
 * Runs in background, doesn't block startup
 */
export async function startBackgroundCacheWarming(settings?: ValidationSettings): Promise<void> {
  const warmer = getCacheWarmer();
  
  console.log('[CacheWarmer] Starting background cache warming...');
  
  // Run in background (don't await)
  warmer.warmCache(settings)
    .then(stats => {
      console.log(
        `[CacheWarmer] Background warming complete: ` +
        `${stats.successCount} codes cached in ${stats.totalTime}ms`
      );
    })
    .catch(error => {
      console.error('[CacheWarmer] Background warming failed:', error);
    });
}

