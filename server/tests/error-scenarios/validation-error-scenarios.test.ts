/**
 * Error Scenario Tests for Validation Control Panel
 * 
 * This file contains comprehensive tests for various error scenarios and edge cases
 * that can occur during validation operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Validation Error Scenario Tests', () => {
  let app: express.Application;
  let validationState: any;
  let errorCount: number;

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

    errorCount = 0;
    
    // Mock the validation API with error scenario support
    app.post('/api/validation/bulk/start', (req, res) => {
      const { resourceTypes, aspects, maxConcurrency, priority } = req.body;
      
      // Simulate various error scenarios
      if (req.headers['x-simulate-error'] === 'network-timeout') {
        return res.status(408).json({
          error: 'Request timeout',
          message: 'The request timed out while starting validation',
          code: 'NETWORK_TIMEOUT',
          retryAfter: 30
        });
      }

      if (req.headers['x-simulate-error'] === 'server-error') {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred while starting validation',
          code: 'INTERNAL_SERVER_ERROR',
          requestId: `req-${Date.now()}`
        });
      }

      if (req.headers['x-simulate-error'] === 'rate-limit') {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many validation requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60,
          limit: 10,
          remaining: 0
        });
      }

      if (req.headers['x-simulate-error'] === 'validation-failed') {
        return res.status(422).json({
          error: 'Validation failed',
          message: 'The validation request contains invalid data',
          code: 'VALIDATION_FAILED',
          details: [
            {
              field: 'resourceTypes',
              message: 'Invalid resource type: UnknownType',
              value: 'UnknownType'
            }
          ]
        });
      }

      // Normal validation logic
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
        totalResources: validationState.totalResources
      });
    });

    app.get('/api/validation/bulk/progress', (req, res) => {
      // Simulate various error scenarios
      if (req.headers['x-simulate-error'] === 'network-timeout') {
        return res.status(408).json({
          error: 'Request timeout',
          message: 'The request timed out while fetching progress',
          code: 'NETWORK_TIMEOUT',
          retryAfter: 30
        });
      }

      if (req.headers['x-simulate-error'] === 'server-error') {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred while fetching progress',
          code: 'INTERNAL_SERVER_ERROR',
          requestId: `req-${Date.now()}`
        });
      }

      if (req.headers['x-simulate-error'] === 'not-found') {
        return res.status(404).json({
          error: 'Validation not found',
          message: 'No validation process found for the current session',
          code: 'VALIDATION_NOT_FOUND'
        });
      }

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
        jobId: validationState.jobId
      });
    });

    app.post('/api/validation/bulk/stop', (req, res) => {
      // Simulate various error scenarios
      if (req.headers['x-simulate-error'] === 'network-timeout') {
        return res.status(408).json({
          error: 'Request timeout',
          message: 'The request timed out while stopping validation',
          code: 'NETWORK_TIMEOUT',
          retryAfter: 30
        });
      }

      if (req.headers['x-simulate-error'] === 'server-error') {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred while stopping validation',
          code: 'INTERNAL_SERVER_ERROR',
          requestId: `req-${Date.now()}`
        });
      }

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

    app.post('/api/validation/bulk/pause', (req, res) => {
      if (req.headers['x-simulate-error'] === 'server-error') {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred while pausing validation',
          code: 'INTERNAL_SERVER_ERROR',
          requestId: `req-${Date.now()}`
        });
      }

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
      if (req.headers['x-simulate-error'] === 'server-error') {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred while resuming validation',
          code: 'INTERNAL_SERVER_ERROR',
          requestId: `req-${Date.now()}`
        });
      }

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
  });

  afterEach(() => {
    // Clean up validation state
    validationState = {};
    errorCount = 0;
  });

  describe('Network Error Scenarios', () => {
    it('should handle network timeout errors gracefully', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Test start timeout
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .set('x-simulate-error', 'network-timeout')
        .send(payload)
        .expect(408);

      expect(startResponse.body).toMatchObject({
        error: 'Request timeout',
        message: 'The request timed out while starting validation',
        code: 'NETWORK_TIMEOUT',
        retryAfter: 30
      });

      // Test progress timeout
      const progressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .set('x-simulate-error', 'network-timeout')
        .expect(408);

      expect(progressResponse.body).toMatchObject({
        error: 'Request timeout',
        message: 'The request timed out while fetching progress',
        code: 'NETWORK_TIMEOUT',
        retryAfter: 30
      });

      // Test stop timeout
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop')
        .set('x-simulate-error', 'network-timeout')
        .expect(408);

      expect(stopResponse.body).toMatchObject({
        error: 'Request timeout',
        message: 'The request timed out while stopping validation',
        code: 'NETWORK_TIMEOUT',
        retryAfter: 30
      });
    });

    it('should handle server error scenarios gracefully', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Test start server error
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .set('x-simulate-error', 'server-error')
        .send(payload)
        .expect(500);

      expect(startResponse.body).toMatchObject({
        error: 'Internal server error',
        message: 'An unexpected error occurred while starting validation',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: expect.any(String)
      });

      // Test progress server error
      const progressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .set('x-simulate-error', 'server-error')
        .expect(500);

      expect(progressResponse.body).toMatchObject({
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching progress',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: expect.any(String)
      });

      // Test stop server error
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop')
        .set('x-simulate-error', 'server-error')
        .expect(500);

      expect(stopResponse.body).toMatchObject({
        error: 'Internal server error',
        message: 'An unexpected error occurred while stopping validation',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: expect.any(String)
      });
    });

    it('should handle rate limiting scenarios', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .set('x-simulate-error', 'rate-limit')
        .send(payload)
        .expect(429);

      expect(response.body).toMatchObject({
        error: 'Rate limit exceeded',
        message: 'Too many validation requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
        limit: 10,
        remaining: 0
      });
    });
  });

  describe('Validation Error Scenarios', () => {
    it('should handle invalid request payloads', async () => {
      // Test missing resourceTypes
      const response1 = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          aspects: { structural: true }
        })
        .expect(400);

      expect(response1.body).toMatchObject({
        error: 'Invalid request payload',
        message: 'Request validation failed',
        details: ['resourceTypes is required and must be a non-empty array'],
        code: 'INVALID_PAYLOAD'
      });

      // Test missing aspects
      const response2 = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: ['Patient']
        })
        .expect(400);

      expect(response2.body).toMatchObject({
        error: 'Invalid request payload',
        message: 'Request validation failed',
        details: ['aspects is required and must be an object'],
        code: 'INVALID_PAYLOAD'
      });
    });

    it('should handle validation failed scenarios', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      const response = await request(app)
        .post('/api/validation/bulk/start')
        .set('x-simulate-error', 'validation-failed')
        .send(payload)
        .expect(422);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        message: 'The validation request contains invalid data',
        code: 'VALIDATION_FAILED',
        details: [
          {
            field: 'resourceTypes',
            message: 'Invalid resource type: UnknownType',
            value: 'UnknownType'
          }
        ]
      });
    });

    it('should handle validation not found scenarios', async () => {
      const response = await request(app)
        .get('/api/validation/bulk/progress')
        .set('x-simulate-error', 'not-found')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Validation not found',
        message: 'No validation process found for the current session',
        code: 'VALIDATION_NOT_FOUND'
      });
    });
  });

  describe('State Conflict Error Scenarios', () => {
    it('should handle validation already running conflicts', async () => {
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

      expect(response.body).toMatchObject({
        error: 'Validation already running',
        message: 'A validation process is already in progress',
        code: 'VALIDATION_ALREADY_RUNNING'
      });
    });

    it('should handle pause/resume state conflicts', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Try to pause when not running (after stopping)
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      const pauseResponse = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(409);

      expect(pauseResponse.body).toMatchObject({
        error: 'No active validation',
        message: 'No validation process is currently running',
        code: 'NO_ACTIVE_VALIDATION'
      });

      // Try to resume when not paused
      const resumeResponse = await request(app)
        .post('/api/validation/bulk/resume')
        .expect(409);

      expect(resumeResponse.body).toMatchObject({
        error: 'No paused validation',
        message: 'No validation process is currently paused',
        code: 'NO_PAUSED_VALIDATION'
      });
    });

    it('should handle already paused conflicts', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Pause validation
      await request(app)
        .post('/api/validation/bulk/pause')
        .expect(200);

      // Try to pause again
      const response = await request(app)
        .post('/api/validation/bulk/pause')
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'No active validation',
        message: 'No validation process is currently running',
        code: 'NO_ACTIVE_VALIDATION'
      });
    });
  });

  describe('Recovery and Resilience Scenarios', () => {
    it('should handle partial failures gracefully', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true }
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Simulate some progress
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Simulate server error during progress
      const errorResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .set('x-simulate-error', 'server-error')
        .expect(500);

      expect(errorResponse.body.code).toBe('INTERNAL_SERVER_ERROR');

      // Should still be able to stop validation
      const stopResponse = await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);

      expect(stopResponse.body.status).toBe('stopped');
    });

    it('should handle recovery from network errors', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Simulate network timeout on start
      await request(app)
        .post('/api/validation/bulk/start')
        .set('x-simulate-error', 'network-timeout')
        .send(payload)
        .expect(408);

      // Should be able to retry and succeed
      const retryResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      expect(retryResponse.body.status).toBe('running');
    });

    it('should handle recovery from rate limiting', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Simulate rate limiting
      await request(app)
        .post('/api/validation/bulk/start')
        .set('x-simulate-error', 'rate-limit')
        .send(payload)
        .expect(429);

      // Should be able to retry after rate limit (simulated by not setting the header)
      const retryResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      expect(retryResponse.body.status).toBe('running');
    });
  });

  describe('Edge Case Error Scenarios', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should handle requests with invalid content type', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should handle extremely large payloads', async () => {
      const largePayload = {
        resourceTypes: Array.from({ length: 1000 }, (_, i) => `ResourceType${i}`),
        aspects: {
          structural: true,
          profile: true,
          terminology: true,
          reference: true,
          businessRule: true,
          metadata: true
        },
        maxConcurrency: 100,
        priority: 'high'
      };

      // This should still work (though it might be slow)
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send(largePayload)
        .expect(202);

      expect(response.body.status).toBe('running');
      expect(response.body.totalResources).toBe(100000); // 1000 types * 100 resources each
    });

    it('should handle empty resource types array', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: [],
          aspects: { structural: true }
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_PAYLOAD');
      expect(response.body.details).toContain('resourceTypes is required and must be a non-empty array');
    });

    it('should handle null and undefined values', async () => {
      const response = await request(app)
        .post('/api/validation/bulk/start')
        .send({
          resourceTypes: null,
          aspects: undefined
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('should handle concurrent error requests', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Make multiple concurrent requests that will fail
      const errorPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/validation/bulk/start')
          .set('x-simulate-error', 'server-error')
          .send(payload)
      );

      const responses = await Promise.all(errorPromises);
      
      // All should return server error
      responses.forEach(response => {
        expect(response.status).toBe(500);
        expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
      });
    });

    it('should handle mixed success and error requests', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true }
      };

      // Make mixed requests
      const requests = [
        request(app).post('/api/validation/bulk/start').send(payload), // Success
        request(app).post('/api/validation/bulk/start').set('x-simulate-error', 'server-error').send(payload), // Error
        request(app).post('/api/validation/bulk/start').send(payload), // Success
        request(app).post('/api/validation/bulk/start').set('x-simulate-error', 'rate-limit').send(payload), // Error
      ];

      const responses = await Promise.all(requests);
      
      // Check that we got the expected mix of responses
      const successCount = responses.filter(r => r.status === 202).length;
      const errorCount = responses.filter(r => r.status >= 400).length;
      
      // First request succeeds, second fails due to conflict, third fails due to conflict, fourth fails due to rate limit
      expect(successCount).toBe(1);
      expect(errorCount).toBe(3);
    });
  });
});
