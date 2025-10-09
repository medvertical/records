/**
 * Unit Tests for Validation Settings Hook - Simplified Implementation
 * 
 * Tests the simplified validation settings hook functionality including:
 * - Loading and saving settings
 * - Toggle aspects and severity changes
 * - Performance settings updates
 * - Resource type filtering
 * - FHIR version management
 * - Auto-save functionality
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationSettings } from './use-validation-settings';
import type { ValidationSettings } from '@shared/validation-settings';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the toast hook
vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
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
    includedTypes: [],
    excludedTypes: []
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test',
  updatedBy: 'test'
};

describe('useValidationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useValidationSettings());

      expect(result.current.settings).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.saving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load settings on mount', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.settings).toEqual(DEFAULT_TEST_SETTINGS);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Settings Updates', () => {
    it('should update aspect settings', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateSettings({
          aspects: {
            ...DEFAULT_TEST_SETTINGS.aspects,
            structural: { enabled: false, severity: 'warning' }
          }
        });
      });

      expect(result.current.settings?.aspects.structural.enabled).toBe(false);
      expect(result.current.settings?.aspects.structural.severity).toBe('warning');
    });

    it('should update performance settings', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateSettings({
          performance: {
            maxConcurrent: 10,
            batchSize: 100
          }
        });
      });

      expect(result.current.settings?.performance.maxConcurrent).toBe(10);
      expect(result.current.settings?.performance.batchSize).toBe(100);
    });

    it('should update resource type settings', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateSettings({
          resourceTypes: {
            enabled: true,
            includedTypes: ['Patient', 'Observation'],
            excludedTypes: ['Binary']
          }
        });
      });

      expect(result.current.settings?.resourceTypes.enabled).toBe(true);
      expect(result.current.settings?.resourceTypes.includedTypes).toEqual(['Patient', 'Observation']);
      expect(result.current.settings?.resourceTypes.excludedTypes).toEqual(['Binary']);
    });
  });

  describe('Validation', () => {
    it('should validate settings correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const isValid = await result.current.validateSettings(result.current.settings!);
      expect(isValid).toBe(true);
    });

    it('should reject invalid settings', async () => {
      const { result } = renderHook(() => useValidationSettings());

      const invalidSettings = {
        ...DEFAULT_TEST_SETTINGS,
        aspects: {
          ...DEFAULT_TEST_SETTINGS.aspects,
          structural: { enabled: true, severity: 'invalid' as any }
        }
      };

      const isValid = await result.current.validateSettings(invalidSettings);
      expect(isValid).toBe(false);
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset settings to defaults', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.resetToDefaults();
      });

      expect(result.current.settings?.aspects.structural.enabled).toBe(true);
      expect(result.current.settings?.performance.maxConcurrent).toBe(5);
      expect(result.current.settings?.performance.batchSize).toBe(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle loading errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });

    it('should handle save errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => useValidationSettings({ serverId: 1 }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      (global.fetch as any).mockRejectedValueOnce(new Error('Save error'));

      await act(async () => {
        await result.current.updateSettings({
          performance: { maxConcurrent: 10, batchSize: 100 }
        });
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Auto-save', () => {
    it('should auto-save when enabled', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => DEFAULT_TEST_SETTINGS
      });

      const { result } = renderHook(() => 
        useValidationSettings({ serverId: 1, autoSave: true, autoSaveDelay: 100 })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updateSettings({
          performance: { maxConcurrent: 10, batchSize: 100 }
        });
      });

      // Wait for auto-save
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial load + auto-save
    });
  });
});

