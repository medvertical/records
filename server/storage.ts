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

export interface IStorage {
  // FHIR Servers
  getFhirServers(): Promise<FhirServer[]>;
  getActiveFhirServer(): Promise<FhirServer | undefined>;
  createFhirServer(server: InsertFhirServer): Promise<FhirServer>;
  updateFhirServerStatus(id: number, isActive: boolean): Promise<void>;
  updateFhirServer(id: number, updates: Partial<Pick<FhirServer, 'name' | 'url' | 'authConfig'>>): Promise<FhirServer>;
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

  // Validation Settings
  getValidationSettings(): Promise<ValidationSettings | undefined>;
  createOrUpdateValidationSettings(settings: InsertValidationSettings): Promise<ValidationSettings>;
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

  async getFhirServers(): Promise<FhirServer[]> {
    return await db.select().from(fhirServers);
  }

  async getActiveFhirServer(): Promise<FhirServer | undefined> {
    const [server] = await db.select().from(fhirServers).where(eq(fhirServers.isActive, true));
    return server || undefined;
  }

  async createFhirServer(server: InsertFhirServer): Promise<FhirServer> {
    const [newServer] = await db
      .insert(fhirServers)
      .values(server)
      .returning();
    return newServer;
  }

  async updateFhirServerStatus(id: number, isActive: boolean): Promise<void> {
    // Deactivate all other servers if this one is being activated
    if (isActive) {
      await db.update(fhirServers).set({ isActive: false });
    }
    await db.update(fhirServers).set({ isActive }).where(eq(fhirServers.id, id));
  }

  async updateFhirServer(id: number, updates: Partial<Pick<FhirServer, 'name' | 'url' | 'authConfig'>>): Promise<FhirServer> {
    const [updatedServer] = await db.update(fhirServers)
      .set(updates)
      .where(eq(fhirServers.id, id))
      .returning();
    
    if (!updatedServer) {
      throw new Error('Server not found');
    }
    
    return updatedServer;
  }

  async deleteFhirServer(id: number): Promise<void> {
    await db.delete(fhirServers).where(eq(fhirServers.id, id));
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
    const conditions = [eq(validationProfiles.isActive, true)];
    
    if (resourceType) {
      conditions.push(eq(validationProfiles.resourceType, resourceType));
    }
    
    return await db.select()
      .from(validationProfiles)
      .where(and(...conditions));
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
    return await db.select().from(validationResults).where(eq(validationResults.resourceId, resourceId));
  }

  async createValidationResult(result: InsertValidationResult): Promise<ValidationResult> {
    const [newResult] = await db
      .insert(validationResults)
      .values(result)
      .returning();
    return newResult;
  }

  async getRecentValidationErrors(limit = 10, serverId?: number): Promise<ValidationResult[]> {
    // Get active server if none specified
    const targetServerId = serverId || (await this.getActiveFhirServer())?.id;
    
    const query = db.select({
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
      fhirResourceId: fhirResources.resourceId,
    })
      .from(validationResults)
      .leftJoin(fhirResources, eq(validationResults.resourceId, fhirResources.id))
      .where(
        targetServerId 
          ? and(
              eq(validationResults.isValid, false),
              eq(fhirResources.serverId, targetServerId)
            )
          : eq(validationResults.isValid, false)
      )
      .orderBy(desc(validationResults.validatedAt))
      .limit(limit);

    return await query;
  }

  async getDashboardCards(): Promise<DashboardCard[]> {
    return await db.select()
      .from(dashboardCards)
      .where(eq(dashboardCards.isVisible, true))
      .orderBy(dashboardCards.position);
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
    // Get active server if none specified
    const targetServerId = serverId || (await this.getActiveFhirServer())?.id;
    
    // Get resources for specific server
    const resources = await db.select().from(fhirResources)
      .where(targetServerId ? eq(fhirResources.serverId, targetServerId) : undefined);
    
    // Get validation results for resources on this server
    const allValidationResults = await db.select({
      ...getTableColumns(validationResults),
      resourceType: fhirResources.resourceType,
    })
      .from(validationResults)
      .innerJoin(fhirResources, eq(validationResults.resourceId, fhirResources.id))
      .where(targetServerId ? eq(fhirResources.serverId, targetServerId) : undefined);
    
    const activeProfiles = await db.select().from(validationProfiles).where(eq(validationProfiles.isActive, true));
    
    const totalResources = resources.length;
    const validResources = allValidationResults.filter(r => r.isValid).length;
    const errorResources = allValidationResults.filter(r => !r.isValid).length;
    
    const resourceBreakdown: Record<string, { total: number; valid: number; validPercent: number }> = {};
    
    // Group by resource type
    resources.forEach(resource => {
      if (!resourceBreakdown[resource.resourceType]) {
        resourceBreakdown[resource.resourceType] = { total: 0, valid: 0, validPercent: 0 };
      }
      resourceBreakdown[resource.resourceType].total++;
    });
    
    // Calculate validation stats per resource type
    allValidationResults.forEach(result => {
      const type = result.resourceType;
      if (resourceBreakdown[type]) {
        if (result.isValid) {
          resourceBreakdown[type].valid++;
        }
      }
    });
    
    // Calculate percentages
    Object.keys(resourceBreakdown).forEach(type => {
      const breakdown = resourceBreakdown[type];
      breakdown.validPercent = breakdown.total > 0 ? (breakdown.valid / breakdown.total) * 100 : 0;
    });
    
    return {
      totalResources,
      validResources,
      errorResources,
      warningResources: 0, // TODO: implement warning count logic
      activeProfiles: activeProfiles.length,
      resourceBreakdown,
    };
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
    const validationSettingsData = await this.getValidationSettings();
    const settings = validationSettingsData?.settings || {
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
      
      // Filter issues based on active validation settings
      let hasRelevantErrors = false;
      let hasRelevantWarnings = false;
      
      if (result.issues && Array.isArray(result.issues)) {
        const filteredIssues = result.issues.filter((issue: any) => {
          const category = issue.category || 'structural';
          
          // Check if this category is enabled
          if (category === 'structural' && !settings.structural?.enabled) return false;
          if (category === 'profile' && !settings.profile?.enabled) return false;
          if (category === 'terminology' && !settings.terminology?.enabled) return false;
          if (category === 'reference' && !settings.reference?.enabled) return false;
          if (category === 'business-rule' && !settings.businessRule?.enabled) return false;
          if (category === 'metadata' && !settings.metadata?.enabled) return false;
          
          return true;
        });
        
        // Check if any filtered issues are errors or warnings
        hasRelevantErrors = filteredIssues.some((issue: any) => 
          issue.severity === 'error' || issue.severity === 'fatal'
        );
        
        hasRelevantWarnings = filteredIssues.some((issue: any) => 
          issue.severity === 'warning'
        );
      }
      
      // Update counts
      if (hasRelevantErrors) {
        errorResourcesCount++;
      } else if (hasRelevantWarnings) {
        warningResourcesCount++;
      } else {
        validResourcesCount++;
        if (resourceBreakdown[result.resourceType]) {
          resourceBreakdown[result.resourceType].valid++;
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

  async getValidationSettings(): Promise<ValidationSettings | undefined> {
    const [settings] = await db
      .select()
      .from(validationSettings)
      .where(eq(validationSettings.isActive, true))
      .orderBy(desc(validationSettings.updatedAt))
      .limit(1);
    return settings || undefined;
  }

  async createOrUpdateValidationSettings(settings: InsertValidationSettings): Promise<ValidationSettings> {
    const existing = await this.getValidationSettings();
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(validationSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(validationSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings with default structure
      const defaultSettings = {
        version: 1,
        settings: {
          structural: { enabled: true, severity: 'error' as const },
          profile: { enabled: true, severity: 'warning' as const },
          terminology: { enabled: true, severity: 'warning' as const },
          reference: { enabled: true, severity: 'error' as const },
          businessRule: { enabled: true, severity: 'warning' as const },
          metadata: { enabled: true, severity: 'information' as const },
          strictMode: false,
          defaultSeverity: 'warning' as const,
          includeDebugInfo: false,
          validateAgainstBaseSpec: true,
          fhirVersion: 'R4' as const,
          terminologyServers: [],
          profileResolutionServers: [],
          cacheSettings: {
            enabled: true,
            ttlMs: 300000,
            maxSizeMB: 100,
            cacheValidationResults: true,
            cacheTerminologyExpansions: true,
            cacheProfileResolutions: true
          },
          timeoutSettings: {
            defaultTimeoutMs: 30000,
            structuralValidationTimeoutMs: 30000,
            profileValidationTimeoutMs: 45000,
            terminologyValidationTimeoutMs: 60000,
            referenceValidationTimeoutMs: 30000,
            businessRuleValidationTimeoutMs: 30000,
            metadataValidationTimeoutMs: 15000
          },
          maxConcurrentValidations: 10,
          useParallelValidation: true,
          customRules: [],
          validateExternalReferences: false,
          validateNonExistentReferences: true,
          validateReferenceTypes: true
        },
        isActive: true,
        createdBy: 'system',
        updatedBy: 'system'
      };
      
      const [created] = await db
        .insert(validationSettings)
        .values(defaultSettings)
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
