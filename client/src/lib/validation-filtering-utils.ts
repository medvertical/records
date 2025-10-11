/**
 * Validation Filtering Utilities
 * 
 * Provides utilities for filtering validation results based on enabled/disabled aspects.
 * This ensures consistent filtering across the application.
 */

export interface ValidationSettings {
  aspects?: {
    [key: string]: {
      enabled: boolean;
      [key: string]: any;
    };
  };
  [key: string]: any;
}

export interface ValidationSummary {
  errorCount: number;
  warningCount: number;
  informationCount: number;
  totalIssues: number;
  validationScore: number;
  hasErrors: boolean;
  hasWarnings: boolean;
  isValid: boolean;
  aspectBreakdown?: {
    [key: string]: {
      issueCount: number;
      errorCount: number;
      warningCount: number;
      informationCount: number;
      validationScore: number;
      passed: boolean;
      enabled: boolean;
      status?: string;
      reason?: string;
      [key: string]: any;
    };
  };
  [key: string]: any;
}

/**
 * Filter validation results based on enabled aspects
 * 
 * This function filters out validation issues from disabled aspects,
 * ensuring that only issues from enabled aspects are counted.
 * 
 * @param validationSummary - The validation summary to filter
 * @param settings - The current validation settings
 * @returns Filtered validation summary with only enabled aspect counts
 */
export function getFilteredValidationSummary(
  validationSummary: any,
  settings: ValidationSettings | null | undefined
): ValidationSummary {
  // If no validation summary, return as-is
  if (!validationSummary) {
    return validationSummary;
  }
  
  // If no settings, return as-is (all aspects considered enabled by default)
  if (!settings) {
    return validationSummary;
  }

  // If we have aspect breakdown data, filter it based on enabled aspects
  if (validationSummary.aspectBreakdown) {
    const filteredBreakdown = { ...validationSummary.aspectBreakdown };
    let filteredErrorCount = 0;
    let filteredWarningCount = 0;
    let filteredInfoCount = 0;
    let filteredTotalIssues = 0;

    // Filter each aspect based on enabled status
    Object.keys(filteredBreakdown).forEach(aspect => {
      // Normalize aspect name to match settings structure
      // DB/Frontend may use: businessRule, business-rule
      // Settings uses: businessRules (plural)
      const normalizedAspect = aspect === 'businessRule' || aspect === 'business-rule' 
        ? 'businessRules' 
        : aspect;
      
      // Access aspects from the correct nested structure
      const aspectEnabled = settings.aspects?.[normalizedAspect]?.enabled !== false;
      
      if (!aspectEnabled) {
        // Reset counts for disabled aspects
        filteredBreakdown[aspect] = {
          ...filteredBreakdown[aspect],
          issueCount: 0,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          validationScore: 100, // Disabled aspects don't count against the score
          passed: true,
          enabled: false
        };
      } else {
        // Aspect is enabled - count ALL issues regardless of status
        const aspectResult = filteredBreakdown[aspect];
        filteredErrorCount += aspectResult.errorCount || 0;
        filteredWarningCount += aspectResult.warningCount || 0;
        filteredInfoCount += aspectResult.informationCount || 0;
        filteredTotalIssues += aspectResult.issueCount || 0;
      }
    });

    // Calculate filtered validation score
    let filteredScore = 100;
    filteredScore -= filteredErrorCount * 15;  // Error issues: -15 points each
    filteredScore -= filteredWarningCount * 5; // Warning issues: -5 points each
    filteredScore -= filteredInfoCount * 1;    // Information issues: -1 point each
    filteredScore = Math.max(0, Math.round(filteredScore));

    return {
      ...validationSummary,
      errorCount: filteredErrorCount,
      warningCount: filteredWarningCount,
      informationCount: filteredInfoCount,
      totalIssues: filteredTotalIssues,
      validationScore: filteredScore,
      hasErrors: filteredErrorCount > 0,
      hasWarnings: filteredWarningCount > 0,
      isValid: filteredErrorCount === 0,
      aspectBreakdown: filteredBreakdown
    };
  }

  return validationSummary;
}

