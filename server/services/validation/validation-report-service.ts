// ============================================================================
// Validation Report Service
// ============================================================================

import { storage } from '../../storage';
import { ValidationErrorService } from './validation-error-service.js';
import { ValidationPerformanceService } from './validation-performance-service.js';

export interface ValidationReport {
  id: string;
  title: string;
  description?: string;
  type: 'summary' | 'detailed' | 'error_analysis' | 'performance' | 'custom';
  format: 'json' | 'csv' | 'pdf' | 'html';
  filters: ValidationReportFilters;
  data: any;
  generatedAt: Date;
  generatedBy: string;
  filePath?: string;
  fileSize?: number;
}

export interface ValidationReportFilters {
  startDate?: Date;
  endDate?: Date;
  resourceTypes?: string[];
  validationRuns?: string[];
  errorSeverities?: string[];
  includeDetails?: boolean;
  includeCharts?: boolean;
  includeRecommendations?: boolean;
}

export interface ValidationReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ValidationReport['type'];
  format: ValidationReport['format'];
  filters: ValidationReportFilters;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationReportSchedule {
  id: string;
  templateId: string;
  name: string;
  cronExpression: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ValidationReportService {
  private static instance: ValidationReportService;
  private templates: Map<string, ValidationReportTemplate> = new Map();
  private schedules: Map<string, ValidationReportSchedule> = new Map();

  private constructor() {}

  static getInstance(): ValidationReportService {
    if (!ValidationReportService.instance) {
      ValidationReportService.instance = new ValidationReportService();
    }
    return ValidationReportService.instance;
  }

  /**
   * Generate a validation report
   */
  async generateReport(
    type: ValidationReport['type'],
    format: ValidationReport['format'],
    filters: ValidationReportFilters,
    generatedBy: string
  ): Promise<ValidationReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[ValidationReport] Generating ${type} report in ${format} format`);

    let data: any;
    let title: string;
    let description: string;

    switch (type) {
      case 'summary':
        data = await this.generateSummaryReport(filters);
        title = 'Validation Summary Report';
        description = 'High-level overview of validation results and statistics';
        break;
      
      case 'detailed':
        data = await this.generateDetailedReport(filters);
        title = 'Detailed Validation Report';
        description = 'Comprehensive validation results with resource-level details';
        break;
      
      case 'error_analysis':
        data = await this.generateErrorAnalysisReport(filters);
        title = 'Validation Error Analysis Report';
        description = 'Detailed analysis of validation errors and recommendations';
        break;
      
      case 'performance':
        data = await this.generatePerformanceReport(filters);
        title = 'Validation Performance Report';
        description = 'Performance metrics and optimization recommendations';
        break;
      
      case 'custom':
        data = await this.generateCustomReport(filters);
        title = 'Custom Validation Report';
        description = 'Custom report based on specified filters';
        break;
      
      default:
        throw new Error(`Unknown report type: ${type}`);
    }

    const report: ValidationReport = {
      id: reportId,
      title,
      description,
      type,
      format,
      filters,
      data,
      generatedAt: new Date(),
      generatedBy
    };

    // Generate file if needed
    if (format !== 'json') {
      const filePath = await this.generateReportFile(report);
      report.filePath = filePath;
      report.fileSize = await this.getFileSize(filePath);
    }

    // Store report metadata
    await this.storeReport(report);

    console.log(`[ValidationReport] Generated report: ${reportId}`);
    return report;
  }

  /**
   * Generate summary report
   */
  private async generateSummaryReport(filters: ValidationReportFilters): Promise<any> {
    const stats = await storage.getResourceStats();
    const errorService = ValidationErrorService.getInstance();
    const performanceService = ValidationPerformanceService.getInstance();

    const errorAggregation = await errorService.getErrorAggregation(
      filters.startDate,
      filters.endDate,
      filters.resourceTypes
    );

    const performanceSummary = performanceService.getPerformanceSummary();

    return {
      summary: {
        totalResources: stats.totalResources,
        validatedResources: stats.validResources + stats.errorResources,
        validResources: stats.validResources,
        errorResources: stats.errorResources,
        validationCoverage: stats.totalResources > 0 ? 
          ((stats.validResources + stats.errorResources) / stats.totalResources) * 100 : 0,
        successRate: (stats.validResources + stats.errorResources) > 0 ? 
          (stats.validResources / (stats.validResources + stats.errorResources)) * 100 : 0
      },
      errors: {
        totalErrors: errorAggregation.totalErrors,
        errorsBySeverity: errorAggregation.errorsBySeverity,
        topErrors: errorAggregation.topErrors.slice(0, 10)
      },
      performance: {
        totalRuns: performanceSummary.totalRuns,
        averageThroughput: performanceSummary.averageThroughput,
        averageEfficiency: performanceSummary.averageEfficiency,
        totalResourcesProcessed: performanceSummary.totalResourcesProcessed
      },
      resourceTypes: stats.resourceBreakdown,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate detailed report
   */
  private async generateDetailedReport(filters: ValidationReportFilters): Promise<any> {
    const summaryData = await this.generateSummaryReport(filters);
    const errorService = ValidationErrorService.getInstance();

    // Get detailed error information
    const detailedErrors = await errorService.getErrorsForValidationRun(
      filters.validationRuns?.[0] || ''
    );

    // Get resource-level details
    const resourceDetails = await this.getResourceDetails(filters);

    return {
      ...summaryData,
      detailedErrors,
      resourceDetails,
      filters: {
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        resourceTypes: filters.resourceTypes,
        errorSeverities: filters.errorSeverities
      }
    };
  }

  /**
   * Generate error analysis report
   */
  private async generateErrorAnalysisReport(filters: ValidationReportFilters): Promise<any> {
    const errorService = ValidationErrorService.getInstance();
    const errorAggregation = await errorService.getErrorAggregation(
      filters.startDate,
      filters.endDate,
      filters.resourceTypes
    );

    const errorTrends = await errorService.getErrorTrends(
      filters.startDate ? Math.ceil((Date.now() - filters.startDate.getTime()) / (24 * 60 * 60 * 1000)) : 30,
      filters.resourceTypes
    );

    // Get detailed error analysis
    const errorAnalysis = await this.analyzeErrors(filters);

    return {
      errorSummary: {
        totalErrors: errorAggregation.totalErrors,
        errorsByType: errorAggregation.errorsByType,
        errorsBySeverity: errorAggregation.errorsBySeverity,
        errorsByCategory: errorAggregation.errorsByCategory,
        errorsByResourceType: errorAggregation.errorsByResourceType
      },
      topErrors: errorAggregation.topErrors,
      errorTrends,
      errorAnalysis,
      recommendations: this.generateErrorRecommendations(errorAggregation),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate performance report
   */
  private async generatePerformanceReport(filters: ValidationReportFilters): Promise<any> {
    const performanceService = ValidationPerformanceService.getInstance();
    const performanceHistory = performanceService.getPerformanceHistory(20);
    const benchmarks = await performanceService.getPerformanceBenchmarks();

    const performanceSummary = performanceService.getPerformanceSummary();

    return {
      performanceSummary,
      performanceHistory,
      benchmarks,
      recommendations: this.generatePerformanceRecommendations(performanceSummary),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate custom report
   */
  private async generateCustomReport(filters: ValidationReportFilters): Promise<any> {
    // Custom report based on specific filters
    const data: any = {};

    if (filters.includeDetails) {
      data.details = await this.getResourceDetails(filters);
    }

    if (filters.includeCharts) {
      data.charts = await this.generateChartData(filters);
    }

    if (filters.includeRecommendations) {
      data.recommendations = await this.generateRecommendations(filters);
    }

    return {
      customData: data,
      filters: {
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        resourceTypes: filters.resourceTypes,
        errorSeverities: filters.errorSeverities
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate report file
   */
  private async generateReportFile(report: ValidationReport): Promise<string> {
    const fileName = `${report.id}.${report.format}`;
    const filePath = `./reports/${fileName}`;

    switch (report.format) {
      case 'csv':
        await this.generateCSVFile(report, filePath);
        break;
      
      case 'pdf':
        await this.generatePDFFile(report, filePath);
        break;
      
      case 'html':
        await this.generateHTMLFile(report, filePath);
        break;
      
      default:
        throw new Error(`Unsupported format: ${report.format}`);
    }

    return filePath;
  }

  /**
   * Generate CSV file
   */
  private async generateCSVFile(report: ValidationReport, filePath: string): Promise<void> {
    // Simplified CSV generation
    const csvData = this.convertToCSV(report.data);
    // In real implementation, write to file system
    console.log(`[ValidationReport] Generated CSV file: ${filePath}`);
  }

  /**
   * Generate PDF file
   */
  private async generatePDFFile(report: ValidationReport, filePath: string): Promise<void> {
    // Simplified PDF generation
    // In real implementation, use a PDF library like puppeteer or jsPDF
    console.log(`[ValidationReport] Generated PDF file: ${filePath}`);
  }

  /**
   * Generate HTML file
   */
  private async generateHTMLFile(report: ValidationReport, filePath: string): Promise<void> {
    // Simplified HTML generation
    const htmlContent = this.generateHTMLContent(report);
    // In real implementation, write to file system
    console.log(`[ValidationReport] Generated HTML file: ${filePath}`);
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => row[header] || '');
        csvRows.push(values.join(','));
      }
      
      return csvRows.join('\n');
    }
    
    return JSON.stringify(data);
  }

  /**
   * Generate HTML content
   */
  private generateHTMLContent(report: ValidationReport): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; }
          .content { margin-top: 20px; }
          .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.title}</h1>
          <p>${report.description}</p>
          <p>Generated: ${report.generatedAt.toISOString()}</p>
        </div>
        <div class="content">
          <pre>${JSON.stringify(report.data, null, 2)}</pre>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get resource details
   */
  private async getResourceDetails(filters: ValidationReportFilters): Promise<any> {
    // Simplified implementation
    return {
      totalResources: 1000,
      validatedResources: 800,
      validResources: 750,
      errorResources: 50
    };
  }

  /**
   * Analyze errors
   */
  private async analyzeErrors(filters: ValidationReportFilters): Promise<any> {
    // Simplified implementation
    return {
      commonErrors: [
        { error: 'Missing required field', count: 25, severity: 'error' },
        { error: 'Invalid code value', count: 15, severity: 'warning' }
      ],
      errorPatterns: [
        { pattern: 'Missing patient identifier', frequency: 0.3 },
        { pattern: 'Invalid date format', frequency: 0.2 }
      ]
    };
  }

  /**
   * Generate error recommendations
   */
  private generateErrorRecommendations(errorAggregation: any): string[] {
    const recommendations: string[] = [];

    if (errorAggregation.errorsBySeverity.fatal > 0) {
      recommendations.push('Address fatal errors immediately as they prevent resource processing');
    }

    if (errorAggregation.errorsBySeverity.error > 100) {
      recommendations.push('High number of errors detected - consider reviewing validation rules');
    }

    if (errorAggregation.topErrors.length > 0) {
      recommendations.push(`Focus on fixing the most common error: ${errorAggregation.topErrors[0].message}`);
    }

    return recommendations;
  }

  /**
   * Generate performance recommendations
   */
  private generatePerformanceRecommendations(performanceSummary: any): string[] {
    const recommendations: string[] = [];

    if (performanceSummary.averageThroughput < 10) {
      recommendations.push('Consider increasing batch size to improve throughput');
    }

    if (performanceSummary.averageEfficiency < 70) {
      recommendations.push('Implement parallel processing to improve efficiency');
    }

    if (performanceSummary.topBottlenecks.length > 0) {
      recommendations.push(`Address top bottleneck: ${performanceSummary.topBottlenecks[0]}`);
    }

    return recommendations;
  }

  /**
   * Generate chart data
   */
  private async generateChartData(filters: ValidationReportFilters): Promise<any> {
    // Simplified implementation
    return {
      validationTrends: [
        { date: '2024-01-01', valid: 100, errors: 10 },
        { date: '2024-01-02', valid: 120, errors: 8 }
      ],
      errorDistribution: {
        fatal: 5,
        error: 25,
        warning: 50,
        information: 20
      }
    };
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(filters: ValidationReportFilters): Promise<string[]> {
    const recommendations: string[] = [];

    // Add general recommendations based on filters
    if (filters.resourceTypes && filters.resourceTypes.length > 0) {
      recommendations.push(`Focus validation efforts on: ${filters.resourceTypes.join(', ')}`);
    }

    if (filters.errorSeverities && filters.errorSeverities.includes('fatal')) {
      recommendations.push('Prioritize fixing fatal errors to improve data quality');
    }

    return recommendations;
  }

  /**
   * Get file size
   */
  private async getFileSize(filePath: string): Promise<number> {
    // Simplified implementation
    return 1024; // 1KB placeholder
  }

  /**
   * Store report metadata
   */
  private async storeReport(report: ValidationReport): Promise<void> {
    try {
      await storage.saveValidationReport(report);
    } catch (error) {
      console.error('Failed to store report:', error);
    }
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<ValidationReport | null> {
    try {
      return await storage.getValidationReport(reportId);
    } catch (error) {
      console.error('Failed to get report:', error);
      return null;
    }
  }

  /**
   * Get all reports
   */
  async getAllReports(limit: number = 50): Promise<ValidationReport[]> {
    try {
      return await storage.getValidationReports(limit);
    } catch (error) {
      console.error('Failed to get reports:', error);
      return [];
    }
  }

  /**
   * Delete report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      await storage.deleteValidationReport(reportId);
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  }
}
