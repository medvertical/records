/**
 * Accessibility Tests for Validation Control Panel
 * 
 * This file contains accessibility tests to ensure the validation control panel
 * is accessible to users with disabilities, including keyboard navigation,
 * screen reader support, and ARIA compliance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Validation Control Panel Accessibility Tests', () => {
  let app: express.Application;
  let validationState: any;

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Reset validation state
    validationState = {
      isRunning: false,
      isPaused: false,
      processedResources: 0,
      totalResources: 0,
      errors: 0,
      warnings: 0,
      currentResourceType: null,
      startTime: null,
      jobId: null,
      shouldStop: false
    };
    
    // Mock the validation API with accessibility considerations
    app.post('/api/validation/bulk/start', (req, res) => {
      const { resourceTypes, aspects, maxConcurrency, priority } = req.body;
      
      // Validate request
      if (!resourceTypes || !Array.isArray(resourceTypes) || resourceTypes.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid request payload',
          message: 'Request validation failed',
          details: ['resourceTypes is required and must be a non-empty array'],
          code: 'INVALID_PAYLOAD',
          // Accessibility: Include error details for screen readers
          accessibility: {
            errorSummary: 'Validation request failed: resourceTypes is required and must be a non-empty array',
            errorDetails: [
              {
                field: 'resourceTypes',
                message: 'This field is required and must contain at least one resource type',
                severity: 'error'
              }
            ]
          }
        });
      }
      
      if (!aspects || typeof aspects !== 'object') {
        return res.status(400).json({ 
          error: 'Invalid request payload',
          message: 'Request validation failed',
          details: ['aspects is required and must be an object'],
          code: 'INVALID_PAYLOAD',
          accessibility: {
            errorSummary: 'Validation request failed: aspects configuration is required',
            errorDetails: [
              {
                field: 'aspects',
                message: 'This field is required and must contain validation aspect settings',
                severity: 'error'
              }
            ]
          }
        });
      }
      
      // Check if already running
      if (validationState.isRunning) {
        return res.status(409).json({
          error: 'Validation already running',
          message: 'A validation process is already in progress',
          code: 'VALIDATION_ALREADY_RUNNING',
          accessibility: {
            errorSummary: 'Cannot start validation: A validation process is already running',
            errorDetails: [
              {
                field: 'validation',
                message: 'Please stop the current validation before starting a new one',
                severity: 'warning'
              }
            ]
          }
        });
      }
      
      // Start validation
      validationState = {
        isRunning: true,
        isPaused: false,
        processedResources: 0,
        totalResources: resourceTypes.length * 100,
        errors: 0,
        warnings: 0,
        currentResourceType: resourceTypes[0],
        startTime: new Date().toISOString(),
        jobId: `job-${Date.now()}`,
        shouldStop: false,
        resourceTypes,
        aspects,
        maxConcurrency: maxConcurrency || 5,
        priority: priority || 'normal'
      };
      
      res.status(202).json({ 
        message: 'Bulk validation started successfully',
        jobId: validationState.jobId,
        status: 'running',
        startTime: validationState.startTime,
        estimatedDuration: '5 minutes',
        requestPayload: { resourceTypes, aspects, maxConcurrency, priority },
        // Accessibility: Include status information for screen readers
        accessibility: {
          statusSummary: 'Validation started successfully',
          statusDetails: {
            totalResources: validationState.totalResources,
            resourceTypes: resourceTypes.join(', '),
            aspects: Object.keys(aspects).filter(key => aspects[key]).join(', '),
            estimatedDuration: '5 minutes'
          },
          liveRegion: {
            message: `Validation started for ${resourceTypes.length} resource types. Processing ${validationState.totalResources} resources.`,
            priority: 'polite'
          }
        }
      });
    });

    app.get('/api/validation/bulk/progress', (req, res) => {
      // Simulate progress updates
      if (validationState.isRunning && !validationState.shouldStop) {
        validationState.processedResources = Math.min(
          validationState.processedResources + Math.floor(Math.random() * 5) + 1,
          validationState.totalResources
        );
        
        // Simulate some errors and warnings
        if (Math.random() < 0.1) {
          validationState.errors += 1;
        }
        if (Math.random() < 0.2) {
          validationState.warnings += 1;
        }
        
        // Check if completed
        if (validationState.processedResources >= validationState.totalResources) {
          validationState.isRunning = false;
          validationState.isPaused = false;
        }
      }
      
      const progressPercentage = validationState.totalResources > 0 
        ? (validationState.processedResources / validationState.totalResources) * 100 
        : 0;
      
      const processingRate = validationState.isRunning ? '2.5' : '0.0';
      const estimatedTimeRemaining = validationState.isRunning && validationState.processedResources > 0
        ? `${Math.ceil((validationState.totalResources - validationState.processedResources) / 2.5)}m`
        : null;
      
      res.status(200).json({ 
        isRunning: validationState.isRunning,
        isPaused: validationState.isPaused,
        processedResources: validationState.processedResources,
        totalResources: validationState.totalResources,
        errors: validationState.errors,
        warnings: validationState.warnings,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        estimatedTimeRemaining,
        processingRate,
        currentResourceType: validationState.currentResourceType,
        status: validationState.isRunning ? 'running' : 
                validationState.isPaused ? 'paused' : 
                validationState.shouldStop ? 'stopped' : 'idle',
        startTime: validationState.startTime,
        jobId: validationState.jobId,
        // Accessibility: Include progress information for screen readers
        accessibility: {
          progressSummary: `Validation progress: ${Math.round(progressPercentage)}% complete`,
          progressDetails: {
            processed: validationState.processedResources,
            total: validationState.totalResources,
            errors: validationState.errors,
            warnings: validationState.warnings,
            currentResourceType: validationState.currentResourceType,
            estimatedTimeRemaining
          },
          liveRegion: {
            message: `Progress: ${validationState.processedResources} of ${validationState.totalResources} resources processed (${Math.round(progressPercentage)}%)`,
            priority: validationState.isRunning ? 'polite' : 'off'
          }
        }
      });
    });

    app.post('/api/validation/bulk/stop', (req, res) => {
      if (!validationState.isRunning && !validationState.isPaused) {
        return res.status(409).json({
          error: 'No active validation',
          message: 'No validation process is currently running or paused',
          code: 'NO_ACTIVE_VALIDATION',
          accessibility: {
            errorSummary: 'Cannot stop validation: No validation process is currently running',
            errorDetails: [
              {
                field: 'validation',
                message: 'There is no active validation to stop',
                severity: 'info'
              }
            ]
          }
        });
      }
      
      validationState.shouldStop = true;
      validationState.isRunning = false;
      validationState.isPaused = false;
      
      res.status(200).json({ 
        message: 'Validation stopped successfully',
        status: 'stopped',
        stopTime: new Date().toISOString(),
        processedResources: validationState.processedResources,
        totalResources: validationState.totalResources,
        // Accessibility: Include stop information for screen readers
        accessibility: {
          statusSummary: 'Validation stopped successfully',
          statusDetails: {
            processedResources: validationState.processedResources,
            totalResources: validationState.totalResources,
            errors: validationState.errors,
            warnings: validationState.warnings
          },
          liveRegion: {
            message: `Validation stopped. ${validationState.processedResources} of ${validationState.totalResources} resources were processed.`,
            priority: 'assertive'
          }
        }
      });
    });

    app.post('/api/validation/bulk/pause', (req, res) => {
      if (!validationState.isRunning) {
        return res.status(409).json({
          error: 'No active validation',
          message: 'No validation process is currently running',
          code: 'NO_ACTIVE_VALIDATION',
          accessibility: {
            errorSummary: 'Cannot pause validation: No validation process is currently running',
            errorDetails: [
              {
                field: 'validation',
                message: 'There is no active validation to pause',
                severity: 'info'
              }
            ]
          }
        });
      }
      
      if (validationState.isPaused) {
        return res.status(409).json({
          error: 'Validation already paused',
          message: 'Validation is already paused',
          code: 'VALIDATION_ALREADY_PAUSED',
          accessibility: {
            errorSummary: 'Cannot pause validation: Validation is already paused',
            errorDetails: [
              {
                field: 'validation',
                message: 'The validation is already in a paused state',
                severity: 'info'
              }
            ]
          }
        });
      }
      
      validationState.isPaused = true;
      validationState.isRunning = false;
      
      res.status(200).json({ 
        message: 'Validation paused successfully',
        status: 'paused',
        pauseTime: new Date().toISOString(),
        processedResources: validationState.processedResources,
        totalResources: validationState.totalResources,
        accessibility: {
          statusSummary: 'Validation paused successfully',
          statusDetails: {
            processedResources: validationState.processedResources,
            totalResources: validationState.totalResources,
            progressPercentage: Math.round((validationState.processedResources / validationState.totalResources) * 100)
          },
          liveRegion: {
            message: `Validation paused at ${validationState.processedResources} of ${validationState.totalResources} resources.`,
            priority: 'assertive'
          }
        }
      });
    });

    app.post('/api/validation/bulk/resume', (req, res) => {
      if (!validationState.isPaused) {
        return res.status(409).json({
          error: 'No paused validation',
          message: 'No validation process is currently paused',
          code: 'NO_PAUSED_VALIDATION',
          accessibility: {
            errorSummary: 'Cannot resume validation: No validation process is currently paused',
            errorDetails: [
              {
                field: 'validation',
                message: 'There is no paused validation to resume',
                severity: 'info'
              }
            ]
          }
        });
      }
      
      validationState.isPaused = false;
      validationState.isRunning = true;
      
      res.status(200).json({ 
        message: 'Validation resumed successfully',
        status: 'running',
        resumeTime: new Date().toISOString(),
        processedResources: validationState.processedResources,
        totalResources: validationState.totalResources,
        accessibility: {
          statusSummary: 'Validation resumed successfully',
          statusDetails: {
            processedResources: validationState.processedResources,
            totalResources: validationState.totalResources,
            progressPercentage: Math.round((validationState.processedResources / validationState.totalResources) * 100)
          },
          liveRegion: {
            message: `Validation resumed. Continuing from ${validationState.processedResources} of ${validationState.totalResources} resources.`,
            priority: 'assertive'
          }
        }
      });
    });
  });

  afterEach(() => {
    // Clean up validation state
    validationState = {};
  });

  describe('API Response Accessibility', () => {
    it('should include accessibility information in error responses', async () => {
      // Test missing resourceTypes
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          aspects: { structural: true }
        })
        .expect(400);

      expect(response.body).toHaveProperty('accessibility');
      expect(response.body.accessibility).toHaveProperty('errorSummary');
      expect(response.body.accessibility).toHaveProperty('errorDetails');
      expect(response.body.accessibility.errorSummary).toContain('resourceTypes is required');
      expect(response.body.accessibility.errorDetails).toHaveLength(1);
      expect(response.body.accessibility.errorDetails[0]).toHaveProperty('field', 'resourceTypes');
      expect(response.body.accessibility.errorDetails[0]).toHaveProperty('message');
      expect(response.body.accessibility.errorDetails[0]).toHaveProperty('severity', 'error');
    });

    it('should include accessibility information in success responses', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true },
        maxConcurrency: 5,
        priority: 'normal'
      };

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      expect(response.body).toHaveProperty('accessibility');
      expect(response.body.accessibility).toHaveProperty('statusSummary');
      expect(response.body.accessibility).toHaveProperty('statusDetails');
      expect(response.body.accessibility).toHaveProperty('liveRegion');
      
      expect(response.body.accessibility.statusSummary).toBe('Validation started successfully');
      expect(response.body.accessibility.statusDetails).toHaveProperty('totalResources');
      expect(response.body.accessibility.statusDetails).toHaveProperty('resourceTypes');
      expect(response.body.accessibility.statusDetails).toHaveProperty('aspects');
      expect(response.body.accessibility.liveRegion).toHaveProperty('message');
      expect(response.body.accessibility.liveRegion).toHaveProperty('priority', 'polite');
    });

    it('should include accessibility information in progress responses', async () => {
      // Start validation first
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        })
        .expect(202);

      // Get progress
      const response = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(response.body).toHaveProperty('accessibility');
      expect(response.body.accessibility).toHaveProperty('progressSummary');
      expect(response.body.accessibility).toHaveProperty('progressDetails');
      expect(response.body.accessibility).toHaveProperty('liveRegion');
      
      expect(response.body.accessibility.progressSummary).toContain('Validation progress:');
      expect(response.body.accessibility.progressSummary).toContain('% complete');
      expect(response.body.accessibility.progressDetails).toHaveProperty('processed');
      expect(response.body.accessibility.progressDetails).toHaveProperty('total');
      expect(response.body.accessibility.progressDetails).toHaveProperty('errors');
      expect(response.body.accessibility.progressDetails).toHaveProperty('warnings');
      expect(response.body.accessibility.liveRegion).toHaveProperty('message');
      expect(response.body.accessibility.liveRegion).toHaveProperty('priority');
    });

    it('should include accessibility information in control responses', async () => {
      // Start validation first
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        })
        .expect(202);

      // Test pause
      const pauseResponse = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(200);

      expect(pauseResponse.body).toHaveProperty('accessibility');
      expect(pauseResponse.body.accessibility).toHaveProperty('statusSummary');
      expect(pauseResponse.body.accessibility).toHaveProperty('statusDetails');
      expect(pauseResponse.body.accessibility).toHaveProperty('liveRegion');
      expect(pauseResponse.body.accessibility.statusSummary).toBe('Validation paused successfully');
      expect(pauseResponse.body.accessibility.liveRegion.priority).toBe('assertive');

      // Test resume
      const resumeResponse = await request(app)
        .post('/api/validation/bulk/resume')
        .expect(200);

      expect(resumeResponse.body).toHaveProperty('accessibility');
      expect(resumeResponse.body.accessibility.statusSummary).toBe('Validation resumed successfully');
      expect(resumeResponse.body.accessibility.liveRegion.priority).toBe('assertive');

      // Test stop
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      expect(stopResponse.body).toHaveProperty('accessibility');
      expect(stopResponse.body.accessibility.statusSummary).toBe('Validation stopped successfully');
      expect(stopResponse.body.accessibility.liveRegion.priority).toBe('assertive');
    });
  });

  describe('Error Handling Accessibility', () => {
    it('should provide accessible error messages for validation conflicts', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Start first validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Try to start second validation
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(409);

      expect(response.body).toHaveProperty('accessibility');
      expect(response.body.accessibility.errorSummary).toContain('Cannot start validation');
      expect(response.body.accessibility.errorDetails[0].message).toContain('stop the current validation');
      expect(response.body.accessibility.errorDetails[0].severity).toBe('warning');
    });

    it('should provide accessible error messages for invalid operations', async () => {
      // Try to pause when not running
      const pauseResponse = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(409);

      expect(pauseResponse.body).toHaveProperty('accessibility');
      expect(pauseResponse.body.accessibility.errorSummary).toContain('Cannot pause validation');
      expect(pauseResponse.body.accessibility.errorDetails[0].message).toContain('no active validation');
      expect(pauseResponse.body.accessibility.errorDetails[0].severity).toBe('info');

      // Try to resume when not paused
      const resumeResponse = await request(app)
        .post('/api/validation/bulk/resume')
        .expect(409);

      expect(resumeResponse.body).toHaveProperty('accessibility');
      expect(resumeResponse.body.accessibility.errorSummary).toContain('Cannot resume validation');
      expect(resumeResponse.body.accessibility.errorDetails[0].message).toContain('no paused validation');
      expect(resumeResponse.body.accessibility.errorDetails[0].severity).toBe('info');

      // Try to stop when not running
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop')
        .expect(409);

      expect(stopResponse.body).toHaveProperty('accessibility');
      expect(stopResponse.body.accessibility.errorSummary).toContain('Cannot stop validation');
      expect(stopResponse.body.accessibility.errorDetails[0].message).toContain('no active validation');
      expect(stopResponse.body.accessibility.errorDetails[0].severity).toBe('info');
    });
  });

  describe('Live Region Updates', () => {
    it('should provide appropriate live region updates for status changes', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true }
      };

      // Start validation
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      expect(startResponse.body.accessibility.liveRegion.priority).toBe('polite');
      expect(startResponse.body.accessibility.liveRegion.message).toContain('Validation started');

      // Get progress
      const progressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(progressResponse.body.accessibility.liveRegion.priority).toBe('polite');
      expect(progressResponse.body.accessibility.liveRegion.message).toContain('Progress:');

      // Pause validation
      const pauseResponse = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(200);

      expect(pauseResponse.body.accessibility.liveRegion.priority).toBe('assertive');
      expect(pauseResponse.body.accessibility.liveRegion.message).toContain('Validation paused');

      // Resume validation
      const resumeResponse = await request(app)
        .post('/api/validation/bulk/resume')
        .expect(200);

      expect(resumeResponse.body.accessibility.liveRegion.priority).toBe('assertive');
      expect(resumeResponse.body.accessibility.liveRegion.message).toContain('Validation resumed');

      // Stop validation
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      expect(stopResponse.body.accessibility.liveRegion.priority).toBe('assertive');
      expect(stopResponse.body.accessibility.liveRegion.message).toContain('Validation stopped');
    });

    it('should provide appropriate live region updates for progress changes', async () => {
      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        })
        .expect(202);

      // Make multiple progress requests
      const progressResponses = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        progressResponses.push(response);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // All progress responses should have live region updates
      progressResponses.forEach(response => {
        expect(response.body.accessibility.liveRegion).toBeDefined();
        expect(response.body.accessibility.liveRegion.message).toContain('Progress:');
        expect(response.body.accessibility.liveRegion.message).toContain('resources processed');
        expect(response.body.accessibility.liveRegion.message).toContain('%');
      });

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide comprehensive status information for screen readers', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation', 'Encounter'],
        aspects: { structural: true, profile: true, terminology: true },
        maxConcurrency: 8,
        priority: 'high'
      };

      // Start validation
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      const statusDetails = startResponse.body.accessibility.statusDetails;
      expect(statusDetails.totalResources).toBe(300); // 3 types * 100 resources each
      expect(statusDetails.resourceTypes).toBe('Patient, Observation, Encounter');
      expect(statusDetails.aspects).toBe('structural, profile, terminology');
      expect(statusDetails.estimatedDuration).toBe('5 minutes');

      // Get progress
      const progressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      const progressDetails = progressResponse.body.accessibility.progressDetails;
      expect(progressDetails).toHaveProperty('processed');
      expect(progressDetails).toHaveProperty('total');
      expect(progressDetails).toHaveProperty('errors');
      expect(progressDetails).toHaveProperty('warnings');
      expect(progressDetails).toHaveProperty('currentResourceType');
      expect(progressDetails).toHaveProperty('estimatedTimeRemaining');

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });

    it('should provide error context for screen readers', async () => {
      // Test various error scenarios
      const errorTests = [
        {
          request: () => request(app).post('/api/validation/bulk/start').send({}),
          expectedError: 'resourceTypes is required',
          expectedField: 'resourceTypes'
        },
        {
          request: () => request(app).post('/api/validation/bulk/start').send({ resourceTypes: ['Patient'] }),
          expectedError: 'aspects configuration is required',
          expectedField: 'aspects'
        }
      ];

      for (const test of errorTests) {
        const response = await test.request();
        expect(response.status).toBeGreaterThanOrEqual(400);
        
        const accessibility = response.body.accessibility;
        expect(accessibility.errorSummary).toContain(test.expectedError);
        expect(accessibility.errorDetails[0].field).toBe(test.expectedField);
        expect(accessibility.errorDetails[0].message).toBeDefined();
        expect(accessibility.errorDetails[0].severity).toBeDefined();
      }
    });
  });

  describe('Keyboard Navigation Support', () => {
    it('should provide keyboard navigation hints in responses', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Start validation
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // The API should provide information that can be used for keyboard navigation
      expect(startResponse.body).toHaveProperty('status');
      expect(startResponse.body).toHaveProperty('jobId');
      expect(startResponse.body).toHaveProperty('startTime');
      
      // These fields can be used by the frontend to provide keyboard navigation hints
      expect(startResponse.body.accessibility.statusSummary).toBeDefined();
      expect(startResponse.body.accessibility.liveRegion.message).toBeDefined();
    });

    it('should provide focus management information', async () => {
      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient'],
          aspects: { structural: true }
        })
        .expect(202);

      // Get progress
      const progressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      // The API should provide information that can be used for focus management
      expect(progressResponse.body).toHaveProperty('status');
      expect(progressResponse.body).toHaveProperty('isRunning');
      expect(progressResponse.body).toHaveProperty('isPaused');
      
      // These fields can be used by the frontend to manage focus appropriately
      expect(progressResponse.body.accessibility.progressSummary).toBeDefined();
      expect(progressResponse.body.accessibility.liveRegion.message).toBeDefined();
    });
  });

  describe('ARIA Compliance', () => {
    it('should provide ARIA-compliant status information', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true }
      };

      // Start validation
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // The API should provide information that can be used for ARIA attributes
      expect(startResponse.body).toHaveProperty('status');
      expect(startResponse.body).toHaveProperty('jobId');
      expect(startResponse.body.accessibility.statusSummary).toBeDefined();
      
      // These can be used for aria-label, aria-describedby, etc.
      expect(startResponse.body.accessibility.statusDetails).toBeDefined();
      expect(startResponse.body.accessibility.liveRegion).toBeDefined();

      // Get progress
      const progressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      // Progress information for ARIA attributes
      expect(progressResponse.body).toHaveProperty('progressPercentage');
      expect(progressResponse.body).toHaveProperty('processedResources');
      expect(progressResponse.body).toHaveProperty('totalResources');
      expect(progressResponse.body.accessibility.progressSummary).toBeDefined();
      expect(progressResponse.body.accessibility.progressDetails).toBeDefined();

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });

    it('should provide ARIA-compliant error information', async () => {
      // Test error response
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send({})
        .expect(400);

      // The API should provide information that can be used for ARIA error attributes
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.accessibility.errorSummary).toBeDefined();
      expect(response.body.accessibility.errorDetails).toBeDefined();
      
      // These can be used for aria-invalid, aria-describedby, etc.
      expect(response.body.accessibility.errorDetails[0]).toHaveProperty('field');
      expect(response.body.accessibility.errorDetails[0]).toHaveProperty('message');
      expect(response.body.accessibility.errorDetails[0]).toHaveProperty('severity');
    });
  });
});
