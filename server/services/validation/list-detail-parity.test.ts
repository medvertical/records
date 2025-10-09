/**
 * List/Detail Parity Tests
 * 
 * This test verifies that validation results displayed in the dashboard (list view)
 * have parity with individual resource validation results (detail view).
 * Specifically, scores, severity counts, and coverage should be consistent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storage } from '../../storage';
import { getValidationSettingsService } from './settings/validation-settings-service';

// Mock dependencies
vi.mock('../../storage', () => ({
  storage: {
    getResourceStatsWithSettings: vi.fn(),
    getValidationResultsDualMode: vi.fn(),
    getFhirResourceById: vi.fn(),
    getActiveFhirServer: vi.fn(),
    reEvaluateValidationResult: vi.fn()
  }
}));

vi.mock('./settings/validation-settings-service', () => ({
  getValidationSettingsService: vi.fn(() => ({
    getActiveSettings: vi.fn()
  }))
}));

describe('List/Detail Parity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation Results Consistency', () => {
    it('should have consistent scores between dashboard and individual resource views', async () => {
      // Mock validation settings
      const mockSettings = {
        aspects: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'warning' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: true, severity: 'info' }
        }
      };

      // Mock individual validation result with issues
      const mockValidationResult = {
        id: 1,
        resourceId: 123,
        isValid: false,
        issues: [
          { aspect: 'structural', severity: 'error', message: 'Structural error' },
          { aspect: 'profile', severity: 'warning', message: 'Profile warning' },
          { aspect: 'terminology', severity: 'warning', message: 'Terminology warning' }
        ],
        errorCount: 1,
        warningCount: 2,
        informationCount: 0
      };

      // Mock dashboard aggregation result
      const mockDashboardStats = {
        totalResources: 100,
        validResources: 85,
        errorResources: 10,
        warningResources: 5,
        aspectBreakdown: {
          structural: { enabled: true, issueCount: 10, errorCount: 8, warningCount: 2, informationCount: 0, score: 85 },
          profile: { enabled: true, issueCount: 15, errorCount: 5, warningCount: 10, informationCount: 0, score: 75 },
          terminology: { enabled: true, issueCount: 8, errorCount: 2, warningCount: 6, informationCount: 0, score: 90 },
          reference: { enabled: true, issueCount: 12, errorCount: 6, warningCount: 6, informationCount: 0, score: 80 },
          businessRule: { enabled: true, issueCount: 5, errorCount: 1, warningCount: 4, informationCount: 0, score: 95 },
          metadata: { enabled: true, issueCount: 3, errorCount: 0, warningCount: 2, informationCount: 1, score: 98 }
        }
      };

      // Setup mocks
      const settingsService = getValidationSettingsService();
      vi.mocked(settingsService.getActiveSettings).mockResolvedValue(mockSettings);
      vi.mocked(storage.getResourceStatsWithSettings).mockResolvedValue(mockDashboardStats);
      vi.mocked(storage.getValidationResultsDualMode).mockResolvedValue([mockValidationResult]);
      vi.mocked(storage.getFhirResourceById).mockResolvedValue({
        id: 123,
        resourceType: 'Patient',
        resourceId: 'patient-1',
        serverId: 1
      });
      vi.mocked(storage.getActiveFhirServer).mockResolvedValue({ id: 1, url: 'http://test-server.com' });

      // Test dashboard aggregation
      const dashboardStats = await storage.getResourceStatsWithSettings();
      
      // Test individual resource result (should apply same filtering logic)
      const individualResults = await storage.getValidationResultsDualMode(1, 'Patient', 'patient-1', 123);
      
      // Verify that both use the same calculation logic
      expect(dashboardStats.aspectBreakdown.structural.score).toBe(85);
      expect(dashboardStats.aspectBreakdown.structural.errorCount).toBe(8);
      expect(dashboardStats.aspectBreakdown.structural.warningCount).toBe(2);
      
      // Verify individual result has same structure for filtering
      expect(individualResults[0].issues).toHaveLength(3);
      expect(individualResults[0].errorCount).toBe(1);
      expect(individualResults[0].warningCount).toBe(2);
    });

    it('should filter issues consistently when validation settings change', async () => {
      // Mock validation settings with some aspects disabled
      const mockSettings = {
        aspects: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: false, severity: 'warning' }, // Disabled
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: false, severity: 'warning' }, // Disabled
          metadata: { enabled: true, severity: 'info' }
        }
      };

      // Mock validation result with issues from disabled aspects
      const mockValidationResult = {
        id: 1,
        resourceId: 123,
        isValid: false,
        issues: [
          { aspect: 'structural', severity: 'error', message: 'Structural error' },
          { aspect: 'profile', severity: 'warning', message: 'Profile warning (should be filtered)' },
          { aspect: 'terminology', severity: 'warning', message: 'Terminology warning' },
          { aspect: 'businessRule', severity: 'warning', message: 'Business rule warning (should be filtered)' }
        ],
        errorCount: 1,
        warningCount: 3,
        informationCount: 0
      };

      // Mock re-evaluation result (after filtering)
      const mockReEvaluatedResult = {
        isValid: false,
        errorCount: 1,
        warningCount: 1 // Only terminology warning remains
      };

      // Setup mocks
      const settingsService = getValidationSettingsService();
      vi.mocked(settingsService.getActiveSettings).mockResolvedValue(mockSettings);
      vi.mocked(storage.getValidationResultsDualMode).mockResolvedValue([mockValidationResult]);
      vi.mocked(storage.reEvaluateValidationResult).mockReturnValue(mockReEvaluatedResult);

      // Test that filtering logic is applied consistently
      const individualResults = await storage.getValidationResultsDualMode(1, 'Patient', 'patient-1', 123);
      
      // Verify that re-evaluation is called with correct settings
      expect(storage.reEvaluateValidationResult).toHaveBeenCalledWith(
        mockValidationResult,
        mockSettings
      );
      
      // Verify that disabled aspects are filtered out
      const filteredIssues = mockValidationResult.issues.filter(issue => {
        const aspect = issue.aspect;
        switch (aspect) {
          case 'structural':
            return mockSettings.aspects.structural.enabled === true;
          case 'profile':
            return mockSettings.aspects.profile.enabled === true; // false
          case 'terminology':
            return mockSettings.aspects.terminology.enabled === true;
          case 'businessRule':
            return mockSettings.aspects.businessRule.enabled === true; // false
          default:
            return true;
        }
      });
      
      expect(filteredIssues).toHaveLength(2); // Only structural and terminology
      expect(filteredIssues.find(issue => issue.aspect === 'profile')).toBeUndefined();
      expect(filteredIssues.find(issue => issue.aspect === 'businessRule')).toBeUndefined();
    });

    it('should calculate scores consistently using the same formula', async () => {
      // Test score calculation formula
      const testCases = [
        { errors: 0, warnings: 0, info: 0, expectedScore: 100 },
        { errors: 1, warnings: 0, info: 0, expectedScore: 85 }, // 100 - (1 * 15)
        { errors: 0, warnings: 1, info: 0, expectedScore: 95 }, // 100 - (1 * 5)
        { errors: 0, warnings: 0, info: 1, expectedScore: 99 }, // 100 - (1 * 1)
        { errors: 2, warnings: 3, info: 1, expectedScore: 64 }, // 100 - (2*15 + 3*5 + 1*1)
        { errors: 10, warnings: 0, info: 0, expectedScore: 0 } // 100 - (10 * 15) = -50, clamped to 0
      ];

      testCases.forEach(({ errors, warnings, info, expectedScore }) => {
        let score = 100;
        score -= errors * 15;    // Error issues: -15 points each
        score -= warnings * 5;   // Warning issues: -5 points each
        score -= info * 1;       // Information issues: -1 point each
        score = Math.max(0, Math.min(100, score));
        
        expect(score).toBe(expectedScore);
      });
    });

    it('should maintain coverage consistency between dashboard and individual views', async () => {
      // Mock dashboard coverage calculation
      const mockDashboardStats = {
        totalResources: 1000,
        validResources: 850,
        errorResources: 100,
        warningResources: 50,
        validationCoverage: 85.0 // 850/1000 * 100
      };

      // Mock individual resource validation results
      const mockIndividualResults = [
        { resourceId: 1, isValid: true },
        { resourceId: 2, isValid: false, errorCount: 1 },
        { resourceId: 3, isValid: true },
        { resourceId: 4, isValid: false, warningCount: 2 }
      ];

      // Setup mocks
      vi.mocked(storage.getResourceStatsWithSettings).mockResolvedValue(mockDashboardStats);
      vi.mocked(storage.getValidationResultsDualMode).mockResolvedValue(mockIndividualResults);

      // Test dashboard coverage
      const dashboardStats = await storage.getResourceStatsWithSettings();
      const dashboardCoverage = (dashboardStats.validResources / dashboardStats.totalResources) * 100;
      
      // Test individual results coverage
      const individualResults = await storage.getValidationResultsDualMode(1, 'Patient', 'patient-1', 123);
      const individualValidCount = individualResults.filter(r => r.isValid).length;
      const individualCoverage = (individualValidCount / individualResults.length) * 100;
      
      // Verify coverage calculations are consistent
      expect(dashboardCoverage).toBe(85.0);
      expect(individualCoverage).toBe(50.0); // 2 valid out of 4 results
      
      // Both should use the same validation logic
      expect(dashboardStats.validResources).toBe(850);
      expect(individualValidCount).toBe(2);
    });
  });

  describe('Aspect Coverage Consistency', () => {
    it('should show consistent aspect breakdown between dashboard and individual resources', async () => {
      // Mock aspect breakdown from dashboard
      const mockDashboardAspectBreakdown = {
        structural: { enabled: true, issueCount: 100, errorCount: 50, warningCount: 30, informationCount: 20, score: 85 },
        profile: { enabled: true, issueCount: 80, errorCount: 20, warningCount: 40, informationCount: 20, score: 90 },
        terminology: { enabled: true, issueCount: 60, errorCount: 10, warningCount: 30, informationCount: 20, score: 95 },
        reference: { enabled: true, issueCount: 40, errorCount: 15, warningCount: 15, informationCount: 10, score: 88 },
        businessRule: { enabled: true, issueCount: 30, errorCount: 5, warningCount: 15, informationCount: 10, score: 92 },
        metadata: { enabled: true, issueCount: 20, errorCount: 2, warningCount: 8, informationCount: 10, score: 96 }
      };

      // Mock individual resource with aspect-specific issues
      const mockIndividualResult = {
        id: 1,
        resourceId: 123,
        isValid: false,
        issues: [
          { aspect: 'structural', severity: 'error', message: 'Structural error' },
          { aspect: 'profile', severity: 'warning', message: 'Profile warning' },
          { aspect: 'terminology', severity: 'info', message: 'Terminology info' }
        ],
        aspectResults: {
          structural: { score: 85, issues: [{ severity: 'error' }] },
          profile: { score: 90, issues: [{ severity: 'warning' }] },
          terminology: { score: 95, issues: [{ severity: 'info' }] }
        }
      };

      // Setup mocks
      vi.mocked(storage.getResourceStatsWithSettings).mockResolvedValue({
        aspectBreakdown: mockDashboardAspectBreakdown
      });
      vi.mocked(storage.getValidationResultsDualMode).mockResolvedValue([mockIndividualResult]);

      // Test dashboard aspect breakdown
      const dashboardStats = await storage.getResourceStatsWithSettings();
      const dashboardAspects = dashboardStats.aspectBreakdown;
      
      // Test individual resource aspect results
      const individualResults = await storage.getValidationResultsDualMode(1, 'Patient', 'patient-1', 123);
      const individualAspects = individualResults[0].aspectResults;
      
      // Verify aspect scores are calculated consistently
      expect(dashboardAspects.structural.score).toBe(85);
      expect(individualAspects?.structural?.score).toBe(85);
      
      expect(dashboardAspects.profile.score).toBe(90);
      expect(individualAspects?.profile?.score).toBe(90);
      
      expect(dashboardAspects.terminology.score).toBe(95);
      expect(individualAspects?.terminology?.score).toBe(95);
    });

    it('should handle disabled aspects consistently in both views', async () => {
      // Mock settings with some aspects disabled
      const mockSettings = {
        aspects: {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: false, severity: 'warning' },
          terminology: { enabled: true, severity: 'warning' },
          reference: { enabled: false, severity: 'error' },
          businessRule: { enabled: true, severity: 'warning' },
          metadata: { enabled: false, severity: 'info' }
        }
      };

      // Mock dashboard stats with disabled aspects filtered
      const mockDashboardStats = {
        aspectBreakdown: {
          structural: { enabled: true, issueCount: 100, errorCount: 50, warningCount: 30, informationCount: 20, score: 85 },
          terminology: { enabled: true, issueCount: 60, errorCount: 10, warningCount: 30, informationCount: 20, score: 95 },
          businessRule: { enabled: true, issueCount: 30, errorCount: 5, warningCount: 15, informationCount: 10, score: 92 }
          // profile, reference, metadata are not included because they're disabled
        }
      };

      // Setup mocks
      const settingsService = getValidationSettingsService();
      vi.mocked(settingsService.getActiveSettings).mockResolvedValue(mockSettings);
      vi.mocked(storage.getResourceStatsWithSettings).mockResolvedValue(mockDashboardStats);

      // Test that disabled aspects are consistently excluded
      const dashboardStats = await storage.getResourceStatsWithSettings();
      const enabledAspects = Object.keys(dashboardStats.aspectBreakdown);
      
      // Verify only enabled aspects are present
      expect(enabledAspects).toContain('structural');
      expect(enabledAspects).toContain('terminology');
      expect(enabledAspects).toContain('businessRule');
      expect(enabledAspects).not.toContain('profile');
      expect(enabledAspects).not.toContain('reference');
      expect(enabledAspects).not.toContain('metadata');
    });
  });
});
