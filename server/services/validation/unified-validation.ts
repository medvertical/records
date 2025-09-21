import { createHash } from 'crypto';
import { storage } from '../../storage';
import { ValidationEngine } from './validation-engine.js';
import { FhirClient } from '../fhir/fhir-client.js';
import { getValidationSettingsService } from './validation-settings-service.js';
import { getValidationPipeline } from './validation-pipeline.js';
import ValidationCacheManager from '../../utils/validation-cache-manager.js';
import type { FhirResource, InsertFhirResource, InsertValidationResult, ValidationResult } from '@shared/schema.js';
import type { ValidationSettings } from '@shared/validation-settings.js';

/**
 * Unified validation service that handles both batch and individual resource validation
 * with timestamp-based invalidation
 *
 * DEPRECATION: This service is adapter-backed by the default ValidationPipeline.
 * New code should depend on the pipeline or its facade directly.
 */
export class UnifiedValidationService {
  private pipeline = getValidationPipeline();
  private cachedSettings: ValidationSettings | null = null;
  private settingsCacheTime: number = 0;
  private SETTINGS_CACHE_TTL = 60000; // Cache settings for 1 minute
  private settingsService: ReturnType<typeof getValidationSettingsService>;

  // Telemetry for deprecation tracking
  private static didWarnOnce = false;
  private deprecationUsageCount = 0;

  constructor(
    private fhirClient: FhirClient,
    private validationEngine: ValidationEngine
  ) {
    // Get the validation settings service instance
    this.settingsService = getValidationSettingsService();

    // Deprecation warning (warn once per process)
    if (!UnifiedValidationService.didWarnOnce) {
      UnifiedValidationService.didWarnOnce = true;
      // Keep logs concise outside tests
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[DEPRECATION] UnifiedValidationService is deprecated. Use ValidationPipeline or its facade.');
      }
    }

    // Set up event listeners for settings changes
    this.setupSettingsEventListeners();
  }

  /**
   * Telemetry accessor for monitoring remaining legacy usage paths
   */
  getTelemetry() {
    return {
      deprecationUsageCount: this.deprecationUsageCount
    };
  }

  /**
   * Set up event listeners for settings changes
   */
  private setupSettingsEventListeners(): void {
    // Listen for settings changes and automatically reload configuration
    this.settingsService.on('settingsChanged', (event) => {
      console.log('[UnifiedValidation] Settings changed, clearing cache and reloading configuration');
      this.clearSettingsCache();
      this.loadValidationSettings().catch(error => {
        console.error('[UnifiedValidation] Failed to reload settings after change:', error);
      });
    });

    // Listen for settings activation
    this.settingsService.on('settingsActivated', (event) => {
      console.log('[UnifiedValidation] Settings activated, reloading configuration');
      this.clearSettingsCache();
      this.loadValidationSettings().catch(error => {
        console.error('[UnifiedValidation] Failed to reload settings after activation:', error);
      });
    });

    // Listen for settings service errors
    this.settingsService.on('error', (error) => {
      console.error('[UnifiedValidation] Settings service error:', error);
      // Clear cache to force reload on next access
      this.clearSettingsCache();
    });
  }

  /**
   * Load validation settings from database and update engine configuration
   */
  async loadValidationSettings(): Promise<void> {
    // Check if we have cached settings that are still valid
    const now = Date.now();
    if (this.cachedSettings && (now - this.settingsCacheTime) < this.SETTINGS_CACHE_TTL) {
      return; // Use cached settings
    }
    
    try {
      const settings = await this.settingsService.getActiveSettings();
      if (settings) {
        // Cache the settings
        this.cachedSettings = settings;
        this.settingsCacheTime = now;
      
        // Only log in development mode to reduce overhead
        if (process.env.NODE_ENV === 'development') {
          console.log('[UnifiedValidation] Loading validation settings from database');
        }
        
        // Debug logging to see what settings are being loaded
        console.log('[UnifiedValidation] Loading settings:', {
          structural: settings.structural?.enabled,
          profile: settings.profile?.enabled,
          terminology: settings.terminology?.enabled,
          reference: settings.reference?.enabled,
          businessRule: settings.businessRule?.enabled,
          metadata: settings.metadata?.enabled,
          strictMode: settings.strictMode,
          fhirVersion: settings.fhirVersion
        });
        
        // Notify the pipeline to refresh its configuration
        this.pipeline.clearCache();

        console.log('[UnifiedValidation] Validation engine configuration updated successfully');
      }
    } catch (error) {
      console.error('[UnifiedValidation] Failed to load validation settings:', error);
      // Don't throw the error, just log it and continue with default settings
    }
  }

  /**
   * Extract profiles from validation settings
   */
  private extractProfilesFromSettings(settings: ValidationSettings): string[] {
    // Extract profiles from custom rules or other sources
    const profiles: string[] = [];
    
    // Add default profiles if none are specified
    if (profiles.length === 0) {
      profiles.push(
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'
      );
    }
    
    return profiles;
  }

  /**
   * Clear cached settings (e.g., when settings are updated)
   */
  clearSettingsCache(): void {
    this.cachedSettings = null;
    this.settingsCacheTime = 0;
  }

  /**
   * Force reload settings from database (bypasses cache)
   */
  async forceReloadSettings(): Promise<void> {
    this.clearSettingsCache();
    await this.loadValidationSettings();
  }

  /**
   * Get current validation settings
   */
  async getCurrentSettings(): Promise<ValidationSettings | null> {
    try {
      if (!this.cachedSettings) {
        await this.loadValidationSettings();
      }
      return this.cachedSettings;
    } catch (error) {
      console.error('[UnifiedValidation] Failed to get current settings:', error);
      return null;
    }
  }

  /**
   * Check if settings service is healthy
   */
  async isSettingsServiceHealthy(): Promise<boolean> {
    try {
      const healthStatus = await this.settingsService.getHealthStatus();
      return healthStatus.isHealthy;
    } catch (error) {
      console.error('[UnifiedValidation] Failed to check settings service health:', error);
      return false;
    }
  }

  /**
   * Filter validation issues based on current settings
   * This determines what the UI considers "valid" vs "error"
   */
  private filterValidationIssues(issues: any[]): { filteredIssues: any[], isValid: boolean } {
    if (!this.cachedSettings) {
      // If no settings, consider all issues as errors
      return { filteredIssues: issues, isValid: issues.length === 0 };
    }

    const settings = this.cachedSettings;
    
    // Check if ALL validation aspects are disabled
    const allAspectsDisabled = 
      settings.structural?.enabled !== true &&
      settings.profile?.enabled !== true &&
      settings.terminology?.enabled !== true &&
      settings.reference?.enabled !== true &&
      settings.businessRule?.enabled !== true &&
      settings.metadata?.enabled !== true;

    // Debug logging
    console.log('[FilterValidation] Settings check:', {
      structural: settings.structural?.enabled,
      profile: settings.profile?.enabled,
      terminology: settings.terminology?.enabled,
      reference: settings.reference?.enabled,
      businessRule: settings.businessRule?.enabled,
      metadata: settings.metadata?.enabled,
      allAspectsDisabled
    });

    if (allAspectsDisabled) {
      // If all aspects are disabled, consider everything valid
      console.log('[FilterValidation] All aspects disabled - returning valid result');
      return { filteredIssues: [], isValid: true };
    }

    const filteredIssues = issues.filter(issue => {
      const category = issue.category || 'structural';
      
      // Check if this category is enabled in settings
      switch (category) {
        case 'structural':
          return settings.structural?.enabled === true;
        case 'profile':
          return settings.profile?.enabled === true;
        case 'terminology':
          return settings.terminology?.enabled === true;
        case 'reference':
          return settings.reference?.enabled === true;
        case 'business-rule':
        case 'businessRule':
          return settings.businessRule?.enabled === true;
        case 'metadata':
          return settings.metadata?.enabled === true;
        case 'general':
          return true; // Always show general category issues
        default:
          return true; // Show unknown categories by default
      }
    });

    // A resource is considered "valid" if it has no errors/fatal issues in the filtered results
    const hasErrors = filteredIssues.some(issue => 
      issue.severity === 'error' || issue.severity === 'fatal'
    );
    
    return { 
      filteredIssues, 
      isValid: !hasErrors 
    };
  }

  /**
   * Check if validation results are outdated based on resource timestamps
   */
  private isValidationOutdated(resource: any, validationResults: ValidationResult[]): boolean {
    if (!validationResults || validationResults.length === 0) {
      return true; // No validation results exist
    }

    // Get the most recent validation timestamp
    const latestValidation = validationResults.reduce((latest, current) => {
      return current.validatedAt > latest.validatedAt ? current : latest;
    });

    // Compare with resource's lastUpdated timestamp
    const resourceLastUpdated = resource.meta?.lastUpdated;
    if (!resourceLastUpdated) {
      return false; // No timestamp available, assume validation is still valid
    }

    const resourceDate = new Date(resourceLastUpdated);
    const validationDate = new Date(latestValidation.validatedAt);

    // Disable verbose logging for performance
    // console.log(`[UnifiedValidation] Resource ${resource.resourceType}/${resource.id}:`);
    // console.log(`  Resource lastUpdated: ${resourceDate.toISOString()}`);
    // console.log(`  Latest validation: ${validationDate.toISOString()}`);
    // console.log(`  Is outdated: ${resourceDate > validationDate}`);

    return resourceDate > validationDate;
  }

  /**
   * Validate a single resource with smart caching and timestamp-based invalidation
   * ALWAYS performs ALL validation categories when saving to database
   * Display filtering happens at the API layer
   */
  async validateResource(
    resource: any, 
    skipUnchanged: boolean = true, 
    forceRevalidation: boolean = false,
    retryAttempt: number = 0
  ): Promise<{
    validationResults: ValidationResult[];
    wasRevalidated: boolean;
  }> {
    // Telemetry for deprecation
    this.deprecationUsageCount += 1;
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[DEPRECATION] UnifiedValidationService.validateResource invoked. Migrate to ValidationPipeline.');
    }

    const resourceHash = this.createResourceHash(resource);
    
    // Check if resource already exists in database
    let dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
    let wasRevalidated = false;

    // Save or update resource in database
    const resourceData: InsertFhirResource = {
      resourceType: resource.resourceType,
      resourceId: resource.id,
      versionId: resource.meta?.versionId,
      data: resource,
      resourceHash: resourceHash,
      serverId: 1 // Default server ID, should be dynamic in production
    };

    if (dbResource) {
      // Update existing resource
      await storage.updateFhirResource(dbResource.id, resource);
      // Get updated resource with current validation results
      const updatedResource = await storage.getFhirResourceById(dbResource.id);
      if (updatedResource) {
        dbResource = updatedResource;
      }
    } else {
      // Create new resource
      dbResource = await storage.createFhirResource(resourceData);
      dbResource.validationResults = [];
    }

    // Check if validation is needed
    const needsValidation = forceRevalidation || 
                           !dbResource.validationResults ||
                           dbResource.validationResults.length === 0 ||
                           (skipUnchanged && dbResource.resourceHash !== resourceHash) ||
                           this.isValidationOutdated(resource, dbResource.validationResults);

    if (needsValidation) {
      // Disable verbose logging for performance
      // console.log(`[UnifiedValidation] Performing validation for ${resource.resourceType}/${resource.id}`);
      wasRevalidated = true;

      // Get retry configuration from settings
      const settings = await this.getValidationSettings();
      const maxRetryAttempts = settings?.batchProcessingSettings?.maxRetryAttempts || 1;
      const retryDelayMs = settings?.batchProcessingSettings?.retryDelayMs || 2000;
      const retryFailedBatches = settings?.batchProcessingSettings?.retryFailedBatches || false;

      // Retry logic wrapper
      let validationResult: any = null;
      let lastError: any = null;
      let retryAttempts: any[] = [];
      let totalRetryDuration = 0;

      for (let attempt = 0; attempt <= maxRetryAttempts; attempt++) {
        const attemptStartTime = Date.now();
        const isRetry = attempt > 0;
        
        try {
          // Load settings first to check if validation should be skipped
          await this.loadValidationSettings();
        
          // Check if ALL validation aspects are disabled
          const currentSettings = this.cachedSettings?.settings || this.cachedSettings;
          const allAspectsDisabled = 
            currentSettings?.structural?.enabled !== true &&
            currentSettings?.profile?.enabled !== true &&
            currentSettings?.terminology?.enabled !== true &&
            currentSettings?.reference?.enabled !== true &&
            currentSettings?.businessRule?.enabled !== true &&
            currentSettings?.metadata?.enabled !== true;

          let enhancedResult: any;
          if (allAspectsDisabled) {
            // Skip validation entirely - return valid result
            enhancedResult = {
              isValid: true,
              resourceType: resource.resourceType,
              resourceId: resource.id,
              issues: [],
              validationAspects: {
                structural: { passed: true, issues: [] },
                profile: { passed: true, issues: [], profilesChecked: [] },
                terminology: { passed: true, issues: [], codesChecked: 0 },
                reference: { passed: true, issues: [], referencesChecked: 0 },
                businessRule: { passed: true, issues: [], rulesChecked: 0 },
                metadata: { passed: true, issues: [] }
              },
              validationScore: 100,
              validatedAt: new Date()
            };
          } else {
            // Always validate with all aspects - settings only affect result filtering
            // Delegate to the default validation pipeline (single-resource execution)
            const pipelineResult = await this.pipeline.executePipeline({
              resources: [{
                resource,
                resourceType: resource.resourceType,
                resourceId: resource.id,
                profileUrl: undefined,
                context: { requestedBy: 'unified-adapter' }
              }]
            });

            const vr = pipelineResult.results[0];
            const issues = (vr?.issues || []).map((issue: any) => ({
              severity: issue.severity, // expected to align with 'error' | 'warning' | 'information' | 'fatal'
              code: issue.code,
              message: issue.message,
              path: Array.isArray(issue.location) ? issue.location.join('.') : (issue.location || ''),
              expression: issue.expression,
              // Map aspect to legacy category naming
              category: issue.aspect === 'businessRule' ? 'business-rule' : (issue.aspect || 'structural')
            }));

            const aspects: Array<'structural'|'profile'|'terminology'|'reference'|'business-rule'|'metadata'> = [
              'structural','profile','terminology','reference','business-rule','metadata'
            ];
            const aspectGroups: Record<string, any[]> = Object.fromEntries(aspects.map(a => [a, []]));
            issues.forEach((i: any) => { (aspectGroups[i.category] ||= []).push(i); });

            enhancedResult = {
              isValid: vr?.isValid ?? true,
              resourceType: vr?.resourceType || resource.resourceType,
              resourceId: vr?.resourceId || resource.id,
              issues,
              validationAspects: {
                structural: { passed: (aspectGroups['structural']?.length ?? 0) === 0, issues: aspectGroups['structural'] || [] },
                profile: { passed: (aspectGroups['profile']?.length ?? 0) === 0, issues: aspectGroups['profile'] || [], profilesChecked: vr?.profileUrl ? [vr.profileUrl] : [] },
                terminology: { passed: (aspectGroups['terminology']?.length ?? 0) === 0, issues: aspectGroups['terminology'] || [], codesChecked: 0 },
                reference: { passed: (aspectGroups['reference']?.length ?? 0) === 0, issues: aspectGroups['reference'] || [], referencesChecked: 0 },
                businessRule: { passed: (aspectGroups['business-rule']?.length ?? 0) === 0, issues: aspectGroups['business-rule'] || [], rulesChecked: 0 },
                metadata: { passed: (aspectGroups['metadata']?.length ?? 0) === 0, issues: aspectGroups['metadata'] || [] }
              },
              validationScore: vr?.summary?.validationScore ?? (vr?.summary?.score ?? 0),
              validatedAt: vr?.validatedAt ? new Date(vr.validatedAt) : new Date()
            };
          }

          // Record successful attempt
          const attemptDuration = Date.now() - attemptStartTime;
          retryAttempts.push({
            attemptNumber: attempt + 1,
            attemptedAt: new Date(attemptStartTime),
            success: true,
            durationMs: attemptDuration,
            resultSummary: {
              isValid: enhancedResult.isValid,
              errorCount: enhancedResult.issues.filter((i: any) => i.severity === 'error' || i.severity === 'fatal').length,
              warningCount: enhancedResult.issues.filter((i: any) => i.severity === 'warning').length,
              validationScore: enhancedResult.validationScore
            }
          });

          // Success - break out of retry loop
          validationResult = enhancedResult;
          break;

        } catch (error) {
          lastError = error;
          const attemptDuration = Date.now() - attemptStartTime;
          totalRetryDuration += attemptDuration;

          // Record failed attempt
          retryAttempts.push({
            attemptNumber: attempt + 1,
            attemptedAt: new Date(attemptStartTime),
            success: false,
            durationMs: attemptDuration,
            errorMessage: error instanceof Error ? error.message : String(error)
          });

          console.error(`[UnifiedValidation] Validation attempt ${attempt + 1} failed for ${resource.resourceType}/${resource.id}:`, error);

          // Check if we should retry
          if (attempt < maxRetryAttempts && retryFailedBatches) {
            console.log(`[UnifiedValidation] Retrying validation for ${resource.resourceType}/${resource.id} in ${retryDelayMs}ms (attempt ${attempt + 2}/${maxRetryAttempts + 1})`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          } else {
            // No more retries - break out of loop
            break;
          }
        }
      }

      // Handle final result (success or failure after all retries)
      if (validationResult) {
        // Success case - process the validation result
        // Apply filtering based on current settings to determine what's considered "valid"
        const { filteredIssues, isValid } = this.filterValidationIssues(validationResult.issues);
        
        // Convert enhanced validation result to our database format
        const validationResultData: InsertValidationResult = {
          resourceId: dbResource.id,
          profileId: null,
          isValid: isValid, // Use filtered validity (what UI considers valid)
          errors: filteredIssues.filter(issue => issue.severity === 'error' || issue.severity === 'fatal').map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.message,
            path: issue.path,
            expression: issue.expression,
            code: issue.code
          })),
          warnings: filteredIssues.filter(issue => issue.severity === 'warning').map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.message,
            path: issue.path,
            expression: issue.expression,
            code: issue.code
          })),
          issues: enhancedResult.issues.map(issue => ({
            severity: issue.severity as 'error' | 'warning' | 'information',
            message: issue.message,
            path: issue.path,
            expression: issue.expression,
            code: issue.code,
            category: issue.category // Include category in stored issues
          })),
          profileUrl: enhancedResult.validationAspects.profile.profilesChecked[0] || null,
          errorCount: filteredIssues.filter(i => i.severity === 'error' || i.severity === 'fatal').length,
          warningCount: filteredIssues.filter(i => i.severity === 'warning').length,
          validationScore: enhancedResult.validationScore,
          validatedAt: enhancedResult.validatedAt,
          // Add enhanced validation details
          details: {
            validationAspects: enhancedResult.validationAspects,
            categories: {
              structural: enhancedResult.issues.filter(i => i.category === 'structural').length,
              profile: enhancedResult.issues.filter(i => i.category === 'profile').length,
              terminology: enhancedResult.issues.filter(i => i.category === 'terminology').length,
              reference: enhancedResult.issues.filter(i => i.category === 'reference').length,
              businessRule: enhancedResult.issues.filter(i => i.category === 'business-rule').length,
              metadata: enhancedResult.issues.filter(i => i.category === 'metadata').length
            },
            // Store both filtered and unfiltered results for debugging
            filteredIssues: filteredIssues,
            allIssues: enhancedResult.issues
          },
          // Add retry information
          retryAttemptCount: retryAttempts.length,
          maxRetryAttempts: maxRetryAttempts,
          isRetry: retryAttempts.length > 1,
          retryInfo: {
            attemptCount: retryAttempts.length,
            maxAttempts: maxRetryAttempts,
            isRetry: retryAttempts.length > 1,
            previousAttempts: retryAttempts,
            totalRetryDurationMs: totalRetryDuration,
            canRetry: retryAttempts.length < maxRetryAttempts,
            retryReason: retryAttempts.length > 1 ? 'Previous validation attempts failed' : undefined
          },
          canRetry: retryAttempts.length < maxRetryAttempts,
          totalRetryDurationMs: totalRetryDuration
        };

        // Save validation result with enhanced caching fields
        const enhancedValidationResult = ValidationCacheManager.prepareValidationResultForStorage(
          enhancedResult,
          currentSettings,
          resource,
          startTime
        );
        await storage.createValidationResult(enhancedValidationResult);

        // Get updated validation results
        const updatedValidationResults = await storage.getValidationResultsByResourceId(dbResource.id);
        return {
          validationResults: updatedValidationResults,
          wasRevalidated: true
        };

      } else {
        // All retry attempts failed - create error validation result
        console.error(`[UnifiedValidation] All validation attempts failed for ${resource.resourceType}/${resource.id} after ${retryAttempts.length} attempts`);
        
        const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
        const errorResult: InsertValidationResult = {
          resourceId: dbResource.id,
          profileId: null,
          isValid: false,
          errors: [{
            severity: 'error' as const,
            message: `Validation failed after ${retryAttempts.length} attempts: ${errorMessage}`,
            path: '',
            code: 'validation-retry-exhausted'
          }],
          warnings: [],
          issues: [{
            severity: 'error' as const,
            message: `Validation failed after ${retryAttempts.length} attempts: ${errorMessage}`,
            path: '',
            code: 'validation-retry-exhausted'
          }],
          errorCount: 1,
          warningCount: 0,
          validationScore: 0,
          validatedAt: new Date(),
          // Add retry information for failed attempts
          retryAttemptCount: retryAttempts.length,
          maxRetryAttempts: maxRetryAttempts,
          isRetry: retryAttempts.length > 1,
          retryInfo: {
            attemptCount: retryAttempts.length,
            maxAttempts: maxRetryAttempts,
            isRetry: retryAttempts.length > 1,
            previousAttempts: retryAttempts,
            totalRetryDurationMs: totalRetryDuration,
            canRetry: false, // All retries exhausted
            retryReason: 'All retry attempts exhausted'
          },
          canRetry: false,
          retryReason: 'All retry attempts exhausted',
          totalRetryDurationMs: totalRetryDuration
        };

        await storage.createValidationResult(errorResult);

        // Get updated validation results
        const updatedValidationResults = await storage.getValidationResultsByResourceId(dbResource.id);
        return {
          validationResults: updatedValidationResults,
          wasRevalidated: true
        };
      }
    } else {
      // Disable verbose logging for performance
      // console.log(`[UnifiedValidation] Using cached validation for ${resource.resourceType}/${resource.id}`);
      return {
        validationResults: dbResource.validationResults || [],
        wasRevalidated: false
      };
    }
  }

  /**
   * Calculate validation score based on issues
   */
  private calculateValidationScore(issues: any[]): number {
    let score = 100;
    
    for (const issue of issues) {
      switch (issue.severity) {
        case 'fatal':
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 2;
          break;
        case 'information':
          score -= 0.5;
          break;
      }
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Create hash for resource to detect changes
   */
  private createResourceHash(resource: any): string {
    // Create hash of resource data, excluding metadata that changes frequently
    const hashableData = {
      ...resource,
      meta: resource.meta ? {
        versionId: resource.meta.versionId,
        lastUpdated: resource.meta.lastUpdated
      } : undefined
    };
    
    const hash = createHash('sha256');
    hash.update(JSON.stringify(hashableData));
    return hash.digest('hex');
  }

  /**
   * Update configuration settings for the validation engine
   */
  updateConfig(config: any) {
    console.log('[UnifiedValidation] Updating configuration (adapter no-op, pipeline is settings-driven):', config);
  }

  /**
   * Check and potentially revalidate a resource with validation results
   */
  async checkAndRevalidateResource(resourceWithValidation: FhirResource & { validationResults?: ValidationResult[] }): Promise<{
    resource: FhirResource & { validationResults: ValidationResult[] };
    wasRevalidated: boolean;
  }> {
    if (!resourceWithValidation.data) {
      return {
        resource: { ...resourceWithValidation, validationResults: resourceWithValidation.validationResults || [] },
        wasRevalidated: false
      };
    }

    // Check if revalidation is needed
    const needsRevalidation = !resourceWithValidation.validationResults ||
                             resourceWithValidation.validationResults.length === 0 ||
                             this.isValidationOutdated(resourceWithValidation.data, resourceWithValidation.validationResults);

    if (needsRevalidation) {
      console.log(`[UnifiedValidation] Resource ${resourceWithValidation.resourceType}/${resourceWithValidation.resourceId} needs revalidation`);
      
      const validationResult = await this.validateResource(resourceWithValidation.data, true, true);
      
      return {
        resource: {
          ...resourceWithValidation,
          validationResults: validationResult.validationResults
        },
        wasRevalidated: validationResult.wasRevalidated
      };
    }

    return {
      resource: { ...resourceWithValidation, validationResults: resourceWithValidation.validationResults || [] },
      wasRevalidated: false
    };
  }
}