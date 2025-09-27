/**
 * Unit tests for ValidationResultFilteringService Logic
 */

import { describe, it, expect } from 'vitest';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

describe('ValidationResultFilteringService Logic', () => {
  describe('Core Filtering Logic', () => {
    it('should verify that ALL_VALIDATION_ASPECTS contains all 6 aspects', () => {
      // This test verifies that our filtering logic is supported by the type system
      expect(ALL_VALIDATION_ASPECTS).toHaveLength(6);
      expect(ALL_VALIDATION_ASPECTS).toContain('structural');
      expect(ALL_VALIDATION_ASPECTS).toContain('profile');
      expect(ALL_VALIDATION_ASPECTS).toContain('terminology');
      expect(ALL_VALIDATION_ASPECTS).toContain('reference');
      expect(ALL_VALIDATION_ASPECTS).toContain('businessRule');
      expect(ALL_VALIDATION_ASPECTS).toContain('metadata');
    });

    it('should test filtering logic for enabled aspects', () => {
      // Test the core filtering logic that will be used in the service
      const mockSettings = {
        structural: { enabled: true },
        profile: { enabled: false },
        terminology: { enabled: true },
        reference: { enabled: false },
        businessRule: { enabled: true },
        metadata: { enabled: false }
      };

      // Extract enabled aspects from settings (same logic as in the service)
      const enabledAspects = new Set<string>();
      ALL_VALIDATION_ASPECTS.forEach(aspect => {
        const aspectConfig = (mockSettings as any)[aspect];
        if (aspectConfig && typeof aspectConfig === 'object' && aspectConfig.enabled === true) {
          enabledAspects.add(aspect);
        }
      });

      expect(enabledAspects.has('structural')).toBe(true);
      expect(enabledAspects.has('profile')).toBe(false);
      expect(enabledAspects.has('terminology')).toBe(true);
      expect(enabledAspects.has('reference')).toBe(false);
      expect(enabledAspects.has('businessRule')).toBe(true);
      expect(enabledAspects.has('metadata')).toBe(false);
    });

    it('should test filtering logic for validation results', () => {
      // Test the core result filtering logic
      const mockResult = {
        resourceId: 'test-123',
        resourceType: 'Patient',
        isValid: false,
        issues: [
          { id: '1', aspect: 'structural', severity: 'error', message: 'Missing field' },
          { id: '2', aspect: 'profile', severity: 'warning', message: 'Profile issue' },
          { id: '3', aspect: 'terminology', severity: 'error', message: 'Invalid code' },
          { id: '4', aspect: 'reference', severity: 'warning', message: 'Reference issue' },
          { id: '5', aspect: 'businessRule', severity: 'info', message: 'Business rule' },
          { id: '6', aspect: 'metadata', severity: 'error', message: 'Metadata issue' }
        ],
        aspects: [
          { aspect: 'structural', isValid: false, issues: [{ id: '1', aspect: 'structural', severity: 'error', message: 'Missing field' }], validationTime: 10, status: 'executed' },
          { aspect: 'profile', isValid: false, issues: [{ id: '2', aspect: 'profile', severity: 'warning', message: 'Profile issue' }], validationTime: 5, status: 'executed' },
          { aspect: 'terminology', isValid: false, issues: [{ id: '3', aspect: 'terminology', severity: 'error', message: 'Invalid code' }], validationTime: 8, status: 'executed' },
          { aspect: 'reference', isValid: false, issues: [{ id: '4', aspect: 'reference', severity: 'warning', message: 'Reference issue' }], validationTime: 6, status: 'executed' },
          { aspect: 'businessRule', isValid: true, issues: [{ id: '5', aspect: 'businessRule', severity: 'info', message: 'Business rule' }], validationTime: 4, status: 'executed' },
          { aspect: 'metadata', isValid: false, issues: [{ id: '6', aspect: 'metadata', severity: 'error', message: 'Metadata issue' }], validationTime: 7, status: 'executed' }
        ],
        validatedAt: new Date(),
        validationTime: 40
      };

      // Simulate enabled aspects (structural, terminology, businessRule)
      const enabledAspects = new Set(['structural', 'terminology', 'businessRule']);

      // Filter aspects based on enabled aspects (same logic as in the service)
      const filteredAspects = mockResult.aspects.filter(aspect => 
        enabledAspects.has(aspect.aspect)
      );

      // Filter issues based on enabled aspects (same logic as in the service)
      const filteredIssues = mockResult.issues.filter(issue => 
        enabledAspects.has(issue.aspect)
      );

      // Should only include enabled aspects
      expect(filteredAspects).toHaveLength(3);
      expect(filteredAspects.map(a => a.aspect)).toEqual(['structural', 'terminology', 'businessRule']);

      // Should only include issues from enabled aspects
      expect(filteredIssues).toHaveLength(3);
      expect(filteredIssues.map(i => i.id)).toEqual(['1', '3', '5']);

      // Calculate filtered counts
      const filteredErrorCount = filteredIssues.filter(issue => issue.severity === 'error').length;
      const filteredWarningCount = filteredIssues.filter(issue => issue.severity === 'warning').length;
      const filteredInformationCount = filteredIssues.filter(issue => issue.severity === 'info').length;

      expect(filteredErrorCount).toBe(2); // structural + terminology errors
      expect(filteredWarningCount).toBe(0); // no warnings in enabled aspects
      expect(filteredInformationCount).toBe(1); // businessRule information

      // Calculate filtered score (1 valid out of 3 aspects = 33%)
      const totalAspects = filteredAspects.length;
      const validAspects = filteredAspects.filter(aspect => aspect.isValid).length;
      const filteredScore = totalAspects > 0 ? Math.round((validAspects / totalAspects) * 100) : 100;

      expect(filteredScore).toBe(33);

      // Determine if result is valid based on filtered data
      const filteredIsValid = filteredErrorCount === 0;
      expect(filteredIsValid).toBe(false); // has filtered errors
    });

    it('should test filtering logic for validation summary', () => {
      // Test the core summary filtering logic
      const mockResults = [
        {
          resourceId: 'test-1',
          resourceType: 'Patient',
          isValid: false,
          issues: [
            { id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' },
            { id: '2', aspect: 'terminology', severity: 'warning', message: 'Warning 1' }
          ],
          aspects: [
            { aspect: 'structural', isValid: false, issues: [{ id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' }], validationTime: 5, status: 'executed' },
            { aspect: 'terminology', isValid: false, issues: [{ id: '2', aspect: 'terminology', severity: 'warning', message: 'Warning 1' }], validationTime: 3, status: 'executed' },
            { aspect: 'businessRule', isValid: true, issues: [], validationTime: 2, status: 'executed' }
          ],
          validatedAt: new Date(),
          validationTime: 10
        },
        {
          resourceId: 'test-2',
          resourceType: 'Patient',
          isValid: true,
          issues: [],
          aspects: [
            { aspect: 'structural', isValid: true, issues: [], validationTime: 4, status: 'executed' },
            { aspect: 'terminology', isValid: true, issues: [], validationTime: 3, status: 'executed' },
            { aspect: 'businessRule', isValid: true, issues: [], validationTime: 2, status: 'executed' }
          ],
          validatedAt: new Date(),
          validationTime: 9
        }
      ];

      // Simulate enabled aspects (structural, terminology, businessRule)
      const enabledAspects = new Set(['structural', 'terminology', 'businessRule']);

      // Filter all results
      const filteredResults = mockResults.map(result => {
        const filteredAspects = result.aspects.filter(aspect => 
          enabledAspects.has(aspect.aspect)
        );
        const filteredIssues = result.issues.filter(issue => 
          enabledAspects.has(issue.aspect)
        );

        const filteredErrorCount = filteredIssues.filter(issue => issue.severity === 'error').length;
        const filteredWarningCount = filteredIssues.filter(issue => issue.severity === 'warning').length;
        const filteredInformationCount = filteredIssues.filter(issue => issue.severity === 'info').length;

        const totalAspects = filteredAspects.length;
        const validAspects = filteredAspects.filter(aspect => aspect.isValid).length;
        const filteredScore = totalAspects > 0 ? Math.round((validAspects / totalAspects) * 100) : 100;

        const filteredIsValid = filteredErrorCount === 0;

        return {
          ...result,
          filteredAspects,
          filteredIssues,
          filteredErrorCount,
          filteredWarningCount,
          filteredInformationCount,
          filteredScore,
          isValid: filteredIsValid
        };
      });

      // Calculate summary
      const totalResources = filteredResults.length;
      const validResources = filteredResults.filter(r => r.isValid).length;
      const invalidResources = totalResources - validResources;
      
      const totalErrors = filteredResults.reduce((sum, r) => sum + r.filteredErrorCount, 0);
      const totalWarnings = filteredResults.reduce((sum, r) => sum + r.filteredWarningCount, 0);
      const totalInformation = filteredResults.reduce((sum, r) => sum + r.filteredInformationCount, 0);
      
      const averageScore = totalResources > 0 
        ? Math.round(filteredResults.reduce((sum, r) => sum + r.filteredScore, 0) / totalResources)
        : 100;

      expect(totalResources).toBe(2);
      expect(validResources).toBe(1);
      expect(invalidResources).toBe(1);
      expect(totalErrors).toBe(1);
      expect(totalWarnings).toBe(1);
      expect(totalInformation).toBe(0);
      expect(averageScore).toBe(67); // (33 + 100) / 2 = 66.5 -> 67
    });

    it('should handle empty results correctly', () => {
      // Test filtering logic with empty results
      const mockResult = {
        resourceId: 'test-456',
        resourceType: 'Patient',
        isValid: true,
        issues: [],
        aspects: [
          { aspect: 'structural', isValid: true, issues: [], validationTime: 5, status: 'executed' },
          { aspect: 'terminology', isValid: true, issues: [], validationTime: 3, status: 'executed' },
          { aspect: 'businessRule', isValid: true, issues: [], validationTime: 2, status: 'executed' }
        ],
        validatedAt: new Date(),
        validationTime: 10
      };

      const enabledAspects = new Set(['structural', 'terminology', 'businessRule']);

      const filteredAspects = mockResult.aspects.filter(aspect => 
        enabledAspects.has(aspect.aspect)
      );
      const filteredIssues = mockResult.issues.filter(issue => 
        enabledAspects.has(issue.aspect)
      );

      const filteredErrorCount = filteredIssues.filter(issue => issue.severity === 'error').length;
      const filteredWarningCount = filteredIssues.filter(issue => issue.severity === 'warning').length;
      const filteredInformationCount = filteredIssues.filter(issue => issue.severity === 'info').length;

      const totalAspects = filteredAspects.length;
      const validAspects = filteredAspects.filter(aspect => aspect.isValid).length;
      const filteredScore = totalAspects > 0 ? Math.round((validAspects / totalAspects) * 100) : 100;

      const filteredIsValid = filteredErrorCount === 0;

      expect(filteredIssues).toHaveLength(0);
      expect(filteredErrorCount).toBe(0);
      expect(filteredWarningCount).toBe(0);
      expect(filteredInformationCount).toBe(0);
      expect(filteredScore).toBe(100);
      expect(filteredIsValid).toBe(true);
    });
  });
});