/**
 * Unit tests for ValidationEngine
 * 
 * Tests that the validation engine always performs all 6 aspects
 * regardless of settings, following the core principle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationEngine } from './validation-engine';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';
import type { ValidationRequest } from '../types/validation-types';

// Mock the validators
vi.mock('../engine/structural-validator', () => ({
  StructuralValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../engine/profile-validator', () => ({
  ProfileValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../engine/terminology-validator', () => ({
  TerminologyValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../engine/reference-validator', () => ({
  ReferenceValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../engine/business-rule-validator', () => ({
  BusinessRuleValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../engine/metadata-validator', () => ({
  MetadataValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../settings/validation-settings-service', () => ({
  getValidationSettingsService: vi.fn().mockReturnValue({
    getSettings: vi.fn().mockResolvedValue({
      structural: { enabled: false },
      profile: { enabled: false },
      terminology: { enabled: false },
      reference: { enabled: false },
      businessRule: { enabled: false },
      metadata: { enabled: false }
    })
  })
}));

describe('ValidationEngine', () => {
  let validationEngine: ValidationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    validationEngine = new ValidationEngine();
  });

  describe('Core Principle: Always Perform All 6 Aspects', () => {
    it('should always execute all 6 validation aspects regardless of settings', async () => {
      // Create a test request with all aspects disabled in settings
      const request: ValidationRequest = {
        resourceType: 'Patient',
        resource: {
          id: 'test-patient-1',
          resourceType: 'Patient',
          name: [{ family: 'Test' }]
        },
        settings: {
          structural: { enabled: false },
          profile: { enabled: false },
          terminology: { enabled: false },
          reference: { enabled: false },
          businessRule: { enabled: false },
          metadata: { enabled: false }
        }
      };

      const result = await validationEngine.validateResource(request);

      // Verify that all 6 aspects were executed
      expect(result.aspects).toHaveLength(6);
      
      // Verify that all aspects are present
      const executedAspects = result.aspects.map(aspect => aspect.aspect);
      expect(executedAspects).toEqual(expect.arrayContaining(ALL_VALIDATION_ASPECTS));
      
      // Verify that all aspects have status 'executed'
      result.aspects.forEach(aspect => {
        expect(aspect.status).toBe('executed');
      });
    });

    it('should execute all aspects even when no settings are provided', async () => {
      const request: ValidationRequest = {
        resourceType: 'Patient',
        resource: {
          id: 'test-patient-2',
          resourceType: 'Patient',
          name: [{ family: 'Test' }]
        }
        // No settings provided
      };

      const result = await validationEngine.validateResource(request);

      // Verify that all 6 aspects were executed
      expect(result.aspects).toHaveLength(6);
      
      // Verify that all aspects are present
      const executedAspects = result.aspects.map(aspect => aspect.aspect);
      expect(executedAspects).toEqual(expect.arrayContaining(ALL_VALIDATION_ASPECTS));
    });

    it('should execute all aspects even when some aspects are explicitly disabled', async () => {
      const request: ValidationRequest = {
        resourceType: 'Patient',
        resource: {
          id: 'test-patient-3',
          resourceType: 'Patient',
          name: [{ family: 'Test' }]
        },
        settings: {
          structural: { enabled: true },
          profile: { enabled: false },
          terminology: { enabled: false },
          reference: { enabled: true },
          businessRule: { enabled: false },
          metadata: { enabled: false }
        }
      };

      const result = await validationEngine.validateResource(request);

      // Verify that all 6 aspects were executed regardless of settings
      expect(result.aspects).toHaveLength(6);
      
      // Verify that all aspects are present
      const executedAspects = result.aspects.map(aspect => aspect.aspect);
      expect(executedAspects).toEqual(expect.arrayContaining(ALL_VALIDATION_ASPECTS));
      
      // Verify that all aspects have status 'executed'
      result.aspects.forEach(aspect => {
        expect(aspect.status).toBe('executed');
      });
    });
  });

  describe('Validation Result Structure', () => {
    it('should return properly structured validation results', async () => {
      const request: ValidationRequest = {
        resourceType: 'Patient',
        resource: {
          id: 'test-patient-4',
          resourceType: 'Patient',
          name: [{ family: 'Test' }]
        }
      };

      const result = await validationEngine.validateResource(request);

      // Verify result structure
      expect(result).toHaveProperty('resourceId');
      expect(result).toHaveProperty('resourceType');
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('aspects');
      expect(result).toHaveProperty('validatedAt');
      expect(result).toHaveProperty('validationTime');

      // Verify resource information
      expect(result.resourceId).toBe('test-patient-4');
      expect(result.resourceType).toBe('Patient');
      
      // Verify aspects array
      expect(Array.isArray(result.aspects)).toBe(true);
      expect(result.aspects).toHaveLength(6);
    });
  });
});
