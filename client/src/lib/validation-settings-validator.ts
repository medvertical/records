import type { ValidationSettings, ValidationAspectConfig } from '@shared/validation-settings-simplified';

/**
 * Validation Settings Validator and Normalizer
 */

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  value?: any;
  expected?: any;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  normalizedSettings?: ValidationSettings;
}

export interface ValidationRule {
  field: string;
  validator: (value: any, settings: any) => ValidationError | null;
  normalizer?: (value: any) => any;
}

export interface ValidationContext {
  isUpdate?: boolean;
  previousSettings?: ValidationSettings;
  strictMode?: boolean;
  allowPartial?: boolean;
}

/**
 * Validation Settings Validator Class
 */
export class ValidationSettingsValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * Initialize validation rules
   */
  private initializeRules(): void {
    // Validation aspects rules
    this.rules.push({
      field: 'aspects',
      validator: (value, settings) => {
        if (!value || typeof value !== 'object') {
          return {
            field: 'aspects',
            message: 'Validation aspects configuration is required',
            code: 'REQUIRED_ASPECTS',
            severity: 'error',
            value,
            expected: 'object',
            suggestion: 'Provide a valid aspects configuration object'
          };
        }

        const requiredAspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
        const missingAspects = requiredAspects.filter(aspect => !value[aspect]);
        
        if (missingAspects.length > 0) {
          return {
            field: 'aspects',
            message: `Missing required validation aspects: ${missingAspects.join(', ')}`,
            code: 'MISSING_ASPECTS',
            severity: 'error',
            value: Object.keys(value),
            expected: requiredAspects,
            suggestion: 'Include all required validation aspects'
          };
        }

        return null;
      },
      normalizer: (value) => {
        const normalized: any = {};
        const defaultConfig: ValidationAspectConfig = { enabled: true, severity: 'error' };
        
        ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'].forEach(aspect => {
          normalized[aspect] = {
            ...defaultConfig,
            ...value[aspect]
          };
        });
        
        return normalized;
      }
    });

    // Individual aspect validation
    ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'].forEach(aspect => {
      this.rules.push({
        field: `aspects.${aspect}`,
        validator: (value, settings) => {
          if (!value || typeof value !== 'object') {
            return {
              field: `aspects.${aspect}`,
              message: `${aspect} aspect configuration is required`,
              code: 'REQUIRED_ASPECT_CONFIG',
              severity: 'error',
              value,
              expected: 'object',
              suggestion: 'Provide a valid aspect configuration object'
            };
          }

          if (typeof value.enabled !== 'boolean') {
            return {
              field: `aspects.${aspect}.enabled`,
              message: `${aspect} aspect enabled flag must be a boolean`,
              code: 'INVALID_ENABLED_TYPE',
              severity: 'error',
              value: value.enabled,
              expected: 'boolean',
              suggestion: 'Set enabled to true or false'
            };
          }

          if (!['error', 'warning', 'info'].includes(value.severity)) {
            return {
              field: `aspects.${aspect}.severity`,
              message: `${aspect} aspect severity must be one of: error, warning, info`,
              code: 'INVALID_SEVERITY',
              severity: 'error',
              value: value.severity,
              expected: ['error', 'warning', 'info'],
              suggestion: 'Set severity to error, warning, or info'
            };
          }

          return null;
        },
        normalizer: (value) => {
          return {
            enabled: Boolean(value.enabled),
            severity: ['error', 'warning', 'info'].includes(value.severity) ? value.severity : 'error'
          };
        }
      });
    });

    // Server configuration rules
    this.rules.push({
      field: 'server',
      validator: (value, settings) => {
        if (!value || typeof value !== 'object') {
          return {
            field: 'server',
            message: 'Server configuration is required',
            code: 'REQUIRED_SERVER_CONFIG',
            severity: 'error',
            value,
            expected: 'object',
            suggestion: 'Provide a valid server configuration object'
          };
        }

        if (!value.url || typeof value.url !== 'string') {
          return {
            field: 'server.url',
            message: 'Server URL is required and must be a string',
            code: 'REQUIRED_SERVER_URL',
            severity: 'error',
            value: value.url,
            expected: 'string',
            suggestion: 'Provide a valid FHIR server URL'
          };
        }

        try {
          new URL(value.url);
        } catch {
          return {
            field: 'server.url',
            message: 'Server URL must be a valid URL',
            code: 'INVALID_SERVER_URL',
            severity: 'error',
            value: value.url,
            expected: 'valid URL',
            suggestion: 'Provide a valid URL format (e.g., https://server.fire.ly)'
          };
        }

        return null;
      },
      normalizer: (value) => {
        return {
          url: String(value.url || ''),
          timeout: Number(value.timeout) || 30000,
          retries: Number(value.retries) || 3
        };
      }
    });

    // Performance configuration rules
    this.rules.push({
      field: 'performance',
      validator: (value, settings) => {
        if (!value || typeof value !== 'object') {
          return {
            field: 'performance',
            message: 'Performance configuration is required',
            code: 'REQUIRED_PERFORMANCE_CONFIG',
            severity: 'error',
            value,
            expected: 'object',
            suggestion: 'Provide a valid performance configuration object'
          };
        }

        if (typeof value.maxConcurrent !== 'number' || value.maxConcurrent < 1 || value.maxConcurrent > 100) {
          return {
            field: 'performance.maxConcurrent',
            message: 'Max concurrent requests must be a number between 1 and 100',
            code: 'INVALID_MAX_CONCURRENT',
            severity: 'error',
            value: value.maxConcurrent,
            expected: 'number (1-100)',
            suggestion: 'Set maxConcurrent to a number between 1 and 100'
          };
        }

        if (typeof value.batchSize !== 'number' || value.batchSize < 1 || value.batchSize > 1000) {
          return {
            field: 'performance.batchSize',
            message: 'Batch size must be a number between 1 and 1000',
            code: 'INVALID_BATCH_SIZE',
            severity: 'error',
            value: value.batchSize,
            expected: 'number (1-1000)',
            suggestion: 'Set batchSize to a number between 1 and 1000'
          };
        }

        return null;
      },
      normalizer: (value) => {
        return {
          maxConcurrent: Math.max(1, Math.min(100, Number(value.maxConcurrent) || 5)),
          batchSize: Math.max(1, Math.min(1000, Number(value.batchSize) || 50))
        };
      }
    });

    // Resource types configuration rules
    this.rules.push({
      field: 'resourceTypes',
      validator: (value, settings) => {
        if (!value || typeof value !== 'object') {
          return {
            field: 'resourceTypes',
            message: 'Resource types configuration is required',
            code: 'REQUIRED_RESOURCE_TYPES_CONFIG',
            severity: 'error',
            value,
            expected: 'object',
            suggestion: 'Provide a valid resource types configuration object'
          };
        }

        if (typeof value.enabled !== 'boolean') {
          return {
            field: 'resourceTypes.enabled',
            message: 'Resource types enabled flag must be a boolean',
            code: 'INVALID_ENABLED_TYPE',
            severity: 'error',
            value: value.enabled,
            expected: 'boolean',
            suggestion: 'Set enabled to true or false'
          };
        }

        if (!Array.isArray(value.includedTypes)) {
          return {
            field: 'resourceTypes.includedTypes',
            message: 'Included resource types must be an array',
            code: 'INVALID_INCLUDED_TYPES',
            severity: 'error',
            value: value.includedTypes,
            expected: 'array',
            suggestion: 'Provide an array of resource type names'
          };
        }

        if (!Array.isArray(value.excludedTypes)) {
          return {
            field: 'resourceTypes.excludedTypes',
            message: 'Excluded resource types must be an array',
            code: 'INVALID_EXCLUDED_TYPES',
            severity: 'error',
            value: value.excludedTypes,
            expected: 'array',
            suggestion: 'Provide an array of resource type names to exclude'
          };
        }

        if (typeof value.latestOnly !== 'boolean') {
          return {
            field: 'resourceTypes.latestOnly',
            message: 'Latest only flag must be a boolean',
            code: 'INVALID_LATEST_ONLY_TYPE',
            severity: 'error',
            value: value.latestOnly,
            expected: 'boolean',
            suggestion: 'Set latestOnly to true or false'
          };
        }

        return null;
      },
      normalizer: (value) => {
        return {
          enabled: Boolean(value.enabled),
          includedTypes: Array.isArray(value.includedTypes) ? value.includedTypes.filter(t => typeof t === 'string') : [],
          excludedTypes: Array.isArray(value.excludedTypes) ? value.excludedTypes.filter(t => typeof t === 'string') : [],
          latestOnly: Boolean(value.latestOnly)
        };
      }
    });

    // Records configuration rules
    this.rules.push({
      field: 'records',
      validator: (value, settings) => {
        if (!value || typeof value !== 'object') {
          return {
            field: 'records',
            message: 'Records configuration is required',
            code: 'REQUIRED_RECORDS_CONFIG',
            severity: 'error',
            value,
            expected: 'object',
            suggestion: 'Provide a valid records configuration object'
          };
        }

        const booleanFields = [
          'validateExternalReferences',
          'strictReferenceTypeChecking',
          'strictMode',
          'validateReferenceIntegrity',
          'allowBrokenReferences'
        ];

        for (const field of booleanFields) {
          if (typeof value[field] !== 'boolean') {
            return {
              field: `records.${field}`,
              message: `${field} must be a boolean`,
              code: 'INVALID_BOOLEAN_TYPE',
              severity: 'error',
              value: value[field],
              expected: 'boolean',
              suggestion: `Set ${field} to true or false`
            };
          }
        }

        if (typeof value.maxReferenceDepth !== 'number' || value.maxReferenceDepth < 1 || value.maxReferenceDepth > 10) {
          return {
            field: 'records.maxReferenceDepth',
            message: 'Max reference depth must be a number between 1 and 10',
            code: 'INVALID_MAX_REFERENCE_DEPTH',
            severity: 'error',
            value: value.maxReferenceDepth,
            expected: 'number (1-10)',
            suggestion: 'Set maxReferenceDepth to a number between 1 and 10'
          };
        }

        return null;
      },
      normalizer: (value) => {
        return {
          validateExternalReferences: Boolean(value.validateExternalReferences),
          strictReferenceTypeChecking: Boolean(value.strictReferenceTypeChecking),
          strictMode: Boolean(value.strictMode),
          validateReferenceIntegrity: Boolean(value.validateReferenceIntegrity),
          allowBrokenReferences: Boolean(value.allowBrokenReferences),
          maxReferenceDepth: Math.max(1, Math.min(10, Number(value.maxReferenceDepth) || 3))
        };
      }
    });
  }

  /**
   * Validate settings
   */
  validate(settings: any, context: ValidationContext = {}): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let normalizedSettings: any = {};

    // Check if settings is an object
    if (!settings || typeof settings !== 'object') {
      errors.push({
        field: 'root',
        message: 'Settings must be an object',
        code: 'INVALID_ROOT_TYPE',
        severity: 'error',
        value: settings,
        expected: 'object',
        suggestion: 'Provide a valid settings object'
      });
      return { isValid: false, errors, warnings };
    }

    // Apply validation rules
    for (const rule of this.rules) {
      const fieldValue = this.getNestedValue(settings, rule.field);
      const error = rule.validator(fieldValue, settings);
      
      if (error) {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }

      // Apply normalization if available
      if (rule.normalizer && fieldValue !== undefined) {
        this.setNestedValue(normalizedSettings, rule.field, rule.normalizer(fieldValue));
      } else if (fieldValue !== undefined) {
        this.setNestedValue(normalizedSettings, rule.field, fieldValue);
      }
    }

    // Cross-field validation
    const crossFieldErrors = this.validateCrossFields(normalizedSettings, context);
    errors.push(...crossFieldErrors);

    // Apply default values for missing fields
    normalizedSettings = this.applyDefaults(normalizedSettings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedSettings: errors.length === 0 ? normalizedSettings : undefined
    };
  }

  /**
   * Validate cross-field dependencies
   */
  private validateCrossFields(settings: any, context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if resource types filtering is enabled but no types are specified
    if (settings.resourceTypes?.enabled && 
        settings.resourceTypes?.includedTypes?.length === 0 && 
        settings.resourceTypes?.excludedTypes?.length === 0) {
      errors.push({
        field: 'resourceTypes',
        message: 'Resource types filtering is enabled but no types are specified',
        code: 'EMPTY_RESOURCE_TYPES',
        severity: 'warning',
        value: settings.resourceTypes,
        expected: 'non-empty arrays',
        suggestion: 'Either specify included types or disable filtering'
      });
    }

    // Check for conflicting resource type configurations
    if (settings.resourceTypes?.includedTypes?.length > 0 && 
        settings.resourceTypes?.excludedTypes?.length > 0) {
      const conflicts = settings.resourceTypes.includedTypes.filter((type: string) => 
        settings.resourceTypes.excludedTypes.includes(type)
      );
      
      if (conflicts.length > 0) {
        errors.push({
          field: 'resourceTypes',
          message: `Resource types appear in both included and excluded lists: ${conflicts.join(', ')}`,
          code: 'CONFLICTING_RESOURCE_TYPES',
          severity: 'warning',
          value: { included: settings.resourceTypes.includedTypes, excluded: settings.resourceTypes.excludedTypes },
          expected: 'no overlap',
          suggestion: 'Remove conflicting types from one of the lists'
        });
      }
    }

    // Check for performance configuration conflicts
    if (settings.performance?.maxConcurrent > settings.performance?.batchSize) {
      errors.push({
        field: 'performance',
        message: 'Max concurrent requests is greater than batch size, which may cause inefficiency',
        code: 'PERFORMANCE_CONFLICT',
        severity: 'warning',
        value: { maxConcurrent: settings.performance.maxConcurrent, batchSize: settings.performance.batchSize },
        expected: 'maxConcurrent <= batchSize',
        suggestion: 'Consider reducing maxConcurrent or increasing batchSize'
      });
    }

    return errors;
  }

  /**
   * Apply default values for missing fields
   */
  private applyDefaults(settings: any): ValidationSettings {
    return {
      aspects: {
        structural: { enabled: true, severity: 'error' },
        profile: { enabled: true, severity: 'error' },
        terminology: { enabled: true, severity: 'error' },
        reference: { enabled: true, severity: 'error' },
        businessRule: { enabled: true, severity: 'error' },
        metadata: { enabled: true, severity: 'error' },
        ...settings.aspects
      },
      server: {
        url: 'https://server.fire.ly',
        timeout: 30000,
        retries: 3,
        ...settings.server
      },
      performance: {
        maxConcurrent: 5,
        batchSize: 50,
        ...settings.performance
      },
      resourceTypes: {
        enabled: false,
        includedTypes: [],
        excludedTypes: [],
        latestOnly: false,
        ...settings.resourceTypes
      },
      records: {
        validateExternalReferences: false,
        strictReferenceTypeChecking: true,
        strictMode: false,
        validateReferenceIntegrity: true,
        allowBrokenReferences: false,
        maxReferenceDepth: 3,
        ...settings.records
      }
    };
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Validate a specific field
   */
  validateField(field: string, value: any, settings: any): ValidationError | null {
    const rule = this.rules.find(r => r.field === field);
    if (!rule) {
      return {
        field,
        message: `No validation rule found for field: ${field}`,
        code: 'NO_VALIDATION_RULE',
        severity: 'warning',
        value,
        expected: 'valid field',
        suggestion: 'Check field name spelling'
      };
    }
    return rule.validator(value, settings);
  }

  /**
   * Normalize a specific field
   */
  normalizeField(field: string, value: any): any {
    const rule = this.rules.find(r => r.field === field);
    if (!rule || !rule.normalizer) {
      return value;
    }
    return rule.normalizer(value);
  }

  /**
   * Get validation rules for a field
   */
  getFieldRules(field: string): ValidationRule | undefined {
    return this.rules.find(r => r.field === field);
  }

  /**
   * Get all validation rules
   */
  getAllRules(): ValidationRule[] {
    return [...this.rules];
  }
}

/**
 * Global validation settings validator instance
 */
export const validationSettingsValidator = new ValidationSettingsValidator();

/**
 * Utility functions for validation settings
 */
export const ValidationSettingsValidatorUtils = {
  /**
   * Quick validate function
   */
  validate: (settings: any, context?: ValidationContext) => {
    return validationSettingsValidator.validate(settings, context);
  },

  /**
   * Quick normalize function
   */
  normalize: (settings: any, context?: ValidationContext) => {
    const result = validationSettingsValidator.validate(settings, context);
    return result.normalizedSettings || settings;
  },

  /**
   * Validate specific field
   */
  validateField: (field: string, value: any, settings: any) => {
    return validationSettingsValidator.validateField(field, value, settings);
  },

  /**
   * Normalize specific field
   */
  normalizeField: (field: string, value: any) => {
    return validationSettingsValidator.normalizeField(field, value);
  },

  /**
   * Check if settings are valid
   */
  isValid: (settings: any, context?: ValidationContext) => {
    const result = validationSettingsValidator.validate(settings, context);
    return result.isValid;
  },

  /**
   * Get validation errors
   */
  getErrors: (settings: any, context?: ValidationContext) => {
    const result = validationSettingsValidator.validate(settings, context);
    return result.errors;
  },

  /**
   * Get validation warnings
   */
  getWarnings: (settings: any, context?: ValidationContext) => {
    const result = validationSettingsValidator.validate(settings, context);
    return result.warnings;
  },

  /**
   * Format validation error for display
   */
  formatError: (error: ValidationError): string => {
    let message = error.message;
    if (error.suggestion) {
      message += ` (${error.suggestion})`;
    }
    return message;
  },

  /**
   * Get error severity color
   */
  getErrorSeverityColor: (severity: ValidationError['severity']): string => {
    switch (severity) {
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  },

  /**
   * Get error severity icon
   */
  getErrorSeverityIcon: (severity: ValidationError['severity']): string => {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❓';
    }
  },
};

