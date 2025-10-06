/**
 * Integration Tests for Validation Control Panel API Endpoints
 * 
 * This file contains comprehensive integration tests for the bulk validation control endpoints:
 * - POST /api/validation/bulk/start
 * - POST /api/validation/bulk/stop
 * - POST /api/validation/bulk/pause
 * - POST /api/validation/bulk/resume
 * - GET /api/validation/bulk/progress
 * - POST /api/validation/bulk/restore
 * - GET /api/validation/bulk/restore-active
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
// Import the actual route handlers
import { setupBulkControlRoutes } from '../../../../server/routes/api/validation/bulk-control';

describe('Validation Control Panel API Integration Tests', () => {
  let app: express.Application;
  let testServerId: number = 1; // Mock server ID

  beforeEach(async () => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Setup validation routes
    setupBulkControlRoutes(app);
    
    // Mock external dependencies
    vi.mock('../../../services/validation', () => ({
      getValidationPipeline: vi.fn().mockReturnValue({
        startValidation: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-123' }),
        pauseValidation: vi.fn().mockResolvedValue({ success: true }),
        resumeValidation: vi.fn().mockResolvedValue({ success: true }),
        stopValidation: vi.fn().mockResolvedValue({ success: true }),
        getProgress: vi.fn().mockResolvedValue({
          isRunning: false,
          isPaused: false,
          processedResources: 0,
          totalResources: 100,
          errors: 0,
          warnings: 0
        })
      }),
      getValidationQueueService: vi.fn().mockReturnValue({
        getQueueStatus: vi.fn().mockResolvedValue({ active: 0, pending: 0, completed: 0 })
      }),
      getIndividualResourceProgressService: vi.fn().mockReturnValue({
        getProgressStats: vi.fn().mockResolvedValue({
          totalResources: 100,
          processedResources: 0,
          validResources: 0,
          errorResources: 0,
          warningResources: 0
        })
      }),
      getValidationCancellationRetryService: vi.fn().mockReturnValue({
        cancelValidation: vi.fn().mockResolvedValue({ success: true })
      }),
      ValidationPriority: {
        LOW: 'low',
        NORMAL: 'normal',
        HIGH: 'high'
      }
    }));

    vi.mock('../../../services/validation/settings/validation-settings-service-simplified', () => ({
      getValidationSettingsService: vi.fn().mockReturnValue({
        getActiveSettings: vi.fn().mockResolvedValue({
          id: 1,
          aspects: {
            structural: true,
            profile: true,
            terminology: false,
            reference: true,
            businessRule: false,
            metadata: false
          }
        })
      })
    }));

    vi.mock('../../../utils/server-scoping', () => ({
      getActiveServerId: vi.fn().mockResolvedValue(testServerId),
      getServerScopingContext: vi.fn().mockResolvedValue({
        serverId: testServerId,
        serverName: 'Test FHIR Server',
        serverUrl: 'https://test.fhir.server'
      })
    }));

    vi.mock('../../../services/performance/validation-performance-monitor', () => ({
      getValidationPerformanceMonitor: vi.fn().mockReturnValue({
        recordMetric: vi.fn()
      })
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/validation/bulk/start', () => {
    it('should start bulk validation with valid payload', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: {
          structural: true,
          profile: true,
          terminology: false,
          reference: true,
          businessRule: false,
          metadata: false
        },
        maxConcurrency: 5,
        priority: 'normal'
      };

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('Bulk validation started successfully'),
        jobId: expect.any(String),
        status: 'running',
        startTime: expect.any(String),
        estimatedDuration: expect.any(String),
        requestPayload: expect.objectContaining({
          resourceTypes: payload.resourceTypes,
          aspects: payload.aspects
        })
      });
    });

    it('should handle invalid payload with missing required fields', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid request payload',
        message: 'Request validation failed',
        details: expect.any(Array),
        code: 'INVALID_PAYLOAD'
      });
    });

    it('should handle invalid resource types', async () => {
      const payload = {
        resourceTypes: ['InvalidResourceType'],
        aspects: { structural: true }
      };

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid request payload');
    });

    it('should handle invalid aspects configuration', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { invalidAspect: true }
      };

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid request payload');
    });

    it('should handle concurrent validation attempts', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Start first validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Attempt to start second validation
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Validation already in progress',
        message: expect.stringContaining('A validation is already running'),
        code: 'VALIDATION_IN_PROGRESS'
      });
    });
  });

  describe('POST /api/validation/bulk/stop', () => {
    beforeEach(async () => {
      // Start a validation first
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        });
    });

    it('should stop running validation successfully', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Validation stopped successfully',
        status: 'stopped',
        stopTime: expect.any(String),
        processedResources: expect.any(Number),
        totalResources: expect.any(Number)
      });
    });

    it('should handle stop when no validation is running', async () => {
      // Stop the validation first
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      // Try to stop again
      const response = await request(app)
        .post('/api/validation/bulk/stop')
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'No validation in progress',
        message: expect.stringContaining('No validation is currently running'),
        code: 'NO_VALIDATION_IN_PROGRESS'
      });
    });
  });

  describe('POST /api/validation/bulk/pause', () => {
    beforeEach(async () => {
      // Start a validation first
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        });
    });

    it('should pause running validation successfully', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Validation paused successfully',
        status: 'paused',
        pauseTime: expect.any(String),
        processedResources: expect.any(Number),
        totalResources: expect.any(Number)
      });
    });

    it('should handle pause when no validation is running', async () => {
      // Stop the validation first
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      // Try to pause
      const response = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'No validation in progress',
        message: expect.stringContaining('No validation is currently running'),
        code: 'NO_VALIDATION_IN_PROGRESS'
      });
    });
  });

  describe('POST /api/validation/bulk/resume', () => {
    beforeEach(async () => {
      // Start and pause a validation first
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        });
      
      await request(app)
        .post('/api/validation/bulk/pause')
        .expect(200);
    });

    it('should resume paused validation successfully', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/resume')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Validation resumed successfully',
        status: 'running',
        resumeTime: expect.any(String),
        processedResources: expect.any(Number),
        totalResources: expect.any(Number)
      });
    });

    it('should handle resume when no validation is paused', async () => {
      // Resume the validation first
      await request(app)
        .post('/api/validation/bulk/resume')
        .expect(200);

      // Try to resume again
      const response = await request(app)
        .post('/api/validation/bulk/resume')
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'No validation paused',
        message: expect.stringContaining('No validation is currently paused'),
        code: 'NO_VALIDATION_PAUSED'
      });
    });
  });

  describe('GET /api/validation/bulk/progress', () => {
    it('should return progress when no validation is running', async () => {
      const response = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(response.body).toMatchObject({
        isRunning: false,
        isPaused: false,
        processedResources: 0,
        totalResources: 0,
        errors: 0,
        warnings: 0,
        progressPercentage: 0,
        estimatedTimeRemaining: null,
        processingRate: '0.0',
        currentResourceType: null,
        status: 'idle'
      });
    });

    it('should return progress when validation is running', async () => {
      // Start a validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        });

      const response = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(response.body).toMatchObject({
        isRunning: true,
        isPaused: false,
        processedResources: expect.any(Number),
        totalResources: expect.any(Number),
        errors: expect.any(Number),
        warnings: expect.any(Number),
        progressPercentage: expect.any(Number),
        status: 'running'
      });
    });

    it('should return progress when validation is paused', async () => {
      // Start and pause a validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        });
      
      await request(app)
        .post('/api/validation/bulk/pause')
        .expect(200);

      const response = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(response.body).toMatchObject({
        isRunning: false,
        isPaused: true,
        status: 'paused'
      });
    });
  });

  describe('POST /api/validation/bulk/restore', () => {
    it('should restore validation state with valid job ID', async () => {
      // Start a validation to create state
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        });

      const jobId = startResponse.body.jobId;

      const response = await request(app)
        .post('/api/validation/bulk/restore')
        .send({ jobId })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Validation state restored successfully',
        jobId,
        state: expect.any(Object),
        restored: true
      });
    });

    it('should handle restore with invalid job ID', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/restore')
        .send({ jobId: 'invalid-job-id' })
        .expect(404);

      expect(response.body).toMatchObject({
        message: 'No valid validation state found for the given job ID',
        jobId: 'invalid-job-id',
        restored: false
      });
    });

    it('should handle restore with missing job ID', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/restore')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        message: 'Job ID is required for state restoration',
        code: 'MISSING_JOB_ID'
      });
    });
  });

  describe('GET /api/validation/bulk/restore-active', () => {
    it('should restore active validation state when available', async () => {
      // Start a validation to create active state
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        });

      const response = await request(app)
        .get('/api/validation/bulk/restore-active')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Active validation state restored successfully',
        serverId: testServerId,
        serverName: 'Test FHIR Server',
        serverUrl: 'https://test.fhir.server',
        state: expect.any(Object),
        restored: true
      });
    });

    it('should handle restore when no active state exists', async () => {
      const response = await request(app)
        .get('/api/validation/bulk/restore-active')
        .expect(404);

      expect(response.body).toMatchObject({
        message: 'No active validation state found for the server',
        restored: false
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // Mock a server error
      vi.mocked(require('../../../services/validation').getValidationPipeline).mockReturnValue({
        startValidation: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal server error',
        message: expect.stringContaining('Database connection failed'),
        code: 'INTERNAL_SERVER_ERROR'
      });
    });

    it('should handle validation service unavailable', async () => {
      // Mock service unavailable
      vi.mocked(require('../../../services/validation').getValidationPipeline).mockReturnValue(null);

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        })
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Service unavailable',
        message: expect.stringContaining('Validation service is not available'),
        code: 'SERVICE_UNAVAILABLE'
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent progress requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/validation/bulk/progress')
          .expect(200)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.body).toHaveProperty('isRunning');
        expect(response.body).toHaveProperty('processedResources');
        expect(response.body).toHaveProperty('totalResources');
      });
    });

    it('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 5; i++) {
        // Start validation
        await request(app)
          .post('/api/validation/bulk/start')
          .send({
            resourceTypes: ['Patient'],
            aspects: { structural: true }
          })
          .expect(202);

        // Stop validation
        await request(app)
          .post('/api/validation/bulk/stop')
          .expect(200);
      }

      // Verify final state
      const response = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(response.body.isRunning).toBe(false);
      expect(response.body.isPaused).toBe(false);
    });
  });
});
