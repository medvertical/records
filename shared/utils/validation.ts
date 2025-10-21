// ============================================================================
// Validation Data Utilities
// ============================================================================

/**
 * Validation data sanitization and bounds checking utilities
 */

/**
 * Ensure a percentage value is within 0-100 bounds
 */
export function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Ensure a count value is non-negative
 */
export function clampCount(value: number): number {
  return Math.max(0, value);
}

/**
 * Calculate validation rate with bounds checking
 */
export function calculateValidationRate(validated: number, total: number): number {
  if (total <= 0 || isNaN(total) || isNaN(validated)) return 0;
  return clampPercentage((validated / total) * 100);
}

/**
 * Calculate success rate with bounds checking
 */
export function calculateSuccessRate(valid: number, validated: number): number {
  if (validated <= 0 || isNaN(validated) || isNaN(valid)) return 0;
  return clampPercentage((valid / validated) * 100);
}

/**
 * Calculate unvalidated count with bounds checking
 */
export function calculateUnvalidatedCount(total: number, validated: number): number {
  return clampCount(total - validated);
}

/**
 * Calculate error count with bounds checking
 */
export function calculateErrorCount(validated: number, valid: number): number {
  return clampCount(validated - valid);
}

/**
 * Sanitize validation statistics data
 */
export function sanitizeValidationStats(stats: any): any {
  return {
    ...stats,
    totalValidated: clampCount(stats.totalValidated || 0),
    validResources: clampCount(stats.validResources || 0),
    errorResources: clampCount(stats.errorResources || 0),
    warningResources: clampCount(stats.warningResources || 0),
    unvalidatedResources: clampCount(stats.unvalidatedResources || 0),
    validationCoverage: clampPercentage(stats.validationCoverage || 0),
    validationProgress: clampPercentage(stats.validationProgress || 0),
    resourceTypeBreakdown: Object.fromEntries(
      Object.entries(stats.resourceTypeBreakdown || {}).map(([type, breakdown]: [string, any]) => [
        type,
        {
          total: clampCount(breakdown.total || 0),
          validated: clampCount(breakdown.validated || 0),
          valid: clampCount(breakdown.valid || 0),
          errors: calculateErrorCount(breakdown.validated || 0, breakdown.valid || 0),
          warnings: clampCount(breakdown.warnings || 0),
          unvalidated: calculateUnvalidatedCount(breakdown.total || 0, breakdown.validated || 0),
          validationRate: calculateValidationRate(breakdown.validated || 0, breakdown.total || 0),
          successRate: calculateSuccessRate(breakdown.valid || 0, breakdown.validated || 0)
        }
      ])
    )
  };
}

/**
 * Validate that validation statistics are consistent
 */
export function validateValidationStatsConsistency(stats: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check basic consistency (include warning resources)
  const expectedTotal = stats.validResources + stats.errorResources + (stats.warningResources || 0);
  if (stats.totalValidated !== expectedTotal) {
    errors.push(`Total validated (${stats.totalValidated}) doesn't match valid + error + warning resources (${expectedTotal})`);
  }
  
  // Check resource type breakdown consistency
  Object.entries(stats.resourceTypeBreakdown || {}).forEach(([type, breakdown]: [string, any]) => {
    const expectedValidated = breakdown.valid + breakdown.errors + (breakdown.warnings || 0);
    if (breakdown.validated !== expectedValidated) {
      errors.push(`Resource type ${type}: validated (${breakdown.validated}) doesn't match valid + errors + warnings (${expectedValidated})`);
    }
    
    if (breakdown.total !== breakdown.validated + breakdown.unvalidated) {
      errors.push(`Resource type ${type}: total (${breakdown.total}) doesn't match validated + unvalidated (${breakdown.validated + breakdown.unvalidated})`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get fallback validation statistics for error cases
 */
export function getFallbackValidationStats(): any {
  return {
    totalValidated: 0,
    validResources: 0,
    errorResources: 0,
    warningResources: 0,
    unvalidatedResources: 0,
    validationCoverage: 0,
    validationProgress: 0,
    lastValidationRun: new Date(),
    resourceTypeBreakdown: {},
    aspectBreakdown: {
      structural: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      profile: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      terminology: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      reference: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      businessRule: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      metadata: { enabled: true, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 }
    }
  };
}
