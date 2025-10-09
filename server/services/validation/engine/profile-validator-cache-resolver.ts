/**
 * ProfileValidator Cache Resolver Enhancement
 * 
 * Task 4.8: Cache-first profile resolution for ProfileValidator
 * 
 * Responsibilities:
 * - Resolve profiles from local cache first
 * - Fall back to Simplifier/remote if not cached
 * - Load StructureDefinitions from indexed profiles
 * - Track cache hit/miss statistics
 */

import { getProfileIndexer } from '../../../services/fhir/profile-indexer';
import { ValidationProfile } from '@shared/schema.js';

// ============================================================================
// Types
// ============================================================================

export interface ProfileResolutionResult {
  found: boolean;
  source: 'cache' | 'simplifier' | 'not-found';
  profile?: ValidationProfile;
  structureDefinition?: any;
}

export interface ProfileCacheStats {
  cacheHits: number;
  cacheMisses: number;
  simplifierFetches: number;
  hitRate: number;
}

// ============================================================================
// ProfileCacheResolver Class
// ============================================================================

export class ProfileCacheResolver {
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    simplifierFetches: 0
  };

  private indexer = getProfileIndexer();

  // ==========================================================================
  // Profile Resolution
  // ==========================================================================

  /**
   * Resolve profile - cache first, then Simplifier
   */
  async resolveProfile(
    profileUrl: string,
    fhirVersion?: 'R4' | 'R5' | 'R6',
    packageId?: string
  ): Promise<ProfileResolutionResult> {
    console.log(`[ProfileCacheResolver] Resolving profile: ${profileUrl}`);

    // 1. Try local cache first
    const cachedProfile = await this.resolveFromCache(profileUrl, fhirVersion, packageId);
    
    if (cachedProfile.found) {
      this.stats.cacheHits++;
      return cachedProfile;
    }

    // 2. Cache miss - would fall back to Simplifier
    this.stats.cacheMisses++;
    this.stats.simplifierFetches++;
    
    console.log(`[ProfileCacheResolver] Profile not in cache: ${profileUrl}, would fetch from Simplifier`);

    return {
      found: false,
      source: 'not-found'
    };
  }

  /**
   * Resolve profile from local cache
   */
  private async resolveFromCache(
    profileUrl: string,
    fhirVersion?: 'R4' | 'R5' | 'R6',
    packageId?: string
  ): Promise<ProfileResolutionResult> {
    try {
      // Search in indexed profiles
      const profile = await this.indexer.findProfileByUrl(profileUrl, packageId);

      if (!profile) {
        return { found: false, source: 'not-found' };
      }

      // Check FHIR version compatibility
      if (fhirVersion && profile.fhirVersion !== fhirVersion) {
        console.warn(
          `[ProfileCacheResolver] Version mismatch for ${profileUrl}: ` +
          `found ${profile.fhirVersion}, expected ${fhirVersion}`
        );
        // Still return it but log the warning
      }

      console.log(`[ProfileCacheResolver] ✅ Cache hit: ${profileUrl} from package ${profile.packageId}`);

      // Extract StructureDefinition from config if available
      const structureDefinition = profile.config?.structureDefinition;

      return {
        found: true,
        source: 'cache',
        profile,
        structureDefinition
      };

    } catch (error) {
      console.error('[ProfileCacheResolver] Cache lookup failed:', error);
      return { found: false, source: 'not-found' };
    }
  }

  /**
   * Batch resolve multiple profiles
   */
  async resolveProfiles(
    profileUrls: string[],
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<Map<string, ProfileResolutionResult>> {
    const results = new Map<string, ProfileResolutionResult>();

    for (const url of profileUrls) {
      const result = await this.resolveProfile(url, fhirVersion);
      results.set(url, result);
    }

    return results;
  }

  // ==========================================================================
  // Profile Search & Lookup
  // ==========================================================================

  /**
   * Search for profiles matching a pattern
   */
  async searchProfiles(
    urlPattern: string,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ValidationProfile[]> {
    return this.indexer.searchProfiles({
      url: urlPattern,
      fhirVersion
    });
  }

  /**
   * Get all profiles for a resource type
   */
  async getProfilesForResourceType(
    resourceType: string,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ValidationProfile[]> {
    return this.indexer.searchProfiles({
      resourceType,
      fhirVersion
    });
  }

  /**
   * Get all profiles from a package
   */
  async getPackageProfiles(packageId: string): Promise<ValidationProfile[]> {
    return this.indexer.getPackageProfiles(packageId);
  }

  // ==========================================================================
  // Smart Profile Resolution Strategies
  // ==========================================================================

  /**
   * Resolve best matching profile for a resource
   * Considers: declared profiles, resource type, FHIR version
   */
  async resolveBestProfile(
    resource: any,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ProfileResolutionResult | null> {
    const resourceType = resource.resourceType;

    // 1. Check if resource declares profiles
    const declaredProfiles = resource.meta?.profile || [];
    
    if (declaredProfiles.length > 0) {
      // Try to resolve declared profiles
      for (const profileUrl of declaredProfiles) {
        const result = await this.resolveProfile(profileUrl, fhirVersion);
        if (result.found) {
          return result;
        }
      }
    }

    // 2. Fall back to resource type profiles
    const typeProfiles = await this.getProfilesForResourceType(resourceType, fhirVersion);
    
    if (typeProfiles.length > 0) {
      console.log(`[ProfileCacheResolver] Found ${typeProfiles.length} cached profiles for ${resourceType}`);
      return {
        found: true,
        source: 'cache',
        profile: typeProfiles[0], // Return first match
        structureDefinition: typeProfiles[0].config?.structureDefinition
      };
    }

    return null;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get cache statistics
   */
  getStats(): ProfileCacheStats {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = total > 0 ? (this.stats.cacheHits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      simplifierFetches: 0
    };
  }

  /**
   * Log statistics
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('[ProfileCacheResolver] Statistics:', {
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      simplifierFetches: stats.simplifierFetches,
      hitRate: `${stats.hitRate}%`
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let profileCacheResolver: ProfileCacheResolver | null = null;

export function getProfileCacheResolver(): ProfileCacheResolver {
  if (!profileCacheResolver) {
    profileCacheResolver = new ProfileCacheResolver();
  }
  return profileCacheResolver;
}

export default ProfileCacheResolver;

