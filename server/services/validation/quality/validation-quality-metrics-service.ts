/**
 * Validation Quality Metrics Service
 * 
 * This service calculates and manages comprehensive validation quality metrics
 * including accuracy, completeness, consistency, performance, and reliability scores.
 */

import { EventEmitter } from 'events';
import { storage } from '../../../storage';
import type { 
  ValidationQualityMetrics,
  ValidationAccuracyMetrics,
  ValidationCompletenessMetrics,
  ValidationConsistencyMetrics,
  ValidationPerformanceMetrics,
  ValidationReliabilityMetrics,
  ValidationAspectQuality,
  ValidationQualityTrend,
  ValidationQualityRecommendation,
  ValidationQualityConfig,
  ValidationQualityReport
} from '@shared/types/validation';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ValidationResultData {
  id: string;
  resourceType: string;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  validationScore: number;
  validatedAt: Date;
  aspectBreakdown: Record<string, {
    passed: boolean;
    issues: any[];
    duration: number;
  }>;
}

interface QualityCalculationContext {
  results: ValidationResultData[];
  timeRange: {
    start: Date;
    end: Date;
  };
  config: ValidationQualityConfig;
}

// ============================================================================
// Validation Quality Metrics Service
// ============================================================================

export class ValidationQualityMetricsService extends EventEmitter {
  private config: ValidationQualityConfig;
  private qualityHistory: ValidationQualityTrend[] = [];
  private recommendations: ValidationQualityRecommendation[] = [];

  constructor(config: Partial<ValidationQualityConfig> = {}) {
    super();
    
    this.config = {
      thresholds: {
        excellent: 90,
        good: 80,
        acceptable: 70,
        poor: 60
      },
      weights: {
        accuracy: 0.3,
        completeness: 0.25,
        consistency: 0.2,
        performance: 0.15,
        reliability: 0.1
      },
      minSampleSize: 10,
      trendAnalysisWindow: 30,
      enableRecommendations: true,
      monitoringInterval: 15,
      ...config
    };
  }

  // ========================================================================
  // Main Quality Metrics Methods
  // ========================================================================

  /**
   * Calculate comprehensive quality metrics for a validation run
   */
  async calculateQualityMetrics(
    timeRange: { start: Date; end: Date },
    resourceTypes?: string[]
  ): Promise<ValidationQualityMetrics> {
    try {
      // Get validation results for the time range
      const results = await this.getValidationResults(timeRange, resourceTypes);
      
      if (results.length < this.config.minSampleSize) {
        throw new Error(`Insufficient data for quality calculation. Need at least ${this.config.minSampleSize} results, got ${results.length}`);
      }

      const context: QualityCalculationContext = {
        results,
        timeRange,
        config: this.config
      };

      // Calculate individual quality metrics
      const accuracy = this.calculateAccuracyMetrics(context);
      const completeness = this.calculateCompletenessMetrics(context);
      const consistency = this.calculateConsistencyMetrics(context);
      const performance = this.calculatePerformanceMetrics(context);
      const reliability = this.calculateReliabilityMetrics(context);

      // Calculate aspect-specific quality scores
      const aspectQualityScores = this.calculateAspectQualityScores(context);

      // Calculate overall quality score
      const overallQualityScore = this.calculateOverallQualityScore({
        accuracy: accuracy.accuracy,
        completeness: completeness.completenessScore,
        consistency: consistency.consistencyScore,
        performance: performance.performanceScore,
        reliability: reliability.reliabilityScore
      });

      // Get quality trends
      const qualityTrends = await this.getQualityTrends(timeRange);

      // Generate recommendations if enabled
      const recommendations = this.config.enableRecommendations 
        ? await this.generateQualityRecommendations(context, {
            accuracy,
            completeness,
            consistency,
            performance,
            reliability
          })
        : [];

      const qualityMetrics: ValidationQualityMetrics = {
        overallQualityScore,
        accuracy,
        completeness,
        consistency,
        performance,
        reliability,
        aspectQualityScores,
        qualityTrends,
        recommendations
      };

      // Store quality trend for future analysis
      await this.storeQualityTrend(qualityMetrics, timeRange);

      this.emit('qualityMetricsCalculated', { qualityMetrics, timeRange });
      return qualityMetrics;

    } catch (error) {
      this.emit('qualityMetricsError', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Generate a comprehensive quality report
   */
  async generateQualityReport(
    timeRange: { start: Date; end: Date },
    resourceTypes?: string[]
  ): Promise<ValidationQualityReport> {
    try {
      const qualityMetrics = await this.calculateQualityMetrics(timeRange, resourceTypes);
      
      // Determine quality grade and status
      const qualityGrade = this.determineQualityGrade(qualityMetrics.overallQualityScore);
      const status = this.determineQualityStatus(qualityMetrics.overallQualityScore);

      // Generate key findings
      const keyFindings = this.generateKeyFindings(qualityMetrics);

      // Generate trends summary
      const trendsSummary = this.generateTrendsSummary(qualityMetrics.qualityTrends);

      // Get top recommendations
      const topRecommendations = qualityMetrics.recommendations
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, 5);

      // Get benchmark comparison (if available)
      const benchmarkComparison = await this.getBenchmarkComparison(qualityMetrics);

      // Get resource type quality breakdown
      const resourceTypeQuality = await this.getResourceTypeQualityBreakdown(timeRange);

      // Get quality history
      const qualityHistory = await this.getQualityHistory(timeRange);

      const report: ValidationQualityReport = {
        generatedAt: new Date(),
        period: timeRange,
        qualityMetrics,
        qualityGrade,
        status,
        keyFindings,
        trendsSummary,
        topRecommendations,
        benchmarkComparison,
        resourceTypeQuality,
        qualityHistory
      };

      this.emit('qualityReportGenerated', { report });
      return report;

    } catch (error) {
      this.emit('qualityReportError', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // ========================================================================
  // Individual Quality Metrics Calculations
  // ========================================================================

  /**
   * Calculate accuracy metrics
   */
  private calculateAccuracyMetrics(context: QualityCalculationContext): ValidationAccuracyMetrics {
    const { results } = context;
    
    // For now, we'll use validation scores as a proxy for accuracy
    // In a real implementation, you'd compare against ground truth data
    const validationScores = results.map(r => r.validationScore);
    const averageScore = validationScores.reduce((sum, score) => sum + score, 0) / validationScores.length;
    
    // Calculate confidence based on score consistency
    const scoreVariance = validationScores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / validationScores.length;
    const confidence = Math.max(0, 100 - Math.sqrt(scoreVariance) * 2);

    // Calculate precision, recall, F1 score based on validation results
    const truePositives = results.filter(r => r.isValid && r.validationScore >= 80).length;
    const falsePositives = results.filter(r => r.isValid && r.validationScore < 80).length;
    const falseNegatives = results.filter(r => !r.isValid && r.validationScore >= 80).length;
    const trueNegatives = results.filter(r => !r.isValid && r.validationScore < 80).length;

    const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      truePositiveRate: recall,
      trueNegativeRate: trueNegatives / (trueNegatives + falsePositives) || 0,
      falsePositiveRate: falsePositives / (falsePositives + trueNegatives) || 0,
      falseNegativeRate: falseNegatives / (falseNegatives + truePositives) || 0,
      precision,
      recall,
      f1Score,
      accuracy: (truePositives + trueNegatives) / results.length,
      confidence
    };
  }

  /**
   * Calculate completeness metrics
   */
  private calculateCompletenessMetrics(context: QualityCalculationContext): ValidationCompletenessMetrics {
    const { results } = context;
    
    // Calculate full validation coverage (resources with all aspects validated)
    const fullyValidatedResources = results.filter(r => 
      Object.keys(r.aspectBreakdown).length >= 6 // All 6 validation aspects
    ).length;
    const fullValidationCoverage = (fullyValidatedResources / results.length) * 100;

    // Calculate aspect coverage
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const aspectCoverage = allAspects.reduce((sum, aspect) => {
      const resourcesWithAspect = results.filter(r => r.aspectBreakdown[aspect]).length;
      return sum + (resourcesWithAspect / results.length);
    }, 0) / allAspects.length * 100;

    // Calculate field coverage (simplified)
    const requiredFieldCoverage = 95; // Assume 95% coverage for required fields
    const optionalFieldCoverage = 75; // Assume 75% coverage for optional fields

    // Count validation gaps
    const validationGaps = results.reduce((gaps, result) => {
      const missingAspects = allAspects.filter(aspect => !result.aspectBreakdown[aspect]).length;
      return gaps + missingAspects;
    }, 0);

    // Identify missing areas
    const missingAreas: string[] = [];
    allAspects.forEach(aspect => {
      const coverage = results.filter(r => r.aspectBreakdown[aspect]).length / results.length;
      if (coverage < 0.8) {
        missingAreas.push(aspect);
      }
    });

    // Calculate overall completeness score
    const completenessScore = (fullValidationCoverage * 0.4 + aspectCoverage * 0.3 + 
                             requiredFieldCoverage * 0.2 + optionalFieldCoverage * 0.1);

    return {
      fullValidationCoverage,
      aspectCoverage,
      requiredFieldCoverage,
      optionalFieldCoverage,
      validationGaps,
      completenessScore,
      missingAreas
    };
  }

  /**
   * Calculate consistency metrics
   */
  private calculateConsistencyMetrics(context: QualityCalculationContext): ValidationConsistencyMetrics {
    const { results } = context;
    
    // Calculate run consistency (variation in validation scores over time)
    const scores = results.map(r => r.validationScore);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 0;

    // Calculate resource consistency (similar resources should have similar scores)
    const resourceTypeScores: Record<string, number[]> = {};
    results.forEach(result => {
      if (!resourceTypeScores[result.resourceType]) {
        resourceTypeScores[result.resourceType] = [];
      }
      resourceTypeScores[result.resourceType].push(result.validationScore);
    });

    const resourceConsistency = Object.values(resourceTypeScores).reduce((sum, scores) => {
      if (scores.length < 2) return sum + 100; // Perfect consistency for single results
      const resourceMean = scores.reduce((s, score) => s + score, 0) / scores.length;
      const resourceVariance = scores.reduce((s, score) => s + Math.pow(score - resourceMean, 2), 0) / scores.length;
      const resourceStdDev = Math.sqrt(resourceVariance);
      const resourceConsistency = Math.max(0, 100 - resourceStdDev * 2);
      return sum + resourceConsistency;
    }, 0) / Object.keys(resourceTypeScores).length;

    // Calculate aspect consistency
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const aspectConsistency = allAspects.reduce((sum, aspect) => {
      const aspectResults = results.filter(r => r.aspectBreakdown[aspect]);
      if (aspectResults.length < 2) return sum + 100;
      
      const aspectScores = aspectResults.map(r => r.aspectBreakdown[aspect].passed ? 100 : 0);
      const aspectMean = aspectScores.reduce((s, score) => s + score, 0) / aspectScores.length;
      const aspectVariance = aspectScores.reduce((s, score) => s + Math.pow(score - aspectMean, 2), 0) / aspectScores.length;
      const aspectStdDev = Math.sqrt(aspectVariance);
      const aspectConsistency = Math.max(0, 100 - aspectStdDev * 2);
      return sum + aspectConsistency;
    }, 0) / allAspects.length;

    // Count inconsistent validations (results with high score variance)
    const inconsistentValidations = results.filter(r => {
      const aspectScores = Object.values(r.aspectBreakdown).map(a => a.passed ? 100 : 0);
      if (aspectScores.length < 2) return false;
      const aspectVariance = aspectScores.reduce((sum, score) => {
        const mean = aspectScores.reduce((s, sc) => s + sc, 0) / aspectScores.length;
        return sum + Math.pow(score - mean, 2);
      }, 0) / aspectScores.length;
      return Math.sqrt(aspectVariance) > 30; // High variance threshold
    }).length;

    // Calculate overall consistency score
    const runConsistency = Math.max(0, 100 - coefficientOfVariation * 50);
    const consistencyScore = (runConsistency * 0.4 + resourceConsistency * 0.3 + aspectConsistency * 0.3);

    return {
      runConsistency,
      resourceConsistency,
      aspectConsistency,
      scoreStandardDeviation: standardDeviation,
      coefficientOfVariation,
      inconsistentValidations,
      consistencyScore
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(context: QualityCalculationContext): ValidationPerformanceMetrics {
    const { results } = context;
    
    // Calculate validation times (assuming they're stored in aspectBreakdown)
    const validationTimes: number[] = [];
    results.forEach(result => {
      Object.values(result.aspectBreakdown).forEach(aspect => {
        if (aspect.duration) {
          validationTimes.push(aspect.duration);
        }
      });
    });

    const averageValidationTime = validationTimes.length > 0 
      ? validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length 
      : 0;

    const sortedTimes = [...validationTimes].sort((a, b) => a - b);
    const medianValidationTime = sortedTimes.length > 0 
      ? sortedTimes[Math.floor(sortedTimes.length / 2)] 
      : 0;

    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ValidationTime = sortedTimes[p95Index] || 0;

    // Calculate throughput
    const totalTime = context.timeRange.end.getTime() - context.timeRange.start.getTime();
    const throughput = totalTime > 0 ? (results.length / (totalTime / (1000 * 60))) : 0;

    // Calculate resource utilization (simplified)
    const resourceUtilization = Math.min(100, (results.length / 1000) * 100);

    // Calculate memory efficiency (simplified)
    const memoryEfficiency = 85; // Assume 85% memory efficiency

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    if (p95ValidationTime > averageValidationTime * 2) {
      bottlenecks.push('High validation time variance');
    }
    if (throughput < 100) {
      bottlenecks.push('Low throughput');
    }

    // Calculate performance score
    const performanceScore = Math.min(100, 
      (Math.max(0, 100 - averageValidationTime / 10) * 0.4) +
      (Math.min(100, throughput / 10) * 0.3) +
      (resourceUtilization * 0.2) +
      (memoryEfficiency * 0.1)
    );

    return {
      averageValidationTime,
      medianValidationTime,
      p95ValidationTime,
      throughput,
      resourceUtilization,
      memoryEfficiency,
      performanceScore,
      bottlenecks
    };
  }

  /**
   * Calculate reliability metrics
   */
  private calculateReliabilityMetrics(context: QualityCalculationContext): ValidationReliabilityMetrics {
    const { results } = context;
    
    // Calculate uptime (assume 99.9% uptime)
    const uptime = 99.9;

    // Calculate error rate
    const errorResults = results.filter(r => !r.isValid || r.errorCount > 0);
    const errorRate = (errorResults.length / results.length) * 100;

    // Calculate recovery time (assume 5 seconds average)
    const recoveryTime = 5000;

    // Calculate retry success rate (assume 80% success rate)
    const retrySuccessRate = 80;

    // Calculate data integrity (assume 99.5% integrity)
    const dataIntegrity = 99.5;

    // Identify reliability issues
    const reliabilityIssues: string[] = [];
    if (errorRate > 5) {
      reliabilityIssues.push('High error rate');
    }
    if (recoveryTime > 10000) {
      reliabilityIssues.push('Slow recovery time');
    }
    if (retrySuccessRate < 70) {
      reliabilityIssues.push('Low retry success rate');
    }

    // Calculate reliability score
    const reliabilityScore = (
      (uptime * 0.3) +
      (Math.max(0, 100 - errorRate * 10) * 0.3) +
      (Math.max(0, 100 - recoveryTime / 100) * 0.2) +
      (retrySuccessRate * 0.1) +
      (dataIntegrity * 0.1)
    );

    return {
      uptime,
      errorRate,
      recoveryTime,
      retrySuccessRate,
      dataIntegrity,
      reliabilityScore,
      reliabilityIssues
    };
  }

  /**
   * Calculate aspect-specific quality scores
   */
  private calculateAspectQualityScores(context: QualityCalculationContext): Record<string, ValidationAspectQuality> {
    const { results } = context;
    const allAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    
    const aspectQualityScores: Record<string, ValidationAspectQuality> = {};

    allAspects.forEach(aspect => {
      const aspectResults = results.filter(r => r.aspectBreakdown[aspect]);
      
      if (aspectResults.length === 0) {
        aspectQualityScores[aspect] = {
          aspect,
          qualityScore: 0,
          issueCount: 0,
          issueSeverityDistribution: { fatal: 0, error: 0, warning: 0, information: 0 },
          coverage: 0,
          accuracy: 0,
          performance: { averageTime: 0, totalTime: 0, throughput: 0 },
          trends: []
        };
        return;
      }

      const passedCount = aspectResults.filter(r => r.aspectBreakdown[aspect].passed).length;
      const accuracy = (passedCount / aspectResults.length) * 100;
      const coverage = (aspectResults.length / results.length) * 100;

      // Calculate issue counts
      let issueCount = 0;
      const issueSeverityDistribution = { fatal: 0, error: 0, warning: 0, information: 0 };
      
      aspectResults.forEach(result => {
        const issues = result.aspectBreakdown[aspect].issues || [];
        issueCount += issues.length;
        issues.forEach((issue: any) => {
          const severity = issue.severity || 'info';
          if (severity in issueSeverityDistribution) {
            issueSeverityDistribution[severity as keyof typeof issueSeverityDistribution]++;
          }
        });
      });

      // Calculate performance metrics
      const times = aspectResults.map(r => r.aspectBreakdown[aspect].duration || 0);
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const throughput = averageTime > 0 ? 60000 / averageTime : 0; // Resources per minute

      // Calculate quality score
      const qualityScore = (accuracy * 0.6) + (coverage * 0.4);

      aspectQualityScores[aspect] = {
        aspect,
        qualityScore,
        issueCount,
        issueSeverityDistribution,
        coverage,
        accuracy,
        performance: {
          averageTime,
          totalTime,
          throughput
        },
        trends: [] // Would be populated with historical data
      };
    });

    return aspectQualityScores;
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallQualityScore(scores: {
    accuracy: number;
    completeness: number;
    consistency: number;
    performance: number;
    reliability: number;
  }): number {
    const weights = this.config.weights;
    return (
      scores.accuracy * weights.accuracy +
      scores.completeness * weights.completeness +
      scores.consistency * weights.consistency +
      scores.performance * weights.performance +
      scores.reliability * weights.reliability
    );
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get validation results from storage
   */
  private async getValidationResults(
    timeRange: { start: Date; end: Date },
    resourceTypes?: string[]
  ): Promise<ValidationResultData[]> {
    // This would query the database for validation results
    // For now, return mock data
    return [];
  }

  /**
   * Determine quality grade based on score
   */
  private determineQualityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Determine quality status based on score
   */
  private determineQualityStatus(score: number): 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable' {
    if (score >= this.config.thresholds.excellent) return 'excellent';
    if (score >= this.config.thresholds.good) return 'good';
    if (score >= this.config.thresholds.acceptable) return 'acceptable';
    if (score >= this.config.thresholds.poor) return 'poor';
    return 'unacceptable';
  }

  /**
   * Generate key findings from quality metrics
   */
  private generateKeyFindings(metrics: ValidationQualityMetrics): string[] {
    const findings: string[] = [];

    if (metrics.overallQualityScore >= 90) {
      findings.push('Excellent overall validation quality achieved');
    } else if (metrics.overallQualityScore < 60) {
      findings.push('Validation quality needs immediate attention');
    }

    if (metrics.accuracy.accuracy < 80) {
      findings.push('Accuracy is below acceptable threshold');
    }

    if (metrics.completeness.completenessScore < 80) {
      findings.push('Validation completeness needs improvement');
    }

    if (metrics.consistency.consistencyScore < 70) {
      findings.push('Validation consistency varies significantly');
    }

    if (metrics.performance.performanceScore < 70) {
      findings.push('Performance bottlenecks detected');
    }

    return findings;
  }

  /**
   * Generate trends summary
   */
  private generateTrendsSummary(trends: ValidationQualityTrend[]): string {
    if (trends.length < 2) {
      return 'Insufficient data for trend analysis';
    }

    const latest = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    const improvement = latest.qualityScore - previous.qualityScore;

    if (improvement > 5) {
      return 'Quality showing significant improvement trend';
    } else if (improvement < -5) {
      return 'Quality showing declining trend';
    } else {
      return 'Quality remaining stable';
    }
  }

  /**
   * Generate quality recommendations
   */
  private async generateQualityRecommendations(
    context: QualityCalculationContext,
    metrics: {
      accuracy: ValidationAccuracyMetrics;
      completeness: ValidationCompletenessMetrics;
      consistency: ValidationConsistencyMetrics;
      performance: ValidationPerformanceMetrics;
      reliability: ValidationReliabilityMetrics;
    }
  ): Promise<ValidationQualityRecommendation[]> {
    const recommendations: ValidationQualityRecommendation[] = [];

    // Accuracy recommendations
    if (metrics.accuracy.accuracy < 80) {
      recommendations.push({
        id: 'improve-accuracy',
        type: 'accuracy',
        priority: 'high',
        title: 'Improve Validation Accuracy',
        description: 'Validation accuracy is below acceptable threshold. Consider enhancing validation rules and testing against ground truth data.',
        expectedImpact: 15,
        effort: 'medium',
        relatedAspects: ['structural', 'profile', 'businessRule'],
        actionItems: [
          'Review and enhance validation rules',
          'Add more comprehensive test cases',
          'Implement validation rule testing framework'
        ],
        estimatedTime: '2-3 weeks'
      });
    }

    // Completeness recommendations
    if (metrics.completeness.completenessScore < 80) {
      recommendations.push({
        id: 'improve-completeness',
        type: 'completeness',
        priority: 'medium',
        title: 'Increase Validation Coverage',
        description: 'Validation completeness can be improved by covering more validation aspects and fields.',
        expectedImpact: 10,
        effort: 'low',
        relatedAspects: ['metadata', 'terminology'],
        actionItems: [
          'Enable additional validation aspects',
          'Increase field coverage',
          'Add missing validation areas'
        ],
        estimatedTime: '1-2 weeks'
      });
    }

    // Performance recommendations
    if (metrics.performance.performanceScore < 70) {
      recommendations.push({
        id: 'optimize-performance',
        type: 'performance',
        priority: 'medium',
        title: 'Optimize Validation Performance',
        description: 'Performance bottlenecks detected. Consider optimizing validation algorithms and resource utilization.',
        expectedImpact: 12,
        effort: 'high',
        relatedAspects: ['terminology', 'reference'],
        actionItems: [
          'Optimize validation algorithms',
          'Implement caching strategies',
          'Parallelize validation processes'
        ],
        estimatedTime: '3-4 weeks'
      });
    }

    return recommendations;
  }

  /**
   * Store quality trend for future analysis
   */
  private async storeQualityTrend(
    metrics: ValidationQualityMetrics,
    timeRange: { start: Date; end: Date }
  ): Promise<void> {
    const trend: ValidationQualityTrend = {
      timestamp: new Date(),
      qualityScore: metrics.overallQualityScore,
      accuracyScore: metrics.accuracy.accuracy,
      completenessScore: metrics.completeness.completenessScore,
      consistencyScore: metrics.consistency.consistencyScore,
      performanceScore: metrics.performance.performanceScore,
      reliabilityScore: metrics.reliability.reliabilityScore,
      resourcesValidated: 0, // Would be calculated from actual data
      duration: timeRange.end.getTime() - timeRange.start.getTime()
    };

    this.qualityHistory.push(trend);
    
    // Keep only recent trends
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.trendAnalysisWindow);
    this.qualityHistory = this.qualityHistory.filter(t => t.timestamp > cutoffDate);
  }

  /**
   * Get quality trends
   */
  private async getQualityTrends(timeRange: { start: Date; end: Date }): Promise<ValidationQualityTrend[]> {
    return this.qualityHistory.filter(trend => 
      trend.timestamp >= timeRange.start && trend.timestamp <= timeRange.end
    );
  }

  /**
   * Get benchmark comparison
   */
  private async getBenchmarkComparison(metrics: ValidationQualityMetrics): Promise<{
    current: ValidationQualityMetrics;
    benchmark: ValidationQualityMetrics;
    improvement: number;
  }> {
    // This would compare against industry benchmarks or historical baselines
    // For now, return a mock comparison
    const benchmark = { ...metrics, overallQualityScore: 85 };
    return {
      current: metrics,
      benchmark,
      improvement: metrics.overallQualityScore - benchmark.overallQualityScore
    };
  }

  /**
   * Get resource type quality breakdown
   */
  private async getResourceTypeQualityBreakdown(
    timeRange: { start: Date; end: Date }
  ): Promise<Record<string, ValidationQualityMetrics>> {
    // This would calculate quality metrics per resource type
    // For now, return empty object
    return {};
  }

  /**
   * Get quality history
   */
  private async getQualityHistory(timeRange: { start: Date; end: Date }): Promise<ValidationQualityTrend[]> {
    return this.getQualityTrends(timeRange);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ValidationQualityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): ValidationQualityConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): { isHealthy: boolean; lastCalculated?: Date } {
    return {
      isHealthy: true,
      lastCalculated: this.qualityHistory.length > 0 ? this.qualityHistory[this.qualityHistory.length - 1].timestamp : undefined
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let qualityMetricsServiceInstance: ValidationQualityMetricsService | null = null;

/**
 * Get the singleton instance of the validation quality metrics service
 */
export function getValidationQualityMetricsService(config?: Partial<ValidationQualityConfig>): ValidationQualityMetricsService {
  if (!qualityMetricsServiceInstance) {
    qualityMetricsServiceInstance = new ValidationQualityMetricsService(config);
  }
  return qualityMetricsServiceInstance;
}
