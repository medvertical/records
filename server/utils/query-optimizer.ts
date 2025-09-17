// ============================================================================
// Database Query Optimizer
// ============================================================================

import { db } from '../db.js';
import { 
  fhirServers, 
  fhirResources, 
  validationResults, 
  validationProfiles,
  validationSettings,
  dashboardCards,
  type FhirServer,
  type FhirResource,
  type ValidationResult,
  type ValidationProfile,
  type ValidationSettings,
  type DashboardCard,
  type ResourceStats
} from '@shared/schema.js';
import { eq, desc, and, sql, getTableColumns, count, sum, avg } from 'drizzle-orm';
import { logger } from './logger.js';
import { cacheManager, CACHE_TAGS } from './cache-manager.js';

export interface OptimizedQueryOptions {
  useCache?: boolean;
  cacheTTL?: number;
  cacheTags?: string[];
  batchSize?: number;
  timeout?: number;
}

export class QueryOptimizer {
  private static instance: QueryOptimizer;

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  /**
   * Get FHIR servers with optimized query
   */
  async getFhirServers(options: OptimizedQueryOptions = {}): Promise<FhirServer[]> {
    const cacheKey = 'fhir-servers';
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<FhirServer[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      const servers = await db.select().from(fhirServers);
      
      if (options.useCache !== false) {
        cacheManager.set(cacheKey, servers, {
          ttl: options.cacheTTL || 5 * 60 * 1000, // 5 minutes
          tags: options.cacheTags || [CACHE_TAGS.FHIR_SERVER]
        });
      }
      
      logger.database(2, 'Fetched FHIR servers', 'getFhirServers', { count: servers.length });
      return servers;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch FHIR servers', 'getFhirServers', { error: error.message });
      throw error;
    }
  }

  /**
   * Get active FHIR server with optimized query
   */
  async getActiveFhirServer(options: OptimizedQueryOptions = {}): Promise<FhirServer | undefined> {
    const cacheKey = 'active-fhir-server';
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<FhirServer>(cacheKey);
      if (cached) return cached;
    }

    try {
      const [server] = await db.select().from(fhirServers).where(eq(fhirServers.isActive, true));
      
      if (options.useCache !== false) {
        cacheManager.set(cacheKey, server, {
          ttl: options.cacheTTL || 2 * 60 * 1000, // 2 minutes
          tags: options.cacheTags || [CACHE_TAGS.FHIR_SERVER]
        });
      }
      
      logger.database(2, 'Fetched active FHIR server', 'getActiveFhirServer', { serverId: server?.id });
      return server || undefined;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch active FHIR server', 'getActiveFhirServer', { error: error.message });
      throw error;
    }
  }

  /**
   * Get resource statistics with optimized query
   */
  async getResourceStats(serverId?: number, options: OptimizedQueryOptions = {}): Promise<ResourceStats> {
    const cacheKey = `resource-stats-${serverId || 'active'}`;
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<ResourceStats>(cacheKey);
      if (cached) return cached;
    }

    try {
      // Get active server if none specified
      const targetServerId = serverId || (await this.getActiveFhirServer({ useCache: true }))?.id;
      
      // Single optimized query to get all resource statistics
      const statsQuery = await db
        .select({
          resourceType: fhirResources.resourceType,
          totalCount: count(fhirResources.id),
          validCount: sum(sql`CASE WHEN ${validationResults.isValid} = true THEN 1 ELSE 0 END`),
          errorCount: sum(sql`CASE WHEN ${validationResults.isValid} = false THEN 1 ELSE 0 END`),
          warningCount: sum(sql`CASE WHEN ${validationResults.warningCount} > 0 THEN 1 ELSE 0 END`)
        })
        .from(fhirResources)
        .leftJoin(validationResults, eq(fhirResources.id, validationResults.resourceId))
        .where(targetServerId ? eq(fhirResources.serverId, targetServerId) : undefined)
        .groupBy(fhirResources.resourceType);

      // Get total counts
      const totalStats = await db
        .select({
          totalResources: count(fhirResources.id),
          totalValidated: count(validationResults.id),
          activeProfiles: count(validationProfiles.id)
        })
        .from(fhirResources)
        .leftJoin(validationResults, eq(fhirResources.id, validationResults.resourceId))
        .leftJoin(validationProfiles, eq(validationProfiles.isActive, true))
        .where(targetServerId ? eq(fhirResources.serverId, targetServerId) : undefined);

      // Process results
      const resourceBreakdown: Record<string, { total: number; valid: number; validPercent: number }> = {};
      let totalResources = 0;
      let validResources = 0;
      let errorResources = 0;
      let warningResources = 0;

      statsQuery.forEach(stat => {
        const total = Number(stat.totalCount) || 0;
        const valid = Number(stat.validCount) || 0;
        const errors = Number(stat.errorCount) || 0;
        const warnings = Number(stat.warningCount) || 0;
        
        totalResources += total;
        validResources += valid;
        errorResources += errors;
        warningResources += warnings;
        
        resourceBreakdown[stat.resourceType] = {
          total,
          valid,
          validPercent: total > 0 ? (valid / total) * 100 : 0
        };
      });

      const stats: ResourceStats = {
        totalResources,
        validResources,
        errorResources,
        warningResources,
        unvalidatedResources: totalResources - (validResources + errorResources + warningResources),
        activeProfiles: Number(totalStats[0]?.activeProfiles) || 0,
        resourceBreakdown
      };

      if (options.useCache !== false) {
        cacheManager.set(cacheKey, stats, {
          ttl: options.cacheTTL || 2 * 60 * 1000, // 2 minutes
          tags: options.cacheTags || [CACHE_TAGS.VALIDATION, CACHE_TAGS.FHIR_RESOURCES]
        });
      }

      logger.database(2, 'Fetched resource statistics', 'getResourceStats', { 
        totalResources, 
        validResources, 
        errorResources,
        serverId: targetServerId 
      });
      
      return stats;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch resource statistics', 'getResourceStats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get validation results with optimized query
   */
  async getValidationResults(
    resourceId?: number, 
    limit = 50, 
    offset = 0,
    options: OptimizedQueryOptions = {}
  ): Promise<ValidationResult[]> {
    const cacheKey = `validation-results-${resourceId || 'all'}-${limit}-${offset}`;
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<ValidationResult[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      let query = db.select().from(validationResults);
      
      if (resourceId) {
        query = query.where(eq(validationResults.resourceId, resourceId));
      }
      
      const results = await query
        .orderBy(desc(validationResults.validatedAt))
        .limit(limit)
        .offset(offset);

      if (options.useCache !== false) {
        cacheManager.set(cacheKey, results, {
          ttl: options.cacheTTL || 1 * 60 * 1000, // 1 minute
          tags: options.cacheTags || [CACHE_TAGS.VALIDATION_RESULTS]
        });
      }

      logger.database(2, 'Fetched validation results', 'getValidationResults', { 
        count: results.length, 
        resourceId, 
        limit, 
        offset 
      });
      
      return results;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch validation results', 'getValidationResults', { error: error.message });
      throw error;
    }
  }

  /**
   * Get recent validation errors with optimized query
   */
  async getRecentValidationErrors(
    limit = 10, 
    serverId?: number,
    options: OptimizedQueryOptions = {}
  ): Promise<ValidationResult[]> {
    const cacheKey = `recent-validation-errors-${serverId || 'active'}-${limit}`;
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<ValidationResult[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      // Get active server if none specified
      const targetServerId = serverId || (await this.getActiveFhirServer({ useCache: true }))?.id;
      
      // Optimized query with join to get validation results with resource info
      const results = await db
        .select({
          id: validationResults.id,
          resourceId: validationResults.resourceId,
          profileId: validationResults.profileId,
          isValid: validationResults.isValid,
          errors: validationResults.errors,
          warnings: validationResults.warnings,
          issues: validationResults.issues,
          profileUrl: validationResults.profileUrl,
          errorCount: validationResults.errorCount,
          warningCount: validationResults.warningCount,
          validationScore: validationResults.validationScore,
          validatedAt: validationResults.validatedAt,
          resourceType: fhirResources.resourceType,
          fhirResourceId: fhirResources.resourceId
        })
        .from(validationResults)
        .innerJoin(fhirResources, eq(validationResults.resourceId, fhirResources.id))
        .where(
          and(
            eq(validationResults.isValid, false),
            targetServerId ? eq(fhirResources.serverId, targetServerId) : undefined
          )
        )
        .orderBy(desc(validationResults.validatedAt))
        .limit(limit);

      if (options.useCache !== false) {
        cacheManager.set(cacheKey, results, {
          ttl: options.cacheTTL || 1 * 60 * 1000, // 1 minute
          tags: options.cacheTags || [CACHE_TAGS.VALIDATION_RESULTS, CACHE_TAGS.FHIR_RESOURCES]
        });
      }

      logger.database(2, 'Fetched recent validation errors', 'getRecentValidationErrors', { 
        count: results.length, 
        serverId: targetServerId, 
        limit 
      });
      
      return results;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch recent validation errors', 'getRecentValidationErrors', { error: error.message });
      throw error;
    }
  }

  /**
   * Get validation profiles with optimized query
   */
  async getValidationProfiles(
    resourceType?: string, 
    options: OptimizedQueryOptions = {}
  ): Promise<ValidationProfile[]> {
    const cacheKey = `validation-profiles-${resourceType || 'all'}`;
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<ValidationProfile[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      let query = db.select().from(validationProfiles).where(eq(validationProfiles.isActive, true));
      
      if (resourceType) {
        query = query.where(and(eq(validationProfiles.isActive, true), eq(validationProfiles.resourceType, resourceType)));
      }
      
      const profiles = await query;

      if (options.useCache !== false) {
        cacheManager.set(cacheKey, profiles, {
          ttl: options.cacheTTL || 10 * 60 * 1000, // 10 minutes (profiles change rarely)
          tags: options.cacheTags || [CACHE_TAGS.VALIDATION_PROFILES]
        });
      }

      logger.database(2, 'Fetched validation profiles', 'getValidationProfiles', { 
        count: profiles.length, 
        resourceType 
      });
      
      return profiles;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch validation profiles', 'getValidationProfiles', { error: error.message });
      throw error;
    }
  }

  /**
   * Get validation settings with optimized query
   */
  async getValidationSettings(options: OptimizedQueryOptions = {}): Promise<ValidationSettings | undefined> {
    const cacheKey = 'validation-settings';
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<ValidationSettings>(cacheKey);
      if (cached) return cached;
    }

    try {
      const [settings] = await db
        .select()
        .from(validationSettings)
        .where(eq(validationSettings.isActive, true))
        .orderBy(desc(validationSettings.updatedAt))
        .limit(1);

      if (options.useCache !== false) {
        cacheManager.set(cacheKey, settings, {
          ttl: options.cacheTTL || 5 * 60 * 1000, // 5 minutes
          tags: options.cacheTags || [CACHE_TAGS.VALIDATION_SETTINGS]
        });
      }

      logger.database(2, 'Fetched validation settings', 'getValidationSettings', { 
        found: !!settings 
      });
      
      return settings || undefined;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch validation settings', 'getValidationSettings', { error: error.message });
      throw error;
    }
  }

  /**
   * Get dashboard cards with optimized query
   */
  async getDashboardCards(options: OptimizedQueryOptions = {}): Promise<DashboardCard[]> {
    const cacheKey = 'dashboard-cards';
    
    if (options.useCache !== false) {
      const cached = cacheManager.get<DashboardCard[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      const cards = await db
        .select()
        .from(dashboardCards)
        .where(eq(dashboardCards.isVisible, true))
        .orderBy(dashboardCards.position);

      if (options.useCache !== false) {
        cacheManager.set(cacheKey, cards, {
          ttl: options.cacheTTL || 10 * 60 * 1000, // 10 minutes (cards change rarely)
          tags: options.cacheTags || [CACHE_TAGS.DASHBOARD_CARDS]
        });
      }

      logger.database(2, 'Fetched dashboard cards', 'getDashboardCards', { 
        count: cards.length 
      });
      
      return cards;
    } catch (error: any) {
      logger.database(0, 'Failed to fetch dashboard cards', 'getDashboardCards', { error: error.message });
      throw error;
    }
  }

  /**
   * Batch insert validation results
   */
  async batchInsertValidationResults(results: any[]): Promise<void> {
    if (results.length === 0) return;

    try {
      const batchSize = 100; // Process in batches of 100
      
      for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        await db.insert(validationResults).values(batch);
      }

      // Clear related cache entries
      cacheManager.clearByTag(CACHE_TAGS.VALIDATION_RESULTS);
      cacheManager.clearByTag(CACHE_TAGS.VALIDATION);

      logger.database(2, 'Batch inserted validation results', 'batchInsertValidationResults', { 
        count: results.length 
      });
    } catch (error: any) {
      logger.database(0, 'Failed to batch insert validation results', 'batchInsertValidationResults', { error: error.message });
      throw error;
    }
  }

  /**
   * Batch insert FHIR resources
   */
  async batchInsertFhirResources(resources: any[]): Promise<void> {
    if (resources.length === 0) return;

    try {
      const batchSize = 100; // Process in batches of 100
      
      for (let i = 0; i < resources.length; i += batchSize) {
        const batch = resources.slice(i, i + batchSize);
        await db.insert(fhirResources).values(batch);
      }

      // Clear related cache entries
      cacheManager.clearByTag(CACHE_TAGS.FHIR_RESOURCES);
      cacheManager.clearByTag(CACHE_TAGS.RESOURCE_COUNTS);

      logger.database(2, 'Batch inserted FHIR resources', 'batchInsertFhirResources', { 
        count: resources.length 
      });
    } catch (error: any) {
      logger.database(0, 'Failed to batch insert FHIR resources', 'batchInsertFhirResources', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear cache for specific operations
   */
  clearCacheForOperation(operation: string): void {
    switch (operation) {
      case 'validation':
        cacheManager.clearByTag(CACHE_TAGS.VALIDATION);
        cacheManager.clearByTag(CACHE_TAGS.VALIDATION_RESULTS);
        break;
      case 'fhir-resources':
        cacheManager.clearByTag(CACHE_TAGS.FHIR_RESOURCES);
        cacheManager.clearByTag(CACHE_TAGS.RESOURCE_COUNTS);
        break;
      case 'dashboard':
        cacheManager.clearByTag(CACHE_TAGS.DASHBOARD);
        break;
      case 'all':
        cacheManager.clear();
        break;
    }
    
    logger.database(2, 'Cleared cache for operation', 'clearCacheForOperation', { operation });
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): any {
    const cacheStats = cacheManager.getStats();
    return {
      cache: cacheStats,
      database: {
        // Add database-specific stats here if needed
      }
    };
  }
}

// Export singleton instance
export const queryOptimizer = QueryOptimizer.getInstance();

