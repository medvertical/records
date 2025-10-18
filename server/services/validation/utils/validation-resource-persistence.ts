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
    engineResult: EngineValidationResult,
    settingsUsed?: any
  ): Promise<void> {
    console.error(`[ValidationResourcePersistence] *** STARTING PERSISTENCE for ${resource.resourceType}/${resource.id} (dbId: ${dbResourceId}) ***`);
    console.error(`[ValidationResourcePersistence] *** engineResult.aspects count: ${engineResult.aspects?.length || 0} ***`);
    console.error(`[ValidationResourcePersistence] *** engineResult.aspects:`, JSON.stringify(engineResult.aspects?.map(a => ({
      aspect: a.aspect,
      isValid: a.isValid,
      issuesCount: a.issues?.length || 0
    })), null, 2));
    
    const insertData = this.resultBuilder.buildInsertResult(
      dbResourceId,
      detailedResult,
      resourceHash,
      engineResult
    );

    // Get active server ID
    const activeServer = await storage.getActiveFhirServer();
    const serverId = activeServer?.id || 1;

    console.error(`[ValidationResourcePersistence] *** serverId: ${serverId} ***`);
    console.error(`[ValidationResourcePersistence] Saving validation result for resource ID: ${dbResourceId}`);
    
    // LEGACY TABLE INSERT - COMMENTED OUT (we now use per-aspect tables)
    // The validation_results table is deprecated in favor of validation_results_per_aspect
    // await storage.createValidationResultWithFhirIdentity(
    //   insertData,
    //   serverId,
    //   resource.resourceType,
    //   resource.id
    // );
    
    // Update lastValidated timestamp
    await storage.updateFhirResourceLastValidated(dbResourceId, detailedResult.validatedAt);

    console.error(`[ValidationResourcePersistence] *** CALLING persistPerAspectResults with settingsUsed: ${settingsUsed ? 'YES' : 'NO'} ***`);
    
    // Persist per-aspect results with actual settings
    await this.persistPerAspectResults(serverId, resource, engineResult, settingsUsed);

    console.error(`[ValidationResourcePersistence] *** PERSISTENCE COMPLETE for ${resource.resourceType}/${resource.id} ***`);
    
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
    engineResult: EngineValidationResult,
    settingsUsed?: any
  ): Promise<void> {
    try {
      const { persistEngineResultPerAspect } = await import('../persistence/per-aspect-persistence');
      const { getValidationSettingsService } = await import('../settings/validation-settings-service');
      
      // Use provided settings, or fall back to current settings
      let settingsSnapshot;
      if (settingsUsed) {
        // Convert to simplified snapshot format expected by persistence
        settingsSnapshot = {
          aspects: {
            structural: { enabled: settingsUsed.aspects?.structural?.enabled ?? true },
            profile: { enabled: settingsUsed.aspects?.profile?.enabled ?? true },
            terminology: { enabled: settingsUsed.aspects?.terminology?.enabled ?? true },
            reference: { enabled: settingsUsed.aspects?.reference?.enabled ?? true },
            businessRule: { enabled: settingsUsed.aspects?.businessRule?.enabled ?? true },
            metadata: { enabled: settingsUsed.aspects?.metadata?.enabled ?? true },
          },
        } as any;
      } else {
        // Fall back to current settings if not provided
        const settingsService = getValidationSettingsService();
        const currentSettings = await settingsService.getCurrentSettings();
        settingsSnapshot = {
          aspects: {
            structural: { enabled: currentSettings?.aspects?.structural?.enabled ?? true },
            profile: { enabled: currentSettings?.aspects?.profile?.enabled ?? true },
            terminology: { enabled: currentSettings?.aspects?.terminology?.enabled ?? true },
            reference: { enabled: currentSettings?.aspects?.reference?.enabled ?? true },
            businessRule: { enabled: currentSettings?.aspects?.businessRule?.enabled ?? true },
            metadata: { enabled: currentSettings?.aspects?.metadata?.enabled ?? true },
          },
        } as any;
      }
      
      console.error('[ValidationResourcePersistence] *** SETTINGS SNAPSHOT:', JSON.stringify(settingsSnapshot));
      console.error(`[ValidationResourcePersistence] *** CALLING persistEngineResultPerAspect for ${resource.resourceType}/${resource.id} ***`);
      
      await persistEngineResultPerAspect({
        serverId,
        resourceType: resource.resourceType,
        fhirId: resource.id,
        settingsSnapshot,
        engineResult: engineResult as any,
      });
      
      console.error(`[ValidationResourcePersistence] *** PER-ASPECT PERSISTENCE COMPLETE for ${resource.resourceType}/${resource.id} ***`);
    } catch (e) {
      console.error('[ValidationResourcePersistence] *** FAILED to persist per-aspect results:', e);
      throw e; // Re-throw so we can see the error
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

