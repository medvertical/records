/**
 * Validation Scoring & Coverage Utilities - MVP Version
 * 
 * Simplified scoring and counting logic for validation results:
 * - Resource validation scoring
 * - Aspect-based scoring
 * - Coverage calculations
 * - Quality metrics
 */

import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationAspect = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';

export interface ValidationCounts {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

export interface AspectValidationData {
  aspect: ValidationAspect;
  enabled: boolean;
  counts: ValidationCounts;
  score: number;
  isValid: boolean;
  messages?: ValidationMessage[];
}

export interface ValidationMessage {
  id: string;
  severity: ValidationSeverity;
  message: string;
  location?: string;
  aspect: ValidationAspect;
}

export interface AggregatedValidationSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  aggregatedScore: number;
  isValid: boolean;
  aspectResults: AspectValidationData[];
  enabledAspectsCount: number;
  disabledAspectsCount: number;
}

export interface ResourceValidationSummary {
  resourceId: string;
  resourceType: string;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  score: number;
  isValid: boolean;
  aspectResults: AspectValidationData[];
  lastValidated?: Date;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate validation score based on counts
 */
export function calculateValidationScore(counts: ValidationCounts): number {
  if (counts.total === 0) return 100;
  
  const errorWeight = 3;
  const warningWeight = 2;
  const infoWeight = 1;
  
  const weightedIssues = (counts.errors * errorWeight) + (counts.warnings * warningWeight) + (counts.info * infoWeight);
  const maxPossibleIssues = counts.total * errorWeight;
  
  const score = Math.max(0, 100 - (weightedIssues / maxPossibleIssues) * 100);
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate aspect score
 */
export function calculateAspectScore(aspect: ValidationAspect, counts: ValidationCounts, settings: ValidationSettings | null): number {
  if (!settings) return calculateValidationScore(counts);
  
  const aspectConfig = settings.aspects[aspect];
  if (!aspectConfig.enabled) return 100; // Perfect score for disabled aspects
  
  return calculateValidationScore(counts);
}

/**
 * Calculate aggregated score from multiple aspects
 */
export function calculateAggregatedScore(aspectResults: AspectValidationData[]): number {
  if (aspectResults.length === 0) return 100;
  
  const enabledAspects = aspectResults.filter(result => result.enabled);
  if (enabledAspects.length === 0) return 100;
  
  const totalScore = enabledAspects.reduce((sum, result) => sum + result.score, 0);
  return Math.round((totalScore / enabledAspects.length) * 100) / 100;
}

/**
 * Determine if validation is valid based on settings
 */
export function isValidationValid(counts: ValidationCounts, settings: ValidationSettings | null): boolean {
  if (!settings) return counts.errors === 0;
  
  // Check if any enabled aspect has errors
  const enabledAspects = Object.entries(settings.aspects)
    .filter(([_, config]) => config.enabled)
    .map(([aspect, _]) => aspect as ValidationAspect);
  
  // For now, consider valid if no errors
  return counts.errors === 0;
}

/**
 * Get validation counts from messages
 */
export function getValidationCounts(messages: ValidationMessage[]): ValidationCounts {
  return {
    total: messages.length,
    errors: messages.filter(m => m.severity === 'error').length,
    warnings: messages.filter(m => m.severity === 'warning').length,
    info: messages.filter(m => m.severity === 'info').length
  };
}

/**
 * Get aspect validation data
 */
export function getAspectValidationData(
  aspect: ValidationAspect,
  messages: ValidationMessage[],
  settings: ValidationSettings | null
): AspectValidationData {
  const aspectMessages = messages.filter(m => m.aspect === aspect);
  const counts = getValidationCounts(aspectMessages);
  const score = calculateAspectScore(aspect, counts, settings);
  const aspectConfig = settings?.aspects[aspect];
  
  return {
    aspect,
    enabled: aspectConfig?.enabled || false,
    counts,
    score,
    isValid: isValidationValid(counts, settings),
    messages: aspectMessages
  };
}

/**
 * Get aggregated validation summary
 */
export function getAggregatedValidationSummary(
  messages: ValidationMessage[],
  settings: ValidationSettings | null
): AggregatedValidationSummary {
  const allAspects: ValidationAspect[] = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
  
  const aspectResults = allAspects.map(aspect => 
    getAspectValidationData(aspect, messages, settings)
  );
  
  const totalCounts = getValidationCounts(messages);
  const aggregatedScore = calculateAggregatedScore(aspectResults);
  const isValid = isValidationValid(totalCounts, settings);
  
  const enabledAspectsCount = aspectResults.filter(result => result.enabled).length;
  const disabledAspectsCount = aspectResults.filter(result => !result.enabled).length;
  
  return {
    totalIssues: totalCounts.total,
    errorCount: totalCounts.errors,
    warningCount: totalCounts.warnings,
    infoCount: totalCounts.info,
    aggregatedScore,
    isValid,
    aspectResults,
    enabledAspectsCount,
    disabledAspectsCount
  };
}

/**
 * Get resource validation summary
 */
export function getResourceValidationSummary(
  resourceId: string,
  resourceType: string,
  messages: ValidationMessage[],
  settings: ValidationSettings | null,
  lastValidated?: Date
): ResourceValidationSummary {
  const summary = getAggregatedValidationSummary(messages, settings);
  
  return {
    resourceId,
    resourceType,
    totalIssues: summary.totalIssues,
    errorCount: summary.errorCount,
    warningCount: summary.warningCount,
    infoCount: summary.infoCount,
    score: summary.aggregatedScore,
    isValid: summary.isValid,
    aspectResults: summary.aspectResults,
    lastValidated
  };
}

// ============================================================================
// Coverage Functions
// ============================================================================

/**
 * Calculate validation coverage percentage
 */
export function calculateValidationCoverage(
  validatedResources: number,
  totalResources: number
): number {
  if (totalResources === 0) return 100;
  
  const coverage = (validatedResources / totalResources) * 100;
  return Math.round(coverage * 100) / 100;
}

/**
 * Get coverage status
 */
export function getCoverageStatus(coverage: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (coverage >= 95) return 'excellent';
  if (coverage >= 80) return 'good';
  if (coverage >= 60) return 'fair';
  return 'poor';
}

/**
 * Get coverage color
 */
export function getCoverageColor(coverage: number): string {
  const status = getCoverageStatus(coverage);
  
  const colors: Record<string, string> = {
    excellent: 'text-green-600',
    good: 'text-blue-600',
    fair: 'text-yellow-600',
    poor: 'text-red-600'
  };
  
  return colors[status] || 'text-gray-600';
}

// ============================================================================
// Quality Metrics
// ============================================================================

/**
 * Calculate quality metrics
 */
export function calculateQualityMetrics(
  summaries: ResourceValidationSummary[]
): {
  averageScore: number;
  medianScore: number;
  validResources: number;
  invalidResources: number;
  totalResources: number;
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
} {
  if (summaries.length === 0) {
    return {
      averageScore: 100,
      medianScore: 100,
      validResources: 0,
      invalidResources: 0,
      totalResources: 0,
      qualityGrade: 'A'
    };
  }
  
  const scores = summaries.map(s => s.score).sort((a, b) => a - b);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const medianScore = scores[Math.floor(scores.length / 2)];
  
  const validResources = summaries.filter(s => s.isValid).length;
  const invalidResources = summaries.filter(s => !s.isValid).length;
  
  let qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (averageScore >= 90) qualityGrade = 'A';
  else if (averageScore >= 80) qualityGrade = 'B';
  else if (averageScore >= 70) qualityGrade = 'C';
  else if (averageScore >= 60) qualityGrade = 'D';
  else qualityGrade = 'F';
  
  return {
    averageScore: Math.round(averageScore * 100) / 100,
    medianScore: Math.round(medianScore * 100) / 100,
    validResources,
    invalidResources,
    totalResources: summaries.length,
    qualityGrade
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get aspect display name
 */
export function getAspectDisplayName(aspect: ValidationAspect): string {
  const names: Record<ValidationAspect, string> = {
    structural: 'Structural',
    profile: 'Profile',
    terminology: 'Terminology',
    reference: 'Reference',
    businessRule: 'Business Rules',
    metadata: 'Metadata'
  };
  
  return names[aspect] || aspect;
}

/**
 * Get severity display name
 */
export function getSeverityDisplayName(severity: ValidationSeverity): string {
  const names: Record<ValidationSeverity, string> = {
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  };
  
  return names[severity] || severity;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: ValidationSeverity): string {
  const colors: Record<ValidationSeverity, string> = {
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  };
  
  return colors[severity] || 'text-gray-600';
}

/**
 * Get score color
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-yellow-600';
  if (score >= 60) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Format score as percentage
 */
export function formatScore(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Format coverage as percentage
 */
export function formatCoverage(coverage: number): string {
  return `${Math.round(coverage)}%`;
}