/**
 * Validation Result Builder
 * 
 * Extracted from ConsolidatedValidationService to handle result transformation
 * and building. Follows Single Responsibility Principle.
 * 
 * Responsibilities:
 * - Build detailed results from engine output
 * - Build detailed results from stored data
 * - Normalize issues and aspects
 * - Calculate summaries and scores
 * - Transform between different result formats
 * 
 * File size: Target <400 lines
 */

import type {
  InsertValidationResult,
  ValidationResult as StoredValidationResult,
} from '@shared/schema';
import type {
  ValidationAspectResult,
  ValidationIssue as EngineValidationIssue,
  ValidationResult as EngineValidationResult,
} from '../types/validation-types';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

// ============================================================================
// Types
// ============================================================================

export interface DetailedValidationIssue extends EngineValidationIssue {
  category?: string;
}

export interface ValidationSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  score: number;
}

export interface ValidationPerformanceSummary {
  totalTimeMs: number;
  aspectTimes: Record<string, number>;
}

export interface DetailedValidationResult {
  resourceType: string;
  resourceId: string | null;
  isValid: boolean;
  issues: DetailedValidationIssue[];
  aspects?: ValidationAspectResult[];
  summary: ValidationSummary;
  performance: ValidationPerformanceSummary;
  validatedAt: string;
  validationTime?: number;
  wasFiltered?: boolean;
  filterReason?: string;
}

// ============================================================================
// Validation Result Builder
// ============================================================================

export class ValidationResultBuilder {
  /**
   * Build detailed result from engine output
   */
  buildFromEngine(
    result: EngineValidationResult,
    resourceType: string,
    resourceId: string | null
  ): DetailedValidationResult {
    const issues = this.normalizeIssues(result.issues || []);
    const summary = this.buildSummary(issues, result.isValid);
    const performance = this.buildPerformanceFromEngine(result);
    const validatedAt = result.validatedAt instanceof Date
      ? result.validatedAt.toISOString()
      : new Date().toISOString();

    return {
      resourceType,
      resourceId,
      isValid: result.isValid,
      issues,
      aspects: result.aspects,
      summary,
      performance,
      validatedAt,
      validationTime: result.validationTime,
    };
  }

  /**
   * Build detailed result from stored data
   */
  buildFromStored(
    stored: StoredValidationResult,
    resourceType: string,
    resourceId: string | null
  ): DetailedValidationResult {
    const issues = this.normalizeIssues(Array.isArray(stored.issues) ? stored.issues : []);
    const summary = this.buildSummary(issues, stored.isValid, {
      totalIssues: Array.isArray(stored.issues) ? stored.issues.length : undefined,
      errorCount: stored.errorCount ?? undefined,
      warningCount: stored.warningCount ?? undefined,
      score: stored.validationScore ?? undefined,
    });
    const performance = this.buildPerformanceFromStored(stored);
    const validatedAt = stored.validatedAt
      ? new Date(stored.validatedAt).toISOString()
      : new Date().toISOString();

    return {
      resourceType,
      resourceId,
      isValid: stored.isValid,
      issues,
      summary,
      performance,
      validatedAt,
    };
  }

  /**
   * Create empty result (for filtered or skipped resources)
   */
  createEmpty(resource: any): DetailedValidationResult {
    return {
      resourceType: resource?.resourceType || 'Unknown',
      resourceId: resource?.id ?? null,
      isValid: true,
      issues: [],
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        informationCount: 0,
        score: 100,
      },
      performance: {
        totalTimeMs: 0,
        aspectTimes: {},
      },
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build insert validation result for database storage
   */
  buildInsertResult(
    resourceId: number,
    detailedResult: DetailedValidationResult,
    resourceHash: string,
    engineResult?: EngineValidationResult
  ): InsertValidationResult {
    const errorIssues = detailedResult.issues.filter(issue => this.isErrorSeverity(issue.severity));
    const warningIssues = detailedResult.issues.filter(issue => issue.severity === 'warning');

    return {
      resourceId,
      profileId: null,
      isValid: detailedResult.isValid,
      errors: errorIssues,
      warnings: warningIssues,
      issues: detailedResult.issues,
      errorCount: detailedResult.summary.errorCount,
      warningCount: detailedResult.summary.warningCount,
      validationScore: detailedResult.summary.score,
      validatedAt: new Date(detailedResult.validatedAt),
      resourceHash,
      performanceMetrics: detailedResult.performance,
      aspectBreakdown: this.buildAspectBreakdown(engineResult?.aspects),
      validationDurationMs: detailedResult.performance.totalTimeMs,
    };
  }

  /**
   * Build aspect breakdown for storage
   */
  buildAspectBreakdown(aspects?: ValidationAspectResult[]): Record<string, any> {
    // Initialize with all aspects as skipped
    const baseline = ALL_VALIDATION_ASPECTS.reduce<Record<string, any>>((acc, aspect) => {
      const key = this.normalizeAspectKey(aspect) ?? aspect;
      acc[key] = {
        issueCount: 0,
        errorCount: 0,
        warningCount: 0,
        informationCount: 0,
        validationScore: 0,
        passed: false,
        enabled: false,
        status: 'skipped',
        reason: 'Aspect result unavailable',
        duration: 0,
        issues: []
      };
      return acc;
    }, {});

    if (!aspects || aspects.length === 0) {
      return baseline;
    }

    // Overlay actual aspect results
    aspects.forEach(aspect => {
      const key = this.normalizeAspectKey(aspect.aspect) ?? aspect.aspect;
      if (!key) return;

      baseline[key] = {
        issueCount: aspect.issues?.length || 0,
        errorCount: aspect.issues?.filter(i => this.isErrorSeverity(i.severity)).length || 0,
        warningCount: aspect.issues?.filter(i => i.severity === 'warning').length || 0,
        informationCount: aspect.issues?.filter(i => this.isInformationSeverity(i.severity)).length || 0,
        validationScore: aspect.score ?? 0,
        passed: aspect.isValid,
        enabled: true,
        status: aspect.isValid ? 'passed' : 'failed',
        reason: aspect.isValid ? 'Validation passed' : 'Validation failed',
        duration: aspect.validationTime ?? 0,
        issues: aspect.issues || []
      };
    });

    return baseline;
  }

  /**
   * Build validation summary
   */
  buildSummary(
    issues: DetailedValidationIssue[],
    isValid: boolean,
    override?: Partial<ValidationSummary>
  ): ValidationSummary {
    const errorCount = override?.errorCount ?? 
      issues.filter(i => this.isErrorSeverity(i.severity)).length;
    const warningCount = override?.warningCount ?? 
      issues.filter(i => i.severity === 'warning').length;
    const informationCount = override?.informationCount ?? 
      issues.filter(i => this.isInformationSeverity(i.severity)).length;
    const totalIssues = override?.totalIssues ?? issues.length;

    // Calculate score: 100 - (errors * 10) - (warnings * 2), min 0
    const score = override?.score ?? Math.max(0, 100 - (errorCount * 10) - (warningCount * 2));

    return {
      totalIssues,
      errorCount,
      warningCount,
      informationCount,
      score,
    };
  }

  /**
   * Build performance summary from engine result
   */
  buildPerformanceFromEngine(result: EngineValidationResult): ValidationPerformanceSummary {
    const aspectTimes: Record<string, number> = {};
    
    if (result.aspects) {
      result.aspects.forEach(aspect => {
        const key = this.normalizeAspectKey(aspect.aspect) ?? aspect.aspect;
        if (key && aspect.validationTime !== undefined) {
          aspectTimes[key] = aspect.validationTime;
        }
      });
    }

    return {
      totalTimeMs: result.validationTime ?? 0,
      aspectTimes,
    };
  }

  /**
   * Build performance summary from stored result
   */
  buildPerformanceFromStored(stored: StoredValidationResult): ValidationPerformanceSummary {
    const aspectTimes: Record<string, number> = {};
    
    if (stored.aspectBreakdown && typeof stored.aspectBreakdown === 'object') {
      Object.entries(stored.aspectBreakdown).forEach(([key, value]: [string, any]) => {
        if (value && typeof value === 'object' && 'duration' in value) {
          aspectTimes[key] = value.duration;
        }
      });
    }

    return {
      totalTimeMs: stored.validationDurationMs ?? 0,
      aspectTimes,
    };
  }

  /**
   * Normalize issues to consistent format
   */
  normalizeIssues(issues: Array<EngineValidationIssue | any>): DetailedValidationIssue[] {
    return issues.map(issue => {
      const category = this.mapAspectToCategory(issue.aspect);
      
      return {
        ...issue,
        severity: issue.severity || 'error',
        code: issue.code || 'unknown',
        message: issue.message || 'Unknown validation issue',
        location: issue.location || issue.path || undefined,
        aspect: issue.aspect || 'structural',
        category,
      };
    });
  }

  /**
   * Map aspect to category
   */
  private mapAspectToCategory(aspect?: string): string {
    if (!aspect) return 'general';
    
    const normalized = aspect.toLowerCase();
    const categoryMap: Record<string, string> = {
      'structural': 'structure',
      'profile': 'conformance',
      'terminology': 'vocabulary',
      'reference': 'links',
      'businessrule': 'rules',
      'business-rule': 'rules',
      'business_rule': 'rules',
      'metadata': 'metadata',
    };

    return categoryMap[normalized] || 'general';
  }

  /**
   * Normalize aspect key for consistency
   */
  private normalizeAspectKey(aspect?: string): string | null {
    if (!aspect) return null;
    
    const normalized = aspect.toLowerCase().replace(/[-_]/g, '');
    const keyMap: Record<string, string> = {
      'businessrule': 'businessRule',
      'structuralvalidation': 'structural',
      'profilevalidation': 'profile',
      'terminologyvalidation': 'terminology',
      'referencevalidation': 'reference',
      'metadatavalidation': 'metadata',
    };

    return keyMap[normalized] || aspect;
  }

  /**
   * Check if severity is error level
   */
  private isErrorSeverity(severity?: string): boolean {
    return severity === 'error' || severity === 'fatal';
  }

  /**
   * Check if severity is information level
   */
  private isInformationSeverity(severity?: string): boolean {
    return severity === 'information' || severity === 'info';
  }
}

// Singleton instance
let builderInstance: ValidationResultBuilder | null = null;

/**
 * Get singleton instance of ValidationResultBuilder
 */
export function getValidationResultBuilder(): ValidationResultBuilder {
  if (!builderInstance) {
    builderInstance = new ValidationResultBuilder();
  }
  return builderInstance;
}

