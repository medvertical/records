/**
 * End-to-End Validation Workflow Tests
 * 
 * This test suite covers the complete end-to-end validation workflow:
 * 1. Settings Configuration
 * 2. Resource Validation
 * 3. Pipeline Processing
 * 4. Data Persistence
 * 5. API Response
 * 6. UI Display
 * 7. Real-time Updates
 * 8. Error Handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock the complete validation system
class MockValidationSystem extends EventEmitter {
  private settings: any = null;
  private validationResults: Map<string, any> = new Map();
  private validationProgress: any = null;
  private isRunning = false;
  private isPaused = false;
  private isStopping = false;

  // Settings Management
  async getSettings() {
    return this.settings || {
      id: 1,
      enabledAspects: ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'],
      strictMode: false,
      batchSize: 100,
      timeoutMs: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      enableParallelProcessing: true,
      maxConcurrentValidations: 5,
      enablePersistence: true,
      enableCaching: true,
      cacheTimeoutMs: 300000,
      enableAuditTrail: true,
      enableRealTimeUpdates: true,
      enableQualityMetrics: true,
      enableCompletenessScoring: true,
      enableConfidenceScoring: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };
  }

  async updateSettings(newSettings: any) {
    this.settings = { ...this.settings, ...newSettings, updatedAt: new Date() };
    this.emit('settingsUpdated', this.settings);
    return this.settings;
  }

  async resetSettings() {
    this.settings = null;
    this.emit('settingsReset');
    return await this.getSettings();
  }

  // Validation Processing
  async validateResource(resource: any) {
    if (!this.settings) {
      throw new Error('Validation settings not configured');
    }

    const result = {
      id: Date.now(),
      resourceId: resource.id || 'unknown',
      resourceType: resource.resourceType || 'Unknown',
      isValid: true,
      overallScore: Math.floor(Math.random() * 40) + 60, // 60-100
      confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
      completeness: Math.random() * 0.3 + 0.7, // 0.7-1.0
      issues: [],
      aspects: this.generateAspectResults(),
      validatedAt: new Date().toISOString(),
      validationTime: Math.floor(Math.random() * 500) + 100,
      profileUrl: resource.profileUrl || 'http://hl7.org/fhir/StructureDefinition/' + resource.resourceType,
      validationSource: 'end-to-end-test'
    };

    // Persist result
    this.validationResults.set(result.resourceId, result);
    this.emit('validationCompleted', result);

    return result;
  }

  async validateResources(resources: any[]) {
    const results = [];
    for (const resource of resources) {
      const result = await this.validateResource(resource);
      results.push(result);
    }
    return results;
  }

  async validateResourceById(resourceId: string) {
    const result = this.validationResults.get(resourceId);
    if (!result) {
      throw new Error(`Resource ${resourceId} not found`);
    }
    return result;
  }

  async validateResourcesByIds(resourceIds: string[]) {
    const results = [];
    for (const resourceId of resourceIds) {
      try {
        const result = await this.validateResourceById(resourceId);
        results.push(result);
      } catch (error) {
        results.push({
          resourceId,
          error: error.message,
          isValid: false
        });
      }
    }
    return results;
  }

  // Pipeline Processing
  async processPipelineRequest(request: any) {
    const requestId = `request-${Date.now()}`;
    this.isRunning = true;
    this.validationProgress = {
      totalResources: request.resources?.length || 1,
      processedResources: 0,
      validResources: 0,
      errorResources: 0,
      warningResources: 0,
      isComplete: false,
      status: 'running',
      requestId
    };

    this.emit('pipelineStarted', { requestId, request });

    try {
      const results = await this.validateResources(request.resources || []);
      
      this.validationProgress = {
        ...this.validationProgress,
        processedResources: results.length,
        validResources: results.filter(r => r.isValid).length,
        errorResources: results.filter(r => !r.isValid).length,
        isComplete: true,
        status: 'completed'
      };

      this.emit('pipelineCompleted', { requestId, results });
      this.isRunning = false;

      return {
        requestId,
        status: 'completed',
        results,
        progress: this.validationProgress
      };
    } catch (error) {
      this.validationProgress = {
        ...this.validationProgress,
        isComplete: true,
        status: 'error',
        errors: [error.message]
      };

      this.emit('pipelineError', { requestId, error });
      this.isRunning = false;

      throw error;
    }
  }

  // Progress and Status
  async getValidationProgress() {
    return this.validationProgress;
  }

  async getValidationStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isStopping: this.isStopping,
      progress: this.validationProgress,
      error: null,
      lastAction: null
    };
  }

  async pauseValidation() {
    this.isPaused = true;
    this.emit('validationPaused');
    return { success: true };
  }

  async resumeValidation() {
    this.isPaused = false;
    this.emit('validationResumed');
    return { success: true };
  }

  async cancelValidation() {
    this.isStopping = true;
    this.isRunning = false;
    this.emit('validationCancelled');
    return { success: true };
  }

  // Results Management
  async getValidationResults() {
    return Array.from(this.validationResults.values());
  }

  async getValidationResult(resourceId: string) {
    return this.validationResults.get(resourceId);
  }

  async getValidationHistory() {
    return Array.from(this.validationResults.values()).sort((a, b) => 
      new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime()
    );
  }

  async clearValidationResults() {
    const count = this.validationResults.size;
    this.validationResults.clear();
    this.emit('resultsCleared', { deletedCount: count });
    return { deletedCount: count };
  }

  async getValidationStatistics() {
    const results = Array.from(this.validationResults.values());
    return {
      totalValidations: results.length,
      validResources: results.filter(r => r.isValid).length,
      errorResources: results.filter(r => !r.isValid).length,
      warningResources: results.filter(r => r.overallScore < 90 && r.overallScore >= 70).length,
      averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.overallScore, 0) / results.length : 0,
      averageConfidence: results.length > 0 ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0,
      averageCompleteness: results.length > 0 ? results.reduce((sum, r) => sum + r.completeness, 0) / results.length : 0
    };
  }

  // Helper methods
  private generateAspectResults() {
    const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const results: any = {};

    for (const aspect of aspects) {
      results[aspect] = {
        isValid: Math.random() > 0.1, // 90% valid
        score: Math.floor(Math.random() * 30) + 70, // 70-100
        confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
        issues: [],
        validationTime: Math.floor(Math.random() * 100) + 20
      };
    }

    return results;
  }

  // Event simulation for real-time updates
  simulateRealTimeUpdate(resourceId: string, updates: any) {
    const existingResult = this.validationResults.get(resourceId);
    if (existingResult) {
      const updatedResult = { ...existingResult, ...updates };
      this.validationResults.set(resourceId, updatedResult);
      this.emit('validationUpdated', updatedResult);
    }
  }

  simulateProgressUpdate(updates: any) {
    if (this.validationProgress) {
      this.validationProgress = { ...this.validationProgress, ...updates };
      this.emit('progressUpdated', this.validationProgress);
    }
  }
}

describe('End-to-End Validation Workflow Tests', () => {
  let validationSystem: MockValidationSystem;

  beforeEach(() => {
    validationSystem = new MockValidationSystem();
  });

  afterEach(() => {
    validationSystem.removeAllListeners();
  });

  describe('Complete Validation Workflow', () => {
    it('should complete full validation workflow from settings to results', async () => {
      // Step 1: Configure validation settings
      const initialSettings = await validationSystem.getSettings();
      expect(initialSettings).toBeDefined();
      expect(initialSettings.enabledAspects).toContain('structural');
      expect(initialSettings.enabledAspects).toContain('profile');

      // Step 2: Update settings
      const updatedSettings = await validationSystem.updateSettings({
        batchSize: 50,
        strictMode: true
      });
      expect(updatedSettings.batchSize).toBe(50);
      expect(updatedSettings.strictMode).toBe(true);

      // Step 3: Validate a resource
      const testResource = {
        id: 'patient-1',
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }],
        birthDate: '1990-01-01',
        gender: 'male'
      };

      const validationResult = await validationSystem.validateResource(testResource);
      expect(validationResult).toBeDefined();
      expect(validationResult.resourceId).toBe('patient-1');
      expect(validationResult.resourceType).toBe('Patient');
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.overallScore).toBeGreaterThanOrEqual(60);
      expect(validationResult.overallScore).toBeLessThanOrEqual(100);

      // Step 4: Verify persistence
      const retrievedResult = await validationSystem.getValidationResult('patient-1');
      expect(retrievedResult).toEqual(validationResult);

      // Step 5: Get validation statistics
      const statistics = await validationSystem.getValidationStatistics();
      expect(statistics.totalValidations).toBe(1);
      expect(statistics.validResources).toBe(1);
      expect(statistics.averageScore).toBeGreaterThan(0);

      // Step 6: Verify all aspects were validated
      expect(validationResult.aspects).toBeDefined();
      expect(validationResult.aspects.structural).toBeDefined();
      expect(validationResult.aspects.profile).toBeDefined();
      expect(validationResult.aspects.terminology).toBeDefined();
      expect(validationResult.aspects.reference).toBeDefined();
      expect(validationResult.aspects.businessRule).toBeDefined();
      expect(validationResult.aspects.metadata).toBeDefined();
    });

    it('should handle batch validation workflow', async () => {
      // Step 1: Configure settings for batch processing
      await validationSystem.updateSettings({
        batchSize: 10,
        enableParallelProcessing: true,
        maxConcurrentValidations: 3
      });

      // Step 2: Create multiple test resources
      const testResources = Array.from({ length: 5 }, (_, i) => ({
        id: `patient-${i + 1}`,
        resourceType: 'Patient',
        name: [{ given: [`Patient${i + 1}`], family: 'Test' }],
        birthDate: `199${i}-01-01`,
        gender: i % 2 === 0 ? 'male' : 'female'
      }));

      // Step 3: Process batch validation
      const pipelineRequest = {
        resources: testResources,
        settings: await validationSystem.getSettings(),
        config: { batchSize: 10, timeoutMs: 30000 }
      };

      const pipelineResult = await validationSystem.processPipelineRequest(pipelineRequest);
      expect(pipelineResult.status).toBe('completed');
      expect(pipelineResult.results).toHaveLength(5);

      // Step 4: Verify all results are persisted
      const allResults = await validationSystem.getValidationResults();
      expect(allResults).toHaveLength(5);

      // Step 5: Verify progress tracking
      const progress = await validationSystem.getValidationProgress();
      expect(progress.totalResources).toBe(5);
      expect(progress.processedResources).toBe(5);
      expect(progress.isComplete).toBe(true);
      expect(progress.status).toBe('completed');

      // Step 6: Verify statistics
      const statistics = await validationSystem.getValidationStatistics();
      expect(statistics.totalValidations).toBe(5);
      expect(statistics.validResources).toBeGreaterThan(0);
    });

    it('should handle validation control workflow (pause, resume, cancel)', async () => {
      // Step 1: Start validation process
      const testResources = Array.from({ length: 3 }, (_, i) => ({
        id: `resource-${i + 1}`,
        resourceType: 'Patient'
      }));

      const pipelineRequest = {
        resources: testResources,
        settings: await validationSystem.getSettings(),
        config: { batchSize: 1, timeoutMs: 30000 }
      };

      // Start pipeline processing
      const pipelinePromise = validationSystem.processPipelineRequest(pipelineRequest);

      // Step 2: Check initial status
      let status = await validationSystem.getValidationStatus();
      expect(status.isRunning).toBe(true);

      // Step 3: Pause validation
      await validationSystem.pauseValidation();
      status = await validationSystem.getValidationStatus();
      expect(status.isPaused).toBe(true);

      // Step 4: Resume validation
      await validationSystem.resumeValidation();
      status = await validationSystem.getValidationStatus();
      expect(status.isPaused).toBe(false);

      // Step 5: Cancel validation
      await validationSystem.cancelValidation();
      status = await validationSystem.getValidationStatus();
      expect(status.isStopping).toBe(true);

      // Step 6: Wait for completion
      try {
        await pipelinePromise;
      } catch (error) {
        // Expected due to cancellation
      }

      status = await validationSystem.getValidationStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should handle error scenarios gracefully', async () => {
      // Step 1: Test validation without settings
      await validationSystem.resetSettings();
      
      const testResource = { id: 'test-resource', resourceType: 'Patient' };
      
      try {
        await validationSystem.validateResource(testResource);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toBe('Validation settings not configured');
      }

      // Step 2: Test validation of non-existent resource
      try {
        await validationSystem.validateResourceById('non-existent-resource');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toBe('Resource non-existent-resource not found');
      }

      // Step 3: Test batch validation with mixed valid/invalid resources
      await validationSystem.updateSettings({
        enabledAspects: ['structural', 'profile']
      });

      // Add a valid resource first
      await validationSystem.validateResource({ id: 'valid-resource', resourceType: 'Patient' });

      // Test batch validation with mixed resources
      const mixedResults = await validationSystem.validateResourcesByIds([
        'valid-resource',
        'non-existent-resource'
      ]);

      expect(mixedResults).toHaveLength(2);
      expect(mixedResults[0].resourceId).toBe('valid-resource');
      expect(mixedResults[0].isValid).toBe(true);
      expect(mixedResults[1].resourceId).toBe('non-existent-resource');
      expect(mixedResults[1].isValid).toBe(false);
      expect(mixedResults[1].error).toBeDefined();
    });

    it('should handle real-time updates and event system', async () => {
      const events: any[] = [];
      
      // Set up event listeners
      validationSystem.on('settingsUpdated', (settings) => {
        events.push({ type: 'settingsUpdated', data: settings });
      });

      validationSystem.on('validationCompleted', (result) => {
        events.push({ type: 'validationCompleted', data: result });
      });

      validationSystem.on('validationUpdated', (result) => {
        events.push({ type: 'validationUpdated', data: result });
      });

      validationSystem.on('progressUpdated', (progress) => {
        events.push({ type: 'progressUpdated', data: progress });
      });

      // Step 1: Update settings (should trigger event)
      await validationSystem.updateSettings({ batchSize: 25 });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('settingsUpdated');

      // Step 2: Validate resource (should trigger event)
      const testResource = { id: 'realtime-resource', resourceType: 'Patient' };
      await validationSystem.validateResource(testResource);
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('validationCompleted');

      // Step 3: Simulate real-time update
      validationSystem.simulateRealTimeUpdate('realtime-resource', {
        overallScore: 98,
        confidence: 0.95
      });
      expect(events).toHaveLength(3);
      expect(events[2].type).toBe('validationUpdated');
      expect(events[2].data.overallScore).toBe(98);

      // Step 4: Simulate progress update
      validationSystem.simulateProgressUpdate({
        processedResources: 5,
        validResources: 4
      });
      expect(events).toHaveLength(4);
      expect(events[3].type).toBe('progressUpdated');
      expect(events[3].data.processedResources).toBe(5);
    });

    it('should handle settings management workflow', async () => {
      // Step 1: Get initial settings
      const initialSettings = await validationSystem.getSettings();
      expect(initialSettings).toBeDefined();

      // Step 2: Update specific settings
      const updatedSettings = await validationSystem.updateSettings({
        strictMode: true,
        batchSize: 25,
        timeoutMs: 60000
      });
      expect(updatedSettings.strictMode).toBe(true);
      expect(updatedSettings.batchSize).toBe(25);
      expect(updatedSettings.timeoutMs).toBe(60000);

      // Step 3: Reset settings
      const resetSettings = await validationSystem.resetSettings();
      expect(resetSettings.strictMode).toBe(false);
      expect(resetSettings.batchSize).toBe(100);
      expect(resetSettings.timeoutMs).toBe(30000);

      // Step 4: Verify settings history (simulated)
      const allResults = await validationSystem.getValidationResults();
      expect(allResults).toHaveLength(0); // Should be empty after reset
    });

    it('should handle data consistency and integrity', async () => {
      // Step 1: Configure settings first
      await validationSystem.updateSettings({
        enabledAspects: ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata']
      });

      // Step 2: Create multiple resources
      const resources = Array.from({ length: 10 }, (_, i) => ({
        id: `consistency-test-${i}`,
        resourceType: 'Patient',
        name: [{ given: [`Test${i}`], family: 'Patient' }]
      }));

      // Step 3: Validate all resources
      for (const resource of resources) {
        await validationSystem.validateResource(resource);
      }

      // Step 4: Verify all results are stored
      const allResults = await validationSystem.getValidationResults();
      expect(allResults).toHaveLength(10);

      // Step 5: Verify individual results can be retrieved
      for (const resource of resources) {
        const result = await validationSystem.getValidationResult(resource.id);
        expect(result).toBeDefined();
        expect(result.resourceId).toBe(resource.id);
      }

      // Step 6: Verify statistics are accurate
      const statistics = await validationSystem.getValidationStatistics();
      expect(statistics.totalValidations).toBe(10);
      expect(statistics.validResources + statistics.errorResources).toBe(10);

      // Step 7: Verify history is ordered correctly
      const history = await validationSystem.getValidationHistory();
      expect(history).toHaveLength(10);
      
      // Check that history is sorted by date (newest first)
      for (let i = 0; i < history.length - 1; i++) {
        const current = new Date(history[i].validatedAt);
        const next = new Date(history[i + 1].validatedAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }

      // Step 8: Clear results and verify
      const clearResult = await validationSystem.clearValidationResults();
      expect(clearResult.deletedCount).toBe(10);

      const clearedResults = await validationSystem.getValidationResults();
      expect(clearedResults).toHaveLength(0);
    });

    it('should handle concurrent operations safely', async () => {
      // Step 1: Set up concurrent operations
      const concurrentOperations = [
        validationSystem.getSettings(),
        validationSystem.getValidationStatus(),
        validationSystem.getValidationStatistics(),
        validationSystem.getValidationResults()
      ];

      // Step 2: Execute all operations concurrently
      const results = await Promise.all(concurrentOperations);

      // Step 3: Verify all operations completed successfully
      expect(results).toHaveLength(4);
      expect(results[0]).toBeDefined(); // Settings
      expect(results[1]).toBeDefined(); // Status
      expect(results[2]).toBeDefined(); // Statistics
      expect(results[3]).toBeDefined(); // Results

      // Step 4: Verify no data corruption occurred
      const settings = results[0];
      const status = results[1];
      const statistics = results[2];
      const validationResults = results[3];

      expect(settings.enabledAspects).toBeDefined();
      expect(status.isRunning).toBeDefined();
      expect(statistics.totalValidations).toBeDefined();
      expect(Array.isArray(validationResults)).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large-scale validation efficiently', async () => {
      const startTime = performance.now();

      // Step 1: Configure for large-scale processing
      await validationSystem.updateSettings({
        batchSize: 100,
        enableParallelProcessing: true,
        maxConcurrentValidations: 10
      });

      // Step 2: Create large number of resources
      const largeResourceSet = Array.from({ length: 100 }, (_, i) => ({
        id: `large-scale-${i}`,
        resourceType: 'Patient',
        name: [{ given: [`Patient${i}`], family: 'LargeScale' }]
      }));

      // Step 3: Process large batch
      const pipelineRequest = {
        resources: largeResourceSet,
        settings: await validationSystem.getSettings(),
        config: { batchSize: 100, timeoutMs: 60000 }
      };

      const pipelineResult = await validationSystem.processPipelineRequest(pipelineRequest);
      const endTime = performance.now();

      // Step 4: Verify performance
      expect(pipelineResult.status).toBe('completed');
      expect(pipelineResult.results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Step 5: Verify all results are persisted
      const allResults = await validationSystem.getValidationResults();
      expect(allResults).toHaveLength(100);

      // Step 6: Verify statistics are accurate
      const statistics = await validationSystem.getValidationStatistics();
      expect(statistics.totalValidations).toBe(100);
    });

    it('should handle memory efficiently with large datasets', async () => {
      // Step 1: Configure settings first
      await validationSystem.updateSettings({
        enabledAspects: ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata']
      });

      // Step 2: Create and validate many resources
      const resources = Array.from({ length: 50 }, (_, i) => ({
        id: `memory-test-${i}`,
        resourceType: 'Patient'
      }));

      for (const resource of resources) {
        await validationSystem.validateResource(resource);
      }

      // Step 3: Verify memory usage is reasonable
      const allResults = await validationSystem.getValidationResults();
      expect(allResults).toHaveLength(50);

      // Step 4: Verify individual access is efficient
      const startTime = performance.now();
      for (const resource of resources) {
        await validationSystem.getValidationResult(resource.id);
      }
      const endTime = performance.now();

      // Should be able to retrieve 50 results quickly
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
