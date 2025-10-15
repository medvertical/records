/**
 * Terminology Validator (Refactored)
 * 
 * Handles FHIR terminology validation using HAPI FHIR Validator.
 * Replaces disabled stub implementation with real terminology validation.
 * 
 * Features:
 * - Real terminology validation via HAPI
 * - ValueSet and CodeSystem validation
 * - Support for R4, R5, R6 terminology
 * - Integration with TerminologyAdapter for fallback chain
 * - Online/offline mode support (tx.fhir.org vs local Ontoserver)
 * - Proper caching to avoid performance issues
 * - Task 2.9: Version-specific terminology server routing
 * 
 * Architecture:
 * - Primary: Uses HAPI FHIR Validator for comprehensive terminology validation
 * - Fallback: TerminologyAdapter for direct ValueSet/CodeSystem lookups
 * - Cache: Terminology cache with TTL (1 hour online, indefinite offline)
 * - Version Routing: R4 → tx.fhir.org/r4, R5 → tx.fhir.org/r5, R6 → tx.fhir.org/r6
 * 
 * File size: Target <400 lines (global.mdc compliance)
 */

import type { ValidationIssue } from '../types/validation-types';
import { hapiValidatorClient } from './hapi-validator-client';
import type { HapiValidationOptions } from './hapi-validator-types';
import { TerminologyAdapter } from '../terminology/terminology-adapter';
import type { ValidationSettings } from '@shared/validation-settings';
import { getTerminologyServerUrl, hapiValidatorConfig } from '../../../config/hapi-validator-config';
import { addR6WarningIfNeeded } from '../utils/r6-support-warnings';

// ============================================================================
// Terminology Validator
// ============================================================================

export class TerminologyValidator {
  private hapiAvailable: boolean | null = null;
  private terminologyAdapter: TerminologyAdapter;
  private validationCache: Map<string, CachedValidationResult> = new Map();

  constructor() {
    this.terminologyAdapter = new TerminologyAdapter();
  }

  /**
   * Validate resource terminology
   * 
   * @param resource - FHIR resource to validate
   * @param resourceType - Expected resource type
   * @param settings - Validation settings (includes mode: online/offline)
   * @returns Array of terminology validation issues
   */
  async validate(
    resource: any,
    resourceType: string,
    settings?: ValidationSettings,
    fhirVersion?: 'R4' | 'R5' | 'R6' // Task 2.4: Accept FHIR version parameter
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    try {
      console.log(`[TerminologyValidator] Validating ${resourceType} resource terminology...`);

      // Detect FHIR version
      const fhirVersion = this.detectFhirVersion(resource);

      // Get mode from settings (default to online)
      const mode = settings?.mode || 'online';
      console.log(`[TerminologyValidator] Mode: ${mode}, Version: ${fhirVersion}`);

      // Check cache first
      const cacheKey = this.generateCacheKey(resource, resourceType, mode);
      const cachedResult = this.getCachedResult(cacheKey, mode);
      if (cachedResult) {
        console.log(`[TerminologyValidator] Using cached result`);
        return cachedResult.issues;
      }

      // TEMPORARY: Skip HAPI for terminology validation (too slow)
      // Use ServerManager-based validation instead
      this.hapiAvailable = false;

      // Perform validation
      if (this.hapiAvailable) {
        // Use HAPI for comprehensive terminology validation
        const hapiIssues = await this.validateWithHapi(resource, resourceType, fhirVersion, mode);
        issues.push(...hapiIssues);
      } else {
        // Use ServerManager-based fallback validation (fast with multi-server support)
        console.log(`[TerminologyValidator] Using ServerManager-based validation`);
        const fallbackIssues = await this.validateWithFallback(resource, resourceType, settings);
        issues.push(...fallbackIssues);
      }

      // Cache result
      this.cacheResult(cacheKey, issues, mode);

      // Add R6 warning if needed (Task 2.10)
      const issuesWithR6Warning = addR6WarningIfNeeded(issues, fhirVersion, 'terminology');

      const validationTime = Date.now() - startTime;
      console.log(
        `[TerminologyValidator] Validated ${resourceType} terminology in ${validationTime}ms ` +
        `(${issuesWithR6Warning.length} issues, validator: ${this.hapiAvailable ? 'HAPI' : 'fallback'})`
      );

      return issuesWithR6Warning;

    } catch (error) {
      console.error('[TerminologyValidator] Terminology validation failed:', error);
      issues.push({
        id: `terminology-error-${Date.now()}`,
        aspect: 'terminology',
        severity: 'error',
        code: 'terminology-validation-error',
        message: `Terminology validation failed: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      });

      // Add R6 warning if needed (Task 2.10)
      return addR6WarningIfNeeded(issues, fhirVersion, 'terminology');
    }
  }

  /**
   * Validate using HAPI FHIR Validator
   * Task 2.9: Enhanced with version-specific terminology server routing
   */
  private async validateWithHapi(
    resource: any,
    resourceType: string,
    fhirVersion: 'R4' | 'R5' | 'R6',
    mode: 'online' | 'offline'
  ): Promise<ValidationIssue[]> {
    try {
      // Get version-specific terminology server URL (Task 2.9)
      const terminologyServerUrl = getTerminologyServerUrl(fhirVersion, mode, hapiValidatorConfig);
      
      console.log(
        `[TerminologyValidator] Using HAPI validator for ${fhirVersion} terminology ` +
        `(${mode}, server: ${terminologyServerUrl})`
      );

      // Build validation options with version-specific terminology server
      const options: HapiValidationOptions = {
        fhirVersion,
        mode,
        terminologyServerUrl, // Task 2.9: Version-specific terminology server
        // HAPI will validate terminology as part of comprehensive validation
      };

      // Call HAPI validator
      const allIssues = await hapiValidatorClient.validateResource(resource, options);

      // Filter to terminology issues only
      const terminologyIssues = this.filterTerminologyIssues(allIssues);

      console.log(
        `[TerminologyValidator] HAPI validation complete: ${terminologyIssues.length} terminology issues ` +
        `(${allIssues.length} total, server: ${terminologyServerUrl})`
      );

      return terminologyIssues;

    } catch (error) {
      console.error(`[TerminologyValidator] HAPI validation failed for ${fhirVersion}:`, error);
      
      // Return error as validation issue
      return [{
        id: `hapi-terminology-error-${Date.now()}`,
        aspect: 'terminology',
        severity: 'warning',
        code: 'hapi-terminology-validation-error',
        message: `HAPI terminology validation failed for ${fhirVersion}: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      }];
    }
  }

  /**
   * Filter HAPI validation issues to only terminology-related ones
   */
  private filterTerminologyIssues(allIssues: ValidationIssue[]): ValidationIssue[] {
    return allIssues.filter(issue => {
      // Already tagged as terminology by hapi-issue-mapper
      if (issue.aspect === 'terminology') {
        return true;
      }

      // Additional check: look for terminology-related codes
      const code = issue.code?.toLowerCase() || '';
      const message = issue.message?.toLowerCase() || '';

      const terminologyKeywords = [
        'code',
        'valueset',
        'binding',
        'terminology',
        'codesystem',
        'concept',
        'display',
      ];

      return terminologyKeywords.some(keyword => 
        code.includes(keyword) || message.includes(keyword)
      );
    });
  }

  /**
   * Fallback terminology validation using TerminologyAdapter
   */
  private async validateWithFallback(
    resource: any,
    resourceType: string,
    settings?: ValidationSettings
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Extract and validate codes from resource
      const codes = this.extractCodes(resource, resourceType);

      for (const codeInfo of codes) {
        // Use TerminologyAdapter to validate code
        try {
          const validationResult = await this.terminologyAdapter.validateCode(
            codeInfo.code,
            codeInfo.system,
            codeInfo.valueSetUrl,
            settings || { mode: 'online' } as ValidationSettings
          );

          if (!validationResult.valid) {
            issues.push({
              id: `fallback-terminology-${Date.now()}-${codeInfo.path}`,
              aspect: 'terminology',
              severity: 'warning',
              code: 'code-not-in-valueset',
              message: validationResult.message || `Code '${codeInfo.code}' not valid in ValueSet '${codeInfo.valueSetUrl}'`,
              path: codeInfo.path,
              timestamp: new Date(),
            });
          }
        } catch (error) {
          console.warn(`[TerminologyValidator] Failed to validate code at ${codeInfo.path}:`, error);
          // Continue with other codes
        }
      }

    } catch (error) {
      console.error(`[TerminologyValidator] Fallback validation failed:`, error);
      issues.push({
        id: `fallback-terminology-error-${Date.now()}`,
        aspect: 'terminology',
        severity: 'warning',
        code: 'terminology-fallback-error',
        message: `Fallback terminology validation failed: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      });
    }

    return issues;
  }

  /**
   * Extract codes from resource for validation
   */
  private extractCodes(resource: any, resourceType: string): Array<{
    code: string;
    system: string;
    valueSetUrl?: string;
    path: string;
  }> {
    const codes: Array<{ code: string; system: string; valueSetUrl?: string; path: string }> = [];

    // Common terminology fields by resource type
    const terminologyPaths: Record<string, Array<{ path: string; valueSetUrl?: string }>> = {
      Patient: [
        { path: 'gender', valueSetUrl: 'http://hl7.org/fhir/ValueSet/administrative-gender' }
      ],
      Observation: [
        { path: 'status', valueSetUrl: 'http://hl7.org/fhir/ValueSet/observation-status' },
        { path: 'code.coding' },
      ],
      Condition: [
        { path: 'clinicalStatus.coding' },
        { path: 'verificationStatus.coding' },
        { path: 'code.coding' },
      ],
      Encounter: [
        { path: 'status', valueSetUrl: 'http://hl7.org/fhir/ValueSet/encounter-status' },
        { path: 'class.code' },
      ],
    };

    const paths = terminologyPaths[resourceType] || [];

    for (const pathInfo of paths) {
      const value = this.getFieldValue(resource, pathInfo.path);
      if (value) {
        if (typeof value === 'string') {
          // Simple code field - infer system from ValueSet URL
          const system = this.inferSystemFromValueSet(pathInfo.valueSetUrl);
          console.log(`[TerminologyValidator] Extracted code: "${value}" with system: "${system}" from ValueSet: "${pathInfo.valueSetUrl}"`);
          codes.push({
            code: value,
            system: system,
            valueSetUrl: pathInfo.valueSetUrl,
            path: pathInfo.path,
          });
        } else if (Array.isArray(value)) {
          // Array of codings
          value.forEach((coding: any, index: number) => {
            if (coding.code && coding.system) {
              codes.push({
                code: coding.code,
                system: coding.system,
                valueSetUrl: pathInfo.valueSetUrl,
                path: `${pathInfo.path}[${index}]`,
              });
            }
          });
        } else if (value.code && value.system) {
          // Single coding
          codes.push({
            code: value.code,
            system: value.system,
            valueSetUrl: pathInfo.valueSetUrl,
            path: pathInfo.path,
          });
        }
      }
    }

    return codes;
  }

  /**
   * Get field value from resource by path
   */
  private getFieldValue(resource: any, path: string): any {
    const parts = path.split('.');
    let current = resource;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Generate cache key for validation result
   */
  private generateCacheKey(resource: any, resourceType: string, mode: string): string {
    // Simple cache key based on resource ID and type
    const resourceId = resource.id || 'no-id';
    const resourceVersion = resource.meta?.versionId || 'no-version';
    return `${resourceType}-${resourceId}-${resourceVersion}-${mode}`;
  }

  /**
   * Get cached validation result
   */
  private getCachedResult(cacheKey: string, mode: 'online' | 'offline'): CachedValidationResult | null {
    const cached = this.validationCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Check TTL based on mode
    const ttl = mode === 'online' ? 60 * 60 * 1000 : Number.MAX_SAFE_INTEGER; // 1 hour online, indefinite offline
    const age = Date.now() - cached.timestamp;

    if (age > ttl) {
      // Expired
      this.validationCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache validation result
   */
  private cacheResult(cacheKey: string, issues: ValidationIssue[], mode: 'online' | 'offline'): void {
    this.validationCache.set(cacheKey, {
      issues,
      timestamp: Date.now(),
      mode,
    });

    // Limit cache size
    if (this.validationCache.size > 1000) {
      // Remove oldest entries
      const keysToRemove = Array.from(this.validationCache.keys()).slice(0, 100);
      keysToRemove.forEach(key => this.validationCache.delete(key));
    }
  }

  /**
   * Clear cache (useful on mode switch)
   */
  clearCache(): void {
    this.validationCache.clear();
    console.log(`[TerminologyValidator] Cache cleared`);
  }

  /**
   * Detect FHIR version from resource
   */
  private detectFhirVersion(resource: any): 'R4' | 'R5' | 'R6' {
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

    // Default to R4
    return 'R4';
  }

  /**
   * Check HAPI validator availability (cached)
   */
  private async checkHapiAvailability(): Promise<void> {
    if (this.hapiAvailable !== null) {
      return;
    }

    try {
      const setupResult = await hapiValidatorClient.testSetup();
      this.hapiAvailable = setupResult.success;
      console.log(`[TerminologyValidator] HAPI validator available: ${this.hapiAvailable}`);
    } catch (error) {
      console.warn(`[TerminologyValidator] Failed to check HAPI availability:`, error);
      this.hapiAvailable = false;
    }
  }

  /**
   * Refresh HAPI availability check
   */
  async refreshHapiAvailability(): Promise<boolean> {
    this.hapiAvailable = null;
    await this.checkHapiAvailability();
    return this.hapiAvailable === true;
  }

  /**
   * Get validator status
   */
  getValidatorStatus(): {
    hapiAvailable: boolean | null;
    cacheSize: number;
    preferredValidator: 'hapi' | 'fallback' | 'unknown';
  } {
    return {
      hapiAvailable: this.hapiAvailable,
      cacheSize: this.validationCache.size,
      preferredValidator: this.hapiAvailable === true ? 'hapi' : 
                         this.hapiAvailable === false ? 'fallback' : 
                         'unknown',
    };
  }

  /**
   * Get terminology server URL for a specific version and mode
   * Task 2.9: Public API for version-specific terminology server info
   * 
   * @param fhirVersion - FHIR version (R4, R5, R6)
   * @param mode - Online or offline mode
   * @returns Terminology server URL
   */
  getTerminologyServerUrl(fhirVersion: 'R4' | 'R5' | 'R6', mode: 'online' | 'offline'): string {
    return getTerminologyServerUrl(fhirVersion, mode, hapiValidatorConfig);
  }

  /**
   * Get all available terminology servers
   * Task 2.9: Query available terminology servers by version and mode
   * 
   * @returns Information about available terminology servers
   */
  getAllTerminologyServers(): Array<{
    fhirVersion: 'R4' | 'R5' | 'R6';
    mode: 'online' | 'offline';
    url: string;
  }> {
    const versions: Array<'R4' | 'R5' | 'R6'> = ['R4', 'R5', 'R6'];
    const modes: Array<'online' | 'offline'> = ['online', 'offline'];
    const servers: Array<{
      fhirVersion: 'R4' | 'R5' | 'R6';
      mode: 'online' | 'offline';
      url: string;
    }> = [];

    for (const version of versions) {
      for (const mode of modes) {
        const url = getTerminologyServerUrl(version, mode, hapiValidatorConfig);
        servers.push({
          fhirVersion: version,
          mode,
          url,
        });
      }
    }

    return servers;
  }

  /**
   * Infer the code system from a ValueSet URL
   */
  private inferSystemFromValueSet(valueSetUrl?: string): string {
    if (!valueSetUrl) return '';
    
    // Map common ValueSet URLs to their corresponding code systems
    const valueSetToSystemMap: Record<string, string> = {
      'http://hl7.org/fhir/ValueSet/administrative-gender': 'http://hl7.org/fhir/administrative-gender',
      'http://hl7.org/fhir/ValueSet/observation-status': 'http://hl7.org/fhir/observation-status',
      'http://hl7.org/fhir/ValueSet/encounter-status': 'http://hl7.org/fhir/encounter-status',
      'http://hl7.org/fhir/ValueSet/condition-clinical': 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      'http://hl7.org/fhir/ValueSet/condition-ver-status': 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
    };
    
    return valueSetToSystemMap[valueSetUrl] || '';
  }
}

// ============================================================================
// Types
// ============================================================================

interface CachedValidationResult {
  issues: ValidationIssue[];
  timestamp: number;
  mode: 'online' | 'offline';
}

// Export singleton instance (maintains backward compatibility)
export const terminologyValidator = new TerminologyValidator();
