// ============================================================================
// Validation Comparison Service
// ============================================================================

import { storage } from '../../../storage';
import { ValidationPerformanceService } from '../performance/validation-performance-service.js';
import { ValidationErrorService } from './validation-error-service.js';

export interface ValidationRun {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  status: 'completed' | 'failed' | 'cancelled';
  configuration: {
    resourceTypes: string[];
    batchSize: number;
    validationSettings: any;
  };
  performance: {
    throughput: number;
    efficiency: number;
    averageProcessingTime: number;
  };
  errors: {
    totalErrors: number;
    errorsBySeverity: Record<string, number>;
    topErrors: Array<{ message: string; count: number; severity: string }>;
  };
}

export interface ValidationComparison {
  id: string;
  name: string;
  description?: string;
  baselineRun: ValidationRun;
  comparisonRun: ValidationRun;
  metrics: {
    performanceImprovement: number; // percentage
    errorReduction: number; // percentage
    throughputChange: number; // percentage
    efficiencyChange: number; // percentage
    resourceCountChange: number; // percentage
  };
  analysis: {
    improvements: string[];
    regressions: string[];
    recommendations: string[];
  };
  createdAt: Date;
}

export interface ValidationTrend {
  id: string;
  name: string;
  description?: string;
  runs: ValidationRun[];
  trendData: {
    dates: string[];
    throughput: number[];
    efficiency: number[];
    errorRate: number[];
    successRate: number[];
  };
  analysis: {
    trendDirection: 'improving' | 'declining' | 'stable';
    trendStrength: number; // 0-1
    keyInsights: string[];
    recommendations: string[];
  };
  createdAt: Date;
}

export interface ValidationBenchmark {
  id: string;
  name: string;
  description: string;
  baseline: ValidationRun;
  current: ValidationRun;
  improvement: number; // percentage
  status: 'improved' | 'degraded' | 'stable';
  metrics: {
    throughput: { baseline: number; current: number; change: number };
    efficiency: { baseline: number; current: number; change: number };
    errorRate: { baseline: number; current: number; change: number };
    successRate: { baseline: number; current: number; change: number };
  };
  createdAt: Date;
}

export class ValidationComparisonService {
  private static instance: ValidationComparisonService;
  private comparisons: Map<string, ValidationComparison> = new Map();
  private trends: Map<string, ValidationTrend> = new Map();
  private benchmarks: Map<string, ValidationBenchmark> = new Map();

  private constructor() {}

  static getInstance(): ValidationComparisonService {
    if (!ValidationComparisonService.instance) {
      ValidationComparisonService.instance = new ValidationComparisonService();
    }
    return ValidationComparisonService.instance;
  }

  /**
   * Compare two validation runs
   */
  async compareValidationRuns(
    baselineRunId: string,
    comparisonRunId: string,
    name: string,
    description?: string
  ): Promise<ValidationComparison> {
    const baselineRun = await this.getValidationRun(baselineRunId);
    const comparisonRun = await this.getValidationRun(comparisonRunId);

    if (!baselineRun || !comparisonRun) {
      throw new Error('One or both validation runs not found');
    }

    const comparison: ValidationComparison = {
      id: `comparison_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      baselineRun,
      comparisonRun,
      metrics: this.calculateComparisonMetrics(baselineRun, comparisonRun),
      analysis: this.analyzeComparison(baselineRun, comparisonRun),
      createdAt: new Date()
    };

    this.comparisons.set(comparison.id, comparison);
    await this.persistComparison(comparison);

    console.log(`[ValidationComparison] Created comparison: ${name}`);
    return comparison;
  }

  /**
   * Create validation trend analysis
   */
  async createValidationTrend(
    runIds: string[],
    name: string,
    description?: string
  ): Promise<ValidationTrend> {
    const runs: ValidationRun[] = [];
    
    for (const runId of runIds) {
      const run = await this.getValidationRun(runId);
      if (run) {
        runs.push(run);
      }
    }

    if (runs.length < 2) {
      throw new Error('At least 2 validation runs are required for trend analysis');
    }

    // Sort runs by start time
    runs.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const trend: ValidationTrend = {
      id: `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      runs,
      trendData: this.calculateTrendData(runs),
      analysis: this.analyzeTrend(runs),
      createdAt: new Date()
    };

    this.trends.set(trend.id, trend);
    await this.persistTrend(trend);

    console.log(`[ValidationComparison] Created trend analysis: ${name}`);
    return trend;
  }

  /**
   * Create validation benchmark
   */
  async createValidationBenchmark(
    baselineRunId: string,
    currentRunId: string,
    name: string,
    description: string
  ): Promise<ValidationBenchmark> {
    const baselineRun = await this.getValidationRun(baselineRunId);
    const currentRun = await this.getValidationRun(currentRunId);

    if (!baselineRun || !currentRun) {
      throw new Error('One or both validation runs not found');
    }

    const benchmark: ValidationBenchmark = {
      id: `benchmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      baseline: baselineRun,
      current: currentRun,
      improvement: this.calculateImprovement(baselineRun, currentRun),
      status: this.determineBenchmarkStatus(baselineRun, currentRun),
      metrics: this.calculateBenchmarkMetrics(baselineRun, currentRun),
      createdAt: new Date()
    };

    this.benchmarks.set(benchmark.id, benchmark);
    await this.persistBenchmark(benchmark);

    console.log(`[ValidationComparison] Created benchmark: ${name}`);
    return benchmark;
  }

  /**
   * Get validation run by ID
   */
  async getValidationRun(runId: string): Promise<ValidationRun | null> {
    try {
      // In real implementation, this would fetch from database
      // For now, return mock data
      return {
        id: runId,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        endTime: new Date(Date.now() - 1800000), // 30 minutes ago
        duration: 1800000, // 30 minutes
        totalResources: 1000,
        processedResources: 1000,
        validResources: 950,
        errorResources: 50,
        warningResources: 25,
        status: 'completed',
        configuration: {
          resourceTypes: ['Patient', 'Observation', 'Encounter'],
          batchSize: 100,
          validationSettings: {}
        },
        performance: {
          throughput: 33.33, // resources per second
          efficiency: 85.5,
          averageProcessingTime: 30 // milliseconds
        },
        errors: {
          totalErrors: 75,
          errorsBySeverity: {
            fatal: 5,
            error: 20,
            warning: 30,
            information: 20
          },
          topErrors: [
            { message: 'Missing required field', count: 15, severity: 'error' },
            { message: 'Invalid code value', count: 10, severity: 'warning' }
          ]
        }
      };
    } catch (error) {
      console.error('Failed to get validation run:', error);
      return null;
    }
  }

  /**
   * Calculate comparison metrics
   */
  private calculateComparisonMetrics(baseline: ValidationRun, comparison: ValidationRun): ValidationComparison['metrics'] {
    const performanceImprovement = this.calculatePercentageChange(
      baseline.performance.throughput,
      comparison.performance.throughput
    );

    const errorReduction = this.calculatePercentageChange(
      baseline.errors.totalErrors,
      comparison.errors.totalErrors,
      true // Invert for error reduction
    );

    const throughputChange = this.calculatePercentageChange(
      baseline.performance.throughput,
      comparison.performance.throughput
    );

    const efficiencyChange = this.calculatePercentageChange(
      baseline.performance.efficiency,
      comparison.performance.efficiency
    );

    const resourceCountChange = this.calculatePercentageChange(
      baseline.totalResources,
      comparison.totalResources
    );

    return {
      performanceImprovement,
      errorReduction,
      throughputChange,
      efficiencyChange,
      resourceCountChange
    };
  }

  /**
   * Analyze comparison
   */
  private analyzeComparison(baseline: ValidationRun, comparison: ValidationRun): ValidationComparison['analysis'] {
    const improvements: string[] = [];
    const regressions: string[] = [];
    const recommendations: string[] = [];

    // Analyze performance
    if (comparison.performance.throughput > baseline.performance.throughput) {
      improvements.push(`Throughput improved by ${this.calculatePercentageChange(baseline.performance.throughput, comparison.performance.throughput).toFixed(1)}%`);
    } else if (comparison.performance.throughput < baseline.performance.throughput) {
      regressions.push(`Throughput decreased by ${Math.abs(this.calculatePercentageChange(baseline.performance.throughput, comparison.performance.throughput)).toFixed(1)}%`);
    }

    // Analyze efficiency
    if (comparison.performance.efficiency > baseline.performance.efficiency) {
      improvements.push(`Efficiency improved by ${this.calculatePercentageChange(baseline.performance.efficiency, comparison.performance.efficiency).toFixed(1)}%`);
    } else if (comparison.performance.efficiency < baseline.performance.efficiency) {
      regressions.push(`Efficiency decreased by ${Math.abs(this.calculatePercentageChange(baseline.performance.efficiency, comparison.performance.efficiency)).toFixed(1)}%`);
    }

    // Analyze errors
    if (comparison.errors.totalErrors < baseline.errors.totalErrors) {
      improvements.push(`Error count reduced by ${this.calculatePercentageChange(baseline.errors.totalErrors, comparison.errors.totalErrors, true).toFixed(1)}%`);
    } else if (comparison.errors.totalErrors > baseline.errors.totalErrors) {
      regressions.push(`Error count increased by ${this.calculatePercentageChange(baseline.errors.totalErrors, comparison.errors.totalErrors).toFixed(1)}%`);
    }

    // Generate recommendations
    if (comparison.performance.throughput < baseline.performance.throughput) {
      recommendations.push('Consider increasing batch size to improve throughput');
    }

    if (comparison.performance.efficiency < baseline.performance.efficiency) {
      recommendations.push('Implement parallel processing to improve efficiency');
    }

    if (comparison.errors.totalErrors > baseline.errors.totalErrors) {
      recommendations.push('Review validation rules to reduce error count');
    }

    return {
      improvements,
      regressions,
      recommendations
    };
  }

  /**
   * Calculate trend data
   */
  private calculateTrendData(runs: ValidationRun[]): ValidationTrend['trendData'] {
    const dates: string[] = [];
    const throughput: number[] = [];
    const efficiency: number[] = [];
    const errorRate: number[] = [];
    const successRate: number[] = [];

    for (const run of runs) {
      const timestamp = run.startTime?.toISOString();
      if (!timestamp || typeof timestamp !== 'string') continue;
      dates.push(timestamp.split('T')[0]);
      throughput.push(run.performance.throughput);
      efficiency.push(run.performance.efficiency);
      
      const totalProcessed = run.validResources + run.errorResources;
      errorRate.push(totalProcessed > 0 ? (run.errorResources / totalProcessed) * 100 : 0);
      successRate.push(totalProcessed > 0 ? (run.validResources / totalProcessed) * 100 : 0);
    }

    return {
      dates,
      throughput,
      efficiency,
      errorRate,
      successRate
    };
  }

  /**
   * Analyze trend
   */
  private analyzeTrend(runs: ValidationRun[]): ValidationTrend['analysis'] {
    const trendData = this.calculateTrendData(runs);
    const keyInsights: string[] = [];
    const recommendations: string[] = [];

    // Analyze throughput trend
    const throughputTrend = this.calculateTrendDirection(trendData.throughput);
    if (throughputTrend.direction === 'improving') {
      keyInsights.push('Throughput is improving over time');
    } else if (throughputTrend.direction === 'declining') {
      keyInsights.push('Throughput is declining over time');
      recommendations.push('Investigate performance bottlenecks');
    }

    // Analyze efficiency trend
    const efficiencyTrend = this.calculateTrendDirection(trendData.efficiency);
    if (efficiencyTrend.direction === 'improving') {
      keyInsights.push('Efficiency is improving over time');
    } else if (efficiencyTrend.direction === 'declining') {
      keyInsights.push('Efficiency is declining over time');
      recommendations.push('Optimize validation processes');
    }

    // Analyze error rate trend
    const errorRateTrend = this.calculateTrendDirection(trendData.errorRate);
    if (errorRateTrend.direction === 'improving') {
      keyInsights.push('Error rate is decreasing over time');
    } else if (errorRateTrend.direction === 'declining') {
      keyInsights.push('Error rate is increasing over time');
      recommendations.push('Review and improve validation rules');
    }

    // Determine overall trend direction
    const overallTrend = this.determineOverallTrend(trendData);
    const trendStrength = this.calculateTrendStrength(trendData);

    return {
      trendDirection: overallTrend,
      trendStrength,
      keyInsights,
      recommendations
    };
  }

  /**
   * Calculate benchmark metrics
   */
  private calculateBenchmarkMetrics(baseline: ValidationRun, current: ValidationRun): ValidationBenchmark['metrics'] {
    return {
      throughput: {
        baseline: baseline.performance.throughput,
        current: current.performance.throughput,
        change: this.calculatePercentageChange(baseline.performance.throughput, current.performance.throughput)
      },
      efficiency: {
        baseline: baseline.performance.efficiency,
        current: current.performance.efficiency,
        change: this.calculatePercentageChange(baseline.performance.efficiency, current.performance.efficiency)
      },
      errorRate: {
        baseline: baseline.errors.totalErrors / baseline.totalResources * 100,
        current: current.errors.totalErrors / current.totalResources * 100,
        change: this.calculatePercentageChange(
          baseline.errors.totalErrors / baseline.totalResources * 100,
          current.errors.totalErrors / current.totalResources * 100
        )
      },
      successRate: {
        baseline: baseline.validResources / baseline.totalResources * 100,
        current: current.validResources / current.totalResources * 100,
        change: this.calculatePercentageChange(
          baseline.validResources / baseline.totalResources * 100,
          current.validResources / current.totalResources * 100
        )
      }
    };
  }

  /**
   * Calculate percentage change
   */
  private calculatePercentageChange(baseline: number, current: number, invert: boolean = false): number {
    if (baseline === 0) return 0;
    
    const change = ((current - baseline) / baseline) * 100;
    return invert ? -change : change;
  }

  /**
   * Calculate improvement
   */
  private calculateImprovement(baseline: ValidationRun, current: ValidationRun): number {
    // Weighted improvement calculation
    const throughputImprovement = this.calculatePercentageChange(baseline.performance.throughput, current.performance.throughput);
    const efficiencyImprovement = this.calculatePercentageChange(baseline.performance.efficiency, current.performance.efficiency);
    const errorReduction = this.calculatePercentageChange(baseline.errors.totalErrors, current.errors.totalErrors, true);
    
    // Weighted average (throughput 40%, efficiency 30%, error reduction 30%)
    return (throughputImprovement * 0.4) + (efficiencyImprovement * 0.3) + (errorReduction * 0.3);
  }

  /**
   * Determine benchmark status
   */
  private determineBenchmarkStatus(baseline: ValidationRun, current: ValidationRun): ValidationBenchmark['status'] {
    const improvement = this.calculateImprovement(baseline, current);
    
    if (improvement > 5) return 'improved';
    if (improvement < -5) return 'degraded';
    return 'stable';
  }

  /**
   * Calculate trend direction
   */
  private calculateTrendDirection(values: number[]): { direction: 'improving' | 'declining' | 'stable'; strength: number } {
    if (values.length < 2) return { direction: 'stable', strength: 0 };

    let increasing = 0;
    let decreasing = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) {
        increasing++;
      } else if (values[i] < values[i - 1]) {
        decreasing++;
      }
    }

    const total = increasing + decreasing;
    if (total === 0) return { direction: 'stable', strength: 0 };

    const increasingRatio = increasing / total;
    const decreasingRatio = decreasing / total;

    if (increasingRatio > 0.6) {
      return { direction: 'improving', strength: increasingRatio };
    } else if (decreasingRatio > 0.6) {
      return { direction: 'declining', strength: decreasingRatio };
    } else {
      return { direction: 'stable', strength: Math.min(increasingRatio, decreasingRatio) };
    }
  }

  /**
   * Determine overall trend
   */
  private determineOverallTrend(trendData: ValidationTrend['trendData']): ValidationTrend['analysis']['trendDirection'] {
    const throughputTrend = this.calculateTrendDirection(trendData.throughput);
    const efficiencyTrend = this.calculateTrendDirection(trendData.efficiency);
    const errorRateTrend = this.calculateTrendDirection(trendData.errorRate);

    let improving = 0;
    let declining = 0;

    if (throughputTrend.direction === 'improving') improving++;
    else if (throughputTrend.direction === 'declining') declining++;

    if (efficiencyTrend.direction === 'improving') improving++;
    else if (efficiencyTrend.direction === 'declining') declining++;

    if (errorRateTrend.direction === 'improving') improving++;
    else if (errorRateTrend.direction === 'declining') declining++;

    if (improving > declining) return 'improving';
    if (declining > improving) return 'declining';
    return 'stable';
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(trendData: ValidationTrend['trendData']): number {
    const throughputTrend = this.calculateTrendDirection(trendData.throughput);
    const efficiencyTrend = this.calculateTrendDirection(trendData.efficiency);
    const errorRateTrend = this.calculateTrendDirection(trendData.errorRate);

    return (throughputTrend.strength + efficiencyTrend.strength + errorRateTrend.strength) / 3;
  }

  /**
   * Get comparison by ID
   */
  getComparison(comparisonId: string): ValidationComparison | null {
    return this.comparisons.get(comparisonId) || null;
  }

  /**
   * Get trend by ID
   */
  getTrend(trendId: string): ValidationTrend | null {
    return this.trends.get(trendId) || null;
  }

  /**
   * Get benchmark by ID
   */
  getBenchmark(benchmarkId: string): ValidationBenchmark | null {
    return this.benchmarks.get(benchmarkId) || null;
  }

  /**
   * Get all comparisons
   */
  getAllComparisons(): ValidationComparison[] {
    return Array.from(this.comparisons.values());
  }

  /**
   * Get all trends
   */
  getAllTrends(): ValidationTrend[] {
    return Array.from(this.trends.values());
  }

  /**
   * Get all benchmarks
   */
  getAllBenchmarks(): ValidationBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Persist comparison
   */
  private async persistComparison(comparison: ValidationComparison): Promise<void> {
    try {
      await storage.saveValidationComparison(comparison);
    } catch (error) {
      console.error('Failed to persist comparison:', error);
    }
  }

  /**
   * Persist trend
   */
  private async persistTrend(trend: ValidationTrend): Promise<void> {
    try {
      await storage.saveValidationTrend(trend);
    } catch (error) {
      console.error('Failed to persist trend:', error);
    }
  }

  /**
   * Persist benchmark
   */
  private async persistBenchmark(benchmark: ValidationBenchmark): Promise<void> {
    try {
      await storage.saveValidationBenchmark(benchmark);
    } catch (error) {
      console.error('Failed to persist benchmark:', error);
    }
  }
}
