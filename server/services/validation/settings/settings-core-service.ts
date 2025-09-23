/**
 * Validation Settings Core Service
 * 
 * Core CRUD operations for validation settings management.
 * Handles the fundamental settings lifecycle operations.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  ValidationAspect
} from '@shared/validation-settings';
import {
  validateValidationSettings,
  validatePartialValidationSettings,
  normalizeValidationSettings
} from '@shared/validation-settings-validator';
import { DEFAULT_VALIDATION_SETTINGS } from '@shared/validation-settings';
import { ValidationSettingsRepository } from '../../../repositories/validation-settings-repository';
import {
  ValidationSettingsError,
  ValidationSettingsErrorCode,
  ErrorSeverity,
  ValidationSettingsErrorLogger,
  createInitializationError,
  createDatabaseError,
  createValidationError,
  createSettingsNotFoundError,
  withErrorRecovery,
  type ErrorRecoveryOptions
} from '../validation-settings-errors';

export interface ValidationSettingsCoreConfig {
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

export class ValidationSettingsCoreService extends EventEmitter {
  private config: ValidationSettingsCoreConfig;
  private activeSettings: ValidationSettings | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private repository: ValidationSettingsRepository;
  private errorLogger: ValidationSettingsErrorLogger;

  constructor(config: Partial<ValidationSettingsCoreConfig> = {}) {
    super();
    
    this.config = {
      enableRealTimeSync: true,
      enableAutoBackup: true,
      backupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
    
    this.repository = new ValidationSettingsRepository();
    this.errorLogger = new ValidationSettingsErrorLogger();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      // Initialize repository
      await this.repository.initialize();
      
      // Load active settings
      await this.loadActiveSettings();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      const initError = createInitializationError(
        `Failed to initialize ValidationSettingsCoreService: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      this.isInitialized = false;
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to shutdown ValidationSettingsCoreService: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      console.error('[ValidationSettingsCoreService] Error loading active settings:', error);
    }
    
    if (!this.activeSettings) {
      // Create default settings if none exist
      this.activeSettings = await this.createDefaultSettings();
    }

    return this.activeSettings;
  }

  /**
   * Get current active settings
   */
  async getSettings(): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.activeSettings;
  }

  /**
   * Get settings by ID
   */
  async getSettingsById(settingsId: string): Promise<ValidationSettings | null> {
    try {
      const record = await this.repository.getById(settingsId);
      return record?.settings || null;
    } catch (error) {
      const dbError = createDatabaseError(
        `Failed to get settings by ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'getSettingsById', settingsId }
      );
      
      this.errorLogger.logError(dbError, 'getSettingsById');
      throw dbError;
    }
  }

  /**
   * Update settings
   */
  async updateSettings(update: ValidationSettingsUpdate): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const currentSettings = await this.getActiveSettings();
      
      // Validate the update
      const validationResult = await this.validateSettings(update);
      if (!validationResult.isValid) {
        const validationError = createValidationError(
          'Settings validation failed',
          { operation: 'updateSettings', validationErrors: validationResult.errors }
        );
        
        this.errorLogger.logError(validationError, 'updateSettings');
        throw validationError;
      }

      // Merge with current settings
      const updatedSettings = normalizeValidationSettings({
        ...currentSettings,
        ...update
      });

      // Save to database
      const savedRecord = await this.repository.updateActive(updatedSettings);
      
      // Update in-memory cache
      this.activeSettings = savedRecord.settings;
      
      // Emit change event
      this.emit('settingsChanged', {
        type: 'updated',
        settingsId: savedRecord.id,
        previousVersion: currentSettings,
        newVersion: savedRecord.settings,
        timestamp: new Date()
      } as SettingsChangeEvent);

      return savedRecord.settings;
      
    } catch (error) {
      if (error instanceof ValidationSettingsError) {
        throw error;
      }
      
      const updateError = createDatabaseError(
        `Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'updateSettings' }
      );
      
      this.errorLogger.logError(updateError, 'updateSettings');
      throw updateError;
    }
  }

  /**
   * Create new settings
   */
  async createSettings(settings: Partial<ValidationSettings>, createdBy?: string): Promise<ValidationSettings> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Validate the settings
      const validationResult = await this.validateSettings(settings);
      if (!validationResult.isValid) {
        const validationError = createValidationError(
          'Settings validation failed',
          { operation: 'createSettings', validationErrors: validationResult.errors }
        );
        
        this.errorLogger.logError(validationError, 'createSettings');
        throw validationError;
      }

      // Normalize and create
      const normalizedSettings = normalizeValidationSettings(settings);
      const savedRecord = await this.repository.create(normalizedSettings, createdBy);
      
      // Emit change event
      this.emit('settingsChanged', {
        type: 'created',
        settingsId: savedRecord.id,
        newVersion: savedRecord.settings,
        changedBy: createdBy,
        timestamp: new Date()
      } as SettingsChangeEvent);

      return savedRecord.settings;
      
    } catch (error) {
      if (error instanceof ValidationSettingsError) {
        throw error;
      }
      
      const createError = createDatabaseError(
        `Failed to create settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'createSettings' }
      );
      
      this.errorLogger.logError(createError, 'createSettings');
      throw createError;
    }
  }

  /**
   * Delete settings
   */
  async deleteSettings(settingsId: string, deletedBy?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Check if this is the active settings
      const activeRecord = await this.repository.getActive();
      if (activeRecord && activeRecord.id === settingsId) {
        throw createValidationError(
          'Cannot delete active settings',
          { operation: 'deleteSettings', settingsId }
        );
      }

      // Delete from database
      await this.repository.delete(settingsId);
      
      // Emit change event
      this.emit('settingsChanged', {
        type: 'deleted',
        settingsId,
        changedBy: deletedBy,
        timestamp: new Date()
      } as SettingsChangeEvent);
      
    } catch (error) {
      if (error instanceof ValidationSettingsError) {
        throw error;
      }
      
      const deleteError = createDatabaseError(
        `Failed to delete settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation: 'deleteSettings', settingsId }
      );
      
      this.errorLogger.logError(deleteError, 'deleteSettings');
      throw deleteError;
    }
  }

  /**
   * Validate settings
   */
  async validateSettings(settings: unknown): Promise<ValidationSettingsValidationResult> {
    try {
      if (typeof settings === 'object' && settings !== null) {
        // Partial validation for updates
        return validatePartialValidationSettings(settings);
      } else {
        // Full validation for new settings
        return validateValidationSettings(settings);
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'root',
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async loadActiveSettings(): Promise<void> {
    try {
      const activeRecord = await this.repository.getActive();
      if (activeRecord) {
        this.activeSettings = activeRecord.settings;
      }
    } catch (error) {
      console.error('[ValidationSettingsCoreService] Error loading active settings:', error);
    }
  }

  private async createDefaultSettings(): Promise<ValidationSettings> {
    return this.createSettings(DEFAULT_VALIDATION_SETTINGS, 'system');
  }
}
