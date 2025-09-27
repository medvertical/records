/**
 * Validation Result Filtering Service
 * 
 * This service provides real-time filtering of validation results based on
 * enabled validation aspects. It listens to settings changes and provides
 * filtered results for UI components.
 */

import { EventEmitter } from 'events';
import { getValidationSettingsService } from '../settings';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import type { ValidationResult, ValidationAspectResult } from '../types/validation-types';
import { ALL_VALIDATION_ASPECTS } from '../types/validation-types';

export interface FilteredValidationResult {
  resourceId: string;
  resourceType: string;
  isValid: boolean;
  issues: any[];
  aspects: ValidationAspectResult[];
  validatedAt: Date;
  validationTime: number;
  // Filtered data based on enabled aspects
  filteredIssues: any[];
  filteredAspects: ValidationAspectResult[];
  filteredScore: number;
  filteredErrorCount: number;
  filteredWarningCount: number;
  filteredInformationCount: number;
}

export interface ValidationResultFilter {
  enabledAspects: Set<string>;
  aspectBreakdown: Record<string, {
    isValid: boolean;
    issueCount: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  }>;
}

export class ValidationResultFilteringService extends EventEmitter {
  private settingsService: ReturnType<typeof getValidationSettingsService>;
  private currentFilter: ValidationResultFilter | null = null;
  private isInitialized = false;

  constructor() {
    super();
    this.settingsService = getValidationSettingsService();
    this.setupSettingsListeners();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load initial settings
      await this.loadCurrentSettings();
      this.isInitialized = true;
      console.log('[ValidationResultFiltering] Service initialized');
    } catch (error) {
      console.error('[ValidationResultFiltering] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up listeners for settings changes
   */
  private setupSettingsListeners(): void {
    this.settingsService.on('settingsChanged', (event) => {
      console.log('[ValidationResultFiltering] Settings changed, updating filter');
      this.loadCurrentSettings().catch(error => {
        console.error('[ValidationResultFiltering] Failed to reload settings:', error);
      });
    });

    this.settingsService.on('settingsReset', () => {
      console.log('[ValidationResultFiltering] Settings reset, updating filter');
      this.loadCurrentSettings().catch(error => {
        console.error('[ValidationResultFiltering] Failed to reload settings:', error);
      });
    });
  }

  /**
   * Load current settings and update filter
   */
  private async loadCurrentSettings(): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      this.updateFilter(settings);
    } catch (error) {
      console.error('[ValidationResultFiltering] Failed to load settings:', error);
      // Use default filter if settings can't be loaded
      this.updateFilter(null);
    }
  }

  /**
   * Update the current filter based on settings
   */
  private updateFilter(settings: ValidationSettings | null): void {
    const enabledAspects = new Set<string>();
    const aspectBreakdown: Record<string, any> = {};

    if (settings) {
      // Extract enabled aspects from settings
      ALL_VALIDATION_ASPECTS.forEach(aspect => {
        const aspectConfig = (settings as any)[aspect];
        if (aspectConfig && typeof aspectConfig === 'object' && aspectConfig.enabled === true) {
          enabledAspects.add(aspect);
        }
        aspectBreakdown[aspect] = {
          isValid: true,
          issueCount: 0,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0
        };
      });
    } else {
      // If no settings, enable all aspects (default behavior)
      ALL_VALIDATION_ASPECTS.forEach(aspect => {
        enabledAspects.add(aspect);
        aspectBreakdown[aspect] = {
          isValid: true,
          issueCount: 0,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0
        };
      });
    }

    this.currentFilter = {
      enabledAspects,
      aspectBreakdown
    };

    console.log('[ValidationResultFiltering] Filter updated:', {
      enabledAspects: Array.from(enabledAspects),
      totalAspects: ALL_VALIDATION_ASPECTS.length
    });

    // Emit filter change event
    this.emit('filterChanged', this.currentFilter);
  }

  /**
   * Filter validation results based on enabled aspects
   */
  filterValidationResult(result: ValidationResult): FilteredValidationResult {
    if (!this.currentFilter) {
      // If no filter, return original result
      return this.createFilteredResult(result, result.issues, result.aspects);
    }

    const { enabledAspects } = this.currentFilter;

    // Filter aspects based on enabled aspects
    const filteredAspects = result.aspects.filter(aspect => 
      enabledAspects.has(aspect.aspect)
    );

    // Filter issues based on enabled aspects
    const filteredIssues = result.issues.filter(issue => 
      enabledAspects.has(issue.aspect)
    );

    return this.createFilteredResult(result, filteredIssues, filteredAspects);
  }

  /**
   * Filter multiple validation results
   */
  filterValidationResults(results: ValidationResult[]): FilteredValidationResult[] {
    return results.map(result => this.filterValidationResult(result));
  }

  /**
   * Create a filtered validation result
   */
  private createFilteredResult(
    originalResult: ValidationResult,
    filteredIssues: any[],
    filteredAspects: ValidationAspectResult[]
  ): FilteredValidationResult {
    // Calculate filtered counts
    const filteredErrorCount = filteredIssues.filter(issue => issue.severity === 'error').length;
    const filteredWarningCount = filteredIssues.filter(issue => issue.severity === 'warning').length;
    const filteredInformationCount = filteredIssues.filter(issue => issue.severity === 'info').length;

    // Calculate filtered score (percentage of valid aspects)
    const totalAspects = filteredAspects.length;
    const validAspects = filteredAspects.filter(aspect => aspect.isValid).length;
    const filteredScore = totalAspects > 0 ? Math.round((validAspects / totalAspects) * 100) : 100;

    // Determine if result is valid based on filtered data
    const filteredIsValid = filteredErrorCount === 0;

    return {
      resourceId: originalResult.resourceId,
      resourceType: originalResult.resourceType,
      isValid: filteredIsValid,
      issues: originalResult.issues, // Keep original issues for reference
      aspects: originalResult.aspects, // Keep original aspects for reference
      validatedAt: originalResult.validatedAt,
      validationTime: originalResult.validationTime,
      // Filtered data
      filteredIssues,
      filteredAspects,
      filteredScore,
      filteredErrorCount,
      filteredWarningCount,
      filteredInformationCount
    };
  }

  /**
   * Get current filter state
   */
  getCurrentFilter(): ValidationResultFilter | null {
    return this.currentFilter;
  }

  /**
   * Get enabled aspects
   */
  getEnabledAspects(): Set<string> {
    return this.currentFilter?.enabledAspects || new Set(ALL_VALIDATION_ASPECTS);
  }

  /**
   * Check if an aspect is enabled
   */
  isAspectEnabled(aspect: string): boolean {
    return this.currentFilter?.enabledAspects.has(aspect) ?? true;
  }

  /**
   * Get filtered validation summary for dashboard
   */
  getFilteredValidationSummary(results: ValidationResult[]): {
    totalResources: number;
    validResources: number;
    invalidResources: number;
    totalErrors: number;
    totalWarnings: number;
    totalInformation: number;
    averageScore: number;
    aspectBreakdown: Record<string, {
      total: number;
      valid: number;
      invalid: number;
      errorCount: number;
      warningCount: number;
      informationCount: number;
    }>;
  } {
    const filteredResults = this.filterValidationResults(results);
    
    const totalResources = filteredResults.length;
    const validResources = filteredResults.filter(r => r.isValid).length;
    const invalidResources = totalResources - validResources;
    
    const totalErrors = filteredResults.reduce((sum, r) => sum + r.filteredErrorCount, 0);
    const totalWarnings = filteredResults.reduce((sum, r) => sum + r.filteredWarningCount, 0);
    const totalInformation = filteredResults.reduce((sum, r) => sum + r.filteredInformationCount, 0);
    
    const averageScore = totalResources > 0 
      ? Math.round(filteredResults.reduce((sum, r) => sum + r.filteredScore, 0) / totalResources)
      : 100;

    // Calculate aspect breakdown
    const aspectBreakdown: Record<string, any> = {};
    ALL_VALIDATION_ASPECTS.forEach(aspect => {
      const aspectResults = filteredResults.flatMap(r => 
        r.filteredAspects.filter(a => a.aspect === aspect)
      );
      
      const total = aspectResults.length;
      const valid = aspectResults.filter(a => a.isValid).length;
      const invalid = total - valid;
      
      const errorCount = aspectResults.reduce((sum, a) => 
        sum + a.issues.filter(i => i.severity === 'error').length, 0
      );
      const warningCount = aspectResults.reduce((sum, a) => 
        sum + a.issues.filter(i => i.severity === 'warning').length, 0
      );
      const informationCount = aspectResults.reduce((sum, a) => 
        sum + a.issues.filter(i => i.severity === 'info').length, 0
      );

      aspectBreakdown[aspect] = {
        total,
        valid,
        invalid,
        errorCount,
        warningCount,
        informationCount
      };
    });

    return {
      totalResources,
      validResources,
      invalidResources,
      totalErrors,
      totalWarnings,
      totalInformation,
      averageScore,
      aspectBreakdown
    };
  }
}

// Singleton instance
let validationResultFilteringServiceInstance: ValidationResultFilteringService | null = null;

export function getValidationResultFilteringService(): ValidationResultFilteringService {
  if (!validationResultFilteringServiceInstance) {
    validationResultFilteringServiceInstance = new ValidationResultFilteringService();
  }
  return validationResultFilteringServiceInstance;
}
