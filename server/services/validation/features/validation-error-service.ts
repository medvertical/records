// ============================================================================
// Validation Error Service
// ============================================================================

import { storage } from '../../../storage';

export interface ValidationError {
  id: string;
  resourceId: string;
  resourceType: string;
  errorType: ValidationErrorType;
  severity: ValidationErrorSeverity;
  category: ValidationErrorCategory;
  message: string;
  details?: any;
  location?: string;
  suggestion?: string;
  timestamp: Date;
  validationRunId: string;
}

export type ValidationErrorType = 
  | 'structural' 
  | 'profile' 
  | 'terminology' 
  | 'reference' 
  | 'business_rule' 
  | 'metadata'
  | 'system';

export type ValidationErrorSeverity = 
  | 'fatal' 
  | 'error' 
  | 'warning' 
  | 'information';

export type ValidationErrorCategory = 
  | 'syntax' 
  | 'semantics' 
  | 'constraints' 
  | 'terminology' 
  | 'references' 
  | 'business_logic' 
  | 'performance' 
  | 'security' 
  | 'compliance';

export interface ErrorCategorizationResult {
  errorType: ValidationErrorType;
  category: ValidationErrorCategory;
  severity: ValidationErrorSeverity;
  message: string;
  details?: any;
  location?: string;
  suggestion?: string;
}

export interface ErrorAggregation {
  totalErrors: number;
  errorsByType: Record<ValidationErrorType, number>;
  errorsBySeverity: Record<ValidationErrorSeverity, number>;
  errorsByCategory: Record<ValidationErrorCategory, number>;
  errorsByResourceType: Record<string, number>;
  topErrors: Array<{
    message: string;
    count: number;
    severity: ValidationErrorSeverity;
  }>;
  errorTrends: Array<{
    date: string;
    count: number;
    severity: ValidationErrorSeverity;
  }>;
}

export class ValidationErrorService {
  private static instance: ValidationErrorService;

  private constructor() {}

  static getInstance(): ValidationErrorService {
    if (!ValidationErrorService.instance) {
      ValidationErrorService.instance = new ValidationErrorService();
    }
    return ValidationErrorService.instance;
  }

  /**
   * Categorize a validation error
   */
  categorizeError(error: any, resource: any): ErrorCategorizationResult {
    const errorMessage = error.message || error.diagnostics || String(error);
    const errorCode = error.code || error.issueCode || '';
    const errorLocation = error.location || error.expression || '';

    // Determine error type based on error characteristics
    const errorType = this.determineErrorType(error, errorMessage, errorCode);
    
    // Determine category based on error type and context
    const category = this.determineCategory(errorType, errorMessage, errorCode, errorLocation);
    
    // Determine severity based on error type and impact
    const severity = this.determineSeverity(errorType, category, errorMessage, errorCode);
    
    // Generate user-friendly message
    const message = this.generateUserFriendlyMessage(errorType, category, errorMessage, errorCode);
    
    // Generate suggestion for fixing the error
    const suggestion = this.generateSuggestion(errorType, category, errorMessage, errorCode, errorLocation);

    return {
      errorType,
      category,
      severity,
      message,
      details: error,
      location: errorLocation,
      suggestion
    };
  }

  /**
   * Store a validation error
   */
  async storeError(error: ValidationError): Promise<void> {
    try {
      await storage.saveValidationError(error);
    } catch (error) {
      console.error('Failed to store validation error:', error);
    }
  }

  /**
   * Get errors for a specific resource
   */
  async getErrorsForResource(resourceId: string, resourceType: string): Promise<ValidationError[]> {
    try {
      return await storage.getValidationErrorsByResource(resourceId, resourceType);
    } catch (error) {
      console.error('Failed to get errors for resource:', error);
      return [];
    }
  }

  /**
   * Get errors for a validation run
   */
  async getErrorsForValidationRun(validationRunId: string): Promise<ValidationError[]> {
    try {
      return await storage.getValidationErrorsByRun(validationRunId);
    } catch (error) {
      console.error('Failed to get errors for validation run:', error);
      return [];
    }
  }

  /**
   * Get error aggregation statistics
   */
  async getErrorAggregation(
    startDate?: Date, 
    endDate?: Date, 
    resourceTypes?: string[]
  ): Promise<ErrorAggregation> {
    try {
      const errors = await storage.getValidationErrors(startDate, endDate, resourceTypes);
      
      const aggregation: ErrorAggregation = {
        totalErrors: errors.length,
        errorsByType: {} as Record<ValidationErrorType, number>,
        errorsBySeverity: {} as Record<ValidationErrorSeverity, number>,
        errorsByCategory: {} as Record<ValidationErrorCategory, number>,
        errorsByResourceType: {},
        topErrors: [],
        errorTrends: []
      };

      // Initialize counters
      const errorTypes: ValidationErrorType[] = ['structural', 'profile', 'terminology', 'reference', 'business_rule', 'metadata', 'system'];
      const severities: ValidationErrorSeverity[] = ['fatal', 'error', 'warning', 'information'];
      const categories: ValidationErrorCategory[] = ['syntax', 'semantics', 'constraints', 'terminology', 'references', 'business_logic', 'performance', 'security', 'compliance'];

      errorTypes.forEach(type => aggregation.errorsByType[type] = 0);
      severities.forEach(severity => aggregation.errorsBySeverity[severity] = 0);
      categories.forEach(category => aggregation.errorsByCategory[category] = 0);

      // Count errors
      const errorMessageCounts = new Map<string, { count: number; severity: ValidationErrorSeverity }>();
      const dailyCounts = new Map<string, { count: number; severity: ValidationErrorSeverity }>();

      errors.forEach(error => {
        // Count by type
        aggregation.errorsByType[error.errorType]++;
        
        // Count by severity
        aggregation.errorsBySeverity[error.severity]++;
        
        // Count by category
        aggregation.errorsByCategory[error.category]++;
        
        // Count by resource type
        aggregation.errorsByResourceType[error.resourceType] = 
          (aggregation.errorsByResourceType[error.resourceType] || 0) + 1;
        
        // Count by message for top errors
        const messageKey = error.message;
        if (errorMessageCounts.has(messageKey)) {
          errorMessageCounts.get(messageKey)!.count++;
        } else {
          errorMessageCounts.set(messageKey, { count: 1, severity: error.severity });
        }
        
        // Count by date for trends
        const timestamp = error.timestamp?.toISOString();
        if (!timestamp || typeof timestamp !== 'string') return;
        const dateKey = timestamp.split('T')[0];
        if (dailyCounts.has(dateKey)) {
          dailyCounts.get(dateKey)!.count++;
        } else {
          dailyCounts.set(dateKey, { count: 1, severity: error.severity });
        }
      });

      // Get top errors
      aggregation.topErrors = Array.from(errorMessageCounts.entries())
        .map(([message, data]) => ({ message, count: data.count, severity: data.severity }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get error trends
      aggregation.errorTrends = Array.from(dailyCounts.entries())
        .map(([date, data]) => ({ date, count: data.count, severity: data.severity }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return aggregation;
    } catch (error) {
      console.error('Failed to get error aggregation:', error);
      return {
        totalErrors: 0,
        errorsByType: {} as Record<ValidationErrorType, number>,
        errorsBySeverity: {} as Record<ValidationErrorSeverity, number>,
        errorsByCategory: {} as Record<ValidationErrorCategory, number>,
        errorsByResourceType: {},
        topErrors: [],
        errorTrends: []
      };
    }
  }

  /**
   * Get error trends over time
   */
  async getErrorTrends(
    days: number = 30, 
    resourceTypes?: string[]
  ): Promise<Array<{ date: string; count: number; severity: ValidationErrorSeverity }>> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const errors = await storage.getValidationErrors(startDate, endDate, resourceTypes);
      
      const dailyCounts = new Map<string, { count: number; severity: ValidationErrorSeverity }>();
      
      errors.forEach(error => {
        const timestamp = error.timestamp?.toISOString();
        if (!timestamp || typeof timestamp !== 'string') return;
        const dateKey = timestamp.split('T')[0];
        if (dailyCounts.has(dateKey)) {
          dailyCounts.get(dateKey)!.count++;
        } else {
          dailyCounts.set(dateKey, { count: 1, severity: error.severity });
        }
      });

      return Array.from(dailyCounts.entries())
        .map(([date, data]) => ({ date, count: data.count, severity: data.severity }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Failed to get error trends:', error);
      return [];
    }
  }

  /**
   * Determine error type based on error characteristics
   */
  private determineErrorType(error: any, message: string, code: string): ValidationErrorType {
    const messageLower = message.toLowerCase();
    const codeLower = code.toLowerCase();

    // Structural errors
    if (messageLower.includes('syntax') || messageLower.includes('parse') || 
        messageLower.includes('json') || messageLower.includes('xml') ||
        codeLower.includes('syntax') || codeLower.includes('parse')) {
      return 'structural';
    }

    // Profile errors
    if (messageLower.includes('profile') || messageLower.includes('constraint') ||
        messageLower.includes('element') || messageLower.includes('required') ||
        codeLower.includes('profile') || codeLower.includes('constraint')) {
      return 'profile';
    }

    // Terminology errors
    if (messageLower.includes('code') || messageLower.includes('coding') ||
        messageLower.includes('value set') || messageLower.includes('terminology') ||
        codeLower.includes('code') || codeLower.includes('terminology')) {
      return 'terminology';
    }

    // Reference errors
    if (messageLower.includes('reference') || messageLower.includes('ref') ||
        messageLower.includes('link') || messageLower.includes('url') ||
        codeLower.includes('reference') || codeLower.includes('ref')) {
      return 'reference';
    }

    // Business rule errors
    if (messageLower.includes('business') || messageLower.includes('rule') ||
        messageLower.includes('logic') || messageLower.includes('validation') ||
        codeLower.includes('business') || codeLower.includes('rule')) {
      return 'business_rule';
    }

    // Metadata errors
    if (messageLower.includes('meta') || messageLower.includes('version') ||
        messageLower.includes('last updated') || messageLower.includes('id') ||
        codeLower.includes('meta') || codeLower.includes('version')) {
      return 'metadata';
    }

    // Default to system error
    return 'system';
  }

  /**
   * Determine category based on error type and context
   */
  private determineCategory(
    errorType: ValidationErrorType, 
    message: string, 
    code: string, 
    location: string
  ): ValidationErrorCategory {
    const messageLower = message.toLowerCase();
    const codeLower = code.toLowerCase();
    const locationLower = location.toLowerCase();

    switch (errorType) {
      case 'structural':
        return 'syntax';
      
      case 'profile':
        if (messageLower.includes('required') || messageLower.includes('mandatory')) {
          return 'constraints';
        }
        return 'semantics';
      
      case 'terminology':
        return 'terminology';
      
      case 'reference':
        return 'references';
      
      case 'business_rule':
        return 'business_logic';
      
      case 'metadata':
        if (messageLower.includes('security') || messageLower.includes('access')) {
          return 'security';
        }
        return 'compliance';
      
      case 'system':
        if (messageLower.includes('performance') || messageLower.includes('timeout')) {
          return 'performance';
        }
        return 'compliance';
      
      default:
        return 'compliance';
    }
  }

  /**
   * Determine severity based on error type and impact
   */
  private determineSeverity(
    errorType: ValidationErrorType, 
    category: ValidationErrorCategory, 
    message: string, 
    code: string
  ): ValidationErrorSeverity {
    const messageLower = message.toLowerCase();
    const codeLower = code.toLowerCase();

    // Fatal errors - prevent resource from being used
    if (messageLower.includes('fatal') || messageLower.includes('critical') ||
        codeLower.includes('fatal') || codeLower.includes('critical') ||
        errorType === 'structural' && category === 'syntax') {
      return 'fatal';
    }

    // Error level - significant issues that should be fixed
    if (messageLower.includes('error') || messageLower.includes('invalid') ||
        codeLower.includes('error') || codeLower.includes('invalid') ||
        errorType === 'profile' || errorType === 'reference') {
      return 'error';
    }

    // Warning level - issues that should be reviewed
    if (messageLower.includes('warning') || messageLower.includes('deprecated') ||
        codeLower.includes('warning') || codeLower.includes('deprecated') ||
        errorType === 'terminology' || errorType === 'metadata') {
      return 'warning';
    }

    // Information level - minor issues or suggestions
    return 'information';
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserFriendlyMessage(
    errorType: ValidationErrorType, 
    category: ValidationErrorCategory, 
    message: string, 
    code: string
  ): string {
    // If the original message is already user-friendly, use it
    if (message.length > 10 && !message.includes('Error') && !message.includes('Exception')) {
      return message;
    }

    // Generate user-friendly messages based on error type and category
    switch (errorType) {
      case 'structural':
        return 'The resource has a structural issue that prevents it from being processed correctly.';
      
      case 'profile':
        return 'The resource does not conform to the required profile structure.';
      
      case 'terminology':
        return 'The resource contains terminology that is not recognized or valid.';
      
      case 'reference':
        return 'The resource contains references that cannot be resolved.';
      
      case 'business_rule':
        return 'The resource violates a business rule or constraint.';
      
      case 'metadata':
        return 'The resource has metadata issues that should be addressed.';
      
      case 'system':
        return 'A system error occurred while processing the resource.';
      
      default:
        return 'An unknown error occurred while validating the resource.';
    }
  }

  /**
   * Generate suggestion for fixing the error
   */
  private generateSuggestion(
    errorType: ValidationErrorType, 
    category: ValidationErrorCategory, 
    message: string, 
    code: string, 
    location: string
  ): string {
    switch (errorType) {
      case 'structural':
        return 'Check the resource syntax and ensure it follows the correct JSON or XML format.';
      
      case 'profile':
        return 'Review the profile requirements and ensure all mandatory elements are present and correctly formatted.';
      
      case 'terminology':
        return 'Verify that all codes and terminologies are from the correct value sets and are properly formatted.';
      
      case 'reference':
        return 'Check that all references point to valid resources and are properly formatted.';
      
      case 'business_rule':
        return 'Review the business rules and constraints to ensure the resource complies with all requirements.';
      
      case 'metadata':
        return 'Update the resource metadata to include all required information and ensure it is properly formatted.';
      
      case 'system':
        return 'Contact system administrator if this error persists.';
      
      default:
        return 'Review the resource for any obvious issues and try again.';
    }
  }
}
