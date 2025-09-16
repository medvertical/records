// ============================================================================
// SSE Validation Hook Tests
// ============================================================================

import { renderHook, act, waitFor } from '@testing-library/react';
import { useValidationSSE, ValidationProgress, SSEMessage } from './use-validation-sse';

// Mock EventSource
class MockEventSource {
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public readyState: number = 0;
  public url: string;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
  }

  close() {
    this.readyState = 3; // CLOSED
  }

  // Helper methods for testing
  simulateOpen() {
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      const event = new MessageEvent('message', { data: JSON.stringify(data) });
      this.onmessage(event);
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Mock global EventSource
global.EventSource = MockEventSource as any;

// Mock fetch
global.fetch = jest.fn();

describe('useValidationSSE', () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventSource = new MockEventSource('/api/validation/stream');
    (global.EventSource as any) = jest.fn(() => mockEventSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should establish SSE connection on mount', () => {
      const { result } = renderHook(() => useValidationSSE());

      expect(global.EventSource).toHaveBeenCalledWith('/api/validation/stream');
      expect(result.current.isConnected).toBe(false);
    });

    it('should set connected state when SSE opens', async () => {
      const { result } = renderHook(() => useValidationSSE());

      act(() => {
        mockEventSource.simulateOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('should handle SSE connection errors', async () => {
      const { result } = renderHook(() => useValidationSSE());

      act(() => {
        mockEventSource.simulateError();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.lastError).toBe('SSE connection error');
      });
    });

    it('should close SSE connection on unmount', () => {
      const closeSpy = jest.spyOn(mockEventSource, 'close');
      const { unmount } = renderHook(() => useValidationSSE());

      unmount();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should handle connected message', async () => {
      const { result } = renderHook(() => useValidationSSE());

      const connectedMessage: SSEMessage = {
        type: 'connected',
        data: { message: 'Connected to validation stream' }
      };

      act(() => {
        mockEventSource.simulateMessage(connectedMessage);
      });

      // Should not throw errors and should handle the message gracefully
      expect(result.current.isConnected).toBe(false); // Still false until onopen
    });

    it('should handle validation progress message', async () => {
      const { result } = renderHook(() => useValidationSSE());

      const progressData: ValidationProgress = {
        totalResources: 1000,
        processedResources: 100,
        validResources: 95,
        errorResources: 5,
        startTime: '2025-01-16T14:00:00.000Z',
        isComplete: false,
        errors: [],
        status: 'running'
      };

      const progressMessage: SSEMessage = {
        type: 'validation-progress',
        data: progressData
      };

      act(() => {
        mockEventSource.simulateMessage(progressMessage);
      });

      await waitFor(() => {
        expect(result.current.progress).toEqual(progressData);
        expect(result.current.validationStatus).toBe('running');
      });
    });

    it('should handle validation started message', async () => {
      const { result } = renderHook(() => useValidationSSE());

      const startedMessage: SSEMessage = {
        type: 'validation-started',
        data: { message: 'Validation started' }
      };

      act(() => {
        mockEventSource.simulateMessage(startedMessage);
      });

      await waitFor(() => {
        expect(result.current.validationStatus).toBe('running');
      });
    });

    it('should handle validation completed message', async () => {
      const { result } = renderHook(() => useValidationSSE());

      const completedMessage: SSEMessage = {
        type: 'validation-completed',
        data: { message: 'Validation completed' }
      };

      act(() => {
        mockEventSource.simulateMessage(completedMessage);
      });

      await waitFor(() => {
        expect(result.current.validationStatus).toBe('completed');
      });
    });

    it('should handle validation error message', async () => {
      const { result } = renderHook(() => useValidationSSE());

      const errorMessage: SSEMessage = {
        type: 'validation-error',
        data: { error: 'Validation failed' }
      };

      act(() => {
        mockEventSource.simulateMessage(errorMessage);
      });

      await waitFor(() => {
        expect(result.current.validationStatus).toBe('error');
        expect(result.current.lastError).toBe('Validation failed');
      });
    });

    it('should handle validation stopped message', async () => {
      const { result } = renderHook(() => useValidationSSE());

      const stoppedMessage: SSEMessage = {
        type: 'validation-stopped',
        data: { message: 'Validation stopped' }
      };

      act(() => {
        mockEventSource.simulateMessage(stoppedMessage);
      });

      await waitFor(() => {
        expect(result.current.validationStatus).toBe('idle');
      });
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on error', async () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useValidationSSE());

      // Simulate connection error
      act(() => {
        mockEventSource.simulateError();
      });

      // Fast-forward time to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should have attempted reconnection
      expect(global.EventSource).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should stop reconnection attempts after max retries', async () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useValidationSSE());

      // Simulate multiple connection errors
      for (let i = 0; i < 6; i++) {
        act(() => {
          mockEventSource.simulateError();
        });

        act(() => {
          jest.advanceTimersByTime(1000 * Math.pow(2, i));
        });
      }

      // Should have attempted reconnection multiple times but eventually stopped
      expect(global.EventSource).toHaveBeenCalledTimes(6);

      jest.useRealTimers();
    });
  });

  describe('API Fallback', () => {
    it('should fallback to API polling when SSE fails', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'running',
          totalResources: 1000,
          processedResources: 100,
          validResources: 95,
          errorResources: 5,
          startTime: '2025-01-16T14:00:00.000Z',
          isComplete: false,
          errors: [],
          status: 'running'
        })
      } as Response);

      const { result } = renderHook(() => useValidationSSE());

      // Simulate SSE connection error to trigger API fallback
      act(() => {
        mockEventSource.simulateError();
      });

      // Wait for API fallback to be triggered
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/validation/bulk/progress');
      });
    });
  });

  describe('Hook Interface', () => {
    it('should provide all expected properties and methods', () => {
      const { result } = renderHook(() => useValidationSSE());

      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('progress');
      expect(result.current).toHaveProperty('validationStatus');
      expect(result.current).toHaveProperty('lastError');
      expect(result.current).toHaveProperty('apiState');
      expect(result.current).toHaveProperty('resetProgress');
      expect(result.current).toHaveProperty('reconnect');
      expect(result.current).toHaveProperty('syncWithApi');

      expect(typeof result.current.resetProgress).toBe('function');
      expect(typeof result.current.reconnect).toBe('function');
      expect(typeof result.current.syncWithApi).toBe('function');
    });

    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useValidationSSE());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.progress).toBe(null);
      expect(result.current.validationStatus).toBe('idle');
      expect(result.current.lastError).toBe(null);
      expect(result.current.apiState).toEqual({
        isRunning: false,
        isPaused: false,
        lastSync: null
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON messages gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useValidationSSE());

      act(() => {
        // Simulate malformed JSON
        const event = new MessageEvent('message', { data: 'invalid json' });
        mockEventSource.onmessage!(event);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[ValidationSSE] Error parsing message:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle unknown message types gracefully', async () => {
      const { result } = renderHook(() => useValidationSSE());

      const unknownMessage: SSEMessage = {
        type: 'unknown-type' as any,
        data: { message: 'Unknown message' }
      };

      act(() => {
        mockEventSource.simulateMessage(unknownMessage);
      });

      // Should not throw errors and should handle gracefully
      expect(result.current.validationStatus).toBe('idle');
    });
  });
});
