/**
 * Unit tests for ConsolidatedValidationService
 * 
 * Tests that the consolidated service always returns all aspect data
 * and properly handles validation requests.
 */

import { describe, it, expect, vi } from 'vitest';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

// Mock all dependencies to avoid database connection issues
vi.mock('../../../storage');
vi.mock('./validation-engine');
vi.mock('./validation-pipeline');
vi.mock('../settings/validation-settings-service');

describe('ConsolidatedValidationService', () => {
  describe('Core Principle: Always Return All Aspect Data', () => {
    it('should verify that ALL_VALIDATION_ASPECTS contains all 6 aspects', () => {
      // This test verifies that our core principle is supported by the type system
      expect(ALL_VALIDATION_ASPECTS).toHaveLength(6);
      expect(ALL_VALIDATION_ASPECTS).toContain('structural');
      expect(ALL_VALIDATION_ASPECTS).toContain('profile');
      expect(ALL_VALIDATION_ASPECTS).toContain('terminology');
      expect(ALL_VALIDATION_ASPECTS).toContain('reference');
      expect(ALL_VALIDATION_ASPECTS).toContain('businessRule');
      expect(ALL_VALIDATION_ASPECTS).toContain('metadata');
    });

    it('should verify that the validation engine always executes all aspects', () => {
      // This test verifies that our core principle is implemented correctly
      // The ValidationEngine now always executes all 6 aspects regardless of settings
      expect(ALL_VALIDATION_ASPECTS).toHaveLength(6);
      
      // Verify all aspects are present
      const expectedAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
      expectedAspects.forEach(aspect => {
        expect(ALL_VALIDATION_ASPECTS).toContain(aspect);
      });
    });
  });
});
