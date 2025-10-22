/**
 * Profile Validator (Refactored)
 * 
 * Handles FHIR profile conformance validation using multiple validation engines.
 * Replaces stub implementation that only checked if meta.profile exists.
 * 
 * Features:
 * - Server-based validation via FHIR server's $validate operation
 * - HAPI FHIR Validator for comprehensive profile validation
 * - Support for R4, R5, R6 profiles
 * - StructureDefinition constraint validation
 * - Profile resolution from Simplifier/local cache
 * - Fallback to basic profile checking if validators unavailable
 * - Task 2.8: Version-specific IG package loading
 * 
 * Architecture:
 * - Primary: Uses FHIR server $validate when profile.engine='server'
 * - Secondary: Uses HAPI FHIR Validator when profile.engine='hapi'
 * - Auto mode: Tries server first, falls back to HAPI (profile.engine='auto')
 * - Fallback: Basic profile constraint checking for known profiles
 * - Integrates with ProfileManager for IG package resolution
 * - Version-aware IG package selection via fhir-package-versions.ts
 * 
 * File size: Target <500 lines (global.mdc compliance)
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
import {
  detectInternationalProfile,
  getRecommendedPackage as getInternationalPackage
} from '../utils/international-profile-detector';
import { getProfileResolutionTimeout, getHapiTimeout } from '../../../config/validation-timeouts'; // CRITICAL FIX: Import centralized timeouts
import { FhirClient, type FhirOperationOutcome } from '../../fhir/fhir-client';
import { storage } from '../../../storage';

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

  constructor() {
    // FhirClient will be created dynamically per validation request
    // using the active FHIR server from the database
  }

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
        console.log(`[ProfileValidator] No profiles to validate against (not even base profile)`);
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

    // If no profiles declared, skip profile validation
    // Base FHIR profiles are already validated by structural validation
    if (profiles.size === 0) {
      console.log(`[ProfileValidator] No profiles declared in meta.profile, skipping profile validation`);
    }

    return Array.from(profiles);
  }

  /**
   * Get base FHIR profile URL for a resource type
   * @param resourceType - FHIR resource type
   * @returns Base profile URL or null if not a standard resource
   */
  private getBaseProfileForResourceType(resourceType: string): string | null {
    // Base FHIR profiles follow pattern: http://hl7.org/fhir/StructureDefinition/{ResourceType}
    const standardResources = [
      'Patient', 'Practitioner', 'Organization', 'Location',
      'Observation', 'Condition', 'Procedure', 'MedicationRequest',
      'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
      'Encounter', 'CarePlan', 'Goal', 'ServiceRequest',
      'Specimen', 'Device', 'Medication', 'Substance',
      'DocumentReference', 'Binary', 'Bundle', 'Composition',
      'CareTeam', 'RelatedPerson', 'PractitionerRole', 'HealthcareService',
      'Endpoint', 'Schedule', 'Slot', 'Appointment', 'AppointmentResponse',
      'Communication', 'CommunicationRequest', 'MessageHeader',
      'OperationOutcome', 'Parameters', 'Subscription', 'ValueSet',
      'CodeSystem', 'StructureDefinition', 'CapabilityStatement'
    ];

    if (standardResources.includes(resourceType)) {
      return `http://hl7.org/fhir/StructureDefinition/${resourceType}`;
    }

    return null;
  }

  /**
   * Check if profile is a base FHIR profile
   * Base profiles are already validated by structural validation, no need for HAPI
   */
  private isBaseFhirProfile(profileUrl: string): boolean {
    const isBase = profileUrl.startsWith('http://hl7.org/fhir/StructureDefinition/');
    console.log(`[ProfileValidator] isBaseFhirProfile("${profileUrl}"): ${isBase}`);
    return isBase;
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
    // Get configured validation engine from settings
    const engine = settings?.aspects?.profile?.engine || 'hapi';
    console.log(`[ProfileValidator] ========================================`);
    console.log(`[ProfileValidator] validateAgainstProfile() called`);
    console.log(`[ProfileValidator] Profile URL: ${profileUrl}`);
    console.log(`[ProfileValidator] Settings engine: ${settings?.aspects?.profile?.engine}`);
    console.log(`[ProfileValidator] Resolved engine: ${engine}`);
    console.log(`[ProfileValidator] ========================================`);

    // Skip HAPI for base FHIR profiles (already validated by structural validation)
    // Base profiles: instant validation
    if (this.isBaseFhirProfile(profileUrl)) {
      console.log(`[ProfileValidator] Base FHIR profile detected, using fast validation: ${profileUrl}`);
      return this.validateWithBasicProfileCheck(resource, resourceType, profileUrl);
    }
    
    // For custom profiles (German KBV/MII, US Core, etc.), use configured engine
    // Engine options: 'server', 'hapi', 'auto'
    
    // Try server validation first if engine is 'server' or 'auto'
    if (engine === 'server' || engine === 'auto') {
      try {
        console.log(`[ProfileValidator] Using FHIR server $validate operation: ${profileUrl}`);
        return await this.validateWithServer(resource, profileUrl);
      } catch (error) {
        console.warn(`[ProfileValidator] Server validation failed:`, error);
        
        // If engine is strictly 'server', throw the error
        if (engine === 'server') {
          throw error;
        }
        
        // For 'auto', fall through to HAPI validation
        console.log(`[ProfileValidator] Falling back to HAPI validation (engine=auto)`);
      }
    }
    
    // Use HAPI validation
    // Note: First validation may take 10-20s (package loading), subsequent validations faster
    if (this.hapiAvailable) {
      console.log(`[ProfileValidator] Custom profile detected, using HAPI validation (with process pool): ${profileUrl}`);
      return this.validateWithHapi(resource, resourceType, profileUrl, fhirVersion, settings);
    } else {
      // Fallback to basic profile checking if HAPI unavailable
      console.log(`[ProfileValidator] HAPI not available, using basic validation: ${profileUrl}`);
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

      // Task 4.10: Resolve profile using ProfileResolver (with timeout)
      // Wrap profile resolution in timeout to prevent hanging
      // Use centralized timeout configuration
      const resolutionTimeout = getProfileResolutionTimeout();
      console.log(`[ProfileValidator] Profile resolution timeout configured: ${resolutionTimeout}ms`);
      
      try {
        await Promise.race([
          this.resolveProfileBeforeValidation(profileUrl, settings),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Profile resolution timeout after ${resolutionTimeout}ms`)), resolutionTimeout)
          )
        ]);
      } catch (error) {
        console.warn(`[ProfileValidator] Profile resolution failed/timed out (timeout: ${resolutionTimeout}ms):`, error);
        // Continue with validation even if resolution fails - HAPI may have cached profile
      }

      // Extract terminology servers from settings (priority order)
      const terminologyServers = this.extractTerminologyServers(settings, fhirVersion);
      
      if (terminologyServers.length > 0) {
        console.log(
          `[ProfileValidator] Using ${terminologyServers.length} terminology server(s) from settings: ` +
          terminologyServers.join(', ')
        );
      } else {
        console.log(`[ProfileValidator] No terminology servers configured in settings, will use default tx.fhir.org`);
      }

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

      // Build validation options with profile, IG packages, and terminology servers
      // Use centralized HAPI timeout configuration (150s) instead of hardcoded 60s
      const hapiTimeout = getHapiTimeout();
      console.log(`[ProfileValidator] Using HAPI timeout from config: ${hapiTimeout}ms (${(hapiTimeout / 1000).toFixed(1)}s)`);
      
      const options: HapiValidationOptions = {
        fhirVersion,
        profile: profileUrl,
        mode,
        terminologyServers: terminologyServers.length > 0 ? terminologyServers : undefined,
        igPackages: igPackages.length > 0 ? igPackages : undefined,
        cacheDirectory: settings?.offlineConfig?.profileCachePath || './server/cache/fhir-packages',
        timeout: hapiTimeout, // Use centralized timeout (default: 150s) for complex profile validation
      };

      // Call HAPI validator
      const allIssues = await hapiValidatorClient.validateResource(resource, options);
      
      console.log(`[ProfileValidator] HAPI returned ${allIssues.length} total issues`);

      // Filter to profile-related issues only
      const profileIssues = this.filterProfileIssues(allIssues);
      
      console.log(`[ProfileValidator] After filtering: ${profileIssues.length} profile issues (filtered out ${allIssues.length - profileIssues.length} non-profile issues)`);

      console.log(
        `[ProfileValidator] HAPI validation complete: ${profileIssues.length} profile issues ` +
        `(${allIssues.length} total, IG packages: ${igPackages.length})`
      );

      return profileIssues;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ProfileValidator] HAPI validation failed for profile ${profileUrl}:`, error);
      
      // Detect profile loading errors (malformed XML, network issues, etc.)
      const isProfileLoadError = 
        errorMessage.includes('FHIRFormatError') ||
        errorMessage.includes('processing instruction can not have PITarget') ||
        errorMessage.includes('loadProfile') ||
        errorMessage.includes('Unable to find/resolve/read') ||
        errorMessage.includes('profile-load-skipped');
      
      if (isProfileLoadError) {
        console.warn(`[ProfileValidator] ⚠️  Profile loading failed for ${profileUrl}, skipping profile validation`);
        console.warn(`[ProfileValidator] Reason: Profile URL may return HTML instead of StructureDefinition XML`);
        
        // Return informational issue instead of error
        return [{
          id: `profile-skipped-${Date.now()}`,
          aspect: 'profile',
          severity: 'info',
          code: 'profile-load-skipped',
          message: `Profile validation skipped: Unable to load profile from ${profileUrl}. The profile URL may be unavailable or returning invalid data.`,
          path: '',
          timestamp: new Date(),
        }];
      }
      
      // For other errors, return as error
      return [{
        id: `hapi-profile-error-${Date.now()}`,
        aspect: 'profile',
        severity: 'error',
        code: 'hapi-profile-validation-error',
        message: `HAPI profile validation failed: ${errorMessage}`,
        path: '',
        timestamp: new Date(),
      }];
    }
  }

  /**
   * Validate using FHIR server's $validate operation
   * This method calls the FHIR server's $validate endpoint with the profile URL
   * 
   * @param resource - FHIR resource to validate
   * @param profileUrl - Profile URL to validate against
   * @returns Array of profile validation issues
   */
  private async validateWithServer(
    resource: any,
    profileUrl: string
  ): Promise<ValidationIssue[]> {
    try {
      // Get the active FHIR server from database
      const activeServer = await storage.getActiveFhirServer();
      if (!activeServer) {
        throw new Error('No active FHIR server configured');
      }
      
      console.log(`[ProfileValidator] Using active FHIR server for $validate: ${activeServer.url}`);
      console.log(`[ProfileValidator] Validating against profile: ${profileUrl}`);
      
      // Create FhirClient with the active server's URL and auth config
      const authConfig = activeServer.authConfig ? activeServer.authConfig as any : undefined;
      const fhirClient = new FhirClient(
        activeServer.url,
        authConfig,
        activeServer.id
      );
      
      // Call server's $validate operation with profile parameter
      const outcome = await fhirClient.validateResourceDirect(resource, profileUrl);
      
      console.log(`[ProfileValidator] Server returned OperationOutcome with ${outcome.issue?.length || 0} issues`);
      
      // Map OperationOutcome to ValidationIssue[]
      const issues = this.mapOperationOutcomeToIssues(outcome);
      
      console.log(`[ProfileValidator] Mapped to ${issues.length} validation issues`);
      
      return issues;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ProfileValidator] Server validation failed:`, error);
      
      throw new Error(`Server validation failed: ${errorMessage}`);
    }
  }

  /**
   * Map FHIR OperationOutcome to ValidationIssue[]
   * Converts the FHIR OperationOutcome structure to our internal ValidationIssue format
   * 
   * @param outcome - FHIR OperationOutcome from server
   * @returns Array of ValidationIssue objects
   */
  private mapOperationOutcomeToIssues(outcome: FhirOperationOutcome): ValidationIssue[] {
    if (!outcome.issue || outcome.issue.length === 0) {
      return [];
    }

    return outcome.issue.map((issue, index) => {
      // Map severity: fatal/error -> error, warning -> warning, info -> info
      let severity: 'error' | 'warning' | 'info' = 'info';
      if (issue.severity === 'fatal' || issue.severity === 'error') {
        severity = 'error';
      } else if (issue.severity === 'warning') {
        severity = 'warning';
      } else {
        // 'info' or any other value maps to 'info'
        severity = 'info';
      }

      // Extract path from expression or location
      let path = '';
      if (issue.expression && issue.expression.length > 0) {
        path = issue.expression[0];
      } else if (issue.location && issue.location.length > 0) {
        path = issue.location[0];
      }

      // Get message from diagnostics or details.text
      const message = issue.diagnostics || issue.details?.text || 'Validation issue (no details provided)';

      return {
        id: `server-profile-${Date.now()}-${index}`,
        aspect: 'profile',
        severity,
        code: issue.code || 'unknown',
        message,
        path,
        timestamp: new Date(),
      };
    });
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
    // Skip resolution for core FHIR profiles (already in HAPI)
    if (profileUrl.startsWith('http://hl7.org/fhir/StructureDefinition/')) {
      console.log(`[ProfileValidator] Skipping resolution for core FHIR profile: ${profileUrl}`);
      return;
    }

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
   * Extract enabled terminology servers from settings
   * Filters by FHIR version compatibility, enabled status, and circuit breaker state
   * Returns servers in priority order (as defined in settings array)
   * 
   * @param settings - Validation settings with terminology servers configuration
   * @param fhirVersion - FHIR version to filter servers for
   * @returns Array of terminology server URLs in priority order
   */
  private extractTerminologyServers(settings: ValidationSettings | undefined, fhirVersion: 'R4' | 'R5' | 'R6'): string[] {
    if (!settings?.terminologyServers || settings.terminologyServers.length === 0) {
      console.log(`[ProfileValidator] No terminology servers found in settings`);
      return [];
    }

    const allServers = settings.terminologyServers;
    console.log(`[ProfileValidator] Found ${allServers.length} terminology server(s) in settings`);

    // Filter servers by enabled status, circuit breaker state, and FHIR version compatibility
    const compatibleServers = allServers.filter(server => {
      const isEnabled = server.enabled === true;
      const isCircuitOpen = server.circuitOpen === true;
      const supportsVersion = server.fhirVersions && server.fhirVersions.includes(fhirVersion);

      if (!isEnabled) {
        console.log(`[ProfileValidator] Skipping disabled server: ${server.name} (${server.url})`);
        return false;
      }

      if (isCircuitOpen) {
        console.log(`[ProfileValidator] Skipping server with open circuit: ${server.name} (${server.url})`);
        return false;
      }

      if (!supportsVersion) {
        console.log(
          `[ProfileValidator] Skipping incompatible server: ${server.name} (${server.url}) - ` +
          `supports ${server.fhirVersions?.join(', ') || 'unknown'}, need ${fhirVersion}`
        );
        return false;
      }

      console.log(`[ProfileValidator] ✓ Server compatible: ${server.name} (${server.url})`);
      return true;
    });

    // Extract URLs while maintaining priority order
    const serverUrls = compatibleServers.map(s => s.url);

    console.log(
      `[ProfileValidator] Filtered to ${serverUrls.length} compatible server(s) for ${fhirVersion}: ` +
      (serverUrls.length > 0 ? serverUrls.join(', ') : 'none')
    );

    return serverUrls;
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
      
      // Add dependencies for MII profiles to fix slice validation
      if (germanProfile.family === 'mii') {
        packages.push('de.basisprofil.r4#1.5.0');
        packages.push('de.medizininformatikinitiative.kerndatensatz.meta#2025.0.1');
        console.log(`[ProfileValidator] Added MII dependencies for slice validation`);
      }
      
      return packages;
    }

    // Auto-detect international profiles (Australian, US Core, UK Core, etc.)
    const intlProfile = detectInternationalProfile(profileUrl);
    
    if (intlProfile.isInternationalProfile && intlProfile.recommendedPackage) {
      const intlPackage = getInternationalPackage(profileUrl);
      if (intlPackage) {
        console.log(
          `[ProfileValidator] International ${intlProfile.family.toUpperCase()} profile detected ` +
          `(${intlProfile.region}), adding package: ${intlPackage}`
        );
        packages.push(intlPackage);
        return packages;
      }
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
    console.log(`[ProfileValidator] Filtering ${allIssues.length} issues...`);
    
    const profileIssues = allIssues.filter(issue => {
      // Already tagged as profile by hapi-issue-mapper
      if (issue.aspect === 'profile') {
        console.log(`[ProfileValidator] ✓ Keeping issue (aspect=profile): ${issue.message?.substring(0, 60)}`);
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

      const hasKeyword = profileKeywords.some(keyword => 
        code.includes(keyword) || message.includes(keyword)
      );
      
      if (hasKeyword) {
        console.log(`[ProfileValidator] ✓ Keeping issue (keyword match): ${issue.message?.substring(0, 60)}`);
      } else {
        console.log(`[ProfileValidator] ✗ Filtering out (aspect=${issue.aspect}): ${issue.message?.substring(0, 60)}`);
      }
      
      return hasKeyword;
    });
    
    return profileIssues;
  }

  /**
   * Basic profile validation (fallback when HAPI unavailable OR for base FHIR profiles)
   */
  private async validateWithBasicProfileCheck(
    resource: any,
    resourceType: string,
    profileUrl: string
  ): Promise<ValidationIssue[]> {
    const isBaseProfile = this.isBaseFhirProfile(profileUrl);
    console.log(
      `[ProfileValidator] Using basic profile check for ${profileUrl} ` +
      `(${isBaseProfile ? 'base profile - fast path' : 'HAPI not available'})`
    );
    
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
    console.log(`[ProfileValidator] Profile ${profileUrl} is declared in meta.profile - validation passed`);
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
