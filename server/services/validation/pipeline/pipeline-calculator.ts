/**
 * Pipeline Calculator
 * 
 * Handles calculation of pipeline summaries, performance metrics, and statistics.
 */

import type { ValidationResult } from '../types/validation-types';
import type { ValidationAspect } from '@shared/validation-settings-simplified';
import { PipelineSummary, PipelinePerformance, MemoryUsage, ConcurrencyStats } from './pipeline-types';

// ============================================================================
// Pipeline Calculator Class
// ============================================================================

export class PipelineCalculator {
  
  // ========================================================================
  // Summary Calculation
  // ========================================================================

  /**
   * Calculate pipeline summary from results
   */
  static calculatePipelineSummary(results: ValidationResult[]): PipelineSummary {
    const totalResources = results.length;
    const successfulValidations = results.filter(r => r.isValid).length;
    const failedValidations = results.filter(r => !r.isValid).length;
    const resourcesWithErrors = results.filter(r => r.summary.errorCount > 0).length;
    const resourcesWithWarnings = results.filter(r => r.summary.warningCount > 0).length;
    
    const overallValidationScore = results.length > 0 
      ? results.reduce((sum, r) => sum + r.summary.validationScore, 0) / results.length
      : 100;

    // Calculate issues by aspect
    const issuesByAspect: Record<ValidationAspect, number> = {
      structural: 0,
      profile: 0,
      terminology: 0,
      reference: 0,
      businessRule: 0,
      metadata: 0
    };

    for (const result of results) {
      for (const [aspect, count] of Object.entries(result.summary.issuesByAspect)) {
        issuesByAspect[aspect as ValidationAspect] += count;
      }
    }

    // Calculate common issues
    const commonIssues = this.calculateCommonIssues(results);

    return {
      totalResources,
      successfulValidations,
      failedValidations,
      resourcesWithErrors,
      resourcesWithWarnings,
      overallValidationScore,
      issuesByAspect,
      commonIssues
    };
  }

  /**
   * Calculate common issues across all results
   */
  private static calculateCommonIssues(results: ValidationResult[]): Array<{
    code: string;
    message: string;
    count: number;
  }> {
    const issueCounts = new Map<string, { code: string; message: string; count: number }>();
    
    for (const result of results) {
      for (const issue of result.issues) {
        const key = `${issue.code}:${issue.message}`;
        const existing = issueCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          issueCounts.set(key, {
            code: issue.code,
            message: issue.message,
            count: 1
          });
        }
      }
    }

    return Array.from(issueCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // ========================================================================
  // Performance Calculation
  // ========================================================================

  /**
   * Calculate pipeline performance metrics
   */
  static calculatePipelinePerformance(results: ValidationResult[], startTime: number): PipelinePerformance {
    const totalTimeMs = Date.now() - startTime;
    const validationTimes = results.map(r => r.performance.totalTimeMs);
    
    const averageValidationTimeMs = validationTimes.length > 0
      ? validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length
      : 0;
    
    const fastestValidationTimeMs = validationTimes.length > 0 ? Math.min(...validationTimes) : 0;
    const slowestValidationTimeMs = validationTimes.length > 0 ? Math.max(...validationTimes) : 0;
    
    const throughput = totalTimeMs > 0 ? (results.length / totalTimeMs) * 1000 : 0;

    return {
      totalTimeMs,
      averageValidationTimeMs,
      fastestValidationTimeMs,
      slowestValidationTimeMs,
      throughput,
      memoryUsage: this.calculateMemoryUsage(results),
      concurrency: this.calculateConcurrencyStats(results)
    };
  }

  /**
   * Calculate memory usage statistics
   */
  private static calculateMemoryUsage(results: ValidationResult[]): MemoryUsage {
    // This is a simplified calculation - in a real implementation,
    // you would track actual memory usage during execution
    
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const averageIssuesPerResource = results.length > 0 ? totalIssues / results.length : 0;
    
    // Estimate memory usage based on results size
    const estimatedMemoryPerResource = 0.1; // MB per resource (rough estimate)
    const peakMemoryMB = results.length * estimatedMemoryPerResource;
    const averageMemoryMB = peakMemoryMB * 0.7; // Assume 70% average usage
    const finalMemoryMB = peakMemoryMB * 0.5; // Assume 50% final usage after cleanup

    return {
      peakMemoryMB,
      averageMemoryMB,
      finalMemoryMB
    };
  }

  /**
   * Calculate concurrency statistics
   */
  private static calculateConcurrencyStats(results: ValidationResult[]): ConcurrencyStats {
    // This is a simplified calculation - in a real implementation,
    // you would track actual concurrency during execution
    
    const maxConcurrentValidations = 10; // Default value
    const averageConcurrency = results.length > 0 ? Math.min(results.length, maxConcurrentValidations) : 0;
    const peakConcurrency = Math.min(results.length, maxConcurrentValidations);

    return {
      maxConcurrentValidations,
      averageConcurrency,
      peakConcurrency
    };
  }

  // ========================================================================
  // Statistical Analysis
  // ========================================================================

  /**
   * Calculate validation statistics
   */
  static calculateValidationStats(results: ValidationResult[]): {
    successRate: number;
    errorRate: number;
    warningRate: number;
    averageIssuesPerResource: number;
    mostProblematicAspect: ValidationAspect | null;
    leastProblematicAspect: ValidationAspect | null;
  } {
    if (results.length === 0) {
      return {
        successRate: 0,
        errorRate: 0,
        warningRate: 0,
        averageIssuesPerResource: 0,
        mostProblematicAspect: null,
        leastProblematicAspect: null
      };
    }

    const successfulValidations = results.filter(r => r.isValid).length;
    const resourcesWithErrors = results.filter(r => r.summary.errorCount > 0).length;
    const resourcesWithWarnings = results.filter(r => r.summary.warningCount > 0).length;
    
    const successRate = (successfulValidations / results.length) * 100;
    const errorRate = (resourcesWithErrors / results.length) * 100;
    const warningRate = (resourcesWithWarnings / results.length) * 100;
    
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const averageIssuesPerResource = totalIssues / results.length;

    // Calculate aspect statistics
    const aspectStats = this.calculateAspectStats(results);
    const mostProblematicAspect = aspectStats.mostProblematic;
    const leastProblematicAspect = aspectStats.leastProblematic;

    return {
      successRate,
      errorRate,
      warningRate,
      averageIssuesPerResource,
      mostProblematicAspect,
      leastProblematicAspect
    };
  }

  /**
   * Calculate aspect-specific statistics
   */
  private static calculateAspectStats(results: ValidationResult[]): {
    mostProblematic: ValidationAspect | null;
    leastProblematic: ValidationAspect | null;
    aspectCounts: Record<ValidationAspect, number>;
  } {
    const aspectCounts: Record<ValidationAspect, number> = {
      structural: 0,
      profile: 0,
      terminology: 0,
      reference: 0,
      businessRule: 0,
      metadata: 0
    };

    for (const result of results) {
      for (const [aspect, count] of Object.entries(result.summary.issuesByAspect)) {
        aspectCounts[aspect as ValidationAspect] += count;
      }
    }

    const sortedAspects = Object.entries(aspectCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([aspect]) => aspect as ValidationAspect);

    return {
      mostProblematic: sortedAspects[0] || null,
      leastProblematic: sortedAspects[sortedAspects.length - 1] || null,
      aspectCounts
    };
  }

  // ========================================================================
  // Performance Analysis
  // ========================================================================

  /**
   * Analyze performance bottlenecks
   */
  static analyzePerformanceBottlenecks(results: ValidationResult[]): {
    slowestAspects: Array<{ aspect: ValidationAspect; averageTime: number }>;
    performanceIssues: string[];
    recommendations: string[];
  } {
    const aspectTimes: Record<ValidationAspect, number[]> = {
      structural: [],
      profile: [],
      terminology: [],
      reference: [],
      businessRule: [],
      metadata: []
    };

    // Collect timing data for each aspect
    for (const result of results) {
      for (const [aspect, time] of Object.entries(result.performance.aspectTimes)) {
        aspectTimes[aspect as ValidationAspect].push(time);
      }
    }

    // Calculate average times for each aspect
    const slowestAspects = Object.entries(aspectTimes)
      .map(([aspect, times]) => ({
        aspect: aspect as ValidationAspect,
        averageTime: times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0
      }))
      .sort((a, b) => b.averageTime - a.averageTime);

    // Identify performance issues
    const performanceIssues: string[] = [];
    const recommendations: string[] = [];

    // Check for slow aspects
    const slowestAspect = slowestAspects[0];
    if (slowestAspect && slowestAspect.averageTime > 5000) { // 5 seconds
      performanceIssues.push(`${slowestAspect.aspect} validation is taking too long (${slowestAspect.averageTime.toFixed(0)}ms average)`);
      recommendations.push(`Consider optimizing ${slowestAspect.aspect} validation or increasing timeout`);
    }

    // Check for high variance in timing
    const totalTimes = results.map(r => r.performance.totalTimeMs);
    const averageTime = totalTimes.reduce((sum, time) => sum + time, 0) / totalTimes.length;
    const variance = totalTimes.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / totalTimes.length;
    const standardDeviation = Math.sqrt(variance);

    if (standardDeviation > averageTime * 0.5) { // High variance
      performanceIssues.push('High variance in validation times indicates inconsistent performance');
      recommendations.push('Investigate resource-specific performance issues');
    }

    // Check for memory issues
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    if (totalIssues > results.length * 10) { // More than 10 issues per resource on average
      performanceIssues.push('High number of validation issues may impact performance');
      recommendations.push('Consider filtering or prioritizing validation rules');
    }

    return {
      slowestAspects,
      performanceIssues,
      recommendations
    };
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Create empty summary
   */
  static createEmptySummary(): PipelineSummary {
    return {
      totalResources: 0,
      successfulValidations: 0,
      failedValidations: 0,
      resourcesWithErrors: 0,
      resourcesWithWarnings: 0,
      overallValidationScore: 0,
      issuesByAspect: {
        structural: 0,
        profile: 0,
        terminology: 0,
        reference: 0,
        businessRule: 0,
        metadata: 0
      },
      commonIssues: []
    };
  }

  /**
   * Create empty performance metrics
   */
  static createEmptyPerformance(startTime: number): PipelinePerformance {
    return {
      totalTimeMs: Date.now() - startTime,
      averageValidationTimeMs: 0,
      fastestValidationTimeMs: 0,
      slowestValidationTimeMs: 0,
      throughput: 0,
      memoryUsage: {
        peakMemoryMB: 0,
        averageMemoryMB: 0,
        finalMemoryMB: 0
      },
      concurrency: {
        maxConcurrentValidations: 0,
        averageConcurrency: 0,
        peakConcurrency: 0
      }
    };
  }

  /**
   * Format performance metrics for display
   */
  static formatPerformanceMetrics(performance: PipelinePerformance): {
    totalTime: string;
    averageTime: string;
    throughput: string;
    memoryUsage: string;
  } {
    return {
      totalTime: this.formatDuration(performance.totalTimeMs),
      averageTime: this.formatDuration(performance.averageValidationTimeMs),
      throughput: `${performance.throughput.toFixed(2)} resources/sec`,
      memoryUsage: `${performance.memoryUsage.peakMemoryMB.toFixed(1)} MB peak`
    };
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  private static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  }
}
