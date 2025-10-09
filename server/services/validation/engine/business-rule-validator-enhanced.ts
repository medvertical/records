/**
 * Business Rule Validator (Enhanced)
 * 
 * Task 6.7-6.8: Enhanced business rule validator with FHIRPath support
 * 
 * Features:
 * - Load custom rules from database
 * - Execute FHIRPath expressions
 * - Rule timeout protection (2s per rule)
 * - Execution tracking and audit
 */

import type { ValidationIssue } from '../types/validation-types';
import { db } from '../../../db';
import { businessRules, businessRuleExecutions, InsertBusinessRuleExecution } from '@shared/schema-business-rules';
import { eq, and, sql } from 'drizzle-orm';
import { getFHIRPathEvaluator } from './fhirpath-evaluator';

// ============================================================================
// Types
// ============================================================================

interface BusinessRuleExecutionResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  executionTimeMs: number;
  error?: string;
  validationMessage?: string;
  suggestions?: string[];
}

// ============================================================================
// BusinessRuleValidator Class (Enhanced)
// ============================================================================

export class BusinessRuleValidatorEnhanced {
  private fhirpathEvaluator = getFHIRPathEvaluator();
  private ruleCache: Map<string, any[]> = new Map();
  private cacheTTL = 60000; // 1 minute cache
  private lastCacheUpdate = 0;

  // ==========================================================================
  // Main Validation Method
  // ==========================================================================

  /**
   * Validate resource against business rules
   * 
   * @param resource - FHIR resource to validate
   * @param resourceType - Type of FHIR resource
   * @param fhirVersion - FHIR version (R4, R5, R6)
   * @returns Array of validation issues
   */
  async validate(
    resource: any,
    resourceType: string,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    try {
      console.log(`[BusinessRuleValidator] Validating ${resourceType} against business rules...`);

      // Load applicable rules
      const rules = await this.getApplicableRules(resourceType, fhirVersion || 'R4');

      if (rules.length === 0) {
        console.log(`[BusinessRuleValidator] No business rules found for ${resourceType}`);
        return [];
      }

      console.log(`[BusinessRuleValidator] Found ${rules.length} applicable rule(s)`);

      // Execute each rule
      for (const rule of rules) {
        try {
          const result = await this.executeRule(rule, resource, resourceType, fhirVersion);

          // Track execution
          await this.trackExecution(rule, result, resource);

          // If rule failed, create validation issue
          if (!result.passed) {
            issues.push({
              id: `business-rule-${rule.ruleId}-${Date.now()}`,
              aspect: 'businessRule',
              severity: rule.severity as 'error' | 'warning' | 'information',
              code: rule.ruleId,
              message: result.validationMessage || rule.validationMessage || `Business rule ${rule.name} failed`,
              path: '',
              timestamp: new Date(),
              suggestions: result.suggestions || rule.suggestions || []
            });
          }

        } catch (error: any) {
          console.error(`[BusinessRuleValidator] Rule execution error for ${rule.ruleId}:`, error);
          
          // Add error as validation issue
          issues.push({
            id: `business-rule-error-${rule.ruleId}-${Date.now()}`,
            aspect: 'businessRule',
            severity: 'warning',
            code: `${rule.ruleId}-execution-error`,
            message: `Business rule execution error: ${error.message}`,
            path: '',
            timestamp: new Date()
          });
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[BusinessRuleValidator] Completed in ${duration}ms, found ${issues.length} issue(s)`);

      return issues;

    } catch (error: any) {
      console.error('[BusinessRuleValidator] Validation failed:', error);
      
      return [{
        id: `business-rule-validation-error-${Date.now()}`,
        aspect: 'businessRule',
        severity: 'warning',
        code: 'business-rule-validation-error',
        message: `Business rule validation failed: ${error.message}`,
        path: '',
        timestamp: new Date()
      }];
    }
  }

  // ==========================================================================
  // Rule Management
  // ==========================================================================

  /**
   * Get applicable rules for resource type and FHIR version
   */
  private async getApplicableRules(
    resourceType: string,
    fhirVersion: string
  ): Promise<any[]> {
    // Check cache
    const cacheKey = `${resourceType}-${fhirVersion}`;
    const now = Date.now();

    if (this.ruleCache.has(cacheKey) && (now - this.lastCacheUpdate) < this.cacheTTL) {
      return this.ruleCache.get(cacheKey) || [];
    }

    // Load from database
    try {
      const rules = await db
        .select()
        .from(businessRules)
        .where(
          and(
            eq(businessRules.enabled, true),
            sql`${resourceType} = ANY(${businessRules.resourceTypes})`,
            sql`${fhirVersion} = ANY(${businessRules.fhirVersions})`
          )
        );

      // Update cache
      this.ruleCache.set(cacheKey, rules);
      this.lastCacheUpdate = now;

      return rules;

    } catch (error) {
      console.error('[BusinessRuleValidator] Failed to load rules:', error);
      return [];
    }
  }

  /**
   * Execute a single business rule
   * 
   * Task 6.8: Includes timeout protection (2s)
   */
  private async executeRule(
    rule: any,
    resource: any,
    resourceType: string,
    fhirVersion?: string
  ): Promise<BusinessRuleExecutionResult> {
    const startTime = Date.now();

    try {
      // Execute FHIRPath expression with 2s timeout
      const result = await this.fhirpathEvaluator.evaluateBoolean(
        resource,
        rule.expression,
        { timeout: 2000 } // Task 6.8: 2s timeout per rule
      );

      const executionTimeMs = Date.now() - startTime;

      // Update rule statistics
      await this.updateRuleStatistics(rule.id, executionTimeMs);

      return {
        ruleId: rule.ruleId,
        ruleName: rule.name,
        passed: result.result,
        executionTimeMs,
        error: result.error,
        validationMessage: rule.validationMessage,
        suggestions: rule.suggestions
      };

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      return {
        ruleId: rule.ruleId,
        ruleName: rule.name,
        passed: false,
        executionTimeMs,
        error: error.message || 'Unknown error',
        validationMessage: `Rule execution failed: ${error.message}`,
        suggestions: []
      };
    }
  }

  // ==========================================================================
  // Statistics & Tracking
  // ==========================================================================

  /**
   * Track rule execution for audit trail
   */
  private async trackExecution(
    rule: any,
    result: BusinessRuleExecutionResult,
    resource: any
  ): Promise<void> {
    try {
      const execution: InsertBusinessRuleExecution = {
        businessRuleId: rule.id,
        resourceType: resource.resourceType,
        fhirVersion: resource.meta?.fhirVersion || 'R4',
        passed: result.passed,
        resultValue: JSON.stringify({ passed: result.passed }),
        executionTimeMs: result.executionTimeMs.toString(),
        errorMessage: result.error
      };

      await db.insert(businessRuleExecutions).values(execution);

    } catch (error) {
      console.error('[BusinessRuleValidator] Failed to track execution:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Update rule statistics
   */
  private async updateRuleStatistics(
    ruleId: number,
    executionTimeMs: number
  ): Promise<void> {
    try {
      await db
        .update(businessRules)
        .set({
          executionCount: sql`${businessRules.executionCount} + 1`,
          lastExecutedAt: new Date(),
          // Calculate running average
          avgExecutionTimeMs: sql`
            CASE 
              WHEN ${businessRules.executionCount} = 0 
              THEN ${executionTimeMs}
              ELSE (${businessRules.avgExecutionTimeMs} * ${businessRules.executionCount} + ${executionTimeMs}) / (${businessRules.executionCount} + 1)
            END
          `
        })
        .where(eq(businessRules.id, ruleId));

    } catch (error) {
      console.error('[BusinessRuleValidator] Failed to update statistics:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Clear rule cache (call after rule updates)
   */
  clearCache(): void {
    this.ruleCache.clear();
    this.lastCacheUpdate = 0;
    console.log('[BusinessRuleValidator] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; age: number } {
    return {
      size: this.ruleCache.size,
      age: Date.now() - this.lastCacheUpdate
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let businessRuleValidatorEnhanced: BusinessRuleValidatorEnhanced | null = null;

export function getBusinessRuleValidatorEnhanced(): BusinessRuleValidatorEnhanced {
  if (!businessRuleValidatorEnhanced) {
    businessRuleValidatorEnhanced = new BusinessRuleValidatorEnhanced();
  }
  return businessRuleValidatorEnhanced;
}

export default BusinessRuleValidatorEnhanced;

