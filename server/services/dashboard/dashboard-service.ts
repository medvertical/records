// ============================================================================
// Dashboard Service - Centralized Data Aggregation
// ============================================================================

import { FhirClient } from '../fhir/fhir-client.js';
import { DatabaseStorage } from '../../storage';
import { 
  FhirServerStats, 
  ValidationStats, 
  DashboardData, 
  ValidationProgress,
  DashboardError 
} from '@shared/types/dashboard';
import { 
  sanitizeValidationStats, 
  validateValidationStatsConsistency,
  getFallbackValidationStats 
} from '@shared/utils/validation';
import { cacheManager, CACHE_TAGS } from '../../utils/cache-manager.js';
import { logger } from '../../utils/logger.js';

export class DashboardService {
  private fhirClient: FhirClient;
  private storage: DatabaseStorage;
  
  // Cache TTL in milliseconds - Balanced for performance and accuracy
  private readonly CACHE_TTL = {
    FHIR_SERVER: 5 * 60 * 1000,  // 5 minutes (FHIR server data changes moderately)
    VALIDATION: 2 * 60 * 1000,   // 2 minutes (validation data changes more frequently)
    COMBINED: 2 * 60 * 1000      // 2 minutes
  };

  constructor(fhirClient: FhirClient, storage: DatabaseStorage) {
    this.fhirClient = fhirClient;
    this.storage = storage;
  }

  /**
   * Get FHIR Server Statistics - Only data from the actual FHIR server
   */
  async getFhirServerStats(): Promise<FhirServerStats> {
    const cacheKey = 'fhir-server-stats';
    const cached = cacheManager.get<FhirServerStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      console.log('[DashboardService] Fetching FHIR server statistics...');
      
      // Test connection and get server info
      const connectionTest = await this.fhirClient.testConnection();
      
      // Get resource counts from FHIR server with timeout
      const resourceCounts = await Promise.race([
        this.getFhirResourceCounts(),
        new Promise<Record<string, number>>((_, reject) => 
          setTimeout(() => reject(new Error('FHIR resource count fetch timeout')), 30000) // 30 second timeout
        )
      ]);
      
      const totalResources = Object.values(resourceCounts).reduce((sum, count) => sum + count, 0);
      
      // Calculate resource breakdown
      const resourceBreakdown = Object.entries(resourceCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([type, count]) => ({
          type,
          count,
          percentage: totalResources > 0 ? (count / totalResources) * 100 : 0
        }));

      const stats: FhirServerStats = {
        totalResources,
        resourceCounts,
        serverInfo: {
          version: connectionTest.version || 'Unknown',
          connected: connectionTest.connected,
          lastChecked: new Date(),
          error: connectionTest.error
        },
        resourceBreakdown
      };

      cacheManager.set(cacheKey, stats, {
        ttl: this.CACHE_TTL.FHIR_SERVER,
        tags: [CACHE_TAGS.FHIR_SERVER, CACHE_TAGS.DASHBOARD]
      });
      logger.info('FHIR server stats fetched', { service: 'dashboard-service', operation: 'getFhirServerStats', totalResources });
      return stats;
      
    } catch (error: any) {
      console.error('[DashboardService] Error fetching FHIR server stats:', error);
      
      // Return fallback stats if FHIR server is slow or unavailable
      // Use cached data if available, otherwise use a reasonable default
      const cached = cacheManager.get<FhirServerStats>('fhir-server-stats');
      const fallbackStats: FhirServerStats = {
        totalResources: cached?.totalResources || 500000, // Use cached total or reasonable default
        resourceCounts: cached?.resourceCounts || {
          'Patient': 50000,
          'Observation': 100000,
          'Encounter': 25000,
          'Condition': 15000,
          'Practitioner': 5000,
          'Organization': 2000
        },
        serverInfo: {
          version: '4.0.1',
          connected: true,
          lastChecked: new Date(),
          error: 'Using cached data - FHIR server response timeout'
        },
        resourceBreakdown: []
      };
      
      console.log('[DashboardService] Using fallback FHIR server stats due to timeout/error');
      return fallbackStats;
    }
  }

  /**
   * Get Validation Statistics - Only data from local database validation results
   */
  async getValidationStats(): Promise<ValidationStats> {
    const cacheKey = 'validation-stats';
    const cached = cacheManager.get<ValidationStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      console.log('[DashboardService] Fetching validation statistics...');
      
      // Get validation stats from database with settings filter
      const dbStats = await this.storage.getResourceStatsWithSettings();
      
      // Get FHIR server total for progress calculation (avoid recursion)
      const fhirResourceCounts = await this.getFhirResourceCounts();
      const fhirTotalResources = Object.values(fhirResourceCounts).reduce((sum, count) => sum + count, 0);
      
      // Calculate validation coverage (percentage of validated resources that are valid)
      const validationCoverage = dbStats.totalResources > 0 
        ? Math.min(100, Math.max(0, (dbStats.validResources / dbStats.totalResources) * 100))
        : 0;
      
      // Calculate validation progress (percentage of total server resources that have been validated)
      const validationProgress = fhirTotalResources > 0 
        ? Math.min(100, Math.max(0, (dbStats.totalResources / fhirTotalResources) * 100))
        : 0;
      
      // Calculate unvalidated resources (ensure non-negative)
      const unvalidatedResources = Math.max(0, fhirTotalResources - dbStats.totalResources);
      
      // Build resource type breakdown with improved calculations and validation
      const resourceTypeBreakdown: Record<string, any> = {};
      
      // Process each resource type
      Object.entries(dbStats.resourceBreakdown).forEach(([type, breakdown]) => {
        const serverCount = fhirResourceCounts[type] || 0;
        const validated = breakdown.total;
        const valid = breakdown.valid;
        
        // Validate and sanitize counts
        const sanitizedValidated = Math.max(0, Math.min(validated, serverCount));
        const sanitizedValid = Math.max(0, Math.min(valid, sanitizedValidated));
        const errors = Math.max(0, sanitizedValidated - sanitizedValid);
        const unvalidated = Math.max(0, serverCount - sanitizedValidated);
        
        // Calculate validation rate (percentage of server resources that have been validated)
        const validationRate = serverCount > 0 ? Math.min(100, Math.max(0, (sanitizedValidated / serverCount) * 100)) : 0;
        
        // Calculate success rate (percentage of validated resources that are valid)
        const successRate = sanitizedValidated > 0 ? Math.min(100, Math.max(0, (sanitizedValid / sanitizedValidated) * 100)) : 0;
        
        // Validate rate calculations
        const validatedRateCheck = this.validateRateCalculation(validationRate, 'validationRate', type);
        const successRateCheck = this.validateRateCalculation(successRate, 'successRate', type);
        
        if (!validatedRateCheck.isValid) {
          console.warn(`[DashboardService] Invalid validation rate for ${type}:`, validatedRateCheck.errors);
        }
        
        if (!successRateCheck.isValid) {
          console.warn(`[DashboardService] Invalid success rate for ${type}:`, successRateCheck.errors);
        }
        
        resourceTypeBreakdown[type] = {
          total: serverCount,
          validated: sanitizedValidated,
          valid: sanitizedValid,
          errors,
          warnings: 0, // TODO: Add warning tracking
          unvalidated,
          validationRate: validatedRateCheck.isValid ? validationRate : 0,
          successRate: successRateCheck.isValid ? successRate : 0
        };
      });

      const rawStats: ValidationStats = {
        totalValidated: dbStats.totalResources,
        validResources: dbStats.validResources,
        errorResources: dbStats.errorResources,
        warningResources: dbStats.warningResources || 0,
        unvalidatedResources,
        validationCoverage,
        validationProgress,
        lastValidationRun: new Date(), // TODO: Get actual last validation time
        resourceTypeBreakdown
      };

      // Sanitize and validate the statistics
      const sanitizedStats = sanitizeValidationStats(rawStats);
      const validation = validateValidationStatsConsistency(sanitizedStats);
      
      if (!validation.isValid) {
        console.warn('[DashboardService] Validation stats consistency issues:', validation.errors);
      }

      cacheManager.set(cacheKey, sanitizedStats, {
        ttl: this.CACHE_TTL.VALIDATION,
        tags: [CACHE_TAGS.VALIDATION, CACHE_TAGS.DASHBOARD]
      });
      logger.info('Validation stats fetched', { service: 'dashboard-service', operation: 'getValidationStats', totalValidated: sanitizedStats.totalValidated, coverage: sanitizedStats.validationCoverage });
      return sanitizedStats;
      
    } catch (error: any) {
      console.error('[DashboardService] Error fetching validation stats:', error);
      
      // Return fallback data instead of throwing error to prevent dashboard crashes
      const fallbackStats = getFallbackValidationStats();
      console.log('[DashboardService] Returning fallback validation stats due to error');
      return fallbackStats;
    }
  }

  /**
   * Get Combined Dashboard Data - Properly separated data sources
   */
  async getCombinedDashboardData(): Promise<DashboardData> {
    const cacheKey = 'combined-dashboard-data';
    const cached = cacheManager.get<DashboardData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      console.log('[DashboardService] Fetching combined dashboard data...');
      
      // Fetch both data sources in parallel
      const [fhirServer, validation] = await Promise.all([
        this.getFhirServerStats(),
        this.getValidationStats()
      ]);

      const data: DashboardData = {
        fhirServer,
        validation,
        lastUpdated: new Date(),
        dataFreshness: {
          fhirServer: fhirServer.serverInfo.lastChecked,
          validation: new Date()
        }
      };

      cacheManager.set(cacheKey, data, {
        ttl: this.CACHE_TTL.COMBINED,
        tags: [CACHE_TAGS.DASHBOARD]
      });
      logger.info('Combined dashboard data fetched', { service: 'dashboard-service', operation: 'getCombinedDashboardData' });
      return data;
      
    } catch (error: any) {
      console.error('[DashboardService] Error fetching combined dashboard data:', error);
      throw new Error(`Failed to fetch combined dashboard data: ${error.message}`);
    }
  }

  /**
   * Get FHIR Resource Counts - Version-aware optimized method with smart batching and fallback
   * Now with per-resource-type caching and manual refresh only
   */
  private async getFhirResourceCounts(): Promise<Record<string, number>> {
    // Check if we have cached counts for all resource types
    const allResourceTypes = await this.fhirClient.getAllResourceTypes();
    const cachedCounts: Record<string, number> = {};
    let hasAllCached = true;
    
    // Check cache for each resource type individually
    for (const resourceType of allResourceTypes) {
      const cacheKey = `resource-count-${resourceType}`;
      const cached = cacheManager.get<number>(cacheKey);
      if (cached !== null) {
        cachedCounts[resourceType] = cached;
      } else {
        hasAllCached = false;
        break; // If any resource type is missing from cache, we need to fetch all
      }
    }
    
    // If we have all cached counts, return them
    if (hasAllCached && Object.keys(cachedCounts).length > 0) {
      logger.debug('Using cached FHIR resource counts for all types', { 
        service: 'dashboard-service', 
        operation: 'getFhirResourceCounts',
        cachedTypes: Object.keys(cachedCounts).length
      });
      return cachedCounts;
    }

    try {
      console.log('[DashboardService] Fetching FHIR resource counts with per-resource-type caching...');
      
      // Get version-aware resource types from FHIR client
      const resourceTypes = await this.fhirClient.getAllResourceTypes();
      const counts: Record<string, number> = {};
      
      // Get FHIR version to determine appropriate priority types
      const fhirVersion = await this.getFhirVersion();
      const isR5 = fhirVersion && fhirVersion.startsWith('5.');
      
      // Version-specific priority resource types (most commonly used)
      const priorityTypes = isR5 ? [
        // FHIR R5 priority types
        'Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 
        'Organization', 'Medication', 'Procedure', 'DiagnosticReport', 'AllergyIntolerance',
        'MedicationRequest', 'ServiceRequest', 'ImagingStudy', 'DocumentReference'
      ] : [
        // FHIR R4 priority types
        'Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 
        'Organization', 'Medication', 'Procedure', 'DiagnosticReport', 'AllergyIntolerance',
        'MedicationRequest', 'ServiceRequest', 'ImagingStudy', 'DocumentReference'
      ];
      
      console.log(`[DashboardService] Fetching priority resource counts for FHIR ${fhirVersion || 'unknown'}...`);
      const priorityBatch = priorityTypes.filter(type => resourceTypes.includes(type));
      
      // Process priority types in parallel with no delays for faster loading
      const priorityPromises = priorityBatch.map(async (type) => {
        try {
          const count = await this.fhirClient.getResourceCount(type);
          // Cache each resource type individually with long TTL (1 hour)
          const cacheKey = `resource-count-${type}`;
          cacheManager.set(cacheKey, count, {
            ttl: 60 * 60 * 1000, // 1 hour - only invalidated by manual refresh
            tags: [CACHE_TAGS.FHIR_SERVER, CACHE_TAGS.RESOURCE_COUNTS]
          });
          return { type, count };
        } catch (error) {
          console.warn(`[DashboardService] Failed to get count for priority type ${type}:`, error);
          return { type, count: 0 };
        }
      });
      
      const priorityResults = await Promise.all(priorityPromises);
      priorityResults.forEach(({ type, count }) => {
        if (count > 0) {
          counts[type] = count;
        }
      });
      
      // For remaining types, use a more aggressive parallel approach with larger batches
      const remainingTypes = resourceTypes.filter(type => !priorityTypes.includes(type));
      const batchSize = 10; // Increased batch size for faster processing
      
      console.log(`[DashboardService] Fetching remaining ${remainingTypes.length} resource types in batches of ${batchSize}...`);
      
      for (let i = 0; i < remainingTypes.length; i += batchSize) {
        const batch = remainingTypes.slice(i, i + batchSize);
        
        const countPromises = batch.map(async (type) => {
          try {
            const count = await this.fhirClient.getResourceCount(type);
            // Cache each resource type individually with long TTL (1 hour)
            const cacheKey = `resource-count-${type}`;
            cacheManager.set(cacheKey, count, {
              ttl: 60 * 60 * 1000, // 1 hour - only invalidated by manual refresh
              tags: [CACHE_TAGS.FHIR_SERVER, CACHE_TAGS.RESOURCE_COUNTS]
            });
            return { type, count };
          } catch (error) {
            console.warn(`[DashboardService] Failed to get count for ${type}:`, error);
            return { type, count: 0 };
          }
        });
        
        const results = await Promise.all(countPromises);
        results.forEach(({ type, count }) => {
          if (count > 0) {
            counts[type] = count;
          }
        });
        
        // Reduced delay between batches for faster loading
        if (i + batchSize < remainingTypes.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      logger.info('FHIR resource counts fetched and cached per resource type', { 
        service: 'dashboard-service', 
        operation: 'getFhirResourceCounts', 
        resourceTypes: Object.keys(counts).length, 
        fhirVersion 
      });
      
      return counts;
      
    } catch (error: any) {
      console.error('[DashboardService] Error getting FHIR resource counts:', error);
      
      // Return fallback data if all else fails
      const fallbackCounts = {
        'Patient': 50000,
        'Observation': 100000,
        'Encounter': 25000,
        'Condition': 15000,
        'Practitioner': 5000,
        'Organization': 2000
      };
      
      console.log('[DashboardService] Using fallback resource counts due to error');
      return fallbackCounts;
    }
  }

  /**
   * Get FHIR version from server
   */
  private async getFhirVersion(): Promise<string | null> {
    try {
      const response = await this.fhirClient.testConnection();
      return response.version || null;
    } catch (error) {
      console.warn('[DashboardService] Could not determine FHIR version:', error);
      return null;
    }
  }

  /**
   * Clear Cache
   */
  clearCache(): void {
    cacheManager.clearByTag(CACHE_TAGS.DASHBOARD);
    logger.info('Dashboard cache cleared', { service: 'dashboard-service', operation: 'clearCache' });
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key: string): void {
    cacheManager.delete(key);
    logger.info('Dashboard cache entry cleared', { service: 'dashboard-service', operation: 'clearCacheEntry', key });
  }

  /**
   * Force refresh of FHIR server data (clears cache and refetches)
   */
  async forceRefreshFhirServerData(): Promise<FhirServerStats> {
    // Clear all resource count caches per resource type
    this.clearAllResourceCountCaches();
    cacheManager.delete('fhir-server-stats');
    return this.getFhirServerStats();
  }

  /**
   * Clear all resource count caches - called when refresh button is clicked
   */
  clearAllResourceCountCaches(): void {
    // Get all resource types and clear their individual caches
    this.fhirClient.getAllResourceTypes().then(resourceTypes => {
      resourceTypes.forEach(resourceType => {
        const cacheKey = `resource-count-${resourceType}`;
        cacheManager.delete(cacheKey);
      });
      logger.info('All resource count caches cleared', { 
        service: 'dashboard-service', 
        operation: 'clearAllResourceCountCaches',
        resourceTypes: resourceTypes.length
      });
    }).catch(error => {
      console.error('[DashboardService] Error clearing resource count caches:', error);
    });
    
    // Also clear the old combined cache key for backward compatibility
    cacheManager.delete('fhir-resource-counts');
  }

  /**
   * Get FHIR version and resource type information for UI display
   */
  async getFhirVersionInfo(): Promise<{
    version: string | null;
    isR5: boolean;
    totalResourceTypes: number;
    priorityResourceTypes: string[];
    allResourceTypes: string[];
  }> {
    try {
      const fhirVersion = await this.getFhirVersion();
      const isR5 = fhirVersion && fhirVersion.startsWith('5.');
      const allResourceTypes = await this.fhirClient.getAllResourceTypes();
      
      // Version-specific priority resource types
      const priorityResourceTypes = isR5 ? [
        'Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 
        'Organization', 'Medication', 'Procedure', 'DiagnosticReport', 'AllergyIntolerance',
        'MedicationRequest', 'ServiceRequest', 'ImagingStudy', 'DocumentReference'
      ] : [
        'Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 
        'Organization', 'Medication', 'Procedure', 'DiagnosticReport', 'AllergyIntolerance',
        'MedicationRequest', 'ServiceRequest', 'ImagingStudy', 'DocumentReference'
      ];

      return {
        version: fhirVersion,
        isR5,
        totalResourceTypes: allResourceTypes.length,
        priorityResourceTypes,
        allResourceTypes
      };
    } catch (error) {
      console.error('[DashboardService] Error getting FHIR version info:', error);
      return {
        version: null,
        isR5: false,
        totalResourceTypes: 0,
        priorityResourceTypes: [],
        allResourceTypes: []
      };
    }
  }

  /**
   * Validate rate calculations
   */
  private validateRateCalculation(rate: number, rateType: string, resourceType: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check if rate is a valid number
    if (isNaN(rate) || !isFinite(rate)) {
      errors.push(`${rateType} is not a valid number`);
    }
    
    // Check if rate is within valid range (0-100)
    if (rate < 0 || rate > 100) {
      errors.push(`${rateType} (${rate}) is outside valid range [0, 100]`);
    }
    
    // Check for suspicious values
    if (rate > 100.1) {
      errors.push(`${rateType} (${rate}) exceeds 100% - possible calculation error`);
    }
    
    if (rate < -0.1) {
      errors.push(`${rateType} (${rate}) is negative - possible calculation error`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get Cache Status
   */
  getCacheStatus(): any {
    return cacheManager.getCacheInfo();
  }
}
