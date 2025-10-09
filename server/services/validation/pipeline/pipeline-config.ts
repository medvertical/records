/**
 * Pipeline Configuration
 * 
 * Manages pipeline configuration, settings integration, and configuration validation.
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings/validation-settings-service';
import type { ValidationSettings } from '@shared/validation-settings';
import { ValidationPipelineConfig } from './pipeline-types';

// ============================================================================
// Pipeline Configuration Class
// ============================================================================

export class PipelineConfig extends EventEmitter {
  private settingsService = getValidationSettingsService();
  private config: ValidationPipelineConfig;
  private defaultConfig: ValidationPipelineConfig;

  constructor(initialConfig: Partial<ValidationPipelineConfig> = {}) {
    super();
    
    this.defaultConfig = {
      enableParallelProcessing: true,
      maxConcurrentValidations: 10,
      defaultTimeoutMs: 300000, // 5 minutes
      enableProgressTracking: true,
      enableResultCaching: true,
      cacheTtlMs: 300000, // 5 minutes
    };

    this.config = { ...this.defaultConfig, ...initialConfig };
    this.setupSettingsListeners();
  }

  // ========================================================================
  // Configuration Management
  // ========================================================================

  /**
   * Get current configuration
   */
  getConfig(): ValidationPipelineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ValidationPipelineConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Validate configuration
    const validationResult = this.validateConfig(this.config);
    if (!validationResult.isValid) {
      // Revert to old config if validation fails
      this.config = oldConfig;
      throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
    }

    this.emit('configUpdated', { 
      oldConfig, 
      newConfig: this.config,
      changes: this.getConfigChanges(oldConfig, this.config)
    });
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.defaultConfig };
    
    this.emit('configReset', { 
      oldConfig, 
      newConfig: this.config 
    });
  }

  /**
   * Get configuration for specific aspect
   */
  getAspectConfig(aspect: keyof ValidationPipelineConfig): any {
    return this.config[aspect];
  }

  /**
   * Update specific aspect configuration
   */
  updateAspectConfig(aspect: keyof ValidationPipelineConfig, value: any): void {
    this.updateConfig({ [aspect]: value });
  }

  // ========================================================================
  // Settings Integration
  // ========================================================================

  private setupSettingsListeners(): void {
    // Listen for settings changes and update configuration accordingly
    this.settingsService.on('settingsUpdated', (newSettings) => {
      this.updateConfigFromSettings(newSettings);
    });
  }

  /**
   * Update configuration based on validation settings
   */
  private updateConfigFromSettings(settings: ValidationSettings): void {
    const configUpdates: Partial<ValidationPipelineConfig> = {};

    // Update max concurrent validations from settings
    if (settings.performance?.maxConcurrent !== undefined) {
      configUpdates.maxConcurrentValidations = settings.performance.maxConcurrent;
    }

    // Update timeout from settings
    if (settings.server?.timeout !== undefined) {
      configUpdates.defaultTimeoutMs = settings.server.timeout;
    }

    // Always enable parallel processing and caching for simplified settings
    configUpdates.enableParallelProcessing = true;
    configUpdates.enableResultCaching = true;
    configUpdates.cacheTtlMs = 300000; // Default 5 minutes

    // Only update if there are actual changes
    if (Object.keys(configUpdates).length > 0) {
      this.updateConfig(configUpdates);
    }
  }

  /**
   * Get settings-aware configuration
   */
  async getSettingsAwareConfig(): Promise<ValidationPipelineConfig> {
    try {
      const settings = await this.settingsService.getCurrentSettings();
      const settingsAwareConfig = { ...this.config };

      // Override with settings values
      if (settings.performance?.maxConcurrent !== undefined) {
        settingsAwareConfig.maxConcurrentValidations = settings.performance.maxConcurrent;
      }

      if (settings.server?.timeout !== undefined) {
        settingsAwareConfig.defaultTimeoutMs = settings.server.timeout;
      }

      // Always enable parallel processing and caching for simplified settings
      settingsAwareConfig.enableParallelProcessing = true;
      settingsAwareConfig.enableResultCaching = true;
      settingsAwareConfig.cacheTtlMs = 300000; // Default 5 minutes

      return settingsAwareConfig;
    } catch (error) {
      console.warn('[PipelineConfig] Failed to load settings, using default config:', error);
      return this.config;
    }
  }

  // ========================================================================
  // Configuration Validation
  // ========================================================================

  /**
   * Validate configuration
   */
  validateConfig(config: ValidationPipelineConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate maxConcurrentValidations
    if (config.maxConcurrentValidations < 1) {
      errors.push('maxConcurrentValidations must be at least 1');
    } else if (config.maxConcurrentValidations > 100) {
      warnings.push('maxConcurrentValidations is very high, this may cause performance issues');
    }

    // Validate defaultTimeoutMs
    if (config.defaultTimeoutMs < 1000) {
      errors.push('defaultTimeoutMs must be at least 1000ms');
    } else if (config.defaultTimeoutMs > 3600000) { // 1 hour
      warnings.push('defaultTimeoutMs is very high, this may cause long waits');
    }

    // Validate cacheTtlMs
    if (config.cacheTtlMs < 0) {
      errors.push('cacheTtlMs must be non-negative');
    } else if (config.cacheTtlMs > 86400000) { // 24 hours
      warnings.push('cacheTtlMs is very high, this may cause memory issues');
    }

    // Validate boolean values
    if (typeof config.enableParallelProcessing !== 'boolean') {
      errors.push('enableParallelProcessing must be a boolean');
    }

    if (typeof config.enableProgressTracking !== 'boolean') {
      errors.push('enableProgressTracking must be a boolean');
    }

    if (typeof config.enableResultCaching !== 'boolean') {
      errors.push('enableResultCaching must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get configuration recommendations
   */
  getConfigRecommendations(): {
    performance: string[];
    reliability: string[];
    memory: string[];
  } {
    const recommendations = {
      performance: [] as string[],
      reliability: [] as string[],
      memory: [] as string[]
    };

    // Performance recommendations
    if (this.config.maxConcurrentValidations < 5) {
      recommendations.performance.push('Consider increasing maxConcurrentValidations to 5-10 for better throughput');
    }

    if (!this.config.enableParallelProcessing) {
      recommendations.performance.push('Enable parallel processing for better performance with multiple resources');
    }

    // Reliability recommendations
    if (this.config.defaultTimeoutMs < 30000) {
      recommendations.reliability.push('Consider increasing defaultTimeoutMs to at least 30 seconds for complex validations');
    }

    if (this.config.maxConcurrentValidations > 20) {
      recommendations.reliability.push('High concurrency may cause resource exhaustion, consider reducing maxConcurrentValidations');
    }

    // Memory recommendations
    if (this.config.enableResultCaching && this.config.cacheTtlMs > 1800000) { // 30 minutes
      recommendations.memory.push('Long cache TTL may cause memory issues, consider reducing cacheTtlMs');
    }

    if (this.config.maxConcurrentValidations > 15) {
      recommendations.memory.push('High concurrency may cause memory pressure, monitor memory usage');
    }

    return recommendations;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private getConfigChanges(oldConfig: ValidationPipelineConfig, newConfig: ValidationPipelineConfig): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};

    for (const key in newConfig) {
      if (oldConfig[key as keyof ValidationPipelineConfig] !== newConfig[key as keyof ValidationPipelineConfig]) {
        changes[key] = {
          old: oldConfig[key as keyof ValidationPipelineConfig],
          new: newConfig[key as keyof ValidationPipelineConfig]
        };
      }
    }

    return changes;
  }

  /**
   * Export configuration to JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.updateConfig(importedConfig);
    } catch (error) {
      throw new Error(`Invalid configuration JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get configuration summary
   */
  getConfigSummary(): {
    parallelProcessing: boolean;
    maxConcurrency: number;
    timeout: number;
    caching: boolean;
    cacheTtl: number;
    progressTracking: boolean;
  } {
    return {
      parallelProcessing: this.config.enableParallelProcessing,
      maxConcurrency: this.config.maxConcurrentValidations,
      timeout: this.config.defaultTimeoutMs,
      caching: this.config.enableResultCaching,
      cacheTtl: this.config.cacheTtlMs,
      progressTracking: this.config.enableProgressTracking
    };
  }
}
