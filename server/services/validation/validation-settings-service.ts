/**
 * Validation Settings Service - Rock Solid Settings Management
 * 
 * This service serves as the single source of truth for all validation settings.
 * It provides centralized management, real-time synchronization, and event-driven updates.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  ValidationSettingsPreset,
  ValidationAspect
} from '@shared/validation-settings';
import {
  validateValidationSettings,
  validatePartialValidationSettings,
  normalizeValidationSettings
} from '@shared/validation-settings-validator';
import {
  DEFAULT_VALIDATION_SETTINGS,
  BUILT_IN_PRESETS
} from '@shared/validation-settings';
import { ValidationSettingsRepository } from '../../repositories/validation-settings-repository';
import {
  ValidationSettingsError,
  ValidationSettingsErrorLogger,
  createInitializationError,
  createDatabaseError,
  createValidationError,
  createSettingsNotFoundError,
  createCacheError,
  createSystemError,
  withErrorRecovery,
  type ErrorRecoveryOptions
} from './validation-settings-errors';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationSettingsServiceConfig {
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  
  /** Maximum number of settings versions to keep */
  maxVersions: number;
  
  /** Whether to enable real-time synchronization */
  enableRealTimeSync: boolean;
  
  /** Whether to enable automatic backup */
  enableAutoBackup: boolean;
  
  /** Backup interval in milliseconds */
  backupIntervalMs: number;
}

export interface SettingsChangeEvent {
  /** Type of change */
  type: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
  
  /** Settings ID */
  settingsId: string;
  
  /** Previous version (for updates) */
  previousVersion?: ValidationSettings;
  
  /** New version */
  newVersion?: ValidationSettings;
  
  /** User who made the change */
  changedBy?: string;
  
  /** Timestamp of the change */
  timestamp: Date;
}

export interface SettingsCacheEntry {
  /** Cached settings */
  settings: ValidationSettings;
  
  /** Cache timestamp */
  cachedAt: Date;
  
  /** Cache TTL */
  ttlMs: number;
  
  /** Whether the cache entry is valid */
  isValid: boolean;
  
  /** Last access timestamp for LRU */
  lastAccessed: Date;
  
  /** Access count for usage statistics */
  accessCount: number;
  
  /** Cache dependencies (other settings that affect this one) */
  dependencies: Set<string>;
  
  /** Cache tags for selective invalidation */
  tags: Set<string>;
}

export interface CacheMetrics {
  /** Total cache hits */
  hits: number;
  
  /** Total cache misses */
  misses: number;
  
  /** Cache hit ratio */
  hitRatio: number;
  
  /** Average access time */
  averageAccessTime: number;
  
  /** Cache size in bytes (estimated) */
  sizeBytes: number;
  
  /** Number of evictions */
  evictions: number;
  
  /** Cache efficiency score (0-100) */
  efficiencyScore: number;
}

// ============================================================================
// Validation Settings Service
// ============================================================================

export class ValidationSettingsService extends EventEmitter {
  private config: ValidationSettingsServiceConfig;
  private cache: Map<string, SettingsCacheEntry> = new Map();
  private activeSettings: ValidationSettings | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private backupTimer: NodeJS.Timeout | null = null;
  private repository: ValidationSettingsRepository;
  private errorLogger: ValidationSettingsErrorLogger;
  
  // Cache metrics and management
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    averageAccessTime: 0,
    sizeBytes: 0,
    evictions: 0,
    efficiencyScore: 0
  };
  private maxCacheSize: number = 100; // Maximum number of cache entries
  private cacheCleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ValidationSettingsServiceConfig> = {}) {
    super();
    
    this.config = {
      cacheTtlMs: 300000, // 5 minutes
      maxVersions: 10,
      enableRealTimeSync: true,
      enableAutoBackup: true,
      backupIntervalMs: 3600000, // 1 hour
      ...config
    };
    
    this.repository = new ValidationSettingsRepository();
    this.errorLogger = new ValidationSettingsErrorLogger();

    this.setupEventHandlers();
  }

  // ========================================================================
  // Initialization and Lifecycle
  // ========================================================================

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    try {
      // Load active settings from database
      await this.loadActiveSettings();
      
      // Start backup timer if enabled
      if (this.config.enableAutoBackup) {
        this.startBackupTimer();
      }
      
      // Start cache cleanup timer
      this.startCacheCleanupTimer();
      
      // Warm cache with frequently accessed settings
      await this.warmCache();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      const initError = createInitializationError(
        `Failed to initialize ValidationSettingsService: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'initialize' }
      );
      
      this.errorLogger.logError(initError, 'initialize');
      this.emit('error', initError);
      throw initError;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop backup timer
      if (this.backupTimer) {
        clearInterval(this.backupTimer);
        this.backupTimer = null;
      }
      
      // Stop cache cleanup timer
      this.stopCacheCleanupTimer();
      
      // Clear cache
      this.cache.clear();
      
      this.isInitialized = false;
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to shutdown ValidationSettingsService: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========================================================================
  // Settings Management
  // ========================================================================

  /**
   * Get current active settings
   */
  async getActiveSettings(): Promise<ValidationSettings> {
    if (!this.isInitialized && !this.isInitializing) {
      await this.initialize();
    }

    if (this.activeSettings) {
      return this.activeSettings;
    }

    // Load from database if not in memory
    try {
      const activeRecord = await this.repository.getActive();
      if (activeRecord) {
        this.activeSettings = activeRecord.settings;
        return this.activeSettings;
      }
    } catch (error) {
      console.error('[ValidationSettingsService] Error loading active settings:', error);
    }
    
    if (!this.activeSettings) {
      // Create default settings if none exist
      this.activeSettings = await this.createDefaultSettings();
    }

    return this.activeSettings;
  }

  /**
   * Get settings by ID
   */
  async getSettingsById(settingsId: string): Promise<ValidationSettings | null> {
    // Check cache first
    const cached = this.getCachedSettings(settingsId);
    if (cached) {
      return cached;
    }

    // Load from database
    const settings = await this.loadSettingsFromDatabase(settingsId);
    if (settings) {
      this.setCachedSettings(settingsId, settings);
    }

    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(update: ValidationSettingsUpdate): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
    // Transform string dates to Date objects before validation
    const transformedSettings = this.transformStringDatesToObjects(update.settings);
    
    // Validate the update
    console.log('[ValidationSettingsService] Validating settings update:', JSON.stringify(transformedSettings, null, 2));
    const validationResult = validatePartialValidationSettings(transformedSettings);
    if (!validationResult.isValid) {
      console.error('[ValidationSettingsService] Validation failed:', validationResult.errors);
      throw new Error(`Invalid settings update: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    // Get current settings
    const currentSettings = await this.getActiveSettings();
    
    // Merge with current settings
    const updatedSettings: ValidationSettings = {
      ...currentSettings,
      ...transformedSettings,
      version: update.createNewVersion ? currentSettings.version + 1 : currentSettings.version,
      updatedAt: new Date(),
      updatedBy: update.updatedBy
    };

    // Normalize and validate the complete settings
    const normalizedSettings = normalizeValidationSettings(updatedSettings);

      // Save to database with transaction support
    const savedSettings = await this.saveSettingsToDatabase(normalizedSettings);

    // Update cache
    this.setCachedSettings(savedSettings.id!, savedSettings);

    // Update active settings if this is the active configuration
    if (savedSettings.isActive) {
      this.activeSettings = savedSettings;
    }

    // Emit change event
    this.emit('settingsChanged', {
      type: 'updated',
      settingsId: savedSettings.id!,
      previousVersion: currentSettings,
      newVersion: savedSettings,
      changedBy: update.updatedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return savedSettings;

    } catch (error) {
      console.error('[ValidationSettingsService] Error updating settings:', error);
      
      // Emit error event
      this.emit('settingsUpdateError', {
        error: error instanceof Error ? error : new Error('Unknown error'),
        update,
        timestamp: new Date()
      });

      // Re-throw with more context
      throw new Error(`Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new settings configuration
   */
  async createSettings(settings: Partial<ValidationSettings>, createdBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Merge with defaults
    const newSettings: ValidationSettings = {
      ...DEFAULT_VALIDATION_SETTINGS,
      ...settings,
      version: 1,
      isActive: false, // New settings are not active by default
      createdAt: new Date(),
      createdBy
    };

    // Normalize and validate
    const normalizedSettings = normalizeValidationSettings(newSettings);

    // Save to database
    const savedSettings = await this.saveSettingsToDatabase(normalizedSettings);

    // Update cache
    this.setCachedSettings(savedSettings.id!, savedSettings);

    // Emit change event
    this.emit('settingsChanged', {
      type: 'created',
      settingsId: savedSettings.id!,
      newVersion: savedSettings,
      changedBy: createdBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return savedSettings;
  }

  /**
   * Activate settings configuration
   */
  async activateSettings(settingsId: string, activatedBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get the settings to activate
    const settings = await this.getSettingsById(settingsId);
    if (!settings) {
      throw new Error(`Settings with ID ${settingsId} not found`);
    }

    // Deactivate current active settings
    if (this.activeSettings) {
      await this.deactivateSettings(this.activeSettings.id!, activatedBy);
    }

    // Activate new settings
    const activatedSettings = await this.updateSettings({
      settings: { isActive: true },
      updatedBy: activatedBy
    });

    this.activeSettings = activatedSettings;

    // Emit change event
    this.emit('settingsChanged', {
      type: 'activated',
      settingsId: activatedSettings.id!,
      newVersion: activatedSettings,
      changedBy: activatedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return activatedSettings;
  }

  /**
   * Deactivate settings configuration
   */
  async deactivateSettings(settingsId: string, deactivatedBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const settings = await this.getSettingsById(settingsId);
    if (!settings) {
      throw new Error(`Settings with ID ${settingsId} not found`);
    }

    const deactivatedSettings = await this.updateSettings({
      settings: { isActive: false },
      updatedBy: deactivatedBy
    });

    // Clear active settings if this was the active one
    if (this.activeSettings?.id === settingsId) {
      this.activeSettings = null;
    }

    // Emit change event
    this.emit('settingsChanged', {
      type: 'deactivated',
      settingsId: deactivatedSettings.id!,
      newVersion: deactivatedSettings,
      changedBy: deactivatedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);

    return deactivatedSettings;
  }

  /**
   * Delete settings configuration
   */
  async deleteSettings(settingsId: string, deletedBy?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const settings = await this.getSettingsById(settingsId);
    if (!settings) {
      throw new Error(`Settings with ID ${settingsId} not found`);
    }

    // Don't allow deletion of active settings
    if (settings.isActive) {
      throw new Error('Cannot delete active settings. Please activate another configuration first.');
    }

    // Delete from database
    await this.deleteSettingsFromDatabase(settingsId);

    // Remove from cache
    this.cache.delete(settingsId);

    // Emit change event
    this.emit('settingsChanged', {
      type: 'deleted',
      settingsId,
      previousVersion: settings,
      changedBy: deletedBy,
      timestamp: new Date()
    } as SettingsChangeEvent);
  }

  // ========================================================================
  // Settings Validation
  // ========================================================================

  /**
   * Validate settings
   */
  async validateSettings(settings: unknown): Promise<ValidationSettingsValidationResult> {
    return validateValidationSettings(settings);
  }

  /**
   * Validate partial settings update
   */
  async validatePartialSettings(settings: unknown): Promise<ValidationSettingsValidationResult> {
    return validatePartialValidationSettings(settings);
  }

  /**
   * Test settings with sample resource
   */
  async testSettings(settings: ValidationSettings, sampleResource: any): Promise<{
    isValid: boolean;
    issues: any[];
    performance: {
      totalTimeMs: number;
      aspectTimes: Record<ValidationAspect, number>;
    };
    validationResult?: any;
  }> {
    const startTime = Date.now();
    const aspectTimes: Record<ValidationAspect, number> = {
      structural: 0,
      profile: 0,
      terminology: 0,
      reference: 0,
          businessRule: 0,
          metadata: 0
    };

    try {
      // Validate the settings first
      const settingsValidation = await this.validateSettings(settings);
      if (!settingsValidation.isValid) {
        return {
          isValid: false,
          issues: settingsValidation.errors.map(error => ({
            type: 'settings_error',
            message: error.message,
            path: error.path,
            code: error.code
          })),
          performance: {
            totalTimeMs: Date.now() - startTime,
            aspectTimes
          }
        };
      }

      // Test each enabled validation aspect
      const issues: any[] = [];
      
      // Structural validation test
      if (settings.structural.enabled) {
        const aspectStart = Date.now();
        try {
          // Basic structural validation
          if (!sampleResource.resourceType) {
            issues.push({
              type: 'structural_error',
              message: 'Resource type is required',
              severity: settings.structural.severity
            });
          }
          if (!sampleResource.id) {
            issues.push({
              type: 'structural_warning',
              message: 'Resource ID is recommended',
              severity: 'warning'
            });
          }
        } catch (error) {
          issues.push({
            type: 'structural_error',
            message: `Structural validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
        aspectTimes.structural = Date.now() - aspectStart;
      }

      // Profile validation test
      if (settings.profile.enabled) {
        const aspectStart = Date.now();
        try {
          // Test profile resolution
          if (sampleResource.meta?.profile && sampleResource.meta.profile.length > 0) {
            // This would test actual profile resolution
            // For now, just check if profiles are present
            console.log('[ValidationSettingsService] Testing profile validation with profiles:', sampleResource.meta.profile);
          }
        } catch (error) {
          issues.push({
            type: 'profile_error',
            message: `Profile validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
        aspectTimes.profile = Date.now() - aspectStart;
      }

      // Terminology validation test
      if (settings.terminology.enabled) {
        const aspectStart = Date.now();
        try {
          // Test terminology server connectivity
          const enabledServers = settings.terminologyServers.filter(s => s.enabled);
          if (enabledServers.length === 0) {
            issues.push({
              type: 'terminology_warning',
              message: 'Terminology validation enabled but no servers configured',
              severity: 'warning'
            });
          } else {
            // Test server connectivity (simplified)
            console.log('[ValidationSettingsService] Testing terminology validation with servers:', enabledServers.length);
          }
        } catch (error) {
          issues.push({
            type: 'terminology_error',
            message: `Terminology validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
        aspectTimes.terminology = Date.now() - aspectStart;
      }

      // Reference validation test
      if (settings.reference.enabled) {
        const aspectStart = Date.now();
        try {
          // Test reference validation
          if (sampleResource.reference) {
            console.log('[ValidationSettingsService] Testing reference validation');
          }
        } catch (error) {
          issues.push({
            type: 'reference_error',
            message: `Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
        aspectTimes.reference = Date.now() - aspectStart;
      }

      // Business rule validation test
      if (settings.businessRule.enabled) {
        const aspectStart = Date.now();
        try {
          // Test business rule validation
          console.log('[ValidationSettingsService] Testing business rule validation');
        } catch (error) {
          issues.push({
            type: 'business_rule_error',
            message: `Business rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
        aspectTimes.businessRule = Date.now() - aspectStart;
      }

      // Metadata validation test
      if (settings.metadata.enabled) {
        const aspectStart = Date.now();
        try {
          // Test metadata validation
          if (!sampleResource.meta) {
            issues.push({
              type: 'metadata_warning',
              message: 'Resource metadata is recommended',
              severity: 'warning'
            });
          }
        } catch (error) {
          issues.push({
            type: 'metadata_error',
            message: `Metadata validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          });
        }
        aspectTimes.metadata = Date.now() - aspectStart;
      }

      const totalTime = Date.now() - startTime;
      const hasErrors = issues.some(issue => issue.severity === 'error');

      return {
        isValid: !hasErrors,
        issues,
        performance: {
          totalTimeMs: totalTime,
          aspectTimes
        }
      };

    } catch (error) {
      console.error('[ValidationSettingsService] Error testing settings:', error);
      return {
        isValid: false,
        issues: [{
          type: 'test_error',
          message: `Settings test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }],
        performance: {
          totalTimeMs: Date.now() - startTime,
          aspectTimes
        }
      };
    }
  }

  // ========================================================================
  // Presets Management
  // ========================================================================

  /**
   * Get available presets
   */
  async getPresets(): Promise<ValidationSettingsPreset[]> {
    return BUILT_IN_PRESETS;
  }

  /**
   * Apply preset to settings
   */
  async applyPreset(presetId: string, createdBy?: string): Promise<ValidationSettings> {
    const preset = BUILT_IN_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Preset with ID ${presetId} not found`);
    }

    return this.createSettings(preset.settings, createdBy);
  }

  // ========================================================================
  // Error Handling and Recovery
  // ========================================================================

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    isInitialized: boolean;
    hasActiveSettings: boolean;
    cacheSize: number;
    lastError?: string;
    uptime: number;
  }> {
    return {
      isHealthy: this.isInitialized && this.activeSettings !== null,
      isInitialized: this.isInitialized,
      hasActiveSettings: this.activeSettings !== null,
      cacheSize: this.cache.size,
      uptime: process.uptime()
    };
  }

  /**
   * Recover from error state
   */
  async recoverFromError(): Promise<void> {
    const recoveryError = createSystemError(
      'Service recovery failed',
      { operation: 'recoverFromError' }
    );

    try {
      console.log('[ValidationSettingsService] Attempting to recover from error state...');
      
      // Clear cache
      this.cache.clear();
      
      // Reset active settings
      this.activeSettings = null;
      
      // Re-initialize
      await this.initialize();
      
      this.emit('recoveryCompleted', {
        timestamp: new Date(),
        success: true
      });
      
      console.log('[ValidationSettingsService] Recovery completed successfully');
    } catch (error) {
      const finalError = createSystemError(
        `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'recoverFromError' }
      );
      
      this.errorLogger.logError(finalError, 'recoverFromError');
      this.emit('recoveryFailed', {
        error: finalError,
        timestamp: new Date()
      });
      throw finalError;
    }
  }

  /**
   * Validate service configuration
   */
  async validateConfiguration(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check cache configuration
    if (this.config.cacheTtlMs < 60000) {
      issues.push('Cache TTL is very short (less than 1 minute)');
      recommendations.push('Consider increasing cache TTL to at least 5 minutes for better performance');
    }

    if (this.config.maxVersions < 5) {
      recommendations.push('Consider increasing max versions to at least 10 for better history tracking');
    }

    // Check backup configuration
    if (!this.config.enableAutoBackup) {
      recommendations.push('Consider enabling automatic backup for data protection');
    }

    if (this.config.backupIntervalMs < 1800000) { // 30 minutes
      recommendations.push('Consider increasing backup interval to at least 30 minutes');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      averageAccessTime: 0,
      sizeBytes: 0,
      evictions: 0,
      efficiencyScore: 0
    };
    this.emit('cacheCleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      id: string;
      cachedAt: Date;
      isValid: boolean;
      lastAccessed: Date;
      accessCount: number;
      tags: string[];
    }>;
    metrics: CacheMetrics;
  } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([id, entry]) => ({
        id,
        cachedAt: entry.cachedAt,
        isValid: entry.isValid,
        lastAccessed: entry.lastAccessed,
        accessCount: entry.accessCount,
        tags: Array.from(entry.tags)
      })),
      metrics: { ...this.cacheMetrics }
    };
  }

  /**
   * Invalidate cache entries by tag
   */
  invalidateByTag(tag: string): void {
    const entriesToInvalidate: string[] = [];
    
    for (const [id, entry] of this.cache.entries()) {
      if (entry.tags.has(tag)) {
        entriesToInvalidate.push(id);
      }
    }
    
    for (const id of entriesToInvalidate) {
      this.cache.delete(id);
    }
    
    if (entriesToInvalidate.length > 0) {
      console.log(`[ValidationSettingsService] Invalidated ${entriesToInvalidate.length} cache entries with tag: ${tag}`);
      this.emit('cacheInvalidated', { tag, entriesInvalidated: entriesToInvalidate.length });
    }
  }

  /**
   * Invalidate cache entries by dependency
   */
  invalidateByDependency(dependencyId: string): void {
    const entriesToInvalidate: string[] = [];
    
    for (const [id, entry] of this.cache.entries()) {
      if (entry.dependencies.has(dependencyId)) {
        entriesToInvalidate.push(id);
      }
    }
    
    for (const id of entriesToInvalidate) {
      this.cache.delete(id);
    }
    
    if (entriesToInvalidate.length > 0) {
      console.log(`[ValidationSettingsService] Invalidated ${entriesToInvalidate.length} cache entries with dependency: ${dependencyId}`);
      this.emit('cacheInvalidated', { dependencyId, entriesInvalidated: entriesToInvalidate.length });
    }
  }

  /**
   * Warm cache with frequently accessed settings
   */
  async warmCache(): Promise<void> {
    try {
      console.log('[ValidationSettingsService] Warming cache...');
      
      // Load active settings
      const activeSettings = await this.getActiveSettings();
      if (activeSettings) {
        this.setCachedSettings(activeSettings.id!, activeSettings, ['active', 'frequent']);
      }
      
      // Load recent settings (last 5)
      const recentSettings = await this.repository.getRecent(5);
      for (const settings of recentSettings) {
        this.setCachedSettings(settings.id!.toString(), settings.settings, ['recent']);
      }
      
      console.log(`[ValidationSettingsService] Cache warmed with ${this.cache.size} entries`);
      this.emit('cacheWarmed', { entriesWarmed: this.cache.size });
      
    } catch (error) {
      console.error('[ValidationSettingsService] Failed to warm cache:', error);
      this.errorLogger.logError(createCacheError('Failed to warm cache', { operation: 'warmCache' }), 'warmCache');
    }
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    const totalRequests = this.cacheMetrics.hits + this.cacheMetrics.misses;
    this.cacheMetrics.hitRatio = totalRequests > 0 ? (this.cacheMetrics.hits / totalRequests) * 100 : 0;
    
    // Calculate efficiency score based on hit ratio and cache utilization
    const cacheUtilization = (this.cache.size / this.maxCacheSize) * 100;
    this.cacheMetrics.efficiencyScore = Math.min(100, (this.cacheMetrics.hitRatio + cacheUtilization) / 2);
    
    return { ...this.cacheMetrics };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsBySeverity: Record<string, number>;
    errorsByCode: Record<string, number>;
    recentErrors: any[];
  } {
    return this.errorLogger.getErrorStats();
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorLogger.clearHistory();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private setupEventHandlers(): void {
    // Handle cache invalidation
    this.on('settingsChanged', (event: SettingsChangeEvent) => {
      if (event.type === 'updated' || event.type === 'deleted') {
        this.cache.delete(event.settingsId);
        
        // Invalidate related cache entries based on dependencies
        this.invalidateByDependency(event.settingsId);
        
        // If this was the active settings, invalidate all cached settings
        if (event.type === 'updated' && event.newVersion?.isActive) {
          this.invalidateByTag('active');
        }
      }
    });
    
    // Handle server configuration changes
    this.on('serverConfigurationChanged', (event: { serverId: string; serverType: 'terminology' | 'profile' }) => {
      this.invalidateByDependency(`${event.serverType}-server-${event.serverId}`);
    });
    
    // Handle profile changes
    this.on('profileChanged', (event: { profileUrl: string }) => {
      this.invalidateByDependency(`profile-${event.profileUrl}`);
    });
  }

  private getCachedSettings(settingsId: string): ValidationSettings | null {
    const startTime = Date.now();
    const entry = this.cache.get(settingsId);
    
    if (!entry) {
      this.cacheMetrics.misses++;
      return null;
    }

    // Check if cache entry is still valid
    const now = new Date();
    const age = now.getTime() - entry.cachedAt.getTime();
    
    if (age > entry.ttlMs || !entry.isValid) {
      this.cache.delete(settingsId);
      this.cacheMetrics.misses++;
      return null;
    }

    // Update access statistics
    entry.lastAccessed = now;
    entry.accessCount++;
    this.cacheMetrics.hits++;
    
    // Update average access time
    const accessTime = Date.now() - startTime;
    this.cacheMetrics.averageAccessTime = 
      (this.cacheMetrics.averageAccessTime * (this.cacheMetrics.hits - 1) + accessTime) / this.cacheMetrics.hits;

    return entry.settings;
  }

  private setCachedSettings(settingsId: string, settings: ValidationSettings, tags: string[] = []): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRUEntries();
    }

    const entry: SettingsCacheEntry = {
      settings,
      cachedAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      ttlMs: this.config.cacheTtlMs,
      isValid: true,
      dependencies: new Set(),
      tags: new Set(tags)
    };

    // Add dependencies based on settings relationships
    this.addDependencies(entry, settings);

    this.cache.set(settingsId, entry);
    
    // Update cache size estimation
    this.updateCacheSizeEstimate();
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLRUEntries(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
    
    // Evict 10% of cache or at least 1 entry
    const evictCount = Math.max(1, Math.floor(this.cache.size * 0.1));
    
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      const [id] = entries[i];
      this.cache.delete(id);
      this.cacheMetrics.evictions++;
    }
    
    console.log(`[ValidationSettingsService] Evicted ${evictCount} LRU cache entries`);
  }

  /**
   * Add dependencies to cache entry based on settings relationships
   */
  private addDependencies(entry: SettingsCacheEntry, settings: ValidationSettings): void {
    // Add dependencies based on server configurations
    if (settings.terminologyServers) {
      for (const server of settings.terminologyServers) {
        entry.dependencies.add(`terminology-server-${server.id}`);
      }
    }
    
    if (settings.profileResolutionServers) {
      for (const server of settings.profileResolutionServers) {
        entry.dependencies.add(`profile-server-${server.id}`);
      }
    }
    
    // Add dependencies based on profile resolution servers
    if (settings.profileResolutionServers) {
      for (const server of settings.profileResolutionServers) {
        entry.dependencies.add(`profile-server-${server.name}`);
      }
    }
    
    // Add global dependencies
    entry.dependencies.add('global-settings');
    entry.dependencies.add('validation-aspects');
  }

  /**
   * Update cache size estimation
   */
  private updateCacheSizeEstimate(): void {
    let totalSize = 0;
    
    for (const [, entry] of this.cache.entries()) {
      // Rough estimation: JSON stringify size + overhead
      const settingsSize = JSON.stringify(entry.settings).length;
      const overhead = 200; // Rough overhead for cache entry metadata
      totalSize += settingsSize + overhead;
    }
    
    this.cacheMetrics.sizeBytes = totalSize;
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanupTimer(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
    
    // Clean up expired entries every 5 minutes
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cache cleanup timer
   */
  private stopCacheCleanupTimer(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    const expiredEntries: string[] = [];
    
    for (const [id, entry] of this.cache.entries()) {
      const age = now.getTime() - entry.cachedAt.getTime();
      if (age > entry.ttlMs || !entry.isValid) {
        expiredEntries.push(id);
      }
    }
    
    for (const id of expiredEntries) {
      this.cache.delete(id);
    }
    
    if (expiredEntries.length > 0) {
      console.log(`[ValidationSettingsService] Cleaned up ${expiredEntries.length} expired cache entries`);
    }
  }

  private async loadActiveSettings(): Promise<void> {
    const startTime = Date.now();
    let fallbackUsed = false;
    let migrationApplied = false;
    
    try {
      console.log('[ValidationSettingsService] Loading active settings...');
      
      // Attempt to load active settings with retry logic
      const activeRecord = await this.loadActiveSettingsWithRetry();
      
      if (activeRecord) {
        // Validate loaded settings
        const validationResult = await this.validateLoadedSettings(activeRecord.settings);
        
        if (validationResult.isValid) {
          this.activeSettings = activeRecord.settings;
          console.log(`[ValidationSettingsService] Active settings loaded successfully (ID: ${activeRecord.id}, Version: ${activeRecord.version})`);
          
          this.emit('settingsLoaded', {
            settingsId: activeRecord.id.toString(),
            settings: this.activeSettings,
            version: activeRecord.version,
            loadTime: Date.now() - startTime,
            timestamp: new Date()
          });
        } else {
          console.warn('[ValidationSettingsService] Loaded settings failed validation, applying migration...');
          
          // Apply migration to fix invalid settings
          const migratedSettings = await this.migrateSettings(activeRecord.settings, validationResult.issues);
          migrationApplied = true;
          
          // Save migrated settings
          await this.saveSettingsToDatabase(migratedSettings);
          
          this.activeSettings = migratedSettings;
          console.log('[ValidationSettingsService] Settings migrated and loaded successfully');
          
          this.emit('settingsMigrated', {
            settingsId: activeRecord.id.toString(),
            originalSettings: activeRecord.settings,
            migratedSettings: this.activeSettings,
            migrationIssues: validationResult.issues,
            timestamp: new Date()
          });
        }
      } else {
        // No active settings found, try to find any settings
        console.log('[ValidationSettingsService] No active settings found, searching for any settings...');
        
        const anySettings = await this.findAnyValidSettings();
        if (anySettings) {
          console.log('[ValidationSettingsService] Found valid settings, activating them...');
          
          // Activate the found settings
          await this.repository.activate(anySettings.id, 'system');
          this.activeSettings = anySettings.settings;
          
          this.emit('settingsActivated', {
            settingsId: anySettings.id.toString(),
            settings: this.activeSettings,
            reason: 'auto-activation',
            timestamp: new Date()
          });
        } else {
          // No valid settings found, create default settings
          console.log('[ValidationSettingsService] No valid settings found, creating default settings...');
          
          this.activeSettings = await this.createDefaultSettings();
          fallbackUsed = true;
          
          this.emit('defaultSettingsCreated', {
            settings: this.activeSettings,
            reason: 'no-valid-settings',
            timestamp: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('[ValidationSettingsService] Critical error loading active settings:', error);
      
      const dbError = createDatabaseError(
        `Failed to load active settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          operation: 'loadActiveSettings',
          loadTime: Date.now() - startTime,
          fallbackUsed,
          migrationApplied
        }
      );
      
      this.errorLogger.logError(dbError, 'loadActiveSettings');
      
      // Final fallback to default settings
    this.activeSettings = DEFAULT_VALIDATION_SETTINGS;
      fallbackUsed = true;
      
      this.emit('criticalError', {
        type: 'loadActiveSettings',
        error: dbError,
        fallbackUsed: true,
        loadTime: Date.now() - startTime,
        timestamp: new Date()
      });
    }
  }

  /**
   * Load active settings with retry logic and circuit breaker
   */
  private async loadActiveSettingsWithRetry(): Promise<any> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.repository.getActive();
      } catch (error) {
        lastError = error as Error;
        console.warn(`[ValidationSettingsService] Failed to load active settings (attempt ${attempt + 1}/${maxRetries}):`, error);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to load active settings after all retries');
  }

  /**
   * Validate loaded settings for integrity and compatibility
   */
  private async validateLoadedSettings(settings: ValidationSettings): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Basic structure validation
      if (!settings || typeof settings !== 'object') {
        issues.push('Settings is not a valid object');
        return { isValid: false, issues };
      }
      
      // Check for required fields
      const requiredFields = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata', 'terminologyServers', 'profileResolutionServers'];
      for (const field of requiredFields) {
        if (!(field in settings)) {
          issues.push(`Missing required field: ${field}`);
        }
      }

      // Validate validation aspects
      const validAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
      for (const aspect of validAspects) {
        if (!(aspect in settings)) {
          issues.push(`Missing validation aspect: ${aspect}`);
        }
      }
      
      // Validate server configurations
      if (settings.terminologyServers && Array.isArray(settings.terminologyServers)) {
        for (let i = 0; i < settings.terminologyServers.length; i++) {
          const server = settings.terminologyServers[i];
          if (!server.url || !server.name) {
            issues.push(`Invalid terminology server at index ${i}: missing URL or name`);
          }
        }
      }
      
      if (settings.profileResolutionServers && Array.isArray(settings.profileResolutionServers)) {
        for (let i = 0; i < settings.profileResolutionServers.length; i++) {
          const server = settings.profileResolutionServers[i];
          if (!server.url || !server.name) {
            issues.push(`Invalid profile resolution server at index ${i}: missing URL or name`);
          }
        }
      }
      
      // Validate timeout settings
      if (settings.timeoutSettings) {
        const timeoutFields = ['defaultTimeoutMs', 'structuralValidationTimeoutMs', 'profileValidationTimeoutMs'];
        for (const field of timeoutFields) {
          const value = (settings.timeoutSettings as any)[field];
          if (value !== undefined && (typeof value !== 'number' || value < 1000 || value > 300000)) {
            issues.push(`Invalid timeout value for ${field}: ${value}`);
          }
        }
      }
      
      // Validate cache settings
      if (settings.cacheSettings) {
        if (settings.cacheSettings.ttlMs !== undefined && (settings.cacheSettings.ttlMs < 1000 || settings.cacheSettings.ttlMs > 3600000)) {
          issues.push(`Invalid cache TTL: ${settings.cacheSettings.ttlMs}`);
        }
        if (settings.cacheSettings.maxSizeMB !== undefined && (settings.cacheSettings.maxSizeMB < 1 || settings.cacheSettings.maxSizeMB > 10000)) {
          issues.push(`Invalid cache max size: ${settings.cacheSettings.maxSizeMB}`);
        }
      }
      
      return { isValid: issues.length === 0, issues };
      
    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, issues };
    }
  }

  /**
   * Migrate settings to fix validation issues
   */
  private async migrateSettings(settings: ValidationSettings, issues: string[]): Promise<ValidationSettings> {
    console.log('[ValidationSettingsService] Migrating settings to fix issues:', issues);
    
    const migratedSettings = { ...settings };
    
    // Fix missing validation aspects
    const validAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    for (const aspect of validAspects) {
      if (!(aspect in migratedSettings)) {
        (migratedSettings as any)[aspect] = (DEFAULT_VALIDATION_SETTINGS as any)[aspect];
      }
    }
    
    // Fix missing server configurations
    if (!migratedSettings.terminologyServers || !Array.isArray(migratedSettings.terminologyServers)) {
      migratedSettings.terminologyServers = DEFAULT_VALIDATION_SETTINGS.terminologyServers;
    }
    
    if (!migratedSettings.profileResolutionServers || !Array.isArray(migratedSettings.profileResolutionServers)) {
      migratedSettings.profileResolutionServers = DEFAULT_VALIDATION_SETTINGS.profileResolutionServers;
    }
    
    // Fix timeout settings
    if (!migratedSettings.timeoutSettings) {
      migratedSettings.timeoutSettings = DEFAULT_VALIDATION_SETTINGS.timeoutSettings;
    }
    
    // Fix cache settings
    if (!migratedSettings.cacheSettings) {
      migratedSettings.cacheSettings = DEFAULT_VALIDATION_SETTINGS.cacheSettings;
    }
    
    // Fix performance settings
    if (migratedSettings.maxConcurrentValidations === undefined) {
      migratedSettings.maxConcurrentValidations = DEFAULT_VALIDATION_SETTINGS.maxConcurrentValidations;
    }
    
    // Ensure all validation aspects are present (already handled above)
    
    console.log('[ValidationSettingsService] Settings migration completed');
    return migratedSettings;
  }

  /**
   * Find any valid settings in the database
   */
  private async findAnyValidSettings(): Promise<any> {
    try {
      const allSettings = await this.repository.getAll({ limit: 10 });
      
      for (const record of allSettings) {
        const validationResult = await this.validateLoadedSettings(record.settings);
        if (validationResult.isValid) {
          return record;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[ValidationSettingsService] Error finding valid settings:', error);
      return null;
    }
  }

  private async loadSettingsFromDatabase(settingsId: string): Promise<ValidationSettings | null> {
    try {
      const record = await this.repository.getById(parseInt(settingsId));
      return record ? record.settings : null;
    } catch (error) {
      console.error('[ValidationSettingsService] Error loading settings from database:', error);
      return null;
    }
  }

  private async saveSettingsToDatabase(settings: ValidationSettings): Promise<ValidationSettings> {
    try {
    if (settings.id) {
        // Update existing settings with transaction support
        const updated = await this.repository.updateWithVersioning({
        id: parseInt(settings.id),
        settings: settings,
        createNewVersion: false,
        updatedBy: settings.updatedBy
      });
      
      // If this is the active settings, make sure it's activated
      if (settings.isActive) {
        await this.repository.activate(updated.id, settings.updatedBy);
      }
      
      return updated.settings;
    } else {
      // Create new settings
        if (settings.isActive) {
          // Use transaction to create and activate in one operation
          const activated = await this.repository.createAndActivate({
            settings: settings,
            isActive: false, // Will be activated by the transaction
            createdBy: settings.createdBy,
            activate: true
          });
          return activated.settings;
        } else {
          // Create without activation
      const created = await this.repository.create({
        settings: settings,
            isActive: false,
        createdBy: settings.createdBy
      });
          return created.settings;
        }
      }
    } catch (error) {
      const dbError = createDatabaseError(
        `Failed to save settings to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'saveSettingsToDatabase', settingsId: settings.id }
      );
      
      this.errorLogger.logError(dbError, 'saveSettingsToDatabase');
      throw dbError;
    }
  }

  private async deleteSettingsFromDatabase(settingsId: string): Promise<void> {
    try {
      await this.repository.delete(parseInt(settingsId));
      this.emit('settingsDeleted', {
        settingsId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ValidationSettingsService] Error deleting settings from database:', error);
      throw new Error(`Failed to delete settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createDefaultSettings(): Promise<ValidationSettings> {
    return this.createSettings(DEFAULT_VALIDATION_SETTINGS, 'system');
  }

  private startBackupTimer(): void {
    this.backupTimer = setInterval(async () => {
      try {
        await this.backupSettings();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.backupIntervalMs);
  }

  private async backupSettings(): Promise<void> {
    try {
      // Use the dedicated backup service for comprehensive backup
      const { getValidationSettingsBackupService } = await import('./validation-settings-backup-service');
      const backupService = getValidationSettingsBackupService();
      
      const backupMetadata = await backupService.createBackup(
        'full',
        'Automatic backup',
        'system',
        ['auto', 'scheduled']
      );
      
      console.log('[ValidationSettingsService] Settings backup created successfully:', backupMetadata.id);
      
    this.emit('backupCreated', {
        backupId: backupMetadata.id,
        timestamp: backupMetadata.timestamp,
        sizeBytes: backupMetadata.sizeBytes,
        settingsCount: backupMetadata.settingsCount
      });
    } catch (error) {
      console.error('[ValidationSettingsService] Error creating settings backup:', error);
      this.emit('backupError', {
        error: error instanceof Error ? error : new Error('Unknown error'),
        timestamp: new Date()
      });
    }
  }

  /**
   * Restore settings from backup
   */
  async restoreFromBackup(backupId: string, options?: any): Promise<void> {
    try {
      // Use the dedicated backup service for comprehensive restore
      const { getValidationSettingsBackupService } = await import('./validation-settings-backup-service');
      const backupService = getValidationSettingsBackupService();
      
      const restoreResult = await backupService.restoreFromBackup(backupId, {
        validateData: true,
        createNewIds: false,
        preserveTimestamps: true,
        restoreAuditTrail: true,
        restoreVersionTags: true,
        conflictResolution: 'skip',
        restoredBy: 'system',
        ...options
      });
      
      // Clear current cache after restore
      this.cache.clear();
      
      // Reload active settings
      await this.loadActiveSettings();
      
      console.log('[ValidationSettingsService] Settings backup restored successfully:', restoreResult);
      
      this.emit('backupRestored', {
        backupId,
        restoreResult,
        timestamp: new Date()
      });
    } catch (error) {
      const restoreError = createSystemError(
        `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'restoreFromBackup', backupId }
      );
      
      this.errorLogger.logError(restoreError, 'restoreFromBackup');
      this.emit('backupRestoreError', {
        error: restoreError,
        backupId,
        timestamp: new Date()
      });
      throw restoreError;
    }
  }

  /**
   * Create a manual backup
   */
  async createManualBackup(description?: string, createdBy?: string, tags?: string[]): Promise<string> {
    try {
      const { getValidationSettingsBackupService } = await import('./validation-settings-backup-service');
      const backupService = getValidationSettingsBackupService();
      
      const backupMetadata = await backupService.createBackup(
        'full',
        description || 'Manual backup',
        createdBy || 'user',
        tags || ['manual']
      );
      
      this.emit('manualBackupCreated', {
        backupId: backupMetadata.id,
        timestamp: backupMetadata.timestamp,
        sizeBytes: backupMetadata.sizeBytes,
        settingsCount: backupMetadata.settingsCount
      });
      
      return backupMetadata.id;
    } catch (error) {
      console.error('[ValidationSettingsService] Error creating manual backup:', error);
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<any[]> {
    try {
      const { getValidationSettingsBackupService } = await import('./validation-settings-backup-service');
      const backupService = getValidationSettingsBackupService();
      
      return await backupService.listBackups();
    } catch (error) {
      console.error('[ValidationSettingsService] Error listing backups:', error);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const { getValidationSettingsBackupService } = await import('./validation-settings-backup-service');
      const backupService = getValidationSettingsBackupService();
      
      await backupService.deleteBackup(backupId);
      
      this.emit('backupDeleted', {
        backupId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ValidationSettingsService] Error deleting backup:', error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const { getValidationSettingsBackupService } = await import('./validation-settings-backup-service');
      const backupService = getValidationSettingsBackupService();
      
      return await backupService.verifyBackup(backupId);
    } catch (error) {
      console.error('[ValidationSettingsService] Error verifying backup:', error);
      return false;
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<number> {
    try {
      const { getValidationSettingsBackupService } = await import('./validation-settings-backup-service');
      const backupService = getValidationSettingsBackupService();
      
      const deletedCount = await backupService.cleanupOldBackups();
      
      if (deletedCount > 0) {
        this.emit('backupsCleanedUp', {
          deletedCount,
          timestamp: new Date()
        });
      }
      
      return deletedCount;
    } catch (error) {
      console.error('[ValidationSettingsService] Error cleaning up old backups:', error);
      return 0;
    }
  }

  /**
   * Transforms string dates to Date objects in the settings object
   */
  private transformStringDatesToObjects(settings: any): any {
    if (!settings || typeof settings !== 'object') {
      return settings;
    }

    const transformed = { ...settings };

    // Transform known date fields
    if (transformed.createdAt && typeof transformed.createdAt === 'string') {
      transformed.createdAt = new Date(transformed.createdAt);
    }
    if (transformed.updatedAt && typeof transformed.updatedAt === 'string') {
      transformed.updatedAt = new Date(transformed.updatedAt);
    }

    return transformed;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let settingsServiceInstance: ValidationSettingsService | null = null;

/**
 * Get the singleton instance of ValidationSettingsService
 */
export function getValidationSettingsService(): ValidationSettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new ValidationSettingsService();
  }
  return settingsServiceInstance;
}

/**
 * Initialize the singleton instance
 */
export async function initializeValidationSettingsService(): Promise<ValidationSettingsService> {
  const service = getValidationSettingsService();
  await service.initialize();
  return service;
}

/**
 * Shutdown the singleton instance
 */
export async function shutdownValidationSettingsService(): Promise<void> {
  if (settingsServiceInstance) {
    await settingsServiceInstance.shutdown();
    settingsServiceInstance = null;
  }
}
