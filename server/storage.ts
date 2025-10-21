import {
  fhirServers,
  fhirResources,
  validationProfiles,
  validationResults,
  dashboardCards,
  validationSettings,
  type FhirServer,
  type InsertFhirServer,
  type FhirResource,
  type InsertFhirResource,
  type ValidationProfile,
  type InsertValidationProfile,
  type ValidationResult,
  type InsertValidationResult,
  type DashboardCard,
  type InsertDashboardCard,
  type ValidationSettings,
  type InsertValidationSettings,
  type FhirResourceWithValidation,
  type ResourceStats,
  type ValidationRequest,
  type ValidationBatch,
  type AspectValidationResult,
  type DetailedValidationResult,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gt, lt, sql, getTableColumns } from "drizzle-orm";
import { queryOptimizer } from "./utils/query-optimizer.js";
import { logger } from "./utils/logger.js";
import { cacheManager, CACHE_TAGS } from "./utils/cache-manager.js";
import { getValidationSettingsService } from "./services/validation/settings/validation-settings-service.js";

export interface IStorage {
  // FHIR Servers
  getFhirServers(): Promise<FhirServer[]>;
  getActiveFhirServer(): Promise<FhirServer | undefined>;
  createFhirServer(server: InsertFhirServer): Promise<FhirServer>;
  updateFhirServerStatus(id: number, isActive: boolean): Promise<void>;
  updateFhirServer(id: number, updates: Partial<Pick<FhirServer, 'name' | 'url' | 'authConfig' | 'isActive'>>): Promise<FhirServer>;
  deleteFhirServer(id: number): Promise<void>;

  // FHIR Resources
  getFhirResources(serverId?: number, resourceType?: string, limit?: number, offset?: number): Promise<FhirResource[]>;
  getFhirResourceById(id: number): Promise<FhirResourceWithValidation | undefined>;
  getFhirResourceByTypeAndId(resourceType: string, resourceId: string): Promise<FhirResource | undefined>;
  createFhirResource(resource: InsertFhirResource): Promise<FhirResource>;
  updateFhirResource(id: number, data: any): Promise<void>;
  updateFhirResourceLastValidated(id: number, validatedAt: string): Promise<void>;
  searchFhirResources(query: string, resourceType?: string): Promise<FhirResource[]>;

  // Validation Profiles
  getValidationProfiles(resourceType?: string): Promise<ValidationProfile[]>;
  createValidationProfile(profile: InsertValidationProfile): Promise<ValidationProfile>;
  getValidationProfileById(id: number): Promise<ValidationProfile | undefined>;
  updateValidationProfile(id: number, updates: Partial<ValidationProfile>): Promise<void>;
  deleteValidationProfile(id: number): Promise<void>;

  // Validation Results (LEGACY - Use ValidationGroupsRepository for per-aspect validation)
  getValidationResultsByResourceId(resourceId: number): Promise<ValidationResult[]>;
  createValidationResult(result: InsertValidationResult): Promise<ValidationResult>;
  createValidationResultWithFhirIdentity(result: InsertValidationResult, serverId: number, resourceType: string, fhirResourceId: string): Promise<ValidationResult>;
  
  // Enhanced Validation Result Caching
  getLatestValidationResult(resourceId: number, settingsHash?: string): Promise<ValidationResult | undefined>;
  getValidationResultByHash(resourceId: number, settingsHash: string, resourceHash: string): Promise<ValidationResult | undefined>;
  invalidateValidationResults(resourceId?: number, settingsHash?: string): Promise<void>;
  cleanupOldValidationResults(maxAgeHours?: number): Promise<number>;

  // Consolidated Validation Service Methods
  getValidationResultsByRequestId(requestId: string): Promise<ValidationResult[]>;
  getValidationResultsByBatchId(batchId: string): Promise<ValidationResult[]>;
  getValidationResultsByStatus(status: string, limit?: number): Promise<ValidationResult[]>;
  updateValidationResultStatus(id: number, status: string, errorMessage?: string, errorDetails?: any): Promise<void>;
  getValidationResultsByResourceType(resourceType: string, limit?: number): Promise<ValidationResult[]>;
  getValidationPerformanceMetrics(resourceType?: string, days?: number): Promise<any>;
  getValidationAspectBreakdown(resourceType?: string, days?: number): Promise<any>;

  // Dashboard
  getDashboardCards(): Promise<DashboardCard[]>;
  createDashboardCard(card: InsertDashboardCard): Promise<DashboardCard>;
  updateDashboardCard(id: number, config: any): Promise<void>;

  // Statistics
  getResourceStats(serverId?: number): Promise<ResourceStats>;

  // Note: Validation Settings methods have been moved to ValidationSettingsRepository
  // Use the rock-solid validation settings service instead
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Check if default server exists
      const existingServers = await this.getFhirServers();
      if (existingServers.length === 0) {
        // Initialize with default FHIR server
        await this.createFhirServer({
          name: "Fire.ly Server",
          url: "https://server.fire.ly",
          isActive: true,
        });
      }

      // Check if default validation profile exists
      const existingProfiles = await this.getValidationProfiles();
      if (existingProfiles.length === 0) {
        // Initialize default validation profiles
        await this.createValidationProfile({
          name: "US Core Patient",
          url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
          resourceType: "Patient",
          profileData: {},
          isActive: true,
        });
      }

      // Check if default dashboard cards exist
      const existingCards = await this.getDashboardCards();
      if (existingCards.length === 0) {
        // Initialize default dashboard cards
        await this.createDashboardCard({
          title: "Validation Overview",
          type: "chart",
          config: { chartType: "donut" },
          position: 1,
          isVisible: true,
        });
        
        await this.createDashboardCard({
          title: "Recent Errors",
          type: "table",
          config: { showRecent: 5 },
          position: 2,
          isVisible: true,
        });
      }
    } catch (error) {
      console.warn("Failed to initialize default data:", error);
    }
  }

  private clearServerCaches(options?: { includeResourceCaches?: boolean }) {
    cacheManager.clearByTag(CACHE_TAGS.FHIR_SERVER);

    if (options?.includeResourceCaches) {
      cacheManager.clearByTag(CACHE_TAGS.FHIR_RESOURCES);
      cacheManager.clearByTag(CACHE_TAGS.RESOURCE_COUNTS);
      cacheManager.clearByTag(CACHE_TAGS.VALIDATION);
      cacheManager.clearByTag(CACHE_TAGS.VALIDATION_RESULTS);
    }
  }

  async getFhirServers(): Promise<FhirServer[]> {
    return await queryOptimizer.getFhirServers();
  }

  async getActiveFhirServer(): Promise<FhirServer | undefined> {
    return await queryOptimizer.getActiveFhirServer();
  }

  async createFhirServer(server: InsertFhirServer): Promise<FhirServer> {
    const [newServer] = await db
      .insert(fhirServers)
      .values(server)
      .returning();
    this.clearServerCaches();
    return newServer;
  }

  async updateFhirServerStatus(id: number, isActive: boolean): Promise<void> {
    // Use a transaction to ensure atomicity and prevent race conditions
    await db.transaction(async (tx) => {
      // Deactivate all other servers if this one is being activated
      if (isActive) {
        await tx.update(fhirServers).set({ isActive: false });
      }
      await tx.update(fhirServers).set({ isActive }).where(eq(fhirServers.id, id));
    });
    this.clearServerCaches({ includeResourceCaches: true });
  }

  async updateFhirServer(id: number, updates: Partial<Pick<FhirServer, 'name' | 'url' | 'authConfig' | 'isActive'>>): Promise<FhirServer> {
    const [updatedServer] = await db.update(fhirServers)
      .set(updates)
      .where(eq(fhirServers.id, id))
      .returning();
    
    if (!updatedServer) {
      throw new Error('Server not found');
    }
    this.clearServerCaches();
    return updatedServer;
  }

  async deleteFhirServer(id: number): Promise<void> {
    await db.delete(fhirServers).where(eq(fhirServers.id, id));
    this.clearServerCaches({ includeResourceCaches: true });
  }

  async getFhirResources(serverId?: number, resourceType?: string, limit = 50, offset = 0): Promise<FhirResource[]> {
    const conditions = [];
    
    // Always filter by active server if no specific server is provided
    if (serverId) {
      conditions.push(eq(fhirResources.serverId, serverId));
    } else {
      // Get active server and filter by it
      const activeServer = await this.getActiveFhirServer();
      if (activeServer) {
        conditions.push(eq(fhirResources.serverId, activeServer.id));
      }
    }
    
    if (resourceType) {
      conditions.push(eq(fhirResources.resourceType, resourceType));
    }
    
    const query = db.select().from(fhirResources);
    
    if (conditions.length > 0) {
      return await query
        .where(and(...conditions))
        .limit(limit)
        .offset(offset);
    }
    
    return await query.limit(limit).offset(offset);
  }

  async getFhirResourceById(id: number): Promise<FhirResourceWithValidation | undefined> {
    const [resource] = await db.select().from(fhirResources).where(eq(fhirResources.id, id));
    if (!resource) return undefined;

    // Try to get validation results from legacy table, but handle gracefully if table doesn't exist
    // (migration to per-aspect validation tables may have dropped legacy table)
    let validationResults: ValidationResult[] = [];
    try {
      validationResults = await this.getValidationResultsByResourceId(id);
    } catch (error: any) {
      // If the validation_results table doesn't exist (code 42P01), just return empty array
      // Validation will use the new per-aspect tables instead
      if (error.code !== '42P01') {
        console.error('[Storage] Error loading validation results for resource:', error);
      }
    }
    
    return {
      ...resource,
      validationResults,
    };
  }

  async getFhirResourceByTypeAndId(resourceType: string, resourceId: string): Promise<FhirResource | undefined> {
    const conditions = [eq(fhirResources.resourceId, resourceId)];
    if (resourceType) {
      conditions.push(eq(fhirResources.resourceType, resourceType));
    }
    
    const [resource] = await db.select().from(fhirResources).where(
      resourceType ? and(...conditions) : conditions[0]
    );
    return resource || undefined;
  }

  async createFhirResource(resource: InsertFhirResource): Promise<FhirResource> {
    const [newResource] = await db
      .insert(fhirResources)
      .values(resource)
      .returning();
    return newResource;
  }

  async updateFhirResource(id: number, data: any): Promise<void> {
    await db.update(fhirResources)
      .set({ data, lastModified: new Date() })
      .where(eq(fhirResources.id, id));
  }

  async updateFhirResourceLastValidated(id: number, validatedAt: string): Promise<void> {
    await db.update(fhirResources)
      .set({ lastValidated: new Date(validatedAt) })
      .where(eq(fhirResources.id, id));
  }

  async searchFhirResources(query: string, resourceType?: string): Promise<FhirResource[]> {
    // Note: This is a simplified search. In a production system, you'd want to use 
    // full-text search capabilities or index specific fields
    const allResources = await this.getFhirResources(undefined, resourceType, 1000, 0);
    
    return allResources.filter(resource => {
      const dataStr = JSON.stringify(resource.data).toLowerCase();
      return dataStr.includes(query.toLowerCase()) || 
             resource.resourceId.toLowerCase().includes(query.toLowerCase());
    });
  }

  async getValidationProfiles(resourceType?: string): Promise<ValidationProfile[]> {
    return await queryOptimizer.getValidationProfiles(resourceType);
  }

  async createValidationProfile(profile: InsertValidationProfile): Promise<ValidationProfile> {
    const [newProfile] = await db
      .insert(validationProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async getValidationProfileById(id: number): Promise<ValidationProfile | undefined> {
    const [profile] = await db.select().from(validationProfiles).where(eq(validationProfiles.id, id));
    return profile || undefined;
  }

  async updateValidationProfile(id: number, updates: Partial<ValidationProfile>): Promise<void> {
    await db.update(validationProfiles)
      .set(updates)
      .where(eq(validationProfiles.id, id));
  }

  async deleteValidationProfile(id: number): Promise<void> {
    await db.delete(validationProfiles)
      .where(eq(validationProfiles.id, id));
  }

  async getValidationResultsByResourceId(resourceId: number): Promise<ValidationResult[]> {
    return await queryOptimizer.getValidationResults(resourceId);
  }

  async clearAllValidationResults(): Promise<void> {
    await db.delete(validationResults);
    console.log('[Storage] Cleared all validation results');
  }

  // REMOVED: Legacy methods clearValidationResultsForResource and clearValidationResultsForFhirIdentity
  // Use ValidationGroupsRepository for per-aspect validation

  async createValidationResult(result: InsertValidationResult): Promise<ValidationResult> {
    const [newResult] = await db
      .insert(validationResults)
      .values(result)
      .returning();
    return newResult;
  }

  async createValidationResultWithFhirIdentity(result: InsertValidationResult, serverId: number, resourceType: string, fhirResourceId: string): Promise<ValidationResult> {
    const [newResult] = await db
      .insert(validationResults)
      .values({
        ...result,
        serverId,
        resourceType,
        fhirResourceId
      })
      .returning();
    return newResult;
  }

  // REMOVED: Legacy methods getRecentValidationErrors and getLatestValidationResults
  // Use ValidationGroupsRepository for per-aspect validation

  async getLatestValidationResult(resourceId: number, settingsHash?: string): Promise<ValidationResult | undefined> {
    const conditions = [eq(validationResults.resourceId, resourceId)];
    
    if (settingsHash) {
      conditions.push(eq(validationResults.settingsHash, settingsHash));
    }
    
    const [result] = await db.select()
      .from(validationResults)
      .where(and(...conditions))
      .orderBy(desc(validationResults.validatedAt))
      .limit(1);
    
    return result || undefined;
  }

  async getValidationResultByHash(resourceId: number, settingsHash: string, resourceHash: string): Promise<ValidationResult | undefined> {
    const [result] = await db.select()
      .from(validationResults)
      .where(and(
        eq(validationResults.resourceId, resourceId),
        eq(validationResults.settingsHash, settingsHash),
        eq(validationResults.resourceHash, resourceHash)
      ))
      .orderBy(desc(validationResults.validatedAt))
      .limit(1);
    
    return result || undefined;
  }

  async invalidateValidationResults(resourceId?: number, settingsHash?: string): Promise<void> {
    const conditions = [];
    
    if (resourceId) {
      conditions.push(eq(validationResults.resourceId, resourceId));
    }
    
    if (settingsHash) {
      conditions.push(eq(validationResults.settingsHash, settingsHash));
    }
    
    if (conditions.length === 0) {
      // If no conditions, delete all validation results (use with caution)
      await db.delete(validationResults);
      logger.warn('[Storage] Deleted ALL validation results - this should only happen during maintenance');
    } else {
      await db.delete(validationResults).where(and(...conditions));
      logger.info('[Storage] Invalidated validation results', { resourceId, settingsHash });
    }
    
    // Clear related caches
    cacheManager.clearByTag(CACHE_TAGS.VALIDATION_RESULTS);
  }

  async cleanupOldValidationResults(maxAgeHours = 168): Promise<number> { // Default 7 days
    const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    
    const result = await db.delete(validationResults)
      .where(lt(validationResults.validatedAt, cutoffDate))
      .returning({ id: validationResults.id });
    
    const deletedCount = result.length;
    logger.info('[Storage] Cleaned up old validation results', { 
      deletedCount, 
      maxAgeHours, 
      cutoffDate: cutoffDate.toISOString() 
    });
    
    return deletedCount;
  }

  // Consolidated Validation Service Methods
  async getValidationResultsByRequestId(requestId: string): Promise<ValidationResult[]> {
    return await db.select()
      .from(validationResults)
      .where(eq(validationResults.validationRequestId, requestId))
      .orderBy(desc(validationResults.validatedAt));
  }

  async getValidationResultsByBatchId(batchId: string): Promise<ValidationResult[]> {
    return await db.select()
      .from(validationResults)
      .where(eq(validationResults.validationBatchId, batchId))
      .orderBy(desc(validationResults.validatedAt));
  }

  async getValidationResultsByStatus(status: string, limit = 100): Promise<ValidationResult[]> {
    return await db.select()
      .from(validationResults)
      .where(eq(validationResults.validationStatus, status))
      .orderBy(desc(validationResults.validatedAt))
      .limit(limit);
  }

  async updateValidationResultStatus(id: number, status: string, errorMessage?: string, errorDetails?: any): Promise<void> {
    const updateData: any = {
      validationStatus: status,
      updatedAt: new Date()
    };

    if (status === 'completed') {
      updateData.validationCompletedAt = new Date();
    } else if (status === 'failed') {
      updateData.validationErrorMessage = errorMessage;
      updateData.validationErrorDetails = errorDetails;
    } else if (status === 'cancelled') {
      updateData.validationCancelledAt = new Date();
    }

    await db.update(validationResults)
      .set(updateData)
      .where(eq(validationResults.id, id));
  }

  async getValidationResultsByResourceType(resourceType: string, limit = 100): Promise<ValidationResult[]> {
    return await db.select()
      .from(validationResults)
      .where(eq(validationResults.resourceType, resourceType))
      .orderBy(desc(validationResults.validatedAt))
      .limit(limit);
  }

  /**
   * @deprecated Legacy method - Use ValidationGroupsRepository for per-aspect validation metrics
   */
  async getValidationPerformanceMetrics(resourceType?: string, days = 30): Promise<any> {
    console.warn('[Storage] getValidationPerformanceMetrics is deprecated - use ValidationGroupsRepository');
    return [];
  }

  /**
   * @deprecated Legacy method - Use ValidationGroupsRepository for per-aspect validation breakdown
   */
  async getValidationAspectBreakdown(resourceType?: string, days = 30): Promise<any> {
    console.warn('[Storage] getValidationAspectBreakdown is deprecated - use ValidationGroupsRepository');
    return [];
  }

  async getDashboardCards(): Promise<DashboardCard[]> {
    return await queryOptimizer.getDashboardCards();
  }

  async createDashboardCard(card: InsertDashboardCard): Promise<DashboardCard> {
    const [newCard] = await db
      .insert(dashboardCards)
      .values(card)
      .returning();
    return newCard;
  }

  async updateDashboardCard(id: number, config: any): Promise<void> {
    await db.update(dashboardCards)
      .set({ config })
      .where(eq(dashboardCards.id, id));
  }

  async getResourceStats(serverId?: number): Promise<ResourceStats> {
    return await queryOptimizer.getResourceStats(serverId);
  }

  async getResourceStatsWithSettings(serverId?: number): Promise<ResourceStats> {
    // Get active server if none specified
    const targetServerId = serverId || (await this.getActiveFhirServer())?.id;
    
    // Get resources for specific server
    const resources = await db.select().from(fhirResources)
      .where(targetServerId ? eq(fhirResources.serverId, targetServerId) : undefined);
    
    // Import per-aspect validation schema
    const { validationResultsPerAspect } = await import('@shared/schema-validation-per-aspect');
    
    // Get validation results from per-aspect table
    // We need to aggregate per-aspect results to determine overall resource validity
    const allValidationResults = await db.select({
      serverId: validationResultsPerAspect.serverId,
      resourceType: validationResultsPerAspect.resourceType,
      fhirId: validationResultsPerAspect.fhirId,
      aspect: validationResultsPerAspect.aspect,
      isValid: validationResultsPerAspect.isValid,
      errorCount: validationResultsPerAspect.errorCount,
      warningCount: validationResultsPerAspect.warningCount,
      informationCount: validationResultsPerAspect.informationCount,
    })
      .from(validationResultsPerAspect)
      .where(targetServerId ? eq(validationResultsPerAspect.serverId, targetServerId) : undefined);
    
    // Get current validation settings
    const settingsService = getValidationSettingsService();
    const validationSettingsData = await settingsService.getCurrentSettings();
    const settings = validationSettingsData || {
      structural: { enabled: true, severity: 'error' as const },
      profile: { enabled: true, severity: 'warning' as const },
      terminology: { enabled: true, severity: 'warning' as const },
      reference: { enabled: true, severity: 'error' as const },
      businessRule: { enabled: true, severity: 'warning' as const },
      metadata: { enabled: true, severity: 'info' as const }
    };
    

    
    // Count valid/error/warning resources based on filtered issues
    let validResourcesCount = 0;
    let errorResourcesCount = 0;
    let warningResourcesCount = 0;
    const resourceBreakdown: Record<string, { total: number; valid: number; validPercent: number }> = {};
    
    // Group resources by type
    resources.forEach(resource => {
      if (!resourceBreakdown[resource.resourceType]) {
        resourceBreakdown[resource.resourceType] = { total: 0, valid: 0, validPercent: 0 };
      }
      resourceBreakdown[resource.resourceType].total++;
    });
    
    // Group per-aspect results by resource (resourceType + fhirId)
    const resourceValidationMap = new Map<string, Array<typeof allValidationResults[0]>>();
    allValidationResults.forEach(result => {
      const key = `${result.resourceType}/${result.fhirId}`;
      if (!resourceValidationMap.has(key)) {
        resourceValidationMap.set(key, []);
      }
      resourceValidationMap.get(key)!.push(result);
    });
    
    // Process each validated resource (aggregating across aspects)
    const processedResources = new Set<string>();
    
    resourceValidationMap.forEach((aspectResults, resourceKey) => {
      // Skip if already processed
      if (processedResources.has(resourceKey)) return;
      processedResources.add(resourceKey);
      
      const resourceType = aspectResults[0].resourceType;
      
      // Aggregate across all aspects: resource is valid only if ALL enabled aspects are valid
      let hasErrors = false;
      let hasWarnings = false;
      let allAspectsValid = true;
      
      let enabledAspectsCount = 0;
      aspectResults.forEach(aspectResult => {
        // Check if this aspect is enabled in settings
        // Treat null/undefined as enabled (default), only skip if explicitly disabled
        const aspectSettings = settings[aspectResult.aspect as keyof typeof settings];
        if (aspectSettings?.enabled === false) {
          return; // Skip explicitly disabled aspects
        }
        
        enabledAspectsCount++;
        
        if (!aspectResult.isValid) {
          allAspectsValid = false;
        }
        
        if (aspectResult.errorCount > 0) {
          hasErrors = true;
        }
        
        if (aspectResult.warningCount > 0) {
          hasWarnings = true;
        }
      });
      
      // If no enabled aspects were checked, skip this resource
      if (enabledAspectsCount === 0) {
        return;
      }
      
      // Determine overall resource status
      if (allAspectsValid) {
        validResourcesCount++;
        if (resourceBreakdown[resourceType]) {
          resourceBreakdown[resourceType].valid++;
        }
      } else {
        // Resource has validation issues
        if (hasErrors) {
          errorResourcesCount++;
        } else if (hasWarnings) {
          warningResourcesCount++;
        } else {
          // Fallback: if isValid is false but no errors/warnings, count as error
          errorResourcesCount++;
        }
      }
    });
    
    // Count unvalidated resources separately (don't count them as errors)
    const validatedResourceKeys = new Set(Array.from(resourceValidationMap.keys()));
    const unvalidatedResourcesCount = resources.filter(resource => {
      const key = `${resource.resourceType}/${resource.resourceId}`;
      return !validatedResourceKeys.has(key);
    }).length;
    
    // Calculate percentages
    Object.keys(resourceBreakdown).forEach(type => {
      const breakdown = resourceBreakdown[type];
      breakdown.validPercent = breakdown.total > 0 ? (breakdown.valid / breakdown.total) * 100 : 0;
    });
    
    const activeProfiles = await db.select().from(validationProfiles).where(eq(validationProfiles.isActive, true));
    
    // Calculate aspect breakdown from per-aspect validation results
    // Treat null/undefined as enabled (default), only mark as disabled if explicitly false
    const aspectBreakdown: Record<string, {
      enabled: boolean;
      issueCount: number;
      errorCount: number;
      warningCount: number;
      informationCount: number;
      score: number;
    }> = {
      structural: { enabled: settings.structural?.enabled !== false, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      profile: { enabled: settings.profile?.enabled !== false, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      terminology: { enabled: settings.terminology?.enabled !== false, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      reference: { enabled: settings.reference?.enabled !== false, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      businessRule: { enabled: settings.businessRule?.enabled !== false, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 },
      metadata: { enabled: settings.metadata?.enabled !== false, issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, score: 100 }
    };

    // Aggregate issues by aspect from per-aspect validation results
    allValidationResults.forEach(result => {
      const aspect = result.aspect;
      if (aspectBreakdown[aspect]) {
        // Count total issues
        const totalIssues = result.errorCount + result.warningCount + result.informationCount;
        aspectBreakdown[aspect].issueCount += totalIssues;
        aspectBreakdown[aspect].errorCount += result.errorCount;
        aspectBreakdown[aspect].warningCount += result.warningCount;
        aspectBreakdown[aspect].informationCount += result.informationCount;
      }
    });

    // Calculate scores for each aspect (100 - penalties)
    Object.keys(aspectBreakdown).forEach(aspect => {
      const breakdown = aspectBreakdown[aspect];
      let score = 100;
      score -= breakdown.errorCount * 15;    // Error issues: -15 points each
      score -= breakdown.warningCount * 5;   // Warning issues: -5 points each
      score -= breakdown.informationCount * 1; // Information issues: -1 point each
      breakdown.score = Math.max(0, Math.min(100, score));
    });
    
    return {
      totalResources: resources.length,
      validResources: validResourcesCount,
      errorResources: errorResourcesCount,
      warningResources: warningResourcesCount,
      unvalidatedResources: unvalidatedResourcesCount,
      activeProfiles: activeProfiles.length,
      resourceBreakdown,
      aspectBreakdown,
    };
  }

  /**
   * Re-evaluate a validation result based on current settings
   * This allows the same validation data to be filtered differently based on current settings
   */
  private reEvaluateValidationResult(result: any, settings: any): { isValid: boolean; errorCount: number; warningCount: number } {
    // Check if ALL validation aspects are disabled
    const allAspectsDisabled = 
      settings?.aspects?.structural?.enabled !== true &&
      settings?.aspects?.profile?.enabled !== true &&
      settings?.aspects?.terminology?.enabled !== true &&
      settings?.aspects?.reference?.enabled !== true &&
      settings?.aspects?.businessRule?.enabled !== true &&
      settings?.aspects?.metadata?.enabled !== true;

    if (allAspectsDisabled) {
      // If all aspects are disabled, consider everything valid
      return { isValid: true, errorCount: 0, warningCount: 0 };
    }

    // Get the stored issues from the validation result
    const issues = result.issues || [];
    
    // Filter issues based on current settings
    const filteredIssues = issues.filter((issue: any) => {
      const aspect = issue.aspect || issue.category || 'structural';
      
      // Check if this aspect is enabled in settings
      switch (aspect) {
        case 'structural':
          return settings?.aspects?.structural?.enabled === true;
        case 'profile':
          return settings?.aspects?.profile?.enabled === true;
        case 'terminology':
          return settings?.aspects?.terminology?.enabled === true;
        case 'reference':
          return settings?.aspects?.reference?.enabled === true;
        case 'business-rule':
        case 'businessRule':
          return settings?.aspects?.businessRule?.enabled === true;
        case 'metadata':
          return settings?.aspects?.metadata?.enabled === true;
        default:
          return true; // Include unknown aspects
      }
    });

    // Count errors and warnings from filtered issues
    let errorCount = 0;
    let warningCount = 0;
    
    filteredIssues.forEach((issue: any) => {
      const severity = issue.severity || 'error';
      if (severity === 'error' || severity === 'fatal') {
        errorCount++;
      } else if (severity === 'warning') {
        warningCount++;
      }
    });

    // Resource is valid if no errors remain after filtering
    const isValid = errorCount === 0;

    return { isValid, errorCount, warningCount };
  }

  // Legacy validation settings methods removed - use ValidationSettingsRepository instead
}

export const storage = new DatabaseStorage();
