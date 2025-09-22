import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../db';
import { validationSettings } from '@shared/schema';

// Mock dependencies
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  }
}));

vi.mock('../services/fhir/fhir-client', () => ({
  FhirClient: vi.fn().mockImplementation(() => ({
    searchResources: vi.fn(),
    getResource: vi.fn(),
    getResourcesByType: vi.fn()
  }))
}));

vi.mock('../services/validation/validation-pipeline', () => ({
  getValidationPipeline: () => ({
    executePipeline: vi.fn(),
    cancelPipeline: vi.fn()
  })
}));

vi.mock('../services/validation/validation-settings-service', () => ({
  getValidationSettingsService: () => ({
    getActiveSettings: vi.fn(),
    updateSettings: vi.fn()
  })
}));

vi.mock('../storage', () => ({
  getResourceById: vi.fn(),
  getResourceStatsWithSettings: vi.fn(),
  storeValidationResult: vi.fn(),
  clearAllValidationResults: vi.fn()
}));

// Import the app after mocking
import app from '../index';

describe('Validation API Integration Tests', () => {
  let server: any;

  const mockResources = [
    {
      resourceId: 1,
      resourceType: 'Patient',
      data: {
        id: 'patient-1',
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }]
      }
    },
    {
      resourceId: 2,
      resourceType: 'Patient',
      data: {
        id: 'patient-2',
        resourceType: 'Patient',
        name: [{ given: ['Jane'], family: 'Smith' }]
      }
    },
    {
      resourceId: 3,
      resourceType: 'Observation',
      data: {
        id: 'observation-1',
        resourceType: 'Observation',
        code: { text: 'Blood Pressure' }
      }
    }
  ];

  const mockValidationResult = {
    resourceId: 1,
    resourceType: 'Patient',
    validationId: 'validation-123',
    isValid: true,
    hasErrors: false,
    hasWarnings: false,
    errorCount: 0,
    warningCount: 0,
    informationCount: 0,
    validationScore: 100,
    lastValidated: new Date().toISOString(),
    aspectBreakdown: {
      structural: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      profile: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      reference: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true },
      metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true }
    },
    issues: []
  };

  const mockValidationSettings = {
    id: 'settings-1',
    name: 'Default Settings',
    settings: {
      structural: { enabled: true, severity: 'error' },
      profile: { enabled: true, severity: 'error' },
      terminology: { enabled: true, severity: 'warning' },
      reference: { enabled: true, severity: 'error' },
      businessRule: { enabled: true, severity: 'warning' },
      metadata: { enabled: true, severity: 'info' }
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    server = app;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/validation/validate-by-ids', () => {
    it('should validate specific resources by IDs successfully', async () => {
      // Mock database responses
      const { getResourceById } = await import('../storage');
      vi.mocked(getResourceById).mockResolvedValue(mockResources[0]);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockResolvedValue({
          success: true,
          results: [mockValidationResult]
        }),
        cancelPipeline: vi.fn()
      });

      const { storeValidationResult } = await import('../storage');
      vi.mocked(storeValidationResult).mockResolvedValue(mockValidationResult);

      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: [1, 2, 3],
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Validation completed');
      expect(response.body.data.validatedCount).toBe(3);
      expect(response.body.data.totalCount).toBe(3);

      // Verify validation pipeline was called
      expect(getValidationPipeline().executePipeline).toHaveBeenCalled();
    });

    it('should handle validation errors gracefully', async () => {
      // Mock validation pipeline error
      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockRejectedValue(new Error('Validation pipeline error')),
        cancelPipeline: vi.fn()
      });

      const { getResourceById } = await import('../storage');
      vi.mocked(getResourceById).mockResolvedValue(mockResources[0]);

      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: [1],
          forceRevalidation: false
        })
        .expect(500);

      expect(response.body.message).toContain('Validation failed');
    });

    it('should handle invalid resource IDs', async () => {
      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: 'invalid', // Should be array
          forceRevalidation: false
        })
        .expect(400);

      expect(response.body.message).toContain('Resource IDs array is required');
    });

    it('should handle empty resource IDs array', async () => {
      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: [],
          forceRevalidation: false
        })
        .expect(400);

      expect(response.body.message).toContain('At least one resource ID is required');
    });

    it('should support force revalidation parameter', async () => {
      const { getResourceById } = await import('../storage');
      vi.mocked(getResourceById).mockResolvedValue(mockResources[0]);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockResolvedValue({
          success: true,
          results: [mockValidationResult]
        }),
        cancelPipeline: vi.fn()
      });

      const { storeValidationResult } = await import('../storage');
      vi.mocked(storeValidationResult).mockResolvedValue(mockValidationResult);

      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: [1],
          forceRevalidation: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.forceRevalidation).toBe(true);
    });

    it('should handle retry logic for failed validation attempts', async () => {
      const { getResourceById } = await import('../storage');
      vi.mocked(getResourceById).mockResolvedValue(mockResources[0]);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      let attemptCount = 0;
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Temporary validation failure');
          }
          return Promise.resolve({
            success: true,
            results: [mockValidationResult]
          });
        }),
        cancelPipeline: vi.fn()
      });

      const { storeValidationResult } = await import('../storage');
      vi.mocked(storeValidationResult).mockResolvedValue(mockValidationResult);

      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: [1],
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(attemptCount).toBe(2); // Should retry once after first failure
    });

    it('should handle missing resources gracefully', async () => {
      const { getResourceById } = await import('../storage');
      vi.mocked(getResourceById).mockResolvedValue(null); // Resource not found

      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: [999], // Non-existent resource
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.data.validatedCount).toBe(0);
      expect(response.body.data.totalCount).toBe(1);
      expect(response.body.data.missingResources).toContain(999);
    });
  });

  describe('GET /api/validation/settings', () => {
    it('should return active validation settings', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      vi.mocked(getValidationSettingsService).mockReturnValue({
        getActiveSettings: vi.fn().mockResolvedValue(mockValidationSettings),
        updateSettings: vi.fn()
      });

      const response = await request(server)
        .get('/api/validation/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockValidationSettings);
      expect(response.body.data.settings.structural.enabled).toBe(true);
    });

    it('should handle missing validation settings', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      vi.mocked(getValidationSettingsService).mockReturnValue({
        getActiveSettings: vi.fn().mockResolvedValue(null),
        updateSettings: vi.fn()
      });

      const response = await request(server)
        .get('/api/validation/settings')
        .expect(404);

      expect(response.body.message).toContain('No active validation settings found');
    });

    it('should handle validation settings service errors', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      vi.mocked(getValidationSettingsService).mockReturnValue({
        getActiveSettings: vi.fn().mockRejectedValue(new Error('Database error')),
        updateSettings: vi.fn()
      });

      const response = await request(server)
        .get('/api/validation/settings')
        .expect(500);

      expect(response.body.message).toContain('Failed to fetch validation settings');
    });
  });

  describe('POST /api/validation/settings', () => {
    it('should update validation settings successfully', async () => {
      const updatedSettings = {
        structural: { enabled: false, severity: 'error' },
        profile: { enabled: true, severity: 'warning' },
        terminology: { enabled: true, severity: 'error' },
        reference: { enabled: false, severity: 'error' },
        businessRule: { enabled: true, severity: 'warning' },
        metadata: { enabled: true, severity: 'info' }
      };

      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      vi.mocked(getValidationSettingsService).mockReturnValue({
        getActiveSettings: vi.fn().mockResolvedValue(mockValidationSettings),
        updateSettings: vi.fn().mockResolvedValue({
          ...mockValidationSettings,
          settings: updatedSettings
        })
      });

      const response = await request(server)
        .post('/api/validation/settings')
        .send({
          settings: updatedSettings
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.structural.enabled).toBe(false);
      expect(response.body.data.settings.profile.severity).toBe('warning');
    });

    it('should validate settings format before updating', async () => {
      const invalidSettings = {
        structural: { enabled: 'invalid', severity: 'error' }, // Invalid boolean
        profile: { enabled: true, severity: 'invalid' } // Invalid severity
      };

      const response = await request(server)
        .post('/api/validation/settings')
        .send({
          settings: invalidSettings
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid validation settings format');
    });

    it('should handle missing settings in request', async () => {
      const response = await request(server)
        .post('/api/validation/settings')
        .send({})
        .expect(400);

      expect(response.body.message).toContain('Validation settings are required');
    });
  });

  describe('POST /api/validation/bulk/start', () => {
    it('should start bulk validation successfully', async () => {
      const { FhirClient } = await import('../services/fhir/fhir-client');
      const mockFhirClient = {
        searchResources: vi.fn().mockResolvedValue({
          entry: mockResources.map(r => ({ resource: r.data }))
        }),
        getResource: vi.fn(),
        getResourcesByType: vi.fn()
      };
      vi.mocked(FhirClient).mockImplementation(() => mockFhirClient);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockResolvedValue({
          success: true,
          results: [mockValidationResult]
        }),
        cancelPipeline: vi.fn()
      });

      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Validation started');
    });

    it('should use configured batch size from validation settings', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = {
        getActiveSettings: vi.fn().mockResolvedValue({
          ...mockValidationSettings,
          batchProcessingSettings: {
            defaultBatchSize: 100,
            minBatchSize: 50,
            maxBatchSize: 500,
            pauseBetweenBatches: true,
            pauseDurationMs: 1000,
            useAdaptiveBatchSizing: false,
            retryFailedBatches: true,
            maxRetryAttempts: 3,
            retryDelayMs: 2000
          }
        }),
        updateSettings: vi.fn()
      };
      vi.mocked(getValidationSettingsService).mockReturnValue(mockSettingsService);

      const { FhirClient } = await import('../services/fhir/fhir-client');
      const mockFhirClient = {
        getAllResourceTypes: vi.fn().mockResolvedValue(['Patient', 'Observation']),
        getResourceCount: vi.fn().mockResolvedValue(1000),
        searchResources: vi.fn().mockResolvedValue({
          entry: mockResources.map(r => ({ resource: r.data }))
        }),
        getResource: vi.fn(),
        getResourcesByType: vi.fn()
      };
      vi.mocked(FhirClient).mockImplementation(() => mockFhirClient);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockResolvedValue({
          success: true,
          results: [mockValidationResult]
        }),
        cancelPipeline: vi.fn()
      });

      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSettingsService.getActiveSettings).toHaveBeenCalled();
    });

    it('should apply resource type filtering when enabled', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = {
        getActiveSettings: vi.fn().mockResolvedValue({
          ...mockValidationSettings,
          resourceTypeFilterSettings: {
            enabled: true,
            mode: 'include',
            resourceTypes: ['Patient', 'Observation']
          },
          batchProcessingSettings: {
            defaultBatchSize: 200,
            minBatchSize: 50,
            maxBatchSize: 500,
            pauseBetweenBatches: false,
            pauseDurationMs: 100,
            useAdaptiveBatchSizing: false,
            retryFailedBatches: false,
            maxRetryAttempts: 1,
            retryDelayMs: 1000
          }
        }),
        updateSettings: vi.fn()
      };
      vi.mocked(getValidationSettingsService).mockReturnValue(mockSettingsService);

      const { FhirClient } = await import('../services/fhir/fhir-client');
      const mockFhirClient = {
        getAllResourceTypes: vi.fn().mockResolvedValue(['Patient', 'Observation', 'DiagnosticReport', 'Medication']),
        getResourceCount: vi.fn().mockResolvedValue(1000),
        searchResources: vi.fn().mockResolvedValue({
          entry: mockResources.map(r => ({ resource: r.data }))
        }),
        getResource: vi.fn(),
        getResourcesByType: vi.fn()
      };
      vi.mocked(FhirClient).mockImplementation(() => mockFhirClient);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockResolvedValue({
          success: true,
          results: [mockValidationResult]
        }),
        cancelPipeline: vi.fn()
      });

      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSettingsService.getActiveSettings).toHaveBeenCalled();
    });

    it('should handle bulk validation when already running', async () => {
      // Mock global validation state as running
      const mockGlobalState = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        startTime: new Date(),
        canPause: true,
        resumeData: null,
        currentResourceType: null,
        nextResourceType: null,
        lastBroadcastTime: null
      };

      // This would require mocking the global state in the actual implementation
      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(409);

      expect(response.body.message).toContain('Validation is already running');
    });

    it('should handle FHIR client errors during bulk validation', async () => {
      const { FhirClient } = await import('../services/fhir/fhir-client');
      const mockFhirClient = {
        searchResources: vi.fn().mockRejectedValue(new Error('FHIR server connection failed')),
        getResource: vi.fn(),
        getResourcesByType: vi.fn()
      };
      vi.mocked(FhirClient).mockImplementation(() => mockFhirClient);

      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(500);

      expect(response.body.message).toContain('Failed to start bulk validation');
    });
  });

  describe('GET /api/validation/progress', () => {
    it('should return validation progress information', async () => {
      const mockProgress = {
        isRunning: true,
        isPaused: false,
        startTime: new Date().toISOString(),
        currentResourceType: 'Patient',
        nextResourceType: 'Observation',
        totalResources: 1000,
        processedResources: 250,
        validResources: 200,
        errorResources: 50,
        validationCoverage: 25,
        estimatedTimeRemaining: '00:15:00'
      };

      // Mock the global validation state
      const response = await request(server)
        .get('/api/validation/progress')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should include active validation aspects in progress response', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = {
        getActiveSettings: vi.fn().mockResolvedValue({
          ...mockValidationSettings,
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'warning' },
          terminology: { enabled: false, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: false, severity: 'warning' },
          metadata: { enabled: true, severity: 'information' }
        }),
        updateSettings: vi.fn()
      };
      vi.mocked(getValidationSettingsService).mockReturnValue(mockSettingsService);

      const { getResourceStatsWithSettings } = await import('../storage');
      vi.mocked(getResourceStatsWithSettings).mockResolvedValue({
        validResources: 100,
        errorResources: 50,
        warningResources: 25,
        totalValidated: 175
      });

      const response = await request(server)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(response.body.currentResourceType).toBeDefined();
      expect(response.body.nextResourceType).toBeDefined();
      expect(response.body.activeValidationAspects).toBeDefined();
      expect(response.body.activeValidationAspects.structural).toBe(true);
      expect(response.body.activeValidationAspects.terminology).toBe(false);
      expect(response.body.activeValidationAspects.businessRule).toBe(false);
    });

    it('should handle validation progress when not running', async () => {
      // Mock global validation state as not running
      const response = await request(server)
        .get('/api/validation/progress')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isRunning).toBe(false);
    });
  });

  describe('POST /api/validation/bulk/pause', () => {
    it('should pause running validation', async () => {
      // Mock global validation state as running
      const response = await request(server)
        .post('/api/validation/bulk/pause')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Validation paused');
    });

    it('should handle pause request when validation is not running', async () => {
      // Mock global validation state as not running
      const response = await request(server)
        .post('/api/validation/bulk/pause')
        .expect(400);

      expect(response.body.message).toContain('No validation is currently running');
    });
  });

  describe('POST /api/validation/bulk/resume', () => {
    it('should resume paused validation', async () => {
      // Mock global validation state as paused
      const response = await request(server)
        .post('/api/validation/bulk/resume')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Validation resumed');
    });

    it('should handle resume request when validation is not paused', async () => {
      // Mock global validation state as not paused
      const response = await request(server)
        .post('/api/validation/bulk/resume')
        .expect(400);

      expect(response.body.message).toContain('No paused validation found');
    });
  });

  describe('POST /api/validation/bulk/stop', () => {
    it('should stop running validation', async () => {
      const { clearAllValidationResults } = await import('../storage');
      vi.mocked(clearAllValidationResults).mockResolvedValue();

      const response = await request(server)
        .post('/api/validation/bulk/stop')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Validation stopped');
      expect(clearAllValidationResults).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      vi.mocked(getValidationSettingsService).mockReturnValue({
        getActiveSettings: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        updateSettings: vi.fn()
      });

      const response = await request(server)
        .get('/api/validation/settings')
        .expect(500);

      expect(response.body.message).toContain('Failed to fetch validation settings');
      expect(response.body.error).toBe('VALIDATION_SETTINGS_ERROR');
    });

    it('should handle service initialization errors', async () => {
      const { FhirClient } = await import('../services/fhir/fhir-client');
      vi.mocked(getFhirClient).mockReturnValue(null);

      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(400);

      expect(response.body.message).toContain('No FHIR server configured');
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send('invalid json')
        .expect(400);

      expect(response.body.message).toContain('Invalid request body');
    });

    it('should handle concurrent validation requests', async () => {
      // This test would verify that concurrent validation requests are handled properly
      // by checking that only one validation can run at a time
      const { FhirClient } = await import('../services/fhir/fhir-client');
      const mockFhirClient = {
        searchResources: vi.fn().mockResolvedValue({
          entry: mockResources.map(r => ({ resource: r.data }))
        }),
        getResource: vi.fn(),
        getResourcesByType: vi.fn()
      };
      vi.mocked(FhirClient).mockImplementation(() => mockFhirClient);

      // Start first validation
      const response1 = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(200);

      // Try to start second validation
      const response2 = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(409);

      expect(response2.body.message).toContain('Validation is already running');
    });
  });

  describe('Enhanced Backend Validation Workflow', () => {
    it('should handle batch processing with retry logic', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = {
        getActiveSettings: vi.fn().mockResolvedValue({
          ...mockValidationSettings,
          batchProcessingSettings: {
            defaultBatchSize: 50,
            minBatchSize: 10,
            maxBatchSize: 200,
            pauseBetweenBatches: false,
            pauseDurationMs: 100,
            useAdaptiveBatchSizing: false,
            retryFailedBatches: true,
            maxRetryAttempts: 2,
            retryDelayMs: 500
          }
        }),
        updateSettings: vi.fn()
      };
      vi.mocked(getValidationSettingsService).mockReturnValue(mockSettingsService);

      const { FhirClient } = await import('../services/fhir/fhir-client');
      const mockFhirClient = {
        getAllResourceTypes: vi.fn().mockResolvedValue(['Patient']),
        getResourceCount: vi.fn().mockResolvedValue(100),
        searchResources: vi.fn().mockResolvedValue({
          entry: mockResources.map(r => ({ resource: r.data }))
        }),
        getResource: vi.fn(),
        getResourcesByType: vi.fn()
      };
      vi.mocked(FhirClient).mockImplementation(() => mockFhirClient);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      let batchAttemptCount = 0;
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockImplementation(() => {
          batchAttemptCount++;
          if (batchAttemptCount < 2) {
            throw new Error('Batch processing failed');
          }
          return Promise.resolve({
            success: true,
            results: [mockValidationResult]
          });
        }),
        cancelPipeline: vi.fn()
      });

      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSettingsService.getActiveSettings).toHaveBeenCalled();
    });

    it('should apply resource type filtering with exclude mode', async () => {
      const { getValidationSettingsService } = await import('../services/validation/validation-settings-service');
      const mockSettingsService = {
        getActiveSettings: vi.fn().mockResolvedValue({
          ...mockValidationSettings,
          resourceTypeFilterSettings: {
            enabled: true,
            mode: 'exclude',
            resourceTypes: ['DiagnosticReport', 'Medication']
          },
          batchProcessingSettings: {
            defaultBatchSize: 200,
            minBatchSize: 50,
            maxBatchSize: 500,
            pauseBetweenBatches: false,
            pauseDurationMs: 100,
            useAdaptiveBatchSizing: false,
            retryFailedBatches: false,
            maxRetryAttempts: 1,
            retryDelayMs: 1000
          }
        }),
        updateSettings: vi.fn()
      };
      vi.mocked(getValidationSettingsService).mockReturnValue(mockSettingsService);

      const { FhirClient } = await import('../services/fhir/fhir-client');
      const mockFhirClient = {
        getAllResourceTypes: vi.fn().mockResolvedValue(['Patient', 'Observation', 'DiagnosticReport', 'Medication']),
        getResourceCount: vi.fn().mockResolvedValue(1000),
        searchResources: vi.fn().mockResolvedValue({
          entry: mockResources.map(r => ({ resource: r.data }))
        }),
        getResource: vi.fn(),
        getResourcesByType: vi.fn()
      };
      vi.mocked(FhirClient).mockImplementation(() => mockFhirClient);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockResolvedValue({
          success: true,
          results: [mockValidationResult]
        }),
        cancelPipeline: vi.fn()
      });

      const response = await request(server)
        .post('/api/validation/bulk/start')
        .send({
          forceRevalidation: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSettingsService.getActiveSettings).toHaveBeenCalled();
    });

    it('should include retry statistics in progress response', async () => {
      const { getResourceStatsWithSettings } = await import('../storage');
      vi.mocked(getResourceStatsWithSettings).mockResolvedValue({
        validResources: 100,
        errorResources: 50,
        warningResources: 25,
        totalValidated: 175
      });

      // Mock retry statistics calculation
      const mockDb = await import('../db');
      vi.mocked(mockDb.db.select).mockReturnValue({
        from: vi.fn().mockResolvedValue([
          { retryAttemptCount: 1, maxRetryAttempts: 3, isRetry: false, canRetry: true, totalRetryDurationMs: 0, isValid: true },
          { retryAttemptCount: 2, maxRetryAttempts: 3, isRetry: true, canRetry: false, totalRetryDurationMs: 1000, isValid: false },
          { retryAttemptCount: 1, maxRetryAttempts: 3, isRetry: false, canRetry: true, totalRetryDurationMs: 0, isValid: true }
        ])
      });

      const response = await request(server)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(response.body.retryStatistics).toBeDefined();
      expect(response.body.retryStatistics.totalRetryAttempts).toBeDefined();
      expect(response.body.retryStatistics.resourcesWithRetries).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large resource validation efficiently', async () => {
      const largeResourceList = Array.from({ length: 100 }, (_, i) => ({
        resourceId: i + 1,
        resourceType: 'Patient',
        data: {
          id: `patient-${i}`,
          resourceType: 'Patient',
          name: [{ given: [`Patient${i}`], family: 'Test' }]
        }
      }));

      const { getResourceById } = await import('../storage');
      vi.mocked(getResourceById).mockResolvedValue(largeResourceList[0]);

      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockResolvedValue({
          success: true,
          results: [mockValidationResult]
        }),
        cancelPipeline: vi.fn()
      });

      const { storeValidationResult } = await import('../storage');
      vi.mocked(storeValidationResult).mockResolvedValue(mockValidationResult);

      const startTime = Date.now();

      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: Array.from({ length: 100 }, (_, i) => i + 1),
          forceRevalidation: false
        })
        .expect(200);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.validatedCount).toBe(100);
      
      // Verify performance is acceptable (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle validation timeout scenarios', async () => {
      const { getValidationPipeline } = await import('../services/validation/validation-pipeline');
      vi.mocked(getValidationPipeline).mockReturnValue({
        executePipeline: vi.fn().mockImplementation(() => 
          new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second delay
        ),
        cancelPipeline: vi.fn()
      });

      const { getResourceById } = await import('../storage');
      vi.mocked(getResourceById).mockResolvedValue(mockResources[0]);

      // This test would verify timeout handling in a real implementation
      // For now, we just verify the pipeline is called
      const response = await request(server)
        .post('/api/validation/validate-by-ids')
        .send({
          resourceIds: [1],
          forceRevalidation: false
        });

      // In a real implementation, this might timeout or handle the long-running operation differently
      expect(getValidationPipeline().executePipeline).toHaveBeenCalled();
    });
  });
});
