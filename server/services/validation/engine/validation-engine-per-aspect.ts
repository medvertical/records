import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { 
  validationResultsPerAspect, 
  validationMessages,
  validationMessageGroups,
  type ValidationAspectType,
  type ValidationSeverityType
} from '../../../../shared/schema-validation-per-aspect';
import { 
  normalizeCanonicalPath, 
  normalizeMessageText,
  computeValidationScore 
} from '../../../../shared/validation-types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

/**
 * Settings snapshot for deterministic invalidation
 */
export interface ValidationSettingsSnapshot {
  aspects: {
    structural: { enabled: boolean; timeoutMs?: number };
    profile: { enabled: boolean; timeoutMs?: number };
    terminology: { enabled: boolean; timeoutMs?: number };
    reference: { enabled: boolean; timeoutMs?: number };
    businessRule: { enabled: boolean; timeoutMs?: number };
    metadata: { enabled: boolean; timeoutMs?: number };
  };
}

/**
 * Default timeouts per aspect (in milliseconds)
 */
const ASPECT_TIMEOUTS: Record<ValidationAspectType, number> = {
  structural: 5000,
  profile: 45000,
  terminology: 60000,
  reference: 30000,
  businessRule: 30000,
  metadata: 5000,
};

/**
 * Compute SHA-256 hash for settings snapshot
 */
export function computeSettingsSnapshotHash(snapshot: ValidationSettingsSnapshot): string {
  const normalized = JSON.stringify(snapshot.aspects, Object.keys(snapshot.aspects).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Compute message signature (SHA-256)
 */
export function computeMessageSignature(
  aspect: string,
  severity: string,
  code: string | undefined,
  canonicalPath: string,
  ruleId: string | undefined,
  normalizedText: string
): string {
  const components = [
    aspect.toLowerCase(),
    severity.toLowerCase(),
    code ? code.trim().toLowerCase() : '',
    canonicalPath,
    ruleId ? ruleId.trim().toLowerCase() : '',
    normalizedText
  ].join('|');
  
  return crypto.createHash('sha256').update(components).digest('hex');
}

/**
 * Raw validation issue from FHIR validator
 */
export interface RawValidationIssue {
  severity: 'error' | 'warning' | 'information';
  code?: string;
  path?: string; // FHIR path (may include array indices)
  diagnostics: string; // Message text
  expression?: string; // FHIRPath expression
  ruleId?: string; // Optional rule identifier
}

/**
 * Per-aspect validation result
 */
export interface PerAspectValidationResult {
  aspect: ValidationAspectType;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  score: number;
  durationMs: number;
  issues: RawValidationIssue[];
}

/**
 * Validation Engine - Per-Aspect
 * Orchestrates validation across all 6 aspects and persists results
 */
export class ValidationEnginePerAspect {
  /**
   * Validate a resource across enabled aspects
   */
  async validateResource(
    serverId: number,
    resourceType: string,
    fhirId: string,
    resource: any,
    settings: ValidationSettingsSnapshot
  ): Promise<{ success: boolean; results: PerAspectValidationResult[] }> {
    const settingsHash = computeSettingsSnapshotHash(settings);
    const results: PerAspectValidationResult[] = [];
    
    // Validate each enabled aspect
    const aspects: ValidationAspectType[] = [
      'structural',
      'profile',
      'terminology',
      'reference',
      'businessRule',
      'metadata'
    ];
    
    for (const aspect of aspects) {
      if (!settings.aspects[aspect]?.enabled) {
        console.log(`Skipping disabled aspect: ${aspect}`);
        continue;
      }
      
      try {
        const result = await this.validateAspect(aspect, resource, settings);
        results.push(result);
        
        // Persist result
        await this.persistAspectResult(
          serverId,
          resourceType,
          fhirId,
          aspect,
          result,
          settingsHash
        );
        
        // Persist messages
        if (result.issues.length > 0) {
          await this.persistMessages(
            serverId,
            resourceType,
            fhirId,
            aspect,
            result.issues
          );
        }
      } catch (error) {
        console.error(`Error validating aspect ${aspect}:`, error);
        // Continue with other aspects (partial results allowed)
      }
    }
    
    return {
      success: results.length > 0,
      results,
    };
  }
  
  /**
   * Validate a single aspect with timeout
   */
  private async validateAspect(
    aspect: ValidationAspectType,
    resource: any,
    settings: ValidationSettingsSnapshot
  ): Promise<PerAspectValidationResult> {
    const startTime = Date.now();
    const timeoutMs = settings.aspects[aspect]?.timeoutMs || ASPECT_TIMEOUTS[aspect];
    
    try {
      // Wrap validation in timeout promise
      const result = await Promise.race([
        this.performAspectValidation(aspect, resource),
        this.timeoutPromise(timeoutMs, aspect),
      ]);
      
      const durationMs = Date.now() - startTime;
      
      return {
        ...result,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Map error to validation result
      const mappedError = this.mapErrorToIssue(aspect, error);
      
      return {
        aspect,
        isValid: false,
        errorCount: 1,
        warningCount: 0,
        informationCount: 0,
        score: 0,
        durationMs,
        issues: [mappedError],
      };
    }
  }
  
  /**
   * Perform actual aspect validation (placeholder)
   */
  private async performAspectValidation(
    aspect: ValidationAspectType,
    resource: any
  ): Promise<Omit<PerAspectValidationResult, 'durationMs'>> {
    // TODO: Implement actual validation logic per aspect
    // For now, return mock results
    const issues: RawValidationIssue[] = [];
    
    // Placeholder: Generate sample issues based on aspect
    if (aspect === 'structural' && !resource.id) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: `${resource.resourceType?.toLowerCase()}.id`,
        diagnostics: `${resource.resourceType}.id: required element is missing`,
        ruleId: 'dom-1',
      });
    }
    
    // Compute severity counts
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const informationCount = issues.filter(i => i.severity === 'information').length;
    
    // Compute score
    const isValid = errorCount === 0;
    const score = computeValidationScore(isValid, errorCount, warningCount, informationCount);
    
    return {
      aspect,
      isValid,
      errorCount,
      warningCount,
      informationCount,
      score,
      issues,
    };
  }
  
  /**
   * Create a timeout promise
   */
  private timeoutPromise(ms: number, aspect: ValidationAspectType): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Validation timeout after ${ms}ms for aspect: ${aspect}`));
      }, ms);
    });
  }
  
  /**
   * Map error to validation issue
   */
  private mapErrorToIssue(aspect: ValidationAspectType, error: any): RawValidationIssue {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Detect timeout errors
    if (errorMessage.includes('timeout')) {
      return {
        severity: 'error',
        code: 'timeout',
        diagnostics: `Validation timeout: ${errorMessage}`,
      };
    }
    
    // Detect network errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
      return {
        severity: 'error',
        code: 'network-error',
        diagnostics: `Network error during ${aspect} validation: ${errorMessage}`,
      };
    }
    
    // Generic error
    return {
      severity: 'error',
      code: 'validation-error',
      diagnostics: `Error during ${aspect} validation: ${errorMessage}`,
    };
  }
  
  /**
   * Persist aspect validation result
   */
  private async persistAspectResult(
    serverId: number,
    resourceType: string,
    fhirId: string,
    aspect: ValidationAspectType,
    result: PerAspectValidationResult,
    settingsSnapshotHash: string
  ): Promise<void> {
    // Delete existing result for this aspect + settings snapshot
    await db.delete(validationResultsPerAspect).where(
      and(
        eq(validationResultsPerAspect.serverId, serverId),
        eq(validationResultsPerAspect.resourceType, resourceType),
        eq(validationResultsPerAspect.fhirId, fhirId),
        eq(validationResultsPerAspect.aspect, aspect),
        eq(validationResultsPerAspect.settingsSnapshotHash, settingsSnapshotHash)
      )
    );
    
    // Insert new result
    await db.insert(validationResultsPerAspect).values({
      serverId,
      resourceType,
      fhirId,
      aspect,
      isValid: result.isValid,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      informationCount: result.informationCount,
      score: result.score,
      settingsSnapshotHash,
      durationMs: result.durationMs,
      validationEngineVersion: '1.0.0',
      detailedResult: {},
    });
  }
  
  /**
   * Persist validation messages with signatures
   */
  private async persistMessages(
    serverId: number,
    resourceType: string,
    fhirId: string,
    aspect: ValidationAspectType,
    issues: RawValidationIssue[]
  ): Promise<void> {
    // Get the validation result ID
    const [result] = await db
      .select({ id: validationResultsPerAspect.id })
      .from(validationResultsPerAspect)
      .where(
        and(
          eq(validationResultsPerAspect.serverId, serverId),
          eq(validationResultsPerAspect.resourceType, resourceType),
          eq(validationResultsPerAspect.fhirId, fhirId),
          eq(validationResultsPerAspect.aspect, aspect)
        )
      )
      .limit(1);
    
    if (!result) {
      console.error('Validation result not found for messages');
      return;
    }
    
    const validationResultId = result.id;
    
    // Process and store each issue
    for (const issue of issues) {
      // Normalize path and text
      const pathResult = normalizeCanonicalPath(issue.path || '', 256);
      const textResult = normalizeMessageText(issue.diagnostics, 512);
      
      // Compute signature
      const signature = computeMessageSignature(
        aspect,
        issue.severity,
        issue.code,
        pathResult.normalized,
        issue.ruleId,
        textResult.normalized
      );
      
      // Insert message
      await db.insert(validationMessages).values({
        validationResultId,
        serverId,
        resourceType,
        fhirId,
        aspect,
        severity: issue.severity as ValidationSeverityType,
        code: issue.code || null,
        canonicalPath: pathResult.normalized,
        text: issue.diagnostics,
        normalizedText: textResult.normalized,
        ruleId: issue.ruleId || null,
        signature,
        signatureVersion: 1,
        pathTruncated: pathResult.truncated,
        textTruncated: textResult.truncated,
      });
      
      // Update or create message group
      await this.updateMessageGroup(
        serverId,
        signature,
        aspect,
        issue.severity as ValidationSeverityType,
        issue.code,
        pathResult.normalized,
        issue.diagnostics
      );
    }
  }
  
  /**
   * Update message group counts (incremental)
   */
  private async updateMessageGroup(
    serverId: number,
    signature: string,
    aspect: ValidationAspectType,
    severity: ValidationSeverityType,
    code: string | undefined,
    canonicalPath: string,
    sampleText: string
  ): Promise<void> {
    // Check if group exists
    const [existing] = await db
      .select()
      .from(validationMessageGroups)
      .where(
        and(
          eq(validationMessageGroups.serverId, serverId),
          eq(validationMessageGroups.signature, signature)
        )
      )
      .limit(1);
    
    if (existing) {
      // Update counts and timestamp
      await db
        .update(validationMessageGroups)
        .set({
          totalResources: existing.totalResources + 1,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(validationMessageGroups.id, existing.id));
    } else {
      // Create new group
      await db.insert(validationMessageGroups).values({
        serverId,
        signature,
        signatureVersion: 1,
        aspect,
        severity,
        code: code || null,
        canonicalPath,
        sampleText,
        totalResources: 1,
      });
    }
  }
  
  /**
   * Invalidate all validation results for a server (when settings change)
   */
  async invalidateAllResults(serverId: number): Promise<{ deleted: number }> {
    const deleted = await db
      .delete(validationResultsPerAspect)
      .where(eq(validationResultsPerAspect.serverId, serverId));
    
    return { deleted: deleted.rowCount || 0 };
  }
  
  /**
   * Invalidate results for a specific resource
   */
  async invalidateResourceResults(
    serverId: number,
    resourceType: string,
    fhirId: string
  ): Promise<void> {
    await db.delete(validationResultsPerAspect).where(
      and(
        eq(validationResultsPerAspect.serverId, serverId),
        eq(validationResultsPerAspect.resourceType, resourceType),
        eq(validationResultsPerAspect.fhirId, fhirId)
      )
    );
  }
}

// Singleton instance
export const validationEnginePerAspect = new ValidationEnginePerAspect();
