/**
 * Profile Validator (Refactored)
 * 
 * Handles FHIR profile conformance validation using HAPI FHIR Validator.
 * Replaces stub implementation that only checked if meta.profile exists.
 * 
 * Features:
 * - Real profile conformance validation via HAPI
 * - Support for R4, R5, R6 profiles
 * - StructureDefinition constraint validation
 * - Profile resolution from Simplifier/local cache
 * - Fallback to basic profile checking if HAPI unavailable
 * - Task 2.8: Version-specific IG package loading
 * 
 * Architecture:
 * - Primary: Uses HAPI FHIR Validator for comprehensive profile validation
 * - Fallback: Basic profile constraint checking for known profiles
 * - Integrates with ProfileManager for IG package resolution
 * - Version-aware IG package selection via fhir-package-versions.ts
 * 
 * File size: Target <400 lines (global.mdc compliance)
 */

import type { ValidationIssue } from '../types/validation-types';
import type { ValidationSettings } from '@shared/validation-settings';
import { hapiValidatorClient } from './hapi-validator-client';
import type { HapiValidationOptions } from './hapi-validator-types';
import {
  getPackagesForVersion,
  getGermanPackagesForVersion,
  getCorePackageId,
} from '../../../config/fhir-package-versions';
import { addR6WarningIfNeeded } from '../utils/r6-support-warnings';
import { getProfileResolver } from '../utils/profile-resolver';
import { GermanProfileDetector } from '../utils/german-profile-detector';

// ============================================================================
// Profile Validator
// ============================================================================

export class ProfileValidator {
  private hapiAvailable: boolean | null = null;
  private profileResolver = getProfileResolver({
    autoDownload: true,
    resolvePackageDependencies: true,
    maxPackageDependencyDepth: 3,
  });

  /**
   * Validate resource against FHIR profiles
   * 
   * @param resource - FHIR resource to validate
   * @param resourceType - Expected resource type
   * @param profileUrl - Optional specific profile URL to validate against
   * @param fhirVersion - FHIR version for validation
   * @param settings - Validation settings including profileSources configuration
   * @returns Array of profile validation issues
   */
  async validate(
    resource: any,
    resourceType: string,
    profileUrl?: string,
    fhirVersion?: 'R4' | 'R5' | 'R6', // Task 2.4: Accept FHIR version parameter
    settings?: ValidationSettings
  ): Promise<ValidationIssue[]> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    try {
      console.log(`[ProfileValidator] Validating ${resourceType} resource profile...`);

      // Detect FHIR version
      const fhirVersion = this.detectFhirVersion(resource);

      // Collect profiles to validate against
      const profilesToValidate = this.collectProfiles(resource, profileUrl);

      if (profilesToValidate.length === 0) {
        console.log(`[ProfileValidator] No profiles declared, performing basic validation`);
        return this.performBasicProfileValidation(resource, resourceType);
      }

      console.log(`[ProfileValidator] Validating against ${profilesToValidate.length} profile(s): ${profilesToValidate.join(', ')}`);

      // Check HAPI availability
      await this.checkHapiAvailability();

      // Validate against each profile
      for (const profile of profilesToValidate) {
        const profileIssues = await this.validateAgainstProfile(
          resource,
          resourceType,
          profile,
          fhirVersion,
          settings
        );
        issues.push(...profileIssues);
      }

      const validationTime = Date.now() - startTime;
      console.log(
        `[ProfileValidator] Validated ${resourceType} profile in ${validationTime}ms ` +
        `(${issues.length} issues, validator: ${this.hapiAvailable ? 'HAPI' : 'basic'})`
      );

      // Add R6 warning if needed (Task 2.10)
      return addR6WarningIfNeeded(issues, fhirVersion, 'profile');

    } catch (error) {
      console.error('[ProfileValidator] Profile validation failed:', error);
      issues.push({
        id: `profile-error-${Date.now()}`,
        aspect: 'profile',
        severity: 'error',
        code: 'profile-validation-error',
        message: `Profile validation failed: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      });

      // Add R6 warning if needed (Task 2.10)
      return addR6WarningIfNeeded(issues, fhirVersion, 'profile');
    }
  }

  /**
   * Collect all profiles to validate against
   */
  private collectProfiles(resource: any, explicitProfileUrl?: string): string[] {
    const profiles: Set<string> = new Set();

    // Add explicit profile URL if provided
    if (explicitProfileUrl) {
      profiles.add(explicitProfileUrl);
    }

    // Add profiles declared in resource meta
    if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
      resource.meta.profile.forEach((profile: string) => {
        if (typeof profile === 'string' && profile.trim()) {
          profiles.add(profile);
        }
      });
    }

    return Array.from(profiles);
  }

  /**
   * Validate resource against a specific profile
   */
  private async validateAgainstProfile(
    resource: any,
    resourceType: string,
    profileUrl: string,
    fhirVersion: 'R4' | 'R5' | 'R6',
    settings?: ValidationSettings
  ): Promise<ValidationIssue[]> {
    if (this.hapiAvailable) {
      // Use HAPI for comprehensive profile validation
      return this.validateWithHapi(resource, resourceType, profileUrl, fhirVersion, settings);
    } else {
      // Fallback to basic profile checking
      return this.validateWithBasicProfileCheck(resource, resourceType, profileUrl);
    }
  }

  /**
   * Validate using HAPI FHIR Validator with profile
   * Task 2.8: Enhanced with version-specific IG package loading
   * Task 4.10: Integrated ProfileResolver for automatic profile resolution
   */
  private async validateWithHapi(
    resource: any,
    resourceType: string,
    profileUrl: string,
    fhirVersion: 'R4' | 'R5' | 'R6',
    settings?: ValidationSettings
  ): Promise<ValidationIssue[]> {
    try {
      console.log(`[ProfileValidator] Using HAPI validator for ${fhirVersion} profile: ${profileUrl}`);

      // Task 4.10: Resolve profile using ProfileResolver
      await this.resolveProfileBeforeValidation(profileUrl, settings);

      // Load version-specific IG packages (Task 2.8)
      const igPackages = this.getIgPackagesForProfile(profileUrl, fhirVersion);
      
      if (igPackages.length > 0) {
        console.log(
          `[ProfileValidator] Loading ${igPackages.length} version-specific IG package(s) for ${fhirVersion}: ` +
          igPackages.join(', ')
        );
      }

      // Determine profile resolution mode based on settings
      const profileSources = settings?.profileSources || 'both';
      let mode: 'online' | 'offline' = 'online';
      
      if (profileSources === 'local') {
        mode = 'offline';
      } else if (profileSources === 'simplifier') {
        mode = 'online';
      } else {
        // 'both' - use online mode for better profile resolution
        mode = 'online';
      }

      console.log(`[ProfileValidator] Profile sources: ${profileSources}, mode: ${mode}`);

      // Build validation options with profile and IG packages
      const options: HapiValidationOptions = {
        fhirVersion,
        profile: profileUrl,
        mode,
        igPackages: igPackages.length > 0 ? igPackages : undefined,
        cacheDirectory: settings?.offlineConfig?.profileCachePath || './server/cache/fhir-packages',
      };

      // Call HAPI validator
      const allIssues = await hapiValidatorClient.validateResource(resource, options);

      // Filter to profile-related issues only
      const profileIssues = this.filterProfileIssues(allIssues);

      console.log(
        `[ProfileValidator] HAPI validation complete: ${profileIssues.length} profile issues ` +
        `(${allIssues.length} total, IG packages: ${igPackages.length})`
      );

      return profileIssues;

    } catch (error) {
      console.error(`[ProfileValidator] HAPI validation failed for profile ${profileUrl}:`, error);
      
      // Return error as validation issue
      return [{
        id: `hapi-profile-error-${Date.now()}`,
        aspect: 'profile',
        severity: 'error',
        code: 'hapi-profile-validation-error',
        message: `HAPI profile validation failed: ${error instanceof Error ? error.message : String(error)}`,
        path: '',
        timestamp: new Date(),
      }];
    }
  }

  /**
   * Resolve profile before validation
   * Task 4.10: Use ProfileResolver to auto-download and cache profiles
   * 
   * @param profileUrl - Profile URL to resolve
   * @param settings - Validation settings
   */
  private async resolveProfileBeforeValidation(
    profileUrl: string,
    settings?: ValidationSettings
  ): Promise<void> {
    try {
      console.log(`[ProfileValidator] Resolving profile: ${profileUrl}`);
      
      // Use ProfileResolver to resolve the profile
      // This will automatically:
      // - Check cache
      // - Download if missing
      // - Detect German profiles
      // - Resolve dependencies
      // - Extract metadata
      const result = await this.profileResolver.resolveProfile(profileUrl, undefined, settings);
      
      if (result.germanProfile?.isGermanProfile) {
        console.log(
          `[ProfileValidator] ✓ German profile detected: ${result.germanProfile.family.toUpperCase()} ` +
          `(${result.germanProfile.confidence}% confidence)`
        );
        
        if (result.germanProfile.recommendedPackage) {
          console.log(`[ProfileValidator] Recommended package: ${result.germanProfile.recommendedPackage}`);
        }
      }
      
      if (result.metadata) {
        console.log(
          `[ProfileValidator] Profile metadata extracted: ` +
          `${result.metadata.elements.length} elements, ` +
          `${result.metadata.constraints.length} constraints`
        );
      }
      
    } catch (error) {
      console.warn(`[ProfileValidator] Profile resolution failed (continuing with validation):`, error);
      // Don't throw - let validation proceed even if resolution fails
    }
  }

  /**
   * Get IG packages for a specific profile and FHIR version
   * Task 2.8: Version-specific IG package selection
   * Task 4.10: Enhanced with German profile auto-detection
   * 
   * @param profileUrl - Profile URL to validate against
   * @param fhirVersion - FHIR version (R4, R5, R6)
   * @returns Array of IG package identifiers
   */
  private getIgPackagesForProfile(profileUrl: string, fhirVersion: 'R4' | 'R5' | 'R6'): string[] {
    const packages: string[] = [];

    // Task 4.10: Use German profile detector for better detection
    const germanProfile = GermanProfileDetector.detectGermanProfile(profileUrl);
    
    if (germanProfile.isGermanProfile && germanProfile.recommendedPackage) {
      console.log(
        `[ProfileValidator] German ${germanProfile.family.toUpperCase()} profile detected, ` +
        `adding package: ${germanProfile.recommendedPackage}`
      );
      packages.push(germanProfile.recommendedPackage);
      return packages;
    }

    // Check if profile URL indicates a specific IG package
    const profileLower = profileUrl.toLowerCase();

    // US Core profiles
    if (profileLower.includes('hl7.org/fhir/us/core')) {
      if (fhirVersion === 'R4') {
        packages.push('hl7.fhir.us.core#7.0.0');
      } else if (fhirVersion === 'R5') {
        packages.push('hl7.fhir.us.core#6.1.0');
      }
      console.log(`[ProfileValidator] Detected US Core profile, adding US Core package for ${fhirVersion}`);
    }

    // International profiles (UV Extensions, IPS)
    if (profileLower.includes('hl7.fhir.uv') || profileLower.includes('/uv/')) {
      const uvPackages = getPackagesForVersion(fhirVersion)
        .filter(pkg => pkg.id.includes('hl7.fhir.uv'))
        .map(pkg => `${pkg.id}@${pkg.version}`);
      packages.push(...uvPackages);
    }

    // If no specific IG detected but profile is not from core spec or international profiles,
    // don't load any packages - let HAPI try to resolve from online sources
    // Removed German profile fallback as it causes errors for non-German profiles

    return [...new Set(packages)]; // Remove duplicates
  }

  /**
   * Filter HAPI validation issues to only profile-related ones
   */
  private filterProfileIssues(allIssues: ValidationIssue[]): ValidationIssue[] {
    return allIssues.filter(issue => {
      // Already tagged as profile by hapi-issue-mapper
      if (issue.aspect === 'profile') {
        return true;
      }

      // Additional check: look for profile-related codes
      const code = issue.code?.toLowerCase() || '';
      const message = issue.message?.toLowerCase() || '';

      const profileKeywords = [
        'profile',
        'constraint',
        'invariant',
        'conformance',
        'structuredefinition',
      ];

      return profileKeywords.some(keyword => 
        code.includes(keyword) || message.includes(keyword)
      );
    });
  }

  /**
   * Basic profile validation (fallback when HAPI unavailable)
   */
  private async validateWithBasicProfileCheck(
    resource: any,
    resourceType: string,
    profileUrl: string
  ): Promise<ValidationIssue[]> {
    console.log(`[ProfileValidator] Using basic profile check (HAPI not available)`);
    
    // Just verify the profile is declared in meta.profile
    if (!resource.meta?.profile || !Array.isArray(resource.meta.profile)) {
      return [{
        id: `basic-profile-${Date.now()}`,
        aspect: 'profile',
        severity: 'warning',
        code: 'profile-not-declared',
        message: `Profile ${profileUrl} not declared in resource meta.profile`,
        path: 'meta.profile',
        timestamp: new Date(),
      }];
    }

    const hasProfile = resource.meta.profile.includes(profileUrl);
    if (!hasProfile) {
      return [{
        id: `basic-profile-mismatch-${Date.now()}`,
        aspect: 'profile',
        severity: 'warning',
        code: 'profile-not-declared',
        message: `Profile ${profileUrl} not found in declared profiles`,
        path: 'meta.profile',
        timestamp: new Date(),
      }];
    }

    // Profile is declared - basic validation passed
    return [];
  }

  /**
   * Perform basic profile validation when no profiles are specified
   */
  private async performBasicProfileValidation(
    resource: any,
    resourceType: string
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if meta.profile should be present
    if (!resource.meta?.profile || !Array.isArray(resource.meta.profile) || resource.meta.profile.length === 0) {
      issues.push({
        id: `basic-no-profile-${Date.now()}`,
        aspect: 'profile',
        severity: 'info',
        code: 'no-profile-declared',
        message: 'No profile declared in resource metadata',
        path: 'meta.profile',
        timestamp: new Date(),
      });
    }

    return issues;
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
      console.log(`[ProfileValidator] HAPI validator available: ${this.hapiAvailable}`);
    } catch (error) {
      console.warn(`[ProfileValidator] Failed to check HAPI availability:`, error);
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
    preferredValidator: 'hapi' | 'basic' | 'unknown';
  } {
    return {
      hapiAvailable: this.hapiAvailable,
      preferredValidator: this.hapiAvailable === true ? 'hapi' : 
                         this.hapiAvailable === false ? 'basic' : 
                         'unknown',
    };
  }

  /**
   * Get available IG packages for a profile and version
   * Task 2.8: Public API for version-specific IG package information
   * 
   * @param profileUrl - Profile URL
   * @param fhirVersion - FHIR version (R4, R5, R6)
   * @returns Array of IG package identifiers
   */
  getAvailableIgPackages(profileUrl: string, fhirVersion: 'R4' | 'R5' | 'R6'): string[] {
    return this.getIgPackagesForProfile(profileUrl, fhirVersion);
  }

  /**
   * Get all IG packages available for a FHIR version
   * Task 2.8: Query available packages by version
   * 
   * @param fhirVersion - FHIR version (R4, R5, R6)
   * @returns Information about available packages
   */
  getAllAvailablePackages(fhirVersion: 'R4' | 'R5' | 'R6'): Array<{
    id: string;
    version: string;
    name: string;
    type: 'german' | 'international';
  }> {
    const germanPackages = getGermanPackagesForVersion(fhirVersion).map(pkg => ({
      id: pkg.id,
      version: pkg.version,
      name: pkg.name,
      type: 'german' as const,
    }));

    const allPackages = getPackagesForVersion(fhirVersion);
    const internationalPackages = allPackages
      .filter(pkg => !germanPackages.some(gp => gp.id === pkg.id))
      .map(pkg => ({
        id: pkg.id,
        version: pkg.version,
        name: pkg.name,
        type: 'international' as const,
      }));

    return [...germanPackages, ...internationalPackages];
  }
}

// Export singleton instance (maintains backward compatibility)
export const profileValidator = new ProfileValidator();
