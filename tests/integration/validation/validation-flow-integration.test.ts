/**
 * Validation Flow Integration Tests
 * 
 * This test suite covers the complete validation flow:
 * Settings → Pipeline → Persistence → API → UI
 * 
 * It tests the integration between all components of the validation system
 * to ensure they work together correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';

// Mock the validation services
const mockValidationSettingsService = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
  getSettingsHistory: vi.fn(),
  applyPreset: vi.fn(),
  rollbackSettings: vi.fn(),
  testSettings: vi.fn(),
  getSettingsStatistics: vi.fn(),
  getAuditTrail: vi.fn(),
  getAuditTrailStatistics: vi.fn()
};

const mockConsolidatedValidationService = {
  validateResource: vi.fn(),
  validateResources: vi.fn(),
  validateResourceById: vi.fn(),
  validateResourcesByIds: vi.fn(),
  getValidationResult: vi.fn(),
  getValidationResults: vi.fn(),
  getValidationHistory: vi.fn(),
  clearValidationResults: vi.fn(),
  getValidationStatistics: vi.fn(),
  getValidationProgress: vi.fn(),
  pauseValidation: vi.fn(),
  resumeValidation: vi.fn(),
  cancelValidation: vi.fn(),
  getValidationStatus: vi.fn()
};

const mockValidationPipeline = {
  processRequest: vi.fn(),
  getRequestStatus: vi.fn(),
  cancelRequest: vi.fn(),
  getPipelineStatistics: vi.fn()
};

const mockStorage = {
  getValidationResults: vi.fn(),
  createValidationResult: vi.fn(),
  updateValidationResult: vi.fn(),
  deleteValidationResult: vi.fn(),
  getValidationResultsByResourceId: vi.fn(),
  getValidationResultsByResourceIds: vi.fn(),
  getValidationResultsByProfileId: vi.fn(),
  getValidationResultsByDateRange: vi.fn(),
  getValidationStatistics: vi.fn(),
  clearValidationResults: vi.fn(),
  cleanupOldValidationResults: vi.fn()
};

// Mock the validation settings
const mockValidationSettings = {
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

// Mock validation results
const mockValidationResult = {
  id: 1,
  resourceId: 'test-resource-1',
  resourceType: 'Patient',
  isValid: true,
  overallScore: 95,
  confidence: 0.9,
  completeness: 0.85,
  issues: [],
  aspects: {
    structural: {
      isValid: true,
      score: 100,
      confidence: 0.95,
      issues: [],
      validationTime: 50
    },
    profile: {
      isValid: true,
      score: 90,
      confidence: 0.85,
      issues: [],
      validationTime: 100
    },
    terminology: {
      isValid: true,
      score: 95,
      confidence: 0.9,
      issues: [],
      validationTime: 75
    },
    reference: {
      isValid: true,
      score: 100,
      confidence: 0.95,
      issues: [],
      validationTime: 60
    },
    businessRule: {
      isValid: true,
      score: 90,
      confidence: 0.8,
      issues: [],
      validationTime: 80
    },
    metadata: {
      isValid: true,
      score: 95,
      confidence: 0.9,
      issues: [],
      validationTime: 40
    }
  },
  validatedAt: new Date().toISOString(),
  validationTime: 405,
  profileUrl: 'http://hl7.org/fhir/StructureDefinition/Patient',
  validationSource: 'consolidated-validation-service'
};

// Mock FHIR resource
const mockFhirResource = {
  id: 'test-resource-1',
  resourceType: 'Patient',
  name: [{ given: ['John'], family: 'Doe' }],
  birthDate: '1990-01-01',
  gender: 'male'
};

describe('Validation Flow Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Setup mock implementations
    setupMockImplementations();
    
    // Setup routes
    setupRoutes();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupMockImplementations() {
    // Mock validation settings service
    mockValidationSettingsService.getSettings.mockResolvedValue(mockValidationSettings);
    mockValidationSettingsService.updateSettings.mockResolvedValue(mockValidationSettings);
    mockValidationSettingsService.resetSettings.mockResolvedValue(mockValidationSettings);
    mockValidationSettingsService.getSettingsHistory.mockResolvedValue([mockValidationSettings]);
    mockValidationSettingsService.applyPreset.mockResolvedValue(mockValidationSettings);
    mockValidationSettingsService.rollbackSettings.mockResolvedValue(mockValidationSettings);
    mockValidationSettingsService.testSettings.mockResolvedValue({ isValid: true, errors: [] });
    mockValidationSettingsService.getSettingsStatistics.mockResolvedValue({
      totalSettings: 1,
      activeSettings: 1,
      lastUpdated: new Date()
    });
    mockValidationSettingsService.getAuditTrail.mockResolvedValue([]);
    mockValidationSettingsService.getAuditTrailStatistics.mockResolvedValue({
      totalChanges: 0,
      lastChange: null
    });

    // Mock consolidated validation service
    mockConsolidatedValidationService.validateResource.mockResolvedValue(mockValidationResult);
    mockConsolidatedValidationService.validateResources.mockResolvedValue([mockValidationResult]);
    mockConsolidatedValidationService.validateResourceById.mockResolvedValue(mockValidationResult);
    mockConsolidatedValidationService.validateResourcesByIds.mockResolvedValue([mockValidationResult]);
    mockConsolidatedValidationService.getValidationResult.mockResolvedValue(mockValidationResult);
    mockConsolidatedValidationService.getValidationResults.mockResolvedValue([mockValidationResult]);
    mockConsolidatedValidationService.getValidationHistory.mockResolvedValue([mockValidationResult]);
    mockConsolidatedValidationService.clearValidationResults.mockResolvedValue({ deletedCount: 1 });
    mockConsolidatedValidationService.getValidationStatistics.mockResolvedValue({
      totalValidations: 1,
      validResources: 1,
      errorResources: 0,
      warningResources: 0,
      averageScore: 95,
      averageConfidence: 0.9,
      averageCompleteness: 0.85
    });
    mockConsolidatedValidationService.getValidationProgress.mockResolvedValue({
      totalResources: 1,
      processedResources: 1,
      validResources: 1,
      errorResources: 0,
      warningResources: 0,
      isComplete: true,
      status: 'completed'
    });
    mockConsolidatedValidationService.pauseValidation.mockResolvedValue({ success: true });
    mockConsolidatedValidationService.resumeValidation.mockResolvedValue({ success: true });
    mockConsolidatedValidationService.cancelValidation.mockResolvedValue({ success: true });
    mockConsolidatedValidationService.getValidationStatus.mockResolvedValue({
      isRunning: false,
      isPaused: false,
      isStopping: false,
      progress: null,
      error: null,
      lastAction: null
    });

    // Mock validation pipeline
    mockValidationPipeline.processRequest.mockResolvedValue({
      requestId: 'test-request-1',
      status: 'completed',
      results: [mockValidationResult]
    });
    mockValidationPipeline.getRequestStatus.mockResolvedValue({
      requestId: 'test-request-1',
      status: 'completed',
      progress: 100,
      results: [mockValidationResult]
    });
    mockValidationPipeline.cancelRequest.mockResolvedValue({ success: true });
    mockValidationPipeline.getPipelineStatistics.mockResolvedValue({
      totalRequests: 1,
      completedRequests: 1,
      failedRequests: 0,
      averageProcessingTime: 405
    });

    // Mock storage
    mockStorage.getValidationResults.mockResolvedValue([mockValidationResult]);
    mockStorage.createValidationResult.mockResolvedValue(mockValidationResult);
    mockStorage.updateValidationResult.mockResolvedValue(mockValidationResult);
    mockStorage.deleteValidationResult.mockResolvedValue({ deletedCount: 1 });
    mockStorage.getValidationResultsByResourceId.mockResolvedValue([mockValidationResult]);
    mockStorage.getValidationResultsByResourceIds.mockResolvedValue([mockValidationResult]);
    mockStorage.getValidationResultsByProfileId.mockResolvedValue([mockValidationResult]);
    mockStorage.getValidationResultsByDateRange.mockResolvedValue([mockValidationResult]);
    mockStorage.getValidationStatistics.mockResolvedValue({
      totalResults: 1,
      validResults: 1,
      errorResults: 0,
      warningResults: 0,
      averageScore: 95
    });
    mockStorage.clearValidationResults.mockResolvedValue({ deletedCount: 1 });
    mockStorage.cleanupOldValidationResults.mockResolvedValue({ deletedCount: 0 });
  }

  function setupRoutes() {
    // Validation settings routes
    app.get('/api/validation/settings', async (req, res) => {
      try {
        const settings = await mockValidationSettingsService.getSettings();
        res.json({ success: true, data: settings });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get settings' });
      }
    });

    app.post('/api/validation/settings', async (req, res) => {
      try {
        const { settings } = req.body;
        const updatedSettings = await mockValidationSettingsService.updateSettings(settings);
        res.json({ success: true, data: updatedSettings });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update settings' });
      }
    });

    app.get('/api/validation/settings/history', async (req, res) => {
      try {
        const history = await mockValidationSettingsService.getSettingsHistory();
        res.json({ success: true, data: history });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get settings history' });
      }
    });

    app.post('/api/validation/settings/reset', async (req, res) => {
      try {
        const settings = await mockValidationSettingsService.resetSettings();
        res.json({ success: true, data: settings });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to reset settings' });
      }
    });

    app.post('/api/validation/settings/preset', async (req, res) => {
      try {
        const { presetName } = req.body;
        const settings = await mockValidationSettingsService.applyPreset(presetName);
        res.json({ success: true, data: settings });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to apply preset' });
      }
    });

    app.post('/api/validation/settings/rollback', async (req, res) => {
      try {
        const { version } = req.body;
        const settings = await mockValidationSettingsService.rollbackSettings(version);
        res.json({ success: true, data: settings });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to rollback settings' });
      }
    });

    app.post('/api/validation/settings/test', async (req, res) => {
      try {
        const { settings } = req.body;
        const result = await mockValidationSettingsService.testSettings(settings);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to test settings' });
      }
    });

    app.get('/api/validation/settings/statistics', async (req, res) => {
      try {
        const statistics = await mockValidationSettingsService.getSettingsStatistics();
        res.json({ success: true, data: statistics });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get settings statistics' });
      }
    });

    app.get('/api/validation/settings/audit-trail', async (req, res) => {
      try {
        const auditTrail = await mockValidationSettingsService.getAuditTrail();
        res.json({ success: true, data: auditTrail });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get audit trail' });
      }
    });

    app.get('/api/validation/settings/audit-trail/statistics', async (req, res) => {
      try {
        const statistics = await mockValidationSettingsService.getAuditTrailStatistics();
        res.json({ success: true, data: statistics });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get audit trail statistics' });
      }
    });

    // Validation routes
    app.post('/api/validation/validate', async (req, res) => {
      try {
        const { resource } = req.body;
        const result = await mockConsolidatedValidationService.validateResource(resource);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to validate resource' });
      }
    });

    app.post('/api/validation/validate-batch', async (req, res) => {
      try {
        const { resources } = req.body;
        const results = await mockConsolidatedValidationService.validateResources(resources);
        res.json({ success: true, data: results });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to validate resources' });
      }
    });

    app.post('/api/validation/validate-by-id', async (req, res) => {
      try {
        const { resourceId } = req.body;
        const result = await mockConsolidatedValidationService.validateResourceById(resourceId);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to validate resource by ID' });
      }
    });

    app.post('/api/validation/validate-by-ids', async (req, res) => {
      try {
        const { resourceIds } = req.body;
        const results = await mockConsolidatedValidationService.validateResourcesByIds(resourceIds);
        res.json({ success: true, data: results });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to validate resources by IDs' });
      }
    });

    app.get('/api/validation/results/:resourceId', async (req, res) => {
      try {
        const { resourceId } = req.params;
        const result = await mockConsolidatedValidationService.getValidationResult(resourceId);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get validation result' });
      }
    });

    app.get('/api/validation/results', async (req, res) => {
      try {
        const results = await mockConsolidatedValidationService.getValidationResults();
        res.json({ success: true, data: results });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get validation results' });
      }
    });

    app.get('/api/validation/history', async (req, res) => {
      try {
        const history = await mockConsolidatedValidationService.getValidationHistory();
        res.json({ success: true, data: history });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get validation history' });
      }
    });

    app.delete('/api/validation/results', async (req, res) => {
      try {
        const result = await mockConsolidatedValidationService.clearValidationResults();
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to clear validation results' });
      }
    });

    app.get('/api/validation/statistics', async (req, res) => {
      try {
        const statistics = await mockConsolidatedValidationService.getValidationStatistics();
        res.json({ success: true, data: statistics });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get validation statistics' });
      }
    });

    app.get('/api/validation/progress', async (req, res) => {
      try {
        const progress = await mockConsolidatedValidationService.getValidationProgress();
        res.json({ success: true, data: progress });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get validation progress' });
      }
    });

    app.post('/api/validation/pause', async (req, res) => {
      try {
        const result = await mockConsolidatedValidationService.pauseValidation();
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to pause validation' });
      }
    });

    app.post('/api/validation/resume', async (req, res) => {
      try {
        const result = await mockConsolidatedValidationService.resumeValidation();
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to resume validation' });
      }
    });

    app.post('/api/validation/cancel', async (req, res) => {
      try {
        const result = await mockConsolidatedValidationService.cancelValidation();
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to cancel validation' });
      }
    });

    app.get('/api/validation/status', async (req, res) => {
      try {
        const status = await mockConsolidatedValidationService.getValidationStatus();
        res.json({ success: true, data: status });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get validation status' });
      }
    });

    // Pipeline routes
    app.post('/api/validation/pipeline/process', async (req, res) => {
      try {
        const { request } = req.body;
        const result = await mockValidationPipeline.processRequest(request);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to process pipeline request' });
      }
    });

    app.get('/api/validation/pipeline/status/:requestId', async (req, res) => {
      try {
        const { requestId } = req.params;
        const status = await mockValidationPipeline.getRequestStatus(requestId);
        res.json({ success: true, data: status });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get pipeline status' });
      }
    });

    app.post('/api/validation/pipeline/cancel/:requestId', async (req, res) => {
      try {
        const { requestId } = req.params;
        const result = await mockValidationPipeline.cancelRequest(requestId);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to cancel pipeline request' });
      }
    });

    app.get('/api/validation/pipeline/statistics', async (req, res) => {
      try {
        const statistics = await mockValidationPipeline.getPipelineStatistics();
        res.json({ success: true, data: statistics });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get pipeline statistics' });
      }
    });
  }

  describe('Settings → Pipeline → Persistence → API → UI Flow', () => {
    it('should complete full validation flow from settings to UI', async () => {
      // Step 1: Get validation settings
      const settingsResponse = await request(app)
        .get('/api/validation/settings')
        .expect(200);

      expect(settingsResponse.body.success).toBe(true);
      expect(settingsResponse.body.data).toEqual(mockValidationSettings);
      expect(mockValidationSettingsService.getSettings).toHaveBeenCalledTimes(1);

      // Step 2: Update validation settings
      const updatedSettings = { ...mockValidationSettings, batchSize: 50 };
      const updateResponse = await request(app)
        .post('/api/validation/settings')
        .send({ settings: updatedSettings })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(mockValidationSettingsService.updateSettings).toHaveBeenCalledWith(updatedSettings);

      // Step 3: Validate a resource using the pipeline
      const validationResponse = await request(app)
        .post('/api/validation/validate')
        .send({ resource: mockFhirResource })
        .expect(200);

      expect(validationResponse.body.success).toBe(true);
      expect(validationResponse.body.data).toEqual(mockValidationResult);
      expect(mockConsolidatedValidationService.validateResource).toHaveBeenCalledWith(mockFhirResource);

      // Step 4: Check persistence by retrieving validation results
      const resultsResponse = await request(app)
        .get('/api/validation/results')
        .expect(200);

      expect(resultsResponse.body.success).toBe(true);
      expect(resultsResponse.body.data).toEqual([mockValidationResult]);
      expect(mockConsolidatedValidationService.getValidationResults).toHaveBeenCalledTimes(1);

      // Step 5: Get validation statistics for UI display
      const statisticsResponse = await request(app)
        .get('/api/validation/statistics')
        .expect(200);

      expect(statisticsResponse.body.success).toBe(true);
      expect(statisticsResponse.body.data).toHaveProperty('totalValidations');
      expect(statisticsResponse.body.data).toHaveProperty('validResources');
      expect(statisticsResponse.body.data).toHaveProperty('averageScore');
      expect(mockConsolidatedValidationService.getValidationStatistics).toHaveBeenCalledTimes(1);

      // Step 6: Get validation progress for UI display
      const progressResponse = await request(app)
        .get('/api/validation/progress')
        .expect(200);

      expect(progressResponse.body.success).toBe(true);
      expect(progressResponse.body.data).toHaveProperty('totalResources');
      expect(progressResponse.body.data).toHaveProperty('processedResources');
      expect(progressResponse.body.data).toHaveProperty('isComplete');
      expect(mockConsolidatedValidationService.getValidationProgress).toHaveBeenCalledTimes(1);
    });

    it('should handle batch validation flow', async () => {
      const resources = [mockFhirResource, { ...mockFhirResource, id: 'test-resource-2' }];
      const expectedResults = [mockValidationResult, { ...mockValidationResult, id: 2, resourceId: 'test-resource-2' }];

      // Mock batch validation
      mockConsolidatedValidationService.validateResources.mockResolvedValue(expectedResults);

      // Step 1: Validate multiple resources
      const batchResponse = await request(app)
        .post('/api/validation/validate-batch')
        .send({ resources })
        .expect(200);

      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.data).toEqual(expectedResults);
      expect(mockConsolidatedValidationService.validateResources).toHaveBeenCalledWith(resources);

      // Step 2: Validate by resource IDs
      const resourceIds = ['test-resource-1', 'test-resource-2'];
      const idsResponse = await request(app)
        .post('/api/validation/validate-by-ids')
        .send({ resourceIds })
        .expect(200);

      expect(idsResponse.body.success).toBe(true);
      expect(mockConsolidatedValidationService.validateResourcesByIds).toHaveBeenCalledWith(resourceIds);
    });

    it('should handle validation control flow (pause, resume, cancel)', async () => {
      // Step 1: Pause validation
      const pauseResponse = await request(app)
        .post('/api/validation/pause')
        .expect(200);

      expect(pauseResponse.body.success).toBe(true);
      expect(mockConsolidatedValidationService.pauseValidation).toHaveBeenCalledTimes(1);

      // Step 2: Resume validation
      const resumeResponse = await request(app)
        .post('/api/validation/resume')
        .expect(200);

      expect(resumeResponse.body.success).toBe(true);
      expect(mockConsolidatedValidationService.resumeValidation).toHaveBeenCalledTimes(1);

      // Step 3: Cancel validation
      const cancelResponse = await request(app)
        .post('/api/validation/cancel')
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(mockConsolidatedValidationService.cancelValidation).toHaveBeenCalledTimes(1);

      // Step 4: Get validation status
      const statusResponse = await request(app)
        .get('/api/validation/status')
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data).toHaveProperty('isRunning');
      expect(statusResponse.body.data).toHaveProperty('isPaused');
      expect(statusResponse.body.data).toHaveProperty('isStopping');
      expect(mockConsolidatedValidationService.getValidationStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle settings management flow', async () => {
      // Step 1: Get settings history
      const historyResponse = await request(app)
        .get('/api/validation/settings/history')
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(mockValidationSettingsService.getSettingsHistory).toHaveBeenCalledTimes(1);

      // Step 2: Apply preset
      const presetResponse = await request(app)
        .post('/api/validation/settings/preset')
        .send({ presetName: 'default' })
        .expect(200);

      expect(presetResponse.body.success).toBe(true);
      expect(mockValidationSettingsService.applyPreset).toHaveBeenCalledWith('default');

      // Step 3: Test settings
      const testResponse = await request(app)
        .post('/api/validation/settings/test')
        .send({ settings: mockValidationSettings })
        .expect(200);

      expect(testResponse.body.success).toBe(true);
      expect(testResponse.body.data).toHaveProperty('isValid');
      expect(mockValidationSettingsService.testSettings).toHaveBeenCalledWith(mockValidationSettings);

      // Step 4: Get settings statistics
      const statsResponse = await request(app)
        .get('/api/validation/settings/statistics')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('totalSettings');
      expect(statsResponse.body.data).toHaveProperty('activeSettings');
      expect(mockValidationSettingsService.getSettingsStatistics).toHaveBeenCalledTimes(1);

      // Step 5: Get audit trail
      const auditResponse = await request(app)
        .get('/api/validation/settings/audit-trail')
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(mockValidationSettingsService.getAuditTrail).toHaveBeenCalledTimes(1);

      // Step 6: Reset settings
      const resetResponse = await request(app)
        .post('/api/validation/settings/reset')
        .expect(200);

      expect(resetResponse.body.success).toBe(true);
      expect(mockValidationSettingsService.resetSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle pipeline processing flow', async () => {
      const pipelineRequest = {
        resources: [mockFhirResource],
        settings: mockValidationSettings,
        config: { batchSize: 50, timeoutMs: 30000 }
      };

      // Step 1: Process pipeline request
      const processResponse = await request(app)
        .post('/api/validation/pipeline/process')
        .send({ request: pipelineRequest })
        .expect(200);

      expect(processResponse.body.success).toBe(true);
      expect(processResponse.body.data).toHaveProperty('requestId');
      expect(processResponse.body.data).toHaveProperty('status');
      expect(mockValidationPipeline.processRequest).toHaveBeenCalledWith(pipelineRequest);

      // Step 2: Get pipeline status
      const statusResponse = await request(app)
        .get('/api/validation/pipeline/status/test-request-1')
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data).toHaveProperty('requestId');
      expect(statusResponse.body.data).toHaveProperty('status');
      expect(mockValidationPipeline.getRequestStatus).toHaveBeenCalledWith('test-request-1');

      // Step 3: Cancel pipeline request
      const cancelResponse = await request(app)
        .post('/api/validation/pipeline/cancel/test-request-1')
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(mockValidationPipeline.cancelRequest).toHaveBeenCalledWith('test-request-1');

      // Step 4: Get pipeline statistics
      const statsResponse = await request(app)
        .get('/api/validation/pipeline/statistics')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('totalRequests');
      expect(statsResponse.body.data).toHaveProperty('completedRequests');
      expect(mockValidationPipeline.getPipelineStatistics).toHaveBeenCalledTimes(1);
    });

    it('should handle error scenarios gracefully', async () => {
      // Mock error scenarios
      mockValidationSettingsService.getSettings.mockRejectedValue(new Error('Settings service error'));
      mockConsolidatedValidationService.validateResource.mockRejectedValue(new Error('Validation service error'));
      mockValidationPipeline.processRequest.mockRejectedValue(new Error('Pipeline service error'));

      // Test settings error
      const settingsErrorResponse = await request(app)
        .get('/api/validation/settings')
        .expect(500);

      expect(settingsErrorResponse.body.success).toBe(false);
      expect(settingsErrorResponse.body.error).toBe('Failed to get settings');

      // Test validation error
      const validationErrorResponse = await request(app)
        .post('/api/validation/validate')
        .send({ resource: mockFhirResource })
        .expect(500);

      expect(validationErrorResponse.body.success).toBe(false);
      expect(validationErrorResponse.body.error).toBe('Failed to validate resource');

      // Test pipeline error
      const pipelineErrorResponse = await request(app)
        .post('/api/validation/pipeline/process')
        .send({ request: { resources: [mockFhirResource] } })
        .expect(500);

      expect(pipelineErrorResponse.body.success).toBe(false);
      expect(pipelineErrorResponse.body.error).toBe('Failed to process pipeline request');
    });

    it('should handle validation results retrieval and management', async () => {
      // Step 1: Get specific validation result
      const resultResponse = await request(app)
        .get('/api/validation/results/test-resource-1')
        .expect(200);

      expect(resultResponse.body.success).toBe(true);
      expect(resultResponse.body.data).toEqual(mockValidationResult);
      expect(mockConsolidatedValidationService.getValidationResult).toHaveBeenCalledWith('test-resource-1');

      // Step 2: Get validation history
      const historyResponse = await request(app)
        .get('/api/validation/history')
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data).toEqual([mockValidationResult]);
      expect(mockConsolidatedValidationService.getValidationHistory).toHaveBeenCalledTimes(1);

      // Step 3: Clear validation results
      const clearResponse = await request(app)
        .delete('/api/validation/results')
        .expect(200);

      expect(clearResponse.body.success).toBe(true);
      expect(clearResponse.body.data).toHaveProperty('deletedCount');
      expect(mockConsolidatedValidationService.clearValidationResults).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Flow Validation', () => {
    it('should ensure data consistency across all layers', async () => {
      // Step 1: Update settings
      const updatedSettings = { ...mockValidationSettings, batchSize: 25 };
      await request(app)
        .post('/api/validation/settings')
        .send({ settings: updatedSettings });

      // Step 2: Validate resource with updated settings
      const validationResponse = await request(app)
        .post('/api/validation/validate')
        .send({ resource: mockFhirResource });

      expect(validationResponse.body.success).toBe(true);
      expect(validationResponse.body.data).toEqual(mockValidationResult);

      // Step 3: Verify settings were used in validation
      expect(mockValidationSettingsService.updateSettings).toHaveBeenCalledWith(updatedSettings);
      expect(mockConsolidatedValidationService.validateResource).toHaveBeenCalledWith(mockFhirResource);

      // Step 4: Verify results are persisted and retrievable
      const resultsResponse = await request(app)
        .get('/api/validation/results');

      expect(resultsResponse.body.success).toBe(true);
      expect(resultsResponse.body.data).toEqual([mockValidationResult]);
    });

    it('should maintain state consistency during concurrent operations', async () => {
      // Simulate concurrent operations
      const promises = [
        request(app).get('/api/validation/settings'),
        request(app).get('/api/validation/status'),
        request(app).get('/api/validation/progress'),
        request(app).get('/api/validation/statistics')
      ];

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify all services were called
      expect(mockValidationSettingsService.getSettings).toHaveBeenCalledTimes(1);
      expect(mockConsolidatedValidationService.getValidationStatus).toHaveBeenCalledTimes(1);
      expect(mockConsolidatedValidationService.getValidationProgress).toHaveBeenCalledTimes(1);
      expect(mockConsolidatedValidationService.getValidationStatistics).toHaveBeenCalledTimes(1);
    });
  });
});
