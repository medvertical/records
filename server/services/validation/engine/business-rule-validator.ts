/**
 * Business Rule Validator
 * 
 * Handles business rule validation of FHIR resources including:
 * - Patient age validation (reasonable birth dates)
 * - Observation value validation (numeric ranges)
 * - Basic cross-field validation rules for R4
 * - Domain-specific constraints
 */

import type { ValidationIssue } from '../types/validation-types';
import moment from 'moment';
import fhirpath from 'fhirpath';

// Lazy load to avoid circular dependencies
let businessRulesService: any = null;
async function getBusinessRulesService() {
  if (!businessRulesService) {
    const module = await import('../../business-rules-service');
    businessRulesService = module.businessRulesService;
  }
  return businessRulesService;
}

/**
 * Task 9.12: Performance metrics for rule execution
 */
interface RulePerformanceMetrics {
  ruleId: string;
  ruleName: string;
  executionCount: number;
  totalExecutionTimeMs: number;
  averageExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  failureCount: number;
  errorCount: number;
  lastExecutedAt: Date;
}

export class BusinessRuleValidator {
  private businessRules: Map<string, Array<{name: string, description: string, validator: Function}>> = new Map();
  private customRulesCache: Map<string, any[]> = new Map();
  private customRulesCacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Task 9.12: Performance monitoring
  private performanceMetrics: Map<string, RulePerformanceMetrics> = new Map();

  constructor() {
    this.initializeBusinessRules();
  }

  /**
   * Initialize business rules for different resource types
   */
  private initializeBusinessRules(): void {
    // Patient business rules
    this.businessRules.set('Patient', [
      {
        name: 'patient-age-validation',
        description: 'Validate patient age is reasonable (birth date validation)',
        validator: this.validatePatientAge.bind(this)
      }
    ]);

    // Observation business rules
    this.businessRules.set('Observation', [
      {
        name: 'observation-value-range-validation',
        description: 'Validate observation values are within reasonable ranges',
        validator: this.validateObservationValueRange.bind(this)
      },
      {
        name: 'observation-effective-date-validation',
        description: 'Validate observation effective date is reasonable',
        validator: this.validateObservationEffectiveDate.bind(this)
      },
      {
        name: 'observation-status-value-consistency',
        description: 'Validate observation status and value consistency',
        validator: this.validateObservationStatusValueConsistency.bind(this)
      }
    ]);

    // Condition business rules
    this.businessRules.set('Condition', [
      {
        name: 'condition-onset-date-validation',
        description: 'Validate condition onset date is reasonable',
        validator: this.validateConditionOnsetDate.bind(this)
      },
      {
        name: 'condition-status-date-consistency',
        description: 'Validate condition status and date consistency',
        validator: this.validateConditionStatusDateConsistency.bind(this)
      }
    ]);

    // Encounter business rules
    this.businessRules.set('Encounter', [
      {
        name: 'encounter-period-validation',
        description: 'Validate encounter period is reasonable',
        validator: this.validateEncounterPeriod.bind(this)
      },
      {
        name: 'encounter-status-period-consistency',
        description: 'Validate encounter status and period consistency',
        validator: this.validateEncounterStatusPeriodConsistency.bind(this)
      }
    ]);

    console.log(`[BusinessRuleValidator] Initialized business rules for ${this.businessRules.size} FHIR R4 resource types`);
  }

  async validate(
    resource: any, 
    resourceType: string, 
    settings?: any,
    fhirVersion?: 'R4' | 'R5' | 'R6' // Task 2.4: Accept FHIR version parameter
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    console.log(`[BusinessRuleValidator] Validating ${resourceType} resource business rules...`);

    try {
      // Get built-in business rules for this resource type
      const rules = this.businessRules.get(resourceType) || [];
      
      for (const rule of rules) {
        try {
          const ruleIssues = await rule.validator(resource, resourceType);
          issues.push(...ruleIssues);
        } catch (error) {
          console.error(`[BusinessRuleValidator] Rule '${rule.name}' failed:`, error);
        }
      }

      // Task 9.11: Load and execute custom FHIRPath rules from database
      const customRuleIssues = await this.executeCustomRules(resource, resourceType);
      issues.push(...customRuleIssues);

      const validationTime = Date.now() - startTime;
      console.log(`[BusinessRuleValidator] Validated ${resourceType} business rules in ${validationTime}ms, found ${issues.length} issues`);

    } catch (error) {
      console.error('[BusinessRuleValidator] Business rule validation failed:', error);
    }

    return issues;
  }

  /**
   * Task 9.11: Execute custom FHIRPath rules from database
   */
  private async executeCustomRules(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Load custom rules from database (with caching)
      const customRules = await this.loadCustomRules(resourceType);

      if (customRules.length === 0) {
        return issues;
      }

      console.log(`[BusinessRuleValidator] Executing ${customRules.length} custom FHIRPath rules for ${resourceType}`);

      // Execute each custom rule
      for (const rule of customRules) {
        try {
          const startTime = Date.now();

          // Evaluate FHIRPath expression
          const result = fhirpath.evaluate(resource, rule.fhirPathExpression);

          const executionTime = Date.now() - startTime;

          // Check if rule passed (expression should return true or truthy value)
          const passed = Array.isArray(result)
            ? result.length > 0 && result.every((r) => r === true || r)
            : result === true || !!result;

          // Task 9.12: Record performance metrics
          this.recordRuleExecution(rule.id, rule.name, executionTime, passed, false);

          if (!passed) {
            // Rule failed - create validation issue
            issues.push({
              id: `custom-rule-${rule.id}-${Date.now()}`,
              aspect: 'business-rules',
              severity: rule.severity as 'error' | 'warning' | 'info',
              code: `custom-rule-${rule.id}`,
              message: rule.name,
              path: '',
              humanReadable: rule.description,
              details: {
                ruleName: rule.name,
                ruleId: rule.id,
                expression: rule.fhirPathExpression,
                result,
                executionTimeMs: executionTime,
                resourceType: resourceType,
                validationType: 'custom-fhirpath-rule',
              },
              validationMethod: 'custom-fhirpath-rule',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R4',
            });
          }

          console.log(`[BusinessRuleValidator] Custom rule '${rule.name}' ${passed ? 'passed' : 'failed'} in ${executionTime}ms`);

        } catch (error: any) {
          console.error(`[BusinessRuleValidator] Custom rule '${rule.name}' execution error:`, error);

          // Task 9.12: Record error in performance metrics
          this.recordRuleExecution(rule.id, rule.name, 0, false, true);

          // Create error issue
          issues.push({
            id: `custom-rule-error-${rule.id}-${Date.now()}`,
            aspect: 'business-rules',
            severity: 'warning',
            code: `custom-rule-execution-error`,
            message: `Error executing custom rule: ${rule.name}`,
            path: '',
            humanReadable: `Custom rule "${rule.name}" failed to execute: ${error.message}`,
            details: {
              ruleName: rule.name,
              ruleId: rule.id,
              expression: rule.fhirPathExpression,
              error: error.message,
              resourceType: resourceType,
              validationType: 'custom-fhirpath-rule-error',
            },
            validationMethod: 'custom-fhirpath-rule',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4',
          });
        }
      }

    } catch (error: any) {
      console.error('[BusinessRuleValidator] Failed to load custom rules:', error);
      // Don't fail validation if custom rules can't be loaded
    }

    return issues;
  }

  /**
   * Task 9.11: Load custom rules from database with caching
   */
  private async loadCustomRules(resourceType: string): Promise<any[]> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.customRulesCacheExpiry > now && this.customRulesCache.has(resourceType)) {
        console.log(`[BusinessRuleValidator] Using cached custom rules for ${resourceType}`);
        return this.customRulesCache.get(resourceType) || [];
      }

      // Load from database
      const service = await getBusinessRulesService();
      if (!service) {
        console.warn('[BusinessRuleValidator] Business rules service not available');
        return [];
      }

      const rules = await service.getRulesByResourceType(resourceType);

      // Update cache
      this.customRulesCache.set(resourceType, rules);
      this.customRulesCacheExpiry = now + this.CACHE_TTL_MS;

      console.log(`[BusinessRuleValidator] Loaded ${rules.length} custom rules from database for ${resourceType}`);

      return rules;

    } catch (error: any) {
      console.error('[BusinessRuleValidator] Error loading custom rules:', error);
      return [];
    }
  }

  /**
   * Task 9.11: Clear custom rules cache (call when rules are updated)
   */
  clearCustomRulesCache(): void {
    this.customRulesCache.clear();
    this.customRulesCacheExpiry = 0;
    console.log('[BusinessRuleValidator] Custom rules cache cleared');
  }

  /**
   * Task 9.12: Record rule execution metrics
   */
  private recordRuleExecution(
    ruleId: string,
    ruleName: string,
    executionTimeMs: number,
    passed: boolean,
    hadError: boolean
  ): void {
    const existing = this.performanceMetrics.get(ruleId);

    if (existing) {
      // Update existing metrics
      const newCount = existing.executionCount + 1;
      const newTotalTime = existing.totalExecutionTimeMs + executionTimeMs;

      this.performanceMetrics.set(ruleId, {
        ruleId,
        ruleName,
        executionCount: newCount,
        totalExecutionTimeMs: newTotalTime,
        averageExecutionTimeMs: newTotalTime / newCount,
        minExecutionTimeMs: Math.min(existing.minExecutionTimeMs, executionTimeMs),
        maxExecutionTimeMs: Math.max(existing.maxExecutionTimeMs, executionTimeMs),
        failureCount: existing.failureCount + (passed ? 0 : 1),
        errorCount: existing.errorCount + (hadError ? 1 : 0),
        lastExecutedAt: new Date(),
      });
    } else {
      // Create new metrics entry
      this.performanceMetrics.set(ruleId, {
        ruleId,
        ruleName,
        executionCount: 1,
        totalExecutionTimeMs: executionTimeMs,
        averageExecutionTimeMs: executionTimeMs,
        minExecutionTimeMs: executionTimeMs,
        maxExecutionTimeMs: executionTimeMs,
        failureCount: passed ? 0 : 1,
        errorCount: hadError ? 1 : 0,
        lastExecutedAt: new Date(),
      });
    }
  }

  /**
   * Task 9.12: Get performance metrics for all rules
   */
  getPerformanceMetrics(): RulePerformanceMetrics[] {
    return Array.from(this.performanceMetrics.values()).sort(
      (a, b) => b.executionCount - a.executionCount
    );
  }

  /**
   * Task 9.12: Get performance metrics for a specific rule
   */
  getRulePerformanceMetrics(ruleId: string): RulePerformanceMetrics | null {
    return this.performanceMetrics.get(ruleId) || null;
  }

  /**
   * Task 9.12: Clear performance metrics
   */
  clearPerformanceMetrics(): void {
    this.performanceMetrics.clear();
    console.log('[BusinessRuleValidator] Performance metrics cleared');
  }

  /**
   * Task 9.12: Get performance summary statistics
   */
  getPerformanceSummary(): {
    totalRules: number;
    totalExecutions: number;
    averageExecutionTimeMs: number;
    slowestRules: { ruleId: string; ruleName: string; avgTimeMs: number }[];
    mostFailedRules: { ruleId: string; ruleName: string; failureRate: number }[];
  } {
    const metrics = this.getPerformanceMetrics();

    const totalExecutions = metrics.reduce((sum, m) => sum + m.executionCount, 0);
    const totalTime = metrics.reduce((sum, m) => sum + m.totalExecutionTimeMs, 0);

    // Get slowest rules (top 5 by average execution time)
    const slowestRules = metrics
      .map((m) => ({
        ruleId: m.ruleId,
        ruleName: m.ruleName,
        avgTimeMs: m.averageExecutionTimeMs,
      }))
      .sort((a, b) => b.avgTimeMs - a.avgTimeMs)
      .slice(0, 5);

    // Get rules with highest failure rate (top 5)
    const mostFailedRules = metrics
      .map((m) => ({
        ruleId: m.ruleId,
        ruleName: m.ruleName,
        failureRate: m.executionCount > 0 ? m.failureCount / m.executionCount : 0,
      }))
      .filter((m) => m.failureRate > 0)
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 5);

    return {
      totalRules: metrics.length,
      totalExecutions,
      averageExecutionTimeMs: totalExecutions > 0 ? totalTime / totalExecutions : 0,
      slowestRules,
      mostFailedRules,
    };
  }

  /**
   * Validate patient age (reasonable birth dates)
   */
  private async validatePatientAge(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!resource.birthDate) {
      return issues; // No birth date to validate
    }

    try {
      const birthDate = moment(resource.birthDate, ['YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSSZ'], true);
      
      if (!birthDate.isValid()) {
        issues.push({
          id: `patient-invalid-birth-date-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'error',
          code: 'invalid-birth-date',
          message: `Invalid birth date format: ${resource.birthDate}`,
          path: 'birthDate',
          humanReadable: 'The birth date format is invalid',
          details: {
            fieldPath: 'birthDate',
            actualValue: resource.birthDate,
            resourceType: resourceType,
            validationType: 'patient-age-validation'
          },
          validationMethod: 'patient-age-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      const now = moment();
      const ageInYears = now.diff(birthDate, 'years');

      // Check for unreasonable ages
      if (ageInYears < 0) {
        issues.push({
          id: `patient-future-birth-date-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'error',
          code: 'future-birth-date',
          message: `Birth date is in the future: ${resource.birthDate}`,
          path: 'birthDate',
          humanReadable: 'The birth date cannot be in the future',
          details: {
            fieldPath: 'birthDate',
            actualValue: resource.birthDate,
            ageInYears: ageInYears,
            resourceType: resourceType,
            validationType: 'patient-age-validation'
          },
          validationMethod: 'patient-age-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      } else if (ageInYears > 150) {
        issues.push({
          id: `patient-unreasonable-age-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'warning',
          code: 'unreasonable-age',
          message: `Patient age is unreasonable: ${ageInYears} years`,
          path: 'birthDate',
          humanReadable: `The patient age of ${ageInYears} years seems unreasonable`,
          details: {
            fieldPath: 'birthDate',
            actualValue: resource.birthDate,
            ageInYears: ageInYears,
            resourceType: resourceType,
            validationType: 'patient-age-validation'
          },
          validationMethod: 'patient-age-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[BusinessRuleValidator] Patient age validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate observation value ranges
   */
  private async validateObservationValueRange(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check valueQuantity
    if (resource.valueQuantity) {
      const value = resource.valueQuantity.value;
      const unit = resource.valueQuantity.unit;
      const code = resource.code?.coding?.[0]?.code;

      if (typeof value === 'number') {
        // Blood pressure validation
        if (code === '85354-9' && unit === 'mm[Hg]') { // Blood pressure
          if (value < 50 || value > 300) {
            issues.push({
              id: `observation-blood-pressure-range-${Date.now()}`,
              aspect: 'business-rules',
              severity: 'warning',
              code: 'value-out-of-range',
              message: `Blood pressure value ${value} ${unit} is outside normal range (50-300 mmHg)`,
              path: 'valueQuantity.value',
              humanReadable: `Blood pressure value of ${value} ${unit} is outside the normal range`,
              details: {
                fieldPath: 'valueQuantity.value',
                actualValue: value,
                unit: unit,
                expectedRange: '50-300 mmHg',
                code: code,
                resourceType: resourceType,
                validationType: 'observation-value-range-validation'
              },
              validationMethod: 'observation-value-range-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R4'
            });
          }
        }
        // Heart rate validation
        else if (code === '8867-4' && unit === '/min') { // Heart rate
          if (value < 30 || value > 300) {
            issues.push({
              id: `observation-heart-rate-range-${Date.now()}`,
              aspect: 'business-rules',
              severity: 'warning',
              code: 'value-out-of-range',
              message: `Heart rate value ${value} ${unit} is outside normal range (30-300 /min)`,
              path: 'valueQuantity.value',
              humanReadable: `Heart rate value of ${value} ${unit} is outside the normal range`,
              details: {
                fieldPath: 'valueQuantity.value',
                actualValue: value,
                unit: unit,
                expectedRange: '30-300 /min',
                code: code,
                resourceType: resourceType,
                validationType: 'observation-value-range-validation'
              },
              validationMethod: 'observation-value-range-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R4'
            });
          }
        }
        // Temperature validation
        else if (unit === 'Cel' || unit === 'degC') { // Temperature in Celsius
          if (value < 25 || value > 45) {
            issues.push({
              id: `observation-temperature-range-${Date.now()}`,
              aspect: 'business-rules',
              severity: 'warning',
              code: 'value-out-of-range',
              message: `Temperature value ${value} ${unit} is outside normal range (25-45°C)`,
              path: 'valueQuantity.value',
              humanReadable: `Temperature value of ${value} ${unit} is outside the normal range`,
              details: {
                fieldPath: 'valueQuantity.value',
                actualValue: value,
                unit: unit,
                expectedRange: '25-45°C',
                code: code,
                resourceType: resourceType,
                validationType: 'observation-value-range-validation'
              },
              validationMethod: 'observation-value-range-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R4'
            });
          }
        }
        // Generic negative value validation
        else if (value < 0 && unit !== 'kg' && unit !== 'g' && unit !== 'mg') { // Negative values (except weights)
          issues.push({
            id: `observation-negative-value-${Date.now()}`,
            aspect: 'business-rules',
            severity: 'warning',
            code: 'negative-value',
            message: `Observation value ${value} ${unit} is negative`,
            path: 'valueQuantity.value',
            humanReadable: `Observation value of ${value} ${unit} is negative, which may be unusual`,
            details: {
              fieldPath: 'valueQuantity.value',
              actualValue: value,
              unit: unit,
              code: code,
              resourceType: resourceType,
              validationType: 'observation-value-range-validation'
            },
            validationMethod: 'observation-value-range-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate observation effective date
   */
  private async validateObservationEffectiveDate(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const effectiveDate = resource.effectiveDateTime || resource.effectivePeriod?.start;
    if (!effectiveDate) {
      return issues; // No effective date to validate
    }

    try {
      const effectiveMoment = moment(effectiveDate, ['YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSSZ'], true);
      
      if (!effectiveMoment.isValid()) {
        issues.push({
          id: `observation-invalid-effective-date-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'error',
          code: 'invalid-effective-date',
          message: `Invalid effective date format: ${effectiveDate}`,
          path: resource.effectiveDateTime ? 'effectiveDateTime' : 'effectivePeriod.start',
          humanReadable: 'The observation effective date format is invalid',
          details: {
            fieldPath: resource.effectiveDateTime ? 'effectiveDateTime' : 'effectivePeriod.start',
            actualValue: effectiveDate,
            resourceType: resourceType,
            validationType: 'observation-effective-date-validation'
          },
          validationMethod: 'observation-effective-date-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      const now = moment();
      const daysDiff = now.diff(effectiveMoment, 'days');

      // Check for future effective dates
      if (daysDiff < -1) { // Allow 1 day in future for rounding
        issues.push({
          id: `observation-future-effective-date-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'warning',
          code: 'future-effective-date',
          message: `Observation effective date is in the future: ${effectiveDate}`,
          path: resource.effectiveDateTime ? 'effectiveDateTime' : 'effectivePeriod.start',
          humanReadable: 'The observation effective date is in the future',
          details: {
            fieldPath: resource.effectiveDateTime ? 'effectiveDateTime' : 'effectivePeriod.start',
            actualValue: effectiveDate,
            daysInFuture: Math.abs(daysDiff),
            resourceType: resourceType,
            validationType: 'observation-effective-date-validation'
          },
          validationMethod: 'observation-effective-date-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[BusinessRuleValidator] Observation effective date validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate observation status and value consistency
   */
  private async validateObservationStatusValueConsistency(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if observation has status 'final' but no value
    if (resource.status === 'final' && !resource.valueQuantity && !resource.valueString && !resource.valueBoolean && !resource.valueInteger) {
      issues.push({
        id: `observation-final-no-value-${Date.now()}`,
        aspect: 'business-rules',
        severity: 'warning',
        code: 'final-status-no-value',
        message: 'Observation has final status but no value',
        path: 'status',
        humanReadable: 'An observation with final status should have a value',
        details: {
          fieldPath: 'status',
          actualValue: resource.status,
          resourceType: resourceType,
          validationType: 'observation-status-value-consistency'
        },
        validationMethod: 'observation-status-value-consistency',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Validate condition onset date
   */
  private async validateConditionOnsetDate(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const onsetDate = resource.onsetDateTime || resource.onsetPeriod?.start;
    if (!onsetDate) {
      return issues; // No onset date to validate
    }

    try {
      const onsetMoment = moment(onsetDate, ['YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSSZ'], true);
      
      if (!onsetMoment.isValid()) {
        issues.push({
          id: `condition-invalid-onset-date-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'error',
          code: 'invalid-onset-date',
          message: `Invalid onset date format: ${onsetDate}`,
          path: resource.onsetDateTime ? 'onsetDateTime' : 'onsetPeriod.start',
          humanReadable: 'The condition onset date format is invalid',
          details: {
            fieldPath: resource.onsetDateTime ? 'onsetDateTime' : 'onsetPeriod.start',
            actualValue: onsetDate,
            resourceType: resourceType,
            validationType: 'condition-onset-date-validation'
          },
          validationMethod: 'condition-onset-date-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      const now = moment();
      const daysDiff = now.diff(onsetMoment, 'days');

      // Check for future onset dates
      if (daysDiff < -1) { // Allow 1 day in future for rounding
        issues.push({
          id: `condition-future-onset-date-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'warning',
          code: 'future-onset-date',
          message: `Condition onset date is in the future: ${onsetDate}`,
          path: resource.onsetDateTime ? 'onsetDateTime' : 'onsetPeriod.start',
          humanReadable: 'The condition onset date is in the future',
          details: {
            fieldPath: resource.onsetDateTime ? 'onsetDateTime' : 'onsetPeriod.start',
            actualValue: onsetDate,
            daysInFuture: Math.abs(daysDiff),
            resourceType: resourceType,
            validationType: 'condition-onset-date-validation'
          },
          validationMethod: 'condition-onset-date-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[BusinessRuleValidator] Condition onset date validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate condition status and date consistency
   */
  private async validateConditionStatusDateConsistency(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // This is a placeholder for more complex status-date consistency rules
    
    return issues;
  }

  /**
   * Validate encounter period
   */
  private async validateEncounterPeriod(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!resource.period) {
      return issues; // No period to validate
    }

    try {
      const startMoment = moment(resource.period.start, ['YYYY-MM-DDTHH:mm:ss.SSSZ'], true);
      const endMoment = moment(resource.period.end, ['YYYY-MM-DDTHH:mm:ss.SSSZ'], true);

      if (!startMoment.isValid()) {
        issues.push({
          id: `encounter-invalid-period-start-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'error',
          code: 'invalid-period-start',
          message: `Invalid encounter period start: ${resource.period.start}`,
          path: 'period.start',
          humanReadable: 'The encounter period start date format is invalid',
          details: {
            fieldPath: 'period.start',
            actualValue: resource.period.start,
            resourceType: resourceType,
            validationType: 'encounter-period-validation'
          },
          validationMethod: 'encounter-period-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      if (!endMoment.isValid()) {
        issues.push({
          id: `encounter-invalid-period-end-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'error',
          code: 'invalid-period-end',
          message: `Invalid encounter period end: ${resource.period.end}`,
          path: 'period.end',
          humanReadable: 'The encounter period end date format is invalid',
          details: {
            fieldPath: 'period.end',
            actualValue: resource.period.end,
            resourceType: resourceType,
            validationType: 'encounter-period-validation'
          },
          validationMethod: 'encounter-period-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Check if end is before start
      if (startMoment.isValid() && endMoment.isValid() && endMoment.isBefore(startMoment)) {
        issues.push({
          id: `encounter-end-before-start-${Date.now()}`,
          aspect: 'business-rules',
          severity: 'error',
          code: 'end-before-start',
          message: `Encounter period end is before start: ${resource.period.end} < ${resource.period.start}`,
          path: 'period',
          humanReadable: 'The encounter period end date is before the start date',
          details: {
            fieldPath: 'period',
            startValue: resource.period.start,
            endValue: resource.period.end,
            resourceType: resourceType,
            validationType: 'encounter-period-validation'
          },
          validationMethod: 'encounter-period-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[BusinessRuleValidator] Encounter period validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate encounter status and period consistency
   */
  private async validateEncounterStatusPeriodConsistency(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if encounter has finished status but no end period
    if (resource.status === 'finished' && (!resource.period || !resource.period.end)) {
      issues.push({
        id: `encounter-finished-no-end-${Date.now()}`,
        aspect: 'business-rules',
        severity: 'warning',
        code: 'finished-status-no-end',
        message: 'Encounter has finished status but no end period',
        path: 'status',
        humanReadable: 'An encounter with finished status should have an end period',
        details: {
          fieldPath: 'status',
          actualValue: resource.status,
          resourceType: resourceType,
          validationType: 'encounter-status-period-consistency'
        },
        validationMethod: 'encounter-status-period-consistency',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }
}