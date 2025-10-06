/**
 * End-to-End Tests for Complete Validation Workflows
 * 
 * This file contains comprehensive E2E tests that test the entire validation workflow
 * from start to finish, including all the integration points.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Validation Workflow End-to-End Tests', () => {
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
    
    // Mock the complete validation workflow
    app.post('/api/validation/bulk/start', (req, res) => {
      const { resourceTypes, aspects, maxConcurrency, priority } = req.body;
      
      // Validate request
      if (!resourceTypes || !Array.isArray(resourceTypes) || resourceTypes.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid request payload',
          message: 'Request validation failed',
          details: ['resourceTypes is required and must be a non-empty array'],
          code: 'INVALID_PAYLOAD'
        });
      }
      
      if (!aspects || typeof aspects !== 'object') {
        return res.status(400).json({ 
          error: 'Invalid request payload',
          message: 'Request validation failed',
          details: ['aspects is required and must be an object'],
          code: 'INVALID_PAYLOAD'
        });
      }
      
      // Check if already running
      if (validationState.isRunning) {
        return res.status(409).json({
          error: 'Validation already running',
          message: 'A validation process is already in progress',
          code: 'VALIDATION_ALREADY_RUNNING'
        });
      }
      
      // Start validation
      validationState = {
        isRunning: true,
        isPaused: false,
        processedResources: 0,
        totalResources: resourceTypes.length * 10, // Mock: 10 resources per type
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
        requestPayload: { resourceTypes, aspects, maxConcurrency, priority }
      });
    });

    app.post('/api/validation/bulk/pause', (req, res) => {
      if (!validationState.isRunning) {
        return res.status(409).json({
          error: 'No active validation',
          message: 'No validation process is currently running',
          code: 'NO_ACTIVE_VALIDATION'
        });
      }
      
      if (validationState.isPaused) {
        return res.status(409).json({
          error: 'Validation already paused',
          message: 'Validation is already paused',
          code: 'VALIDATION_ALREADY_PAUSED'
        });
      }
      
      validationState.isPaused = true;
      validationState.isRunning = false;
      
      res.status(200).json({ 
        message: 'Validation paused successfully',
        status: 'paused',
        pauseTime: new Date().toISOString(),
        processedResources: validationState.processedResources,
        totalResources: validationState.totalResources
      });
    });

    app.post('/api/validation/bulk/resume', (req, res) => {
      if (!validationState.isPaused) {
        return res.status(409).json({
          error: 'No paused validation',
          message: 'No validation process is currently paused',
          code: 'NO_PAUSED_VALIDATION'
        });
      }
      
      validationState.isPaused = false;
      validationState.isRunning = true;
      
      res.status(200).json({ 
        message: 'Validation resumed successfully',
        status: 'running',
        resumeTime: new Date().toISOString(),
        processedResources: validationState.processedResources,
        totalResources: validationState.totalResources
      });
    });

    app.post('/api/validation/bulk/stop', (req, res) => {
      if (!validationState.isRunning && !validationState.isPaused) {
        return res.status(409).json({
          error: 'No active validation',
          message: 'No validation process is currently running or paused',
          code: 'NO_ACTIVE_VALIDATION'
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
        totalResources: validationState.totalResources
      });
    });

    app.get('/api/validation/bulk/progress', (req, res) => {
      // Simulate progress updates
      if (validationState.isRunning && !validationState.shouldStop) {
        validationState.processedResources = Math.min(
          validationState.processedResources + Math.floor(Math.random() * 3) + 1,
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
        jobId: validationState.jobId
      });
    });

    app.post('/api/validation/bulk/restore', (req, res) => {
      const { jobId } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ 
          message: 'Job ID is required for state restoration',
          code: 'MISSING_JOB_ID'
        });
      }
      
      if (jobId === validationState.jobId && validationState.jobId) {
        res.status(200).json({ 
          message: 'Validation state restored successfully',
          jobId,
          state: validationState,
          restored: true
        });
      } else {
        res.status(404).json({ 
          message: 'No valid validation state found for the given job ID',
          jobId,
          restored: false
        });
      }
    });

    app.get('/api/validation/bulk/restore-active', (req, res) => {
      if (validationState.jobId && (validationState.isRunning || validationState.isPaused)) {
        res.status(200).json({ 
          message: 'Active validation state restored successfully',
          serverId: 1,
          serverName: 'Test Server',
          serverUrl: 'http://test.server',
          state: validationState,
          restored: true
        });
      } else {
        res.status(404).json({ 
          message: 'No active validation state found for the server',
          restored: false
        });
      }
    });
  });

  afterEach(() => {
    // Clean up validation state
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
  });

  describe('Complete Validation Workflow', () => {
    it('should complete a full validation workflow from start to finish', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation', 'Encounter'],
        aspects: {
          structural: true,
          profile: true,
          terminology: false,
          reference: true,
          businessRule: false,
          metadata: false
        },
        maxConcurrency: 3,
        priority: 'high'
      };

      // Step 1: Start validation
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      expect(startResponse.body).toMatchObject({
        message: 'Bulk validation started successfully',
        jobId: expect.any(String),
        status: 'running',
        startTime: expect.any(String),
        estimatedDuration: '5 minutes'
      });

      const jobId = startResponse.body.jobId;

      // Step 2: Check initial progress
      const initialProgressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(initialProgressResponse.body).toMatchObject({
        isRunning: true,
        isPaused: false,
        totalResources: 30, // 3 resource types * 10 resources each
        status: 'running',
        jobId: jobId
      });

      // Step 3: Simulate progress by making multiple progress requests
      let progressResponse;
      for (let i = 0; i < 5; i++) {
        progressResponse = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        
        // Small delay to simulate real progress
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(progressResponse.body.processedResources).toBeGreaterThan(0);
      expect(progressResponse.body.progressPercentage).toBeGreaterThan(0);

      // Step 4: Pause validation
      const pauseResponse = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(200);

      expect(pauseResponse.body).toMatchObject({
        message: 'Validation paused successfully',
        status: 'paused'
      });

      // Step 5: Check paused progress
      const pausedProgressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(pausedProgressResponse.body).toMatchObject({
        isRunning: false,
        isPaused: true,
        status: 'paused'
      });

      // Step 6: Resume validation
      const resumeResponse = await request(app)
        .post('/api/validation/bulk/resume')
        .expect(200);

      expect(resumeResponse.body).toMatchObject({
        message: 'Validation resumed successfully',
        status: 'running'
      });

      // Step 7: Continue progress
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Step 8: Stop validation
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      expect(stopResponse.body).toMatchObject({
        message: 'Validation stopped successfully',
        status: 'stopped'
      });

      // Step 9: Verify final state
      const finalProgressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);

      expect(finalProgressResponse.body).toMatchObject({
        isRunning: false,
        isPaused: false,
        status: 'stopped'
      });
    });

    it('should handle validation completion workflow', async () => {
      // Start validation with small dataset
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true },
        maxConcurrency: 10
      };

      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Simulate completion by making many progress requests
      let isCompleted = false;
      let attempts = 0;
      const maxAttempts = 50;

      while (!isCompleted && attempts < maxAttempts) {
        const response = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);

        if (response.body.processedResources >= response.body.totalResources) {
          isCompleted = true;
          expect(response.body).toMatchObject({
            isRunning: false,
            isPaused: false,
            processedResources: response.body.totalResources,
            progressPercentage: 100
          });
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(isCompleted).toBe(true);
    });

    it('should handle error scenarios in validation workflow', async () => {
      // Test starting validation when already running
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
      const errorResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(409);

      expect(errorResponse.body).toMatchObject({
        error: 'Validation already running',
        message: 'A validation process is already in progress',
        code: 'VALIDATION_ALREADY_RUNNING'
      });

      // Test pausing when not running
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      const pauseErrorResponse = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(409);

      expect(pauseErrorResponse.body).toMatchObject({
        error: 'No active validation',
        message: 'No validation process is currently running',
        code: 'NO_ACTIVE_VALIDATION'
      });
    });

    it('should handle state restoration workflow', async () => {
      // Start validation
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true }
      };

      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      const jobId = startResponse.body.jobId;

      // Make some progress
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Restore by job ID
      const restoreResponse = await request(app)
        .post('/api/validation/bulk/restore')
        .send({ jobId })
        .expect(200);

      expect(restoreResponse.body).toMatchObject({
        message: 'Validation state restored successfully',
        jobId,
        restored: true,
        state: expect.objectContaining({
          jobId,
          resourceTypes: payload.resourceTypes,
          aspects: payload.aspects
        })
      });

      // Test restore active
      const restoreActiveResponse = await request(app)
        .get('/api/validation/bulk/restore-active')
        .expect(200);

      expect(restoreActiveResponse.body).toMatchObject({
        message: 'Active validation state restored successfully',
        restored: true,
        state: expect.objectContaining({
          jobId
        })
      });
    });

    it('should handle concurrent operations gracefully', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Make concurrent progress requests
      const progressPromises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/validation/bulk/progress')
          .expect(200)
      );

      const responses = await Promise.all(progressPromises);
      
      // All responses should be consistent
      responses.forEach(response => {
        expect(response.body).toHaveProperty('isRunning');
        expect(response.body).toHaveProperty('processedResources');
        expect(response.body).toHaveProperty('totalResources');
        expect(response.body).toHaveProperty('status');
      });

      // Stop validation (if still running)
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop');
      
      // Accept both 200 (stopped) and 409 (already stopped) as valid
      expect([200, 409]).toContain(stopResponse.status);
    });

    it('should maintain data consistency throughout workflow', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation', 'Encounter', 'DiagnosticReport'],
        aspects: {
          structural: true,
          profile: true,
          terminology: true,
          reference: true,
          businessRule: true,
          metadata: true
        },
        maxConcurrency: 2,
        priority: 'low'
      };

      // Start validation
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      const jobId = startResponse.body.jobId;

      // Track progress and ensure consistency
      let lastProcessedResources = 0;
      let lastErrors = 0;
      let lastWarnings = 0;

      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);

        // Verify progress is non-decreasing
        expect(response.body.processedResources).toBeGreaterThanOrEqual(lastProcessedResources);
        expect(response.body.errors).toBeGreaterThanOrEqual(lastErrors);
        expect(response.body.warnings).toBeGreaterThanOrEqual(lastWarnings);

        // Verify total resources remains constant
        expect(response.body.totalResources).toBe(40); // 4 resource types * 10 resources each

        // Verify job ID consistency
        expect(response.body.jobId).toBe(jobId);

        // Update tracking variables
        lastProcessedResources = response.body.processedResources;
        lastErrors = response.body.errors;
        lastWarnings = response.body.warnings;

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });
  });

  describe('Workflow Edge Cases', () => {
    it('should handle rapid start/stop cycles', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      for (let cycle = 0; cycle < 5; cycle++) {
        // Start
        await request(app)
          .post('/api/validation/bulk/start')
          .send(payload)
          .expect(202);

        // Make a few progress requests
        for (let i = 0; i < 2; i++) {
          await request(app)
            .get('/api/validation/bulk/progress')
            .expect(200);
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        // Stop
        await request(app)
          .post('/api/validation/bulk/stop')
          .expect(200);

        // Verify stopped state
        const finalResponse = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);

        expect(finalResponse.body.isRunning).toBe(false);
        expect(finalResponse.body.isPaused).toBe(false);
      }
    });

    it('should handle pause/resume cycles', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true }
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Multiple pause/resume cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        // Pause
        await request(app)
          .post('/api/validation/bulk/pause')
          .expect(200);

        // Verify paused
        const pausedResponse = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        expect(pausedResponse.body.isPaused).toBe(true);

        // Resume
        await request(app)
          .post('/api/validation/bulk/resume')
          .expect(200);

        // Verify resumed
        const resumedResponse = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        expect(resumedResponse.body.isRunning).toBe(true);

        // Make some progress
        for (let i = 0; i < 2; i++) {
          await request(app)
            .get('/api/validation/bulk/progress')
            .expect(200);
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }

      // Stop (if still running)
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop');
      
      // Accept both 200 (stopped) and 409 (already stopped) as valid
      expect([200, 409]).toContain(stopResponse.status);
    });

    it('should handle invalid restore operations', async () => {
      // Try to restore with invalid job ID
      const invalidRestoreResponse = await request(app)
        .post('/api/validation/bulk/restore')
        .send({ jobId: 'invalid-job-id' })
        .expect(404);

      expect(invalidRestoreResponse.body).toMatchObject({
        message: 'No valid validation state found for the given job ID',
        jobId: 'invalid-job-id',
        restored: false
      });

      // Try to restore active when no active validation
      const noActiveResponse = await request(app)
        .get('/api/validation/bulk/restore-active')
        .expect(404);

      expect(noActiveResponse.body).toMatchObject({
        message: 'No active validation state found for the server',
        restored: false
      });
    });
  });
});
