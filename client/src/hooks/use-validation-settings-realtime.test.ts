/**
 * Unit Tests for Validation Settings Real-time Functionality
 * 
 * Tests the real-time settings change detection and UI recalculation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useValidationSettingsRealTime } from './use-validation-settings-realtime';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the toast hook
vi.mock('./use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock the validation settings polling hook
vi.mock('./use-validation-settings-polling', () => ({
  useValidationSettingsPolling: () => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn()
  })
}));

// Mock EventTarget for custom events
global.EventTarget = class MockEventTarget {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
} as any;

describe('useValidationSettingsRealTime', () => {
  let queryClient: QueryClient;
  let mockFetch: any;
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ isValid: true, errors: [], warnings: [] })
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderHookWithProvider = () => {
    return renderHook(() => useValidationSettingsRealTime(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    });
  };

  describe('Event Listener Management', () => {
    it('should add settingsChanged event listener on mount', () => {
      renderHookWithProvider();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'settingsChanged',
        expect.any(Function)
      );
    });

    it('should remove settingsChanged event listener on unmount', () => {
      const { unmount } = renderHookWithProvider();

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'settingsChanged',
        expect.any(Function)
      );
    });
  });

  describe('Settings Change Detection', () => {
    it('should detect settingsChanged events and update state', async () => {
      const { result } = renderHookWithProvider();

      // Simulate a settingsChanged event
      const mockEvent = new CustomEvent('settingsChanged', {
        detail: {
          settings: { structural: { enabled: true, severity: 'error' } },
          timestamp: Date.now(),
          validationResult: { isValid: true, errors: [], warnings: [] }
        }
      });

      // Get the event handler that was registered
      const eventHandler = addEventListenerSpy.mock.calls[0][1];
      
      // Trigger the event handler
      act(() => {
        eventHandler(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.lastSettingsChange).toBeDefined();
        expect(result.current.lastSettingsChange?.timestamp).toBe(mockEvent.detail.timestamp);
      });
    });

    it('should handle multiple settings changes', async () => {
      const { result } = renderHookWithProvider();

      const eventHandler = addEventListenerSpy.mock.calls[0][1];

      // First settings change
      const firstEvent = new CustomEvent('settingsChanged', {
        detail: {
          settings: { structural: { enabled: true, severity: 'error' } },
          timestamp: Date.now(),
          validationResult: { isValid: true, errors: [], warnings: [] }
        }
      });

      act(() => {
        eventHandler(firstEvent);
      });

      await waitFor(() => {
        expect(result.current.lastSettingsChange?.timestamp).toBe(firstEvent.detail.timestamp);
      });

      // Second settings change
      const secondEvent = new CustomEvent('settingsChanged', {
        detail: {
          settings: { structural: { enabled: false, severity: 'warning' } },
          timestamp: Date.now() + 1000,
          validationResult: { isValid: true, errors: [], warnings: [] }
        }
      });

      act(() => {
        eventHandler(secondEvent);
      });

      await waitFor(() => {
        expect(result.current.lastSettingsChange?.timestamp).toBe(secondEvent.detail.timestamp);
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should provide real-time settings change information', () => {
      const { result } = renderHookWithProvider();

      expect(result.current.hasRecentSettingsChange).toBeDefined();
      expect(typeof result.current.hasRecentSettingsChange).toBe('function');
    });

    it('should correctly identify recent settings changes', async () => {
      const { result } = renderHookWithProvider();

      const eventHandler = addEventListenerSpy.mock.calls[0][1];

      // Trigger a settings change
      const mockEvent = new CustomEvent('settingsChanged', {
        detail: {
          settings: { structural: { enabled: true, severity: 'error' } },
          timestamp: Date.now(),
          validationResult: { isValid: true, errors: [], warnings: [] }
        }
      });

      act(() => {
        eventHandler(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.hasRecentSettingsChange(5000)).toBe(true);
        expect(result.current.hasRecentSettingsChange(100)).toBe(true);
      });
    });

    it('should correctly identify old settings changes', async () => {
      const { result } = renderHookWithProvider();

      const eventHandler = addEventListenerSpy.mock.calls[0][1];

      // Trigger a settings change with old timestamp
      const mockEvent = new CustomEvent('settingsChanged', {
        detail: {
          settings: { structural: { enabled: true, severity: 'error' } },
          timestamp: Date.now() - 10000, // 10 seconds ago
          validationResult: { isValid: true, errors: [], warnings: [] }
        }
      });

      act(() => {
        eventHandler(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.hasRecentSettingsChange(5000)).toBe(false);
        expect(result.current.hasRecentSettingsChange(15000)).toBe(true);
      });
    });
  });

  describe('Integration with Query Client', () => {
    it('should invalidate validation settings queries on settings change', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      
      renderHookWithProvider();

      const eventHandler = addEventListenerSpy.mock.calls[0][1];

      // Trigger a settings change
      const mockEvent = new CustomEvent('settingsChanged', {
        detail: {
          settings: { structural: { enabled: true, severity: 'error' } },
          timestamp: Date.now(),
          validationResult: { isValid: true, errors: [], warnings: [] }
        }
      });

      act(() => {
        eventHandler(mockEvent);
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ['validation-settings']
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed settingsChanged events gracefully', async () => {
      const { result } = renderHookWithProvider();

      const eventHandler = addEventListenerSpy.mock.calls[0][1];

      // Trigger a malformed event
      const malformedEvent = new CustomEvent('settingsChanged', {
        detail: null
      });

      // Should not throw an error
      expect(() => {
        act(() => {
          eventHandler(malformedEvent);
        });
      }).not.toThrow();

      await waitFor(() => {
        expect(result.current.lastSettingsChange).toBeNull();
      });
    });

    it('should handle events without detail gracefully', async () => {
      const { result } = renderHookWithProvider();

      const eventHandler = addEventListenerSpy.mock.calls[0][1];

      // Trigger an event without detail
      const eventWithoutDetail = new CustomEvent('settingsChanged');

      // Should not throw an error
      expect(() => {
        act(() => {
          eventHandler(eventWithoutDetail);
        });
      }).not.toThrow();

      await waitFor(() => {
        expect(result.current.lastSettingsChange).toBeNull();
      });
    });
  });
});
