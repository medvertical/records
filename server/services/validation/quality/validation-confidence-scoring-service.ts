/**
 * Validation Confidence Scoring Service
 * 
 * This service calculates confidence scores for validation results based on
 * various factors including completeness, data quality, consistency, and reliability.
 */

import { EventEmitter } from 'events';
import { storage } from '../../../storage';
import type { 
  ValidationConfidenceMetrics,
  ValidationConfidenceFactors,
  ValidationConfidenceIssue,
  ValidationConfidenceAction,
  ValidationResultWithConfidence
} from '@shared/types/validation';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ValidationResultData {
  id: string;
  resourceType: string;
  isValid: boolean;
  validationScore: number;
  errorCount: number;
  warningCount: number;
  aspectBreakdown: Record<string, {
    passed: boolean;
    issues: any[];
    duration: number;
  }>;
  validatedAt: Date;
  settingsUsed: any;
}

interface ConfidenceCalculationContext {
  result: ValidationResultData;
  historicalResults: ValidationResultData[];
  settings: any;
  externalDependencyStatus: {
    terminologyServers: boolean;
    profileServers: boolean;
    referenceServers: boolean;
  };
}

interface ConfidenceScoringConfig {
  /** Weights for different confidence factors */
  factorWeights: {
    aspectCompleteness: number;
    dataSourceQuality: number;
    resultConsistency: number;
    ruleCoverage: number;
    historicalAccuracy: number;
    engineReliability: number;
    resourceComplexity: number;
    externalDependencyReliability: number;
  };
  
  /** Confidence thresholds */
  thresholds: {
    veryLow: number;    // 0-20
    low: number;        // 21-40
    medium: number;     // 41-60
    high: number;       // 61-80
    veryHigh: number;   // 81-100
  };
  
  /** Minimum sample size for historical analysis */
  minHistoricalSampleSize: number;
  
  /** Confidence calculation parameters */
  parameters: {
    complexityPenalty: number;
    inconsistencyPenalty: number;
    missingDataPenalty: number;
    externalDependencyFailurePenalty: number;
  };
}

// ============================================================================
// Validation Confidence Scoring Service
// ============================================================================

export class ValidationConfidenceScoringService extends EventEmitter {
  private config: ConfidenceScoringConfig;
  private confidenceHistory: Map<string, number[]> = new Map();

  constructor(config: Partial<ConfidenceScoringConfig> = {}) {
    super();
    
    this.config = {
      factorWeights: {
        aspectCompleteness: 0.2,
        dataSourceQuality: 0.15,
        resultConsistency: 0.15,
        ruleCoverage: 0.15,
        historicalAccuracy: 0.15,
        engineReliability: 0.1,
        resourceComplexity: 0.05,
        externalDependencyReliability: 0.05
      },
      thresholds: {
        veryLow: 20,
        low: 40,
        medium: 60,
        high: 80,
        veryHigh: 100
      },
      minHistoricalSampleSize: 5,
      parameters: {
        complexityPenalty: 10,
        inconsistencyPenalty: 15,
        missingDataPenalty: 20,
        externalDependencyFailurePenalty: 25
      },
      ...config
    };
  }

  // ========================================================================
  // Main Confidence Scoring Methods
  // ========================================================================

  /**
   * Calculate confidence metrics for a validation result
   */
  async calculateConfidenceMetrics(
    result: ValidationResultData,
    historicalResults: ValidationResultData[] = [],
    settings: any = {},
    externalDependencyStatus: {
      terminologyServers: boolean;
      profileServers: boolean;
      referenceServers: boolean;
    } = { terminologyServers: true, profileServers: true, referenceServers: true }
  ): Promise<ValidationConfidenceMetrics> {
    try {
      const context: ConfidenceCalculationContext = {
        result,
        historicalResults,
        settings,
        externalDependencyStatus
      };

      // Calculate individual confidence factors
      const confidenceFactors = this.calculateConfidenceFactors(context);
      
      // Calculate overall confidence score
      const confidenceScore = this.calculateOverallConfidenceScore(confidenceFactors);
      
      // Determine confidence level
      const confidenceLevel = this.determineConfidenceLevel(confidenceScore);
      
      // Identify confidence issues
      const confidenceIssues = this.identifyConfidenceIssues(context);
      
      // Calculate validation certainty
      const validationCertainty = this.calculateValidationCertainty(context);
      
      // Determine confidence trend
      const confidenceTrend = this.calculateConfidenceTrend(result.resourceType, confidenceScore);
      
      // Generate explanation
      const explanation = this.generateConfidenceExplanation(
        confidenceScore,
        confidenceLevel,
        confidenceFactors,
        confidenceIssues
      );
      
      // Generate recommendations
      const recommendations = this.generateConfidenceRecommendations(
        confidenceScore,
        confidenceLevel,
        confidenceIssues,
        confidenceFactors
      );

      const confidenceMetrics: ValidationConfidenceMetrics = {
        confidenceScore,
        confidenceLevel,
        confidenceFactors,
        confidenceIssues,
        validationCertainty,
        confidenceTrend,
        explanation,
        recommendations
      };

      // Store confidence score for trend analysis
      this.storeConfidenceScore(result.resourceType, confidenceScore);

      this.emit('confidenceCalculated', { result, confidenceMetrics });
      return confidenceMetrics;

    } catch (error) {
      this.emit('confidenceCalculationError', { 
        result, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Enhance validation result with confidence scoring
   */
  async enhanceValidationResultWithConfidence(
    result: ValidationResultData,
    historicalResults: ValidationResultData[] = [],
    settings: any = {},
    externalDependencyStatus: {
      terminologyServers: boolean;
      profileServers: boolean;
      referenceServers: boolean;
    } = { terminologyServers: true, profileServers: true, referenceServers: true }
  ): Promise<ValidationResultWithConfidence> {
    try {
      const confidence = await this.calculateConfidenceMetrics(
        result,
        historicalResults,
        settings,
        externalDependencyStatus
      );

      // Determine if confidence is sufficient
      const confidenceSufficient = this.isConfidenceSufficient(confidence);

      // Generate recommended actions
      const recommendedActions = this.generateRecommendedActions(confidence, result);

      const enhancedResult: ValidationResultWithConfidence = {
        validationResult: result,
        confidence,
        confidenceSufficient,
        recommendedActions
      };

      this.emit('resultEnhanced', { enhancedResult });
      return enhancedResult;

    } catch (error) {
      this.emit('resultEnhancementError', { 
        result, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  // ========================================================================
  // Confidence Factor Calculations
  // ========================================================================

  /**
   * Calculate individual confidence factors
   */
  private calculateConfidenceFactors(context: ConfidenceCalculationContext): ValidationConfidenceFactors {
    const { result, historicalResults, settings, externalDependencyStatus } = context;

    return {
      aspectCompleteness: this.calculateAspectCompleteness(result, settings),
      dataSourceQuality: this.calculateDataSourceQuality(result, settings),
      resultConsistency: this.calculateResultConsistency(result, historicalResults),
      ruleCoverage: this.calculateRuleCoverage(result, settings),
      historicalAccuracy: this.calculateHistoricalAccuracy(result, historicalResults),
      engineReliability: this.calculateEngineReliability(result),
      resourceComplexity: this.calculateResourceComplexity(result),
      externalDependencyReliability: this.calculateExternalDependencyReliability(
        result,
        externalDependencyStatus
      )
    };
  }

  /**
   * Calculate aspect completeness factor
   */
  private calculateAspectCompleteness(result: ValidationResultData, settings: any): number {
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const enabledAspects = allAspects.filter(aspect => {
      return settings[aspect]?.enabled !== false;
    });

    const validatedAspects = Object.keys(result.aspectBreakdown);
    const completeness = (validatedAspects.length / enabledAspects.length) * 100;
    
    return Math.min(100, Math.max(0, completeness));
  }

  /**
   * Calculate data source quality factor
   */
  private calculateDataSourceQuality(result: ValidationResultData, settings: any): number {
    let qualityScore = 80; // Base quality score

    // Reduce quality based on validation issues
    const totalIssues = result.errorCount + result.warningCount;
    if (totalIssues > 0) {
      qualityScore -= Math.min(30, totalIssues * 2);
    }

    // Reduce quality if validation score is low
    if (result.validationScore < 70) {
      qualityScore -= 20;
    } else if (result.validationScore < 50) {
      qualityScore -= 40;
    }

    return Math.min(100, Math.max(0, qualityScore));
  }

  /**
   * Calculate result consistency factor
   */
  private calculateResultConsistency(
    result: ValidationResultData,
    historicalResults: ValidationResultData[]
  ): number {
    if (historicalResults.length < this.config.minHistoricalSampleSize) {
      return 70; // Default consistency when insufficient historical data
    }

    // Find similar resources (same type, similar validation score)
    const similarResults = historicalResults.filter(h => 
      h.resourceType === result.resourceType &&
      Math.abs(h.validationScore - result.validationScore) <= 10
    );

    if (similarResults.length === 0) {
      return 60; // Lower consistency for unique results
    }

    // Calculate consistency based on aspect breakdown similarity
    let consistencyScore = 100;
    const currentAspects = Object.keys(result.aspectBreakdown);
    
    similarResults.forEach(similar => {
      const similarAspects = Object.keys(similar.aspectBreakdown);
      const aspectOverlap = currentAspects.filter(a => similarAspects.includes(a)).length;
      const aspectConsistency = (aspectOverlap / Math.max(currentAspects.length, similarAspects.length)) * 100;
      consistencyScore = Math.min(consistencyScore, aspectConsistency);
    });

    return Math.max(0, consistencyScore - 10); // Small penalty for any inconsistency
  }

  /**
   * Calculate rule coverage factor
   */
  private calculateRuleCoverage(result: ValidationResultData, settings: any): number {
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const enabledAspects = allAspects.filter(aspect => settings[aspect]?.enabled !== false);
    const validatedAspects = Object.keys(result.aspectBreakdown);
    
    // Calculate coverage percentage
    const coverage = (validatedAspects.length / enabledAspects.length) * 100;
    
    // Apply penalty for missing aspects
    const missingAspects = enabledAspects.filter(a => !validatedAspects.includes(a));
    const penalty = missingAspects.length * 15;
    
    return Math.min(100, Math.max(0, coverage - penalty));
  }

  /**
   * Calculate historical accuracy factor
   */
  private calculateHistoricalAccuracy(
    result: ValidationResultData,
    historicalResults: ValidationResultData[]
  ): number {
    if (historicalResults.length < this.config.minHistoricalSampleSize) {
      return 75; // Default accuracy when insufficient historical data
    }

    // Calculate accuracy based on historical validation scores for similar resources
    const similarResults = historicalResults.filter(h => h.resourceType === result.resourceType);
    
    if (similarResults.length === 0) {
      return 70; // Default accuracy for new resource types
    }

    const averageHistoricalScore = similarResults.reduce((sum, h) => sum + h.validationScore, 0) / similarResults.length;
    const scoreVariance = similarResults.reduce((sum, h) => sum + Math.pow(h.validationScore - averageHistoricalScore, 2), 0) / similarResults.length;
    const standardDeviation = Math.sqrt(scoreVariance);
    
    // Higher accuracy for lower variance (more consistent results)
    const accuracyScore = Math.max(0, 100 - (standardDeviation * 2));
    
    return Math.min(100, accuracyScore);
  }

  /**
   * Calculate engine reliability factor
   */
  private calculateEngineReliability(result: ValidationResultData): number {
    let reliabilityScore = 90; // Base engine reliability

    // Reduce reliability based on validation duration (longer = less reliable)
    const totalDuration = Object.values(result.aspectBreakdown).reduce((sum, aspect) => sum + aspect.duration, 0);
    if (totalDuration > 30000) { // More than 30 seconds
      reliabilityScore -= 20;
    } else if (totalDuration > 10000) { // More than 10 seconds
      reliabilityScore -= 10;
    }

    // Reduce reliability if there were retries
    if (result.aspectBreakdown.retryAttemptCount > 0) {
      reliabilityScore -= 15;
    }

    return Math.min(100, Math.max(0, reliabilityScore));
  }

  /**
   * Calculate resource complexity factor
   */
  private calculateResourceComplexity(result: ValidationResultData): number {
    let complexityScore = 80; // Base complexity score

    // Reduce score for complex resources (more aspects, more issues)
    const aspectCount = Object.keys(result.aspectBreakdown).length;
    if (aspectCount > 4) {
      complexityScore -= 10;
    }

    const totalIssues = result.errorCount + result.warningCount;
    if (totalIssues > 5) {
      complexityScore -= 15;
    } else if (totalIssues > 2) {
      complexityScore -= 5;
    }

    return Math.min(100, Math.max(0, complexityScore));
  }

  /**
   * Calculate external dependency reliability factor
   */
  private calculateExternalDependencyReliability(
    result: ValidationResultData,
    externalDependencyStatus: {
      terminologyServers: boolean;
      profileServers: boolean;
      referenceServers: boolean;
    }
  ): number {
    let reliabilityScore = 100;

    // Reduce reliability based on failed external dependencies
    if (!externalDependencyStatus.terminologyServers) {
      reliabilityScore -= 30;
    }
    if (!externalDependencyStatus.profileServers) {
      reliabilityScore -= 25;
    }
    if (!externalDependencyStatus.referenceServers) {
      reliabilityScore -= 20;
    }

    return Math.min(100, Math.max(0, reliabilityScore));
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidenceScore(factors: ValidationConfidenceFactors): number {
    const weights = this.config.factorWeights;
    
    return Math.round(
      factors.aspectCompleteness * weights.aspectCompleteness +
      factors.dataSourceQuality * weights.dataSourceQuality +
      factors.resultConsistency * weights.resultConsistency +
      factors.ruleCoverage * weights.ruleCoverage +
      factors.historicalAccuracy * weights.historicalAccuracy +
      factors.engineReliability * weights.engineReliability +
      factors.resourceComplexity * weights.resourceComplexity +
      factors.externalDependencyReliability * weights.externalDependencyReliability
    );
  }

  /**
   * Determine confidence level based on score
   */
  private determineConfidenceLevel(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score <= this.config.thresholds.veryLow) return 'very_low';
    if (score <= this.config.thresholds.low) return 'low';
    if (score <= this.config.thresholds.medium) return 'medium';
    if (score <= this.config.thresholds.high) return 'high';
    return 'very_high';
  }

  /**
   * Identify confidence issues
   */
  private identifyConfidenceIssues(context: ConfidenceCalculationContext): ValidationConfidenceIssue[] {
    const issues: ValidationConfidenceIssue[] = [];
    const { result, settings, externalDependencyStatus } = context;

    // Check for missing validation aspects
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const enabledAspects = allAspects.filter(aspect => settings[aspect]?.enabled !== false);
    const validatedAspects = Object.keys(result.aspectBreakdown);
    const missingAspects = enabledAspects.filter(a => !validatedAspects.includes(a));

    if (missingAspects.length > 0) {
      issues.push({
        type: 'incomplete_validation',
        description: `Missing validation for aspects: ${missingAspects.join(', ')}`,
        confidenceImpact: missingAspects.length * 10,
        severity: missingAspects.length > 2 ? 'high' : 'medium',
        relatedAspect: missingAspects.join(', '),
        resolution: 'Enable missing validation aspects or investigate why they were skipped'
      });
    }

    // Check for external dependency failures
    const failedDependencies = [];
    if (!externalDependencyStatus.terminologyServers) failedDependencies.push('terminology servers');
    if (!externalDependencyStatus.profileServers) failedDependencies.push('profile servers');
    if (!externalDependencyStatus.referenceServers) failedDependencies.push('reference servers');

    if (failedDependencies.length > 0) {
      issues.push({
        type: 'external_dependency_failure',
        description: `External dependency failures: ${failedDependencies.join(', ')}`,
        confidenceImpact: failedDependencies.length * 15,
        severity: failedDependencies.length > 1 ? 'high' : 'medium',
        resolution: 'Check external service availability and connectivity'
      });
    }

    // Check for high validation scores with many issues (potential inconsistency)
    if (result.validationScore > 80 && (result.errorCount + result.warningCount) > 5) {
      issues.push({
        type: 'rule_ambiguity',
        description: 'High validation score despite multiple issues detected',
        confidenceImpact: 20,
        severity: 'medium',
        resolution: 'Review validation rules and scoring algorithm'
      });
    }

    // Check for historical inconsistency
    if (context.historicalResults.length >= this.config.minHistoricalSampleSize) {
      const similarResults = context.historicalResults.filter(h => 
        h.resourceType === result.resourceType &&
        Math.abs(h.validationScore - result.validationScore) <= 5
      );
      
      if (similarResults.length < context.historicalResults.length * 0.3) {
        issues.push({
          type: 'historical_inconsistency',
          description: 'Validation result differs significantly from historical patterns',
          confidenceImpact: 15,
          severity: 'medium',
          resolution: 'Investigate resource characteristics and validation settings'
        });
      }
    }

    return issues;
  }

  /**
   * Calculate validation certainty
   */
  private calculateValidationCertainty(context: ConfidenceCalculationContext): number {
    const { result } = context;
    let certainty = 90; // Base certainty

    // Reduce certainty for resources with many issues
    const totalIssues = result.errorCount + result.warningCount;
    if (totalIssues > 3) {
      certainty -= Math.min(30, totalIssues * 5);
    }

    // Reduce certainty for low validation scores
    if (result.validationScore < 60) {
      certainty -= 20;
    } else if (result.validationScore < 80) {
      certainty -= 10;
    }

    // Reduce certainty if any validation aspects failed
    const failedAspects = Object.values(result.aspectBreakdown).filter(a => !a.passed).length;
    if (failedAspects > 0) {
      certainty -= failedAspects * 10;
    }

    return Math.min(100, Math.max(0, certainty));
  }

  /**
   * Calculate confidence trend
   */
  private calculateConfidenceTrend(resourceType: string, currentScore: number): 'improving' | 'stable' | 'declining' | 'unknown' {
    const history = this.confidenceHistory.get(resourceType) || [];
    
    if (history.length < 3) {
      return 'unknown';
    }

    const recentScores = history.slice(-3);
    const trend = (recentScores[2] - recentScores[0]) / 2;

    if (trend > 5) return 'improving';
    if (trend < -5) return 'declining';
    return 'stable';
  }

  /**
   * Generate confidence explanation
   */
  private generateConfidenceExplanation(
    score: number,
    level: string,
    factors: ValidationConfidenceFactors,
    issues: ValidationConfidenceIssue[]
  ): string {
    const explanations = [];

    explanations.push(`Confidence level: ${level} (${score}/100)`);

    // Add factor explanations
    if (factors.aspectCompleteness < 80) {
      explanations.push('Validation completeness could be improved');
    }
    if (factors.dataSourceQuality < 80) {
      explanations.push('Data source quality is below optimal');
    }
    if (factors.resultConsistency < 70) {
      explanations.push('Results show some inconsistency');
    }
    if (factors.externalDependencyReliability < 90) {
      explanations.push('External dependencies have reliability issues');
    }

    // Add issue explanations
    if (issues.length > 0) {
      explanations.push(`${issues.length} confidence issue(s) identified`);
    }

    return explanations.join('. ');
  }

  /**
   * Generate confidence recommendations
   */
  private generateConfidenceRecommendations(
    score: number,
    level: string,
    issues: ValidationConfidenceIssue[],
    factors: ValidationConfidenceFactors
  ): string[] {
    const recommendations = [];

    if (score < 70) {
      recommendations.push('Consider manual review of validation results');
    }

    if (factors.aspectCompleteness < 80) {
      recommendations.push('Enable additional validation aspects');
    }

    if (factors.dataSourceQuality < 80) {
      recommendations.push('Improve data source quality and validation rules');
    }

    if (factors.externalDependencyReliability < 90) {
      recommendations.push('Check external service availability and connectivity');
    }

    if (issues.some(i => i.type === 'external_dependency_failure')) {
      recommendations.push('Resolve external dependency issues');
    }

    if (issues.some(i => i.type === 'incomplete_validation')) {
      recommendations.push('Complete missing validation aspects');
    }

    return recommendations;
  }

  /**
   * Check if confidence is sufficient for the use case
   */
  private isConfidenceSufficient(confidence: ValidationConfidenceMetrics): boolean {
    return confidence.confidenceLevel === 'high' || confidence.confidenceLevel === 'very_high';
  }

  /**
   * Generate recommended actions based on confidence
   */
  private generateRecommendedActions(
    confidence: ValidationConfidenceMetrics,
    result: ValidationResultData
  ): ValidationConfidenceAction[] {
    const actions: ValidationConfidenceAction[] = [];

    if (confidence.confidenceLevel === 'very_low' || confidence.confidenceLevel === 'low') {
      actions.push({
        type: 'review_manually',
        description: 'Manual review recommended due to low confidence',
        priority: 'high',
        expectedConfidenceImprovement: 20,
        effort: 'medium'
      });
    }

    if (confidence.confidenceIssues.some(i => i.type === 'external_dependency_failure')) {
      actions.push({
        type: 'investigate_further',
        description: 'Investigate external dependency failures',
        priority: 'high',
        expectedConfidenceImprovement: 15,
        effort: 'low'
      });
    }

    if (confidence.confidenceLevel === 'medium') {
      actions.push({
        type: 'seek_additional_validation',
        description: 'Consider additional validation sources',
        priority: 'medium',
        expectedConfidenceImprovement: 10,
        effort: 'high'
      });
    }

    if (confidence.confidenceLevel === 'high' || confidence.confidenceLevel === 'very_high') {
      actions.push({
        type: 'trust_result',
        description: 'Result can be trusted with high confidence',
        priority: 'low',
        expectedConfidenceImprovement: 0,
        effort: 'low'
      });
    }

    return actions;
  }

  /**
   * Store confidence score for trend analysis
   */
  private storeConfidenceScore(resourceType: string, score: number): void {
    if (!this.confidenceHistory.has(resourceType)) {
      this.confidenceHistory.set(resourceType, []);
    }

    const history = this.confidenceHistory.get(resourceType)!;
    history.push(score);

    // Keep only last 20 scores
    if (history.length > 20) {
      history.shift();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConfidenceScoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfidenceScoringConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): { isHealthy: boolean; confidenceHistorySize: number } {
    return {
      isHealthy: true,
      confidenceHistorySize: this.confidenceHistory.size
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let confidenceScoringServiceInstance: ValidationConfidenceScoringService | null = null;

/**
 * Get the singleton instance of the validation confidence scoring service
 */
export function getValidationConfidenceScoringService(config?: Partial<ConfidenceScoringConfig>): ValidationConfidenceScoringService {
  if (!confidenceScoringServiceInstance) {
    confidenceScoringServiceInstance = new ValidationConfidenceScoringService(config);
  }
  return confidenceScoringServiceInstance;
}
