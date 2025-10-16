/**
 * FHIRPath Expression Validator
 * Task 9.9: Add rule validation - parse FHIRPath, check syntax errors before saving
 */

import fhirpath from 'fhirpath';

/**
 * Validation result interface
 */
export interface FHIRPathValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  ast?: any; // Abstract syntax tree if parsing succeeds
}

/**
 * FHIRPath expression complexity metrics
 */
export interface ExpressionComplexity {
  depth: number;
  functionCount: number;
  operatorCount: number;
  estimatedExecutionTime: 'fast' | 'medium' | 'slow';
}

/**
 * FHIRPathValidator class
 * Validates FHIRPath expressions for syntax errors and best practices
 */
export class FHIRPathValidator {
  /**
   * Validate a FHIRPath expression
   */
  validate(expression: string): FHIRPathValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty expression
    if (!expression || expression.trim() === '') {
      errors.push('FHIRPath expression cannot be empty');
      return { isValid: false, errors, warnings };
    }

    try {
      // Parse the FHIRPath expression
      // The fhirpath library will throw an error if the syntax is invalid
      const model = fhirpath.compile(expression);

      // If we get here, the expression is syntactically valid
      console.log('[FHIRPathValidator] Expression parsed successfully');

      // Perform additional validation checks
      this.checkForCommonIssues(expression, warnings);
      this.checkComplexity(expression, warnings);

      return {
        isValid: true,
        errors,
        warnings,
        ast: model,
      };
    } catch (error: any) {
      // Parse error occurred
      const errorMessage = this.extractErrorMessage(error);
      errors.push(errorMessage);

      // Try to provide helpful suggestions
      const suggestions = this.getSuggestions(expression, errorMessage);
      if (suggestions.length > 0) {
        warnings.push(...suggestions);
      }

      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Extract meaningful error message from parser error
   */
  private extractErrorMessage(error: any): string {
    if (error.message) {
      // Clean up error message
      let message = error.message;

      // Remove stack trace if present
      const stackIndex = message.indexOf('\n');
      if (stackIndex > 0) {
        message = message.substring(0, stackIndex);
      }

      return message;
    }

    return 'Invalid FHIRPath expression syntax';
  }

  /**
   * Get helpful suggestions based on common errors
   */
  private getSuggestions(expression: string, errorMessage: string): string[] {
    const suggestions: string[] = [];

    // Missing closing parenthesis
    const openParens = (expression.match(/\(/g) || []).length;
    const closeParens = (expression.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      suggestions.push(`Missing ${openParens - closeParens} closing parenthesis`);
    } else if (closeParens > openParens) {
      suggestions.push(`Extra ${closeParens - openParens} closing parenthesis`);
    }

    // Missing closing quote
    const singleQuotes = (expression.match(/'/g) || []).length;
    const doubleQuotes = (expression.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      suggestions.push('Unclosed single quote - check string literals');
    }
    if (doubleQuotes % 2 !== 0) {
      suggestions.push('Unclosed double quote - check string literals');
    }

    // Common typos
    if (expression.includes('exist()')) {
      suggestions.push('Did you mean exists() instead of exist()?');
    }
    if (expression.includes('count') && !expression.includes('count()')) {
      suggestions.push('Did you mean count() with parentheses?');
    }

    // Invalid operators
    if (expression.includes('==')) {
      suggestions.push('Use single = for equality, not ==');
    }
    if (expression.includes('!=')) {
      suggestions.push('Use != or consider using empty() instead');
    }
    if (expression.includes('&&') || expression.includes('||')) {
      suggestions.push('Use "and" and "or" keywords instead of && and ||');
    }

    return suggestions;
  }

  /**
   * Check for common issues and best practices
   */
  private checkForCommonIssues(expression: string, warnings: string[]): void {
    // Check for overly complex expressions
    if (expression.length > 500) {
      warnings.push('Expression is very long (>500 chars) - consider breaking into multiple rules');
    }

    // Check for potential performance issues
    if (expression.includes('.where(') && expression.includes('.where(')) {
      const whereCount = (expression.match(/\.where\(/g) || []).length;
      if (whereCount > 3) {
        warnings.push(`Expression has ${whereCount} where() clauses - may impact performance`);
      }
    }

    // Check for deprecated functions (if any)
    // (Currently none, but placeholder for future)

    // Check for missing exists() on optional fields
    if (expression.includes('implies') && !expression.includes('exists()')) {
      warnings.push('Consider using exists() to check field presence before accessing properties');
    }

    // Check for potential null reference issues
    const dotAccessCount = (expression.match(/\.\w+/g) || []).length;
    const existsCount = (expression.match(/exists\(\)/g) || []).length;
    if (dotAccessCount > 3 && existsCount === 0) {
      warnings.push('Accessing nested fields without exists() checks may cause errors if fields are missing');
    }
  }

  /**
   * Analyze expression complexity
   */
  private checkComplexity(expression: string, warnings: string[]): void {
    const complexity = this.analyzeComplexity(expression);

    if (complexity.estimatedExecutionTime === 'slow') {
      warnings.push(
        `Expression complexity is high (depth: ${complexity.depth}, functions: ${complexity.functionCount}) - may impact validation performance`
      );
    }

    if (complexity.functionCount > 10) {
      warnings.push(`Expression uses ${complexity.functionCount} functions - consider simplifying`);
    }
  }

  /**
   * Analyze expression complexity
   */
  analyzeComplexity(expression: string): ExpressionComplexity {
    // Estimate nesting depth
    let maxDepth = 0;
    let currentDepth = 0;
    for (const char of expression) {
      if (char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === ')') {
        currentDepth--;
      }
    }

    // Count function calls
    const functionPattern = /\w+\(/g;
    const functionCount = (expression.match(functionPattern) || []).length;

    // Count operators
    const operatorPattern = /\s(and|or|xor|implies|=|!=|<|>|<=|>=|\+|\-|\*|\/|div|mod)\s/gi;
    const operatorCount = (expression.match(operatorPattern) || []).length;

    // Estimate execution time based on complexity
    let estimatedExecutionTime: 'fast' | 'medium' | 'slow' = 'fast';
    const complexityScore = maxDepth * 2 + functionCount + operatorCount;

    if (complexityScore > 20) {
      estimatedExecutionTime = 'slow';
    } else if (complexityScore > 10) {
      estimatedExecutionTime = 'medium';
    }

    return {
      depth: maxDepth,
      functionCount,
      operatorCount,
      estimatedExecutionTime,
    };
  }

  /**
   * Test expression against a sample resource
   * Returns execution result and any runtime errors
   */
  async testExpression(expression: string, resource: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    executionTimeMs?: number;
  }> {
    try {
      const startTime = Date.now();

      // Execute the expression directly against the resource
      // fhirpath.evaluate handles both compilation and execution
      const result = fhirpath.evaluate(resource, expression);

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        result,
        executionTimeMs,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Expression execution failed',
      };
    }
  }

  /**
   * Batch validate multiple expressions
   */
  async validateBatch(expressions: string[]): Promise<FHIRPathValidationResult[]> {
    return expressions.map((expr) => this.validate(expr));
  }

  /**
   * Check if expression is likely to return boolean
   * (useful for validation rules which expect boolean results)
   */
  likelyReturnsBoolean(expression: string): boolean {
    // Expressions with these patterns typically return boolean
    const booleanPatterns = [
      /\.exists\(\)/,
      /\.empty\(\)/,
      /\simplies\s/,
      /\s(and|or|xor)\s/,
      /[=!<>]=?/,
      /\.all\(/,
      /\.any\(/,
      /^(true|false)$/,
    ];

    return booleanPatterns.some((pattern) => pattern.test(expression));
  }

  /**
   * Extract resource fields referenced in expression
   * Useful for determining which resource types the rule applies to
   */
  extractReferencedFields(expression: string): string[] {
    const fields = new Set<string>();

    // Match field access patterns (word followed by . or [)
    const fieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*[.\[]/g;
    let match;

    while ((match = fieldPattern.exec(expression)) !== null) {
      const fieldName = match[1];
      // Skip function names
      if (!this.isFHIRPathFunction(fieldName)) {
        fields.add(fieldName);
      }
    }

    return Array.from(fields);
  }

  /**
   * Check if a word is a FHIRPath function
   */
  private isFHIRPathFunction(word: string): boolean {
    const functions = [
      'exists', 'empty', 'all', 'any', 'where', 'select', 'count', 'distinct',
      'first', 'last', 'tail', 'skip', 'take', 'union', 'combine', 'intersect',
      'exclude', 'matches', 'contains', 'startsWith', 'endsWith', 'length',
      'substring', 'replace', 'indexOf', 'toInteger', 'toDecimal', 'toString',
      'toBoolean', 'now', 'today', 'hasValue', 'ofType', 'memberOf', 'iif',
    ];

    return functions.includes(word.toLowerCase());
  }
}

/**
 * Singleton instance
 */
export const fhirpathValidator = new FHIRPathValidator();

