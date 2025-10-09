/**
 * Validation Score Calculation Service
 * 
 * This service provides dynamic score calculation based on enabled validation aspects.
 * It calculates scores for individual resources, summaries, and aspect breakdowns.
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings';
import type { ValidationSettings } from '@shared/validation-settings';
import type { ValidationResult, ValidationAspectResult } from '../types/validation-types';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

export interface ValidationScore {
  overall: number;
  aspectScores: Record<string, number>;
  weightedScore: number;
  confidence: number;
}

export interface ValidationScoreBreakdown {
  totalAspects: number;
  validAspects: number;
  invalidAspects: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  aspectDetails: Record<string, {
    score: number;
    isValid: boolean;
    issueCount: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  }>;
}

export interface ValidationScoreSummary {
  averageScore: number;
  medianScore: number;
  scoreDistribution: {
    excellent: number; // 90-100
    good: number;      // 70-89
    fair: number;      // 50-69
    poor: number;      // 0-49
  };
  totalResources: number;
  validResources: number;
  invalidResources: number;
}

export class ValidationScoreCalculationService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private currentSettings: ValidationSettings | null = null;
  private isInitialized = false;

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
    this.setupSettingsListeners();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load initial settings
      await this.loadCurrentSettings();
      this.isInitialized = true;
      console.log('[ValidationScoreCalculation] Service initialized');
    } catch (error) {
      console.error('[ValidationScoreCalculation] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up listeners for settings changes
   */
  private setupSettingsListeners(): void {
    this.settingsService.on('settingsChanged', (event) => {
      console.log('[ValidationScoreCalculation] Settings changed, updating score calculation');
      this.loadCurrentSettings().catch(error => {
        console.error('[ValidationScoreCalculation] Failed to reload settings:', error);
      });
    });

    this.settingsService.on('settingsReset', () => {
      console.log('[ValidationScoreCalculation] Settings reset, updating score calculation');
      this.loadCurrentSettings().catch(error => {
        console.error('[ValidationScoreCalculation] Failed to reload settings:', error);
      });
    });
  }

  /**
   * Load current settings
   */
  private async loadCurrentSettings(): Promise<void> {
    try {
      this.currentSettings = await this.settingsService.getSettings();
      this.emit('settingsUpdated', this.currentSettings);
    } catch (error) {
      console.error('[ValidationScoreCalculation] Failed to load settings:', error);
      this.currentSettings = null;
    }
  }

  /**
   * Get enabled aspects from current settings
   */
  private getEnabledAspects(): Set<string> {
    const enabledAspects = new Set<string>();

    if (this.currentSettings) {
      ALL_VALIDATION_ASPECTS.forEach(aspect => {
        const aspectConfig = (this.currentSettings as any)[aspect];
        if (aspectConfig && typeof aspectConfig === 'object' && aspectConfig.enabled === true) {
          enabledAspects.add(aspect);
        }
      });
    } else {
      // If no settings, enable all aspects (default behavior)
      ALL_VALIDATION_ASPECTS.forEach(aspect => {
        enabledAspects.add(aspect);
      });
    }

    return enabledAspects;
  }

  /**
   * Calculate validation score for a single resource
   */
  calculateResourceScore(result: ValidationResult): ValidationScore {
    const enabledAspects = this.getEnabledAspects();

    // Filter aspects and issues based on enabled aspects
    const filteredAspects = result.aspects.filter(aspect => 
      enabledAspects.has(aspect.aspect)
    );
    const filteredIssues = result.issues.filter(issue => 
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

    // Calculate weighted score (aspects with more issues get lower weight)
    let weightedScore = 0;
    let totalWeight = 0;

    filteredAspects.forEach(aspect => {
      const issueCount = aspect.issues.length;
      const weight = Math.max(1, 10 - issueCount); // Higher weight for fewer issues
      const aspectScore = aspect.isValid ? 100 : 0;
      
      weightedScore += aspectScore * weight;
      totalWeight += weight;
    });

    const finalWeightedScore = totalWeight > 0 
      ? Math.round(weightedScore / totalWeight) 
      : 100;

    // Calculate confidence based on aspect coverage and issue severity
    const errorCount = filteredIssues.filter(issue => issue.severity === 'error').length;
    const warningCount = filteredIssues.filter(issue => issue.severity === 'warning').length;
    const informationCount = filteredIssues.filter(issue => issue.severity === 'info').length;

    const confidence = Math.max(0, 100 - (errorCount * 20) - (warningCount * 10) - (informationCount * 5));

    return {
      overall,
      aspectScores,
      weightedScore: finalWeightedScore,
      confidence
    };
  }

  /**
   * Calculate score breakdown for a single resource
   */
  calculateScoreBreakdown(result: ValidationResult): ValidationScoreBreakdown {
    const enabledAspects = this.getEnabledAspects();

    // Filter aspects and issues based on enabled aspects
    const filteredAspects = result.aspects.filter(aspect => 
      enabledAspects.has(aspect.aspect)
    );
    const filteredIssues = result.issues.filter(issue => 
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

    return {
      totalAspects,
      validAspects,
      invalidAspects,
      errorCount,
      warningCount,
      informationCount,
      aspectDetails
    };
  }

  /**
   * Calculate score summary for multiple resources
   */
  calculateScoreSummary(results: ValidationResult[]): ValidationScoreSummary {
    if (results.length === 0) {
      return {
        averageScore: 100,
        medianScore: 100,
        scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        totalResources: 0,
        validResources: 0,
        invalidResources: 0
      };
    }

    // Calculate scores for all resources
    const scores = results.map(result => this.calculateResourceScore(result));
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
    const validResources = results.filter(result => {
      const score = this.calculateResourceScore(result);
      return score.overall >= 70; // Consider 70+ as valid
    }).length;

    const invalidResources = results.length - validResources;

    return {
      averageScore,
      medianScore,
      scoreDistribution,
      totalResources: results.length,
      validResources,
      invalidResources
    };
  }

  /**
   * Calculate aspect-specific scores across multiple resources
   */
  calculateAspectScores(results: ValidationResult[]): Record<string, {
    averageScore: number;
    totalResources: number;
    validResources: number;
    invalidResources: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  }> {
    const enabledAspects = this.getEnabledAspects();
    const aspectStats: Record<string, any> = {};

    // Initialize aspect stats
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
    results.forEach(result => {
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

    return finalStats;
  }

  /**
   * Get current settings
   */
  getCurrentSettings(): ValidationSettings | null {
    return this.currentSettings;
  }

  /**
   * Check if an aspect is enabled
   */
  isAspectEnabled(aspect: string): boolean {
    return this.getEnabledAspects().has(aspect);
  }

  /**
   * Get enabled aspects
   */
  getEnabledAspects(): Set<string> {
    return this.getEnabledAspects();
  }
}

// Singleton instance
let validationScoreCalculationServiceInstance: ValidationScoreCalculationService | null = null;

export function getValidationScoreCalculationService(): ValidationScoreCalculationService {
  if (!validationScoreCalculationServiceInstance) {
    validationScoreCalculationServiceInstance = new ValidationScoreCalculationService();
  }
  return validationScoreCalculationServiceInstance;
}
