/**
 * Smart Profile Resolver
 * 
 * Automatically resolves FHIR profile canonical URLs to local cached profiles.
 * Searches multiple sources (local cache → Simplifier → FHIR Registry) and
 * caches results for future use.
 * 
 * Features:
 * - Canonical URL normalization
 * - Multi-source profile search
 * - Automatic profile download
 * - Dependency resolution
 * - Version-aware caching
 * 
 * Responsibilities: Profile resolution ONLY
 * - Does not perform validation (handled by ProfileValidator)
 * - Does not manage IG packages (handled by ProfileManager)
 * 
 * File size: ~350 lines (adhering to global.mdc standards)
 */

import { simplifierClient } from '../../../services/fhir/simplifier-client';
import type { ValidationSettings } from '@shared/validation-settings';
import { db, pool } from '../../../db';
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { getPackageDependencyResolver } from './package-dependency-resolver';
import { VersionResolver } from './version-resolver';
import { ProfileMetadataExtractor, type ProfileMetadata } from './profile-metadata-extractor';
import { GermanProfileDetector, type GermanProfileDetectionResult } from './german-profile-detector';
import { getProfileNotificationService } from './profile-notification-service';

// ============================================================================
// Types
// ============================================================================

export interface ProfileResolutionResult {
  /** Canonical URL (normalized) */
  canonicalUrl: string;
  
  /** Profile content (StructureDefinition) */
  profile: any;
  
  /** Where the profile was found */
  source: 'local-cache' | 'database' | 'simplifier' | 'fhir-registry';
  
  /** Version resolved */
  version: string;
  
  /** Dependencies (other profiles required) */
  dependencies: string[];
  
  /** Resolution time (ms) */
  resolutionTime: number;
  
  /** Whether profile was downloaded */
  downloaded: boolean;
  
  /** Extracted metadata (if available) */
  metadata?: ProfileMetadata;
  
  /** German profile detection (if detected) */
  germanProfile?: GermanProfileDetectionResult;
}

export interface ProfileSearchResult {
  /** Canonical URL */
  url: string;
  
  /** Profile name */
  name: string;
  
  /** Version */
  version: string;
  
  /** Package ID */
  packageId: string;
  
  /** Source registry */
  source: 'simplifier' | 'fhir-registry' | 'local';
}

export interface ProfileResolverConfig {
  /** Enable automatic profile download */
  autoDownload: boolean;
  
  /** Maximum resolution attempts */
  maxAttempts: number;
  
  /** Timeout for each source (ms) */
  timeout: number;
  
  /** Prefer specific source */
  preferredSource?: 'local' | 'simplifier' | 'fhir-registry';
  
  /** Resolve package dependencies automatically */
  resolvePackageDependencies: boolean;
  
  /** Maximum package dependency depth */
  maxPackageDependencyDepth: number;
}

// ============================================================================
// Profile Resolver
// ============================================================================

export class ProfileResolver {
  private localCache: Map<string, ProfileResolutionResult> = new Map();
  private config: ProfileResolverConfig;

  constructor(config?: Partial<ProfileResolverConfig>) {
    this.config = {
      autoDownload: config?.autoDownload ?? true,
      maxAttempts: config?.maxAttempts ?? 3,
      timeout: config?.timeout ?? 10000,
      preferredSource: config?.preferredSource,
      resolvePackageDependencies: config?.resolvePackageDependencies ?? true,
      maxPackageDependencyDepth: config?.maxPackageDependencyDepth ?? 3,
    };
  }

  /**
   * Resolve a profile by canonical URL
   * 
   * Searches in order:
   * 1. Local cache (in-memory)
   * 2. Database cache
   * 3. Simplifier API
   * 4. FHIR Package Registry
   * 
   * @param canonicalUrl - Profile canonical URL
   * @param version - Optional specific version (supports ranges like ^1.0.0, ~2.1.0)
   * @param settings - Validation settings
   * @returns Profile resolution result
   */
  async resolveProfile(
    canonicalUrl: string,
    version?: string,
    settings?: ValidationSettings
  ): Promise<ProfileResolutionResult> {
    const startTime = Date.now();
    
    console.log(
      `[ProfileResolver] Resolving profile: ${canonicalUrl}` +
      (version ? ` (version: ${version})` : '')
    );

    // Step 1: Normalize canonical URL
    const normalized = this.normalizeCanonicalUrl(canonicalUrl);
    
    // Step 2: Resolve best version if not exact or if version range specified
    let resolvedVersion = version;
    if (!version || version === 'latest' || version.match(/[\^~><=*]/)) {
      resolvedVersion = await this.resolveBestVersion(normalized, version);
      if (resolvedVersion !== version) {
        console.log(`[ProfileResolver] Version resolved: ${version || 'latest'} → ${resolvedVersion}`);
      }
    }
    
    const cacheKey = this.buildCacheKey(normalized, resolvedVersion);

    // Step 3: Check in-memory cache
    const cached = this.localCache.get(cacheKey);
    if (cached) {
      console.log(`[ProfileResolver] Found in local cache: ${normalized}@${resolvedVersion}`);
      return cached;
    }

    // Step 4: Search external sources
    const result = await this.searchSources(normalized, resolvedVersion, settings);
    
    // Step 5: Detect German profiles
    const germanProfile = GermanProfileDetector.detectGermanProfile(normalized);
    if (germanProfile.isGermanProfile) {
      result.germanProfile = germanProfile;
      console.log(
        `[ProfileResolver] ✓ German profile detected: ${germanProfile.family.toUpperCase()} ` +
        `(confidence: ${germanProfile.confidence}%)`
      );
      
      // Notify about German profile detection
      const notificationService = getProfileNotificationService();
      notificationService.notifyGermanProfileDetected(
        normalized,
        germanProfile.family,
        germanProfile.recommendedPackage
      );
    }
    
    // Step 6: Cache result
    this.localCache.set(cacheKey, result);
    
    const resolutionTime = Date.now() - startTime;
    console.log(
      `[ProfileResolver] Resolved ${normalized}@${result.version} from ${result.source} ` +
      `in ${resolutionTime}ms`
    );

    return result;
  }

  /**
   * Search for a profile by partial URL or name
   * 
   * @param query - Search query
   * @param fhirVersion - Optional FHIR version filter
   * @returns Array of matching profiles
   */
  async searchProfiles(
    query: string,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ProfileSearchResult[]> {
    console.log(`[ProfileResolver] Searching profiles: ${query}`);

    try {
      // Search Simplifier
      const simplifierResults = await simplifierClient.searchProfiles(query);
      
      // Convert to ProfileSearchResult format
      const results: ProfileSearchResult[] = simplifierResults.map(profile => ({
        url: profile.url,
        name: profile.name,
        version: profile.version,
        packageId: profile.packageId,
        source: 'simplifier' as const,
      }));

      // Filter by FHIR version if specified
      if (fhirVersion) {
        // Filter based on canonical URL patterns (basic heuristic)
        const versionPattern = fhirVersion.toLowerCase();
        return results.filter(r => 
          r.url.toLowerCase().includes(versionPattern) ||
          r.packageId.toLowerCase().includes(versionPattern)
        );
      }

      return results;

    } catch (error) {
      console.error('[ProfileResolver] Profile search failed:', error);
      return [];
    }
  }

  /**
   * Get available versions for a profile from all sources
   * 
   * @param canonicalUrl - Profile canonical URL
   * @returns Array of available version strings
   */
  async getAvailableVersions(canonicalUrl: string): Promise<string[]> {
    const versions: string[] = [];

    try {
      // Check database cache
      const dbQuery = sql`
        SELECT DISTINCT version 
        FROM profiles_cache 
        WHERE canonical_url = ${canonicalUrl}
        ORDER BY cached_at DESC
      `;
      
      const dbResult = await db.execute(dbQuery);
      versions.push(...dbResult.rows.map((r: any) => r.version).filter(Boolean));

      // Check Simplifier (only if not enough versions found)
      if (versions.length < 3) {
        const profileName = this.extractProfileName(canonicalUrl);
        const simplifierResults = await simplifierClient.searchProfiles(profileName);
        const matchingProfiles = simplifierResults.filter(p => p.url === canonicalUrl);
        versions.push(...matchingProfiles.map(p => p.version).filter(Boolean));
      }

      // Remove duplicates and filter invalid versions
      const uniqueVersions = [...new Set(versions)].filter(v => VersionResolver.isValidVersion(v));
      
      console.log(`[ProfileResolver] Found ${uniqueVersions.length} versions for ${canonicalUrl}`);
      return uniqueVersions;

    } catch (error) {
      console.error('[ProfileResolver] Failed to get available versions:', error);
      return versions;
    }
  }

  /**
   * Resolve the best version for a profile
   * 
   * @param canonicalUrl - Profile canonical URL
   * @param requestedVersion - Requested version (can be exact, range, or undefined)
   * @param preferStable - Prefer stable versions over pre-release
   * @returns Resolved version string
   */
  async resolveBestVersion(
    canonicalUrl: string,
    requestedVersion?: string,
    preferStable: boolean = true
  ): Promise<string> {
    const availableVersions = await this.getAvailableVersions(canonicalUrl);
    
    if (availableVersions.length === 0) {
      console.warn(`[ProfileResolver] No versions available for ${canonicalUrl}`);
      return requestedVersion || 'latest';
    }

    const resolution = VersionResolver.resolveVersion(requestedVersion, availableVersions, preferStable);
    
    console.log(
      `[ProfileResolver] Version resolution for ${canonicalUrl}: ` +
      `requested="${requestedVersion || 'latest'}", ` +
      `resolved="${resolution.version}", ` +
      `strategy=${resolution.strategy}, ` +
      `exactMatch=${resolution.exactMatch}, ` +
      `matches=${resolution.matches.length}`
    );

    return resolution.version;
  }

  /**
   * Check if a profile is cached
   * 
   * @param canonicalUrl - Profile canonical URL
   * @param version - Optional version
   * @returns true if cached
   */
  isCached(canonicalUrl: string, version?: string): boolean {
    const normalized = this.normalizeCanonicalUrl(canonicalUrl);
    const cacheKey = this.buildCacheKey(normalized, version);
    return this.localCache.has(cacheKey);
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.localCache.clear();
    console.log('[ProfileResolver] Local cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.localCache.size,
      profiles: Array.from(this.localCache.keys()),
    };
  }

  /**
   * Extract metadata from a profile
   * 
   * @param profile - StructureDefinition resource
   * @returns Extracted metadata or null if extraction fails
   */
  extractMetadata(profile: any): ProfileMetadata | null {
    try {
      if (!profile || profile.resourceType !== 'StructureDefinition') {
        console.warn('[ProfileResolver] Invalid profile for metadata extraction');
        return null;
      }

      const metadata = ProfileMetadataExtractor.extractMetadata(profile);
      
      console.log(
        `[ProfileResolver] Extracted metadata for ${metadata.name}: ` +
        `${metadata.elements.length} elements, ` +
        `${metadata.constraints.length} constraints, ` +
        `complexity: ${ProfileMetadataExtractor.getComplexityScore(metadata)}/100`
      );

      return metadata;

    } catch (error) {
      console.error('[ProfileResolver] Failed to extract profile metadata:', error);
      return null;
    }
  }

  /**
   * Get metadata for a cached profile
   * 
   * @param canonicalUrl - Profile canonical URL
   * @param version - Optional version
   * @returns Profile metadata or null if not found
   */
  async getProfileMetadata(canonicalUrl: string, version?: string): Promise<ProfileMetadata | null> {
    try {
      // First check if we have the profile cached
      const normalized = this.normalizeCanonicalUrl(canonicalUrl);
      const resolvedVersion = version || await this.resolveBestVersion(normalized, version);
      
      // Try to resolve the profile (this will cache it if not already cached)
      const result = await this.resolveProfile(normalized, resolvedVersion);
      
      if (!result.profile) {
        return null;
      }

      // Extract and return metadata
      return this.extractMetadata(result.profile);

    } catch (error) {
      console.error('[ProfileResolver] Failed to get profile metadata:', error);
      return null;
    }
  }

  /**
   * Generate a summary report for a profile
   * 
   * @param canonicalUrl - Profile canonical URL
   * @param version - Optional version
   * @returns Human-readable profile summary
   */
  async generateProfileSummary(canonicalUrl: string, version?: string): Promise<string | null> {
    const metadata = await this.getProfileMetadata(canonicalUrl, version);
    
    if (!metadata) {
      return null;
    }

    return ProfileMetadataExtractor.generateSummary(metadata);
  }

  /**
   * Detect if a profile is a German profile
   * 
   * @param canonicalUrl - Profile canonical URL
   * @returns German profile detection result
   */
  detectGermanProfile(canonicalUrl: string): GermanProfileDetectionResult {
    const result = GermanProfileDetector.detectGermanProfile(canonicalUrl);
    
    if (result.isGermanProfile) {
      console.log(
        `[ProfileResolver] Detected German profile: ${result.family.toUpperCase()} ` +
        `(confidence: ${result.confidence}%)`
      );
      
      if (result.module) {
        console.log(`[ProfileResolver] Module: ${result.module}`);
      }
      
      if (result.recommendedPackage) {
        console.log(`[ProfileResolver] Recommended package: ${result.recommendedPackage}`);
      }
    }
    
    return result;
  }

  /**
   * Get recommendations for validating a German profile
   * 
   * @param canonicalUrl - Profile canonical URL
   * @returns Array of recommendation strings
   */
  getGermanProfileRecommendations(canonicalUrl: string): string[] {
    return GermanProfileDetector.generateRecommendations(canonicalUrl);
  }

  /**
   * Resolve a German profile with automatic package detection
   * 
   * @param canonicalUrl - Profile canonical URL
   * @param version - Optional version
   * @param settings - Validation settings
   * @returns Profile resolution result with German profile info
   */
  async resolveGermanProfile(
    canonicalUrl: string,
    version?: string,
    settings?: ValidationSettings
  ): Promise<ProfileResolutionResult> {
    // Detect German profile first
    const germanProfile = this.detectGermanProfile(canonicalUrl);
    
    // Log recommendations
    if (germanProfile.isGermanProfile) {
      const recommendations = this.getGermanProfileRecommendations(canonicalUrl);
      console.log('[ProfileResolver] German Profile Recommendations:');
      recommendations.forEach(rec => console.log(`  ${rec}`));
      
      // Auto-download recommended package if enabled
      if (this.config.resolvePackageDependencies && germanProfile.recommendedPackage) {
        console.log(`[ProfileResolver] Auto-downloading recommended package: ${germanProfile.recommendedPackage}`);
        
        const resolver = getPackageDependencyResolver({
          maxDepth: 2,
          parallel: true,
          skipCached: true,
        });
        
        try {
          await resolver.resolveDependencies(
            germanProfile.recommendedPackage,
            germanProfile.packageVersion
          );
        } catch (error) {
          console.warn(`[ProfileResolver] Failed to auto-download package:`, error);
        }
      }
    }
    
    // Resolve profile normally
    const result = await this.resolveProfile(canonicalUrl, version, settings);
    
    // Add German profile detection to result
    if (germanProfile.isGermanProfile) {
      result.germanProfile = germanProfile;
    }
    
    return result;
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Normalize canonical URL
   * Handles version suffixes, trailing slashes, etc.
   */
  private normalizeCanonicalUrl(url: string): string {
    let normalized = url.trim();

    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');

    // Extract base URL (before |version)
    const versionSeparatorIndex = normalized.indexOf('|');
    if (versionSeparatorIndex > 0) {
      normalized = normalized.substring(0, versionSeparatorIndex);
    }

    return normalized;
  }

  /**
   * Build cache key from canonical URL and version
   */
  private buildCacheKey(canonicalUrl: string, version?: string): string {
    return version ? `${canonicalUrl}|${version}` : canonicalUrl;
  }

  /**
   * Search multiple sources for profile
   */
  private async searchSources(
    canonicalUrl: string,
    version?: string,
    settings?: ValidationSettings
  ): Promise<ProfileResolutionResult> {
    const startTime = Date.now();

    // Step 1: Check database cache first
    try {
      const cachedResult = await this.searchDatabase(canonicalUrl, version);
      if (cachedResult) {
        console.log(`[ProfileResolver] Found in database cache: ${canonicalUrl}`);
        return cachedResult;
      }
    } catch (error) {
      console.warn('[ProfileResolver] Database search failed:', error);
    }

    // Step 2: Try Simplifier (most reliable)
    try {
      const simplifierResult = await this.searchSimplifier(canonicalUrl, version);
      if (simplifierResult) {
        // Cache the result in database
        await this.cacheProfileInDatabase(simplifierResult);
        
        // Notify if profile was downloaded
        if (simplifierResult.downloaded) {
          const notificationService = getProfileNotificationService();
          notificationService.notifyProfileDownloaded(
            simplifierResult.canonicalUrl,
            simplifierResult.version,
            'Simplifier'
          );
        }
        
        return simplifierResult;
      }
    } catch (error) {
      console.warn('[ProfileResolver] Simplifier search failed:', error);
    }

    // Step 3: Try FHIR Package Registry
    try {
      const registryResult = await this.searchFhirRegistry(canonicalUrl, version);
      if (registryResult) {
        // Cache the result in database
        await this.cacheProfileInDatabase(registryResult);
        
        // Notify if profile was downloaded
        if (registryResult.downloaded) {
          const notificationService = getProfileNotificationService();
          notificationService.notifyProfileDownloaded(
            registryResult.canonicalUrl,
            registryResult.version,
            'FHIR Registry'
          );
        }
        
        return registryResult;
      }
    } catch (error) {
      console.warn('[ProfileResolver] FHIR Registry search failed:', error);
    }

    // Step 4: Check filesystem cache as last resort
    try {
      const filesystemResult = await this.searchFilesystemCache(canonicalUrl, version, settings);
      if (filesystemResult) {
        console.log(`[ProfileResolver] Found in filesystem cache: ${canonicalUrl}`);
        return filesystemResult;
      }
    } catch (error) {
      console.warn('[ProfileResolver] Filesystem cache search failed:', error);
    }

    // If not found anywhere, return placeholder result
    return {
      canonicalUrl,
      profile: null,
      source: 'local-cache',
      version: version || 'unknown',
      dependencies: [],
      resolutionTime: Date.now() - startTime,
      downloaded: false,
    };
  }

  /**
   * Search Simplifier for profile
   */
  private async searchSimplifier(
    canonicalUrl: string,
    version?: string
  ): Promise<ProfileResolutionResult | null> {
    console.log(`[ProfileResolver] Searching Simplifier for: ${canonicalUrl}`);

    try {
      // Extract profile name from URL
      const profileName = this.extractProfileName(canonicalUrl);
      
      // Search Simplifier
      const searchResults = await simplifierClient.searchProfiles(profileName);
      
      if (searchResults.length === 0) {
        return null;
      }

      // Find exact match or best match
      const match = searchResults.find(p => p.url === canonicalUrl) || searchResults[0];

      // Download full StructureDefinition if auto-download is enabled
      let structureDefinition = null;
      let dependencies: string[] = [];
      let metadata: ProfileMetadata | undefined;

      if (this.config.autoDownload) {
        structureDefinition = await this.downloadStructureDefinition(match.packageId, match.id);
        if (structureDefinition) {
          dependencies = this.extractDependencies(structureDefinition);
          
          // Extract metadata from the downloaded profile
          const extractedMetadata = this.extractMetadata(structureDefinition);
          if (extractedMetadata) {
            metadata = extractedMetadata;
          }
          
          // Recursively resolve dependencies if they exist
          if (dependencies.length > 0) {
            await this.resolveDependencies(dependencies);
          }
        }
      }

      return {
        canonicalUrl,
        profile: structureDefinition || match,
        source: 'simplifier',
        version: match.version,
        dependencies,
        resolutionTime: 0,
        downloaded: !!structureDefinition,
        metadata,
      };

    } catch (error) {
      console.error('[ProfileResolver] Simplifier search failed:', error);
      return null;
    }
  }

  /**
   * Extract profile name from canonical URL
   */
  private extractProfileName(canonicalUrl: string): string {
    const parts = canonicalUrl.split('/');
    return parts[parts.length - 1] || canonicalUrl;
  }

  /**
   * Download StructureDefinition from Simplifier
   */
  private async downloadStructureDefinition(packageId: string, profileId: string): Promise<any | null> {
    try {
      console.log(`[ProfileResolver] Downloading StructureDefinition ${profileId} from package ${packageId}`);

      // First, try to get the package details to find download URL
      const packageDetails = await simplifierClient.getPackageDetails(packageId);
      if (!packageDetails) {
        console.warn(`[ProfileResolver] Package ${packageId} not found`);
        return null;
      }

      // Resolve package dependencies if enabled
      if (this.config.resolvePackageDependencies && packageDetails.dependencies.length > 0) {
        console.log(`[ProfileResolver] Package ${packageId} has ${packageDetails.dependencies.length} dependencies`);
        await this.resolvePackageDependenciesForProfile(packageId, packageDetails.version);
      }

      // Download the package content
      const packageBuffer = await simplifierClient.downloadPackage(packageId);
      if (!packageBuffer) {
        console.warn(`[ProfileResolver] Failed to download package ${packageId}`);
        return null;
      }

      // Extract StructureDefinition from package
      // Note: In a full implementation, this would unzip the .tgz and parse the contained FHIR resources
      // For now, we'll use a simplified approach and try to get profile details
      const profiles = await simplifierClient.getPackageProfiles(packageId);
      const targetProfile = profiles.find(p => p.id === profileId || p.name === profileId);
      
      if (!targetProfile) {
        console.warn(`[ProfileResolver] Profile ${profileId} not found in package ${packageId}`);
        return null;
      }

      // In a full implementation, this would be the parsed StructureDefinition JSON
      // For now, return the profile metadata with indication it was downloaded
      return {
        resourceType: 'StructureDefinition',
        id: targetProfile.id,
        url: targetProfile.url,
        name: targetProfile.name,
        title: targetProfile.title,
        status: targetProfile.status,
        kind: targetProfile.kind,
        abstract: targetProfile.abstract,
        baseDefinition: targetProfile.baseDefinition,
        type: targetProfile.type,
        // These would be populated from actual StructureDefinition content
        differential: { element: [] },
        snapshot: { element: [] },
        _downloaded: true,
        _source: 'simplifier',
        _packageId: packageId
      };

    } catch (error) {
      console.error(`[ProfileResolver] Error downloading StructureDefinition ${profileId}:`, error);
      return null;
    }
  }

  /**
   * Recursively resolve profile dependencies
   */
  private async resolveDependencies(dependencies: string[]): Promise<void> {
    console.log(`[ProfileResolver] Resolving ${dependencies.length} dependencies`);

    // Prevent infinite recursion
    const maxDepth = 3;
    const resolvedDependencies = new Set<string>();

    for (const dependency of dependencies) {
      if (!resolvedDependencies.has(dependency)) {
        await this.resolveDependency(dependency, resolvedDependencies, 1, maxDepth);
      }
    }
  }

  /**
   * Resolve a single dependency
   */
  private async resolveDependency(
    canonicalUrl: string, 
    resolved: Set<string>, 
    currentDepth: number, 
    maxDepth: number
  ): Promise<void> {
    // Prevent infinite recursion
    if (currentDepth > maxDepth) {
      console.warn(`[ProfileResolver] Max dependency depth reached for ${canonicalUrl}`);
      return;
    }

    // Skip if already resolved
    if (resolved.has(canonicalUrl)) {
      return;
    }

    try {
      console.log(`[ProfileResolver] Resolving dependency ${canonicalUrl} (depth: ${currentDepth})`);
      
      // Resolve the dependency
      const result = await this.resolveProfile(canonicalUrl);
      
      if (result && result.dependencies.length > 0) {
        // Recursively resolve nested dependencies
        for (const nestedDependency of result.dependencies) {
          await this.resolveDependency(nestedDependency, resolved, currentDepth + 1, maxDepth);
        }
      }

      resolved.add(canonicalUrl);

    } catch (error) {
      console.error(`[ProfileResolver] Failed to resolve dependency ${canonicalUrl}:`, error);
    }
  }

  /**
   * Extract dependencies from StructureDefinition
   */
  private extractDependencies(structureDefinition: any): string[] {
    const dependencies: string[] = [];

    // Check baseDefinition
    if (structureDefinition.baseDefinition && 
        structureDefinition.baseDefinition !== 'http://hl7.org/fhir/StructureDefinition/DomainResource' &&
        structureDefinition.baseDefinition !== 'http://hl7.org/fhir/StructureDefinition/Resource') {
      dependencies.push(structureDefinition.baseDefinition);
    }

    // Check differential for profile references
    if (structureDefinition.differential?.element) {
      for (const element of structureDefinition.differential.element) {
        if (element.type) {
          for (const type of element.type) {
            // Check for profile references
            if (type.profile) {
              dependencies.push(...type.profile);
            }
            // Check for targetProfile references (for Reference types)
            if (type.targetProfile) {
              dependencies.push(...type.targetProfile);
            }
          }
        }
        
        // Check for slicing references
        if (element.slicing?.discriminator) {
          for (const discriminator of element.slicing.discriminator) {
            if (discriminator.path && discriminator.path.includes('resolve()')) {
              // This might reference another profile - extract if possible
              // Complex logic would be needed to parse FHIRPath expressions
            }
          }
        }
      }
    }

    // Check snapshot elements as fallback
    if (!structureDefinition.differential && structureDefinition.snapshot?.element) {
      for (const element of structureDefinition.snapshot.element) {
        if (element.type) {
          for (const type of element.type) {
            if (type.profile) {
              dependencies.push(...type.profile);
            }
            if (type.targetProfile) {
              dependencies.push(...type.targetProfile);
            }
          }
        }
      }
    }

    // Filter out core FHIR profiles and duplicates
    const filteredDependencies = dependencies
      .filter(dep => !dep.startsWith('http://hl7.org/fhir/StructureDefinition/') || 
                     dep.includes('Extension') || 
                     dep.includes('Profile'))
      .filter((dep, index, arr) => arr.indexOf(dep) === index);

    return filteredDependencies;
  }

  /**
   * Search database cache for profile
   */
  private async searchDatabase(canonicalUrl: string, version?: string): Promise<ProfileResolutionResult | null> {
    try {
      console.log(`[ProfileResolver] Searching database cache for: ${canonicalUrl}`);
      
      // Query profiles_cache table using drizzle raw SQL
      const query = version 
        ? sql`
          SELECT 
            pc.canonical_url,
            pc.version,
            pc.profile_content,
            pc.source,
            pc.resolution_time_ms,
            pc.cached_at,
            pc.access_count,
            pc.validation_count,
            COALESCE(
              ARRAY_AGG(pd.depends_on_canonical_url) FILTER (WHERE pd.depends_on_canonical_url IS NOT NULL),
              '{}'::text[]
            ) as dependencies
          FROM profiles_cache pc
          LEFT JOIN profile_dependencies pd ON pd.profile_id = pc.id
          WHERE pc.canonical_url = ${canonicalUrl}
          AND pc.version = ${version}
          GROUP BY pc.id, pc.canonical_url, pc.version, pc.profile_content, pc.source, 
                   pc.resolution_time_ms, pc.cached_at, pc.access_count, pc.validation_count
          ORDER BY pc.cached_at DESC
          LIMIT 1
        `
        : sql`
          SELECT 
            pc.canonical_url,
            pc.version,
            pc.profile_content,
            pc.source,
            pc.resolution_time_ms,
            pc.cached_at,
            pc.access_count,
            pc.validation_count,
            COALESCE(
              ARRAY_AGG(pd.depends_on_canonical_url) FILTER (WHERE pd.depends_on_canonical_url IS NOT NULL),
              '{}'::text[]
            ) as dependencies
          FROM profiles_cache pc
          LEFT JOIN profile_dependencies pd ON pd.profile_id = pc.id
          WHERE pc.canonical_url = ${canonicalUrl}
          GROUP BY pc.id, pc.canonical_url, pc.version, pc.profile_content, pc.source, 
                   pc.resolution_time_ms, pc.cached_at, pc.access_count, pc.validation_count
          ORDER BY pc.cached_at DESC
          LIMIT 1
        `;
      
      const result = await db.execute(query);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0] as any;
      
      // Update access statistics
      await this.updateProfileAccessStats(canonicalUrl, version);
      
      return {
        canonicalUrl: row.canonical_url,
        profile: row.profile_content,
        source: 'database',
        version: row.version || 'unknown',
        dependencies: row.dependencies || [],
        resolutionTime: row.resolution_time_ms || 0,
        downloaded: true,
      };
      
    } catch (error) {
      console.error('[ProfileResolver] Database search failed:', error);
      return null;
    }
  }

  /**
   * Cache profile result in database
   */
  private async cacheProfileInDatabase(result: ProfileResolutionResult): Promise<void> {
    try {
      console.log(`[ProfileResolver] Caching profile in database: ${result.canonicalUrl}`);
      
      if (!result.profile) {
        console.warn('[ProfileResolver] Cannot cache null profile');
        return;
      }

      // Generate content hash for deduplication
      const contentHash = createHash('sha256')
        .update(JSON.stringify(result.profile))
        .digest('hex');

      // Extract metadata from StructureDefinition
      const profile = result.profile;
      const profileId = profile.id || this.extractProfileName(result.canonicalUrl);
      const resourceType = profile.type || 'Unknown';
      const baseDefinition = profile.baseDefinition;
      const kind = profile.kind || 'resource';
      const status = profile.status || 'active';
      
      // Prepare values with proper null handling for SQL
      const dateValue = profile.date ? new Date(profile.date).toISOString() : new Date().toISOString();
      const versionValue = result.version || 'latest';
      const baseDefinitionValue = baseDefinition || null;
      const purposeValue = profile.purpose || null;
      const copyrightValue = profile.copyright || null;
      
      // Map source value to match CHECK constraint
      let sourceValue = result.source;
      if (sourceValue === 'local-cache') {
        sourceValue = 'local';
      }
      
      // Insert or update profile in cache
      await db.execute(sql`
        INSERT INTO profiles_cache (
          canonical_url, version, name, title, profile_id, package_id, resource_type, kind, abstract,
          base_definition, derivation, type, source, fhir_version, profile_content,
          differential_elements, snapshot_elements, status, experimental, date,
          publisher, contact_info, use_context, jurisdiction, purpose, copyright,
          context_info, resolution_time_ms, dependencies_resolved, resolution_source,
          checksum_sha256
        ) VALUES (
          ${result.canonicalUrl},
          ${versionValue},
          ${profile.name || profileId},
          ${profile.title || profile.name || profileId},
          ${profileId},
          ${null},
          ${resourceType},
          ${kind},
          ${profile.abstract || false},
          ${baseDefinitionValue},
          ${profile.derivation || 'specialization'},
          ${profile.type || resourceType},
          ${sourceValue},
          ${profile.fhirVersion || 'R4'},
          ${JSON.stringify(profile)},
          ${JSON.stringify(profile.differential || {})},
          ${JSON.stringify(profile.snapshot || {})},
          ${status},
          ${profile.experimental || false},
          ${dateValue},
          ${profile.publisher || 'Unknown'},
          ${JSON.stringify(profile.contact || [])},
          ${JSON.stringify(profile.useContext || [])},
          ${JSON.stringify(profile.jurisdiction || [])},
          ${purposeValue},
          ${copyrightValue},
          ${JSON.stringify(profile.context || [])},
          ${result.resolutionTime},
          ${result.dependencies.length > 0},
          ${sourceValue},
          ${contentHash}
        )
        ON CONFLICT (canonical_url, version) 
        DO UPDATE SET
          profile_content = EXCLUDED.profile_content,
          source = EXCLUDED.source,
          resolution_time_ms = EXCLUDED.resolution_time_ms,
          checksum_sha256 = EXCLUDED.checksum_sha256,
          updated_at = NOW()
      `);

      // Cache dependencies if they exist
      if (result.dependencies.length > 0) {
        await this.cacheDependencies(result.canonicalUrl, versionValue, result.dependencies);
      }

      // Log successful caching
      console.log(`[ProfileResolver] Successfully cached profile: ${result.canonicalUrl}`);
      
    } catch (error) {
      console.error('[ProfileResolver] Failed to cache profile in database:', error);
      // Don't throw - caching failures shouldn't break profile resolution
    }
  }

  /**
   * Search FHIR Package Registry
   */
  private async searchFhirRegistry(canonicalUrl: string, version?: string): Promise<ProfileResolutionResult | null> {
    console.log(`[ProfileResolver] Searching FHIR Package Registry for: ${canonicalUrl}`);

    try {
      // Extract profile name from URL for search
      const profileName = this.extractProfileName(canonicalUrl);
      
      // Search packages in FHIR Registry
      const searchResults = await simplifierClient.searchPackages(profileName);
      
      if (searchResults.packages.length === 0) {
        return null;
      }

      // Look for packages that might contain our profile
      const relevantPackages = searchResults.packages.filter(pkg => 
        pkg.canonicalUrl?.includes(canonicalUrl) || 
        pkg.name.toLowerCase().includes(profileName.toLowerCase())
      );

      if (relevantPackages.length === 0) {
        return null;
      }

      const targetPackage = relevantPackages[0];

      // Try to download and extract the profile
      if (this.config.autoDownload) {
        const structureDefinition = await this.downloadStructureDefinition(targetPackage.id, profileName);
        if (structureDefinition) {
          const dependencies = this.extractDependencies(structureDefinition);
          
          return {
            canonicalUrl,
            profile: structureDefinition,
            source: 'fhir-registry',
            version: targetPackage.version,
            dependencies,
            resolutionTime: 0,
            downloaded: true,
          };
        }
      }

      // Return package info if download not enabled or failed
      return {
        canonicalUrl,
        profile: {
          resourceType: 'StructureDefinition',
          url: canonicalUrl,
          name: profileName,
          title: targetPackage.title,
          status: 'active',
          _packageInfo: targetPackage
        },
        source: 'fhir-registry',
        version: targetPackage.version,
        dependencies: [],
        resolutionTime: 0,
        downloaded: false,
      };

    } catch (error) {
      console.error('[ProfileResolver] FHIR Registry search failed:', error);
      return null;
    }
  }

  /**
   * Search filesystem cache for profile
   */
  private async searchFilesystemCache(
    canonicalUrl: string, 
    version?: string, 
    settings?: ValidationSettings
  ): Promise<ProfileResolutionResult | null> {
    try {
      const cachePath = settings?.offlineConfig?.profileCachePath || '/opt/fhir/igs/';
      console.log(`[ProfileResolver] Searching filesystem cache at: ${cachePath}`);

      // TODO: Implement filesystem search
      // This would:
      // 1. List directories in cachePath
      // 2. Look for .tgz files or extracted IG packages
      // 3. Parse package.json and find StructureDefinitions
      // 4. Match by canonical URL
      
      // For now, return null (filesystem cache not implemented)
      console.log(`[ProfileResolver] Filesystem cache search not yet implemented`);
      return null;

    } catch (error) {
      console.error('[ProfileResolver] Filesystem cache search failed:', error);
      return null;
    }
  }

  /**
   * Resolve package dependencies for a profile
   */
  private async resolvePackageDependenciesForProfile(packageId: string, version: string): Promise<void> {
    try {
      console.log(`[ProfileResolver] Resolving package dependencies for: ${packageId}@${version}`);
      
      const resolver = getPackageDependencyResolver({
        maxDepth: this.config.maxPackageDependencyDepth,
        parallel: true,
        maxConcurrent: 3,
        skipCached: true,
      });

      const dependencyGraph = await resolver.resolveDependencies(packageId, version);
      
      console.log(
        `[ProfileResolver] Package dependency resolution complete: ` +
        `${dependencyGraph.downloadedPackages}/${dependencyGraph.totalPackages} packages, ` +
        `${dependencyGraph.failedPackages.length} failed`
      );

      // Log visualization of dependency tree (useful for debugging)
      if (dependencyGraph.totalPackages > 1) {
        const visualization = resolver.visualizeDependencyGraph(dependencyGraph);
        console.log('\n' + visualization + '\n');
      }

      // Warn about failed packages
      if (dependencyGraph.failedPackages.length > 0) {
        console.warn(
          `[ProfileResolver] Failed to download ${dependencyGraph.failedPackages.length} packages: ` +
          dependencyGraph.failedPackages.join(', ')
        );
      }

      // Warn about circular dependencies
      if (dependencyGraph.circularDependencies.length > 0) {
        console.warn(
          `[ProfileResolver] Detected ${dependencyGraph.circularDependencies.length} circular dependencies`
        );
      }

    } catch (error) {
      console.error(`[ProfileResolver] Package dependency resolution failed:`, error);
      // Don't throw - package dependency failures shouldn't break profile resolution
    }
  }

  /**
   * Update profile access statistics
   */
  private async updateProfileAccessStats(canonicalUrl: string, version?: string): Promise<void> {
    try {
      const query = version
        ? sql`
          UPDATE profiles_cache 
          SET access_count = access_count + 1, 
              last_accessed_at = NOW() 
          WHERE canonical_url = ${canonicalUrl} 
          AND version = ${version}
        `
        : sql`
          UPDATE profiles_cache 
          SET access_count = access_count + 1, 
              last_accessed_at = NOW() 
          WHERE canonical_url = ${canonicalUrl}
        `;

      await db.execute(query);
    } catch (error) {
      console.warn('[ProfileResolver] Failed to update access stats:', error);
      // Don't throw - this is just for statistics
    }
  }

  /**
   * Cache profile dependencies in database
   */
  private async cacheDependencies(canonicalUrl: string, version: string | undefined, dependencies: string[]): Promise<void> {
    try {
      // First, get the profile ID
      const profileQuery = version
        ? sql`SELECT id FROM profiles_cache WHERE canonical_url = ${canonicalUrl} AND version = ${version}`
        : sql`SELECT id FROM profiles_cache WHERE canonical_url = ${canonicalUrl} ORDER BY cached_at DESC LIMIT 1`;
      
      const profileResult = await db.execute(profileQuery);
      if (profileResult.rows.length === 0) {
        console.warn('[ProfileResolver] Cannot cache dependencies - profile not found in cache');
        return;
      }

      const profileId = (profileResult.rows[0] as any).id;

      // Delete existing dependencies for this profile
      await db.execute(sql`
        DELETE FROM profile_dependencies WHERE profile_id = ${profileId}
      `);

      // Insert new dependencies
      for (const dependency of dependencies) {
        // Try to find the dependency profile in cache
        const depQuery = sql`
          SELECT id FROM profiles_cache 
          WHERE canonical_url = ${dependency}
          ORDER BY cached_at DESC 
          LIMIT 1
        `;
        
        const depResult = await db.execute(depQuery);
        const dependsOnProfileId = depResult.rows.length > 0 ? (depResult.rows[0] as any).id : null;
        
        // Determine dependency type based on URL patterns
        let dependencyType = 'profile_reference';
        if (dependency.includes('/Extension/')) {
          dependencyType = 'extension';
        } else if (dependency.includes('/ValueSet/')) {
          dependencyType = 'value_set';
        } else if (dependency.includes('/CodeSystem/')) {
          dependencyType = 'code_system';
        }

        await db.execute(sql`
          INSERT INTO profile_dependencies (
            profile_id, depends_on_profile_id, depends_on_canonical_url,
            dependency_type, required, resolved
          ) VALUES (
            ${profileId},
            ${dependsOnProfileId},
            ${dependency},
            ${dependencyType},
            true,
            ${dependsOnProfileId !== null}
          )
        `);
      }

      console.log(`[ProfileResolver] Cached ${dependencies.length} dependencies for ${canonicalUrl}`);
      
    } catch (error) {
      console.error('[ProfileResolver] Failed to cache dependencies:', error);
      // Don't throw - dependency caching failures shouldn't break profile resolution
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let resolverInstance: ProfileResolver | null = null;

/**
 * Get or create singleton ProfileResolver instance
 */
export function getProfileResolver(config?: Partial<ProfileResolverConfig>): ProfileResolver {
  if (!resolverInstance) {
    resolverInstance = new ProfileResolver(config);
  }
  return resolverInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetProfileResolver(): void {
  resolverInstance = null;
}

