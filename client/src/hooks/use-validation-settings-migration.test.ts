/**
 * Unit Tests for Validation Settings Migration Hook
 * 
 * Tests the FHIR version migration functionality including:
 * - Automatic version detection
 * - Settings migration between R4 and R5
 * - Resource type adaptation
 * - Migration impact assessment
 * - User confirmation handling
 * - Error handling and rollback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationSettingsMigration } from './use-validation-settings-migration';
import type { ValidationSettings, FHIRVersion } from '@shared/validation-settings';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the toast hook
vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock the validation settings hook
vi.mock('./use-validation-settings', () => ({
  useValidationSettings: () => ({
    settings: DEFAULT_TEST_SETTINGS,
    updateSettings: vi.fn(),
    loading: false,
    error: null
  })
}));

// Default settings for testing
const DEFAULT_TEST_SETTINGS: ValidationSettings = {
  id: 1,
  serverId: 1,
  aspects: {
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRules: { enabled: true, severity: 'error' },
    metadata: { enabled: true, severity: 'error' }
  },
  performance: {
    maxConcurrent: 5,
    batchSize: 50
  },
  resourceTypes: {
    enabled: true,
    includedTypes: ['Patient', 'Observation', 'Encounter'],
    excludedTypes: ['Binary', 'OperationOutcome']
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test',
  updatedBy: 'test'
};

describe('useValidationSettingsMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Version Detection', () => {
    it('should detect R4 version from server', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: 'R4' })
      });

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.detectedVersion).toBe('R4');
      expect(result.current.isDetecting).toBe(false);
    });

    it('should detect R5 version from server', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: 'R5' })
      });

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.detectedVersion).toBe('R5');
      expect(result.current.isDetecting).toBe(false);
    });

    it('should handle version detection errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.detectedVersion).toBeNull();
      expect(result.current.isDetecting).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Migration Assessment', () => {
    it('should assess migration impact from R4 to R5', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          impact: {
            resourceTypes: {
              added: ['DeviceMetric', 'Substance', 'TestScript', 'ClinicalImpression'],
              removed: [],
              modified: []
            },
            settings: {
              compatible: true,
              warnings: ['Some resource types may have new validation rules in R5']
            }
          }
        })
      });

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.assessMigrationImpact('R4', 'R5');
      });

      expect(result.current.migrationImpact).toBeTruthy();
      expect(result.current.migrationImpact?.resourceTypes.added).toContain('DeviceMetric');
      expect(result.current.migrationImpact?.settings.compatible).toBe(true);
    });

    it('should assess migration impact from R5 to R4', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          impact: {
            resourceTypes: {
              added: [],
              removed: ['DeviceMetric', 'Substance', 'TestScript', 'ClinicalImpression'],
              modified: []
            },
            settings: {
              compatible: false,
              warnings: ['R5-specific resource types will be removed from settings']
            }
          }
        })
      });

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.assessMigrationImpact('R5', 'R4');
      });

      expect(result.current.migrationImpact).toBeTruthy();
      expect(result.current.migrationImpact?.resourceTypes.removed).toContain('DeviceMetric');
      expect(result.current.migrationImpact?.settings.compatible).toBe(false);
    });
  });

  describe('Settings Migration', () => {
    it('should migrate settings from R4 to R5', async () => {
      const migratedSettings = {
        ...DEFAULT_TEST_SETTINGS,
        resourceTypes: {
          enabled: true,
          includedTypes: ['Patient', 'Observation', 'Encounter', 'DeviceMetric'],
          excludedTypes: ['Binary', 'OperationOutcome']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => migratedSettings
      });

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.migrateSettings('R4', 'R5');
      });

      expect(result.current.isMigrating).toBe(false);
      expect(result.current.migrationResult).toBeTruthy();
      expect(result.current.migrationResult?.success).toBe(true);
    });

    it('should handle migration errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Migration failed'));

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.migrateSettings('R4', 'R5');
      });

      expect(result.current.isMigrating).toBe(false);
      expect(result.current.migrationResult?.success).toBe(false);
      expect(result.current.migrationResult?.error).toContain('Migration failed');
    });
  });

  describe('User Confirmation', () => {
    it('should handle user confirmation for migration', async () => {
      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        result.current.confirmMigration();
      });

      expect(result.current.userConfirmed).toBe(true);
    });

    it('should handle user cancellation of migration', async () => {
      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        result.current.cancelMigration();
      });

      expect(result.current.userConfirmed).toBe(false);
    });
  });

  describe('Automatic Migration', () => {
    it('should automatically migrate when version changes', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ version: 'R5' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            impact: {
              resourceTypes: { added: ['DeviceMetric'], removed: [], modified: [] },
              settings: { compatible: true, warnings: [] }
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...DEFAULT_TEST_SETTINGS,
            resourceTypes: {
              enabled: true,
              includedTypes: ['Patient', 'Observation', 'Encounter', 'DeviceMetric'],
              excludedTypes: ['Binary', 'OperationOutcome']
            }
          })
        });

      const { result } = renderHook(() => 
        useValidationSettingsMigration({ 
          serverId: 1, 
          autoMigrate: true,
          currentVersion: 'R4'
        })
      );

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.detectedVersion).toBe('R5');
      expect(result.current.isMigrating).toBe(false);
    });

    it('should not auto-migrate when disabled', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: 'R5' })
      });

      const { result } = renderHook(() => 
        useValidationSettingsMigration({ 
          serverId: 1, 
          autoMigrate: false,
          currentVersion: 'R4'
        })
      );

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.detectedVersion).toBe('R5');
      expect(result.current.isMigrating).toBe(false);
      expect(result.current.migrationResult).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isDetecting).toBe(false);
    });

    it('should handle invalid FHIR versions', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: 'INVALID' })
      });

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.detectedVersion).toBeNull();
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should reset state when server changes', async () => {
      const { result, rerender } = renderHook(
        ({ serverId }) => useValidationSettingsMigration({ serverId }),
        { initialProps: { serverId: 1 } }
      );

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.detectedVersion).toBeTruthy();

      rerender({ serverId: 2 });

      expect(result.current.detectedVersion).toBeNull();
      expect(result.current.migrationImpact).toBeNull();
      expect(result.current.migrationResult).toBeNull();
    });

    it('should clear error state on new operations', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useValidationSettingsMigration({ serverId: 1 }));

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.error).toBeTruthy();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: 'R4' })
      });

      await act(async () => {
        await result.current.detectFhirVersion();
      });

      expect(result.current.error).toBeNull();
    });
  });
});

