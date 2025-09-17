// ============================================================================
// Validation Quality Service
// ============================================================================

import { storage } from '../../storage';
import { ValidationErrorService } from './validation-error-service.js';
import { ValidationPerformanceService } from './validation-performance-service.js';

export interface QualityScore {
  id: string;
  resourceId: string;
  resourceType: string;
  overallScore: number; // 0-100
  componentScores: {
    structural: number; // 0-100
    semantic: number; // 0-100
    terminology: number; // 0-100
    references: number; // 0-100
    businessRules: number; // 0-100
    metadata: number; // 0-100
  };
  weightedScore: number; // 0-100 (weighted by importance)
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  issues: QualityIssue[];
  recommendations: string[];
  calculatedAt: Date;
}

export interface QualityIssue {
  id: string;
  type: 'structural' | 'semantic' | 'terminology' | 'reference' | 'business_rule' | 'metadata';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  location?: string;
  impact: number; // 0-100 (impact on quality score)
  fixable: boolean;
  suggestion?: string;
}

export interface QualityMetrics {
  id: string;
  name: string;
  description: string;
  category: 'accuracy' | 'completeness' | 'consistency' | 'timeliness' | 'reliability';
  formula: string;
  weight: number; // 0-1
  threshold: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  unit: string;
}

export interface QualityKPI {
  id: string;
  name: string;
  description: string;
  value: number;
  target: number;
  unit: string;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}

export interface QualityBenchmark {
  id: string;
  name: string;
  description: string;
  standard: 'fhir_r4' | 'fhir_r5' | 'custom' | 'industry';
  metrics: {
    averageScore: number;
    medianScore: number;
    percentile90: number;
    percentile95: number;
    percentile99: number;
  };
  thresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  sampleSize: number;
  lastUpdated: Date;
}

export interface QualityImprovement {
  id: string;
  type: 'automated' | 'manual' | 'process' | 'training';
  priority: 'high' | 'medium' | 'low';
  impact: number; // 0-100
  effort: number; // 0-100
  description: string;
  recommendation: string;
  expectedImprovement: number; // percentage
  implementation: string;
  cost: number; // estimated cost
  timeline: string; // estimated timeline
}

export class ValidationQualityService {
  private static instance: ValidationQualityService;
  private qualityMetrics: Map<string, QualityMetrics> = new Map();
  private benchmarks: Map<string, QualityBenchmark> = new Map();
  private improvements: Map<string, QualityImprovement> = new Map();

  private constructor() {
    this.initializeDefaultMetrics();
    this.initializeDefaultBenchmarks();
  }

  static getInstance(): ValidationQualityService {
    if (!ValidationQualityService.instance) {
      ValidationQualityService.instance = new ValidationQualityService();
    }
    return ValidationQualityService.instance;
  }

  /**
   * Calculate quality score for a resource
   */
  async calculateQualityScore(
    resourceId: string,
    resourceType: string,
    validationData: any
  ): Promise<QualityScore> {
    const issues = await this.identifyQualityIssues(resourceId, resourceType, validationData);
    const componentScores = this.calculateComponentScores(issues);
    const overallScore = this.calculateOverallScore(componentScores);
    const weightedScore = this.calculateWeightedScore(componentScores);
    const qualityLevel = this.determineQualityLevel(overallScore);
    const recommendations = this.generateRecommendations(issues, componentScores);

    const qualityScore: QualityScore = {
      id: `quality_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resourceId,
      resourceType,
      overallScore,
      componentScores,
      weightedScore,
      qualityLevel,
      issues,
      recommendations,
      calculatedAt: new Date()
    };

    // Store quality score
    await this.storeQualityScore(qualityScore);

    return qualityScore;
  }

  /**
   * Calculate quality KPIs
   */
  async calculateQualityKPIs(): Promise<QualityKPI[]> {
    const kpis: QualityKPI[] = [];

    // Overall Quality Score KPI
    const overallQuality = await this.calculateOverallQualityKPI();
    kpis.push(overallQuality);

    // Error Rate KPI
    const errorRate = await this.calculateErrorRateKPI();
    kpis.push(errorRate);

    // Completeness KPI
    const completeness = await this.calculateCompletenessKPI();
    kpis.push(completeness);

    // Consistency KPI
    const consistency = await this.calculateConsistencyKPI();
    kpis.push(consistency);

    // Timeliness KPI
    const timeliness = await this.calculateTimelinessKPI();
    kpis.push(timeliness);

    return kpis;
  }

  /**
   * Get quality benchmark
   */
  getQualityBenchmark(standard: QualityBenchmark['standard']): QualityBenchmark | null {
    for (const benchmark of this.benchmarks.values()) {
      if (benchmark.standard === standard) {
        return benchmark;
      }
    }
    return null;
  }

  /**
   * Compare quality against benchmark
   */
  async compareQualityAgainstBenchmark(
    resourceType: string,
    standard: QualityBenchmark['standard']
  ): Promise<{
    current: number;
    benchmark: QualityBenchmark;
    comparison: {
      percentile: number;
      status: 'above' | 'at' | 'below';
      gap: number;
    };
  }> {
    const benchmark = this.getQualityBenchmark(standard);
    if (!benchmark) {
      throw new Error(`Benchmark not found for standard: ${standard}`);
    }

    const currentQuality = await this.getAverageQualityScore(resourceType);
    const percentile = this.calculatePercentile(currentQuality, benchmark);
    const status = this.determineBenchmarkStatus(currentQuality, benchmark);
    const gap = currentQuality - benchmark.metrics.averageScore;

    return {
      current: currentQuality,
      benchmark,
      comparison: {
        percentile,
        status,
        gap
      }
    };
  }

  /**
   * Generate quality improvement recommendations
   */
  async generateQualityImprovements(resourceType?: string): Promise<QualityImprovement[]> {
    const improvements: QualityImprovement[] = [];

    // Analyze current quality issues
    const qualityIssues = await this.analyzeQualityIssues(resourceType);
    
    // Generate improvements based on issues
    for (const issue of qualityIssues) {
      const improvement = this.createImprovementFromIssue(issue);
      if (improvement) {
        improvements.push(improvement);
      }
    }

    // Add standard improvements
    improvements.push(...this.getStandardImprovements());

    // Sort by impact/effort ratio
    improvements.sort((a, b) => (b.impact / b.effort) - (a.impact / a.effort));

    return improvements;
  }

  /**
   * Identify quality issues
   */
  private async identifyQualityIssues(
    resourceId: string,
    resourceType: string,
    validationData: any
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Structural issues
    const structuralIssues = this.identifyStructuralIssues(validationData);
    issues.push(...structuralIssues);

    // Semantic issues
    const semanticIssues = this.identifySemanticIssues(validationData);
    issues.push(...semanticIssues);

    // Terminology issues
    const terminologyIssues = this.identifyTerminologyIssues(validationData);
    issues.push(...terminologyIssues);

    // Reference issues
    const referenceIssues = this.identifyReferenceIssues(validationData);
    issues.push(...referenceIssues);

    // Business rule issues
    const businessRuleIssues = this.identifyBusinessRuleIssues(validationData);
    issues.push(...businessRuleIssues);

    // Metadata issues
    const metadataIssues = this.identifyMetadataIssues(validationData);
    issues.push(...metadataIssues);

    return issues;
  }

  /**
   * Identify structural issues
   */
  private identifyStructuralIssues(validationData: any): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for missing required fields
    if (validationData.missingRequiredFields && validationData.missingRequiredFields.length > 0) {
      issues.push({
        id: `structural_${Date.now()}_1`,
        type: 'structural',
        severity: 'high',
        message: `Missing required fields: ${validationData.missingRequiredFields.join(', ')}`,
        impact: 20,
        fixable: true,
        suggestion: 'Add the missing required fields to the resource'
      });
    }

    // Check for invalid data types
    if (validationData.invalidDataTypes && validationData.invalidDataTypes.length > 0) {
      issues.push({
        id: `structural_${Date.now()}_2`,
        type: 'structural',
        severity: 'high',
        message: `Invalid data types: ${validationData.invalidDataTypes.join(', ')}`,
        impact: 25,
        fixable: true,
        suggestion: 'Correct the data types for the specified fields'
      });
    }

    return issues;
  }

  /**
   * Identify semantic issues
   */
  private identifySemanticIssues(validationData: any): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for logical inconsistencies
    if (validationData.logicalInconsistencies && validationData.logicalInconsistencies.length > 0) {
      issues.push({
        id: `semantic_${Date.now()}_1`,
        type: 'semantic',
        severity: 'medium',
        message: `Logical inconsistencies: ${validationData.logicalInconsistencies.join(', ')}`,
        impact: 15,
        fixable: true,
        suggestion: 'Review and correct the logical inconsistencies'
      });
    }

    return issues;
  }

  /**
   * Identify terminology issues
   */
  private identifyTerminologyIssues(validationData: any): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for invalid codes
    if (validationData.invalidCodes && validationData.invalidCodes.length > 0) {
      issues.push({
        id: `terminology_${Date.now()}_1`,
        type: 'terminology',
        severity: 'medium',
        message: `Invalid codes: ${validationData.invalidCodes.join(', ')}`,
        impact: 10,
        fixable: true,
        suggestion: 'Use valid codes from the appropriate value sets'
      });
    }

    return issues;
  }

  /**
   * Identify reference issues
   */
  private identifyReferenceIssues(validationData: any): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for broken references
    if (validationData.brokenReferences && validationData.brokenReferences.length > 0) {
      issues.push({
        id: `reference_${Date.now()}_1`,
        type: 'reference',
        severity: 'high',
        message: `Broken references: ${validationData.brokenReferences.join(', ')}`,
        impact: 20,
        fixable: true,
        suggestion: 'Fix or remove the broken references'
      });
    }

    return issues;
  }

  /**
   * Identify business rule issues
   */
  private identifyBusinessRuleIssues(validationData: any): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for business rule violations
    if (validationData.businessRuleViolations && validationData.businessRuleViolations.length > 0) {
      issues.push({
        id: `business_rule_${Date.now()}_1`,
        type: 'business_rule',
        severity: 'medium',
        message: `Business rule violations: ${validationData.businessRuleViolations.join(', ')}`,
        impact: 15,
        fixable: true,
        suggestion: 'Review and correct the business rule violations'
      });
    }

    return issues;
  }

  /**
   * Identify metadata issues
   */
  private identifyMetadataIssues(validationData: any): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check for missing metadata
    if (validationData.missingMetadata && validationData.missingMetadata.length > 0) {
      issues.push({
        id: `metadata_${Date.now()}_1`,
        type: 'metadata',
        severity: 'low',
        message: `Missing metadata: ${validationData.missingMetadata.join(', ')}`,
        impact: 5,
        fixable: true,
        suggestion: 'Add the missing metadata fields'
      });
    }

    return issues;
  }

  /**
   * Calculate component scores
   */
  private calculateComponentScores(issues: QualityIssue[]): QualityScore['componentScores'] {
    const componentScores = {
      structural: 100,
      semantic: 100,
      terminology: 100,
      references: 100,
      businessRules: 100,
      metadata: 100
    };

    for (const issue of issues) {
      const impact = issue.impact;
      switch (issue.type) {
        case 'structural':
          componentScores.structural -= impact;
          break;
        case 'semantic':
          componentScores.semantic -= impact;
          break;
        case 'terminology':
          componentScores.terminology -= impact;
          break;
        case 'reference':
          componentScores.references -= impact;
          break;
        case 'business_rule':
          componentScores.businessRules -= impact;
          break;
        case 'metadata':
          componentScores.metadata -= impact;
          break;
      }
    }

    // Ensure scores are within bounds
    for (const key in componentScores) {
      componentScores[key as keyof typeof componentScores] = Math.max(0, Math.min(100, componentScores[key as keyof typeof componentScores]));
    }

    return componentScores;
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(componentScores: QualityScore['componentScores']): number {
    const scores = Object.values(componentScores);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculate weighted score
   */
  private calculateWeightedScore(componentScores: QualityScore['componentScores']): number {
    const weights = {
      structural: 0.25,
      semantic: 0.20,
      terminology: 0.15,
      references: 0.15,
      businessRules: 0.15,
      metadata: 0.10
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [component, score] of Object.entries(componentScores)) {
      const weight = weights[component as keyof typeof weights];
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Determine quality level
   */
  private determineQualityLevel(score: number): QualityScore['qualityLevel'] {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'poor';
    return 'critical';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(issues: QualityIssue[], componentScores: QualityScore['componentScores']): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on lowest scoring components
    const sortedComponents = Object.entries(componentScores)
      .sort(([,a], [,b]) => a - b);

    for (const [component, score] of sortedComponents.slice(0, 3)) {
      if (score < 80) {
        recommendations.push(`Improve ${component} quality (current score: ${score.toFixed(1)})`);
      }
    }

    // Generate recommendations based on critical issues
    const criticalIssues = issues.filter(issue => issue.severity === 'critical' || issue.severity === 'high');
    for (const issue of criticalIssues.slice(0, 3)) {
      if (issue.suggestion) {
        recommendations.push(issue.suggestion);
      }
    }

    return recommendations;
  }

  /**
   * Calculate overall quality KPI
   */
  private async calculateOverallQualityKPI(): Promise<QualityKPI> {
    const averageScore = await this.getAverageQualityScore();
    const target = 85; // Target quality score
    const status = this.determineKPIStatus(averageScore, target);
    const trend = await this.calculateQualityTrend();

    return {
      id: 'overall_quality',
      name: 'Overall Quality Score',
      description: 'Average quality score across all resources',
      value: averageScore,
      target,
      unit: 'score',
      status,
      trend,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate error rate KPI
   */
  private async calculateErrorRateKPI(): Promise<QualityKPI> {
    const errorRate = await this.getErrorRate();
    const target = 5; // Target error rate percentage
    const status = this.determineKPIStatus(100 - errorRate, 100 - target); // Invert for error rate
    const trend = await this.calculateErrorRateTrend();

    return {
      id: 'error_rate',
      name: 'Error Rate',
      description: 'Percentage of resources with validation errors',
      value: errorRate,
      target,
      unit: '%',
      status,
      trend,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate completeness KPI
   */
  private async calculateCompletenessKPI(): Promise<QualityKPI> {
    const completeness = await this.getCompletenessScore();
    const target = 95; // Target completeness percentage
    const status = this.determineKPIStatus(completeness, target);
    const trend = await this.calculateCompletenessTrend();

    return {
      id: 'completeness',
      name: 'Data Completeness',
      description: 'Percentage of required fields that are populated',
      value: completeness,
      target,
      unit: '%',
      status,
      trend,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate consistency KPI
   */
  private async calculateConsistencyKPI(): Promise<QualityKPI> {
    const consistency = await this.getConsistencyScore();
    const target = 90; // Target consistency percentage
    const status = this.determineKPIStatus(consistency, target);
    const trend = await this.calculateConsistencyTrend();

    return {
      id: 'consistency',
      name: 'Data Consistency',
      description: 'Percentage of resources that follow consistent patterns',
      value: consistency,
      target,
      unit: '%',
      status,
      trend,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate timeliness KPI
   */
  private async calculateTimelinessKPI(): Promise<QualityKPI> {
    const timeliness = await this.getTimelinessScore();
    const target = 80; // Target timeliness percentage
    const status = this.determineKPIStatus(timeliness, target);
    const trend = await this.calculateTimelinessTrend();

    return {
      id: 'timeliness',
      name: 'Data Timeliness',
      description: 'Percentage of resources that are up-to-date',
      value: timeliness,
      target,
      unit: '%',
      status,
      trend,
      lastUpdated: new Date()
    };
  }

  /**
   * Determine KPI status
   */
  private determineKPIStatus(value: number, target: number): QualityKPI['status'] {
    const percentage = (value / target) * 100;
    
    if (percentage >= 100) return 'excellent';
    if (percentage >= 90) return 'good';
    if (percentage >= 80) return 'fair';
    if (percentage >= 70) return 'poor';
    return 'critical';
  }

  /**
   * Initialize default quality metrics
   */
  private initializeDefaultMetrics(): void {
    const defaultMetrics: QualityMetrics[] = [
      {
        id: 'structural_quality',
        name: 'Structural Quality',
        description: 'Quality of resource structure and syntax',
        category: 'accuracy',
        formula: '100 - (structural_issues * impact_weight)',
        weight: 0.25,
        threshold: { excellent: 95, good: 85, fair: 75, poor: 65 },
        unit: 'score'
      },
      {
        id: 'semantic_quality',
        name: 'Semantic Quality',
        description: 'Quality of resource semantics and meaning',
        category: 'accuracy',
        formula: '100 - (semantic_issues * impact_weight)',
        weight: 0.20,
        threshold: { excellent: 90, good: 80, fair: 70, poor: 60 },
        unit: 'score'
      },
      {
        id: 'terminology_quality',
        name: 'Terminology Quality',
        description: 'Quality of terminology and coding',
        category: 'consistency',
        formula: '100 - (terminology_issues * impact_weight)',
        weight: 0.15,
        threshold: { excellent: 95, good: 85, fair: 75, poor: 65 },
        unit: 'score'
      },
      {
        id: 'reference_quality',
        name: 'Reference Quality',
        description: 'Quality of resource references',
        category: 'reliability',
        formula: '100 - (reference_issues * impact_weight)',
        weight: 0.15,
        threshold: { excellent: 95, good: 85, fair: 75, poor: 65 },
        unit: 'score'
      },
      {
        id: 'business_rule_quality',
        name: 'Business Rule Quality',
        description: 'Compliance with business rules',
        category: 'consistency',
        formula: '100 - (business_rule_issues * impact_weight)',
        weight: 0.15,
        threshold: { excellent: 90, good: 80, fair: 70, poor: 60 },
        unit: 'score'
      },
      {
        id: 'metadata_quality',
        name: 'Metadata Quality',
        description: 'Quality of resource metadata',
        category: 'completeness',
        formula: '100 - (metadata_issues * impact_weight)',
        weight: 0.10,
        threshold: { excellent: 85, good: 75, fair: 65, poor: 55 },
        unit: 'score'
      }
    ];

    for (const metric of defaultMetrics) {
      this.qualityMetrics.set(metric.id, metric);
    }
  }

  /**
   * Initialize default benchmarks
   */
  private initializeDefaultBenchmarks(): void {
    const defaultBenchmarks: QualityBenchmark[] = [
      {
        id: 'fhir_r4_benchmark',
        name: 'FHIR R4 Benchmark',
        description: 'Quality benchmark based on FHIR R4 standards',
        standard: 'fhir_r4',
        metrics: {
          averageScore: 82.5,
          medianScore: 85.0,
          percentile90: 92.0,
          percentile95: 95.0,
          percentile99: 98.0
        },
        thresholds: {
          excellent: 95,
          good: 85,
          fair: 75,
          poor: 65
        },
        sampleSize: 10000,
        lastUpdated: new Date()
      },
      {
        id: 'fhir_r5_benchmark',
        name: 'FHIR R5 Benchmark',
        description: 'Quality benchmark based on FHIR R5 standards',
        standard: 'fhir_r5',
        metrics: {
          averageScore: 85.0,
          medianScore: 87.5,
          percentile90: 94.0,
          percentile95: 96.0,
          percentile99: 98.5
        },
        thresholds: {
          excellent: 96,
          good: 87,
          fair: 77,
          poor: 67
        },
        sampleSize: 5000,
        lastUpdated: new Date()
      }
    ];

    for (const benchmark of defaultBenchmarks) {
      this.benchmarks.set(benchmark.id, benchmark);
    }
  }

  /**
   * Get standard improvements
   */
  private getStandardImprovements(): QualityImprovement[] {
    return [
      {
        id: 'improvement_1',
        type: 'automated',
        priority: 'high',
        impact: 80,
        effort: 30,
        description: 'Implement automated validation rules',
        recommendation: 'Add automated validation rules for common issues',
        expectedImprovement: 25,
        implementation: 'Configure validation rules in the validation engine',
        cost: 1000,
        timeline: '2 weeks'
      },
      {
        id: 'improvement_2',
        type: 'process',
        priority: 'medium',
        impact: 60,
        effort: 50,
        description: 'Improve data entry processes',
        recommendation: 'Train staff on proper data entry procedures',
        expectedImprovement: 15,
        implementation: 'Conduct training sessions and update procedures',
        cost: 5000,
        timeline: '1 month'
      },
      {
        id: 'improvement_3',
        type: 'manual',
        priority: 'low',
        impact: 40,
        effort: 70,
        description: 'Manual data cleanup',
        recommendation: 'Perform manual cleanup of existing data',
        expectedImprovement: 10,
        implementation: 'Assign staff to review and correct data',
        cost: 10000,
        timeline: '3 months'
      }
    ];
  }

  // Helper methods (simplified implementations)
  private async getAverageQualityScore(resourceType?: string): Promise<number> {
    // Simplified implementation
    return 82.5;
  }

  private async getErrorRate(): Promise<number> {
    // Simplified implementation
    return 8.5;
  }

  private async getCompletenessScore(): Promise<number> {
    // Simplified implementation
    return 92.0;
  }

  private async getConsistencyScore(): Promise<number> {
    // Simplified implementation
    return 88.5;
  }

  private async getTimelinessScore(): Promise<number> {
    // Simplified implementation
    return 85.0;
  }

  private async calculateQualityTrend(): Promise<QualityKPI['trend']> {
    // Simplified implementation
    return 'improving';
  }

  private async calculateErrorRateTrend(): Promise<QualityKPI['trend']> {
    // Simplified implementation
    return 'declining';
  }

  private async calculateCompletenessTrend(): Promise<QualityKPI['trend']> {
    // Simplified implementation
    return 'stable';
  }

  private async calculateConsistencyTrend(): Promise<QualityKPI['trend']> {
    // Simplified implementation
    return 'improving';
  }

  private async calculateTimelinessTrend(): Promise<QualityKPI['trend']> {
    // Simplified implementation
    return 'stable';
  }

  private calculatePercentile(score: number, benchmark: QualityBenchmark): number {
    if (score >= benchmark.metrics.percentile99) return 99;
    if (score >= benchmark.metrics.percentile95) return 95;
    if (score >= benchmark.metrics.percentile90) return 90;
    if (score >= benchmark.metrics.medianScore) return 50;
    return 25;
  }

  private determineBenchmarkStatus(score: number, benchmark: QualityBenchmark): 'above' | 'at' | 'below' {
    if (score > benchmark.metrics.averageScore) return 'above';
    if (score === benchmark.metrics.averageScore) return 'at';
    return 'below';
  }

  private async analyzeQualityIssues(resourceType?: string): Promise<QualityIssue[]> {
    // Simplified implementation
    return [];
  }

  private createImprovementFromIssue(issue: QualityIssue): QualityImprovement | null {
    // Simplified implementation
    return null;
  }

  private async storeQualityScore(qualityScore: QualityScore): Promise<void> {
    try {
      await storage.saveQualityScore(qualityScore);
    } catch (error) {
      console.error('Failed to store quality score:', error);
    }
  }
}
