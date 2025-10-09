/**
 * Unit Tests for Validation Settings API Endpoints
 * 
 * Tests the simplified validation settings API endpoints including:
 * - GET /api/validation/settings
 * - PUT /api/validation/settings
 * - POST /api/validation/settings/reset
 * - GET /api/validation/resource-types/:version
 * - POST /api/validation/settings/migrate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { validationSettingsRoutes } from './validation-settings';
import type { ValidationSettings } from '@shared/validation-settings';

// Mock the validation settings service
vi.mock('../../../services/validation/settings/validation-settings-service', () => ({
  ValidationSettingsService: vi.fn().mockImplementation(() => ({
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    validateSettings: vi.fn(),
    getResourceTypesForVersion: vi.fn(),
    migrateSettingsForVersion: vi.fn()
  }))
}));

// Mock the validation settings repository
vi.mock('../../../repositories/validation-settings-repository', () => ({
  ValidationSettingsRepository: vi.fn().mockImplementation(() => ({
    getByServerId: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn()
  }))
}));

// Default settings for testing
const DEFAULT_TEST_SETTINGS: ValidationSettings = {
  id: 1,
  serverId: 1,
  aspects: {
    structural: { enabled: true, severity: 'error' },
    profile: { enabled: true, severity: 'warning' },
    terminology: { enabled: true, severity: 'warning' },
    reference: { enabled: true, severity: 'error' },
    businessRules: { enabled: true, severity: 'error' },
    metadata: { enabled: true, severity: 'error' }
  },
  performance: {
    maxConcurrent: 5,
    batchSize: 50
  },
  resourceTypes: {
    enabled: true,
    includedTypes: [],
    excludedTypes: []
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test',
  updatedBy: 'test'
};

describe('Validation Settings API Endpoints', () => {
  let app: express.Application;
  let mockService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/validation', validationSettingsRoutes);

    // Get the mocked service instance
    const { ValidationSettingsService } = require('../../../services/validation/settings/validation-settings-service');
    mockService = new ValidationSettingsService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/validation/settings', () => {
    it('should return validation settings for a server', async () => {
      mockService.getSettings.mockResolvedValue(DEFAULT_TEST_SETTINGS);

      const response = await request(app)
        .get('/api/validation/settings')
        .query({ serverId: '1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(DEFAULT_TEST_SETTINGS);
      expect(mockService.getSettings).toHaveBeenCalledWith(1);
    });

    it('should return 404 when settings not found', async () => {
      mockService.getSettings.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/validation/settings')
        .query({ serverId: '1' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Settings not found');
    });

    it('should handle service errors', async () => {
      mockService.getSettings.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/validation/settings')
        .query({ serverId: '1' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database error');
    });
  });

  describe('PUT /api/validation/settings', () => {
    it('should update validation settings', async () => {
      const updateData = {
        aspects: {
          ...DEFAULT_TEST_SETTINGS.aspects,
          structural: { enabled: false, severity: 'warning' }
        }
      };

      const updatedSettings = {
        ...DEFAULT_TEST_SETTINGS,
        ...updateData
      };

      mockService.updateSettings.mockResolvedValue(updatedSettings);

      const response = await request(app)
        .put('/api/validation/settings')
        .send({ serverId: 1, ...updateData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedSettings);
      expect(mockService.updateSettings).toHaveBeenCalledWith(1, updateData);
    });

    it('should validate settings before updating', async () => {
      const invalidUpdateData = {
        aspects: {
          ...DEFAULT_TEST_SETTINGS.aspects,
          structural: { enabled: true, severity: 'invalid' as any }
        }
      };

      mockService.validateSettings.mockResolvedValue({
        isValid: false,
        errors: ['Invalid severity value']
      });

      const response = await request(app)
        .put('/api/validation/settings')
        .send({ serverId: 1, ...invalidUpdateData })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid severity value');
    });

    it('should handle partial updates', async () => {
      const partialUpdate = {
        performance: { maxConcurrent: 10, batchSize: 100 }
      };

      const updatedSettings = {
        ...DEFAULT_TEST_SETTINGS,
        ...partialUpdate
      };

      mockService.updateSettings.mockResolvedValue(updatedSettings);

      const response = await request(app)
        .put('/api/validation/settings')
        .send({ serverId: 1, ...partialUpdate })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performance.maxConcurrent).toBe(10);
      expect(response.body.data.performance.batchSize).toBe(100);
    });
  });

  describe('POST /api/validation/settings/reset', () => {
    it('should reset settings to defaults', async () => {
      const defaultSettings = {
        ...DEFAULT_TEST_SETTINGS,
        aspects: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'warning' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRules: { enabled: true, severity: 'error' },
          metadata: { enabled: true, severity: 'error' }
        },
        performance: { maxConcurrent: 5, batchSize: 50 },
        resourceTypes: { enabled: true, includedTypes: [], excludedTypes: [] }
      };

      mockService.resetToDefaults.mockResolvedValue(defaultSettings);

      const response = await request(app)
        .post('/api/validation/settings/reset')
        .send({ serverId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(defaultSettings);
      expect(mockService.resetToDefaults).toHaveBeenCalledWith(1);
    });
  });

  describe('GET /api/validation/resource-types/:version', () => {
    it('should return resource types for R4 version', async () => {
      const r4ResourceTypes = [
        'Patient', 'Observation', 'Encounter', 'Condition', 'Procedure',
        'Medication', 'DiagnosticReport', 'AllergyIntolerance', 'Binary',
        'OperationOutcome'
      ];

      mockService.getResourceTypesForVersion.mockResolvedValue(r4ResourceTypes);

      const response = await request(app)
        .get('/api/validation/resource-types/R4')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(r4ResourceTypes);
      expect(mockService.getResourceTypesForVersion).toHaveBeenCalledWith('R4');
    });

    it('should return resource types for R5 version', async () => {
      const r5ResourceTypes = [
        'Patient', 'Observation', 'Encounter', 'Condition', 'Procedure',
        'Medication', 'DiagnosticReport', 'AllergyIntolerance', 'Binary',
        'OperationOutcome', 'DeviceMetric', 'Substance', 'TestScript',
        'ClinicalImpression'
      ];

      mockService.getResourceTypesForVersion.mockResolvedValue(r5ResourceTypes);

      const response = await request(app)
        .get('/api/validation/resource-types/R5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(r5ResourceTypes);
      expect(mockService.getResourceTypesForVersion).toHaveBeenCalledWith('R5');
    });

    it('should handle invalid FHIR version', async () => {
      mockService.getResourceTypesForVersion.mockRejectedValue(new Error('Invalid FHIR version'));

      const response = await request(app)
        .get('/api/validation/resource-types/INVALID')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid FHIR version');
    });
  });

  describe('POST /api/validation/settings/migrate', () => {
    it('should migrate settings between FHIR versions', async () => {
      const migrationRequest = {
        serverId: 1,
        fromVersion: 'R4' as const,
        toVersion: 'R5' as const
      };

      const migratedSettings = {
        ...DEFAULT_TEST_SETTINGS,
        resourceTypes: {
          enabled: true,
          includedTypes: ['Patient', 'Observation', 'Encounter', 'Condition', 'Procedure'],
          excludedTypes: ['Binary', 'OperationOutcome']
        }
      };

      mockService.migrateSettingsForVersion.mockResolvedValue(migratedSettings);

      const response = await request(app)
        .post('/api/validation/settings/migrate')
        .send(migrationRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(migratedSettings);
      expect(mockService.migrateSettingsForVersion).toHaveBeenCalledWith(1, 'R4', 'R5');
    });

    it('should handle migration errors', async () => {
      const migrationRequest = {
        serverId: 1,
        fromVersion: 'R4' as const,
        toVersion: 'R5' as const
      };

      mockService.migrateSettingsForVersion.mockRejectedValue(new Error('Migration failed'));

      const response = await request(app)
        .post('/api/validation/settings/migrate')
        .send(migrationRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Migration failed');
    });
  });

  describe('Input Validation', () => {
    it('should validate serverId parameter', async () => {
      const response = await request(app)
        .get('/api/validation/settings')
        .query({ serverId: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid serverId');
    });

    it('should validate FHIR version parameter', async () => {
      const response = await request(app)
        .get('/api/validation/resource-types/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid FHIR version');
    });

    it('should validate required fields in PUT request', async () => {
      const response = await request(app)
        .put('/api/validation/settings')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('serverId is required');
    });
  });
});

