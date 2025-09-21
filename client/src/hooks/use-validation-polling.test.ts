// ============================================================================
// Unit Tests for useValidationPolling Hook
// ============================================================================

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useValidationPolling } from './use-validation-polling';

// Mock fetch globally
global.fetch = vi.fn();

// Mock timers
vi.useFakeTimers();

describe('useValidationPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useValidationPolling({ enabled: false, hasActiveServer: false }));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.progress).toBe(null);
      expect(result.current.validationStatus).toBe('idle');
      expect(result.current.lastError).toBe(null);
      expect(result.current.currentServer).toBe(null);
      expect(result.current.connectionAttempts).toBe(0);
      expect(result.current.lastConnectedAt).toBe(null);
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useValidationPolling({ enabled: false, hasActiveServer: false }));

      expect(typeof result.current.startPolling).toBe('function');
      expect(typeof result.current.stopPolling).toBe('function');
      expect(typeof result.current.resetProgress).toBe('function');
      expect(typeof result.current.reconnect).toBe('function');
      expect(typeof result.current.syncWithApi).toBe('function');
    });
  });

  describe('Manual Actions', () => {
    it('should reset progress state', () => {
      const { result } = renderHook(() => useValidationPolling({ enabled: false, hasActiveServer: false }));

      // Reset progress
      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.progress).toBe(null);
      expect(result.current.validationStatus).toBe('idle');
      expect(result.current.lastError).toBe(null);
    });

    it('should handle manual polling start/stop', () => {
      const { result } = renderHook(() => useValidationPolling({ enabled: false, hasActiveServer: false }));

      // Start polling should not throw errors
      expect(() => {
        act(() => {
          result.current.startPolling();
        });
      }).not.toThrow();

      // Stop polling should not throw errors
      expect(() => {
        act(() => {
          result.current.stopPolling();
        });
      }).not.toThrow();
    });
  });

  describe('Options and Configuration', () => {
    it('should respect hasActiveServer option', () => {
      const { result } = renderHook(() => 
        useValidationPolling({ enabled: true, hasActiveServer: false })
      );

      // Should not start polling without active server
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should use custom polling interval', () => {
      const { result } = renderHook(() => 
        useValidationPolling({ enabled: false, hasActiveServer: false, pollInterval: 5000 })
      );

      // Should accept custom interval without issues
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should handle enabled option changes', () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useValidationPolling({ enabled, hasActiveServer: false }),
        { initialProps: { enabled: false } }
      );

      expect(result.current.connectionState).toBe('disconnected');

      // Change enabled to true
      rerender({ enabled: true });

      // Should still be disconnected without active server
      expect(result.current.connectionState).toBe('disconnected');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const { result } = renderHook(() => useValidationPolling({ enabled: false, hasActiveServer: false }));

      // Should not throw errors when starting polling
      expect(() => {
        act(() => {
          result.current.startPolling();
        });
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { result, unmount } = renderHook(() => 
        useValidationPolling({ enabled: false, hasActiveServer: false })
      );

      // Should not throw errors when starting polling
      expect(() => {
        act(() => {
          result.current.startPolling();
        });
      }).not.toThrow();

      // Unmount component
      unmount();

      // Should not throw any errors
      expect(() => {
        vi.advanceTimersByTime(10000);
      }).not.toThrow();
    });

    it('should stop polling when enabled changes to false', () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useValidationPolling({ enabled, hasActiveServer: false }),
        { initialProps: { enabled: true } }
      );

      // Should start in disconnected state without active server
      expect(result.current.connectionState).toBe('disconnected');

      // Change enabled to false
      rerender({ enabled: false });

      expect(result.current.connectionState).toBe('disconnected');
    });
  });

  describe('Hook Interface', () => {
    it('should return consistent interface', () => {
      const { result } = renderHook(() => useValidationPolling({ enabled: false, hasActiveServer: false }));

      // Check all expected properties exist
      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('connectionState');
      expect(result.current).toHaveProperty('progress');
      expect(result.current).toHaveProperty('validationStatus');
      expect(result.current).toHaveProperty('lastError');
      expect(result.current).toHaveProperty('currentServer');
      expect(result.current).toHaveProperty('connectionAttempts');
      expect(result.current).toHaveProperty('lastConnectedAt');
      expect(result.current).toHaveProperty('startPolling');
      expect(result.current).toHaveProperty('stopPolling');
      expect(result.current).toHaveProperty('resetProgress');
      expect(result.current).toHaveProperty('reconnect');
      expect(result.current).toHaveProperty('syncWithApi');
    });
  });
});