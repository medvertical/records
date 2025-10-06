// ============================================================================
// Validation Polling Hook Tests
// ============================================================================

import { renderHook, act, waitFor } from '@testing-library/react';
import { useValidationPolling } from './use-validation-polling';

// Mock fetch
global.fetch = jest.fn();

describe('useValidationPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default configuration', () => {
    const { result } = renderHook(() => useValidationPolling());

    expect(result.current.getPollingConfig()).toEqual({
      enabled: true,
      pollInterval: 10000,
      activePollInterval: 3000,
      idlePollInterval: 10000,
      hasActiveServer: true,
      maxRetries: 5,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      requestTimeout: 30000,
      enableSmartPolling: true,
      enableExponentialBackoff: true
    });
  });

  it('should accept custom configuration', () => {
    const customConfig = {
      enabled: false,
      pollInterval: 5000,
      activePollInterval: 2000,
      idlePollInterval: 15000,
      maxRetries: 3,
      retryDelay: 500,
      maxRetryDelay: 10000,
      requestTimeout: 15000,
      enableSmartPolling: false,
      enableExponentialBackoff: false
    };

    const { result } = renderHook(() => useValidationPolling(customConfig));

    expect(result.current.getPollingConfig()).toEqual(customConfig);
  });

  it('should update configuration dynamically', () => {
    const { result } = renderHook(() => useValidationPolling());

    act(() => {
      result.current.updatePollingConfig({
        activePollInterval: 1000,
        idlePollInterval: 5000
      });
    });

    expect(result.current.getPollingConfig()).toMatchObject({
      activePollInterval: 1000,
      idlePollInterval: 5000
    });
  });

  it('should handle fetch errors with configurable retry logic', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useValidationPolling({
      maxRetries: 2,
      retryDelay: 100,
      enableExponentialBackoff: false
    }));

    act(() => {
      result.current.startPolling();
    });

    // Wait for retries
    await waitFor(() => {
      expect(result.current.lastError).toContain('Network error');
    }, { timeout: 1000 });

    // Should have attempted retries based on configuration
    expect(result.current.lastError).toContain('(attempt 2/2)');
  });

  it('should use smart polling when enabled', async () => {
    const mockProgress = {
      totalResources: 100,
      processedResources: 50,
      validResources: 45,
      errorResources: 5,
      status: 'running' as const,
      startTime: new Date(),
      currentResourceType: 'Patient'
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProgress)
    });

    const { result } = renderHook(() => useValidationPolling({
      enableSmartPolling: true,
      activePollInterval: 1000,
      idlePollInterval: 5000
    }));

    act(() => {
      result.current.startPolling();
    });

    // Should start with idle interval
    expect(result.current.getPollingConfig().enableSmartPolling).toBe(true);
  });

  it('should handle disabled polling', () => {
    const { result } = renderHook(() => useValidationPolling({
      enabled: false
    }));

    expect(result.current.getPollingConfig().enabled).toBe(false);
  });

  it('should provide connection state management', () => {
    const { result } = renderHook(() => useValidationPolling());

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionAttempts).toBe(0);
  });

  it('should handle manual sync with API', async () => {
    const mockProgress = {
      totalResources: 100,
      processedResources: 50,
      validResources: 45,
      errorResources: 5,
      status: 'running' as const,
      startTime: new Date(),
      currentResourceType: 'Patient'
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProgress)
    });

    const { result } = renderHook(() => useValidationPolling());

    await act(async () => {
      await result.current.syncWithApi();
    });

    expect(result.current.progress).toEqual(expect.objectContaining({
      totalResources: 100,
      processedResources: 50,
      status: 'running'
    }));
  });

  it('should handle reconnection', () => {
    const { result } = renderHook(() => useValidationPolling());

    act(() => {
      result.current.reconnect();
    });

    // Should reset error state and attempt reconnection
    expect(result.current.lastError).toBeNull();
  });

  it('should reset progress state', () => {
    const { result } = renderHook(() => useValidationPolling());

    // Set some state first
    act(() => {
      result.current.updatePollingConfig({ enabled: true });
    });

    act(() => {
      result.current.resetProgress();
    });

    expect(result.current.progress).toBeNull();
    expect(result.current.validationStatus).toBe('idle');
    expect(result.current.lastError).toBeNull();
  });
});