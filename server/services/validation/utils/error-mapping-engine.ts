/**
 * Error Mapping Engine
 * 
 * Translates technical FHIR validation error codes into user-friendly messages
 * with actionable suggested fixes. Loads mappings from error-mappings.json and
 * performs context variable substitution.
 * 
 * Features:
 * - Load error mappings from JSON configuration
 * - Context variable substitution ({code}, {system}, {valueSet}, etc.)
 * - Fallback to original message if no mapping found
 * - Aspect-specific error handling
 * - Suggested fixes generation
 * 
 * Responsibilities: Error translation ONLY
 * - Does not perform validation (handled by validators)
 * - Does not modify ValidationIssue objects (returns enhanced data)
 * 
 * File size: ~250 lines (adhering to global.mdc standards)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { ValidationIssue } from '../types/validation-types';
import type { ValidationAspect } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export interface ErrorMapping {
  /** User-friendly error message (with context variables) */
  userMessage: string;
  
  /** Array of suggested fixes */
  suggestedFixes: string[];
  
  /** Error severity */
  severity: 'error' | 'warning' | 'info';
  
  /** Documentation URL */
  documentation: string;
}

export interface EnhancedValidationIssue extends ValidationIssue {
  /** User-friendly message (translated) */
  userMessage: string;
  
  /** Suggested fixes */
  suggestedFixes: string[];
  
  /** Documentation URL */
  documentationUrl?: string;
  
  /** Whether error mapping was applied */
  mapped: boolean;
}

export interface ErrorContext {
  /** Error code */
  code?: string;
  
  /** FHIR version */
  fhirVersion?: string;
  
  /** Resource type */
  resourceType?: string;
  
  /** Field path */
  path?: string;
  
  /** Additional context variables */
  [key: string]: any;
}

// ============================================================================
// Error Mapping Engine
// ============================================================================

export class ErrorMappingEngine {
  private mappings: Map<string, Map<string, ErrorMapping>> = new Map();
  private loaded: boolean = false;

  /**
   * Load error mappings from JSON file
   */
  loadMappings(): void {
    if (this.loaded) {
      return;
    }

    try {
      const mappingsPath = join(process.cwd(), 'server/config/error-mappings.json');
      const fileContent = readFileSync(mappingsPath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Parse mappings by aspect
      for (const [aspect, aspectMappings] of Object.entries(data.mappings)) {
        if (aspect.startsWith('_')) continue; // Skip comments
        
        const aspectMap = new Map<string, ErrorMapping>();
        
        for (const [code, mapping] of Object.entries(aspectMappings as any)) {
          aspectMap.set(code, mapping as ErrorMapping);
        }
        
        this.mappings.set(aspect, aspectMap);
      }

      this.loaded = true;
      console.log(
        `[ErrorMappingEngine] Loaded error mappings for ${this.mappings.size} aspects`
      );

    } catch (error) {
      console.error('[ErrorMappingEngine] Failed to load error mappings:', error);
      // Continue with empty mappings (graceful degradation)
    }
  }

  /**
   * Enhance a validation issue with user-friendly error information
   * 
   * @param issue - Original validation issue
   * @param context - Additional context for variable substitution
   * @returns Enhanced validation issue with mapped error
   */
  enhanceIssue(
    issue: ValidationIssue,
    context?: ErrorContext
  ): EnhancedValidationIssue {
    // Ensure mappings are loaded
    if (!this.loaded) {
      this.loadMappings();
    }

    // Try to find mapping for this error
    const mapping = this.findMapping(issue.aspect, issue.code);

    if (!mapping) {
      // No mapping found, return original issue with defaults
      return {
        ...issue,
        userMessage: issue.message,
        suggestedFixes: [],
        mapped: false,
      };
    }

    // Build context for variable substitution
    const fullContext: ErrorContext = {
      code: issue.code,
      path: issue.path,
      fhirVersion: context?.fhirVersion,
      resourceType: context?.resourceType,
      ...this.extractContextFromMessage(issue.message),
      ...context,
    };

    // Substitute variables in user message
    const userMessage = this.substituteVariables(mapping.userMessage, fullContext);

    // Substitute variables in suggested fixes
    const suggestedFixes = mapping.suggestedFixes.map(fix =>
      this.substituteVariables(fix, fullContext)
    );

    return {
      ...issue,
      userMessage,
      suggestedFixes,
      documentationUrl: mapping.documentation || undefined,
      mapped: true,
    };
  }

  /**
   * Enhance multiple validation issues
   * 
   * @param issues - Array of validation issues
   * @param context - Shared context for all issues
   * @returns Array of enhanced issues
   */
  enhanceIssues(
    issues: ValidationIssue[],
    context?: ErrorContext
  ): EnhancedValidationIssue[] {
    return issues.map(issue => this.enhanceIssue(issue, context));
  }

  /**
   * Get error mapping for a specific code
   * 
   * @param aspect - Validation aspect
   * @param code - Error code
   * @returns Error mapping if found, null otherwise
   */
  getMapping(aspect: ValidationAspect | string, code?: string): ErrorMapping | null {
    return this.findMapping(aspect, code);
  }

  /**
   * Check if a mapping exists for an error code
   */
  hasMapping(aspect: ValidationAspect | string, code?: string): boolean {
    return this.findMapping(aspect, code) !== null;
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Find error mapping for aspect and code
   */
  private findMapping(aspect: string, code?: string): ErrorMapping | null {
    if (!code) return null;

    // Try aspect-specific mapping first
    const aspectMappings = this.mappings.get(aspect);
    if (aspectMappings?.has(code)) {
      return aspectMappings.get(code)!;
    }

    // Try system-wide mapping
    const systemMappings = this.mappings.get('system');
    if (systemMappings?.has(code)) {
      return systemMappings.get(code)!;
    }

    return null;
  }

  /**
   * Substitute context variables in a string
   * Format: {variableName}
   */
  private substituteVariables(template: string, context: ErrorContext): string {
    let result = template;

    // Replace all {variable} patterns
    const variablePattern = /\{(\w+)\}/g;
    result = result.replace(variablePattern, (match, varName) => {
      const value = context[varName];
      return value !== undefined ? String(value) : match;
    });

    return result;
  }

  /**
   * Extract context variables from error message
   * Attempts to parse common patterns from HAPI/FHIR error messages
   */
  private extractContextFromMessage(message: string): Record<string, any> {
    const context: Record<string, any> = {};

    // Extract code from message (pattern: code 'xxx')
    const codeMatch = message.match(/code '([^']+)'/i);
    if (codeMatch) {
      context.code = codeMatch[1];
    }

    // Extract system from message (pattern: system 'http://...')
    const systemMatch = message.match(/system '([^']+)'/i);
    if (systemMatch) {
      context.system = systemMatch[1];
    }

    // Extract ValueSet from message
    const valueSetMatch = message.match(/ValueSet '([^']+)'/i);
    if (valueSetMatch) {
      context.valueSet = valueSetMatch[1];
    }

    // Extract profile from message
    const profileMatch = message.match(/profile '([^']+)'/i);
    if (profileMatch) {
      context.profileUrl = profileMatch[1];
    }

    return context;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let engineInstance: ErrorMappingEngine | null = null;

/**
 * Get or create singleton ErrorMappingEngine instance
 */
export function getErrorMappingEngine(): ErrorMappingEngine {
  if (!engineInstance) {
    engineInstance = new ErrorMappingEngine();
    engineInstance.loadMappings();
  }
  return engineInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetErrorMappingEngine(): void {
  engineInstance = null;
}

