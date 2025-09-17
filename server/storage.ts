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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gt, sql, getTableColumns } from "drizzle-orm";
import { queryOptimizer } from "./utils/query-optimizer.js";
import { logger } from "./utils/logger.js";
import { cacheManager, CACHE_TAGS } from "./utils/cache-manager.js";
import { getValidationSettingsService } from "./services/validation/validation-settings-service.js";

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
  searchFhirResources(query: string, resourceType?: string): Promise<FhirResource[]>;

  // Validation Profiles
  getValidationProfiles(resourceType?: string): Promise<ValidationProfile[]>;
  createValidationProfile(profile: InsertValidationProfile): Promise<ValidationProfile>;
  getValidationProfileById(id: number): Promise<ValidationProfile | undefined>;
  updateValidationProfile(id: number, updates: Partial<ValidationProfile>): Promise<void>;
  deleteValidationProfile(id: number): Promise<void>;

  // Validation Results
  getValidationResultsByResourceId(resourceId: number): Promise<ValidationResult[]>;
  createValidationResult(result: InsertValidationResult): Promise<ValidationResult>;
  getRecentValidationErrors(limit?: number, serverId?: number): Promise<ValidationResult[]>;

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

    const validationResults = await this.getValidationResultsByResourceId(id);
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

  async createValidationResult(result: InsertValidationResult): Promise<ValidationResult> {
    const [newResult] = await db
      .insert(validationResults)
      .values(result)
      .returning();
    return newResult;
  }

  async getRecentValidationErrors(limit = 10, serverId?: number): Promise<ValidationResult[]> {
    return await queryOptimizer.getRecentValidationErrors(limit, serverId);
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
    
    // Get validation results for resources on this server WITH issues
    const allValidationResults = await db.select({
      ...getTableColumns(validationResults),
      resourceType: fhirResources.resourceType,
      resourceId: fhirResources.id
    })
      .from(validationResults)
      .innerJoin(fhirResources, eq(validationResults.resourceId, fhirResources.id))
      .where(targetServerId ? eq(fhirResources.serverId, targetServerId) : undefined);
    
    // Get current validation settings
    const settingsService = getValidationSettingsService();
    const validationSettingsData = await settingsService.getActiveSettings();
    const settings = validationSettingsData || {
      structural: { enabled: true, severity: 'error' as const },
      profile: { enabled: true, severity: 'warning' as const },
      terminology: { enabled: true, severity: 'warning' as const },
      reference: { enabled: true, severity: 'error' as const },
      businessRule: { enabled: true, severity: 'warning' as const },
      metadata: { enabled: true, severity: 'information' as const }
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
    
    // Process each validated resource
    const processedResourceIds = new Set<number>();
    
    allValidationResults.forEach(result => {
      // Skip if we already processed this resource
      if (processedResourceIds.has(result.resourceId)) return;
      processedResourceIds.add(result.resourceId);
      
      // Re-evaluate validation result based on current settings
      const reEvaluatedResult = this.reEvaluateValidationResult(result, settings);
      
      if (reEvaluatedResult.isValid) {
        validResourcesCount++;
        if (resourceBreakdown[result.resourceType]) {
          resourceBreakdown[result.resourceType].valid++;
        }
      } else {
        // Check if it has warnings (but no errors) or errors
        const hasErrors = reEvaluatedResult.errorCount > 0;
        const hasWarnings = reEvaluatedResult.warningCount > 0;
        
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
    const validatedResourceIds = new Set(allValidationResults.map(r => r.resourceId));
    const unvalidatedResourcesCount = resources.filter(resource => 
      !validatedResourceIds.has(resource.id)
    ).length;
    
    // Calculate percentages
    Object.keys(resourceBreakdown).forEach(type => {
      const breakdown = resourceBreakdown[type];
      breakdown.validPercent = breakdown.total > 0 ? (breakdown.valid / breakdown.total) * 100 : 0;
    });
    
    const activeProfiles = await db.select().from(validationProfiles).where(eq(validationProfiles.isActive, true));
    
    return {
      totalResources: resources.length,
      validResources: validResourcesCount,
      errorResources: errorResourcesCount,
      warningResources: warningResourcesCount,
      unvalidatedResources: unvalidatedResourcesCount,
      activeProfiles: activeProfiles.length,
      resourceBreakdown,
    };
  }

  /**
   * Re-evaluate a validation result based on current settings
   * This allows the same validation data to be filtered differently based on current settings
   */
  private reEvaluateValidationResult(result: any, settings: any): { isValid: boolean; errorCount: number; warningCount: number } {
    // Check if ALL validation aspects are disabled
    const allAspectsDisabled = 
      settings?.structural?.enabled !== true &&
      settings?.profile?.enabled !== true &&
      settings?.terminology?.enabled !== true &&
      settings?.reference?.enabled !== true &&
      settings?.businessRule?.enabled !== true &&
      settings?.metadata?.enabled !== true;

    if (allAspectsDisabled) {
      // If all aspects are disabled, consider everything valid
      return { isValid: true, errorCount: 0, warningCount: 0 };
    }

    // Get the stored issues from the validation result
    const issues = result.issues || [];
    
    // Filter issues based on current settings
    const filteredIssues = issues.filter((issue: any) => {
      const category = issue.category || 'structural';
      
      // Check if this category is enabled in settings
      switch (category) {
        case 'structural':
          return settings?.structural?.enabled === true;
        case 'profile':
          return settings?.profile?.enabled === true;
        case 'terminology':
          return settings?.terminology?.enabled === true;
        case 'reference':
          return settings?.reference?.enabled === true;
        case 'business-rule':
        case 'businessRule':
          return settings?.businessRule?.enabled === true;
        case 'metadata':
          return settings?.metadata?.enabled === true;
        default:
          return true; // Include unknown categories
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
