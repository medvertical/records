import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { and, eq, notInArray } from 'drizzle-orm';
import { validationResultsPerAspect, validationMessages } from '../../../shared/schema-validation-per-aspect';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export class StaleDataCleanupService {
  /**
   * Remove validation results/messages for resources that no longer exist
   * Caller should pass the current set of existing (serverId, resourceType, fhirId)
   */
  async removeOrphanedValidationData(params: {
    serverId: number;
    existingResourceKeys: { resourceType: string; fhirId: string }[];
  }): Promise<{ removedResults: number; removedMessages: number }> {
    const { serverId, existingResourceKeys } = params;
    const keepPairs = new Set(existingResourceKeys.map(k => `${k.resourceType}:${k.fhirId}`));

    // Find orphaned result rows
    const toDelete = await db
      .select({
        id: validationResultsPerAspect.id,
        resourceType: validationResultsPerAspect.resourceType,
        fhirId: validationResultsPerAspect.fhirId,
      })
      .from(validationResultsPerAspect)
      .where(eq(validationResultsPerAspect.serverId, serverId));

    const orphanIds: number[] = [];
    const orphanResultIds: number[] = [];
    for (const row of toDelete) {
      const key = `${row.resourceType}:${row.fhirId}`;
      if (!keepPairs.has(key)) {
        orphanIds.push(row.id);
        orphanResultIds.push(row.id);
      }
    }

    let removedMessages = 0;
    let removedResults = 0;

    if (orphanResultIds.length > 0) {
      // Delete messages first (FK)
      const delMsg = await db
        .delete(validationMessages)
        .where(and(
          eq(validationMessages.serverId, serverId),
          notInArray(validationMessages.validationResultId, [])
        ));
      removedMessages = delMsg.rowCount || 0;

      // Delete results
      const delRes = await db
        .delete(validationResultsPerAspect)
        .where(eq(validationResultsPerAspect.serverId, serverId));
      removedResults = delRes.rowCount || 0;
    }

    return { removedResults, removedMessages };
  }
}

export const staleDataCleanupService = new StaleDataCleanupService();

