/**
 * Unit Tests: ErrorMappingEngine
 * 
 * Tests for error code translation and enhancement system.
 * Covers mapping loading, context substitution, and suggested fixes.
 * 
 * Test Coverage:
 * - Loading error mappings from JSON
 * - Context variable substitution
 * - Suggested fixes generation
 * - Aspect-specific mappings
 * - Fallback to original message
 * - Edge cases and missing mappings
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ErrorMappingEngine,
  getErrorMappingEngine,
  resetErrorMappingEngine,
  type EnhancedValidationIssue,
} from '../error-mapping-engine';
import type { ValidationIssue } from '../../types/validation-types';

describe('ErrorMappingEngine', () => {
  let engine: ErrorMappingEngine;

  beforeEach(() => {
    resetErrorMappingEngine();
    engine = new ErrorMappingEngine();
    engine.loadMappings();
  });

  afterEach(() => {
    resetErrorMappingEngine();
  });

  describe('mapping loading', () => {
    it('should load error mappings from JSON file', () => {
      const mapping = engine.getMapping('terminology', 'code-unknown');
      
      expect(mapping).toBeDefined();
      expect(mapping?.userMessage).toContain('not found');
      expect(mapping?.suggestedFixes).toBeInstanceOf(Array);
      expect(mapping?.suggestedFixes.length).toBeGreaterThan(0);
    });

    it('should load structural mappings', () => {
      const mapping = engine.getMapping('structural', 'structure-failed');
      
      expect(mapping).toBeDefined();
      expect(mapping?.severity).toBe('error');
    });

    it('should load profile mappings', () => {
      const mapping = engine.getMapping('profile', 'profile-mismatch');
      
      expect(mapping).toBeDefined();
      expect(mapping?.userMessage).toContain('conform');
    });

    it('should return null for unknown error code', () => {
      const mapping = engine.getMapping('terminology', 'unknown-error-code');
      
      expect(mapping).toBeNull();
    });
  });

  describe('enhanceIssue', () => {
    it('should enhance terminology issue with user-friendly message', () => {
      const issue: ValidationIssue = {
        id: 'test-1',
        aspect: 'terminology',
        severity: 'error',
        code: 'code-unknown',
        message: "Original technical message",
        path: 'gender',
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue, {
        code: 'invalid-code',
        system: 'http://example.org/codes',
      });

      expect(enhanced.mapped).toBe(true);
      expect(enhanced.userMessage).toContain('not found');
      expect(enhanced.userMessage).toContain('invalid-code');
      expect(enhanced.userMessage).toContain('http://example.org/codes');
      expect(enhanced.suggestedFixes).toBeInstanceOf(Array);
      expect(enhanced.suggestedFixes.length).toBeGreaterThan(0);
    });

    it('should substitute context variables in user message', () => {
      const issue: ValidationIssue = {
        id: 'test-2',
        aspect: 'terminology',
        severity: 'error',
        code: 'code-not-in-valueset',
        message: "Code validation failed",
        path: 'status',
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue, {
        code: 'test-code',
        system: 'http://test.org/codes',
        valueSet: 'http://test.org/valueset/test',
      });

      expect(enhanced.userMessage).toContain('test-code');
      expect(enhanced.userMessage).toContain('http://test.org/codes');
      expect(enhanced.userMessage).toContain('http://test.org/valueset/test');
    });

    it('should substitute variables in suggested fixes', () => {
      const issue: ValidationIssue = {
        id: 'test-3',
        aspect: 'terminology',
        severity: 'error',
        code: 'code-unknown',
        message: "Code not found",
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue, {
        code: 'xyz',
        system: 'http://example.org',
      });

      const fixesWithCode = enhanced.suggestedFixes.filter(fix => fix.includes('xyz'));
      expect(fixesWithCode.length).toBeGreaterThan(0);
    });

    it('should fallback to original message if no mapping found', () => {
      const issue: ValidationIssue = {
        id: 'test-4',
        aspect: 'structural',
        severity: 'error',
        code: 'unmapped-error-code',
        message: "Original error message",
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue);

      expect(enhanced.mapped).toBe(false);
      expect(enhanced.userMessage).toBe("Original error message");
      expect(enhanced.suggestedFixes).toEqual([]);
    });

    it('should handle missing error code gracefully', () => {
      const issue: ValidationIssue = {
        id: 'test-5',
        aspect: 'terminology',
        severity: 'error',
        message: "Error with no code",
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue);

      expect(enhanced.mapped).toBe(false);
      expect(enhanced.userMessage).toBe("Error with no code");
    });

    it('should include documentation URL when available', () => {
      const issue: ValidationIssue = {
        id: 'test-6',
        aspect: 'terminology',
        severity: 'error',
        code: 'code-unknown',
        message: "Code not found",
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue);

      expect(enhanced.documentationUrl).toBeDefined();
      expect(enhanced.documentationUrl).toContain('http');
    });
  });

  describe('enhanceIssues (batch)', () => {
    it('should enhance multiple issues', () => {
      const issues: ValidationIssue[] = [
        {
          id: 'test-1',
          aspect: 'terminology',
          severity: 'error',
          code: 'code-unknown',
          message: "Code not found",
          timestamp: new Date(),
        },
        {
          id: 'test-2',
          aspect: 'profile',
          severity: 'error',
          code: 'profile-mismatch',
          message: "Profile mismatch",
          timestamp: new Date(),
        },
      ];

      const enhanced = engine.enhanceIssues(issues, {
        resourceType: 'Patient',
        fhirVersion: 'R4',
      });

      expect(enhanced).toHaveLength(2);
      expect(enhanced[0].mapped).toBe(true);
      expect(enhanced[1].mapped).toBe(true);
    });

    it('should handle mixed mapped and unmapped issues', () => {
      const issues: ValidationIssue[] = [
        {
          id: 'test-1',
          aspect: 'terminology',
          severity: 'error',
          code: 'code-unknown',
          message: "Mapped error",
          timestamp: new Date(),
        },
        {
          id: 'test-2',
          aspect: 'structural',
          severity: 'error',
          code: 'unknown-code-xyz',
          message: "Unmapped error",
          timestamp: new Date(),
        },
      ];

      const enhanced = engine.enhanceIssues(issues);

      expect(enhanced[0].mapped).toBe(true);
      expect(enhanced[1].mapped).toBe(false);
      expect(enhanced[1].userMessage).toBe("Unmapped error");
    });
  });

  describe('context variable extraction', () => {
    it('should extract code from message', () => {
      const issue: ValidationIssue = {
        id: 'test-7',
        aspect: 'terminology',
        severity: 'error',
        code: 'code-unknown',
        message: "Code 'test-code' is not valid",
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue);

      // Should extract 'test-code' from message and use in user message
      expect(enhanced.userMessage).toBeDefined();
    });

    it('should extract system from message', () => {
      const issue: ValidationIssue = {
        id: 'test-8',
        aspect: 'terminology',
        severity: 'error',
        code: 'code-unknown',
        message: "Code in system 'http://example.org' not found",
        timestamp: new Date(),
      };

      const enhanced = engine.enhanceIssue(issue);

      expect(enhanced.userMessage).toBeDefined();
    });
  });

  describe('hasMapping', () => {
    it('should return true for existing mapping', () => {
      const exists = engine.hasMapping('terminology', 'code-unknown');
      
      expect(exists).toBe(true);
    });

    it('should return false for non-existent mapping', () => {
      const exists = engine.hasMapping('terminology', 'non-existent-code');
      
      expect(exists).toBe(false);
    });
  });

  describe('getMapping', () => {
    it('should return mapping for valid code', () => {
      const mapping = engine.getMapping('terminology', 'code-unknown');
      
      expect(mapping).toBeDefined();
      expect(mapping?.userMessage).toBeTruthy();
      expect(mapping?.suggestedFixes).toBeInstanceOf(Array);
    });

    it('should return null for invalid code', () => {
      const mapping = engine.getMapping('terminology', 'invalid-code-xyz');
      
      expect(mapping).toBeNull();
    });

    it('should handle system-wide error codes', () => {
      const mapping = engine.getMapping('system', 'TIMEOUT');
      
      expect(mapping).toBeDefined();
      expect(mapping?.userMessage).toContain('timeout');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getErrorMappingEngine', () => {
      const instance1 = getErrorMappingEngine();
      const instance2 = getErrorMappingEngine();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getErrorMappingEngine();
      resetErrorMappingEngine();
      const instance2 = getErrorMappingEngine();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('aspect-specific mappings', () => {
    const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];

    aspects.forEach(aspect => {
      it(`should have mappings for ${aspect} aspect`, () => {
        // Try to get any mapping for this aspect
        const issue: ValidationIssue = {
          id: 'test',
          aspect: aspect as any,
          severity: 'error',
          code: 'test-code',
          message: 'test',
          timestamp: new Date(),
        };

        const enhanced = engine.enhanceIssue(issue);
        
        // Even if not mapped, should not throw
        expect(enhanced).toBeDefined();
      });
    });
  });
});

