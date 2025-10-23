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
import { StructuralValidator } from './structural-validator';
import { ProfileValidator } from './profile-validator';
import { TerminologyValidator } from './terminology-validator';
import { ReferenceValidator } from './reference-validator';
import { BusinessRuleValidator } from './business-rule-validator';
import { MetadataValidator } from './metadata-validator';
import { getValidationTimeouts } from '../../../config/validation-timeouts'; // CRITICAL FIX: Import centralized timeout config
import { getHapiValidationCoordinator, type HapiValidationCoordinator } from './hapi-validation-coordinator';

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
 * Get default timeouts per aspect from centralized configuration
 */
function getAspectTimeouts(): Record<ValidationAspectType, number> {
  const timeouts = getValidationTimeouts();
  
  console.log('[ValidationEnginePerAspect] Loading aspect timeouts from centralized config:', {
    structural: timeouts.validationEngine.structural,
    profile: timeouts.validationEngine.profile,
    terminology: timeouts.validationEngine.terminology,
    reference: timeouts.validationEngine.reference,
    businessRules: timeouts.validationEngine.businessRules,
    metadata: timeouts.validationEngine.metadata,
  });
  
  return {
    structural: timeouts.validationEngine.structural,
    profile: timeouts.validationEngine.profile,
    terminology: timeouts.validationEngine.terminology,
    reference: timeouts.validationEngine.reference,
    businessRule: timeouts.validationEngine.businessRules,
    metadata: timeouts.validationEngine.metadata,
  };
}

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
  private structuralValidator: StructuralValidator;
  private profileValidator: ProfileValidator;
  private terminologyValidator: TerminologyValidator;
  private referenceValidator: ReferenceValidator;
  private businessRuleValidator: BusinessRuleValidator;
  private metadataValidator: MetadataValidator;
  private fhirClient?: any;
  private terminologyClient?: any;
  private fhirVersion: 'R4' | 'R5' | 'R6';

  constructor(
    fhirClient?: any,
    terminologyClient?: any,
    fhirVersion: 'R4' | 'R5' | 'R6' = 'R4'
  ) {
    this.fhirClient = fhirClient;
    this.terminologyClient = terminologyClient;
    this.fhirVersion = fhirVersion;
    
    this.structuralValidator = new StructuralValidator();
    this.profileValidator = new ProfileValidator();
    this.terminologyValidator = new TerminologyValidator();
    this.referenceValidator = new ReferenceValidator();
    this.businessRuleValidator = new BusinessRuleValidator();
    this.metadataValidator = new MetadataValidator();
  }

  /**
   * Validate a resource across enabled aspects
   */
  async validateResource(
    serverId: number,
    resourceType: string,
    fhirId: string,
    resource: any,
    settings: ValidationSettingsSnapshot,
    profileUrl?: string
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
    
    // Check if any aspect uses HAPI engine
    const needsHapiCoordinator = aspects.some(aspect => {
      const aspectSettings = settings.aspects[aspect] as any;
      return aspectSettings?.enabled && aspectSettings?.engine === 'hapi';
    });
    
    // Initialize coordinator once if needed
    let coordinator: HapiValidationCoordinator | undefined;
    if (needsHapiCoordinator) {
      coordinator = getHapiValidationCoordinator();
      const resourceId = `${resourceType}/${fhirId}`;
      
      if (!coordinator.hasBeenInitialized(resourceId)) {
        console.log('[ValidationEnginePerAspect] Initializing HAPI coordinator');
        try {
          await coordinator.initializeForResource(resource, settings as any, profileUrl, this.fhirVersion);
          console.log('[ValidationEnginePerAspect] HAPI coordinator initialized successfully');
        } catch (error) {
          console.warn('[ValidationEnginePerAspect] HAPI coordinator initialization failed:', error);
          // Continue without coordinator - validators will fall back to individual calls
          coordinator = undefined;
        }
      }
    }
    
    for (const aspect of aspects) {
      if (!settings.aspects[aspect]?.enabled) {
        console.log(`Skipping disabled aspect: ${aspect}`);
        continue;
      }
      
      try {
        const result = await this.validateAspect(aspect, resource, settings, profileUrl, coordinator);
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
    settings: ValidationSettingsSnapshot,
    profileUrl?: string,
    coordinator?: HapiValidationCoordinator
  ): Promise<PerAspectValidationResult> {
    const startTime = Date.now();
    const aspectTimeouts = getAspectTimeouts();
    const timeoutMs = settings.aspects[aspect]?.timeoutMs || aspectTimeouts[aspect];
    
    console.log(`[ValidationEnginePerAspect] Validating aspect ${aspect} with timeout: ${timeoutMs}ms`);
    
    try {
      // Wrap validation in timeout promise
      const result = await Promise.race([
        this.performAspectValidation(aspect, resource, settings, profileUrl, coordinator),
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
   * Perform actual aspect validation
   */
  private async performAspectValidation(
    aspect: ValidationAspectType,
    resource: any,
    settings: ValidationSettingsSnapshot,
    profileUrl?: string,
    coordinator?: HapiValidationCoordinator
  ): Promise<Omit<PerAspectValidationResult, 'durationMs'>> {
    const issues: RawValidationIssue[] = [];
    
    // Call the appropriate validator based on aspect
    let validationIssues: any[] = [];
    
    try {
      console.log(`[PerAspect] Validating aspect: ${aspect} for ${resource.resourceType}/${resource.id}`);
      
      switch (aspect) {
        case 'structural':
          console.log(`[PerAspect] Calling structural validator with fhirVersion: ${this.fhirVersion}`);
          validationIssues = await this.structuralValidator.validate(
            resource,
            resource.resourceType,
            this.fhirVersion,
            settings as any,
            coordinator
          );
          console.log(`[PerAspect] Structural validation found ${validationIssues.length} issues`);
          break;
        case 'profile':
          console.log(`[PerAspect] Calling profile validator with profileUrl: ${profileUrl}, fhirVersion: ${this.fhirVersion}`);
          validationIssues = await this.profileValidator.validate(
            resource,
            resource.resourceType,
            profileUrl,
            this.fhirVersion,
            settings,
            coordinator
          );
          console.log(`[PerAspect] Profile validation found ${validationIssues.length} issues`);
          break;
        case 'terminology':
          console.log(`[PerAspect] Calling terminology validator with settings, fhirVersion: ${this.fhirVersion}`);
          validationIssues = await this.terminologyValidator.validate(
            resource,
            resource.resourceType,
            settings as any,
            this.fhirVersion
          );
          console.log(`[PerAspect] Terminology validation found ${validationIssues.length} issues`);
          break;
        case 'reference':
          console.log(`[PerAspect] Calling reference validator with fhirClient: ${!!this.fhirClient}, fhirVersion: ${this.fhirVersion}`);
          validationIssues = await this.referenceValidator.validate(
            resource,
            resource.resourceType,
            this.fhirClient,
            this.fhirVersion
          );
          console.log(`[PerAspect] Reference validation found ${validationIssues.length} issues`);
          break;
        case 'businessRule':
          console.log(`[PerAspect] Calling businessRule validator with settings, fhirVersion: ${this.fhirVersion}`);
          validationIssues = await this.businessRuleValidator.validate(
            resource,
            resource.resourceType,
            settings as any,
            this.fhirVersion
          );
          console.log(`[PerAspect] BusinessRule validation found ${validationIssues.length} issues`);
          break;
        case 'metadata':
          console.log(`[PerAspect] Calling metadata validator with fhirVersion: ${this.fhirVersion}`);
          validationIssues = await this.metadataValidator.validate(
            resource,
            resource.resourceType,
            this.fhirVersion,
            coordinator
          );
          console.log(`[PerAspect] Metadata validation found ${validationIssues.length} issues`);
          break;
      }
      
      console.log(`[PerAspect] ${aspect} validation complete. Issues:`, validationIssues);
      
      // Transform ValidationIssue[] to RawValidationIssue[] format
      for (const issue of validationIssues) {
        issues.push({
          severity: issue.severity as 'error' | 'warning' | 'information',
          code: issue.code,
          path: issue.path,
          diagnostics: issue.message,
          expression: issue.expression,
          ruleId: issue.ruleId,
        });
      }
    } catch (error) {
      console.error(`[ValidationEnginePerAspect] Error calling ${aspect} validator:`, error);
      // Add error as validation issue
      issues.push({
        severity: 'error',
        code: 'validator-error',
        diagnostics: `Validator failed: ${error instanceof Error ? error.message : String(error)}`,
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
