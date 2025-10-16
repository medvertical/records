/**
 * Error Mapping Integration Tests
 * Task 11.6: Verify user-friendly error messages appear correctly
 * 
 * Tests that validation errors are mapped to user-friendly messages
 * and that error details are properly formatted.
 */

import { describe, it, expect } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import { getTestDataManager } from '../fixtures/test-data-manager';

const engine = getValidationEngine();
const testData = getTestDataManager();

// ============================================================================
// Error Message Quality Tests
// ============================================================================

describe('Error Mapping Integration', () => {
  describe('User-Friendly Messages', () => {
    it('should provide clear error messages for missing required fields', async () => {
      const invalidPatient = testData.getResourceById('test-patient-missing-required');

      if (invalidPatient) {
        const result = await engine.validateResource({
          resource: invalidPatient.content,
          resourceType: 'Patient',
        });

        expect(result.isValid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);

        // Check that error messages are user-friendly
        const messages = result.issues.map(issue => issue.message);
        
        // Should not contain technical jargon like "dom-6" or "HAPI-1234"
        const hasTechnicalCodes = messages.some(msg => 
          /dom-\d+|HAPI-\d+|err-\d+/i.test(msg)
        );
        
        expect(hasTechnicalCodes).toBe(false);
      }
    });

    it('should provide clear error messages for invalid enum values', async () => {
      const invalidObservation = testData.getResourceById('test-observation-invalid-status');

      if (invalidObservation) {
        const result = await engine.validateResource({
          resource: invalidObservation.content,
          resourceType: 'Observation',
        });

        expect(result.isValid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);

        // Find the status-related error
        const statusError = result.issues.find(issue =>
          issue.message.toLowerCase().includes('status')
        );

        expect(statusError).toBeDefined();
        if (statusError) {
          // Should mention the invalid value
          expect(statusError.message.toLowerCase()).toContain('invalid');
        }
      }
    });

    it('should provide severity levels for issues', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        if (result.issues.length > 0) {
          result.issues.forEach(issue => {
            // Should have a severity
            expect(issue.severity).toBeDefined();
            expect(['error', 'warning', 'information']).toContain(issue.severity);
          });
        }
      }
    });
  });

  // ========================================================================
  // Error Detail Tests
  // ========================================================================

  describe('Error Details', () => {
    it('should include field locations in error messages', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        if (result.issues.length > 0) {
          result.issues.forEach(issue => {
            // Should have a location or expression
            const hasLocation = issue.location || issue.expression;
            expect(hasLocation).toBeDefined();
          });
        }
      }
    });

    it('should group related errors', async () => {
      const invalidCondition = testData.getResourceById('test-condition-missing-status');

      if (invalidCondition) {
        const result = await engine.validateResource({
          resource: invalidCondition.content,
          resourceType: 'Condition',
        });

        expect(result.isValid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);

        // Issues should be organized
        result.issues.forEach(issue => {
          expect(issue.aspect).toBeDefined();
          expect(issue.message).toBeDefined();
        });
      }
    });

    it('should provide actionable error messages', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        if (result.issues.length > 0) {
          result.issues.forEach(issue => {
            // Message should be non-empty and meaningful
            expect(issue.message.length).toBeGreaterThan(10);
            
            // Should not be just error codes
            expect(issue.message).not.toMatch(/^[A-Z]+-\d+$/);
          });
        }
      }
    });
  });

  // ========================================================================
  // Error Context Tests
  // ========================================================================

  describe('Error Context', () => {
    it('should include resource type in validation results', async () => {
      const validResources = testData.getValidResources();

      for (const testResource of validResources.slice(0, 3)) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        expect(result.resourceType).toBe(testResource.resourceType);
      }
    });

    it('should include resource ID in validation results', async () => {
      const validResources = testData.getValidResources();

      for (const testResource of validResources.slice(0, 3)) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        expect(result.resourceId).toBe(testResource.resourceId);
      }
    });

    it('should track which aspects found errors', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        if (result.issues.length > 0) {
          result.issues.forEach(issue => {
            expect(issue.aspect).toBeDefined();
            expect(['structural', 'profile', 'terminology', 'reference', 'businessRules', 'metadata']).toContain(issue.aspect);
          });
        }
      }
    });
  });

  // ========================================================================
  // Error Formatting Tests
  // ========================================================================

  describe('Error Formatting', () => {
    it('should format validation results consistently', async () => {
      const testResource = testData.getValidResources()[0];

      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      // Check result structure
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('aspects');
      expect(result).toHaveProperty('resourceType');
      expect(result).toHaveProperty('resourceId');
      expect(result).toHaveProperty('validatedAt');
      expect(result).toHaveProperty('validationTime');
    });

    it('should include timestamps in validation results', async () => {
      const testResource = testData.getValidResources()[0];

      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(result.validationTime).toBeGreaterThan(0);
    });

    it('should include validation duration', async () => {
      const testResource = testData.getValidResources()[0];

      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      expect(result.validationTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.validationTime).toBe('number');
    });
  });

  // ========================================================================
  // Error Severity Tests
  // ========================================================================

  describe('Error Severity Handling', () => {
    it('should categorize errors by severity', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        if (result.issues.length > 0) {
          const errors = result.issues.filter(i => i.severity === 'error');
          const warnings = result.issues.filter(i => i.severity === 'warning');
          const info = result.issues.filter(i => i.severity === 'information');

          // Should have at least some categorization
          expect(errors.length + warnings.length + info.length).toBe(result.issues.length);
        }
      }
    });

    it('should mark resources invalid if they have errors', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        const hasErrors = result.issues.some(i => i.severity === 'error');
        
        if (hasErrors) {
          expect(result.isValid).toBe(false);
        }
      }
    });

    it('should allow warnings without marking resource invalid', async () => {
      // This test assumes some resources might have warnings but still be valid
      // In practice, this depends on validation configuration
      const validResources = testData.getValidResources();

      for (const testResource of validResources.slice(0, 3)) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        // If there are warnings but no errors, should still be valid
        const hasWarnings = result.issues.some(i => i.severity === 'warning');
        const hasErrors = result.issues.some(i => i.severity === 'error');

        if (hasWarnings && !hasErrors) {
          expect(result.isValid).toBe(true);
        }
      }
    });
  });

  // ========================================================================
  // Error Message Quality Checks
  // ========================================================================

  describe('Message Quality', () => {
    it('should not have empty error messages', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        result.issues.forEach(issue => {
          expect(issue.message).toBeTruthy();
          expect(issue.message.trim().length).toBeGreaterThan(0);
        });
      }
    });

    it('should have descriptive error messages', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        result.issues.forEach(issue => {
          // Should be more than just a code
          expect(issue.message.length).toBeGreaterThan(15);
          
          // Should start with capital letter
          expect(issue.message[0]).toMatch(/[A-Z]/);
        });
      }
    });

    it('should provide context in error messages', async () => {
      const invalidResources = testData.getInvalidResources();

      for (const testResource of invalidResources) {
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        });

        result.issues.forEach(issue => {
          // Should include field name or path
          const hasFieldReference = 
            issue.location?.length > 0 ||
            issue.expression?.length > 0 ||
            issue.message.includes('.');

          expect(hasFieldReference).toBe(true);
        });
      }
    });
  });

  // ========================================================================
  // Validation Summary Tests
  // ========================================================================

  describe('Validation Summary', () => {
    it('should provide a summary of validation results', async () => {
      const testResource = testData.getInvalidResources()[0];

      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      // Result should be easily summarizable
      expect(result.isValid).toBeDefined();
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.aspects).toBeInstanceOf(Array);
    });

    it('should indicate which aspects were validated', async () => {
      const testResource = testData.getValidResources()[0];

      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      expect(result.aspects).toBeInstanceOf(Array);
      expect(result.aspects.length).toBeGreaterThan(0);
    });

    it('should provide validation metadata', async () => {
      const testResource = testData.getValidResources()[0];

      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      expect(result.fhirVersion).toBeDefined();
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(result.validationTime).toBeGreaterThanOrEqual(0);
    });
  });
});

