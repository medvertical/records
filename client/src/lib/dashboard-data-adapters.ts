// ============================================================================
// Dashboard Data Adapters - Transform existing API responses to widget data format
// ============================================================================

import { 
  Alert, 
  AlertSummary, 
  OverviewMetrics, 
  ValidationStatus, 
  TrendData, 
  TrendMetrics,
  ResourceBreakdownData,
  ResourceTypeData
} from '@/shared/types/dashboard-new';
import { 
  FhirServerStats, 
  ValidationStats, 
  ValidationProgress 
} from '@shared/types/dashboard';

/**
 * Alert Data Adapter - Single responsibility: Transform validation errors and server alerts to Alert format
 * Follows global rules: Under 200 lines, single responsibility, focused on alert transformation
 */
export class AlertDataAdapter {
  static transformValidationErrors(errors: any[]): Alert[] {
    if (!Array.isArray(errors)) return [];

    return errors.map((error, index) => ({
      id: error.id || `validation-error-${index}`,
      type: this.determineAlertType(error.severity || 'warning'),
      title: error.title || 'Validation Error',
      message: error.message || 'An error occurred during validation',
      timestamp: new Date(error.timestamp || Date.now()),
      resolved: error.resolved || false,
      actions: error.actions ? this.transformActions(error.actions) : undefined,
    }));
  }

  static transformServerAlerts(alerts: any[]): Alert[] {
    if (!Array.isArray(alerts)) return [];

    return alerts.map((alert, index) => ({
      id: alert.id || `server-alert-${index}`,
      type: this.determineAlertType(alert.level || 'info'),
      title: alert.title || 'Server Alert',
      message: alert.message || 'A server alert occurred',
      timestamp: new Date(alert.timestamp || Date.now()),
      resolved: alert.resolved || false,
      actions: alert.actions ? this.transformActions(alert.actions) : undefined,
    }));
  }

  static createAlertSummary(alerts: Alert[]): AlertSummary {
    return {
      critical: alerts.filter(a => a.type === 'critical').length,
      warnings: alerts.filter(a => a.type === 'warning').length,
      info: alerts.filter(a => a.type === 'info').length,
      total: alerts.length,
    };
  }

  private static determineAlertType(severity: string): Alert['type'] {
    switch (severity?.toLowerCase()) {
      case 'error':
      case 'critical':
      case 'fatal':
        return 'critical';
      case 'warning':
      case 'warn':
        return 'warning';
      case 'info':
      case 'information':
      default:
        return 'info';
    }
  }

  private static transformActions(actions: any[]) {
    return actions.map((action, index) => ({
      id: action.id || `action-${index}`,
      label: action.label || 'Action',
      type: action.type || 'secondary',
      action: action.action || (() => {}),
    }));
  }
}

/**
 * Overview Data Adapter - Single responsibility: Transform FHIR server and validation stats to overview metrics
 * Follows global rules: Under 200 lines, single responsibility, focused on overview transformation
 */
export class OverviewDataAdapter {
  static transformToOverviewMetrics(
    fhirServerStats: FhirServerStats | undefined,
    validationStats: ValidationStats | undefined
  ): OverviewMetrics | undefined {
    if (!fhirServerStats && !validationStats) return undefined;

    const totalResources = fhirServerStats?.totalResources || 0;
    const validatedResources = validationStats?.totalValidated || 0;
    const successRate = validationStats?.validationCoverage || 0;
    const validationCoverage = totalResources > 0 ? (validatedResources / totalResources) * 100 : 0;

    return {
      totalResources,
      validatedResources,
      successRate,
      validationCoverage,
    };
  }

  static getDefaultOverviewMetrics(): OverviewMetrics {
    return {
      totalResources: 0,
      validatedResources: 0,
      successRate: 0,
      validationCoverage: 0,
    };
  }

  static validateOverviewMetrics(metrics: OverviewMetrics): boolean {
    return (
      typeof metrics.totalResources === 'number' &&
      typeof metrics.validatedResources === 'number' &&
      typeof metrics.successRate === 'number' &&
      typeof metrics.validationCoverage === 'number' &&
      metrics.totalResources >= 0 &&
      metrics.validatedResources >= 0 &&
      metrics.successRate >= 0 &&
      metrics.validationCoverage >= 0
    );
  }
}

/**
 * Status Data Adapter - Single responsibility: Transform validation progress to status format
 * Follows global rules: Under 200 lines, single responsibility, focused on status transformation
 */
export class StatusDataAdapter {
  static transformValidationProgress(progress: ValidationProgress | undefined): ValidationStatus | undefined {
    if (!progress) return undefined;

    return {
      status: progress.status,
      progress: this.calculateProgressPercentage(progress),
      totalResources: progress.totalResources,
      processedResources: progress.processedResources,
      validResources: progress.validResources,
      errorResources: progress.errorResources,
      currentResourceType: progress.currentResourceType || undefined,
      nextResourceType: undefined, // Not available in current progress data
      processingRate: progress.processingRate || 0,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
    };
  }

  static getDefaultValidationStatus(): ValidationStatus {
    return {
      status: 'idle',
      progress: 0,
      totalResources: 0,
      processedResources: 0,
      validResources: 0,
      errorResources: 0,
      processingRate: 0,
    };
  }

  static validateValidationStatus(status: ValidationStatus): boolean {
    return (
      typeof status.status === 'string' &&
      typeof status.progress === 'number' &&
      typeof status.processingRate === 'number' &&
      status.progress >= 0 &&
      status.progress <= 100 &&
      status.processingRate >= 0
    );
  }

  private static calculateProgressPercentage(progress: ValidationProgress): number {
    if (!progress.totalResources || progress.totalResources === 0) return 0;
    return (progress.processedResources / progress.totalResources) * 100;
  }
}

/**
 * Trends Data Adapter - Single responsibility: Transform historical data to trend format
 * Follows global rules: Under 200 lines, single responsibility, focused on trend transformation
 */
export class TrendsDataAdapter {
  static transformHistoricalData(historicalData: any[]): TrendData[] {
    if (!Array.isArray(historicalData)) return [];

    return historicalData.map((data) => ({
      date: new Date(data.timestamp || data.date || Date.now()),
      successRate: data.successRate || data.validationRate || 0,
      totalValidated: data.totalValidated || data.processedResources || 0,
      errorCount: data.errorCount || data.errorResources || 0,
      warningCount: data.warningCount || data.warningResources || 0,
    }));
  }

  static calculateTrendMetrics(trendData: TrendData[]): TrendMetrics | undefined {
    if (!trendData.length) return undefined;

    const current = trendData[trendData.length - 1];
    const previous = trendData.length > 1 ? trendData[trendData.length - 2] : current;

    const change = current.successRate - previous.successRate;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

    return {
      current: current.successRate,
      previous: previous.successRate,
      change: Math.abs(change),
      direction,
      period: 'vs last period',
    };
  }

  static getDefaultTrendData(): TrendData[] {
    return [];
  }

  static validateTrendData(trendData: TrendData[]): boolean {
    return Array.isArray(trendData) && trendData.every(data => 
      data.date instanceof Date &&
      typeof data.successRate === 'number' &&
      typeof data.totalValidated === 'number' &&
      typeof data.errorCount === 'number' &&
      typeof data.warningCount === 'number'
    );
  }
}

/**
 * Resource Breakdown Data Adapter - Single responsibility: Transform resource stats to breakdown format
 * Follows global rules: Under 200 lines, single responsibility, focused on resource transformation
 */
export class ResourceBreakdownDataAdapter {
  static transformResourceStats(
    fhirServerStats: FhirServerStats | undefined,
    validationStats: ValidationStats | undefined
  ): ResourceBreakdownData | undefined {
    if (!fhirServerStats?.resourceBreakdown && !validationStats?.resourceTypeBreakdown) {
      return undefined;
    }

    const totalResources = fhirServerStats?.totalResources || 0;
    const resourceTypes: ResourceTypeData[] = [];

    // Transform FHIR server resource breakdown
    if (fhirServerStats?.resourceBreakdown) {
      fhirServerStats.resourceBreakdown.forEach((resource) => {
        const validationData = validationStats?.resourceTypeBreakdown?.[resource.type];
        
        resourceTypes.push({
          type: resource.type,
          count: resource.count,
          percentage: resource.percentage,
          validated: validationData?.validated || 0,
          valid: validationData?.valid || 0,
          errors: validationData?.errors || 0,
          warnings: validationData?.warnings || 0,
          successRate: validationData?.successRate || 0,
        });
      });
    }

    // Sort by count and get top 6
    const sortedResourceTypes = resourceTypes.sort((a, b) => b.count - a.count);
    const topResourceTypes = sortedResourceTypes.slice(0, 6);

    return {
      totalResources,
      resourceTypes: sortedResourceTypes,
      topResourceTypes,
    };
  }

  static getDefaultResourceBreakdown(): ResourceBreakdownData {
    return {
      totalResources: 0,
      resourceTypes: [],
      topResourceTypes: [],
    };
  }

  static validateResourceBreakdown(data: ResourceBreakdownData): boolean {
    return (
      typeof data.totalResources === 'number' &&
      Array.isArray(data.resourceTypes) &&
      Array.isArray(data.topResourceTypes) &&
      data.totalResources >= 0
    );
  }
}

/**
 * Data Adapter Registry - Central registry for all data adapters
 */
export class DataAdapterRegistry {
  private static adapters = {
    alert: AlertDataAdapter,
    overview: OverviewDataAdapter,
    status: StatusDataAdapter,
    trends: TrendsDataAdapter,
    resourceBreakdown: ResourceBreakdownDataAdapter,
  };

  static getAdapter(type: keyof typeof DataAdapterRegistry.adapters) {
    return this.adapters[type];
  }

  static getAllAdapters() {
    return this.adapters;
  }
}

export default DataAdapterRegistry;
