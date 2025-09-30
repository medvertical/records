/**
 * Validation Scoring & Coverage Utilities
 * 
 * Provides consistent scoring and counting logic across all views:
 * - Resource list view
 * - Resource detail view
 * - Group views
 * - Dashboard statistics
 * 
 * Ensures parity in calculations and maintains single source of truth
 */

import type { ValidationMessage } from '@/components/validation/ValidationMessageList';

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'information';
export type ValidationAspect = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';

export interface ValidationCounts {
  total: number;
  errors: number;
  warnings: number;
  information: number;
}

export interface AspectValidationData {
  aspect: ValidationAspect;
  enabled: boolean;
  counts: ValidationCounts;
  score: number;
  isValid: boolean;
  messages?: ValidationMessage[];
}

export interface AggregatedValidationSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  aggregatedScore: number;
  isValid: boolean;
  aspectResults: AspectValidationData[];
  enabledAspectsCount: number;
  disabledAspectsCount: number;
}

export interface ValidationSettings {
  aspects?: {
    structural?: { enabled: boolean };
    profile?: { enabled: boolean };
    terminology?: { enabled: boolean };
    reference?: { enabled: boolean };
    businessRule?: { enabled: boolean };
    metadata?: { enabled: boolean };
  };
}

// ============================================================================
// Scoring Constants
// ============================================================================

/**
 * Default scoring weights
 * These values determine how much each issue type affects the score
 */
export const SCORING_WEIGHTS = {
  error: 15,      // Error issues: -15 points each
  warning: 5,     // Warning issues: -5 points each
  information: 1, // Information issues: -1 point each
} as const;

/**
 * Minimum and maximum score bounds
 */
export const SCORE_BOUNDS = {
  min: 0,
  max: 100,
} as const;

// ============================================================================
// Core Counting Functions
// ============================================================================

/**
 * Count validation messages by severity
 */
export function countMessagesBySeverity(
  messages: ValidationMessage[]
): ValidationCounts {
  const counts: ValidationCounts = {
    total: messages.length,
    errors: 0,
    warnings: 0,
    information: 0,
  };

  messages.forEach((message) => {
    switch (message.severity) {
      case 'error':
        counts.errors++;
        break;
      case 'warning':
        counts.warnings++;
        break;
      case 'information':
        counts.information++;
        break;
    }
  });

  return counts;
}

/**
 * Filter messages based on enabled aspects
 */
export function filterMessagesByAspectSettings(
  messages: Array<ValidationMessage & { aspect?: ValidationAspect }>,
  settings?: ValidationSettings
): Array<ValidationMessage & { aspect?: ValidationAspect }> {
  if (!settings?.aspects) {
    return messages; // No settings, return all messages
  }

  return messages.filter((message) => {
    const aspect = message.aspect || 'structural';
    const aspectSettings = settings.aspects?.[aspect];
    return aspectSettings?.enabled !== false; // Default to enabled if not explicitly disabled
  });
}

// ============================================================================
// Score Calculation Functions
// ============================================================================

/**
 * Calculate validation score based on issue counts
 * Uses consistent weights across all views
 */
export function calculateValidationScore(counts: ValidationCounts): number {
  let score = SCORE_BOUNDS.max;
  
  score -= counts.errors * SCORING_WEIGHTS.error;
  score -= counts.warnings * SCORING_WEIGHTS.warning;
  score -= counts.information * SCORING_WEIGHTS.information;
  
  return Math.max(SCORE_BOUNDS.min, Math.min(SCORE_BOUNDS.max, Math.round(score)));
}

/**
 * Calculate aggregated score across multiple aspects
 * Only considers enabled aspects in the calculation
 */
export function calculateAggregatedScore(
  aspectResults: AspectValidationData[]
): number {
  const enabledAspects = aspectResults.filter(r => r.enabled);
  
  if (enabledAspects.length === 0) {
    return SCORE_BOUNDS.max; // No enabled aspects = perfect score
  }
  
  const totalScore = enabledAspects.reduce((sum, aspect) => sum + aspect.score, 0);
  return Math.round(totalScore / enabledAspects.length);
}

/**
 * Calculate score for a single aspect
 */
export function calculateAspectScore(
  messages: ValidationMessage[],
  enabled: boolean = true
): number {
  if (!enabled) {
    return SCORE_BOUNDS.max; // Disabled aspects get perfect score
  }
  
  const counts = countMessagesBySeverity(messages);
  return calculateValidationScore(counts);
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Build aspect validation data from messages
 */
export function buildAspectValidationData(
  aspect: ValidationAspect,
  messages: ValidationMessage[],
  enabled: boolean = true
): AspectValidationData {
  const counts = countMessagesBySeverity(messages);
  const score = calculateValidationScore(counts);
  
  return {
    aspect,
    enabled,
    counts,
    score,
    isValid: counts.errors === 0,
    messages,
  };
}

/**
 * Aggregate validation summary from aspect-specific messages
 * This is the main function used across all views for consistency
 */
export function aggregateValidationSummary(
  messagesGroupedByAspect: Record<ValidationAspect, ValidationMessage[]>,
  settings?: ValidationSettings
): AggregatedValidationSummary {
  const aspects: ValidationAspect[] = [
    'structural',
    'profile',
    'terminology',
    'reference',
    'businessRule',
    'metadata',
  ];

  // Build aspect results
  const aspectResults: AspectValidationData[] = aspects.map((aspect) => {
    const messages = messagesGroupedByAspect[aspect] || [];
    const enabled = settings?.aspects?.[aspect]?.enabled !== false;
    return buildAspectValidationData(aspect, messages, enabled);
  });

  // Calculate aggregated counts (only from enabled aspects)
  const enabledResults = aspectResults.filter(r => r.enabled);
  const totalCounts: ValidationCounts = {
    total: 0,
    errors: 0,
    warnings: 0,
    information: 0,
  };

  enabledResults.forEach((result) => {
    totalCounts.total += result.counts.total;
    totalCounts.errors += result.counts.errors;
    totalCounts.warnings += result.counts.warnings;
    totalCounts.information += result.counts.information;
  });

  // Calculate aggregated score
  const aggregatedScore = calculateAggregatedScore(aspectResults);

  return {
    totalIssues: totalCounts.total,
    errorCount: totalCounts.errors,
    warningCount: totalCounts.warnings,
    informationCount: totalCounts.information,
    aggregatedScore,
    isValid: totalCounts.errors === 0,
    aspectResults,
    enabledAspectsCount: enabledResults.length,
    disabledAspectsCount: aspectResults.length - enabledResults.length,
  };
}

/**
 * Group messages by aspect
 * Helper function for organizing messages before aggregation
 */
export function groupMessagesByAspect(
  messages: Array<ValidationMessage & { aspect?: ValidationAspect }>
): Record<ValidationAspect, ValidationMessage[]> {
  const grouped: Record<ValidationAspect, ValidationMessage[]> = {
    structural: [],
    profile: [],
    terminology: [],
    reference: [],
    businessRule: [],
    metadata: [],
  };

  messages.forEach((message) => {
    const aspect = message.aspect || 'structural';
    if (grouped[aspect]) {
      grouped[aspect].push(message);
    }
  });

  return grouped;
}

// ============================================================================
// Validation Status Helpers
// ============================================================================

/**
 * Get validation status badge variant based on counts
 */
export function getValidationBadgeVariant(counts: ValidationCounts): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (counts.errors > 0) return 'destructive';
  if (counts.warnings > 0) return 'warning';
  if (counts.information > 0) return 'secondary';
  return 'success';
}

/**
 * Get validation status label
 */
export function getValidationStatusLabel(counts: ValidationCounts): string {
  if (counts.errors > 0) return `${counts.errors} Error${counts.errors !== 1 ? 's' : ''}`;
  if (counts.warnings > 0) return `${counts.warnings} Warning${counts.warnings !== 1 ? 's' : ''}`;
  if (counts.information > 0) return `${counts.information} Info`;
  return 'Valid';
}

/**
 * Format score for display with color coding
 */
export function getScoreColorClass(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Validate parity between two validation summaries
 * Used for testing consistency across views
 */
export function validateSummaryParity(
  summary1: AggregatedValidationSummary,
  summary2: AggregatedValidationSummary
): { isParity: boolean; differences: string[] } {
  const differences: string[] = [];

  if (summary1.totalIssues !== summary2.totalIssues) {
    differences.push(`Total issues mismatch: ${summary1.totalIssues} vs ${summary2.totalIssues}`);
  }

  if (summary1.errorCount !== summary2.errorCount) {
    differences.push(`Error count mismatch: ${summary1.errorCount} vs ${summary2.errorCount}`);
  }

  if (summary1.warningCount !== summary2.warningCount) {
    differences.push(`Warning count mismatch: ${summary1.warningCount} vs ${summary2.warningCount}`);
  }

  if (summary1.aggregatedScore !== summary2.aggregatedScore) {
    differences.push(`Aggregated score mismatch: ${summary1.aggregatedScore} vs ${summary2.aggregatedScore}`);
  }

  return {
    isParity: differences.length === 0,
    differences,
  };
}
