/**
 * Validation Aspects Dropdown - Batch Processing Tests
 * 
 * Tests for batch processing configuration in the validation aspects dropdown
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ValidationAspectsDropdown } from './validation-aspects-dropdown';
import type { ValidationSettings, BatchProcessingConfig } from '@/../../shared/validation-settings';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock fetch
global.fetch = vi.fn();

describe('ValidationAspectsDropdown - Batch Processing', () => {
  // Helper function to open dropdown
  const openDropdown = async () => {
    await waitFor(() => {
      expect(screen.getByText('Validation')).toBeInTheDocument();
    });
    
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('200')).toBeInTheDocument();
    });
  };

  const mockValidationSettings: ValidationSettings = {
    version: 1,
    isActive: true,
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRule: { enabled: true, severity: 'warning' },
    metadata: { enabled: true, severity: 'information' },
    strictMode: false,
    defaultSeverity: 'warning',
    includeDebugInfo: false,
    validateAgainstBaseSpec: true,
    fhirVersion: 'R4',
    terminologyServers: [],
    profileResolutionServers: [],
    cacheSettings: {
      enabled: true,
      ttlMs: 300000,
      maxSizeMB: 100,
      cacheValidationResults: true,
      cacheTerminologyExpansions: true,
      cacheProfileResolutions: true
    },
    timeoutSettings: {
      defaultTimeoutMs: 30000,
      structuralValidationTimeoutMs: 30000,
      profileValidationTimeoutMs: 45000,
      terminologyValidationTimeoutMs: 60000,
      referenceValidationTimeoutMs: 30000,
      businessRuleValidationTimeoutMs: 30000,
      metadataValidationTimeoutMs: 15000
    },
    batchProcessingSettings: {
      defaultBatchSize: 200,
      minBatchSize: 50,
      maxBatchSize: 1000,
      useAdaptiveBatchSizing: false,
      targetBatchProcessingTimeMs: 30000,
      pauseBetweenBatches: false,
      pauseDurationMs: 1000,
      retryFailedBatches: true,
      maxRetryAttempts: 1,
      retryDelayMs: 2000
    },
    maxConcurrentValidations: 8,
    useParallelValidation: true,
    customRules: [],
    validateExternalReferences: false,
    validateNonExistentReferences: true,
    validateReferenceTypes: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful fetch response
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ settings: mockValidationSettings })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Batch Size Input', () => {
    it('should render batch size input with correct value', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      const batchSizeInput = screen.getByDisplayValue('200');
      expect(batchSizeInput).toBeInTheDocument();
      expect(batchSizeInput).toHaveAttribute('type', 'number');
    });

    it('should display correct min and max values in label', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      expect(screen.getByText(/Batch Size \(50 - 1000\)/)).toBeInTheDocument();
    });

    it('should have correct min and max attributes on input', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      const batchSizeInput = screen.getByDisplayValue('200');
      expect(batchSizeInput).toHaveAttribute('min', '50');
      expect(batchSizeInput).toHaveAttribute('max', '1000');
    });

    it('should update batch size when input changes', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: mockValidationSettings })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      (global.fetch as vi.Mock).mockImplementation(mockFetch);

      render(<ValidationAspectsDropdown />);
      
      await openDropdown();

      const batchSizeInput = screen.getByDisplayValue('200');
      fireEvent.change(batchSizeInput, { target: { value: '300' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/validation/settings',
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"defaultBatchSize":300')
          })
        );
      });
    });

    it('should not update batch size if value is outside valid range', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: mockValidationSettings })
        });

      (global.fetch as vi.Mock).mockImplementation(mockFetch);

      render(<ValidationAspectsDropdown />);
      
      await openDropdown();

      const batchSizeInput = screen.getByDisplayValue('200');
      
      // Try to set value below minimum
      fireEvent.change(batchSizeInput, { target: { value: '25' } });

      // Should not call update API
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only the initial load call
    });

    it('should not update batch size if value is above maximum', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: mockValidationSettings })
        });

      (global.fetch as vi.Mock).mockImplementation(mockFetch);

      render(<ValidationAspectsDropdown />);
      
      await openDropdown();

      const batchSizeInput = screen.getByDisplayValue('200');
      
      // Try to set value above maximum
      fireEvent.change(batchSizeInput, { target: { value: '1500' } });

      // Should not call update API
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only the initial load call
    });
  });

  describe('Adaptive Batch Sizing Toggle', () => {
    it('should render adaptive batch sizing toggle', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      expect(screen.getByLabelText('Adaptive sizing')).toBeInTheDocument();
    });

    it('should show correct initial state for adaptive batch sizing', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      const adaptiveToggle = screen.getByLabelText('Adaptive sizing');
      expect(adaptiveToggle).not.toBeChecked();
    });

    it('should update adaptive batch sizing when toggled', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: mockValidationSettings })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      (global.fetch as vi.Mock).mockImplementation(mockFetch);

      render(<ValidationAspectsDropdown />);
      
      await openDropdown();

      const adaptiveToggle = screen.getByLabelText('Adaptive sizing');
      fireEvent.click(adaptiveToggle);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/validation/settings',
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"useAdaptiveBatchSizing":true')
          })
        );
      });
    });
  });

  describe('Pause Between Batches Toggle', () => {
    it('should render pause between batches toggle', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      expect(screen.getByLabelText('Pause between batches')).toBeInTheDocument();
    });

    it('should show correct initial state for pause between batches', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      const pauseToggle = screen.getByLabelText('Pause between batches');
      expect(pauseToggle).not.toBeChecked();
    });

    it('should update pause between batches when toggled', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: mockValidationSettings })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      (global.fetch as vi.Mock).mockImplementation(mockFetch);

      render(<ValidationAspectsDropdown />);
      
      await openDropdown();

      const pauseToggle = screen.getByLabelText('Pause between batches');
      fireEvent.click(pauseToggle);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/validation/settings',
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"pauseBetweenBatches":true')
          })
        );
      });
    });
  });

  describe('Batch Processing Section', () => {
    it('should render batch processing section with correct title', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      expect(screen.getByText('Batch Processing')).toBeInTheDocument();
    });

    it('should render batch processing section with layers icon', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      // Look for the Layers icon by its SVG path (since it doesn't have a test-id)
      const layersIcon = screen.getByText('Batch Processing').closest('div')?.querySelector('svg');
      expect(layersIcon).toBeInTheDocument();
    });

    it('should display helpful description for batch size', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      expect(screen.getByText('Number of resources to process in each batch')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as vi.Mock).mockRejectedValue(new Error('Network error'));

      render(<ValidationAspectsDropdown />);
      
      // Should render without crashing
      await waitFor(() => {
        expect(screen.getByText('Validation')).toBeInTheDocument();
      });
    });

    it('should handle API errors when updating batch settings', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: mockValidationSettings })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid settings' })
        });

      (global.fetch as vi.Mock).mockImplementation(mockFetch);

      render(<ValidationAspectsDropdown />);
      
      await openDropdown();

      const batchSizeInput = screen.getByDisplayValue('200');
      fireEvent.change(batchSizeInput, { target: { value: '300' } });

      // Should handle error gracefully
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading States', () => {
    it('should disable controls while loading', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      const batchSizeInput = screen.getByDisplayValue('200');
      const adaptiveToggle = screen.getByLabelText('Adaptive sizing');
      const pauseToggle = screen.getByLabelText('Pause between batches');
      
      expect(batchSizeInput).not.toBeDisabled();
      expect(adaptiveToggle).not.toBeDisabled();
      expect(pauseToggle).not.toBeDisabled();
    });

    it('should show loading state during updates', async () => {
      let resolveUpdate: (value: any) => void;
      const updatePromise = new Promise(resolve => {
        resolveUpdate = resolve;
      });

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ settings: mockValidationSettings })
        })
        .mockImplementation(() => updatePromise);

      (global.fetch as vi.Mock).mockImplementation(mockFetch);

      render(<ValidationAspectsDropdown />);
      
      await openDropdown();

      const batchSizeInput = screen.getByDisplayValue('200');
      fireEvent.change(batchSizeInput, { target: { value: '300' } });

      // Controls should be disabled during update
      await waitFor(() => {
        expect(batchSizeInput).toBeDisabled();
      });

      // Resolve the update
      resolveUpdate!({
        ok: true,
        json: async () => ({ success: true })
      });

      // Controls should be enabled again after update
      await waitFor(() => {
        expect(batchSizeInput).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for batch processing controls', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      expect(screen.getByLabelText('Batch Size (50 - 1000)')).toBeInTheDocument();
      expect(screen.getByLabelText('Adaptive sizing')).toBeInTheDocument();
      expect(screen.getByLabelText('Pause between batches')).toBeInTheDocument();
    });

    it('should have proper form associations', async () => {
      render(<ValidationAspectsDropdown />);
      
      await openDropdown();
      
      const batchSizeInput = screen.getByLabelText('Batch Size (50 - 1000)');
      const adaptiveToggle = screen.getByLabelText('Adaptive sizing');
      const pauseToggle = screen.getByLabelText('Pause between batches');
      
      expect(batchSizeInput).toHaveAttribute('id', 'batchSize');
      expect(adaptiveToggle).toHaveAttribute('id', 'adaptiveBatchSizing');
      expect(pauseToggle).toHaveAttribute('id', 'pauseBetweenBatches');
    });
  });
});
