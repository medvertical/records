import { describe, it, expect } from 'vitest';
import {
  countMessagesBySeverity,
  calculateValidationScore,
  calculateAggregatedScore,
  aggregateValidationSummary,
  groupMessagesByAspect,
  filterMessagesByAspectSettings,
  validateSummaryParity,
  getValidationBadgeVariant,
  getValidationStatusLabel,
  type ValidationMessage,
  type ValidationAspect,
} from './validation-scoring';

describe('validation-scoring', () => {
  // Sample messages for testing
  const sampleMessages: Array<ValidationMessage & { aspect?: ValidationAspect }> = [
    {
      severity: 'error',
      code: 'E001',
      canonicalPath: 'Patient.name',
      text: 'Name is required',
      signature: 'sig-001',
      aspect: 'structural',
    },
    {
      severity: 'warning',
      code: 'W001',
      canonicalPath: 'Patient.telecom',
      text: 'Phone number format issue',
      signature: 'sig-002',
      aspect: 'structural',
    },
    {
      severity: 'error',
      code: 'E002',
      canonicalPath: 'Patient.birthDate',
      text: 'Invalid date format',
      signature: 'sig-003',
      aspect: 'profile',
    },
    {
      severity: 'information',
      code: 'I001',
      canonicalPath: 'Patient.gender',
      text: 'Gender code suggestion',
      signature: 'sig-004',
      aspect: 'terminology',
    },
  ];

  describe('countMessagesBySeverity', () => {
    it('should count messages by severity correctly', () => {
      const counts = countMessagesBySeverity(sampleMessages);
      
      expect(counts.total).toBe(4);
      expect(counts.errors).toBe(2);
      expect(counts.warnings).toBe(1);
      expect(counts.information).toBe(1);
    });

    it('should handle empty messages', () => {
      const counts = countMessagesBySeverity([]);
      
      expect(counts.total).toBe(0);
      expect(counts.errors).toBe(0);
      expect(counts.warnings).toBe(0);
      expect(counts.information).toBe(0);
    });
  });

  describe('calculateValidationScore', () => {
    it('should calculate score with default weights', () => {
      const counts = {
        total: 3,
        errors: 1,
        warnings: 1,
        information: 1,
      };
      
      // Score = 100 - (1 * 15) - (1 * 5) - (1 * 1) = 79
      const score = calculateValidationScore(counts);
      expect(score).toBe(79);
    });

    it('should return 100 for no issues', () => {
      const counts = {
        total: 0,
        errors: 0,
        warnings: 0,
        information: 0,
      };
      
      const score = calculateValidationScore(counts);
      expect(score).toBe(100);
    });

    it('should not go below 0', () => {
      const counts = {
        total: 20,
        errors: 10, // 10 * 15 = 150 (would be -50)
        warnings: 0,
        information: 0,
      };
      
      const score = calculateValidationScore(counts);
      expect(score).toBe(0);
    });
  });

  describe('groupMessagesByAspect', () => {
    it('should group messages by aspect correctly', () => {
      const grouped = groupMessagesByAspect(sampleMessages);
      
      expect(grouped.structural).toHaveLength(2);
      expect(grouped.profile).toHaveLength(1);
      expect(grouped.terminology).toHaveLength(1);
      expect(grouped.reference).toHaveLength(0);
      expect(grouped.businessRule).toHaveLength(0);
      expect(grouped.metadata).toHaveLength(0);
    });

    it('should default to structural for messages without aspect', () => {
      const messagesWithoutAspect: ValidationMessage[] = [
        {
          severity: 'error',
          canonicalPath: 'test',
          text: 'test error',
          signature: 'sig-test',
        },
      ];
      
      const grouped = groupMessagesByAspect(messagesWithoutAspect);
      expect(grouped.structural).toHaveLength(1);
    });
  });

  describe('filterMessagesByAspectSettings', () => {
    it('should filter out messages from disabled aspects', () => {
      const settings = {
        aspects: {
          structural: { enabled: true },
          profile: { enabled: false },
          terminology: { enabled: true },
        },
      };
      
      const filtered = filterMessagesByAspectSettings(sampleMessages, settings);
      
      // Should exclude profile message (1 error)
      expect(filtered).toHaveLength(3);
      expect(filtered.find(m => m.aspect === 'profile')).toBeUndefined();
    });

    it('should return all messages if no settings provided', () => {
      const filtered = filterMessagesByAspectSettings(sampleMessages);
      expect(filtered).toHaveLength(4);
    });

    it('should default to enabled if aspect not in settings', () => {
      const settings = {
        aspects: {
          structural: { enabled: false },
        },
      };
      
      const filtered = filterMessagesByAspectSettings(sampleMessages, settings);
      
      // Should keep profile and terminology (not in settings = enabled by default)
      expect(filtered.find(m => m.aspect === 'profile')).toBeDefined();
      expect(filtered.find(m => m.aspect === 'terminology')).toBeDefined();
      expect(filtered.find(m => m.aspect === 'structural')).toBeUndefined();
    });
  });

  describe('aggregateValidationSummary', () => {
    it('should aggregate validation summary correctly', () => {
      const grouped = groupMessagesByAspect(sampleMessages);
      const settings = {
        aspects: {
          structural: { enabled: true },
          profile: { enabled: true },
          terminology: { enabled: true },
        },
      };
      
      const summary = aggregateValidationSummary(grouped, settings);
      
      expect(summary.totalIssues).toBe(4);
      expect(summary.errorCount).toBe(2);
      expect(summary.warningCount).toBe(1);
      expect(summary.informationCount).toBe(1);
      expect(summary.isValid).toBe(false);
      expect(summary.enabledAspectsCount).toBe(6); // All aspects default to enabled
    });

    it('should exclude disabled aspects from counts', () => {
      const grouped = groupMessagesByAspect(sampleMessages);
      const settings = {
        aspects: {
          structural: { enabled: false },
          profile: { enabled: true },
          terminology: { enabled: true },
        },
      };
      
      const summary = aggregateValidationSummary(grouped, settings);
      
      // Should exclude structural messages (1 error, 1 warning)
      expect(summary.totalIssues).toBe(2);
      expect(summary.errorCount).toBe(1);
      expect(summary.warningCount).toBe(0);
      expect(summary.informationCount).toBe(1);
    });

    it('should calculate aggregated score from enabled aspects only', () => {
      const grouped = groupMessagesByAspect(sampleMessages);
      const settings = {
        aspects: {
          structural: { enabled: true },
          profile: { enabled: true },
          terminology: { enabled: false },
          reference: { enabled: false },
          businessRule: { enabled: false },
          metadata: { enabled: false },
        },
      };
      
      const summary = aggregateValidationSummary(grouped, settings);
      
      // Only structural and profile are enabled
      expect(summary.enabledAspectsCount).toBe(2);
      expect(summary.disabledAspectsCount).toBe(4);
    });
  });

  describe('calculateAggregatedScore', () => {
    it('should average scores from enabled aspects', () => {
      const aspectResults = [
        { aspect: 'structural' as const, enabled: true, score: 80, counts: { total: 2, errors: 1, warnings: 1, information: 0 }, isValid: false },
        { aspect: 'profile' as const, enabled: true, score: 90, counts: { total: 1, errors: 0, warnings: 1, information: 0 }, isValid: true },
        { aspect: 'terminology' as const, enabled: false, score: 50, counts: { total: 5, errors: 3, warnings: 2, information: 0 }, isValid: false },
      ];
      
      // Average of 80 and 90 (terminology is disabled) = 85
      const score = calculateAggregatedScore(aspectResults);
      expect(score).toBe(85);
    });

    it('should return 100 if no aspects are enabled', () => {
      const aspectResults = [
        { aspect: 'structural' as const, enabled: false, score: 80, counts: { total: 2, errors: 1, warnings: 1, information: 0 }, isValid: false },
      ];
      
      const score = calculateAggregatedScore(aspectResults);
      expect(score).toBe(100);
    });
  });

  describe('validateSummaryParity', () => {
    it('should detect parity between identical summaries', () => {
      const summary1 = {
        totalIssues: 4,
        errorCount: 2,
        warningCount: 1,
        informationCount: 1,
        aggregatedScore: 79,
        isValid: false,
        aspectResults: [],
        enabledAspectsCount: 3,
        disabledAspectsCount: 3,
      };
      
      const summary2 = { ...summary1 };
      
      const result = validateSummaryParity(summary1, summary2);
      expect(result.isParity).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect differences in summaries', () => {
      const summary1 = {
        totalIssues: 4,
        errorCount: 2,
        warningCount: 1,
        informationCount: 1,
        aggregatedScore: 79,
        isValid: false,
        aspectResults: [],
        enabledAspectsCount: 3,
        disabledAspectsCount: 3,
      };
      
      const summary2 = {
        ...summary1,
        errorCount: 3, // Different
        aggregatedScore: 80, // Different
      };
      
      const result = validateSummaryParity(summary1, summary2);
      expect(result.isParity).toBe(false);
      expect(result.differences).toHaveLength(2);
      expect(result.differences[0]).toContain('Error count mismatch');
      expect(result.differences[1]).toContain('Aggregated score mismatch');
    });
  });

  describe('getValidationBadgeVariant', () => {
    it('should return destructive for errors', () => {
      const counts = { total: 1, errors: 1, warnings: 0, information: 0 };
      expect(getValidationBadgeVariant(counts)).toBe('destructive');
    });

    it('should return warning for warnings (no errors)', () => {
      const counts = { total: 1, errors: 0, warnings: 1, information: 0 };
      expect(getValidationBadgeVariant(counts)).toBe('warning');
    });

    it('should return secondary for information (no errors/warnings)', () => {
      const counts = { total: 1, errors: 0, warnings: 0, information: 1 };
      expect(getValidationBadgeVariant(counts)).toBe('secondary');
    });

    it('should return success for no issues', () => {
      const counts = { total: 0, errors: 0, warnings: 0, information: 0 };
      expect(getValidationBadgeVariant(counts)).toBe('success');
    });
  });

  describe('getValidationStatusLabel', () => {
    it('should show error count for errors', () => {
      const counts = { total: 3, errors: 2, warnings: 1, information: 0 };
      expect(getValidationStatusLabel(counts)).toBe('2 Errors');
    });

    it('should show warning count for warnings (no errors)', () => {
      const counts = { total: 1, errors: 0, warnings: 1, information: 0 };
      expect(getValidationStatusLabel(counts)).toBe('1 Warning');
    });

    it('should show info count for information (no errors/warnings)', () => {
      const counts = { total: 1, errors: 0, warnings: 0, information: 1 };
      expect(getValidationStatusLabel(counts)).toBe('1 Info');
    });

    it('should show Valid for no issues', () => {
      const counts = { total: 0, errors: 0, warnings: 0, information: 0 };
      expect(getValidationStatusLabel(counts)).toBe('Valid');
    });
  });
});
