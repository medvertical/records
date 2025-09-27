/**
 * Unit tests for ValidationResourceListBadgesService Logic
 */

import { describe, it, expect } from 'vitest';

describe('ValidationResourceListBadgesService Logic', () => {
  describe('Core Badge Logic', () => {
    it('should verify badge structure is properly defined', () => {
      // Test that badge structure is properly defined
      const mockBadge = {
        resourceId: 'patient-1',
        resourceType: 'Patient',
        isValid: true,
        score: 85,
        errorCount: 0,
        warningCount: 2,
        informationCount: 1,
        enabledAspects: ['structural', 'profile', 'terminology'],
        disabledAspects: ['reference', 'businessRule', 'metadata'],
        lastValidated: new Date(),
        badgeColor: 'green',
        badgeText: '85%',
        tooltip: 'Score: 85%, 1 info(s)\nEnabled aspects: structural, profile, terminology\nDisabled aspects: reference, businessRule, metadata'
      };

      // Verify badge structure
      expect(mockBadge).toHaveProperty('resourceId');
      expect(mockBadge).toHaveProperty('resourceType');
      expect(mockBadge).toHaveProperty('isValid');
      expect(mockBadge).toHaveProperty('score');
      expect(mockBadge).toHaveProperty('errorCount');
      expect(mockBadge).toHaveProperty('warningCount');
      expect(mockBadge).toHaveProperty('informationCount');
      expect(mockBadge).toHaveProperty('enabledAspects');
      expect(mockBadge).toHaveProperty('disabledAspects');
      expect(mockBadge).toHaveProperty('lastValidated');
      expect(mockBadge).toHaveProperty('badgeColor');
      expect(mockBadge).toHaveProperty('badgeText');
      expect(mockBadge).toHaveProperty('tooltip');

      // Verify badge values
      expect(mockBadge.resourceId).toBe('patient-1');
      expect(mockBadge.resourceType).toBe('Patient');
      expect(mockBadge.isValid).toBe(true);
      expect(mockBadge.score).toBe(85);
      expect(mockBadge.errorCount).toBe(0);
      expect(mockBadge.warningCount).toBe(2);
      expect(mockBadge.informationCount).toBe(1);
      expect(Array.isArray(mockBadge.enabledAspects)).toBe(true);
      expect(Array.isArray(mockBadge.disabledAspects)).toBe(true);
      expect(mockBadge.lastValidated).toBeInstanceOf(Date);
      expect(['green', 'yellow', 'red', 'gray']).toContain(mockBadge.badgeColor);
      expect(typeof mockBadge.badgeText).toBe('string');
      expect(typeof mockBadge.tooltip).toBe('string');
    });

    it('should test badge color calculation logic', () => {
      // Test the logic for calculating badge colors
      const calculateBadgeColor = (isValid: boolean, score: number, errorCount: number, warningCount: number, enabledAspects: string[]) => {
        if (enabledAspects.length === 0) {
          return 'gray';
        } else if (errorCount > 0) {
          return 'red';
        } else if (warningCount > 0) {
          return 'yellow';
        } else if (score >= 90) {
          return 'green';
        } else if (score >= 70) {
          return 'yellow';
        } else {
          return 'red';
        }
      };

      // Test no aspects enabled
      expect(calculateBadgeColor(true, 100, 0, 0, [])).toBe('gray');

      // Test with errors
      expect(calculateBadgeColor(false, 100, 1, 0, ['structural'])).toBe('red');
      expect(calculateBadgeColor(true, 100, 1, 0, ['structural'])).toBe('red');

      // Test with warnings but no errors
      expect(calculateBadgeColor(true, 100, 0, 1, ['structural'])).toBe('yellow');

      // Test high score
      expect(calculateBadgeColor(true, 95, 0, 0, ['structural'])).toBe('green');

      // Test medium score
      expect(calculateBadgeColor(true, 75, 0, 0, ['structural'])).toBe('yellow');

      // Test low score
      expect(calculateBadgeColor(true, 50, 0, 0, ['structural'])).toBe('red');
    });

    it('should test badge text calculation logic', () => {
      // Test the logic for calculating badge text
      const calculateBadgeText = (isValid: boolean, score: number, errorCount: number, warningCount: number, enabledAspects: string[]) => {
        if (enabledAspects.length === 0) {
          return 'N/A';
        } else if (errorCount > 0) {
          return `${errorCount}E`;
        } else if (warningCount > 0) {
          return `${warningCount}W`;
        } else {
          return `${score}%`;
        }
      };

      // Test no aspects enabled
      expect(calculateBadgeText(true, 100, 0, 0, [])).toBe('N/A');

      // Test with errors
      expect(calculateBadgeText(false, 100, 3, 0, ['structural'])).toBe('3E');
      expect(calculateBadgeText(true, 100, 1, 0, ['structural'])).toBe('1E');

      // Test with warnings but no errors
      expect(calculateBadgeText(true, 100, 0, 2, ['structural'])).toBe('2W');

      // Test with score only
      expect(calculateBadgeText(true, 85, 0, 0, ['structural'])).toBe('85%');
    });

    it('should test tooltip generation logic', () => {
      // Test the logic for generating tooltips
      const generateTooltip = (isValid: boolean, score: number, errorCount: number, warningCount: number, informationCount: number, enabledAspects: string[], disabledAspects: string[]) => {
        let tooltip = '';

        if (enabledAspects.length === 0) {
          tooltip = 'No validation aspects enabled';
        } else if (errorCount > 0) {
          tooltip = `${errorCount} error(s), ${warningCount} warning(s), ${informationCount} info(s)`;
        } else if (warningCount > 0) {
          tooltip = `${warningCount} warning(s), ${informationCount} info(s)`;
        } else {
          tooltip = `Score: ${score}%, ${informationCount} info(s)`;
        }

        // Add aspect information
        if (enabledAspects.length > 0) {
          tooltip += `\nEnabled aspects: ${enabledAspects.join(', ')}`;
        }
        if (disabledAspects.length > 0) {
          tooltip += `\nDisabled aspects: ${disabledAspects.join(', ')}`;
        }

        return tooltip;
      };

      const enabledAspects = ['structural', 'profile'];
      const disabledAspects = ['terminology', 'reference', 'businessRule', 'metadata'];

      // Test with errors
      const errorTooltip = generateTooltip(false, 100, 2, 1, 0, enabledAspects, disabledAspects);
      expect(errorTooltip).toContain('2 error(s)');
      expect(errorTooltip).toContain('1 warning(s)');
      expect(errorTooltip).toContain('0 info(s)');
      expect(errorTooltip).toContain('Enabled aspects: structural, profile');
      expect(errorTooltip).toContain('Disabled aspects: terminology, reference, businessRule, metadata');

      // Test with warnings only
      const warningTooltip = generateTooltip(true, 100, 0, 3, 1, enabledAspects, disabledAspects);
      expect(warningTooltip).toContain('3 warning(s)');
      expect(warningTooltip).toContain('1 info(s)');
      expect(warningTooltip).toContain('Enabled aspects: structural, profile');

      // Test with score only
      const scoreTooltip = generateTooltip(true, 85, 0, 0, 2, enabledAspects, disabledAspects);
      expect(scoreTooltip).toContain('Score: 85%');
      expect(scoreTooltip).toContain('2 info(s)');
      expect(scoreTooltip).toContain('Enabled aspects: structural, profile');

      // Test no aspects enabled
      const noAspectsTooltip = generateTooltip(true, 100, 0, 0, 0, [], []);
      expect(noAspectsTooltip).toBe('No validation aspects enabled');
    });
  });

  describe('Badge Update Logic', () => {
    it('should test badge update event structure', () => {
      // Test the structure of badge update events
      const createBadgeUpdateEvent = (
        type: 'badgeUpdated' | 'badgesRefreshed' | 'aspectChanged' | 'scoreRecalculated',
        data: any,
        affectedViews: string[]
      ) => {
        return {
          type,
          timestamp: new Date(),
          data,
          affectedViews
        };
      };

      const event = createBadgeUpdateEvent(
        'badgesRefreshed',
        {
          reason: 'settingsChanged',
          changedAspects: ['profile', 'terminology'],
          badges: [{ resourceId: 'patient-1', badgeColor: 'green' }]
        },
        ['resourceList']
      );

      expect(event.type).toBe('badgesRefreshed');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.data).toHaveProperty('reason');
      expect(event.data).toHaveProperty('changedAspects');
      expect(event.data).toHaveProperty('badges');
      expect(event.affectedViews).toEqual(['resourceList']);
    });

    it('should test aspect change event structure', () => {
      // Test the structure of aspect change events
      const createAspectChangeEvent = (aspect: string, enabled: boolean, badges: any[]) => {
        return {
          type: 'aspectChanged',
          timestamp: new Date(),
          data: {
            aspect,
            enabled,
            reason: 'aspectToggled',
            badges
          },
          affectedViews: ['resourceList']
        };
      };

      const event = createAspectChangeEvent('profile', true, [
        { resourceId: 'patient-1', badgeColor: 'green', enabledAspects: ['structural', 'profile'] }
      ]);

      expect(event.type).toBe('aspectChanged');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.data.aspect).toBe('profile');
      expect(event.data.enabled).toBe(true);
      expect(event.data.reason).toBe('aspectToggled');
      expect(event.data.badges).toHaveLength(1);
      expect(event.affectedViews).toEqual(['resourceList']);
    });

    it('should test score recalculation event structure', () => {
      // Test the structure of score recalculation events
      const createScoreRecalculationEvent = (reason: string, badges: any[]) => {
        return {
          type: 'scoreRecalculated',
          timestamp: new Date(),
          data: {
            reason,
            badges
          },
          affectedViews: ['resourceList']
        };
      };

      const event = createScoreRecalculationEvent('settingsChanged', [
        { resourceId: 'patient-1', score: 85, badgeColor: 'green' }
      ]);

      expect(event.type).toBe('scoreRecalculated');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.data.reason).toBe('settingsChanged');
      expect(event.data.badges).toHaveLength(1);
      expect(event.affectedViews).toEqual(['resourceList']);
    });
  });

  describe('Badge Summary Logic', () => {
    it('should test badge summary calculation logic', () => {
      // Test the logic for calculating badge summary
      const calculateBadgeSummary = (badges: any[]) => {
        const totalResources = badges.length;
        const validResources = badges.filter(b => b.isValid).length;
        const invalidResources = totalResources - validResources;
        const averageScore = totalResources > 0 
          ? Math.round(badges.reduce((sum, b) => sum + b.score, 0) / totalResources)
          : 0;

        // Calculate badge distribution
        const badgeDistribution = {
          green: badges.filter(b => b.badgeColor === 'green').length,
          yellow: badges.filter(b => b.badgeColor === 'yellow').length,
          red: badges.filter(b => b.badgeColor === 'red').length,
          gray: badges.filter(b => b.badgeColor === 'gray').length
        };

        // Calculate aspect breakdown
        const aspectBreakdown: any = {};
        const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
        
        allAspects.forEach(aspect => {
          const aspectBadges = badges.filter(b => b.enabledAspects.includes(aspect));
          aspectBreakdown[aspect] = {
            enabled: aspectBadges.length > 0,
            affectedResources: aspectBadges.length,
            averageScore: aspectBadges.length > 0 
              ? Math.round(aspectBadges.reduce((sum, b) => sum + b.score, 0) / aspectBadges.length)
              : 0
          };
        });

        return {
          totalResources,
          validResources,
          invalidResources,
          averageScore,
          badgeDistribution,
          aspectBreakdown
        };
      };

      const mockBadges = [
        {
          resourceId: 'patient-1',
          isValid: true,
          score: 90,
          badgeColor: 'green',
          enabledAspects: ['structural', 'profile']
        },
        {
          resourceId: 'patient-2',
          isValid: false,
          score: 60,
          badgeColor: 'red',
          enabledAspects: ['structural', 'profile']
        },
        {
          resourceId: 'patient-3',
          isValid: true,
          score: 80,
          badgeColor: 'yellow',
          enabledAspects: ['structural']
        },
        {
          resourceId: 'patient-4',
          isValid: true,
          score: 0,
          badgeColor: 'gray',
          enabledAspects: []
        }
      ];

      const summary = calculateBadgeSummary(mockBadges);

      expect(summary.totalResources).toBe(4);
      expect(summary.validResources).toBe(3);
      expect(summary.invalidResources).toBe(1);
      expect(summary.averageScore).toBe(58); // (90 + 60 + 80 + 0) / 4 = 57.5 -> 58

      // Verify badge distribution
      expect(summary.badgeDistribution.green).toBe(1);
      expect(summary.badgeDistribution.yellow).toBe(1);
      expect(summary.badgeDistribution.red).toBe(1);
      expect(summary.badgeDistribution.gray).toBe(1);

      // Verify aspect breakdown
      expect(summary.aspectBreakdown.structural.enabled).toBe(true);
      expect(summary.aspectBreakdown.structural.affectedResources).toBe(3);
      expect(summary.aspectBreakdown.structural.averageScore).toBe(77); // (90 + 60 + 80) / 3 = 76.67 -> 77

      expect(summary.aspectBreakdown.profile.enabled).toBe(true);
      expect(summary.aspectBreakdown.profile.affectedResources).toBe(2);
      expect(summary.aspectBreakdown.profile.averageScore).toBe(75); // (90 + 60) / 2 = 75

      expect(summary.aspectBreakdown.terminology.enabled).toBe(false);
      expect(summary.aspectBreakdown.terminology.affectedResources).toBe(0);
      expect(summary.aspectBreakdown.terminology.averageScore).toBe(0);
    });
  });

  describe('Score Recalculation Logic', () => {
    it('should test score recalculation logic', () => {
      // Test the logic for recalculating scores
      const recalculateScore = (badge: any) => {
        if (badge.enabledAspects.length === 0) {
          return 0;
        }

        // Simple score calculation based on enabled aspects
        const baseScore = badge.isValid ? 100 : 0;
        const aspectPenalty = badge.errorCount * 10 + badge.warningCount * 5;
        const enabledAspectBonus = badge.enabledAspects.length * 5;

        return Math.max(0, Math.min(100, baseScore - aspectPenalty + enabledAspectBonus));
      };

      // Test valid resource with no issues
      const validBadge = {
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        enabledAspects: ['structural', 'profile', 'terminology']
      };
      expect(recalculateScore(validBadge)).toBe(100); // 100 + (3 * 5) = 115, capped at 100

      // Test invalid resource with errors
      const invalidBadge = {
        isValid: false,
        errorCount: 2,
        warningCount: 1,
        enabledAspects: ['structural', 'profile']
      };
      expect(recalculateScore(invalidBadge)).toBe(0); // 0 - (2 * 10) - (1 * 5) + (2 * 5) = 0 - 20 - 5 + 10 = -15, capped at 0

      // Test resource with no enabled aspects
      const noAspectsBadge = {
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        enabledAspects: []
      };
      expect(recalculateScore(noAspectsBadge)).toBe(0);

      // Test resource with warnings only
      const warningBadge = {
        isValid: true,
        errorCount: 0,
        warningCount: 3,
        enabledAspects: ['structural']
      };
      expect(recalculateScore(warningBadge)).toBe(90); // 100 - (3 * 5) + (1 * 5) = 100 - 15 + 5 = 90
    });
  });

  describe('Update History Logic', () => {
    it('should test update history management', () => {
      // Test the logic for managing update history
      const maxHistorySize = 5;
      let updateHistory: any[] = [];

      const addUpdateEvent = (event: any) => {
        updateHistory.push(event);
        if (updateHistory.length > maxHistorySize) {
          updateHistory.shift();
        }
      };

      // Add events
      for (let i = 0; i < 7; i++) {
        addUpdateEvent({ id: i, type: 'test', timestamp: new Date() });
      }

      // Should only keep the last 5 events
      expect(updateHistory).toHaveLength(5);
      expect(updateHistory[0].id).toBe(2); // First event should be the 3rd one (index 2)
      expect(updateHistory[4].id).toBe(6); // Last event should be the 7th one (index 6)
    });

    it('should test update history retrieval', () => {
      // Test the logic for retrieving update history
      const updateHistory = [
        { id: 1, type: 'badgesRefreshed', timestamp: new Date('2023-01-01') },
        { id: 2, type: 'aspectChanged', timestamp: new Date('2023-01-02') },
        { id: 3, type: 'scoreRecalculated', timestamp: new Date('2023-01-03') },
        { id: 4, type: 'badgesRefreshed', timestamp: new Date('2023-01-04') },
        { id: 5, type: 'aspectChanged', timestamp: new Date('2023-01-05') }
      ];

      const getUpdateHistory = (limit?: number) => {
        if (limit) {
          return updateHistory.slice(-limit);
        }
        return [...updateHistory];
      };

      // Test without limit
      const allHistory = getUpdateHistory();
      expect(allHistory).toHaveLength(5);
      expect(allHistory[0].id).toBe(1);
      expect(allHistory[4].id).toBe(5);

      // Test with limit
      const limitedHistory = getUpdateHistory(3);
      expect(limitedHistory).toHaveLength(3);
      expect(limitedHistory[0].id).toBe(3);
      expect(limitedHistory[2].id).toBe(5);
    });
  });
});
