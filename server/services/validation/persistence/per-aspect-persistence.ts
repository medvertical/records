import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { and, eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

import {
  validationResultsPerAspect,
  validationMessages,
  validationMessageGroups,
  type ValidationAspectType,
  type ValidationSeverityType,
} from '../../../../shared/schema-validation-per-aspect';
import { normalizeCanonicalPath, normalizeMessageText } from '../../../../shared/validation-types';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export type EngineAspectIssue = {
  id?: string;
  aspect: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  code?: string;
  timestamp?: Date | string;
};

export type EngineAspectResult = {
  aspect: string;
  isValid: boolean;
  issues: EngineAspectIssue[];
  validationTime?: number;
};

export type EngineValidationResult = {
  resourceId: string;
  resourceType: string;
  isValid: boolean;
  issues: EngineAspectIssue[];
  aspects: EngineAspectResult[];
  validatedAt: Date | string;
  fhirVersion?: 'R4' | 'R5' | 'R6'; // Task 2.11: FHIR version
};

export type SimplifiedSettingsSnapshot = {
  aspects: Record<ValidationAspectType, { enabled: boolean; timeoutMs?: number }>;
};

export function computeSettingsSnapshotHash(snapshot: SimplifiedSettingsSnapshot): string {
  const normalized = JSON.stringify(snapshot.aspects, Object.keys(snapshot.aspects).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function computeMessageSignature(input: {
  aspect: ValidationAspectType;
  severity: ValidationSeverityType;
  code?: string | null;
  canonicalPath: string;
  ruleId?: string | null;
  normalizedText: string;
}): string {
  const parts = [
    input.aspect.toLowerCase(),
    input.severity.toLowerCase(),
    (input.code || '').trim().toLowerCase(),
    input.canonicalPath,
    (input.ruleId || '').trim().toLowerCase(),
    input.normalizedText,
  ].join('|');
  return crypto.createHash('sha256').update(parts).digest('hex');
}

function mapSeverity(sev: 'error' | 'warning' | 'info'): ValidationSeverityType {
  if (sev === 'info') return 'information';
  return sev;
}

export async function persistEngineResultPerAspect(params: {
  serverId: number;
  resourceType: string;
  fhirId: string;
  settingsSnapshot: SimplifiedSettingsSnapshot;
  engineResult: EngineValidationResult;
}): Promise<void> {
  const { serverId, resourceType, fhirId, settingsSnapshot, engineResult } = params;
  const settingsHash = computeSettingsSnapshotHash(settingsSnapshot);
  
  console.log(`[persistEngineResultPerAspect] Starting persistence for ${resourceType}/${fhirId}`, {
    serverId,
    settingsHash,
    aspectCount: engineResult.aspects?.length || 0,
    hasAspects: !!engineResult.aspects,
  });
  
  // Task 2.11: Get FHIR version from engine result, default to R4
  const fhirVersion = engineResult.fhirVersion || 'R4';

  if (!engineResult.aspects || engineResult.aspects.length === 0) {
    console.warn(`[persistEngineResultPerAspect] No aspects found in engine result for ${resourceType}/${fhirId}`);
    return;
  }

  for (const aspectResult of engineResult.aspects) {
    const aspect = aspectResult.aspect as ValidationAspectType;
    console.log(`[persistEngineResultPerAspect] Persisting aspect ${aspect} for ${resourceType}/${fhirId}`);

    // Severity counts
    const errorCount = aspectResult.issues.filter(i => i.severity === 'error').length;
    const warningCount = aspectResult.issues.filter(i => i.severity === 'warning').length;
    const informationCount = aspectResult.issues.filter(i => i.severity === 'info').length;

    // Remove existing row for (serverId, resourceType, fhirId, aspect, settingsHash)
    await db.delete(validationResultsPerAspect).where(
      and(
        eq(validationResultsPerAspect.serverId, serverId),
        eq(validationResultsPerAspect.resourceType, resourceType),
        eq(validationResultsPerAspect.fhirId, fhirId),
        eq(validationResultsPerAspect.aspect, aspect),
        eq(validationResultsPerAspect.settingsSnapshotHash, settingsHash),
      )
    );

    // Insert new per-aspect row (Task 2.11: Include fhirVersion)
    const inserted = await db.insert(validationResultsPerAspect).values({
      serverId,
      resourceType,
      fhirId,
      aspect,
      fhirVersion, // Task 2.11: Store FHIR version
      isValid: aspectResult.isValid,
      errorCount,
      warningCount,
      informationCount,
      score: aspectResult.isValid ? (warningCount > 0 ? Math.max(0, 100 - warningCount * 10) : 100) : 0,
      settingsSnapshotHash: settingsHash,
      durationMs: aspectResult.validationTime ?? 0,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    }).returning({ id: validationResultsPerAspect.id });

    const validationResultId = inserted[0]?.id;
    if (!validationResultId) {
      console.error(`[persistEngineResultPerAspect] Failed to insert validation result for ${aspect} aspect of ${resourceType}/${fhirId}`);
      continue;
    }
    
    console.log(`[persistEngineResultPerAspect] Successfully inserted ${aspect} aspect (id: ${validationResultId}) for ${resourceType}/${fhirId}`);

    // Remove previous messages for this result + aspect (optional; can keep history)
    await db.delete(validationMessages).where(
      and(
        eq(validationMessages.validationResultId, validationResultId)
      )
    );

    // Store messages and update groups
    for (const issue of aspectResult.issues) {
      const severity = mapSeverity(issue.severity);
      const pathNorm = normalizeCanonicalPath(issue.path || '', 256);
      const textNorm = normalizeMessageText(issue.message || '', 512);

      const signature = computeMessageSignature({
        aspect,
        severity,
        code: issue.code || null,
        canonicalPath: pathNorm.normalized,
        ruleId: null,
        normalizedText: textNorm.normalized,
      });

      // Task 2.11: Insert validation message with FHIR version
      await db.insert(validationMessages).values({
        validationResultId,
        serverId,
        resourceType,
        fhirId,
        aspect,
        fhirVersion, // Task 2.11: Store FHIR version
        severity,
        code: issue.code || null,
        canonicalPath: pathNorm.normalized,
        text: issue.message,
        normalizedText: textNorm.normalized,
        ruleId: null,
        signature,
        signatureVersion: 1,
        pathTruncated: pathNorm.truncated,
        textTruncated: textNorm.truncated,
      });

      // Upsert message group with atomic increment
      // Try to insert; if exists (unique constraint on serverId + signature), update counter atomically
      const insertResult = await db
        .insert(validationMessageGroups)
        .values({
          serverId,
          signature,
          signatureVersion: 1,
          aspect,
          severity,
          code: issue.code || null,
          canonicalPath: pathNorm.normalized,
          sampleText: issue.message,
          totalResources: 1,
        })
        .onConflictDoUpdate({
          target: [validationMessageGroups.serverId, validationMessageGroups.signature],
          set: {
            // Atomic increment using SQL
            totalResources: sql`${validationMessageGroups.totalResources} + 1`,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: validationMessageGroups.id });
    }
  }
}


