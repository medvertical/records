/**
 * Validation Settings Validator Tests
 * 
 * Tests for batch processing configuration validation
 */

import { describe, it, expect } from 'vitest';
import { validateValidationSettings, validatePartialValidationSettings } from './validation-settings-validator';
import type { ValidationSettings, BatchProcessingConfig, ResourceTypeFilterConfig } from './validation-settings';

describe('Validation Settings Validator - Batch Processing', () => {
  const createValidBatchProcessingConfig = (): BatchProcessingConfig => ({
    defaultBatchSize: 200,
    minBatchSize: 50,
    maxBatchSize: 1000,
    useAdaptiveBatchSizing: false,
    targetBatchProcessingTimeMs: 30000,
    pauseBetweenBatches: false,
    pauseDurationMs: 1000,
    retryFailedBatches: true,
    maxRetryAttempts: 1,
    retryDelayMs: 2000
  });

  const createValidValidationSettings = (batchConfig?: Partial<BatchProcessingConfig>): ValidationSettings => ({
    version: 1,
    isActive: true,
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'information' },
    strictMode: false,
    defaultSeverity: 'warning',
    includeDebugInfo: false,
    validateAgainstBaseSpec: true,
    fhirVersion: 'R4',
    terminologyServers: [],
    profileResolutionServers: [],
    cacheSettings: {
      enabled: true,
      ttlMs: 300000,
      maxSizeMB: 100,
      cacheValidationResults: true,
      cacheTerminologyExpansions: true,
      cacheProfileResolutions: true
    },
    timeoutSettings: {
      defaultTimeoutMs: 30000,
      structuralValidationTimeoutMs: 30000,
      profileValidationTimeoutMs: 45000,
      terminologyValidationTimeoutMs: 60000,
      referenceValidationTimeoutMs: 30000,
      businessRuleValidationTimeoutMs: 30000,
      metadataValidationTimeoutMs: 15000
    },
    batchProcessingSettings: {
      ...createValidBatchProcessingConfig(),
      ...batchConfig
    },
    resourceTypeFilterSettings: {
      enabled: false,
      mode: 'include',
      resourceTypes: ['Patient', 'Observation', 'Encounter'],
      validateUnknownTypes: true,
      showResourceTypeCounts: true,
      validateCustomTypes: true
    },
    maxConcurrentValidations: 8,
    useParallelValidation: true,
    customRules: [],
    validateExternalReferences: false,
    validateNonExistentReferences: true,
    validateReferenceTypes: true
  });

  describe('Batch Processing Configuration Validation', () => {
    it('should validate valid batch processing configuration', () => {
      const settings = createValidValidationSettings();
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject batch size below minimum', () => {
      const settings = createValidValidationSettings({
        defaultBatchSize: 25 // Below minimum of 50
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const batchSizeError = result.errors.find(e => e.path === 'batchProcessingSettings.defaultBatchSize');
      expect(batchSizeError).toBeDefined();
      expect(batchSizeError!.message).toContain('at least 50');
    });

    it('should reject batch size above maximum', () => {
      const settings = createValidValidationSettings({
        defaultBatchSize: 1500 // Above maximum of 1000
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const batchSizeError = result.errors.find(e => e.path === 'batchProcessingSettings.defaultBatchSize');
      expect(batchSizeError).toBeDefined();
      expect(batchSizeError!.message).toContain('1000');
    });

    it('should reject min batch size below minimum', () => {
      const settings = createValidValidationSettings({
        minBatchSize: 5 // Below minimum of 10
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('at least 10');
      expect(result.errors[0].path).toBe('batchProcessingSettings.minBatchSize');
    });

    it('should reject max batch size above maximum', () => {
      const settings = createValidValidationSettings({
        maxBatchSize: 3000 // Above maximum of 2000
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const maxBatchSizeError = result.errors.find(e => e.path === 'batchProcessingSettings.maxBatchSize');
      expect(maxBatchSizeError).toBeDefined();
      expect(maxBatchSizeError!.message).toContain('2000');
    });

    it('should reject default batch size outside min/max bounds', () => {
      const settings = createValidValidationSettings({
        defaultBatchSize: 75,
        minBatchSize: 100,
        maxBatchSize: 200
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('between min and max batch size values');
      expect(result.errors[0].path).toBe('batchProcessingSettings.defaultBatchSize');
    });

    it('should reject min batch size greater than max batch size', () => {
      const settings = createValidValidationSettings({
        minBatchSize: 500,
        maxBatchSize: 200
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const minBatchSizeError = result.errors.find(e => e.path === 'batchProcessingSettings.minBatchSize');
      expect(minBatchSizeError).toBeDefined();
      expect(minBatchSizeError!.message).toContain('less than maximum batch size');
    });

    it('should reject invalid target processing time', () => {
      const settings = createValidValidationSettings({
        targetBatchProcessingTimeMs: 1000 // Below minimum of 5000
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('at least 5 seconds');
      expect(result.errors[0].path).toBe('batchProcessingSettings.targetBatchProcessingTimeMs');
    });

    it('should reject invalid retry delay', () => {
      const settings = createValidValidationSettings({
        retryDelayMs: 500 // Below minimum of 1000
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('at least 1 second');
      expect(result.errors[0].path).toBe('batchProcessingSettings.retryDelayMs');
    });

    it('should reject invalid max retry attempts', () => {
      const settings = createValidValidationSettings({
        maxRetryAttempts: 10 // Above maximum of 5
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const maxRetryError = result.errors.find(e => e.path === 'batchProcessingSettings.maxRetryAttempts');
      expect(maxRetryError).toBeDefined();
      expect(maxRetryError!.message).toContain('5');
    });

    it('should reject invalid pause duration', () => {
      const settings = createValidValidationSettings({
        pauseDurationMs: 50 // Below minimum of 100
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('at least 100ms');
      expect(result.errors[0].path).toBe('batchProcessingSettings.pauseDurationMs');
    });

    it('should accept valid boolean values for batch processing flags', () => {
      const settings = createValidValidationSettings({
        useAdaptiveBatchSizing: true,
        pauseBetweenBatches: true,
        retryFailedBatches: false
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Partial Validation Settings - Batch Processing', () => {
    it('should validate partial batch processing configuration', () => {
      const partialSettings = {
        batchProcessingSettings: {
          defaultBatchSize: 150,
          minBatchSize: 50,
          maxBatchSize: 1000,
          useAdaptiveBatchSizing: false,
          targetBatchProcessingTimeMs: 30000,
          pauseBetweenBatches: false,
          pauseDurationMs: 1000,
          retryFailedBatches: true,
          maxRetryAttempts: 1,
          retryDelayMs: 2000
        }
      };
      const result = validatePartialValidationSettings(partialSettings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid partial batch processing configuration', () => {
      const partialSettings = {
        batchProcessingSettings: {
          defaultBatchSize: 25, // Below minimum
          minBatchSize: 50,
          maxBatchSize: 1000,
          useAdaptiveBatchSizing: false,
          targetBatchProcessingTimeMs: 30000,
          pauseBetweenBatches: false,
          pauseDurationMs: 1000,
          retryFailedBatches: true,
          maxRetryAttempts: 1,
          retryDelayMs: 2000
        }
      };
      const result = validatePartialValidationSettings(partialSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const batchSizeError = result.errors.find(e => e.path === 'batchProcessingSettings.defaultBatchSize');
      expect(batchSizeError).toBeDefined();
      expect(batchSizeError!.message).toContain('at least 50');
    });

    it('should validate complete batch processing update', () => {
      const partialSettings = {
        batchProcessingSettings: {
          defaultBatchSize: 300,
          minBatchSize: 100,
          maxBatchSize: 800,
          useAdaptiveBatchSizing: true,
          targetBatchProcessingTimeMs: 30000,
          pauseBetweenBatches: true,
          pauseDurationMs: 2000,
          retryFailedBatches: true,
          maxRetryAttempts: 2,
          retryDelayMs: 3000
        }
      };
      const result = validatePartialValidationSettings(partialSettings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Business Logic Validation - Batch Processing', () => {
    it('should warn about large batch size', () => {
      const settings = createValidValidationSettings({
        defaultBatchSize: 600 // Above 500 threshold
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      const largeBatchWarning = result.warnings.find(w => w.code === 'LARGE_BATCH_SIZE');
      expect(largeBatchWarning).toBeDefined();
      expect(largeBatchWarning!.message).toContain('may cause memory issues');
    });

    it('should suggest against adaptive sizing with pause', () => {
      const settings = createValidValidationSettings({
        useAdaptiveBatchSizing: true,
        pauseBetweenBatches: true
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      const adaptiveSuggestion = result.suggestions.find(s => s.code === 'ADAPTIVE_WITH_PAUSE');
      expect(adaptiveSuggestion).toBeDefined();
      expect(adaptiveSuggestion!.message).toContain('may reduce efficiency');
    });

    it('should warn about high retry count', () => {
      const settings = createValidValidationSettings({
        retryFailedBatches: true,
        maxRetryAttempts: 4 // Above 3 threshold
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      const highRetryWarning = result.warnings.find(w => w.code === 'HIGH_RETRY_COUNT');
      expect(highRetryWarning).toBeDefined();
      expect(highRetryWarning!.message).toContain('may significantly increase processing time');
    });

    it('should not warn about normal batch size', () => {
      const settings = createValidValidationSettings({
        defaultBatchSize: 200 // Normal size
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      const largeBatchWarning = result.warnings.find(w => w.code === 'LARGE_BATCH_SIZE');
      expect(largeBatchWarning).toBeUndefined();
    });

    it('should not suggest against normal retry count', () => {
      const settings = createValidValidationSettings({
        retryFailedBatches: true,
        maxRetryAttempts: 1 // Normal retry count
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      const highRetryWarning = result.warnings.find(w => w.code === 'HIGH_RETRY_COUNT');
      expect(highRetryWarning).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary values correctly', () => {
      const settings = createValidValidationSettings({
        defaultBatchSize: 50, // Minimum valid value
        minBatchSize: 50,
        maxBatchSize: 1000,
        maxRetryAttempts: 0, // Minimum valid value
        retryDelayMs: 1000, // Minimum valid value
        targetBatchProcessingTimeMs: 5000 // Minimum valid value
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle maximum boundary values correctly', () => {
      const settings = createValidValidationSettings({
        defaultBatchSize: 1000, // Maximum valid value
        minBatchSize: 100,
        maxBatchSize: 2000,
        maxRetryAttempts: 5, // Maximum valid value
        retryDelayMs: 60000, // Maximum valid value
        targetBatchProcessingTimeMs: 300000, // Maximum valid value
        pauseDurationMs: 10000 // Maximum valid value
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle missing batch processing settings', () => {
      const settings = createValidValidationSettings();
      // Remove batch processing settings
      delete (settings as any).batchProcessingSettings;
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Validation Settings Validator - Resource Type Filtering', () => {
  const createValidResourceTypeFilterConfig = (): ResourceTypeFilterConfig => ({
    enabled: false,
    mode: 'include',
    resourceTypes: ['Patient', 'Observation', 'Encounter'],
    validateUnknownTypes: true,
    showResourceTypeCounts: true,
    validateCustomTypes: true
  });

  const createValidValidationSettings = (filterConfig?: Partial<ResourceTypeFilterConfig>): ValidationSettings => ({
    version: 1,
    isActive: true,
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'information' },
    strictMode: false,
    defaultSeverity: 'warning',
    includeDebugInfo: false,
    validateAgainstBaseSpec: true,
    fhirVersion: 'R4',
    terminologyServers: [],
    profileResolutionServers: [],
    cacheSettings: {
      enabled: true,
      ttlMs: 300000,
      maxSizeMB: 100,
      cacheValidationResults: true,
      cacheTerminologyExpansions: true,
      cacheProfileResolutions: true
    },
    timeoutSettings: {
      defaultTimeoutMs: 30000,
      structuralValidationTimeoutMs: 30000,
      profileValidationTimeoutMs: 45000,
      terminologyValidationTimeoutMs: 60000,
      referenceValidationTimeoutMs: 30000,
      businessRuleValidationTimeoutMs: 30000,
      metadataValidationTimeoutMs: 15000
    },
    batchProcessingSettings: {
      defaultBatchSize: 200,
      minBatchSize: 50,
      maxBatchSize: 1000,
      useAdaptiveBatchSizing: false,
      targetBatchProcessingTimeMs: 30000,
      pauseBetweenBatches: false,
      pauseDurationMs: 1000,
      retryFailedBatches: true,
      maxRetryAttempts: 1,
      retryDelayMs: 2000
    },
    resourceTypeFilterSettings: {
      ...createValidResourceTypeFilterConfig(),
      ...filterConfig
    },
    maxConcurrentValidations: 10,
    useParallelValidation: true,
    customRules: [],
    validateExternalReferences: false,
    validateNonExistentReferences: true,
    validateReferenceTypes: true
  });

  describe('Resource Type Filter Configuration Validation', () => {
    it('should validate valid resource type filter configuration', () => {
      const settings = createValidValidationSettings();
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid filter mode', () => {
      const settings = createValidValidationSettings({
        mode: 'invalid' as any
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.find(e => e.path === 'resourceTypeFilterSettings.mode')).toBeDefined();
    });

    it('should reject empty resource types list when filtering is enabled', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        resourceTypes: []
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.find(e => e.path === 'resourceTypeFilterSettings.resourceTypes')).toBeDefined();
    });

    it('should reject invalid resource type names', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        resourceTypes: ['invalid-resource-type', 'AnotherInvalidType!', 'patient'] // lowercase, hyphen, special chars
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.find(e => e.path === 'resourceTypeFilterSettings.resourceTypes')).toBeDefined();
    });

    it('should accept valid resource type names', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        resourceTypes: ['Patient', 'Observation', 'Encounter', 'Condition', 'Procedure']
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject too many resource types', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        resourceTypes: Array.from({ length: 101 }, (_, i) => `ResourceType${i}`)
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.find(e => e.path === 'resourceTypeFilterSettings.resourceTypes')).toBeDefined();
    });

    it('should accept empty resource types list when filtering is disabled', () => {
      const settings = createValidValidationSettings({
        enabled: false,
        resourceTypes: []
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate include mode configuration', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        mode: 'include',
        resourceTypes: ['Patient', 'Observation']
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate exclude mode configuration', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        mode: 'exclude',
        resourceTypes: ['Binary', 'Bundle', 'Parameters']
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate unknown types and custom types settings', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        validateUnknownTypes: false,
        validateCustomTypes: false
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Resource Type Filter Business Logic Validation', () => {
    it('should provide suggestions for common resource types when filtering is enabled', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        resourceTypes: ['Patient'] // Only one common type selected
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.find(s => s.code === 'suggest_common_resource_types')).toBeDefined();
    });

    it('should warn about excluding too many resource types', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        mode: 'exclude',
        resourceTypes: Array.from({ length: 50 }, (_, i) => `ResourceType${i}`)
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.find(w => w.code === 'exclude_too_many_types')).toBeDefined();
    });

    it('should suggest enabling unknown types validation for comprehensive filtering', () => {
      const settings = createValidValidationSettings({
        enabled: true,
        validateUnknownTypes: false,
        resourceTypes: ['Patient', 'Observation']
      });
      const result = validateValidationSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.find(s => s.code === 'enable_unknown_types_validation')).toBeDefined();
    });
  });
});
