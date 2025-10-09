/**
 * Validation Resource Persistence Helper
 * 
 * Extracted from ConsolidatedValidationService to handle resource persistence
 * and storage operations. Follows Single Responsibility Principle.
 * 
 * Responsibilities:
 * - Ensure resources are stored in database
 * - Persist validation results
 * - Persist per-aspect validation data
 * - Manage validation timestamps
 * 
 * File size: Target <200 lines
 */

import { storage } from '../../../storage';
import { cacheManager } from '../../../utils/cache-manager';
import { getValidationResultBuilder, type DetailedValidationResult } from './validation-result-builder';
import type {
  FhirResourceWithValidation,
  InsertFhirResource,
} from '@shared/schema';
import type {
  ValidationResult as EngineValidationResult,
} from '../types/validation-types';

// ============================================================================
// Validation Resource Persistence Helper
// ============================================================================

export class ValidationResourcePersistence {
  private resultBuilder = getValidationResultBuilder();

  /**
   * Ensure resource is stored in database (create or update)
   */
  async ensureResourceStored(resource: any, resourceHash: string): Promise<{
    dbResource: FhirResourceWithValidation | undefined;
    dbResourceId: number | undefined;
  }> {
    let dbResource: FhirResourceWithValidation | undefined;
    let dbResourceId: number | undefined;

    try {
      // Check if resource exists
      if (resource._dbId) {
        dbResource = await storage.getFhirResourceById(resource._dbId);
        dbResourceId = dbResource?.id;
      } else if (resource.id) {
        const existing = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
        if (existing) {
          dbResourceId = existing.id;
        }
      }

      // Create or update resource
      if (resource.id) {
        const resourceData: InsertFhirResource = {
          resourceType: resource.resourceType,
          resourceId: resource.id,
          versionId: resource.meta?.versionId,
          data: resource,
          resourceHash,
          serverId: 1, // TODO: inject active server
        };

        if (dbResourceId) {
          await storage.updateFhirResource(dbResourceId, resource);
        } else {
          const created = await storage.createFhirResource(resourceData);
          dbResourceId = created.id;
        }

        if (dbResourceId) {
          dbResource = await storage.getFhirResourceById(dbResourceId);
        }
      }
    } catch (error) {
      console.error('[ValidationResourcePersistence] Failed to persist resource:', error);
      throw error;
    }

    return { dbResource, dbResourceId };
  }

  /**
   * Persist validation result to database
   */
  async persistValidationResult(
    dbResourceId: number,
    resource: any,
    detailedResult: DetailedValidationResult,
    resourceHash: string,
    engineResult: EngineValidationResult
  ): Promise<void> {
    const insertData = this.resultBuilder.buildInsertResult(
      dbResourceId,
      detailedResult,
      resourceHash,
      engineResult
    );

    // Get active server ID
    const activeServer = await storage.getActiveFhirServer();
    const serverId = activeServer?.id || 1;

    console.log(`[ValidationResourcePersistence] Saving validation result for resource ID: ${dbResourceId}`);
    
    // Save validation result
    await storage.createValidationResultWithFhirIdentity(
      insertData,
      serverId,
      resource.resourceType,
      resource.id
    );
    
    // Update lastValidated timestamp
    await storage.updateFhirResourceLastValidated(dbResourceId, detailedResult.validatedAt);

    // Persist per-aspect results
    await this.persistPerAspectResults(serverId, resource, engineResult);

    // Clear cache
    cacheManager.clear();
    console.log(`[ValidationResourcePersistence] Cleared cache for resource ID: ${dbResourceId}`);
  }

  /**
   * Persist per-aspect validation results
   */
  private async persistPerAspectResults(
    serverId: number,
    resource: any,
    engineResult: EngineValidationResult
  ): Promise<void> {
    try {
      const { persistEngineResultPerAspect } = await import('../persistence/per-aspect-persistence');
      
      const settingsSnapshot = {
        aspects: {
          structural: { enabled: true },
          profile: { enabled: true },
          terminology: { enabled: true },
          reference: { enabled: true },
          businessRule: { enabled: true },
          metadata: { enabled: true },
        },
      } as any;
      
      await persistEngineResultPerAspect({
        serverId,
        resourceType: resource.resourceType,
        fhirId: resource.id,
        settingsSnapshot,
        engineResult: engineResult as any,
      });
    } catch (e) {
      console.error('[ValidationResourcePersistence] Failed to persist per-aspect results:', e);
    }
  }
}

// Singleton instance
let persistenceInstance: ValidationResourcePersistence | null = null;

/**
 * Get singleton instance of ValidationResourcePersistence
 */
export function getValidationResourcePersistence(): ValidationResourcePersistence {
  if (!persistenceInstance) {
    persistenceInstance = new ValidationResourcePersistence();
  }
  return persistenceInstance;
}

