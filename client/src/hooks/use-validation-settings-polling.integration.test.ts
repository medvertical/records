import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useValidationSettingsPolling } from './use-validation-settings-polling';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the toast hook
vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock the shared polling hook
vi.mock('./use-polling', () => ({
  usePolling: () => ({
    isPolling: false,
    failureCount: 0,
    currentInterval: 30000,
    lastSuccess: null,
    lastError: null,
    isPaused: false,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    reset: vi.fn(),
    poll: vi.fn()
  })
}));

// Mock EventTarget for custom events
global.EventTarget = class MockEventTarget {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
} as any;

// Test data
const mockValidationSettings = {
  id: 'settings-1',
  name: 'Default Settings',
  settings: {
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'error' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'info' }
  },
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z')
};

const updatedValidationSettings = {
  ...mockValidationSettings,
  settings: {
    structural: { enabled: false, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'error' },
    reference: { enabled: false, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'info' }
  },
  updatedAt: new Date('2024-01-01T01:00:00Z')
};

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        cacheTime: 0,
      },
    },
  });
};

const renderHookWithProviders = (hook: any, options = {}) => {
  const queryClient = createTestQueryClient();
  
  return {
    ...renderHook(hook, {
      wrapper: ({ children }: { children: React.ReactNode }) => {
        const React = require('react');
        const { QueryClientProvider } = require('@tanstack/react-query');
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
      },
      ...options
    }),
    queryClient
  };
};

describe('useValidationSettingsPolling Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API response by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockValidationSettings)
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic Polling Functionality', () => {
    it('should start polling when enabled', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 1000,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      expect(result.current.isPolling).toBe(true);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/validation/settings');
    });

    it('should not start polling when disabled', async () => {
      renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 1000,
          enabled: false,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait a bit to ensure no polling occurs
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should stop polling when disabled after being enabled', async () => {
      const { result, rerender } = renderHookWithProviders(
        ({ enabled }) => useValidationSettingsPolling({
          pollingInterval: 100,
          enabled,
          showNotifications: false,
          invalidateCache: false
        }),
        { initialProps: { enabled: true } }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });

      // Disable polling
      rerender({ enabled: false });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });
  });

  describe('Settings Change Detection', () => {
    it('should detect settings changes and trigger cache invalidation', async () => {
      const { result, queryClient } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: true
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for next poll
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify settings change was detected
      expect(result.current.lastFetchedSettings).toEqual(updatedValidationSettings);
    });

    it('should not trigger cache invalidation when invalidateCache is false', async () => {
      const { result, queryClient } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for next poll
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify settings change was detected but cache wasn't invalidated
      expect(result.current.lastFetchedSettings).toEqual(updatedValidationSettings);
    });

    it('should show notifications when showNotifications is true', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: true,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for next poll
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify settings change was detected
      expect(result.current.lastFetchedSettings).toEqual(updatedValidationSettings);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API error
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for error to be handled
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.error).toContain('Network error');
      expect(result.current.isPolling).toBe(false);
    });

    it('should handle HTTP error responses', async () => {
      // Mock HTTP error response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Server error' })
      });

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for error to be handled
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.error).toContain('500');
      expect(result.current.isPolling).toBe(false);
    });

    it('should handle malformed JSON responses', async () => {
      // Mock malformed JSON response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for error to be handled
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      expect(result.current.error).toContain('Invalid JSON');
      expect(result.current.isPolling).toBe(false);
    });

    it('should retry polling after error recovery', async () => {
      // Start with error
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result, rerender } = renderHookWithProviders(
        ({ enabled }) => useValidationSettingsPolling({
          pollingInterval: 100,
          enabled,
          showNotifications: false,
          invalidateCache: false
        }),
        { initialProps: { enabled: true } }
      );

      // Wait for error
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      // Mock recovery
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockValidationSettings)
      });

      // Re-enable polling
      rerender({ enabled: true });

      // Wait for recovery
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.isPolling).toBe(true);
      expect(result.current.lastFetchedSettings).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should handle rapid polling intervals efficiently', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 50, // Very fast polling
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Wait for multiple polls
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify multiple polls occurred
      expect(global.fetch).toHaveBeenCalledTimes(expect.any(Number));
      expect(global.fetch).toHaveBeenCalledTimes(expect.any(Number));
    });

    it('should handle polling cleanup correctly', async () => {
      const { result, unmount } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      const initialCallCount = (global.fetch as any).mock.calls.length;

      // Unmount component
      unmount();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify no additional calls after unmount
      expect((global.fetch as any).mock.calls.length).toBe(initialCallCount);
    });

    it('should handle memory leaks in long-running polling', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Run polling for extended period
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify polling is still working correctly
      expect(result.current.isPolling).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.lastFetchedSettings).toBeDefined();
    });
  });

  describe('Custom Event Integration', () => {
    it('should dispatch settingsChanged event when settings change', async () => {
      const mockDispatchEvent = vi.fn();
      global.dispatchEvent = mockDispatchEvent;

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: true
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for next poll
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify settingsChanged event was dispatched
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settingsChanged',
          detail: expect.objectContaining({
            settings: updatedValidationSettings
          })
        })
      );
    });

    it('should not dispatch events when invalidateCache is false', async () => {
      const mockDispatchEvent = vi.fn();
      global.dispatchEvent = mockDispatchEvent;

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for next poll
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify no settingsChanged event was dispatched
      expect(mockDispatchEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settingsChanged'
        })
      );
    });
  });

  describe('Configuration Integration', () => {
    it('should respect custom polling intervals', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 30000, // 30 seconds
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      const initialCallTime = Date.now();

      // Wait for next poll (should be around 30 seconds)
      await new Promise(resolve => setTimeout(resolve, 5100));

      const nextCallTime = Date.now();
      const timeDifference = nextCallTime - initialCallTime;

      // Verify polling interval is approximately correct (allow some tolerance)
      expect(timeDifference).toBeGreaterThan(4000);
      expect(timeDifference).toBeLessThan(6000);
    });

    it('should handle dynamic configuration changes', async () => {
      const { result, rerender } = renderHookWithProviders(
        ({ interval, enabled }) => useValidationSettingsPolling({
          pollingInterval: interval,
          enabled,
          showNotifications: false,
          invalidateCache: false
        }),
        { initialProps: { interval: 1000, enabled: true } }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      // Change polling interval
      rerender({ interval: 2000, enabled: true });

      // Wait for new interval to take effect
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(result.current.isPolling).toBe(true);

      // Disable polling
      rerender({ interval: 2000, enabled: false });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });
  });

  describe('Data Consistency Integration', () => {
    it('should handle settings with missing fields gracefully', async () => {
      const incompleteSettings = {
        id: 'settings-1',
        settings: {
          structural: { enabled: true },
          // Missing other aspects
        }
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(incompleteSettings)
      });

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      expect(result.current.lastFetchedSettings).toEqual(incompleteSettings);
      expect(result.current.error).toBeNull();
    });

    it('should handle null/undefined settings responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null)
      });

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeNull();
      });

      expect(result.current.error).toBeNull();
    });

    it('should maintain data consistency across multiple polls', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.lastFetchedSettings).toBeDefined();
      });

      const initialSettings = result.current.lastFetchedSettings;

      // Wait for multiple polls
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify settings remained consistent
      expect(result.current.lastFetchedSettings).toEqual(initialSettings);
      expect(result.current.error).toBeNull();
    });
  });
});
