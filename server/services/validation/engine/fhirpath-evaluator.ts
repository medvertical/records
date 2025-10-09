/**
 * FHIRPath Evaluator
 * 
 * Task 6.2-6.3: FHIRPath expression evaluator for business rules
 * 
 * Requirements:
 * - npm install fhirpath
 * 
 * Features:
 * - Evaluate FHIRPath expressions against FHIR resources
 * - Error handling and timeout protection
 * - Expression validation
 * - Support for custom business rules
 */

// NOTE: Install with: npm install fhirpath
// @ts-ignore - FHIRPath library will be installed
import fhirpath from 'fhirpath';

// ============================================================================
// Types
// ============================================================================

export interface FHIRPathEvaluationOptions {
  timeout?: number; // Timeout in milliseconds (default: 2000ms)
  context?: Record<string, any>; // Additional context variables
}

export interface FHIRPathEvaluationResult {
  success: boolean;
  result: any;
  resultType: 'boolean' | 'number' | 'string' | 'array' | 'object' | 'null' | 'error';
  executionTime: number;
  error?: string;
}

export interface ExpressionValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

// ============================================================================
// FHIRPath Evaluator Class
// ============================================================================

export class FHIRPathEvaluator {
  private defaultTimeout = 2000; // 2 seconds

  // ==========================================================================
  // Expression Evaluation
  // ==========================================================================

  /**
   * Evaluate FHIRPath expression against a resource
   * 
   * @param resource - FHIR resource to evaluate against
   * @param expression - FHIRPath expression
   * @param options - Evaluation options
   * @returns Evaluation result with type information
   */
  async evaluateExpression(
    resource: any,
    expression: string,
    options?: FHIRPathEvaluationOptions
  ): Promise<FHIRPathEvaluationResult> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.defaultTimeout;

    try {
      // Validate expression first
      const validation = this.validateExpression(expression);
      if (!validation.valid) {
        return {
          success: false,
          result: null,
          resultType: 'error',
          executionTime: Date.now() - startTime,
          error: validation.error
        };
      }

      // Execute with timeout protection
      const result = await this.executeWithTimeout(
        () => fhirpath.evaluate(resource, expression, options?.context),
        timeout
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result,
        resultType: this.getResultType(result),
        executionTime
      };

    } catch (error: any) {
      return {
        success: false,
        result: null,
        resultType: 'error',
        executionTime: Date.now() - startTime,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Evaluate boolean expression (for business rule validation)
   * 
   * @param resource - FHIR resource
   * @param expression - FHIRPath expression that should return boolean
   * @returns True if expression evaluates to true, false otherwise
   */
  async evaluateBoolean(
    resource: any,
    expression: string,
    options?: FHIRPathEvaluationOptions
  ): Promise<{ result: boolean; error?: string; executionTime: number }> {
    const evaluation = await this.evaluateExpression(resource, expression, options);

    if (!evaluation.success) {
      return {
        result: false,
        error: evaluation.error,
        executionTime: evaluation.executionTime
      };
    }

    // Convert result to boolean
    const boolResult = this.coerceToBoolean(evaluation.result);

    return {
      result: boolResult,
      executionTime: evaluation.executionTime
    };
  }

  // ==========================================================================
  // Expression Validation
  // ==========================================================================

  /**
   * Validate FHIRPath expression syntax
   * 
   * @param expression - FHIRPath expression to validate
   * @returns Validation result
   */
  validateExpression(expression: string): ExpressionValidationResult {
    // Check for empty expression
    if (!expression || expression.trim().length === 0) {
      return {
        valid: false,
        error: 'Expression cannot be empty',
        suggestion: 'Provide a valid FHIRPath expression'
      };
    }

    // Check for dangerous operations (security)
    const dangerousPatterns = [
      /eval\s*\(/i,
      /function\s*\(/i,
      /constructor/i,
      /__proto__/i,
      /prototype/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        return {
          valid: false,
          error: 'Expression contains potentially dangerous operations',
          suggestion: 'Remove eval, function, or prototype access'
        };
      }
    }

    try {
      // Try to compile the expression to check syntax
      // Note: fhirpath.compile() checks syntax without executing
      fhirpath.compile(expression);
      
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: `Syntax error: ${error.message}`,
        suggestion: 'Check FHIRPath syntax documentation'
      };
    }
  }

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(
    fn: () => T,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Expression execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Determine result type
   */
  private getResultType(result: any): FHIRPathEvaluationResult['resultType'] {
    if (result === null || result === undefined) return 'null';
    if (typeof result === 'boolean') return 'boolean';
    if (typeof result === 'number') return 'number';
    if (typeof result === 'string') return 'string';
    if (Array.isArray(result)) return 'array';
    if (typeof result === 'object') return 'object';
    return 'null';
  }

  /**
   * Coerce result to boolean
   */
  private coerceToBoolean(result: any): boolean {
    if (typeof result === 'boolean') return result;
    if (Array.isArray(result)) return result.length > 0 && result[0] === true;
    if (result === null || result === undefined) return false;
    return Boolean(result);
  }

  /**
   * Format error message
   */
  private formatError(error: any): string {
    if (error.message) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error during FHIRPath evaluation';
  }

  // ==========================================================================
  // Common FHIRPath Patterns
  // ==========================================================================

  /**
   * Get common FHIRPath patterns for autocomplete/suggestions
   */
  getCommonPatterns(): Array<{ pattern: string; description: string; example: string }> {
    return [
      {
        pattern: 'exists()',
        description: 'Check if element exists',
        example: 'Patient.name.exists()'
      },
      {
        pattern: 'empty()',
        description: 'Check if element is empty',
        example: 'Patient.name.empty()'
      },
      {
        pattern: 'count()',
        description: 'Count elements',
        example: 'Patient.identifier.count() > 0'
      },
      {
        pattern: 'where()',
        description: 'Filter collection',
        example: 'Patient.identifier.where(system = "http://...")'
      },
      {
        pattern: 'all()',
        description: 'Check if all elements match',
        example: 'Patient.name.all(family.exists())'
      },
      {
        pattern: 'matches()',
        description: 'Match against regex',
        example: 'Patient.telecom.value.matches("[0-9]+")'
      },
      {
        pattern: 'memberOf()',
        description: 'Check if code in ValueSet',
        example: 'Observation.code.memberOf("http://...")'
      }
    ];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let fhirpathEvaluator: FHIRPathEvaluator | null = null;

export function getFHIRPathEvaluator(): FHIRPathEvaluator {
  if (!fhirpathEvaluator) {
    fhirpathEvaluator = new FHIRPathEvaluator();
  }
  return fhirpathEvaluator;
}

export default FHIRPathEvaluator;

