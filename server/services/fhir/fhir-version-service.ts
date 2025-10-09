/**
 * FHIR Version Service
 * 
 * Task 2.1: Server-level FHIR version detection from CapabilityStatement
 * 
 * Responsibilities:
 * - Detect FHIR version (R4, R5, R6) from server's CapabilityStatement
 * - Store detected version in database (fhir_servers.fhir_version)
 * - Provide version lookup for validation operations
 * - Handle version detection failures with fallback
 * - Cache version information per server
 * 
 * Replaces resource-level heuristic detection with server-level CapabilityStatement-based detection
 * 
 * File size: Target <250 lines
 */

import { FhirClient } from './fhir-client';
import { storage } from '../../storage';
import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface FhirVersionInfo {
  serverId: number;
  version: 'R4' | 'R5' | 'R6';
  rawVersion: string;
  detectedAt: Date;
  source: 'capability_statement' | 'fallback';
}

export interface VersionDetectionResult {
  success: boolean;
  version?: 'R4' | 'R5' | 'R6';
  rawVersion?: string;
  source: 'capability_statement' | 'fallback' | 'cache';
  error?: string;
}

// ============================================================================
// FHIR Version Service
// ============================================================================

export class FhirVersionService {
  private versionCache = new Map<number, FhirVersionInfo>();
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Detect and store FHIR version for a server
   * 
   * @param serverId - Database ID of the FHIR server
   * @param serverUrl - Base URL of the FHIR server
   * @param authConfig - Optional authentication configuration
   * @returns Version detection result
   */
  async detectAndStoreVersion(
    serverId: number,
    serverUrl: string,
    authConfig?: any
  ): Promise<VersionDetectionResult> {
    console.log(`[FhirVersionService] Detecting FHIR version for server ${serverId}: ${serverUrl}`);

    try {
      // Create FHIR client
      const client = new FhirClient(serverUrl, authConfig);

      // Get FHIR version from CapabilityStatement
      const version = await client.getFhirVersion();

      if (!version) {
        console.warn(`[FhirVersionService] Could not detect version from CapabilityStatement, using fallback`);
        return this.handleDetectionFailure(serverId);
      }

      // Normalize to R4/R5/R6
      const normalizedVersion = this.normalizeVersion(version);

      // Store in database
      await this.storeVersion(serverId, normalizedVersion, version);

      // Cache the result
      this.cacheVersion(serverId, {
        serverId,
        version: normalizedVersion,
        rawVersion: version,
        detectedAt: new Date(),
        source: 'capability_statement',
      });

      console.log(`[FhirVersionService] Detected and stored version: ${normalizedVersion} (raw: ${version})`);

      return {
        success: true,
        version: normalizedVersion,
        rawVersion: version,
        source: 'capability_statement',
      };
    } catch (error: any) {
      console.error(`[FhirVersionService] Version detection failed:`, error);
      return this.handleDetectionFailure(serverId, error.message);
    }
  }

  /**
   * Get FHIR version for a server (from cache or database)
   * 
   * @param serverId - Database ID of the FHIR server
   * @returns FHIR version or null if not detected
   */
  async getServerVersion(serverId: number): Promise<'R4' | 'R5' | 'R6' | null> {
    // Check cache first
    const cached = this.versionCache.get(serverId);
    if (cached && !this.isCacheStale(cached)) {
      console.log(`[FhirVersionService] Using cached version for server ${serverId}: ${cached.version}`);
      return cached.version;
    }

    // Load from database
    try {
      const server = await storage.getFhirServerById(serverId);
      if (server?.fhirVersion) {
        const version = this.normalizeVersion(server.fhirVersion);
        
        // Cache the result
        this.cacheVersion(serverId, {
          serverId,
          version,
          rawVersion: server.fhirVersion,
          detectedAt: new Date(),
          source: 'capability_statement',
        });

        console.log(`[FhirVersionService] Loaded version from database for server ${serverId}: ${version}`);
        return version;
      }

      console.warn(`[FhirVersionService] No version stored for server ${serverId}`);
      return null;
    } catch (error: any) {
      console.error(`[FhirVersionService] Failed to load version from database:`, error);
      return null;
    }
  }

  /**
   * Get FHIR version with fallback to resource-level heuristics
   * 
   * @param serverId - Database ID of the FHIR server
   * @param resource - Optional resource to use for heuristic detection
   * @returns FHIR version (always returns a value)
   */
  async getVersionWithFallback(
    serverId: number,
    resource?: any
  ): Promise<'R4' | 'R5' | 'R6'> {
    // Try server-level detection first
    const serverVersion = await this.getServerVersion(serverId);
    if (serverVersion) {
      return serverVersion;
    }

    // Fall back to resource-level heuristics if available
    if (resource) {
      console.log(`[FhirVersionService] Using resource-level heuristic detection for server ${serverId}`);
      return this.detectFromResource(resource);
    }

    // Ultimate fallback: R4
    console.warn(`[FhirVersionService] No version detection possible, defaulting to R4 for server ${serverId}`);
    return 'R4';
  }

  /**
   * Clear version cache for a server
   */
  clearCache(serverId?: number): void {
    if (serverId) {
      this.versionCache.delete(serverId);
      console.log(`[FhirVersionService] Cleared cache for server ${serverId}`);
    } else {
      this.versionCache.clear();
      console.log(`[FhirVersionService] Cleared all version cache`);
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private async storeVersion(
    serverId: number,
    version: 'R4' | 'R5' | 'R6',
    rawVersion: string
  ): Promise<void> {
    try {
      await storage.updateFhirServer(serverId, {
        fhirVersion: version,
      });
      logger.info(`[FhirVersionService] Stored version ${version} (${rawVersion}) for server ${serverId}`);
    } catch (error: any) {
      logger.error(`[FhirVersionService] Failed to store version:`, error);
      throw error;
    }
  }

  private cacheVersion(serverId: number, info: FhirVersionInfo): void {
    this.versionCache.set(serverId, info);
  }

  private isCacheStale(info: FhirVersionInfo): boolean {
    const age = Date.now() - info.detectedAt.getTime();
    return age > this.CACHE_TTL;
  }

  private normalizeVersion(version: string): 'R4' | 'R5' | 'R6' {
    if (!version) return 'R4';

    const versionUpper = version.toUpperCase();
    if (versionUpper.includes('R6') || version.startsWith('6.')) return 'R6';
    if (versionUpper.includes('R5') || version.startsWith('5.')) return 'R5';
    if (versionUpper.includes('R4') || version.startsWith('4.')) return 'R4';

    // Fallback
    logger.warn(`[FhirVersionService] Unknown version format: ${version}, defaulting to R4`);
    return 'R4';
  }

  private async handleDetectionFailure(
    serverId: number,
    errorMessage?: string
  ): Promise<VersionDetectionResult> {
    // Try to load existing version from database
    const existingVersion = await this.getServerVersion(serverId);
    
    if (existingVersion) {
      console.log(`[FhirVersionService] Using existing version from database: ${existingVersion}`);
      return {
        success: true,
        version: existingVersion,
        source: 'cache',
      };
    }

    // Fall back to R4
    console.warn(`[FhirVersionService] Falling back to R4 for server ${serverId}`);
    await this.storeVersion(serverId, 'R4', '4.0.1');

    return {
      success: false,
      version: 'R4',
      source: 'fallback',
      error: errorMessage,
    };
  }

  /**
   * Detect FHIR version from resource using heuristics (fallback method)
   * This is the old detection method, kept for backward compatibility
   */
  private detectFromResource(resource: any): 'R4' | 'R5' | 'R6' {
    // Check meta.profile for version indicators
    if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
      for (const profile of resource.meta.profile) {
        if (typeof profile === 'string') {
          if (profile.includes('r6') || profile.includes('R6')) return 'R6';
          if (profile.includes('r5') || profile.includes('R5')) return 'R5';
          if (profile.includes('r4') || profile.includes('R4')) return 'R4';
        }
      }
    }

    // Check for R6-specific fields
    if (resource.versionAlgorithm || resource.copyrightLabel) {
      return 'R6';
    }

    // Check for R5-specific fields
    if (resource.contained && Array.isArray(resource.contained) && resource.contained.length > 0) {
      const hasComplexContained = resource.contained.some((c: any) => 
        c.meta?.profile || c.extension
      );
      if (hasComplexContained) {
        return 'R5';
      }
    }

    // Default to R4
    return 'R4';
  }
}

// Singleton instance
let versionServiceInstance: FhirVersionService | null = null;

/**
 * Get singleton instance of FhirVersionService
 */
export function getFhirVersionService(): FhirVersionService {
  if (!versionServiceInstance) {
    versionServiceInstance = new FhirVersionService();
  }
  return versionServiceInstance;
}

