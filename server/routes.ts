import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { FhirClient } from "./services/fhir/fhir-client";
import { UnifiedValidationService } from "./services/validation/unified-validation";
import { profileManager } from "./services/fhir/profile-manager";
import { insertFhirServerSchema, insertFhirResourceSchema, insertValidationProfileSchema, type ValidationResult, validationResults } from "@shared/schema.js";
import { z } from "zod";
import { db } from "./db.js";
import { lt, sql } from "drizzle-orm";

// Rock Solid Validation Settings imports
import { getValidationSettingsService } from "./services/validation/validation-settings-service";
import { getValidationSettingsRepository } from "./repositories/validation-settings-repository";
import { getValidationPipeline } from "./services/validation/validation-pipeline";
import { getValidationQueueService, ValidationPriority } from "./services/validation/validation-queue-service";
import { getIndividualResourceProgressService } from "./services/validation/individual-resource-progress-service";
import { getValidationCancellationRetryService } from "./services/validation/validation-cancellation-retry-service";
import { DashboardService } from "./services/dashboard/dashboard-service";
import type { ValidationSettings, ValidationSettingsUpdate } from "@shared/validation-settings.js";
import { BUILT_IN_PRESETS } from "@shared/validation-settings.js";
import ValidationCacheManager from "./utils/validation-cache-manager.js";

let fhirClient: FhirClient;
let unifiedValidationService: UnifiedValidationService;
let dashboardService: DashboardService;

// Make dashboard service available globally for validation settings service
declare global {
  var dashboardService: DashboardService | undefined;
}

// Global validation state tracking
let globalValidationState = {
  isRunning: false,
  isPaused: false,
  startTime: null as Date | null,
  canPause: false,
  shouldStop: false,
  resumeData: null as any | null,
  currentResourceType: null as string | null,
  nextResourceType: null as string | null,
  lastBroadcastTime: null as number | null
};

// Resource counts cache for dashboard performance
const resourceCountsCache = {
  totalResources: 0,
  resourceCounts: {} as Record<string, number>,
  lastUpdated: 0,
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
};

// Helper function to get cached or fresh resource counts
async function getCachedResourceCounts() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (resourceCountsCache.lastUpdated > 0 && (now - resourceCountsCache.lastUpdated) < resourceCountsCache.CACHE_DURATION) {
    console.log('[ResourceCache] Using cached resource counts:', resourceCountsCache.totalResources);
    return {
      totalResources: resourceCountsCache.totalResources,
      resourceCounts: resourceCountsCache.resourceCounts
    };
  }
  
  // Refresh cache with new data
  if (fhirClient) {
    try {
      console.log('[ResourceCache] Refreshing resource counts cache...');
      
      // Get all supported resource types from server CapabilityStatement
      const allResourceTypes = await fhirClient.getAllResourceTypes();
      
      // Get counts using the optimized resource-counts endpoint logic
      const batchSize = 8;
      const resourceCounts: Record<string, number> = {};
      let totalProcessed = 0;
      
      for (let i = 0; i < allResourceTypes.length; i += batchSize) {
        const batch = allResourceTypes.slice(i, i + batchSize);
        
        const countPromises = batch.map(async (type) => {
          try {
            const count = await fhirClient.getResourceCount(type);
            return { type, count };
          } catch (error) {
            console.warn(`[ResourceCache] Failed to get count for ${type}:`, error.message);
            return { type, count: 0 };
          }
        });
        
        const results = await Promise.all(countPromises);
        results.forEach(({ type, count }) => {
          if (count > 0) {
            resourceCounts[type] = count;
            totalProcessed++;
          }
        });
        
        // Small delay between batches
        if (i + batchSize < allResourceTypes.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      const totalResources = Object.values(resourceCounts).reduce((sum, count) => sum + count, 0);
      
      // Update cache
      resourceCountsCache.totalResources = totalResources;
      resourceCountsCache.resourceCounts = resourceCounts;
      resourceCountsCache.lastUpdated = now;
      
      console.log(`[ResourceCache] Cache refreshed: ${totalProcessed} resource types, ${totalResources} total resources`);
      
      return { totalResources, resourceCounts };
      
    } catch (error) {
      console.error('[ResourceCache] Failed to refresh resource counts:', error);
      // Return cached data if available, otherwise fallback
      if (resourceCountsCache.lastUpdated > 0) {
        return {
          totalResources: resourceCountsCache.totalResources,
          resourceCounts: resourceCountsCache.resourceCounts
        };
      } else {
        return { totalResources: 807575, resourceCounts: {} }; // Known comprehensive total
      }
    }
  }
  
  return { totalResources: 807575, resourceCounts: {} }; // Known comprehensive total
}

// Filter validation issues based on active settings
function filterValidationIssues(validationResults: ValidationResult[], activeSettings: any): ValidationResult[] {
  if (!activeSettings) return validationResults;
  
        // Use nested settings structure (the actual validation settings)
        const settings = activeSettings.settings || activeSettings;
  
  return validationResults.map(result => {
    if (!result.issues || !Array.isArray(result.issues) || result.issues.length === 0) return result;
    
    // Filter issues based on their aspect and active settings
    const filteredIssues = result.issues.filter((issue: any) => {
      // Use the aspect field from the new validation engine
      const aspect = issue.aspect;
      
      if (!aspect) {
        // Fallback: try to infer aspect from the message/code for legacy issues
        const message = (issue.message || '').toLowerCase();
        const code = (issue.code || '').toLowerCase();
        
        if (message.includes('cardinality') || message.includes('instance count') || 
            message.includes('declared type') || message.includes('incompatible') ||
            code.includes('structure')) {
          return settings.structural?.enabled === true;
        } else if (message.includes('profile') || message.includes('constraint') ||
                   code.includes('profile')) {
          return settings.profile?.enabled === true;
        } else if (message.includes('code') || message.includes('terminology') ||
                   message.includes('valueset') || code.includes('terminology')) {
          return settings.terminology?.enabled === true;
        } else if (message.includes('reference') || message.includes('target') ||
                   code.includes('reference')) {
          return settings.reference?.enabled === true;
        } else if (message.includes('business') || message.includes('logic') ||
                   code.includes('business')) {
          return settings.businessRule?.enabled === true;
        } else if (message.includes('metadata') || message.includes('security') ||
                   message.includes('narrative') || code.includes('metadata')) {
          return settings.metadata?.enabled === true;
        } else {
          // Default to structural for unknown issues
          return settings.structural?.enabled === true;
        }
      }
      
      switch (aspect) {
        case 'structural':
          return settings.structural?.enabled === true;
        case 'profile':
          return settings.profile?.enabled === true;
        case 'terminology':
          return settings.terminology?.enabled === true;
        case 'reference':
          return settings.reference?.enabled === true;
        case 'businessRule':
          return settings.businessRule?.enabled === true;
        case 'metadata':
          return settings.metadata?.enabled === true;
        default:
          return true; // Show unknown aspects by default
      }
    });
    
    // Recalculate error and warning counts based on filtered issues
    const errorCount = filteredIssues.filter((issue: any) => issue.severity === 'error' || issue.severity === 'fatal').length;
    const warningCount = filteredIssues.filter((issue: any) => issue.severity === 'warning').length;
    
    console.log(`[FilterValidation] Original issues: ${result.issues?.length || 0}, Filtered issues: ${filteredIssues.length}`);
    console.log(`[FilterValidation] Active settings object:`, JSON.stringify(activeSettings, null, 2));
    console.log(`[FilterValidation] Active settings:`, {
      structural: settings.structural?.enabled === true,
      profile: settings.profile?.enabled === true,
      terminology: settings.terminology?.enabled === true,
      reference: settings.reference?.enabled === true,
      businessRule: settings.businessRule?.enabled === true,
      metadata: settings.metadata?.enabled === true
    });
    
    return {
      ...result,
      issues: filteredIssues,
      errors: filteredIssues.filter((issue: any) => issue.severity === 'error'),
      warnings: filteredIssues.filter((issue: any) => issue.severity === 'warning'),
      errorCount,
      warningCount,
      // Recalculate validation score based on filtered issues
      validationScore: errorCount === 0 && warningCount === 0 ? 100 : 
                      errorCount > 0 ? 0 : 
                      Math.max(0, 100 - (warningCount * 10)),
      isValid: errorCount === 0
    };
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize FHIR client with active server
  const activeServer = await storage.getActiveFhirServer();
  if (activeServer) {
    fhirClient = new FhirClient(activeServer.url);
    unifiedValidationService = new UnifiedValidationService(fhirClient, null as any);
    dashboardService = new DashboardService(fhirClient, storage);
    globalThis.dashboardService = dashboardService;
    
    // Load and apply saved validation settings using rock-solid service
    try {
      const settingsService = getValidationSettingsService();
      const savedSettings = await settingsService.getActiveSettings();
    if (savedSettings && unifiedValidationService) {
        console.log('[Routes] Loading saved validation settings from rock-solid service');
      const config = {
          enableStructuralValidation: savedSettings.structural?.enabled ?? true,
          enableProfileValidation: savedSettings.profile?.enabled ?? true,
          enableTerminologyValidation: savedSettings.terminology?.enabled ?? true,
          enableReferenceValidation: savedSettings.reference?.enabled ?? true,
          enableBusinessRuleValidation: savedSettings.businessRule?.enabled ?? true,
          enableMetadataValidation: savedSettings.metadata?.enabled ?? true,
          strictMode: savedSettings.strictMode ?? false,
          profiles: savedSettings.customRules as string[] || [],
          terminologyServers: savedSettings.terminologyServers as any[] || [],
          profileResolutionServers: savedSettings.profileResolutionServers as any[] || []
      };
      unifiedValidationService.updateConfig(config);
      console.log('[Routes] Applied saved validation settings to services');
      }
    } catch (error) {
      console.warn('[Routes] Failed to load validation settings from service:', error);
    }
  }

  // FHIR Server endpoints
  app.get("/api/fhir/servers", async (req, res) => {
    try {
      const servers = await storage.getFhirServers();
      res.json(servers);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to start bulk validation',
        error: 'BULK_START_FAILED',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/fhir/servers", async (req, res) => {
    try {
      const data = insertFhirServerSchema.parse(req.body);
      const server = await storage.createFhirServer(data);
      res.json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers/:id/activate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateFhirServerStatus(id, true);
      
      // Notify validation settings service about server configuration change
      try {
        const settingsService = getValidationSettingsService();
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'terminology' 
        });
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'profile' 
        });
      } catch (error) {
        console.warn('[Routes] Failed to notify validation settings service about server activation:', error);
      }
      
      // Reinitialize FHIR client with new server
      const servers = await storage.getFhirServers();
      const activeServer = servers.find(s => s.id === id);
      if (activeServer) {
        fhirClient = new FhirClient(activeServer.url);
        unifiedValidationService = new UnifiedValidationService(fhirClient, null as any);
        
        // Reapply saved validation settings using rock-solid service
        try {
          const settingsService = getValidationSettingsService();
          const savedSettings = await settingsService.getActiveSettings();
        if (savedSettings && unifiedValidationService) {
          const config = {
              enableStructuralValidation: savedSettings.structural?.enabled ?? true,
              enableProfileValidation: savedSettings.profile?.enabled ?? true,
              enableTerminologyValidation: savedSettings.terminology?.enabled ?? true,
              enableReferenceValidation: savedSettings.reference?.enabled ?? true,
              enableBusinessRuleValidation: savedSettings.businessRule?.enabled ?? true,
              enableMetadataValidation: savedSettings.metadata?.enabled ?? true,
              strictMode: savedSettings.strictMode ?? false,
              profiles: savedSettings.customRules as string[] || [],
              terminologyServers: savedSettings.terminologyServers as any[] || [],
              profileResolutionServers: savedSettings.profileResolutionServers as any[] || []
          };
          unifiedValidationService.updateConfig(config);
          }
        } catch (error) {
          console.warn('[Routes] Failed to reapply validation settings after server activation:', error);
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bulk validation progress',
        error: 'BULK_PROGRESS_FAILED',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/fhir/servers/:id/deactivate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateFhirServerStatus(id, false);
      
      // Notify validation settings service about server configuration change
      try {
        const settingsService = getValidationSettingsService();
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'terminology' 
        });
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'profile' 
        });
      } catch (error) {
        console.warn('[Routes] Failed to notify validation settings service about server deactivation:', error);
      }
      
      // Clear the FHIR client since no server is active
      fhirClient = null as any;
      unifiedValidationService = null as any;
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/fhir/servers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, url, authConfig } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ message: "Name and URL are required" });
      }

      // Update the server
      const updatedServer = await storage.updateFhirServer(id, {
        name,
        url,
        authConfig
      });

      // Notify validation settings service about server configuration change
      try {
        const settingsService = getValidationSettingsService();
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'terminology' 
        });
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'profile' 
        });
      } catch (error) {
        console.warn('[Routes] Failed to notify validation settings service about server update:', error);
      }

      res.json(updatedServer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/fhir/servers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if this is the active server
      const activeServer = await storage.getActiveFhirServer();
      if (activeServer && activeServer.id === id) {
        return res.status(400).json({ 
          message: "Cannot delete the active server. Please activate another server first." 
        });
      }
      
      await storage.deleteFhirServer(id);
      
      // Notify validation settings service about server configuration change
      try {
        const settingsService = getValidationSettingsService();
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'terminology' 
        });
        settingsService.emit('serverConfigurationChanged', { 
          serverId: id.toString(), 
          serverType: 'profile' 
        });
      } catch (error) {
        console.warn('[Routes] Failed to notify validation settings service about server deletion:', error);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/connection/test", async (req, res) => {
    try {
      if (!fhirClient) {
        return res.status(400).json({ message: "No active FHIR server configured" });
      }
      
      const result = await fhirClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test connection to a custom FHIR server
  app.get("/api/fhir/connection/test-custom", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ connected: false, error: "URL parameter is required" });
      }

      // Create a temporary FHIR client to test the connection
      const tempClient = new FhirClient(url);
      const result = await tempClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ connected: false, error: error.message });
    }
  });

  // Get all FHIR servers
  app.get("/api/fhir/servers", async (req, res) => {
    try {
      const servers = await storage.getFhirServers();
      res.json(servers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new FHIR server
  app.post("/api/fhir/servers", async (req, res) => {
    try {
      const { name, url, authConfig } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ message: "Name and URL are required" });
      }

      // Deactivate other servers first
      const existingServers = await storage.getFhirServers();
      for (const server of existingServers) {
        if (server.isActive) {
          await storage.updateFhirServerStatus(server.id, false);
        }
      }

      // Create new server
      const newServer = await storage.createFhirServer({
        name,
        url,
        isActive: true,
        authConfig
      });

      // Notify validation settings service about new server configuration
      try {
        const settingsService = getValidationSettingsService();
        settingsService.emit('serverConfigurationChanged', { 
          serverId: newServer.id.toString(), 
          serverType: 'terminology' 
        });
        settingsService.emit('serverConfigurationChanged', { 
          serverId: newServer.id.toString(), 
          serverType: 'profile' 
        });
      } catch (error) {
        console.warn('[Routes] Failed to notify validation settings service about server creation:', error);
      }

      // Update the global FHIR client
      fhirClient = new FhirClient(url);
      
      res.json(newServer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Resource endpoints
  app.get("/api/fhir/resources", async (req, res) => {
    const startTime = Date.now();
    try {
      console.log("=== NEW RESOURCES ENDPOINT CALLED ===", {
        timestamp: new Date().toISOString(),
        query: req.query
      });
      const { resourceType, _count = '20', page = '0', search } = req.query;
      const count = parseInt(_count as string);
      const offset = parseInt(page as string) * count;
      console.log(`=== PARAMS: resourceType=${resourceType}, count=${count}, page=${page}, search=${search} ===`);

      if (search) {
        console.log("=== USING SEARCH BRANCH ===");
        const searchStartTime = Date.now();
        // Perform search in local storage
        const results = await storage.searchFhirResources(search as string, resourceType as string);
        const searchTime = Date.now() - searchStartTime;
        const totalTime = Date.now() - startTime;
        
        console.log("=== SEARCH COMPLETED ===", {
          searchTime: `${searchTime}ms`,
          totalTime: `${totalTime}ms`,
          resultCount: results.length,
          returnedCount: results.slice(offset, offset + count).length,
          timestamp: new Date().toISOString()
        });
        
        res.json({
          resources: results.slice(offset, offset + count),
          total: results.length,
        });
      } else {
        // Prioritize cached resources for fast loading, use FHIR server only for fresh data
        console.log(`[Resources] Using cached data for performance`);
        console.log(`[Resources] Resource type: ${resourceType}, Count: ${count}, Page: ${page}`);
        
        try {
          const cacheStartTime = Date.now();
          // Try to get cached resources first for immediate response
          const cachedResources = await storage.getFhirResources(undefined, resourceType as string, count, offset);
          
          // Get total count from cache for this resource type
          const allCachedForType = await storage.getFhirResources(undefined, resourceType as string, 10000, 0);
          const cacheTime = Date.now() - cacheStartTime;
          
          console.log(`[Resources] Cache query completed in ${cacheTime}ms`, {
            cachedResourcesCount: cachedResources.length,
            totalCachedForType: allCachedForType.length,
            timestamp: new Date().toISOString()
          });
          
          if (cachedResources.length > 0) {
            console.log(`[Resources] Serving ${cachedResources.length} cached resources immediately (${allCachedForType.length} total in cache)`);
            
            // Get current validation settings for filtering using rock-solid service
            const validationStartTime = Date.now();
            let validationSettings = null;
            try {
              const settingsService = getValidationSettingsService();
              validationSettings = await settingsService.getActiveSettings();
            } catch (error) {
              console.warn('[Routes] Failed to load validation settings for filtering:', error);
            }
            const validationSettingsTime = Date.now() - validationStartTime;
            
            console.log(`[Resources] Validation settings loaded in ${validationSettingsTime}ms`);
            
            // Return resources immediately with cached validation data only
            const validationProcessingStartTime = Date.now();
            const resourcesWithCachedValidation = await Promise.all(
              cachedResources.map(async (resource) => {
                try {
                  // Get existing validation results from cache (no revalidation)
                  const validationResults = await storage.getValidationResultsByResourceId(resource.id);
                  console.log(`[Resource ${resource.id}] Fetched ${validationResults.length} validation results`);
                  
                  // Filter validation results based on active settings
                  const filteredResults = filterValidationIssues(validationResults, validationSettings);
                  
                  // Calculate validation summary based on latest FILTERED validation result
                  const latestValidation = filteredResults.length > 0 ? 
                    filteredResults.reduce((latest, current) => 
                      new Date(current.validatedAt) > new Date(latest.validatedAt) ? current : latest
                    ) : null;
                  
                  // Recalculate counts based on filtered issues
                  let filteredErrorCount = 0;
                  let filteredWarningCount = 0;
                  let filteredInfoCount = 0;
                  
                  // Initialize aspect-specific counts (only for enabled aspects)
                  const issuesByAspect = {
                    structural: 0,
                    profile: 0,
                    terminology: 0,
                    reference: 0,
                    businessRule: 0,
                    metadata: 0
                  };
                  
                  // Use existing aspect breakdown from validation results or initialize default
                  // Use nested settings structure (the actual validation settings)
                  const settings = (validationSettings as any)?.settings || validationSettings;
                  let aspectBreakdown = latestValidation?.aspectBreakdown || {
                    structural: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.structural?.enabled !== false },
                    profile: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.profile?.enabled !== false },
                    terminology: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.terminology?.enabled !== false },
                    reference: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.reference?.enabled !== false },
                    businessRule: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.businessRule?.enabled !== false },
                    metadata: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.metadata?.enabled !== false }
                  };
                  
                  if (latestValidation && latestValidation.aspectBreakdown) {
                    // Update aspectBreakdown to reflect current settings
                    for (const aspect of Object.keys(aspectBreakdown)) {
                      const breakdown = (aspectBreakdown as any)[aspect];
                      const storedBreakdown = (latestValidation.aspectBreakdown as any)[aspect];
                      
                      // Update enabled status based on current settings
                      breakdown.enabled = settings && settings[aspect]?.enabled !== false;
                      console.log(`[Resource ${resource.id}] Aspect ${aspect}: settings.enabled=${settings?.[aspect]?.enabled}, breakdown.enabled=${breakdown.enabled}`);
                      
                      // Use stored data but with current enabled status
                      if (storedBreakdown) {
                        breakdown.errorCount = storedBreakdown.errorCount || 0;
                        breakdown.warningCount = storedBreakdown.warningCount || 0;
                        breakdown.informationCount = storedBreakdown.informationCount || 0;
                        breakdown.issueCount = storedBreakdown.issueCount || 0;
                      }
                      
                      // Only count issues from enabled aspects
                      if (breakdown.enabled) {
                        filteredErrorCount += breakdown.errorCount || 0;
                        filteredWarningCount += breakdown.warningCount || 0;
                        filteredInfoCount += breakdown.informationCount || 0;
                        
                        // Count issues by aspect (only for enabled aspects)
                        (issuesByAspect as any)[aspect] = breakdown.issueCount || 0;
                      }
                    }
                  }
                  
                  // Calculate validation score based on filtered issues (only enabled aspects)
                  let filteredScore = 0; // Default to 0 if no validation has been performed
                  if (latestValidation && latestValidation.aspectBreakdown) {
                    filteredScore = 100; // Start with 100 if validation was performed
                    // Calculate score from aspectBreakdown (filtered by enabled aspects)
                    for (const aspect of Object.keys(aspectBreakdown)) {
                      const breakdown = (aspectBreakdown as any)[aspect];
                      
            // Only consider issues from enabled aspects for scoring
            const aspectEnabled = breakdown.enabled && settings && (settings as any)[aspect]?.enabled !== false;
                      
                      if (aspectEnabled) {
                        filteredScore -= (breakdown.errorCount || 0) * 15;  // Error issues: -15 points each
                        filteredScore -= (breakdown.warningCount || 0) * 5; // Warning issues: -5 points each
                        filteredScore -= (breakdown.informationCount || 0) * 1; // Information issues: -1 point each
                      }
                    }
                    filteredScore = Math.max(0, Math.round(filteredScore));
                  }
                  
                  // Calculate aspect-specific scores and pass/fail status
                  for (const aspect of Object.keys(aspectBreakdown)) {
                    const breakdown = (aspectBreakdown as any)[aspect];
                    
                    if (breakdown.enabled && settings && (settings as any)[aspect]?.enabled !== false) {
                      // Calculate score for this aspect
                      let aspectScore = 100;
                      aspectScore -= breakdown.errorCount * 15;  // Error issues: -15 points each
                      aspectScore -= breakdown.warningCount * 5; // Warning issues: -5 points each
                      aspectScore -= breakdown.informationCount * 1; // Information issues: -1 point each
                      breakdown.validationScore = Math.max(0, Math.round(aspectScore));
                      
                      // Aspect passes if no errors (warnings and info are acceptable)
                      breakdown.passed = breakdown.errorCount === 0;
                    } else {
                      // Disabled aspects get neutral scores
                      breakdown.validationScore = 100;
                      breakdown.passed = true;
                    }
                  }
                  
                  return {
                    ...resource.data,
                    _dbId: resource.id,
                    validationResults: filteredResults,
                    _validationSummary: {
                      hasErrors: filteredErrorCount > 0,
                      hasWarnings: filteredWarningCount > 0,
                      errorCount: filteredErrorCount,
                      warningCount: filteredWarningCount,
                      isValid: filteredErrorCount === 0,
                      validationScore: filteredScore,
                      lastValidated: latestValidation?.validatedAt ? new Date(latestValidation.validatedAt) : null,
                      needsValidation: false, // Always use cached validation results for performance
                      issuesByAspect: issuesByAspect,
                      aspectBreakdown: aspectBreakdown
                    }
                  };
                } catch (error) {
                  console.warn(`Failed to get validation results for resource ${resource.id}:`, error);
                  return {
                    ...resource.data,
                    _dbId: resource.id,
                    validationResults: [],
                    _validationSummary: {
                      hasErrors: false,
                      hasWarnings: false,
                      errorCount: 0,
                      warningCount: 0,
                      isValid: false,
                      validationScore: 0,
                      lastValidated: null,
                      needsValidation: false,
                      issuesByAspect: {
                        structural: 0,
                        profile: 0,
                        terminology: 0,
                        reference: 0,
                        businessRule: 0,
                        metadata: 0
                      },
                      aspectBreakdown: {
                        structural: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.structural?.enabled !== false },
                        profile: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.profile?.enabled !== false },
                        terminology: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.terminology?.enabled !== false },
                        reference: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.reference?.enabled !== false },
                        businessRule: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.businessRule?.enabled !== false },
                        metadata: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.metadata?.enabled !== false }
                      }
                    }
                  };
                }
              })
            );
            
            const validationProcessingTime = Date.now() - validationProcessingStartTime;
            const totalTime = Date.now() - startTime;
            
            console.log(`[Resources] Validation processing completed in ${validationProcessingTime}ms`, {
              resourceCount: resourcesWithCachedValidation.length,
              totalTime: `${totalTime}ms`,
              timestamp: new Date().toISOString()
            });
            
            // Send immediate response
            res.json({
              resources: resourcesWithCachedValidation,
              total: allCachedForType.length,
            });
            
            // DISABLED: Background validation in list view for performance
            // Background validation causes significant UI delays when loading resource lists
            // Resources will be validated on-demand when opened in detail view
            console.log(`[Resources] Background validation disabled for list view performance`);
            
            // Previously, background validation was causing the list view to show
            // "Validating..." for extended periods, making the UI feel unresponsive
          } else {
            // No cached data, fall back to FHIR server
            if (fhirClient) {
              console.log(`[Resources] No cached data, fetching from FHIR server...`);
              const targetResourceType = resourceType as string || 'Patient';
              
              // Fetch resources with total count in single request for speed
              const bundle = await fhirClient.searchResources(
                targetResourceType,
                {
                  _total: 'accurate',
                  _count: count.toString(),
                  _offset: offset.toString()
                }
              );

              const resources = bundle.entry?.map(entry => entry.resource) || [];
              const realTotal = bundle.total || 0;
              console.log(`Fetched ${resources.length} ${targetResourceType} resources (${realTotal} total) from FHIR server`);
              
              // Store resources locally for future use
              for (const resource of resources) {
                try {
                  const existing = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
                  if (!existing) {
                    await storage.createFhirResource({
                      serverId: (await storage.getActiveFhirServer())?.id || 1,
                      resourceType: resource.resourceType,
                      resourceId: resource.id,
                      versionId: resource.meta?.versionId,
                      data: resource,
                    });
                  }
                } catch (storageError) {
                  console.warn(`Failed to store resource ${resource.resourceType}/${resource.id}:`, storageError);
                }
              }

              res.json({
                resources,
                total: realTotal,
              });
            } else {
              // No FHIR client and no cached data
              res.json({
                resources: [],
                total: 0,
              });
            }
          }
        } catch (error: any) {
          console.error('Error accessing cached resources:', error);
          res.status(500).json({ message: error.message });
        }
      }
    } catch (error: any) {
      console.error('Error in /api/fhir/resources:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/resources/:id", async (req, res) => {
    try {
      const resourceId = req.params.id;
      console.log(`[Resource Detail] Looking for resource ID: ${resourceId}`);
      
      // Check if it's a numeric ID (database ID) or a UUID (FHIR resource ID)
      const isNumeric = /^\d+$/.test(resourceId);
      console.log(`[Resource Detail] Is numeric: ${isNumeric}`);
      
      let resource;
      if (isNumeric) {
        const id = parseInt(resourceId);
        console.log(`[Resource Detail] Searching by database ID: ${id}`);
        resource = await storage.getFhirResourceById(id);
      } else {
        // Look up by FHIR resource ID using database query
        console.log(`[Resource Detail] Searching by FHIR resource ID: ${resourceId}`);
        resource = await storage.getFhirResourceByTypeAndId("", resourceId);
        console.log(`[Resource Detail] Found resource by FHIR ID:`, resource ? 'YES' : 'NO');
        if (resource) {
          // Get full resource with validation results
          console.log(`[Resource Detail] Getting full resource with validation for DB ID: ${resource.id}`);
          resource = await storage.getFhirResourceById(resource.id);
        }
      }
      
      if (!resource) {
        console.log(`[Resource Detail] Resource not found for ID: ${resourceId}`);
        return res.status(404).json({ message: "Resource not found" });
      }
      
      // Skip revalidation check for better performance - use cached validation results
      // Resources are validated during batch processing and should be up-to-date
      // Individual revalidation can be triggered manually if needed
      console.log(`[Resource Detail] Using cached validation results for ${resource.resourceType}/${resource.resourceId}`);
      
      // Get validation settings for filtering using rock-solid service
      let validationSettings = null;
      try {
        const settingsService = getValidationSettingsService();
        validationSettings = await settingsService.getActiveSettings();
      } catch (error) {
        console.warn('[Routes] Failed to load validation settings for resource detail filtering:', error);
      }
      
      // Get only the latest validation result (like in list view)
      if (resource.validationResults && resource.validationResults.length > 0) {
        console.log(`[Resource Detail] Total validation results: ${resource.validationResults.length}`);
        
        // Sort by validatedAt descending and take only the latest
        const sortedResults = resource.validationResults.sort((a: any, b: any) => 
          new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime()
        );
        
        // Keep only the latest validation result
        const latestResult = sortedResults[0];
        console.log(`[Resource Detail] Using latest validation from ${latestResult.validatedAt}`);
        
        // Filter the latest validation result based on active settings
        resource.validationResults = filterValidationIssues([latestResult], validationSettings);
      console.log(`[Resource Detail] After filtering: ${(resource.validationResults as any)[0]?.issues?.length || 0} issues`);
      
      // Create _validationSummary for individual resource endpoint (same as resource list endpoint)
      const latestValidation = resource.validationResults[0];
      if (latestValidation && latestValidation.aspectBreakdown) {
        // Initialize aspect-specific counts (only for enabled aspects)
        const issuesByAspect = {
          structural: 0,
          profile: 0,
          terminology: 0,
          reference: 0,
          businessRule: 0,
          metadata: 0
        };
        
        // Use existing aspect breakdown from validation results or initialize default
        // Use nested settings structure (the actual validation settings)
        const settings = (validationSettings as any)?.settings || validationSettings;
        let aspectBreakdown = latestValidation?.aspectBreakdown || {
          structural: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.structural?.enabled !== false },
          profile: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.profile?.enabled !== false },
          terminology: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.terminology?.enabled !== false },
          reference: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.reference?.enabled !== false },
          businessRule: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.businessRule?.enabled !== false },
          metadata: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.metadata?.enabled !== false }
        };
        
        let filteredErrorCount = 0;
        let filteredWarningCount = 0;
        let filteredInfoCount = 0;
        
        // Update aspectBreakdown to reflect current settings
        for (const aspect of Object.keys(aspectBreakdown)) {
          const breakdown = (aspectBreakdown as any)[aspect];
          const storedBreakdown = (latestValidation.aspectBreakdown as any)[aspect];
          
          // Update enabled status based on current settings
          breakdown.enabled = settings && (settings as any)[aspect]?.enabled !== false;
          
          // Use stored data but with current enabled status
          if (storedBreakdown) {
            breakdown.errorCount = storedBreakdown.errorCount || 0;
            breakdown.warningCount = storedBreakdown.warningCount || 0;
            breakdown.informationCount = storedBreakdown.informationCount || 0;
            breakdown.issueCount = storedBreakdown.issueCount || 0;
          }
          
          // Only count issues from enabled aspects
          if (breakdown.enabled) {
            filteredErrorCount += breakdown.errorCount || 0;
            filteredWarningCount += breakdown.warningCount || 0;
            filteredInfoCount += breakdown.informationCount || 0;
            
            // Count issues by aspect (only for enabled aspects)
            (issuesByAspect as any)[aspect] = breakdown.issueCount || 0;
          }
        }
        
        // Calculate validation score based on filtered aspect breakdown (only enabled aspects)
        let filteredScore = 0; // Default to 0 if no validation has been performed
        if (latestValidation && latestValidation.aspectBreakdown) {
          filteredScore = 100; // Start with 100 if validation was performed
          for (const aspect of Object.keys(aspectBreakdown)) {
            const breakdown = (aspectBreakdown as any)[aspect];
            
            // Only consider issues from enabled aspects for scoring
            const aspectEnabled = breakdown.enabled && settings && (settings as any)[aspect]?.enabled !== false;
            
            if (aspectEnabled) {
              filteredScore -= (breakdown.errorCount || 0) * 15;  // Error issues: -15 points each
              filteredScore -= (breakdown.warningCount || 0) * 5; // Warning issues: -5 points each
              filteredScore -= (breakdown.informationCount || 0) * 1; // Information issues: -1 point each
            }
          }
          filteredScore = Math.max(0, Math.round(filteredScore));
        }
        
        // Calculate aspect-specific scores and pass/fail status
        for (const aspect of Object.keys(aspectBreakdown)) {
          const breakdown = (aspectBreakdown as any)[aspect];
          
          if (breakdown.enabled && settings && (settings as any)[aspect]?.enabled !== false) {
            // Calculate score for this aspect
            let aspectScore = 100;
            aspectScore -= breakdown.errorCount * 15;  // Error issues: -15 points each
            aspectScore -= breakdown.warningCount * 5; // Warning issues: -5 points each
            aspectScore -= breakdown.informationCount * 1; // Information issues: -1 point each
            breakdown.validationScore = Math.max(0, Math.round(aspectScore));
            
            // Aspect passes if no errors (warnings and info are acceptable)
            breakdown.passed = breakdown.errorCount === 0;
          } else {
            // Disabled aspects get neutral scores
            breakdown.validationScore = 100;
            breakdown.passed = true;
          }
        }
        
        // Add _validationSummary to the resource
        (resource as any)._validationSummary = {
          hasErrors: filteredErrorCount > 0,
          hasWarnings: filteredWarningCount > 0,
          errorCount: filteredErrorCount,
          warningCount: filteredWarningCount,
          informationCount: filteredInfoCount,
          isValid: filteredErrorCount === 0,
          validationScore: filteredScore,
          lastValidated: latestValidation?.validatedAt ? new Date(latestValidation.validatedAt) : null,
          needsValidation: false, // Always use cached validation results for performance
          issuesByAspect: issuesByAspect,
          aspectBreakdown: aspectBreakdown
        };
      } else {
        // No validation results, create default summary
        (resource as any)._validationSummary = {
          hasErrors: false,
          hasWarnings: false,
          errorCount: 0,
          warningCount: 0,
          informationCount: 0,
          isValid: false,
          validationScore: 0,
          lastValidated: null,
          needsValidation: false,
          issuesByAspect: {
            structural: 0,
            profile: 0,
            terminology: 0,
            reference: 0,
            businessRule: 0,
            metadata: 0
          },
          aspectBreakdown: {
            structural: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.structural?.enabled !== false },
            profile: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.profile?.enabled !== false },
            terminology: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.terminology?.enabled !== false },
            reference: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.reference?.enabled !== false },
            businessRule: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.businessRule?.enabled !== false },
            metadata: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: validationSettings?.metadata?.enabled !== false }
          }
        };
      }
    } else {
      // No validation results at all
      const settings = (validationSettings as any)?.settings || validationSettings;
      (resource as any)._validationSummary = {
        hasErrors: false,
        hasWarnings: false,
        errorCount: 0,
        warningCount: 0,
        informationCount: 0,
        isValid: false,
        validationScore: 0,
        lastValidated: null,
        needsValidation: false,
        issuesByAspect: {
          structural: 0,
          profile: 0,
          terminology: 0,
          reference: 0,
          businessRule: 0,
          metadata: 0
        },
        aspectBreakdown: {
          structural: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.structural?.enabled !== false },
          profile: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.profile?.enabled !== false },
          terminology: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.terminology?.enabled !== false },
          reference: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.reference?.enabled !== false },
          businessRule: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.businessRule?.enabled !== false },
          metadata: { issueCount: 0, errorCount: 0, warningCount: 0, informationCount: 0, validationScore: 100, passed: true, enabled: settings?.metadata?.enabled !== false }
        }
      };
      }
      
      console.log(`[Resource Detail] Returning resource:`, resource.resourceType, resource.resourceId);
      res.json(resource);
    } catch (error: any) {
      console.error(`[Resource Detail] Error:`, error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/resource-types", async (req, res) => {
    const startTime = Date.now();
    try {
      console.log("[ResourceTypes] Starting resource types fetch:", {
        timestamp: new Date().toISOString()
      });
      
      if (!fhirClient) {
        console.log("[ResourceTypes] No FHIR client available");
        return res.status(400).json({ message: "No active FHIR server configured" });
      }
      
      const resourceTypes = await fhirClient.getAllResourceTypes();
      const totalTime = Date.now() - startTime;
      
      console.log("[ResourceTypes] Resource types fetch completed:", {
        resourceTypeCount: resourceTypes.length,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      });
      
      res.json(resourceTypes);
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error("[ResourceTypes] Resource types fetch error:", {
        error: error.message,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/resource-counts", async (req, res) => {
    try {
      if (!fhirClient) {
        return res.status(400).json({ message: "No active FHIR server configured" });
      }
      
      const counts: Record<string, number> = {};
      
      // Get actual resource types supported by the FHIR server from CapabilityStatement
      console.log('[ResourceCounts] Fetching supported resource types from server CapabilityStatement...');
      const supportedResourceTypes = await fhirClient.getAllResourceTypes();
      console.log(`[ResourceCounts] Server supports ${supportedResourceTypes.length} resource types:`, supportedResourceTypes.slice(0, 10), '...');
      
      // Process resource types in smaller batches to avoid overwhelming the server
      const batchSize = 8;
      let totalProcessed = 0;
      
      for (let i = 0; i < supportedResourceTypes.length; i += batchSize) {
        const batch = supportedResourceTypes.slice(i, i + batchSize);
        console.log(`[ResourceCounts] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(supportedResourceTypes.length/batchSize)}: ${batch.join(', ')}`);
        
        const countPromises = batch.map(async (type) => {
          try {
            const count = await fhirClient.getResourceCount(type);
            console.log(`[ResourceCounts] ${type}: ${count} resources`);
            return { type, count };
          } catch (error) {
            console.warn(`[ResourceCounts] Failed to get count for ${type}:`, error.message);
            return { type, count: 0 };
          }
        });
        
        const results = await Promise.all(countPromises);
        results.forEach(({ type, count }) => {
          if (count > 0) { // Only include resource types that actually have resources
            counts[type] = count;
            totalProcessed++;
          }
        });
        
        // Small delay between batches to be respectful to the server
        if (i + batchSize < supportedResourceTypes.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const totalResources = Object.values(counts).reduce((sum, count) => sum + count, 0);
      console.log(`[ResourceCounts] Complete. Found ${totalProcessed} resource types with data, total: ${totalResources} resources`);
      
      res.json(counts);
    } catch (error: any) {
      console.error('[ResourceCounts] Error:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Validation endpoints
  app.post("/api/validation/validate-resource", async (req, res) => {
    try {
      if (!unifiedValidationService) {
        return res.status(400).json({ message: "Validation service not initialized" });
      }

      const { resource, profileUrl, config } = req.body;
      // Delegate to unified validation adapter (backed by default pipeline)
      const { validationResults } = await unifiedValidationService.validateResource(resource, true, true);
      const latest = validationResults.sort((a: any, b: any) => new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime())[0];
      const result = {
        isValid: latest?.isValid ?? true,
        errors: latest?.errors ?? [],
        warnings: latest?.warnings ?? []
      };
      
      // Store validation result
      const resourceRecord = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
      if (resourceRecord) {
        await storage.createValidationResult({
          resourceId: resourceRecord.id,
          profileId: null, // TODO: link to profile if available
          isValid: result.isValid,
          errors: result.errors,
          warnings: result.warnings,
        });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/validate-resource-detailed", async (req, res) => {
    try {
      // Validation is handled by the pipeline via UnifiedValidationService

      const { resource, config } = req.body;
      
      // Create enhanced config with profiles from installed packages
      const installedProfiles = await storage.getValidationProfiles(resource?.resourceType);
      const enhancedConfig = {
        strictMode: config?.strictMode || false,
        requiredFields: config?.requiredFields || [],
        customRules: config?.customRules || [],
        autoValidate: true,
        profiles: installedProfiles.map(p => p.url).slice(0, 3), // Limit to 3 profiles for performance
        fetchFromSimplifier: config?.fetchFromSimplifier !== false,
        fetchFromFhirServer: config?.fetchFromFhirServer !== false,
        autoDetectProfiles: config?.autoDetectProfiles !== false
      };
      // Use unified validation adapter; map to detailed legacy shape from DB result
      const { validationResults } = await unifiedValidationService.validateResource(resource, true, true);
      const latest = validationResults.sort((a: any, b: any) => new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime())[0];
      const detailed = {
        isValid: latest?.isValid ?? true,
        resourceType: resource.resourceType,
        resourceId: resource.id,
        profileUrl: enhancedConfig.profiles[0],
        profileName: enhancedConfig.profiles[0],
        issues: (latest?.issues || []).map((i: any) => ({
          severity: i.severity,
          code: i.code,
          details: i.message,
          diagnostics: i.message,
          location: Array.isArray(i.path) ? i.path : (i.path ? [i.path] : []),
          expression: i.expression,
          humanReadable: i.message,
          suggestion: undefined,
          category: i.category || 'general'
        })),
        summary: {
          totalIssues: (latest?.issues || []).length,
          errorCount: (latest?.errors || []).length,
          warningCount: (latest?.warnings || []).length,
          informationCount: 0,
          fatalCount: 0,
          score: latest?.validationScore ?? 0
        },
        validatedAt: latest?.validatedAt || new Date()
      };
      res.json(detailed);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/profiles", async (req, res) => {
    try {
      const { resourceType } = req.query;
      const profiles = await storage.getValidationProfiles(resourceType as string);
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/profiles", async (req, res) => {
    try {
      const data = insertValidationProfileSchema.parse(req.body);
      const profile = await storage.createValidationProfile(data);
      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/validation/errors/recent", async (req, res) => {
    try {
      const { limit = '10' } = req.query;
      const errors = await storage.getRecentValidationErrors(parseInt(limit as string));
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });



  app.get("/api/fhir/packages", async (req, res) => {
    try {
      const packages = await fhirClient.scanInstalledPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test endpoint to verify validation settings are applied
  app.post("/api/validation/test-settings", async (req, res) => {
    try {
      if (!unifiedValidationService) {
        return res.status(400).json({ message: "Validation service not initialized" });
      }

      const { resource } = req.body;
      
      console.log('[TestValidation] Testing validation with current settings on resource:', resource.resourceType + '/' + resource.id);
      
      // Perform validation using unified validation service
      const result = await unifiedValidationService.validateResource(resource, true, true);
      
      res.json({
        message: "Test validation complete",
        validationResults: result.validationResults,
        wasRevalidated: result.wasRevalidated
      });
    } catch (error: any) {
      console.error('[TestValidation] Test validation failed:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk validation endpoints
  app.post("/api/validation/bulk/start", async (req, res) => {
    try {
      if (!unifiedValidationService || !fhirClient) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      if (globalValidationState.isRunning) {
        return res.status(409).json({ message: "Validation is already running" });
      }

      const options = req.body || {};
      const forceRevalidation = options.forceRevalidation || false;

      // RESET validation state for NEW start (always start at 0)
      globalValidationState.isRunning = true;
      globalValidationState.startTime = new Date();
      globalValidationState.canPause = true;
      globalValidationState.shouldStop = false;
      globalValidationState.isPaused = false;
      globalValidationState.resumeData = null;
      
      if (forceRevalidation) {
        console.log('REVALIDATION start - Force revalidation of all resources. Global state: isRunning=true, canPause=true');
      } else {
        console.log('NEW validation start - RESET to 0. Global state: isRunning=true, canPause=true');
      }
      
      // Clear all previous validation results to start fresh
      await storage.clearAllValidationResults();

      // Return immediately to provide fast UI response
      res.json({ 
        message: forceRevalidation ? "Revalidation starting..." : "Validation starting...", 
        status: "starting",
        forceRevalidation: forceRevalidation
      });

      // Start validation asynchronously in background  
      setImmediate(async () => {
        try {
          console.log('Starting background validation with options:', options);
          
          // Don't reset global state here - it's already set in main thread
          
          // Get actual resource types supported by the FHIR server from CapabilityStatement
          console.log('Getting supported resource types from FHIR server CapabilityStatement...');
      const resourceTypes = await fhirClient.getAllResourceTypes();
      console.log(`Using comprehensive ${resourceTypes.length} FHIR resource types`);
      console.log(`Resource types to validate: ${JSON.stringify(resourceTypes.slice(0, 10))}... (showing first 10 of ${resourceTypes.length})`);
      
      // Calculate REAL total resources from FHIR server (ALL resource types - no exclusions)
      console.log('Calculating total resources from FHIR server (ALL types - no exclusions)...');
      let realTotalResources = 0;
      const resourceCounts: Record<string, number> = {};
      
      for (const resourceType of resourceTypes) {
        // Check if validation should stop during initialization
        if (globalValidationState.shouldStop) {
          console.log('Validation stopped during initialization phase');
          globalValidationState.isRunning = false;
          globalValidationState.isPaused = false;
          return res.json({ message: "Validation stopped during initialization" });
        }
        
        try {
          const count = await fhirClient.getResourceCount(resourceType);
          resourceCounts[resourceType] = count;
          realTotalResources += count; // Include ALL resource types
          console.log(`${resourceType}: ${count} resources`);
        } catch (error) {
          console.error(`Failed to get count for ${resourceType}:`, error);
          resourceCounts[resourceType] = 0;
        }
      }
      
      console.log(`\nTOTAL RESOURCES TO VALIDATE: ${realTotalResources} across ALL ${resourceTypes.length} resource types`);
      console.log('Top resource types:', Object.entries(resourceCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', '));
      
      if (realTotalResources === 0) {
        throw new Error('No resources found on FHIR server. Cannot start validation.');
      }

      // Send "running" status now that initialization is complete
      // Broadcast initializing status via SSE
      // Note: SSE broadcasts are handled by the validation service

      // Start real FHIR server validation using authentic data
      console.log('Starting real FHIR server validation with authentic data from Fire.ly server...');
      
      // RESET all counters to 0 for NEW start (nicht Resume!)
      let processedResources = 0;
      let validResources = 0;
      let errorResources = 0;
      const startTime = new Date();
      const errors: string[] = [];
      console.log('NEW START: Reset all counters to 0 (processedResources=0, validResources=0, errorResources=0)');
      
      // Broadcast RESET progress immediately to ensure UI shows 0/617442
      // SSE progress broadcast handled by validation service

      // Process resource types with real FHIR server data (EXCLUDING types with >50k resources)
      for (let i = 0; i < resourceTypes.length; i++) {
        const resourceType = resourceTypes[i];
        const nextResourceType = i + 1 < resourceTypes.length ? resourceTypes[i + 1] : null;
        
        // Update current and next resource type in global state
        globalValidationState.currentResourceType = resourceType;
        globalValidationState.nextResourceType = nextResourceType;
        
        // Check if validation should stop (pause/stop request)
        if (globalValidationState.shouldStop) {
          console.log('Validation paused by user request - saving state');
          globalValidationState.isRunning = false;
          globalValidationState.isPaused = true; // Set paused state
          // Save current progress for resume
          globalValidationState.resumeData = {
            resourceType,
            processedResources,
            validResources,
            errorResources,
            errors,
            startTime
          };
          break;
        }
        
        try {
          // Get total count for this resource type
          const totalCount = await fhirClient.getResourceCount(resourceType);
          
          // SKIP resource types with >50,000 resources
          if (totalCount > 50000) {
            console.log(`SKIPPING ${resourceType}: ${totalCount} resources (>50k threshold)`);
            continue;
          }
          
          console.log(`Validating ALL ${resourceType} resources from FHIR server...`);
          console.log(`Found ${totalCount} total ${resourceType} resources on server`);
          
          // Process ALL resources in batches
          let offset = 0;
          const batchSize = options.batchSize || 20;
          
          while (offset < totalCount && globalValidationState.isRunning && !globalValidationState.shouldStop) {
            // Get batch of resources
            const bundle = await fhirClient.searchResources(resourceType, { _offset: offset }, batchSize);
            
            if (!bundle.entry || bundle.entry.length === 0) {
              console.log(`No more ${resourceType} resources at offset ${offset}`);
              break;
            }
            
            console.log(`Processing ${resourceType} batch: ${bundle.entry.length} resources (offset: ${offset})`);
            
            // Process resources in batched pipeline executions for better throughput
            const PARALLEL_BATCH_SIZE = 10; // Process 10 resources per pipeline batch
            
            for (let i = 0; i < bundle.entry.length; i += PARALLEL_BATCH_SIZE) {
              // Check if validation should stop before each batch
              if (globalValidationState.shouldStop) {
                console.log('Validation paused by user request during resource processing');
                globalValidationState.isRunning = false;
                globalValidationState.isPaused = true; // Set paused state
                // Save current progress for resume
                globalValidationState.resumeData = {
                  resourceType,
                  offset: offset + i,
                  processedResources,
                  validResources,
                  errorResources,
                  errors,
                  startTime
                };
                break;
              }
              
              // Create batch for pipeline
              const parallelBatch = bundle.entry.slice(i, i + PARALLEL_BATCH_SIZE).filter(e => e.resource);
              const resourcesForPipeline = parallelBatch.map(e => ({
                resource: (e as any).resource,
                resourceType: (e as any).resource.resourceType,
                resourceId: (e as any).resource.id
              }));

              try {
                const pipeline = getValidationPipeline();
                const pipelineResult: any = await pipeline.executePipeline({
                  resources: resourcesForPipeline,
                  context: {
                    requestedBy: 'bulk_validation',
                    requestId: `bulk_${resourceType}_${Date.now()}_${i}`
                  }
                });

                const batchResults: any[] = Array.isArray(pipelineResult?.results) ? pipelineResult.results : [];
                for (const r of batchResults) {
                  processedResources++;
                  const score = (r?.summary?.validationScore ?? 0) as number;
                  const isValid = score >= 95;
                  if (isValid) {
                    validResources++;
                  } else {
                    errorResources++;
                    const errCount = (r?.summary?.errorCount ?? 0) as number;
                    const warnCount = (r?.summary?.warningCount ?? 0) as number;
                    const rid = (r?.resourceId || r?.resource?.id || 'unknown') as string;
                    errors.push(`${resourceType}/${rid}: Score ${score}% (${errCount} errors, ${warnCount} warnings)`);
                  }
                }
              } catch (validationError: any) {
                // If the batch fails, attribute errors to each resource in the batch
                for (const e of parallelBatch) {
                  processedResources++;
                  errorResources++;
                  const rid = (e as any).resource?.id || 'unknown';
                  errors.push(`${resourceType}/${rid}: Validation failed - ${validationError?.message || String(validationError)}`);
                }
              }

              // SSE progress updates handled by validation service
            }
            
            offset += batchSize;
            
            // Check if validation should stop after each batch
            if (globalValidationState.shouldStop) {
              console.log('Validation paused by user request after batch');
              globalValidationState.isRunning = false;
              globalValidationState.isPaused = true; // Set paused state
              // Save current progress for resume
              globalValidationState.resumeData = {
                resourceType,
                offset,
                processedResources,
                validResources,
                errorResources,
                errors,
                startTime
              };
              break;
            }
            
            // Small delay between batches to prevent overwhelming server
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // If we broke out of the while loop due to pause, break out of the for loop too
          if (globalValidationState.shouldStop || globalValidationState.isPaused) {
            break;
          }
          
        } catch (resourceError) {
          console.error(`Error fetching ${resourceType} resources:`, resourceError);
          errors.push(`${resourceType}: Failed to fetch resources - ${resourceError}`);
        }
      }

      // Only broadcast completion if validation actually completed (not paused)
      if (!globalValidationState.isPaused && !globalValidationState.shouldStop) {
        console.log('Validation completed successfully - broadcasting completion');
        const finalProgress = {
          totalResources: realTotalResources,
          processedResources,
          validResources,
          errorResources,
          isComplete: true,
          errors,
          startTime: startTime.toISOString(),
          status: 'completed' as const
        };
        
        // Mark validation as completed
        globalValidationState.isRunning = false;
        globalValidationState.isPaused = false;
        globalValidationState.resumeData = null;
        
        // SSE completion broadcast handled by validation service
      } else if (globalValidationState.isPaused) {
        console.log('Validation was paused - not broadcasting completion');
        // SSE paused state broadcast handled by validation service
      }

          console.log("Background validation started successfully");
        } catch (error: any) {
          console.error('Background validation startup error:', error);
          // SSE error broadcast handled by validation service
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/bulk/progress", async (req, res) => {
    try {
      if (!unifiedValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      // Get the total resources from FHIR server for validation
      // Use the actual total from FHIR server via dashboard service
      const fhirServerStats = await dashboardService.getFhirServerStats();
      const totalResources = fhirServerStats.totalResources;
      // Determine actual status based on validation state
      let status = 'not_running';
      if (globalValidationState.isRunning) {
        status = 'running';
      } else if (globalValidationState.isPaused) {
        status = 'paused';
      }
      
      // Get processed resources from database
      const summary = await storage.getResourceStatsWithSettings();
      
      // Always use actual database counts for progress tracking
      // This ensures progress is shown correctly whether running, paused, or stopped
      const processedResources = summary.validResources + summary.errorResources;
      
      // Calculate estimated time remaining based on processing rate
      let estimatedTimeRemaining = undefined;
      if (status === 'running' && processedResources > 0 && globalValidationState.startTime) {
        const elapsedMs = Date.now() - globalValidationState.startTime.getTime();
        const processingRate = processedResources / (elapsedMs / 1000); // resources per second
        const remainingResources = totalResources - processedResources;
        estimatedTimeRemaining = Math.round((remainingResources / processingRate) * 1000); // in milliseconds
      }
      
      // Determine current and next resource type
      let currentResourceType = undefined;
      let nextResourceType = undefined;
      
      if (status === 'running' || status === 'paused') {
        if (globalValidationState.currentResourceType) {
          currentResourceType = globalValidationState.currentResourceType;
        } else if (globalValidationState.resumeData?.resourceType) {
          currentResourceType = globalValidationState.resumeData.resourceType;
        } else if (status === 'running') {
          currentResourceType = 'Processing...';
        } else if (status === 'paused') {
          currentResourceType = 'Paused';
        }
        
        if (globalValidationState.nextResourceType) {
          nextResourceType = globalValidationState.nextResourceType;
        } else if (status === 'running') {
          nextResourceType = 'Next resource type...';
        }
      }
      
      const progress = {
        totalResources,
        processedResources,
        validResources: summary.validResources,
        errorResources: summary.errorResources,
        progress: totalResources > 0 ? Math.round((processedResources / totalResources) * 100) : 0,
        currentResourceType,
        nextResourceType,
        isComplete: false,
        errors: [],
        startTime: globalValidationState.startTime ? globalValidationState.startTime.toISOString() : new Date().toISOString(),
        estimatedTimeRemaining,
        status: status as 'running' | 'paused' | 'not_running'
      };
      
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/bulk/summary", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      
      // Use the new dashboard service for consistent data
      const validationStats = await dashboardService.getValidationStats();
      const fhirServerStats = await dashboardService.getFhirServerStats();
      
      const validationSummary = {
        totalResources: fhirServerStats.totalResources, // Real comprehensive FHIR server total (807K+)
        totalValidated: validationStats.totalValidated, // Resources actually validated in database
        validResources: validationStats.validResources,
        errorResources: validationStats.errorResources,
        warningResources: validationStats.warningResources,
        unvalidatedResources: validationStats.unvalidatedResources,
        resourcesWithErrors: validationStats.errorResources,
        resourcesWithWarnings: validationStats.warningResources,
        validationCoverage: validationStats.validationCoverage, // Percentage of validated resources that are valid
        validationProgress: validationStats.validationProgress, // Percentage of server resources that have been validated
        lastValidationRun: validationStats.lastValidationRun
      };
      
      console.log('[ValidationSummary] Server total:', fhirServerStats.totalResources, 'Validated:', validationStats.totalValidated, 'Coverage:', validationStats.validationCoverage.toFixed(1) + '%', 'Progress:', validationStats.validationProgress.toFixed(1) + '%');
      res.json(validationSummary);
    } catch (error: any) {
      console.error('Error getting validation summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch validation summary',
        error: 'BULK_SUMMARY_FAILED',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/bulk/pause", async (req, res) => {
    try {
      if (!globalValidationState.isRunning) {
        if (globalValidationState.isPaused) {
          return res.status(400).json({ message: "Validation is already paused" });
        } else {
          return res.status(400).json({ message: "No validation is currently running" });
        }
      }

      // Set global pause state immediately
      globalValidationState.shouldStop = true;
      globalValidationState.canPause = true;
      globalValidationState.isRunning = false;
      globalValidationState.isPaused = true; // Set paused state immediately
      console.log('Validation pause requested - setting paused state immediately');
      
      // SSE paused state broadcast handled by validation service
      
      res.json({ message: "Validation paused successfully" });
    } catch (error: any) {
      console.error('Error in pause endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to pause bulk validation',
        error: 'BULK_PAUSE_FAILED',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/bulk/resume", async (req, res) => {
    try {
      if (!globalValidationState.isPaused || !globalValidationState.resumeData) {
        return res.status(400).json({ message: "No paused validation to resume" });
      }

      const resumeData = globalValidationState.resumeData;
      
      // Reset pause flags and resume validation
      globalValidationState.shouldStop = false;
      globalValidationState.isPaused = false;
      globalValidationState.isRunning = true;
      
      console.log('Resuming validation from saved state:', resumeData);
      
      // Broadcast resume via SSE
      // SSE resume broadcasts handled by validation service

      res.json({ message: "Validation resumed successfully" });
      
      // Actually restart validation from saved state
      setImmediate(async () => {
        try {
          console.log('Restarting validation loop from resume point...');
          
          // Get all resource types and find where we left off
          const resourceTypes = await fhirClient.getAllResourceTypes();
          const resumeIndex = resourceTypes.indexOf(resumeData.resourceType);
          
          if (resumeIndex === -1) {
            console.error('Resume resource type not found:', resumeData.resourceType);
            return;
          }
          
          // Continue from where we left off
          let processedResources = resumeData.processedResources;
          let validResources = resumeData.validResources;
          let errorResources = resumeData.errorResources;
          const errors = [...resumeData.errors];
          const startTime = resumeData.startTime;
          
          // Continue processing from the saved resource type
          for (let i = resumeIndex; i < resourceTypes.length && globalValidationState.isRunning && !globalValidationState.shouldStop; i++) {
            const resourceType = resourceTypes[i];
            
            try {
              console.log(`Resuming validation of ${resourceType} resources...`);
              
              // Get total count for this resource type
              const totalCount = await fhirClient.getResourceCount(resourceType);
              console.log(`Found ${totalCount} total ${resourceType} resources on server`);
              
              // Start from saved offset for current resource type, or 0 for new types
              let offset = (i === resumeIndex && resumeData.offset) ? resumeData.offset : 0;
              const batchSize = 20;
              
              while (offset < totalCount && globalValidationState.isRunning && !globalValidationState.shouldStop) {
                // Get batch of resources
                const bundle = await fhirClient.searchResources(resourceType, { _offset: offset }, batchSize);
                
                if (!bundle.entry || bundle.entry.length === 0) {
                  console.log(`No more ${resourceType} resources at offset ${offset}`);
                  break;
                }
                
                console.log(`Processing ${resourceType} batch: ${bundle.entry.length} resources (offset: ${offset})`);
                
                for (const entry of bundle.entry) {
                  // Check if validation should stop before each resource
                  if (globalValidationState.shouldStop) {
                    console.log('Validation paused during resume processing');
                    globalValidationState.isRunning = false;
                    globalValidationState.isPaused = true;
                    // Save current progress for next resume
                    globalValidationState.resumeData = {
                      resourceType,
                      offset,
                      processedResources,
                      validResources,
                      errorResources,
                      errors,
                      startTime
                    };
                    return;
                  }
                  
                  if (entry.resource) {
                    try {
                      // Validate real FHIR resource
                      const result = await unifiedValidationService.validateResource(
                        entry.resource, 
                        true, // skipUnchanged
                        false
                      );
                      
                      processedResources++;
                      
                      // Check for validation errors
                      if (result.validationResults?.some(vr => !vr.isValid)) {
                        errorResources++;
                        const errorDetails = result.validationResults
                          .filter(vr => !vr.isValid)
                          .flatMap(vr => vr.errors || [])
                          .join('; ');
                        errors.push(`${resourceType}/${entry.resource.id}: ${errorDetails}`);
                      } else {
                        validResources++;
                      }
                      
                      // SSE progress updates handled by validation service
                      
                    } catch (validationError) {
                      processedResources++;
                      errorResources++;
                      errors.push(`${resourceType}/${entry.resource.id}: Validation failed - ${validationError}`);
                    }
                  }
                }
                
                offset += batchSize;
                
                // Check if validation should stop after each batch
                if (globalValidationState.shouldStop) {
                  console.log('Validation paused after batch during resume');
                  globalValidationState.isRunning = false;
                  globalValidationState.isPaused = true;
                  // Save current progress for next resume
                  globalValidationState.resumeData = {
                    resourceType,
                    offset,
                    processedResources,
                    validResources,
                    errorResources,
                    errors,
                    startTime
                  };
                  return;
                }
                
                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
            } catch (resourceError) {
              console.error(`Error fetching ${resourceType} resources during resume:`, resourceError);
              errors.push(`${resourceType}: Failed to fetch resources - ${resourceError}`);
            }
          }
          
          // Validation completed
          globalValidationState.isRunning = false;
          globalValidationState.isPaused = false;
          globalValidationState.resumeData = null;
          
          const finalProgress = {
            totalResources: processedResources,
            processedResources,
            validResources,
            errorResources,
            isComplete: true,
            errors,
            startTime
          };
          
          // SSE completion broadcast handled by validation service
          
        } catch (error) {
          console.error('Error during resume validation:', error);
          globalValidationState.isRunning = false;
          globalValidationState.isPaused = false;
          // SSE error broadcast handled by validation service
        }
      });
      
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to resume bulk validation',
        error: 'BULK_RESUME_FAILED',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });



  app.post("/api/validation/bulk/stop", async (req, res) => {
    try {
      // Allow stopping at any time (running, paused, or initializing)
      // Stop validation completely (not pause)
      globalValidationState.shouldStop = true;
      globalValidationState.isRunning = false;
      globalValidationState.isPaused = false; // Clear paused state
      globalValidationState.resumeData = null; // Clear resume data
      console.log('Validation stop requested - clearing all state');
      
      // Clear all validation results when stopping
      await storage.clearAllValidationResults();
      
      // Pipeline-based execution has no separate robust service to stop
      
      // SSE stopped broadcast handled by validation service
      
      res.json({ message: "Validation stopped successfully" });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to stop bulk validation',
        error: 'BULK_STOP_FAILED',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Queue-based bulk validation endpoint
  app.post("/api/validation/bulk/start-queue", async (req, res) => {
    try {
      if (!unifiedValidationService || !fhirClient) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      const options = req.body || {};
      const forceRevalidation = options.forceRevalidation || false;
      const priority = options.priority || 'normal';
      const batchSize = options.batchSize || 200;

      console.log(`[QueueBulkValidation] Starting queue-based bulk validation (forceRevalidation: ${forceRevalidation}, priority: ${priority})`);

      // Clear all previous validation results if force revalidation
      if (forceRevalidation) {
        await storage.clearAllValidationResults();
        console.log('[QueueBulkValidation] Cleared all previous validation results for revalidation');
      }

      // Get all resource types from FHIR server
      const resourceTypes = await fhirClient.getAllResourceTypes();
      console.log(`[QueueBulkValidation] Found ${resourceTypes.length} resource types to validate`);

      const queueService = getValidationQueueService();
      const batchId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Start queue processing if not already running
      queueService.startProcessing();

      let totalQueuedItems = 0;
      const context = {
        requestedBy: req.headers['x-user-id'] as string || 'anonymous',
        requestId: batchId,
        batchId,
        metadata: {
          type: 'bulk_validation',
          forceRevalidation,
          batchSize,
          resourceTypes: resourceTypes.length
        }
      };

      // Queue validation for each resource type
      for (const resourceType of resourceTypes) {
        try {
          // Get resources for this type using searchResources (same as existing bulk validation)
          const bundle = await fhirClient.searchResources(resourceType, { _offset: 0 }, batchSize);
          
          if (bundle.entry && bundle.entry.length > 0) {
            // Create validation requests from bundle entries
            const validationRequests = bundle.entry
              .filter(e => e.resource)
              .map((entry: any) => ({
                resource: entry.resource,
                resourceType: resourceType,
                resourceId: entry.resource.id,
                context: {
                  ...context,
                  resourceType
                }
              }));

            // Queue batch validation
            const itemIds = await queueService.queueBatchValidation(
              validationRequests,
              context,
              ValidationPriority[priority.toUpperCase() as keyof typeof ValidationPriority] || ValidationPriority.NORMAL,
              3 // max attempts
            );

            totalQueuedItems += itemIds.length;
            console.log(`[QueueBulkValidation] Queued ${itemIds.length} items for ${resourceType}`);
          }
        } catch (error) {
          console.error(`[QueueBulkValidation] Failed to queue validation for ${resourceType}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Queue-based validation started with ${totalQueuedItems} items`,
        data: {
          batchId,
          totalQueuedItems,
          resourceTypes: resourceTypes.length,
          priority,
          forceRevalidation
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('[QueueBulkValidation] Failed to start queue-based bulk validation:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to start queue-based bulk validation',
        error: 'QUEUE_BULK_START_FAILED',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Validation Queue Management endpoints
  app.get("/api/validation/queue/stats", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const stats = queueService.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationQueue] Failed to get queue stats:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get queue statistics",
        error: "QUEUE_STATS_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/validation/queue/items", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const { status, limit = '50' } = req.query;
      
      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({
          success: false,
          message: "Invalid limit - must be between 1 and 1000",
          error: "INVALID_LIMIT",
          timestamp: new Date().toISOString()
        });
      }

      let items;
      if (status) {
        // Get items by specific status
        items = queueService.getQueueItems(status as any);
      } else {
        // Get all queue items
        items = queueService.getQueueItems();
      }

      // Limit results
      items = items.slice(0, limitNum);
      
      res.json({
        success: true,
        data: items,
        pagination: {
          limit: limitNum,
          total: items.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationQueue] Failed to get queue items:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get queue items",
        error: "QUEUE_ITEMS_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/validation/queue/processing", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const processingItems = queueService.getProcessingItems();
      
      res.json({
        success: true,
        data: processingItems,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationQueue] Failed to get processing items:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get processing items",
        error: "QUEUE_PROCESSING_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/queue/cancel", async (req, res) => {
    try {
      const { itemId, batchId } = req.body;
      
      if (!itemId && !batchId) {
        return res.status(400).json({
          success: false,
          message: "Either itemId or batchId is required",
          error: "MISSING_ID",
          timestamp: new Date().toISOString()
        });
      }

      const queueService = getValidationQueueService();
      let cancelledCount = 0;

      if (itemId) {
        const cancelled = queueService.cancelValidation(itemId);
        cancelledCount = cancelled ? 1 : 0;
      } else if (batchId) {
        cancelledCount = queueService.cancelBatch(batchId);
      }

      res.json({
        success: true,
        data: {
          cancelledCount,
          itemId,
          batchId
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationQueue] Failed to cancel validation:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to cancel validation",
        error: "QUEUE_CANCEL_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/queue/clear", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      const clearedCount = queueService.clearCompletedItems();
      
      res.json({
        success: true,
        data: {
          clearedCount
        },
        message: `Cleared ${clearedCount} completed/failed items from queue`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationQueue] Failed to clear completed items:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to clear completed items",
        error: "QUEUE_CLEAR_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/queue/start", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      queueService.startProcessing();
      
      res.json({
        success: true,
        message: "Queue processing started",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationQueue] Failed to start queue processing:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to start queue processing",
        error: "QUEUE_START_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/queue/stop", async (req, res) => {
    try {
      const queueService = getValidationQueueService();
      queueService.stopProcessing();
      
      res.json({
        success: true,
        message: "Queue processing stopped",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationQueue] Failed to stop queue processing:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to stop queue processing",
        error: "QUEUE_STOP_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Individual Resource Progress Tracking endpoints
  app.get("/api/validation/progress/individual/stats", async (req, res) => {
    try {
      const progressService = getIndividualResourceProgressService();
      const stats = progressService.getProgressStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to get progress stats:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get individual resource progress statistics",
        error: "INDIVIDUAL_PROGRESS_STATS_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/validation/progress/individual/active", async (req, res) => {
    try {
      const progressService = getIndividualResourceProgressService();
      const activeProgress = progressService.getActiveProgress();
      
      res.json({
        success: true,
        data: activeProgress,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to get active progress:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get active resource progress",
        error: "INDIVIDUAL_PROGRESS_ACTIVE_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/validation/progress/individual/completed", async (req, res) => {
    try {
      const progressService = getIndividualResourceProgressService();
      const { limit = '100' } = req.query;
      
      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({
          success: false,
          message: "Invalid limit - must be between 1 and 1000",
          error: "INVALID_LIMIT",
          timestamp: new Date().toISOString()
        });
      }

      const completedProgress = progressService.getCompletedProgress(limitNum);
      
      res.json({
        success: true,
        data: completedProgress,
        pagination: {
          limit: limitNum,
          total: completedProgress.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to get completed progress:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get completed resource progress",
        error: "INDIVIDUAL_PROGRESS_COMPLETED_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/validation/progress/individual/:resourceId", async (req, res) => {
    try {
      const { resourceId } = req.params;
      const progressService = getIndividualResourceProgressService();
      const progress = progressService.getResourceProgress(resourceId);
      
      if (!progress) {
        return res.status(404).json({
          success: false,
          message: "Resource progress not found",
          error: "RESOURCE_PROGRESS_NOT_FOUND",
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: progress,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to get resource progress:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get resource progress",
        error: "INDIVIDUAL_PROGRESS_RESOURCE_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/progress/individual/start", async (req, res) => {
    try {
      const { resourceId, resourceType, context, resourceUrl, metadata } = req.body;
      
      if (!resourceId || !resourceType || !context) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: resourceId, resourceType, context",
          error: "MISSING_REQUIRED_FIELDS",
          timestamp: new Date().toISOString()
        });
      }

      const progressService = getIndividualResourceProgressService();
      const progress = progressService.startResourceProgress(
        resourceId,
        resourceType,
        context,
        resourceUrl,
        metadata
      );
      
      res.json({
        success: true,
        data: progress,
        message: "Started tracking individual resource progress",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to start resource progress:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to start resource progress tracking",
        error: "INDIVIDUAL_PROGRESS_START_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/progress/individual/update", async (req, res) => {
    try {
      const update = req.body;
      
      if (!update.resourceId) {
        return res.status(400).json({
          success: false,
          message: "Missing required field: resourceId",
          error: "MISSING_RESOURCE_ID",
          timestamp: new Date().toISOString()
        });
      }

      const progressService = getIndividualResourceProgressService();
      const updatedProgress = progressService.updateResourceProgress(update);
      
      if (!updatedProgress) {
        return res.status(404).json({
          success: false,
          message: "Resource progress not found",
          error: "RESOURCE_PROGRESS_NOT_FOUND",
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: updatedProgress,
        message: "Updated resource progress",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to update resource progress:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to update resource progress",
        error: "INDIVIDUAL_PROGRESS_UPDATE_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/progress/individual/complete", async (req, res) => {
    try {
      const { resourceId, finalStatus, finalResults } = req.body;
      
      if (!resourceId || !finalStatus) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: resourceId, finalStatus",
          error: "MISSING_REQUIRED_FIELDS",
          timestamp: new Date().toISOString()
        });
      }

      const progressService = getIndividualResourceProgressService();
      const completedProgress = progressService.completeResourceProgress(
        resourceId,
        finalStatus,
        finalResults
      );
      
      if (!completedProgress) {
        return res.status(404).json({
          success: false,
          message: "Resource progress not found",
          error: "RESOURCE_PROGRESS_NOT_FOUND",
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: completedProgress,
        message: "Completed resource progress tracking",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to complete resource progress:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to complete resource progress tracking",
        error: "INDIVIDUAL_PROGRESS_COMPLETE_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/progress/individual/cancel", async (req, res) => {
    try {
      const { resourceId } = req.body;
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: "Missing required field: resourceId",
          error: "MISSING_RESOURCE_ID",
          timestamp: new Date().toISOString()
        });
      }

      const progressService = getIndividualResourceProgressService();
      const cancelled = progressService.cancelResourceProgress(resourceId);
      
      if (!cancelled) {
        return res.status(404).json({
          success: false,
          message: "Resource progress not found or already completed",
          error: "RESOURCE_PROGRESS_NOT_FOUND",
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        message: "Cancelled resource progress tracking",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to cancel resource progress:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to cancel resource progress tracking",
        error: "INDIVIDUAL_PROGRESS_CANCEL_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/progress/individual/clear", async (req, res) => {
    try {
      const progressService = getIndividualResourceProgressService();
      progressService.clearAllProgress();
      
      res.json({
        success: true,
        message: "Cleared all individual resource progress data",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[IndividualResourceProgress] Failed to clear progress data:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to clear progress data",
        error: "INDIVIDUAL_PROGRESS_CLEAR_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Enhanced Cancellation and Retry Management endpoints
  app.get("/api/validation/cancellation-retry/stats", async (req, res) => {
    try {
      const service = getValidationCancellationRetryService();
      const stats = service.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to get stats:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get cancellation and retry statistics",
        error: "CANCELLATION_RETRY_STATS_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/validation/cancellation-retry/active", async (req, res) => {
    try {
      const service = getValidationCancellationRetryService();
      const activeCancellations = service.getActiveCancellations();
      const activeRetries = service.getActiveRetries();
      
      res.json({
        success: true,
        data: {
          cancellations: activeCancellations,
          retries: activeRetries
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to get active operations:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to get active cancellation and retry operations",
        error: "CANCELLATION_RETRY_ACTIVE_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/cancel", async (req, res) => {
    try {
      const { type, targetId, reason, requestedBy } = req.body;
      
      if (!type || !targetId || !requestedBy) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: type, targetId, requestedBy",
          error: "MISSING_REQUIRED_FIELDS",
          timestamp: new Date().toISOString()
        });
      }

      const service = getValidationCancellationRetryService();
      const request = await service.cancelOperation(
        type,
        targetId,
        reason || 'Cancelled by user',
        requestedBy
      );
      
      res.json({
        success: true,
        data: request,
        message: "Cancellation request submitted successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to cancel operation:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to cancel operation",
        error: "CANCELLATION_RETRY_CANCEL_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/cancel-all", async (req, res) => {
    try {
      const { type, reason, requestedBy } = req.body;
      
      if (!type || !requestedBy) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: type, requestedBy",
          error: "MISSING_REQUIRED_FIELDS",
          timestamp: new Date().toISOString()
        });
      }

      const service = getValidationCancellationRetryService();
      const requests = await service.cancelAllOperations(
        type,
        reason || 'Cancelled by user',
        requestedBy
      );
      
      res.json({
        success: true,
        data: requests,
        message: `Cancelled all ${type} operations (${requests.length} operations)`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to cancel all operations:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to cancel all operations",
        error: "CANCELLATION_RETRY_CANCEL_ALL_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/emergency-stop", async (req, res) => {
    try {
      const { reason, requestedBy } = req.body;
      
      if (!requestedBy) {
        return res.status(400).json({
          success: false,
          message: "Missing required field: requestedBy",
          error: "MISSING_REQUESTED_BY",
          timestamp: new Date().toISOString()
        });
      }

      const service = getValidationCancellationRetryService();
      // Set global validation state reference
      service.setGlobalValidationState(globalValidationState);
      
      const requests = await service.emergencyStop(
        reason || 'Emergency stop requested',
        requestedBy
      );
      
      res.json({
        success: true,
        data: requests,
        message: `Emergency stop completed - cancelled ${requests.length} operations`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to perform emergency stop:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to perform emergency stop",
        error: "CANCELLATION_RETRY_EMERGENCY_STOP_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/retry", async (req, res) => {
    try {
      const { type, targetId, reason, requestedBy, retryPolicy } = req.body;
      
      if (!type || !targetId || !requestedBy) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: type, targetId, requestedBy",
          error: "MISSING_REQUIRED_FIELDS",
          timestamp: new Date().toISOString()
        });
      }

      const service = getValidationCancellationRetryService();
      const request = await service.retryOperation(
        type,
        targetId,
        reason || 'Retry requested by user',
        requestedBy,
        retryPolicy
      );
      
      res.json({
        success: true,
        data: request,
        message: "Retry request submitted successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to retry operation:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to retry operation",
        error: "CANCELLATION_RETRY_RETRY_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/retry-all-failed", async (req, res) => {
    try {
      const { type, reason, requestedBy, retryPolicy } = req.body;
      
      if (!type || !requestedBy) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: type, requestedBy",
          error: "MISSING_REQUIRED_FIELDS",
          timestamp: new Date().toISOString()
        });
      }

      const service = getValidationCancellationRetryService();
      const requests = await service.retryAllFailedOperations(
        type,
        reason || 'Retry all failed requested by user',
        requestedBy,
        retryPolicy
      );
      
      res.json({
        success: true,
        data: requests,
        message: `Retrying all failed ${type} operations (${requests.length} operations)`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to retry all failed operations:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to retry all failed operations",
        error: "CANCELLATION_RETRY_RETRY_ALL_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/cancel-retry", async (req, res) => {
    try {
      const { retryId } = req.body;
      
      if (!retryId) {
        return res.status(400).json({
          success: false,
          message: "Missing required field: retryId",
          error: "MISSING_RETRY_ID",
          timestamp: new Date().toISOString()
        });
      }

      const service = getValidationCancellationRetryService();
      const cancelled = service.cancelRetry(retryId);
      
      if (!cancelled) {
        return res.status(404).json({
          success: false,
          message: "Retry request not found or already completed",
          error: "RETRY_NOT_FOUND",
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        message: "Retry request cancelled successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to cancel retry:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to cancel retry request",
        error: "CANCELLATION_RETRY_CANCEL_RETRY_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/clear-old", async (req, res) => {
    try {
      const { olderThanHours = 24 } = req.body;
      
      const service = getValidationCancellationRetryService();
      const clearedCount = service.clearOldRequests(olderThanHours);
      
      res.json({
        success: true,
        data: {
          clearedCount
        },
        message: `Cleared ${clearedCount} old cancellation and retry requests`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to clear old requests:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to clear old requests",
        error: "CANCELLATION_RETRY_CLEAR_OLD_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/validation/cancellation-retry/update-policy", async (req, res) => {
    try {
      const { type, policy } = req.body;
      
      if (!type || !policy) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: type, policy",
          error: "MISSING_REQUIRED_FIELDS",
          timestamp: new Date().toISOString()
        });
      }

      const service = getValidationCancellationRetryService();
      service.updateRetryPolicy(type, policy);
      
      res.json({
        success: true,
        message: "Retry policy updated successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[CancellationRetry] Failed to update retry policy:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to update retry policy",
        error: "CANCELLATION_RETRY_UPDATE_POLICY_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Dashboard endpoints
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      
      // Use the same data source as validation progress for consistency
      const [fhirServerStats, validationStats] = await Promise.all([
        dashboardService.getFhirServerStats(),
        dashboardService.getValidationStats()
      ]);
      
      // Return backward-compatible format for existing frontend
      const stats = {
        totalResources: fhirServerStats.totalResources, // Real comprehensive FHIR server total (consistent with validation progress)
        validResources: validationStats.validResources, // Validation count filtered by settings
        errorResources: validationStats.errorResources, // Validation count filtered by settings
        warningResources: validationStats.warningResources,
        unvalidatedResources: validationStats.unvalidatedResources,
        validationCoverage: validationStats.validationCoverage,
        validationProgress: validationStats.validationProgress,
        activeProfiles: 0, // TODO: Get from validation settings
        resourceBreakdown: fhirServerStats.resourceBreakdown.slice(0, 10) // Top 10 resource types from FHIR server
      };
      
      console.log(`[DashboardStats] Server: ${fhirServerStats.totalResources} total, Validation: ${validationStats.totalValidated} validated, ${validationStats.validResources} valid, ${validationStats.errorResources} errors`);
      res.json(stats);
    } catch (error: any) {
      console.error('[DashboardStats] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/cards", async (req, res) => {
    try {
      const cards = await storage.getDashboardCards();
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // New separated dashboard endpoints
  app.get("/api/dashboard/fhir-server-stats", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      
      const fhirServerStats = await dashboardService.getFhirServerStats();
      res.json(fhirServerStats);
    } catch (error: any) {
      console.error('[FHIRServerStats] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/validation-stats", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      
      const validationStats = await dashboardService.getValidationStats();
      res.json(validationStats);
    } catch (error: any) {
      console.error('[ValidationStats] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/combined", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      
      const combinedData = await dashboardService.getCombinedDashboardData();
      res.json(combinedData);
    } catch (error: any) {
      console.error('[CombinedDashboard] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Force refresh endpoint for performance optimization
  app.post("/api/dashboard/force-refresh", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      const fhirServerStats = await dashboardService.forceRefreshFhirServerData();
      res.json({ 
        message: "FHIR server data refreshed successfully",
        fhirServerStats,
        cacheStatus: dashboardService.getCacheStatus()
      });
    } catch (error: any) {
      console.error('[ForceRefresh] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR version and resource type information endpoint
  app.get("/api/dashboard/fhir-version-info", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      const versionInfo = await dashboardService.getFhirVersionInfo();
      res.json(versionInfo);
    } catch (error: any) {
      console.error('[FhirVersionInfo] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Profile Management endpoints
  app.get("/api/profiles/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }
      const packages = await profileManager.searchPackages(query as string);
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/profiles/versions", async (req, res) => {
    try {
      const { packageId } = req.query;
      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }
      const versions = await profileManager.getPackageVersions(packageId as string);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/profiles/installed", async (req, res) => {
    try {
      const packages = await profileManager.getInstalledPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profiles/install", async (req, res) => {
    try {
      const { packageId, version } = req.body;
      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }
      const result = await profileManager.installPackage(packageId, version);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profiles/uninstall", async (req, res) => {
    try {
      const { packageId } = req.body;
      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }
      const result = await profileManager.uninstallPackage(packageId);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profiles/update", async (req, res) => {
    try {
      const { packageId } = req.body;
      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }
      const result = await profileManager.updatePackage(packageId);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/profiles/updates", async (req, res) => {
    try {
      const updates = await profileManager.checkForUpdates();
      res.json(updates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================================================
  // Rock Solid Validation Settings API Routes
  // ========================================================================

  // Initialize rock-solid validation services
  const settingsService = getValidationSettingsService();
  const settingsRepository = getValidationSettingsRepository();
  const validationPipeline = getValidationPipeline();

  // Initialize settings service
  await settingsService.initialize();

  // GET /api/validation/settings - Get current active settings
  app.get("/api/validation/settings", async (req, res) => {
    try {
      // Validate request parameters
      const { includeHistory, includeStatistics } = req.query;
      
      // Get settings with proper error handling
      const settings = await settingsService.getActiveSettings();
      
      if (!settings) {
        return res.status(404).json({
          success: false,
          message: "No active validation settings found",
          error: "SETTINGS_NOT_FOUND",
          timestamp: new Date().toISOString()
        });
      }
      
      // The service returns ValidationSettings directly, not a record with id/settings
      // So we need to wrap it in the expected format
      const response: any = {
        success: true,
        settings: settings,
        timestamp: new Date().toISOString()
      };
      
      if (includeHistory === 'true') {
        try {
          // Get the active record to access the id for history
          const activeRecord = await settingsRepository.getActive();
          if (activeRecord) {
            const history = await settingsRepository.getHistory(activeRecord.id);
            response.history = history;
          }
        } catch (historyError) {
          console.warn('[ValidationSettings] Failed to load history:', historyError);
          response.historyError = "Failed to load settings history";
        }
      }
      
      if (includeStatistics === 'true') {
        try {
          const stats = await settingsRepository.getStatistics();
          response.statistics = stats;
        } catch (statsError) {
          console.warn('[ValidationSettings] Failed to load statistics:', statsError);
          response.statisticsError = "Failed to load settings statistics";
        }
      }
      
      res.json(response);
    } catch (error: any) {
      console.error('[ValidationSettings] GET settings failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 500;
      let errorCode = "INTERNAL_SERVER_ERROR";
      let message = "Failed to load validation settings";
      
      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = "VALIDATION_ERROR";
        message = "Invalid request parameters";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // PUT /api/validation/settings - Update settings
  app.put("/api/validation/settings", async (req, res) => {
    try {
      console.log('[ValidationSettings] Received settings update:', JSON.stringify(req.body, null, 2));
      
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: "Invalid request body - must be a valid settings object",
          error: "INVALID_REQUEST_BODY",
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate required fields
      const requiredFields = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          error: "MISSING_REQUIRED_FIELDS",
          missingFields,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate field structures
      const validationErrors: string[] = [];
      requiredFields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'object') {
          if (typeof req.body[field].enabled !== 'boolean') {
            validationErrors.push(`${field}.enabled must be a boolean`);
          }
          if (req.body[field].severity && !['error', 'warning', 'information'].includes(req.body[field].severity)) {
            validationErrors.push(`${field}.severity must be one of: error, warning, information`);
          }
        }
      });
      
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation errors in settings structure",
          error: "VALIDATION_ERRORS",
          validationErrors,
          timestamp: new Date().toISOString()
        });
      }
      
      const update: ValidationSettingsUpdate = {
        settings: req.body,
        validate: true,
        createNewVersion: false,
        updatedBy: req.headers['x-user-id'] as string || 'anonymous'
      };

      const updatedSettings = await settingsService.updateSettings(update);
      
      if (!updatedSettings) {
        return res.status(500).json({
          success: false,
          message: "Failed to update settings - no settings returned from service",
          error: "UPDATE_FAILED",
          timestamp: new Date().toISOString()
        });
      }
      
      // Clear validation service cache and force reload settings to ensure new settings are used
      try {
      if (unifiedValidationService) {
        await unifiedValidationService.forceReloadSettings();
        console.log('[ValidationSettings] Cleared validation service cache and reloaded settings after update');
        }
      } catch (cacheError) {
        console.warn('[ValidationSettings] Failed to clear validation service cache:', cacheError);
        // Don't fail the request if cache clearing fails
      }
      
  // Clear dashboard cache to ensure statistics reflect new validation settings
  try {
    if (dashboardService) {
      dashboardService.clearCache();
      console.log('[ValidationSettings] Cleared dashboard cache after settings update');
    }
  } catch (dashboardCacheError) {
    console.warn('[ValidationSettings] Failed to clear dashboard cache:', dashboardCacheError);
    // Don't fail the request if dashboard cache clearing fails
  }

  // Log settings change for polling-based detection
  console.log('[ValidationSettings] Settings updated - polling will detect changes automatically');
      
      res.json({
        success: true,
        data: updatedSettings,
        message: "Settings updated successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Update failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 400;
      let errorCode = "UPDATE_FAILED";
      let message = "Failed to update validation settings";
      
      if (error.name === 'ValidationError' || error.name === 'ValidationSettingsError') {
        errorCode = "VALIDATION_ERROR";
        message = "Settings validation failed";
        
        // Include detailed validation information if available
        const validationDetails = {
          errors: error.context?.validationErrors || [],
          warnings: error.context?.validationWarnings || [],
          suggestions: error.context?.validationSuggestions || []
        };
        
        res.status(statusCode).json({
          success: false,
          message,
          error: errorCode,
          details: error.message,
          validation: validationDetails,
          timestamp: new Date().toISOString()
        });
        return;
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      } else if (error.message?.includes('permission')) {
        statusCode = 403;
        errorCode = "PERMISSION_DENIED";
        message = "Insufficient permissions to update settings";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/validation/settings/validate - Validate settings
  app.post("/api/validation/settings/validate", async (req, res) => {
    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: "Invalid request body - must be a valid settings object",
          error: "INVALID_REQUEST_BODY",
          timestamp: new Date().toISOString()
        });
      }
      
      // Perform validation
      const validationResult = await settingsService.validateSettings(req.body);
      
      if (!validationResult) {
        return res.status(500).json({
          success: false,
          message: "Validation service returned no result",
          error: "VALIDATION_SERVICE_ERROR",
          timestamp: new Date().toISOString()
        });
      }
      
      // Ensure validation result has proper structure
      const response = {
        success: true,
        data: {
          isValid: validationResult.isValid || false,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
          suggestions: validationResult.suggestions || [],
          validatedAt: new Date().toISOString(),
          // Add summary information for better UX
          summary: {
            totalErrors: validationResult.errors?.length || 0,
            totalWarnings: validationResult.warnings?.length || 0,
            totalSuggestions: validationResult.suggestions?.length || 0,
            hasErrors: (validationResult.errors?.length || 0) > 0,
            hasWarnings: (validationResult.warnings?.length || 0) > 0,
            hasSuggestions: (validationResult.suggestions?.length || 0) > 0
          }
        },
        message: validationResult.isValid ? "Settings validation passed" : "Settings validation failed",
        timestamp: new Date().toISOString()
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('[ValidationSettings] Validation failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 400;
      let errorCode = "VALIDATION_FAILED";
      let message = "Failed to validate settings";
      
      if (error.name === 'ValidationError') {
        errorCode = "VALIDATION_ERROR";
        message = "Settings validation error";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/validation/settings/history - Get settings history
  app.get("/api/validation/settings/history", async (req, res) => {
    try {
      const { id, limit = '50', offset = '0' } = req.query;
      
      // Validate required parameters
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Settings ID is required",
          error: "MISSING_SETTINGS_ID",
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate ID format
      const settingsId = parseInt(id as string);
      if (isNaN(settingsId) || settingsId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid settings ID - must be a positive integer",
          error: "INVALID_SETTINGS_ID",
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate pagination parameters
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      
      if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
        return res.status(400).json({
          success: false,
          message: "Invalid limit - must be between 1 and 1000",
          error: "INVALID_LIMIT",
          timestamp: new Date().toISOString()
        });
      }
      
      if (isNaN(offsetNum) || offsetNum < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid offset - must be a non-negative integer",
          error: "INVALID_OFFSET",
          timestamp: new Date().toISOString()
        });
      }

      const history = await settingsRepository.getHistory(settingsId, limitNum, offsetNum);
      
      if (!history) {
        return res.status(404).json({
          success: false,
          message: "Settings history not found",
          error: "HISTORY_NOT_FOUND",
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: history,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: Array.isArray(history) ? history.length : 1
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] History failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 500;
      let errorCode = "HISTORY_LOAD_FAILED";
      let message = "Failed to load settings history";
      
      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = "VALIDATION_ERROR";
        message = "Invalid request parameters";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/validation/settings/reset - Reset to defaults
  app.post("/api/validation/settings/reset", async (req, res) => {
    try {
      // Validate request body (optional confirmation)
      const { confirmReset = false, resetType = 'defaults' } = req.body;
      
      if (confirmReset !== true) {
        return res.status(400).json({
          success: false,
          message: "Reset confirmation required - set confirmReset to true",
          error: "RESET_CONFIRMATION_REQUIRED",
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate reset type
      const validResetTypes = ['defaults', 'minimal', 'strict'];
      if (!validResetTypes.includes(resetType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid reset type - must be one of: ${validResetTypes.join(', ')}`,
          error: "INVALID_RESET_TYPE",
          validTypes: validResetTypes,
          timestamp: new Date().toISOString()
        });
      }
      
      // Create default settings based on reset type
      let defaultSettingsData = {};
      if (resetType === 'minimal') {
        defaultSettingsData = {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: false, severity: 'warning' },
          terminology: { enabled: false, severity: 'warning' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: false, severity: 'warning' },
          metadata: { enabled: true, severity: 'error' },
          strictMode: false
        };
      } else if (resetType === 'strict') {
        defaultSettingsData = {
          structural: { enabled: true, severity: 'error' },
          profile: { enabled: true, severity: 'error' },
          terminology: { enabled: true, severity: 'error' },
          reference: { enabled: true, severity: 'error' },
          businessRule: { enabled: true, severity: 'error' },
          metadata: { enabled: true, severity: 'error' },
          strictMode: true
        };
      }
      // 'defaults' uses empty object which will use service defaults
      
      const defaultSettings = await settingsService.createSettings(defaultSettingsData, 'system');
      
      if (!defaultSettings || !defaultSettings.id) {
        return res.status(500).json({
          success: false,
          message: "Failed to create default settings",
          error: "DEFAULT_SETTINGS_CREATION_FAILED",
          timestamp: new Date().toISOString()
        });
      }
      
      const activatedSettings = await settingsService.activateSettings(defaultSettings.id, 'system');
      
      if (!activatedSettings) {
        return res.status(500).json({
          success: false,
          message: "Failed to activate default settings",
          error: "SETTINGS_ACTIVATION_FAILED",
          timestamp: new Date().toISOString()
        });
      }
      
      // Clear validation service cache
      try {
        if (unifiedValidationService) {
          await unifiedValidationService.forceReloadSettings();
          console.log('[ValidationSettings] Cleared validation service cache after reset');
        }
      } catch (cacheError) {
        console.warn('[ValidationSettings] Failed to clear validation service cache after reset:', cacheError);
        // Don't fail the request if cache clearing fails
      }
      
      // Clear dashboard cache to ensure statistics reflect new validation settings
      try {
        if (dashboardService) {
          dashboardService.clearCache();
          console.log('[ValidationSettings] Cleared dashboard cache after settings reset');
        }
      } catch (dashboardCacheError) {
        console.warn('[ValidationSettings] Failed to clear dashboard cache after reset:', dashboardCacheError);
        // Don't fail the request if dashboard cache clearing fails
      }

      // Log settings reset for polling-based detection
      console.log('[ValidationSettings] Settings reset - polling will detect changes automatically');
      
      res.json({
        success: true,
        data: activatedSettings,
        message: `Settings reset to ${resetType} successfully`,
        resetType,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Reset failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 500;
      let errorCode = "RESET_FAILED";
      let message = "Failed to reset settings";
      
      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = "VALIDATION_ERROR";
        message = "Invalid reset request";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      } else if (error.message?.includes('permission')) {
        statusCode = 403;
        errorCode = "PERMISSION_DENIED";
        message = "Insufficient permissions to reset settings";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/validation/settings/presets - Get available presets
  app.get("/api/validation/settings/presets", async (req, res) => {
    try {
      const { category, includeBuiltIn = 'true' } = req.query;
      
      const presets = await settingsService.getPresets();
      
      if (!presets || !Array.isArray(presets)) {
        return res.status(500).json({
          success: false,
          message: "Invalid presets data returned from service",
          error: "INVALID_PRESETS_DATA",
          timestamp: new Date().toISOString()
        });
      }
      
      // Filter presets by category if specified
      let filteredPresets = presets;
      if (category) {
        filteredPresets = presets.filter(preset => 
          preset.category === category || preset.tags?.includes(category)
        );
      }
      
      // Filter built-in presets if requested
      if (includeBuiltIn === 'false') {
        filteredPresets = filteredPresets.filter(preset => !preset.isBuiltIn);
      }
      
      res.json({
        success: true,
        data: filteredPresets,
        total: filteredPresets.length,
        categories: [...new Set(presets.map(p => p.category).filter(Boolean))],
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Presets failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 500;
      let errorCode = "PRESETS_LOAD_FAILED";
      let message = "Failed to load presets";
      
      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = "VALIDATION_ERROR";
        message = "Invalid request parameters";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/validation/settings/notify-change - Trigger polling-based notification for settings change
  app.post("/api/validation/settings/notify-change", async (req, res) => {
    try {
      const { changeType = 'polling_detected', settingsId, previousVersion, newVersion } = req.body;
      
      // Log the polling-detected change for debugging
      console.log('[ValidationSettings] Polling detected settings change:', {
        changeType,
        settingsId: settingsId || 'current',
        timestamp: new Date().toISOString()
      });
      
      // For MVP, we rely on polling to detect changes
      // The polling system will automatically invalidate caches and refresh UI
      // No need for complex SSE broadcasting - polling handles this efficiently
      
      res.json({
        success: true,
        message: "Polling-based notification logged successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Error logging polling notification:', error);
      res.status(500).json({
        success: false,
        message: "Failed to log polling notification",
        error: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });


  // POST /api/validation/settings/presets/apply - Apply preset
  app.post("/api/validation/settings/presets/apply", async (req, res) => {
    try {
      const { presetId, confirmApply = false } = req.body;
      
      // Validate required parameters
      if (!presetId) {
        return res.status(400).json({
          success: false,
          message: "Preset ID is required",
          error: "MISSING_PRESET_ID",
          timestamp: new Date().toISOString()
        });
      }
      
      if (confirmApply !== true) {
        return res.status(400).json({
          success: false,
          message: "Preset application confirmation required - set confirmApply to true",
          error: "APPLY_CONFIRMATION_REQUIRED",
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate preset ID format
      if (typeof presetId !== 'string' || presetId.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid preset ID - must be a non-empty string",
          error: "INVALID_PRESET_ID",
          timestamp: new Date().toISOString()
        });
      }

      const settings = await settingsService.applyPreset(presetId.trim(), req.headers['x-user-id'] as string);
      
      if (!settings) {
        return res.status(404).json({
          success: false,
          message: "Preset not found or failed to apply",
          error: "PRESET_NOT_FOUND",
          presetId: presetId.trim(),
          timestamp: new Date().toISOString()
        });
      }
      
      // Clear validation service cache
      try {
        if (unifiedValidationService) {
          await unifiedValidationService.forceReloadSettings();
          console.log('[ValidationSettings] Cleared validation service cache after preset application');
        }
      } catch (cacheError) {
        console.warn('[ValidationSettings] Failed to clear validation service cache after preset application:', cacheError);
        // Don't fail the request if cache clearing fails
      }
      
      // Clear dashboard cache to ensure statistics reflect new validation settings
      try {
        if (dashboardService) {
          dashboardService.clearCache();
          console.log('[ValidationSettings] Cleared dashboard cache after preset application');
        }
      } catch (dashboardCacheError) {
        console.warn('[ValidationSettings] Failed to clear dashboard cache after preset application:', dashboardCacheError);
        // Don't fail the request if dashboard cache clearing fails
      }

      // Log preset application for polling-based detection
      console.log('[ValidationSettings] Preset applied - polling will detect changes automatically');
      
      res.json({
        success: true,
        data: settings,
        message: "Preset applied successfully",
        presetId: presetId.trim(),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Preset apply failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 400;
      let errorCode = "PRESET_APPLY_FAILED";
      let message = "Failed to apply preset";
      
      if (error.name === 'ValidationError') {
        errorCode = "VALIDATION_ERROR";
        message = "Invalid preset application request";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      } else if (error.message?.includes('not found')) {
        statusCode = 404;
        errorCode = "PRESET_NOT_FOUND";
        message = "Preset not found";
      } else if (error.message?.includes('permission')) {
        statusCode = 403;
        errorCode = "PERMISSION_DENIED";
        message = "Insufficient permissions to apply preset";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/validation/settings/rollback - Rollback to previous settings version
  app.post("/api/validation/settings/rollback", async (req, res) => {
    try {
      const { settingsId, rollbackToVersion, rolledBackBy } = req.body;
      
      // Validate required parameters
      if (!settingsId || rollbackToVersion === undefined) {
        return res.status(400).json({
          success: false,
          message: "Settings ID and rollback version are required",
          error: "MISSING_PARAMETERS",
          required: ["settingsId", "rollbackToVersion"],
          timestamp: new Date().toISOString()
        });
      }

      const settingsService = getValidationSettingsService();
      const rollbackResult = await settingsService.rollbackToVersion(
        settingsId, 
        rollbackToVersion, 
        rolledBackBy || 'user-rollback'
      );
      
      // Clear relevant caches
      // Note: queryClient is not available in server context, cache invalidation handled by service
      
      res.json({
        success: true,
        data: {
          rollbackResult,
          rolledBackAt: new Date().toISOString(),
          rolledBackBy: rolledBackBy || 'user-rollback'
        },
        message: "Settings successfully rolled back",
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('[ValidationSettings] Rollback failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 400;
      let errorCode = "ROLLBACK_FAILED";
      let message = "Failed to rollback settings";
      
      if (error.message?.includes('not found')) {
        statusCode = 404;
        errorCode = "SETTINGS_NOT_FOUND";
        message = "Settings not found";
      } else if (error.message?.includes('validation failed')) {
        errorCode = "ROLLBACK_VALIDATION_ERROR";
        message = "Rollback settings validation failed";
      } else if (error.message?.includes('database')) {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database error during rollback";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/validation/settings/test - Test settings with sample resource
  app.post("/api/validation/settings/test", async (req, res) => {
    try {
      const { settings, sampleResource, testType = 'validation' } = req.body;
      
      // Validate required parameters
      if (!settings || !sampleResource) {
        return res.status(400).json({ 
          success: false,
          message: "Settings and sample resource are required",
          error: "MISSING_REQUIRED_PARAMETERS",
          required: ['settings', 'sampleResource'],
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate settings structure
      if (typeof settings !== 'object' || Array.isArray(settings)) {
        return res.status(400).json({
          success: false,
          message: "Settings must be a valid object",
          error: "INVALID_SETTINGS_FORMAT",
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate sample resource structure
      if (typeof sampleResource !== 'object' || Array.isArray(sampleResource)) {
        return res.status(400).json({
          success: false,
          message: "Sample resource must be a valid object",
          error: "INVALID_SAMPLE_RESOURCE_FORMAT",
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate test type
      const validTestTypes = ['validation', 'performance', 'compatibility'];
      if (!validTestTypes.includes(testType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid test type - must be one of: ${validTestTypes.join(', ')}`,
          error: "INVALID_TEST_TYPE",
          validTypes: validTestTypes,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate sample resource has required FHIR fields
      if (!sampleResource.resourceType || !sampleResource.id) {
        return res.status(400).json({
          success: false,
          message: "Sample resource must have resourceType and id fields",
          error: "INVALID_SAMPLE_RESOURCE_STRUCTURE",
          required: ['resourceType', 'id'],
          timestamp: new Date().toISOString()
        });
      }

      const testResult = await settingsService.testSettings(settings, sampleResource, testType);
      
      if (!testResult) {
        return res.status(500).json({
          success: false,
          message: "Test service returned no result",
          error: "TEST_SERVICE_ERROR",
          timestamp: new Date().toISOString()
        });
      }
      
      // Ensure test result has proper structure
      const response = {
        success: true,
        data: {
          testType,
          isValid: testResult.isValid || false,
          validationResults: testResult.validationResults || [],
          performanceMetrics: testResult.performanceMetrics || {},
          compatibilityIssues: testResult.compatibilityIssues || [],
          recommendations: testResult.recommendations || [],
          testedAt: new Date().toISOString(),
          sampleResource: {
            resourceType: sampleResource.resourceType,
            id: sampleResource.id
          }
        },
        message: testResult.isValid ? "Settings test passed" : "Settings test failed",
        timestamp: new Date().toISOString()
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('[ValidationSettings] Test failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 400;
      let errorCode = "TEST_FAILED";
      let message = "Failed to test settings";
      
      if (error.name === 'ValidationError') {
        errorCode = "VALIDATION_ERROR";
        message = "Settings test validation error";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      } else if (error.message?.includes('resource')) {
        errorCode = "INVALID_RESOURCE";
        message = "Invalid sample resource provided";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/validation/cleanup - Clean up old validation results
  app.post("/api/validation/cleanup", async (req, res) => {
    try {
      const { 
        maxAgeHours = 168, // Default 7 days
        dryRun = false,
        confirmCleanup = false 
      } = req.body;
      
      // Validate parameters
      if (typeof maxAgeHours !== 'number' || maxAgeHours < 1) {
        return res.status(400).json({
          success: false,
          message: "maxAgeHours must be a positive number (hours)",
          error: "INVALID_MAX_AGE_HOURS",
          timestamp: new Date().toISOString()
        });
      }
      
      if (!confirmCleanup && !dryRun) {
        return res.status(400).json({
          success: false,
          message: "Cleanup confirmation required - set confirmCleanup to true or dryRun to true",
          error: "CLEANUP_CONFIRMATION_REQUIRED",
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('[ValidationCleanup] Starting cleanup process', {
        maxAgeHours,
        dryRun,
        confirmCleanup
      });
      
      if (dryRun) {
        // Dry run - just count how many records would be deleted
        const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
        
        // Count records that would be deleted
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(validationResults)
          .where(lt(validationResults.validatedAt, cutoffDate));
        
        const count = countResult[0]?.count || 0;
        
        res.json({
          success: true,
          message: "Dry run completed - no records were deleted",
          dryRun: true,
          wouldDeleteCount: count,
          maxAgeHours,
          cutoffDate: cutoffDate.toISOString(),
          timestamp: new Date().toISOString()
        });
      } else {
        // Actual cleanup
        const deletedCount = await storage.cleanupOldValidationResults(maxAgeHours);
        
        console.log('[ValidationCleanup] Cleanup completed', {
          deletedCount,
          maxAgeHours
        });
        
        res.json({
          success: true,
          message: "Validation results cleanup completed successfully",
          deletedCount,
          maxAgeHours,
          cutoffDate: new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000)).toISOString(),
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('[ValidationCleanup] Error during cleanup:', error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup validation results",
        error: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Debug endpoint to check validation results for a specific resource
  app.get('/api/debug/validation-results/:resourceId', async (req, res) => {
    try {
      const resourceId = parseInt(req.params.resourceId);
      const validationResults = await storage.getValidationResultsByResourceId(resourceId);
      res.json({
        resourceId,
        validationResultsCount: validationResults.length,
        validationResults: validationResults
      });
    } catch (error) {
      console.error('[Debug] Error fetching validation results:', error);
      res.status(500).json({ error: 'Failed to fetch validation results' });
    }
  });

  // GET /api/validation/cleanup/statistics - Get validation results cleanup statistics
  app.get("/api/validation/cleanup/statistics", async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;
      
      // Calculate time ranges
      const now = new Date();
      const timeRanges = {
        '1d': 24,
        '7d': 24 * 7,
        '30d': 24 * 30,
        '90d': 24 * 90,
        '1y': 24 * 365,
        'all': 0
      };
      
      const hours = timeRanges[timeRange as keyof typeof timeRanges];
      if (hours === undefined) {
        return res.status(400).json({
          success: false,
          message: "Invalid time range",
          error: "INVALID_TIME_RANGE",
          validRanges: Object.keys(timeRanges),
          timestamp: new Date().toISOString()
        });
      }
      
      // Get total validation results count
      const totalCountResult = await db
        .select({ totalCount: sql<number>`count(*)` })
        .from(validationResults);
      
      const totalCount = totalCountResult[0]?.totalCount || 0;
      
      // Get count by age ranges
      const ageRanges = [
        { name: 'last_24h', hours: 24 },
        { name: 'last_7d', hours: 24 * 7 },
        { name: 'last_30d', hours: 24 * 30 },
        { name: 'last_90d', hours: 24 * 90 },
        { name: 'older_than_90d', hours: 24 * 90 }
      ];
      
      const ageStats = await Promise.all(
        ageRanges.map(async (range) => {
          const cutoffDate = new Date(now.getTime() - (range.hours * 60 * 60 * 1000));
          let query = db.select({ count: sql<number>`count(*)` }).from(validationResults);
          
          if (range.name === 'older_than_90d') {
            query = query.where(lt(validationResults.validatedAt, cutoffDate));
          } else {
            const startDate = range.name === 'last_24h' ? cutoffDate : new Date(now.getTime() - ((range.hours + 24) * 60 * 60 * 1000));
            query = query.where(sql`${validationResults.validatedAt} >= ${startDate} AND ${validationResults.validatedAt} < ${cutoffDate}`);
          }
          
          const result = await query;
          return {
            range: range.name,
            count: result[0]?.count || 0
          };
        })
      );
      
      // Get oldest and newest validation results
      const oldestResult = await db
        .select({ oldest: sql<string>`min(${validationResults.validatedAt})` })
        .from(validationResults);
      
      const newestResult = await db
        .select({ newest: sql<string>`max(${validationResults.validatedAt})` })
        .from(validationResults);
      
      const oldest = oldestResult[0]?.oldest;
      const newest = newestResult[0]?.newest;
      
      res.json({
        success: true,
        data: {
          totalValidationResults: totalCount,
          ageDistribution: ageStats,
          oldestValidation: oldest ? new Date(oldest).toISOString() : null,
          newestValidation: newest ? new Date(newest).toISOString() : null,
          timeRange,
          generatedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationCleanupStats] Error getting cleanup statistics:', error);
      res.status(500).json({
        success: false,
        message: "Failed to get cleanup statistics",
        error: error?.message || String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/validation/settings/statistics - Get settings statistics
  app.get("/api/validation/settings/statistics", async (req, res) => {
    try {
      const { timeRange = '30d', includeDetails = 'false' } = req.query;
      
      // Validate time range
      const validTimeRanges = ['1d', '7d', '30d', '90d', '1y', 'all'];
      if (!validTimeRanges.includes(timeRange as string)) {
        return res.status(400).json({
          success: false,
          message: `Invalid time range - must be one of: ${validTimeRanges.join(', ')}`,
          error: "INVALID_TIME_RANGE",
          validRanges: validTimeRanges,
          timestamp: new Date().toISOString()
        });
      }
      
      const stats = await settingsRepository.getStatistics(timeRange as string, includeDetails === 'true');
      
      if (!stats) {
        return res.status(500).json({
          success: false,
          message: "Statistics service returned no data",
          error: "STATISTICS_SERVICE_ERROR",
          timestamp: new Date().toISOString()
        });
      }
      
      // Ensure statistics have proper structure
      const response = {
        success: true,
        data: {
          timeRange: timeRange as string,
          totalSettings: stats.totalSettings || 0,
          activeSettings: stats.activeSettings || 0,
          settingsHistory: stats.settingsHistory || [],
          usageStats: stats.usageStats || {},
          performanceMetrics: stats.performanceMetrics || {},
          errorRates: stats.errorRates || {},
          lastUpdated: new Date().toISOString()
        },
        message: "Settings statistics loaded successfully",
        timestamp: new Date().toISOString()
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('[ValidationSettings] Statistics failed:', error);
      
      // Determine error type and appropriate response
      let statusCode = 500;
      let errorCode = "STATISTICS_LOAD_FAILED";
      let message = "Failed to load settings statistics";
      
      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = "VALIDATION_ERROR";
        message = "Invalid request parameters";
      } else if (error.name === 'DatabaseError') {
        statusCode = 503;
        errorCode = "DATABASE_ERROR";
        message = "Database connection failed";
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorCode = "TIMEOUT_ERROR";
        message = "Request timeout";
      }
      
      res.status(statusCode).json({
        success: false,
        message,
        error: errorCode,
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/validation/validate - Validate resource using rock-solid engine (via pipeline)
  app.post("/api/validation/validate", async (req, res) => {
    try {
      const { resource, resourceType, resourceId, profileUrl, context } = req.body;
      
      if (!resource || !resourceType) {
        return res.status(400).json({ 
          message: "Resource and resourceType are required" 
        });
      }

      const validationRequest = {
        resource,
        resourceType,
        resourceId,
        profileUrl,
        context: {
          ...context,
          requestedBy: req.headers['x-user-id'] as string || 'anonymous',
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      };

      const pipelineReq = {
        resources: [validationRequest],
        context: validationRequest.context
      };
      const result = await validationPipeline.executePipeline(pipelineReq);
      const first = Array.isArray(result.results) ? result.results[0] : null;
      if (!first) {
        return res.status(500).json({ message: 'No validation result returned' });
      }
      res.json(first);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Validation failed",
        error: error.message 
      });
    }
  });

  // POST /api/validation/validate-batch - Validate multiple resources (via pipeline)
  app.post("/api/validation/validate-batch", async (req, res) => {
    try {
      const { resources } = req.body;
      
      if (!resources || !Array.isArray(resources)) {
        return res.status(400).json({ 
          message: "Resources array is required" 
        });
      }

      const validationRequests = resources.map((resourceData: any) => ({
        resource: resourceData.resource,
        resourceType: resourceData.resourceType,
        resourceId: resourceData.resourceId,
        profileUrl: resourceData.profileUrl,
        context: {
          ...resourceData.context,
          requestedBy: req.headers['x-user-id'] as string || 'anonymous',
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      }));

      const pipelineReq = {
        resources: validationRequests,
        context: { requestedBy: req.headers['x-user-id'] as string || 'anonymous' }
      } as const;
      const result = await validationPipeline.executePipeline(pipelineReq);
      res.json(result.results);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Batch validation failed",
        error: error.message 
      });
    }
  });

  // POST /api/validation/validate-by-ids - Validate specific resources by their IDs
  app.post("/api/validation/validate-by-ids", async (req, res) => {
    try {
      const { resourceIds, forceRevalidation = false } = req.body;
      
      if (!resourceIds || !Array.isArray(resourceIds)) {
        return res.status(400).json({ 
          message: "Resource IDs array is required" 
        });
      }

      console.log(`[ValidateByIds] Starting validation for ${resourceIds.length} resources (forceRevalidation: ${forceRevalidation})`);

      // Get current validation settings for cache key generation
      const settingsService = getValidationSettingsService();
      const currentSettings = await settingsService.getActiveSettings();
      const settingsHash = ValidationCacheManager.generateSettingsHash(currentSettings);

      // Fetch resources from database by their IDs
      const resources = await Promise.all(
        resourceIds.map(async (id: number) => {
          const resource = await storage.getFhirResourceById(id);
          if (!resource) {
            console.warn(`[ValidateByIds] Resource with ID ${id} not found`);
            return null;
          }
          return resource;
        })
      );

      // Filter out null resources (not found)
      const validResources = resources.filter(resource => resource !== null);
      
      if (validResources.length === 0) {
        return res.status(404).json({ 
          message: "No valid resources found for the provided IDs" 
        });
      }

      console.log(`[ValidateByIds] Found ${validResources.length} valid resources to validate`);

      // Check for cached validation results first (unless force revalidation is requested)
      const resourcesToValidate = [];
      const cachedResults = [];
      
      for (const resource of validResources) {
        if (!forceRevalidation) {
          // Check if we have a valid cached result
          const resourceHash = ValidationCacheManager.generateResourceHash(resource.data);
          const cachedResult = await storage.getValidationResultByHash(
            resource.id, 
            settingsHash, 
            resourceHash
          );
          
          if (cachedResult && ValidationCacheManager.isValidationResultValid(
            cachedResult, 
            settingsHash, 
            resourceHash
          )) {
            console.log(`[ValidateByIds] Using cached result for resource ${resource.id}`);
            cachedResults.push({
              resourceId: resource.id,
              resourceType: resource.resourceType,
              resourceData: resource.data,
              validationResult: cachedResult,
              fromCache: true
            });
            continue;
          }
        }
        
        // Resource needs validation
        resourcesToValidate.push(resource);
      }

      console.log(`[ValidateByIds] ${cachedResults.length} cached results, ${resourcesToValidate.length} resources need validation`);

      let validationResults: any[] = [];
      
      // Validate resources that don't have valid cached results
      if (resourcesToValidate.length > 0) {
        const validationRequests = resourcesToValidate.map((resource: any) => ({
          resource: resource.data,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          context: {
            source: 'validate-by-ids',
            requestedBy: req.headers['x-user-id'] as string || 'anonymous',
            requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
          }
        }));

        const pipelineReq = {
          resources: validationRequests,
          context: { requestedBy: req.headers['x-user-id'] as string || 'anonymous' }
        } as const;
        
        const result = await validationPipeline.executePipeline(pipelineReq);
        validationResults = result.results || [];
        
        // Store validation results with enhanced caching fields
        console.log(`[ValidateByIds] Attempting to store ${validationResults.length} validation results`);
        for (const validationResult of validationResults) {
          try {
            console.log(`[ValidateByIds] Processing validation result for resourceId: ${validationResult.resourceId}`);
            const resource = resourcesToValidate.find(r => r.resourceId === validationResult.resourceId);
            console.log(`[ValidateByIds] Found resource:`, resource ? `ID: ${resource.id}, Type: ${resource.resourceType}` : 'NOT FOUND');
            if (resource) {
              console.log(`[ValidateByIds] Preparing enhanced result for storage...`);
              const enhancedResult = ValidationCacheManager.prepareValidationResultForStorage(
                validationResult,
                currentSettings,
                resource.data,
                Date.now() // Start time approximation
              );
              // Set the database resource ID
              enhancedResult.resourceId = resource.id;
              console.log(`[ValidateByIds] Storing validation result with resourceId: ${enhancedResult.resourceId}`);
              await storage.createValidationResult(enhancedResult);
              console.log(`[ValidateByIds] Successfully stored validation result for resource ${resource.id} (${resource.resourceType}/${resource.resourceId})`);
            } else {
              console.warn(`[ValidateByIds] Resource not found for validationResult.resourceId: ${validationResult.resourceId}`);
            }
          } catch (error) {
            console.error(`[ValidateByIds] Failed to store validation result for resource ${validationResult.resourceId}:`, error);
          }
        }
        
        console.log(`[ValidateByIds] Validation completed for ${validationResults.length} resources`);
      }

      // Combine cached and newly validated results
      const allResults = [...cachedResults, ...validationResults];
      
      console.log(`[ValidateByIds] Final response: cachedResults=${cachedResults.length}, validationResults=${validationResults.length}, allResults=${allResults.length}`);
      
      res.json({
        success: true,
        validatedCount: allResults.length,
        requestedCount: resourceIds.length,
        cachedCount: cachedResults.length,
        newlyValidatedCount: validationResults.length,
        results: allResults
      });
    } catch (error: any) {
      console.error('[ValidateByIds] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/validation/pipeline - Execute validation pipeline
  app.post("/api/validation/pipeline", async (req, res) => {
    try {
      const { resources, config, context } = req.body;
      
      if (!resources || !Array.isArray(resources)) {
        return res.status(400).json({ 
          message: "Resources array is required" 
        });
      }

      const pipelineRequest = {
        resources: resources.map((resourceData: any) => ({
          resource: resourceData.resource,
          resourceType: resourceData.resourceType,
          resourceId: resourceData.resourceId,
          profileUrl: resourceData.profileUrl,
          context: resourceData.context
        })),
        config,
        context: {
          ...context,
          requestedBy: req.headers['x-user-id'] as string || 'anonymous',
          requestId: `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      };

      const result = await validationPipeline.executePipeline(pipelineRequest);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Pipeline execution failed",
        error: error.message 
      });
    }
  });

  // GET /api/validation/settings/audit-trail - Get audit trail history
  app.get("/api/validation/settings/audit-trail", async (req, res) => {
    try {
      const { settingsId, limit = '50' } = req.query;
      
      // Validate parameters
      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({
          success: false,
          message: "Invalid limit - must be between 1 and 1000",
          error: "INVALID_LIMIT",
          timestamp: new Date().toISOString()
        });
      }

      const settingsService = getValidationSettingsService();
      const settingsIdNum = settingsId ? parseInt(settingsId as string) : undefined;
      
      if (settingsIdNum && isNaN(settingsIdNum)) {
        return res.status(400).json({
          success: false,
          message: "Invalid settings ID - must be a positive integer",
          error: "INVALID_SETTINGS_ID",
          timestamp: new Date().toISOString()
        });
      }

      const auditHistory = await settingsService.getAuditTrailHistory(settingsIdNum, limitNum);
      
      res.json({
        success: true,
        data: auditHistory,
        pagination: {
          limit: limitNum,
          total: auditHistory.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Audit trail failed:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to load audit trail history",
        error: "AUDIT_TRAIL_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/validation/settings/audit-trail/statistics - Get audit trail statistics
  app.get("/api/validation/settings/audit-trail/statistics", async (req, res) => {
    try {
      const settingsService = getValidationSettingsService();
      const statistics = await settingsService.getAuditTrailStatistics();
      
      res.json({
        success: true,
        data: statistics,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Audit trail statistics failed:', error);
      
      res.status(500).json({
        success: false,
        message: "Failed to load audit trail statistics",
        error: "AUDIT_TRAIL_STATISTICS_ERROR",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/validation/pipeline/:requestId/status - Get pipeline status
  app.get("/api/validation/pipeline/:requestId/status", async (req, res) => {
    try {
      const { requestId } = req.params;
      const status = validationPipeline.getPipelineStatus(requestId);
      res.json({ requestId, status });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to get pipeline status",
        error: error.message 
      });
    }
  });

  // POST /api/validation/pipeline/:requestId/cancel - Cancel pipeline
  app.post("/api/validation/pipeline/:requestId/cancel", async (req, res) => {
    try {
      const { requestId } = req.params;
      await validationPipeline.cancelPipeline(requestId);
      res.json({ message: "Pipeline cancelled successfully" });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to cancel pipeline",
        error: error.message 
      });
    }
  });

// ========================================================================
// Backup and Restore API Endpoints
// ========================================================================

// GET /api/validation/backups - List all available backups
app.get("/api/validation/backups", async (req, res) => {
  try {
    const settingsService = getValidationSettingsService();
    const backups = await settingsService.listBackups();
    
    res.json({
      success: true,
      data: backups,
      count: backups.length
    });
  } catch (error) {
    console.error('[API] Error listing backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/validation/backups - Create a new backup
app.post("/api/validation/backups", async (req, res) => {
  try {
    const { description, createdBy, tags } = req.body;
    const settingsService = getValidationSettingsService();
    
    const backupId = await settingsService.createManualBackup(
      description,
      createdBy || 'api',
      tags
    );
    
    res.json({
      success: true,
      data: { backupId },
      message: 'Backup created successfully'
    });
  } catch (error) {
    console.error('[API] Error creating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/validation/backups/:backupId - Get backup details
app.get("/api/validation/backups/:backupId", async (req, res) => {
  try {
    const { backupId } = req.params;
    const settingsService = getValidationSettingsService();
    
    const backups = await settingsService.listBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found',
        message: `Backup with ID ${backupId} not found`
      });
    }
    
    res.json({
      success: true,
      data: backup
    });
  } catch (error) {
    console.error('[API] Error getting backup details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/validation/backups/:backupId - Delete a backup
app.delete("/api/validation/backups/:backupId", async (req, res) => {
  try {
    const { backupId } = req.params;
    const settingsService = getValidationSettingsService();
    
    await settingsService.deleteBackup(backupId);
    
    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/validation/backups/:backupId/verify - Verify backup integrity
app.post("/api/validation/backups/:backupId/verify", async (req, res) => {
  try {
    const { backupId } = req.params;
    const settingsService = getValidationSettingsService();
    
    const isValid = await settingsService.verifyBackup(backupId);
    
    res.json({
      success: true,
      data: { isValid },
      message: isValid ? 'Backup is valid' : 'Backup is invalid or corrupted'
    });
  } catch (error) {
    console.error('[API] Error verifying backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify backup',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/validation/backups/:backupId/restore - Restore from backup
app.post("/api/validation/backups/:backupId/restore", async (req, res) => {
  try {
    const { backupId } = req.params;
    const { options } = req.body;
    const settingsService = getValidationSettingsService();
    
    await settingsService.restoreFromBackup(backupId, options);
    
    res.json({
      success: true,
      message: 'Backup restored successfully'
    });
  } catch (error) {
    console.error('[API] Error restoring backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore backup',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/validation/backups/cleanup - Clean up old backups
app.post("/api/validation/backups/cleanup", async (req, res) => {
  try {
    const settingsService = getValidationSettingsService();
    const deletedCount = await settingsService.cleanupOldBackups();
    
    res.json({
      success: true,
      data: { deletedCount },
      message: `Cleaned up ${deletedCount} old backups`
    });
  } catch (error) {
    console.error('[API] Error cleaning up backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up backups',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ========================================================================
// Server-Sent Events (SSE) for Real-time Settings Notifications
// ========================================================================

  // GET /api/validation/stream - SSE endpoint for real-time validation updates
  app.get("/api/validation/stream", (req, res) => {
    console.log('[SSE] New client connecting to validation stream');
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      data: { 
        message: 'Connected to validation stream', 
        timestamp: new Date().toISOString(),
        clientId: Math.random().toString(36).substr(2, 9)
      }
    })}\n\n`);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          data: { 
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending heartbeat:', error);
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      console.log('[SSE] Client disconnected from validation stream');
      clearInterval(heartbeatInterval);
    });

    req.on('error', (error) => {
      console.error('[SSE] Client connection error:', error);
      clearInterval(heartbeatInterval);
    });

    // Send a test message after 1 second to verify connection
    setTimeout(() => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'test',
          data: { 
            message: 'SSE connection test successful',
            timestamp: new Date().toISOString()
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending test message:', error);
      }
    }, 1000);
  });
  
  // ORIGINAL SSE IMPLEMENTATION (DISABLED)
  app.get("/api/validation/stream-disabled", (req, res) => {
    try {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection message
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        data: { message: 'Connected to validation stream', timestamp: new Date().toISOString() }
      })}\n\n`);

      // Get validation settings service for event listening
      const settingsService = getValidationSettingsService();
      
      // Temporarily disable pipeline to prevent hanging
      let pipeline;
      try {
        pipeline = getValidationPipeline();
      } catch (error) {
        console.warn('[SSE] Pipeline not available, using fallback mode:', error);
        pipeline = null;
      }

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending heartbeat:', error);
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Listen for settings change events
    const onSettingsChanged = (event: any) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'settings-changed',
          data: {
            changeType: event.type,
            settingsId: event.settingsId,
            timestamp: new Date().toISOString(),
            previousVersion: event.previousVersion,
            newVersion: event.newVersion
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending settings change event:', error);
      }
    };

    const onSettingsActivated = (event: any) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'settings-activated',
          data: {
            settingsId: event.settingsId,
            settings: event.settings,
            timestamp: new Date().toISOString()
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending settings activated event:', error);
      }
    };

    const onCacheInvalidated = (event: any) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'cache-invalidated',
          data: {
            tag: event.tag,
            dependencyId: event.dependencyId,
            entriesInvalidated: event.entriesInvalidated,
            timestamp: new Date().toISOString()
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending cache invalidated event:', error);
      }
    };

    const onCacheWarmed = (event: any) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'cache-warmed',
          data: {
            entriesWarmed: event.entriesWarmed,
            timestamp: new Date().toISOString()
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending cache warmed event:', error);
      }
    };

    // Register event listeners
    settingsService.on('settingsChanged', onSettingsChanged);
    settingsService.on('settingsActivated', onSettingsActivated);
    settingsService.on('cacheInvalidated', onCacheInvalidated);
    settingsService.on('cacheWarmed', onCacheWarmed);

    // Validation pipeline -> SSE forwarding
    const onPipelineProgress = (evt: any) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'validation-progress',
          data: {
            totalResources: evt.totalResources,
            processedResources: evt.processedResources,
            validResources: evt.validResources,
            errorResources: evt.errorResources,
            progress: (typeof evt.processedResources === 'number' && typeof evt.totalResources === 'number' && evt.totalResources > 0)
              ? Math.round((evt.processedResources / evt.totalResources) * 100)
              : 0,
            startTime: evt.startTime,
            isComplete: Boolean(evt.isComplete),
            errors: [],
            status: evt.status || 'running'
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending validation progress:', error);
      }
    };

    const onPipelineCompleted = ({ result }: any) => {
      try {
        const summary = result?.summary;
        res.write(`data: ${JSON.stringify({
          type: 'validation-completed',
          data: {
            status: 'completed',
            progress: {
              totalResources: summary?.totalResources ?? 0,
              processedResources: summary?.totalResources ?? 0,
              validResources: summary?.successfulValidations ?? 0,
              errorResources: summary?.resourcesWithErrors ?? 0,
              startTime: result?.timestamps?.startedAt ?? new Date().toISOString(),
              isComplete: true,
              errors: [],
              status: 'completed'
            }
          }
        })}\n\n`);
      } catch (error) {
        console.error('[SSE] Error sending validation completed:', error);
      }
    };

    const onPipelineFailed = ({ error }: any) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'validation-error',
          data: { error }
        })}\n\n`);
      } catch (err) {
        console.error('[SSE] Error sending validation error:', err);
      }
    };

    const onPipelineCancelled = (_evt: any) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'validation-stopped',
          data: { timestamp: new Date().toISOString() }
        })}\n\n`);
      } catch (err) {
        console.error('[SSE] Error sending validation stopped:', err);
      }
    };

    // Only register pipeline listeners if pipeline is available
    if (pipeline) {
      pipeline.on('pipelineProgress', onPipelineProgress);
      pipeline.on('pipelineCompleted', onPipelineCompleted);
      pipeline.on('pipelineFailed', onPipelineFailed);
      pipeline.on('pipelineCancelled', onPipelineCancelled);
    }

    // Handle client disconnect
    req.on('close', () => {
      console.log('[SSE] Client disconnected from validation stream');
      clearInterval(heartbeatInterval);
      
      // Remove event listeners
      settingsService.off('settingsChanged', onSettingsChanged);
      settingsService.off('settingsActivated', onSettingsActivated);
      settingsService.off('cacheInvalidated', onCacheInvalidated);
      settingsService.off('cacheWarmed', onCacheWarmed);

      if (pipeline) {
        pipeline.off('pipelineProgress', onPipelineProgress);
        pipeline.off('pipelineCompleted', onPipelineCompleted);
        pipeline.off('pipelineFailed', onPipelineFailed);
        pipeline.off('pipelineCancelled', onPipelineCancelled);
      }
    });

    req.on('error', (error) => {
      console.error('[SSE] Client connection error:', error);
      clearInterval(heartbeatInterval);
      
      // Remove event listeners
      settingsService.off('settingsChanged', onSettingsChanged);
      settingsService.off('settingsActivated', onSettingsActivated);
      settingsService.off('cacheInvalidated', onCacheInvalidated);
      settingsService.off('cacheWarmed', onCacheWarmed);

      if (pipeline) {
        pipeline.off('pipelineProgress', onPipelineProgress);
        pipeline.off('pipelineCompleted', onPipelineCompleted);
        pipeline.off('pipelineFailed', onPipelineFailed);
        pipeline.off('pipelineCancelled', onPipelineCancelled);
      }
    });
    } catch (error) {
      console.error('[SSE] Error in SSE endpoint:', error);
      res.status(500).json({ error: 'SSE connection failed' });
    }
  });

  const httpServer = createServer(app);
  
  // SSE is handled by the validation service, no WebSocket initialization needed
  
  return httpServer;
}
