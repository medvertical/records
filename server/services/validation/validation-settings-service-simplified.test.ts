/**
 * Simplified Validation Settings Service Tests
 * 
 * Tests for the simplified validation settings service without
 * versioning, audit trails, or complex history management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidationSettingsService } from './settings/validation-settings-service-simplified';
import { ValidationSettingsRepository } from '../../repositories/validation-settings-repository-simplified';
import type { ValidationSettings } from '@shared/validation-settings-simplified';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  }
}));

// Mock the simplified repository
vi.mock('../../repositories/validation-settings-repository-simplified', () => ({
  ValidationSettingsRepository: vi.fn().mockImplementation(() => ({
    getCurrentSettings: vi.fn(),
    createSettings: vi.fn(),
    updateSettings: vi.fn(),
    deleteSettings: vi.fn(),
    getSettingsStatistics: vi.fn(),
    getHealthStatus: vi.fn()
  }))
}));

describe('ValidationSettingsService (Simplified)', () => {
  let service: ValidationSettingsService;
  let mockRepository: any;

  const mockSettings: ValidationSettings = {
    aspects: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'error' },
      metadata: { enabled: true, severity: 'error' }
    },
    server: {
      url: 'https://hapi.fhir.org/baseR4',
      timeout: 30000,
      retries: 3
    },
    performance: {
      maxConcurrent: 8,
      batchSize: 100
    }
  };

  beforeEach(() => {
    mockRepository = {
      getCurrentSettings: vi.fn(),
      createSettings: vi.fn(),
      updateSettings: vi.fn(),
      deleteSettings: vi.fn(),
      getSettingsStatistics: vi.fn(),
      getHealthStatus: vi.fn()
    };

    (ValidationSettingsRepository as any).mockImplementation(() => mockRepository);
    service = new ValidationSettingsService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentSettings', () => {
    it('should return current validation settings', async () => {
      mockRepository.getCurrentSettings.mockResolvedValue(mockSettings);

      const result = await service.getCurrentSettings();

      expect(result).toEqual(mockSettings);
      expect(mockRepository.getCurrentSettings).toHaveBeenCalledTimes(1);
    });

    it('should return default settings when no settings found', async () => {
      mockRepository.getCurrentSettings.mockResolvedValue(null);

      const result = await service.getCurrentSettings();

      expect(result).toBeDefined();
      expect(result.aspects).toBeDefined();
      expect(result.server).toBeDefined();
      expect(result.performance).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      mockRepository.getCurrentSettings.mockRejectedValue(new Error('Database error'));

      // Service should fallback to defaults when database fails
      const result = await service.getCurrentSettings();
      expect(result).toBeDefined();
      expect(result.aspects).toBeDefined();
    });
  });

  describe('updateSettings', () => {
    it('should update validation settings successfully', async () => {
      const updateData = {
        aspects: {
          structural: { enabled: false, severity: 'warning' as const }
        }
      };

      mockRepository.updateSettings.mockResolvedValue({ ...mockSettings, ...updateData });

      const result = await service.updateSettings(updateData);

      expect(result).toBeDefined();
      expect(mockRepository.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        aspects: expect.objectContaining({
          structural: expect.objectContaining({
            enabled: false,
            severity: 'warning'
          })
        })
      }));
    });

    it('should handle update errors gracefully', async () => {
      const updateData = { aspects: { structural: { enabled: false, severity: 'warning' as const } } };
      mockRepository.updateSettings.mockRejectedValue(new Error('Update failed'));

      await expect(service.updateSettings(updateData)).rejects.toThrow('Update failed');
    });
  });

  describe('validateSettings', () => {
    it('should validate settings successfully', async () => {
      const result = await service.validateSettings(mockSettings);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid settings', async () => {
      const invalidSettings = {
        ...mockSettings,
        aspects: {
          ...mockSettings.aspects,
          structural: { enabled: true, severity: 'invalid' as any }
        }
      };

      const result = await service.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('resetToDefault', () => {
    it('should reset settings to default values', async () => {
      const defaultSettings = {
        aspects: {
          structural: { enabled: true, severity: 'error' as const },
          profile: { enabled: true, severity: 'warning' as const },
          terminology: { enabled: true, severity: 'warning' as const },
          reference: { enabled: true, severity: 'error' as const },
          businessRule: { enabled: true, severity: 'error' as const },
          metadata: { enabled: true, severity: 'error' as const }
        },
        server: {
          url: 'https://hapi.fhir.org/baseR4',
          timeout: 30000,
          retries: 3
        },
        performance: {
          maxConcurrent: 8,
          batchSize: 100
        }
      };

      mockRepository.updateSettings.mockResolvedValue(defaultSettings);

      const result = await service.resetToDefault();

      expect(result).toBeDefined();
      expect(mockRepository.updateSettings).toHaveBeenCalledWith(defaultSettings);
    });
  });

  describe('getBuiltInPresets', () => {
    it('should return built-in presets', async () => {
      const presets = await service.getBuiltInPresets();

      expect(presets).toBeDefined();
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
    });
  });

  describe('applyPreset', () => {
    it('should apply a preset successfully', async () => {
      const presetId = 'strict';
      const presetSettings = {
        aspects: {
          structural: { enabled: true, severity: 'error' as const },
          profile: { enabled: true, severity: 'error' as const },
          terminology: { enabled: true, severity: 'error' as const },
          reference: { enabled: true, severity: 'error' as const },
          businessRule: { enabled: true, severity: 'error' as const },
          metadata: { enabled: true, severity: 'error' as const }
        },
        server: {
          url: 'https://hapi.fhir.org/baseR4',
          timeout: 30000,
          retries: 3
        },
        performance: {
          maxConcurrent: 4,
          batchSize: 50
        }
      };

      mockRepository.updateSettings.mockResolvedValue(presetSettings);

      const result = await service.applyPreset(presetId);

      expect(result).toBeDefined();
      expect(mockRepository.updateSettings).toHaveBeenCalled();
    });

    it('should handle invalid preset ID', async () => {
      const invalidPresetId = 'invalid-preset';

      await expect(service.applyPreset(invalidPresetId)).rejects.toThrow();
    });
  });

  describe('testSettings', () => {
    it('should test settings with sample resource', async () => {
      const testResource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }]
      };

      const result = await service.testSettings(mockSettings, testResource);

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.issues).toBeDefined();
    });
  });

  describe('getSettingsStatistics', () => {
    it('should return settings statistics', async () => {
      const mockStats = {
        totalSettings: 1,
        activeSettings: 1,
        lastUpdated: new Date(),
        aspectCounts: {
          structural: 1,
          profile: 1,
          terminology: 1,
          reference: 1,
          businessRule: 1,
          metadata: 1
        }
      };

      mockRepository.getSettingsStatistics.mockResolvedValue(mockStats);

      const result = await service.getSettingsStatistics();

      expect(result).toEqual(mockStats);
      expect(mockRepository.getSettingsStatistics).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date(),
        repository: 'connected',
        database: 'connected'
      };

      mockRepository.getHealthStatus.mockResolvedValue(mockHealth);

      const result = await service.getHealthStatus();

      expect(result).toEqual(mockHealth);
      expect(mockRepository.getHealthStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event System', () => {
    it('should emit settings changed event when settings are updated', async () => {
      const updateData = {
        aspects: {
          structural: { enabled: false, severity: 'warning' as const }
        }
      };

      const eventSpy = vi.fn();
      service.on('settingsChanged', eventSpy);

      mockRepository.updateSettings.mockResolvedValue({ ...mockSettings, ...updateData });

      await service.updateSettings(updateData);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'updated',
        data: expect.any(Object)
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockRepository.getCurrentSettings.mockRejectedValue(new Error('Connection failed'));

      // Service should fallback to defaults when database fails
      const result = await service.getCurrentSettings();
      expect(result).toBeDefined();
      expect(result.aspects).toBeDefined();
    });

    it('should handle invalid settings data', async () => {
      const invalidSettings = {
        aspects: {
          structural: { enabled: 'invalid', severity: 'invalid' }
        }
      } as any;

      const result = await service.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
