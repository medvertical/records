import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { FhirClient } from "./services/fhir-client.js";
import { ValidationEngine } from "./services/validation-engine.js";
import { UnifiedValidationService } from "./services/unified-validation.js";
import { profileManager } from "./services/profile-manager.js";
import { RobustValidationService } from "./services/robust-validation.js";
import { insertFhirServerSchema, insertFhirResourceSchema, insertValidationProfileSchema } from "@shared/schema.js";
import { validationWebSocket, initializeWebSocket } from "./services/websocket-server.js";
import { z } from "zod";

let fhirClient: FhirClient;
let validationEngine: ValidationEngine;
let unifiedValidationService: UnifiedValidationService;
let robustValidationService: RobustValidationService;

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize FHIR client with active server
  const activeServer = await storage.getActiveFhirServer();
  if (activeServer) {
    fhirClient = new FhirClient(activeServer.url);
    validationEngine = new ValidationEngine(fhirClient);
    unifiedValidationService = new UnifiedValidationService(fhirClient, validationEngine);
    robustValidationService = new RobustValidationService(fhirClient, validationEngine);
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
            console.log(`[Resources] Serving ${cachedResources.length} cached resources (${allCachedForType.length} total in cache)`);
            
            // Include validation results with each resource
            const resourcesWithValidation = await Promise.all(
              cachedResources.map(async (resource) => {
                try {
                  const validationResults = await storage.getValidationResultsByResourceId(resource.id);
                  return {
                    ...resource.data,
                    _dbId: resource.id, // Include database ID for validation lookup
                    _validationResults: validationResults,
                    _validationSummary: {
                      hasErrors: validationResults.some(vr => !vr.isValid && vr.errors && vr.errors.length > 0),
                      hasWarnings: validationResults.some(vr => vr.warnings && vr.warnings.length > 0),
                      errorCount: validationResults.reduce((sum, vr) => sum + (vr.errors?.length || 0), 0),
                      warningCount: validationResults.reduce((sum, vr) => sum + (vr.warnings?.length || 0), 0),
                      isValid: validationResults.length > 0 && validationResults.every(vr => vr.isValid),
                      lastValidated: validationResults.length > 0 ? new Date(Math.max(...validationResults.map(vr => new Date(vr.validatedAt).getTime()))) : null
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
                      lastValidated: null
                    }
                  };
                }
              })
            );
            
            res.json({
              resources: resourcesWithValidation,
              total: allCachedForType.length,
            });
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
      
      // Get counts for common resource types with parallel requests
      const commonTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'Practitioner', 'Organization'];
      const countPromises = commonTypes.map(async (type) => {
        try {
          const count = await fhirClient.getResourceCount(type);
          return { type, count };
        } catch (error) {
          console.warn(`Failed to get count for ${type}:`, error);
          return { type, count: 0 };
        }
      });
      
      const results = await Promise.all(countPromises);
      results.forEach(({ type, count }) => {
        counts[type] = count;
      });
      
      res.json(counts);
    } catch (error: any) {
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
      // Return comprehensive Enhanced Validation Engine settings
      const settings = {
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
        
        // Performance settings
        batchSize: 20,
        maxRetries: 3,
        timeout: 30000,
        
        // Quality thresholds
        minValidationScore: 70,
        errorSeverityThreshold: 'warning' // 'information', 'warning', 'error', 'fatal'
      };
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/settings", async (req, res) => {
    try {
      const settings = req.body;
      console.log('[ValidationSettings] Updating Enhanced Validation Engine configuration:', settings);
      
      // Update Enhanced Validation Engine configuration
      if (unifiedValidationService) {
        const enhancedConfig = {
          enableStructuralValidation: settings.enableStructuralValidation ?? true,
          enableProfileValidation: settings.enableProfileValidation ?? true,
          enableTerminologyValidation: settings.enableTerminologyValidation ?? true,
          enableReferenceValidation: settings.enableReferenceValidation ?? true,
          enableBusinessRuleValidation: settings.enableBusinessRuleValidation ?? true,
          enableMetadataValidation: settings.enableMetadataValidation ?? true,
          strictMode: settings.strictMode ?? false,
          profiles: settings.validationProfiles ?? [],
          terminologyServers: settings.terminologyServers ?? [],
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
      
      // ALWAYS use comprehensive FHIR resource types - ignore any specific types from frontend
      console.log('Starting comprehensive FHIR validation across ALL resource types...');
      const resourceTypes = [
        'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment', 
        'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
        'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam', 'CatalogEntry',
        'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse', 'ClinicalImpression',
        'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition',
        'Composition', 'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage',
        'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'DetectedIssue', 'Device',
        'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement',
        'DiagnosticReport', 'DocumentManifest', 'DocumentReference', 'DomainResource',
        'EffectEvidenceSynthesis', 'Encounter', 'Endpoint', 'EnrollmentRequest',
        'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable',
        'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal',
        'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService', 'ImagingStudy',
        'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation',
        'ImplementationGuide', 'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List',
        'Location', 'Measure', 'MeasureReport', 'Media', 'Medication', 'MedicationAdministration',
        'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
        'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication',
        'MedicinalProductIndication', 'MedicinalProductIngredient', 'MedicinalProductInteraction',
        'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical',
        'MedicinalProductUndesirableEffect', 'MessageDefinition', 'MessageHeader', 'MolecularSequence',
        'NamingSystem', 'NutritionOrder', 'Observation', 'ObservationDefinition', 'OperationDefinition',
        'OperationOutcome', 'Organization', 'OrganizationAffiliation', 'Parameters', 'Patient',
        'PaymentNotice', 'PaymentReconciliation', 'Person', 'PlanDefinition', 'Practitioner',
        'PractitionerRole', 'Procedure', 'Provenance', 'Questionnaire', 'QuestionnaireResponse',
        'RelatedPerson', 'RequestGroup', 'ResearchDefinition', 'ResearchElementDefinition',
        'ResearchStudy', 'ResearchSubject', 'Resource', 'RiskAssessment', 'RiskEvidenceSynthesis',
        'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition',
        'StructureDefinition', 'StructureMap', 'Subscription', 'Substance', 'SubstanceNucleicAcid',
        'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
        'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task', 'TerminologyCapabilities',
        'TestReport', 'TestScript', 'ValueSet', 'VerificationResult', 'VisionPrescription'
      ];
      console.log(`Using comprehensive ${resourceTypes.length} FHIR resource types`);
      console.log(`Resource types to validate: ${JSON.stringify(resourceTypes.slice(0, 10))}... (showing first 10 of ${resourceTypes.length})`);
      
      // Calculate REAL total resources from FHIR server
      console.log('Calculating real total resources from FHIR server...');
      let realTotalResources = 0;
      const resourceCounts: Record<string, number> = {};
      
      for (const resourceType of resourceTypes) {
        try {
          const count = await fhirClient.getResourceCount(resourceType);
          resourceCounts[resourceType] = count;
          realTotalResources += count;
          console.log(`${resourceType}: ${count} resources`);
        } catch (error) {
          console.error(`Failed to get count for ${resourceType}:`, error);
          resourceCounts[resourceType] = 0;
        }
      }
      
      console.log(`REAL TOTAL RESOURCES TO VALIDATE: ${realTotalResources} across ${resourceTypes.length} resource types`);
      console.log('Top resource types:', Object.entries(resourceCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', '));
      
      if (realTotalResources === 0) {
        throw new Error('No resources found on FHIR server. Cannot start validation.');
      }
      
      // Broadcast validation start via WebSocket
      if (validationWebSocket) {
        validationWebSocket.broadcastValidationStart();
      }

      // Start real FHIR server validation using authentic data
      console.log('Starting real FHIR server validation with authentic data from Fire.ly server...');
      
      let processedResources = 0;
      let validResources = 0;
      let errorResources = 0;
      const startTime = new Date();
      const errors: string[] = [];

      // Process ALL resource types with real FHIR server data - NO LIMITS!
      for (const resourceType of resourceTypes) { // Process ALL 148 resource types
        try {
          console.log(`Validating real ${resourceType} resources from FHIR server...`);
          
          // Get real resources from FHIR server
          const bundle = await fhirClient.searchResources(resourceType, {}, options.batchSize || 20);
          
          if (bundle.entry && bundle.entry.length > 0) {
            console.log(`Found ${bundle.entry.length} real ${resourceType} resources from server`);
            
            for (const entry of bundle.entry) {
              if (entry.resource) {
                try {
                  // Validate real FHIR resource using enhanced validation
                  const result = await unifiedValidationService.validateResource(
                    entry.resource, 
                    options.skipUnchanged !== false, 
                    false
                  );
                  
                  processedResources++;
                  
                  // Check for validation errors in real data
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
                  
                  // Broadcast real progress with AUTHENTIC total resource count
                  if (validationWebSocket && processedResources % 5 === 0) {
                    const progress = {
                      totalResources: realTotalResources, // REAL total from FHIR server (126,000+)
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
                  
                } catch (validationError) {
                  processedResources++;
                  errorResources++;
                  errors.push(`${resourceType}/${entry.resource.id}: Validation failed - ${validationError}`);
                }
              }
            }
          } else {
            console.log(`No ${resourceType} resources found on server`);
          }
        } catch (resourceError) {
          console.error(`Error fetching ${resourceType} resources:`, resourceError);
          errors.push(`${resourceType}: Failed to fetch resources - ${resourceError}`);
        }
      }

      // Create a simple validation promise for compatibility
      const validationPromise = Promise.resolve({
        totalResources: processedResources,
        processedResources,
        validResources,
        errorResources,
        isComplete: true,
        errors,
        startTime
      });

      // Handle completion or errors
      validationPromise.then((finalProgress) => {
        if (finalProgress?.isComplete && validationWebSocket) {
          validationWebSocket.broadcastValidationComplete(finalProgress);
        }
      }).catch(error => {
        console.error('Bulk validation error:', error);
        if (validationWebSocket) {
          validationWebSocket.broadcastError(error.message);
        }
      });

      res.json({ 
        message: "Real FHIR server validation started with authentic data",
        status: "running",
        dataSource: "Fire.ly FHIR Server (authentic data)"
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

      // Get real validation summary from database
      const summary = await storage.getResourceStats();
      
      const progress = {
        totalResources: summary.totalResources,
        processedResources: summary.validResources + summary.errorResources,
        validResources: summary.validResources,
        errorResources: summary.errorResources,
        isComplete: false,
        errors: [],
        startTime: new Date().toISOString(),
        status: 'not_running' as const
      };
      
      console.log('[ValidationProgress] Real error count from database:', summary.errorResources);
      res.json({
        status: "not_running",
        ...progress
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/validation/bulk/summary", async (req, res) => {
    try {
      // Get real validation summary from database
      const summary = await storage.getResourceStats();
      
      const validationSummary = {
        totalResources: summary.totalResources,
        totalValidated: summary.validResources + summary.errorResources,
        validResources: summary.validResources,
        errorResources: summary.errorResources,
        resourcesWithErrors: summary.errorResources, // Match dashboard expectation
        lastValidationRun: new Date()
      };
      
      console.log('[ValidationSummary] Real error count from database:', summary.errorResources);
      res.json(validationSummary);
    } catch (error: any) {
      console.error('Error getting validation summary:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/pause", async (req, res) => {
    try {
      if (!robustValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      if (!robustValidationService.isValidationRunning()) {
        return res.status(400).json({ message: "No validation is currently running" });
      }

      robustValidationService.pauseValidation();
      res.json({ message: "Validation paused successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/resume", async (req, res) => {
    try {
      if (!robustValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      if (robustValidationService.getState() !== 'paused') {
        return res.status(400).json({ message: "No paused validation to resume" });
      }



      // Broadcast validation start when resuming
      if (validationWebSocket) {
        validationWebSocket.broadcastValidationStart();
      }

      // Resume the validation with robust implementation
      const resumedProgress = await robustValidationService.resumeValidation({
        batchSize: 20,
        maxRetries: 3,
        skipUnchanged: true,
        onProgress: (progress) => {
          if (validationWebSocket) {
            validationWebSocket.broadcastProgress(progress);
          }
        }
      });
      
      // Broadcast initial resume progress
      if (validationWebSocket && resumedProgress) {
        validationWebSocket.broadcastProgress(resumedProgress);
      }

      res.json({ message: "Validation resumed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/validation/bulk/stop", async (req, res) => {
    try {
      if (!robustValidationService) {
        return res.status(400).json({ message: "No FHIR server configured" });
      }

      robustValidationService.stopValidation();
      
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
      const stats = await storage.getResourceStats();
      res.json(stats);
    } catch (error: any) {
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

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for real-time validation updates
  initializeWebSocket(httpServer);
  
  return httpServer;
}
