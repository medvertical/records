/**
 * Unit Tests for Simplified Validation Settings Service
 * 
 * Tests validation logic, normalization, and core functionality
 */

import { ValidationSettingsService } from './validation-settings-service-simplified';
import { DEFAULT_VALIDATION_SETTINGS } from '@shared/validation-settings-simplified';
import type { ValidationSettings, ValidationSettingsUpdate } from '@shared/validation-settings-simplified';

describe('ValidationSettingsService', () => {
  let service: ValidationSettingsService;

  beforeEach(() => {
    service = new ValidationSettingsService();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('Validation Logic', () => {
    it('should validate correct settings', () => {
      const validSettings: ValidationSettings = {
        ...DEFAULT_VALIDATION_SETTINGS
      };

      const result = service.validateSettings(validSettings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject settings with missing aspects', () => {
      const invalidSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: undefined
      } as any;

      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Aspects configuration is required');
    });

    it('should reject settings with invalid aspect severity', () => {
      const invalidSettings: ValidationSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: {
          ...DEFAULT_VALIDATION_SETTINGS.aspects,
          structural: {
            enabled: true,
            severity: 'invalid' as any
          }
        }
      };

      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('structural validation severity must be \'error\', \'warning\', or \'info\'');
    });

    it('should reject settings with invalid server URL', () => {
      const invalidSettings: ValidationSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        server: {
          ...DEFAULT_VALIDATION_SETTINGS.server,
          url: 'not-a-valid-url'
        }
      };

      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Server URL must be a valid URL');
    });

    it('should reject settings with invalid performance values', () => {
      const invalidSettings: ValidationSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        performance: {
          maxConcurrent: 0,
          batchSize: -1
        }
      };

      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max concurrent validations must be at least 1');
      expect(result.errors).toContain('Batch size must be at least 1');
    });

    it('should reject settings with invalid records configuration', () => {
      const invalidSettings: ValidationSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        records: {
          ...DEFAULT_VALIDATION_SETTINGS.records,
          maxReferenceDepth: 0
        }
      };

      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum reference depth must be at least 1');
    });

    it('should generate warnings for performance-impacting settings', () => {
      const settingsWithWarnings: ValidationSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        records: {
          ...DEFAULT_VALIDATION_SETTINGS.records,
          maxReferenceDepth: 15
        }
      };

      const result = service.validateSettings(settingsWithWarnings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Maximum reference depth greater than 10 may impact performance');
    });
  });

  describe('Settings Normalization', () => {
    it('should normalize settings to default structure', async () => {
      await service.initialize();
      
      const settings = await service.getCurrentSettings();
      
      expect(settings).toHaveProperty('aspects');
      expect(settings).toHaveProperty('server');
      expect(settings).toHaveProperty('performance');
      expect(settings).toHaveProperty('records');
      
      // Check aspect structure
      expect(settings.aspects).toHaveProperty('structural');
      expect(settings.aspects).toHaveProperty('profile');
      expect(settings.aspects).toHaveProperty('terminology');
      expect(settings.aspects).toHaveProperty('reference');
      expect(settings.aspects).toHaveProperty('businessRule');
      expect(settings.aspects).toHaveProperty('metadata');
      
      // Check each aspect has required properties
      Object.values(settings.aspects).forEach(aspect => {
        expect(aspect).toHaveProperty('enabled');
        expect(aspect).toHaveProperty('severity');
        expect(typeof aspect.enabled).toBe('boolean');
        expect(['error', 'warning', 'info']).toContain(aspect.severity);
      });
    });

    it('should handle partial settings updates', async () => {
      await service.initialize();
      
      const update: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: false, severity: 'warning' }
          }
        }
      };

      const result = await service.updateSettings(update);
      
      expect(result.aspects.structural.enabled).toBe(false);
      expect(result.aspects.structural.severity).toBe('warning');
      // Other aspects should remain unchanged
      expect(result.aspects.profile).toEqual(DEFAULT_VALIDATION_SETTINGS.aspects.profile);
    });
  });

  describe('Event Emission', () => {
    it('should emit settingsChanged event on update', async () => {
      await service.initialize();
      
      const eventSpy = jest.fn();
      service.on('settingsChanged', eventSpy);
      
      const update: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: false, severity: 'warning' }
          }
        }
      };

      await service.updateSettings(update);
      
      expect(eventSpy).toHaveBeenCalledWith({
        type: 'updated',
        data: expect.any(Object)
      });
    });

    it('should emit settingsReset event on reset', async () => {
      await service.initialize();
      
      const eventSpy = jest.fn();
      service.on('settingsReset', eventSpy);
      
      await service.resetToDefaults();
      
      expect(eventSpy).toHaveBeenCalledWith({
        newSettings: expect.any(Object)
      });
    });

    it('should emit presetApplied event on preset application', async () => {
      await service.initialize();
      
      const eventSpy = jest.fn();
      service.on('settingsChanged', eventSpy);
      
      await service.applyPreset('strict');
      
      expect(eventSpy).toHaveBeenCalledWith({
        type: 'presetApplied',
        data: expect.objectContaining({
          presetId: 'strict',
          settings: expect.any(Object)
        })
      });
    });
  });

  describe('Preset Management', () => {
    it('should return built-in presets', () => {
      const presets = service.getPresets();
      
      expect(presets).toHaveLength(2);
      expect(presets[0]).toHaveProperty('id');
      expect(presets[0]).toHaveProperty('name');
      expect(presets[0]).toHaveProperty('description');
      expect(presets[0]).toHaveProperty('settings');
    });

    it('should find specific preset by ID', () => {
      const strictPreset = service.getPreset('strict');
      
      expect(strictPreset).toBeDefined();
      expect(strictPreset?.id).toBe('strict');
      expect(strictPreset?.name).toBe('Strict Validation');
    });

    it('should return null for non-existent preset', () => {
      const nonExistentPreset = service.getPreset('non-existent');
      
      expect(nonExistentPreset).toBeNull();
    });
  });

  describe('Snapshot Hash Generation', () => {
    it('should generate consistent hash for same settings', async () => {
      await service.initialize();
      
      const settings1 = await service.getCurrentSettingsWithSnapshot();
      const settings2 = await service.getCurrentSettingsWithSnapshot();
      
      expect(settings1.snapshotHash).toBe(settings2.snapshotHash);
    });

    it('should generate different hash for different settings', async () => {
      await service.initialize();
      
      const settings1 = await service.getCurrentSettingsWithSnapshot();
      
      const update: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: false, severity: 'warning' }
          }
        }
      };
      
      await service.updateSettings(update);
      const settings2 = await service.getCurrentSettingsWithSnapshot();
      
      expect(settings1.snapshotHash).not.toBe(settings2.snapshotHash);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      await service.initialize();
      
      const invalidUpdate: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: true, severity: 'invalid' as any }
          }
        }
      };

      await expect(service.updateSettings(invalidUpdate)).rejects.toThrow('Validation failed');
    });

    it('should handle preset application errors', async () => {
      await service.initialize();
      
      await expect(service.applyPreset('non-existent')).rejects.toThrow('Preset not found');
    });
  });
});

