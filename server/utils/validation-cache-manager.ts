import crypto from 'crypto';
import { logger } from './logger.js';
import type { ValidationSettings } from '@shared/validation-settings';
import type { ValidationResult } from '../services/validation/core/validation-engine.js';

/**
 * Utility functions for validation result caching and persistence
 */
export class ValidationCacheManager {
  private static readonly VALIDATION_ENGINE_VERSION = '1.0.0';

  /**
   * Generate a hash of validation settings for cache invalidation
   */
  static generateSettingsHash(settings: ValidationSettings): string {
    try {
      // Create a normalized version of settings for hashing
      const normalizedSettings = {
        structural: {
          enabled: settings.structural?.enabled ?? true,
          severity: settings.structural?.severity ?? 'error'
        },
        profile: {
          enabled: settings.profile?.enabled ?? true,
          severity: settings.profile?.severity ?? 'warning'
        },
        terminology: {
          enabled: settings.terminology?.enabled ?? true,
          severity: settings.terminology?.severity ?? 'warning'
        },
        reference: {
          enabled: settings.reference?.enabled ?? true,
          severity: settings.reference?.severity ?? 'error'
        },
        businessRule: {
          enabled: settings.businessRule?.enabled ?? true,
          severity: settings.businessRule?.severity ?? 'warning'
        },
        metadata: {
          enabled: settings.metadata?.enabled ?? true,
          severity: settings.metadata?.severity ?? 'information'
        },
        strictMode: settings.strictMode ?? false,
        validateAgainstBaseSpec: settings.validateAgainstBaseSpec ?? true,
        validateExternalReferences: settings.validateExternalReferences ?? true,
        validateNonExistentReferences: settings.validateNonExistentReferences ?? true,
        validateReferenceTypes: settings.validateReferenceTypes ?? true
      };

      const settingsString = JSON.stringify(normalizedSettings, Object.keys(normalizedSettings).sort());
      return crypto.createHash('sha256').update(settingsString).digest('hex').substring(0, 16);
    } catch (error) {
      logger.error('[ValidationCacheManager] Error generating settings hash:', { service: 'validation-cache-manager', operation: 'generateSettingsHash' }, error);
      return 'default';
    }
  }

  /**
   * Generate a hash of resource content for change detection
   */
  static generateResourceHash(resourceData: any): string {
    try {
      // Normalize the resource data for consistent hashing
      const normalizedData = {
        resourceType: resourceData.resourceType,
        id: resourceData.id,
        // Include key fields that affect validation
        meta: resourceData.meta,
        // Include profile references
        meta_profile: resourceData.meta?.profile,
        // Include version info
        meta_versionId: resourceData.meta?.versionId,
        meta_lastUpdated: resourceData.meta?.lastUpdated
      };

      const resourceString = JSON.stringify(normalizedData, Object.keys(normalizedData).sort());
      return crypto.createHash('sha256').update(resourceString).digest('hex').substring(0, 16);
    } catch (error) {
      logger.error('[ValidationCacheManager] Error generating resource hash:', { service: 'validation-cache-manager', operation: 'generateResourceHash' }, error);
      return 'unknown';
    }
  }

  /**
   * Check if a validation result is still valid (not expired)
   */
  static isValidationResultValid(
    result: any,
    currentSettingsHash: string,
    currentResourceHash: string,
    maxAgeHours: number = 24
  ): boolean {
    try {
      // Check if settings have changed
      if (result.settingsHash !== currentSettingsHash) {
        logger.debug('[ValidationCacheManager] Validation result invalid: settings changed', { service: 'validation-cache-manager', operation: 'isValidationResultValid' });
        return false;
      }

      // Check if resource content has changed
      if (result.resourceHash !== currentResourceHash) {
        logger.debug('[ValidationCacheManager] Validation result invalid: resource content changed', { service: 'validation-cache-manager', operation: 'isValidationResultValid' });
        return false;
      }

      // Check if validation engine version has changed
      if (result.validationEngineVersion !== this.VALIDATION_ENGINE_VERSION) {
        logger.debug('[ValidationCacheManager] Validation result invalid: validation engine version changed', { service: 'validation-cache-manager', operation: 'isValidationResultValid' });
        return false;
      }

      // Check if result is too old
      const resultAge = Date.now() - new Date(result.validatedAt).getTime();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      
      if (resultAge > maxAgeMs) {
        logger.debug('[ValidationCacheManager] Validation result invalid: too old', { service: 'validation-cache-manager', operation: 'isValidationResultValid' });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[ValidationCacheManager] Error checking validation result validity:', { service: 'validation-cache-manager', operation: 'isValidationResultValid' }, error);
      return false;
    }
  }

  /**
   * Prepare validation result data for storage with caching metadata
   */
  static prepareValidationResultForStorage(
    validationResult: ValidationResult,
    settings: ValidationSettings,
    resourceData: any,
    startTime: number
  ): any {
    try {
      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        resourceId: validationResult.resourceId,
        profileId: null, // TODO: Link to profile if available
        isValid: validationResult.isValid,
        errors: (validationResult as any).errors || [],
        warnings: (validationResult as any).warnings || [],
        issues: validationResult.issues || [],
        profileUrl: validationResult.profileUrl,
        errorCount: validationResult.summary.errorCount,
        warningCount: validationResult.summary.warningCount,
        validationScore: validationResult.summary.validationScore,
        validatedAt: new Date(),
        // Enhanced caching fields
        settingsHash: this.generateSettingsHash(settings),
        settingsVersion: settings.version || 1,
        resourceHash: this.generateResourceHash(resourceData),
        validationEngineVersion: this.VALIDATION_ENGINE_VERSION,
        performanceMetrics: {
          totalTimeMs: validationResult.performance.totalTimeMs,
          aspectTimes: validationResult.performance.aspectTimes,
          structuralTimeMs: validationResult.performance.structuralTimeMs,
          profileTimeMs: validationResult.performance.profileTimeMs,
          terminologyTimeMs: validationResult.performance.terminologyTimeMs,
          referenceTimeMs: validationResult.performance.referenceTimeMs,
          businessRuleTimeMs: validationResult.performance.businessRuleTimeMs,
          metadataTimeMs: validationResult.performance.metadataTimeMs
        },
        aspectBreakdown: validationResult.summary.aspectBreakdown,
        validationDurationMs: duration,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('[ValidationCacheManager] Error preparing validation result for storage:', { service: 'validation-cache-manager', operation: 'prepareValidationResultForStorage' }, error);
      throw error;
    }
  }

  /**
   * Get cache key for validation result lookup
   */
  static getCacheKey(resourceId: number, settingsHash: string): string {
    return `validation_result:${resourceId}:${settingsHash}`;
  }

  /**
   * Get cache key for resource hash lookup
   */
  static getResourceHashCacheKey(resourceId: number): string {
    return `resource_hash:${resourceId}`;
  }

  /**
   * Get cache key for settings hash lookup
   */
  static getSettingsHashCacheKey(): string {
    return 'current_settings_hash';
  }

  /**
   * Log validation result cache statistics
   */
  static logCacheStats(stats: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    invalidatedResults: number;
  }): void {
    const hitRate = stats.totalRequests > 0 ? (stats.cacheHits / stats.totalRequests) * 100 : 0;
    
    logger.info('[ValidationCacheManager] Cache Statistics:', { 
      service: 'validation-cache-manager', 
      operation: 'logCacheStats',
      totalRequests: stats.totalRequests,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      hitRate: `${hitRate.toFixed(2)}%`,
      invalidatedResults: stats.invalidatedResults
    });
  }
}

export default ValidationCacheManager;
