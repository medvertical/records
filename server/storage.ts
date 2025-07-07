import {
  fhirServers,
  fhirResources,
  validationProfiles,
  validationResults,
  dashboardCards,
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
  type FhirResourceWithValidation,
  type ResourceStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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
  getRecentValidationErrors(limit?: number): Promise<ValidationResult[]>;

  // Dashboard
  getDashboardCards(): Promise<DashboardCard[]>;
  createDashboardCard(card: InsertDashboardCard): Promise<DashboardCard>;
  updateDashboardCard(id: number, config: any): Promise<void>;

  // Statistics
  getResourceStats(): Promise<ResourceStats>;
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
    let query = db.select().from(fhirResources);
    
    const conditions = [];
    if (serverId) {
      conditions.push(eq(fhirResources.serverId, serverId));
    }
    if (resourceType) {
      conditions.push(eq(fhirResources.resourceType, resourceType));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
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
    let query = db.select().from(validationProfiles).where(eq(validationProfiles.isActive, true));
    
    if (resourceType) {
      query = query.where(and(
        eq(validationProfiles.isActive, true),
        eq(validationProfiles.resourceType, resourceType)
      ));
    }
    
    return await query;
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

  async getRecentValidationErrors(limit = 10): Promise<ValidationResult[]> {
    return await db.select({
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
      .where(eq(validationResults.isValid, false))
      .orderBy(desc(validationResults.validatedAt))
      .limit(limit);
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

  async getResourceStats(): Promise<ResourceStats> {
    const resources = await db.select().from(fhirResources);
    const allValidationResults = await db.select().from(validationResults);
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
      const resource = resources.find(r => r.id === result.resourceId);
      if (resource && resourceBreakdown[resource.resourceType]) {
        if (result.isValid) {
          resourceBreakdown[resource.resourceType].valid++;
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
      activeProfiles: activeProfiles.length,
      resourceBreakdown,
    };
  }
}

export const storage = new DatabaseStorage();
