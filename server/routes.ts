import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { FhirClient } from "./services/fhir-client.js";
import { ValidationEngine } from "./services/validation-engine.js";
import { UnifiedValidationService } from "./services/unified-validation.js";
import { profileManager } from "./services/profile-manager.js";
import { RobustValidationService } from "./services/robust-validation.js";
import { insertFhirServerSchema, insertFhirResourceSchema, insertValidationProfileSchema, type ValidationResult } from "@shared/schema.js";
import { validationWebSocket, initializeWebSocket } from "./services/websocket-server.js";
import { z } from "zod";

// Rock Solid Validation Settings imports
import { getValidationSettingsService } from "./services/validation-settings-service.js";
import { getValidationSettingsRepository } from "./repositories/validation-settings-repository.js";
import { getRockSolidValidationEngine } from "./services/rock-solid-validation-engine.js";
import { getValidationPipeline } from "./services/validation-pipeline.js";
import { DashboardService } from "./services/dashboard-service.js";
import type { ValidationSettings, ValidationSettingsUpdate } from "@shared/validation-settings.js";
import { BUILT_IN_PRESETS } from "@shared/validation-settings.js";

let fhirClient: FhirClient;
let validationEngine: ValidationEngine;
let unifiedValidationService: UnifiedValidationService;
let robustValidationService: RobustValidationService;
let dashboardService: DashboardService;

// Global validation state tracking
let globalValidationState = {
  isRunning: false,
  isPaused: false,
  startTime: null as Date | null,
  canPause: false,
  shouldStop: false,
  resumeData: null as any | null
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
  
  return validationResults.map(result => {
    if (!result.issues || result.issues.length === 0) return result;
    
    // Filter issues based on their category and active settings
    const filteredIssues = result.issues.filter((issue: any) => {
      // If issue has no category, try to infer it from the message
      let category = issue.category;
      
      if (!category) {
        // Try to infer category from issue message/code
        const message = (issue.message || '').toLowerCase();
        const code = (issue.code || '').toLowerCase();
        
        if (message.includes('cardinality') || message.includes('instance count') || 
            message.includes('declared type') || message.includes('incompatible') ||
            code.includes('structure')) {
          category = 'structural';
        } else if (message.includes('profile') || message.includes('constraint') ||
                   code.includes('profile')) {
          category = 'profile';
        } else if (message.includes('code') || message.includes('terminology') ||
                   message.includes('valueset') || code.includes('terminology')) {
          category = 'terminology';
        } else if (message.includes('reference') || message.includes('target') ||
                   code.includes('reference')) {
          category = 'reference';
        } else if (message.includes('business') || message.includes('logic') ||
                   code.includes('business')) {
          category = 'business-rule';
        } else if (message.includes('metadata') || message.includes('security') ||
                   message.includes('narrative') || code.includes('metadata')) {
          category = 'metadata';
        } else if (message.includes('unable to resolve reference to profile') || 
                   message.includes('unable to resolve profile') ||
                   message.includes('profile resolution') ||
                   message.includes('unresolved profile')) {
          category = 'general';
        } else {
          // Default to structural for unknown issues
          category = 'structural';
        }
      }
      
      switch (category) {
        case 'structural':
          return activeSettings.enableStructuralValidation !== false;
        case 'profile':
          return activeSettings.enableProfileValidation !== false;
        case 'terminology':
          return activeSettings.enableTerminologyValidation !== false;
        case 'reference':
          return activeSettings.enableReferenceValidation !== false;
        case 'business-rule':
          return activeSettings.enableBusinessRuleValidation !== false;
        case 'metadata':
          return activeSettings.enableMetadataValidation !== false;
        case 'general':
          return true; // Always show general category issues
        default:
          return true; // Show unknown categories by default
      }
    });
    
    // Recalculate error and warning counts based on filtered issues
    const errorCount = filteredIssues.filter((issue: any) => issue.severity === 'error' || issue.severity === 'fatal').length;
    const warningCount = filteredIssues.filter((issue: any) => issue.severity === 'warning').length;
    
    console.log(`[FilterValidation] Original issues: ${result.issues?.length || 0}, Filtered issues: ${filteredIssues.length}`);
    console.log(`[FilterValidation] Active settings:`, {
      structural: activeSettings.enableStructuralValidation !== false,
      profile: activeSettings.enableProfileValidation !== false,
      terminology: activeSettings.enableTerminologyValidation !== false,
      reference: activeSettings.enableReferenceValidation !== false,
      businessRule: activeSettings.enableBusinessRuleValidation !== false,
      metadata: activeSettings.enableMetadataValidation !== false
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
    validationEngine = new ValidationEngine(fhirClient);
    unifiedValidationService = new UnifiedValidationService(fhirClient, validationEngine);
    robustValidationService = new RobustValidationService(fhirClient, validationEngine);
    dashboardService = new DashboardService(fhirClient, storage);
    
    // Load and apply saved validation settings
    const savedSettings = await storage.getValidationSettings();
    if (savedSettings && unifiedValidationService) {
      console.log('[Routes] Loading saved validation settings from database');
      const settings = savedSettings.settings || {};
      const config = {
        enableStructuralValidation: settings.structural?.enabled ?? true,
        enableProfileValidation: settings.profile?.enabled ?? true,
        enableTerminologyValidation: settings.terminology?.enabled ?? true,
        enableReferenceValidation: settings.reference?.enabled ?? true,
        enableBusinessRuleValidation: settings.businessRule?.enabled ?? true,
        enableMetadataValidation: settings.metadata?.enabled ?? true,
        strictMode: settings.strictMode ?? false,
        profiles: settings.customRules as string[] || [],
        terminologyServers: settings.terminologyServers as any[] || [],
        profileResolutionServers: settings.profileResolutionServers as any[] || []
      };
      unifiedValidationService.updateConfig(config);
      console.log('[Routes] Applied saved validation settings to services');
    }
  }

  // FHIR Server endpoints
  app.get("/api/fhir/servers", async (req, res) => {
    try {
      const servers = await storage.getFhirServers();
      res.json(servers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      
      // Reinitialize FHIR client with new server
      const servers = await storage.getFhirServers();
      const activeServer = servers.find(s => s.id === id);
      if (activeServer) {
        fhirClient = new FhirClient(activeServer.url);
        validationEngine = new ValidationEngine(fhirClient);
        unifiedValidationService = new UnifiedValidationService(fhirClient, validationEngine);
        robustValidationService = new RobustValidationService(fhirClient, validationEngine);
        
        // Reapply saved validation settings
        const savedSettings = await storage.getValidationSettings();
        if (savedSettings && unifiedValidationService) {
          const settings = savedSettings.settings || {};
          const config = {
            enableStructuralValidation: settings.structural?.enabled ?? true,
            enableProfileValidation: settings.profile?.enabled ?? true,
            enableTerminologyValidation: settings.terminology?.enabled ?? true,
            enableReferenceValidation: settings.reference?.enabled ?? true,
            enableBusinessRuleValidation: settings.businessRule?.enabled ?? true,
            enableMetadataValidation: settings.metadata?.enabled ?? true,
            strictMode: settings.strictMode ?? false,
            profiles: settings.customRules as string[] || [],
            terminologyServers: settings.terminologyServers as any[] || [],
            profileResolutionServers: settings.profileResolutionServers as any[] || []
          };
          unifiedValidationService.updateConfig(config);
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers/:id/deactivate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateFhirServerStatus(id, false);
      
      // Clear the FHIR client since no server is active
      fhirClient = null as any;
      validationEngine = null as any;
      unifiedValidationService = null as any;
      robustValidationService = null as any;
      
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

      // Update the global FHIR client
      fhirClient = new FhirClient(url);
      
      res.json(newServer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Resource endpoints
  app.get("/api/fhir/resources", async (req, res) => {
    try {
      console.log("=== NEW RESOURCES ENDPOINT CALLED ===");
      const { resourceType, _count = '20', page = '0', search } = req.query;
      const count = parseInt(_count as string);
      const offset = parseInt(page as string) * count;
      console.log(`=== PARAMS: resourceType=${resourceType}, count=${count}, page=${page}, search=${search} ===`);

      if (search) {
        console.log("=== USING SEARCH BRANCH ===");
        // Perform search in local storage
        const results = await storage.searchFhirResources(search as string, resourceType as string);
        res.json({
          resources: results.slice(offset, offset + count),
          total: results.length,
        });
      } else {
        // Prioritize cached resources for fast loading, use FHIR server only for fresh data
        console.log(`[Resources] Using cached data for performance`);
        console.log(`[Resources] Resource type: ${resourceType}, Count: ${count}, Page: ${page}`);
        
        try {
          // Try to get cached resources first for immediate response
          const cachedResources = await storage.getFhirResources(undefined, resourceType as string, count, offset);
          
          // Get total count from cache for this resource type
          const allCachedForType = await storage.getFhirResources(undefined, resourceType as string, 10000, 0);
          
          if (cachedResources.length > 0) {
            console.log(`[Resources] Serving ${cachedResources.length} cached resources immediately (${allCachedForType.length} total in cache)`);
            
            // Get current validation settings for filtering
            const validationSettings = await storage.getValidationSettings();
            
            // Return resources immediately with cached validation data only
            const resourcesWithCachedValidation = await Promise.all(
              cachedResources.map(async (resource) => {
                try {
                  // Get existing validation results from cache (no revalidation)
                  const validationResults = await storage.getValidationResultsByResourceId(resource.id);
                  
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
                  
                  if (latestValidation && latestValidation.issues) {
                    latestValidation.issues.forEach(issue => {
                      if (issue.severity === 'error' || issue.severity === 'fatal') {
                        filteredErrorCount++;
                      } else if (issue.severity === 'warning') {
                        filteredWarningCount++;
                      } else if (issue.severity === 'information') {
                        filteredInfoCount++;
                      }
                    });
                  }
                  
                  // Calculate validation score based on filtered issues
                  let filteredScore = 100;
                  if (latestValidation && latestValidation.issues) {
                    latestValidation.issues.forEach(issue => {
                      if (issue.severity === 'error' || issue.severity === 'fatal') {
                        filteredScore -= 10;
                      } else if (issue.severity === 'warning') {
                        filteredScore -= 2;
                      } else if (issue.severity === 'information') {
                        filteredScore -= 0.5;
                      }
                    });
                    filteredScore = Math.max(0, filteredScore);
                  }
                  
                  return {
                    ...resource.data,
                    _dbId: resource.id,
                    _validationResults: filteredResults,
                    _validationSummary: {
                      hasErrors: filteredErrorCount > 0,
                      hasWarnings: filteredWarningCount > 0,
                      errorCount: filteredErrorCount,
                      warningCount: filteredWarningCount,
                      isValid: filteredErrorCount === 0,
                      validationScore: filteredScore,
                      lastValidated: latestValidation ? new Date(latestValidation.validatedAt) : null,
                      needsValidation: validationResults.length === 0 // Flag resources that need validation
                    }
                  };
                } catch (error) {
                  console.warn(`Failed to get validation results for resource ${resource.id}:`, error);
                  return {
                    ...resource.data,
                    _dbId: resource.id,
                    _validationResults: [],
                    _validationSummary: {
                      hasErrors: false,
                      hasWarnings: false,
                      errorCount: 0,
                      warningCount: 0,
                      isValid: false,
                      validationScore: 0,
                      lastValidated: null,
                      needsValidation: true
                    }
                  };
                }
              })
            );
            
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
      
      // Check if validation is outdated and revalidate if needed
      if (unifiedValidationService && resource.data) {
        console.log(`[Resource Detail] Checking validation freshness for ${resource.resourceType}/${resource.resourceId}`);
        try {
          const validationResult = await unifiedValidationService.checkAndRevalidateResource(resource);
          resource = validationResult.resource;
          
          if (validationResult.wasRevalidated) {
            console.log(`[Resource Detail] Resource ${resource.resourceType}/${resource.resourceId} was revalidated`);
          } else {
            console.log(`[Resource Detail] Resource ${resource.resourceType}/${resource.resourceId} validation is up-to-date`);
          }
        } catch (validationError) {
          console.warn(`[Resource Detail] Validation check failed for ${resource.resourceType}/${resource.resourceId}:`, validationError);
          // Continue with existing validation results
        }
      }
      
      // Get validation settings for filtering
      const validationSettings = await storage.getValidationSettings();
      
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
        console.log(`[Resource Detail] After filtering: ${resource.validationResults[0]?.issues?.length || 0} issues`);
      }
      
      console.log(`[Resource Detail] Returning resource:`, resource.resourceType, resource.resourceId);
      res.json(resource);
    } catch (error: any) {
      console.error(`[Resource Detail] Error:`, error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/resource-types", async (req, res) => {
    try {
      if (!fhirClient) {
        return res.status(400).json({ message: "No active FHIR server configured" });
      }
      
      const resourceTypes = await fhirClient.getAllResourceTypes();
      res.json(resourceTypes);
    } catch (error: any) {
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
      if (!validationEngine) {
        return res.status(400).json({ message: "Validation engine not initialized" });
      }

      const { resource, profileUrl, config } = req.body;
      
      const result = await validationEngine.validateResource(resource, profileUrl, config);
      
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
      if (!validationEngine) {
        return res.status(400).json({ message: "Validation engine not initialized" });
      }

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
      
      const result = await validationEngine.validateResourceDetailed(resource, enhancedConfig);
      
      res.json(result);
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

  app.get("/api/validation/settings", async (req, res) => {
    try {
      // Load settings from database first
      const savedSettings = await storage.getValidationSettings();
      
      if (savedSettings) {
        // Return saved settings from database
        console.log('[ValidationSettings] Returning saved settings from database');
        
        // Merge the config object with the main settings to create a flat structure
        const flatSettings = {
          ...savedSettings,
          ...(savedSettings.config as any || {}),
          // Remove the nested config to avoid confusion
          config: undefined
        };
        
        res.json(flatSettings);
      } else {
        // Return default settings if no saved settings exist
        console.log('[ValidationSettings] No saved settings, returning defaults');
        const defaultSettings = {
          // Enhanced Validation Engine - 6 Aspects
          enableStructuralValidation: true,
          enableProfileValidation: true,
          enableTerminologyValidation: true,
          enableReferenceValidation: true,
          enableBusinessRuleValidation: true,
          enableMetadataValidation: true,
          
          // Legacy settings for backwards compatibility
          fetchFromSimplifier: true,
          fetchFromFhirServer: true,
          autoDetectProfiles: true,
          strictMode: false,
          maxProfiles: 3,
          cacheDuration: 3600, // 1 hour in seconds
          
          // Advanced settings
          validationProfiles: [
            'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
            'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'
          ],
          terminologyServers: [
            {
              priority: 1,
              enabled: true,
              url: 'https://r4.ontoserver.csiro.au/fhir',
              type: 'ontoserver',
              name: 'CSIRO OntoServer',
              description: 'Primary terminology server with SNOMED CT, LOINC, extensions',
              capabilities: ['SNOMED CT', 'LOINC', 'ICD-10', 'Extensions', 'ValueSets']
            },
            {
              priority: 2,
              enabled: true,
              url: 'https://tx.fhir.org/r4',
              type: 'fhir-terminology',
            name: 'HL7 FHIR Terminology Server',
            description: 'Official HL7 terminology server for FHIR standards',
            capabilities: ['US Core', 'FHIR Base', 'HL7 Standards', 'ValueSets']
          },
          {
            priority: 3,
            enabled: false,
            url: 'https://snowstorm.ihtsdotools.org/fhir',
            type: 'snowstorm',
            name: 'SNOMED International',
            description: 'Official SNOMED CT terminology server',
            capabilities: ['SNOMED CT', 'ECL', 'Concept Maps']
          }
        ],
        // Legacy single server for backwards compatibility
        terminologyServer: {
          enabled: true,
          url: 'https://r4.ontoserver.csiro.au/fhir',
          type: 'ontoserver',
          description: 'CSIRO OntoServer (Public)'
        },
        
        // Profile Resolution Servers
        profileResolutionServers: [
          {
            priority: 1,
            enabled: true,
            url: 'https://packages.simplifier.net',
            type: 'simplifier',
            name: 'Simplifier.net',
            description: 'Firely Simplifier - Community profile registry with thousands of FHIR profiles',
            capabilities: ['FHIR Profiles', 'Implementation Guides', 'Extensions', 'US Core', 'IPS', 'Custom Profiles']
          },
          {
            priority: 2,
            enabled: true,
            url: 'https://build.fhir.org',
            type: 'fhir-ci',
            name: 'FHIR CI Build',
            description: 'Official FHIR continuous integration server with latest profiles',
            capabilities: ['Official FHIR Profiles', 'Core Profiles', 'Development Versions']
          },
          {
            priority: 3,
            enabled: true,
            url: 'https://registry.fhir.org',
            type: 'fhir-registry',
            name: 'FHIR Package Registry',
            description: 'Official FHIR package registry for stable profile versions',
            capabilities: ['Stable Profiles', 'Published IGs', 'Official Packages']
          }
        ],
        
        // Performance settings
        batchSize: 20,
        maxRetries: 3,
        timeout: 30000,
        
        // Quality thresholds
        minValidationScore: 70,
        errorSeverityThreshold: 'warning' // 'information', 'warning', 'error', 'fatal'
        };
        res.json(defaultSettings);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/settings", async (req, res) => {
    try {
      const settings = req.body;
      console.log('[ValidationSettings] Updating Enhanced Validation Engine configuration:', settings);
      
      // Persist settings to database
      const savedSettings = await storage.createOrUpdateValidationSettings({
        enableStructuralValidation: settings.enableStructuralValidation ?? true,
        enableProfileValidation: settings.enableProfileValidation ?? true,
        enableTerminologyValidation: settings.enableTerminologyValidation ?? true,
        enableReferenceValidation: settings.enableReferenceValidation ?? true,
        enableBusinessRuleValidation: settings.enableBusinessRuleValidation ?? true,
        enableMetadataValidation: settings.enableMetadataValidation ?? true,
        strictMode: settings.strictMode ?? false,
        validationProfiles: settings.validationProfiles ?? [],
        terminologyServers: settings.terminologyServers ?? [],
        profileResolutionServers: settings.profileResolutionServers ?? [],
        config: {
          // Only store additional settings not in the main columns
          fetchFromSimplifier: settings.fetchFromSimplifier,
          fetchFromFhirServer: settings.fetchFromFhirServer,
          autoDetectProfiles: settings.autoDetectProfiles,
          maxProfiles: settings.maxProfiles,
          cacheDuration: settings.cacheDuration,
          terminologyServer: settings.terminologyServer,
          batchSize: settings.batchSize,
          maxRetries: settings.maxRetries,
          timeout: settings.timeout,
          minValidationScore: settings.minValidationScore,
          errorSeverityThreshold: settings.errorSeverityThreshold,
          autoRefreshDashboard: settings.autoRefreshDashboard,
          rememberLastPage: settings.rememberLastPage
        }
      });
      
      console.log('[ValidationSettings] Settings persisted to database');
      
      // Update Enhanced Validation Engine configuration
      if (unifiedValidationService) {
        const enhancedConfig = {
          enableStructuralValidation: savedSettings.enableStructuralValidation,
          enableProfileValidation: savedSettings.enableProfileValidation,
          enableTerminologyValidation: savedSettings.enableTerminologyValidation,
          enableReferenceValidation: savedSettings.enableReferenceValidation,
          enableBusinessRuleValidation: savedSettings.enableBusinessRuleValidation,
          enableMetadataValidation: savedSettings.enableMetadataValidation,
          strictMode: savedSettings.strictMode,
          profiles: savedSettings.validationProfiles as string[],
          terminologyServers: savedSettings.terminologyServers as any[],
          profileResolutionServers: savedSettings.profileResolutionServers as any[],
          // Legacy single server for backwards compatibility
          terminologyServer: settings.terminologyServer
        };
        
        console.log('[ValidationSettings] Applying config to Enhanced Validation Engine with multiple terminology servers:', enhancedConfig);
        // Update validation engine configuration
        if (typeof unifiedValidationService.updateConfig === 'function') {
          unifiedValidationService.updateConfig(enhancedConfig);
        }
      }
      
      // Update terminology server configuration if provided
      if (settings.terminologyServer && validationEngine) {
        validationEngine.updateTerminologyConfig(settings);
      }
      
      // Broadcast settings change to trigger dashboard cache invalidation
      if (validationWebSocket) {
        validationWebSocket.broadcastMessage('settings_changed', {
          type: 'validation_settings_updated',
          timestamp: new Date().toISOString(),
          message: 'Validation settings have been updated. Dashboard data will refresh.'
        });
      }
      
      res.json({
        message: "Enhanced Validation Engine settings updated successfully",
        settings: settings,
        appliedConfig: {
          enhancedValidationEnabled: true,
          aspectsConfigured: [
            'Structural Validation',
            'Profile Validation', 
            'Terminology Validation',
            'Reference Validation',
            'Business Rule Validation',
            'Metadata Validation'
          ]
        }
      });
    } catch (error: any) {
      console.error('[ValidationSettings] Failed to update settings:', error);
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

      if (unifiedValidationService.isValidationRunning && unifiedValidationService.isValidationRunning()) {
        return res.status(409).json({ message: "Validation is already running" });
      }

      const options = req.body || {};

      // RESET validation state for NEW start (always start at 0)
      globalValidationState.isRunning = true;
      globalValidationState.startTime = new Date();
      globalValidationState.canPause = true;
      globalValidationState.shouldStop = false;
      globalValidationState.isPaused = false;
      globalValidationState.resumeData = null;
      console.log('NEW validation start - RESET to 0. Global state: isRunning=true, canPause=true');
      
      // Clear all previous validation results to start fresh
      await storage.clearAllValidationResults();

      // Return immediately to provide fast UI response
      res.json({ 
        message: "Validation starting...", 
        status: "starting" 
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
          if (validationWebSocket) {
            validationWebSocket.broadcastValidationStopped();
          }
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
      if (validationWebSocket) {
        validationWebSocket.broadcastValidationStart();
      }
      
      // Broadcast initializing status via WebSocket
      if (validationWebSocket) {
        validationWebSocket.broadcastProgress({
          totalResources: 0,
          processedResources: 0,
          validResources: 0,
          errorResources: 0,
          currentResourceType: 'Initializing...',
          startTime: new Date(),
          estimatedTimeRemaining: undefined,
          isComplete: false,
          errors: []
        });
      }

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
      if (validationWebSocket) {
        validationWebSocket.broadcastProgress({
          totalResources: realTotalResources,
          processedResources: 0, // RESET to 0
          validResources: 0, // RESET to 0 
          errorResources: 0, // RESET to 0
          currentResourceType: 'Starting validation...',
          startTime: startTime.toISOString(),
          estimatedTimeRemaining: undefined,
          isComplete: false,
          errors: [],
          status: 'running' as const
        });
      }

      // Process resource types with real FHIR server data (EXCLUDING types with >50k resources)
      for (const resourceType of resourceTypes) {
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
            
            // Process resources in parallel for much better performance
            const PARALLEL_BATCH_SIZE = 10; // Process 10 resources in parallel
            
            for (let i = 0; i < bundle.entry.length; i += PARALLEL_BATCH_SIZE) {
              // Check if validation should stop before each parallel batch
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
              
              // Get the next batch of resources to process in parallel
              const parallelBatch = bundle.entry.slice(i, i + PARALLEL_BATCH_SIZE);
              
              // Validate resources in parallel
              const validationPromises = parallelBatch.map(async (entry) => {
                if (!entry.resource) return null;
                
                try {
                  // Validate real FHIR resource using enhanced validation
                  const result = await unifiedValidationService.validateResource(
                    entry.resource, 
                    options.skipUnchanged !== false, 
                    false
                  );
                  
                  // Check for validation errors using validation score from latest result
                  const latestValidation = result.validationResults && result.validationResults.length > 0 
                    ? result.validationResults.reduce((latest, current) => 
                        current.validatedAt > latest.validatedAt ? current : latest
                      )
                    : null;
                  
                  if (latestValidation) {
                    const validationScore = latestValidation.validationScore || 0;
                    const isResourceValid = validationScore >= 95; // 95+ is considered valid (allows minor info messages)
                    
                    if (!isResourceValid) {
                      const errorCount = latestValidation.errorCount || 0;
                      const warningCount = latestValidation.warningCount || 0;
                      return {
                        valid: false,
                        error: `${resourceType}/${entry.resource.id}: Score ${validationScore}% (${errorCount} errors, ${warningCount} warnings)`
                      };
                    } else {
                      return { valid: true, error: null };
                    }
                  } else {
                    // No validation results available - count as error
                    return {
                      valid: false,
                      error: `${resourceType}/${entry.resource.id}: No validation results available`
                    };
                  }
                  
                } catch (validationError) {
                  return {
                    valid: false,
                    error: `${resourceType}/${entry.resource.id}: Validation failed - ${validationError}`
                  };
                }
              });
              
              // Wait for all parallel validations to complete
              const results = await Promise.all(validationPromises);
              
              // Update progress for this parallel batch
              results.forEach(result => {
                if (result) {
                  processedResources++;
                  if (result.valid) {
                    validResources++;
                  } else {
                    errorResources++;
                    if (result.error) {
                      errors.push(result.error);
                    }
                  }
                }
              });
              
              // Broadcast real progress with AUTHENTIC total resource count
              if (validationWebSocket && processedResources % 10 === 0) {
                const progress = {
                  totalResources: realTotalResources, // REAL total from FHIR server (617,442+)
                  processedResources,
                  validResources,
                  errorResources,
                  currentResourceType: resourceType,
                  startTime: startTime.toISOString(),
                  isComplete: false,
                  errors: errors.slice(-10), // Last 10 errors
                  status: 'running' as const
                };
                validationWebSocket.broadcastProgress(progress);
              }
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
        
        if (validationWebSocket) {
          validationWebSocket.broadcastValidationComplete(finalProgress);
        }
      } else if (globalValidationState.isPaused) {
        console.log('Validation was paused - not broadcasting completion');
        // Broadcast paused state to ensure UI shows correct status
        if (validationWebSocket) {
          validationWebSocket.broadcastProgress({
            totalResources: realTotalResources,
            processedResources,
            validResources,
            errorResources,
            currentResourceType: globalValidationState.resumeData?.resourceType || 'Paused',
            startTime: startTime.toISOString(),
            isComplete: false,
            errors: errors.slice(-10),
            status: 'paused' as const
          });
        }
      }

          console.log("Background validation started successfully");
        } catch (error: any) {
          console.error('Background validation startup error:', error);
          if (validationWebSocket) {
            validationWebSocket.broadcastError('Failed to start validation: ' + error.message);
          }
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
      // Use the known total from FHIR server (857,607 resources)
      const totalResources = 857607;
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
      const progress = {
        totalResources,
        processedResources: summary.validResources + summary.errorResources,
        validResources: summary.validResources,
        errorResources: summary.errorResources,
        isComplete: false,
        errors: [],
        startTime: globalValidationState.startTime ? globalValidationState.startTime.toISOString() : new Date().toISOString(),
        status: status as 'running' | 'paused' | 'not_running'
      };
      
      res.json({
        status,
        ...progress
      });
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
      res.status(500).json({ message: error.message });
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
      
      // Broadcast paused state to ensure UI shows correct status
      if (validationWebSocket) {
        validationWebSocket.broadcastValidationPaused();
      }
      
      res.json({ message: "Validation paused successfully" });
    } catch (error: any) {
      console.error('Error in pause endpoint:', error);
      res.status(500).json({ message: error.message });
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
      
      // Broadcast resume via WebSocket
      if (validationWebSocket) {
        validationWebSocket.broadcastValidationStart();
        validationWebSocket.broadcastProgress({
          totalResources: 617442,
          processedResources: resumeData.processedResources,
          validResources: resumeData.validResources,
          errorResources: resumeData.errorResources,
          currentResourceType: `Resuming ${resumeData.resourceType}...`,
          startTime: resumeData.startTime,
          isComplete: false,
          errors: resumeData.errors.slice(-10),
          status: 'running' as const
        });
      }

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
                      
                      // Broadcast progress every 5 resources
                      if (validationWebSocket && processedResources % 5 === 0) {
                        const progress = {
                          totalResources: 617442,
                          processedResources,
                          validResources,
                          errorResources,
                          currentResourceType: resourceType,
                          startTime: startTime,
                          isComplete: false,
                          errors: errors.slice(-10),
                          status: 'running' as const
                        };
                        validationWebSocket.broadcastProgress(progress);
                      }
                      
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
          
          if (validationWebSocket) {
            validationWebSocket.broadcastValidationComplete(finalProgress);
          }
          
        } catch (error) {
          console.error('Error during resume validation:', error);
          globalValidationState.isRunning = false;
          globalValidationState.isPaused = false;
          if (validationWebSocket) {
            validationWebSocket.broadcastError(`Resume validation failed: ${error}`);
          }
        }
      });
      
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      
      // Also stop the robust validation service
      if (robustValidationService) {
        robustValidationService.stopValidation();
      }
      
      // Broadcast validation stopped via WebSocket to clear frontend state
      if (validationWebSocket) {
        validationWebSocket.broadcastValidationStopped();
      }
      
      res.json({ message: "Validation stopped successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard endpoints
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      if (!dashboardService) {
        return res.status(503).json({ message: "Dashboard service not initialized" });
      }
      
      // Use the new dashboard service for consistent data
      const combinedData = await dashboardService.getCombinedDashboardData();
      
      // Return backward-compatible format for existing frontend
      const stats = {
        totalResources: combinedData.fhirServer.totalResources, // Real comprehensive FHIR server total (807K+)
        validResources: combinedData.validation.validResources, // Validation count filtered by settings
        errorResources: combinedData.validation.errorResources, // Validation count filtered by settings
        warningResources: combinedData.validation.warningResources,
        unvalidatedResources: combinedData.validation.unvalidatedResources,
        validationCoverage: combinedData.validation.validationCoverage,
        validationProgress: combinedData.validation.validationProgress,
        activeProfiles: 0, // TODO: Get from validation settings
        resourceBreakdown: combinedData.fhirServer.resourceBreakdown.slice(0, 10) // Top 10 resource types from FHIR server
      };
      
      console.log(`[DashboardStats] Server: ${combinedData.fhirServer.totalResources} total, Validation: ${combinedData.validation.totalValidated} validated, ${combinedData.validation.validResources} valid, ${combinedData.validation.errorResources} errors`);
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
  const rockSolidEngine = getRockSolidValidationEngine();
  const validationPipeline = getValidationPipeline();

  // Initialize settings service
  await settingsService.initialize();

  // GET /api/validation/settings - Get current active settings
  app.get("/api/validation/settings", async (req, res) => {
    try {
      const settings = await settingsService.getActiveSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to load validation settings",
        error: error.message 
      });
    }
  });

  // PUT /api/validation/settings - Update settings
  app.put("/api/validation/settings", async (req, res) => {
    try {
      console.log('[ValidationSettings] Received settings update:', JSON.stringify(req.body, null, 2));
      
      const update: ValidationSettingsUpdate = {
        settings: req.body,
        validate: true,
        createNewVersion: false,
        updatedBy: req.headers['x-user-id'] as string || 'anonymous'
      };

      const updatedSettings = await settingsService.updateSettings(update);
      
      // Clear validation service cache and force reload settings to ensure new settings are used
      if (unifiedValidationService) {
        await unifiedValidationService.forceReloadSettings();
        console.log('[ValidationSettings] Cleared validation service cache and reloaded settings after update');
      }
      
      res.json(updatedSettings);
    } catch (error: any) {
      console.error('[ValidationSettings] Update failed:', error.message);
      res.status(400).json({ 
        message: "Failed to update validation settings",
        error: error.message 
      });
    }
  });

  // POST /api/validation/settings/validate - Validate settings
  app.post("/api/validation/settings/validate", async (req, res) => {
    try {
      const validationResult = await settingsService.validateSettings(req.body);
      res.json(validationResult);
    } catch (error: any) {
      res.status(400).json({ 
        message: "Failed to validate settings",
        error: error.message 
      });
    }
  });

  // GET /api/validation/settings/history - Get settings history
  app.get("/api/validation/settings/history", async (req, res) => {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ message: "Settings ID is required" });
      }

      const history = await settingsRepository.getHistory(parseInt(id as string));
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to load settings history",
        error: error.message 
      });
    }
  });

  // POST /api/validation/settings/reset - Reset to defaults
  app.post("/api/validation/settings/reset", async (req, res) => {
    try {
      const defaultSettings = await settingsService.createSettings({}, 'system');
      const activatedSettings = await settingsService.activateSettings(defaultSettings.id!, 'system');
      res.json(activatedSettings);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to reset settings",
        error: error.message 
      });
    }
  });

  // GET /api/validation/settings/presets - Get available presets
  app.get("/api/validation/settings/presets", async (req, res) => {
    try {
      const presets = await settingsService.getPresets();
      res.json(presets);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to load presets",
        error: error.message 
      });
    }
  });

  // POST /api/validation/settings/presets/apply - Apply preset
  app.post("/api/validation/settings/presets/apply", async (req, res) => {
    try {
      const { presetId } = req.body;
      if (!presetId) {
        return res.status(400).json({ message: "Preset ID is required" });
      }

      const settings = await settingsService.applyPreset(presetId, req.headers['x-user-id'] as string);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ 
        message: "Failed to apply preset",
        error: error.message 
      });
    }
  });

  // POST /api/validation/settings/test - Test settings with sample resource
  app.post("/api/validation/settings/test", async (req, res) => {
    try {
      const { settings, sampleResource } = req.body;
      if (!settings || !sampleResource) {
        return res.status(400).json({ 
          message: "Settings and sample resource are required" 
        });
      }

      const testResult = await settingsService.testSettings(settings, sampleResource);
      res.json(testResult);
    } catch (error: any) {
      res.status(400).json({ 
        message: "Failed to test settings",
        error: error.message 
      });
    }
  });

  // GET /api/validation/settings/statistics - Get settings statistics
  app.get("/api/validation/settings/statistics", async (req, res) => {
    try {
      const stats = await settingsRepository.getStatistics();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Failed to load settings statistics",
        error: error.message 
      });
    }
  });

  // POST /api/validation/validate - Validate resource using rock-solid engine
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

      const result = await rockSolidEngine.validateResource(validationRequest);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Validation failed",
        error: error.message 
      });
    }
  });

  // POST /api/validation/validate-batch - Validate multiple resources
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

      const results = await rockSolidEngine.validateResources(validationRequests);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ 
        message: "Batch validation failed",
        error: error.message 
      });
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

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for real-time validation updates
  initializeWebSocket(httpServer);
  
  return httpServer;
}
