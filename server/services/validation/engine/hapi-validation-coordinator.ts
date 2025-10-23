/**
 * HAPI Validation Coordinator
 * 
 * Central service that calls HAPI once per resource validation and distributes
 * issues to validators by aspect. This eliminates duplicate HAPI calls and
 * prevents issue loss due to aspect-based filtering.
 * 
 * Architecture:
 * - Calls HAPI once with all profiles and settings
 * - Receives ALL issues from HAPI (structural, profile, terminology, etc.)
 * - Sorts issues by aspect using existing hapi-issue-mapper logic
 * - Caches issues in memory keyed by resourceId
 * - Validators query coordinator for their aspect's issues
 * - Auto-expires cache after 5 minutes
 */

import type { ValidationIssue } from '../types/validation-types';
import type { ValidationSettings } from '../../../../shared/validation-settings';
import type { ValidationAspectType } from '../../../../shared/schema-validation-per-aspect';
import { hapiValidatorClient } from './hapi-validator-client';
import { mapOperationOutcomeToIssues } from './hapi-issue-mapper';
import type { HapiValidationOptions } from './hapi-validator-types';

interface CoordinatorCacheEntry {
  issues: Map<ValidationAspectType, ValidationIssue[]>;
  timestamp: number;
  allIssues: ValidationIssue[];
}

/**
 * HAPI Validation Coordinator
 * Singleton service that manages HAPI validation calls and issue distribution
 */
class HapiValidationCoordinator {
  private cache = new Map<string, CoordinatorCacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Initialize coordinator for a resource
   * Calls HAPI once and caches all issues sorted by aspect
   */
  async initializeForResource(
    resource: any,
    settings: ValidationSettings,
    profileUrl?: string,
    fhirVersion: 'R4' | 'R5' | 'R6' = 'R4'
  ): Promise<void> {
    const resourceId = `${resource.resourceType}/${resource.id}`;
    
    // Check if already initialized and not expired
    if (this.hasBeenInitialized(resourceId)) {
      console.log(`[HapiValidationCoordinator] Already initialized for ${resourceId}`);
      return;
    }
    
    console.log(`[HapiValidationCoordinator] Initializing for ${resourceId}`);
    
    try {
      // Collect all profiles from resource and settings
      const profiles = this.collectProfiles(resource, profileUrl);
      
      if (profiles.length === 0) {
        console.log(`[HapiValidationCoordinator] No profiles to validate, skipping HAPI call`);
        // Initialize with empty cache
        this.cache.set(resourceId, {
          issues: new Map(),
          timestamp: Date.now(),
          allIssues: []
        });
        return;
      }
      
      // Collect IG packages from settings (validators will use their own logic)
      const igPackages = settings.igPackages || [];
      
      // Get terminology servers from settings and extract URLs
      const terminologyServersRaw = settings.terminologyServers || [];
      const terminologyServerUrls = terminologyServersRaw
        .filter((server: any) => server && server.enabled)
        .map((server: any) => server.url || server);
      
      // Build HAPI validation options
      const options: HapiValidationOptions = {
        fhirVersion,
        profile: profiles[0], // Primary profile
        mode: 'profile', // Comprehensive validation
        igPackages: igPackages.length > 0 ? igPackages : undefined,
        terminologyServers: terminologyServerUrls.length > 0 ? terminologyServerUrls : undefined,
        cacheDirectory: settings.offlineConfig?.profileCachePath || '/Users/sheydin/.fhir/packages',
        timeout: 150000, // 150 seconds for comprehensive validation
        enableBestPractice: settings.enableBestPracticeChecks ?? true,
        validationLevel: 'hints', // Get all messages
      };
      
      console.log(`[HapiValidationCoordinator] Calling HAPI with ${profiles.length} profiles, ${igPackages.length} IG packages`);
      console.log(`[HapiValidationCoordinator] Options: bestPractice=${options.enableBestPractice}, level=${options.validationLevel}`);
      
      // Call HAPI validator
      const startTime = Date.now();
      const operationOutcome = await hapiValidatorClient.validateResource(resource, options);
      const duration = Date.now() - startTime;
      
      console.log(`[HapiValidationCoordinator] HAPI returned in ${duration}ms with ${operationOutcome.issue?.length || 0} issues`);
      
      // Map to ValidationIssue format
      const allIssues = mapOperationOutcomeToIssues(operationOutcome, fhirVersion);
      
      // Group issues by aspect
      const issuesByAspect = new Map<ValidationAspectType, ValidationIssue[]>();
      
      for (const issue of allIssues) {
        const aspect = issue.aspect as ValidationAspectType;
        if (!issuesByAspect.has(aspect)) {
          issuesByAspect.set(aspect, []);
        }
        issuesByAspect.get(aspect)!.push(issue);
      }
      
      // Log distribution
      console.log(`[HapiValidationCoordinator] Issues by aspect:`);
      issuesByAspect.forEach((issues, aspect) => {
        console.log(`  - ${aspect}: ${issues.length} issues`);
      });
      
      // Cache the results
      this.cache.set(resourceId, {
        issues: issuesByAspect,
        timestamp: Date.now(),
        allIssues
      });
      
      console.log(`[HapiValidationCoordinator] Cached ${allIssues.length} total issues for ${resourceId}`);
      
    } catch (error) {
      console.error(`[HapiValidationCoordinator] Initialization failed:`, error);
      
      // Cache empty results to prevent retry
      this.cache.set(resourceId, {
        issues: new Map(),
        timestamp: Date.now(),
        allIssues: []
      });
      
      throw error;
    }
  }
  
  /**
   * Get issues for a specific aspect
   */
  getIssuesByAspect(resourceId: string, aspect: ValidationAspectType): ValidationIssue[] {
    const entry = this.cache.get(resourceId);
    
    if (!entry) {
      console.log(`[HapiValidationCoordinator] No cache entry for ${resourceId}`);
      return [];
    }
    
    // Check expiration
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      console.log(`[HapiValidationCoordinator] Cache expired for ${resourceId}`);
      this.cache.delete(resourceId);
      return [];
    }
    
    const issues = entry.issues.get(aspect) || [];
    console.log(`[HapiValidationCoordinator] Returning ${issues.length} issues for ${resourceId} aspect ${aspect}`);
    
    return issues;
  }
  
  /**
   * Check if coordinator has been initialized for a resource
   */
  hasBeenInitialized(resourceId: string): boolean {
    const entry = this.cache.get(resourceId);
    
    if (!entry) {
      return false;
    }
    
    // Check expiration
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(resourceId);
      return false;
    }
    
    return true;
  }
  
  /**
   * Clear cache for a specific resource
   */
  clear(resourceId: string): void {
    console.log(`[HapiValidationCoordinator] Clearing cache for ${resourceId}`);
    this.cache.delete(resourceId);
  }
  
  /**
   * Clear all cache entries
   */
  clearAll(): void {
    console.log(`[HapiValidationCoordinator] Clearing all cache (${this.cache.size} entries)`);
    this.cache.clear();
  }
  
  /**
   * Collect profiles from resource and explicit profileUrl
   */
  private collectProfiles(resource: any, explicitProfileUrl?: string): string[] {
    const profiles = new Set<string>();
    
    // Add explicit profile URL if provided
    if (explicitProfileUrl) {
      profiles.add(explicitProfileUrl);
    }
    
    // Add profiles from resource meta.profile
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
   * Clean up expired cache entries
   */
  cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        expiredKeys.push(key);
      }
    });
    
    if (expiredKeys.length > 0) {
      console.log(`[HapiValidationCoordinator] Cleaning up ${expiredKeys.length} expired entries`);
      expiredKeys.forEach(key => this.cache.delete(key));
    }
  }
}

// Singleton instance
let coordinatorInstance: HapiValidationCoordinator | null = null;

/**
 * Get singleton coordinator instance
 */
export function getHapiValidationCoordinator(): HapiValidationCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new HapiValidationCoordinator();
    
    // Setup periodic cleanup (every minute)
    setInterval(() => {
      coordinatorInstance?.cleanupExpiredEntries();
    }, 60 * 1000);
  }
  
  return coordinatorInstance;
}

/**
 * Export type for use in other modules
 */
export type { HapiValidationCoordinator };

