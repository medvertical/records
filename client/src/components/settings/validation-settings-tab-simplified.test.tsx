/**
 * Unit Tests for Validation Settings Tab Simplified
 * 
 * Tests validation settings UI component functionality including:
 * - Toggle aspects and severity changes
 * - Records-specific options
 * - Engine controls
 * - Save/apply with validation
 * - Settings changed event emission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ValidationSettingsTab } from './validation-settings-tab-simplified';
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

describe('ValidationSettingsTab', () => {
  let queryClient: QueryClient;
  let mockFetch: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/validation/settings')) {
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
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ValidationSettingsTab />
      </QueryClientProvider>
    );
  };

  describe('Validation Aspects Toggles', () => {
    it('should render all validation aspects with toggles', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Structural Validation')).toBeInTheDocument();
        expect(screen.getByText('Profile Validation')).toBeInTheDocument();
        expect(screen.getByText('Terminology Validation')).toBeInTheDocument();
        expect(screen.getByText('Reference Validation')).toBeInTheDocument();
        expect(screen.getByText('Business Rule Validation')).toBeInTheDocument();
        expect(screen.getByText('Metadata Validation')).toBeInTheDocument();
      });
    });

    it('should allow toggling validation aspects', async () => {
      renderComponent();

      await waitFor(() => {
        const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
        expect(structuralToggle).toBeInTheDocument();
        
        // Toggle should be enabled by default
        expect(structuralToggle).toBeChecked();
      });

      // Toggle the structural validation
      const structuralToggle = screen.getByRole('switch', { name: /structural validation/i });
      fireEvent.click(structuralToggle);

      await waitFor(() => {
        expect(structuralToggle).not.toBeChecked();
      });
    });

    it('should allow changing severity levels', async () => {
      renderComponent();

      await waitFor(() => {
        const severitySelects = screen.getAllByRole('combobox');
        expect(severitySelects.length).toBeGreaterThan(0);
      });

      // Find and change a severity select
      const severitySelects = screen.getAllByRole('combobox');
      const firstSelect = severitySelects[0];
      
      fireEvent.click(firstSelect);
      
      // Select warning severity
      const warningOption = screen.getByRole('option', { name: /warning/i });
      fireEvent.click(warningOption);

      await waitFor(() => {
        expect(firstSelect).toHaveTextContent('Warning');
      });
    });
  });

  describe('Records-Specific Options', () => {
    it('should render records-specific options', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Records-Specific Options')).toBeInTheDocument();
        expect(screen.getByText('Validate External References')).toBeInTheDocument();
        expect(screen.getByText('Reference Type Checks')).toBeInTheDocument();
        expect(screen.getByText('Strict Mode')).toBeInTheDocument();
      });
    });

    it('should allow toggling records-specific options', async () => {
      renderComponent();

      await waitFor(() => {
        const externalRefToggle = screen.getByRole('switch', { name: /validate external references/i });
        expect(externalRefToggle).toBeInTheDocument();
        
        // Toggle the external references option
        fireEvent.click(externalRefToggle);
        
        expect(externalRefToggle).toBeChecked();
      });
    });

    it('should allow setting maximum reference depth', async () => {
      renderComponent();

      await waitFor(() => {
        const depthInput = screen.getByLabelText(/maximum reference depth/i);
        expect(depthInput).toBeInTheDocument();
        
        // Change the depth value
        fireEvent.change(depthInput, { target: { value: '5' } });
        
        expect(depthInput).toHaveValue(5);
      });
    });
  });

  describe('Engine Controls', () => {
    it('should render engine control options', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Engine Controls')).toBeInTheDocument();
        expect(screen.getByText('Batch Size')).toBeInTheDocument();
        expect(screen.getByText('Max Concurrent')).toBeInTheDocument();
        expect(screen.getByText('Timeout (ms)')).toBeInTheDocument();
        expect(screen.getByText('Retry Attempts')).toBeInTheDocument();
      });
    });

    it('should allow changing batch size', async () => {
      renderComponent();

      await waitFor(() => {
        const batchSizeInput = screen.getByLabelText(/batch size/i);
        expect(batchSizeInput).toBeInTheDocument();
        
        // Change the batch size
        fireEvent.change(batchSizeInput, { target: { value: '500' } });
        
        expect(batchSizeInput).toHaveValue(500);
      });
    });

    it('should allow changing max concurrent validations', async () => {
      renderComponent();

      await waitFor(() => {
        const maxConcurrentInput = screen.getByLabelText(/max concurrent/i);
        expect(maxConcurrentInput).toBeInTheDocument();
        
        // Change the max concurrent value
        fireEvent.change(maxConcurrentInput, { target: { value: '10' } });
        
        expect(maxConcurrentInput).toHaveValue(10);
      });
    });
  });

  describe('Save and Apply Functionality', () => {
    it('should save settings with validation', async () => {
      renderComponent();

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save settings/i });
        expect(saveButton).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Wait for validation and save calls
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings/validate'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings'),
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
          })
        );
      });
    });

    it('should emit settingsChanged event after successful save', async () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      
      renderComponent();

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save settings/i });
        expect(saveButton).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Wait for the settingsChanged event to be dispatched
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

    it('should handle validation errors gracefully', async () => {
      // Mock validation failure
      mockFetch.mockImplementation((url: string) => {
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
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderComponent();

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save settings/i });
        expect(saveButton).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Should not proceed to save if validation fails
      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalledWith(
          expect.stringContaining('/api/validation/settings'),
          expect.objectContaining({ method: 'PUT' })
        );
      });
    });

    it('should show loading state during save', async () => {
      // Mock slow API response
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/validation/settings/validate')) {
          return new Promise(resolve => {
            setTimeout(() => resolve({
              ok: true,
              json: () => Promise.resolve({ isValid: true, errors: [], warnings: [] })
            }), 100);
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      renderComponent();

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save settings/i });
        expect(saveButton).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe('Server-Scoped Settings', () => {
    it('should include server ID in save request when active server is set', async () => {
      renderComponent();

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save settings/i });
        expect(saveButton).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save settings/i });
      fireEvent.click(saveButton);

      // Wait for save call with server ID
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

  describe('Snapshot Information Display', () => {
    it('should display snapshot hash and timestamp', async () => {
      renderComponent();

      await waitFor(() => {
        // Should show snapshot information
        expect(screen.getByText(/snapshot/i)).toBeInTheDocument();
        expect(screen.getByText(/last updated/i)).toBeInTheDocument();
      });
    });
  });
});
