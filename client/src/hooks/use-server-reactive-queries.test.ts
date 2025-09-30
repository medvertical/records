import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useServerReactiveQueries } from './use-server-reactive-queries';
import { useServerData } from './use-server-data';

// Mock useServerData
vi.mock('./use-server-data', () => ({
  useServerData: vi.fn(),
}));

describe('useServerReactiveQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('returns current server information', () => {
    const mockServer = {
      id: 1,
      name: 'Test Server',
      url: 'http://test.fhir.org',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(useServerData).mockReturnValue({
      activeServer: mockServer,
      servers: [mockServer],
      isLoading: false,
      error: null,
      serverStatus: undefined,
      isConnectionLoading: false,
      refreshServers: vi.fn(),
      setActiveServer: vi.fn(),
    });

    const { result } = renderHook(() => useServerReactiveQueries(), { wrapper });

    expect(result.current.serverId).toBe(1);
    expect(result.current.serverName).toBe('Test Server');
    expect(result.current.serverUrl).toBe('http://test.fhir.org');
  });

  it('invalidates queries when server changes', async () => {
    const server1 = {
      id: 1,
      name: 'Server 1',
      url: 'http://server1.fhir.org',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const server2 = {
      id: 2,
      name: 'Server 2',
      url: 'http://server2.fhir.org',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // Start with server 1
    vi.mocked(useServerData).mockReturnValue({
      activeServer: server1,
      servers: [server1, server2],
      isLoading: false,
      error: null,
      serverStatus: undefined,
      isConnectionLoading: false,
      refreshServers: vi.fn(),
      setActiveServer: vi.fn(),
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

    const { rerender } = renderHook(() => useServerReactiveQueries(), { wrapper });

    expect(invalidateSpy).not.toHaveBeenCalled();

    // Switch to server 2
    vi.mocked(useServerData).mockReturnValue({
      activeServer: server2,
      servers: [server1, server2],
      isLoading: false,
      error: null,
      serverStatus: undefined,
      isConnectionLoading: false,
      refreshServers: vi.fn(),
      setActiveServer: vi.fn(),
    });

    rerender();

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalled();
      expect(refetchSpy).toHaveBeenCalled();
    });
  });

  it('does not invalidate on initial mount', () => {
    const mockServer = {
      id: 1,
      name: 'Test Server',
      url: 'http://test.fhir.org',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(useServerData).mockReturnValue({
      activeServer: mockServer,
      servers: [mockServer],
      isLoading: false,
      error: null,
      serverStatus: undefined,
      isConnectionLoading: false,
      refreshServers: vi.fn(),
      setActiveServer: vi.fn(),
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useServerReactiveQueries(), { wrapper });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('handles undefined server gracefully', () => {
    vi.mocked(useServerData).mockReturnValue({
      activeServer: undefined,
      servers: [],
      isLoading: false,
      error: null,
      serverStatus: undefined,
      isConnectionLoading: false,
      refreshServers: vi.fn(),
      setActiveServer: vi.fn(),
    });

    const { result } = renderHook(() => useServerReactiveQueries(), { wrapper });

    expect(result.current.serverId).toBeUndefined();
    expect(result.current.serverName).toBeUndefined();
    expect(result.current.serverUrl).toBeUndefined();
  });
});
