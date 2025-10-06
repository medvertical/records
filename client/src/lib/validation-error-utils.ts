import { ValidationError, ValidationWarning } from '../components/dashboard/controls/ValidationErrorWarningDisplay';

/**
 * Utility functions for handling validation errors and warnings
 */

export interface ApiErrorData {
  total: number;
  byType: Record<string, number>;
  byResourceType: Record<string, number>;
  byAspect: Record<string, number>;
  bySeverity: Record<string, number>;
  recent: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
    aspect?: string;
    timestamp: string;
    details?: string;
    suggestions?: string[];
    code?: string;
    path?: string;
  }>;
}

export interface ApiWarningData {
  total: number;
  byType: Record<string, number>;
  byResourceType: Record<string, number>;
  byAspect: Record<string, number>;
  bySeverity: Record<string, number>;
  recent: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
    aspect?: string;
    timestamp: string;
    details?: string;
    suggestions?: string[];
    code?: string;
    path?: string;
  }>;
}

/**
 * Convert API error data to ValidationError format
 */
export function convertApiErrorsToValidationErrors(apiErrors: ApiErrorData): ValidationError[] {
  return apiErrors.recent.map(error => ({
    id: error.id,
    type: error.type,
    severity: error.severity as 'low' | 'medium' | 'high' | 'critical',
    message: error.message,
    resourceType: error.resourceType,
    resourceId: error.resourceId,
    aspect: error.aspect,
    timestamp: new Date(error.timestamp),
    details: error.details,
    suggestions: error.suggestions,
    code: error.code,
    path: error.path,
  }));
}

/**
 * Convert API warning data to ValidationWarning format
 */
export function convertApiWarningsToValidationWarnings(apiWarnings: ApiWarningData): ValidationWarning[] {
  return apiWarnings.recent.map(warning => ({
    id: warning.id,
    type: warning.type,
    severity: warning.severity as 'low' | 'medium' | 'high',
    message: warning.message,
    resourceType: warning.resourceType,
    resourceId: warning.resourceId,
    aspect: warning.aspect,
    timestamp: new Date(warning.timestamp),
    details: warning.details,
    suggestions: warning.suggestions,
    code: warning.code,
    path: warning.path,
  }));
}

/**
 * Generate mock validation errors for testing
 */
export function generateMockValidationErrors(count: number = 5): ValidationError[] {
  const errorTypes = ['Structural', 'Profile', 'Terminology', 'Reference', 'Business Rule'];
  const severities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
  const resourceTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'AllergyIntolerance'];
  const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
  
  const errors: ValidationError[] = [];
  
  for (let i = 0; i < count; i++) {
    const type = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
    const aspect = aspects[Math.floor(Math.random() * aspects.length)];
    
    errors.push({
      id: `error_${i + 1}`,
      type,
      severity,
      message: `${type} validation failed for ${resourceType} resource`,
      resourceType,
      resourceId: `resource_${i + 1}`,
      aspect,
      timestamp: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
      details: `Detailed error information for ${type} validation failure. This error occurred during the ${aspect} validation aspect.`,
      suggestions: [
        `Check the ${aspect} validation rules for ${resourceType}`,
        `Verify the resource structure matches the expected format`,
        `Review the validation configuration settings`
      ],
      code: `ERR_${type.toUpperCase()}_${i + 1}`,
      path: `/${resourceType.toLowerCase()}[${i + 1}]/${aspect}`,
    });
  }
  
  return errors;
}

/**
 * Generate mock validation warnings for testing
 */
export function generateMockValidationWarnings(count: number = 3): ValidationWarning[] {
  const warningTypes = ['Deprecated', 'Performance', 'Best Practice', 'Compatibility'];
  const severities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
  const resourceTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'AllergyIntolerance'];
  const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
  
  const warnings: ValidationWarning[] = [];
  
  for (let i = 0; i < count; i++) {
    const type = warningTypes[Math.floor(Math.random() * warningTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
    const aspect = aspects[Math.floor(Math.random() * aspects.length)];
    
    warnings.push({
      id: `warning_${i + 1}`,
      type,
      severity,
      message: `${type} warning for ${resourceType} resource`,
      resourceType,
      resourceId: `resource_${i + 1}`,
      aspect,
      timestamp: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
      details: `Warning details for ${type} issue. This warning was generated during the ${aspect} validation aspect.`,
      suggestions: [
        `Consider updating the ${resourceType} resource to follow current best practices`,
        `Review the ${aspect} validation configuration`,
        `Check for deprecated elements or patterns`
      ],
      code: `WARN_${type.toUpperCase()}_${i + 1}`,
      path: `/${resourceType.toLowerCase()}[${i + 1}]/${aspect}`,
    });
  }
  
  return warnings;
}

/**
 * Get error statistics summary
 */
export function getErrorStatistics(errors: ValidationError[]) {
  const stats = {
    total: errors.length,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    byType: {} as Record<string, number>,
    byResourceType: {} as Record<string, number>,
    byAspect: {} as Record<string, number>,
  };
  
  errors.forEach(error => {
    // Count by severity
    stats.bySeverity[error.severity]++;
    
    // Count by type
    stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    
    // Count by resource type
    if (error.resourceType) {
      stats.byResourceType[error.resourceType] = (stats.byResourceType[error.resourceType] || 0) + 1;
    }
    
    // Count by aspect
    if (error.aspect) {
      stats.byAspect[error.aspect] = (stats.byAspect[error.aspect] || 0) + 1;
    }
  });
  
  return stats;
}

/**
 * Get warning statistics summary
 */
export function getWarningStatistics(warnings: ValidationWarning[]) {
  const stats = {
    total: warnings.length,
    bySeverity: {
      high: 0,
      medium: 0,
      low: 0,
    },
    byType: {} as Record<string, number>,
    byResourceType: {} as Record<string, number>,
    byAspect: {} as Record<string, number>,
  };
  
  warnings.forEach(warning => {
    // Count by severity
    stats.bySeverity[warning.severity]++;
    
    // Count by type
    stats.byType[warning.type] = (stats.byType[warning.type] || 0) + 1;
    
    // Count by resource type
    if (warning.resourceType) {
      stats.byResourceType[warning.resourceType] = (stats.byResourceType[warning.resourceType] || 0) + 1;
    }
    
    // Count by aspect
    if (warning.aspect) {
      stats.byAspect[warning.aspect] = (stats.byAspect[warning.aspect] || 0) + 1;
    }
  });
  
  return stats;
}

/**
 * Filter errors by severity
 */
export function filterErrorsBySeverity(errors: ValidationError[], severity: string): ValidationError[] {
  return errors.filter(error => error.severity === severity);
}

/**
 * Filter warnings by severity
 */
export function filterWarningsBySeverity(warnings: ValidationWarning[], severity: string): ValidationWarning[] {
  return warnings.filter(warning => warning.severity === severity);
}

/**
 * Search errors and warnings by text
 */
export function searchErrorsAndWarnings(
  errors: ValidationError[], 
  warnings: ValidationWarning[], 
  searchTerm: string
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  const filteredErrors = errors.filter(error => 
    error.message.toLowerCase().includes(lowerSearchTerm) ||
    error.type.toLowerCase().includes(lowerSearchTerm) ||
    error.resourceType?.toLowerCase().includes(lowerSearchTerm) ||
    error.aspect?.toLowerCase().includes(lowerSearchTerm)
  );
  
  const filteredWarnings = warnings.filter(warning => 
    warning.message.toLowerCase().includes(lowerSearchTerm) ||
    warning.type.toLowerCase().includes(lowerSearchTerm) ||
    warning.resourceType?.toLowerCase().includes(lowerSearchTerm) ||
    warning.aspect?.toLowerCase().includes(lowerSearchTerm)
  );
  
  return { errors: filteredErrors, warnings: filteredWarnings };
}

/**
 * Sort errors by severity (critical first)
 */
export function sortErrorsBySeverity(errors: ValidationError[]): ValidationError[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...errors].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Sort warnings by severity (high first)
 */
export function sortWarningsBySeverity(warnings: ValidationWarning[]): ValidationWarning[] {
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return [...warnings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

