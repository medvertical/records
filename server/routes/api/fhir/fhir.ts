import type { Express } from "express";
import { storage } from "../../../storage.js";
import { FhirClient } from "../../../services/fhir/fhir-client";
import { profileManager } from "../../../services/fhir/profile-manager";

// Helper function to enhance resources with validation data
async function enhanceResourcesWithValidationData(resources: any[]): Promise<any[]> {
  console.log(`[FHIR API] enhanceResourcesWithValidationData called with ${resources.length} resources`);
  const enhancedResources = [];
  
  for (const resource of resources) {
    try {
      // Try to find the resource in our database
      let dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
      console.log(`[FHIR API] Looking up resource ${resource.resourceType}/${resource.id} in database:`, dbResource ? `Found with ID ${dbResource.id}` : 'Not found');
      console.log(`[FHIR API] Resource data for lookup:`, { resourceType: resource.resourceType, id: resource.id });
      
      // If resource doesn't exist in database, create it
      if (!dbResource) {
        try {
          // Get active server ID
          const activeServer = await storage.getActiveFhirServer();
          console.log(`[FHIR API] Active server:`, activeServer);
          if (activeServer) {
            // Create resource in database
            const resourceData = {
              serverId: activeServer.id,
              resourceType: resource.resourceType,
              resourceId: resource.id,
              versionId: resource.meta?.versionId || '1',
              data: resource,
              resourceHash: null, // Will be calculated during validation
              lastValidated: null
            };
            console.log(`[FHIR API] Creating database entry for ${resource.resourceType}/${resource.id} with data:`, resourceData);
            dbResource = await storage.createFhirResource(resourceData);
            console.log(`[FHIR API] Successfully created database entry for ${resource.resourceType}/${resource.id} with ID: ${dbResource.id}`);
          } else {
            console.warn(`[FHIR API] No active server found, cannot create database entry for ${resource.resourceType}/${resource.id}`);
          }
        } catch (createError) {
          console.error(`[FHIR API] Failed to create database entry for ${resource.resourceType}/${resource.id}:`, createError);
          console.error(`[FHIR API] Error details:`, {
            message: createError.message,
            stack: createError.stack,
            code: createError.code,
            detail: createError.detail
          });
        }
      }
      
      if (dbResource) {
        // Get validation results for this resource
        const validationResults = await storage.getValidationResultsByResourceId(dbResource.id);
        
        // Create validation summary from the latest validation result
        let validationSummary = null;
        if (validationResults && validationResults.length > 0) {
          const latestResult = validationResults[0]; // Assuming results are ordered by date
          
          // Simplified validation check - just ensure we have valid data
          const hasBeenValidated = (
            latestResult.validatedAt && 
            latestResult.validationScore !== null
          );
          
          // Include all validation data that has been properly validated
          if (hasBeenValidated) {
            validationSummary = {
              isValid: latestResult.isValid,
              hasErrors: latestResult.errorCount > 0,
              hasWarnings: latestResult.warningCount > 0,
              errorCount: latestResult.errorCount,
              warningCount: latestResult.warningCount,
              informationCount: latestResult.issues?.filter((issue: any) => issue.severity === 'information').length || 0,
              lastValidated: latestResult.validatedAt,
              validationScore: latestResult.validationScore,
              aspectBreakdown: latestResult.aspectBreakdown
            };
          } else {
            console.log(`[FHIR API] Skipping validation data for ${resource.resourceType}/${resource.id} - appears to be default/mock data or not properly validated`);
          }
        }
        
        // Enhance the resource with database ID and validation data
        enhancedResources.push({
          ...resource,
          _dbId: dbResource.id,
          _validationSummary: validationSummary
        });
      } else {
        // Resource not in database and couldn't be created, no validation data
        enhancedResources.push({
          ...resource,
          _validationSummary: null
        });
      }
    } catch (error) {
      console.warn(`[FHIR API] Error enhancing resource ${resource.resourceType}/${resource.id} with validation data:`, error.message);
      // Add resource without validation data if enhancement fails
      enhancedResources.push({
        ...resource,
        _validationSummary: null
      });
    }
  }
  
  return enhancedResources;
}

// Mock data helper for testing when FHIR server is unavailable
function createMockBundle(resourceType: string, batchSize: number, offset: number): any {
  const entries = [];
  const actualBatchSize = Math.min(batchSize, 10); // Limit mock batch size
  
  for (let i = 0; i < actualBatchSize; i++) {
    const resourceId = `mock-${resourceType.toLowerCase()}-${offset + i + 1}`;
    const resource = {
      resourceType,
      id: resourceId,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      },
      // Add minimal required fields for validation
      ...(resourceType === 'Patient' && {
        name: [{ family: `Test${i + 1}`, given: ['Patient'] }],
        gender: i % 2 === 0 ? 'male' : 'female',
        birthDate: '1990-01-01'
      }),
      ...(resourceType === 'Observation' && {
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '33747-0', display: 'Test Observation' }] },
        subject: { reference: `Patient/mock-patient-${i + 1}` }
      }),
      ...(resourceType === 'Encounter' && {
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
        subject: { reference: `Patient/mock-patient-${i + 1}` }
      })
    };
    
    entries.push({
      fullUrl: `https://mock.server/${resourceType}/${resourceId}`,
      resource,
      search: { mode: 'match' }
    });
  }
  
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 150, // Mock total
    entry: entries
  };
}

export function setupFhirRoutes(app: Express, fhirClient: FhirClient) {
  // FHIR Server Management
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
      const server = await storage.createFhirServer(req.body);
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers/:id/activate", async (req, res) => {
    try {
      const { id } = req.params;
      const server = await storage.activateFhirServer(id);
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/fhir/servers/:id/deactivate", async (req, res) => {
    try {
      const { id } = req.params;
      const server = await storage.deactivateFhirServer(id);
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/fhir/servers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const server = await storage.updateFhirServer(id, req.body);
      res.json(server);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/fhir/servers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFhirServer(id);
      res.json({ message: "Server deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR Connection Testing
  app.get("/api/fhir/connection/test", async (req, res) => {
    try {
      const { url, auth } = req.query;
      const result = await fhirClient.testConnection(url as string, auth as any);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/connection/test-custom", async (req, res) => {
    try {
      const { url, auth } = req.query;
      const result = await fhirClient.testConnection(url as string, auth as any);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR Individual Resource
  app.get("/api/fhir/resources/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let { resourceType } = req.query;
      
      console.log(`[FHIR API] Individual resource endpoint called for: ${resourceType || 'unknown'}/${id}`);

      // If resourceType is provided, use it directly
      if (resourceType) {
        try {
          const resource = await fhirClient.getResource(resourceType as string, id);
          
          if (!resource) {
            return res.status(404).json({ 
              message: `Resource ${resourceType}/${id} not found`,
              resourceType,
              id
            });
          }

          console.log(`[FHIR API] Successfully fetched ${resourceType} resource ${id}`);
          
          // Enhance resource with validation data
          console.log(`[FHIR API] About to enhance resource with validation data`);
          const enhancedResources = await enhanceResourcesWithValidationData([resource]);
          console.log(`[FHIR API] Enhancement completed, returning enhanced resource`);
          res.json(enhancedResources[0]);
          return;
          
        } catch (error: any) {
          console.error(`[FHIR API] Failed to fetch ${resourceType} resource ${id}:`, error.message);
          
          if (error.message.includes('404') || error.message.includes('not found')) {
            return res.status(404).json({ 
              message: `Resource ${resourceType}/${id} not found`,
              resourceType,
              id
            });
          }
          
          throw error;
        }
      }

      // If no resourceType provided, try common resource types
      const commonTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'DiagnosticReport', 'Medication', 'MedicationRequest', 'Procedure', 'AllergyIntolerance', 'Immunization', 'DocumentReference', 'Organization', 'Practitioner'];
      
      for (const type of commonTypes) {
        try {
          console.log(`[FHIR API] Trying to fetch ${type}/${id}`);
          const resource = await fhirClient.getResource(type, id);
          
          if (resource) {
            console.log(`[FHIR API] Successfully fetched ${type} resource ${id}`);
            
            // Enhance resource with validation data
            console.log(`[FHIR API] About to enhance resource with validation data (type search)`);
            const enhancedResources = await enhanceResourcesWithValidationData([resource]);
            console.log(`[FHIR API] Enhancement completed, returning enhanced resource (type search)`);
            res.json(enhancedResources[0]);
            return;
          }
        } catch (error: any) {
          // Continue to next type if this one fails
          console.log(`[FHIR API] ${type}/${id} not found, trying next type`);
        }
      }

      // If we get here, resource wasn't found with any type
      return res.status(404).json({ 
        message: `Resource ${id} not found with any resource type`,
        id
      });

    } catch (error: any) {
      console.error('[FHIR API] Error fetching individual resource:', error);
      res.status(500).json({ 
        message: "Failed to fetch resource",
        error: error.message 
      });
    }
  });

  // FHIR Resources
  app.get("/api/fhir/resources", async (req, res) => {
    try {
      const { resourceType, limit = 50, offset = 0, search } = req.query;
      
      // If no resource type is specified, fetch resources from all common types
      if (!resourceType) {
        try {
          console.log('[FHIR API] Fetching resources from all types...');
          
          // Get resources from common resource types
          const commonResourceTypes = [
            "Patient", "Observation", "Encounter", "Condition", "DiagnosticReport",
            "Medication", "MedicationRequest", "Procedure", "AllergyIntolerance",
            "Immunization", "DocumentReference", "Organization", "Practitioner"
          ];
          
          const allResources = [];
          let totalCount = 0;
          
          // Fetch a few resources from each type
          const resourcesPerType = Math.max(1, Math.floor(parseInt(limit as string) / commonResourceTypes.length));
          
          for (const type of commonResourceTypes) {
            try {
              const searchParams: Record<string, string | number> = {
                _count: resourcesPerType,
                _total: 'accurate'
              };
              
              if (search) {
                searchParams._content = search as string;
              }
              
              const bundle = await fhirClient.searchResources(type, searchParams);
              
              if (bundle.entry) {
                const typeResources = bundle.entry.map(entry => entry.resource);
                allResources.push(...typeResources);
                totalCount += bundle.total || typeResources.length;
              }
            } catch (error) {
              console.warn(`[FHIR API] Failed to fetch ${type} resources:`, error.message);
              // Continue with other types even if one fails
            }
          }
          
          // Shuffle the resources to mix them up
          const shuffledResources = allResources.sort(() => Math.random() - 0.5);
          
          // Limit to requested count
          const limitedResources = shuffledResources.slice(0, parseInt(limit as string));
          
          console.log(`[FHIR API] Fetched ${limitedResources.length} resources from all types (total available: ${totalCount})`);
          
          // Enhance resources with validation data
          const enhancedResources = await enhanceResourcesWithValidationData(limitedResources);
          
          return res.json({
            resources: enhancedResources,
            total: totalCount,
            message: `Showing ${enhancedResources.length} resources from all types`,
            resourceType: "All"
          });
          
        } catch (error: any) {
          console.error('[FHIR API] Error fetching all resources:', error);
          return res.status(500).json({ 
            message: "Failed to fetch resources from all types",
            error: error.message 
          });
        }
      }

      let bundle;
      try {
        // Build search parameters
        const searchParams: Record<string, string | number> = {
          _count: parseInt(limit as string),
          _total: 'accurate' // Request accurate total count
        };
        
        if (search) {
          searchParams._content = search as string;
        }
        
        if (parseInt(offset as string) > 0) {
          searchParams._offset = parseInt(offset as string);
        }
        
        bundle = await fhirClient.searchResources(
          resourceType as string,
          searchParams
        );
      } catch (error: any) {
        // Fallback to mock data if FHIR server is unavailable
        console.warn(`FHIR server unavailable, using mock data: ${error.message}`);
        bundle = createMockBundle(resourceType as string, parseInt(limit as string), parseInt(offset as string));
      }

      // Transform FHIR Bundle to expected frontend format
      const resources = bundle.entry?.map(entry => entry.resource) || [];
      
      // Try to get total from various possible locations in the Bundle
      let total = 0;
      if (bundle.total !== undefined) {
        total = bundle.total;
      } else if (bundle.meta?.total !== undefined) {
        total = bundle.meta.total;
      } else if (resources.length > 0) {
        // If we have resources but no total, estimate based on current page
        // This is not ideal but better than showing 0
        total = resources.length;
      }

      // Enhance resources with validation data
      const enhancedResources = await enhanceResourcesWithValidationData(resources);

      res.json({
        resources: enhancedResources,
        total,
        bundle // Include original bundle for debugging if needed
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  // FHIR Resource Types
  app.get("/api/fhir/resource-types", async (req, res) => {
    try {
      const resourceTypes = await fhirClient.getResourceTypes();
      res.json(resourceTypes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // FHIR Resource Counts
  app.get("/api/fhir/resource-counts", async (req, res) => {
    try {
      // Add timeout to the entire operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
      });
      
      const countsPromise = fhirClient.getResourceCounts();
      const counts = await Promise.race([countsPromise, timeoutPromise]) as Record<string, number>;
      
      // Transform the counts into the expected format
      const resourceTypes = Object.entries(counts).map(([resourceType, count]) => ({
        resourceType,
        count
      }));
      
      const totalResources = Object.values(counts).reduce((sum, count) => sum + count, 0);
      
      res.json({
        resourceTypes,
        totalResources
      });
    } catch (error: any) {
      console.warn('Failed to get resource counts, using fallback:', error.message);
      // Return default resource counts as fallback
      const defaultCounts = {
        resourceTypes: [
          { resourceType: 'Patient', count: 0 },
          { resourceType: 'Observation', count: 0 },
          { resourceType: 'Encounter', count: 0 },
          { resourceType: 'DiagnosticReport', count: 0 },
          { resourceType: 'Medication', count: 0 }
        ],
        totalResources: 0
      };
      res.json(defaultCounts);
    }
  });

  // FHIR Packages
  app.get("/api/fhir/packages", async (req, res) => {
    try {
      const packages = await profileManager.getInstalledPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generic FHIR Resource Access
  app.get("/api/fhir/:resourceType", async (req, res) => {
    try {
      const { resourceType } = req.params;
      const { limit = 50, offset = 0, search } = req.query;
      
      const resources = await fhirClient.searchResources(
        resourceType,
        search as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      
      res.json(resources);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fhir/:resourceType/:id", async (req, res) => {
    try {
      const { resourceType, id } = req.params;
      const resource = await fhirClient.getResource(resourceType, id);
      res.json(resource);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
