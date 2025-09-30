import type { ValidationAspectType, ValidationSeverityType } from './schema-validation-per-aspect';

/**
 * Message signature components for grouping identical messages
 */
export interface MessageSignatureComponents {
  aspect: ValidationAspectType;
  severity: ValidationSeverityType;
  code?: string;
  canonicalPath: string; // Normalized path (no array indices)
  ruleId?: string;
  normalizedText: string; // Normalized message text
}

/**
 * Result of signature computation
 */
export interface MessageSignatureResult {
  signature: string; // SHA-256 hash (hex)
  signatureVersion: number;
  components: MessageSignatureComponents;
  pathTruncated: boolean;
  textTruncated: boolean;
}

/**
 * Raw validation message (before normalization)
 */
export interface RawValidationMessage {
  severity: 'error' | 'warning' | 'information';
  code?: string;
  path: string; // Original FHIR path (may include array indices)
  text: string; // Original message text
  ruleId?: string;
  expression?: string; // FHIRPath expression
}

/**
 * Normalized validation message (ready for storage)
 */
export interface NormalizedValidationMessage extends RawValidationMessage {
  canonicalPath: string; // Normalized path
  normalizedText: string; // Normalized text
  signature: string; // SHA-256 hash
  signatureVersion: number;
  pathTruncated: boolean;
  textTruncated: boolean;
}

/**
 * Per-aspect validation result DTO
 */
export interface ValidationResultPerAspectDTO {
  serverId: number;
  resourceType: string;
  fhirId: string;
  aspect: ValidationAspectType;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  score: number;
  settingsSnapshotHash: string;
  validatedAt: Date;
  durationMs?: number;
  messages: NormalizedValidationMessage[];
}

/**
 * Aggregated validation result for a resource across all aspects
 */
export interface AggregatedValidationResult {
  serverId: number;
  resourceType: string;
  fhirId: string;
  settingsSnapshotHash: string;
  validatedAt: Date;
  
  // Per-aspect results
  aspects: {
    [K in ValidationAspectType]?: {
      enabled: boolean;
      isValid: boolean;
      errorCount: number;
      warningCount: number;
      informationCount: number;
      score: number;
      validatedAt?: Date;
    };
  };
  
  // Aggregated scores
  overallScore: number; // Average of enabled aspects
  coverage: number; // Percentage of enabled aspects that have been validated
  
  // Aggregated counts (across enabled aspects)
  totalErrors: number;
  totalWarnings: number;
  totalInformation: number;
}

/**
 * Validation message group DTO (for groups API)
 */
export interface ValidationMessageGroupDTO {
  signature: string;
  aspect: ValidationAspectType;
  severity: ValidationSeverityType;
  code?: string;
  canonicalPath: string;
  sampleMessage: string; // First message text
  totalResources: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/**
 * Group members DTO (for group members API)
 */
export interface ValidationGroupMemberDTO {
  resourceType: string;
  fhirId: string;
  validatedAt: Date;
  perAspect: {
    aspect: ValidationAspectType;
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  }[];
}

/**
 * Resource messages DTO (for resource messages API)
 */
export interface ResourceMessagesDTO {
  serverId: number;
  resourceType: string;
  fhirId: string;
  aspects: {
    aspect: ValidationAspectType;
    messages: {
      id: number;
      severity: ValidationSeverityType;
      code?: string;
      canonicalPath: string;
      path: string; // Original path
      text: string;
      signature: string;
      createdAt: Date;
    }[];
  }[];
}

/**
 * Settings snapshot for validation (canonical format)
 */
export interface ValidationSettingsSnapshot {
  aspects: {
    structural: { enabled: boolean; severity: 'error' | 'warning' | 'information'; timeoutMs: number };
    profile: { enabled: boolean; severity: 'warning' | 'information'; timeoutMs: number };
    terminology: { enabled: boolean; severity: 'warning' | 'information'; timeoutMs: number };
    reference: { enabled: boolean; severity: 'error' | 'warning' | 'information'; timeoutMs: number };
    businessRule: { enabled: boolean; severity: 'error' | 'warning' | 'information'; timeoutMs: number };
    metadata: { enabled: boolean; severity: 'error' | 'warning' | 'information'; timeoutMs: number };
  };
  // Additional settings
  strictMode?: boolean;
  validateExternalReferences?: boolean;
  [key: string]: any; // Allow additional settings
}

/**
 * Compute SHA-256 hash for settings snapshot
 */
export function computeSettingsSnapshotHash(snapshot: ValidationSettingsSnapshot): string {
  // Sort keys for deterministic hash
  const normalized = JSON.stringify(snapshot, Object.keys(snapshot).sort());
  // Use crypto (Node.js) or SubtleCrypto (browser) - implementation in separate file
  return normalized; // Placeholder - actual implementation will use crypto
}

/**
 * Scoring utility function
 * Shared between list and detail views for parity
 */
export function computeValidationScore(
  isValid: boolean,
  errorCount: number,
  warningCount: number,
  informationCount: number
): number {
  if (isValid && errorCount === 0 && warningCount === 0) {
    return 100;
  }
  
  // Errors zero the score
  if (errorCount > 0) {
    return 0;
  }
  
  // Warnings reduce score (max 50% reduction)
  const warningPenalty = Math.min(50, warningCount * 10);
  return Math.max(0, 100 - warningPenalty);
}

/**
 * Aggregate scores across aspects
 * Used for overall resource score
 */
export function aggregateAspectScores(
  aspectResults: Array<{ enabled: boolean; score: number; validated: boolean }>
): { overallScore: number; coverage: number } {
  const enabledAspects = aspectResults.filter(a => a.enabled);
  const validatedEnabledAspects = enabledAspects.filter(a => a.validated);
  
  if (enabledAspects.length === 0) {
    return { overallScore: 0, coverage: 0 };
  }
  
  const coverage = (validatedEnabledAspects.length / enabledAspects.length) * 100;
  
  if (validatedEnabledAspects.length === 0) {
    return { overallScore: 0, coverage: 0 };
  }
  
  const totalScore = validatedEnabledAspects.reduce((sum, a) => sum + a.score, 0);
  const overallScore = Math.round(totalScore / validatedEnabledAspects.length);
  
  return { overallScore, coverage };
}

/**
 * Normalize FHIR path for signature computation
 * Removes array indices: entry[3].item[0].code -> entry.item.code
 */
export function normalizeCanonicalPath(path: string, maxLength: number = 256): { normalized: string; truncated: boolean } {
  let normalized = path
    // Remove array indices
    .replace(/\[\d+\]/g, '')
    // Remove multiple dots
    .replace(/\.{2,}/g, '.')
    // Remove leading/trailing dots
    .replace(/^\.+|\.+$/g, '')
    // Lowercase
    .toLowerCase()
    // Remove whitespace
    .replace(/\s+/g, '');
  
  const truncated = normalized.length > maxLength;
  if (truncated) {
    normalized = normalized.substring(0, maxLength);
  }
  
  return { normalized, truncated };
}

/**
 * Normalize message text for signature computation
 * Trim, collapse whitespace, lowercase, remove control chars
 */
export function normalizeMessageText(text: string, maxLength: number = 512): { normalized: string; truncated: boolean } {
  let normalized = text
    // Trim
    .trim()
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    // Lowercase
    .toLowerCase()
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '');
  
  const truncated = normalized.length > maxLength;
  if (truncated) {
    normalized = normalized.substring(0, maxLength);
  }
  
  return { normalized, truncated };
}
