/**
 * Integration tests for FHIR data flow
 * 
 * Tests that validation data properly flows from storage to UI
 * through the enhanceResourcesWithValidationData function.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the storage module
vi.mock('../../../storage', () => ({
  storage: {
    getFhirResourceByTypeAndId: vi.fn(),
    getActiveFhirServer: vi.fn(),
    createFhirResource: vi.fn(),
    getValidationResultsByResourceId: vi.fn()
  }
}));

// Mock the FHIR client
vi.mock('../../../services/fhir/fhir-client', () => ({
  FhirClient: vi.fn()
}));

// Mock the profile manager
vi.mock('../../../services/fhir/profile-manager', () => ({
  profileManager: {
    getProfileUrl: vi.fn()
  }
}));

describe('FHIR Data Flow', () => {
  describe('enhanceResourcesWithValidationData', () => {
    it('should always include validation data when available', async () => {
      // Import the function after mocking
      const { enhanceResourcesWithValidationData } = await import('./helpers/resource-enhancer');
      
      const mockStorage = vi.mocked(require('../../../storage').storage);
      
      // Mock storage responses
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue({
        id: 123,
        resourceType: 'Patient',
        resourceId: 'patient-1',
        data: { id: 'patient-1', resourceType: 'Patient' }
      });
      
      mockStorage.getActiveFhirServer.mockResolvedValue({
        id: 1,
        name: 'Test Server',
        baseUrl: 'https://test.server'
      });
      
      mockStorage.getValidationResultsByResourceId.mockResolvedValue([
        {
          id: 456,
          resourceId: 123,
          isValid: false,
          errorCount: 2,
          warningCount: 1,
          informationCount: 0,
          validationScore: 60,
          validatedAt: new Date().toISOString(),
          aspectBreakdown: {
            structural: { isValid: false, issueCount: 1 },
            profile: { isValid: true, issueCount: 0 },
            terminology: { isValid: false, issueCount: 1 },
            reference: { isValid: true, issueCount: 0 },
            businessRule: { isValid: true, issueCount: 0 },
            metadata: { isValid: true, issueCount: 1 }
          },
          issues: [
            { id: '1', aspect: 'structural', severity: 'error', message: 'Missing required field' },
            { id: '2', aspect: 'terminology', severity: 'error', message: 'Invalid code' },
            { id: '3', aspect: 'metadata', severity: 'warning', message: 'Missing meta' }
          ]
        }
      ]);
      
      const testResources = [
        {
          id: 'patient-1',
          resourceType: 'Patient',
          name: [{ family: 'Test' }]
        }
      ];
      
      const enhancedResources = await enhanceResourcesWithValidationData(testResources);
      
      // Verify that validation data is included
      expect(enhancedResources).toHaveLength(1);
      expect(enhancedResources[0]).toHaveProperty('_validationSummary');
      expect(enhancedResources[0]._validationSummary).not.toBeNull();
      
      // Verify validation summary structure
      const validationSummary = enhancedResources[0]._validationSummary;
      expect(validationSummary).toHaveProperty('isValid');
      expect(validationSummary).toHaveProperty('hasErrors');
      expect(validationSummary).toHaveProperty('hasWarnings');
      expect(validationSummary).toHaveProperty('errorCount');
      expect(validationSummary).toHaveProperty('warningCount');
      expect(validationSummary).toHaveProperty('informationCount');
      expect(validationSummary).toHaveProperty('lastValidated');
      expect(validationSummary).toHaveProperty('validationScore');
      expect(validationSummary).toHaveProperty('aspectBreakdown');
      
      // Verify validation data values
      expect(validationSummary.isValid).toBe(false);
      expect(validationSummary.hasErrors).toBe(true);
      expect(validationSummary.hasWarnings).toBe(true);
      expect(validationSummary.errorCount).toBe(2);
      expect(validationSummary.warningCount).toBe(1);
      expect(validationSummary.informationCount).toBe(0);
      expect(validationSummary.validationScore).toBe(60);
      
      // Verify aspect breakdown includes all 6 aspects
      expect(validationSummary.aspectBreakdown).toHaveProperty('structural');
      expect(validationSummary.aspectBreakdown).toHaveProperty('profile');
      expect(validationSummary.aspectBreakdown).toHaveProperty('terminology');
      expect(validationSummary.aspectBreakdown).toHaveProperty('reference');
      expect(validationSummary.aspectBreakdown).toHaveProperty('businessRule');
      expect(validationSummary.aspectBreakdown).toHaveProperty('metadata');
    });

    it('should handle missing validation data gracefully', async () => {
      const { enhanceResourcesWithValidationData } = await import('./helpers/resource-enhancer');
      
      const mockStorage = vi.mocked(require('../../../storage').storage);
      
      // Mock storage responses - resource exists but no validation results
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue({
        id: 123,
        resourceType: 'Patient',
        resourceId: 'patient-1',
        data: { id: 'patient-1', resourceType: 'Patient' }
      });
      
      mockStorage.getValidationResultsByResourceId.mockResolvedValue([]);
      
      const testResources = [
        {
          id: 'patient-1',
          resourceType: 'Patient',
          name: [{ family: 'Test' }]
        }
      ];
      
      const enhancedResources = await enhanceResourcesWithValidationData(testResources);
      
      // Verify that resource is still enhanced but with null validation summary
      expect(enhancedResources).toHaveLength(1);
      expect(enhancedResources[0]).toHaveProperty('_validationSummary');
      expect(enhancedResources[0]._validationSummary).toBeNull();
    });

    it('should handle validation data with missing fields gracefully', async () => {
      const { enhanceResourcesWithValidationData } = await import('./helpers/resource-enhancer');
      
      const mockStorage = vi.mocked(require('../../../storage').storage);
      
      // Mock storage responses - resource exists with incomplete validation data
      mockStorage.getFhirResourceByTypeAndId.mockResolvedValue({
        id: 123,
        resourceType: 'Patient',
        resourceId: 'patient-1',
        data: { id: 'patient-1', resourceType: 'Patient' }
      });
      
      mockStorage.getValidationResultsByResourceId.mockResolvedValue([
        {
          id: 456,
          resourceId: 123,
          // Missing some fields
          isValid: null,
          errorCount: null,
          warningCount: null,
          validationScore: null,
          validatedAt: null,
          aspectBreakdown: null,
          issues: null
        }
      ]);
      
      const testResources = [
        {
          id: 'patient-1',
          resourceType: 'Patient',
          name: [{ family: 'Test' }]
        }
      ];
      
      const enhancedResources = await enhanceResourcesWithValidationData(testResources);
      
      // Verify that validation data is included with default values
      expect(enhancedResources).toHaveLength(1);
      expect(enhancedResources[0]).toHaveProperty('_validationSummary');
      expect(enhancedResources[0]._validationSummary).not.toBeNull();
      
      const validationSummary = enhancedResources[0]._validationSummary;
      expect(validationSummary.isValid).toBe(false);
      expect(validationSummary.hasErrors).toBe(false);
      expect(validationSummary.hasWarnings).toBe(false);
      expect(validationSummary.errorCount).toBe(0);
      expect(validationSummary.warningCount).toBe(0);
      expect(validationSummary.informationCount).toBe(0);
      expect(validationSummary.validationScore).toBe(0);
      expect(validationSummary.aspectBreakdown).toEqual({});
    });
  });
});
