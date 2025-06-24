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

export interface IStorage {
  // FHIR Servers
  getFhirServers(): Promise<FhirServer[]>;
  getActiveFhirServer(): Promise<FhirServer | undefined>;
  createFhirServer(server: InsertFhirServer): Promise<FhirServer>;
  updateFhirServerStatus(id: number, isActive: boolean): Promise<void>;

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

export class MemStorage implements IStorage {
  private fhirServers: Map<number, FhirServer> = new Map();
  private fhirResources: Map<number, FhirResource> = new Map();
  private validationProfiles: Map<number, ValidationProfile> = new Map();
  private validationResults: Map<number, ValidationResult> = new Map();
  private dashboardCards: Map<number, DashboardCard> = new Map();
  private currentId = 1;

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize with default FHIR server
    const defaultServer: FhirServer = {
      id: this.currentId++,
      name: "Fire.ly Server",
      url: "https://server.fire.ly",
      isActive: true,
      createdAt: new Date(),
    };
    this.fhirServers.set(defaultServer.id, defaultServer);

    // Initialize default validation profiles
    const usPatientProfile: ValidationProfile = {
      id: this.currentId++,
      name: "US Core Patient",
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
      resourceType: "Patient",
      profileData: {},
      isActive: true,
      createdAt: new Date(),
    };
    this.validationProfiles.set(usPatientProfile.id, usPatientProfile);

    // Initialize default dashboard cards
    const defaultCards: DashboardCard[] = [
      {
        id: this.currentId++,
        title: "Validation Overview",
        type: "chart",
        config: { chartType: "donut" },
        position: 1,
        isVisible: true,
      },
      {
        id: this.currentId++,
        title: "Recent Errors",
        type: "table",
        config: { showRecent: 5 },
        position: 2,
        isVisible: true,
      },
    ];
    
    defaultCards.forEach(card => {
      this.dashboardCards.set(card.id, card);
    });
  }

  async getFhirServers(): Promise<FhirServer[]> {
    return Array.from(this.fhirServers.values());
  }

  async getActiveFhirServer(): Promise<FhirServer | undefined> {
    return Array.from(this.fhirServers.values()).find(server => server.isActive);
  }

  async createFhirServer(server: InsertFhirServer): Promise<FhirServer> {
    const newServer: FhirServer = {
      ...server,
      id: this.currentId++,
      isActive: server.isActive ?? false,
      createdAt: new Date(),
    };
    this.fhirServers.set(newServer.id, newServer);
    return newServer;
  }

  async updateFhirServerStatus(id: number, isActive: boolean): Promise<void> {
    const server = this.fhirServers.get(id);
    if (server) {
      // Deactivate all other servers if this one is being activated
      if (isActive) {
        this.fhirServers.forEach(s => s.isActive = false);
      }
      server.isActive = isActive;
    }
  }

  async getFhirResources(serverId?: number, resourceType?: string, limit = 50, offset = 0): Promise<FhirResource[]> {
    let resources = Array.from(this.fhirResources.values());
    
    if (serverId) {
      resources = resources.filter(r => r.serverId === serverId);
    }
    
    if (resourceType) {
      resources = resources.filter(r => r.resourceType === resourceType);
    }
    
    return resources.slice(offset, offset + limit);
  }

  async getFhirResourceById(id: number): Promise<FhirResourceWithValidation | undefined> {
    const resource = this.fhirResources.get(id);
    if (!resource) return undefined;

    const validationResults = await this.getValidationResultsByResourceId(id);
    return {
      ...resource,
      validationResults,
    };
  }

  async getFhirResourceByTypeAndId(resourceType: string, resourceId: string): Promise<FhirResource | undefined> {
    return Array.from(this.fhirResources.values()).find(
      r => r.resourceType === resourceType && r.resourceId === resourceId
    );
  }

  async createFhirResource(resource: InsertFhirResource): Promise<FhirResource> {
    const newResource: FhirResource = {
      ...resource,
      id: this.currentId++,
      serverId: resource.serverId ?? null,
      versionId: resource.versionId ?? null,
      lastModified: new Date(),
    };
    this.fhirResources.set(newResource.id, newResource);
    return newResource;
  }

  async updateFhirResource(id: number, data: any): Promise<void> {
    const resource = this.fhirResources.get(id);
    if (resource) {
      resource.data = data;
      resource.lastModified = new Date();
    }
  }

  async searchFhirResources(query: string, resourceType?: string): Promise<FhirResource[]> {
    let resources = Array.from(this.fhirResources.values());
    
    if (resourceType) {
      resources = resources.filter(r => r.resourceType === resourceType);
    }
    
    return resources.filter(resource => {
      const dataStr = JSON.stringify(resource.data).toLowerCase();
      return dataStr.includes(query.toLowerCase()) || 
             resource.resourceId.toLowerCase().includes(query.toLowerCase());
    });
  }

  async getValidationProfiles(resourceType?: string): Promise<ValidationProfile[]> {
    let profiles = Array.from(this.validationProfiles.values());
    
    if (resourceType) {
      profiles = profiles.filter(p => p.resourceType === resourceType);
    }
    
    return profiles.filter(p => p.isActive);
  }

  async createValidationProfile(profile: InsertValidationProfile): Promise<ValidationProfile> {
    const newProfile: ValidationProfile = {
      ...profile,
      id: this.currentId++,
      isActive: profile.isActive ?? true,
      createdAt: new Date(),
    };
    this.validationProfiles.set(newProfile.id, newProfile);
    return newProfile;
  }

  async getValidationProfileById(id: number): Promise<ValidationProfile | undefined> {
    return this.validationProfiles.get(id);
  }

  async getValidationResultsByResourceId(resourceId: number): Promise<ValidationResult[]> {
    return Array.from(this.validationResults.values()).filter(
      result => result.resourceId === resourceId
    );
  }

  async createValidationResult(result: InsertValidationResult): Promise<ValidationResult> {
    const newResult: ValidationResult = {
      ...result,
      id: this.currentId++,
      resourceId: result.resourceId ?? null,
      profileId: result.profileId ?? null,
      errors: result.errors ?? [],
      warnings: result.warnings ?? [],
      validatedAt: new Date(),
    };
    this.validationResults.set(newResult.id, newResult);
    return newResult;
  }

  async getRecentValidationErrors(limit = 10): Promise<ValidationResult[]> {
    return Array.from(this.validationResults.values())
      .filter(result => !result.isValid)
      .sort((a, b) => new Date(b.validatedAt!).getTime() - new Date(a.validatedAt!).getTime())
      .slice(0, limit);
  }

  async getDashboardCards(): Promise<DashboardCard[]> {
    return Array.from(this.dashboardCards.values())
      .filter(card => card.isVisible)
      .sort((a, b) => a.position - b.position);
  }

  async createDashboardCard(card: InsertDashboardCard): Promise<DashboardCard> {
    const newCard: DashboardCard = {
      ...card,
      id: this.currentId++,
      isVisible: card.isVisible ?? true,
    };
    this.dashboardCards.set(newCard.id, newCard);
    return newCard;
  }

  async updateDashboardCard(id: number, config: any): Promise<void> {
    const card = this.dashboardCards.get(id);
    if (card) {
      card.config = config;
    }
  }

  async getResourceStats(): Promise<ResourceStats> {
    const resources = Array.from(this.fhirResources.values());
    const validationResults = Array.from(this.validationResults.values());
    
    const totalResources = resources.length;
    const validResources = validationResults.filter(r => r.isValid).length;
    const errorResources = validationResults.filter(r => !r.isValid).length;
    const activeProfiles = Array.from(this.validationProfiles.values()).filter(p => p.isActive).length;
    
    const resourceBreakdown: Record<string, { total: number; valid: number; validPercent: number }> = {};
    
    // Group by resource type
    resources.forEach(resource => {
      if (!resourceBreakdown[resource.resourceType]) {
        resourceBreakdown[resource.resourceType] = { total: 0, valid: 0, validPercent: 0 };
      }
      resourceBreakdown[resource.resourceType].total++;
    });
    
    // Calculate validation stats per resource type
    validationResults.forEach(result => {
      const resource = this.fhirResources.get(result.resourceId!);
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
      activeProfiles,
      resourceBreakdown,
    };
  }
}

export const storage = new MemStorage();
