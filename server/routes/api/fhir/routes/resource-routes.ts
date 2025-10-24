import type { Express } from "express";
import type { FhirClient } from "../../../../services/fhir/fhir-client";
import { db } from "../../../../db";
import { editAuditTrail, validationSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { validationQueue } from '../../../../services/validation/queue/validation-queue-simple';
import type { ValidationSettings } from '@shared/validation-settings';
import logger from '../../../../utils/logger';
import { getCurrentFhirClient } from "../helpers/fhir-client-helper";
import { computeResourceHash } from "../helpers/resource-hash-helper";
import { validateFhirResourceStructure } from "../helpers/resource-validator";
import { enhanceResourcesWithValidationData } from "../helpers/resource-enhancer";

/**
 * Setup FHIR resource CRUD routes
 * Handles individual resource operations (GET, PUT)
 */
export function setupResourceRoutes(app: Express, fhirClient: FhirClient | null) {
  // PUT /api/fhir/resources/:resourceType/:id - Update a resource
  app.put("/api/fhir/resources/:resourceType/:id", async (req, res) => {
    try {
      const { resourceType, id } = req.params;
      const rawResource = req.body;
      const ifMatch = req.headers['if-match'] as string | undefined;
      
      // Strip internal fields
      const { _dbId, _validationSummary, resourceId, ...resource } = rawResource;
      
      // Validate resource structure
      const fhirValidation = validateFhirResourceStructure(resource);
      if (!fhirValidation.valid) {
        return res.status(422).json({
          success: false,
          error: 'FHIR validation failed',
          details: fhirValidation.errors,
        });
      }
      
      // Ensure resource type and ID match
      if (resource.resourceType !== resourceType) {
        return res.status(400).json({
          success: false,
          error: 'Resource type mismatch',
          message: `Expected ${resourceType}, got ${resource.resourceType}`,
        });
      }
      
      if (resource.id !== id) {
        return res.status(400).json({
          success: false,
          error: 'Resource ID mismatch',
          message: `Expected ${id}, got ${resource.id}`,
        });
      }
      
      // Get FHIR client
      const currentFhirClient = getCurrentFhirClient(fhirClient);
      if (!currentFhirClient) {
        return res.status(503).json({
          success: false,
          error: 'FHIR client not initialized',
          message: 'Cannot edit resource: FHIR server connection not available'
        });
      }
      
      // Fetch current resource
      let currentResource: any;
      try {
        currentResource = await currentFhirClient.getResource(resourceType, id);
      } catch (error: any) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          resourceType,
          id,
          details: error.message,
        });
      }
      
      if (!currentResource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
          resourceType,
          id,
        });
      }
      
      // Check If-Match for optimistic concurrency control
      if (ifMatch) {
        const currentVersionId = currentResource.meta?.versionId;
        const currentETag = currentVersionId ? `W/"${currentVersionId}"` : undefined;
        
        if (currentETag && ifMatch !== currentETag && ifMatch !== currentVersionId) {
          return res.status(409).json({
            success: false,
            error: 'Version conflict',
            message: 'Resource has been modified by another user',
            currentVersionId,
            requestedVersionId: ifMatch,
          });
        }
      }
      
      // Compute hashes for audit trail
      const beforeHash = computeResourceHash(currentResource);
      const afterHash = computeResourceHash(resource);
      
      // Update resource on FHIR server
      let updatedResource: any;
      try {
        const baseUrl = (currentFhirClient as any).baseUrl;
        const headers = (currentFhirClient as any).headers;
        
        const updateResponse = await fetch(`${baseUrl}/${resourceType}/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(resource),
        });
        
        if (!updateResponse.ok) {
          const errorBody = await updateResponse.text();
          return res.status(updateResponse.status).json({
            success: false,
            error: 'FHIR server rejected the update',
            message: `HTTP ${updateResponse.status}: ${updateResponse.statusText}`,
            details: errorBody.substring(0, 1000),
          });
        }
        
        updatedResource = await updateResponse.json();
      } catch (error: any) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update resource on FHIR server',
          message: error.message || 'Unknown error',
        });
      }
      
      // Get FHIR version
      let fhirVersion: string | null = null;
      try {
        fhirVersion = await currentFhirClient.getFhirVersion();
      } catch (error) {
        logger.warn('[Edit] Could not detect FHIR version:', error);
      }
      
      // Create audit record
      const serverId = 1; // TODO: Get from active server
      try {
        await db.insert(editAuditTrail).values({
          serverId,
          resourceType,
          fhirId: id,
          beforeHash,
          afterHash,
          fhirVersion: fhirVersion || undefined,
          editedAt: new Date(),
          editedBy: 'system',
          operation: 'single_edit',
          result: 'success',
          versionBefore: currentResource.meta?.versionId,
          versionAfter: updatedResource.meta?.versionId,
        });
        
        logger.info(`[Audit] Recorded successful edit: ${resourceType}/${id}`);
      } catch (auditError) {
        logger.error('[Audit] Failed to record audit trail:', auditError);
      }
      
      // Check auto-revalidation settings
      let queuedRevalidation = false;
      try {
        const settingsResult = await db
          .select()
          .from(validationSettings)
          .where(eq(validationSettings.serverId, serverId))
          .limit(1);
        
        const settings: ValidationSettings | null = settingsResult.length > 0 
          ? (settingsResult[0] as any).settings
          : null;
        
        const shouldAutoRevalidate = settings?.autoRevalidateAfterEdit !== false;
        
        if (shouldAutoRevalidate) {
          validationQueue.enqueue({
            serverId,
            resourceType,
            fhirId: id,
            priority: 'high',
          });
          queuedRevalidation = true;
          logger.info(`[Edit] Auto-revalidation queued for ${resourceType}/${id}`);
        }
      } catch (settingsError) {
        logger.warn('[Edit] Failed to check auto-revalidation settings:', settingsError);
        validationQueue.enqueue({
          serverId,
          resourceType,
          fhirId: id,
          priority: 'high',
        });
        queuedRevalidation = true;
      }
      
      res.json({
        success: true,
        resourceType,
        id,
        versionId: updatedResource.meta?.versionId,
        beforeHash,
        afterHash,
        changed: beforeHash !== afterHash,
        queuedRevalidation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating resource:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update resource',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/fhir/resources/:id - Get a single resource by ID
  app.get("/api/fhir/resources/:id", async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;
    let { resourceType } = req.query;
    const requestId = `${resourceType || 'unknown'}/${id}`;
    
    try {
      console.log(`[FHIR API] [${requestId}] Resource detail request started`);

      // If resourceType is provided, use it directly
      if (resourceType) {
        try {
          const currentFhirClient = getCurrentFhirClient(fhirClient);
          if (!currentFhirClient) {
            return res.status(503).json({ message: "FHIR client not initialized", requestId });
          }
          
          // Race with 1.5-second timeout for external FHIR server (reduced from 3s when resourceType is known)
          const resource = await Promise.race([
            currentFhirClient.getResource(resourceType as string, id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('External FHIR server timeout after 1.5s')), 1500)
            )
          ]);
          
          if (!resource) {
            return res.status(404).json({ 
              message: `Resource ${resourceType}/${id} not found`,
              resourceType, id, requestId
            });
          }

          const enhancedResources = await enhanceResourcesWithValidationData([resource]);
          const totalDuration = Date.now() - startTime;
          console.log(`[FHIR API] [${requestId}] Completed from FHIR server (${totalDuration}ms)`);
          res.json(enhancedResources[0]);
          return;
          
        } catch (error: any) {
          if (error.message?.includes('404') || error.message?.includes('not found') || error.statusCode === 404) {
            return res.status(404).json({ 
              message: `Resource ${resourceType}/${id} not found`,
              resourceType, id, requestId
            });
          }
          // FHIR server error - return 503 Service Unavailable
          console.error(`[FHIR API] [${requestId}] FHIR server error: ${error.message}`);
          return res.status(503).json({
            message: 'FHIR server is currently unavailable',
            error: error.message,
            resourceType, id, requestId
          });
        }
      }

      // Try common resource types to auto-detect resource type from ID
      const commonTypes = ['Patient', 'Observation', 'Encounter', 'Condition', 'DiagnosticReport', 
                          'Medication', 'MedicationRequest', 'Procedure', 'AllergyIntolerance', 
                          'Immunization', 'DocumentReference', 'Organization', 'Practitioner', 'AuditEvent'];
      
      for (const type of commonTypes) {
        try {
          const currentFhirClient = getCurrentFhirClient(fhirClient);
          if (!currentFhirClient) {
            return res.status(503).json({ message: "FHIR client not initialized", requestId });
          }
          
          // Race with 1-second timeout per type (reduced from 3s to speed up detection)
          const resource = await Promise.race([
            currentFhirClient.getResource(type, id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 1000)
            )
          ]);
          
          if (resource) {
            const enhancedResources = await enhanceResourcesWithValidationData([resource]);
            res.json(enhancedResources[0]);
            return;
          }
        } catch (error: any) {
          // Continue to next type
        }
      }

      // Not found with any type
      return res.status(404).json({ 
        message: `Resource ${id} not found with any resource type`,
        id, requestId, triedTypes: commonTypes
      });

    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      console.error(`[FHIR API] [${requestId}] Error (${totalDuration}ms):`, error.message);
      
      res.status(500).json({ 
        message: "Failed to fetch resource",
        error: error.message,
        requestId,
        duration: totalDuration
      });
    }
  });
}

