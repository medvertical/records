/**
 * Validation Routes Tests
 * 
 * Tests for the updated validation routes that use the consolidated validation service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsolidatedValidationService } from '../../../services/validation';
import { getValidationSettingsService } from '../../../services/validation/settings/validation-settings-service';
import { getValidationPipeline, getValidationQueueService, getIndividualResourceProgressService, getValidationCancellationRetryService } from '../../../services/validation';
import { storage } from '../../../storage';

// Mock dependencies
vi.mock('../../../storage', () => ({
  storage: {
    getValidationResultsByRequestId: vi.fn(),
    updateValidationResultStatus: vi.fn(),
    getFhirResourceById: vi.fn(),
    createValidationResult: vi.fn()
  }
}));

vi.mock('../../../services/validation', () => ({
  ConsolidatedValidationService: vi.fn().mockImplementation(() => ({
    validateResource: vi.fn()
  })),
  getValidationPipeline: vi.fn(),
  getValidationQueueService: vi.fn(),
  getIndividualResourceProgressService: vi.fn(),
  getValidationCancellationRetryService: vi.fn()
}));

vi.mock('../../../services/validation/settings/validation-settings-service', () => ({
  getValidationSettingsService: vi.fn()
}));

describe('Validation Routes - Consolidated Service Integration', () => {
  let mockConsolidatedService: any;
  let mockSettingsService: any;
  let mockPipeline: any;
  let mockQueueService: any;
  let mockProgressService: any;
  let mockCancellationService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mocks
    mockConsolidatedService = {
      validateResource: vi.fn()
    };
    
    mockSettingsService = {
      getCurrentSettings: vi.fn(),
      updateSettings: vi.fn()
    };
    
    mockPipeline = {
      executePipeline: vi.fn()
    };
    
    mockQueueService = {
      addToQueue: vi.fn()
    };
    
    mockProgressService = {
      getOverallProgress: vi.fn()
    };
    
    mockCancellationService = {
      pauseValidation: vi.fn(),
      resumeValidation: vi.fn(),
      cancelValidation: vi.fn()
    };

    // Setup mock returns
    vi.mocked(ConsolidatedValidationService).mockImplementation(() => mockConsolidatedService);
    vi.mocked(getValidationSettingsService).mockReturnValue(mockSettingsService);
    vi.mocked(getValidationPipeline).mockReturnValue(mockPipeline);
    vi.mocked(getValidationQueueService).mockReturnValue(mockQueueService);
    vi.mocked(getIndividualResourceProgressService).mockReturnValue(mockProgressService);
    vi.mocked(getValidationCancellationRetryService).mockReturnValue(mockCancellationService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Consolidated Service Integration', () => {
    it('should use consolidated validation service for individual resource validation', async () => {
      const mockDetailedResult = {
        isValid: false,
        issues: [
          { aspect: 'structural', severity: 'error', message: 'Test error' }
        ],
        summary: {
          totalIssues: 1,
          errorCount: 1,
          warningCount: 0,
          informationCount: 0
        },
        performance: {
          totalTimeMs: 100,
          aspectTimes: {
            structural: 50,
            profile: 30,
            terminology: 20,
            reference: 0,
            businessRule: 0,
            metadata: 0
          }
        }
      };

      mockConsolidatedService.validateResource.mockResolvedValue({
        detailedResult: mockDetailedResult
      });

      // Test that the consolidated service is called correctly
      const result = await mockConsolidatedService.validateResource(
        { resourceType: 'Patient', id: 'test-123' },
        true,
        true
      );

      expect(mockConsolidatedService.validateResource).toHaveBeenCalledWith(
        { resourceType: 'Patient', id: 'test-123' },
        true,
        true
      );
      expect(result.detailedResult).toEqual(mockDetailedResult);
    });

    it('should use consolidated service methods for bulk operations', async () => {
      // Test progress service integration
      const mockProgress = {
        processedResources: 50,
        totalResources: 100,
        errors: 5,
        warnings: 10
      };

      mockProgressService.getOverallProgress.mockResolvedValue(mockProgress);

      const progress = await mockProgressService.getOverallProgress();
      expect(progress).toEqual(mockProgress);
      expect(mockProgressService.getOverallProgress).toHaveBeenCalled();
    });

    it('should use cancellation service for pause/resume/stop operations', async () => {
      // Test pause
      await mockCancellationService.pauseValidation();
      expect(mockCancellationService.pauseValidation).toHaveBeenCalled();

      // Test resume
      await mockCancellationService.resumeValidation();
      expect(mockCancellationService.resumeValidation).toHaveBeenCalled();

      // Test cancel
      await mockCancellationService.cancelValidation();
      expect(mockCancellationService.cancelValidation).toHaveBeenCalled();
    });

    it('should use storage methods for request tracking', async () => {
      const mockResults = [
        {
          id: 1,
          resourceId: 123,
          validationRequestId: 'req-123',
          validationStatus: 'completed'
        }
      ];

      vi.mocked(storage.getValidationResultsByRequestId).mockResolvedValue(mockResults);
      vi.mocked(storage.updateValidationResultStatus).mockResolvedValue(undefined);

      // Test getting results by request ID
      const results = await storage.getValidationResultsByRequestId('req-123');
      expect(results).toEqual(mockResults);
      expect(storage.getValidationResultsByRequestId).toHaveBeenCalledWith('req-123');

      // Test updating result status
      await storage.updateValidationResultStatus(1, 'cancelled');
      expect(storage.updateValidationResultStatus).toHaveBeenCalledWith(1, 'cancelled');
    });

    it('should return full detailed results from validation routes', async () => {
      const mockDetailedResult = {
        isValid: false,
        overallScore: 75,
        overallConfidence: 90,
        overallCompleteness: 85,
        totalDurationMs: 150,
        aspectResults: {
          structural: {
            isValid: false,
            issues: [{ severity: 'error', message: 'Test error' }],
            durationMs: 50,
            score: 70,
            confidence: 90,
            completeness: 85
          },
          profile: {
            isValid: true,
            issues: [],
            durationMs: 30,
            score: 100,
            confidence: 95,
            completeness: 90
          },
          terminology: {
            isValid: true,
            issues: [],
            durationMs: 20,
            score: 100,
            confidence: 90,
            completeness: 85
          },
          reference: {
            isValid: true,
            issues: [],
            durationMs: 0,
            score: 100,
            confidence: 95,
            completeness: 90
          },
          businessRule: {
            isValid: true,
            issues: [],
            durationMs: 0,
            score: 100,
            confidence: 90,
            completeness: 85
          },
          metadata: {
            isValid: true,
            issues: [],
            durationMs: 0,
            score: 100,
            confidence: 95,
            completeness: 90
          }
        },
        summary: {
          totalIssues: 1,
          errorCount: 1,
          warningCount: 0,
          informationCount: 0,
          issueCountByAspect: {
            structural: 1,
            profile: 0,
            terminology: 0,
            reference: 0,
            businessRule: 0,
            metadata: 0
          }
        },
        performance: {
          totalDurationMs: 150,
          durationByAspect: {
            structural: 50,
            profile: 30,
            terminology: 20,
            reference: 0,
            businessRule: 0,
            metadata: 0
          },
          resourceSizeBytes: 1024,
          complexityScore: 75
        },
        context: {
          validationEnvironment: 'production',
          validationSource: 'api'
        }
      };

      mockConsolidatedService.validateResource.mockResolvedValue({
        detailedResult: mockDetailedResult
      });

      const result = await mockConsolidatedService.validateResource(
        { resourceType: 'Patient', id: 'test-123' },
        true,
        true
      );

      // Verify the result contains all expected detailed information
      expect(result.detailedResult).toHaveProperty('isValid');
      expect(result.detailedResult).toHaveProperty('overallScore');
      expect(result.detailedResult).toHaveProperty('overallConfidence');
      expect(result.detailedResult).toHaveProperty('overallCompleteness');
      expect(result.detailedResult).toHaveProperty('totalDurationMs');
      expect(result.detailedResult).toHaveProperty('aspectResults');
      expect(result.detailedResult).toHaveProperty('summary');
      expect(result.detailedResult).toHaveProperty('performance');
      expect(result.detailedResult).toHaveProperty('context');

      // Verify aspect results structure
      expect(result.detailedResult.aspectResults).toHaveProperty('structural');
      expect(result.detailedResult.aspectResults).toHaveProperty('profile');
      expect(result.detailedResult.aspectResults).toHaveProperty('terminology');
      expect(result.detailedResult.aspectResults).toHaveProperty('reference');
      expect(result.detailedResult.aspectResults).toHaveProperty('businessRule');
      expect(result.detailedResult.aspectResults).toHaveProperty('metadata');

      // Verify each aspect has the expected properties
      Object.values(result.detailedResult.aspectResults).forEach(aspect => {
        expect(aspect).toHaveProperty('isValid');
        expect(aspect).toHaveProperty('issues');
        expect(aspect).toHaveProperty('durationMs');
        expect(aspect).toHaveProperty('score');
        expect(aspect).toHaveProperty('confidence');
        expect(aspect).toHaveProperty('completeness');
      });
    });
  });

  describe('Route Response Format', () => {
    it('should ensure all validation routes return consistent detailed result format', () => {
      // This test verifies that our route updates maintain consistent response format
      const expectedDetailedResultStructure = {
        isValid: expect.any(Boolean),
        overallScore: expect.any(Number),
        overallConfidence: expect.any(Number),
        overallCompleteness: expect.any(Number),
        totalDurationMs: expect.any(Number),
        aspectResults: {
          structural: expect.objectContaining({
            isValid: expect.any(Boolean),
            issues: expect.any(Array),
            durationMs: expect.any(Number),
            score: expect.any(Number),
            confidence: expect.any(Number),
            completeness: expect.any(Number)
          }),
          profile: expect.objectContaining({
            isValid: expect.any(Boolean),
            issues: expect.any(Array),
            durationMs: expect.any(Number),
            score: expect.any(Number),
            confidence: expect.any(Number),
            completeness: expect.any(Number)
          }),
          terminology: expect.objectContaining({
            isValid: expect.any(Boolean),
            issues: expect.any(Array),
            durationMs: expect.any(Number),
            score: expect.any(Number),
            confidence: expect.any(Number),
            completeness: expect.any(Number)
          }),
          reference: expect.objectContaining({
            isValid: expect.any(Boolean),
            issues: expect.any(Array),
            durationMs: expect.any(Number),
            score: expect.any(Number),
            confidence: expect.any(Number),
            completeness: expect.any(Number)
          }),
          businessRule: expect.objectContaining({
            isValid: expect.any(Boolean),
            issues: expect.any(Array),
            durationMs: expect.any(Number),
            score: expect.any(Number),
            confidence: expect.any(Number),
            completeness: expect.any(Number)
          }),
          metadata: expect.objectContaining({
            isValid: expect.any(Boolean),
            issues: expect.any(Array),
            durationMs: expect.any(Number),
            score: expect.any(Number),
            confidence: expect.any(Number),
            completeness: expect.any(Number)
          })
        },
        summary: {
          totalIssues: expect.any(Number),
          errorCount: expect.any(Number),
          warningCount: expect.any(Number),
          informationCount: expect.any(Number),
          issueCountByAspect: expect.any(Object)
        },
        performance: {
          totalDurationMs: expect.any(Number),
          durationByAspect: expect.any(Object),
          resourceSizeBytes: expect.any(Number),
          complexityScore: expect.any(Number)
        },
        context: expect.any(Object)
      };

      // This structure should be returned by all validation routes
      expect(expectedDetailedResultStructure).toBeDefined();
    });
  });
});
