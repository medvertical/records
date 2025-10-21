/**
 * Validation Settings Service - Simplified Implementation
 * 
 * This service provides simplified validation settings management focusing on
 * essential functionality: 6 validation aspects, performance settings, and resource type filtering.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  FHIRVersion
} from '@shared/validation-settings';
import {
  validateValidationSettings,
  getDefaultValidationSettingsForVersion,
  createDefaultValidationSettings,
  resetToDefaultSettings,
  isDefaultSettings,
  migrateResourceTypesForVersion,
  getAllResourceTypesForVersion,
  isResourceTypeAvailableInVersion,
  getUnavailableResourceTypes,
  getR5SpecificResourceTypes
} from '@shared/validation-settings';
import { ValidationSettingsRepository } from '../../../repositories/validation-settings-repository';
import { 
  ValidationSettingsError, 
  SimpleErrorHandler,
  createInitializationError,
  createDatabaseError,
  createValidationError,
  createSystemError
} from '../validation-settings-errors';

// ============================================================================
// Service Configuration
// ============================================================================

export interface ValidationSettingsServiceConfig {
  /** Whether to enable caching */
  enableCaching?: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  
  /** Default FHIR version */
  defaultFhirVersion?: FHIRVersion;
}

// ============================================================================
// Service Events (Simplified)
// ============================================================================

export interface SettingsChangeEvent {
  type: 'updated';
  serverId?: number;
  data: ValidationSettings;
  timestamp: Date;
}

// ============================================================================
// Validation Settings Service
// ============================================================================

export class ValidationSettingsService extends EventEmitter {
  private repository: ValidationSettingsRepository;
  private config: Required<ValidationSettingsServiceConfig>;
  private currentSettings: ValidationSettings | null = null;
  private lastCacheTime: number = 0;
  private isInitialized: boolean = false;

  constructor(config: ValidationSettingsServiceConfig = {}) {
    super();
    
    this.config = {
      enableCaching: config.enableCaching ?? true,
      cacheTtlMs: config.cacheTtlMs ?? 300000, // 5 minutes
      defaultFhirVersion: config.defaultFhirVersion ?? 'R4'
    };
    
    this.repository = new ValidationSettingsRepository();
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.repository.initialize();
      this.isInitialized = true;
      // No event emission for initialization
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'initialize');
      SimpleErrorHandler.logError(settingsError, 'initialize');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ========================================================================
  // Settings Management
  // ========================================================================

  async getCurrentSettings(serverId?: number): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    // Check cache first
    if (this.config.enableCaching && this.currentSettings && this.isCacheValid()) {
      return this.currentSettings;
    }

    try {
      const settings = await this.repository.getCurrentSettings(serverId);
      
      if (settings) {
        this.currentSettings = settings;
        this.lastCacheTime = Date.now();
        return settings;
      }

      // Return defaults if no settings found
      const defaultSettings = getDefaultValidationSettingsForVersion(this.config.defaultFhirVersion);
      this.currentSettings = defaultSettings;
      this.lastCacheTime = Date.now();
      
      return defaultSettings;
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'getCurrentSettings');
      SimpleErrorHandler.logError(settingsError, 'getCurrentSettings');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  async updateSettings(update: ValidationSettingsUpdate & { serverId?: number; validate?: boolean }): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    try {
      // Get current settings for the server
      const currentSettings = await this.getCurrentSettings(update.serverId);
      console.log('[ValidationSettings] Current settings:', JSON.stringify(currentSettings.aspects?.structural, null, 2));
      console.log('[ValidationSettings] Update:', JSON.stringify(update.aspects?.structural, null, 2));
      
      // Deep merge with update (not shallow merge!)
      const updatedSettings: ValidationSettings = {
        ...currentSettings,
        // Deep merge nested objects - these must come AFTER currentSettings to override properly
        aspects: update.aspects ? {
          ...currentSettings.aspects,
          // Deep merge individual aspects
          ...(update.aspects.structural && {structural: {...currentSettings.aspects.structural, ...update.aspects.structural}}),
          ...(update.aspects.profile && {profile: {...currentSettings.aspects.profile, ...update.aspects.profile}}),
          ...(update.aspects.terminology && {terminology: {...currentSettings.aspects.terminology, ...update.aspects.terminology}}),
          ...(update.aspects.reference && {reference: {...currentSettings.aspects.reference, ...update.aspects.reference}}),
          ...(update.aspects.businessRule && {businessRule: {...currentSettings.aspects.businessRule, ...update.aspects.businessRule}}),
          ...(update.aspects.metadata && {metadata: {...currentSettings.aspects.metadata, ...update.aspects.metadata}}),
        } : currentSettings.aspects,
        performance: update.performance ? {
          ...currentSettings.performance,
          ...update.performance
        } : currentSettings.performance,
        resourceTypes: update.resourceTypes ? {
          ...currentSettings.resourceTypes,
          ...update.resourceTypes
        } : currentSettings.resourceTypes,
        // Primitive/top-level fields from update
        ...(update.mode && { mode: update.mode }),
        ...(update.useFhirValidateOperation !== undefined && { useFhirValidateOperation: update.useFhirValidateOperation }),
        ...(update.autoRevalidateAfterEdit !== undefined && { autoRevalidateAfterEdit: update.autoRevalidateAfterEdit }),
        ...(update.autoRevalidateOnVersionChange !== undefined && { autoRevalidateOnVersionChange: update.autoRevalidateOnVersionChange }),
        ...(update.listViewPollingInterval !== undefined && { listViewPollingInterval: update.listViewPollingInterval }),
        terminologyServers: update.terminologyServers || currentSettings.terminologyServers,
        circuitBreaker: update.circuitBreaker || currentSettings.circuitBreaker,
        terminologyFallback: update.terminologyFallback ? {
          ...currentSettings.terminologyFallback,
          ...update.terminologyFallback
        } : currentSettings.terminologyFallback,
        offlineConfig: update.offlineConfig ? {
          ...currentSettings.offlineConfig,
          ...update.offlineConfig
        } : currentSettings.offlineConfig,
        ...(update.profileSources && { profileSources: update.profileSources }),
      };
      
      console.log('[ValidationSettings] Merged settings:', JSON.stringify(updatedSettings.aspects?.structural, null, 2));
      
      // Validate settings if requested
      if (update.validate !== false) {
        const validationResult = validateValidationSettings(updatedSettings, this.config.defaultFhirVersion);
        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
        }
      }
      
      // Save to database
      console.log('[ValidationSettings] Saving to DB, structural:', JSON.stringify(updatedSettings.aspects?.structural, null, 2));
      const savedSettings = await this.repository.createOrUpdate(updatedSettings, update.serverId);
      console.log('[ValidationSettings] Saved to DB, structural:', JSON.stringify(savedSettings.aspects?.structural, null, 2));
      
      // Update cache
      this.currentSettings = savedSettings;
      this.lastCacheTime = Date.now();
      
      // Emit simple event
      this.emit('settingsChanged', {
        type: 'updated',
        serverId: update.serverId,
        data: this.currentSettings,
        timestamp: new Date()
      });
      
      return this.currentSettings;
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'updateSettings');
      SimpleErrorHandler.logError(settingsError, 'updateSettings');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  async resetToDefaults(serverId?: number, fhirVersion?: FHIRVersion): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    try {
      const version = fhirVersion || this.config.defaultFhirVersion;
      const defaultSettings = resetToDefaultSettings(version);
      
      // Save to database
      const savedSettings = await this.repository.createOrUpdate(defaultSettings, serverId);
      
      // Update cache
      this.currentSettings = savedSettings;
      this.lastCacheTime = Date.now();
      
      // Emit simple event
      this.emit('settingsChanged', {
        type: 'updated',
        serverId,
        data: this.currentSettings,
        timestamp: new Date()
      });
      
      return this.currentSettings;
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'operation');
      SimpleErrorHandler.logError(settingsError, 'operation');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  // ========================================================================
  // FHIR Version Management & Auto-Migration
  // ========================================================================

  async migrateSettingsForFhirVersion(
    fromVersion: FHIRVersion,
    toVersion: FHIRVersion,
    serverId?: number
  ): Promise<ValidationSettings> {
    await this.ensureInitialized();
    
    try {
      const currentSettings = await this.getCurrentSettings(serverId);
      
      // Migrate resource types for the new FHIR version
      const migratedSettings: ValidationSettings = {
        ...currentSettings,
        resourceTypes: migrateResourceTypesForVersion(
          currentSettings.resourceTypes,
          fromVersion,
          toVersion
        )
      };
      
      // Save migrated settings
      const savedSettings = await this.repository.createOrUpdate(migratedSettings, serverId);
      
      // Update cache
      this.currentSettings = savedSettings;
      this.lastCacheTime = Date.now();
      
      // Emit simple event
      this.emit('settingsChanged', {
        type: 'updated',
        serverId,
        data: this.currentSettings,
        timestamp: new Date()
      });
      
      return this.currentSettings;
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'operation');
      SimpleErrorHandler.logError(settingsError, 'operation');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  async autoMigrateSettingsForServer(serverUrl: string, serverId?: number): Promise<{
    migrated: boolean;
    fromVersion: FHIRVersion;
    toVersion: FHIRVersion;
    settings: ValidationSettings;
    migrationReport: {
      removedTypes: string[];
      addedTypes: string[];
      warnings: string[];
    };
  }> {
    await this.ensureInitialized();
    
    try {
      // Detect current FHIR version from server
      const detectedVersion = await this.detectFhirVersion(serverUrl);
      
      // Get current settings
      const currentSettings = await this.getCurrentSettings(serverId);
      
      // Check if migration is needed
      const currentVersion = this.config.defaultFhirVersion;
      
      if (detectedVersion === currentVersion) {
        return {
          migrated: false,
          fromVersion: currentVersion,
          toVersion: detectedVersion,
          settings: currentSettings,
          migrationReport: {
            removedTypes: [],
            addedTypes: [],
            warnings: []
          }
        };
      }
      
      // Perform migration
      const migrationReport = this.generateMigrationReport(
        currentSettings.resourceTypes,
        currentVersion,
        detectedVersion
      );
      
      const migratedSettings = await this.migrateSettingsForFhirVersion(
        currentVersion,
        detectedVersion,
        serverId
      );
      
      // Update default FHIR version for future operations
      this.config.defaultFhirVersion = detectedVersion;
      
      // Emit simple migration event
      this.emit('settingsChanged', {
        type: 'updated',
        serverId,
        data: migratedSettings,
        timestamp: new Date()
      });
      
      return {
        migrated: true,
        fromVersion: currentVersion,
        toVersion: detectedVersion,
        settings: migratedSettings,
        migrationReport
      };
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'operation');
      SimpleErrorHandler.logError(settingsError, 'operation');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  private generateMigrationReport(
    currentResourceTypes: ValidationSettings['resourceTypes'],
    fromVersion: FHIRVersion,
    toVersion: FHIRVersion
  ): {
    removedTypes: string[];
    addedTypes: string[];
    warnings: string[];
  } {
    const removedTypes: string[] = [];
    const addedTypes: string[] = [];
    const warnings: string[] = [];
    
    // Get available types for both versions
    const fromTypes = getAllResourceTypesForVersion(fromVersion);
    const toTypes = getAllResourceTypesForVersion(toVersion);
    
    // Check included types
    for (const type of currentResourceTypes.includedTypes) {
      if (fromTypes.has(type) && !toTypes.has(type)) {
        removedTypes.push(type);
        warnings.push(`Resource type '${type}' is not available in FHIR ${toVersion} and was removed from included types`);
      }
    }
    
    // Check excluded types
    for (const type of currentResourceTypes.excludedTypes) {
      if (fromTypes.has(type) && !toTypes.has(type)) {
        removedTypes.push(type);
        warnings.push(`Resource type '${type}' is not available in FHIR ${toVersion} and was removed from excluded types`);
      }
    }
    
    // Find new types available in target version
    for (const type of toTypes) {
      if (!fromTypes.has(type)) {
        addedTypes.push(type);
      }
    }
    
    if (addedTypes.length > 0) {
      warnings.push(`${addedTypes.length} new resource types are available in FHIR ${toVersion}: ${addedTypes.slice(0, 5).join(', ')}${addedTypes.length > 5 ? '...' : ''}`);
    }
    
    return { removedTypes, addedTypes, warnings };
  }

  async checkMigrationNeeded(serverUrl: string, serverId?: number): Promise<{
    needed: boolean;
    fromVersion: FHIRVersion;
    toVersion: FHIRVersion;
    impact: 'low' | 'medium' | 'high';
    affectedTypes: string[];
  }> {
    try {
      const detectedVersion = await this.detectFhirVersion(serverUrl);
      const currentVersion = this.config.defaultFhirVersion;
      
      if (detectedVersion === currentVersion) {
        return {
          needed: false,
          fromVersion: currentVersion,
          toVersion: detectedVersion,
          impact: 'low',
          affectedTypes: []
        };
      }
      
      const currentSettings = await this.getCurrentSettings(serverId);
      const migrationReport = this.generateMigrationReport(
        currentSettings.resourceTypes,
        currentVersion,
        detectedVersion
      );
      
      // Determine impact level
      let impact: 'low' | 'medium' | 'high' = 'low';
      if (migrationReport.removedTypes.length > 5) {
        impact = 'high';
      } else if (migrationReport.removedTypes.length > 0) {
        impact = 'medium';
      }
      
      return {
        needed: true,
        fromVersion: currentVersion,
        toVersion: detectedVersion,
        impact,
        affectedTypes: migrationReport.removedTypes
      };
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'operation');
      SimpleErrorHandler.logError(settingsError, 'operation');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  async previewMigration(serverUrl: string, serverId?: number): Promise<{
    currentSettings: ValidationSettings;
    migratedSettings: ValidationSettings;
    migrationReport: {
      removedTypes: string[];
      addedTypes: string[];
      warnings: string[];
    };
  }> {
    try {
      const detectedVersion = await this.detectFhirVersion(serverUrl);
      const currentVersion = this.config.defaultFhirVersion;
      const currentSettings = await this.getCurrentSettings(serverId);
      
      if (detectedVersion === currentVersion) {
        return {
          currentSettings,
          migratedSettings: currentSettings,
          migrationReport: {
            removedTypes: [],
            addedTypes: [],
            warnings: []
          }
        };
      }
      
      const migrationReport = this.generateMigrationReport(
        currentSettings.resourceTypes,
        currentVersion,
        detectedVersion
      );
      
      const migratedSettings: ValidationSettings = {
        ...currentSettings,
        resourceTypes: migrateResourceTypesForVersion(
          currentSettings.resourceTypes,
          currentVersion,
          detectedVersion
        )
      };
      
      return {
        currentSettings,
        migratedSettings,
        migrationReport
      };
    } catch (error) {
      const settingsError = SimpleErrorHandler.handleError(error, 'operation');
      SimpleErrorHandler.logError(settingsError, 'operation');
      this.emit('error', settingsError);
      throw settingsError;
    }
  }

  // ========================================================================
  // FHIR Version Detection
  // ========================================================================

  async detectFhirVersion(serverUrl: string): Promise<FHIRVersion> {
    try {
      // Try to detect FHIR version from server capabilities
      const response = await fetch(`${serverUrl}/metadata`, {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch server metadata: ${response.statusText}`);
      }

      const metadata = await response.json();
      
      // Check for FHIR version in metadata
      if (metadata.fhirVersion) {
        const version = metadata.fhirVersion;
        if (version.startsWith('4.0') || version.startsWith('4.1') || version.startsWith('4.2') || version.startsWith('4.3')) {
          return 'R4';
        } else if (version.startsWith('5.0')) {
          return 'R5';
        }
      }

      // Fallback: try to detect from resource types
      return await this.detectFhirVersionFromResourceTypes(serverUrl);
    } catch (error) {
      console.warn('Failed to detect FHIR version, using default:', error);
      return this.config.defaultFhirVersion;
    }
  }

  private async detectFhirVersionFromResourceTypes(serverUrl: string): Promise<FHIRVersion> {
    try {
      // Try to search for R5-specific resource types
      const r5SpecificTypes = getR5SpecificResourceTypes();
      
      for (const resourceType of r5SpecificTypes.slice(0, 3)) { // Check first 3 R5 types
        try {
          const response = await fetch(`${serverUrl}/${resourceType}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/fhir+json'
            }
          });
          
          // If we get a response (even if empty), the resource type exists
          if (response.ok || response.status === 404) {
            return 'R5';
          }
        } catch {
          // Continue checking other types
        }
      }
      
      return 'R4'; // Default to R4 if R5 detection fails
    } catch (error) {
      console.warn('Failed to detect FHIR version from resource types:', error);
      return this.config.defaultFhirVersion;
    }
  }

  // ========================================================================
  // Resource Type Validation
  // ========================================================================

  async validateResourceTypes(
    resourceTypes: string[],
    fhirVersion?: FHIRVersion
  ): Promise<{
    valid: string[];
    invalid: string[];
    warnings: string[];
  }> {
    const version = fhirVersion || this.config.defaultFhirVersion;
    const allTypes = getAllResourceTypesForVersion(version);
    
    const valid: string[] = [];
    const invalid: string[] = [];
    const warnings: string[] = [];

    for (const resourceType of resourceTypes) {
      if (isResourceTypeAvailableInVersion(resourceType, version)) {
        valid.push(resourceType);
      } else {
        invalid.push(resourceType);
        
        // Check if it's an R5 type being used with R4
        if (version === 'R4' && getR5SpecificResourceTypes().includes(resourceType)) {
          warnings.push(`Resource type '${resourceType}' is R5-specific and not available in FHIR R4`);
        } else {
          warnings.push(`Resource type '${resourceType}' is not available in FHIR ${version}`);
        }
      }
    }

    return { valid, invalid, warnings };
  }

  async getAvailableResourceTypes(fhirVersion?: FHIRVersion): Promise<string[]> {
    const version = fhirVersion || this.config.defaultFhirVersion;
    return [...getAllResourceTypesForVersion(version)];
  }

  /**
   * Get available resource types from connected FHIR server, filtered by FHIR version
   * This combines server capabilities with FHIR version specifications
   * 
   * @param fhirVersion - FHIR version to filter by (R4 or R5)
   * @returns Array of resource types available in both server and version spec
   */
  async getAvailableResourceTypesFromServer(fhirVersion?: FHIRVersion): Promise<{
    resourceTypes: string[];
    source: 'server' | 'static' | 'filtered';
    serverVersion?: string;
    totalServerTypes?: number;
    filteredCount?: number;
  }> {
    const version = fhirVersion || this.config.defaultFhirVersion;
    const versionResourceTypes = getAllResourceTypesForVersion(version);
    
    try {
      // Import storage and get active FHIR server
      const { storage } = await import('../../../storage.js');
      const activeServer = await storage.getActiveFhirServer();
      
      if (!activeServer) {
        console.log('[ValidationSettingsService] No active FHIR server, using static resource types');
        return {
          resourceTypes: [...versionResourceTypes],
          source: 'static'
        };
      }
      
      // Import server activation service to get FHIR client
      const { serverActivationService } = await import('../../../services/server-activation-service');
      const fhirClient = serverActivationService.getFhirClient();
      
      if (!fhirClient) {
        console.log('[ValidationSettingsService] No FHIR client available, using static resource types');
        return {
          resourceTypes: [...versionResourceTypes],
          source: 'static'
        };
      }
      
      // Fetch resource types from server's CapabilityStatement
      console.log('[ValidationSettingsService] Fetching resource types from FHIR server...');
      const serverResourceTypes = await fhirClient.getAllResourceTypes();
      const serverVersion = await fhirClient.getFhirVersion();
      
      console.log(`[ValidationSettingsService] Server reports ${serverResourceTypes.length} resource types, version: ${serverVersion}`);
      
      // Filter server types by requested FHIR version (intersection)
      const filteredTypes = serverResourceTypes.filter(type => 
        isResourceTypeAvailableInVersion(type, version)
      );
      
      console.log(`[ValidationSettingsService] Filtered to ${filteredTypes.length} types for FHIR ${version}`);
      
      return {
        resourceTypes: filteredTypes,
        source: 'filtered',
        serverVersion: serverVersion || undefined,
        totalServerTypes: serverResourceTypes.length,
        filteredCount: filteredTypes.length
      };
      
    } catch (error: any) {
      console.error('[ValidationSettingsService] Error fetching resource types from server:', error.message);
      // Fall back to static types on error
      return {
        resourceTypes: [...versionResourceTypes],
        source: 'static'
      };
    }
  }

  async getResourceTypeValidationReport(
    settings: ValidationSettings,
    fhirVersion?: FHIRVersion
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const version = fhirVersion || this.config.defaultFhirVersion;
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate included types
    if (settings.resourceTypes.includedTypes.length > 0) {
      const includedValidation = await this.validateResourceTypes(settings.resourceTypes.includedTypes, version);
      
      if (includedValidation.invalid.length > 0) {
        errors.push(`Invalid included resource types: ${includedValidation.invalid.join(', ')}`);
      }
      
      warnings.push(...includedValidation.warnings);
    }

    // Validate excluded types
    if (settings.resourceTypes.excludedTypes.length > 0) {
      const excludedValidation = await this.validateResourceTypes(settings.resourceTypes.excludedTypes, version);
      
      if (excludedValidation.invalid.length > 0) {
        errors.push(`Invalid excluded resource types: ${excludedValidation.invalid.join(', ')}`);
      }
      
      warnings.push(...excludedValidation.warnings);
    }

    // Check for conflicts
    const conflicts = settings.resourceTypes.includedTypes.filter(type => 
      settings.resourceTypes.excludedTypes.includes(type)
    );
    
    if (conflicts.length > 0) {
      errors.push(`Resource types cannot be both included and excluded: ${conflicts.join(', ')}`);
    }

    // Performance recommendations
    if (settings.resourceTypes.includedTypes.length > 50) {
      recommendations.push('Consider reducing the number of included resource types for better performance');
    }

    if (settings.resourceTypes.includedTypes.length === 0 && settings.resourceTypes.enabled) {
      recommendations.push('No resource types are included. Consider adding specific types or disabling filtering');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  // ========================================================================
  // Validation
  // ========================================================================

  async validateSettings(settings: ValidationSettings, fhirVersion?: FHIRVersion): Promise<ValidationSettingsValidationResult> {
    const version = fhirVersion || this.config.defaultFhirVersion;
    const baseValidation = validateValidationSettings(settings, version);
    
    // Add resource type validation
    const resourceTypeReport = await this.getResourceTypeValidationReport(settings, version);
    
    return {
      isValid: baseValidation.isValid && resourceTypeReport.isValid,
      errors: [...baseValidation.errors, ...resourceTypeReport.errors],
      warnings: [...baseValidation.warnings, ...resourceTypeReport.warnings]
    };
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheTime < this.config.cacheTtlMs;
  }

  clearCache(): void {
    this.currentSettings = null;
    this.lastCacheTime = 0;
    // No event emission for cache clearing
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  async isSettingsDefault(serverId?: number): Promise<boolean> {
    const settings = await this.getCurrentSettings(serverId);
    return isDefaultSettings(settings, this.config.defaultFhirVersion);
  }

  async getSettingsForVersion(version: FHIRVersion, serverId?: number): Promise<ValidationSettings> {
    const settings = await this.getCurrentSettings(serverId);
    
    // If current settings are for a different version, migrate them
    if (version !== this.config.defaultFhirVersion) {
      return this.migrateSettingsForFhirVersion(this.config.defaultFhirVersion, version, serverId);
    }
    
    return settings;
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  async shutdown(): Promise<void> {
    this.clearCache();
    this.removeAllListeners();
    this.isInitialized = false;
    // No event emission for shutdown
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let serviceInstance: ValidationSettingsService | null = null;

export function getValidationSettingsService(config?: ValidationSettingsServiceConfig): ValidationSettingsService {
  if (!serviceInstance) {
    serviceInstance = new ValidationSettingsService(config);
  }
  return serviceInstance;
}

export function resetValidationSettingsService(): void {
  if (serviceInstance) {
    serviceInstance.shutdown();
    serviceInstance = null;
  }
}

export async function initializeValidationSettingsService(config?: ValidationSettingsServiceConfig): Promise<ValidationSettingsService> {
  const service = getValidationSettingsService(config);
  await service.initialize();
  return service;
}

export async function shutdownValidationSettingsService(): Promise<void> {
  if (serviceInstance) {
    await serviceInstance.shutdown();
    serviceInstance = null;
  }
}
