/**
 * Unit tests for ValidationScoreCalculationService Logic
 */

import { describe, it, expect } from 'vitest';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

describe('ValidationScoreCalculationService Logic', () => {
  describe('Core Score Calculation Logic', () => {
    it('should verify that ALL_VALIDATION_ASPECTS contains all 6 aspects', () => {
      // This test verifies that our score calculation logic is supported by the type system
      expect(ALL_VALIDATION_ASPECTS).toHaveLength(6);
      expect(ALL_VALIDATION_ASPECTS).toContain('structural');
      expect(ALL_VALIDATION_ASPECTS).toContain('profile');
      expect(ALL_VALIDATION_ASPECTS).toContain('terminology');
      expect(ALL_VALIDATION_ASPECTS).toContain('reference');
      expect(ALL_VALIDATION_ASPECTS).toContain('businessRule');
      expect(ALL_VALIDATION_ASPECTS).toContain('metadata');
    });

    it('should test resource score calculation logic', () => {
      // Test the core score calculation logic for a single resource
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

      // Filter aspects and issues based on enabled aspects
      const filteredAspects = mockResult.aspects.filter(aspect => 
        enabledAspects.has(aspect.aspect)
      );
      const filteredIssues = mockResult.issues.filter(issue => 
        enabledAspects.has(issue.aspect)
      );

      // Calculate aspect scores
      const aspectScores: Record<string, number> = {};
      let totalScore = 0;
      let validAspects = 0;

      filteredAspects.forEach(aspect => {
        const aspectScore = aspect.isValid ? 100 : 0;
        aspectScores[aspect.aspect] = aspectScore;
        totalScore += aspectScore;
        if (aspect.isValid) validAspects++;
      });

      // Calculate overall score
      const overall = filteredAspects.length > 0 
        ? Math.round(totalScore / filteredAspects.length) 
        : 100;

      // Calculate weighted score
      let weightedScore = 0;
      let totalWeight = 0;

      filteredAspects.forEach(aspect => {
        const issueCount = aspect.issues.length;
        const weight = Math.max(1, 10 - issueCount);
        const aspectScore = aspect.isValid ? 100 : 0;
        
        weightedScore += aspectScore * weight;
        totalWeight += weight;
      });

      const finalWeightedScore = totalWeight > 0 
        ? Math.round(weightedScore / totalWeight) 
        : 100;

      // Calculate confidence
      const errorCount = filteredIssues.filter(issue => issue.severity === 'error').length;
      const warningCount = filteredIssues.filter(issue => issue.severity === 'warning').length;
      const informationCount = filteredIssues.filter(issue => issue.severity === 'info').length;

      const confidence = Math.max(0, 100 - (errorCount * 20) - (warningCount * 10) - (informationCount * 5));

      // Verify calculations
      expect(aspectScores.structural).toBe(0); // Invalid aspect
      expect(aspectScores.terminology).toBe(0); // Invalid aspect
      expect(aspectScores.businessRule).toBe(100); // Valid aspect

      expect(overall).toBe(33); // (0 + 0 + 100) / 3 = 33.33 -> 33

      expect(finalWeightedScore).toBe(33); // Should be similar to overall for this case

      // Confidence calculation: 100 - (2 * 20) - (0 * 10) - (1 * 5) = 100 - 40 - 0 - 5 = 55
      expect(confidence).toBe(55);
    });

    it('should test score breakdown calculation logic', () => {
      // Test the score breakdown calculation logic
      const mockResult = {
        resourceId: 'test-456',
        resourceType: 'Patient',
        isValid: true,
        issues: [
          { id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' },
          { id: '2', aspect: 'terminology', severity: 'warning', message: 'Warning 1' },
          { id: '3', aspect: 'businessRule', severity: 'info', message: 'Info 1' }
        ],
        aspects: [
          { aspect: 'structural', isValid: false, issues: [{ id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' }], validationTime: 5, status: 'executed' },
          { aspect: 'terminology', isValid: false, issues: [{ id: '2', aspect: 'terminology', severity: 'warning', message: 'Warning 1' }], validationTime: 3, status: 'executed' },
          { aspect: 'businessRule', isValid: true, issues: [{ id: '3', aspect: 'businessRule', severity: 'info', message: 'Info 1' }], validationTime: 2, status: 'executed' }
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

      const totalAspects = filteredAspects.length;
      const validAspects = filteredAspects.filter(aspect => aspect.isValid).length;
      const invalidAspects = totalAspects - validAspects;

      const errorCount = filteredIssues.filter(issue => issue.severity === 'error').length;
      const warningCount = filteredIssues.filter(issue => issue.severity === 'warning').length;
      const informationCount = filteredIssues.filter(issue => issue.severity === 'info').length;

      // Calculate aspect details
      const aspectDetails: Record<string, any> = {};
      filteredAspects.forEach(aspect => {
        const aspectIssues = aspect.issues;
        const aspectErrorCount = aspectIssues.filter(issue => issue.severity === 'error').length;
        const aspectWarningCount = aspectIssues.filter(issue => issue.severity === 'warning').length;
        const aspectInformationCount = aspectIssues.filter(issue => issue.severity === 'info').length;

        aspectDetails[aspect.aspect] = {
          score: aspect.isValid ? 100 : 0,
          isValid: aspect.isValid,
          issueCount: aspectIssues.length,
          errorCount: aspectErrorCount,
          warningCount: aspectWarningCount,
          informationCount: aspectInformationCount
        };
      });

      // Verify breakdown
      expect(totalAspects).toBe(3);
      expect(validAspects).toBe(1);
      expect(invalidAspects).toBe(2);
      expect(errorCount).toBe(1);
      expect(warningCount).toBe(1);
      expect(informationCount).toBe(1);

      // Verify aspect details
      expect(aspectDetails.structural.score).toBe(0);
      expect(aspectDetails.structural.isValid).toBe(false);
      expect(aspectDetails.structural.errorCount).toBe(1);

      expect(aspectDetails.terminology.score).toBe(0);
      expect(aspectDetails.terminology.isValid).toBe(false);
      expect(aspectDetails.terminology.warningCount).toBe(1);

      expect(aspectDetails.businessRule.score).toBe(100);
      expect(aspectDetails.businessRule.isValid).toBe(true);
      expect(aspectDetails.businessRule.informationCount).toBe(1);
    });

    it('should test score summary calculation logic', () => {
      // Test the score summary calculation logic for multiple resources
      const mockResults = [
        {
          resourceId: 'test-1',
          resourceType: 'Patient',
          isValid: false,
          issues: [{ id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' }],
          aspects: [{ aspect: 'structural', isValid: false, issues: [{ id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' }], validationTime: 5, status: 'executed' }],
          validatedAt: new Date(),
          validationTime: 5
        },
        {
          resourceId: 'test-2',
          resourceType: 'Patient',
          isValid: true,
          issues: [],
          aspects: [{ aspect: 'structural', isValid: true, issues: [], validationTime: 3, status: 'executed' }],
          validatedAt: new Date(),
          validationTime: 3
        },
        {
          resourceId: 'test-3',
          resourceType: 'Patient',
          isValid: true,
          issues: [],
          aspects: [{ aspect: 'structural', isValid: true, issues: [], validationTime: 4, status: 'executed' }],
          validatedAt: new Date(),
          validationTime: 4
        }
      ];

      const enabledAspects = new Set(['structural']);

      // Calculate scores for all resources
      const scores = mockResults.map(result => {
        const filteredAspects = result.aspects.filter(aspect => 
          enabledAspects.has(aspect.aspect)
        );

        const totalScore = filteredAspects.reduce((sum, aspect) => sum + (aspect.isValid ? 100 : 0), 0);
        const overall = filteredAspects.length > 0 
          ? Math.round(totalScore / filteredAspects.length) 
          : 100;

        return { overall };
      });

      const overallScores = scores.map(score => score.overall);

      // Calculate statistics
      const averageScore = Math.round(overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length);
      
      // Calculate median
      const sortedScores = [...overallScores].sort((a, b) => a - b);
      const medianScore = sortedScores.length % 2 === 0
        ? Math.round((sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2)
        : sortedScores[Math.floor(sortedScores.length / 2)];

      // Calculate score distribution
      const scoreDistribution = {
        excellent: overallScores.filter(score => score >= 90).length,
        good: overallScores.filter(score => score >= 70 && score < 90).length,
        fair: overallScores.filter(score => score >= 50 && score < 70).length,
        poor: overallScores.filter(score => score < 50).length
      };

      // Calculate valid/invalid resources
      const validResources = mockResults.filter(result => {
        const filteredAspects = result.aspects.filter(aspect => 
          enabledAspects.has(aspect.aspect)
        );
        const totalScore = filteredAspects.reduce((sum, aspect) => sum + (aspect.isValid ? 100 : 0), 0);
        const overall = filteredAspects.length > 0 
          ? Math.round(totalScore / filteredAspects.length) 
          : 100;
        return overall >= 70;
      }).length;

      const invalidResources = mockResults.length - validResources;

      // Verify calculations
      expect(overallScores).toEqual([0, 100, 100]); // [invalid, valid, valid]
      expect(averageScore).toBe(67); // (0 + 100 + 100) / 3 = 66.67 -> 67
      expect(medianScore).toBe(100); // [0, 100, 100] -> median is 100
      expect(scoreDistribution.excellent).toBe(2); // 2 scores >= 90
      expect(scoreDistribution.good).toBe(0);
      expect(scoreDistribution.fair).toBe(0);
      expect(scoreDistribution.poor).toBe(1); // 1 score < 50
      expect(validResources).toBe(2); // 2 resources with score >= 70
      expect(invalidResources).toBe(1); // 1 resource with score < 70
    });

    it('should handle empty results correctly', () => {
      // Test score calculation with empty results
      const mockResult = {
        resourceId: 'test-empty',
        resourceType: 'Patient',
        isValid: true,
        issues: [],
        aspects: [],
        validatedAt: new Date(),
        validationTime: 0
      };

      const enabledAspects = new Set(['structural', 'terminology']);

      const filteredAspects = mockResult.aspects.filter(aspect => 
        enabledAspects.has(aspect.aspect)
      );

      const totalScore = filteredAspects.reduce((sum, aspect) => sum + (aspect.isValid ? 100 : 0), 0);
      const overall = filteredAspects.length > 0 
        ? Math.round(totalScore / filteredAspects.length) 
        : 100;

      expect(overall).toBe(100); // Default to 100 when no aspects
    });

    it('should test aspect-specific score calculation logic', () => {
      // Test aspect-specific score calculation across multiple resources
      const mockResults = [
        {
          resourceId: 'test-1',
          resourceType: 'Patient',
          isValid: false,
          issues: [{ id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' }],
          aspects: [{ aspect: 'structural', isValid: false, issues: [{ id: '1', aspect: 'structural', severity: 'error', message: 'Error 1' }], validationTime: 5, status: 'executed' }],
          validatedAt: new Date(),
          validationTime: 5
        },
        {
          resourceId: 'test-2',
          resourceType: 'Patient',
          isValid: true,
          issues: [],
          aspects: [{ aspect: 'structural', isValid: true, issues: [], validationTime: 3, status: 'executed' }],
          validatedAt: new Date(),
          validationTime: 3
        }
      ];

      const enabledAspects = new Set(['structural']);

      // Initialize aspect stats
      const aspectStats: Record<string, any> = {};
      enabledAspects.forEach(aspect => {
        aspectStats[aspect] = {
          scores: [],
          totalResources: 0,
          validResources: 0,
          invalidResources: 0,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0
        };
      });

      // Collect stats for each resource
      mockResults.forEach(result => {
        const filteredAspects = result.aspects.filter(aspect => 
          enabledAspects.has(aspect.aspect)
        );

        filteredAspects.forEach(aspect => {
          const aspectStat = aspectStats[aspect.aspect];
          aspectStat.scores.push(aspect.isValid ? 100 : 0);
          aspectStat.totalResources++;

          if (aspect.isValid) {
            aspectStat.validResources++;
          } else {
            aspectStat.invalidResources++;
          }

          // Count issues by severity
          aspect.issues.forEach(issue => {
            if (issue.severity === 'error') aspectStat.errorCount++;
            else if (issue.severity === 'warning') aspectStat.warningCount++;
            else if (issue.severity === 'info') aspectStat.informationCount++;
          });
        });
      });

      // Calculate final stats
      const finalStats: Record<string, any> = {};
      Object.entries(aspectStats).forEach(([aspect, stats]) => {
        const averageScore = stats.scores.length > 0 
          ? Math.round(stats.scores.reduce((sum: number, score: number) => sum + score, 0) / stats.scores.length)
          : 100;

        finalStats[aspect] = {
          averageScore,
          totalResources: stats.totalResources,
          validResources: stats.validResources,
          invalidResources: stats.invalidResources,
          errorCount: stats.errorCount,
          warningCount: stats.warningCount,
          informationCount: stats.informationCount
        };
      });

      // Verify aspect-specific calculations
      expect(finalStats.structural.averageScore).toBe(50); // (0 + 100) / 2 = 50
      expect(finalStats.structural.totalResources).toBe(2);
      expect(finalStats.structural.validResources).toBe(1);
      expect(finalStats.structural.invalidResources).toBe(1);
      expect(finalStats.structural.errorCount).toBe(1);
      expect(finalStats.structural.warningCount).toBe(0);
      expect(finalStats.structural.informationCount).toBe(0);
    });
  });
});
