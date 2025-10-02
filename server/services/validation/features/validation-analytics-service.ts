/**
 * Validation Analytics Service
 * 
 * This service provides comprehensive analytics and performance metrics for validation operations,
 * including trends, performance analysis, and dashboard statistics.
 */

import { EventEmitter } from 'events';
import { storage } from '../../../storage';
import { getValidationSettingsService } from '../settings/validation-settings-service-simplified';
import { getIndividualResourceProgressService } from './individual-resource-progress-service';
import { getValidationPollingService } from './validation-polling-service';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationAnalytics {
  overview: {
    totalResources: number;
    validatedResources: number;
    validationProgress: number;
    averageValidationScore: number;
    lastValidationRun: Date | null;
    validationTrend: 'improving' | 'stable' | 'declining';
  };
  performance: {
    averageValidationTime: number;
    fastestValidation: number;
    slowestValidation: number;
    throughputPerMinute: number;
    errorRate: number;
    successRate: number;
  };
  trends: {
    dailyValidations: Array<{
      date: string;
      count: number;
      averageScore: number;
      errorCount: number;
      warningCount: number;
    }>;
    weeklyTrend: Array<{
      week: string;
      totalValidations: number;
      averageScore: number;
      improvement: number;
    }>;
    monthlyTrend: Array<{
      month: string;
      totalValidations: number;
      averageScore: number;
      topErrors: string[];
    }>;
  };
  resourceTypeAnalytics: Array<{
    resourceType: string;
    totalCount: number;
    validatedCount: number;
    averageScore: number;
    errorRate: number;
    commonErrors: string[];
    validationTime: number;
  }>;
  aspectAnalytics: Array<{
    aspect: string;
    totalValidations: number;
    errorCount: number;
    warningCount: number;
    averageTime: number;
    successRate: number;
  }>;
  qualityMetrics: {
    dataQualityScore: number;
    complianceScore: number;
    consistencyScore: number;
    completenessScore: number;
    overallHealthScore: number;
  };
  systemHealth: {
    validationEngineStatus: 'healthy' | 'degraded' | 'error';
    averageResponseTime: number;
    errorRate: number;
    activeSessions: number;
    cacheHitRate: number;
    memoryUsage: number;
  };
}

export interface AnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface AnalyticsFilters {
  resourceTypes?: string[];
  aspects?: string[];
  minScore?: number;
  maxScore?: number;
  includeErrors?: boolean;
  includeWarnings?: boolean;
}

export interface PerformanceMetrics {
  validationThroughput: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queueLength: number;
}

export interface TrendAnalysis {
  period: string;
  metric: string;
  value: number;
  change: number;
  changePercentage: number;
  trend: 'up' | 'down' | 'stable';
  significance: 'high' | 'medium' | 'low';
}

// ============================================================================
// Validation Analytics Service
// ============================================================================

export class ValidationAnalyticsService extends EventEmitter {
  private static instance: ValidationAnalyticsService;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly CACHE_TTL = {
    OVERVIEW: 5 * 60 * 1000, // 5 minutes
    TRENDS: 15 * 60 * 1000, // 15 minutes
    PERFORMANCE: 2 * 60 * 1000, // 2 minutes
    QUALITY: 10 * 60 * 1000, // 10 minutes
    SYSTEM_HEALTH: 1 * 60 * 1000 // 1 minute
  };

  private constructor() {
    super();
    this.setupCleanupInterval();
  }

  public static getInstance(): ValidationAnalyticsService {
    if (!ValidationAnalyticsService.instance) {
      ValidationAnalyticsService.instance = new ValidationAnalyticsService();
    }
    return ValidationAnalyticsService.instance;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Get comprehensive validation analytics
   */
  public async getValidationAnalytics(
    timeRange?: AnalyticsTimeRange,
    filters?: AnalyticsFilters
  ): Promise<ValidationAnalytics> {
    const cacheKey = `analytics-${JSON.stringify({ timeRange, filters })}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const [
        overview,
        performance,
        trends,
        resourceTypeAnalytics,
        aspectAnalytics,
        qualityMetrics,
        systemHealth
      ] = await Promise.all([
        this.getOverviewAnalytics(timeRange, filters),
        this.getPerformanceAnalytics(timeRange, filters),
        this.getTrendAnalytics(timeRange, filters),
        this.getResourceTypeAnalytics(timeRange, filters),
        this.getAspectAnalytics(timeRange, filters),
        this.getQualityMetrics(timeRange, filters),
        this.getSystemHealthMetrics()
      ]);

      const analytics: ValidationAnalytics = {
        overview,
        performance,
        trends,
        resourceTypeAnalytics,
        aspectAnalytics,
        qualityMetrics,
        systemHealth
      };

      this.setCachedData(cacheKey, analytics, this.CACHE_TTL.OVERVIEW);
      return analytics;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting validation analytics:', error);
      throw error;
    }
  }

  /**
   * Get overview analytics
   */
  public async getOverviewAnalytics(
    timeRange?: AnalyticsTimeRange,
    filters?: AnalyticsFilters
  ): Promise<ValidationAnalytics['overview']> {
    const cacheKey = `overview-${JSON.stringify({ timeRange, filters })}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get basic statistics from storage
      const stats = await storage.getResourceStatsWithSettings();
      const progressStats = getIndividualResourceProgressService().getProgressStats();

      // Calculate validation progress
      const totalResources = stats.totalResources;
      const validatedResources = stats.totalResources;
      const validationProgress = totalResources > 0 ? (validatedResources / totalResources) * 100 : 0;

      // Calculate average validation score
      const averageValidationScore = this.calculateAverageScore(stats);

      // Determine validation trend
      const validationTrend = await this.calculateValidationTrend(timeRange);

      const overview = {
        totalResources,
        validatedResources,
        validationProgress,
        averageValidationScore,
        lastValidationRun: new Date(), // TODO: Get actual last validation time
        validationTrend
      };

      this.setCachedData(cacheKey, overview, this.CACHE_TTL.OVERVIEW);
      return overview;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting overview analytics:', error);
      throw error;
    }
  }

  /**
   * Get performance analytics
   */
  public async getPerformanceAnalytics(
    timeRange?: AnalyticsTimeRange,
    filters?: AnalyticsFilters
  ): Promise<ValidationAnalytics['performance']> {
    const cacheKey = `performance-${JSON.stringify({ timeRange, filters })}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const progressStats = getIndividualResourceProgressService().getProgressStats();
      const pollingStats = getValidationPollingService().getPollingStats();

      // Calculate performance metrics
      const averageValidationTime = progressStats.averageProcessingTimeMs;
      const fastestValidation = progressStats.performanceMetrics.fastestResource.timeMs;
      const slowestValidation = progressStats.performanceMetrics.slowestResource.timeMs;
      
      // Calculate throughput (validations per minute)
      const throughputPerMinute = this.calculateThroughput(progressStats);
      
      // Calculate error and success rates
      const totalValidations = progressStats.totalResources;
      const failedValidations = progressStats.failedResources;
      const errorRate = totalValidations > 0 ? (failedValidations / totalValidations) * 100 : 0;
      const successRate = 100 - errorRate;

      const performance = {
        averageValidationTime,
        fastestValidation,
        slowestValidation,
        throughputPerMinute,
        errorRate,
        successRate
      };

      this.setCachedData(cacheKey, performance, this.CACHE_TTL.PERFORMANCE);
      return performance;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting performance analytics:', error);
      throw error;
    }
  }

  /**
   * Get trend analytics
   */
  public async getTrendAnalytics(
    timeRange?: AnalyticsTimeRange,
    filters?: AnalyticsFilters
  ): Promise<ValidationAnalytics['trends']> {
    const cacheKey = `trends-${JSON.stringify({ timeRange, filters })}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Generate mock trend data for now
      // TODO: Implement actual trend calculation from historical data
      const dailyValidations = this.generateDailyTrendData(timeRange);
      const weeklyTrend = this.generateWeeklyTrendData(timeRange);
      const monthlyTrend = this.generateMonthlyTrendData(timeRange);

      const trends = {
        dailyValidations,
        weeklyTrend,
        monthlyTrend
      };

      this.setCachedData(cacheKey, trends, this.CACHE_TTL.TRENDS);
      return trends;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting trend analytics:', error);
      throw error;
    }
  }

  /**
   * Get resource type analytics
   */
  public async getResourceTypeAnalytics(
    timeRange?: AnalyticsTimeRange,
    filters?: AnalyticsFilters
  ): Promise<ValidationAnalytics['resourceTypeAnalytics']> {
    const cacheKey = `resource-types-${JSON.stringify({ timeRange, filters })}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const stats = await storage.getResourceStatsWithSettings();
      const resourceTypeAnalytics = Object.entries(stats.resourceBreakdown).map(([resourceType, breakdown]) => ({
        resourceType,
        totalCount: breakdown.total,
        validatedCount: breakdown.total,
        averageScore: this.calculateResourceTypeScore(breakdown),
        errorRate: breakdown.total > 0 ? ((breakdown.total - breakdown.valid) / breakdown.total) * 100 : 0,
        commonErrors: this.getCommonErrorsForResourceType(resourceType),
        validationTime: this.calculateAverageValidationTime(resourceType)
      }));

      this.setCachedData(cacheKey, resourceTypeAnalytics, this.CACHE_TTL.OVERVIEW);
      return resourceTypeAnalytics;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting resource type analytics:', error);
      throw error;
    }
  }

  /**
   * Get aspect analytics
   */
  public async getAspectAnalytics(
    timeRange?: AnalyticsTimeRange,
    filters?: AnalyticsFilters
  ): Promise<ValidationAnalytics['aspectAnalytics']> {
    const cacheKey = `aspects-${JSON.stringify({ timeRange, filters })}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const stats = await storage.getResourceStatsWithSettings();
      const aspectAnalytics = Object.entries(stats.aspectBreakdown || {}).map(([aspect, breakdown]) => ({
        aspect,
        totalValidations: breakdown.total || 0,
        errorCount: breakdown.errors || 0,
        warningCount: breakdown.warnings || 0,
        averageTime: breakdown.averageTime || 0,
        successRate: breakdown.total > 0 ? ((breakdown.total - breakdown.errors) / breakdown.total) * 100 : 0
      }));

      this.setCachedData(cacheKey, aspectAnalytics, this.CACHE_TTL.OVERVIEW);
      return aspectAnalytics;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting aspect analytics:', error);
      throw error;
    }
  }

  /**
   * Get quality metrics
   */
  public async getQualityMetrics(
    timeRange?: AnalyticsTimeRange,
    filters?: AnalyticsFilters
  ): Promise<ValidationAnalytics['qualityMetrics']> {
    const cacheKey = `quality-${JSON.stringify({ timeRange, filters })}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const stats = await storage.getResourceStatsWithSettings();
      
      // Calculate quality scores
      const dataQualityScore = this.calculateDataQualityScore(stats);
      const complianceScore = this.calculateComplianceScore(stats);
      const consistencyScore = this.calculateConsistencyScore(stats);
      const completenessScore = this.calculateCompletenessScore(stats);
      const overallHealthScore = (dataQualityScore + complianceScore + consistencyScore + completenessScore) / 4;

      const qualityMetrics = {
        dataQualityScore,
        complianceScore,
        consistencyScore,
        completenessScore,
        overallHealthScore
      };

      this.setCachedData(cacheKey, qualityMetrics, this.CACHE_TTL.QUALITY);
      return qualityMetrics;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting quality metrics:', error);
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  public async getSystemHealthMetrics(): Promise<ValidationAnalytics['systemHealth']> {
    const cacheKey = 'system-health';
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const pollingStats = getValidationPollingService().getPollingStats();
      const progressStats = getIndividualResourceProgressService().getProgressStats();

      // Calculate system health metrics
      const validationEngineStatus = this.determineEngineStatus(progressStats);
      const averageResponseTime = progressStats.averageProcessingTimeMs;
      const errorRate = progressStats.failedResources > 0 ? (progressStats.failedResources / progressStats.totalResources) * 100 : 0;
      const activeSessions = pollingStats.activeSessions;
      const cacheHitRate = this.calculateCacheHitRate();
      const memoryUsage = this.getMemoryUsage();

      const systemHealth = {
        validationEngineStatus,
        averageResponseTime,
        errorRate,
        activeSessions,
        cacheHitRate,
        memoryUsage
      };

      this.setCachedData(cacheKey, systemHealth, this.CACHE_TTL.SYSTEM_HEALTH);
      return systemHealth;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting system health metrics:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheKey = 'performance-metrics';
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const progressStats = getIndividualResourceProgressService().getProgressStats();
      const pollingStats = getValidationPollingService().getPollingStats();

      const metrics: PerformanceMetrics = {
        validationThroughput: this.calculateThroughput(progressStats),
        averageResponseTime: progressStats.averageProcessingTimeMs,
        errorRate: progressStats.failedResources > 0 ? (progressStats.failedResources / progressStats.totalResources) * 100 : 0,
        cacheHitRate: this.calculateCacheHitRate(),
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsage(),
        activeConnections: pollingStats.activeSessions,
        queueLength: 0 // Default to 0 for now
      };

      this.setCachedData(cacheKey, metrics, this.CACHE_TTL.PERFORMANCE);
      return metrics;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get trend analysis for specific metrics
   */
  public async getTrendAnalysis(
    metric: string,
    timeRange: AnalyticsTimeRange
  ): Promise<TrendAnalysis[]> {
    const cacheKey = `trend-analysis-${metric}-${JSON.stringify(timeRange)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Generate mock trend analysis for now
      // TODO: Implement actual trend analysis from historical data
      const trendAnalysis = this.generateTrendAnalysis(metric, timeRange);

      this.setCachedData(cacheKey, trendAnalysis, this.CACHE_TTL.TRENDS);
      return trendAnalysis;
    } catch (error) {
      console.error('[ValidationAnalytics] Error getting trend analysis:', error);
      throw error;
    }
  }

  /**
   * Clear analytics cache
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('[ValidationAnalytics] Cache cleared');
  }

  /**
   * Clear specific cache entry
   */
  public clearCacheEntry(key: string): void {
    this.cache.delete(key);
    console.log(`[ValidationAnalytics] Cache entry cleared: ${key}`);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private calculateAverageScore(stats: any): number {
    // Calculate average validation score based on valid vs total resources
    if (stats.totalResources === 0) return 0;
    return (stats.validResources / stats.totalResources) * 100;
  }

  private async calculateValidationTrend(timeRange?: AnalyticsTimeRange): Promise<'improving' | 'stable' | 'declining'> {
    // TODO: Implement actual trend calculation from historical data
    // For now, return a mock trend
    return 'stable';
  }

  private calculateThroughput(progressStats: any): number {
    // Calculate validations per minute based on average processing time
    if (progressStats.averageProcessingTimeMs === 0) return 0;
    return 60000 / progressStats.averageProcessingTimeMs; // 60 seconds / average time in ms
  }

  private calculateResourceTypeScore(breakdown: any): number {
    if (breakdown.total === 0) return 0;
    return (breakdown.valid / breakdown.total) * 100;
  }

  private getCommonErrorsForResourceType(resourceType: string): string[] {
    // TODO: Implement actual error analysis
    return ['Missing required field', 'Invalid format', 'Reference not found'];
  }

  private calculateAverageValidationTime(resourceType: string): number {
    // TODO: Implement actual time calculation
    return 1500; // Mock value
  }

  private calculateDataQualityScore(stats: any): number {
    // Calculate data quality score based on validation results
    if (stats.totalResources === 0) return 0;
    return (stats.validResources / stats.totalResources) * 100;
  }

  private calculateComplianceScore(stats: any): number {
    // Calculate compliance score based on error rates
    if (stats.totalResources === 0) return 100;
    const errorRate = (stats.errorResources / stats.totalResources) * 100;
    return Math.max(0, 100 - errorRate);
  }

  private calculateConsistencyScore(stats: any): number {
    // Calculate consistency score based on validation patterns
    // TODO: Implement actual consistency calculation
    return 85; // Mock value
  }

  private calculateCompletenessScore(stats: any): number {
    // Calculate completeness score based on validation coverage
    // TODO: Implement actual completeness calculation
    return 90; // Mock value
  }

  private determineEngineStatus(progressStats: any): 'healthy' | 'degraded' | 'error' {
    const errorRate = progressStats.failedResources > 0 ? (progressStats.failedResources / progressStats.totalResources) * 100 : 0;
    
    if (errorRate > 20) return 'error';
    if (errorRate > 10) return 'degraded';
    return 'healthy';
  }

  private calculateCacheHitRate(): number {
    // TODO: Implement actual cache hit rate calculation
    return 85; // Mock value
  }

  private getMemoryUsage(): number {
    // TODO: Implement actual memory usage calculation
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  private getCpuUsage(): number {
    // TODO: Implement actual CPU usage calculation
    return 25; // Mock value
  }

  private generateDailyTrendData(timeRange?: AnalyticsTimeRange): Array<{
    date: string;
    count: number;
    averageScore: number;
    errorCount: number;
    warningCount: number;
  }> {
    // Generate mock daily trend data
    const days = 7;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 1000) + 500,
        averageScore: Math.floor(Math.random() * 20) + 80,
        errorCount: Math.floor(Math.random() * 50) + 10,
        warningCount: Math.floor(Math.random() * 100) + 20
      });
    }
    
    return data;
  }

  private generateWeeklyTrendData(timeRange?: AnalyticsTimeRange): Array<{
    week: string;
    totalValidations: number;
    averageScore: number;
    improvement: number;
  }> {
    // Generate mock weekly trend data
    const weeks = 4;
    const data = [];
    
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      
      data.push({
        week: `Week ${weeks - i}`,
        totalValidations: Math.floor(Math.random() * 5000) + 2000,
        averageScore: Math.floor(Math.random() * 15) + 82,
        improvement: Math.floor(Math.random() * 10) - 5
      });
    }
    
    return data;
  }

  private generateMonthlyTrendData(timeRange?: AnalyticsTimeRange): Array<{
    month: string;
    totalValidations: number;
    averageScore: number;
    topErrors: string[];
  }> {
    // Generate mock monthly trend data
    const months = 6;
    const data = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      
      data.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        totalValidations: Math.floor(Math.random() * 20000) + 10000,
        averageScore: Math.floor(Math.random() * 10) + 85,
        topErrors: ['Missing required field', 'Invalid format', 'Reference not found']
      });
    }
    
    return data;
  }

  private generateTrendAnalysis(metric: string, timeRange: AnalyticsTimeRange): TrendAnalysis[] {
    // Generate mock trend analysis
    const periods = 10;
    const data = [];
    
    for (let i = 0; i < periods; i++) {
      const value = Math.floor(Math.random() * 100) + 50;
      const change = Math.floor(Math.random() * 20) - 10;
      const changePercentage = (change / value) * 100;
      
      data.push({
        period: `Period ${i + 1}`,
        metric,
        value,
        change,
        changePercentage,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
        significance: Math.abs(changePercentage) > 10 ? 'high' : Math.abs(changePercentage) > 5 ? 'medium' : 'low'
      });
    }
    
    return data;
  }

  private setupCleanupInterval(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.cache.entries()) {
        if (now - cached.timestamp >= cached.ttl) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const getValidationAnalyticsService = (): ValidationAnalyticsService => {
  return ValidationAnalyticsService.getInstance();
};
