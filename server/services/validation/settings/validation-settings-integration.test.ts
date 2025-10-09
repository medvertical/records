/**
 * Integration Tests for Validation Settings
 * 
 * Tests persistence, event emission, and service integration
 */

import { ValidationSettingsService } from './validation-settings-service';
import { ValidationSettingsRepository } from '../../../repositories/validation-settings-repository-simplified';
import { DEFAULT_VALIDATION_SETTINGS } from '@shared/validation-settings';
import type { ValidationSettings, ValidationSettingsUpdate } from '@shared/validation-settings';

// Mock the repository
jest.mock('../../../repositories/validation-settings-repository-simplified');

describe('ValidationSettingsService Integration', () => {
  let service: ValidationSettingsService;
  let mockRepository: jest.Mocked<ValidationSettingsRepository>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock repository
    mockRepository = {
      getActiveSettings: jest.fn(),
      createOrUpdate: jest.fn(),
      getSettingsStatistics: jest.fn(),
      getHealthStatus: jest.fn()
    } as any;

    // Mock the repository constructor
    (ValidationSettingsRepository as jest.MockedClass<typeof ValidationSettingsRepository>).mockImplementation(() => mockRepository);

    service = new ValidationSettingsService();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('Persistence Integration', () => {
    it('should persist settings to database on update', async () => {
      await service.initialize();
      
      const update: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: false, severity: 'warning' }
          }
        }
      };

      const expectedSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: {
          ...DEFAULT_VALIDATION_SETTINGS.aspects,
          structural: { enabled: false, severity: 'warning' }
        }
      };

      mockRepository.createOrUpdate.mockResolvedValue(expectedSettings);

      const result = await service.updateSettings(update);

      expect(mockRepository.createOrUpdate).toHaveBeenCalledWith(expectedSettings);
      expect(result).toEqual(expectedSettings);
    });

    it('should load settings from database on initialization', async () => {
      const savedSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: {
          ...DEFAULT_VALIDATION_SETTINGS.aspects,
          structural: { enabled: false, severity: 'warning' }
        }
      };

      mockRepository.getActiveSettings.mockResolvedValue(savedSettings);

      await service.initialize();
      const settings = await service.getCurrentSettings();

      expect(mockRepository.getActiveSettings).toHaveBeenCalled();
      expect(settings).toEqual(savedSettings);
    });

    it('should fallback to defaults when database is unavailable', async () => {
      mockRepository.getActiveSettings.mockRejectedValue(new Error('Database unavailable'));

      await service.initialize();
      const settings = await service.getCurrentSettings();

      expect(settings).toEqual(DEFAULT_VALIDATION_SETTINGS);
    });

    it('should persist reset settings to database', async () => {
      await service.initialize();
      
      mockRepository.createOrUpdate.mockResolvedValue(DEFAULT_VALIDATION_SETTINGS);

      const result = await service.resetToDefaults();

      expect(mockRepository.createOrUpdate).toHaveBeenCalledWith(DEFAULT_VALIDATION_SETTINGS);
      expect(result).toEqual(DEFAULT_VALIDATION_SETTINGS);
    });
  });

  describe('Event Emission Integration', () => {
    it('should emit events in correct order during update', async () => {
      await service.initialize();
      
      const events: any[] = [];
      service.on('settingsChanged', (event) => events.push({ type: 'settingsChanged', data: event }));
      service.on('updateError', (event) => events.push({ type: 'updateError', data: event }));

      const update: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: false, severity: 'warning' }
          }
        }
      };

      const expectedSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: {
          ...DEFAULT_VALIDATION_SETTINGS.aspects,
          structural: { enabled: false, severity: 'warning' }
        }
      };

      mockRepository.createOrUpdate.mockResolvedValue(expectedSettings);

      await service.updateSettings(update);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('settingsChanged');
      expect(events[0].data).toEqual({
        type: 'updated',
        data: expectedSettings
      });
    });

    it('should emit error events on persistence failure', async () => {
      await service.initialize();
      
      const events: any[] = [];
      service.on('updateError', (event) => events.push({ type: 'updateError', data: event }));

      const update: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: false, severity: 'warning' }
          }
        }
      };

      mockRepository.createOrUpdate.mockRejectedValue(new Error('Database error'));

      await expect(service.updateSettings(update)).rejects.toThrow('Database error');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('updateError');
    });

    it('should emit reset events on settings reset', async () => {
      await service.initialize();
      
      const events: any[] = [];
      service.on('settingsReset', (event) => events.push({ type: 'settingsReset', data: event }));

      mockRepository.createOrUpdate.mockResolvedValue(DEFAULT_VALIDATION_SETTINGS);

      await service.resetToDefaults();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('settingsReset');
      expect(events[0].data).toEqual({
        newSettings: DEFAULT_VALIDATION_SETTINGS
      });
    });
  });

  describe('Cache Integration', () => {
    it('should use cache for repeated requests', async () => {
      await service.initialize();
      
      const savedSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: {
          ...DEFAULT_VALIDATION_SETTINGS.aspects,
          structural: { enabled: false, severity: 'warning' }
        }
      };

      mockRepository.getActiveSettings.mockResolvedValue(savedSettings);

      // First call should hit database
      const settings1 = await service.getCurrentSettings();
      expect(mockRepository.getActiveSettings).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const settings2 = await service.getCurrentSettings();
      expect(mockRepository.getActiveSettings).toHaveBeenCalledTimes(1);
      expect(settings1).toEqual(settings2);
    });

    it('should invalidate cache on update', async () => {
      await service.initialize();
      
      const update: ValidationSettingsUpdate = {
        settings: {
          aspects: {
            structural: { enabled: false, severity: 'warning' }
          }
        }
      };

      const expectedSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: {
          ...DEFAULT_VALIDATION_SETTINGS.aspects,
          structural: { enabled: false, severity: 'warning' }
        }
      };

      mockRepository.createOrUpdate.mockResolvedValue(expectedSettings);

      await service.updateSettings(update);

      // Cache should be updated with new settings
      const cachedSettings = await service.getCurrentSettings();
      expect(cachedSettings).toEqual(expectedSettings);
    });

    it('should clear cache on explicit clear', async () => {
      await service.initialize();
      
      const events: any[] = [];
      service.on('cacheCleared', (event) => events.push({ type: 'cacheCleared', data: event }));

      service.clearCache();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('cacheCleared');
    });
  });

  describe('Service Health Integration', () => {
    it('should report healthy status when repository is available', async () => {
      await service.initialize();
      
      mockRepository.getHealthStatus.mockResolvedValue({ healthy: true });

      const health = await service.getHealthStatus();

      expect(mockRepository.getHealthStatus).toHaveBeenCalled();
      expect(health).toEqual({ healthy: true });
    });

    it('should report statistics from repository', async () => {
      await service.initialize();
      
      const mockStats = {
        totalSettings: 1,
        lastUpdated: new Date(),
        cacheHits: 5,
        cacheMisses: 2
      };

      mockRepository.getSettingsStatistics.mockResolvedValue(mockStats);

      const stats = await service.getSettingsStatistics();

      expect(mockRepository.getSettingsStatistics).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });
  });

  describe('Preset Integration', () => {
    it('should apply preset and persist to database', async () => {
      await service.initialize();
      
      const strictPresetSettings = {
        ...DEFAULT_VALIDATION_SETTINGS,
        aspects: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: true, severity: 'error' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'error' },
          metadata: { enabled: true, severity: 'error' }
        }
      };

      mockRepository.createOrUpdate.mockResolvedValue(strictPresetSettings);

      const result = await service.applyPreset('strict');

      expect(mockRepository.createOrUpdate).toHaveBeenCalledWith(strictPresetSettings);
      expect(result).toEqual(strictPresetSettings);
    });
  });
});

