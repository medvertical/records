/**
 * Unit Tests for Unified Validation Service Retry Logic
 * 
 * Tests the retry functionality implemented in the UnifiedValidationService
 * including retry attempts, retry configuration, and retry tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../fhir/fhir-client');
vi.mock('./validation-engine');
vi.mock('./validation-settings-service');
vi.mock('./validation-pipeline');
vi.mock('../../storage');
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { UnifiedValidationService } from './unified-validation';
import { FhirClient } from '../fhir/fhir-client';
import { ValidationEngine } from './validation-engine';
import { getValidationSettingsService } from './validation-settings-service';
import { getValidationPipeline } from './validation-pipeline';
import { storage } from '../../storage';

describe('UnifiedValidationService - Retry Logic', () => {
  let mockFhirClient: any;
  let mockValidationEngine: any;
  let mockValidationSettingsService: any;
  let mockValidationPipeline: any;
  let mockStorage: any;
  let service: UnifiedValidationService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock FhirClient
    mockFhirClient = {
      searchResources: vi.fn(),
      getResource: vi.fn(),
    };

    // Mock ValidationEngine
    mockValidationEngine = {
      validateResource: vi.fn(),
    };

    // Mock ValidationSettingsService
    mockValidationSettingsService = {
      getActiveSettings: vi.fn(),
      updateSettings: vi.fn(),
    };

    // Mock ValidationPipeline
    mockValidationPipeline = {
      executePipeline: vi.fn(),
    };

    // Mock Storage
    mockStorage = {
      getFhirResourceByTypeAndId: vi.fn(),
      createFhirResource: vi.fn(),
      updateFhirResource: vi.fn(),
      createValidationResult: vi.fn(),
      getValidationResultsByResourceId: vi.fn(),
    };

    // Setup mocks
    vi.mocked(getValidationSettingsService).mockReturnValue(mockValidationSettingsService);
    vi.mocked(getValidationPipeline).mockReturnValue(mockValidationPipeline);
    vi.mocked(storage).mockReturnValue(mockStorage);

    // Create service instance
    service = new UnifiedValidationService(mockFhirClient, mockValidationEngine);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Retry Configuration', () => {
    it('should use default retry settings when no configuration provided', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 1,
          retryDelayMs: 2000,
          retryFailedBatches: false,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      mockValidationPipeline.executePipeline.mockResolvedValue({
        results: [{
          isValid: false,
          issues: [{ severity: 'error', message: 'Test error' }],
          summary: { validationScore: 0 },
          validatedAt: new Date(),
        }],
      });

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      // This should trigger a retry since validation fails
      await service.validateResource(resource, false, true);

      // Verify that retry settings were used
      expect(mockValidationSettingsService.getActiveSettings).toHaveBeenCalled();
    });

    it('should respect configured retry attempts', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 3,
          retryDelayMs: 1000,
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail all attempts
      mockValidationPipeline.executePipeline.mockRejectedValue(new Error('Validation failed'));

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      await service.validateResource(resource, false, true);

      // Should attempt validation 4 times (initial + 3 retries)
      expect(mockValidationPipeline.executePipeline).toHaveBeenCalledTimes(4);
    });

    it('should stop retrying when max attempts reached', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 2,
          retryDelayMs: 100,
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to always fail
      mockValidationPipeline.executePipeline.mockRejectedValue(new Error('Persistent validation error'));

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const result = await service.validateResource(resource, false, true);

      // Should have 3 total attempts (initial + 2 retries)
      expect(mockValidationPipeline.executePipeline).toHaveBeenCalledTimes(3);
      expect(result.validationResults).toHaveLength(1);
      expect(result.validationResults[0].isValid).toBe(false);
      expect(result.validationResults[0].retryAttemptCount).toBe(3);
    });
  });

  describe('Retry Success Scenarios', () => {
    it('should succeed on retry after initial failure', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 2,
          retryDelayMs: 100,
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail first time, succeed second time
      mockValidationPipeline.executePipeline
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          results: [{
            isValid: true,
            issues: [],
            summary: { validationScore: 100 },
            validatedAt: new Date(),
          }],
        });

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const result = await service.validateResource(resource, false, true);

      // Should have 2 total attempts (initial failure + successful retry)
      expect(mockValidationPipeline.executePipeline).toHaveBeenCalledTimes(2);
      expect(result.validationResults).toHaveLength(1);
      expect(result.validationResults[0].isValid).toBe(true);
      expect(result.validationResults[0].retryAttemptCount).toBe(2);
      expect(result.validationResults[0].isRetry).toBe(true);
    });

    it('should track retry duration and attempts correctly', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 1,
          retryDelayMs: 200,
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail first time, succeed second time
      mockValidationPipeline.executePipeline
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          results: [{
            isValid: true,
            issues: [],
            summary: { validationScore: 100 },
            validatedAt: new Date(),
          }],
        });

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const result = await service.validateResource(resource, false, true);

      expect(result.validationResults).toHaveLength(1);
      const validationResult = result.validationResults[0];
      
      expect(validationResult.retryAttemptCount).toBe(2);
      expect(validationResult.maxRetryAttempts).toBe(1);
      expect(validationResult.isRetry).toBe(true);
      expect(validationResult.canRetry).toBe(false);
      expect(validationResult.totalRetryDurationMs).toBeGreaterThan(0);
      expect(validationResult.retryReason).toBe('Previous validation attempts failed');
    });
  });

  describe('Retry Failure Scenarios', () => {
    it('should create error result when all retries exhausted', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 2,
          retryDelayMs: 100,
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to always fail
      const persistentError = new Error('Persistent validation error');
      mockValidationPipeline.executePipeline.mockRejectedValue(persistentError);

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const result = await service.validateResource(resource, false, true);

      expect(result.validationResults).toHaveLength(1);
      const validationResult = result.validationResults[0];
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.retryAttemptCount).toBe(3);
      expect(validationResult.maxRetryAttempts).toBe(2);
      expect(validationResult.isRetry).toBe(true);
      expect(validationResult.canRetry).toBe(false);
      expect(validationResult.retryReason).toBe('All retry attempts exhausted');
      expect(validationResult.errorCount).toBe(1);
      expect(validationResult.errors[0].message).toContain('Validation failed after 3 attempts');
    });

    it('should handle retry disabled scenario', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 2,
          retryDelayMs: 100,
          retryFailedBatches: false, // Retry disabled
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail
      mockValidationPipeline.executePipeline.mockRejectedValue(new Error('Validation error'));

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const result = await service.validateResource(resource, false, true);

      // Should only attempt once since retry is disabled
      expect(mockValidationPipeline.executePipeline).toHaveBeenCalledTimes(1);
      expect(result.validationResults).toHaveLength(1);
      expect(result.validationResults[0].retryAttemptCount).toBe(1);
      expect(result.validationResults[0].isRetry).toBe(false);
    });
  });

  describe('Retry Information Tracking', () => {
    it('should store detailed retry information in database', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 1,
          retryDelayMs: 100,
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail first time, succeed second time
      mockValidationPipeline.executePipeline
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          results: [{
            isValid: true,
            issues: [],
            summary: { validationScore: 100 },
            validatedAt: new Date(),
          }],
        });

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      await service.validateResource(resource, false, true);

      // Verify that createValidationResult was called with retry information
      expect(mockStorage.createValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAttemptCount: 2,
          maxRetryAttempts: 1,
          isRetry: true,
          canRetry: false,
          totalRetryDurationMs: expect.any(Number),
          retryInfo: expect.objectContaining({
            attemptCount: 2,
            maxAttempts: 1,
            isRetry: true,
            previousAttempts: expect.arrayContaining([
              expect.objectContaining({
                attemptNumber: 1,
                success: false,
                errorMessage: 'Network timeout',
                durationMs: expect.any(Number),
              }),
              expect.objectContaining({
                attemptNumber: 2,
                success: true,
                durationMs: expect.any(Number),
              }),
            ]),
            totalRetryDurationMs: expect.any(Number),
            canRetry: false,
            retryReason: 'Previous validation attempts failed',
          }),
        })
      );
    });

    it('should handle missing retry configuration gracefully', async () => {
      // Mock settings without batchProcessingSettings
      mockValidationSettingsService.getActiveSettings.mockResolvedValue({});
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail
      mockValidationPipeline.executePipeline.mockRejectedValue(new Error('Validation error'));

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const result = await service.validateResource(resource, false, true);

      // Should use default values (no retry)
      expect(mockValidationPipeline.executePipeline).toHaveBeenCalledTimes(1);
      expect(result.validationResults).toHaveLength(1);
      expect(result.validationResults[0].retryAttemptCount).toBe(1);
      expect(result.validationResults[0].maxRetryAttempts).toBe(1);
      expect(result.validationResults[0].isRetry).toBe(false);
    });
  });

  describe('Retry Performance', () => {
    it('should respect retry delay timing', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 1,
          retryDelayMs: 500, // 500ms delay
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail first time, succeed second time
      mockValidationPipeline.executePipeline
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          results: [{
            isValid: true,
            issues: [],
            summary: { validationScore: 100 },
            validatedAt: new Date(),
          }],
        });

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const startTime = Date.now();
      await service.validateResource(resource, false, true);
      const endTime = Date.now();

      // Should take at least 500ms due to retry delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(500);
    });

    it('should handle rapid retry scenarios efficiently', async () => {
      const mockSettings = {
        batchProcessingSettings: {
          maxRetryAttempts: 3,
          retryDelayMs: 50, // Short delay
          retryFailedBatches: true,
        },
      };

      mockValidationSettingsService.getActiveSettings.mockResolvedValue(mockSettings);
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue(null);
      mockStorage.createFhirResource.mockResolvedValue({ id: 1, validationResults: [] });
      
      // Mock validation to fail all attempts
      mockValidationPipeline.executePipeline.mockRejectedValue(new Error('Persistent error'));

      const resource = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['John'], family: 'Doe' }],
      };

      const startTime = Date.now();
      await service.validateResource(resource, false, true);
      const endTime = Date.now();

      // Should complete all retries (4 total attempts) within reasonable time
      expect(mockValidationPipeline.executePipeline).toHaveBeenCalledTimes(4);
      expect(endTime - startTime).toBeLessThan(1000); // Should be under 1 second
    });
  });
});
