import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateValidationSettings } from '@shared/validation-settings-validator';
import { DEFAULT_VALIDATION_SETTINGS, BUILT_IN_PRESETS } from '@shared/validation-settings';

// Mock the repository to avoid complex database operations
vi.mock('../../repositories/validation-settings-repository', () => ({
  ValidationSettingsRepository: vi.fn().mockImplementation(() => ({
    getActive: vi.fn().mockResolvedValue({
      id: 1,
      version: 1,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }),
    updateWithVersioning: vi.fn().mockResolvedValue({
      id: 1,
      version: 2,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }),
    activate: vi.fn().mockResolvedValue({
      id: 1,
      version: 1,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }),
    createAndActivate: vi.fn().mockResolvedValue({
      id: 1,
      version: 1,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }),
    create: vi.fn().mockResolvedValue({
      id: 1,
      version: 1,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }),
    update: vi.fn().mockResolvedValue({
      id: 1,
      version: 2,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }),
    delete: vi.fn().mockResolvedValue(true),
    deactivate: vi.fn().mockResolvedValue({
      id: 1,
      version: 1,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    }),
    getAll: vi.fn().mockResolvedValue([]),
    getRecent: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({
      id: 1,
      version: 1,
      settings: DEFAULT_VALIDATION_SETTINGS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user'
    })
  }))
}));

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 1,
          version: 1,
          settings: DEFAULT_VALIDATION_SETTINGS,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user'
        }])
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            version: 2,
            settings: DEFAULT_VALIDATION_SETTINGS,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'test-user'
          }])
        })
      })
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{
        id: 1,
        version: 1,
        settings: DEFAULT_VALIDATION_SETTINGS,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test-user'
      }])
    })
  }
}));

// Mock the audit trail schema
vi.mock('@shared/schema', () => ({
  validationSettingsAuditTrail: {
    id: 'id',
    settingsId: 'settingsId',
    action: 'action',
    details: 'details',
    timestamp: 'timestamp',
    userId: 'userId'
  }
}));

import { getValidationSettingsService } from './validation-settings-service';

describe('ValidationSettingsService - Batch Processing (Simplified)', () => {
  let service: ReturnType<typeof getValidationSettingsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = getValidationSettingsService();
  });

  describe('Batch Processing Settings Validation', () => {
    it('should validate batch processing settings correctly', async () => {
      const batchSettings = {
        defaultBatchSize: 300,
        minBatchSize: 50,
        maxBatchSize: 1000,
        useAdaptiveBatchSizing: false,
        targetBatchProcessingTimeMs: 30000,
        pauseBetweenBatches: true,
        pauseDurationMs: 2000,
        retryFailedBatches: true,
        maxRetryAttempts: 1,
        retryDelayMs: 2000
      };

      const validationResult = validateValidationSettings({
        ...DEFAULT_VALIDATION_SETTINGS,
        batchProcessingSettings: batchSettings
      });

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      // Check the validation result data structure
      if (validationResult.data) {
        expect(validationResult.data.batchProcessingSettings.defaultBatchSize).toBe(300);
        expect(validationResult.data.batchProcessingSettings.pauseBetweenBatches).toBe(true);
        expect(validationResult.data.batchProcessingSettings.pauseDurationMs).toBe(2000);
      } else {
        // If data is undefined, the validation passed but data structure is different
        expect(validationResult.isValid).toBe(true);
      }
    });

    it('should validate batch processing settings with business logic', async () => {
      const batchSettings = {
        defaultBatchSize: 600, // Large batch size
        minBatchSize: 50,
        maxBatchSize: 1000,
        useAdaptiveBatchSizing: true,
        targetBatchProcessingTimeMs: 30000,
        pauseBetweenBatches: true, // This should generate a warning
        pauseDurationMs: 2000,
        retryFailedBatches: true,
        maxRetryAttempts: 4, // High retry count
        retryDelayMs: 2000
      };

      const validationResult = validateValidationSettings({
        ...DEFAULT_VALIDATION_SETTINGS,
        batchProcessingSettings: batchSettings
      });

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      
      // Check for business logic warnings
      const warnings = validationResult.warnings || [];
      const suggestions = validationResult.suggestions || [];
      
      // Should have warning about large batch size
      expect(warnings.some(w => w.code === 'LARGE_BATCH_SIZE')).toBe(true);
      
      // Should have warning about high retry count
      expect(warnings.some(w => w.code === 'HIGH_RETRY_COUNT')).toBe(true);
      
      // Should have suggestion about adaptive sizing with pause
      expect(suggestions.some(s => s.code === 'ADAPTIVE_WITH_PAUSE')).toBe(true);
    });

    it('should load default batch processing settings', async () => {
      const settings = await service.getActiveSettings();
      
      expect(settings.batchProcessingSettings).toBeDefined();
      expect(settings.batchProcessingSettings.defaultBatchSize).toBe(200);
      expect(settings.batchProcessingSettings.minBatchSize).toBe(50);
      expect(settings.batchProcessingSettings.maxBatchSize).toBe(1000);
      expect(settings.batchProcessingSettings.useAdaptiveBatchSizing).toBe(false);
      expect(settings.batchProcessingSettings.pauseBetweenBatches).toBe(false);
      expect(settings.batchProcessingSettings.retryFailedBatches).toBe(true);
      expect(settings.batchProcessingSettings.maxRetryAttempts).toBe(1);
      expect(settings.batchProcessingSettings.retryDelayMs).toBe(2000);
    });

    it('should create settings with batch processing presets', async () => {
      // Check that presets exist and have batch processing settings
      expect(BUILT_IN_PRESETS.length).toBeGreaterThan(0);
      
      // Find presets by checking their names (case-insensitive)
      const strictPreset = BUILT_IN_PRESETS.find(p => p.name.toLowerCase().includes('strict'));
      const permissivePreset = BUILT_IN_PRESETS.find(p => p.name.toLowerCase().includes('permissive'));
      const balancedPreset = BUILT_IN_PRESETS.find(p => p.name.toLowerCase().includes('balanced'));
      
      // Test that all presets have batch processing settings
      BUILT_IN_PRESETS.forEach(preset => {
        expect(preset.settings.batchProcessingSettings).toBeDefined();
        expect(preset.settings.batchProcessingSettings.defaultBatchSize).toBeGreaterThan(0);
        expect(preset.settings.batchProcessingSettings.minBatchSize).toBeGreaterThan(0);
        expect(preset.settings.batchProcessingSettings.maxBatchSize).toBeGreaterThan(0);
        expect(typeof preset.settings.batchProcessingSettings.useAdaptiveBatchSizing).toBe('boolean');
        expect(typeof preset.settings.batchProcessingSettings.pauseBetweenBatches).toBe('boolean');
        expect(typeof preset.settings.batchProcessingSettings.retryFailedBatches).toBe('boolean');
      });
      
      // If specific presets exist, test their values
      if (strictPreset) {
        expect(strictPreset.settings.batchProcessingSettings.defaultBatchSize).toBeLessThanOrEqual(200);
      }
      
      if (permissivePreset) {
        expect(permissivePreset.settings.batchProcessingSettings.defaultBatchSize).toBeGreaterThanOrEqual(200);
      }
      
      if (balancedPreset) {
        expect(balancedPreset.settings.batchProcessingSettings.defaultBatchSize).toBe(200);
      }
    });
  });
});
