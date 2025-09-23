/**
 * Validation Settings Preset Service
 * 
 * Manages built-in and custom validation settings presets.
 * Provides preset application, creation, and management functionality.
 */

import { EventEmitter } from 'events';
import type {
  ValidationSettings,
  ValidationSettingsPreset
} from '@shared/validation-settings';
import { BUILT_IN_PRESETS } from '@shared/validation-settings';
import { ValidationSettingsRepository } from '../../../repositories/validation-settings-repository';

export interface CustomPreset {
  /** Preset ID */
  id: string;
  
  /** Preset name */
  name: string;
  
  /** Preset description */
  description: string;
  
  /** Preset settings */
  settings: ValidationSettings;
  
  /** Created by user */
  createdBy: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** Whether preset is active */
  isActive: boolean;
}

export interface PresetApplicationResult {
  /** Whether application was successful */
  success: boolean;
  
  /** Applied settings */
  settings?: ValidationSettings;
  
  /** Error message if failed */
  error?: string;
  
  /** Preset that was applied */
  preset?: ValidationSettingsPreset | CustomPreset;
}

export class ValidationSettingsPresetService extends EventEmitter {
  private repository: ValidationSettingsRepository;
  private customPresets: Map<string, CustomPreset> = new Map();

  constructor() {
    super();
    this.repository = new ValidationSettingsRepository();
  }

  /**
   * Initialize the preset service
   */
  async initialize(): Promise<void> {
    await this.loadCustomPresets();
    this.emit('initialized');
  }

  /**
   * Shutdown the preset service
   */
  async shutdown(): Promise<void> {
    this.customPresets.clear();
    this.emit('shutdown');
  }

  // ========================================================================
  // Built-in Presets
  // ========================================================================

  /**
   * Get all built-in presets
   */
  getBuiltInPresets(): ValidationSettingsPreset[] {
    return [...BUILT_IN_PRESETS];
  }

  /**
   * Get built-in preset by ID
   */
  getBuiltInPreset(presetId: string): ValidationSettingsPreset | null {
    return BUILT_IN_PRESETS.find(preset => preset.id === presetId) || null;
  }

  /**
   * Apply built-in preset
   */
  async applyBuiltInPreset(presetId: string, createdBy?: string): Promise<PresetApplicationResult> {
    try {
      const preset = this.getBuiltInPreset(presetId);
      if (!preset) {
        return {
          success: false,
          error: `Built-in preset '${presetId}' not found`
        };
      }

      // Create settings from preset
      const settings = await this.createSettingsFromPreset(preset, createdBy);
      
      this.emit('presetApplied', {
        presetId,
        presetType: 'built-in',
        createdBy,
        timestamp: new Date()
      });

      return {
        success: true,
        settings,
        preset
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply built-in preset: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ========================================================================
  // Custom Presets
  // ========================================================================

  /**
   * Get all custom presets
   */
  getCustomPresets(): CustomPreset[] {
    return Array.from(this.customPresets.values());
  }

  /**
   * Get custom preset by ID
   */
  getCustomPreset(presetId: string): CustomPreset | null {
    return this.customPresets.get(presetId) || null;
  }

  /**
   * Create custom preset
   */
  async createCustomPreset(
    name: string,
    description: string,
    settings: ValidationSettings,
    createdBy: string
  ): Promise<CustomPreset> {
    const presetId = this.generatePresetId(name);
    
    const preset: CustomPreset = {
      id: presetId,
      name,
      description,
      settings,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    this.customPresets.set(presetId, preset);
    await this.saveCustomPresets();
    
    this.emit('customPresetCreated', {
      presetId,
      name,
      createdBy,
      timestamp: new Date()
    });

    return preset;
  }

  /**
   * Update custom preset
   */
  async updateCustomPreset(
    presetId: string,
    updates: Partial<Pick<CustomPreset, 'name' | 'description' | 'settings'>>,
    updatedBy: string
  ): Promise<CustomPreset | null> {
    const preset = this.customPresets.get(presetId);
    if (!preset) {
      return null;
    }

    const updatedPreset: CustomPreset = {
      ...preset,
      ...updates,
      updatedAt: new Date()
    };

    this.customPresets.set(presetId, updatedPreset);
    await this.saveCustomPresets();
    
    this.emit('customPresetUpdated', {
      presetId,
      updatedBy,
      timestamp: new Date()
    });

    return updatedPreset;
  }

  /**
   * Delete custom preset
   */
  async deleteCustomPreset(presetId: string, deletedBy: string): Promise<boolean> {
    const preset = this.customPresets.get(presetId);
    if (!preset) {
      return false;
    }

    this.customPresets.delete(presetId);
    await this.saveCustomPresets();
    
    this.emit('customPresetDeleted', {
      presetId,
      deletedBy,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Apply custom preset
   */
  async applyCustomPreset(presetId: string, createdBy?: string): Promise<PresetApplicationResult> {
    try {
      const preset = this.getCustomPreset(presetId);
      if (!preset) {
        return {
          success: false,
          error: `Custom preset '${presetId}' not found`
        };
      }

      // Create settings from preset
      const settings = await this.createSettingsFromPreset(preset, createdBy);
      
      this.emit('presetApplied', {
        presetId,
        presetType: 'custom',
        createdBy,
        timestamp: new Date()
      });

      return {
        success: true,
        settings,
        preset
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply custom preset: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ========================================================================
  // Preset Management
  // ========================================================================

  /**
   * Get all available presets (built-in + custom)
   */
  getAllPresets(): Array<ValidationSettingsPreset | CustomPreset> {
    return [
      ...this.getBuiltInPresets(),
      ...this.getCustomPresets()
    ];
  }

  /**
   * Search presets by name or description
   */
  searchPresets(query: string): Array<ValidationSettingsPreset | CustomPreset> {
    const lowerQuery = query.toLowerCase();
    
    return this.getAllPresets().filter(preset => 
      preset.name.toLowerCase().includes(lowerQuery) ||
      preset.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get preset by ID (built-in or custom)
   */
  getPresetById(presetId: string): ValidationSettingsPreset | CustomPreset | null {
    return this.getBuiltInPreset(presetId) || this.getCustomPreset(presetId);
  }

  /**
   * Apply preset by ID (built-in or custom)
   */
  async applyPreset(presetId: string, createdBy?: string): Promise<PresetApplicationResult> {
    // Try built-in preset first
    const builtInResult = await this.applyBuiltInPreset(presetId, createdBy);
    if (builtInResult.success) {
      return builtInResult;
    }

    // Try custom preset
    return this.applyCustomPreset(presetId, createdBy);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Create settings from preset
   */
  private async createSettingsFromPreset(
    preset: ValidationSettingsPreset | CustomPreset,
    createdBy?: string
  ): Promise<ValidationSettings> {
    return this.repository.create(preset.settings, createdBy).then(record => record.settings);
  }

  /**
   * Generate unique preset ID
   */
  private generatePresetId(name: string): string {
    const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let counter = 1;
    let presetId = baseId;
    
    while (this.customPresets.has(presetId)) {
      presetId = `${baseId}-${counter}`;
      counter++;
    }
    
    return presetId;
  }

  /**
   * Load custom presets from storage
   */
  private async loadCustomPresets(): Promise<void> {
    try {
      // TODO: Implement custom preset persistence
      // For now, start with empty custom presets
      this.customPresets.clear();
    } catch (error) {
      console.error('[ValidationSettingsPresetService] Error loading custom presets:', error);
    }
  }

  /**
   * Save custom presets to storage
   */
  private async saveCustomPresets(): Promise<void> {
    try {
      // TODO: Implement custom preset persistence
      // For now, just emit event
      this.emit('customPresetsSaved', { count: this.customPresets.size });
    } catch (error) {
      console.error('[ValidationSettingsPresetService] Error saving custom presets:', error);
    }
  }
}
