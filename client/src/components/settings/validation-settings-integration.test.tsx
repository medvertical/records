/**
 * Integration Tests for Validation Settings
 * 
 * Tests the complete validation settings workflow including:
 * - UI interactions
 * - API calls
 * - Event emission
 * - Cache invalidation
 * - Real-time updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ValidationSettingsTab } from './validation-settings-tab-simplified';
import { ValidationAspectsPanel } from '@/components/dashboard/controls/ValidationAspectsPanel';
import { DEFAULT_VALIDATION_SETTINGS } from '@shared/validation-settings-simplified';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock the active server hook
vi.mock('@/hooks/use-active-server', () => ({
  useActiveServer: () => ({
    activeServer: { id: 1, name: 'Test Server', url: 'http://test.com' },
    setActiveServer: vi.fn(),
    clearActiveServer: vi.fn()
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
  ...DEFAULT_VALIDATION_SETTINGS,
  id: 'settings-1',
  name: 'Default Settings',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z')
};

const updatedValidationSettings = {
  ...mockValidationSettings,
  aspects: {
    ...mockValidationSettings.aspects,
    structural: { enabled: false, severity: 'warning' as const }
  },
  updatedAt: new Date('2024-01-01T01:00:00Z')
};

describe('Validation Settings Integration', () => {
  let queryClient: QueryClient;
  let mockFetch: any;
  let dispatchEventSpy: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    mockFetch = vi.fn();
    global.fetch = mockFetch;
    dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Mock successful API responses
    mockFetch.mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/validation/settings') && options?.method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockValidationSettings)
        });
      }
      if (url.includes('/api/validation/settings/validate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ isValid: true, errors: [], warnings: [] })
        });
      }
      if (url.includes('/api/validation/settings') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(updatedValidationSettings)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponents = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <div>
          <ValidationSettingsTab />
          <ValidationAspectsPanel />
        </div>
      </QueryClientProvider>
    );
  };

  describe('Complete Settings Workflow', () => {
    it('should complete full validation settings workflow', async () => {
      renderComponents();

      // Wait for components to load
      await waitFor(() => {
        expect(screen.getByText('Structural Validation')).toBeInTheDocument();
      });

      // Step 1: Toggle a validation aspect
      const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
      expect(structuralToggle).toBeChecked();

      fireEvent.click(structuralToggle);

      await waitFor(() => {
        expect(structuralToggle).not.toBeChecked();
      });

      // Step 2: Change severity level
      const severitySelects = screen.getAllByRole('combobox');
      const firstSelect = severitySelects[0];
      
      fireEvent.click(firstSelect);
      
      const warningOption = screen.getByRole('option', { name: /warning/i });
      fireEvent.click(warningOption);

      await waitFor(() => {
        expect(firstSelect).toHaveTextContent('Warning');
      });

      // Step 3: Save settings
      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Step 4: Verify validation endpoint was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings/validate'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
      });

      // Step 5: Verify save endpoint was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings'),
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
          })
        );
      });

      // Step 6: Verify settingsChanged event was emitted
      await waitFor(() => {
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'settingsChanged',
            detail: expect.objectContaining({
              settings: expect.any(Object),
              timestamp: expect.any(Number)
            })
          })
        );
      });
    });

    it('should handle validation errors in workflow', async () => {
      // Mock validation failure
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/validation/settings/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
              isValid: false, 
              errors: ['Invalid settings configuration'],
              warnings: []
            })
          });
        }
        if (url.includes('/api/validation/settings') && options?.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockValidationSettings)
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderComponents();

      await waitFor(() => {
        expect(screen.getByText('Structural Validation')).toBeInTheDocument();
      });

      // Make a change
      const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
      fireEvent.click(structuralToggle);

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Should call validation endpoint
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings/validate'),
          expect.any(Object)
        );
      });

      // Should NOT call save endpoint due to validation failure
      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings'),
          expect.objectContaining({ method: 'PUT' })
        );
      });

      // Should NOT emit settingsChanged event
      expect(dispatchEventSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'settingsChanged' })
      );
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should update all components when settings change', async () => {
      renderComponents();

      // Wait for components to load
      await waitFor(() => {
        expect(screen.getByText('Structural Validation')).toBeInTheDocument();
      });

      // Make a change and save
      const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
      fireEvent.click(structuralToggle);

      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'settingsChanged' })
        );
      });

      // Verify that both components would receive the update
      // (In a real scenario, this would trigger re-renders with updated data)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/validation/settings'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should handle server-scoped settings correctly', async () => {
      renderComponents();

      await waitFor(() => {
        expect(screen.getByText('Structural Validation')).toBeInTheDocument();
      });

      // Make a change and save
      const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
      fireEvent.click(structuralToggle);

      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Verify server ID is included in the save request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings?serverId=1'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"serverId":1')
          })
        );
      });
    });
  });

  describe('Cache Invalidation Integration', () => {
    it('should invalidate validation settings cache after save', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      
      renderComponents();

      await waitFor(() => {
        expect(screen.getByText('Structural Validation')).toBeInTheDocument();
      });

      // Make a change and save
      const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
      fireEvent.click(structuralToggle);

      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'settingsChanged' })
        );
      });

      // Verify cache invalidation occurred
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['validation-settings']
      });
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from network errors during save', async () => {
      // Mock network error
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/validation/settings') && options?.method === 'PUT') {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('/api/validation/settings/validate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ isValid: true, errors: [], warnings: [] })
          });
        }
        if (url.includes('/api/validation/settings') && options?.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockValidationSettings)
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderComponents();

      await waitFor(() => {
        expect(screen.getByText('Structural Validation')).toBeInTheDocument();
      });

      // Make a change and save
      const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
      fireEvent.click(structuralToggle);

      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Should call validation endpoint
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings/validate'),
          expect.any(Object)
        );
      });

      // Should attempt save endpoint
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings'),
          expect.objectContaining({ method: 'PUT' })
        );
      });

      // Should NOT emit settingsChanged event due to save failure
      expect(dispatchEventSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'settingsChanged' })
      );
    });
  });
});
