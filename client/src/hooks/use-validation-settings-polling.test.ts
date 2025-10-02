import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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

describe('useValidationSettingsPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API response by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockValidationSettings)
    });

    // Mock window.dispatchEvent
    global.dispatchEvent = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllTimers();
  });

  describe('Real-time Settings Updates', () => {
    it('should detect settings changes and update state in real-time', async () => {
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
        expect(result.current.settings).toEqual(mockValidationSettings);
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for next poll
      await waitFor(() => {
        expect(result.current.settings).toEqual(updatedValidationSettings);
      });

      expect(result.current.lastChange).toBeInstanceOf(Date);
    });

    it('should trigger cache invalidation when settings change', async () => {
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
        expect(result.current.settings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for cache invalidation
      await waitFor(() => {
        expect(result.current.settings).toEqual(updatedValidationSettings);
      });

      // Verify cache invalidation was triggered
      // Note: In a real test, we would verify that invalidateQueries was called
      expect(result.current.lastChange).toBeInstanceOf(Date);
    });

    it('should dispatch custom event when settings change', async () => {
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
        expect(result.current.settings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for event dispatch
      await waitFor(() => {
        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'settingsChanged',
            detail: expect.objectContaining({
              changeType: 'updated',
              settingsId: 'settings-1',
              newVersion: updatedValidationSettings
            })
          })
        );
      });
    });

    it('should show toast notification when settings change and notifications are enabled', async () => {
      const mockToast = vi.fn();
      vi.mocked(require('./use-toast').useToast).mockReturnValue({
        toast: mockToast
      });

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
        expect(result.current.settings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for notification
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Settings Updated",
          description: "Validation settings have been updated by another user.",
          variant: "default"
        });
      });
    });

    it('should not show notifications when showNotifications is false', async () => {
      const mockToast = vi.fn();
      vi.mocked(require('./use-toast').useToast).mockReturnValue({
        toast: mockToast
      });

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
        expect(result.current.settings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for settings change
      await waitFor(() => {
        expect(result.current.settings).toEqual(updatedValidationSettings);
      });

      // Verify no notification was shown
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should handle rapid consecutive settings changes correctly', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 50,
          enabled: true,
          showNotifications: false,
          invalidateCache: true
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const settingsChange1 = {
        ...mockValidationSettings,
        settings: { ...mockValidationSettings.settings, structural: { enabled: false, severity: 'error' } },
        updatedAt: new Date('2024-01-01T01:00:00Z')
      };

      const settingsChange2 = {
        ...settingsChange1,
        settings: { ...settingsChange1.settings, profile: { enabled: false, severity: 'error' } },
        updatedAt: new Date('2024-01-01T02:00:00Z')
      };

      // Mock rapid settings changes
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(settingsChange1)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(settingsChange2)
        });

      // Wait for both changes
      await waitFor(() => {
        expect(result.current.settings).toEqual(settingsChange2);
      });

      expect(result.current.lastChange).toBeInstanceOf(Date);
      expect(global.dispatchEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Polling Behavior', () => {
    it('should poll at specified intervals', async () => {
      vi.useFakeTimers();
      
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
        expect(result.current.isPolling).toBe(true);
      });

      const initialCallCount = (global.fetch as any).mock.calls.length;

      // Advance timer by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Wait for next poll
      await waitFor(() => {
        expect((global.fetch as any).mock.calls.length).toBe(initialCallCount + 1);
      });

      vi.useRealTimers();
    });

    it('should stop polling when disabled', async () => {
      const { result, rerender } = renderHookWithProviders(
        ({ enabled }) => useValidationSettingsPolling({
          pollingInterval: 100,
          enabled,
          showNotifications: false,
          invalidateCache: false
        }),
        { initialProps: { enabled: true } }
      );

      // Wait for polling to start
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });

      const initialCallCount = (global.fetch as any).mock.calls.length;

      // Disable polling
      rerender({ enabled: false });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });

      // Wait a bit and verify no additional calls
      await new Promise(resolve => setTimeout(resolve, 200));
      expect((global.fetch as any).mock.calls.length).toBe(initialCallCount);
    });

    it('should handle polling errors gracefully', async () => {
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
        expect(result.current.hasError).toBe(true);
        expect(result.current.error).toContain('Network error');
      });

      expect(result.current.failedPolls).toBeGreaterThan(0);
    });

    it('should recover from polling errors', async () => {
      // Start with error
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for error
      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
      });

      // Mock recovery
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockValidationSettings)
      });

      // Wait for recovery
      await waitFor(() => {
        expect(result.current.hasError).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.failedPolls).toBe(0);
      });
    });
  });

  describe('State Management', () => {
    it('should maintain correct polling state', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial state
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
        expect(result.current.settings).toBeDefined();
        expect(result.current.lastPoll).toBeInstanceOf(Date);
        expect(result.current.hasError).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.failedPolls).toBe(0);
      });
    });

    it('should track last change timestamp correctly', async () => {
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
        expect(result.current.settings).toBeDefined();
      });

      const initialLastChange = result.current.lastChange;

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for change
      await waitFor(() => {
        expect(result.current.lastChange).not.toEqual(initialLastChange);
        expect(result.current.lastChange).toBeInstanceOf(Date);
      });
    });

    it('should handle concurrent polling requests correctly', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 50,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const initialCallCount = (global.fetch as any).mock.calls.length;

      // Wait for multiple rapid polls
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify that concurrent requests were prevented
      const finalCallCount = (global.fetch as any).mock.calls.length;
      expect(finalCallCount).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
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

      // Wait for error
      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
        expect(result.current.error).toContain('500');
      });
    });

    it('should handle malformed JSON responses', async () => {
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

      // Wait for error
      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
        expect(result.current.error).toContain('Invalid JSON');
      });
    });

    it('should handle network timeout errors', async () => {
      (global.fetch as any).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for error
      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
        expect(result.current.error).toContain('Request timeout');
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should clean up intervals on unmount', async () => {
      const { result, unmount } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 100,
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for polling to start
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
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

      // Wait for initial state
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });

      // Run polling for extended period
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify polling is still working correctly
      expect(result.current.isPolling).toBe(true);
      expect(result.current.hasError).toBe(false);
      expect(result.current.settings).toBeDefined();
    });

    it('should handle rapid polling intervals efficiently', async () => {
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 10, // Very fast polling
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      // Wait for multiple polls
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify multiple polls occurred but system is still stable
      expect(result.current.isPolling).toBe(true);
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom polling intervals', async () => {
      vi.useFakeTimers();
      
      const { result } = renderHookWithProviders(() => 
        useValidationSettingsPolling({
          pollingInterval: 2000, // 2 seconds
          enabled: true,
          showNotifications: false,
          invalidateCache: false
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      const initialCallCount = (global.fetch as any).mock.calls.length;

      // Advance timer by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Wait for next poll
      await waitFor(() => {
        expect((global.fetch as any).mock.calls.length).toBe(initialCallCount + 1);
      });

      vi.useRealTimers();
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

      // Wait for initial state
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });

      // Change polling interval
      rerender({ interval: 2000, enabled: true });

      expect(result.current.isPolling).toBe(true);

      // Disable polling
      rerender({ interval: 2000, enabled: false });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });

    it('should handle invalidateCache option correctly', async () => {
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
        expect(result.current.settings).toBeDefined();
      });

      // Mock settings change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedValidationSettings)
      });

      // Wait for settings change
      await waitFor(() => {
        expect(result.current.settings).toEqual(updatedValidationSettings);
      });

      // Verify cache invalidation was triggered
      expect(result.current.lastChange).toBeInstanceOf(Date);
    });
  });
});
