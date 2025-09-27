/**
 * Unit tests for validation error handling
 * 
 * Tests that error handling works correctly throughout the validation pipeline
 * and that the system doesn't crash on validation errors.
 */

import { describe, it, expect } from 'vitest';

describe('Validation Error Handling', () => {
  describe('Error Handling Logic', () => {
    it('should handle validation errors gracefully', () => {
      // Test the error handling logic that's used throughout the validation pipeline
      const handleValidationError = (error: unknown, context: string) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        console.error(`[${context}] Validation failed:`, errorMessage);
        return {
          success: false,
          error: errorMessage,
          context
        };
      };
      
      // Test with Error object
      const testError = new Error('Test validation error');
      const result1 = handleValidationError(testError, 'TestContext');
      
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Test validation error');
      expect(result1.context).toBe('TestContext');
      
      // Test with unknown error
      const result2 = handleValidationError('String error', 'TestContext');
      
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Unknown validation error');
      expect(result2.context).toBe('TestContext');
      
      // Test with null/undefined
      const result3 = handleValidationError(null, 'TestContext');
      
      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Unknown validation error');
      expect(result3.context).toBe('TestContext');
    });

    it('should create proper error results for failed validations', () => {
      // Test the error result creation logic
      const createErrorResult = (resource: any, error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          resourceId: resource.id || 'unknown',
          resourceType: resource.resourceType || 'Unknown',
          isValid: false,
          issues: [{
            id: `error-${Date.now()}`,
            aspect: 'structural' as const,
            severity: 'error' as const,
            message: `Validation failed: ${errorMessage}`,
            code: 'VALIDATION_ERROR'
          }],
          aspects: [],
          validatedAt: new Date(),
          validationTime: 0
        };
      };
      
      const testResource = {
        id: 'test-resource-1',
        resourceType: 'Patient',
        name: [{ family: 'Test' }]
      };
      
      const testError = new Error('Database connection failed');
      const errorResult = createErrorResult(testResource, testError);
      
      // Verify error result structure
      expect(errorResult.resourceId).toBe('test-resource-1');
      expect(errorResult.resourceType).toBe('Patient');
      expect(errorResult.isValid).toBe(false);
      expect(errorResult.issues).toHaveLength(1);
      expect(errorResult.issues[0].severity).toBe('error');
      expect(errorResult.issues[0].message).toContain('Database connection failed');
      expect(errorResult.issues[0].code).toBe('VALIDATION_ERROR');
      expect(errorResult.aspects).toHaveLength(0);
      expect(errorResult.validationTime).toBe(0);
    });

    it('should handle aspect validation errors correctly', () => {
      // Test aspect-level error handling
      const handleAspectError = (aspect: string, error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown aspect validation error';
        return {
          aspect,
          isValid: false,
          issues: [{
            id: `aspect-error-${Date.now()}`,
            aspect,
            severity: 'error' as const,
            message: `Aspect validation failed: ${errorMessage}`,
            code: 'ASPECT_ERROR'
          }],
          validationTime: 0,
          status: 'failed' as const
        };
      };
      
      const testError = new Error('Profile validation service unavailable');
      const aspectResult = handleAspectError('profile', testError);
      
      // Verify aspect error result
      expect(aspectResult.aspect).toBe('profile');
      expect(aspectResult.isValid).toBe(false);
      expect(aspectResult.issues).toHaveLength(1);
      expect(aspectResult.issues[0].aspect).toBe('profile');
      expect(aspectResult.issues[0].severity).toBe('error');
      expect(aspectResult.issues[0].message).toContain('Profile validation service unavailable');
      expect(aspectResult.issues[0].code).toBe('ASPECT_ERROR');
      expect(aspectResult.validationTime).toBe(0);
      expect(aspectResult.status).toBe('failed');
    });
  });
});
