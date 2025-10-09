/**
 * Version Router
 * Task 2.6: Routes validation requests to version-specific ValidationEngine instances
 * 
 * Purpose:
 * - Maintains a pool of ValidationEngine instances per FHIR version (R4, R5, R6)
 * - Routes validation requests to the appropriate engine based on FHIR version
 * - Handles version-specific configuration and limitations
 * - Provides a clean API for version-aware validation
 * 
 * Architecture:
 * - Singleton pattern for engine instances per version
 * - Lazy initialization of engines (created on first use)
 * - Version detection and routing logic
 * - Integration with fhir-package-versions.ts for version configs
 * 
 * File size: Target <400 lines (global.mdc compliance)
 */

import { ValidationEngine } from '../core/validation-engine';
import { HapiValidatorClient } from './hapi-validator-client';
import { FhirClient } from '../../fhir/fhir-client';
import { TerminologyClient } from '../../fhir/terminology-client';
import {
  getVersionConfig,
  hasFullSupport,
  isSupportedVersion,
} from '../../../config/fhir-package-versions';
import type {
  ValidationRequest,
  ValidationResult,
} from '../types/validation-types';

// ============================================================================
// Types
// ============================================================================

export type FhirVersion = 'R4' | 'R5' | 'R6';

export interface VersionRouterConfig {
  enableR5?: boolean;
  enableR6?: boolean;
  autoDetectVersion?: boolean;
}

export interface VersionedValidationRequest extends ValidationRequest {
  fhirVersion?: FhirVersion;
}

export interface VersionRoutingResult {
  engine: ValidationEngine;
  version: FhirVersion;
  limitations: string[];
  hasFullSupport: boolean;
}

// ============================================================================
// Version Router Class
// ============================================================================

export class VersionRouter {
  private engines: Map<FhirVersion, ValidationEngine>;
  private hapiClient: HapiValidatorClient;
  private fhirClient?: FhirClient;
  private terminologyClient?: TerminologyClient;
  private config: VersionRouterConfig;

  constructor(
    fhirClient?: FhirClient,
    terminologyClient?: TerminologyClient,
    config: VersionRouterConfig = {}
  ) {
    this.engines = new Map();
    this.fhirClient = fhirClient;
    this.terminologyClient = terminologyClient;
    this.config = {
      enableR5: config.enableR5 ?? true,
      enableR6: config.enableR6 ?? true,
      autoDetectVersion: config.autoDetectVersion ?? true,
    };
    this.hapiClient = new HapiValidatorClient();

    console.log('[VersionRouter] Initialized with config:', this.config);
  }

  /**
   * Get or create a ValidationEngine for a specific FHIR version
   * Implements lazy initialization and caching
   */
  private getEngineForVersion(version: FhirVersion): ValidationEngine {
    // Check if version is supported
    if (!isSupportedVersion(version)) {
      throw new Error(
        `Unsupported FHIR version: ${version}. Supported versions: R4, R5, R6.`
      );
    }

    // Check if version is enabled in config
    if (version === 'R5' && !this.config.enableR5) {
      throw new Error('FHIR R5 support is disabled in configuration.');
    }

    if (version === 'R6' && !this.config.enableR6) {
      throw new Error('FHIR R6 support is disabled in configuration.');
    }

    // Check if engine already exists (cached)
    let engine = this.engines.get(version);

    if (!engine) {
      console.log(`[VersionRouter] Creating new ValidationEngine for ${version}`);
      
      // Create new engine with version
      engine = new ValidationEngine(
        this.fhirClient,
        this.terminologyClient,
        version
      );

      // Cache engine
      this.engines.set(version, engine);

      // Log version limitations
      const versionConfig = getVersionConfig(version);
      if (versionConfig.limitations && versionConfig.limitations.length > 0) {
        console.warn(
          `[VersionRouter] ${version} has limitations: ${versionConfig.limitations.join(', ')}`
        );
      }
    }

    return engine;
  }

  /**
   * Route a validation request to the appropriate ValidationEngine
   * Task 2.6: Main routing logic
   * 
   * @param request - Validation request (may include fhirVersion)
   * @returns Validation result with version info
   */
  async routeValidation(request: VersionedValidationRequest): Promise<ValidationResult> {
    // Determine FHIR version
    const version = this.determineVersion(request);

    console.log(
      `[VersionRouter] Routing validation for ${request.resourceType} to ${version} engine`
    );

    // Check version support
    const versionConfig = getVersionConfig(version);
    const fullSupport = hasFullSupport(version);

    // Log warnings for limited support versions
    if (!fullSupport) {
      console.warn(
        `[VersionRouter] ${version} has ${versionConfig.supportStatus} support. ` +
        `Limitations: ${versionConfig.limitations?.join(', ') || 'None'}`
      );
    }

    // Get appropriate engine
    const engine = this.getEngineForVersion(version);

    // Execute validation
    const result = await engine.validateResource(request);

    // Add version metadata to result
    return {
      ...result,
      fhirVersion: version,
      versionLimitations: versionConfig.limitations || [],
    };
  }

  /**
   * Determine FHIR version from request
   * Task 2.6: Version detection logic
   * 
   * Priority:
   * 1. Explicit version in request.fhirVersion
   * 2. Auto-detect from resource.meta.versionId
   * 3. Detect from resource content (heuristics)
   * 4. Default to R4
   */
  private determineVersion(request: VersionedValidationRequest): FhirVersion {
    // 1. Explicit version
    if (request.fhirVersion) {
      if (!isSupportedVersion(request.fhirVersion)) {
        console.warn(
          `[VersionRouter] Unsupported version ${request.fhirVersion} specified, defaulting to R4`
        );
        return 'R4';
      }
      return request.fhirVersion;
    }

    // 2. Auto-detect from resource if enabled
    if (this.config.autoDetectVersion && request.resource) {
      const detectedVersion = this.detectVersionFromResource(request.resource);
      if (detectedVersion) {
        console.log(`[VersionRouter] Auto-detected FHIR version: ${detectedVersion}`);
        return detectedVersion;
      }
    }

    // 3. Default to R4
    console.log('[VersionRouter] Using default FHIR version: R4');
    return 'R4';
  }

  /**
   * Detect FHIR version from resource content
   * Uses heuristics based on resource structure
   */
  private detectVersionFromResource(resource: any): FhirVersion | null {
    if (!resource) return null;

    // Check meta.fhirVersion (if present)
    if (resource.meta?.fhirVersion) {
      const version = resource.meta.fhirVersion;
      if (version.startsWith('4.')) return 'R4';
      if (version.startsWith('5.')) return 'R5';
      if (version.startsWith('6.')) return 'R6';
    }

    // R6-specific features
    if (resource.implicitRules || resource.contained?.[0]?.implicitRules) {
      // R6 has enhanced implicitRules handling
      return 'R6';
    }

    // R5-specific features
    if (resource.meta?.versionAlgorithm || resource.versionAlgorithm) {
      return 'R5';
    }

    // Default: cannot reliably detect
    return null;
  }

  /**
   * Get version support information
   * Task 2.6: Provides version-specific routing info
   */
  getVersionInfo(version: FhirVersion): VersionRoutingResult | null {
    if (!isSupportedVersion(version)) {
      return null;
    }

    // Check if version is enabled
    if (version === 'R5' && !this.config.enableR5) {
      return null;
    }

    if (version === 'R6' && !this.config.enableR6) {
      return null;
    }

    const engine = this.getEngineForVersion(version);
    const versionConfig = getVersionConfig(version);

    return {
      engine,
      version,
      limitations: versionConfig.limitations || [],
      hasFullSupport: hasFullSupport(version),
    };
  }

  /**
   * Check if a specific version is available for routing
   */
  isVersionAvailable(version: FhirVersion): boolean {
    if (!isSupportedVersion(version)) {
      return false;
    }

    if (version === 'R5' && !this.config.enableR5) {
      return false;
    }

    if (version === 'R6' && !this.config.enableR6) {
      return false;
    }

    // Check HAPI client support
    return this.hapiClient.isVersionAvailable(version);
  }

  /**
   * Get all available versions
   */
  getAvailableVersions(): FhirVersion[] {
    const versions: FhirVersion[] = ['R4'];

    if (this.config.enableR5 && this.hapiClient.isVersionAvailable('R5')) {
      versions.push('R5');
    }

    if (this.config.enableR6 && this.hapiClient.isVersionAvailable('R6')) {
      versions.push('R6');
    }

    return versions;
  }

  /**
   * Clear cached engines (for testing or configuration changes)
   */
  clearCache(): void {
    console.log('[VersionRouter] Clearing engine cache');
    this.engines.clear();
  }

  /**
   * Get statistics about cached engines
   */
  getStats() {
    return {
      cachedEngines: Array.from(this.engines.keys()),
      engineCount: this.engines.size,
      config: this.config,
      availableVersions: this.getAvailableVersions(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let versionRouterInstance: VersionRouter | null = null;

/**
 * Get the singleton VersionRouter instance
 * Task 2.6: Singleton pattern for global routing
 */
export function getVersionRouter(
  fhirClient?: FhirClient,
  terminologyClient?: TerminologyClient,
  config?: VersionRouterConfig
): VersionRouter {
  if (!versionRouterInstance) {
    console.log('[VersionRouter] Creating singleton instance');
    versionRouterInstance = new VersionRouter(fhirClient, terminologyClient, config);
  }
  return versionRouterInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetVersionRouter(): void {
  console.log('[VersionRouter] Resetting singleton instance');
  versionRouterInstance = null;
}

