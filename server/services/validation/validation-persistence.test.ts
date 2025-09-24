import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsolidatedValidationService } from './core/consolidated-validation-service';
import { storage } from '../../storage';
import { getValidationSettingsService } from './validation-settings-service';
import { getValidationPipeline } from './core/validation-pipeline';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  }
}));

// Mock dependencies
vi.mock('../../storage', () => ({
  storage: {
    getFhirResourceByTypeAndId: vi.fn(),
    createValidationResult: vi.fn(),
    getValidationResultsByResourceId: vi.fn(),
    getLatestValidationResult: vi.fn(),
    invalidateValidationResults: vi.fn(),
    // New consolidated service methods
    getValidationResultsByRequestId: vi.fn(),
    getValidationResultsByBatchId: vi.fn(),
    getValidationResultsByStatus: vi.fn(),
    updateValidationResultStatus: vi.fn(),
    getValidationResultsByResourceType: vi.fn(),
    getValidationPerformanceMetrics: vi.fn(),
    getValidationAspectBreakdown: vi.fn()
  }
}));

vi.mock('./validation-settings-service', () => ({
  getValidationSettingsService: () => ({
    getActiveSettings: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn()
  })
}));

vi.mock('./validation-pipeline', () => ({
  getValidationPipeline: () => ({
    executePipeline: vi.fn()
  })
}));

describe('Validation Result Persistence', () => {
  let validationService: ConsolidatedValidationService;
  let mockStorage: any;
  let mockSettingsService: any;
  let mockPipeline: any;

  const mockFhirResource = {
    id: 123,
    serverId: 1,
    resourceType: 'Patient',
    resourceId: 'patient-123',
    data: {
      id: 'patient-123',
      resourceType: 'Patient',
      name: [{ given: ['John'], family: 'Doe' }]
    },
    lastUpdated: new Date('2024-01-15T09:00:00Z'),
    createdAt: new Date('2024-01-15T09:00:00Z'),
    updatedAt: new Date('2024-01-15T09:00:00Z')
  };

  const mockValidationSettings = {
    settings: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'error' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'info' }
    }
  };

  const mockValidationResult = {
    id: 1,
    resourceId: 123,
    settingsHash: 'hash123',
    resourceHash: 'resourceHash123',
    validationEngineVersion: '1.0.0',
    isValid: false,
    hasErrors: true,
    hasWarnings: true,
    errorCount: 2,
    warningCount: 1,
    informationCount: 0,
    validationScore: 75,
    lastValidated: new Date('2024-01-15T10:00:00Z'),
    validatedAt: new Date('2024-01-15T10:00:00Z'),
    performanceMetrics: {
      totalDurationMs: 150,
      aspectBreakdown: {
        structural: { durationMs: 50, issueCount: 1 },
        profile: { durationMs: 40, issueCount: 1 },
        terminology: { durationMs: 30, issueCount: 0 },
        reference: { durationMs: 20, issueCount: 1 },
        businessRule: { durationMs: 10, issueCount: 0 },
        metadata: { durationMs: 0, issueCount: 0 }
      }
    },
    aspectBreakdown: {
      structural: { enabled: true, issueCount: 1, errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 90, passed: false },
      profile: { enabled: true, issueCount: 1, errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 85, passed: false },
      terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      reference: { enabled: true, issueCount: 1, errorCount: 0, warningCount: 1, informationCount: 0, validationScore: 95, passed: false },
      businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
    },
    issues: [
      { aspect: 'structural', severity: 'error', message: 'Structural validation error' },
      { aspect: 'profile', severity: 'error', message: 'Profile validation error' },
      { aspect: 'reference', severity: 'warning', message: 'Reference validation warning' }
    ],
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z')
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    validationService = new ConsolidatedValidationService();
    mockStorage = storage;
    mockSettingsService = getValidationSettingsService();
    mockPipeline = getValidationPipeline();

    // Setup default mocks
    vi.mocked(mockStorage.getFhirResourceByTypeAndId).mockResolvedValue(mockFhirResource);
    vi.mocked(mockSettingsService.getActiveSettings).mockResolvedValue(mockValidationSettings);
    vi.mocked(mockStorage.createValidationResult).mockResolvedValue(mockValidationResult);
    vi.mocked(mockStorage.getValidationResultsByResourceId).mockResolvedValue([mockValidationResult]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Validation Result Persistence', () => {
    it('should persist validation results after successful validation', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: false,
          hasErrors: true,
          hasWarnings: true,
          errorCount: 2,
          warningCount: 1,
          informationCount: 0,
          validationScore: 75,
          issues: mockValidationResult.issues,
          performanceMetrics: mockValidationResult.performanceMetrics,
          aspectBreakdown: mockValidationResult.aspectBreakdown
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const result = await validationService.validateResource('Patient', 'patient-123');

      expect(mockStorage.createValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 123,
          settingsHash: expect.any(String),
          resourceHash: expect.any(String),
          validationEngineVersion: expect.any(String),
          isValid: false,
          hasErrors: true,
          hasWarnings: true,
          errorCount: 2,
          warningCount: 1,
          informationCount: 0,
          validationScore: 75,
          performanceMetrics: mockValidationResult.performanceMetrics,
          aspectBreakdown: mockValidationResult.aspectBreakdown,
          issues: mockValidationResult.issues
        })
      );

      expect(mockStorage.getValidationResultsByResourceId).toHaveBeenCalledWith(123);
      expect(result.validationResults).toEqual([mockValidationResult]);
    });

    it('should persist error results when validation fails', async () => {
      const mockPipelineResult = {
        success: false,
        error: new Error('Validation failed'),
        results: []
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const result = await validationService.validateResource('Patient', 'patient-123');

      expect(mockStorage.createValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 123,
          isValid: false,
          hasErrors: true,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 0,
          issues: expect.arrayContaining([
            expect.objectContaining({
              severity: 'error',
              message: expect.stringContaining('Validation failed')
            })
          ])
        })
      );
    });

    it('should handle storage persistence errors gracefully', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: false,
          hasErrors: true,
          hasWarnings: false,
          errorCount: 1,
          warningCount: 0,
          informationCount: 0,
          validationScore: 90,
          issues: [{ aspect: 'structural', severity: 'error', message: 'Test error' }],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);
      vi.mocked(mockStorage.createValidationResult).mockRejectedValue(new Error('Storage error'));

      await expect(validationService.validateResource('Patient', 'patient-123'))
        .rejects.toThrow('Storage error');
    });

    it('should generate consistent settings and resource hashes', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      // Validate the same resource multiple times
      await validationService.validateResource('Patient', 'patient-123');
      await validationService.validateResource('Patient', 'patient-123');

      // Verify that the same settings hash and resource hash are used
      const createCalls = vi.mocked(mockStorage.createValidationResult).mock.calls;
      expect(createCalls).toHaveLength(2);
      
      const firstCall = createCalls[0][0];
      const secondCall = createCalls[1][0];
      
      expect(firstCall.settingsHash).toBe(secondCall.settingsHash);
      expect(firstCall.resourceHash).toBe(secondCall.resourceHash);
    });
  });

  describe('Validation Result Caching', () => {
    it('should retrieve existing validation results when available', async () => {
      vi.mocked(mockStorage.getLatestValidationResult).mockResolvedValue(mockValidationResult);

      const result = await validationService.validateResource('Patient', 'patient-123');

      expect(mockStorage.getLatestValidationResult).toHaveBeenCalledWith(
        123,
        expect.any(String)
      );
      expect(mockPipeline.executePipeline).not.toHaveBeenCalled();
      expect(result.validationResults).toEqual([mockValidationResult]);
      expect(result.wasRevalidated).toBe(false);
    });

    it('should re-validate when force revalidation is requested', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const result = await validationService.validateResource('Patient', 'patient-123', true);

      expect(mockPipeline.executePipeline).toHaveBeenCalled();
      expect(mockStorage.createValidationResult).toHaveBeenCalled();
      expect(result.wasRevalidated).toBe(true);
    });

    it('should re-validate when validation settings change', async () => {
      const oldSettings = {
        settings: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: false, severity: 'error' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      const oldResult = {
        ...mockValidationResult,
        settingsHash: 'oldHash123'
      };

      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockStorage.getLatestValidationResult).mockResolvedValue(oldResult);
      vi.mocked(mockSettingsService.getActiveSettings).mockResolvedValue(mockValidationSettings);
      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const result = await validationService.validateResource('Patient', 'patient-123');

      // Should re-validate because settings hash changed
      expect(mockPipeline.executePipeline).toHaveBeenCalled();
      expect(mockStorage.createValidationResult).toHaveBeenCalled();
      expect(result.wasRevalidated).toBe(true);
    });

    it('should re-validate when resource data changes', async () => {
      const oldResult = {
        ...mockValidationResult,
        resourceHash: 'oldResourceHash123'
      };

      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockStorage.getLatestValidationResult).mockResolvedValue(oldResult);
      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const result = await validationService.validateResource('Patient', 'patient-123');

      // Should re-validate because resource hash changed
      expect(mockPipeline.executePipeline).toHaveBeenCalled();
      expect(mockStorage.createValidationResult).toHaveBeenCalled();
      expect(result.wasRevalidated).toBe(true);
    });

    it('should invalidate cache when validation settings change', async () => {
      vi.mocked(mockStorage.getLatestValidationResult).mockResolvedValue(mockValidationResult);

      await validationService.invalidateValidationCache();

      expect(mockStorage.invalidateValidationResults).toHaveBeenCalled();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      vi.mocked(mockStorage.invalidateValidationResults).mockRejectedValue(new Error('Cache invalidation failed'));

      await expect(validationService.invalidateValidationCache())
        .rejects.toThrow('Cache invalidation failed');
    });
  });

  describe('Validation Result Metadata', () => {
    it('should include performance metrics in validation results', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: false,
          hasErrors: true,
          hasWarnings: false,
          errorCount: 1,
          warningCount: 0,
          informationCount: 0,
          validationScore: 90,
          issues: [{ aspect: 'structural', severity: 'error', message: 'Test error' }],
          performanceMetrics: {
            totalDurationMs: 150,
            aspectBreakdown: {
              structural: { durationMs: 100, issueCount: 1 },
              profile: { durationMs: 30, issueCount: 0 },
              terminology: { durationMs: 20, issueCount: 0 },
              reference: { durationMs: 0, issueCount: 0 },
              businessRule: { durationMs: 0, issueCount: 0 },
              metadata: { durationMs: 0, issueCount: 0 }
            }
          },
          aspectBreakdown: {
            structural: { enabled: true, issueCount: 1, errorCount: 1, warningCount: 0, informationCount: 0, validationScore: 90, passed: false },
            profile: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
            terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
            reference: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
            businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
            metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
          }
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      await validationService.validateResource('Patient', 'patient-123');

      expect(mockStorage.createValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          performanceMetrics: expect.objectContaining({
            totalDurationMs: 150,
            aspectBreakdown: expect.objectContaining({
              structural: { durationMs: 100, issueCount: 1 }
            })
          })
        })
      );
    });

    it('should include validation engine version in results', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      await validationService.validateResource('Patient', 'patient-123');

      expect(mockStorage.createValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          validationEngineVersion: expect.any(String)
        })
      );
    });

    it('should include timestamps in validation results', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const beforeValidation = new Date();
      await validationService.validateResource('Patient', 'patient-123');
      const afterValidation = new Date();

      expect(mockStorage.createValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          lastValidated: expect.any(Date),
          validatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      );

      const createCall = vi.mocked(mockStorage.createValidationResult).mock.calls[0][0];
      expect(createCall.lastValidated.getTime()).toBeGreaterThanOrEqual(beforeValidation.getTime());
      expect(createCall.lastValidated.getTime()).toBeLessThanOrEqual(afterValidation.getTime());
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle resource not found errors gracefully', async () => {
      vi.mocked(mockStorage.getFhirResourceByTypeAndId).mockResolvedValue(undefined);

      await expect(validationService.validateResource('Patient', 'nonexistent-patient'))
        .rejects.toThrow('Resource not found');
    });

    it('should handle validation settings service errors gracefully', async () => {
      vi.mocked(mockSettingsService.getActiveSettings).mockRejectedValue(new Error('Settings service error'));

      await expect(validationService.validateResource('Patient', 'patient-123'))
        .rejects.toThrow('Settings service error');
    });

    it('should handle validation pipeline errors gracefully', async () => {
      vi.mocked(mockPipeline.executePipeline).mockRejectedValue(new Error('Pipeline error'));

      await expect(validationService.validateResource('Patient', 'patient-123'))
        .rejects.toThrow('Pipeline error');
    });

    it('should handle concurrent validation requests correctly', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      // Simulate concurrent validation requests
      const promises = [
        validationService.validateResource('Patient', 'patient-123'),
        validationService.validateResource('Patient', 'patient-123'),
        validationService.validateResource('Patient', 'patient-123')
      ];

      const results = await Promise.all(promises);

      // Verify all requests completed successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.validationResults).toBeDefined();
      });

      // Verify storage was called for each validation
      expect(mockStorage.createValidationResult).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed validation results gracefully', async () => {
      const malformedPipelineResult = {
        success: true,
        results: [{
          // Missing required fields
          resourceId: 123
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(malformedPipelineResult);

      await expect(validationService.validateResource('Patient', 'patient-123'))
        .rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency validation requests efficiently', async () => {
      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100,
          issues: [],
          performanceMetrics: {},
          aspectBreakdown: {}
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const startTime = Date.now();

      // Simulate high-frequency validation requests
      const promises = Array.from({ length: 50 }, (_, i) => 
        validationService.validateResource('Patient', `patient-${i}`)
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all validations completed
      expect(mockStorage.createValidationResult).toHaveBeenCalledTimes(50);
      
      // Verify performance is acceptable (adjust threshold as needed)
      expect(processingTime).toBeLessThan(10000); // 10 seconds
    });

    it('should handle large validation result payloads efficiently', async () => {
      const largeIssues = Array.from({ length: 1000 }, (_, i) => ({
        aspect: 'structural',
        severity: 'error',
        message: `Large validation error ${i}`,
        location: `location-${i}`
      }));

      const mockPipelineResult = {
        success: true,
        results: [{
          resourceId: 123,
          isValid: false,
          hasErrors: true,
          hasWarnings: false,
          errorCount: 1000,
          warningCount: 0,
          informationCount: 0,
          validationScore: 0,
          issues: largeIssues,
          performanceMetrics: {
            totalDurationMs: 5000,
            aspectBreakdown: {
              structural: { durationMs: 5000, issueCount: 1000 }
            }
          },
          aspectBreakdown: {
            structural: { enabled: true, issueCount: 1000, errorCount: 1000, warningCount: 0, informationCount: 0, validationScore: 0, passed: false }
          }
        }]
      };

      vi.mocked(mockPipeline.executePipeline).mockResolvedValue(mockPipelineResult);

      const startTime = Date.now();

      await validationService.validateResource('Patient', 'patient-123');

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify large payload was handled
      expect(mockStorage.createValidationResult).toHaveBeenCalledWith(
        expect.objectContaining({
          issues: largeIssues,
          errorCount: 1000
        })
      );

      // Verify performance is acceptable for large payloads
      expect(processingTime).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Consolidated Validation Service Methods', () => {
    it('should get validation results by request ID', async () => {
      const requestId = 'req-123';
      const mockResults = [mockValidationResult];
      
      vi.mocked(mockStorage.getValidationResultsByRequestId).mockResolvedValue(mockResults);

      const results = await mockStorage.getValidationResultsByRequestId(requestId);

      expect(mockStorage.getValidationResultsByRequestId).toHaveBeenCalledWith(requestId);
      expect(results).toEqual(mockResults);
    });

    it('should get validation results by batch ID', async () => {
      const batchId = 'batch-456';
      const mockResults = [mockValidationResult];
      
      vi.mocked(mockStorage.getValidationResultsByBatchId).mockResolvedValue(mockResults);

      const results = await mockStorage.getValidationResultsByBatchId(batchId);

      expect(mockStorage.getValidationResultsByBatchId).toHaveBeenCalledWith(batchId);
      expect(results).toEqual(mockResults);
    });

    it('should get validation results by status', async () => {
      const status = 'completed';
      const limit = 50;
      const mockResults = [mockValidationResult];
      
      vi.mocked(mockStorage.getValidationResultsByStatus).mockResolvedValue(mockResults);

      const results = await mockStorage.getValidationResultsByStatus(status, limit);

      expect(mockStorage.getValidationResultsByStatus).toHaveBeenCalledWith(status, limit);
      expect(results).toEqual(mockResults);
    });

    it('should update validation result status', async () => {
      const resultId = 123;
      const status = 'failed';
      const errorMessage = 'Validation failed';
      const errorDetails = { code: 'VALIDATION_ERROR', details: 'Invalid resource structure' };

      await mockStorage.updateValidationResultStatus(resultId, status, errorMessage, errorDetails);

      expect(mockStorage.updateValidationResultStatus).toHaveBeenCalledWith(
        resultId, 
        status, 
        errorMessage, 
        errorDetails
      );
    });

    it('should get validation results by resource type', async () => {
      const resourceType = 'Patient';
      const limit = 100;
      const mockResults = [mockValidationResult];
      
      vi.mocked(mockStorage.getValidationResultsByResourceType).mockResolvedValue(mockResults);

      const results = await mockStorage.getValidationResultsByResourceType(resourceType, limit);

      expect(mockStorage.getValidationResultsByResourceType).toHaveBeenCalledWith(resourceType, limit);
      expect(results).toEqual(mockResults);
    });

    it('should get validation performance metrics', async () => {
      const resourceType = 'Patient';
      const days = 30;
      const mockMetrics = {
        resourceType: 'Patient',
        validationStatus: 'completed',
        totalValidations: 100,
        avgDurationMs: 150,
        minDurationMs: 50,
        maxDurationMs: 500,
        avgValidationScore: 85,
        avgConfidenceScore: 90,
        avgCompletenessScore: 88,
        validCount: 80,
        invalidCount: 20,
        errorCount: 15,
        warningCount: 25
      };
      
      vi.mocked(mockStorage.getValidationPerformanceMetrics).mockResolvedValue([mockMetrics]);

      const metrics = await mockStorage.getValidationPerformanceMetrics(resourceType, days);

      expect(mockStorage.getValidationPerformanceMetrics).toHaveBeenCalledWith(resourceType, days);
      expect(metrics).toEqual([mockMetrics]);
    });

    it('should get validation aspect breakdown', async () => {
      const resourceType = 'Patient';
      const days = 30;
      const mockBreakdown = {
        resourceType: 'Patient',
        validationStatus: 'completed',
        totalValidations: 100,
        structuralValidCount: 95,
        profileValidCount: 90,
        terminologyValidCount: 85,
        referenceValidCount: 88,
        businessRuleValidCount: 92,
        metadataValidCount: 98,
        avgStructuralDurationMs: 50,
        avgProfileDurationMs: 75,
        avgTerminologyDurationMs: 100,
        avgReferenceDurationMs: 60,
        avgBusinessRuleDurationMs: 80,
        avgMetadataDurationMs: 40
      };
      
      vi.mocked(mockStorage.getValidationAspectBreakdown).mockResolvedValue([mockBreakdown]);

      const breakdown = await mockStorage.getValidationAspectBreakdown(resourceType, days);

      expect(mockStorage.getValidationAspectBreakdown).toHaveBeenCalledWith(resourceType, days);
      expect(breakdown).toEqual([mockBreakdown]);
    });

    it('should handle validation result status updates with different statuses', async () => {
      const resultId = 123;

      // Test completed status
      await mockStorage.updateValidationResultStatus(resultId, 'completed');
      expect(mockStorage.updateValidationResultStatus).toHaveBeenCalledWith(resultId, 'completed');

      // Test cancelled status
      await mockStorage.updateValidationResultStatus(resultId, 'cancelled');
      expect(mockStorage.updateValidationResultStatus).toHaveBeenCalledWith(resultId, 'cancelled');

      // Test failed status with error details
      const errorMessage = 'Validation failed';
      const errorDetails = { code: 'INVALID_RESOURCE' };
      await mockStorage.updateValidationResultStatus(resultId, 'failed', errorMessage, errorDetails);
      expect(mockStorage.updateValidationResultStatus).toHaveBeenCalledWith(
        resultId, 
        'failed', 
        errorMessage, 
        errorDetails
      );
    });

    it('should handle empty results gracefully', async () => {
      // Test empty results for various methods
      vi.mocked(mockStorage.getValidationResultsByRequestId).mockResolvedValue([]);
      vi.mocked(mockStorage.getValidationResultsByBatchId).mockResolvedValue([]);
      vi.mocked(mockStorage.getValidationResultsByStatus).mockResolvedValue([]);
      vi.mocked(mockStorage.getValidationResultsByResourceType).mockResolvedValue([]);
      vi.mocked(mockStorage.getValidationPerformanceMetrics).mockResolvedValue([]);
      vi.mocked(mockStorage.getValidationAspectBreakdown).mockResolvedValue([]);

      expect(await mockStorage.getValidationResultsByRequestId('req-123')).toEqual([]);
      expect(await mockStorage.getValidationResultsByBatchId('batch-456')).toEqual([]);
      expect(await mockStorage.getValidationResultsByStatus('pending')).toEqual([]);
      expect(await mockStorage.getValidationResultsByResourceType('Patient')).toEqual([]);
      expect(await mockStorage.getValidationPerformanceMetrics()).toEqual([]);
      expect(await mockStorage.getValidationAspectBreakdown()).toEqual([]);
    });
  });
});
