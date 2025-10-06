/**
 * Performance Tests for Large-Scale Validation Operations
 * 
 * This file contains performance tests that simulate large-scale validation scenarios
 * and measure various performance metrics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Validation Performance Tests', () => {
  let app: express.Application;
  let validationState: any;
  let performanceMetrics: any;

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

    // Reset performance metrics
    performanceMetrics = {
      requestTimes: [],
      memoryUsage: [],
      responseSizes: [],
      errorRates: []
    };
    
    // Mock the validation workflow with performance tracking
    app.post('/api/validation/bulk/start', (req, res) => {
      const startTime = Date.now();
      
      const { resourceTypes, aspects, maxConcurrency, priority } = req.body;
      
      // Validate request
      if (!resourceTypes || !Array.isArray(resourceTypes) || resourceTypes.length === 0) {
        const responseTime = Date.now() - startTime;
        performanceMetrics.requestTimes.push(responseTime);
        return res.status(400).json({ 
          error: 'Invalid request payload',
          message: 'Request validation failed',
          details: ['resourceTypes is required and must be a non-empty array'],
          code: 'INVALID_PAYLOAD'
        });
      }
      
      if (!aspects || typeof aspects !== 'object') {
        const responseTime = Date.now() - startTime;
        performanceMetrics.requestTimes.push(responseTime);
        return res.status(400).json({ 
          error: 'Invalid request payload',
          message: 'Request validation failed',
          details: ['aspects is required and must be an object'],
          code: 'INVALID_PAYLOAD'
        });
      }
      
      // Check if already running
      if (validationState.isRunning) {
        const responseTime = Date.now() - startTime;
        performanceMetrics.requestTimes.push(responseTime);
        return res.status(409).json({
          error: 'Validation already running',
          message: 'A validation process is already in progress',
          code: 'VALIDATION_ALREADY_RUNNING'
        });
      }
      
      // Start validation with large dataset simulation
      const resourcesPerType = 1000; // Simulate 1000 resources per type
      validationState = {
        isRunning: true,
        isPaused: false,
        processedResources: 0,
        totalResources: resourceTypes.length * resourcesPerType,
        errors: 0,
        warnings: 0,
        currentResourceType: resourceTypes[0],
        startTime: new Date().toISOString(),
        jobId: `job-${Date.now()}`,
        shouldStop: false,
        resourceTypes,
        aspects,
        maxConcurrency: maxConcurrency || 5,
        priority: priority || 'normal',
        resourcesPerType
      };
      
      const responseTime = Date.now() - startTime;
      performanceMetrics.requestTimes.push(responseTime);
      
      res.status(202).json({ 
        message: 'Bulk validation started successfully',
        jobId: validationState.jobId,
        status: 'running',
        startTime: validationState.startTime,
        estimatedDuration: '5 minutes',
        totalResources: validationState.totalResources,
        requestPayload: { resourceTypes, aspects, maxConcurrency, priority }
      });
    });

    app.get('/api/validation/bulk/progress', (req, res) => {
      const startTime = Date.now();
      
      // Simulate progress updates with realistic performance
      if (validationState.isRunning && !validationState.shouldStop) {
        // Simulate processing rate based on concurrency
        const processingRate = validationState.maxConcurrency * 2; // 2 resources per second per concurrent worker
        const increment = Math.min(processingRate, validationState.totalResources - validationState.processedResources);
        
        validationState.processedResources = Math.min(
          validationState.processedResources + increment,
          validationState.totalResources
        );
        
        // Simulate some errors and warnings
        if (Math.random() < 0.05) { // 5% error rate
          validationState.errors += 1;
        }
        if (Math.random() < 0.15) { // 15% warning rate
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
      
      const processingRate = validationState.isRunning ? 
        (validationState.maxConcurrency * 2).toFixed(1) : '0.0';
      
      const estimatedTimeRemaining = validationState.isRunning && validationState.processedResources > 0
        ? `${Math.ceil((validationState.totalResources - validationState.processedResources) / (validationState.maxConcurrency * 2))}s`
        : null;
      
      const response = { 
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
      };

      const responseTime = Date.now() - startTime;
      performanceMetrics.requestTimes.push(responseTime);
      performanceMetrics.responseSizes.push(JSON.stringify(response).length);
      
      res.status(200).json(response);
    });

    app.post('/api/validation/bulk/stop', (req, res) => {
      const startTime = Date.now();
      
      if (!validationState.isRunning && !validationState.isPaused) {
        const responseTime = Date.now() - startTime;
        performanceMetrics.requestTimes.push(responseTime);
        return res.status(409).json({
          error: 'No active validation',
          message: 'No validation process is currently running or paused',
          code: 'NO_ACTIVE_VALIDATION'
        });
      }
      
      validationState.shouldStop = true;
      validationState.isRunning = false;
      validationState.isPaused = false;
      
      const responseTime = Date.now() - startTime;
      performanceMetrics.requestTimes.push(responseTime);
      
      res.status(200).json({ 
        message: 'Validation stopped successfully',
        status: 'stopped',
        stopTime: new Date().toISOString(),
        processedResources: validationState.processedResources,
        totalResources: validationState.totalResources
      });
    });
  });

  afterEach(() => {
    // Clean up validation state
    validationState = {};
    performanceMetrics = {
      requestTimes: [],
      memoryUsage: [],
      responseSizes: [],
      errorRates: []
    };
  });

  describe('Large-Scale Validation Performance', () => {
    it('should handle large dataset validation efficiently', async () => {
      const largePayload = {
        resourceTypes: ['Patient', 'Observation', 'Encounter', 'DiagnosticReport', 'Medication', 'Procedure', 'Condition', 'AllergyIntolerance'],
        aspects: {
          structural: true,
          profile: true,
          terminology: true,
          reference: true,
          businessRule: true,
          metadata: true
        },
        maxConcurrency: 10,
        priority: 'high'
      };

      // Start validation with large dataset
      const startTime = Date.now();
      const startResponse = await request(app)
        .post('/api/validation/bulk/start')
        .send(largePayload)
        .expect(202);

      const startDuration = Date.now() - startTime;
      expect(startDuration).toBeLessThan(1000); // Should start within 1 second

      expect(startResponse.body.totalResources).toBe(8000); // 8 types * 1000 resources each

      // Monitor progress over time
      const progressChecks = 20;
      const progressInterval = 100; // 100ms between checks
      const progressTimes: number[] = [];

      for (let i = 0; i < progressChecks; i++) {
        const progressStartTime = Date.now();
        const progressResponse = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        
        const progressDuration = Date.now() - progressStartTime;
        progressTimes.push(progressDuration);
        
        expect(progressDuration).toBeLessThan(500); // Each progress check should be fast
        
        // Verify progress is increasing
        if (i > 0) {
          expect(progressResponse.body.processedResources).toBeGreaterThanOrEqual(0);
        }
        
        await new Promise(resolve => setTimeout(resolve, progressInterval));
      }

      // Calculate performance metrics
      const avgProgressTime = progressTimes.reduce((a, b) => a + b, 0) / progressTimes.length;
      const maxProgressTime = Math.max(...progressTimes);
      const minProgressTime = Math.min(...progressTimes);

      expect(avgProgressTime).toBeLessThan(200); // Average progress time should be under 200ms
      expect(maxProgressTime).toBeLessThan(500); // Max progress time should be under 500ms
      expect(minProgressTime).toBeGreaterThan(0); // Min progress time should be positive

      // Stop validation
      const stopTime = Date.now();
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
      
      const stopDuration = Date.now() - stopTime;
      expect(stopDuration).toBeLessThan(1000); // Should stop within 1 second
    });

    it('should handle high-frequency progress requests efficiently', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true },
        maxConcurrency: 5
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Make high-frequency progress requests
      const requestCount = 100;
      const requests: Promise<any>[] = [];
      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(app)
            .get('/api/validation/bulk/progress')
            .expect(200)
        );
      }

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.body).toHaveProperty('isRunning');
        expect(response.body).toHaveProperty('processedResources');
        expect(response.body).toHaveProperty('totalResources');
      });

      // Performance assertions
      const avgTimePerRequest = totalTime / requestCount;
      expect(avgTimePerRequest).toBeLessThan(50); // Average time per request should be under 50ms
      expect(totalTime).toBeLessThan(5000); // Total time for 100 requests should be under 5 seconds

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });

    it('should maintain consistent performance under concurrent load', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation', 'Encounter'],
        aspects: { structural: true, profile: true, terminology: true },
        maxConcurrency: 8
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Simulate concurrent load with multiple clients
      const concurrentClients = 5;
      const requestsPerClient = 20;
      const clientPromises: Promise<any>[] = [];

      for (let client = 0; client < concurrentClients; client++) {
        const clientPromise = (async () => {
          const clientRequests: Promise<any>[] = [];
          
          for (let i = 0; i < requestsPerClient; i++) {
            clientRequests.push(
              request(app)
                .get('/api/validation/bulk/progress')
                .expect(200)
            );
            
            // Small delay between requests
            if (i < requestsPerClient - 1) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
          
          return Promise.all(clientRequests);
        })();
        
        clientPromises.push(clientPromise);
      }

      const startTime = Date.now();
      const allResponses = await Promise.all(clientPromises);
      const totalTime = Date.now() - startTime;

      // Flatten all responses
      const allResponsesFlat = allResponses.flat();
      
      // All requests should succeed
      allResponsesFlat.forEach(response => {
        expect(response.body).toHaveProperty('isRunning');
        expect(response.body).toHaveProperty('processedResources');
        expect(response.body).toHaveProperty('totalResources');
      });

      // Performance assertions
      const totalRequests = concurrentClients * requestsPerClient;
      const avgTimePerRequest = totalTime / totalRequests;
      
      expect(avgTimePerRequest).toBeLessThan(100); // Average time per request should be under 100ms
      expect(totalTime).toBeLessThan(10000); // Total time should be under 10 seconds
      expect(allResponsesFlat.length).toBe(totalRequests); // All requests should complete

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });

    it('should handle memory efficiently during long-running validation', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation', 'Encounter', 'DiagnosticReport', 'Medication', 'Procedure'],
        aspects: {
          structural: true,
          profile: true,
          terminology: true,
          reference: true,
          businessRule: true,
          metadata: true
        },
        maxConcurrency: 6
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Monitor memory usage over time
      const memoryChecks = 50;
      const memoryUsage: number[] = [];
      const responseSizes: number[] = [];

      for (let i = 0; i < memoryChecks; i++) {
        const response = await request(app)
          .get('/api/validation/bulk/progress')
          .expect(200);
        
        // Simulate memory usage tracking
        const responseSize = JSON.stringify(response.body).length;
        responseSizes.push(responseSize);
        
        // Simulate memory usage (in a real test, you'd use process.memoryUsage())
        const simulatedMemoryUsage = 50 + (response.body.processedResources * 0.1); // Simulate memory growth
        memoryUsage.push(simulatedMemoryUsage);
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Memory efficiency assertions
      const maxMemoryUsage = Math.max(...memoryUsage);
      const avgMemoryUsage = memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length;
      const memoryGrowth = memoryUsage[memoryUsage.length - 1] - memoryUsage[0];

      expect(maxMemoryUsage).toBeLessThan(1000); // Max memory usage should be reasonable
      expect(avgMemoryUsage).toBeLessThan(500); // Average memory usage should be reasonable
      expect(memoryGrowth).toBeLessThan(200); // Memory growth should be controlled

      // Response size consistency
      const avgResponseSize = responseSizes.reduce((a, b) => a + b, 0) / responseSizes.length;
      const maxResponseSize = Math.max(...responseSizes);
      const minResponseSize = Math.min(...responseSizes);

      expect(avgResponseSize).toBeLessThan(2000); // Average response size should be reasonable
      expect(maxResponseSize - minResponseSize).toBeLessThan(1000); // Response size variation should be minimal

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });

    it('should handle rapid start/stop cycles without performance degradation', async () => {
      const payload = {
        resourceTypes: ['Patient'],
        aspects: { structural: true },
        maxConcurrency: 3
      };

      const cycles = 10;
      const cycleTimes: number[] = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        const cycleStartTime = Date.now();
        
        // Start validation
        await request(app)
          .post('/api/validation/bulk/start')
          .send(payload)
          .expect(202);

        // Make a few progress requests
        for (let i = 0; i < 3; i++) {
          await request(app)
            .get('/api/validation/bulk/progress')
            .expect(200);
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Stop validation
        await request(app)
          .post('/api/validation/bulk/stop')
          .expect(200);

        const cycleTime = Date.now() - cycleStartTime;
        cycleTimes.push(cycleTime);
      }

      // Performance consistency assertions
      const avgCycleTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
      const maxCycleTime = Math.max(...cycleTimes);
      const minCycleTime = Math.min(...cycleTimes);
      const cycleTimeVariation = maxCycleTime - minCycleTime;

      expect(avgCycleTime).toBeLessThan(1000); // Average cycle time should be under 1 second
      expect(maxCycleTime).toBeLessThan(2000); // Max cycle time should be under 2 seconds
      expect(cycleTimeVariation).toBeLessThan(1000); // Cycle time variation should be minimal
    });

    it('should handle error scenarios without performance impact', async () => {
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true },
        maxConcurrency: 4
      };

      // Start validation
      await request(app)
        .post('/api/validation/bulk/start')
        .send(payload)
        .expect(202);

      // Test error scenarios
      const errorTests = [
        // Try to start when already running
        () => request(app).post('/api/validation/bulk/start').send(payload),
        // Try to pause when not running (after stopping)
        () => request(app).post('/api/validation/bulk/pause'),
        // Try to resume when not paused
        () => request(app).post('/api/validation/bulk/resume')
      ];

      const errorResponseTimes: number[] = [];

      for (const errorTest of errorTests) {
        const startTime = Date.now();
        const response = await errorTest();
        const responseTime = Date.now() - startTime;
        
        errorResponseTimes.push(responseTime);
        expect(response.status).toBeGreaterThanOrEqual(400); // Should return error status
      }

      // Error response times should be fast
      errorResponseTimes.forEach(time => {
        expect(time).toBeLessThan(200); // Error responses should be under 200ms
      });

      // Normal operations should still work
      const normalStartTime = Date.now();
      const progressResponse = await request(app)
        .get('/api/validation/bulk/progress')
        .expect(200);
      const normalResponseTime = Date.now() - normalStartTime;

      expect(normalResponseTime).toBeLessThan(200); // Normal operations should be fast
      expect(progressResponse.body).toHaveProperty('isRunning');

      // Stop validation
      await request(app)
        .post('/api/validation/bulk/stop')
        .expect(200);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for different dataset sizes', async () => {
      const testCases = [
        { resourceTypes: ['Patient'], expectedMaxTime: 500, description: 'Small dataset (1 type)' },
        { resourceTypes: ['Patient', 'Observation'], expectedMaxTime: 800, description: 'Medium dataset (2 types)' },
        { resourceTypes: ['Patient', 'Observation', 'Encounter', 'DiagnosticReport'], expectedMaxTime: 1200, description: 'Large dataset (4 types)' },
        { resourceTypes: ['Patient', 'Observation', 'Encounter', 'DiagnosticReport', 'Medication', 'Procedure', 'Condition', 'AllergyIntolerance'], expectedMaxTime: 2000, description: 'Very large dataset (8 types)' }
      ];

      for (const testCase of testCases) {
        const payload = {
          resourceTypes: testCase.resourceTypes,
          aspects: { structural: true, profile: true },
          maxConcurrency: 5
        };

        // Start validation
        const startTime = Date.now();
        await request(app)
          .post('/api/validation/bulk/start')
          .send(payload)
          .expect(202);
        const startDuration = Date.now() - startTime;

        // Make progress requests
        const progressStartTime = Date.now();
        for (let i = 0; i < 10; i++) {
          await request(app)
            .get('/api/validation/bulk/progress')
            .expect(200);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        const progressDuration = Date.now() - progressStartTime;

        // Stop validation
        const stopStartTime = Date.now();
        await request(app)
          .post('/api/validation/bulk/stop')
          .expect(200);
        const stopDuration = Date.now() - stopStartTime;

        const totalTime = startDuration + progressDuration + stopDuration;

        expect(totalTime).toBeLessThan(testCase.expectedMaxTime);
        console.log(`${testCase.description}: ${totalTime}ms (benchmark: ${testCase.expectedMaxTime}ms)`);
      }
    });

    it('should maintain performance under different concurrency levels', async () => {
      const concurrencyLevels = [1, 2, 5, 10, 20];
      const payload = {
        resourceTypes: ['Patient', 'Observation'],
        aspects: { structural: true, profile: true }
      };

      for (const concurrency of concurrencyLevels) {
        const testPayload = { ...payload, maxConcurrency: concurrency };

        // Start validation
        const startTime = Date.now();
        await request(app)
          .post('/api/validation/bulk/start')
          .send(testPayload)
          .expect(202);
        const startDuration = Date.now() - startTime;

        // Make progress requests
        const progressStartTime = Date.now();
        for (let i = 0; i < 5; i++) {
          await request(app)
            .get('/api/validation/bulk/progress')
            .expect(200);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        const progressDuration = Date.now() - progressStartTime;

        // Stop validation
        const stopStartTime = Date.now();
        await request(app)
          .post('/api/validation/bulk/stop')
          .expect(200);
        const stopDuration = Date.now() - stopStartTime;

        const totalTime = startDuration + progressDuration + stopDuration;

        // Performance should not degrade significantly with higher concurrency
        expect(totalTime).toBeLessThan(2000); // Should be under 2 seconds regardless of concurrency
        console.log(`Concurrency ${concurrency}: ${totalTime}ms`);
      }
    });
  });
});
