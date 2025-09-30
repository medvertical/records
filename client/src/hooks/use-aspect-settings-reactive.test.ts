import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAspectSettingsReactive } from './use-aspect-settings-reactive';
import { useValidationSettingsPolling } from './use-validation-settings-polling';

// Mock useValidationSettingsPolling
vi.mock('./use-validation-settings-polling', () => ({
  useValidationSettingsPolling: vi.fn(),
}));

describe('useAspectSettingsReactive', () => {
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

  const mockSettings = {
    aspects: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'warning' },
      terminology: { enabled: false, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'error' },
      metadata: { enabled: false, severity: 'error' },
    },
  };

  it('returns aspect settings from polling hook', () => {
    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: mockSettings,
      lastChange: null,
      isPolling: true,
    } as any);

    const { result } = renderHook(() => useAspectSettingsReactive(), { wrapper });

    expect(result.current.aspectSettings).toEqual(mockSettings.aspects);
  });

  it('detects enabled aspects correctly', () => {
    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: mockSettings,
      lastChange: null,
      isPolling: true,
    } as any);

    const { result } = renderHook(() => useAspectSettingsReactive(), { wrapper });

    expect(result.current.isAspectEnabled('structural')).toBe(true);
    expect(result.current.isAspectEnabled('terminology')).toBe(false);
    expect(result.current.isAspectEnabled('metadata')).toBe(false);
  });

  it('returns enabled aspects list', () => {
    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: mockSettings,
      lastChange: null,
      isPolling: true,
    } as any);

    const { result } = renderHook(() => useAspectSettingsReactive(), { wrapper });

    const enabled = result.current.getEnabledAspects();
    expect(enabled).toHaveLength(4);
    expect(enabled).toContain('structural');
    expect(enabled).toContain('profile');
    expect(enabled).toContain('reference');
    expect(enabled).toContain('businessRule');
  });

  it('returns disabled aspects list', () => {
    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: mockSettings,
      lastChange: null,
      isPolling: true,
    } as any);

    const { result } = renderHook(() => useAspectSettingsReactive(), { wrapper });

    const disabled = result.current.getDisabledAspects();
    expect(disabled).toHaveLength(2);
    expect(disabled).toContain('terminology');
    expect(disabled).toContain('metadata');
  });

  it('detects validating state after recent change', () => {
    const recentTimestamp = new Date(Date.now() - 2000).toISOString(); // 2 seconds ago

    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: mockSettings,
      lastChange: {
        timestamp: recentTimestamp,
        changes: [],
      },
      isPolling: true,
    } as any);

    const { result } = renderHook(() => useAspectSettingsReactive(), { wrapper });

    expect(result.current.isValidating()).toBe(true);
  });

  it('not validating after old change', () => {
    const oldTimestamp = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago

    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: mockSettings,
      lastChange: {
        timestamp: oldTimestamp,
        changes: [],
      },
      isPolling: true,
    } as any);

    const { result } = renderHook(() => useAspectSettingsReactive(), { wrapper });

    expect(result.current.isValidating()).toBe(false);
  });

  it('invalidates cache when settings change', async () => {
    const initialSettings = { ...mockSettings };
    const changedSettings = {
      aspects: {
        ...mockSettings.aspects,
        structural: { enabled: false, severity: 'error' },
      },
    };

    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: initialSettings,
      lastChange: null,
      isPolling: true,
    } as any);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { rerender } = renderHook(() => useAspectSettingsReactive(), { wrapper });

    expect(invalidateSpy).not.toHaveBeenCalled();

    // Change settings
    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: changedSettings,
      lastChange: {
        timestamp: new Date().toISOString(),
        changes: ['structural.enabled'],
      },
      isPolling: true,
    } as any);

    rerender();

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  it('calls onChange callback when settings change', async () => {
    const onChange = vi.fn();
    const initialSettings = { ...mockSettings };
    const changedSettings = {
      aspects: {
        ...mockSettings.aspects,
        profile: { enabled: false, severity: 'warning' },
      },
    };

    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: initialSettings,
      lastChange: null,
      isPolling: true,
    } as any);

    const { rerender } = renderHook(
      () => useAspectSettingsReactive({ onSettingsChange: onChange }),
      { wrapper }
    );

    expect(onChange).not.toHaveBeenCalled();

    // Change settings
    vi.mocked(useValidationSettingsPolling).mockReturnValue({
      settings: changedSettings,
      lastChange: {
        timestamp: new Date().toISOString(),
        changes: ['profile.enabled'],
      },
      isPolling: true,
    } as any);

    rerender();

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });
});
