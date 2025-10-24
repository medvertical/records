import { storage } from "../../../../storage.js";
import * as ValidationGroupsRepository from "../../../../repositories/validation-groups-repository";

/**
 * Enhanced resource with validation data
 */
export interface EnhancedResource {
  [key: string]: any;
  resourceId: string;
  _dbId?: number;
  _validationSummary?: any;
}

/**
 * Enhance resources with validation data from the database
 * Adds validation summary and database IDs to resources
 * @param resources - Array of FHIR resources to enhance
 * @param includeValidation - Whether to fetch validation summaries (default: false for fast list loading)
 */
export async function enhanceResourcesWithValidationData(
  resources: any[], 
  includeValidation: boolean = false
): Promise<EnhancedResource[]> {
  const startTime = Date.now();
  console.log(`[FHIR API] enhanceResourcesWithValidationData called with ${resources.length} resources, includeValidation=${includeValidation}`);
  const enhancedResources: EnhancedResource[] = [];
  
  // Get active server once for all resources
  let activeServer;
  try {
    activeServer = await storage.getActiveFhirServer();
    console.log(`[FHIR API] Active server:`, activeServer?.id || 'none');
  } catch (serverError: any) {
    console.error(`[FHIR API] Failed to get active server:`, serverError.message);
    // Continue without server - resources will be added without DB entries
  }
  
  for (const resource of resources) {
    const resourceKey = `${resource.resourceType}/${resource.id}`;
    const resourceStartTime = Date.now();
    
    try {
      // Try to find the resource in our database
      let dbResource;
      try {
        dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
        console.log(`[FHIR API] DB lookup for ${resourceKey}: ${dbResource ? `Found (ID: ${dbResource.id})` : 'Not found'} (${Date.now() - resourceStartTime}ms)`);
      } catch (lookupError: any) {
        console.error(`[FHIR API] DB lookup failed for ${resourceKey}:`, {
          error: lookupError.message,
          code: lookupError.code,
          duration: Date.now() - resourceStartTime
        });
        // Continue without dbResource
      }
      
      // If resource doesn't exist in database, create it
      if (!dbResource && activeServer) {
        try {
          // Check for duplicate insert race condition with a quick re-check
          dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
          
          if (!dbResource) {
            const resourceData = {
              serverId: activeServer.id,
              resourceType: resource.resourceType,
              resourceId: resource.id,
              versionId: resource.meta?.versionId || '1',
              data: resource,
              resourceHash: null, // Will be calculated during validation
              lastValidated: null
            };
            
            dbResource = await storage.createFhirResource(resourceData);
            console.log(`[FHIR API] Created DB entry for ${resourceKey} (ID: ${dbResource.id}) (${Date.now() - resourceStartTime}ms)`);
          } else {
            console.log(`[FHIR API] ${resourceKey} created by concurrent request, using existing (${Date.now() - resourceStartTime}ms)`);
          }
        } catch (createError: any) {
          // Handle duplicate key errors gracefully (race condition)
          if (createError.code === '23505' || createError.message?.includes('duplicate')) {
            console.log(`[FHIR API] Duplicate key for ${resourceKey}, attempting to fetch existing (${Date.now() - resourceStartTime}ms)`);
            try {
              dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
            } catch (refetchError: any) {
              console.error(`[FHIR API] Failed to refetch after duplicate for ${resourceKey}:`, refetchError.message);
            }
          } else {
            console.error(`[FHIR API] Failed to create DB entry for ${resourceKey}:`, {
              error: createError.message,
              code: createError.code,
              detail: createError.detail,
              duration: Date.now() - resourceStartTime
            });
          }
        }
      }
      
      // Get validation summary if we have a dbResource and validation is requested
      let validationSummary = null;
      if (includeValidation && dbResource && activeServer) {
        try {
          validationSummary = await ValidationGroupsRepository.getResourceValidationSummary(
            activeServer.id,
            resource.resourceType,
            resource.id
          );
          
          if (validationSummary) {
            console.log(`[FHIR API] Validation summary for ${resourceKey}: ${validationSummary.errorCount} errors, ${validationSummary.warningCount} warnings (${Date.now() - resourceStartTime}ms)`);
          }
        } catch (validationError: any) {
          console.error(`[FHIR API] Failed to get validation summary for ${resourceKey}:`, {
            error: validationError.message,
            duration: Date.now() - resourceStartTime
          });
          // Continue without validation summary
        }
      }
      
      // Enhance the resource
      enhancedResources.push({
        ...resource,
        resourceId: resource.id,  // Map FHIR id to resourceId for consistency
        _dbId: dbResource?.id,
        _validationSummary: validationSummary
      });
      
    } catch (error: any) {
      console.error(`[FHIR API] Unexpected error enhancing ${resourceKey}:`, {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - resourceStartTime
      });
      // Add resource without validation data if enhancement fails
      enhancedResources.push({
        ...resource,
        resourceId: resource.id,
        _validationSummary: null
      });
    }
  }
  
  console.log(`[FHIR API] Enhanced ${enhancedResources.length} resources in ${Date.now() - startTime}ms`);
  return enhancedResources;
}

