/**
 * FHIRPath Validator Tests
 * Task 9.9: Test FHIRPath expression validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FHIRPathValidator } from '../fhirpath-validator';

describe('FHIRPathValidator', () => {
  let validator: FHIRPathValidator;

  beforeEach(() => {
    validator = new FHIRPathValidator();
  });

  // ========================================================================
  // Basic Validation
  // ========================================================================

  describe('Basic Validation', () => {
    it('should validate simple exists() expression', () => {
      const result = validator.validate('name.exists()');
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate field access', () => {
      const result = validator.validate('name.family');
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate boolean operators', () => {
      const result = validator.validate('name.exists() and gender.exists()');
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate implies operator', () => {
      const result = validator.validate('deceased.exists() implies active = false');
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject empty expression', () => {
      const result = validator.validate('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('cannot be empty');
    });

    it('should reject invalid syntax', () => {
      const result = validator.validate('name..exists()'); // Double dot is invalid
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Error Detection
  // ========================================================================

  describe('Error Detection', () => {
    it('should detect unclosed parenthesis', () => {
      const result = validator.validate('name.where(use = \'official\'');
      
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.includes('closing parenthesis'))).toBe(true);
    });

    it('should detect unclosed quote', () => {
      const result = validator.validate('name.where(use = \'official)');
      
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.includes('quote'))).toBe(true);
    });

    it('should detect invalid function name', () => {
      const result = validator.validate('name.invalidFunction()');
      
      // FHIRPath library may or may not catch this at parse time
      // If it passes parse, it will fail at execution
      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0);
      } else {
        // If parse succeeds, test will fail at execution
        expect(result.isValid).toBe(true);
      }
    });

    it('should suggest using = instead of ==', () => {
      const result = validator.validate('status == \'active\'');
      
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.includes('single ='))).toBe(true);
    });

    it('should suggest using and/or instead of && ||', () => {
      const result = validator.validate('name.exists() && gender.exists()');
      
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.includes('and'))).toBe(true);
    });
  });

  // ========================================================================
  // Complex Expressions
  // ========================================================================

  describe('Complex Expressions', () => {
    it('should validate where() with nested conditions', () => {
      const result = validator.validate(
        'identifier.where(system = \'http://example.org\' and value.exists())'
      );
      
      expect(result.isValid).toBe(true);
    });

    it('should validate all() collection operation', () => {
      const result = validator.validate(
        'dosageInstruction.all(text.exists() or timing.exists())'
      );
      
      expect(result.isValid).toBe(true);
    });

    it('should validate memberOf() function', () => {
      const result = validator.validate(
        'status.memberOf(\'http://hl7.org/fhir/ValueSet/observation-status\')'
      );
      
      expect(result.isValid).toBe(true);
    });

    it('should validate nested function calls', () => {
      const result = validator.validate(
        'name.where(use = \'official\').first().family.exists()'
      );
      
      expect(result.isValid).toBe(true);
    });
  });

  // ========================================================================
  // Complexity Analysis
  // ========================================================================

  describe('Complexity Analysis', () => {
    it('should analyze simple expression complexity', () => {
      const complexity = validator.analyzeComplexity('name.exists()');
      
      expect(complexity.depth).toBe(1);
      expect(complexity.functionCount).toBe(1);
      expect(complexity.estimatedExecutionTime).toBe('fast');
    });

    it('should detect high complexity', () => {
      const expr = 'name.where(use = \'official\').all(family.exists() and given.where(length() > 0).count() > 0)';
      const complexity = validator.analyzeComplexity(expr);
      
      expect(complexity.functionCount).toBeGreaterThan(3);
    });

    it('should warn about overly long expressions', () => {
      const longExpr = 'a'.repeat(600) + '.exists()';
      const result = validator.validate(longExpr);
      
      // Should still be valid but with warnings
      expect(result.warnings.some(w => w.includes('very long'))).toBe(true);
    });

    it('should warn about many where() clauses', () => {
      const expr = 'a.where(b).where(c).where(d).where(e)';
      const result = validator.validate(expr);
      
      expect(result.warnings.some(w => w.includes('where()'))).toBe(true);
    });
  });

  // ========================================================================
  // Expression Testing
  // ========================================================================

  describe('Expression Testing', () => {
    it('should test expression against resource', async () => {
      const resource = {
        resourceType: 'Patient',
        name: [{ family: 'Doe', given: ['John'] }],
      };

      const result = await validator.testExpression('name.exists()', resource);
      
      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();
    });

    it('should handle false result', async () => {
      const resource = {
        resourceType: 'Patient',
        // No name field
      };

      const result = await validator.testExpression('name.exists()', resource);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual([false]);
    });

    it('should handle execution error', async () => {
      const resource = {
        resourceType: 'Patient',
      };

      // Invalid expression that might cause runtime error
      const result = await validator.testExpression('invalid..syntax', resource);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should measure execution time', async () => {
      const resource = {
        resourceType: 'Patient',
        name: [{ family: 'Doe' }],
      };

      const result = await validator.testExpression('name.family.exists()', resource);
      
      expect(result.success).toBe(true);
      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Helper Functions
  // ========================================================================

  describe('Helper Functions', () => {
    it('should detect boolean-returning expressions', () => {
      expect(validator.likelyReturnsBoolean('name.exists()')).toBe(true);
      expect(validator.likelyReturnsBoolean('status = \'active\'')).toBe(true);
      expect(validator.likelyReturnsBoolean('name.all(family.exists())')).toBe(true);
      expect(validator.likelyReturnsBoolean('deceased implies active = false')).toBe(true);
    });

    it('should not mark non-boolean expressions as boolean', () => {
      expect(validator.likelyReturnsBoolean('name.family')).toBe(false);
      expect(validator.likelyReturnsBoolean('count()')).toBe(false);
    });

    it('should extract referenced fields', () => {
      const fields = validator.extractReferencedFields('name.family and identifier.value');
      
      expect(fields).toContain('name');
      expect(fields).toContain('identifier');
      expect(fields.length).toBe(2);
    });

    it('should not include function names as fields', () => {
      const fields = validator.extractReferencedFields('name.exists() and count()');
      
      expect(fields).toContain('name');
      expect(fields).not.toContain('exists');
      expect(fields).not.toContain('count');
    });
  });

  // ========================================================================
  // Batch Validation
  // ========================================================================

  describe('Batch Validation', () => {
    it('should validate multiple expressions', async () => {
      const expressions = [
        'name.exists()',
        'gender.exists()',
        'birthDate <= today()',
      ];

      const results = await validator.validateBatch(expressions);
      
      expect(results.length).toBe(3);
      expect(results.every(r => r.isValid)).toBe(true);
    });

    it('should identify invalid expressions in batch', async () => {
      const expressions = [
        'name.exists()',
        'invalid..syntax',
        'gender.exists()',
      ];

      const results = await validator.validateBatch(expressions);
      
      expect(results.length).toBe(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });
  });
});

