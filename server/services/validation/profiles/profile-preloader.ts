/**
 * Profile Preloader
 * Task 10.8: Pre-load common profiles at startup for better performance
 * 
 * Automatically downloads and caches frequently-used profiles to eliminate
 * cold-start delays during validation.
 */

import { getProfileResolver } from '../utils/profile-resolver';
import { getProfileIndexer } from '../../fhir/profile-indexer';
import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export interface PreloadConfig {
  /** FHIR versions to pre-load profiles for */
  fhirVersions?: Array<'R4' | 'R5' | 'R6'>;
  
  /** Maximum concurrent downloads */
  maxConcurrent?: number;
  
  /** Timeout per profile download (ms) */
  timeout?: number;
  
  /** Whether to pre-load package dependencies */
  includeDependencies?: boolean;
}

export interface PreloadStats {
  /** Total profiles attempted */
  totalProfiles: number;
  
  /** Successfully loaded */
  successCount: number;
  
  /** Failed to load */
  failureCount: number;
  
  /** Already cached (skipped) */
  cachedCount: number;
  
  /** Total time taken (ms) */
  totalTimeMs: number;
  
  /** Results by profile */
  results: Map<string, PreloadResult>;
  
  /** Errors encountered */
  errors: string[];
}

export interface PreloadResult {
  canonicalUrl: string;
  success: boolean;
  cached: boolean;
  timeMs: number;
  error?: string;
}

// ============================================================================
// Common German FHIR Profiles
// ============================================================================

/**
 * Task 10.8: Common German FHIR profiles to pre-load
 * These are the most frequently used profiles in German healthcare
 */
export const COMMON_GERMAN_PROFILES = {
  // MII (Medizininformatik-Initiative) - Research data profiles
  MII: [
    'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient',
    'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/PatientPseudonymisiert',
    'https://www.medizininformatik-initiative.de/fhir/core/modul-diagnose/StructureDefinition/Diagnose',
    'https://www.medizininformatik-initiative.de/fhir/core/modul-labor/StructureDefinition/ObservationLab',
    'https://www.medizininformatik-initiative.de/fhir/core/modul-medikation/StructureDefinition/Medication',
  ],
  
  // ISiK (Informationstechnische Systeme im Krankenhaus) - Hospital IT
  ISIK: [
    'https://gematik.de/fhir/isik/v2/Basismodul/StructureDefinition/ISiKPatient',
    'https://gematik.de/fhir/isik/v2/Basismodul/StructureDefinition/ISiKKontaktGesundheitseinrichtung',
    'https://gematik.de/fhir/isik/v2/Basismodul/StructureDefinition/ISiKDiagnose',
    'https://gematik.de/fhir/isik/v2/Basismodul/StructureDefinition/ISiKProzedur',
    'https://gematik.de/fhir/isik/v2/Basismodul/StructureDefinition/ISiKMedikation',
  ],
  
  // KBV (Kassenärztliche Bundesvereinigung) - Ambulatory care
  KBV: [
    'https://fhir.kbv.de/StructureDefinition/KBV_PR_MIO_CMR_Patient',
    'https://fhir.kbv.de/StructureDefinition/KBV_PR_MIO_Vaccination_Patient',
    'https://fhir.kbv.de/StructureDefinition/KBV_PR_FOR_Patient',
    'https://fhir.kbv.de/StructureDefinition/KBV_PR_BASE_Patient',
  ],
  
  // Basisprofil DE (German Base Profiles)
  BASISPROFIL: [
    'http://fhir.de/StructureDefinition/patient-de-basis',
    'http://fhir.de/StructureDefinition/observation-de-basis',
    'http://fhir.de/StructureDefinition/condition-de-basis',
  ],
  
  // HL7 Deutschland
  HL7_DE: [
    'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',  // Commonly referenced
  ],
};

/**
 * All common profiles flattened
 */
export const ALL_COMMON_PROFILES = [
  ...COMMON_GERMAN_PROFILES.MII,
  ...COMMON_GERMAN_PROFILES.ISIK,
  ...COMMON_GERMAN_PROFILES.KBV,
  ...COMMON_GERMAN_PROFILES.BASISPROFIL,
  ...COMMON_GERMAN_PROFILES.HL7_DE,
];

// ============================================================================
// Profile Preloader
// ============================================================================

export class ProfilePreloader {
  private profileResolver = getProfileResolver();
  private profileIndexer = getProfileIndexer();
  private isPreloading = false;
  private lastPreloadStats: PreloadStats | null = null;

  /**
   * Pre-load common German profiles
   */
  async preloadCommonProfiles(config: PreloadConfig = {}): Promise<PreloadStats> {
    if (this.isPreloading) {
      throw new Error('Preload already in progress');
    }

    this.isPreloading = true;
    const startTime = Date.now();

    const {
      fhirVersions = ['R4'], // Default to R4
      maxConcurrent = 5,
      timeout = 30000,
      includeDependencies = false,
    } = config;

    console.log('[ProfilePreloader] Starting profile preload:', {
      fhirVersions,
      profileCount: ALL_COMMON_PROFILES.length,
      maxConcurrent,
    });

    const stats: PreloadStats = {
      totalProfiles: ALL_COMMON_PROFILES.length * fhirVersions.length,
      successCount: 0,
      failureCount: 0,
      cachedCount: 0,
      totalTimeMs: 0,
      results: new Map(),
      errors: [],
    };

    try {
      // Pre-load for each FHIR version
      for (const fhirVersion of fhirVersions) {
        console.log(`[ProfilePreloader] Pre-loading profiles for ${fhirVersion}...`);

        // Process in batches to control concurrency
        for (let i = 0; i < ALL_COMMON_PROFILES.length; i += maxConcurrent) {
          const batch = ALL_COMMON_PROFILES.slice(i, i + maxConcurrent);

          const batchResults = await Promise.allSettled(
            batch.map(async (canonicalUrl) => {
              const profileStartTime = Date.now();

              try {
                // Check if already cached
                const cached = await this.profileIndexer.findProfileByCanonical(
                  canonicalUrl,
                  fhirVersion
                );

                if (cached) {
                  stats.cachedCount++;
                  const result: PreloadResult = {
                    canonicalUrl,
                    success: true,
                    cached: true,
                    timeMs: Date.now() - profileStartTime,
                  };
                  stats.results.set(`${canonicalUrl}|${fhirVersion}`, result);
                  console.log(`[ProfilePreloader] ✓ ${canonicalUrl} (cached)`);
                  return result;
                }

                // Download and cache profile
                const resolution = await this.profileResolver.resolve(
                  canonicalUrl,
                  fhirVersion,
                  { timeout, resolveDependencies: includeDependencies }
                );

                stats.successCount++;
                const result: PreloadResult = {
                  canonicalUrl,
                  success: true,
                  cached: false,
                  timeMs: Date.now() - profileStartTime,
                };
                stats.results.set(`${canonicalUrl}|${fhirVersion}`, result);
                console.log(`[ProfilePreloader] ✓ ${canonicalUrl} (downloaded)`);
                return result;

              } catch (error) {
                stats.failureCount++;
                const errorMsg = error instanceof Error ? error.message : String(error);
                stats.errors.push(`${canonicalUrl}: ${errorMsg}`);
                
                const result: PreloadResult = {
                  canonicalUrl,
                  success: false,
                  cached: false,
                  timeMs: Date.now() - profileStartTime,
                  error: errorMsg,
                };
                stats.results.set(`${canonicalUrl}|${fhirVersion}`, result);
                console.warn(`[ProfilePreloader] ✗ ${canonicalUrl} - ${errorMsg}`);
                return result;
              }
            })
          );

          // Log batch completion
          const batchSuccess = batchResults.filter(r => r.status === 'fulfilled').length;
          console.log(
            `[ProfilePreloader] Batch complete: ${batchSuccess}/${batch.length} successful`
          );
        }
      }

      stats.totalTimeMs = Date.now() - startTime;
      this.lastPreloadStats = stats;

      console.log('[ProfilePreloader] Preload complete:', {
        total: stats.totalProfiles,
        success: stats.successCount,
        cached: stats.cachedCount,
        failed: stats.failureCount,
        timeMs: stats.totalTimeMs,
      });

      return stats;

    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Pre-load specific profiles
   */
  async preloadProfiles(
    profileUrls: string[],
    fhirVersion: 'R4' | 'R5' | 'R6' = 'R4',
    config: { maxConcurrent?: number; timeout?: number } = {}
  ): Promise<PreloadStats> {
    const { maxConcurrent = 5, timeout = 30000 } = config;

    console.log('[ProfilePreloader] Pre-loading custom profiles:', {
      count: profileUrls.length,
      fhirVersion,
    });

    const startTime = Date.now();
    const stats: PreloadStats = {
      totalProfiles: profileUrls.length,
      successCount: 0,
      failureCount: 0,
      cachedCount: 0,
      totalTimeMs: 0,
      results: new Map(),
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < profileUrls.length; i += maxConcurrent) {
      const batch = profileUrls.slice(i, i + maxConcurrent);

      const batchResults = await Promise.allSettled(
        batch.map(async (canonicalUrl) => {
          const profileStartTime = Date.now();

          try {
            // Check cache
            const cached = await this.profileIndexer.findProfileByCanonical(
              canonicalUrl,
              fhirVersion
            );

            if (cached) {
              stats.cachedCount++;
              const result: PreloadResult = {
                canonicalUrl,
                success: true,
                cached: true,
                timeMs: Date.now() - profileStartTime,
              };
              stats.results.set(canonicalUrl, result);
              return result;
            }

            // Download
            await this.profileResolver.resolve(canonicalUrl, fhirVersion, { timeout });

            stats.successCount++;
            const result: PreloadResult = {
              canonicalUrl,
              success: true,
              cached: false,
              timeMs: Date.now() - profileStartTime,
            };
            stats.results.set(canonicalUrl, result);
            return result;

          } catch (error) {
            stats.failureCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            stats.errors.push(`${canonicalUrl}: ${errorMsg}`);
            
            const result: PreloadResult = {
              canonicalUrl,
              success: false,
              cached: false,
              timeMs: Date.now() - profileStartTime,
              error: errorMsg,
            };
            stats.results.set(canonicalUrl, result);
            return result;
          }
        })
      );
    }

    stats.totalTimeMs = Date.now() - startTime;
    this.lastPreloadStats = stats; // Task 10.8: Store stats
    return stats;
  }

  /**
   * Get last preload statistics
   */
  getLastPreloadStats(): PreloadStats | null {
    return this.lastPreloadStats;
  }

  /**
   * Check if preloading is in progress
   */
  isPreloadInProgress(): boolean {
    return this.isPreloading;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let preloaderInstance: ProfilePreloader | null = null;

export function getProfilePreloader(): ProfilePreloader {
  if (!preloaderInstance) {
    preloaderInstance = new ProfilePreloader();
  }
  return preloaderInstance;
}

/**
 * Initialize profile preloading at startup
 */
export async function initializeProfilePreloading(
  config: PreloadConfig = {}
): Promise<PreloadStats> {
  console.log('[ProfilePreloader] Initializing profile preloading...');
  
  const preloader = getProfilePreloader();
  
  try {
    const stats = await preloader.preloadCommonProfiles(config);
    
    console.log('[ProfilePreloader] Initialization complete:', {
      success: stats.successCount,
      cached: stats.cachedCount,
      failed: stats.failureCount,
      timeMs: stats.totalTimeMs,
    });

    return stats;
  } catch (error) {
    console.error('[ProfilePreloader] Initialization failed:', error);
    throw error;
  }
}

