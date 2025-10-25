import { getFilteredValidationSummary } from './validation-filtering-utils';

export interface ValidationSummary {
  totalResources: number;
  validatedCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface ValidationSummaryWithStats extends ValidationSummary {
  aspectStats: {
    [key: string]: {
      valid: number;
      invalid: number;
      warnings: number;
      total: number;
    };
  };
  severityStats: {
    [key: string]: {
      count: number;
      resourceCount: number;
    };
  };
}

/**
 * Calculate validation summary statistics for resources
 * Includes aspect breakdown and severity stats
 */
export function calculateValidationSummaryWithStats(
  resources: any[] | undefined,
  currentSettings: any
): ValidationSummaryWithStats {
  if (!resources) {
    return {
      totalResources: 0,
      validatedCount: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      aspectStats: {},
      severityStats: {},
    };
  }

  // Count all resources on the current page
  const totalResources = resources.length;
  const validatedResources = resources.filter((r: any) => r._validationSummary?.lastValidated);
  
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  // Initialize aspect stats with the aspect IDs expected by the frontend component
  const aspectStats: { [key: string]: { valid: number; invalid: number; warnings: number; total: number } } = {
    structural: { valid: 0, invalid: 0, warnings: 0, total: 0 },
    profile: { valid: 0, invalid: 0, warnings: 0, total: 0 },
    terminology: { valid: 0, invalid: 0, warnings: 0, total: 0 },
    reference: { valid: 0, invalid: 0, warnings: 0, total: 0 },
    businessRule: { valid: 0, invalid: 0, warnings: 0, total: 0 },
    metadata: { valid: 0, invalid: 0, warnings: 0, total: 0 },
  };

  // Initialize severity stats
  const severityStats: { [key: string]: { count: number; resourceCount: number } } = {
    error: { count: 0, resourceCount: 0 },
    warning: { count: 0, resourceCount: 0 },
    information: { count: 0, resourceCount: 0 },
  };

  validatedResources.forEach((r: any) => {
    if (r._validationSummary) {
      // Apply filtering to only count issues from enabled aspects
      const filteredSummary = getFilteredValidationSummary(r._validationSummary, currentSettings);
      
      const resourceErrors = filteredSummary.errorCount || 0;
      const resourceWarnings = filteredSummary.warningCount || 0;
      const resourceInfo = filteredSummary.informationCount || 0;

      errorCount += resourceErrors;
      warningCount += resourceWarnings;
      infoCount += resourceInfo;

      // Count resources with each severity
      if (resourceErrors > 0) {
        severityStats.error.count += resourceErrors;
        severityStats.error.resourceCount += 1;
      }
      if (resourceWarnings > 0) {
        severityStats.warning.count += resourceWarnings;
        severityStats.warning.resourceCount += 1;
      }
      if (resourceInfo > 0) {
        severityStats.information.count += resourceInfo;
        severityStats.information.resourceCount += 1;
      }

      // Process aspect breakdown for this resource (use filtered data)
      if (filteredSummary.aspectBreakdown && typeof filteredSummary.aspectBreakdown === 'object') {
        // Map backend aspect keys to frontend keys
        const aspectMapping: { [key: string]: string } = {
          'structural': 'structural',
          'profile': 'profile',
          'terminology': 'terminology',
          'reference': 'reference',
          'business-rule': 'businessRule',
          'businessRule': 'businessRule',
          'metadata': 'metadata',
        };

        Object.keys(filteredSummary.aspectBreakdown).forEach((backendAspect: string) => {
          const frontendAspect = aspectMapping[backendAspect] || backendAspect;
          const aspectData = filteredSummary.aspectBreakdown?.[backendAspect];
          
          if (aspectData && typeof aspectData === 'object' && aspectStats[frontendAspect]) {
            const hasErrors = (Number(aspectData.errorCount) || 0) > 0;
            const hasWarnings = (Number(aspectData.warningCount) || 0) > 0;
            
            aspectStats[frontendAspect].total += 1;
            
            if (hasErrors) {
              aspectStats[frontendAspect].invalid += 1;
            } else if (hasWarnings) {
              aspectStats[frontendAspect].warnings += 1;
            } else {
              aspectStats[frontendAspect].valid += 1;
            }
          }
        });
      }
    }
  });

  return {
    totalResources,
    validatedCount: validatedResources.length,
    errorCount,
    warningCount,
    infoCount,
    aspectStats,
    severityStats,
  };
}

/**
 * Create simplified validation summary (without stats)
 */
export function calculateValidationSummary(
  summaryWithStats: ValidationSummaryWithStats
): ValidationSummary {
  return {
    totalResources: summaryWithStats.totalResources,
    validatedCount: summaryWithStats.validatedCount,
    errorCount: summaryWithStats.errorCount,
    warningCount: summaryWithStats.warningCount,
    infoCount: summaryWithStats.infoCount,
  };
}

