/**
 * Validation Completeness Service
 * 
 * This service calculates and manages validation completeness indicators including
 * coverage metrics, missing validation areas, and completeness scores.
 */

import { EventEmitter } from 'events';
import { storage } from '../../storage';
import type { 
  ValidationCompletenessMetrics,
  ValidationCompletenessFactors,
  ValidationCoverageMetrics,
  MissingValidationArea,
  ValidationGap,
  ValidationCompletenessAction,
  ValidationResultWithCompleteness
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
    fieldsValidated?: string[];
    fieldsSkipped?: string[];
    fieldsMissing?: string[];
  }>;
  validatedAt: Date;
  settingsUsed: any;
  resourceData: any;
}

interface CompletenessCalculationContext {
  result: ValidationResultData;
  settings: any;
  resourceProfile?: any;
  availableValidationRules: string[];
}

interface CompletenessScoringConfig {
  /** Weights for different completeness factors */
  factorWeights: {
    aspectCompleteness: number;
    fieldCoverage: number;
    ruleCoverage: number;
    profileCompliance: number;
    terminologyCoverage: number;
    referenceCoverage: number;
    businessRuleCoverage: number;
    metadataCoverage: number;
  };
  
  /** Completeness thresholds */
  thresholds: {
    incomplete: number;      // 0-40
    partial: number;         // 41-60
    mostlyComplete: number;  // 61-80
    complete: number;        // 81-95
    fullyComplete: number;   // 96-100
  };
  
  /** Minimum coverage requirements */
  minimumCoverage: {
    aspectCoverage: number;
    fieldCoverage: number;
    ruleCoverage: number;
  };
  
  /** Completeness calculation parameters */
  parameters: {
    missingAspectPenalty: number;
    missingFieldPenalty: number;
    missingRulePenalty: number;
    profileMismatchPenalty: number;
  };
}

// ============================================================================
// Validation Completeness Service
// ============================================================================

export class ValidationCompletenessService extends EventEmitter {
  private config: CompletenessScoringConfig;
  private completenessHistory: Map<string, number[]> = new Map();

  constructor(config: Partial<CompletenessScoringConfig> = {}) {
    super();
    
    this.config = {
      factorWeights: {
        aspectCompleteness: 0.25,
        fieldCoverage: 0.2,
        ruleCoverage: 0.15,
        profileCompliance: 0.15,
        terminologyCoverage: 0.1,
        referenceCoverage: 0.1,
        businessRuleCoverage: 0.05,
        metadataCoverage: 0.05
      },
      thresholds: {
        incomplete: 40,
        partial: 60,
        mostlyComplete: 80,
        complete: 95,
        fullyComplete: 100
      },
      minimumCoverage: {
        aspectCoverage: 80,
        fieldCoverage: 70,
        ruleCoverage: 60
      },
      parameters: {
        missingAspectPenalty: 20,
        missingFieldPenalty: 10,
        missingRulePenalty: 15,
        profileMismatchPenalty: 25
      },
      ...config
    };
  }

  // ========================================================================
  // Main Completeness Calculation Methods
  // ========================================================================

  /**
   * Calculate completeness metrics for a validation result
   */
  async calculateCompletenessMetrics(
    result: ValidationResultData,
    settings: any = {},
    resourceProfile?: any,
    availableValidationRules: string[] = []
  ): Promise<ValidationCompletenessMetrics> {
    try {
      const context: CompletenessCalculationContext = {
        result,
        settings,
        resourceProfile,
        availableValidationRules
      };

      // Calculate individual completeness factors
      const completenessFactors = this.calculateCompletenessFactors(context);
      
      // Calculate coverage metrics
      const coverageMetrics = this.calculateCoverageMetrics(context);
      
      // Identify missing validation areas
      const missingValidationAreas = this.identifyMissingValidationAreas(context);
      
      // Identify validation gaps
      const validationGaps = this.identifyValidationGaps(context);
      
      // Calculate overall completeness score
      const completenessScore = this.calculateOverallCompletenessScore(completenessFactors);
      
      // Determine completeness level
      const completenessLevel = this.determineCompletenessLevel(completenessScore);
      
      // Calculate completeness trend
      const completenessTrend = this.calculateCompletenessTrend(result.resourceType, completenessScore);
      
      // Generate explanation
      const explanation = this.generateCompletenessExplanation(
        completenessScore,
        completenessLevel,
        completenessFactors,
        missingValidationAreas,
        validationGaps
      );
      
      // Generate recommendations
      const recommendations = this.generateCompletenessRecommendations(
        completenessScore,
        completenessLevel,
        missingValidationAreas,
        validationGaps,
        completenessFactors
      );

      // Estimate effort to achieve full completeness
      const estimatedEffort = this.estimateCompletenessEffort(missingValidationAreas, validationGaps);

      const completenessMetrics: ValidationCompletenessMetrics = {
        completenessScore,
        completenessLevel,
        completenessFactors,
        coverageMetrics,
        missingValidationAreas,
        validationGaps,
        completenessTrend,
        explanation,
        recommendations,
        estimatedEffort
      };

      // Store completeness score for trend analysis
      this.storeCompletenessScore(result.resourceType, completenessScore);

      this.emit('completenessCalculated', { result, completenessMetrics });
      return completenessMetrics;

    } catch (error) {
      this.emit('completenessCalculationError', { 
        result, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Enhance validation result with completeness indicators
   */
  async enhanceValidationResultWithCompleteness(
    result: ValidationResultData,
    settings: any = {},
    resourceProfile?: any,
    availableValidationRules: string[] = []
  ): Promise<ValidationResultWithCompleteness> {
    try {
      const completeness = await this.calculateCompletenessMetrics(
        result,
        settings,
        resourceProfile,
        availableValidationRules
      );

      // Determine if completeness is sufficient
      const completenessSufficient = this.isCompletenessSufficient(completeness);

      // Generate recommended actions
      const recommendedActions = this.generateRecommendedActions(completeness, result);

      const enhancedResult: ValidationResultWithCompleteness = {
        validationResult: result,
        completeness,
        completenessSufficient,
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
  // Completeness Factor Calculations
  // ========================================================================

  /**
   * Calculate individual completeness factors
   */
  private calculateCompletenessFactors(context: CompletenessCalculationContext): ValidationCompletenessFactors {
    const { result, settings, resourceProfile } = context;

    return {
      aspectCompleteness: this.calculateAspectCompleteness(result, settings),
      fieldCoverage: this.calculateFieldCoverage(result, resourceProfile),
      ruleCoverage: this.calculateRuleCoverage(result, context.availableValidationRules),
      profileCompliance: this.calculateProfileCompliance(result, resourceProfile),
      terminologyCoverage: this.calculateTerminologyCoverage(result),
      referenceCoverage: this.calculateReferenceCoverage(result),
      businessRuleCoverage: this.calculateBusinessRuleCoverage(result),
      metadataCoverage: this.calculateMetadataCoverage(result)
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
    
    // Apply penalty for missing aspects
    const missingAspects = enabledAspects.filter(a => !validatedAspects.includes(a));
    const penalty = missingAspects.length * this.config.parameters.missingAspectPenalty;
    
    return Math.min(100, Math.max(0, completeness - penalty));
  }

  /**
   * Calculate field coverage factor
   */
  private calculateFieldCoverage(result: ValidationResultData, resourceProfile?: any): number {
    let totalFields = 0;
    let validatedFields = 0;
    let skippedFields = 0;
    let missingFields = 0;

    // Analyze field coverage from aspect breakdown
    Object.values(result.aspectBreakdown).forEach(aspect => {
      if (aspect.fieldsValidated) {
        totalFields += aspect.fieldsValidated.length;
        validatedFields += aspect.fieldsValidated.length;
      }
      if (aspect.fieldsSkipped) {
        totalFields += aspect.fieldsSkipped.length;
        skippedFields += aspect.fieldsSkipped.length;
      }
      if (aspect.fieldsMissing) {
        totalFields += aspect.fieldsMissing.length;
        missingFields += aspect.fieldsMissing.length;
      }
    });

    if (totalFields === 0) {
      return 75; // Default coverage when field data is not available
    }

    const coverage = (validatedFields / totalFields) * 100;
    const penalty = (missingFields / totalFields) * this.config.parameters.missingFieldPenalty;
    
    return Math.min(100, Math.max(0, coverage - penalty));
  }

  /**
   * Calculate rule coverage factor
   */
  private calculateRuleCoverage(result: ValidationResultData, availableValidationRules: string[]): number {
    if (availableValidationRules.length === 0) {
      return 80; // Default coverage when rule data is not available
    }

    // Count rules that were applied during validation
    const appliedRules = new Set<string>();
    Object.values(result.aspectBreakdown).forEach(aspect => {
      if (aspect.issues) {
        aspect.issues.forEach((issue: any) => {
          if (issue.ruleId) {
            appliedRules.add(issue.ruleId);
          }
        });
      }
    });

    const coverage = (appliedRules.size / availableValidationRules.length) * 100;
    const missingRules = availableValidationRules.length - appliedRules.size;
    const penalty = (missingRules / availableValidationRules.length) * this.config.parameters.missingRulePenalty;
    
    return Math.min(100, Math.max(0, coverage - penalty));
  }

  /**
   * Calculate profile compliance factor
   */
  private calculateProfileCompliance(result: ValidationResultData, resourceProfile?: any): number {
    if (!resourceProfile) {
      return 70; // Default compliance when profile is not available
    }

    let compliance = 90; // Base compliance

    // Check for profile validation issues
    const profileIssues = result.aspectBreakdown.profile?.issues || [];
    if (profileIssues.length > 0) {
      compliance -= Math.min(30, profileIssues.length * 5);
    }

    // Check for profile mismatches
    if (result.aspectBreakdown.profile?.passed === false) {
      compliance -= this.config.parameters.profileMismatchPenalty;
    }

    return Math.min(100, Math.max(0, compliance));
  }

  /**
   * Calculate terminology coverage factor
   */
  private calculateTerminologyCoverage(result: ValidationResultData): number {
    const terminologyAspect = result.aspectBreakdown.terminology;
    if (!terminologyAspect) {
      return 60; // Lower coverage when terminology validation is not available
    }

    let coverage = terminologyAspect.passed ? 90 : 70;
    
    // Reduce coverage based on terminology issues
    const terminologyIssues = terminologyAspect.issues || [];
    if (terminologyIssues.length > 0) {
      coverage -= Math.min(20, terminologyIssues.length * 3);
    }

    return Math.min(100, Math.max(0, coverage));
  }

  /**
   * Calculate reference coverage factor
   */
  private calculateReferenceCoverage(result: ValidationResultData): number {
    const referenceAspect = result.aspectBreakdown.reference;
    if (!referenceAspect) {
      return 60; // Lower coverage when reference validation is not available
    }

    let coverage = referenceAspect.passed ? 90 : 70;
    
    // Reduce coverage based on reference issues
    const referenceIssues = referenceAspect.issues || [];
    if (referenceIssues.length > 0) {
      coverage -= Math.min(20, referenceIssues.length * 3);
    }

    return Math.min(100, Math.max(0, coverage));
  }

  /**
   * Calculate business rule coverage factor
   */
  private calculateBusinessRuleCoverage(result: ValidationResultData): number {
    const businessRuleAspect = result.aspectBreakdown.businessRule;
    if (!businessRuleAspect) {
      return 60; // Lower coverage when business rule validation is not available
    }

    let coverage = businessRuleAspect.passed ? 90 : 70;
    
    // Reduce coverage based on business rule issues
    const businessRuleIssues = businessRuleAspect.issues || [];
    if (businessRuleIssues.length > 0) {
      coverage -= Math.min(20, businessRuleIssues.length * 3);
    }

    return Math.min(100, Math.max(0, coverage));
  }

  /**
   * Calculate metadata coverage factor
   */
  private calculateMetadataCoverage(result: ValidationResultData): number {
    const metadataAspect = result.aspectBreakdown.metadata;
    if (!metadataAspect) {
      return 60; // Lower coverage when metadata validation is not available
    }

    let coverage = metadataAspect.passed ? 90 : 70;
    
    // Reduce coverage based on metadata issues
    const metadataIssues = metadataAspect.issues || [];
    if (metadataIssues.length > 0) {
      coverage -= Math.min(20, metadataIssues.length * 3);
    }

    return Math.min(100, Math.max(0, coverage));
  }

  /**
   * Calculate coverage metrics
   */
  private calculateCoverageMetrics(context: CompletenessCalculationContext): ValidationCoverageMetrics {
    const { result, resourceProfile } = context;
    
    // Calculate aspect coverage
    const aspectCoverage: Record<string, any> = {};
    Object.entries(result.aspectBreakdown).forEach(([aspect, data]) => {
      const totalFields = (data.fieldsValidated?.length || 0) + 
                         (data.fieldsSkipped?.length || 0) + 
                         (data.fieldsMissing?.length || 0);
      
      aspectCoverage[aspect] = {
        coverage: totalFields > 0 ? ((data.fieldsValidated?.length || 0) / totalFields) * 100 : 100,
        totalFields,
        validatedFields: data.fieldsValidated?.length || 0,
        skippedFields: data.fieldsSkipped?.length || 0,
        missingFields: data.fieldsMissing || []
      };
    });

    // Calculate field type coverage (simplified)
    const fieldTypeCoverage: Record<string, any> = {
      required: {
        coverage: 85, // Would be calculated from actual field data
        totalFields: 10,
        validatedFields: 8,
        requiredFields: 10,
        optionalFields: 5
      },
      optional: {
        coverage: 70,
        totalFields: 5,
        validatedFields: 3,
        requiredFields: 0,
        optionalFields: 5
      }
    };

    // Calculate section coverage (simplified)
    const sectionCoverage: Record<string, any> = {
      core: {
        coverage: 90,
        totalSections: 5,
        validatedSections: 4,
        missingSections: ['extensions']
      },
      extensions: {
        coverage: 60,
        totalSections: 3,
        validatedSections: 1,
        missingSections: ['custom-extension-1', 'custom-extension-2']
      }
    };

    // Calculate overall coverage
    const allCoverages = Object.values(aspectCoverage).map((a: any) => a.coverage);
    const overallCoverage = allCoverages.length > 0 
      ? allCoverages.reduce((sum, coverage) => sum + coverage, 0) / allCoverages.length 
      : 0;

    return {
      overallCoverage,
      aspectCoverage,
      fieldTypeCoverage,
      sectionCoverage
    };
  }

  /**
   * Identify missing validation areas
   */
  private identifyMissingValidationAreas(context: CompletenessCalculationContext): MissingValidationArea[] {
    const { result, settings } = context;
    const missingAreas: MissingValidationArea[] = [];

    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const enabledAspects = allAspects.filter(aspect => settings[aspect]?.enabled !== false);
    const validatedAspects = Object.keys(result.aspectBreakdown);

    // Check for missing aspects
    enabledAspects.forEach(aspect => {
      if (!validatedAspects.includes(aspect)) {
        missingAreas.push({
          type: 'aspect',
          identifier: aspect,
          description: `${aspect} validation aspect is missing`,
          impact: 15,
          severity: 'high',
          reason: 'not_enabled',
          resolution: `Enable ${aspect} validation aspect in settings`,
          relatedAspect: aspect
        });
      }
    });

    // Check for missing fields in each aspect
    Object.entries(result.aspectBreakdown).forEach(([aspect, data]) => {
      if (data.fieldsMissing && data.fieldsMissing.length > 0) {
        data.fieldsMissing.forEach(field => {
          missingAreas.push({
            type: 'field',
            identifier: field,
            description: `Field ${field} is missing from ${aspect} validation`,
            impact: 5,
            severity: 'medium',
            reason: 'validation_failed',
            resolution: `Ensure ${field} is properly validated in ${aspect} aspect`,
            relatedAspect: aspect
          });
        });
      }
    });

    return missingAreas;
  }

  /**
   * Identify validation gaps
   */
  private identifyValidationGaps(context: CompletenessCalculationContext): ValidationGap[] {
    const { result } = context;
    const gaps: ValidationGap[] = [];

    // Check for incomplete validations
    Object.entries(result.aspectBreakdown).forEach(([aspect, data]) => {
      if (data.fieldsSkipped && data.fieldsSkipped.length > 0) {
        data.fieldsSkipped.forEach(field => {
          gaps.push({
            id: `gap-${aspect}-${field}`,
            type: 'incomplete_validation',
            description: `Field ${field} was skipped during ${aspect} validation`,
            path: [aspect, field],
            severity: 'medium',
            completenessImpact: 5,
            suggestedFix: `Complete validation for ${field} in ${aspect} aspect`,
            autoResolvable: true,
            relatedAspect: aspect
          });
        });
      }
    });

    // Check for profile mismatches
    if (result.aspectBreakdown.profile?.passed === false) {
      gaps.push({
        id: 'gap-profile-mismatch',
        type: 'profile_mismatch',
        description: 'Resource does not conform to expected profile',
        path: ['profile'],
        severity: 'high',
        completenessImpact: 20,
        suggestedFix: 'Update resource to match profile requirements or adjust profile',
        autoResolvable: false,
        relatedAspect: 'profile'
      });
    }

    return gaps;
  }

  /**
   * Calculate overall completeness score
   */
  private calculateOverallCompletenessScore(factors: ValidationCompletenessFactors): number {
    const weights = this.config.factorWeights;
    
    return Math.round(
      factors.aspectCompleteness * weights.aspectCompleteness +
      factors.fieldCoverage * weights.fieldCoverage +
      factors.ruleCoverage * weights.ruleCoverage +
      factors.profileCompliance * weights.profileCompliance +
      factors.terminologyCoverage * weights.terminologyCoverage +
      factors.referenceCoverage * weights.referenceCoverage +
      factors.businessRuleCoverage * weights.businessRuleCoverage +
      factors.metadataCoverage * weights.metadataCoverage
    );
  }

  /**
   * Determine completeness level based on score
   */
  private determineCompletenessLevel(score: number): 'incomplete' | 'partial' | 'mostly_complete' | 'complete' | 'fully_complete' {
    if (score <= this.config.thresholds.incomplete) return 'incomplete';
    if (score <= this.config.thresholds.partial) return 'partial';
    if (score <= this.config.thresholds.mostlyComplete) return 'mostly_complete';
    if (score <= this.config.thresholds.complete) return 'complete';
    return 'fully_complete';
  }

  /**
   * Calculate completeness trend
   */
  private calculateCompletenessTrend(resourceType: string, currentScore: number): 'improving' | 'stable' | 'declining' | 'unknown' {
    const history = this.completenessHistory.get(resourceType) || [];
    
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
   * Generate completeness explanation
   */
  private generateCompletenessExplanation(
    score: number,
    level: string,
    factors: ValidationCompletenessFactors,
    missingAreas: MissingValidationArea[],
    gaps: ValidationGap[]
  ): string {
    const explanations = [];

    explanations.push(`Completeness level: ${level} (${score}/100)`);

    // Add factor explanations
    if (factors.aspectCompleteness < 80) {
      explanations.push('Some validation aspects are missing or incomplete');
    }
    if (factors.fieldCoverage < 80) {
      explanations.push('Field coverage could be improved');
    }
    if (factors.ruleCoverage < 80) {
      explanations.push('Validation rule coverage is incomplete');
    }

    // Add gap explanations
    if (missingAreas.length > 0) {
      explanations.push(`${missingAreas.length} missing validation area(s) identified`);
    }
    if (gaps.length > 0) {
      explanations.push(`${gaps.length} validation gap(s) found`);
    }

    return explanations.join('. ');
  }

  /**
   * Generate completeness recommendations
   */
  private generateCompletenessRecommendations(
    score: number,
    level: string,
    missingAreas: MissingValidationArea[],
    gaps: ValidationGap[],
    factors: ValidationCompletenessFactors
  ): string[] {
    const recommendations = [];

    if (score < 70) {
      recommendations.push('Enable additional validation aspects to improve completeness');
    }

    if (factors.fieldCoverage < 80) {
      recommendations.push('Improve field coverage by validating more resource fields');
    }

    if (factors.ruleCoverage < 80) {
      recommendations.push('Add more validation rules to increase rule coverage');
    }

    if (missingAreas.some(area => area.type === 'aspect')) {
      recommendations.push('Enable missing validation aspects in settings');
    }

    if (gaps.some(gap => gap.type === 'incomplete_validation')) {
      recommendations.push('Complete partial validations for better coverage');
    }

    if (gaps.some(gap => gap.type === 'profile_mismatch')) {
      recommendations.push('Resolve profile compliance issues');
    }

    return recommendations;
  }

  /**
   * Estimate effort to achieve full completeness
   */
  private estimateCompletenessEffort(
    missingAreas: MissingValidationArea[],
    gaps: ValidationGap[]
  ): 'low' | 'medium' | 'high' | 'very_high' {
    let effortScore = 0;

    // Calculate effort based on missing areas
    missingAreas.forEach(area => {
      switch (area.severity) {
        case 'critical': effortScore += 4; break;
        case 'high': effortScore += 3; break;
        case 'medium': effortScore += 2; break;
        case 'low': effortScore += 1; break;
      }
    });

    // Calculate effort based on gaps
    gaps.forEach(gap => {
      switch (gap.severity) {
        case 'critical': effortScore += 3; break;
        case 'high': effortScore += 2; break;
        case 'medium': effortScore += 1; break;
        case 'low': effortScore += 0.5; break;
      }
    });

    if (effortScore >= 15) return 'very_high';
    if (effortScore >= 10) return 'high';
    if (effortScore >= 5) return 'medium';
    return 'low';
  }

  /**
   * Check if completeness is sufficient for the use case
   */
  private isCompletenessSufficient(completeness: ValidationCompletenessMetrics): boolean {
    return completeness.completenessLevel === 'complete' || completeness.completenessLevel === 'fully_complete';
  }

  /**
   * Generate recommended actions based on completeness
   */
  private generateRecommendedActions(
    completeness: ValidationCompletenessMetrics,
    result: ValidationResultData
  ): ValidationCompletenessAction[] {
    const actions: ValidationCompletenessAction[] = [];

    if (completeness.completenessLevel === 'incomplete' || completeness.completenessLevel === 'partial') {
      actions.push({
        type: 'enable_aspect',
        description: 'Enable additional validation aspects',
        priority: 'high',
        expectedCompletenessImprovement: 20,
        effort: 'low',
        automatable: true,
        implementationSteps: [
          'Review current validation settings',
          'Enable missing validation aspects',
          'Re-run validation'
        ]
      });
    }

    if (completeness.missingValidationAreas.some(area => area.type === 'field')) {
      actions.push({
        type: 'validate_field',
        description: 'Complete validation for missing fields',
        priority: 'medium',
        expectedCompletenessImprovement: 15,
        effort: 'medium',
        automatable: true,
        implementationSteps: [
          'Identify missing fields',
          'Update validation configuration',
          'Re-validate resource'
        ]
      });
    }

    if (completeness.validationGaps.some(gap => gap.type === 'profile_mismatch')) {
      actions.push({
        type: 'update_profile',
        description: 'Resolve profile compliance issues',
        priority: 'high',
        expectedCompletenessImprovement: 25,
        effort: 'high',
        automatable: false,
        implementationSteps: [
          'Review profile requirements',
          'Update resource structure',
          'Re-validate against profile'
        ]
      });
    }

    return actions;
  }

  /**
   * Store completeness score for trend analysis
   */
  private storeCompletenessScore(resourceType: string, score: number): void {
    if (!this.completenessHistory.has(resourceType)) {
      this.completenessHistory.set(resourceType, []);
    }

    const history = this.completenessHistory.get(resourceType)!;
    history.push(score);

    // Keep only last 20 scores
    if (history.length > 20) {
      history.shift();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CompletenessScoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): CompletenessScoringConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): { isHealthy: boolean; completenessHistorySize: number } {
    return {
      isHealthy: true,
      completenessHistorySize: this.completenessHistory.size
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let completenessServiceInstance: ValidationCompletenessService | null = null;

/**
 * Get the singleton instance of the validation completeness service
 */
export function getValidationCompletenessService(config?: Partial<CompletenessScoringConfig>): ValidationCompletenessService {
  if (!completenessServiceInstance) {
    completenessServiceInstance = new ValidationCompletenessService(config);
  }
  return completenessServiceInstance;
}
